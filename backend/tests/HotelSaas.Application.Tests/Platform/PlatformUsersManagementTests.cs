using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.Commands.CreatePlatformAdmin;
using HotelSaas.Application.Platform.Commands.TogglePlatformUserStatus;
using HotelSaas.Application.Platform.Commands.UpdatePlatformUserRole;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetPlatformUsers;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace HotelSaas.Application.Tests.Platform;

/// <summary>
/// Isolated non-DB unit tests verifying Wave 5 Platform Users &amp; Admin Account Management CQRS handlers,
/// FluentValidation rules, fail-closed SuperAdmin authorization, self-lock/last-SuperAdmin guardrails,
/// refresh token revocation, and thin controller architecture.
/// </summary>
public sealed class PlatformUsersManagementTests
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

            if (!isScoped ||
                (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin && _currentUser.IsAuthenticated) ||
                EfExpressionRewriter.HasIgnoreQueryFilters(expression))
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
        public string Email { get; set; } = "superadmin@hotelsaas.vn";
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

    private sealed class StubPasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"HASHED::{password}";
        public bool Verify(string password, string hash) => hash == $"HASHED::{password}";
    }

    private sealed class StubApplicationDbContext : IApplicationDbContext
    {
        private readonly ICurrentTenantService _tenantService;
        private readonly ICurrentUserContext _currentUser;

        public StubApplicationDbContext(ICurrentTenantService tenantService, ICurrentUserContext currentUser)
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
        public List<SubscriptionPlan> SubscriptionPlanList { get; } = new();
        public List<SystemBanner> SystemBannerList { get; } = new();
        public List<PropertySurchargePolicy> PropertySurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RoomTypeRateList { get; } = new();
        public List<RoomTypeRateAudit> RoomTypeRateAuditList { get; } = new();
        public List<Invoice> InvoiceList { get; } = new();
        public List<InvoiceItem> InvoiceItemList { get; } = new();
        public List<GuestLoyaltyMembership> GuestLoyaltyMembershipList { get; } = new();
        public List<LoyaltyPointTransaction> LoyaltyPointTransactionList { get; } = new();
        public List<TenantContract> TenantContractList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();
        public List<SocialIdentity> SocialIdentityList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();
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
        public DbSet<SubscriptionPlan> SubscriptionPlans => new InMemoryAsyncDbSet<SubscriptionPlan>(SubscriptionPlanList, _tenantService, _currentUser);
        public DbSet<SystemBanner> SystemBanners => new InMemoryAsyncDbSet<SystemBanner>(SystemBannerList, _tenantService, _currentUser);
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => new InMemoryAsyncDbSet<PropertySurchargePolicy>(PropertySurchargePolicyList, _tenantService, _currentUser);
        public DbSet<RoomTypeRate> RoomTypeRates => new InMemoryAsyncDbSet<RoomTypeRate>(RoomTypeRateList, _tenantService, _currentUser);
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => new InMemoryAsyncDbSet<RoomTypeRateAudit>(RoomTypeRateAuditList, _tenantService, _currentUser);
        public DbSet<Invoice> Invoices => new InMemoryAsyncDbSet<Invoice>(InvoiceList, _tenantService, _currentUser);
        public DbSet<InvoiceItem> InvoiceItems => new InMemoryAsyncDbSet<InvoiceItem>(InvoiceItemList, _tenantService, _currentUser);
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => new InMemoryAsyncDbSet<GuestLoyaltyMembership>(GuestLoyaltyMembershipList, _tenantService, _currentUser);
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => new InMemoryAsyncDbSet<LoyaltyPointTransaction>(LoyaltyPointTransactionList, _tenantService, _currentUser);
        public DbSet<TenantContract> TenantContracts => new InMemoryAsyncDbSet<TenantContract>(TenantContractList, _tenantService, _currentUser);
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => new InMemoryAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList, _tenantService, _currentUser);
        public DbSet<SocialIdentity> SocialIdentities => new InMemoryAsyncDbSet<SocialIdentity>(SocialIdentityList, _tenantService, _currentUser);
        public DbSet<GuestReview> GuestReviews => new InMemoryAsyncDbSet<GuestReview>(GuestReviewList, _tenantService, _currentUser);
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
        public StubPasswordHasher PasswordHasher { get; } = new();
        public StubApplicationDbContext Db { get; }
        public ISender Mediator { get; }

        public TestHarness()
        {
            Db = new StubApplicationDbContext(TenantService, CurrentUser);

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddApplication();
            services.AddScoped<IApplicationDbContext>(_ => Db);
            services.AddScoped<ICurrentTenantService>(_ => TenantService);
            services.AddScoped<ICurrentPropertyService>(_ => PropertyService);
            services.AddScoped<ICurrentUserContext>(_ => CurrentUser);
            services.AddScoped<IPasswordHasher>(_ => PasswordHasher);

            var provider = services.BuildServiceProvider();
            Mediator = provider.GetRequiredService<ISender>();
        }
    }

    [Fact]
    public async Task GetPlatformUsers_ReturnsGlobalSummary_OrdersSuperAdminFirst_FiltersAndHydratesTenants()
    {
        var h = new TestHarness();
        var baseTime = new DateTime(2026, 11, 15, 10, 0, 0, DateTimeKind.Utc);
        var callerAdminId = Guid.NewGuid();
        h.CurrentUser.SetUser(callerAdminId, "root@hotelsaas.vn", GlobalUserRole.SuperAdmin);

        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        h.Db.Tenants.AddRange(
            new Tenant { Id = tenantA, Name = "Aurora Hospitality", Code = "AUR", Slug = "aurora", Status = TenantStatus.Active },
            new Tenant { Id = tenantB, Name = "Saigon Boutique", Code = "SGB", Slug = "sgb", Status = TenantStatus.Active });

        // Force scoped TenantId on context to verify IgnoreQueryFilters() still aggregates across ALL tenants
        h.TenantService.TenantId = tenantA;

        var ownerA = new User
        {
            Id = Guid.NewGuid(),
            Email = "owner@aurora.vn",
            Username = "aurora.owner",
            FullName = "Nguyễn Chủ Khách Sạn",
            PhoneNumber = "0901112222",
            PasswordHash = "SECRET_HASH_1",
            GlobalRole = GlobalUserRole.TenantStaff,
            IsActive = true,
            TenantId = tenantA,
            EmailVerifiedAtUtc = baseTime,
            CreatedAtUtc = baseTime.AddDays(-3)
        };

        var multiStaff = new User
        {
            Id = Guid.NewGuid(),
            Email = "ops@sgb.vn",
            Username = "sgb.ops",
            FullName = "Phạm Quản Lý Chuỗi",
            PhoneNumber = "0912345678",
            PasswordHash = "SECRET_HASH_2",
            GlobalRole = GlobalUserRole.TenantStaff,
            IsActive = true,
            TenantId = null,
            EmailVerifiedAtUtc = baseTime,
            PhoneVerifiedAtUtc = baseTime,
            CreatedAtUtc = baseTime.AddDays(-1)
        };

        var customerActive = new User
        {
            Id = Guid.NewGuid(),
            Email = "guest1@gmail.com",
            Username = "guest1",
            FullName = "Lê Minh Khách",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true,
            CreatedAtUtc = baseTime
        };

        var customerLocked = new User
        {
            Id = Guid.NewGuid(),
            Email = "locked@gmail.com",
            Username = "locked.guest",
            FullName = "Trần Tài Khoản Khóa",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = false,
            CreatedAtUtc = baseTime.AddDays(-5)
        };

        var superAdmin = new User
        {
            Id = callerAdminId,
            Email = "root@hotelsaas.vn",
            Username = "root",
            FullName = "Super Admin Nền Tảng",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = true,
            EmailVerifiedAtUtc = baseTime,
            PhoneVerifiedAtUtc = baseTime,
            CreatedAtUtc = baseTime.AddDays(-10)
        };

        h.Db.Users.AddRange(ownerA, multiStaff, customerActive, customerLocked, superAdmin);

        h.Db.TenantStaffMembers.AddRange(
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantA, UserId = ownerA.Id, StaffRole = StaffRole.Owner, IsActive = true },
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantB, UserId = multiStaff.Id, StaffRole = StaffRole.Manager, IsActive = true },
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantA, UserId = multiStaff.Id, StaffRole = StaffRole.Receptionist, IsActive = true },
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantB, UserId = multiStaff.Id, StaffRole = StaffRole.Housekeeper, IsActive = false });

        var response = await h.Mediator.Send(new GetPlatformUsersQuery());

        Assert.Equal(5, response.Summary.TotalUsers);
        Assert.Equal(1, response.Summary.SuperAdminCount);
        Assert.Equal(2, response.Summary.TenantStaffCount);
        Assert.Equal(2, response.Summary.CustomerCount);
        Assert.Equal(4, response.Summary.ActiveCount);
        Assert.Equal(1, response.Summary.LockedCount);
        Assert.Equal(5, response.TotalCount);
        Assert.Equal(5, response.Items.Count);

        // SuperAdmin must appear first despite older CreatedAtUtc, followed by non-SuperAdmins descending by CreatedAtUtc
        Assert.Equal(superAdmin.Id, response.Items[0].Id);
        Assert.Equal("Quản trị nền tảng (SuperAdmin)", response.Items[0].GlobalRoleName);
        Assert.Equal(customerActive.Id, response.Items[1].Id);
        Assert.Equal("Khách hàng B2C", response.Items[1].GlobalRoleName);
        Assert.Equal(multiStaff.Id, response.Items[2].Id);
        Assert.Equal("Chủ cơ sở & Nhân sự", response.Items[2].GlobalRoleName);
        Assert.Equal(2, response.Items[2].MembershipsCount);
        Assert.Equal("Saigon Boutique", response.Items[2].DefaultTenantName);
        Assert.Equal(ownerA.Id, response.Items[3].Id);
        Assert.Equal("Aurora Hospitality", response.Items[3].DefaultTenantName);
        Assert.Equal(customerLocked.Id, response.Items[4].Id);

        // Filtered query preserves global KPI summary while narrowing Items & TotalCount
        var filtered = await h.Mediator.Send(new GetPlatformUsersQuery(
            Search: "091234",
            Role: GlobalUserRole.TenantStaff,
            IsActive: true,
            Page: 1,
            PageSize: 10));

        Assert.Equal(5, filtered.Summary.TotalUsers);
        Assert.Equal(1, filtered.TotalCount);
        Assert.Single(filtered.Items);
        Assert.Equal(multiStaff.Id, filtered.Items[0].Id);

        // Credential hygiene: DTO must never expose PasswordHash
        Assert.Null(typeof(PlatformUserDto).GetProperty("PasswordHash"));
    }

    [Fact]
    public async Task CreatePlatformAdmin_ValidatesInput_HashesPassword_GeneratesUniqueUsername_AndRejectsDuplicateEmail()
    {
        var h = new TestHarness();
        var callerId = Guid.NewGuid();
        h.CurrentUser.SetUser(callerId, "root@hotelsaas.vn", GlobalUserRole.SuperAdmin);

        // Existing user already owns username "ops.admin"
        h.Db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = "ops.admin@customer.vn",
            Username = "ops.admin",
            FullName = "Existing Prefix Holder",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        });

        await Assert.ThrowsAsync<ValidationException>(() =>
            h.Mediator.Send(new CreatePlatformAdminCommand("invalid-email", "Admin Name", "ValidPass123")));

        await Assert.ThrowsAsync<ValidationException>(() =>
            h.Mediator.Send(new CreatePlatformAdminCommand("valid@hotelsaas.vn", "", "ValidPass123")));

        await Assert.ThrowsAsync<ValidationException>(() =>
            h.Mediator.Send(new CreatePlatformAdminCommand("valid@hotelsaas.vn", "Admin Name", "short7")));

        var created = await h.Mediator.Send(new CreatePlatformAdminCommand(
            "  Ops.Admin@HotelSaas.vn ",
            "  Quản Trị Vận Hành  ",
            "AdminPass#2026",
            " 0909888777 "));

        Assert.Equal("ops.admin@hotelsaas.vn", created.Email);
        Assert.Equal("ops.admin@hotelsaas.vn", created.Username);
        Assert.Equal("Quản Trị Vận Hành", created.FullName);
        Assert.Equal("0909888777", created.PhoneNumber);
        Assert.Equal(GlobalUserRole.SuperAdmin, created.GlobalRole);
        Assert.Equal("Quản trị nền tảng (SuperAdmin)", created.GlobalRoleName);
        Assert.True(created.IsActive);
        Assert.True(created.EmailVerified);
        Assert.True(created.PhoneVerified);

        var persisted = h.Db.UserList.Single(u => u.Id == created.Id);
        Assert.Equal("HASHED::AdminPass#2026", persisted.PasswordHash);

        var duplicateEx = await Assert.ThrowsAsync<ConflictException>(() =>
            h.Mediator.Send(new CreatePlatformAdminCommand(
                "OPS.ADMIN@hotelsaas.vn",
                "Duplicate Admin",
                "AnotherPass#2026")));
        Assert.Equal("ERR_EMAIL_EXISTS", duplicateEx.ErrorCode);
    }

    [Fact]
    public async Task TogglePlatformUserStatus_BlocksSelfLock_AndBlocksLockingLastActiveSuperAdmin()
    {
        var h = new TestHarness();
        var admin1 = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin1@hotelsaas.vn",
            Username = "admin1",
            FullName = "Primary SuperAdmin",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = true
        };
        var inactiveAdmin = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin2@hotelsaas.vn",
            Username = "admin2",
            FullName = "Inactive SuperAdmin",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = false
        };
        h.Db.Users.AddRange(admin1, inactiveAdmin);

        h.CurrentUser.SetUser(admin1.Id, admin1.Email, GlobalUserRole.SuperAdmin);
        var selfLockEx = await Assert.ThrowsAsync<BadRequestException>(() =>
            h.Mediator.Send(new TogglePlatformUserStatusCommand(admin1.Id, TargetIsActive: false)));
        Assert.Equal("ERR_SELF_LOCK_FORBIDDEN", selfLockEx.ErrorCode);

        // Even if another session attempts to lock admin1 while admin1 is the sole active SuperAdmin, ERR_LAST_SUPERADMIN blocks it
        h.CurrentUser.SetUser(inactiveAdmin.Id, inactiveAdmin.Email, GlobalUserRole.SuperAdmin);
        var lastAdminEx = await Assert.ThrowsAsync<BadRequestException>(() =>
            h.Mediator.Send(new TogglePlatformUserStatusCommand(admin1.Id, TargetIsActive: false)));
        Assert.Equal("ERR_LAST_SUPERADMIN", lastAdminEx.ErrorCode);
        Assert.True(admin1.IsActive);
    }

    [Fact]
    public async Task TogglePlatformUserStatus_LocksAndUnlocksUser_AndRevokesActiveRefreshTokens()
    {
        var h = new TestHarness();
        var adminId = Guid.NewGuid();
        h.CurrentUser.SetUser(adminId, "root@hotelsaas.vn", GlobalUserRole.SuperAdmin);

        var staffUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "staff@hotel.vn",
            Username = "staff",
            FullName = "Nhân Sự Khách Sạn",
            GlobalRole = GlobalUserRole.TenantStaff,
            IsActive = true
        };
        h.Db.Users.Add(staffUser);

        var previouslyRevokedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var activeToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = staffUser.Id,
            Token = "tok-active",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            RevokedAtUtc = null
        };
        var alreadyRevokedToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = staffUser.Id,
            Token = "tok-old",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            RevokedAtUtc = previouslyRevokedAt
        };
        var adminToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = adminId,
            Token = "tok-admin",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            RevokedAtUtc = null
        };
        h.Db.RefreshTokens.AddRange(activeToken, alreadyRevokedToken, adminToken);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            h.Mediator.Send(new TogglePlatformUserStatusCommand(Guid.NewGuid(), false)));

        var lockedDto = await h.Mediator.Send(new TogglePlatformUserStatusCommand(
            staffUser.Id,
            TargetIsActive: false,
            Reason: "Khóa kiểm tra an ninh"));

        Assert.False(lockedDto.IsActive);
        Assert.NotNull(activeToken.RevokedAtUtc);
        Assert.Equal(previouslyRevokedAt, alreadyRevokedToken.RevokedAtUtc);
        Assert.Null(adminToken.RevokedAtUtc);

        var unlockedDto = await h.Mediator.Send(new TogglePlatformUserStatusCommand(staffUser.Id));
        Assert.True(unlockedDto.IsActive);
    }

    [Fact]
    public async Task UpdatePlatformUserRole_PromotesAndDemotes_WhileBlockingSelfChange_AndLastSuperAdminDemotion()
    {
        var h = new TestHarness();
        var admin1 = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin1@hotelsaas.vn",
            Username = "admin1",
            FullName = "Root Admin",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = true,
            EmailVerifiedAtUtc = DateTime.UtcNow,
            PhoneVerifiedAtUtc = DateTime.UtcNow
        };
        var customer = new User
        {
            Id = Guid.NewGuid(),
            Email = "user@gmail.com",
            Username = "user",
            FullName = "Unverified Customer",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true,
            EmailVerifiedAtUtc = null,
            PhoneVerifiedAtUtc = null
        };
        var inactiveAdmin = new User
        {
            Id = Guid.NewGuid(),
            Email = "inactive.admin@hotelsaas.vn",
            Username = "inactive.admin",
            FullName = "Inactive Admin",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = false
        };
        h.Db.Users.AddRange(admin1, customer, inactiveAdmin);

        h.CurrentUser.SetUser(admin1.Id, admin1.Email, GlobalUserRole.SuperAdmin);

        var selfRoleEx = await Assert.ThrowsAsync<BadRequestException>(() =>
            h.Mediator.Send(new UpdatePlatformUserRoleCommand(admin1.Id, GlobalUserRole.Customer)));
        Assert.Equal("ERR_SELF_ROLE_CHANGE_FORBIDDEN", selfRoleEx.ErrorCode);

        // Promote Customer -> SuperAdmin auto-marks EmailVerified & PhoneVerified
        var promoted = await h.Mediator.Send(new UpdatePlatformUserRoleCommand(customer.Id, GlobalUserRole.SuperAdmin));
        Assert.Equal(GlobalUserRole.SuperAdmin, promoted.GlobalRole);
        Assert.True(promoted.EmailVerified);
        Assert.True(promoted.PhoneVerified);

        // Demote second SuperAdmin -> TenantStaff succeeds while admin1 remains active
        var demoted = await h.Mediator.Send(new UpdatePlatformUserRoleCommand(customer.Id, GlobalUserRole.TenantStaff));
        Assert.Equal(GlobalUserRole.TenantStaff, demoted.GlobalRole);
        Assert.Equal("Chủ cơ sở & Nhân sự", demoted.GlobalRoleName);

        // Demoting the sole remaining active SuperAdmin (admin1) is blocked by ERR_LAST_SUPERADMIN
        h.CurrentUser.SetUser(inactiveAdmin.Id, inactiveAdmin.Email, GlobalUserRole.SuperAdmin);
        var lastAdminEx = await Assert.ThrowsAsync<BadRequestException>(() =>
            h.Mediator.Send(new UpdatePlatformUserRoleCommand(admin1.Id, GlobalUserRole.Customer)));
        Assert.Equal("ERR_LAST_SUPERADMIN", lastAdminEx.ErrorCode);
    }

    [Fact]
    public async Task PlatformUsers_AllHandlers_FailClosed_ForNonSuperAdmin_AndControllerIsThin()
    {
        var h = new TestHarness();
        var targetUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "guest@hotelsaas.vn",
            Username = "guest",
            FullName = "Guest User",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        };
        var rootAdmin = new User
        {
            Id = Guid.NewGuid(),
            Email = "root@hotelsaas.vn",
            Username = "root",
            FullName = "Root SuperAdmin",
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = true
        };
        h.Db.Users.AddRange(targetUser, rootAdmin);

        // 1. TenantStaff caller -> Forbidden
        h.CurrentUser.SetUser(Guid.NewGuid(), "staff@hotel.vn", GlobalUserRole.TenantStaff);
        var ex1 = await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new GetPlatformUsersQuery()));
        Assert.Equal("ERR_FORBIDDEN", ex1.ErrorCode);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            h.Mediator.Send(new CreatePlatformAdminCommand("new@hotelsaas.vn", "New Admin", "Password#123")));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            h.Mediator.Send(new TogglePlatformUserStatusCommand(targetUser.Id, false)));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            h.Mediator.Send(new UpdatePlatformUserRoleCommand(targetUser.Id, GlobalUserRole.SuperAdmin)));

        // 2. Unauthenticated caller -> Forbidden
        h.CurrentUser.SetUser(rootAdmin.Id, rootAdmin.Email, GlobalUserRole.SuperAdmin);
        h.CurrentUser.IsAuthenticated = false;
        await Assert.ThrowsAsync<ForbiddenException>(() => h.Mediator.Send(new GetPlatformUsersQuery()));

        // 3. Verify PlatformUsersController thin architecture & attributes
        var controllerType = typeof(PlatformUsersController);
        var authorizeAttr = controllerType.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorizeAttr);
        Assert.Equal("SuperAdmin", authorizeAttr!.Roles);

        var ctors = controllerType.GetConstructors();
        Assert.Single(ctors);
        var ctorParams = ctors[0].GetParameters();
        Assert.Single(ctorParams);
        Assert.Equal(typeof(ISender), ctorParams[0].ParameterType);

        var dbContextFields = controllerType
            .GetFields(BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance)
            .Where(f => typeof(IApplicationDbContext).IsAssignableFrom(f.FieldType));
        Assert.Empty(dbContextFields);

        // 4. Exercise controller actions via Mediator
        h.CurrentUser.IsAuthenticated = true;
        var controller = new PlatformUsersController(h.Mediator);

        var getResult = Assert.IsType<OkObjectResult>(await controller.GetUsers(null, null, null));
        var listPayload = Assert.IsType<PlatformUsersResponseDto>(getResult.Value);
        Assert.Equal(2, listPayload.TotalCount);

        var createResult = Assert.IsType<ObjectResult>(await controller.CreateAdmin(
            new CreatePlatformAdminRequest("secops@hotelsaas.vn", "SecOps Admin", "SecOpsPass#2026", "0988777666")));
        Assert.Equal(StatusCodes.Status201Created, createResult.StatusCode);
        var createdDto = Assert.IsType<PlatformUserDto>(createResult.Value);
        Assert.Equal(GlobalUserRole.SuperAdmin, createdDto.GlobalRole);

        var toggleResult = Assert.IsType<OkObjectResult>(await controller.ToggleStatus(
            targetUser.Id,
            new TogglePlatformUserStatusRequest(false, "Audit lock")));
        Assert.False(Assert.IsType<PlatformUserDto>(toggleResult.Value).IsActive);

        var roleResult = Assert.IsType<OkObjectResult>(await controller.UpdateRole(
            targetUser.Id,
            new UpdatePlatformUserRoleRequest(GlobalUserRole.TenantStaff)));
        Assert.Equal(GlobalUserRole.TenantStaff, Assert.IsType<PlatformUserDto>(roleResult.Value).GlobalRole);
    }
}
