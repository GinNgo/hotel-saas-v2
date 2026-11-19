using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation.TestHelper;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.Commands.RescheduleGuestBooking;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.Reservations.Commands.RegenerateSmartLockPin;
using HotelSaas.Application.Reservations.Commands.RevokeSmartLockPin;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests;

public sealed class GuestHoldRescheduleAndSmartLockTests
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
        public string Email { get; set; } = "staff@hotelsaastest.local";
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
        public string? IpAddress => "127.0.0.1";

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
        public List<Payment> PaymentList { get; } = new();
        public List<PropertySurchargePolicy> SurchargePolicyList { get; } = new();
        public List<RoomTypeRate> RateList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();
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
            Payments = new StubAsyncDbSet<Payment>(PaymentList, tenantService);
            PropertySurchargePolicies = new StubAsyncDbSet<PropertySurchargePolicy>(SurchargePolicyList, tenantService);
            RoomTypeRates = new StubAsyncDbSet<RoomTypeRate>(RateList, tenantService);
            AuditLogs = new StubAsyncDbSet<AuditLog>(AuditLogList, tenantService);
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
        public DbSet<Payment> Payments { get; }
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies { get; }
        public DbSet<RoomTypeRate> RoomTypeRates { get; }
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<AuditLog> AuditLogs { get; }
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships { get; }
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions { get; }
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();
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

    private sealed class StubSender : ISender
    {
        public object? LastSentRequest { get; private set; }
        public object? ResponseToReturn { get; set; }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            LastSentRequest = request;
            return Task.FromResult((TResponse)ResponseToReturn!);
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            LastSentRequest = request;
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            LastSentRequest = request;
            return Task.FromResult(ResponseToReturn);
        }
    }

    private static (
        StubTenantService TenantSvc,
        StubPropertyService PropSvc,
        StubUserContext UserCtx,
        StubApplicationDbContext Context,
        Property Property,
        RoomType RoomType,
        Room Room) CreateSeededFixture()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var roomTypeId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var propSvc = new StubPropertyService { PropertyId = propertyId, IsTenantWide = true };
        var userCtx = new StubUserContext { TenantId = tenantId, PropertyId = propertyId };
        var ctx = new StubApplicationDbContext(tenantSvc);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Hotel Chain Test",
            Code = "HCT",
            Status = TenantStatus.Active
        };
        var property = new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Tenant = tenant,
            Name = "Branch Da Lat",
            Code = "BDL",
            Slug = "branch-da-lat",
            Address = "10 Tran Phu, Da Lat",
            Status = PropertyStatus.Active,
            IsPublished = true,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 8,
            AllowHourlyBooking = true,
            AllowOvernightBooking = true,
            AllowDailyBooking = true
        };
        var roomType = new RoomType
        {
            Id = roomTypeId,
            TenantId = tenantId,
            PropertyId = propertyId,
            Name = "Deluxe Garden",
            Code = "DLX",
            BasePrice = 800_000m,
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
            IsActive = true,
            Status = RoomStatus.Clean
        };
        var rate = new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            EffectiveTo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(400)),
            NightlyPrice = 800_000m,
            FirstHours = 2,
            FirstHoursPrice = 300_000m,
            AdditionalHourPrice = 80_000m,
            IsActive = true
        };

        ctx.TenantList.Add(tenant);
        ctx.PropertyList.Add(property);
        ctx.RoomTypeList.Add(roomType);
        ctx.RoomList.Add(room);
        ctx.RateList.Add(rate);

        return (tenantSvc, propSvc, userCtx, ctx, property, roomType, room);
    }

    #endregion

    #region CreateGuestHold SpecialRequests Tests

    [Fact]
    public async Task CreateGuestHold_WithSpecialRequests_StoresTrimmedNoteInSnapshotCustomerNotes()
    {
        var (tenantSvc, propSvc, _, ctx, property, roomType, _) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var checkOut = checkIn.AddDays(2);
        var (startUtc, endUtc) = ReservationTimeHelper.GetOvernightUtcInterval(
            checkIn, checkOut, property.CheckInTime, property.CheckOutTime);

        var cmd = new CreateGuestHoldCommand(
            PropertySlug: property.Slug,
            RoomTypeId: roomType.Id,
            RentalType: RentalType.Daily,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Nguyen Van A",
            GuestEmail: "vana@example.com",
            GuestPhone: "0912345678",
            NumberOfGuests: 2,
            CheckInDate: checkIn,
            CheckOutDate: checkOut,
            IdempotencyKey: "hold-spec-req-001",
            FirebaseIdToken: "mock-token",
            SpecialRequests: "  Tầng cao, yên tĩnh, không hút thuốc  ");

        var hold = await handler.Handle(cmd, CancellationToken.None);

        Assert.NotNull(hold);
        var saved = Assert.Single(ctx.ReservationList);
        var snap = ReservationSnapshotHelper.TryDeserialize(saved.Notes);
        Assert.NotNull(snap);
        Assert.Equal("Tầng cao, yên tĩnh, không hút thuốc", snap!.CustomerNotes);
        Assert.Equal("Tầng cao, yên tĩnh, không hút thuốc", ReservationSnapshotHelper.CleanCustomerNotes(saved.Notes, snap));
    }

    [Fact]
    public async Task CreateGuestHold_SpecialRequestsExceeds500Chars_FailsValidatorAndHandler()
    {
        var (tenantSvc, propSvc, _, ctx, property, roomType, _) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);
        var validator = new CreateGuestHoldCommandValidator();

        var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var checkOut = checkIn.AddDays(1);
        var (startUtc, endUtc) = ReservationTimeHelper.GetOvernightUtcInterval(
            checkIn, checkOut, property.CheckInTime, property.CheckOutTime);

        var tooLong = new string('x', 501);
        var cmd = new CreateGuestHoldCommand(
            PropertySlug: property.Slug,
            RoomTypeId: roomType.Id,
            RentalType: RentalType.Daily,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Nguyen Van A",
            GuestEmail: "vana@example.com",
            GuestPhone: "0912345678",
            CheckInDate: checkIn,
            CheckOutDate: checkOut,
            FirebaseIdToken: "mock-token",
            SpecialRequests: tooLong);

        var valResult = validator.TestValidate(cmd);
        valResult.ShouldHaveValidationErrorFor(x => x.SpecialRequests);

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_SPECIAL_REQUESTS_TOO_LONG", ex.ErrorCode);
    }

    #endregion

    #region RescheduleGuestBooking (G0-05) Tests

    [Fact]
    public async Task RescheduleGuestBooking_ConfirmedDailyBooking_RecalculatesQuotePreservesSnapshotAndWritesAudit()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, roomType, room) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);

        var oldCheckIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
        var oldCheckOut = oldCheckIn.AddDays(1);
        var (oldStartUtc, oldEndUtc) = ReservationTimeHelper.GetOvernightUtcInterval(
            oldCheckIn, oldCheckOut, property.CheckInTime, property.CheckOutTime);

        var promo = new Promotion
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            Code = "SAVE10",
            Name = "Giam 10%",
            Type = PromotionType.PercentDiscount,
            Value = 10m,
            MinNights = 1,
            MaxUsage = 1,
            CurrentUsage = 1, // This booking already consumed the last slot
            StartsAtUtc = DateTime.UtcNow.AddDays(-1),
            EndsAtUtc = DateTime.UtcNow.AddDays(30),
            IsActive = true
        };
        ctx.PromotionList.Add(promo);

        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Daily,
            StartAtUtc = oldStartUtc,
            EndAtUtc = oldEndUtc,
            BufferMinutes = 30,
            RoomTypeId = roomType.Id,
            RoomTypeName = roomType.Name,
            TotalAmount = 670_000m,
            PromoCode = "SAVE10",
            PromoDiscountAmount = 80_000m,
            Currency = "VND",
            CustomerNotes = "Phòng gần thang máy",
            LookupToken = "tok-reschedule-valid-01",
            DepositRequired = 201_000m,
            IsOnlineHold = true,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30),
            IsPhoneVerified = true
        };

        var guestId = Guid.NewGuid();
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            Room = room,
            GuestUserId = guestId,
            GuestName = "Tran Thi B",
            GuestEmail = "thib@example.com",
            GuestPhone = "+84912345678",
            CheckInDate = oldCheckIn,
            CheckOutDate = oldCheckOut,
            NumberOfGuests = 2,
            TotalAmount = 670_000m,
            PointsRedeemed = 50,
            PointsDiscountAmount = 50_000m,
            Status = ReservationStatus.Confirmed,
            SmartLockPin = "654321",
            SmartLockStatus = "Active",
            ConfirmationCode = "RES-RSC01",
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            CreatedAtUtc = DateTime.UtcNow
        };
        ctx.ReservationList.Add(reservation);
        ctx.PaymentList.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            ReservationId = reservation.Id,
            Amount = 216_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Completed
        });

        var newCheckIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20));
        var newCheckOut = newCheckIn.AddDays(2); // 2 nights * 800,000 = 1,600,000 -> -10% (160,000) = 1,440,000 -> -50,000 pts = 1,390,000
        var (newStartUtc, newEndUtc) = ReservationTimeHelper.GetOvernightUtcInterval(
            newCheckIn, newCheckOut, property.CheckInTime, property.CheckOutTime);

        var handler = new RescheduleGuestBookingCommandHandler(ctx, pc, tenantSvc, propSvc, userCtx);
        var result = await handler.Handle(
            new RescheduleGuestBookingCommand(
                LookupToken: "tok-reschedule-valid-01",
                NewStartAtUtc: newStartUtc,
                NewEndAtUtc: newEndUtc,
                NewCheckInDate: newCheckIn,
                NewCheckOutDate: newCheckOut,
                Reason: "Dời chuyến bay 10 ngày",
                AuthenticatedUserId: guestId),
            CancellationToken.None);

        Assert.Equal(1_390_000m, result.TotalAmount);
        Assert.Equal(417_000m, result.DepositRequired); // 30% of 1,390,000
        Assert.Equal(216_000m, result.PaidAmount);
        Assert.Equal(1_174_000m, result.RemainingBalance);
        Assert.Equal(newCheckIn, result.CheckInDate);
        Assert.Equal(newCheckOut, result.CheckOutDate);
        Assert.Equal("tok-reschedule-valid-01", result.LookupToken);
        Assert.Equal("654321", result.SmartLockPin);

        var updatedSnap = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        Assert.NotNull(updatedSnap);
        Assert.Equal("Phòng gần thang máy", updatedSnap!.CustomerNotes);
        Assert.Equal("SAVE10", updatedSnap.PromoCode);
        Assert.Equal(160_000m, updatedSnap.PromoDiscountAmount);
        Assert.Equal(RentalType.Daily, updatedSnap.RentalType);

        var audit = Assert.Single(ctx.AuditLogList);
        Assert.Equal("Reschedule", audit.Action);
        Assert.Contains("Dời chuyến bay 10 ngày", audit.NewValues);
    }

    [Fact]
    public async Task RescheduleGuestBooking_OverlappingRoomReservation_ThrowsConflictAndDoesNotMutate()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, roomType, room) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);

        var checkInA = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
        var checkOutA = checkInA.AddDays(2);
        var (startA, endA) = ReservationTimeHelper.GetOvernightUtcInterval(checkInA, checkOutA, property.CheckInTime, property.CheckOutTime);

        var checkInB = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20));
        var checkOutB = checkInB.AddDays(2);
        var (startB, endB) = ReservationTimeHelper.GetOvernightUtcInterval(checkInB, checkOutB, property.CheckInTime, property.CheckOutTime);

        var targetRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            CheckInDate = checkInA,
            CheckOutDate = checkOutA,
            TotalAmount = 1_600_000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-TGT01",
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = startA,
                EndAtUtc = endA,
                RoomTypeId = roomType.Id,
                RoomTypeName = roomType.Name,
                LookupToken = "tok-target-01",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30)
            })
        };

        var blockingRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            CheckInDate = checkInB,
            CheckOutDate = checkOutB,
            TotalAmount = 1_600_000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-BLK01",
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = startB,
                EndAtUtc = endB,
                RoomTypeId = roomType.Id,
                LookupToken = "tok-blocking-01",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30)
            })
        };

        ctx.ReservationList.AddRange(new[] { targetRes, blockingRes });

        var handler = new RescheduleGuestBookingCommandHandler(ctx, pc, tenantSvc, propSvc, userCtx);
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(
                new RescheduleGuestBookingCommand("tok-target-01", startB, endB, checkInB, checkOutB),
                CancellationToken.None));

        Assert.Equal("ERR_ROOM_UNAVAILABLE", ex.ErrorCode);
        Assert.Equal(checkInA, targetRes.CheckInDate);
    }

    [Fact]
    public async Task RescheduleGuestBooking_ConfirmationCodeOnly_OrMismatchedUser_ThrowsForbidden()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, roomType, room) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);

        var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var checkOut = checkIn.AddDays(1);
        var (startUtc, endUtc) = ReservationTimeHelper.GetOvernightUtcInterval(checkIn, checkOut, property.CheckInTime, property.CheckOutTime);

        var ownerUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        ctx.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            GuestUserId = ownerUserId,
            CheckInDate = checkIn,
            CheckOutDate = checkOut,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-ONLYCODE",
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                RoomTypeId = roomType.Id,
                LookupToken = "tok-secret-only",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30)
            })
        });

        var handler = new RescheduleGuestBookingCommandHandler(ctx, pc, tenantSvc, propSvc, userCtx);
        var newStart = startUtc.AddDays(2);
        var newEnd = endUtc.AddDays(2);

        // Confirmation code alone cannot authorize reschedule
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new RescheduleGuestBookingCommand("RES-ONLYCODE", newStart, newEnd), CancellationToken.None));

        // Wrong authenticated user cannot reschedule another guest's reservation even with token
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new RescheduleGuestBookingCommand("tok-secret-only", newStart, newEnd, AuthenticatedUserId: otherUserId), CancellationToken.None));
    }

    [Fact]
    public async Task RescheduleGuestBooking_Beyond365Days_OrExpiredHold_ThrowsExpectedException()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, roomType, room) = CreateSeededFixture();
        var pc = new PricingCalculator(ctx);

        var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var checkOut = checkIn.AddDays(1);
        var (startUtc, endUtc) = ReservationTimeHelper.GetOvernightUtcInterval(checkIn, checkOut, property.CheckInTime, property.CheckOutTime);

        ctx.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            CheckInDate = checkIn,
            CheckOutDate = checkOut,
            Status = ReservationStatus.PendingPayment,
            ConfirmationCode = "RES-EXP01",
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                RoomTypeId = roomType.Id,
                LookupToken = "tok-expired-hold",
                IsOnlineHold = true,
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-2),
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30)
            })
        });

        ctx.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            CheckInDate = checkIn,
            CheckOutDate = checkOut,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-FAR01",
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                RoomTypeId = roomType.Id,
                LookupToken = "tok-far-future",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(30)
            })
        });

        var handler = new RescheduleGuestBookingCommandHandler(ctx, pc, tenantSvc, propSvc, userCtx);

        var holdEx = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new RescheduleGuestBookingCommand("tok-expired-hold", startUtc.AddDays(2), endUtc.AddDays(2)), CancellationToken.None));
        Assert.Equal("ERR_HOLD_EXPIRED", holdEx.ErrorCode);

        var farEx = await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new RescheduleGuestBookingCommand("tok-far-future", DateTime.UtcNow.AddDays(370), DateTime.UtcNow.AddDays(371)), CancellationToken.None));
        Assert.Equal("ERR_INVALID_SCHEDULE", farEx.ErrorCode);
    }

    #endregion

    #region Smart Lock M5 (G0-03) Tests

    [Fact]
    public async Task RegenerateSmartLockPin_ConfirmedReservation_GeneratesNewSixDigitActivePinAndAudits()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, _, room) = CreateSeededFixture();
        var membershipLookup = new StubMembershipLookupService(property.Id);

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            Room = room,
            Status = ReservationStatus.Confirmed,
            SmartLockPin = "111222",
            SmartLockStatus = "Revoked",
            ConfirmationCode = "RES-SL01"
        };
        ctx.ReservationList.Add(reservation);

        var handler = new RegenerateSmartLockPinCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipLookup);
        var result = await handler.Handle(
            new RegenerateSmartLockPinCommand(reservation.Id, property.Id, "Khách báo quên mã PIN"),
            CancellationToken.None);

        Assert.Equal("Active", result.SmartLockStatus);
        Assert.NotNull(result.SmartLockPin);
        Assert.Matches(@"^\d{6}$", result.SmartLockPin!);
        Assert.NotEqual("111222", result.SmartLockPin);
        Assert.NotNull(reservation.SmartLockActivatedAtUtc);

        var audit = Assert.Single(ctx.AuditLogList);
        Assert.Equal("RegenerateSmartLockPin", audit.Action);
        Assert.DoesNotContain(result.SmartLockPin!, audit.NewValues); // Never leak raw PIN into AuditLog
        Assert.Contains("Khách báo quên mã PIN", audit.NewValues);
    }

    [Fact]
    public async Task RevokeSmartLockPin_ActiveReservation_SetsRevokedPreservesHistoryAndBlocksDoubleRevoke()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, _, room) = CreateSeededFixture();
        var membershipLookup = new StubMembershipLookupService(property.Id);
        var activatedAt = DateTime.UtcNow.AddHours(-2);

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            Room = room,
            Status = ReservationStatus.CheckedIn,
            SmartLockPin = "654321",
            SmartLockStatus = "Active",
            SmartLockActivatedAtUtc = activatedAt,
            ConfirmationCode = "RES-SL02"
        };
        ctx.ReservationList.Add(reservation);

        var handler = new RevokeSmartLockPinCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipLookup);
        var result = await handler.Handle(
            new RevokeSmartLockPinCommand(reservation.Id, property.Id, "Khách làm mất thẻ từ"),
            CancellationToken.None);

        Assert.Equal("Revoked", result.SmartLockStatus);
        Assert.Equal(activatedAt, reservation.SmartLockActivatedAtUtc);

        var audit = Assert.Single(ctx.AuditLogList);
        Assert.Equal("RevokeSmartLockPin", audit.Action);
        Assert.Contains("Khách làm mất thẻ từ", audit.NewValues);

        var doubleRevokeEx = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new RevokeSmartLockPinCommand(reservation.Id, property.Id), CancellationToken.None));
        Assert.Equal("ERR_SMART_LOCK_ALREADY_REVOKED", doubleRevokeEx.ErrorCode);
    }

    [Fact]
    public async Task SmartLockCommands_FailClosedOnCrossBranchOrInvalidStatus()
    {
        var (tenantSvc, propSvc, userCtx, ctx, property, _, room) = CreateSeededFixture();
        propSvc.IsTenantWide = false;
        propSvc.PropertyId = property.Id;
        var wrongPropertyId = Guid.NewGuid();

        var pendingRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = room.Id,
            Status = ReservationStatus.PendingPayment,
            ConfirmationCode = "RES-SL03"
        };
        ctx.ReservationList.Add(pendingRes);

        var regenHandler = new RegenerateSmartLockPinCommandHandler(ctx, tenantSvc, propSvc, userCtx);
        var revokeHandler = new RevokeSmartLockPinCommandHandler(ctx, tenantSvc, propSvc, userCtx);

        // Cross-branch request fails closed with ForbiddenException
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            regenHandler.Handle(new RegenerateSmartLockPinCommand(pendingRes.Id, wrongPropertyId), CancellationToken.None));

        // PendingPayment reservation cannot regenerate or revoke
        var regenStatusEx = await Assert.ThrowsAsync<ConflictException>(() =>
            regenHandler.Handle(new RegenerateSmartLockPinCommand(pendingRes.Id, property.Id), CancellationToken.None));
        Assert.Equal("ERR_INVALID_STATUS_TRANSITION", regenStatusEx.ErrorCode);

        var revokeStatusEx = await Assert.ThrowsAsync<ConflictException>(() =>
            revokeHandler.Handle(new RevokeSmartLockPinCommand(pendingRes.Id, property.Id), CancellationToken.None));
        Assert.Equal("ERR_INVALID_STATUS_TRANSITION", revokeStatusEx.ErrorCode);
    }

    [Fact]
    public void ReservationsController_SmartLockEndpoints_RequireCheckInOutUpdatePermission()
    {
        var controllerType = typeof(ReservationsController);
        var regenMethod = controllerType.GetMethod(nameof(ReservationsController.RegenerateSmartLockPin));
        var revokeMethod = controllerType.GetMethod(nameof(ReservationsController.RevokeSmartLockPin));

        Assert.NotNull(regenMethod);
        Assert.NotNull(revokeMethod);

        var regenRoute = regenMethod!.GetCustomAttribute<HttpPostAttribute>();
        var revokeRoute = revokeMethod!.GetCustomAttribute<HttpPostAttribute>();
        Assert.Equal("{id:guid}/smart-lock/regenerate", regenRoute?.Template);
        Assert.Equal("{id:guid}/smart-lock/revoke", revokeRoute?.Template);

        var regenPerm = regenMethod.GetCustomAttributes<RequirePermissionAttribute>().FirstOrDefault();
        var revokePerm = revokeMethod.GetCustomAttributes<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(regenPerm);
        Assert.NotNull(revokePerm);
        Assert.Equal("CHECK_IN_OUT", regenPerm!.FunctionCode);
        Assert.Equal(PermissionAction.Update, regenPerm.RequiredAction);
        Assert.Equal("CHECK_IN_OUT", revokePerm!.FunctionCode);
        Assert.Equal(PermissionAction.Update, revokePerm.RequiredAction);
    }

    [Fact]
    public async Task ReservationsController_SmartLockEndpoints_ForwardPropertyIdAndReasonToMediator()
    {
        var sender = new StubSender
        {
            ResponseToReturn = new ReservationDetailDto { Id = Guid.NewGuid() }
        };
        var controller = new ReservationsController(sender)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
            }
        };

        var resId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        controller.HttpContext.Request.Headers["X-Property-Id"] = propId.ToString();

        var regenRes = await controller.RegenerateSmartLockPin(resId, null, "Đổi mã định kỳ", CancellationToken.None);
        Assert.IsType<OkObjectResult>(regenRes);
        var regenCmd = Assert.IsType<RegenerateSmartLockPinCommand>(sender.LastSentRequest);
        Assert.Equal(resId, regenCmd.ReservationId);
        Assert.Equal(propId, regenCmd.PropertyId);
        Assert.Equal("Đổi mã định kỳ", regenCmd.Reason);

        var revokeRes = await controller.RevokeSmartLockPin(resId, propId, "Mất thẻ", CancellationToken.None);
        Assert.IsType<OkObjectResult>(revokeRes);
        var revokeCmd = Assert.IsType<RevokeSmartLockPinCommand>(sender.LastSentRequest);
        Assert.Equal(resId, revokeCmd.ReservationId);
        Assert.Equal(propId, revokeCmd.PropertyId);
        Assert.Equal("Mất thẻ", revokeCmd.Reason);
    }

    #endregion
}
