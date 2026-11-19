using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation.TestHelper;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Application.Promotions.Commands.CreatePromotion;
using HotelSaas.Application.Promotions.Commands.TogglePromotionStatus;
using HotelSaas.Application.Promotions.Commands.UpdatePromotion;
using HotelSaas.Application.Promotions.Queries.GetPromotions;
using HotelSaas.Application.Promotions.Queries.GetPublicPromotions;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;
using HotelSaas.Application.RoomTypes.DTOs;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests.Promotions;

public sealed class PromotionAndRateSplittingTests
{
    #region In-Memory Stub Harness

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "manager@hotelsaastest.local";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = HotelSaas.Domain.Enums.StaffRole.Manager;
        public Guid? RoleId { get; set; } = Guid.NewGuid();
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsurePropertyContext() { }
        public void EnsureTenantContext() { }
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

        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public MembershipLookupResult Result { get; set; }

        public StubMembershipLookupService(Guid propertyId)
        {
            Result = MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                StaffRole.Manager,
                propertyId,
                true,
                Array.Empty<Guid>(),
                PropertyStatus.Active);
        }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Result);
    }

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

    private sealed class StubEfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;

        private StubEfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new StubEfExpressionRewriter(effectiveRoot).Visit(expression);

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
                if (genDef == typeof(StubAsyncDbSet<>) || genDef == typeof(StubAsyncQueryable<>))
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

    private sealed class StubAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;

        public StubAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
        }

        private IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || StubEfExpressionRewriter.HasIgnoreQueryFilters(expression))
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
                typeof(StubAsyncQueryable<>).MakeGenericType(elementType),
                expression,
                this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new StubAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = StubEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = StubEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = StubEfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class StubAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public StubAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
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
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new AsyncEnumeratorWrapper<TElement>(GetEnumerator());
        }
    }

    private sealed class AsyncEnumeratorWrapper<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public AsyncEnumeratorWrapper(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
    }

    private sealed class StubAsyncDbSet<T> : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly List<T> _data;
        private readonly IQueryable<T> _rootQueryable;
        private readonly StubAsyncQueryProvider<T> _provider;

        public StubAsyncDbSet(List<T> data, ICurrentTenantService tenantService)
        {
            _data = data;
            _rootQueryable = _data.AsQueryable();
            _provider = new StubAsyncQueryProvider<T>(_data, tenantService);
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _rootQueryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        public override EntityEntry<T> Add(T entity)
        {
            _data.Add(entity);
            return null!;
        }

        public override void AddRange(params T[] entities) => _data.AddRange(entities);
        public override void AddRange(IEnumerable<T> entities) => _data.AddRange(entities);

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            var enumerable = _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression);
            return new AsyncEnumeratorWrapper<T>(enumerable.GetEnumerator());
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();
    }

    private sealed class StubApplicationDbContext : IApplicationDbContext
    {
        public List<User> UserList { get; } = new();
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<RoomType> RoomTypeList { get; } = new();
        public List<Room> RoomList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<PropertySurchargePolicy> SurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RateList { get; } = new();
        public List<RoomTypeRateAudit> RateAuditList { get; } = new();
        public List<Subscription> SubscriptionList { get; } = new();
        public List<AiUsageLog> AiUsageLogList { get; } = new();
        public List<Promotion> PromotionList { get; } = new();
        public List<GuestLoyaltyMembership> MembershipList { get; } = new();
        public List<LoyaltyPointTransaction> PointTransactionList { get; } = new();

        public StubApplicationDbContext(ICurrentTenantService tenantService)
        {
            Users = new StubAsyncDbSet<User>(UserList, tenantService);
            Tenants = new StubAsyncDbSet<Tenant>(TenantList, tenantService);
            Properties = new StubAsyncDbSet<Property>(PropertyList, tenantService);
            RoomTypes = new StubAsyncDbSet<RoomType>(RoomTypeList, tenantService);
            Rooms = new StubAsyncDbSet<Room>(RoomList, tenantService);
            Reservations = new StubAsyncDbSet<Reservation>(ReservationList, tenantService);
            PropertySurchargePolicies = new StubAsyncDbSet<PropertySurchargePolicy>(SurchargePolicyList, tenantService);
            RoomTypeRates = new StubAsyncDbSet<RoomTypeRate>(RateList, tenantService);
            RoomTypeRateAudits = new StubAsyncDbSet<RoomTypeRateAudit>(RateAuditList, tenantService);
            Subscriptions = new StubAsyncDbSet<Subscription>(SubscriptionList, tenantService);
            AiUsageLogs = new StubAsyncDbSet<AiUsageLog>(AiUsageLogList, tenantService);
            Promotions = new StubAsyncDbSet<Promotion>(PromotionList, tenantService);
            GuestLoyaltyMemberships = new StubAsyncDbSet<GuestLoyaltyMembership>(MembershipList, tenantService);
            LoyaltyPointTransactions = new StubAsyncDbSet<LoyaltyPointTransaction>(PointTransactionList, tenantService);
        }

        public DbSet<User> Users { get; }
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants { get; }
        public DbSet<Property> Properties { get; }
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<RoomType> RoomTypes { get; }
        public DbSet<Room> Rooms { get; }
        public DbSet<Reservation> Reservations { get; }
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions { get; }
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies { get; }
        public DbSet<RoomTypeRate> RoomTypeRates { get; }
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits { get; }
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships { get; }
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions { get; }
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs { get; }
        public DbSet<Promotion> Promotions { get; }

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());

        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<int> UpdateRoomStatusAtomicAsync(
            Guid roomId,
            Guid tenantId,
            Guid propertyId,
            RoomStatus expectedOldStatus,
            RoomStatus newStatus,
            DateTime updatedAtUtc,
            CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private sealed class StubLocationLookupService : ILocationLookupService
    {
        public IReadOnlyList<ProvinceDto> GetProvinces() => Array.Empty<ProvinceDto>();
        public IReadOnlyList<WardDto> GetWardsByProvince(string provinceCode) => Array.Empty<WardDto>();
        public ProvinceDto? GetProvinceByCode(string provinceCode) => null;
        public WardDto? GetWardByCode(string provinceCode, string wardCode) => null;
        public bool IsValidProvince(string provinceCode) => false;
        public bool IsValidWard(string provinceCode, string wardCode) => false;
        public IReadOnlyList<TouristZoneDto> GetTouristZones(string? provinceCode = null) => Array.Empty<TouristZoneDto>();
        public TouristZoneDto? GetTouristZoneBySlug(string slug) => null;
        public TouristZoneDto? FindTouristZone(string query) => null;
        public IReadOnlyList<LandmarkDto> GetLandmarks(string? provinceCode = null, string? touristZoneSlug = null) => Array.Empty<LandmarkDto>();
        public LandmarkDto? GetLandmarkBySlug(string slug) => null;
        public LandmarkDto? FindLandmark(string query) => null;
        public IReadOnlyList<LandmarkDto> SearchLandmarks(string query, string? provinceCode = null, int maxResults = 10) => Array.Empty<LandmarkDto>();
    }

    private sealed class StubDynamicPricingService : IDynamicPricingService
    {
        public DynamicPricingSummaryDto SummaryToReturn { get; set; } = new(
            Guid.NewGuid(),
            "Test Property",
            new DateOnly(2026, 11, 20),
            82.5,
            "High",
            Array.Empty<RoomTypePricingRecommendationDto>());

        public Task<DynamicPricingAdjustmentDto?> CalculateDynamicAdjustmentAsync(
            Guid propertyId,
            Guid roomTypeId,
            RentalType rentalType,
            DateOnly startDate,
            DateOnly endDate,
            decimal basePrice,
            CancellationToken cancellationToken = default)
            => Task.FromResult<DynamicPricingAdjustmentDto?>(null);

        public Task<DynamicPricingSummaryDto> GetPricingRecommendationsAsync(
            Guid propertyId,
            DateOnly targetDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult(SummaryToReturn with { PropertyId = propertyId, TargetDate = targetDate });
    }

    private sealed class StubSender : ISender
    {
        public object? LastSentRequest { get; private set; }
        public object? NextResponse { get; set; }

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            LastSentRequest = request;
            return Task.FromResult((TResponse)NextResponse!);
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            LastSentRequest = request;
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            LastSentRequest = request;
            return Task.FromResult(NextResponse);
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }

    private static DateOnly GetTodayVnDate()
    {
        var tz = TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var vnTz)
            ? vnTz
            : (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var seTz)
                ? seTz
                : TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT"));
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
    }

    private static (
        Guid TenantId,
        Guid PropertyId,
        Guid RoomTypeId,
        StubTenantService TenantSvc,
        StubPropertyService PropSvc,
        StubUserContext UserCtx,
        StubApplicationDbContext Db) BuildSeededRateContext()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var roomTypeId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var propSvc = new StubPropertyService { PropertyId = propertyId, IsTenantWide = true };
        var userCtx = new StubUserContext { UserId = userId, TenantId = tenantId, PropertyId = propertyId, IsTenantWide = true };
        var db = new StubApplicationDbContext(tenantSvc);

        db.TenantList.Add(new Tenant
        {
            Id = tenantId,
            Name = "Sunset Hospitality",
            Slug = "sunset-hospitality",
            Status = TenantStatus.Active
        });

        db.PropertyList.Add(new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "Sunset Đà Nẵng",
            Slug = "sunset-da-nang",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            IsPublished = true,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            MaxHourlyHours = 8,
            BufferMinutes = 30
        });

        db.RoomTypeList.Add(new RoomType
        {
            Id = roomTypeId,
            TenantId = tenantId,
            PropertyId = propertyId,
            Name = "Deluxe Sea View",
            Code = "DLX",
            BasePrice = 500000m,
            MaxOccupancy = 2
        });

        return (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db);
    }

    #endregion

    #region T016 Rate Interval Splitting Tests (All 4 Cases + Multi-Overlap)

    [Fact]
    public async Task CreateRoomTypeRate_CaseA_FullCover_DeactivatesExistingAndCreatesReplacement()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var today = GetTodayVnDate();

        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 60000m,
            NightlyPrice = 500000m,
            EffectiveFrom = today.AddDays(2),
            EffectiveTo = today.AddDays(8),
            IsActive = true
        });

        var handler = new CreateRoomTypeRateCommandHandler(
            db, tenantSvc, propSvc, userCtx, new StubMembershipLookupService(propertyId));

        await handler.Handle(new CreateRoomTypeRateCommand(
            roomTypeId, propertyId, 2, 250000m, 70000m, 700000m,
            today.AddDays(1), today.AddDays(10), "VND", "Thay thế toàn phần"), CancellationToken.None);

        var activeRates = db.RateList.Where(r => r.IsActive).ToList();
        Assert.Single(activeRates);
        Assert.Equal(today.AddDays(1), activeRates[0].EffectiveFrom);
        Assert.Equal(today.AddDays(10), activeRates[0].EffectiveTo);
        Assert.Equal(700000m, activeRates[0].NightlyPrice);

        Assert.Contains(db.RateAuditList, a => a.ActionType == "Replaced");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Replaced_Created");
    }

    [Fact]
    public async Task CreateRoomTypeRate_CaseB_StrictInteriorSplit_ShortensHeadAndCreatesActiveTail()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var today = GetTodayVnDate();

        var existingId = Guid.NewGuid();
        db.RateList.Add(new RoomTypeRate
        {
            Id = existingId,
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            Currency = "VND",
            EffectiveFrom = today.AddDays(1),
            EffectiveTo = today.AddDays(15),
            ChangeReason = "Giá nền",
            IsActive = true
        });

        var handler = new CreateRoomTypeRateCommandHandler(
            db, tenantSvc, propSvc, userCtx, new StubMembershipLookupService(propertyId));

        await handler.Handle(new CreateRoomTypeRateCommand(
            roomTypeId, propertyId, 2, 300000m, 80000m, 800000m,
            today.AddDays(5), today.AddDays(9), "VND", "Cao điểm lễ"), CancellationToken.None);

        var activeRates = db.RateList.Where(r => r.IsActive).OrderBy(r => r.EffectiveFrom).ToList();
        Assert.Equal(3, activeRates.Count);

        // Head [1, 5)
        Assert.Equal(existingId, activeRates[0].Id);
        Assert.Equal(today.AddDays(1), activeRates[0].EffectiveFrom);
        Assert.Equal(today.AddDays(5), activeRates[0].EffectiveTo);
        Assert.Equal(500000m, activeRates[0].NightlyPrice);

        // Middle [5, 9)
        Assert.Equal(today.AddDays(5), activeRates[1].EffectiveFrom);
        Assert.Equal(today.AddDays(9), activeRates[1].EffectiveTo);
        Assert.Equal(800000m, activeRates[1].NightlyPrice);

        // Cloned Tail [9, 15)
        Assert.Equal(today.AddDays(9), activeRates[2].EffectiveFrom);
        Assert.Equal(today.AddDays(15), activeRates[2].EffectiveTo);
        Assert.Equal(500000m, activeRates[2].NightlyPrice);
        Assert.Equal(200000m, activeRates[2].FirstHoursPrice);

        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_Shortened");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_Created");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_TailCreated");
    }

    [Fact]
    public async Task CreateRoomTypeRate_CaseC_RightTailOverlap_ShortensExistingRate()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var today = GetTodayVnDate();

        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            EffectiveFrom = today.AddDays(1),
            EffectiveTo = today.AddDays(10),
            IsActive = true
        });

        var handler = new CreateRoomTypeRateCommandHandler(
            db, tenantSvc, propSvc, userCtx, new StubMembershipLookupService(propertyId));

        await handler.Handle(new CreateRoomTypeRateCommand(
            roomTypeId, propertyId, 2, 250000m, 65000m, 650000m,
            today.AddDays(5), today.AddDays(14), "VND", "Cuối tuần"), CancellationToken.None);

        var activeRates = db.RateList.Where(r => r.IsActive).OrderBy(r => r.EffectiveFrom).ToList();
        Assert.Equal(2, activeRates.Count);
        Assert.Equal((today.AddDays(1), today.AddDays(5)), (activeRates[0].EffectiveFrom, activeRates[0].EffectiveTo));
        Assert.Equal((today.AddDays(5), today.AddDays(14)), (activeRates[1].EffectiveFrom, activeRates[1].EffectiveTo));
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_Shortened");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_Created");
    }

    [Fact]
    public async Task CreateRoomTypeRate_CaseD_LeftHeadOverlap_TrimsHeadStart()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var today = GetTodayVnDate();

        var existingId = Guid.NewGuid();
        db.RateList.Add(new RoomTypeRate
        {
            Id = existingId,
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            EffectiveFrom = today.AddDays(5),
            EffectiveTo = today.AddDays(15),
            IsActive = true
        });

        var handler = new CreateRoomTypeRateCommandHandler(
            db, tenantSvc, propSvc, userCtx, new StubMembershipLookupService(propertyId));

        await handler.Handle(new CreateRoomTypeRateCommand(
            roomTypeId, propertyId, 2, 260000m, 70000m, 700000m,
            today.AddDays(2), today.AddDays(9), "VND", "Đầu tuần"), CancellationToken.None);

        var activeRates = db.RateList.Where(r => r.IsActive).OrderBy(r => r.EffectiveFrom).ToList();
        Assert.Equal(2, activeRates.Count);
        Assert.Equal((today.AddDays(2), today.AddDays(9)), (activeRates[0].EffectiveFrom, activeRates[0].EffectiveTo));
        Assert.Equal(existingId, activeRates[1].Id);
        Assert.Equal((today.AddDays(9), today.AddDays(15)), (activeRates[1].EffectiveFrom, activeRates[1].EffectiveTo));
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Trimmed_Head");
    }

    [Fact]
    public async Task CreateRoomTypeRate_MultiOverlap_HandlesShortenReplaceAndTrimTogether()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var today = GetTodayVnDate();

        var rateMiddleId = Guid.NewGuid();
        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            EffectiveFrom = today.AddDays(1),
            EffectiveTo = today.AddDays(5),
            IsActive = true
        });
        db.RateList.Add(new RoomTypeRate
        {
            Id = rateMiddleId,
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 210000m,
            AdditionalHourPrice = 55000m,
            NightlyPrice = 550000m,
            EffectiveFrom = today.AddDays(5),
            EffectiveTo = today.AddDays(10),
            IsActive = true
        });
        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 220000m,
            AdditionalHourPrice = 60000m,
            NightlyPrice = 600000m,
            EffectiveFrom = today.AddDays(10),
            EffectiveTo = today.AddDays(15),
            IsActive = true
        });

        var handler = new CreateRoomTypeRateCommandHandler(
            db, tenantSvc, propSvc, userCtx, new StubMembershipLookupService(propertyId));

        await handler.Handle(new CreateRoomTypeRateCommand(
            roomTypeId, propertyId, 2, 300000m, 80000m, 800000m,
            today.AddDays(3), today.AddDays(12), "VND", "Đồng bộ giá mùa lễ"), CancellationToken.None);

        var activeRates = db.RateList.Where(r => r.IsActive).OrderBy(r => r.EffectiveFrom).ToList();
        Assert.Equal(3, activeRates.Count);
        Assert.Equal((today.AddDays(1), today.AddDays(3)), (activeRates[0].EffectiveFrom, activeRates[0].EffectiveTo));
        Assert.Equal((today.AddDays(3), today.AddDays(12)), (activeRates[1].EffectiveFrom, activeRates[1].EffectiveTo));
        Assert.Equal((today.AddDays(12), today.AddDays(15)), (activeRates[2].EffectiveFrom, activeRates[2].EffectiveTo));

        Assert.False(db.RateList.First(r => r.Id == rateMiddleId).IsActive);
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Split_Shortened");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Replaced");
        Assert.Contains(db.RateAuditList, a => a.ActionType == "Trimmed_Head");
    }

    #endregion

    #region T014 Promotions CRUD, Quote Discount & Guest Hold Atomic Usage Tests

    [Fact]
    public async Task CreatePromotion_NormalizesCodeToUppercase_AndRejectsDuplicatePerTenant()
    {
        var (tenantId, _, _, tenantSvc, _, _, db) = BuildSeededRateContext();

        var validator = new CreatePromotionCommandValidator();
        var invalidPercent = validator.TestValidate(new CreatePromotionCommand(
            "BAD150", "Invalid", null, PromotionType.PercentDiscount, 150m, 1, null,
            DateTime.UtcNow, DateTime.UtcNow.AddDays(5)));
        invalidPercent.ShouldHaveValidationErrorFor(x => x.Value);

        var handler = new CreatePromotionCommandHandler(db, tenantSvc);
        var created = await handler.Handle(new CreatePromotionCommand(
            " summer20 ", "Summer Deal", "Giảm 20%", PromotionType.PercentDiscount, 20m, 1, 50,
            DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddDays(10), true), CancellationToken.None);

        Assert.Equal("SUMMER20", created.Code);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(new CreatePromotionCommand(
            "SUMMER20", "Dup", null, PromotionType.FixedDiscount, 50000m, 1, null,
            DateTime.UtcNow, DateTime.UtcNow.AddDays(5), true), CancellationToken.None));
    }

    [Fact]
    public async Task PricingCalculator_SupportsPercentFixedAndFreeNightDiscounts()
    {
        var (tenantId, propertyId, roomTypeId, _, _, _, db) = BuildSeededRateContext();
        var property = db.PropertyList.Single();
        var roomType = db.RoomTypeList.Single();
        var checkIn = GetTodayVnDate().AddDays(2);
        var checkOut = checkIn.AddDays(2);

        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            EffectiveFrom = checkIn.AddDays(-1),
            EffectiveTo = checkOut.AddDays(5),
            IsActive = true
        });

        db.PromotionList.AddRange(
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "PCT20",
                Name = "Giảm 20%",
                Type = PromotionType.PercentDiscount,
                Value = 20m,
                MinNights = 1,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "FIX1200K",
                Name = "Giảm 1.2tr",
                Type = PromotionType.FixedDiscount,
                Value = 1200000m,
                MinNights = 1,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "FREE1NIGHT",
                Name = "Tặng 1 đêm",
                Type = PromotionType.FreeNight,
                Value = 1m,
                MinNights = 2,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            });

        var startUtc = new DateTime(checkIn.Year, checkIn.Month, checkIn.Day, 7, 0, 0, DateTimeKind.Utc); // 14:00 VN
        var endUtc = new DateTime(checkOut.Year, checkOut.Month, checkOut.Day, 5, 0, 0, DateTimeKind.Utc); // 12:00 VN
        var calculator = new PricingCalculator(db);

        // 1. PercentDiscount (20% of 1,000,000 = 200,000 -> 800,000)
        var pctQuote = await calculator.CalculateAsync(
            property, roomType, RentalType.Overnight, startUtc, endUtc, checkIn, checkOut, CancellationToken.None, "pct20");
        Assert.Equal("PCT20", pctQuote.PromoCode);
        Assert.Equal(200000m, pctQuote.PromoDiscountAmount);
        Assert.Equal(800000m, pctQuote.TotalAmount);
        Assert.Contains(pctQuote.Breakdown, b => b.Category == "Discount" && b.Amount == -200000m);

        // 2. FixedDiscount capped at subtotal (1,200,000 capped at 1,000,000 -> 0)
        var fixedQuote = await calculator.CalculateAsync(
            property, roomType, RentalType.Overnight, startUtc, endUtc, checkIn, checkOut, CancellationToken.None, "FIX1200K");
        Assert.Equal(1000000m, fixedQuote.PromoDiscountAmount);
        Assert.Equal(0m, fixedQuote.TotalAmount);

        // 3. FreeNight discounts 1 nightly price (500,000 -> 500,000)
        var freeNightQuote = await calculator.CalculateAsync(
            property, roomType, RentalType.Overnight, startUtc, endUtc, checkIn, checkOut, CancellationToken.None, "FREE1NIGHT");
        Assert.Equal(500000m, freeNightQuote.PromoDiscountAmount);
        Assert.Equal(500000m, freeNightQuote.TotalAmount);

        // 4. FreeNight rejected for Hourly stays
        var hourlyEndUtc = startUtc.AddHours(2);
        await Assert.ThrowsAsync<BadRequestException>(() => calculator.CalculateAsync(
            property, roomType, RentalType.Hourly, startUtc, hourlyEndUtc, null, null, CancellationToken.None, "FREE1NIGHT"));
    }

    [Fact]
    public async Task PricingCalculator_RejectsExhaustedInactiveExpiredAndMinNightsPromo()
    {
        var (tenantId, propertyId, roomTypeId, _, _, _, db) = BuildSeededRateContext();
        var property = db.PropertyList.Single();
        var roomType = db.RoomTypeList.Single();
        var checkIn = GetTodayVnDate().AddDays(1);
        var checkOut = checkIn.AddDays(1);

        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 500000m,
            EffectiveFrom = checkIn.AddDays(-1),
            EffectiveTo = checkOut.AddDays(5),
            IsActive = true
        });

        db.PromotionList.AddRange(
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "EXHAUSTED",
                Name = "Hết lượt",
                Type = PromotionType.PercentDiscount,
                Value = 10m,
                MaxUsage = 3,
                CurrentUsage = 3,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(5),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "PAUSED",
                Name = "Tạm tắt",
                Type = PromotionType.PercentDiscount,
                Value = 10m,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(5),
                IsActive = false
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "EXPIRED",
                Name = "Hết hạn",
                Type = PromotionType.PercentDiscount,
                Value = 10m,
                StartsAtUtc = DateTime.UtcNow.AddDays(-10),
                EndsAtUtc = DateTime.UtcNow.AddDays(-1),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "LONGSTAY3",
                Name = "Từ 3 đêm",
                Type = PromotionType.PercentDiscount,
                Value = 15m,
                MinNights = 3,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(5),
                IsActive = true
            });

        var startUtc = new DateTime(checkIn.Year, checkIn.Month, checkIn.Day, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(checkOut.Year, checkOut.Month, checkOut.Day, 5, 0, 0, DateTimeKind.Utc);
        var calculator = new PricingCalculator(db);

        foreach (var badCode in new[] { "EXHAUSTED", "PAUSED", "EXPIRED", "LONGSTAY3", "UNKNOWN" })
        {
            var ex = await Assert.ThrowsAsync<BadRequestException>(() => calculator.CalculateAsync(
                property, roomType, RentalType.Overnight, startUtc, endUtc, checkIn, checkOut, CancellationToken.None, badCode));
            Assert.Equal("ERR_INVALID_PROMO_CODE", ex.ErrorCode);
        }
    }

    [Fact]
    public async Task CreateGuestHold_WithValidPromo_AppliesDiscountAndIncrementsUsageOnceOnIdempotency()
    {
        var (tenantId, propertyId, roomTypeId, tenantSvc, propSvc, userCtx, db) = BuildSeededRateContext();
        var checkIn = GetTodayVnDate().AddDays(2);
        var checkOut = checkIn.AddDays(1);

        db.UserList.Add(new User
        {
            Id = userCtx.UserId,
            Email = "guest@example.com",
            FullName = "Nguyen Van Khach",
            PhoneNumber = "+84901234567",
            PhoneVerifiedAtUtc = DateTime.UtcNow.AddDays(-1)
        });

        db.RoomList.Add(new Room
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            RoomNumber = "101",
            Floor = 1,
            Status = RoomStatus.Clean,
            IsActive = true
        });

        db.RateList.Add(new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            FirstHours = 2,
            FirstHoursPrice = 200000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 600000m,
            EffectiveFrom = checkIn.AddDays(-1),
            EffectiveTo = checkOut.AddDays(5),
            IsActive = true
        });

        var promo = new Promotion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "WELCOME100K",
            Name = "Giảm 100k",
            Type = PromotionType.FixedDiscount,
            Value = 100000m,
            MinNights = 1,
            MaxUsage = 2,
            CurrentUsage = 0,
            StartsAtUtc = DateTime.UtcNow.AddDays(-1),
            EndsAtUtc = DateTime.UtcNow.AddDays(10),
            IsActive = true
        };
        db.PromotionList.Add(promo);

        var startUtc = new DateTime(checkIn.Year, checkIn.Month, checkIn.Day, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(checkOut.Year, checkOut.Month, checkOut.Day, 5, 0, 0, DateTimeKind.Utc);

        var calculator = new PricingCalculator(db);
        var holdHandler = new CreateGuestHoldCommandHandler(db, calculator, tenantSvc, propSvc);

        var cmd = new CreateGuestHoldCommand(
            PropertySlug: "sunset-da-nang",
            RoomTypeId: roomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Nguyen Van Khach",
            GuestEmail: "guest@example.com",
            GuestPhone: "0901234567",
            NumberOfGuests: 2,
            CheckInDate: checkIn,
            CheckOutDate: checkOut,
            ExpectedTotalAmount: 500000m,
            IdempotencyKey: "promo-idem-123456",
            GuestUserId: userCtx.UserId,
            PromoCode: "welcome100k");

        var firstHold = await holdHandler.Handle(cmd, CancellationToken.None);
        Assert.Equal("WELCOME100K", firstHold.PromoCode);
        Assert.Equal(100000m, firstHold.PromoDiscountAmount);
        Assert.Equal(500000m, firstHold.TotalAmount);
        Assert.Equal(1, promo.CurrentUsage);

        // Idempotency replay must return exact hold WITHOUT incrementing CurrentUsage again
        var replayHold = await holdHandler.Handle(cmd, CancellationToken.None);
        Assert.Equal(firstHold.ReservationId, replayHold.ReservationId);
        Assert.Equal("WELCOME100K", replayHold.PromoCode);
        Assert.Equal(1, promo.CurrentUsage);
    }

    [Fact]
    public async Task GetPublicPromotions_ReturnsOnlyActiveInWindowNonExhaustedPublishedDeals()
    {
        var (tenantId, _, _, _, _, _, db) = BuildSeededRateContext();
        var unpublishedTenantId = Guid.NewGuid();
        db.TenantList.Add(new Tenant
        {
            Id = unpublishedTenantId,
            Name = "Hidden Group",
            Slug = "hidden-group",
            Status = TenantStatus.Active
        });

        db.PromotionList.AddRange(
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "LIVE20",
                Name = "Live Deal",
                Type = PromotionType.PercentDiscount,
                Value = 20m,
                MinNights = 1,
                MaxUsage = 10,
                CurrentUsage = 3,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = "MAXEDOUT",
                Name = "Exhausted",
                Type = PromotionType.PercentDiscount,
                Value = 15m,
                MaxUsage = 5,
                CurrentUsage = 5,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            },
            new Promotion
            {
                Id = Guid.NewGuid(),
                TenantId = unpublishedTenantId,
                Code = "UNPUBLISHED",
                Name = "No Published Properties",
                Type = PromotionType.FixedDiscount,
                Value = 50000m,
                StartsAtUtc = DateTime.UtcNow.AddDays(-1),
                EndsAtUtc = DateTime.UtcNow.AddDays(10),
                IsActive = true
            });

        var handler = new GetPublicPromotionsQueryHandler(db);
        var deals = await handler.Handle(new GetPublicPromotionsQuery(), CancellationToken.None);

        var deal = Assert.Single(deals);
        Assert.Equal("LIVE20", deal.Code);
        Assert.Equal("Sunset Hospitality", deal.TenantName);
        Assert.Contains("Đà Nẵng", deal.ApplicableDestinations);
    }

    #endregion

    #region T016 AI Controller Hardening & Usage Tracking Tests

    [Fact]
    public async Task AiController_GetAiUsageStatus_CountsOnlyRealAiUsageLogs()
    {
        var (tenantId, propertyId, _, _, _, userCtx, db) = BuildSeededRateContext();
        var sender = new StubSender();
        var pricingSvc = new StubDynamicPricingService();

        // Operational rows must NOT inflate UsedCount
        for (int i = 0; i < 4; i++)
        {
            db.ReservationList.Add(new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                CreatedAtUtc = DateTime.UtcNow
            });
            db.RateAuditList.Add(new RoomTypeRateAudit
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                ChangedAtUtc = DateTime.UtcNow
            });
        }

        var controller = new AiController(db, userCtx, sender, new StubLocationLookupService(), pricingSvc);

        var initialResult = Assert.IsType<OkObjectResult>(await controller.GetAiUsageStatus(CancellationToken.None));
        var initialDto = Assert.IsType<AiUsageStatusDto>(initialResult.Value);
        Assert.Equal(0, initialDto.UsedCount);
        Assert.Equal(20, initialDto.RemainingCount);

        db.AiUsageLogList.Add(new AiUsageLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Feature = "DynamicPricing",
            CreatedAtUtc = DateTime.UtcNow
        });

        var afterResult = Assert.IsType<OkObjectResult>(await controller.GetAiUsageStatus(CancellationToken.None));
        var afterDto = Assert.IsType<AiUsageStatusDto>(afterResult.Value);
        Assert.Equal(1, afterDto.UsedCount);
        Assert.Equal(19, afterDto.RemainingCount);
    }

    [Fact]
    public async Task AiController_DynamicPricingEndpoints_EnforceTenantAndBranchScopeAndLogUsage()
    {
        var (tenantId, propertyId, roomTypeId, _, _, userCtx, db) = BuildSeededRateContext();
        var otherPropId = Guid.NewGuid();
        db.PropertyList.Add(new Property
        {
            Id = otherPropId,
            TenantId = tenantId,
            Name = "Other Branch",
            Slug = "other-branch",
            Status = PropertyStatus.Active
        });

        var sender = new StubSender
        {
            NextResponse = new RoomTypeRateDto
            {
                Id = Guid.NewGuid(),
                PropertyId = propertyId,
                RoomTypeId = roomTypeId,
                NightlyPrice = 650000m,
                EffectiveFrom = GetTodayVnDate(),
                EffectiveTo = GetTodayVnDate().AddDays(1),
                IsActive = true
            }
        };
        var pricingSvc = new StubDynamicPricingService();

        // 1. Missing TenantId -> 401
        var unauthUser = new StubUserContext { TenantId = null };
        var unauthController = new AiController(db, unauthUser, sender, new StubLocationLookupService(), pricingSvc);
        Assert.IsType<UnauthorizedObjectResult>(
            await unauthController.GetDynamicPricingRecommendations(propertyId, null, CancellationToken.None));

        // 2. Branch-scoped user accessing wrong property -> 403 Forbid
        userCtx.IsTenantWide = false;
        userCtx.PropertyId = propertyId;
        var controller = new AiController(db, userCtx, sender, new StubLocationLookupService(), pricingSvc);
        Assert.IsType<ForbidResult>(
            await controller.GetDynamicPricingRecommendations(otherPropId, null, CancellationToken.None));

        // 3. Valid property recommendation call -> 200 + AiUsageLog
        var recResult = Assert.IsType<OkObjectResult>(
            await controller.GetDynamicPricingRecommendations(propertyId, null, CancellationToken.None));
        var summary = Assert.IsType<DynamicPricingSummaryDto>(recResult.Value);
        Assert.Equal(propertyId, summary.PropertyId);
        Assert.Single(db.AiUsageLogList, l => l.Feature == "DynamicPricing");

        // 4. 1-click Apply dispatches CreateRoomTypeRateCommand and records AiUsageLog
        var applyResult = await controller.ApplyDynamicPricingRecommendation(
            new ApplyDynamicPricingRequest(roomTypeId, 650000m, propertyId),
            CancellationToken.None);

        var okApply = Assert.IsType<OkObjectResult>(applyResult);
        var rateDto = Assert.IsType<RoomTypeRateDto>(okApply.Value);
        Assert.Equal(650000m, rateDto.NightlyPrice);
        var sentCmd = Assert.IsType<CreateRoomTypeRateCommand>(sender.LastSentRequest);
        Assert.Equal(650000m, sentCmd.NightlyPrice);
        Assert.Single(db.AiUsageLogList, l => l.Feature == "DynamicPricingApply");
    }

    #endregion
}
