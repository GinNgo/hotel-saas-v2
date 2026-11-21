using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.Queries.GetPrintableInvoice;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;

namespace HotelSaas.Application.Tests.Print;

/// <summary>
/// Isolated in-memory unit tests for <see cref="GetPrintableInvoiceQueryHandler"/> covering:
/// 1. Accounting math reconciliation: SubTotal + VatAmount + ServiceFeeAmount - DiscountAmount == TotalAmount.
/// 2. Anonymous PII security hardening: cryptographic LookupToken required, raw 6-char ConfirmationCode stays masked,
///    and expired/revoked/missing-expiry tokens are rejected cleanly while authenticated JWT access keeps working.
/// 3. SePay-compatible VietQR URL generation via IVietQrService (clean DATPHONG RESABC123 memo &amp; UseSepayQrImage flag).
/// </summary>
public sealed class GetPrintableInvoiceTests
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

        public InMemoryAsyncQueryProvider(List<TEntity> backingData)
        {
            _backingData = backingData;
        }

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

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; }
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; }
        public StaffRole? StaffRole { get; set; }
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; }
        public bool IsAuthenticated { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
            IsAuthenticated = userId != Guid.Empty;
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
    public async Task WithIssuedInvoice_PopulatesServiceFeeAndDiscount_AndReconcilesGrandTotal()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservationId = Guid.NewGuid();

        var db = new FakeDbContext();
        db.ReservationList.Add(new Reservation
        {
            Id = reservationId,
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-INV100",
            GuestName = "Tran Van An",
            GuestEmail = "an@example.com",
            GuestPhone = "0901234567",
            CheckInDate = new DateOnly(2026, 8, 10),
            CheckOutDate = new DateOnly(2026, 8, 12),
            NumberOfGuests = 2,
            TotalAmount = 1_130_000m,
            PointsDiscountAmount = 100_000m,
            Property = new Property
            {
                Id = propertyId,
                TenantId = tenantId,
                Name = "Saigon Boutique",
                TaxRatePercent = 8m,
                ServiceFeeRatePercent = 5m
            },
            Payments = new List<Payment>()
        });

        db.InvoiceList.Add(new Invoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ReservationId = reservationId,
            InvoiceNumber = "INV-20260812-RES-INV100",
            IssuedAtUtc = DateTime.UtcNow,
            TaxRate = 0.08m,
            TaxAmount = 80_000m,
            ServiceFeeRate = 0.05m,
            ServiceFeeAmount = 50_000m,
            DiscountAmount = 100_000m,
            PointsDiscountAmount = 100_000m,
            Subtotal = 1_100_000m,
            GrandTotal = 1_130_000m,
            Status = InvoiceStatus.Issued,
            InvoiceItems = new List<InvoiceItem>
            {
                new() { Id = Guid.NewGuid(), Description = "Tiền phòng Deluxe", Quantity = 2, UnitPrice = 615_000m, Amount = 1_230_000m }
            }
        });

        var staffCtx = new StubUserContext();
        staffCtx.SetUser(Guid.NewGuid(), "reception@hotel.vn", GlobalUserRole.TenantStaff);
        staffCtx.SetMembershipContext(tenantId, TenantStatus.Active, propertyId, PropertyStatus.Active, StaffRole.Receptionist, null, false);

        var handler = new GetPrintableInvoiceQueryHandler(db, staffCtx, new VietQrService());
        var dto = await handler.Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);

        Assert.Equal(1_100_000m, dto.SubTotal);
        Assert.Equal(8m, dto.VatRate);
        Assert.Equal(80_000m, dto.VatAmount);
        Assert.Equal(50_000m, dto.ServiceFeeAmount);
        Assert.Equal(100_000m, dto.DiscountAmount);
        Assert.Equal(1_130_000m, dto.TotalAmount);
        Assert.Equal(dto.TotalAmount, dto.SubTotal + dto.VatAmount + dto.ServiceFeeAmount - dto.DiscountAmount);
    }

    [Fact]
    public async Task WithoutIssuedInvoice_CalculatesPropertyServiceFeeAndDiscounts_MatchingCheckoutFormula()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservationId = Guid.NewGuid();

        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeName = "Suite",
            PromoCode = "SUMMER40",
            PromoDiscountAmount = 40_000m,
            LookupToken = "tok-precheckout-01",
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(15)
        };

        var db = new FakeDbContext();
        db.ReservationList.Add(new Reservation
        {
            Id = reservationId,
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-PRE001",
            GuestName = "Le Thi Mai",
            GuestEmail = "mai@example.com",
            GuestPhone = "0988776655",
            CheckInDate = new DateOnly(2026, 8, 15),
            CheckOutDate = new DateOnly(2026, 8, 16),
            NumberOfGuests = 2,
            TotalAmount = 1_130_000m,
            PointsDiscountAmount = 60_000m,
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            Property = new Property
            {
                Id = propertyId,
                TenantId = tenantId,
                Name = "Da Nang Resort",
                TaxRatePercent = 8m,
                ServiceFeeRatePercent = 5m
            },
            Payments = new List<Payment>()
        });

        var staffCtx = new StubUserContext();
        staffCtx.SetUser(Guid.NewGuid(), "cashier@hotel.vn", GlobalUserRole.TenantStaff);
        staffCtx.SetMembershipContext(tenantId, TenantStatus.Active, propertyId, PropertyStatus.Active, StaffRole.Manager, null, false);

        var handler = new GetPrintableInvoiceQueryHandler(db, staffCtx, new VietQrService());
        var dto = await handler.Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);

        Assert.Equal(80_000m, dto.VatAmount);
        Assert.Equal(50_000m, dto.ServiceFeeAmount);
        Assert.Equal(100_000m, dto.DiscountAmount); // 60k loyalty points + 40k promo
        Assert.Equal(1_100_000m, dto.SubTotal);
        Assert.Equal(1_130_000m, dto.TotalAmount);
        Assert.Equal(dto.TotalAmount, dto.SubTotal + dto.VatAmount + dto.ServiceFeeAmount - dto.DiscountAmount);
    }

    [Fact]
    public async Task AnonymousAccess_EnforcesCryptographicLookupTokenAndExpiry_WhileAuthenticatedAccessRemainsUnblocked()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var guestUserId = Guid.NewGuid();
        var reservationId = Guid.NewGuid();
        const string lookupToken = "tok-crypto-9a8b7c6d5e4f";

        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeName = "Deluxe",
            LookupToken = lookupToken,
            TokenExpiresAtUtc = DateTime.UtcNow.AddHours(12),
            IsTokenRevoked = false
        };

        var reservation = new Reservation
        {
            Id = reservationId,
            TenantId = tenantId,
            PropertyId = propertyId,
            GuestUserId = guestUserId,
            ConfirmationCode = "RES-ABC123",
            GuestName = "Pham Hoang Nam",
            GuestEmail = "nam.secret@example.com",
            GuestPhone = "0912345678",
            CheckInDate = new DateOnly(2026, 9, 1),
            CheckOutDate = new DateOnly(2026, 9, 2),
            NumberOfGuests = 2,
            TotalAmount = 1_000_000m,
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            Room = new Room { Id = Guid.NewGuid(), RoomNumber = "402" },
            Payments = new List<Payment>()
        };

        var db = new FakeDbContext();
        db.ReservationList.Add(reservation);
        db.PrintTemplateList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Khách Sạn Biển Xanh",
            BankName = "MBBank",
            BankAccountNumber = "999988887777",
            BankAccountHolder = "CTY BIEN XANH",
            ShowVietQrCode = true
        });

        var anonHandler = new GetPrintableInvoiceQueryHandler(db, new StubUserContext(), new VietQrService());

        // 1. Raw confirmation code MUST stay masked anonymously
        var rawCodeDto = await anonHandler.Handle(new GetPrintableInvoiceQuery(reservationId, "RES-ABC123"), CancellationToken.None);
        Assert.Equal("P*** H*** N***", rawCodeDto.GuestName);
        Assert.Equal("n***@example.com", rawCodeDto.GuestEmail);
        Assert.Equal("091****678", rawCodeDto.GuestPhone);
        Assert.Equal("***", rawCodeDto.RoomNumber);
        Assert.False(rawCodeDto.ShowVietQrCode);
        Assert.Equal(string.Empty, rawCodeDto.VietQrImageUrl);
        Assert.NotEqual("999988887777", rawCodeDto.BankAccountNumber);

        // 2. Valid non-expired LookupToken unlocks PII and VietQR
        var validTokenDto = await anonHandler.Handle(new GetPrintableInvoiceQuery(reservationId, lookupToken), CancellationToken.None);
        Assert.Equal("Pham Hoang Nam", validTokenDto.GuestName);
        Assert.Equal("nam.secret@example.com", validTokenDto.GuestEmail);
        Assert.Equal("0912345678", validTokenDto.GuestPhone);
        Assert.Equal("402", validTokenDto.RoomNumber);
        Assert.True(validTokenDto.ShowVietQrCode);
        Assert.Equal("999988887777", validTokenDto.BankAccountNumber);

        // 3. Expired LookupToken is rejected cleanly
        snapshot.TokenExpiresAtUtc = DateTime.UtcNow.AddSeconds(-5);
        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            anonHandler.Handle(new GetPrintableInvoiceQuery(reservationId, lookupToken), CancellationToken.None));

        // 4. Null TokenExpiresAtUtc is rejected fail-closed
        snapshot.TokenExpiresAtUtc = null;
        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            anonHandler.Handle(new GetPrintableInvoiceQuery(reservationId, lookupToken), CancellationToken.None));

        // 5. Revoked token is rejected cleanly even with future expiry
        snapshot.TokenExpiresAtUtc = DateTime.UtcNow.AddDays(5);
        snapshot.IsTokenRevoked = true;
        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            anonHandler.Handle(new GetPrintableInvoiceQuery(reservationId, lookupToken), CancellationToken.None));

        // 6. Authenticated staff, guest owner, and SuperAdmin STILL succeed even when token is expired/revoked
        snapshot.TokenExpiresAtUtc = DateTime.UtcNow.AddDays(-10);
        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);

        var guestCtx = new StubUserContext();
        guestCtx.SetUser(guestUserId, "nam.secret@example.com", GlobalUserRole.Customer);
        var guestDto = await new GetPrintableInvoiceQueryHandler(db, guestCtx, new VietQrService())
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);
        Assert.Equal("Pham Hoang Nam", guestDto.GuestName);
        Assert.True(guestDto.ShowVietQrCode);

        var staffCtx = new StubUserContext();
        staffCtx.SetUser(Guid.NewGuid(), "staff@hotel.vn", GlobalUserRole.TenantStaff);
        staffCtx.SetMembershipContext(tenantId, TenantStatus.Active, propertyId, PropertyStatus.Active, StaffRole.Receptionist, null, false);
        var staffDto = await new GetPrintableInvoiceQueryHandler(db, staffCtx, new VietQrService())
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);
        Assert.Equal("Pham Hoang Nam", staffDto.GuestName);

        var superAdminCtx = new StubUserContext();
        superAdminCtx.SetUser(Guid.NewGuid(), "superadmin@hotelsaas.platform", GlobalUserRole.SuperAdmin);
        var adminDto = await new GetPrintableInvoiceQueryHandler(db, superAdminCtx, new VietQrService())
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);
        Assert.Equal("Pham Hoang Nam", adminDto.GuestName);
    }

    [Fact]
    public async Task VietQrGeneration_UsesVietQrService_CleanSepayMemo_AndRespectsUseSepayQrImage()
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservationId = Guid.NewGuid();

        var db = new FakeDbContext();
        db.ReservationList.Add(new Reservation
        {
            Id = reservationId,
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-ABC123",
            GuestName = "Nguyen Van QR",
            GuestEmail = "qr@example.com",
            CheckInDate = new DateOnly(2026, 9, 10),
            CheckOutDate = new DateOnly(2026, 9, 12),
            TotalAmount = 1_500_000m,
            Payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    ReservationId = reservationId,
                    Amount = 500_000m,
                    Status = PaymentStatus.Completed,
                    Method = PaymentMethod.BankTransfer
                }
            }
        });
        db.PrintTemplateList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Khách Sạn Sài Gòn",
            BankName = "MBBank",
            BankAccountNumber = "999988887777",
            BankAccountHolder = "CTY KHACH SAN SAI GON",
            ShowVietQrCode = true
        });

        var staffCtx = new StubUserContext();
        staffCtx.SetUser(Guid.NewGuid(), "staff@hotel.vn", GlobalUserRole.TenantStaff);
        staffCtx.SetMembershipContext(tenantId, TenantStatus.Active, propertyId, PropertyStatus.Active, StaffRole.Owner, null, true);

        // 1. Default VietQR image (UseSepayQrImage = false)
        var defaultConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Payment:Sepay:UseSepayQrImage"] = "false" })
            .Build();
        var defaultDto = await new GetPrintableInvoiceQueryHandler(db, staffCtx, new VietQrService(defaultConfig))
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);

        Assert.True(defaultDto.ShowVietQrCode);
        Assert.StartsWith("https://img.vietqr.io/image/970422-999988887777-compact2.png?", defaultDto.VietQrImageUrl);
        Assert.Contains("amount=1000000", defaultDto.VietQrImageUrl);
        Assert.Contains("addInfo=DATPHONG+RESABC123", defaultDto.VietQrImageUrl);
        Assert.DoesNotContain("RES-ABC123", defaultDto.VietQrImageUrl);
        Assert.DoesNotContain("THANHTOAN", defaultDto.VietQrImageUrl);

        // 2. SePay QR image mode (UseSepayQrImage = true)
        var sepayConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Payment:Sepay:UseSepayQrImage"] = "true" })
            .Build();
        var sepayDto = await new GetPrintableInvoiceQueryHandler(db, staffCtx, new VietQrService(sepayConfig))
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);

        Assert.True(sepayDto.ShowVietQrCode);
        Assert.StartsWith("https://qr.sepay.vn/img?", sepayDto.VietQrImageUrl);
        Assert.Contains("acc=999988887777", sepayDto.VietQrImageUrl);
        Assert.Contains("bank=MBBank", sepayDto.VietQrImageUrl);
        Assert.Contains("amount=1000000", sepayDto.VietQrImageUrl);
        Assert.Contains("des=DATPHONG+RESABC123", sepayDto.VietQrImageUrl);

        // 3. Backward-compatible null IVietQrService constructor fallback also produces clean DATPHONG RESABC123
        var fallbackDto = await new GetPrintableInvoiceQueryHandler(db, staffCtx)
            .Handle(new GetPrintableInvoiceQuery(reservationId), CancellationToken.None);

        Assert.StartsWith("https://img.vietqr.io/image/970422-999988887777-compact2.png?", fallbackDto.VietQrImageUrl);
        Assert.Contains("addInfo=DATPHONG+RESABC123", fallbackDto.VietQrImageUrl);
        Assert.DoesNotContain("THANHTOAN", fallbackDto.VietQrImageUrl);
    }
}
