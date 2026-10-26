using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Commands.ConfirmGuestBooking;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetGuestBookingByToken;
using HotelSaas.Application.Public.Queries.GetPublicAvailability;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;
using HotelSaas.Application.Public.Queries.GetPublicRoomTypes;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

/// <summary>
/// Comprehensive integration and concurrency tests for P5-GUEST-BOOKING-01:
/// 1. Online hold creation with room auto-assignment, 15-minute expiration, 30% deposit, and unguessable token.
/// 2. Concurrency race on last available room (only one wins under LockRoomRowAsync).
/// 3. Expired online hold immediately frees inventory for subsequent bookings (Decision D03).
/// 4. Secure booking lookup by token masks PII (Decision D02, D21).
/// 5. Invalid token returns NotFoundException.
/// 6. Confirm active hold transitions to Confirmed, records deposit, and is idempotent upon replay.
/// 7. Confirm expired hold throws ConflictException (ERR_HOLD_EXPIRED).
/// 8. Public discovery queries return active properties, room types, and availability.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P5_GuestBookingTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
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
        public string Email { get; set; } = "staff@hotel.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public HotelSaas.Domain.Enums.TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public HotelSaas.Domain.Enums.PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public HotelSaas.Domain.Enums.StaffRole? StaffRole { get; set; } = HotelSaas.Domain.Enums.StaffRole.Receptionist;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }
        public void SetMembershipContext(
            Guid tenantId,
            HotelSaas.Domain.Enums.TenantStatus tenantStatus,
            Guid? propertyId,
            HotelSaas.Domain.Enums.PropertyStatus? propertyStatus,
            HotelSaas.Domain.Enums.StaffRole? staffRole,
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
        public string PropertySlug { get; }
        public Guid RoomTypeId { get; }
        public Guid RoomId1 { get; }
        public Guid RoomId2 { get; }

        private TestFixture(
            string connectionString,
            string testSchema,
            NpgsqlConnection connection,
            Guid tenantId,
            Guid propertyId,
            string propertySlug,
            Guid roomTypeId,
            Guid roomId1,
            Guid roomId2)
        {
            ConnectionString = connectionString;
            TestSchema = testSchema;
            Connection = connection;
            TenantId = tenantId;
            PropertyId = propertyId;
            PropertySlug = propertySlug;
            RoomTypeId = roomTypeId;
            RoomId1 = roomId1;
            RoomId2 = roomId2;
        }

        public static async Task<TestFixture> CreateAsync(P5_GuestBookingTests testSuite, int roomCount = 2)
        {
            var connStr = GetConnectionString();
            ValidateTestDatabaseTarget(connStr);

            var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
            var conn = await testSuite.CreateTestConnectionAsync(testSchema);

            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var propertySlug = $"chi-nhanh-{Guid.NewGuid():N}"[..16];
            var roomTypeId = Guid.NewGuid();
            var roomId1 = Guid.NewGuid();
            var roomId2 = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propertyId };

            await using (var ctx = P5_GuestBookingTests.CreateDbContext(connStr, testSchema, tenantService, propertyService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Đông",
                    Code = "KSBD",
                    Slug = "ksbd",
                    Address = "200 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var property = new Property
                {
                    Id = propertyId,
                    TenantId = tenantId,
                    Name = "Khách Sạn Biển Đông - Chi Nhánh 1",
                    Code = "BD01",
                    Slug = propertySlug,
                    Address = "200 Vo Nguyen Giap",
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
                    MaxOccupancy = 2
                };

                var room1 = new Room
                {
                    Id = roomId1,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "101",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(property);
                ctx.RoomTypes.Add(roomType);
                ctx.Rooms.Add(room1);

                if (roomCount > 1)
                {
                    var room2 = new Room
                    {
                        Id = roomId2,
                        TenantId = tenantId,
                        PropertyId = propertyId,
                        RoomTypeId = roomTypeId,
                        RoomNumber = "102",
                        Floor = 1,
                        Status = RoomStatus.Clean,
                        IsActive = true
                    };
                    ctx.Rooms.Add(room2);
                }

                // Seed Rate for 2026: 300k for 2h package, 50k extra hour, 1_000_000 nightly
                var rate = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    EffectiveFrom = new DateOnly(2026, 1, 1),
                    EffectiveTo = new DateOnly(2026, 12, 31),
                    FirstHours = 2,
                    FirstHoursPrice = 300_000m,
                    AdditionalHourPrice = 50_000m,
                    NightlyPrice = 1_000_000m,
                    CreatedByUserId = Guid.NewGuid(),
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.RoomTypeRates.Add(rate);

                await ctx.SaveChangesAsync();
            }

            return new TestFixture(connStr, testSchema, conn, tenantId, propertyId, propertySlug, roomTypeId, roomId1, roomId2);
        }

        public ApplicationDbContext CreateDbContext(MockTenantService? tenantSvc = null, MockPropertyService? propSvc = null)
        {
            var t = tenantSvc ?? new MockTenantService { TenantId = TenantId };
            var p = propSvc ?? new MockPropertyService { PropertyId = PropertyId, HeaderPropertyId = PropertyId, TokenPropertyId = PropertyId };
            return P5_GuestBookingTests.CreateDbContext(ConnectionString, TestSchema, t, p);
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
    public async Task CreateGuestHold_AutoAssignsAvailableRoom_AndSets15MinuteExpiryAndDeposit()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService();
        var propSvc = new MockPropertyService();
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pricingCalculator = new PricingCalculator(ctx);
        var handler = new CreateGuestHoldCommandHandler(ctx, pricingCalculator, tenantSvc, propSvc);

        // 1 night stay: 2026-10-15 14:00 (+7) to 2026-10-16 12:00 (+7)
        // UTC: 2026-10-15 07:00:00Z to 2026-10-16 05:00:00Z
        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var command = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Nguyen Van A",
            GuestEmail: "guest.test@example.com",
            GuestPhone: "0901234567",
            NumberOfGuests: 2,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        );

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.ReservationId);
        Assert.StartsWith("RES-", result.ConfirmationCode);
        Assert.Equal(48, result.LookupToken.Length); // 24 bytes hex = 48 chars
        Assert.True(result.AssignedRoomId == fixture.RoomId1 || result.AssignedRoomId == fixture.RoomId2);
        Assert.Equal(1_000_000m, result.TotalAmount);
        Assert.Equal(300_000m, result.DepositRequired); // 30% of 1M = 300,000 VND
        Assert.True(result.HoldExpiresAtUtc > DateTime.UtcNow.AddMinutes(14));
        Assert.True(result.HoldExpiresAtUtc <= DateTime.UtcNow.AddMinutes(16));
        Assert.Equal(900, result.SecondsRemaining);
        Assert.Equal(ReservationStatus.PendingPayment.ToString(), result.Status);

        // Verify DB entity
        var savedRes = await ctx.Reservations.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == result.ReservationId);
        Assert.NotNull(savedRes);
        Assert.Equal(result.AssignedRoomId, savedRes.RoomId);
        Assert.Equal(ReservationStatus.PendingPayment, savedRes.Status);

        var snapshot = ReservationSnapshotHelper.TryDeserialize(savedRes.Notes);
        Assert.NotNull(snapshot);
        Assert.Equal(result.LookupToken, snapshot.LookupToken);
        Assert.True(snapshot.IsOnlineHold);
        Assert.Equal(result.HoldExpiresAtUtc, snapshot.HoldExpiresAtUtc);
    }

    [Fact]
    public async Task CreateGuestHold_ConcurrencyRace_CompetesForLastRoom_OnlyOneWins()
    {
        // Property has ONLY 1 room
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 1);

        var startUtc = new DateTime(2026, 10, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 21, 5, 0, 0, DateTimeKind.Utc);

        var cmd1 = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Guest Winner",
            GuestEmail: "winner@example.com",
            GuestPhone: "0901111111",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 20),
            CheckOutDate: new DateOnly(2026, 10, 21)
        );

        var cmd2 = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Guest Loser",
            GuestEmail: "loser@example.com",
            GuestPhone: "0902222222",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 20),
            CheckOutDate: new DateOnly(2026, 10, 21)
        );

        int successes = 0;
        int conflicts = 0;

        var task1 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService();
            var pSvc = new MockPropertyService();
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var pc = new PricingCalculator(c);
            var h = new CreateGuestHoldCommandHandler(c, pc, tSvc, pSvc);
            try
            {
                await h.Handle(cmd1, CancellationToken.None);
                Interlocked.Increment(ref successes);
            }
            catch (ConflictException)
            {
                Interlocked.Increment(ref conflicts);
            }
        });

        var task2 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService();
            var pSvc = new MockPropertyService();
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var pc = new PricingCalculator(c);
            var h = new CreateGuestHoldCommandHandler(c, pc, tSvc, pSvc);
            try
            {
                await h.Handle(cmd2, CancellationToken.None);
                Interlocked.Increment(ref successes);
            }
            catch (ConflictException)
            {
                Interlocked.Increment(ref conflicts);
            }
        });

        await Task.WhenAll(task1, task2);

        Assert.Equal(1, successes);
        Assert.Equal(1, conflicts);

        await using var verifyCtx = fixture.CreateDbContext();
        var reservationsCount = await verifyCtx.Reservations.IgnoreQueryFilters().CountAsync();
        Assert.Equal(1, reservationsCount);
    }

    [Fact]
    public async Task CreateGuestHold_ExpiredHold_AutomaticallyFreesInventoryForNextBooking()
    {
        // Property has 1 room
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 1);

        var startUtc = new DateTime(2026, 10, 25, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 26, 5, 0, 0, DateTimeKind.Utc);

        // 1. Seed an expired hold on the single room
        await using (var seedCtx = fixture.CreateDbContext())
        {
            var expiredSnapshot = new ReservationSnapshot
            {
                RentalType = RentalType.Overnight,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                BufferMinutes = 30,
                RoomTypeId = fixture.RoomTypeId,
                RoomTypeName = "Deluxe Ocean View",
                TotalAmount = 1_000_000m,
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5), // Expired 5 mins ago
                LookupToken = "expired_token_1234567890abcdef",
                DepositRequired = 300_000m,
                IsOnlineHold = true
            };

            var expiredRes = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = fixture.TenantId,
                PropertyId = fixture.PropertyId,
                RoomId = fixture.RoomId1,
                GuestName = "Old Expired Guest",
                GuestEmail = "old@example.com",
                GuestPhone = "0900000000",
                CheckInDate = new DateOnly(2026, 10, 25),
                CheckOutDate = new DateOnly(2026, 10, 26),
                NumberOfGuests = 1,
                TotalAmount = 1_000_000m,
                Status = ReservationStatus.PendingPayment,
                Notes = ReservationSnapshotHelper.Serialize(expiredSnapshot),
                ConfirmationCode = "RES-EXPIRED",
                CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20),
                UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
            };

            seedCtx.Reservations.Add(expiredRes);
            await seedCtx.SaveChangesAsync();
        }

        // 2. New booking attempts to book the same room type and dates
        var tenantSvc = new MockTenantService();
        var propSvc = new MockPropertyService();
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var command = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "New Fresh Guest",
            GuestEmail: "fresh@example.com",
            GuestPhone: "0909999999",
            NumberOfGuests: 2,
            CheckInDate: new DateOnly(2026, 10, 25),
            CheckOutDate: new DateOnly(2026, 10, 26)
        );

        // Under Decision D03, expired hold is ignored by IsBlockingReservation, so this succeeds!
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(fixture.RoomId1, result.AssignedRoomId);
        Assert.Equal(ReservationStatus.PendingPayment.ToString(), result.Status);
    }

    [Fact]
    public async Task GetGuestBookingByToken_MasksPII_AndReturnsMetrics()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService();
        var propSvc = new MockPropertyService();
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var holdHandler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var hold = await holdHandler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Nguyen Van Anh",
            GuestEmail: "nguyen.anh@gmail.com",
            GuestPhone: "0901234567",
            NumberOfGuests: 2,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        // Lookup by token
        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(hold.LookupToken), CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal(hold.ConfirmationCode, detail.ConfirmationCode);
        Assert.Equal(hold.LookupToken, detail.LookupToken);
        Assert.Equal("n***h@gmail.com", detail.MaskedGuestEmail);
        Assert.Equal("090****567", detail.MaskedGuestPhone);
        Assert.Contains("***", detail.MaskedGuestName);
        Assert.DoesNotContain("Van", detail.MaskedGuestName); // middle name masked
        Assert.Equal(1_000_000m, detail.TotalAmount);
        Assert.Equal(300_000m, detail.DepositRequired);
        Assert.Equal(0m, detail.PaidAmount);
        Assert.Equal(1_000_000m, detail.RemainingBalance);
        Assert.False(detail.IsFullyPaid);
        Assert.True(detail.SecondsRemaining > 0 && detail.SecondsRemaining <= 900);
    }

    [Fact]
    public async Task GetGuestBookingByToken_InvalidOrMissingToken_ThrowsNotFoundException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();
        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery("unknown_token_999999999999999999999999"), CancellationToken.None));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery("   "), CancellationToken.None));
    }

    [Fact]
    public async Task CreateGuestHold_SameKey_Concurrent_OnRoomTypeWithMultipleRooms_CreatesExactlyOneHold()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var sharedKey = "shared-hold-key-1001";
        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var task1 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService { TenantId = fixture.TenantId };
            var pSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var pc = new PricingCalculator(c);
            var h = new CreateGuestHoldCommandHandler(c, pc, tSvc, pSvc);
            return await h.Handle(new CreateGuestHoldCommand(
                PropertySlug: fixture.PropertySlug,
                RoomTypeId: fixture.RoomTypeId,
                RentalType: RentalType.Overnight,
                StartAtUtc: startUtc,
                EndAtUtc: endUtc,
                GuestName: "SameKey Guest",
                GuestEmail: "samekey@example.com",
                GuestPhone: "0901111111",
                NumberOfGuests: 1,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16),
                IdempotencyKey: sharedKey
            ), CancellationToken.None);
        });

        var task2 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService { TenantId = fixture.TenantId };
            var pSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var pc = new PricingCalculator(c);
            var h = new CreateGuestHoldCommandHandler(c, pc, tSvc, pSvc);
            return await h.Handle(new CreateGuestHoldCommand(
                PropertySlug: fixture.PropertySlug,
                RoomTypeId: fixture.RoomTypeId,
                RentalType: RentalType.Overnight,
                StartAtUtc: startUtc,
                EndAtUtc: endUtc,
                GuestName: "SameKey Guest",
                GuestEmail: "samekey@example.com",
                GuestPhone: "0901111111",
                NumberOfGuests: 1,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16),
                IdempotencyKey: sharedKey
            ), CancellationToken.None);
        });

        var results = await Task.WhenAll(task1, task2);

        // Both calls should resolve to the exact same hold and reservation
        Assert.Equal(results[0].ReservationId, results[1].ReservationId);
        Assert.Equal(results[0].AssignedRoomId, results[1].AssignedRoomId);
        Assert.Equal(results[0].LookupToken, results[1].LookupToken);

        await using var verifyCtx = fixture.CreateDbContext();
        var totalHolds = await verifyCtx.Reservations.IgnoreQueryFilters()
            .CountAsync(r => r.PropertyId == fixture.PropertyId);
        Assert.Equal(1, totalHolds);
    }

    [Fact]
    public async Task CreateGuestHold_SameKey_WithChangedPayload_ThrowsConflictException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var sharedKey = "shared-conflict-key-2002";
        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        // First hold succeeds
        await handler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Original Guest",
            GuestEmail: "original@example.com",
            GuestPhone: "0901111111",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16),
            IdempotencyKey: sharedKey
        ), CancellationToken.None);

        // Second hold with changed guest name throws ConflictException
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CreateGuestHoldCommand(
                PropertySlug: fixture.PropertySlug,
                RoomTypeId: fixture.RoomTypeId,
                RentalType: RentalType.Overnight,
                StartAtUtc: startUtc,
                EndAtUtc: endUtc,
                GuestName: "Altered Name",
                GuestEmail: "original@example.com",
                GuestPhone: "0901111111",
                NumberOfGuests: 1,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16),
                IdempotencyKey: sharedKey
            ), CancellationToken.None));

        Assert.Equal("ERR_IDEMPOTENCY_CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task ConfirmGuestBooking_ActiveHold_TransitionsToConfirmed_AndIsIdempotent()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var userCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var holdHandler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var hold = await holdHandler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Tran Thi B",
            GuestEmail: "tran.b@example.com",
            GuestPhone: "0912345678",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        // 1. Confirm hold with deposit
        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, userCtx);
        var confirmResult = await confirmHandler.Handle(new ConfirmGuestBookingCommand(
            LookupToken: hold.LookupToken,
            ReservationId: null,
            PropertyId: fixture.PropertyId,
            PaymentAmount: hold.DepositRequired,
            PaymentMethod: PaymentMethod.BankTransfer,
            TransactionRef: "DEMO-TX-1001",
            IdempotencyKey: "confirm-key-001"
        ), CancellationToken.None);

        Assert.Equal("Confirmed", confirmResult.Status);
        Assert.Equal(300_000m, confirmResult.PaidAmount);
        Assert.Equal(700_000m, confirmResult.RemainingBalance);
        Assert.False(confirmResult.IsFullyPaid);

        // Verify DB reservation status
        var savedRes = await ctx.Reservations.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == hold.ReservationId);
        Assert.NotNull(savedRes);
        Assert.Equal(ReservationStatus.Confirmed, savedRes.Status);

        // Verify DB payment record and actor audit
        var payments = await ctx.Payments.IgnoreQueryFilters().Where(p => p.ReservationId == hold.ReservationId).ToListAsync();
        Assert.Single(payments);
        Assert.Equal(300_000m, payments[0].Amount);
        Assert.Equal(PaymentStatus.Completed, payments[0].Status);
        Assert.Contains($"[BY:{userCtx.UserId}]", payments[0].TransactionRef);

        // 2. Re-confirm with same token (idempotent replay)
        var replayResult = await confirmHandler.Handle(new ConfirmGuestBookingCommand(
            LookupToken: hold.LookupToken,
            ReservationId: null,
            PropertyId: fixture.PropertyId,
            PaymentAmount: hold.DepositRequired,
            PaymentMethod: PaymentMethod.BankTransfer,
            TransactionRef: "DEMO-TX-1001",
            IdempotencyKey: "confirm-key-001"
        ), CancellationToken.None);

        Assert.Equal("Confirmed", replayResult.Status);
        Assert.Equal(300_000m, replayResult.PaidAmount);

        // Verify payments count is still exactly 1
        var paymentsAfterReplay = await ctx.Payments.IgnoreQueryFilters().Where(p => p.ReservationId == hold.ReservationId).ToListAsync();
        Assert.Single(paymentsAfterReplay);
    }

    [Fact]
    public async Task ConfirmGuestBooking_Unauthenticated_ThrowsForbiddenException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var unauthCtx = new MockUserContext { UserId = Guid.Empty }; // unauthenticated!
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, unauthCtx);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            confirmHandler.Handle(new ConfirmGuestBookingCommand(
                LookupToken: "dummy-token",
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: 300_000m,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-01"
            ), CancellationToken.None));
    }

    [Fact]
    public async Task ConfirmGuestBooking_BranchMismatch_ThrowsBadRequestException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var userCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, userCtx);

        var foreignBranchId = Guid.NewGuid();
        var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
            confirmHandler.Handle(new ConfirmGuestBookingCommand(
                LookupToken: "dummy-token",
                ReservationId: null,
                PropertyId: foreignBranchId,
                PaymentAmount: 300_000m,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-01"
            ), CancellationToken.None));

        Assert.Equal("ERR_BRANCH_MISMATCH", ex.ErrorCode);
    }

    [Fact]
    public async Task ConfirmGuestBooking_InsufficientDeposit_ThrowsBadRequestException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var userCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var holdHandler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var hold = await holdHandler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Deposit Test",
            GuestEmail: "deposit@example.com",
            GuestPhone: "0912345678",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, userCtx);

        // Required deposit is 300,000 VND. Submitting 100,000 VND throws ERR_INSUFFICIENT_DEPOSIT
        var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
            confirmHandler.Handle(new ConfirmGuestBookingCommand(
                LookupToken: hold.LookupToken,
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: 100_000m,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-INSUFFICIENT"
            ), CancellationToken.None));

        Assert.Equal("ERR_INSUFFICIENT_DEPOSIT", ex.ErrorCode);
    }

    [Fact]
    public async Task ConfirmGuestBooking_ExpiredHold_ThrowsConflictException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var userCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        // Seed hold that expired 2 minutes ago
        var expiredToken = "expired_confirm_token_123456789";
        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            BufferMinutes = 30,
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-2), // Expired!
            LookupToken = expiredToken,
            DepositRequired = 300_000m,
            IsOnlineHold = true,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            IsTokenRevoked = false
        };

        var expiredRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Expired Guest",
            GuestEmail = "expired@example.com",
            GuestPhone = "0900000000",
            CheckInDate = new DateOnly(2026, 10, 15),
            CheckOutDate = new DateOnly(2026, 10, 16),
            NumberOfGuests = 1,
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            ConfirmationCode = "RES-EXP-001",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        };

        ctx.Reservations.Add(expiredRes);
        await ctx.SaveChangesAsync();

        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, userCtx);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            confirmHandler.Handle(new ConfirmGuestBookingCommand(
                LookupToken: expiredToken,
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: 300_000m,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-EXP"
            ), CancellationToken.None));

        Assert.Equal("ERR_HOLD_EXPIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task ConfirmGuestBooking_ConcurrentConfirm_RecordsExactlyOnePayment()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var holdHandler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var hold = await holdHandler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Concurrent Confirm",
            GuestEmail: "concurrent.confirm@example.com",
            GuestPhone: "0908888888",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        var key = "same-confirm-key-777";

        var task1 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService { TenantId = fixture.TenantId };
            var pSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
            var uCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var h = new ConfirmGuestBookingCommandHandler(c, tSvc, pSvc, uCtx);
            return await h.Handle(new ConfirmGuestBookingCommand(
                LookupToken: hold.LookupToken,
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: hold.DepositRequired,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-CONCURRENT",
                IdempotencyKey: key
            ), CancellationToken.None);
        });

        var task2 = Task.Run(async () =>
        {
            var tSvc = new MockTenantService { TenantId = fixture.TenantId };
            var pSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
            var uCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
            await using var c = fixture.CreateDbContext(tSvc, pSvc);
            var h = new ConfirmGuestBookingCommandHandler(c, tSvc, pSvc, uCtx);
            return await h.Handle(new ConfirmGuestBookingCommand(
                LookupToken: hold.LookupToken,
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: hold.DepositRequired,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-CONCURRENT",
                IdempotencyKey: key
            ), CancellationToken.None);
        });

        var results = await Task.WhenAll(task1, task2);

        Assert.Equal("Confirmed", results[0].Status);
        Assert.Equal("Confirmed", results[1].Status);

        await using var verifyCtx = fixture.CreateDbContext();
        var payments = await verifyCtx.Payments.IgnoreQueryFilters()
            .Where(p => p.ReservationId == hold.ReservationId)
            .ToListAsync();

        Assert.Single(payments); // Exactly one Completed payment recorded!
        Assert.Equal(hold.DepositRequired, payments[0].Amount);
    }

    [Fact]
    public async Task ConfirmGuestBooking_ConcurrentCancel_DoesNotReviveCancelledReservation()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        var userCtx = new MockUserContext { PropertyId = fixture.PropertyId, TenantId = fixture.TenantId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var holdHandler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc);

        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

        var hold = await holdHandler.Handle(new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Cancel Race",
            GuestEmail: "cancel.race@example.com",
            GuestPhone: "0907777777",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 10, 15),
            CheckOutDate: new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        // Cancel the reservation first
        var res = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == hold.ReservationId);
        res.Status = ReservationStatus.Cancelled;
        await ctx.SaveChangesAsync();

        // Attempt to confirm the cancelled reservation under room lock
        var confirmHandler = new ConfirmGuestBookingCommandHandler(ctx, tenantSvc, propSvc, userCtx);
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            confirmHandler.Handle(new ConfirmGuestBookingCommand(
                LookupToken: hold.LookupToken,
                ReservationId: null,
                PropertyId: fixture.PropertyId,
                PaymentAmount: hold.DepositRequired,
                PaymentMethod: PaymentMethod.BankTransfer,
                TransactionRef: "TX-CANCEL-RACE"
            ), CancellationToken.None));

        Assert.Equal("ERR_RESERVATION_CANCELLED", ex.ErrorCode);

        // Verify reservation remains Cancelled and no payment was written
        await using var verifyCtx = fixture.CreateDbContext();
        var recheck = await verifyCtx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == hold.ReservationId);
        Assert.Equal(ReservationStatus.Cancelled, recheck.Status);

        var payments = await verifyCtx.Payments.IgnoreQueryFilters().Where(p => p.ReservationId == hold.ReservationId).ToListAsync();
        Assert.Empty(payments);
    }

    [Fact]
    public async Task GetGuestBookingByToken_RevokedOrExpiredToken_ThrowsNotFoundException()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        // 1. Seed revoked token
        var revokedToken = "revoked_token_123456789";
        var snapRevoked = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow,
            EndAtUtc = DateTime.UtcNow.AddDays(1),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Standard",
            TotalAmount = 500_000m,
            LookupToken = revokedToken,
            IsTokenRevoked = true // REVOKED!
        };

        var resRevoked = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Revoked",
            GuestEmail = "revoked@example.com",
            TotalAmount = 500_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapRevoked),
            ConfirmationCode = "RES-REV-01"
        };
        ctx.Reservations.Add(resRevoked);

        // 2. Seed expired TTL token
        var expiredTtlToken = "expired_ttl_token_123456789";
        var snapExpired = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(-10),
            EndAtUtc = DateTime.UtcNow.AddDays(-9),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Standard",
            TotalAmount = 500_000m,
            LookupToken = expiredTtlToken,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(-1) // EXPIRED TTL!
        };

        var resExpired = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId2,
            GuestName = "Expired TTL",
            GuestEmail = "expiredttl@example.com",
            TotalAmount = 500_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapExpired),
            ConfirmationCode = "RES-EXPTTL-01"
        };
        ctx.Reservations.Add(resExpired);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // Revoked token fail-closed
        await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(revokedToken), CancellationToken.None));

        // Expired TTL token fail-closed
        await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(expiredTtlToken), CancellationToken.None));
    }

    [Fact]
    public async Task PublicDiscovery_Queries_ReturnDetailsAndRoomTypesScopedToActiveProperty()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var secondPropertyId = Guid.NewGuid();
        var secondRoomTypeId = Guid.NewGuid();
        var secondProperty = new Property
        {
            Id = secondPropertyId,
            TenantId = fixture.TenantId,
            Name = "Khách Sạn Biển Đông - Chi Nhánh 2",
            Code = "BD02",
            Slug = "chi-nhanh-bien-dong-2",
            Address = "12 Trường Sa",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            IsPublished = true,
            CheckInTime = new TimeOnly(15, 0),
            CheckOutTime = new TimeOnly(11, 0)
        };
        var secondRoomType = new RoomType
        {
            Id = secondRoomTypeId,
            TenantId = fixture.TenantId,
            PropertyId = secondPropertyId,
            Name = "Standard Twin - Chi Nhánh 2",
            Code = "ST02",
            BasePrice = 700_000m,
            MaxOccupancy = 3,
            BedType = null,
            SquareMeters = null,
            ImageUrl = null
        };
        var inactiveProperty = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            Name = "Cơ sở tạm ngưng",
            Code = "INACTIVE",
            Slug = "co-so-tam-ngung-public-test",
            Address = "Đà Nẵng",
            City = "Da Nang",
            Status = PropertyStatus.Inactive
        };

        ctx.Properties.AddRange(secondProperty, inactiveProperty);
        ctx.RoomTypes.Add(secondRoomType);
        await ctx.SaveChangesAsync();

        // 1. Get properties
        var propHandler = new GetPublicPropertiesQueryHandler(ctx);
        var properties = await propHandler.Handle(new GetPublicPropertiesQuery(), CancellationToken.None);
        Assert.NotEmpty(properties);
        Assert.Contains(properties, p => p.Slug == fixture.PropertySlug);

        // 2. Get property by slug
        var slugHandler = new GetPublicPropertyBySlugQueryHandler(ctx);
        var property = await slugHandler.Handle(new GetPublicPropertyBySlugQuery(fixture.PropertySlug), CancellationToken.None);
        Assert.NotNull(property);
        Assert.Equal(fixture.PropertySlug, property.Slug);
        Assert.Equal("Khách Sạn Biển Đông - Chi Nhánh 1", property.Name);

        var propertyB = await slugHandler.Handle(new GetPublicPropertyBySlugQuery(secondProperty.Slug), CancellationToken.None);
        Assert.Equal(secondProperty.Name, propertyB.Name);
        await Assert.ThrowsAsync<NotFoundException>(() => slugHandler.Handle(
            new GetPublicPropertyBySlugQuery(inactiveProperty.Slug), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => slugHandler.Handle(
            new GetPublicPropertyBySlugQuery("khong-ton-tai-public-test"), CancellationToken.None));

        // 3. Get room types
        var rtHandler = new GetPublicRoomTypesQueryHandler(ctx);
        var roomTypes = await rtHandler.Handle(new GetPublicRoomTypesQuery(fixture.PropertySlug), CancellationToken.None);
        Assert.Single(roomTypes);
        Assert.Equal("Deluxe Ocean View", roomTypes[0].Name);
        Assert.Equal(fixture.PropertyId, roomTypes[0].PropertyId);

        var roomTypesB = await rtHandler.Handle(new GetPublicRoomTypesQuery(secondProperty.Slug), CancellationToken.None);
        Assert.Single(roomTypesB);
        Assert.Equal(secondRoomTypeId, roomTypesB[0].Id);
        Assert.Equal(secondPropertyId, roomTypesB[0].PropertyId);
        Assert.Equal("Standard Twin - Chi Nhánh 2", roomTypesB[0].Name);
        Assert.Null(roomTypesB[0].BedType);
        Assert.Null(roomTypesB[0].SquareMeters);
        Assert.Null(roomTypesB[0].ImageUrl);
        await Assert.ThrowsAsync<NotFoundException>(() => rtHandler.Handle(
            new GetPublicRoomTypesQuery(inactiveProperty.Slug), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => rtHandler.Handle(
            new GetPublicRoomTypesQuery("khong-ton-tai-public-test"), CancellationToken.None));

        // 4. Get availability
        var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);
        var pc = new PricingCalculator(ctx);
        var availHandler = new GetPublicAvailabilityQueryHandler(ctx, pc);
        var avail = await availHandler.Handle(new GetPublicAvailabilityQuery(
            fixture.PropertySlug,
            RentalType.Overnight,
            startUtc,
            endUtc,
            new DateOnly(2026, 10, 15),
            new DateOnly(2026, 10, 16)
        ), CancellationToken.None);

        Assert.Single(avail);
        Assert.Equal(2, avail[0].TotalRooms);
        Assert.Equal(2, avail[0].AvailableRooms);
        Assert.True(avail[0].IsAvailable);
    }
}
