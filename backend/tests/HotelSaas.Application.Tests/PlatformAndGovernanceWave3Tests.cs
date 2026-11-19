using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application;
using HotelSaas.Application.Banners.Commands.CreateBanner;
using HotelSaas.Application.Banners.Commands.DeleteBanner;
using HotelSaas.Application.Banners.Commands.UpdateBanner;
using HotelSaas.Application.Banners.Queries.GetActiveBanners;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Notifications.Commands.DeleteNotification;
using HotelSaas.Application.Notifications.Commands.MarkAllNotificationsRead;
using HotelSaas.Application.Notifications.Commands.MarkNotificationRead;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using HotelSaas.Application.Notifications.Queries.GetUnreadNotificationCount;
using HotelSaas.Application.Platform.Commands.ApprovePropertyPublish;
using HotelSaas.Application.Platform.Commands.ToggleTenantStatus;
using HotelSaas.Application.Platform.Plans;
using HotelSaas.Application.Platform.Queries.GetDashboardSummary;
using HotelSaas.Application.Platform.Queries.GetPlatformOverview;
using HotelSaas.Application.Platform.Queries.GetPlatformTenants;
using HotelSaas.Application.Subscriptions.Commands.ConfirmSubscriptionPayment;
using HotelSaas.Application.Subscriptions.Commands.InitiateSubscriptionUpgrade;
using HotelSaas.Application.Subscriptions.Queries.GetCurrentSubscription;
using HotelSaas.Application.Subscriptions.Queries.GetSubscriptionPlans;
using HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;
using HotelSaas.Application.SupportGrants.Commands.LogSupportDiagnosticAccess;
using HotelSaas.Application.SupportGrants.Commands.RevokeSupportGrant;
using HotelSaas.Application.SupportGrants.Queries.GetPlatformSupportGrants;
using HotelSaas.Application.SupportGrants.Queries.GetTenantSupportGrants;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HotelSaas.Application.Tests;

/// <summary>
/// Isolated in-memory unit tests covering Wave 3 Platform Governance, SupportAccessGrant (SDD-05 D24),
/// DB-driven Subscription Billing / VNPay IPN, SystemBanners, Notifications REST persistence, and thin controllers.
/// </summary>
public sealed class PlatformAndGovernanceWave3Tests
{
    private sealed class NoopTransaction : IDbContextTransaction
    {
        public Guid TransactionId { get; } = Guid.NewGuid();
        public void Commit() { }
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Dispose() { }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Rollback() { }
        public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class EfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;
        private EfExpressionRewriter(IQueryable effectiveRoot) => _effectiveRoot = effectiveRoot;

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new EfExpressionRewriter(effectiveRoot).Visit(expression);

        public static bool HasIgnoreQueryFilters(Expression expression)
        {
            var finder = new MethodFinder("IgnoreQueryFilters");
            finder.Visit(expression);
            return finder.Found;
        }

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking" or "Include" or "ThenInclude" or "AsSplitQuery")
            {
                return Visit(node.Arguments[0]);
            }

            return base.VisitMethodCall(node);
        }

        protected override Expression VisitConstant(ConstantExpression node)
        {
            if (node.Value != null && node.Value.GetType().IsGenericType)
            {
                var genDef = node.Value.GetType().GetGenericTypeDefinition();
                if (genDef == typeof(InMemoryAsyncDbSet<>) || genDef == typeof(InMemoryAsyncQueryable<>))
                {
                    return _effectiveRoot.Expression;
                }
            }

            return base.VisitConstant(node);
        }

        private sealed class MethodFinder : ExpressionVisitor
        {
            private readonly string _methodName;
            public bool Found { get; private set; }
            public MethodFinder(string methodName) => _methodName = methodName;

            protected override Expression VisitMethodCall(MethodCallExpression node)
            {
                if (node.Method.Name == _methodName)
                {
                    Found = true;
                }
                return base.VisitMethodCall(node);
            }
        }
    }

    private sealed class InMemoryAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public InMemoryAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private sealed class InMemoryAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;
        private readonly ICurrentUserContext _currentUser;

        public InMemoryAsyncQueryProvider(
            List<TEntity> backingData,
            ICurrentTenantService tenantService,
            ICurrentUserContext currentUser)
        {
            _backingData = backingData;
            _tenantService = tenantService;
            _currentUser = currentUser;
        }

        public IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || EfExpressionRewriter.HasIgnoreQueryFilters(expression))
            {
                return _backingData.AsQueryable();
            }

            if (!_tenantService.TenantId.HasValue)
            {
                if (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin)
                {
                    return _backingData.AsQueryable();
                }

                return Array.Empty<TEntity>().AsQueryable();
            }

            var tenantId = _tenantService.TenantId.Value;
            return _backingData
                .Where(e => ((ITenantScopedEntity)e).TenantId == tenantId)
                .AsQueryable();
        }

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(InMemoryAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new InMemoryAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class InMemoryAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public InMemoryAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator()
            => _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TElement>(GetEnumerator());
    }

    private sealed class InMemoryAsyncDbSet<TEntity> : DbSet<TEntity>, IQueryable<TEntity>, IAsyncEnumerable<TEntity>
        where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly InMemoryAsyncQueryProvider<TEntity> _provider;
        private readonly Expression _expression;

        public InMemoryAsyncDbSet(
            List<TEntity> backingData,
            ICurrentTenantService tenantService,
            ICurrentUserContext currentUser)
        {
            _backingData = backingData;
            _provider = new InMemoryAsyncQueryProvider<TEntity>(backingData, tenantService, currentUser);
            _expression = Expression.Constant(this);
        }

        public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator()
            => _provider.ResolveEffectiveQueryable(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TEntity>(GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _backingData.Add(entity);
            return null!;
        }

        public override void AddRange(IEnumerable<TEntity> entities) => _backingData.AddRange(entities);
        public override void AddRange(params TEntity[] entities) => _backingData.AddRange(entities);

        public override EntityEntry<TEntity> Remove(TEntity entity)
        {
            _backingData.Remove(entity);
            return null!;
        }

        public override void RemoveRange(IEnumerable<TEntity> entities)
        {
            foreach (var entity in entities.ToList())
            {
                _backingData.Remove(entity);
            }
        }
    }

    private sealed class StubCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubCurrentPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubCurrentUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "user@hotelsaas.vn";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.SuperAdmin;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; }
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; }
        public StaffRole? StaffRole { get; set; }
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public string? IpAddress { get; set; } = "127.0.0.1";

        public void SetIpAddress(string? ipAddress) => IpAddress = ipAddress;
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }

        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
            IsAuthenticated = true;
        }

        public void SetMembershipContext(
            Guid tenantId,
            TenantStatus tenantStatus,
            Guid? propertyId,
            PropertyStatus? propertyStatus,
            StaffRole? staffRole,
            Guid? roleId,
            bool isTenantWide)
        {
            TenantId = tenantId;
            TenantStatus = tenantStatus;
            PropertyId = propertyId;
            PropertyStatus = propertyStatus;
            StaffRole = staffRole;
            RoleId = roleId;
            IsTenantWide = isTenantWide;
        }
    }

    private sealed class FakeDbContext : IApplicationDbContext
    {
        private readonly ICurrentTenantService _tenantService;
        private readonly ICurrentUserContext _currentUser;

        public FakeDbContext(ICurrentTenantService tenantService, ICurrentUserContext currentUser)
        {
            _tenantService = tenantService;
            _currentUser = currentUser;
        }

        public List<User> UserList { get; } = new();
        public List<RefreshToken> RefreshTokenList { get; } = new();
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<AccessRole> AccessRoleList { get; } = new();
        public List<PermissionFunction> PermissionFunctionList { get; } = new();
        public List<RolePermission> RolePermissionList { get; } = new();
        public List<TenantStaff> TenantStaffList { get; } = new();
        public List<RoomType> RoomTypeList { get; } = new();
        public List<Room> RoomList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<Payment> PaymentList { get; } = new();
        public List<Subscription> SubscriptionList { get; } = new();
        public List<SubscriptionPayment> SubscriptionPaymentList { get; } = new();
        public List<SubscriptionPlan> SubscriptionPlanList { get; } = new();
        public List<SystemBanner> SystemBannerList { get; } = new();
        public List<Notification> NotificationList { get; } = new();
        public List<SupportAccessGrant> SupportAccessGrantList { get; } = new();
        public List<SupportAuditLog> SupportAuditLogList { get; } = new();
        public List<PropertySurchargePolicy> PropertySurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RoomTypeRateList { get; } = new();
        public List<RoomTypeRateAudit> RoomTypeRateAuditList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();
        public List<Invoice> InvoiceList { get; } = new();
        public List<InvoiceItem> InvoiceItemList { get; } = new();
        public List<GuestLoyaltyMembership> GuestLoyaltyMembershipList { get; } = new();
        public List<LoyaltyPointTransaction> LoyaltyPointTransactionList { get; } = new();
        public List<TenantContract> TenantContractList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();
        public List<SocialIdentity> SocialIdentityList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();
        public List<HousekeepingTask> HousekeepingTaskList { get; } = new();
        public List<Promotion> PromotionList { get; } = new();
        public List<AiUsageLog> AiUsageLogList { get; } = new();

        public DbSet<User> Users => new InMemoryAsyncDbSet<User>(UserList, _tenantService, _currentUser);
        public DbSet<RefreshToken> RefreshTokens => new InMemoryAsyncDbSet<RefreshToken>(RefreshTokenList, _tenantService, _currentUser);
        public DbSet<Tenant> Tenants => new InMemoryAsyncDbSet<Tenant>(TenantList, _tenantService, _currentUser);
        public DbSet<Property> Properties => new InMemoryAsyncDbSet<Property>(PropertyList, _tenantService, _currentUser);
        public DbSet<AccessRole> AccessRoles => new InMemoryAsyncDbSet<AccessRole>(AccessRoleList, _tenantService, _currentUser);
        public DbSet<PermissionFunction> PermissionFunctions => new InMemoryAsyncDbSet<PermissionFunction>(PermissionFunctionList, _tenantService, _currentUser);
        public DbSet<RolePermission> RolePermissions => new InMemoryAsyncDbSet<RolePermission>(RolePermissionList, _tenantService, _currentUser);
        public DbSet<TenantStaff> TenantStaffMembers => new InMemoryAsyncDbSet<TenantStaff>(TenantStaffList, _tenantService, _currentUser);
        public DbSet<RoomType> RoomTypes => new InMemoryAsyncDbSet<RoomType>(RoomTypeList, _tenantService, _currentUser);
        public DbSet<Room> Rooms => new InMemoryAsyncDbSet<Room>(RoomList, _tenantService, _currentUser);
        public DbSet<Reservation> Reservations => new InMemoryAsyncDbSet<Reservation>(ReservationList, _tenantService, _currentUser);
        public DbSet<Payment> Payments => new InMemoryAsyncDbSet<Payment>(PaymentList, _tenantService, _currentUser);
        public DbSet<Subscription> Subscriptions => new InMemoryAsyncDbSet<Subscription>(SubscriptionList, _tenantService, _currentUser);
        public DbSet<SubscriptionPayment> SubscriptionPayments => new InMemoryAsyncDbSet<SubscriptionPayment>(SubscriptionPaymentList, _tenantService, _currentUser);
        public DbSet<SubscriptionPlan> SubscriptionPlans => new InMemoryAsyncDbSet<SubscriptionPlan>(SubscriptionPlanList, _tenantService, _currentUser);
        public DbSet<SystemBanner> SystemBanners => new InMemoryAsyncDbSet<SystemBanner>(SystemBannerList, _tenantService, _currentUser);
        public DbSet<Notification> Notifications => new InMemoryAsyncDbSet<Notification>(NotificationList, _tenantService, _currentUser);
        public DbSet<SupportAccessGrant> SupportAccessGrants => new InMemoryAsyncDbSet<SupportAccessGrant>(SupportAccessGrantList, _tenantService, _currentUser);
        public DbSet<SupportAuditLog> SupportAuditLogs => new InMemoryAsyncDbSet<SupportAuditLog>(SupportAuditLogList, _tenantService, _currentUser);
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => new InMemoryAsyncDbSet<PropertySurchargePolicy>(PropertySurchargePolicyList, _tenantService, _currentUser);
        public DbSet<RoomTypeRate> RoomTypeRates => new InMemoryAsyncDbSet<RoomTypeRate>(RoomTypeRateList, _tenantService, _currentUser);
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => new InMemoryAsyncDbSet<RoomTypeRateAudit>(RoomTypeRateAuditList, _tenantService, _currentUser);
        public DbSet<AuditLog> AuditLogs => new InMemoryAsyncDbSet<AuditLog>(AuditLogList, _tenantService, _currentUser);
        public DbSet<Invoice> Invoices => new InMemoryAsyncDbSet<Invoice>(InvoiceList, _tenantService, _currentUser);
        public DbSet<InvoiceItem> InvoiceItems => new InMemoryAsyncDbSet<InvoiceItem>(InvoiceItemList, _tenantService, _currentUser);
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => new InMemoryAsyncDbSet<GuestLoyaltyMembership>(GuestLoyaltyMembershipList, _tenantService, _currentUser);
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => new InMemoryAsyncDbSet<LoyaltyPointTransaction>(LoyaltyPointTransactionList, _tenantService, _currentUser);
        public DbSet<TenantContract> TenantContracts => new InMemoryAsyncDbSet<TenantContract>(TenantContractList, _tenantService, _currentUser);
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => new InMemoryAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList, _tenantService, _currentUser);
        public DbSet<SocialIdentity> SocialIdentities => new InMemoryAsyncDbSet<SocialIdentity>(SocialIdentityList, _tenantService, _currentUser);
        public DbSet<GuestReview> GuestReviews => new InMemoryAsyncDbSet<GuestReview>(GuestReviewList, _tenantService, _currentUser);
        public DbSet<HousekeepingTask> HousekeepingTasks => new InMemoryAsyncDbSet<HousekeepingTask>(HousekeepingTaskList, _tenantService, _currentUser);
        public DbSet<Promotion> Promotions => new InMemoryAsyncDbSet<Promotion>(PromotionList, _tenantService, _currentUser);
        public DbSet<AiUsageLog> AiUsageLogs => new InMemoryAsyncDbSet<AiUsageLog>(AiUsageLogList, _tenantService, _currentUser);

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());

        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<int> UpdateRoomStatusAtomicAsync(
            Guid roomId, Guid tenantId, Guid propertyId,
            RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc,
            CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private sealed class TestHarness
    {
        public StubCurrentTenantService TenantService { get; } = new();
        public StubCurrentPropertyService PropertyService { get; } = new();
        public StubCurrentUserContext CurrentUser { get; } = new();
        public FakeDbContext Db { get; }
        public ISender Mediator { get; }
        public IVnpayPaymentService Vnpay { get; }

        public const string TestVnpHashSecret = "WAVE3TESTHASHSECRET1234567890ABCDEF";

        public TestHarness()
        {
            Db = new FakeDbContext(TenantService, CurrentUser);
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Payment:Vnpay:TmnCode"] = "WAVE3TMN",
                    ["Payment:Vnpay:HashSecret"] = TestVnpHashSecret,
                    ["Payment:Vnpay:Url"] = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
                    ["Payment:Vnpay:ReturnUrl"] = "http://localhost:4200/subscriptions"
                })
                .Build();
            Vnpay = new VnpayPaymentService(config);

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddApplication();
            services.AddScoped<IApplicationDbContext>(_ => Db);
            services.AddScoped<ICurrentTenantService>(_ => TenantService);
            services.AddScoped<ICurrentPropertyService>(_ => PropertyService);
            services.AddScoped<ICurrentUserContext>(_ => CurrentUser);
            services.AddScoped<IVnpayPaymentService>(_ => Vnpay);

            var provider = services.BuildServiceProvider();
            Mediator = provider.GetRequiredService<ISender>();
        }
    }

    private static string SignVnpayParams(IDictionary<string, string> parameters, string hashSecret)
    {
        var sorted = new SortedDictionary<string, string>(parameters, StringComparer.Ordinal);
        var sb = new StringBuilder();
        foreach (var (key, value) in sorted)
        {
            if (sb.Length > 0) sb.Append('&');
            sb.Append(key).Append('=').Append(WebUtility.UrlEncode(value));
        }

        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(hashSecret));
        return Convert.ToHexStringLower(hmac.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString())));
    }

    [Fact]
    public async Task T019_PlatformTenants_ToggleStatus_And_ApprovePublish_Work_With_AuditLogs()
    {
        var h = new TestHarness();
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();

        h.Db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Aurora Hospitality",
            Code = "AURORA",
            Slug = "aurora",
            City = "Đà Nẵng",
            Status = TenantStatus.Active,
            SubscriptionTier = SubscriptionTier.Pro,
            CreatedAtUtc = DateTime.UtcNow
        });

        h.Db.Properties.Add(new Property
        {
            Id = propId,
            TenantId = tenantId,
            Name = "Aurora Beachfront",
            Code = "AUR-DN",
            Slug = "aurora-beachfront",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            IsPublished = false,
            CreatedAtUtc = DateTime.UtcNow
        });

        h.Db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = "PRO",
            Name = "Pro",
            MonthlyPrice = 699000m,
            YearlyPrice = 6990000m,
            MaxRooms = 50,
            MaxProperties = 3,
            MaxStaff = 10,
            IsActive = true
        });

        var subId = Guid.NewGuid();
        h.Db.Subscriptions.Add(new Subscription
        {
            Id = subId,
            TenantId = tenantId,
            Tier = SubscriptionTier.Pro,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            PricePerCycle = 699000m,
            CreatedAtUtc = DateTime.UtcNow
        });

        h.Db.SubscriptionPayments.Add(new SubscriptionPayment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SubscriptionId = subId,
            Amount = 699000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.VNPay
        });

        var pendingTenants = await h.Mediator.Send(new GetPlatformTenantsQuery(OnlyPendingPublish: true));
        Assert.Single(pendingTenants);
        Assert.Equal(699000m, pendingTenants[0].TotalSaasPaid);
        Assert.Single(pendingTenants[0].Branches);
        Assert.False(pendingTenants[0].Branches[0].IsPublished);

        var publishResult = await h.Mediator.Send(new ApprovePropertyPublishCommand(propId, true, "Đã kiểm duyệt hồ sơ pháp lý"));
        Assert.True(publishResult.IsPublished);
        Assert.True(h.Db.PropertyList.Single(p => p.Id == propId).IsPublished);

        var toggleResult = await h.Mediator.Send(new ToggleTenantStatusCommand(tenantId, TenantStatus.Suspended, "Quá hạn thanh toán"));
        Assert.Equal(TenantStatus.Suspended, toggleResult.Status);
        Assert.Equal(2, h.Db.AuditLogList.Count);
    }

    [Fact]
    public async Task T019_PlatformOverview_Aggregates_Mrr_CompletedPayments_And_AiTokens()
    {
        var h = new TestHarness();
        var t1 = Guid.NewGuid();
        var t2 = Guid.NewGuid();

        h.Db.Tenants.AddRange(
            new Tenant { Id = t1, Name = "Tenant Monthly", Code = "TM1", Slug = "tm1", Status = TenantStatus.Active },
            new Tenant { Id = t2, Name = "Tenant Annual", Code = "TA2", Slug = "ta2", Status = TenantStatus.Active });

        h.Db.Properties.AddRange(
            new Property { Id = Guid.NewGuid(), TenantId = t1, Name = "B1", Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = Guid.NewGuid(), TenantId = t2, Name = "B2", Status = PropertyStatus.Active, IsPublished = false });

        var s1 = Guid.NewGuid();
        var s2 = Guid.NewGuid();
        h.Db.Subscriptions.AddRange(
            new Subscription { Id = s1, TenantId = t1, Tier = SubscriptionTier.Pro, BillingCycle = BillingCycle.Monthly, Status = SubscriptionStatus.Active, PricePerCycle = 600000m },
            new Subscription { Id = s2, TenantId = t2, Tier = SubscriptionTier.Enterprise, BillingCycle = BillingCycle.Annual, Status = SubscriptionStatus.Active, PricePerCycle = 12000000m });

        h.Db.SubscriptionPayments.AddRange(
            new SubscriptionPayment { Id = Guid.NewGuid(), TenantId = t1, SubscriptionId = s1, Amount = 600000m, Status = PaymentStatus.Completed },
            new SubscriptionPayment { Id = Guid.NewGuid(), TenantId = t2, SubscriptionId = s2, Amount = 12000000m, Status = PaymentStatus.Pending });

        h.Db.AiUsageLogs.AddRange(
            new AiUsageLog { Id = Guid.NewGuid(), TenantId = t1, Feature = "Concierge", InputTokens = 120, OutputTokens = 300, IsSuccess = true },
            new AiUsageLog { Id = Guid.NewGuid(), TenantId = t2, Feature = "Pricing", InputTokens = 80, OutputTokens = 150, IsSuccess = false });

        var overview = await h.Mediator.Send(new GetPlatformOverviewQuery());
        Assert.Equal(2, overview.ActiveTenants);
        Assert.Equal(1, overview.PublishedBranches);
        Assert.Equal(1, overview.PublishPendingBranches);
        Assert.Equal(1600000m, overview.MrrVnd); // 600k + (12M / 12)
        Assert.Equal(19200000m, overview.ArrVnd);
        Assert.Equal(600000m, overview.TotalCollectedSaasRevenue); // Pending excluded
        Assert.Equal(2, overview.TotalAiCalls);
        Assert.Equal(1, overview.SuccessfulAiCalls);
        Assert.Equal(200, overview.TotalAiInputTokens);
        Assert.Equal(450, overview.TotalAiOutputTokens);
    }

    [Fact]
    public async Task T019_DashboardSummary_Aggregates_FullInventory_Without_100Row_Truncation()
    {
        var h = new TestHarness();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        h.TenantService.TenantId = tenantId;
        h.PropertyService.PropertyId = propertyId;
        h.CurrentUser.SetUser(Guid.NewGuid(), "manager@hotel.vn", GlobalUserRole.TenantStaff);
        h.CurrentUser.SetMembershipContext(tenantId, TenantStatus.Active, propertyId, PropertyStatus.Active, StaffRole.Manager, Guid.NewGuid(), isTenantWide: false);

        for (var i = 0; i < 120; i++)
        {
            h.Db.Rooms.Add(new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                RoomNumber = $"R{i + 1:000}",
                Status = i < 45 ? RoomStatus.Occupied : RoomStatus.Clean,
                IsActive = true
            });
        }

        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow,
            HotelSaas.Application.Reservations.Services.ReservationTimeHelper.GetVietnamTimeZone()));

        h.Db.Reservations.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomId = h.Db.RoomList[0].Id,
            Status = ReservationStatus.CheckedIn,
            CheckInDate = todayVn,
            CheckOutDate = todayVn.AddDays(2),
            NumberOfGuests = 3,
            TotalAmount = 2500000m
        });

        h.Db.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ReservationId = h.Db.ReservationList[0].Id,
            Amount = 1500000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Completed,
            PaidAtUtc = DateTime.UtcNow
        });

        var summary = await h.Mediator.Send(new GetDashboardSummaryQuery(propertyId));
        Assert.Equal(120, summary.TotalRooms);
        Assert.Equal(45, summary.OccupiedRooms);
        Assert.Equal(75, summary.CleanRooms);
        Assert.Equal(3, summary.InHouseGuestsCount);
        Assert.Equal(1, summary.TodayCheckInsCount);
        Assert.Equal(1500000m, summary.TodayRevenue);

        // Fail-closed property scoping for branch-bound staff
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            h.Mediator.Send(new GetDashboardSummaryQuery(Guid.NewGuid())));
    }

    [Fact]
    public async Task T019_AdminPlans_CRUD_Validates_Duplicates_And_Calculates_Subscribers()
    {
        var h = new TestHarness();
        var created = await h.Mediator.Send(new CreateAdminPlanCommand(
            "PRO", "Pro Plan", "For growing hotels",
            699000m, 6990000m, 50, 3, 10,
            true, true, true, true, 2, new[] { "VNPay", "Reports" }));

        h.Db.Subscriptions.Add(new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Tier = SubscriptionTier.Pro,
            Status = SubscriptionStatus.Active
        });

        var plans = await h.Mediator.Send(new GetAdminPlansQuery());
        Assert.Single(plans);
        Assert.Equal(1, plans[0].ActiveTenantsCount);
        Assert.Equal(699000m, plans[0].EstimatedMonthlyRevenue);

        await Assert.ThrowsAsync<ConflictException>(() => h.Mediator.Send(new CreateAdminPlanCommand(
            "pro", "Duplicate", null, 100000m, 1000000m, 10, 1, 3,
            false, false, true, false, 1, null)));

        var toggled = await h.Mediator.Send(new ToggleAdminPlanActiveCommand(created.Id));
        Assert.False(toggled.IsActive);
    }

    [Fact]
    public async Task T020_SupportAccessGrant_Enforces_Window_OwnerRole_Revocation_And_FailClosed_Diagnostics()
    {
        var h = new TestHarness();
        var tenantId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var supportId = Guid.NewGuid();
        var otherSupportId = Guid.NewGuid();

        h.Db.Tenants.Add(new Tenant { Id = tenantId, Name = "Saigon Boutique", Code = "SGB", Slug = "sgb" });
        h.Db.Properties.Add(new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "District 1", Code = "D1", Status = PropertyStatus.Active });
        h.Db.Users.AddRange(
            new User { Id = supportId, Email = "support1@hotelsaas.vn", FullName = "Support One", GlobalRole = GlobalUserRole.SuperAdmin, IsActive = true },
            new User { Id = otherSupportId, Email = "support2@hotelsaas.vn", FullName = "Support Two", GlobalRole = GlobalUserRole.SuperAdmin, IsActive = true },
            new User { Id = managerId, Email = "mgr@sgb.vn", FullName = "Manager", GlobalRole = GlobalUserRole.TenantStaff, IsActive = true });

        h.TenantService.TenantId = tenantId;

        // 1. Manager (non-Owner) forbidden
        h.CurrentUser.SetUser(managerId, "mgr@sgb.vn", GlobalUserRole.TenantStaff);
        h.CurrentUser.SetMembershipContext(tenantId, TenantStatus.Active, null, null, StaffRole.Manager, Guid.NewGuid(), true);
        await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new CreateSupportGrantCommand(
            supportId, "DIAGNOSTIC", "Kiểm tra hóa đơn", DateTime.UtcNow.AddHours(2))));

        // 2. Owner context
        h.CurrentUser.SetUser(ownerId, "owner@sgb.vn", GlobalUserRole.TenantStaff);
        h.CurrentUser.SetMembershipContext(tenantId, TenantStatus.Active, null, null, StaffRole.Owner, Guid.NewGuid(), true);

        // Reject < 15 minutes
        await Assert.ThrowsAsync<ValidationException>(() => h.Mediator.Send(new CreateSupportGrantCommand(
            supportId, "READ_ONLY", "Quá ngắn hạn", DateTime.UtcNow.AddMinutes(5))));

        // Reject > 72 hours
        await Assert.ThrowsAsync<ValidationException>(() => h.Mediator.Send(new CreateSupportGrantCommand(
            supportId, "READ_ONLY", "Quá dài hạn", DateTime.UtcNow.AddHours(75))));

        // Reject invalid scope
        await Assert.ThrowsAsync<ValidationException>(() => h.Mediator.Send(new CreateSupportGrantCommand(
            supportId, "FULL_WRITE", "Sai scope", DateTime.UtcNow.AddHours(2))));

        // Reject non-SuperAdmin target
        await Assert.ThrowsAsync<BadRequestException>(() => h.Mediator.Send(new CreateSupportGrantCommand(
            managerId, "READ_ONLY", "Nhầm user", DateTime.UtcNow.AddHours(2))));

        // Valid creation writes GRANT_CREATED SupportAuditLog
        var grant = await h.Mediator.Send(new CreateSupportGrantCommand(
            supportId, "DIAGNOSTIC", "Kiểm tra sự cố xuất hóa đơn VAT", DateTime.UtcNow.AddHours(4)));
        Assert.Equal("ACTIVE", grant.Status);
        Assert.Single(h.Db.SupportAuditLogList);
        Assert.Equal("GRANT_CREATED", h.Db.SupportAuditLogList[0].Action);

        // 3. Support user mismatch blocked (fail-closed)
        h.TenantService.TenantId = null;
        h.CurrentUser.SetUser(otherSupportId, "support2@hotelsaas.vn", GlobalUserRole.SuperAdmin);
        await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new LogSupportDiagnosticAccessCommand(grant.Id)));

        // 4. Target support user succeeds & logs VIEW_DIAGNOSTICS
        h.CurrentUser.SetUser(supportId, "support1@hotelsaas.vn", GlobalUserRole.SuperAdmin);
        var snapshot = await h.Mediator.Send(new LogSupportDiagnosticAccessCommand(grant.Id, "/api/platform/support-grants/diag"));
        Assert.Equal(tenantId, snapshot.TenantId);
        Assert.Equal(1, snapshot.PropertyCount);
        Assert.Contains(h.Db.SupportAuditLogList, l => l.Action == "VIEW_DIAGNOSTICS" && l.ActorUserId == supportId);

        // 5. Expired grant blocked
        var expiredEntity = new SupportAccessGrant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            GrantedByUserId = ownerId,
            TargetSupportUserId = supportId,
            Scope = "READ_ONLY",
            Reason = "Expired test",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1),
            CreatedAtUtc = DateTime.UtcNow.AddHours(-2)
        };
        h.Db.SupportAccessGrants.Add(expiredEntity);
        await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new LogSupportDiagnosticAccessCommand(expiredEntity.Id)));

        // 6. Owner revokes grant -> immediate fail-closed block
        h.TenantService.TenantId = tenantId;
        h.CurrentUser.SetUser(ownerId, "owner@sgb.vn", GlobalUserRole.TenantStaff);
        h.CurrentUser.SetMembershipContext(tenantId, TenantStatus.Active, null, null, StaffRole.Owner, Guid.NewGuid(), true);
        var revoked = await h.Mediator.Send(new RevokeSupportGrantCommand(grant.Id, "Đã xử lý xong"));
        Assert.Equal("REVOKED", revoked.Status);

        h.TenantService.TenantId = null;
        h.CurrentUser.SetUser(supportId, "support1@hotelsaas.vn", GlobalUserRole.SuperAdmin);
        await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new LogSupportDiagnosticAccessCommand(grant.Id)));
    }

    [Fact]
    public async Task T020_SubscriptionUpgrade_Uses_DbPlans_PendingPayment_And_VnpayChecksum()
    {
        var h = new TestHarness();
        var tenantId = Guid.NewGuid();
        var subId = Guid.NewGuid();

        h.Db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Mekong Hotel",
            Code = "MKG",
            Slug = "mekong",
            SubscriptionTier = SubscriptionTier.Basic
        });

        h.Db.SubscriptionPlans.AddRange(
            new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Code = "STARTER",
                Name = "Starter Live",
                MonthlyPrice = 350000m,
                YearlyPrice = 3500000m,
                MaxRooms = 20,
                MaxProperties = 1,
                MaxStaff = 5,
                SortOrder = 1,
                IsActive = true
            },
            new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Code = "PRO",
                Name = "Pro Live 2026",
                MonthlyPrice = 790000m,
                YearlyPrice = 7900000m,
                MaxRooms = 65,
                MaxProperties = 4,
                MaxStaff = 15,
                HasVnPay = true,
                HasAdvancedReports = true,
                SortOrder = 2,
                IsActive = true
            });

        h.Db.Subscriptions.Add(new Subscription
        {
            Id = subId,
            TenantId = tenantId,
            Tier = SubscriptionTier.Basic,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            PricePerCycle = 350000m,
            CurrentPeriodStartUtc = DateTime.UtcNow.AddDays(-5),
            CurrentPeriodEndUtc = DateTime.UtcNow.AddDays(25)
        });

        h.TenantService.TenantId = tenantId;
        h.CurrentUser.SetUser(Guid.NewGuid(), "owner@mekong.vn", GlobalUserRole.TenantStaff);
        h.CurrentUser.SetMembershipContext(tenantId, TenantStatus.Active, null, null, StaffRole.Owner, Guid.NewGuid(), true);

        // Live catalog comes from DB SubscriptionPlans
        var plans = await h.Mediator.Send(new GetSubscriptionPlansQuery());
        Assert.Equal(2, plans.Count);
        Assert.Equal(790000m, plans.Single(p => p.PlanCode == "PRO").MonthlyPrice);

        // Initiate creates Pending payment WITHOUT changing tier!
        var initiation = await h.Mediator.Send(new InitiateSubscriptionUpgradeCommand(
            TargetTier: (int)SubscriptionTier.Pro,
            BillingCycle: BillingCycle.Annual,
            ClientIp: "127.0.0.1"));

        Assert.False(initiation.IsImmediateActivation);
        Assert.Equal("Pending", initiation.PaymentStatus);
        Assert.Equal(7900000m, initiation.Amount);
        Assert.False(string.IsNullOrWhiteSpace(initiation.PaymentUrl));
        Assert.Equal(SubscriptionTier.Basic, h.Db.SubscriptionList.Single(s => s.Id == subId).Tier);

        // Tampered VNPay IPN returns 97 Invalid Checksum and keeps Basic tier
        var invalidIpn = await h.Mediator.Send(new ProcessSubscriptionVnpayIpnCommand(new Dictionary<string, string>
        {
            ["vnp_TxnRef"] = initiation.TransactionRef,
            ["vnp_Amount"] = "790000000",
            ["vnp_ResponseCode"] = "00",
            ["vnp_TransactionStatus"] = "00",
            ["vnp_SecureHash"] = "deadbeef"
        }));
        Assert.Equal("97", invalidIpn.RspCode);
        Assert.Equal(SubscriptionTier.Basic, h.Db.SubscriptionList.Single(s => s.Id == subId).Tier);

        // Tenant user MUST NOT bypass VNPay via unverified ConfirmSubscriptionPaymentCommand on a Pending payment
        var bypassEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            h.Mediator.Send(new ConfirmSubscriptionPaymentCommand(PaymentId: initiation.PaymentId)));
        Assert.Equal("ERR_VNPAY_SIGNATURE_REQUIRED", bypassEx.ErrorCode);
        Assert.Equal(SubscriptionTier.Basic, h.Db.SubscriptionList.Single(s => s.Id == subId).Tier);
        Assert.Equal(PaymentStatus.Pending, h.Db.SubscriptionPaymentList.Single(p => p.Id == initiation.PaymentId).Status);

        // Valid signed VNPay IPN returns 00 and activates Pro Annual
        var vnpParams = new Dictionary<string, string>
        {
            ["vnp_Amount"] = ((long)(initiation.Amount * 100m)).ToString(),
            ["vnp_ResponseCode"] = "00",
            ["vnp_TransactionNo"] = "14009988",
            ["vnp_TransactionStatus"] = "00",
            ["vnp_TxnRef"] = initiation.TransactionRef
        };
        vnpParams["vnp_SecureHash"] = SignVnpayParams(vnpParams, TestHarness.TestVnpHashSecret);

        var validIpn = await h.Mediator.Send(new ProcessSubscriptionVnpayIpnCommand(vnpParams));
        Assert.Equal("00", validIpn.RspCode);
        Assert.Equal(SubscriptionTier.Pro, h.Db.SubscriptionList.Single(s => s.Id == subId).Tier);
        Assert.Equal(BillingCycle.Annual, h.Db.SubscriptionList.Single(s => s.Id == subId).BillingCycle);
        Assert.Equal(PaymentStatus.Completed, h.Db.SubscriptionPaymentList.Single(p => p.Id == initiation.PaymentId).Status);

        // Idempotent confirmation returns AlreadyConfirmed = true
        var idempotent = await h.Mediator.Send(new ConfirmSubscriptionPaymentCommand(PaymentId: initiation.PaymentId));
        Assert.True(idempotent.AlreadyConfirmed);
        Assert.Equal((int)SubscriptionTier.Pro, idempotent.NewTier);
    }

    [Fact]
    public async Task T021_SystemBanners_And_UserScoped_Notifications_Work_Securely()
    {
        var h = new TestHarness();
        var now = DateTime.UtcNow;

        // XSS ImageUrl blocked
        await Assert.ThrowsAsync<ValidationException>(() => h.Mediator.Send(new CreateBannerCommand(
            "Unsafe Banner", "javascript:alert(1)", null, null, null, null, true)));

        var globalBanner = await h.Mediator.Send(new CreateBannerCommand(
            "Bảo trì định kỳ", "https://cdn.hotelsaas.vn/banners/maint.png", "/subscriptions", null,
            now.AddHours(-1), now.AddHours(4), true));

        var proBanner = await h.Mediator.Send(new CreateBannerCommand(
            "Nâng cấp Enterprise", "https://cdn.hotelsaas.vn/banners/ent.png", "/subscriptions", "PRO",
            now.AddHours(-1), now.AddHours(4), true));

        await h.Mediator.Send(new CreateBannerCommand(
            "Banner hết hạn", "https://cdn.hotelsaas.vn/banners/old.png", null, null,
            now.AddDays(-5), now.AddDays(-1), true));

        var proVisible = await h.Mediator.Send(new GetActiveBannersQuery("PRO"));
        Assert.Equal(2, proVisible.Count);

        var starterVisible = await h.Mediator.Send(new GetActiveBannersQuery("STARTER"));
        Assert.Single(starterVisible);
        Assert.Equal(globalBanner.Id, starterVisible[0].Id);

        await h.Mediator.Send(new UpdateBannerCommand(
            proBanner.Id, "Nâng cấp VIP", "https://cdn.hotelsaas.vn/banners/ent.png", "/subscriptions", "PRO",
            now.AddHours(-1), now.AddHours(5), false));
        Assert.Single(await h.Mediator.Send(new GetActiveBannersQuery("PRO")));
        await h.Mediator.Send(new DeleteBannerCommand(proBanner.Id));

        // Notifications strict user + tenant isolation
        var tenantId = Guid.NewGuid();
        var userA = Guid.NewGuid();
        var userB = Guid.NewGuid();

        var notifA1 = new Notification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userA,
            Type = NotificationType.NewBooking,
            Title = "Booking mới #101",
            Message = "Khách Nguyễn Văn A vừa đặt phòng",
            IsRead = false,
            CreatedAtUtc = now
        };
        var notifA2 = new Notification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userA,
            Type = NotificationType.PaymentReceived,
            Title = "Thanh toán #101",
            Message = "Đã nhận 1.500.000đ",
            IsRead = false,
            CreatedAtUtc = now.AddMinutes(-5)
        };
        var notifB = new Notification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userB,
            Type = NotificationType.SystemAlert,
            Title = "Bí mật User B",
            Message = "Chỉ User B thấy",
            IsRead = false,
            CreatedAtUtc = now
        };
        h.Db.Notifications.AddRange(notifA1, notifA2, notifB);

        h.TenantService.TenantId = tenantId;
        h.CurrentUser.SetUser(userA, "a@hotel.vn", GlobalUserRole.TenantStaff);

        var pageA = await h.Mediator.Send(new GetNotificationsQuery(Page: 1, PageSize: 10));
        Assert.Equal(2, pageA.TotalCount);
        Assert.Equal(2, (await h.Mediator.Send(new GetUnreadNotificationCountQuery())).UnreadCount);

        // User A cannot mark or delete User B's notification
        await Assert.ThrowsAsync<NotFoundException>(() => h.Mediator.Send(new MarkNotificationReadCommand(notifB.Id)));
        await Assert.ThrowsAsync<NotFoundException>(() => h.Mediator.Send(new DeleteNotificationCommand(notifB.Id)));

        var readOne = await h.Mediator.Send(new MarkNotificationReadCommand(notifA1.Id));
        Assert.True(readOne.IsRead);
        Assert.Equal(1, (await h.Mediator.Send(new GetUnreadNotificationCountQuery())).UnreadCount);

        var markAll = await h.Mediator.Send(new MarkAllNotificationsReadCommand());
        Assert.Equal(1, markAll.UpdatedCount);
        Assert.Equal(0, (await h.Mediator.Send(new GetUnreadNotificationCountQuery())).UnreadCount);

        await h.Mediator.Send(new DeleteNotificationCommand(notifA1.Id));
        Assert.Single((await h.Mediator.Send(new GetNotificationsQuery())).Items);
        Assert.False(h.Db.NotificationList.Single(n => n.Id == notifB.Id).IsRead);
    }

    [Fact]
    public void Wave3_Controllers_Strictly_Inject_Only_ISender_And_Zero_DbContext()
    {
        var controllerTypes = new[]
        {
            typeof(AdminPlansController),
            typeof(SubscriptionsController),
            typeof(PlatformTenantsController),
            typeof(PlatformOverviewController),
            typeof(TenantsController),
            typeof(AdminBannersController),
            typeof(NotificationsController)
        };

        foreach (var type in controllerTypes)
        {
            var ctors = type.GetConstructors();
            Assert.Single(ctors);
            var ctorParams = ctors[0].GetParameters();
            Assert.Single(ctorParams);
            Assert.Equal(typeof(ISender), ctorParams[0].ParameterType);

            var dbContextFields = type
                .GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                .Where(f => typeof(IApplicationDbContext).IsAssignableFrom(f.FieldType));
            Assert.Empty(dbContextFields);
        }
    }
}
