using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.CreatePayment;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Payments.Queries.GetPayments;
using HotelSaas.Application.Payments.Queries.GetPaymentSummary;
using HotelSaas.Application.Reservations.Commands.CancelReservation;
using HotelSaas.Application.Reservations.Commands.CheckOutReservation;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Integration and concurrency tests for Phase P4-CASH-FOLIO-01:
/// 1. Manual Cash & BankTransfer recording for reservations.
/// 2. Automatic reservation status transition from PendingPayment to Confirmed.
/// 3. Advisory lock & transaction ref idempotency replay protection.
/// 4. Financial folio balance calculation (TotalAmount, PaidAmount, RemainingBalance, IsFullyPaid).
/// 5. Overpayment (ERR_AMOUNT_EXCEEDS_BALANCE) and already-paid (ERR_FOLIO_ALREADY_PAID) guards.
/// 6. Cancelled reservation guard (ERR_RESERVATION_CANCELLED).
/// 7. Concurrent payment competition serialization via LockReservationRowAsync (FOR UPDATE).
/// 8. Payment list and daily cashier summary query aggregation.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P4_CashFolioTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        var isAllowed = dbName.EndsWith("_test", StringComparison.Ordinal)
                     || dbName == "hotel_saas_p1b01a_test"
                     || dbName.Contains("test_");

        if (!isAllowed)
        {
            throw new InvalidOperationException(
                $"Target database '{builder.Database}' is NOT an authorized test database! Target database name must contain '_test'.");
        }
    }

    private sealed class MockTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class MockUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "cashier@hotel.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Receptionist;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsurePropertyContext() { }
        public void EnsureTenantContext() { }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide) { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
    }

    private sealed class MockMembershipLookupService : IMembershipLookupService
    {
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                Domain.Enums.StaffRole.Receptionist,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }
    }

    private static ApplicationDbContext CreateDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propertyService = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var propSvc = propertyService ?? new MockPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propSvc);
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        public string ConnectionString { get; }
        public string TestSchema { get; }
        public NpgsqlConnection Connection { get; }
        public Guid TenantId { get; }
        public Guid PropertyId { get; }
        public Guid RoomTypeId { get; }
        public Guid RoomId { get; }
        public Guid CashierUserId { get; }

        private TestFixture(
            string connectionString,
            string testSchema,
            NpgsqlConnection connection,
            Guid tenantId,
            Guid propertyId,
            Guid roomTypeId,
            Guid roomId,
            Guid cashierUserId)
        {
            ConnectionString = connectionString;
            TestSchema = testSchema;
            Connection = connection;
            TenantId = tenantId;
            PropertyId = propertyId;
            RoomTypeId = roomTypeId;
            RoomId = roomId;
            CashierUserId = cashierUserId;
        }

        public static async Task<TestFixture> CreateAsync(P4_CashFolioTests testSuite)
        {
            var connStr = GetConnectionString();
            ValidateTestDatabaseTarget(connStr);

            var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
            var conn = await testSuite.CreateTestConnectionAsync(testSchema);

            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var cashierUserId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propertyId };

            await using (var ctx = P4_CashFolioTests.CreateDbContext(connStr, testSchema, tenantService, propertyService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Xanh",
                    Code = "KSBX",
                    Slug = "ksbx",
                    Address = "120 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };
                var property = new Property
                {
                    Id = propertyId,
                    TenantId = tenantId,
                    Name = "Chi nhánh Mỹ Khê",
                    Code = "MK01",
                    Slug = "my-khe-01",
                    Address = "120 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };
                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    Name = "Deluxe Ocean View",
                    Code = "DOV",
                    BasePrice = 1_000_000m,
                    MaxOccupancy = 3
                };
                var room = new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "401",
                    Floor = 4,
                    Status = RoomStatus.Clean,
                    IsActive = true
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(property);
                ctx.RoomTypes.Add(roomType);
                ctx.Rooms.Add(room);
                await ctx.SaveChangesAsync();
            }

            return new TestFixture(connStr, testSchema, conn, tenantId, propertyId, roomTypeId, roomId, cashierUserId);
        }

        public ApplicationDbContext CreateDbContext()
        {
            var tenantSvc = new MockTenantService { TenantId = TenantId };
            var propSvc = new MockPropertyService { PropertyId = PropertyId, HeaderPropertyId = PropertyId, TokenPropertyId = PropertyId };
            return P4_CashFolioTests.CreateDbContext(ConnectionString, TestSchema, tenantSvc, propSvc);
        }

        public async Task<Reservation> SeedReservationAsync(
            ReservationStatus status = ReservationStatus.PendingPayment,
            decimal totalAmount = 1_000_000m,
            string customerName = "Nguyen Van A",
            string customerPhone = "0901234567")
        {
            await using var ctx = CreateDbContext();
            var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var checkOut = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3));

            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                PropertyId = PropertyId,
                RoomId = RoomId,
                GuestName = customerName,
                GuestPhone = customerPhone,
                GuestEmail = "guest@example.com",
                CheckInDate = checkIn,
                CheckOutDate = checkOut,
                NumberOfGuests = 2,
                TotalAmount = totalAmount,
                Status = status,
                ConfirmationCode = $"RES-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..18]
            };

            ctx.Reservations.Add(reservation);
            await ctx.SaveChangesAsync();
            return reservation;
        }

        public async ValueTask DisposeAsync()
        {
            await using (var cmd = Connection.CreateCommand())
            {
                cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{TestSchema}\" CASCADE;";
                await cmd.ExecuteNonQueryAsync();
            }
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task CreatePayment_ManualCash_RecordsPayment_AndTransitionsReservationToConfirmed()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.PendingPayment,
            totalAmount: 1_200_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var command = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 500_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-REC-001",
            IdempotencyKey: $"idemp-{Guid.NewGuid():N}");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(500_000m, result.Amount);
        Assert.Equal(PaymentMethod.Cash, result.Method);
        Assert.Equal(PaymentStatus.Completed, result.Status);
        Assert.Equal(reservation.Id, result.ReservationId);
        Assert.Contains($"[BY:{fixture.CashierUserId}]", result.TransactionRef);
        Assert.StartsWith($"[IK:{command.IdempotencyKey}][BY:{fixture.CashierUserId}]", result.TransactionRef);

        // Verify Reservation status transitioned to Confirmed
        var updatedRes = await ctx.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reservation.Id);
        Assert.NotNull(updatedRes);
        Assert.Equal(ReservationStatus.Confirmed, updatedRes.Status);

        // Verify Folio balance
        var folioHandler = new GetFolioQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var folio = await folioHandler.Handle(new GetFolioQuery(reservation.Id, fixture.PropertyId), CancellationToken.None);

        Assert.Equal(1_200_000m, folio.TotalAmount);
        Assert.Equal(500_000m, folio.PaidAmount);
        Assert.Equal(700_000m, folio.RemainingBalance);
        Assert.False(folio.IsFullyPaid);
        Assert.Single(folio.Payments);
        Assert.Equal(500_000m, folio.Payments[0].Amount);
    }

    [Fact]
    public async Task CreatePayment_FullPayment_SetsIsFullyPaidTrue_AndZeroBalance()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.Confirmed,
            totalAmount: 800_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        // Pay full amount via BankTransfer
        var command = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 800_000m,
            Method: PaymentMethod.BankTransfer,
            TransactionRef: "MB-TRANS-987654",
            IdempotencyKey: $"idemp-{Guid.NewGuid():N}");

        var result = await handler.Handle(command, CancellationToken.None);
        Assert.Equal(800_000m, result.Amount);
        Assert.Equal(PaymentMethod.BankTransfer, result.Method);

        // Query folio
        var folioHandler = new GetFolioQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var folio = await folioHandler.Handle(new GetFolioQuery(reservation.Id, fixture.PropertyId), CancellationToken.None);

        Assert.Equal(800_000m, folio.TotalAmount);
        Assert.Equal(800_000m, folio.PaidAmount);
        Assert.Equal(0m, folio.RemainingBalance);
        Assert.True(folio.IsFullyPaid);
    }

    [Fact]
    public async Task CreatePayment_IdempotencyReplay_ReturnsExistingPaymentWithoutDuplicate()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var idempKey = $"idem-replay-{Guid.NewGuid():N}";
        var command = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-002",
            IdempotencyKey: idempKey);

        var firstResult = await handler.Handle(command, CancellationToken.None);

        // Replay with exact same IdempotencyKey
        var replayCommand = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-002",
            IdempotencyKey: idempKey);

        var secondResult = await handler.Handle(replayCommand, CancellationToken.None);

        Assert.Equal(firstResult.Id, secondResult.Id);
        Assert.Equal(firstResult.Amount, secondResult.Amount);

        // Verify total payments in database is strictly 1
        var paymentsCount = await ctx.Payments.CountAsync(p => p.ReservationId == reservation.Id);
        Assert.Equal(1, paymentsCount);

        // Verify folio paid amount is exactly 300,000, not 600,000
        var folioHandler = new GetFolioQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var folio = await folioHandler.Handle(new GetFolioQuery(reservation.Id, fixture.PropertyId), CancellationToken.None);
        Assert.Equal(300_000m, folio.PaidAmount);
        Assert.Equal(700_000m, folio.RemainingBalance);
    }

    [Fact]
    public async Task CreatePayment_SameKey_DifferentPayload_ThrowsConflictException_PayloadMismatch()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var res1 = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);
        var res2 = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var sharedKey = $"idemp-conflict-{Guid.NewGuid():N}";

        // First payment succeeds
        var firstCommand = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-ORIG",
            IdempotencyKey: sharedKey);

        var firstResult = await handler.Handle(firstCommand, CancellationToken.None);
        Assert.NotNull(firstResult);

        // 1. Mismatch Amount: same key, different amount -> ERR_IDEMPOTENCY_PAYLOAD_MISMATCH
        var diffAmountCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 400_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-ORIG",
            IdempotencyKey: sharedKey);

        var exAmount = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(diffAmountCmd, CancellationToken.None));
        Assert.Equal("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", exAmount.ErrorCode);

        // 2. Mismatch Method: same key, different method -> ERR_IDEMPOTENCY_PAYLOAD_MISMATCH
        var diffMethodCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 300_000m,
            Method: PaymentMethod.BankTransfer,
            TransactionRef: "CASH-ORIG",
            IdempotencyKey: sharedKey);

        var exMethod = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(diffMethodCmd, CancellationToken.None));
        Assert.Equal("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", exMethod.ErrorCode);

        // 3. Mismatch Reservation: same key, different reservation -> ERR_IDEMPOTENCY_PAYLOAD_MISMATCH
        var diffResCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res2.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-ORIG",
            IdempotencyKey: sharedKey);

        var exRes = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(diffResCmd, CancellationToken.None));
        Assert.Equal("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", exRes.ErrorCode);

        // 4. Mismatch TransactionRef: same key, different reference -> ERR_IDEMPOTENCY_PAYLOAD_MISMATCH
        var diffRefCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-ALTERED",
            IdempotencyKey: sharedKey);

        var exRef = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(diffRefCmd, CancellationToken.None));
        Assert.Equal("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", exRef.ErrorCode);
    }

    [Fact]
    public async Task CreatePayment_ExceedingRemainingBalance_ThrowsBadRequestException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 500_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var overpayCommand = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 600_000m, // Exceeds 500_000
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null);

        var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(overpayCommand, CancellationToken.None));

        Assert.Equal("ERR_AMOUNT_EXCEEDS_BALANCE", ex.ErrorCode);
    }

    [Fact]
    public async Task CreatePayment_OnAlreadyFullyPaidFolio_ThrowsConflictException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 500_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        // First pay in full
        await handler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 500_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null), CancellationToken.None);

        // Attempt second payment
        var secondCommand = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 100_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(secondCommand, CancellationToken.None));

        Assert.Equal("ERR_FOLIO_ALREADY_PAID", ex.ErrorCode);
    }

    [Fact]
    public async Task CreatePayment_OnCancelledReservation_ThrowsConflictException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.Cancelled,
            totalAmount: 500_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var command = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 200_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(command, CancellationToken.None));

        Assert.Equal("ERR_RESERVATION_CANCELLED", ex.ErrorCode);
    }

    [Fact]
    public async Task CreatePayment_InvalidAmountsAndMethods_ThrowsBadRequestException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 500_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        // Zero amount
        var zeroCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 0m,
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null);

        var zEx = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(zeroCmd, CancellationToken.None));
        Assert.Equal("ERR_INVALID_AMOUNT", zEx.ErrorCode);

        // Negative amount
        var negCmd = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: -10_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: null,
            IdempotencyKey: null);

        var nEx = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(negCmd, CancellationToken.None));
        Assert.Equal("ERR_INVALID_AMOUNT", nEx.ErrorCode);
    }

    [Fact]
    public async Task CreatePayment_ConcurrentPayments_SerializeUnderRowLock_WithoutOvercharging()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        // Reservation total 700,000.
        // Two concurrent payments each try to pay 400,000.
        // If race condition existed, both would succeed and total would be 800,000 > 700,000.
        // With LockReservationRowAsync (FOR UPDATE), one must succeed (paying 400,000, leaving 300,000)
        // and the other must fail with ERR_AMOUNT_EXCEEDS_BALANCE (400,000 > 300,000).
        var reservation = await fixture.SeedReservationAsync(totalAmount: 700_000m);

        var barrier = new TaskCompletionSource();

        async Task<Exception?> ExecutePaymentAsync(string note)
        {
            await barrier.Task;
            try
            {
                await using var ctx = fixture.CreateDbContext();
                var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
                var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
                var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
                var membershipSvc = new MockMembershipLookupService();
                var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

                await handler.Handle(new CreatePaymentCommand(
                    PropertyId: fixture.PropertyId,
                    ReservationId: reservation.Id,
                    Amount: 400_000m,
                    Method: PaymentMethod.Cash,
                    TransactionRef: note,
                    IdempotencyKey: null), CancellationToken.None);

                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }

        var task1 = Task.Run(() => ExecutePaymentAsync("Payment Concurrent 1"));
        var task2 = Task.Run(() => ExecutePaymentAsync("Payment Concurrent 2"));

        // Release both tasks at once
        barrier.SetResult();

        var results = await Task.WhenAll(task1, task2);

        var successes = results.Count(r => r == null);
        var failures = results.Where(r => r != null).ToList();

        Assert.Equal(1, successes);
        Assert.Single(failures);
        Assert.IsType<BadRequestException>(failures[0]);
        var badReqEx = (BadRequestException)failures[0]!;
        Assert.Equal("ERR_AMOUNT_EXCEEDS_BALANCE", badReqEx.ErrorCode);

        // Verify total paid in database is strictly 400,000
        await using var verifyCtx = fixture.CreateDbContext();
        var vTenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var vPropSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var vUserCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var vMembershipSvc = new MockMembershipLookupService();
        var folioHandler = new GetFolioQueryHandler(verifyCtx, vTenantSvc, vUserCtx, vMembershipSvc, vPropSvc);
        var folio = await folioHandler.Handle(new GetFolioQuery(reservation.Id, fixture.PropertyId), CancellationToken.None);

        Assert.Equal(700_000m, folio.TotalAmount);
        Assert.Equal(400_000m, folio.PaidAmount);
        Assert.Equal(300_000m, folio.RemainingBalance);
        Assert.False(folio.IsFullyPaid);
    }

    [Fact]
    public async Task Concurrency_PaymentAndCancel_OnPendingPayment_SerializedUnderRoomLock_NeverRevivesCancelled()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.PendingPayment,
            totalAmount: 1_000_000m);

        var barrier = new TaskCompletionSource();

        async Task<Exception?> ExecutePaymentAsync()
        {
            await barrier.Task;
            try
            {
                await using var ctx = fixture.CreateDbContext();
                var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
                var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
                var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
                var membershipSvc = new MockMembershipLookupService();
                var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

                await handler.Handle(new CreatePaymentCommand(
                    PropertyId: fixture.PropertyId,
                    ReservationId: reservation.Id,
                    Amount: 500_000m,
                    Method: PaymentMethod.Cash,
                    TransactionRef: "CASH-CONC-CANCEL",
                    IdempotencyKey: $"idemp-{Guid.NewGuid():N}"), CancellationToken.None);

                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }

        async Task<Exception?> ExecuteCancelAsync()
        {
            await barrier.Task;
            try
            {
                await using var ctx = fixture.CreateDbContext();
                var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
                var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
                var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
                var membershipSvc = new MockMembershipLookupService();
                var handler = new CancelReservationCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

                await handler.Handle(new CancelReservationCommand(
                    ReservationId: reservation.Id,
                    PropertyId: fixture.PropertyId,
                    Reason: "Guest concurrent cancel request"), CancellationToken.None);

                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }

        var payTask = Task.Run(ExecutePaymentAsync);
        var cancelTask = Task.Run(ExecuteCancelAsync);

        barrier.SetResult();

        var results = await Task.WhenAll(payTask, cancelTask);
        var payEx = results[0];
        var cancelEx = results[1];

        // Cancel must always succeed (it is valid on both PendingPayment and Confirmed)
        Assert.Null(cancelEx);

        await using var verifyCtx = fixture.CreateDbContext();
        var finalRes = await verifyCtx.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reservation.Id);
        Assert.NotNull(finalRes);

        // Crucial invariant: The reservation MUST end in Cancelled status, never revived to Confirmed
        Assert.Equal(ReservationStatus.Cancelled, finalRes.Status);

        // If Payment failed due to Cancel winning the lock first:
        if (payEx != null)
        {
            Assert.IsType<ConflictException>(payEx);
            Assert.Equal("ERR_RESERVATION_CANCELLED", ((ConflictException)payEx).ErrorCode);

            var paymentsCount = await verifyCtx.Payments.CountAsync(p => p.ReservationId == reservation.Id);
            Assert.Equal(0, paymentsCount);
        }
        else
        {
            // Payment won first (confirmed), then Cancel cancelled it
            var paymentsCount = await verifyCtx.Payments.CountAsync(p => p.ReservationId == reservation.Id);
            Assert.Equal(1, paymentsCount);
        }
    }

    [Fact]
    public async Task GetPaymentsAndSummary_CalculatesAggregatesCorrectly()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var res1 = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);
        var res2 = await fixture.SeedReservationAsync(totalAmount: 2_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var payHandler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        // Payment 1: Cash 500,000
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 500_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-1",
            IdempotencyKey: null), CancellationToken.None);

        // Payment 2: BankTransfer 1,200,000
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res2.Id,
            Amount: 1_200_000m,
            Method: PaymentMethod.BankTransfer,
            TransactionRef: "BANK-1",
            IdempotencyKey: null), CancellationToken.None);

        // Payment 3: Cash 200,000
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Amount: 200_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-2",
            IdempotencyKey: null), CancellationToken.None);

        // 1. Test GetPaymentsQuery
        var listHandler = new GetPaymentsQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var pagedList = await listHandler.Handle(new GetPaymentsQuery(
            PropertyId: fixture.PropertyId,
            ReservationId: null,
            Method: null,
            Status: null,
            DateFrom: null,
            DateTo: null,
            Page: 1,
            PageSize: 10), CancellationToken.None);

        Assert.Equal(3, pagedList.TotalCount);
        Assert.Equal(3, pagedList.Items.Count);

        // Filter by reservation
        var res1Payments = await listHandler.Handle(new GetPaymentsQuery(
            PropertyId: fixture.PropertyId,
            ReservationId: res1.Id,
            Method: null,
            Status: null,
            DateFrom: null,
            DateTo: null,
            Page: 1,
            PageSize: 10), CancellationToken.None);
        Assert.Equal(2, res1Payments.TotalCount);

        // 2. Test GetPaymentSummaryQuery for today (VN timezone UTC+7)
        var vnTz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));

        var summaryHandler = new GetPaymentSummaryQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var summary = await summaryHandler.Handle(new GetPaymentSummaryQuery(
            PropertyId: fixture.PropertyId,
            Date: todayVn), CancellationToken.None);

        Assert.Equal(fixture.PropertyId, summary.PropertyId);
        Assert.Equal(todayVn, summary.Date);
        Assert.Equal(1_900_000m, summary.TotalCollected);
        Assert.Equal(700_000m, summary.CashCollected);
        Assert.Equal(1_200_000m, summary.BankTransferCollected);
        Assert.Equal(0m, summary.CreditCardCollected);
        Assert.Equal(3, summary.CompletedCount);
    }

    [Fact]
    public async Task CreatePayment_InvalidIdempotencyKey_DelimitersOrInvalidLength_ThrowsBadRequestException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var invalidKeys = new[]
        {
            "a][IK:b",                               // delimiter injection attempt
            "][BY:fake",                             // delimiter injection attempt
            "short",                                 // < 8 characters
            new string('k', 129),                    // > 128 characters
            "key with space",                        // whitespace
            "key:with:colons",                       // colon delimiter
            "key@special#chars!"                     // special characters outside [a-zA-Z0-9_-]
        };

        foreach (var key in invalidKeys)
        {
            var cmd = new CreatePaymentCommand(
                PropertyId: fixture.PropertyId,
                ReservationId: reservation.Id,
                Amount: 100_000m,
                Method: PaymentMethod.Cash,
                TransactionRef: "CASH-TEST",
                IdempotencyKey: key);

            var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_INVALID_IDEMPOTENCY_KEY", ex.ErrorCode);
        }
    }

    [Fact]
    public async Task CreatePayment_LegitimatePrefixKeys_AreNotConsideredReplay()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var handler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        var key1 = "test_key_prefix_10";
        var key2 = "test_key_prefix_100"; // shares prefix with key1, but is distinct

        var cmd1 = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 200_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-1",
            IdempotencyKey: key1);

        var result1 = await handler.Handle(cmd1, CancellationToken.None);
        Assert.NotNull(result1);

        var cmd2 = new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 300_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "CASH-2",
            IdempotencyKey: key2);

        var result2 = await handler.Handle(cmd2, CancellationToken.None);
        Assert.NotNull(result2);
        Assert.NotEqual(result1.Id, result2.Id);
        Assert.Equal(300_000m, result2.Amount);

        // Verify total payments recorded is 2
        var count = await ctx.Payments.CountAsync(p => p.ReservationId == reservation.Id);
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task CheckOut_WhenOutstandingBalance_ThrowsConflictException_ERR_OUTSTANDING_BALANCE()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        // Seed reservation at CheckedIn status with 1,000,000 total amount
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.CheckedIn,
            totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();
        var checkoutHandler = new CheckOutReservationCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

        // Case 1: 0 payment made -> throws ERR_OUTSTANDING_BALANCE
        var exNoPay = await Assert.ThrowsAsync<ConflictException>(() =>
            checkoutHandler.Handle(new CheckOutReservationCommand(reservation.Id, fixture.PropertyId), CancellationToken.None));
        Assert.Equal("ERR_OUTSTANDING_BALANCE", exNoPay.ErrorCode);

        // Pay partial 400,000 (leaves 600,000 balance)
        var payHandler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 400_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "PARTIAL-1",
            IdempotencyKey: null), CancellationToken.None);

        // Case 2: Partial payment made -> still throws ERR_OUTSTANDING_BALANCE
        var exPartial = await Assert.ThrowsAsync<ConflictException>(() =>
            checkoutHandler.Handle(new CheckOutReservationCommand(reservation.Id, fixture.PropertyId), CancellationToken.None));
        Assert.Equal("ERR_OUTSTANDING_BALANCE", exPartial.ErrorCode);
    }

    [Fact]
    public async Task CheckOut_WhenFullyPaid_TransitionsToCheckedOut()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.CheckedIn,
            totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();

        // Settle full payment first
        var payHandler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 1_000_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "FULL-PAY",
            IdempotencyKey: null), CancellationToken.None);

        // Checkout reservation
        var checkoutHandler = new CheckOutReservationCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        var checkoutResult = await checkoutHandler.Handle(
            new CheckOutReservationCommand(reservation.Id, fixture.PropertyId), CancellationToken.None);

        Assert.NotNull(checkoutResult);
        Assert.Equal(ReservationStatus.CheckedOut, checkoutResult.Status);

        // Verify database state: Reservation is CheckedOut, Room is Dirty
        var savedRes = await ctx.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reservation.Id);
        Assert.NotNull(savedRes);
        Assert.Equal(ReservationStatus.CheckedOut, savedRes.Status);

        var savedRoom = await ctx.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == fixture.RoomId);
        Assert.NotNull(savedRoom);
        Assert.Equal(RoomStatus.Dirty, savedRoom.Status);
    }

    [Fact]
    public async Task Concurrency_FinalPaymentAndCheckOut_SerializedUnderRoomLock_ConsistentOutcome()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        var reservation = await fixture.SeedReservationAsync(
            status: ReservationStatus.CheckedIn,
            totalAmount: 1_000_000m);

        await using var ctx = fixture.CreateDbContext();
        var userCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
        var membershipSvc = new MockMembershipLookupService();

        // Seed 500,000 partial payment upfront
        var payHandler = new CreatePaymentCommandHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);
        await payHandler.Handle(new CreatePaymentCommand(
            PropertyId: fixture.PropertyId,
            ReservationId: reservation.Id,
            Amount: 500_000m,
            Method: PaymentMethod.Cash,
            TransactionRef: "INIT-PARTIAL",
            IdempotencyKey: null), CancellationToken.None);

        var barrier = new TaskCompletionSource();

        async Task<Exception?> ExecuteFinalPaymentAsync()
        {
            await barrier.Task;
            try
            {
                await using var payCtx = fixture.CreateDbContext();
                var pUserCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
                var pTenantSvc = new MockTenantService { TenantId = fixture.TenantId };
                var pPropSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
                var pMembershipSvc = new MockMembershipLookupService();
                var handler = new CreatePaymentCommandHandler(payCtx, pTenantSvc, pUserCtx, pMembershipSvc, pPropSvc);

                await handler.Handle(new CreatePaymentCommand(
                    PropertyId: fixture.PropertyId,
                    ReservationId: reservation.Id,
                    Amount: 500_000m,
                    Method: PaymentMethod.Cash,
                    TransactionRef: "FINAL-PAY",
                    IdempotencyKey: $"idemp-{Guid.NewGuid():N}"), CancellationToken.None);

                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }

        async Task<Exception?> ExecuteCheckOutAsync()
        {
            await barrier.Task;
            try
            {
                await using var coCtx = fixture.CreateDbContext();
                var coUserCtx = new MockUserContext { UserId = fixture.CashierUserId, TenantId = fixture.TenantId, PropertyId = fixture.PropertyId };
                var coTenantSvc = new MockTenantService { TenantId = fixture.TenantId };
                var coPropSvc = new MockPropertyService { PropertyId = fixture.PropertyId, HeaderPropertyId = fixture.PropertyId, TokenPropertyId = fixture.PropertyId };
                var coMembershipSvc = new MockMembershipLookupService();
                var handler = new CheckOutReservationCommandHandler(coCtx, coTenantSvc, coUserCtx, coMembershipSvc, coPropSvc);

                await handler.Handle(new CheckOutReservationCommand(
                    ReservationId: reservation.Id,
                    PropertyId: fixture.PropertyId), CancellationToken.None);

                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }

        var payTask = Task.Run(ExecuteFinalPaymentAsync);
        var checkoutTask = Task.Run(ExecuteCheckOutAsync);

        barrier.SetResult();

        var results = await Task.WhenAll(payTask, checkoutTask);
        var payEx = results[0];
        var checkoutEx = results[1];

        // Payment should always succeed (status was CheckedIn, remaining balance was 500k)
        Assert.Null(payEx);

        await using var verifyCtx = fixture.CreateDbContext();
        var finalRes = await verifyCtx.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reservation.Id);
        Assert.NotNull(finalRes);

        var finalRoom = await verifyCtx.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == fixture.RoomId);
        Assert.NotNull(finalRoom);

        if (checkoutEx == null)
        {
            // Payment won the lock first, settled balance to 0, then Checkout ran and succeeded
            Assert.Equal(ReservationStatus.CheckedOut, finalRes.Status);
            Assert.Equal(RoomStatus.Dirty, finalRoom.Status);
        }
        else
        {
            // Checkout won the lock first while balance was still 500,000 -> rejected with ERR_OUTSTANDING_BALANCE,
            // then payment ran and succeeded.
            Assert.IsType<ConflictException>(checkoutEx);
            Assert.Equal("ERR_OUTSTANDING_BALANCE", ((ConflictException)checkoutEx).ErrorCode);
            Assert.Equal(ReservationStatus.CheckedIn, finalRes.Status);
        }

        // Total completed payments must strictly be 1,000,000m
        var totalPaid = await verifyCtx.Payments
            .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
            .SumAsync(p => p.Amount);
        Assert.Equal(1_000_000m, totalPaid);
    }
}
