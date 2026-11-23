using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.Plans;
using HotelSaas.Application.Platform.Queries.GetPlatformOverview;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;

namespace HotelSaas.Application.Tests.Platform;

/// <summary>
/// Verifies strict MRR parity between <see cref="GetPlatformOverviewQueryHandler"/> and
/// <see cref="GetAdminPlansQueryHandler"/> / <see cref="GetAdminPlanByIdQueryHandler"/> /
/// <see cref="UpdateAdminPlanCommandHandler"/> / <see cref="ToggleAdminPlanActiveCommandHandler"/>:
/// - Trial subscriptions contribute 0 to paid MRR and subscriber counts.
/// - Inactive (Suspended / PendingApproval) tenants are excluded even with Active subscriptions.
/// - Duplicate Active subscriptions per tenant are deduplicated to the latest subscription.
/// - Annual billing cycles are prorated (PricePerCycle / 12m) and TenantContract pricing is honored identically.
/// </summary>
public sealed class PlatformMrrParityTests
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
        public InMemoryAsyncQueryProvider(List<TEntity> backingData) => _backingData = backingData;

        public IQueryable<TEntity> ResolveEffectiveQueryable() => _backingData.AsQueryable();

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
            var effective = ResolveEffectiveQueryable();
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable();
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable();
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

        public InMemoryAsyncDbSet(List<TEntity> backingData)
        {
            _backingData = backingData;
            _provider = new InMemoryAsyncQueryProvider<TEntity>(backingData);
            _expression = Expression.Constant(this);
        }

        public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator() => _provider.ResolveEffectiveQueryable().GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TEntity>(GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _backingData.Add(entity);
            return null!;
        }
    }

    private sealed class FakeDbContext : IApplicationDbContext
    {
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
        public List<PropertySurchargePolicy> SurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RoomTypeRateList { get; } = new();
        public List<RoomTypeRateAudit> RoomTypeRateAuditList { get; } = new();
        public List<Invoice> InvoiceList { get; } = new();
        public List<InvoiceItem> InvoiceItemList { get; } = new();
        public List<GuestLoyaltyMembership> MembershipList { get; } = new();
        public List<LoyaltyPointTransaction> LoyaltyTxList { get; } = new();
        public List<TenantContract> TenantContractList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateList { get; } = new();
        public List<SocialIdentity> SocialIdentityList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();
        public List<AiUsageLog> AiUsageLogList { get; } = new();

        public DbSet<User> Users => new InMemoryAsyncDbSet<User>(UserList);
        public DbSet<RefreshToken> RefreshTokens => new InMemoryAsyncDbSet<RefreshToken>(RefreshTokenList);
        public DbSet<Tenant> Tenants => new InMemoryAsyncDbSet<Tenant>(TenantList);
        public DbSet<Property> Properties => new InMemoryAsyncDbSet<Property>(PropertyList);
        public DbSet<AccessRole> AccessRoles => new InMemoryAsyncDbSet<AccessRole>(AccessRoleList);
        public DbSet<PermissionFunction> PermissionFunctions => new InMemoryAsyncDbSet<PermissionFunction>(PermissionFunctionList);
        public DbSet<RolePermission> RolePermissions => new InMemoryAsyncDbSet<RolePermission>(RolePermissionList);
        public DbSet<TenantStaff> TenantStaffMembers => new InMemoryAsyncDbSet<TenantStaff>(TenantStaffList);
        public DbSet<RoomType> RoomTypes => new InMemoryAsyncDbSet<RoomType>(RoomTypeList);
        public DbSet<Room> Rooms => new InMemoryAsyncDbSet<Room>(RoomList);
        public DbSet<Reservation> Reservations => new InMemoryAsyncDbSet<Reservation>(ReservationList);
        public DbSet<Payment> Payments => new InMemoryAsyncDbSet<Payment>(PaymentList);
        public DbSet<Subscription> Subscriptions => new InMemoryAsyncDbSet<Subscription>(SubscriptionList);
        public DbSet<SubscriptionPayment> SubscriptionPayments => new InMemoryAsyncDbSet<SubscriptionPayment>(SubscriptionPaymentList);
        public DbSet<SubscriptionPlan> SubscriptionPlans => new InMemoryAsyncDbSet<SubscriptionPlan>(SubscriptionPlanList);
        public DbSet<SystemBanner> SystemBanners => new InMemoryAsyncDbSet<SystemBanner>(SystemBannerList);
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => new InMemoryAsyncDbSet<PropertySurchargePolicy>(SurchargePolicyList);
        public DbSet<RoomTypeRate> RoomTypeRates => new InMemoryAsyncDbSet<RoomTypeRate>(RoomTypeRateList);
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => new InMemoryAsyncDbSet<RoomTypeRateAudit>(RoomTypeRateAuditList);
        public DbSet<Invoice> Invoices => new InMemoryAsyncDbSet<Invoice>(InvoiceList);
        public DbSet<InvoiceItem> InvoiceItems => new InMemoryAsyncDbSet<InvoiceItem>(InvoiceItemList);
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => new InMemoryAsyncDbSet<GuestLoyaltyMembership>(MembershipList);
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => new InMemoryAsyncDbSet<LoyaltyPointTransaction>(LoyaltyTxList);
        public DbSet<TenantContract> TenantContracts => new InMemoryAsyncDbSet<TenantContract>(TenantContractList);
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => new InMemoryAsyncDbSet<PrintTemplateConfig>(PrintTemplateList);
        public DbSet<SocialIdentity> SocialIdentities => new InMemoryAsyncDbSet<SocialIdentity>(SocialIdentityList);
        public DbSet<GuestReview> GuestReviews => new InMemoryAsyncDbSet<GuestReview>(GuestReviewList);
        public DbSet<AiUsageLog> AiUsageLogs => new InMemoryAsyncDbSet<AiUsageLog>(AiUsageLogList);

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

    private sealed class SuperAdminUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "superadmin@hotelsaas.platform";
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

    [Fact]
    public async Task OverviewAndAdminPlans_ProduceIdenticalMrr_ExcludingTrialAndInactiveTenants_WithDedupProrationAndContracts()
    {
        var db = new FakeDbContext();
        var superAdmin = new SuperAdminUserContext();
        var now = DateTime.UtcNow;

        var starterPlan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = "STARTER",
            Name = "Starter",
            MonthlyPrice = 299_000m,
            YearlyPrice = 2_990_000m,
            MaxRooms = 15,
            MaxProperties = 1,
            MaxStaff = 3,
            SortOrder = 1,
            IsActive = true
        };
        var proPlan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = "PRO",
            Name = "Pro",
            MonthlyPrice = 699_000m,
            YearlyPrice = 6_990_000m,
            MaxRooms = 50,
            MaxProperties = 3,
            MaxStaff = 10,
            SortOrder = 2,
            IsActive = true
        };
        var enterprisePlan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = "ENTERPRISE",
            Name = "Enterprise",
            MonthlyPrice = 1_499_000m,
            YearlyPrice = 14_990_000m,
            MaxRooms = 9999,
            MaxProperties = 50,
            MaxStaff = 100,
            SortOrder = 3,
            IsActive = true
        };
        db.SubscriptionPlanList.AddRange([starterPlan, proPlan, enterprisePlan]);

        // Tenant 1 (Active): duplicate Active subscriptions -> deduplicated to latest Annual PRO (6,990,000 / 12 = 582,500)
        var t1ProAnnual = Guid.NewGuid();
        // Tenant 2 (Active): Trial subscription -> MUST contribute 0 even if a TenantContract exists
        var t2Trial = Guid.NewGuid();
        // Tenant 3 (Suspended): Active subscription -> MUST contribute 0 because tenant is Suspended
        var t3Suspended = Guid.NewGuid();
        // Tenant 4 (PendingApproval): Active subscription -> MUST contribute 0 because tenant is PendingApproval
        var t4Pending = Guid.NewGuid();
        // Tenant 5 (Active): No Subscription row, Active Annual TenantContract (12,000,000 / 12 = 1,000,000)
        var t5Contract = Guid.NewGuid();
        // Tenant 6 (Active): Monthly Active STARTER subscription (299,000)
        var t6StarterMonthly = Guid.NewGuid();

        db.TenantList.AddRange(
        [
            new Tenant { Id = t1ProAnnual, Name = "Pro Annual Hotel", Code = "T1", Slug = "t1", Status = TenantStatus.Active, SubscriptionTier = SubscriptionTier.Pro },
            new Tenant { Id = t2Trial, Name = "Trial Hotel", Code = "T2", Slug = "t2", Status = TenantStatus.Active, SubscriptionTier = SubscriptionTier.Enterprise },
            new Tenant { Id = t3Suspended, Name = "Suspended Hotel", Code = "T3", Slug = "t3", Status = TenantStatus.Suspended, SubscriptionTier = SubscriptionTier.Enterprise },
            new Tenant { Id = t4Pending, Name = "Pending Hotel", Code = "T4", Slug = "t4", Status = TenantStatus.PendingApproval, SubscriptionTier = SubscriptionTier.Basic },
            new Tenant { Id = t5Contract, Name = "Contract Resort", Code = "T5", Slug = "t5", Status = TenantStatus.Active, SubscriptionTier = SubscriptionTier.Enterprise },
            new Tenant { Id = t6StarterMonthly, Name = "Starter Mini", Code = "T6", Slug = "t6", Status = TenantStatus.Active, SubscriptionTier = SubscriptionTier.Basic }
        ]);

        db.SubscriptionList.AddRange(
        [
            // Older Active subscription for T1 (should be superseded by newer one)
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t1ProAnnual,
                Tier = SubscriptionTier.Basic,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = 299_000m,
                CreatedAtUtc = now.AddMonths(-6)
            },
            // Latest Active Annual subscription for T1 -> 582,500 VND/mo
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t1ProAnnual,
                Tier = SubscriptionTier.Pro,
                BillingCycle = BillingCycle.Annual,
                Status = SubscriptionStatus.Active,
                PricePerCycle = 6_990_000m,
                CreatedAtUtc = now.AddDays(-10)
            },
            // T2 Trial subscription -> MUST contribute 0
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t2Trial,
                Tier = SubscriptionTier.Enterprise,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Trial,
                PricePerCycle = 1_499_000m,
                CreatedAtUtc = now.AddDays(-2)
            },
            // T3 Suspended tenant with Active subscription -> MUST contribute 0
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t3Suspended,
                Tier = SubscriptionTier.Enterprise,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = 1_499_000m,
                CreatedAtUtc = now.AddDays(-20)
            },
            // T4 Pending tenant with Active subscription -> MUST contribute 0
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t4Pending,
                Tier = SubscriptionTier.Basic,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = 299_000m,
                CreatedAtUtc = now.AddDays(-1)
            },
            // T6 Active Monthly STARTER -> 299,000 VND/mo
            new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = t6StarterMonthly,
                Tier = SubscriptionTier.Basic,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = 299_000m,
                CreatedAtUtc = now.AddDays(-5)
            }
        ]);

        db.TenantContractList.AddRange(
        [
            // T2 has an Active contract, but T2 is currently on Trial subscription -> still 0 paid MRR
            new TenantContract
            {
                Id = Guid.NewGuid(),
                TenantId = t2Trial,
                ContractNumber = "HD-TRIAL-01",
                PlanCode = "ENTERPRISE",
                BillingCycle = BillingCycle.Annual,
                ContractValue = 14_990_000m,
                Status = TenantContractStatus.Active,
                SignedAtUtc = now.AddDays(-3)
            },
            // T5 has no subscription row, Active Annual ENTERPRISE contract -> 1,000,000 VND/mo
            new TenantContract
            {
                Id = Guid.NewGuid(),
                TenantId = t5Contract,
                ContractNumber = "HD-ENT-05",
                PlanCode = "ENTERPRISE",
                BillingCycle = BillingCycle.Annual,
                ContractValue = 12_000_000m,
                Status = TenantContractStatus.Active,
                SignedAtUtc = now.AddDays(-15)
            }
        ]);

        var overview = await new GetPlatformOverviewQueryHandler(db, superAdmin)
            .Handle(new GetPlatformOverviewQuery(), CancellationToken.None);
        var adminPlans = await new GetAdminPlansQueryHandler(db, superAdmin)
            .Handle(new GetAdminPlansQuery(), CancellationToken.None);

        const decimal expectedMrr = 299_000m + 582_500m + 1_000_000m; // 1,881,500 VND
        Assert.Equal(expectedMrr, overview.MrrVnd);
        Assert.Equal(expectedMrr * 12m, overview.ArrVnd);
        Assert.Equal(overview.MrrVnd, adminPlans.Sum(p => p.EstimatedMonthlyRevenue));
        Assert.Equal(overview.MrrVnd, overview.PlanBreakdown.Sum(p => p.EstimatedMrr));

        // Exact per-plan parity between Overview PlanBreakdown and AdminPlans
        foreach (var breakdown in overview.PlanBreakdown)
        {
            var planDto = Assert.Single(adminPlans, p => p.Code == breakdown.Code);
            Assert.Equal(breakdown.ActiveTenantsCount, planDto.ActiveTenantsCount);
            Assert.Equal(breakdown.EstimatedMrr, planDto.EstimatedMonthlyRevenue);
        }

        Assert.Equal(1, adminPlans.Single(p => p.Code == "STARTER").ActiveTenantsCount);
        Assert.Equal(299_000m, adminPlans.Single(p => p.Code == "STARTER").EstimatedMonthlyRevenue);
        Assert.Equal(1, adminPlans.Single(p => p.Code == "PRO").ActiveTenantsCount);
        Assert.Equal(582_500m, adminPlans.Single(p => p.Code == "PRO").EstimatedMonthlyRevenue);
        Assert.Equal(1, adminPlans.Single(p => p.Code == "ENTERPRISE").ActiveTenantsCount);
        Assert.Equal(1_000_000m, adminPlans.Single(p => p.Code == "ENTERPRISE").EstimatedMonthlyRevenue);

        // Single-plan handlers also compute identical MRR
        var proById = await new GetAdminPlanByIdQueryHandler(db, superAdmin)
            .Handle(new GetAdminPlanByIdQuery(proPlan.Id), CancellationToken.None);
        Assert.Equal(1, proById.ActiveTenantsCount);
        Assert.Equal(582_500m, proById.EstimatedMonthlyRevenue);

        var proUpdated = await new UpdateAdminPlanCommandHandler(db, superAdmin).Handle(
            new UpdateAdminPlanCommand(
                proPlan.Id, proPlan.Code, "Pro Updated", proPlan.Description,
                proPlan.MonthlyPrice, proPlan.YearlyPrice, proPlan.MaxRooms, proPlan.MaxProperties, proPlan.MaxStaff,
                proPlan.HasVnPay, proPlan.HasAdvancedReports, proPlan.IsActive, proPlan.IsPopular, proPlan.SortOrder, null),
            CancellationToken.None);
        Assert.Equal(1, proUpdated.ActiveTenantsCount);
        Assert.Equal(582_500m, proUpdated.EstimatedMonthlyRevenue);

        var proToggled = await new ToggleAdminPlanActiveCommandHandler(db, superAdmin)
            .Handle(new ToggleAdminPlanActiveCommand(proPlan.Id), CancellationToken.None);
        Assert.Equal(1, proToggled.ActiveTenantsCount);
        Assert.Equal(582_500m, proToggled.EstimatedMonthlyRevenue);
    }

    [Fact]
    public async Task TrialOnlySubscriptions_ContributeZeroMrr_AcrossOverviewAndAdminPlans()
    {
        var db = new FakeDbContext();
        var superAdmin = new SuperAdminUserContext();
        var tenantId = Guid.NewGuid();

        db.SubscriptionPlanList.Add(new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = "PRO",
            Name = "Pro",
            MonthlyPrice = 699_000m,
            YearlyPrice = 6_990_000m,
            MaxRooms = 50,
            MaxProperties = 3,
            MaxStaff = 10,
            SortOrder = 1,
            IsActive = true
        });
        db.TenantList.Add(new Tenant
        {
            Id = tenantId,
            Name = "Free Trial Boutique",
            Code = "TRIAL1",
            Slug = "trial-1",
            Status = TenantStatus.Active,
            SubscriptionTier = SubscriptionTier.Pro
        });
        db.SubscriptionList.Add(new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tier = SubscriptionTier.Pro,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Trial,
            PricePerCycle = 699_000m,
            CreatedAtUtc = DateTime.UtcNow
        });

        var overview = await new GetPlatformOverviewQueryHandler(db, superAdmin)
            .Handle(new GetPlatformOverviewQuery(), CancellationToken.None);
        var adminPlans = await new GetAdminPlansQueryHandler(db, superAdmin)
            .Handle(new GetAdminPlansQuery(), CancellationToken.None);

        Assert.Equal(0m, overview.MrrVnd);
        Assert.Equal(0m, overview.ArrVnd);
        Assert.All(overview.PlanBreakdown, p =>
        {
            Assert.Equal(0, p.ActiveTenantsCount);
            Assert.Equal(0m, p.EstimatedMrr);
        });
        Assert.All(adminPlans, p =>
        {
            Assert.Equal(0, p.ActiveTenantsCount);
            Assert.Equal(0m, p.EstimatedMonthlyRevenue);
        });
    }
}
