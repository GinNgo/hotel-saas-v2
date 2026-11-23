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
using HotelSaas.Application.Public.Queries.GetGuestBookingByToken;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reviews.Commands.ReplyGuestReview;
using HotelSaas.Application.Reviews.Commands.SubmitGuestReview;
using HotelSaas.Application.Reviews.Commands.ToggleReviewVisibility;
using HotelSaas.Application.Reviews.Queries.GetPmsPropertyReviews;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests.Reviews;

public sealed class GuestReviewTests
{
    private readonly SubmitGuestReviewCommandValidator _validator = new();
    private readonly ReplyGuestReviewCommandValidator _replyValidator = new();
    private readonly GetPmsPropertyReviewsQueryValidator _pmsQueryValidator = new();

    #region In-Memory Filter-Aware Test Harness

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubAuditLogService : IAuditLogService
    {
        public List<(string Action, string EntityName, Guid EntityId, Guid? PropertyId)> RecordedActions { get; } = new();

        public Task<AuditLog> RecordActionAsync(
            string action,
            string entityName,
            Guid entityId,
            object? oldValues = null,
            object? newValues = null,
            Guid? propertyId = null,
            CancellationToken cancellationToken = default)
        {
            RecordedActions.Add((action, entityName, entityId, propertyId));
            return Task.FromResult(new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                PropertyId = propertyId,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        public Task<AuditLog> RecordActionExplicitAsync(
            Guid tenantId,
            Guid? propertyId,
            Guid? userId,
            string action,
            string entityName,
            Guid entityId,
            object? oldValues = null,
            object? newValues = null,
            string? ipAddress = null,
            CancellationToken cancellationToken = default)
            => RecordActionAsync(action, entityName, entityId, oldValues, newValues, propertyId, cancellationToken);
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

    private sealed class FilterAwareEfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;

        private FilterAwareEfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new FilterAwareEfExpressionRewriter(effectiveRoot).Visit(expression);

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
                if (genDef == typeof(FilterAwareAsyncDbSet<>) || genDef == typeof(FilterAwareAsyncQueryable<>))
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

    private sealed class FilterAwareAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;

        public FilterAwareAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
        }

        private IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || FilterAwareEfExpressionRewriter.HasIgnoreQueryFilters(expression))
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
                typeof(FilterAwareAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new FilterAwareAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class FilterAwareAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public FilterAwareAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
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

    private sealed class FilterAwareAsyncDbSet<T> : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly List<T> _data;
        private readonly IQueryable<T> _rootQueryable;
        private readonly FilterAwareAsyncQueryProvider<T> _provider;

        public FilterAwareAsyncDbSet(List<T> data, ICurrentTenantService tenantService)
        {
            _data = data;
            _rootQueryable = _data.AsQueryable();
            _provider = new FilterAwareAsyncQueryProvider<T>(_data, tenantService);
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

    private sealed class FakeReviewDbContext : IApplicationDbContext
    {
        private readonly bool _throwNotImplementedOnGuestReviews;
        private readonly DbSet<GuestReview> _guestReviewsSet;

        public List<User> UserList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<RoomType> RoomTypeList { get; } = new();
        public List<Room> RoomList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<Payment> PaymentList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();

        public FakeReviewDbContext(ICurrentTenantService tenantService, bool throwNotImplementedOnGuestReviews = false)
        {
            _throwNotImplementedOnGuestReviews = throwNotImplementedOnGuestReviews;
            Users = new FilterAwareAsyncDbSet<User>(UserList, tenantService);
            Properties = new FilterAwareAsyncDbSet<Property>(PropertyList, tenantService);
            RoomTypes = new FilterAwareAsyncDbSet<RoomType>(RoomTypeList, tenantService);
            Rooms = new FilterAwareAsyncDbSet<Room>(RoomList, tenantService);
            Reservations = new FilterAwareAsyncDbSet<Reservation>(ReservationList, tenantService);
            Payments = new FilterAwareAsyncDbSet<Payment>(PaymentList, tenantService);
            _guestReviewsSet = new FilterAwareAsyncDbSet<GuestReview>(GuestReviewList, tenantService);
        }

        public DbSet<User> Users { get; }
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
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
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews =>
            _throwNotImplementedOnGuestReviews ? throw new NotImplementedException() : _guestReviewsSet;
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

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

    private static (
        FakeReviewDbContext Db,
        Guid TenantA,
        Guid TenantB,
        Property PropA1,
        Property PropA2,
        Property PropAInactive,
        Property PropB1,
        GuestReview RevA1,
        GuestReview RevA2,
        GuestReview RevA3Hidden,
        GuestReview RevAInactive,
        GuestReview RevB1
    ) SeedMultiTenantReviews()
    {
        var tenantSvc = new StubTenantService();
        var db = new FakeReviewDbContext(tenantSvc);

        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var propA1 = new Property { Id = Guid.NewGuid(), TenantId = tenantA, Name = "LuxeStay Saigon", Code = "SGN1", Status = PropertyStatus.Active };
        var propA2 = new Property { Id = Guid.NewGuid(), TenantId = tenantA, Name = "LuxeStay Da Lat", Code = "DLI1", Status = PropertyStatus.Active };
        var propAInactive = new Property { Id = Guid.NewGuid(), TenantId = tenantA, Name = "LuxeStay Closed", Code = "CLS1", Status = PropertyStatus.Inactive };
        var propB1 = new Property { Id = Guid.NewGuid(), TenantId = tenantB, Name = "Other Chain Hotel", Code = "OTH1", Status = PropertyStatus.Active };
        db.PropertyList.AddRange(new[] { propA1, propA2, propAInactive, propB1 });

        var rtA1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = propA1.Id, Name = "Deluxe King", Code = "DLX" };
        var rtA2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = propA2.Id, Name = "Pine Suite", Code = "PN" };
        var rmA1 = new Room { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = propA1.Id, RoomTypeId = rtA1.Id, RoomType = rtA1, RoomNumber = "101" };
        var rmA2 = new Room { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = propA2.Id, RoomTypeId = rtA2.Id, RoomType = rtA2, RoomNumber = "202" };
        db.RoomTypeList.AddRange(new[] { rtA1, rtA2 });
        db.RoomList.AddRange(new[] { rmA1, rmA2 });

        var guestUser = new User { Id = Guid.NewGuid(), FullName = "Nguyen Van Khach", Email = "khach@example.com" };
        db.UserList.Add(guestUser);

        Reservation BuildRes(Guid tId, Property prop, Room? room, string code, string guestName, RentalType rentalType)
        {
            return new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tId,
                PropertyId = prop.Id,
                Property = prop,
                RoomId = room?.Id ?? Guid.NewGuid(),
                Room = room,
                GuestUserId = guestUser.Id,
                GuestName = guestName,
                GuestEmail = "khach@example.com",
                GuestPhone = "0901234567",
                ConfirmationCode = code,
                CheckInDate = new DateOnly(2026, 11, 10),
                CheckOutDate = new DateOnly(2026, 11, 12),
                Status = ReservationStatus.CheckedOut,
                Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                {
                    RentalType = rentalType,
                    RoomTypeName = room?.RoomType?.Name ?? "Standard",
                    LookupToken = $"tok-{code.ToLowerInvariant()}",
                    TokenExpiresAtUtc = DateTime.UtcNow.AddDays(14)
                })
            };
        }

        var resA1 = BuildRes(tenantA, propA1, rmA1, "RES-A101", "Tran Minh Anh", RentalType.Daily);
        var resA2 = BuildRes(tenantA, propA2, rmA2, "RES-A202", "Le Hoang Nam", RentalType.Overnight);
        var resA3 = BuildRes(tenantA, propA1, rmA1, "RES-A103", "Pham Thu Ha", RentalType.Hourly);
        var resAInactive = BuildRes(tenantA, propAInactive, null, "RES-AINA", "Old Guest", RentalType.Daily);
        var resB1 = BuildRes(tenantB, propB1, null, "RES-B101", "Competitor Guest", RentalType.Daily);
        db.ReservationList.AddRange(new[] { resA1, resA2, resA3, resAInactive, resB1 });

        var now = DateTime.UtcNow;
        var revA1 = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            ReservationId = resA1.Id,
            Reservation = resA1,
            UserId = guestUser.Id,
            User = guestUser,
            OverallRating = 5,
            CleanlinessRating = 5,
            LocationRating = 5,
            ServiceRating = 5,
            ValueRating = 4,
            Comment = "Phòng rất sạch, view đẹp!",
            OwnerReply = "Cảm ơn anh Anh đã tin tưởng lựa chọn LuxeStay.",
            RepliedAtUtc = now.AddHours(-2),
            IsPublished = true,
            CreatedAtUtc = now.AddDays(-1),
            UpdatedAtUtc = now.AddHours(-2)
        };

        var revA2 = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            ReservationId = resA2.Id,
            Reservation = resA2,
            UserId = guestUser.Id,
            User = guestUser,
            OverallRating = 3,
            CleanlinessRating = 3,
            LocationRating = 4,
            ServiceRating = 3,
            ValueRating = 3,
            Comment = "Vị trí tốt nhưng wifi hơi chậm.",
            OwnerReply = null,
            IsPublished = true,
            CreatedAtUtc = now.AddHours(-6),
            UpdatedAtUtc = now.AddHours(-6)
        };

        var revA3Hidden = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            ReservationId = resA3.Id,
            Reservation = resA3,
            UserId = guestUser.Id,
            User = guestUser,
            OverallRating = 1,
            Comment = "Spam comment",
            OwnerReply = null,
            IsPublished = false,
            CreatedAtUtc = now.AddHours(-3),
            UpdatedAtUtc = now.AddHours(-3)
        };

        var revAInactive = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            ReservationId = resAInactive.Id,
            Reservation = resAInactive,
            UserId = guestUser.Id,
            User = guestUser,
            OverallRating = 4,
            Comment = "Inactive branch review",
            IsPublished = true,
            CreatedAtUtc = now.AddDays(-5),
            UpdatedAtUtc = now.AddDays(-5)
        };

        var revB1 = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = tenantB,
            ReservationId = resB1.Id,
            Reservation = resB1,
            UserId = guestUser.Id,
            User = guestUser,
            OverallRating = 5,
            Comment = "Other tenant secret review",
            IsPublished = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.GuestReviewList.AddRange(new[] { revA1, revA2, revA3Hidden, revAInactive, revB1 });

        return (db, tenantA, tenantB, propA1, propA2, propAInactive, propB1, revA1, revA2, revA3Hidden, revAInactive, revB1);
    }

    #endregion

    #region SubmitGuestReviewCommandValidator Tests

    [Fact]
    public void Validator_RejectsEmptyLookupToken()
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "",
            Rating: 5,
            Comment: "Dịch vụ tuyệt vời");

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.LookupToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(6)]
    [InlineData(10)]
    public void Validator_RejectsOverallRatingOutside1To5(int invalidRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-123",
            Rating: invalidRating,
            Comment: "Nhận xét");

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Rating);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public void Validator_AcceptsValidRatings(int validRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: validRating,
            CleanlinessRating: validRating,
            LocationRating: validRating,
            ServiceRating: validRating,
            ValueRating: validRating,
            Comment: "Phòng sạch sẽ, vị trí trung tâm thuận tiện.");

        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_RejectsExcessiveCommentLength()
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: 5,
            Comment: new string('a', 1501));

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Comment);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Validator_RejectsSubRatingsOutside1To5(int invalidSubRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: 5,
            CleanlinessRating: invalidSubRating);

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.CleanlinessRating);
    }

    #endregion

    #region B2B GetPmsPropertyReviewsQuery Tests

    [Fact]
    public async Task GetPmsPropertyReviews_TenantWideOwner_ReturnsActiveBranchReviews_WithSummaryAndFilters()
    {
        var (db, tenantA, _, propA1, propA2, _, _, revA1, revA2, revA3Hidden, _, _) = SeedMultiTenantReviews();
        var tenantSvc = new StubTenantService { TenantId = tenantA };
        var propSvc = new StubPropertyService { IsTenantWide = true, PropertyId = null };
        var handler = new GetPmsPropertyReviewsQueryHandler(db, tenantSvc, propSvc);

        // 1. All active branches of Tenant A (3 reviews: revA1, revA2, revA3Hidden; excludes inactive branch & Tenant B)
        var allResult = await handler.Handle(new GetPmsPropertyReviewsQuery(), CancellationToken.None);

        Assert.Equal(3, allResult.TotalCount);
        Assert.Equal(3, allResult.Summary.TotalCount);
        Assert.Equal(3.0, allResult.Summary.AverageRating); // (5 + 3 + 1) / 3 = 3.0
        Assert.Equal(2, allResult.Summary.PublishedCount);
        Assert.Equal(1, allResult.Summary.HiddenCount);
        Assert.Equal(1, allResult.Summary.RepliedCount);
        Assert.Equal(2, allResult.Summary.UnansweredCount);
        Assert.Equal(1, allResult.Summary.RatingDistribution[5]);
        Assert.Equal(1, allResult.Summary.RatingDistribution[3]);
        Assert.Equal(1, allResult.Summary.RatingDistribution[1]);
        Assert.DoesNotContain(allResult.Items, x => x.ConfirmationCode == "RES-B101");
        Assert.DoesNotContain(allResult.Items, x => x.ConfirmationCode == "RES-AINA");

        // Unmasked PMS guest names & room info
        var a1Item = Assert.Single(allResult.Items, x => x.Id == revA1.Id);
        Assert.Equal("Tran Minh Anh", a1Item.GuestName);
        Assert.Equal("101", a1Item.RoomNumber);
        Assert.Equal("Deluxe King", a1Item.RoomTypeName);

        // 2. Filter by PropertyId = propA2, Rating = 3, HasReply = false
        var prop2Result = await handler.Handle(
            new GetPmsPropertyReviewsQuery(PropertyId: propA2.Id, Rating: 3, HasReply: false),
            CancellationToken.None);

        var filtered = Assert.Single(prop2Result.Items);
        Assert.Equal(revA2.Id, filtered.Id);
        Assert.Equal("Le Hoang Nam", filtered.GuestName);
        Assert.Equal(1, prop2Result.Summary.TotalCount); // Summary scoped to propA2 baseline

        // 3. Search by confirmation code & visibility filter
        var hiddenSearch = await handler.Handle(
            new GetPmsPropertyReviewsQuery(IsPublished: false, Search: "RES-A103"),
            CancellationToken.None);
        var hiddenItem = Assert.Single(hiddenSearch.Items);
        Assert.Equal(revA3Hidden.Id, hiddenItem.Id);
        Assert.False(hiddenItem.IsPublished);
        Assert.Equal(3, hiddenSearch.Summary.TotalCount); // Summary reflects tenant baseline even when list filtered
    }

    [Fact]
    public async Task GetPmsPropertyReviews_BranchScopedStaff_EnforcesAssignedBranch_AndRejectsCrossBranch()
    {
        var (db, tenantA, _, propA1, propA2, _, propB1, _, _, _, _, _) = SeedMultiTenantReviews();
        var tenantSvc = new StubTenantService { TenantId = tenantA };
        var propSvc = new StubPropertyService
        {
            IsTenantWide = false,
            PropertyId = propA1.Id,
            TokenPropertyId = propA1.Id
        };
        var handler = new GetPmsPropertyReviewsQueryHandler(db, tenantSvc, propSvc);

        // Allowed on own branch (propA1 has revA1 and revA3Hidden)
        var ownResult = await handler.Handle(new GetPmsPropertyReviewsQuery(), CancellationToken.None);
        Assert.Equal(2, ownResult.TotalCount);
        Assert.All(ownResult.Items, item => Assert.Equal(propA1.Id, item.PropertyId));

        // Cross-branch request rejected
        var crossBranchEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new GetPmsPropertyReviewsQuery(PropertyId: propA2.Id), CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", crossBranchEx.ErrorCode);

        // Cross-tenant property request rejected even for TenantWide owner
        var tenantWidePropSvc = new StubPropertyService { IsTenantWide = true };
        var tenantWideHandler = new GetPmsPropertyReviewsQueryHandler(db, tenantSvc, tenantWidePropSvc);
        var crossTenantEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            tenantWideHandler.Handle(new GetPmsPropertyReviewsQuery(PropertyId: propB1.Id), CancellationToken.None));
        Assert.Equal("ERR_CROSS_TENANT_ACCESS", crossTenantEx.ErrorCode);
    }

    [Fact]
    public void PmsQueryValidator_RejectsInvalidRatingAndPaging()
    {
        _pmsQueryValidator.TestValidate(new GetPmsPropertyReviewsQuery(Rating: 6))
            .ShouldHaveValidationErrorFor(x => x.Rating);
        _pmsQueryValidator.TestValidate(new GetPmsPropertyReviewsQuery(Page: 0))
            .ShouldHaveValidationErrorFor(x => x.Page);
        _pmsQueryValidator.TestValidate(new GetPmsPropertyReviewsQuery(PageSize: 101))
            .ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    #endregion

    #region ReplyGuestReview & ToggleReviewVisibility Tests

    [Fact]
    public void ReplyValidator_RejectsEmptyWhitespaceAndOver2000Chars()
    {
        _replyValidator.TestValidate(new ReplyGuestReviewCommand(Guid.NewGuid(), ""))
            .ShouldHaveValidationErrorFor(x => x.Reply);
        _replyValidator.TestValidate(new ReplyGuestReviewCommand(Guid.NewGuid(), "   "))
            .ShouldHaveValidationErrorFor(x => x.Reply);
        _replyValidator.TestValidate(new ReplyGuestReviewCommand(Guid.NewGuid(), new string('x', 2001)))
            .ShouldHaveValidationErrorFor(x => x.Reply);
        _replyValidator.TestValidate(new ReplyGuestReviewCommand(Guid.NewGuid(), "Cảm ơn Quý khách!"))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task ReplyGuestReview_UpdatesReplyAndAudit_AndRejectsCrossBranchOrCrossTenant()
    {
        var (db, tenantA, _, propA1, propA2, _, _, _, revA2, revA3Hidden, _, revB1) = SeedMultiTenantReviews();
        var tenantSvc = new StubTenantService { TenantId = tenantA };
        var auditSvc = new StubAuditLogService();

        // 1. Branch-scoped staff at propA1 cannot reply to revA2 (belongs to propA2)
        var branch1PropSvc = new StubPropertyService { IsTenantWide = false, PropertyId = propA1.Id };
        var branch1Handler = new ReplyGuestReviewCommandHandler(db, tenantSvc, branch1PropSvc, auditSvc);

        var branchEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            branch1Handler.Handle(new ReplyGuestReviewCommand(revA2.Id, "Cố tình reply chi nhánh khác"), CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", branchEx.ErrorCode);

        // 2. Cross-tenant review rejected even for TenantWide owner
        var ownerPropSvc = new StubPropertyService { IsTenantWide = true };
        var ownerHandler = new ReplyGuestReviewCommandHandler(db, tenantSvc, ownerPropSvc, auditSvc);

        var tenantEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
            ownerHandler.Handle(new ReplyGuestReviewCommand(revB1.Id, "Cross tenant"), CancellationToken.None));
        Assert.Equal("ERR_CROSS_TENANT_ACCESS", tenantEx.ErrorCode);

        // 3. Valid reply on revA3Hidden (propA1) by branch1 staff trims text, sets timestamps, and records audit
        var result = await branch1Handler.Handle(
            new ReplyGuestReviewCommand(revA3Hidden.Id, "   Xin lỗi Quý khách về trải nghiệm chưa tốt.   "),
            CancellationToken.None);

        Assert.Equal("Xin lỗi Quý khách về trải nghiệm chưa tốt.", result.OwnerReply);
        Assert.NotNull(result.RepliedAtUtc);
        Assert.Equal(revA3Hidden.OwnerReply, result.OwnerReply);
        var audit = Assert.Single(auditSvc.RecordedActions);
        Assert.Equal("GuestReview", audit.EntityName);
        Assert.Equal(propA1.Id, audit.PropertyId);
        Assert.Equal(propA2.Id, revA2.Reservation!.PropertyId);
    }

    [Fact]
    public async Task ToggleReviewVisibility_TogglesIsPublished_AndEnforcesTenantAndBranchIsolation()
    {
        var (db, tenantA, _, propA1, _, _, _, revA1, revA2, _, _, revB1) = SeedMultiTenantReviews();
        var tenantSvc = new StubTenantService { TenantId = tenantA };
        var auditSvc = new StubAuditLogService();

        // 1. Branch-scoped staff at propA1 cannot toggle revA2 (propA2)
        var branch1PropSvc = new StubPropertyService { IsTenantWide = false, PropertyId = propA1.Id };
        var branch1Handler = new ToggleReviewVisibilityCommandHandler(db, tenantSvc, branch1PropSvc, auditSvc);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            branch1Handler.Handle(new ToggleReviewVisibilityCommand(revA2.Id, false), CancellationToken.None));

        // 2. Cross-tenant rejected
        var ownerPropSvc = new StubPropertyService { IsTenantWide = true };
        var ownerHandler = new ToggleReviewVisibilityCommandHandler(db, tenantSvc, ownerPropSvc, auditSvc);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            ownerHandler.Handle(new ToggleReviewVisibilityCommand(revB1.Id, false), CancellationToken.None));

        // 3. Valid hide and re-publish on revA1
        var hiddenResult = await branch1Handler.Handle(
            new ToggleReviewVisibilityCommand(revA1.Id, false),
            CancellationToken.None);
        Assert.False(hiddenResult.IsPublished);
        Assert.False(revA1.IsPublished);

        var publishedResult = await branch1Handler.Handle(
            new ToggleReviewVisibilityCommand(revA1.Id, true),
            CancellationToken.None);
        Assert.True(publishedResult.IsPublished);
        Assert.True(revA1.IsPublished);
        Assert.Equal(2, auditSvc.RecordedActions.Count);
    }

    #endregion

    #region B2C GetGuestBookingByToken State Sync Tests

    [Fact]
    public async Task GetGuestBookingByToken_ReturnsHasReviewedAndExistingReview_WhenReviewExists()
    {
        var (db, _, _, _, _, _, _, revA1, revA2, _, _, _) = SeedMultiTenantReviews();
        var handler = new GetGuestBookingByTokenQueryHandler(db);

        // 1. Reservation with review & owner reply
        var detailWithReview = await handler.Handle(new GetGuestBookingByTokenQuery("tok-res-a101"), CancellationToken.None);
        Assert.True(detailWithReview.HasReviewed);
        Assert.NotNull(detailWithReview.ExistingReview);
        Assert.Equal(revA1.Id, detailWithReview.ExistingReview!.Id);
        Assert.Equal(5, detailWithReview.ExistingReview.Rating);
        Assert.Equal(5, detailWithReview.ExistingReview.CleanlinessRating);
        Assert.Equal(4, detailWithReview.ExistingReview.ValueRating);
        Assert.Equal("Phòng rất sạch, view đẹp!", detailWithReview.ExistingReview.Comment);
        Assert.Equal("Cảm ơn anh Anh đã tin tưởng lựa chọn LuxeStay.", detailWithReview.ExistingReview.OwnerReply);
        Assert.NotNull(detailWithReview.ExistingReview.RepliedAtUtc);

        // 2. Reservation without review -> HasReviewed = false
        var unreviewedRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = revA2.TenantId,
            PropertyId = revA2.Reservation!.PropertyId,
            GuestName = "Khach Chua Review",
            GuestEmail = "new@example.com",
            ConfirmationCode = "RES-NOREV",
            CheckInDate = new DateOnly(2026, 11, 14),
            CheckOutDate = new DateOnly(2026, 11, 15),
            TotalAmount = 500_000m,
            Status = ReservationStatus.CheckedOut,
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                RoomTypeName = "Standard",
                LookupToken = "tok-res-norev",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7)
            })
        };
        db.ReservationList.Add(unreviewedRes);

        var detailWithoutReview = await handler.Handle(new GetGuestBookingByTokenQuery("tok-res-norev"), CancellationToken.None);
        Assert.False(detailWithoutReview.HasReviewed);
        Assert.Null(detailWithoutReview.ExistingReview);
    }

    [Fact]
    public async Task GetGuestBookingByToken_GracefullyFallsBack_WhenGuestReviewsDbSetNotImplemented()
    {
        var tenantSvc = new StubTenantService();
        var db = new FakeReviewDbContext(tenantSvc, throwNotImplementedOnGuestReviews: true);
        var prop = new Property { Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), Name = "Stub Hotel", Address = "123 Le Loi" };
        db.PropertyList.Add(prop);
        db.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = prop.TenantId,
            PropertyId = prop.Id,
            GuestName = "Nguyen Van Test",
            GuestEmail = "test@example.com",
            ConfirmationCode = "RES-STUB1",
            CheckInDate = new DateOnly(2026, 11, 15),
            CheckOutDate = new DateOnly(2026, 11, 16),
            TotalAmount = 600_000m,
            Status = ReservationStatus.CheckedIn,
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                RoomTypeName = "Deluxe",
                LookupToken = "tok-stub-1",
                TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7)
            })
        });

        var handler = new GetGuestBookingByTokenQueryHandler(db);
        var detail = await handler.Handle(new GetGuestBookingByTokenQuery("tok-stub-1"), CancellationToken.None);

        Assert.False(detail.HasReviewed);
        Assert.Null(detail.ExistingReview);
    }

    #endregion
}
