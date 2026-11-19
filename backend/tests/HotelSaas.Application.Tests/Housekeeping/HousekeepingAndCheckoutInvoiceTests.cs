using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Housekeeping.Commands.AssignHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.ClaimHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.CompleteHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.CreateHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.StartHousekeepingTask;
using HotelSaas.Application.Housekeeping.Queries.GetHousekeepingTasks;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Payments.Commands.AddFolioItem;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;
using HotelSaas.Application.Properties.Queries.GetPropertyPolicies;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.Reservations.Commands.CheckOutReservation;
using HotelSaas.Application.Reservations.Commands.CreateReservation;
using HotelSaas.Application.Reservations.Commands.MarkNoShow;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace HotelSaas.Application.Tests.Housekeeping;

/// <summary>
/// Isolated unit tests (strictly in-memory/stubbed, zero PostgreSQL dependencies) covering:
/// - T012 HousekeepingTask queue, upcoming check-in urgency promotion, assignment, BR-HK06 self-claim, start, complete
/// - T013 Checkout auto-generated HousekeepingTask &amp; issued Invoice, late checkout surcharge + override audit, AddFolioItem proportional tax recalculation
/// - T017 CreateReservation MaxOccupancy/365-day horizon rules, MarkNoShow, NightAuditBackgroundService, and Property Policies Tax/ServiceFee/24-24 surcharges
/// </summary>
public sealed class HousekeepingAndCheckoutInvoiceTests
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

        private EfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

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

        public InMemoryAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
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

        public InMemoryAsyncDbSet(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _provider = new InMemoryAsyncQueryProvider<TEntity>(backingData, tenantService);
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

    private sealed class TestDbContext : IApplicationDbContext
    {
        private readonly ICurrentTenantService _tenantService;

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
        public List<PropertySurchargePolicy> SurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RoomTypeRateList { get; } = new();
        public List<RoomTypeRateAudit> RoomTypeRateAuditList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();
        public List<Invoice> InvoiceList { get; } = new();
        public List<InvoiceItem> InvoiceItemList { get; } = new();
        public List<GuestLoyaltyMembership> MembershipList { get; } = new();
        public List<LoyaltyPointTransaction> LoyaltyTxList { get; } = new();
        public List<TenantContract> TenantContractList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateList { get; } = new();
        public List<SocialIdentity> SocialIdentityList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();
        public List<HousekeepingTask> HousekeepingTaskList { get; } = new();
        public List<Promotion> PromotionList { get; } = new();
        public List<AiUsageLog> AiUsageLogList { get; } = new();

        public TestDbContext(ICurrentTenantService tenantService)
        {
            _tenantService = tenantService;
        }

        public DbSet<User> Users => new InMemoryAsyncDbSet<User>(UserList, _tenantService);
        public DbSet<RefreshToken> RefreshTokens => new InMemoryAsyncDbSet<RefreshToken>(RefreshTokenList, _tenantService);
        public DbSet<Tenant> Tenants => new InMemoryAsyncDbSet<Tenant>(TenantList, _tenantService);
        public DbSet<Property> Properties => new InMemoryAsyncDbSet<Property>(PropertyList, _tenantService);
        public DbSet<AccessRole> AccessRoles => new InMemoryAsyncDbSet<AccessRole>(AccessRoleList, _tenantService);
        public DbSet<PermissionFunction> PermissionFunctions => new InMemoryAsyncDbSet<PermissionFunction>(PermissionFunctionList, _tenantService);
        public DbSet<RolePermission> RolePermissions => new InMemoryAsyncDbSet<RolePermission>(RolePermissionList, _tenantService);
        public DbSet<TenantStaff> TenantStaffMembers => new InMemoryAsyncDbSet<TenantStaff>(TenantStaffList, _tenantService);
        public DbSet<RoomType> RoomTypes => new InMemoryAsyncDbSet<RoomType>(RoomTypeList, _tenantService);
        public DbSet<Room> Rooms => new InMemoryAsyncDbSet<Room>(RoomList, _tenantService);
        public DbSet<Reservation> Reservations => new InMemoryAsyncDbSet<Reservation>(ReservationList, _tenantService);
        public DbSet<Payment> Payments => new InMemoryAsyncDbSet<Payment>(PaymentList, _tenantService);
        public DbSet<Subscription> Subscriptions => new InMemoryAsyncDbSet<Subscription>(SubscriptionList, _tenantService);
        public DbSet<SubscriptionPlan> SubscriptionPlans => new InMemoryAsyncDbSet<SubscriptionPlan>(SubscriptionPlanList, _tenantService);
        public DbSet<SystemBanner> SystemBanners => new InMemoryAsyncDbSet<SystemBanner>(SystemBannerList, _tenantService);
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => new InMemoryAsyncDbSet<PropertySurchargePolicy>(SurchargePolicyList, _tenantService);
        public DbSet<RoomTypeRate> RoomTypeRates => new InMemoryAsyncDbSet<RoomTypeRate>(RoomTypeRateList, _tenantService);
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => new InMemoryAsyncDbSet<RoomTypeRateAudit>(RoomTypeRateAuditList, _tenantService);
        public DbSet<AuditLog> AuditLogs => new InMemoryAsyncDbSet<AuditLog>(AuditLogList, _tenantService);
        public DbSet<Invoice> Invoices => new InMemoryAsyncDbSet<Invoice>(InvoiceList, _tenantService);
        public DbSet<InvoiceItem> InvoiceItems => new InMemoryAsyncDbSet<InvoiceItem>(InvoiceItemList, _tenantService);
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => new InMemoryAsyncDbSet<GuestLoyaltyMembership>(MembershipList, _tenantService);
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => new InMemoryAsyncDbSet<LoyaltyPointTransaction>(LoyaltyTxList, _tenantService);
        public DbSet<TenantContract> TenantContracts => new InMemoryAsyncDbSet<TenantContract>(TenantContractList, _tenantService);
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => new InMemoryAsyncDbSet<PrintTemplateConfig>(PrintTemplateList, _tenantService);
        public DbSet<SocialIdentity> SocialIdentities => new InMemoryAsyncDbSet<SocialIdentity>(SocialIdentityList, _tenantService);
        public DbSet<GuestReview> GuestReviews => new InMemoryAsyncDbSet<GuestReview>(GuestReviewList, _tenantService);
        public DbSet<HousekeepingTask> HousekeepingTasks => new InMemoryAsyncDbSet<HousekeepingTask>(HousekeepingTaskList, _tenantService);
        public DbSet<Promotion> Promotions => new InMemoryAsyncDbSet<Promotion>(PromotionList, _tenantService);
        public DbSet<AiUsageLog> AiUsageLogs => new InMemoryAsyncDbSet<AiUsageLog>(AiUsageLogList, _tenantService);

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => Task.FromResult(1);
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; }
        public string Email { get; set; } = "staff@example.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Manager;
        public Guid? RoleId { get; set; } = Guid.NewGuid();
        public bool IsTenantWide { get; set; }
        public bool IsAuthenticated { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide)
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

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public StaffRole StaffRole { get; set; } = StaffRole.Manager;
        public Task<MembershipLookupResult> ResolveMembershipAsync(Guid tenantId, Guid userId, Guid? targetPropertyId, CancellationToken cancellationToken = default)
            => Task.FromResult(MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole, targetPropertyId, isTenantWide: false));
    }

    private sealed class RecordingNotificationDispatcher : INotificationDispatcher
    {
        public List<(string PropertyId, string RoomNumber, string RoomStatus, string Message)> HousekeepingAlerts { get; } = new();
        public List<(string ReservationId, string PreviousStatus, string NewStatus)> StatusChanges { get; } = new();

        public Task NotifyNewReservationConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string roomTypeName, decimal totalAmount, decimal depositPaid, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyReservationStatusChangedAsync(string propertyId, string reservationId, string confirmationCode, string previousStatus, string newStatus, CancellationToken cancellationToken = default)
        {
            StatusChanges.Add((reservationId, previousStatus, newStatus));
            return Task.CompletedTask;
        }
        public Task NotifyHousekeepingAlertAsync(string propertyId, string roomNumber, string roomStatus, string message, CancellationToken cancellationToken = default)
        {
            HousekeepingAlerts.Add((propertyId, roomNumber, roomStatus, message));
            return Task.CompletedTask;
        }
        public Task NotifyBookingPaymentConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, decimal totalAmount, decimal paidAmount, string paymentMethod, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingCancellationRequestedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string reason, decimal refundableAmount, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> NotifyHoldExpiredAsync(string propertyId, string reservationId, string confirmationCode, string roomTypeName, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed class StubSender : ISender
    {
        public Func<object, object?> Handler { get; set; } = _ => null;

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
            => Task.FromResult((TResponse)Handler(request)!);

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
            => Task.CompletedTask;

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
            => Task.FromResult(Handler(request));

        public async IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.CompletedTask;
            yield break;
        }

        public async IAsyncEnumerable<object?> CreateStream(object request, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.CompletedTask;
            yield break;
        }
    }

    private static (TestDbContext Db, StubTenantService TenantSvc, StubPropertyService PropSvc, StubUserContext UserCtx, StubMembershipLookupService MemberSvc, Guid TenantId, Guid PropertyId, Guid RoomTypeId, Guid RoomId) CreateBaseFixture()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var roomTypeId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var propSvc = new StubPropertyService { PropertyId = propertyId, HeaderPropertyId = propertyId, TokenPropertyId = propertyId };
        var userCtx = new StubUserContext { UserId = userId, TenantId = tenantId, PropertyId = propertyId, StaffRole = StaffRole.Manager };
        var memberSvc = new StubMembershipLookupService { StaffRole = StaffRole.Manager };
        var db = new TestDbContext(tenantSvc);

        var property = new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "Hotel Saigon",
            Code = "SG01",
            Slug = "hotel-saigon",
            Address = "123 Le Loi, Q1",
            City = "Ho Chi Minh",
            PhoneNumber = "0281234567",
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12,
            TaxRatePercent = 8m,
            ServiceFeeRatePercent = 5m,
            Status = PropertyStatus.Active
        };

        var roomType = new RoomType
        {
            Id = roomTypeId,
            TenantId = tenantId,
            PropertyId = propertyId,
            Name = "Deluxe Double",
            Code = "DLX",
            BasePrice = 1_000_000m,
            MaxOccupancy = 2
        };

        var room = new Room
        {
            Id = roomId,
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            RoomType = roomType,
            RoomNumber = "101",
            Floor = 1,
            Status = RoomStatus.Dirty,
            IsActive = true
        };

        db.PropertyList.Add(property);
        db.RoomTypeList.Add(roomType);
        db.RoomList.Add(room);

        return (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propertyId, roomTypeId, roomId);
    }

    [Fact]
    public async Task GetHousekeepingTasks_PromotesEffectivePriorityToUrgent_WhenConfirmedCheckInToday_AndJoinsAssignedUserWithoutShadowFk()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propId, _, roomId) = CreateBaseFixture();
        var housekeeperId = Guid.NewGuid();
        db.UserList.Add(new User { Id = housekeeperId, FullName = "Nguyen Thi Lan", Email = "lan@hotel.vn", IsActive = true });

        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));

        // Intentionally leave task.AssignedTo == null to verify handler joins _context.Users via AssignedToUserId
        var task = new HousekeepingTask
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoomId = roomId,
            AssignedToUserId = housekeeperId,
            AssignedTo = null,
            Status = HousekeepingTaskStatus.Pending,
            Priority = HousekeepingPriority.Normal,
            Notes = "Turnaround before VIP check-in",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-15),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-15)
        };
        db.HousekeepingTaskList.Add(task);

        db.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            GuestName = "Tran Van B",
            ConfirmationCode = "RES-TODAY",
            CheckInDate = todayVn,
            CheckOutDate = todayVn.AddDays(1),
            Status = ReservationStatus.Confirmed,
            TotalAmount = 1_000_000m
        });

        var handler = new GetHousekeepingTasksQueryHandler(db, tenantSvc, userCtx, propSvc, memberSvc);
        var result = await handler.Handle(new GetHousekeepingTasksQuery(propId, Priority: HousekeepingPriority.Urgent), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Equal("Nguyen Thi Lan", dto.AssignedToName);
        Assert.True(dto.HasUpcomingCheckIn);
        Assert.NotNull(dto.NextCheckInAtUtc);
        Assert.Equal(HousekeepingPriority.Normal, dto.Priority);
        Assert.Equal(HousekeepingPriority.Urgent, dto.EffectivePriority);
    }

    [Fact]
    public async Task HousekeepingLifecycle_ClaimConflict_Assign_Start_Complete_TransitionsRoomAtomically()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propId, _, roomId) = CreateBaseFixture();
        var hk1Id = Guid.NewGuid();
        var hk2Id = Guid.NewGuid();
        db.UserList.AddRange(
            new User { Id = hk1Id, FullName = "HK One", Email = "hk1@hotel.vn", IsActive = true },
            new User { Id = hk2Id, FullName = "HK Two", Email = "hk2@hotel.vn", IsActive = true });
        db.TenantStaffList.AddRange(
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, UserId = hk1Id, StaffRole = StaffRole.Housekeeper, IsActive = true },
            new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, UserId = hk2Id, StaffRole = StaffRole.Housekeeper, IsActive = true });

        var createHandler = new CreateHousekeepingTaskCommandHandler(db, tenantSvc, userCtx, propSvc, memberSvc);
        var created = await createHandler.Handle(new CreateHousekeepingTaskCommand(propId, roomId, HousekeepingPriority.High, "Clean deep"), CancellationToken.None);
        Assert.Equal(HousekeepingTaskStatus.Pending, created.Status);

        // BR-HK06: hk1 self-claims; hk2 cannot steal it
        userCtx.UserId = hk1Id;
        userCtx.StaffRole = StaffRole.Housekeeper;
        memberSvc.StaffRole = StaffRole.Housekeeper;
        var claimHandler = new ClaimHousekeepingTaskCommandHandler(db, tenantSvc, userCtx, propSvc, memberSvc);
        var claimed = await claimHandler.Handle(new ClaimHousekeepingTaskCommand(created.Id, propId), CancellationToken.None);
        Assert.Equal(HousekeepingTaskStatus.Claimed, claimed.Status);
        Assert.Equal(hk1Id, claimed.AssignedToUserId);

        userCtx.UserId = hk2Id;
        var conflictEx = await Assert.ThrowsAsync<ConflictException>(() =>
            claimHandler.Handle(new ClaimHousekeepingTaskCommand(created.Id, propId), CancellationToken.None));
        Assert.Equal("ERR_TASK_ALREADY_CLAIMED", conflictEx.ErrorCode);

        // Manager reassigns to hk2
        userCtx.StaffRole = StaffRole.Manager;
        memberSvc.StaffRole = StaffRole.Manager;
        var assignHandler = new AssignHousekeepingTaskCommandHandler(db, tenantSvc, userCtx, propSvc, memberSvc);
        var assigned = await assignHandler.Handle(new AssignHousekeepingTaskCommand(created.Id, propId, hk2Id), CancellationToken.None);
        Assert.Equal(hk2Id, assigned.AssignedToUserId);

        // hk2 starts cleaning -> Room Dirty -> Cleaning
        userCtx.UserId = hk2Id;
        userCtx.StaffRole = StaffRole.Housekeeper;
        memberSvc.StaffRole = StaffRole.Housekeeper;
        var startHandler = new StartHousekeepingTaskCommandHandler(db, tenantSvc, userCtx, propSvc, memberSvc);
        var started = await startHandler.Handle(new StartHousekeepingTaskCommand(created.Id, propId), CancellationToken.None);
        Assert.Equal(HousekeepingTaskStatus.InProgress, started.Status);
        Assert.NotNull(started.StartedAtUtc);
        Assert.Equal(RoomStatus.Cleaning, db.RoomList.Single().Status);

        // hk2 completes -> Room Cleaning -> Clean & SignalR alert dispatched
        var dispatcher = new RecordingNotificationDispatcher();
        var completeHandler = new CompleteHousekeepingTaskCommandHandler(db, tenantSvc, userCtx, propSvc, memberSvc, dispatcher);
        var completed = await completeHandler.Handle(new CompleteHousekeepingTaskCommand(created.Id, propId, "Checked amenities"), CancellationToken.None);
        Assert.Equal(HousekeepingTaskStatus.Completed, completed.Status);
        Assert.NotNull(completed.CompletedAtUtc);
        Assert.Equal(RoomStatus.Clean, db.RoomList.Single().Status);
        Assert.Single(dispatcher.HousekeepingAlerts);
    }

    [Fact]
    public async Task CheckOutReservation_AutoGeneratesUrgentHousekeepingTask_AndIssuedInvoice_ExcludingRefunds()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propId, rtId, roomId) = CreateBaseFixture();
        var room = db.RoomList.Single();
        room.Status = RoomStatus.Occupied;

        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));
        var resId = Guid.NewGuid();
        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            RoomTypeId = rtId,
            RoomTypeName = "Deluxe Double",
            TotalAmount = 1_130_000m,
            Breakdown = new[]
            {
                new QuoteBreakdownItemDto { Description = "Tiền phòng 1 đêm", UnitPrice = 1_130_000m, Quantity = 1, Amount = 1_130_000m, Category = "RoomCharge" }
            }
        };

        db.ReservationList.Add(new Reservation
        {
            Id = resId,
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            Room = room,
            GuestName = "Le Minh",
            GuestEmail = "minh@example.com",
            GuestPhone = "0909999999",
            ConfirmationCode = "RES-CHK01",
            CheckInDate = todayVn.AddDays(-1),
            CheckOutDate = todayVn,
            TotalAmount = 1_130_000m,
            Status = ReservationStatus.CheckedIn,
            Notes = ReservationSnapshotHelper.Serialize(snapshot)
        });

        // Next-day confirmed check-in triggers Urgent HousekeepingTask
        db.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            GuestName = "Next Guest",
            ConfirmationCode = "RES-NEXT",
            CheckInDate = todayVn,
            CheckOutDate = todayVn.AddDays(1),
            Status = ReservationStatus.Confirmed,
            TotalAmount = 1_000_000m
        });

        db.PaymentList.AddRange(
            new Payment { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, ReservationId = resId, Amount = 1_130_000m, Method = PaymentMethod.Cash, Status = PaymentStatus.Completed },
            new Payment { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, ReservationId = resId, Amount = 200_000m, Method = PaymentMethod.Cash, Status = PaymentStatus.Completed, TransactionRef = "REFUND-OLD" });

        var handler = new CheckOutReservationCommandHandler(db, tenantSvc, userCtx, memberSvc, propSvc);
        var result = await handler.Handle(new CheckOutReservationCommand(resId, propId), CancellationToken.None);

        Assert.Equal(ReservationStatus.CheckedOut, result.Status);
        Assert.Equal("Expired", db.ReservationList.First(r => r.Id == resId).SmartLockStatus);
        Assert.Equal(RoomStatus.Dirty, room.Status);

        var hkTask = Assert.Single(db.HousekeepingTaskList);
        Assert.Equal(HousekeepingTaskStatus.Pending, hkTask.Status);
        Assert.Equal(HousekeepingPriority.Urgent, hkTask.Priority);

        var invoice = Assert.Single(db.InvoiceList);
        Assert.Equal(InvoiceStatus.Issued, invoice.Status);
        Assert.EndsWith("-RES-CHK01", invoice.InvoiceNumber);
        Assert.Equal(0.08m, invoice.TaxRate);
        Assert.Equal(0.05m, invoice.ServiceFeeRate);
        Assert.Equal(80_000m, invoice.TaxAmount);
        Assert.Equal(50_000m, invoice.ServiceFeeAmount);
        Assert.Equal(1_000_000m, invoice.Subtotal);
        Assert.Equal(1_130_000m, invoice.GrandTotal);
        Assert.Equal(1_130_000m, invoice.PaidAmount);
        Assert.Equal(0m, invoice.Balance);
        Assert.Single(invoice.InvoiceItems);
    }

    [Fact]
    public async Task CheckOutReservation_LateSurchargeOverride_RequiresManagerOrOwner_AndAuditsChange()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propId, _, roomId) = CreateBaseFixture();
        var room = db.RoomList.Single();
        room.Status = RoomStatus.Occupied;
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));
        var resId = Guid.NewGuid();

        db.ReservationList.Add(new Reservation
        {
            Id = resId,
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            Room = room,
            GuestName = "Pham Late",
            ConfirmationCode = "RES-LATE1",
            CheckInDate = todayVn.AddDays(-2),
            CheckOutDate = todayVn.AddDays(-1),
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.CheckedIn
        });
        db.PaymentList.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propId,
            ReservationId = resId,
            Amount = 1_250_000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.Cash
        });

        // Receptionist is forbidden from overriding late surcharge
        userCtx.StaffRole = StaffRole.Receptionist;
        memberSvc.StaffRole = StaffRole.Receptionist;
        var handler = new CheckOutReservationCommandHandler(db, tenantSvc, userCtx, memberSvc, propSvc);
        var forbiddenEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new CheckOutReservationCommand(resId, propId, OverrideLateSurchargeAmount: 250_000m, LateSurchargeOverrideReason: "VIP"), CancellationToken.None));
        Assert.Equal("ERR_OVERRIDE_FORBIDDEN", forbiddenEx.ErrorCode);

        // Manager succeeds and logs AuditLog
        userCtx.StaffRole = StaffRole.Manager;
        memberSvc.StaffRole = StaffRole.Manager;
        var result = await handler.Handle(
            new CheckOutReservationCommand(resId, propId, OverrideLateSurchargeAmount: 250_000m, LateSurchargeOverrideReason: "Chốt phụ thu thỏa thuận"),
            CancellationToken.None);

        Assert.Equal(ReservationStatus.CheckedOut, result.Status);
        Assert.Equal(1_250_000m, result.TotalAmount);
        var audit = Assert.Single(db.AuditLogList);
        Assert.Equal("OverrideLateCheckOutSurcharge", audit.Action);
    }

    [Fact]
    public async Task AddFolioItem_RecalculatesTaxAndServiceFeeProportionally_OnExistingInvoice()
    {
        var (db, tenantSvc, _, userCtx, memberSvc, tenantId, propId, _, roomId) = CreateBaseFixture();
        var resId = Guid.NewGuid();
        var invId = Guid.NewGuid();

        db.ReservationList.Add(new Reservation
        {
            Id = resId,
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            GuestName = "Folio Guest",
            ConfirmationCode = "RES-FOLIO",
            TotalAmount = 1_130_000m,
            Status = ReservationStatus.CheckedIn
        });

        var existingInvoice = new Invoice
        {
            Id = invId,
            TenantId = tenantId,
            ReservationId = resId,
            InvoiceNumber = "INV-TEST-01",
            Subtotal = 1_000_000m,
            TaxRate = 0.08m,
            TaxAmount = 80_000m,
            ServiceFeeRate = 0.05m,
            ServiceFeeAmount = 50_000m,
            GrandTotal = 1_130_000m,
            PaidAmount = 1_130_000m,
            Balance = 0m,
            Status = InvoiceStatus.Issued
        };
        db.InvoiceList.Add(existingInvoice);

        var sender = new StubSender
        {
            Handler = req => req is GetFolioQuery q
                ? new FolioDto(q.ReservationId, "RES-FOLIO", "Folio Guest", "f@example.com", null, roomId, "101", null, "Deluxe",
                    ReservationStatus.CheckedIn, "CheckedIn", RentalType.Overnight, null, null, DateTime.UtcNow, DateTime.UtcNow.AddDays(1),
                    1_243_000m, 1_130_000m, 113_000m, false, Array.Empty<PaymentDto>(), Array.Empty<QuoteBreakdownItemDto>(),
                    null, null, null, null, null)
                : null
        };

        var handler = new AddFolioItemCommandHandler(db, tenantSvc, userCtx, memberSvc, sender);
        await handler.Handle(new AddFolioItemCommand(resId, propId, "MINIBAR", "Minibar Water", 1, 113_000m, "Minibar"), CancellationToken.None);

        Assert.Equal(1_243_000m, existingInvoice.GrandTotal);
        Assert.Equal(1_100_000m, existingInvoice.Subtotal);
        Assert.Equal(88_000m, existingInvoice.TaxAmount);
        Assert.Equal(55_000m, existingInvoice.ServiceFeeAmount);
        Assert.Equal(113_000m, existingInvoice.Balance);
        Assert.Single(existingInvoice.InvoiceItems);
    }

    [Fact]
    public async Task CreateReservation_EnforcesMaxOccupancy_AndAdvanceHorizon365Days()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, _, propId, _, roomId) = CreateBaseFixture();
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));

        // 1. Validator rejects > 365 days
        var validator = new CreateReservationCommandValidator();
        var farCheckIn = todayVn.AddDays(366);
        var farCmd = new CreateReservationCommand(
            propId, roomId, RentalType.Overnight,
            DateTime.UtcNow.AddDays(366), DateTime.UtcNow.AddDays(367),
            farCheckIn, farCheckIn.AddDays(1),
            "Future Guest", "future@example.com", "0901112233", NumberOfGuests: 2);
        var valRes = await validator.ValidateAsync(farCmd);
        Assert.False(valRes.IsValid);
        Assert.Contains(valRes.Errors, e => e.ErrorCode == "ERR_ADVANCE_HORIZON_EXCEEDED");

        // 2. Handler rejects > 365 days with BadRequestException
        var sender = new StubSender();
        var handler = new CreateReservationCommandHandler(db, tenantSvc, userCtx, memberSvc, sender, propSvc);
        var horizonEx = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(farCmd, CancellationToken.None));
        Assert.Equal("ERR_ADVANCE_HORIZON_EXCEEDED", horizonEx.ErrorCode);

        // 3. Handler rejects NumberOfGuests > RoomType.MaxOccupancy (2)
        var nearCheckIn = todayVn.AddDays(2);
        var overCapCmd = new CreateReservationCommand(
            propId, roomId, RentalType.Overnight,
            DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(3),
            nearCheckIn, nearCheckIn.AddDays(1),
            "Group Guest", "group@example.com", "0901112233", NumberOfGuests: 4);
        var capEx = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(overCapCmd, CancellationToken.None));
        Assert.Equal("ERR_OCCUPANCY_EXCEEDED", capEx.ErrorCode);
    }

    [Fact]
    public async Task MarkNoShow_And_NightAuditBackgroundService_MarkPastCutoffConfirmedAsNoShow()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, tenantId, propId, _, roomId) = CreateBaseFixture();
        var room = db.RoomList.Single();
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));

        var manualResId = Guid.NewGuid();
        var staleResId = Guid.NewGuid();
        var futureResId = Guid.NewGuid();

        db.ReservationList.AddRange(
            new Reservation
            {
                Id = manualResId,
                TenantId = tenantId,
                PropertyId = propId,
                RoomId = roomId,
                Room = room,
                GuestName = "Manual NoShow",
                ConfirmationCode = "RES-MNS",
                CheckInDate = todayVn,
                CheckOutDate = todayVn.AddDays(1),
                Status = ReservationStatus.Confirmed,
                SmartLockStatus = "Pending"
            },
            new Reservation
            {
                Id = staleResId,
                TenantId = tenantId,
                PropertyId = propId,
                RoomId = roomId,
                Room = room,
                GuestName = "Overnight Missed",
                ConfirmationCode = "RES-STALE",
                CheckInDate = todayVn.AddDays(-1),
                CheckOutDate = todayVn.AddDays(1),
                Status = ReservationStatus.Confirmed,
                SmartLockStatus = "Active"
            },
            new Reservation
            {
                Id = futureResId,
                TenantId = tenantId,
                PropertyId = propId,
                RoomId = roomId,
                Room = room,
                GuestName = "Future CheckIn",
                ConfirmationCode = "RES-FUT",
                CheckInDate = todayVn.AddDays(1),
                CheckOutDate = todayVn.AddDays(2),
                Status = ReservationStatus.Confirmed,
                SmartLockStatus = "Pending"
            });

        // 1. Explicit MarkNoShow
        var dispatcher = new RecordingNotificationDispatcher();
        var markHandler = new MarkNoShowCommandHandler(db, tenantSvc, userCtx, memberSvc, propSvc, dispatcher);
        var marked = await markHandler.Handle(new MarkNoShowCommand(manualResId, propId, "Unreachable"), CancellationToken.None);
        Assert.Equal(ReservationStatus.NoShow, marked.Status);
        Assert.Equal("Revoked", db.ReservationList.First(r => r.Id == manualResId).SmartLockStatus);

        // 2. NightAuditBackgroundService marks staleResId while preserving futureResId
        var services = new ServiceCollection();
        services.AddSingleton<IApplicationDbContext>(db);
        services.AddSingleton<ICurrentTenantService>(tenantSvc);
        services.AddSingleton<ICurrentPropertyService>(propSvc);
        services.AddSingleton<INotificationDispatcher>(dispatcher);
        await using var provider = services.BuildServiceProvider();

        var nightAudit = new NightAuditBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<NightAuditBackgroundService>.Instance);

        var sweptCount = await nightAudit.ExecuteNightAuditIterationAsync(CancellationToken.None);

        Assert.Equal(1, sweptCount);
        Assert.Equal(ReservationStatus.NoShow, db.ReservationList.First(r => r.Id == staleResId).Status);
        Assert.Equal("Revoked", db.ReservationList.First(r => r.Id == staleResId).SmartLockStatus);
        Assert.Equal(ReservationStatus.Confirmed, db.ReservationList.First(r => r.Id == futureResId).Status);
    }

    [Fact]
    public async Task PropertyPolicies_UpdatesAndReads_TaxRate_ServiceFeeRate_And_24hSurcharges()
    {
        var (db, tenantSvc, propSvc, userCtx, memberSvc, _, propId, _, _) = CreateBaseFixture();

        var surcharges24h = new[]
        {
            new UpdateSurchargeItemCommand(null, SurchargeType.EarlyCheckIn, new TimeOnly(0, 0), new TimeOnly(6, 0), SurchargeCalculationMethod.PercentageOfNightly, 100m, null, true),
            new UpdateSurchargeItemCommand(null, SurchargeType.EarlyCheckIn, new TimeOnly(6, 0), new TimeOnly(9, 0), SurchargeCalculationMethod.PercentageOfNightly, 50m, null, true),
            new UpdateSurchargeItemCommand(null, SurchargeType.EarlyCheckIn, new TimeOnly(9, 0), new TimeOnly(14, 0), SurchargeCalculationMethod.PercentageOfNightly, 30m, null, true),
            new UpdateSurchargeItemCommand(null, SurchargeType.LateCheckOut, new TimeOnly(12, 0), new TimeOnly(15, 0), SurchargeCalculationMethod.PercentageOfNightly, 30m, null, true),
            new UpdateSurchargeItemCommand(null, SurchargeType.LateCheckOut, new TimeOnly(15, 0), new TimeOnly(18, 0), SurchargeCalculationMethod.PercentageOfNightly, 50m, null, true),
            new UpdateSurchargeItemCommand(null, SurchargeType.LateCheckOut, new TimeOnly(18, 0), new TimeOnly(23, 59, 59), SurchargeCalculationMethod.PercentageOfNightly, 100m, null, true)
        };

        var updateCmd = new UpdatePropertyPoliciesCommand(
            propId,
            new TimeOnly(14, 0),
            new TimeOnly(12, 0),
            30,
            12,
            surcharges24h,
            TaxRatePercent: 10m,
            ServiceFeeRatePercent: 5m);

        var validator = new UpdatePropertyPoliciesCommandValidator();
        var valRes = await validator.ValidateAsync(updateCmd);
        Assert.True(valRes.IsValid);

        var updateHandler = new UpdatePropertyPoliciesCommandHandler(db, tenantSvc, propSvc, userCtx, memberSvc);
        var updated = await updateHandler.Handle(updateCmd, CancellationToken.None);

        Assert.Equal(10m, updated.TaxRatePercent);
        Assert.Equal(5m, updated.ServiceFeeRatePercent);
        Assert.Equal(6, updated.Surcharges.Count);

        var getHandler = new GetPropertyPoliciesQueryHandler(db, tenantSvc, userCtx, memberSvc);
        var fetched = await getHandler.Handle(new GetPropertyPoliciesQuery(propId), CancellationToken.None);
        Assert.Equal(10m, fetched.TaxRatePercent);
        Assert.Equal(5m, fetched.ServiceFeeRatePercent);
        Assert.Equal(6, fetched.Surcharges.Count);
    }
}
