using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Reservations.Commands.CancelReservation;
using HotelSaas.Application.Reservations.Commands.CheckOutReservation;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Loyalty;

[Collection("RealDatabaseTests")]
public sealed class LoyaltyLifecycleFsmTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
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
        public string Email { get; set; } = "staff@hotel.com";
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
        ICurrentTenantService tenantSvc,
        ICurrentPropertyService propSvc)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };

        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    [Fact]
    public async Task CancelReservation_WithPointsRedeemed_RefundsPointsToMembership_Idempotently()
    {
        var testSchema = $"loyalty_cancel_{Guid.NewGuid():N}"[..24];
        var connStr = GetConnectionString();

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var tenantSvc = new MockTenantService();
        var propSvc = new MockPropertyService();
        var userCtx = new MockUserContext();
        var membershipLookup = new MockMembershipLookupService();

        try
        {
            await using (var migrateCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var guestUserId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();

            tenantSvc.TenantId = tenantId;
            propSvc.PropertyId = propertyId;
            propSvc.HeaderPropertyId = propertyId;
            propSvc.TokenPropertyId = propertyId;
            userCtx.TenantId = tenantId;
            userCtx.PropertyId = propertyId;

            Guid reservationId;
            Guid membershipId;

            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var tenant = new Tenant { Id = tenantId, Name = "Aurora Hospitality", Code = "AURORA", Status = TenantStatus.Active };
                var property = new Property { Id = propertyId, TenantId = tenantId, Name = "Aurora Boutique", Code = "AUR-01", Slug = "aurora-boutique", Address = "12 Minh Khai" };
                var user = new User { Id = guestUserId, Email = "guest@example.com", Username = "guest", PasswordHash = "hash", FullName = "Nguyễn Văn Khách" };

                var membership = new GuestLoyaltyMembership
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EnrolledPropertyId = propertyId,
                    UserId = guestUserId,
                    MemberCode = "VIP-999123",
                    Tier = LoyaltyTier.Silver,
                    PointsBalance = 200,
                    LifetimePoints = 300,
                    CompletedStaysCount = 2
                };
                membershipId = membership.Id;

                var roomType = new RoomType { Id = roomTypeId, TenantId = tenantId, PropertyId = propertyId, Name = "Deluxe", Code = "DLX" };
                var room = new Room { Id = roomId, TenantId = tenantId, PropertyId = propertyId, RoomTypeId = roomTypeId, RoomNumber = "101", Floor = 1, Status = RoomStatus.Clean };

                var reservation = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomId = roomId,
                    GuestUserId = guestUserId,
                    GuestName = "Nguyễn Văn Khách",
                    GuestEmail = "guest@example.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                    TotalAmount = 900_000m,
                    PointsRedeemed = 100,
                    PointsDiscountAmount = 100_000m,
                    PointsRefunded = 0,
                    Status = ReservationStatus.Confirmed,
                    ConfirmationCode = "RES-998877"
                };
                reservationId = reservation.Id;

                var holdTx = new LoyaltyPointTransaction
                {
                    Id = Guid.NewGuid(),
                    MembershipId = membership.Id,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    ReservationId = reservation.Id,
                    TransactionType = LoyaltyPointTransactionType.HeldForBooking,
                    PointsDelta = -100,
                    BalanceAfter = 200,
                    Description = "Khóa tạm 100 điểm đặt phòng",
                    CreatedAtUtc = DateTime.UtcNow
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.Users.Add(user);
                seedCtx.GuestLoyaltyMemberships.Add(membership);
                seedCtx.RoomTypes.Add(roomType);
                seedCtx.Rooms.Add(room);
                seedCtx.Reservations.Add(reservation);
                seedCtx.LoyaltyPointTransactions.Add(holdTx);
                await seedCtx.SaveChangesAsync();
            }

            // Execute CancelReservationCommandHandler
            await using (var cancelCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CancelReservationCommandHandler(
                    cancelCtx,
                    tenantSvc,
                    userCtx,
                    membershipLookup,
                    propSvc);

                var command = new CancelReservationCommand(reservationId, propertyId, "Khách bận việc đột xuất");
                var result = await handler.Handle(command, CancellationToken.None);

                Assert.Equal(ReservationStatus.Cancelled, result.Status);
            }

            // Verify points refunded to membership and ledger recorded
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var res = await verifyCtx.Reservations.FindAsync(reservationId);
                Assert.NotNull(res);
                Assert.Equal(ReservationStatus.Cancelled, res.Status);
                Assert.Equal(100, res.PointsRefunded);

                var membership = await verifyCtx.GuestLoyaltyMemberships.FindAsync(membershipId);
                Assert.NotNull(membership);
                Assert.Equal(300, membership.PointsBalance); // 200 + 100 refunded = 300

                var refundTx = await verifyCtx.LoyaltyPointTransactions
                    .FirstOrDefaultAsync(t => t.ReservationId == reservationId && t.TransactionType == LoyaltyPointTransactionType.RefundedOnCancel);
                Assert.NotNull(refundTx);
                Assert.Equal(100, refundTx.PointsDelta);
                Assert.Equal(300, refundTx.BalanceAfter);

                // Idempotency check: Guard res.PointsRefunded == 0 prevents double-refunding
                Assert.Equal(res.PointsRedeemed, res.PointsRefunded);
            }
        }
        finally
        {
            await using var cleanupCmd = conn.CreateCommand();
            cleanupCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanupCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task CheckOutReservation_AwardsPointsBasedOnMembershipTier_AndUpgradesTier()
    {
        var testSchema = $"loyalty_checkout_{Guid.NewGuid():N}"[..24];
        var connStr = GetConnectionString();

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var tenantSvc = new MockTenantService();
        var propSvc = new MockPropertyService();
        var userCtx = new MockUserContext();
        var membershipLookup = new MockMembershipLookupService();

        try
        {
            await using (var migrateCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var guestUserId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();

            tenantSvc.TenantId = tenantId;
            propSvc.PropertyId = propertyId;
            propSvc.HeaderPropertyId = propertyId;
            propSvc.TokenPropertyId = propertyId;
            userCtx.TenantId = tenantId;
            userCtx.PropertyId = propertyId;

            Guid reservationId;
            Guid membershipId;

            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var tenant = new Tenant { Id = tenantId, Name = "Aurora Hospitality", Code = "AURORA", Status = TenantStatus.Active };
                var property = new Property { Id = propertyId, TenantId = tenantId, Name = "Aurora Boutique", Code = "AUR-01", Slug = "aurora-boutique", Address = "12 Minh Khai" };
                var user = new User { Id = guestUserId, Email = "goldguest@example.com", Username = "goldguest", PasswordHash = "hash", FullName = "Lê Thị Vàng" };

                // Gold member with 14 completed stays: 1 more stay triggers Diamond upgrade (>= 15 stays)!
                var membership = new GuestLoyaltyMembership
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EnrolledPropertyId = propertyId,
                    UserId = guestUserId,
                    MemberCode = "GLD-888999",
                    Tier = LoyaltyTier.Gold, // 4% earn rate
                    PointsBalance = 500,
                    LifetimePoints = 1200,
                    CompletedStaysCount = 14
                };
                membershipId = membership.Id;

                var roomType = new RoomType { Id = roomTypeId, TenantId = tenantId, PropertyId = propertyId, Name = "Suite", Code = "STE" };
                var room = new Room { Id = roomId, TenantId = tenantId, PropertyId = propertyId, RoomTypeId = roomTypeId, RoomNumber = "201", Floor = 2, Status = RoomStatus.Occupied };

                // 2,000,000 VND reservation, fully paid
                var reservation = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomId = roomId,
                    GuestUserId = guestUserId,
                    GuestName = "Lê Thị Vàng",
                    GuestEmail = "goldguest@example.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    TotalAmount = 2_000_000m,
                    PointsRedeemed = 0,
                    PointsDiscountAmount = 0m,
                    PointsEarned = 0,
                    Status = ReservationStatus.CheckedIn,
                    ConfirmationCode = "RES-GOLD-01"
                };
                reservationId = reservation.Id;

                var payment = new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    ReservationId = reservation.Id,
                    Amount = 2_000_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Completed,
                    PaidAtUtc = DateTime.UtcNow
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.Users.Add(user);
                seedCtx.GuestLoyaltyMemberships.Add(membership);
                seedCtx.RoomTypes.Add(roomType);
                seedCtx.Rooms.Add(room);
                seedCtx.Reservations.Add(reservation);
                seedCtx.Payments.Add(payment);
                await seedCtx.SaveChangesAsync();
            }

            // Execute CheckOutReservationCommandHandler
            await using (var checkoutCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckOutReservationCommandHandler(
                    checkoutCtx,
                    tenantSvc,
                    userCtx,
                    membershipLookup,
                    propSvc);

                var command = new CheckOutReservationCommand(reservationId, propertyId);
                var result = await handler.Handle(command, CancellationToken.None);

                Assert.Equal(ReservationStatus.CheckedOut, result.Status);
            }

            // Verify points awarded (4% of 2,000,000 = 80,000 VND = 80 points) and tier upgraded to Diamond
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var res = await verifyCtx.Reservations.FindAsync(reservationId);
                Assert.NotNull(res);
                Assert.Equal(ReservationStatus.CheckedOut, res.Status);
                Assert.Equal(80, res.PointsEarned);

                var room = await verifyCtx.Rooms.FindAsync(roomId);
                Assert.NotNull(room);
                Assert.Equal(RoomStatus.Dirty, room.Status);

                var membership = await verifyCtx.GuestLoyaltyMemberships.FindAsync(membershipId);
                Assert.NotNull(membership);
                Assert.Equal(580, membership.PointsBalance); // 500 + 80 = 580
                Assert.Equal(1280, membership.LifetimePoints);
                Assert.Equal(15, membership.CompletedStaysCount);
                Assert.Equal(LoyaltyTier.Diamond, membership.Tier); // Auto-upgraded from Gold to Diamond at 15 stays!

                var earnTx = await verifyCtx.LoyaltyPointTransactions
                    .FirstOrDefaultAsync(t => t.ReservationId == reservationId && t.TransactionType == LoyaltyPointTransactionType.EarnedOnCheckout);
                Assert.NotNull(earnTx);
                Assert.Equal(80, earnTx.PointsDelta);
                Assert.Equal(580, earnTx.BalanceAfter);
            }
        }
        finally
        {
            await using var cleanupCmd = conn.CreateCommand();
            cleanupCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanupCmd.ExecuteNonQueryAsync();
        }
    }
}
