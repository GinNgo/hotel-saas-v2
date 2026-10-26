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
using HotelSaas.Application.Public.Services;
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
    public async Task PublicDiscovery_Queries_ReturnActivePropertiesAndRoomTypes()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

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

        // 3. Get room types
        var rtHandler = new GetPublicRoomTypesQueryHandler(ctx);
        var roomTypes = await rtHandler.Handle(new GetPublicRoomTypesQuery(fixture.PropertySlug), CancellationToken.None);
        Assert.Single(roomTypes);
        Assert.Equal("Deluxe Ocean View", roomTypes[0].Name);

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

    // =========================================================================
    // T04 REGRESSION TESTS: GUEST BOOKING LOOKUP CAPABILITY & DATA INTEGRITY
    // =========================================================================

    [Fact]
    public async Task GetGuestBookingByToken_T04_RejectsInvalidEmptyRevokedOrExpiredTokens()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();
        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // 1. Empty and whitespace tokens reject with BadRequestException (ERR_INVALID_TOKEN)
        var exNullOrEmpty = await Assert.ThrowsAsync<BadRequestException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(string.Empty), CancellationToken.None));
        Assert.Equal("ERR_INVALID_TOKEN", exNullOrEmpty.ErrorCode);

        var exWhitespace = await Assert.ThrowsAsync<BadRequestException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery("    "), CancellationToken.None));
        Assert.Equal("ERR_INVALID_TOKEN", exWhitespace.ErrorCode);

        // 2. Non-existent token rejects with NotFoundException
        await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery("non_existent_token_0123456789abcdef"), CancellationToken.None));

        // 3. Revoked token fails-closed with NotFoundException
        var revokedToken = "tok_revoked_0123456789abcdef";
        var snapRevoked = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow,
            EndAtUtc = DateTime.UtcNow.AddDays(1),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            LookupToken = revokedToken,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            IsTokenRevoked = true // REVOKED!
        };
        var resRevoked = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Revoked Guest",
            GuestEmail = "revoked@example.com",
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapRevoked),
            ConfirmationCode = "RES-T04-REV"
        };
        ctx.Reservations.Add(resRevoked);

        // 4. Token with expired TTL fails-closed with NotFoundException
        var expiredTtlToken = "tok_expired_ttl_0123456789abcdef";
        var snapExpiredTtl = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(-10),
            EndAtUtc = DateTime.UtcNow.AddDays(-9),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            LookupToken = expiredTtlToken,
            TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5), // EXPIRED TTL!
            IsTokenRevoked = false
        };
        var resExpiredTtl = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId2,
            GuestName = "Expired TTL Guest",
            GuestEmail = "expiredttl@example.com",
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapExpiredTtl),
            ConfirmationCode = "RES-T04-EXPTTL"
        };
        ctx.Reservations.Add(resExpiredTtl);

        // 5. Token without TTL fails-closed with NotFoundException
        var missingTtlToken = "tok_missing_ttl_0123456789abcdef";
        var snapMissingTtl = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow,
            EndAtUtc = DateTime.UtcNow.AddDays(1),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            LookupToken = missingTtlToken,
            TokenExpiresAtUtc = null, // MISSING TTL!
            IsTokenRevoked = false
        };
        var resMissingTtl = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Missing TTL Guest",
            GuestEmail = "missingttl@example.com",
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapMissingTtl),
            ConfirmationCode = "RES-T04-NOTTL"
        };
        ctx.Reservations.Add(resMissingTtl);
        await ctx.SaveChangesAsync();

        var exRevoked = await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(revokedToken), CancellationToken.None));
        Assert.Contains("thu hồi", exRevoked.Message);

        var exExpiredTtl = await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(expiredTtlToken), CancellationToken.None));
        Assert.Contains("hết hạn", exExpiredTtl.Message);

        var exMissingTtl = await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(missingTtlToken), CancellationToken.None));
        Assert.Contains("hết hạn", exMissingTtl.Message);
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_TokenA_ReturnsOnlyBookingA_DoesNotLeakBookingB()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var tokenA = "tok_reservation_a_1234567890abcdef";
        var tokenB = "tok_reservation_b_0987654321fedcba";

        var snapA = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_200_000m,
            LookupToken = tokenA,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 360_000m
        };
        var resA = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Alice Nguyen",
            GuestEmail = "alice@example.com",
            GuestPhone = "0901111111",
            TotalAmount = 1_200_000m,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snapA),
            ConfirmationCode = "CONF-T04-AAA",
            CheckInDate = new DateOnly(2026, 11, 1),
            CheckOutDate = new DateOnly(2026, 11, 2),
            NumberOfGuests = 1
        };

        var snapB = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(3),
            EndAtUtc = DateTime.UtcNow.AddDays(4),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 2_500_000m,
            LookupToken = tokenB,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 750_000m
        };
        var resB = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId2,
            GuestName = "Bob Tran",
            GuestEmail = "bob@example.com",
            GuestPhone = "0902222222",
            TotalAmount = 2_500_000m,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snapB),
            ConfirmationCode = "CONF-T04-BBB",
            CheckInDate = new DateOnly(2026, 11, 3),
            CheckOutDate = new DateOnly(2026, 11, 4),
            NumberOfGuests = 2
        };

        ctx.Reservations.AddRange(resA, resB);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // 1. Querying with Token A returns ONLY Booking A
        var detailA = await queryHandler.Handle(new GetGuestBookingByTokenQuery(tokenA), CancellationToken.None);
        Assert.NotNull(detailA);
        Assert.Equal(resA.Id, detailA.ReservationId);
        Assert.Equal("CONF-T04-AAA", detailA.ConfirmationCode);
        Assert.Equal(tokenA, detailA.LookupToken);
        Assert.Equal(1_200_000m, detailA.TotalAmount);
        Assert.Equal(360_000m, detailA.DepositRequired);
        Assert.Equal(1, detailA.NumberOfGuests);
        Assert.NotEqual(resB.Id, detailA.ReservationId);
        Assert.NotEqual("CONF-T04-BBB", detailA.ConfirmationCode);

        // 2. Querying with Token B returns ONLY Booking B
        var detailB = await queryHandler.Handle(new GetGuestBookingByTokenQuery(tokenB), CancellationToken.None);
        Assert.NotNull(detailB);
        Assert.Equal(resB.Id, detailB.ReservationId);
        Assert.Equal("CONF-T04-BBB", detailB.ConfirmationCode);
        Assert.Equal(tokenB, detailB.LookupToken);
        Assert.Equal(2_500_000m, detailB.TotalAmount);
        Assert.Equal(750_000m, detailB.DepositRequired);
        Assert.Equal(2, detailB.NumberOfGuests);
        Assert.NotEqual(resA.Id, detailB.ReservationId);
        Assert.NotEqual("CONF-T04-AAA", detailB.ConfirmationCode);
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_RelatedData_StrictlyBelongsToPermittedReservationAndProperty()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctxA = fixture.CreateDbContext();

        var tokenA = "tok_prop_a_reservation_123456789";
        var snapA = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_500_000m,
            LookupToken = tokenA,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 450_000m
        };
        var resA = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Khách A",
            GuestEmail = "khach.a@example.com",
            TotalAmount = 1_500_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapA),
            ConfirmationCode = "CONF-PROP-A"
        };
        var payA = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resA.Id,
            Amount = 450_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-A-001"
        };
        ctxA.Reservations.Add(resA);
        ctxA.Payments.Add(payA);
        await ctxA.SaveChangesAsync();

        // Seed second property in same test schema using Property B scoped context
        var propertyB = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            Name = "Khách Sạn Sơn Trà Luxury",
            Code = "ST02",
            Slug = "khach-san-son-tra-luxury",
            Address = "88 Vo Van Kiet, Da Nang",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };
        var roomTypeB = new RoomType
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = propertyB.Id,
            Name = "Executive Suite",
            Code = "EXE",
            BasePrice = 3_000_000m,
            MaxOccupancy = 4
        };
        var roomB = new Room
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = propertyB.Id,
            RoomTypeId = roomTypeB.Id,
            RoomNumber = "201",
            Floor = 2,
            Status = RoomStatus.Clean,
            IsActive = true
        };

        var propBSvc = new MockPropertyService { PropertyId = propertyB.Id, HeaderPropertyId = propertyB.Id, TokenPropertyId = propertyB.Id, IsTenantWide = true };
        await using var ctxB = fixture.CreateDbContext(propSvc: propBSvc);

        ctxB.Properties.Add(propertyB);
        ctxB.RoomTypes.Add(roomTypeB);
        ctxB.Rooms.Add(roomB);

        var tokenB = "tok_prop_b_reservation_987654321";
        var snapB = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(5),
            EndAtUtc = DateTime.UtcNow.AddDays(6),
            RoomTypeId = roomTypeB.Id,
            RoomTypeName = "Executive Suite",
            TotalAmount = 3_000_000m,
            LookupToken = tokenB,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 900_000m
        };
        var resB = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = propertyB.Id,
            RoomId = roomB.Id,
            GuestName = "Khách B",
            GuestEmail = "khach.b@example.com",
            TotalAmount = 3_000_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapB),
            ConfirmationCode = "CONF-PROP-B"
        };
        var payB = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = propertyB.Id,
            ReservationId = resB.Id,
            Amount = 900_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-B-001"
        };
        ctxB.Reservations.Add(resB);
        ctxB.Payments.Add(payB);
        await ctxB.SaveChangesAsync();

        // Guest token lookup is public and unauthenticated
        var publicGuestTenantSvc = new MockTenantService { TenantId = null };
        var publicGuestPropSvc = new MockPropertyService { PropertyId = null, HeaderPropertyId = null, TokenPropertyId = null };
        await using var publicCtx = fixture.CreateDbContext(publicGuestTenantSvc, publicGuestPropSvc);
        var queryHandler = new GetGuestBookingByTokenQueryHandler(publicCtx);

        // Verify A
        var detailA = await queryHandler.Handle(new GetGuestBookingByTokenQuery(tokenA), CancellationToken.None);
        Assert.Equal(fixture.PropertyId, detailA.PropertyId);
        Assert.Equal("Khách Sạn Biển Đông - Chi Nhánh 1", detailA.PropertyName);
        Assert.Equal("200 Vo Nguyen Giap", detailA.PropertyAddress);
        Assert.Equal("Deluxe Ocean View", detailA.RoomTypeName);
        Assert.Equal(450_000m, detailA.PaidAmount); // strictly A's payment!
        Assert.Equal(1_050_000m, detailA.RemainingBalance);
        Assert.False(detailA.IsFullyPaid);

        // Verify B
        var detailB = await queryHandler.Handle(new GetGuestBookingByTokenQuery(tokenB), CancellationToken.None);
        Assert.Equal(propertyB.Id, detailB.PropertyId);
        Assert.Equal("Khách Sạn Sơn Trà Luxury", detailB.PropertyName);
        Assert.Equal("88 Vo Van Kiet, Da Nang", detailB.PropertyAddress);
        Assert.Equal("Executive Suite", detailB.RoomTypeName);
        Assert.Equal(900_000m, detailB.PaidAmount); // strictly B's payment!
        Assert.Equal(2_100_000m, detailB.RemainingBalance);
        Assert.False(detailB.IsFullyPaid);
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_PIIMasking_DoesNotExposeFullNameEmailOrPhone()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_pii_masking_verify_123456789";
        var rawName = "Trần Trọng Tân";
        var rawEmail = "trongtan.hotel@gmail.com";
        var rawPhone = "0987654321";

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            LookupToken = token,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 300_000m
        };
        var res = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = rawName,
            GuestEmail = rawEmail,
            GuestPhone = rawPhone,
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snap),
            ConfirmationCode = "CONF-PII-01"
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None);

        // 1. Name masking: Full name and middle name are masked
        Assert.NotEqual(rawName, detail.MaskedGuestName);
        Assert.DoesNotContain("Trọng", detail.MaskedGuestName);
        Assert.Contains("***", detail.MaskedGuestName);

        // 2. Email masking: Username is partially redacted, domain retained
        Assert.NotEqual(rawEmail, detail.MaskedGuestEmail);
        Assert.DoesNotContain("trongtan", detail.MaskedGuestEmail);
        Assert.Contains("***", detail.MaskedGuestEmail);
        Assert.EndsWith("@gmail.com", detail.MaskedGuestEmail);

        // 3. Phone masking: Middle 4 digits redacted
        Assert.NotEqual(rawPhone, detail.MaskedGuestPhone);
        Assert.Contains("****", detail.MaskedGuestPhone);
        Assert.StartsWith("098", detail.MaskedGuestPhone);
        Assert.EndsWith("321", detail.MaskedGuestPhone);

        // 4. Contract validation: DTO does not expose raw guest fields
        var dtoProps = typeof(GuestBookingDetailDto).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("GuestName", dtoProps);
        Assert.DoesNotContain("GuestEmail", dtoProps);
        Assert.DoesNotContain("GuestPhone", dtoProps);
    }

    [Theory]
    [InlineData(ReservationStatus.Confirmed, "Active", "123456", false, true, "123456", "Active", "Confirmed")]
    [InlineData(ReservationStatus.CheckedIn, "Active", "654321", false, true, "654321", "Active", "CheckedIn")]
    [InlineData(ReservationStatus.Cancelled, "Revoked", "999111", false, false, null, "Revoked", "Cancelled")]
    [InlineData(ReservationStatus.CheckedOut, "Expired", "999222", false, false, null, "Expired", "CheckedOut")]
    [InlineData(ReservationStatus.PendingPayment, "Inactive", "999333", false, false, null, "Inactive", "PendingPayment")]
    [InlineData(ReservationStatus.PendingPayment, "Inactive", "999444", true, false, null, "Inactive", "Expired")]
    [InlineData(ReservationStatus.Confirmed, "Inactive", "999555", false, false, null, "Inactive", "Confirmed")]
    [InlineData(ReservationStatus.Confirmed, "Revoked", "999666", false, false, null, "Revoked", "Confirmed")]
    [InlineData(ReservationStatus.CheckedIn, "Expired", "999777", false, false, null, "Expired", "CheckedIn")]
    [InlineData(ReservationStatus.Confirmed, null, "999888", false, false, null, null, "Confirmed")]
    [InlineData(ReservationStatus.Confirmed, "Active", null, false, false, null, "Active", "Confirmed")]
    public async Task GetGuestBookingByToken_T04_SmartLockPin_EnforcesDisclosabilityPolicy(
        ReservationStatus status,
        string? lockStatus,
        string? pinInDb,
        bool isHoldExpired,
        bool expectPinReturned,
        string? expectedPin,
        string? expectedLockStatus,
        string expectedStatusDisplay)
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var token = $"tok_pin_{Guid.NewGuid():N}";
        var holdExpiresAt = isHoldExpired ? DateTime.UtcNow.AddMinutes(-10) : DateTime.UtcNow.AddMinutes(15);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_000_000m,
            HoldExpiresAtUtc = holdExpiresAt,
            LookupToken = token,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 300_000m,
            IsOnlineHold = true
        };

        var res = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "PIN Policy Guest",
            GuestEmail = "pin.policy@example.com",
            TotalAmount = 1_000_000m,
            Status = status,
            SmartLockPin = pinInDb,
            SmartLockStatus = lockStatus,
            SmartLockActivatedAtUtc = lockStatus == "Active" ? DateTime.UtcNow : null,
            Notes = ReservationSnapshotHelper.Serialize(snap),
            ConfirmationCode = $"RES-{Guid.NewGuid():N}"[..11].ToUpperInvariant()
        };

        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal(expectedStatusDisplay, detail.Status);
        Assert.Equal(expectedLockStatus, detail.SmartLockStatus);
        if (expectPinReturned)
        {
            Assert.Equal(expectedPin, detail.SmartLockPin);
        }
        else
        {
            Assert.Null(detail.SmartLockPin);
        }
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_PendingPayment_ExpiredHold_ReflectedAsExpired_WithoutLosingLookupRights()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_hold_expired_lookup_preserved_123";
        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(2),
            EndAtUtc = DateTime.UtcNow.AddDays(3),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_500_000m,
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-15), // Hold expired 15 mins ago!
            LookupToken = token,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),     // Token valid for 7 days!
            DepositRequired = 450_000m,
            IsOnlineHold = true
        };
        var res = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Preserved Lookup Guest",
            GuestEmail = "preserved@example.com",
            GuestPhone = "0901234567",
            TotalAmount = 1_500_000m,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snap),
            ConfirmationCode = "RES-T04-PRESERVED"
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // The query MUST SUCCEED (token lookup rights are NOT revoked when hold expires)
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal("Expired", detail.Status); // Reflected as Expired per contract
        Assert.Equal(0, detail.SecondsRemaining); // Countdown clamped to 0
        Assert.Equal("RES-T04-PRESERVED", detail.ConfirmationCode);
        Assert.Equal(1_500_000m, detail.TotalAmount);
        Assert.Equal(450_000m, detail.DepositRequired);

        // However, if the token's own TTL expired, lookup is revoked
        snap.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        res.Notes = ReservationSnapshotHelper.Serialize(snap);
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None));
        Assert.Contains("hết hạn", ex.Message);
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_PaidAmountAndBalance_BasedStrictlyOnCompletedPayments_IgnoresFailedOrPending()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_payment_ledger_audit_123456";
        var totalAmount = 2_000_000m;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(2),
            EndAtUtc = DateTime.UtcNow.AddDays(3),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = totalAmount,
            LookupToken = token,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 600_000m
        };
        var res = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Ledger Audit Guest",
            GuestEmail = "audit@example.com",
            TotalAmount = totalAmount,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snap),
            ConfirmationCode = "RES-T04-LEDGER"
        };
        ctx.Reservations.Add(res);

        // Seed 4 payments with varying statuses
        var completedPayment1 = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 500_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed, // VALID!
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-COMPLETED-1"
        };
        var pendingPayment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 300_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Pending, // IN-FLIGHT - MUST BE IGNORED!
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-PENDING"
        };
        var failedPayment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 400_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Failed, // FAILED - MUST BE IGNORED!
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-FAILED"
        };
        var refundedPayment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 200_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Refunded, // REFUNDED - MUST BE IGNORED!
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-REFUNDED"
        };

        ctx.Payments.AddRange(completedPayment1, pendingPayment, failedPayment, refundedPayment);
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // 1. Paid amount must only sum Completed payments (500,000 VND)
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None);
        Assert.Equal(500_000m, detail.PaidAmount);
        Assert.Equal(1_500_000m, detail.RemainingBalance);
        Assert.False(detail.IsFullyPaid);

        // 2. Add second completed payment of 1,500,000 VND -> fully settles reservation
        var completedPayment2 = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 1_500_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-COMPLETED-2"
        };
        ctx.Payments.Add(completedPayment2);
        await ctx.SaveChangesAsync();

        var settledDetail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token), CancellationToken.None);
        Assert.Equal(2_000_000m, settledDetail.PaidAmount);
        Assert.Equal(0m, settledDetail.RemainingBalance);
        Assert.True(settledDetail.IsFullyPaid);
    }

    [Fact]
    public async Task GetGuestBookingByToken_T04_IgnoreQueryFilters_ScopesStrictlyToTokenCapability_NoCrossTenantLeakage()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 2);
        await using var ctx1 = fixture.CreateDbContext();

        var token1 = "tok_tenant1_secret_capability_111111";
        var token2 = "tok_tenant2_secret_capability_222222";

        var snap1 = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean View",
            TotalAmount = 1_200_000m,
            LookupToken = token1,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 360_000m
        };
        var res1 = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            GuestName = "Tenant1 Guest",
            GuestEmail = "t1@example.com",
            TotalAmount = 1_200_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snap1),
            ConfirmationCode = "CONF-T1-01"
        };
        var pay1 = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res1.Id,
            Amount = 360_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-T1-PAY"
        };
        ctx1.Reservations.Add(res1);
        ctx1.Payments.Add(pay1);
        await ctx1.SaveChangesAsync();

        // Seed second tenant and property in the exact same database schema using Tenant 2 scoped context
        var tenant2Id = Guid.NewGuid();
        var prop2Id = Guid.NewGuid();
        var roomType2Id = Guid.NewGuid();
        var room2Id = Guid.NewGuid();

        var tenant2 = new Tenant
        {
            Id = tenant2Id,
            Name = "Khách Sạn An Hải Bắc",
            Code = "AHB",
            Slug = "ahb",
            Address = "50 Tran Hung Dao",
            City = "Da Nang",
            Status = TenantStatus.Active
        };
        var prop2 = new Property
        {
            Id = prop2Id,
            TenantId = tenant2Id,
            Name = "Khách Sạn An Hải Bắc - Chi Nhánh Cảng",
            Code = "AHB01",
            Slug = "ahb-cang",
            Address = "50 Tran Hung Dao, Da Nang",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };
        var rt2 = new RoomType
        {
            Id = roomType2Id,
            TenantId = tenant2Id,
            PropertyId = prop2Id,
            Name = "Superior Harbor View",
            Code = "SHV",
            BasePrice = 2_500_000m,
            MaxOccupancy = 2
        };
        var r2 = new Room
        {
            Id = room2Id,
            TenantId = tenant2Id,
            PropertyId = prop2Id,
            RoomTypeId = roomType2Id,
            RoomNumber = "301",
            Floor = 3,
            Status = RoomStatus.Clean,
            IsActive = true
        };

        var tenant2Svc = new MockTenantService { TenantId = tenant2Id };
        var prop2Svc = new MockPropertyService { PropertyId = prop2Id, HeaderPropertyId = prop2Id, TokenPropertyId = prop2Id, IsTenantWide = true };
        await using var ctx2 = fixture.CreateDbContext(tenantSvc: tenant2Svc, propSvc: prop2Svc);

        ctx2.Tenants.Add(tenant2);
        ctx2.Properties.Add(prop2);
        ctx2.RoomTypes.Add(rt2);
        ctx2.Rooms.Add(r2);

        var snap2 = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(3),
            EndAtUtc = DateTime.UtcNow.AddDays(4),
            RoomTypeId = roomType2Id,
            RoomTypeName = "Superior Harbor View",
            TotalAmount = 2_500_000m,
            LookupToken = token2,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            DepositRequired = 750_000m
        };
        var res2 = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenant2Id,
            PropertyId = prop2Id,
            RoomId = room2Id,
            GuestName = "Tenant2 Guest",
            GuestEmail = "t2@example.com",
            TotalAmount = 2_500_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snap2),
            ConfirmationCode = "CONF-T2-01"
        };
        var pay2 = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenant2Id,
            PropertyId = prop2Id,
            ReservationId = res2.Id,
            Amount = 750_000m,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            TransactionRef = "TX-T2-PAY"
        };
        ctx2.Reservations.Add(res2);
        ctx2.Payments.Add(pay2);
        await ctx2.SaveChangesAsync();

        // Simulate public guest query: unauthenticated context without tenant/property claims
        var publicGuestTenantSvc = new MockTenantService { TenantId = null };
        var publicGuestPropSvc = new MockPropertyService { PropertyId = null };
        await using var publicCtx = fixture.CreateDbContext(publicGuestTenantSvc, publicGuestPropSvc);
        var queryHandler = new GetGuestBookingByTokenQueryHandler(publicCtx);

        // 1. Querying with Token 1 (Tenant 1) ignores query filters but scopes strictly to Tenant 1
        var detail1 = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token1), CancellationToken.None);
        Assert.Equal(res1.Id, detail1.ReservationId);
        Assert.Equal(fixture.PropertyId, detail1.PropertyId);
        Assert.Equal("Khách Sạn Biển Đông - Chi Nhánh 1", detail1.PropertyName);
        Assert.Equal("200 Vo Nguyen Giap", detail1.PropertyAddress);
        Assert.Equal("Deluxe Ocean View", detail1.RoomTypeName);
        Assert.Equal(1_200_000m, detail1.TotalAmount);
        Assert.Equal(360_000m, detail1.PaidAmount);
        Assert.Equal(840_000m, detail1.RemainingBalance);
        Assert.NotEqual(res2.Id, detail1.ReservationId);
        Assert.NotEqual(prop2Id, detail1.PropertyId);
        Assert.NotEqual("Superior Harbor View", detail1.RoomTypeName);

        // 2. Querying with Token 2 (Tenant 2) ignores query filters but scopes strictly to Tenant 2
        var detail2 = await queryHandler.Handle(new GetGuestBookingByTokenQuery(token2), CancellationToken.None);
        Assert.Equal(res2.Id, detail2.ReservationId);
        Assert.Equal(prop2Id, detail2.PropertyId);
        Assert.Equal("Khách Sạn An Hải Bắc - Chi Nhánh Cảng", detail2.PropertyName);
        Assert.Equal("50 Tran Hung Dao, Da Nang", detail2.PropertyAddress);
        Assert.Equal("Superior Harbor View", detail2.RoomTypeName);
        Assert.Equal(2_500_000m, detail2.TotalAmount);
        Assert.Equal(750_000m, detail2.PaidAmount);
        Assert.Equal(1_750_000m, detail2.RemainingBalance);
        Assert.NotEqual(res1.Id, detail2.ReservationId);
        Assert.NotEqual(fixture.PropertyId, detail2.PropertyId);
        Assert.NotEqual("Deluxe Ocean View", detail2.RoomTypeName);
    }

    [Fact]
    public async Task GetGuestBookingByToken_SupportsConfirmationCodeLookup_AndStopsHoldTimerWhenConfirmed()
    {
        await using var fixture = await TestFixture.CreateAsync(this, roomCount: 1);
        var tenantSvc = new MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Daily,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(15),
            LookupToken = "tok-secret-uuid-code",
            DepositRequired = 300_000m,
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7)
        };

        var res = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId1,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            GuestName = "Tran Trong Tan",
            GuestEmail = "tan@example.com",
            GuestPhone = "0349994118",
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-FVC9ZK",
            SmartLockPin = "308077",
            SmartLockStatus = "Active",
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Add completed payment
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = res.Id,
            Amount = 1_000_000m,
            Method = PaymentMethod.Cash,
            Status = PaymentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();

        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);

        // 1. Lookup by ConfirmationCode (case-insensitive "res-fvc9zk")
        var detail = await queryHandler.Handle(new GetGuestBookingByTokenQuery("res-fvc9zk"), CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal(res.Id, detail.ReservationId);
        Assert.Equal("RES-FVC9ZK", detail.ConfirmationCode);
        Assert.Equal("tok-secret-uuid-code", detail.LookupToken);
        Assert.Equal("Confirmed", detail.Status);
        Assert.True(detail.IsFullyPaid);
        Assert.Equal(1_000_000m, detail.PaidAmount);
        Assert.Equal(0m, detail.RemainingBalance);

        // Authoritative hold timer MUST be null for Confirmed reservations (no 14:21 countdown!)
        Assert.Null(detail.HoldExpiresAtUtc);
        Assert.Null(detail.SecondsRemaining);

        // Smart lock PIN is accessible because Confirmed + Active
        Assert.Equal("308077", detail.SmartLockPin);
        Assert.Equal("Active", detail.SmartLockStatus);
    }
}
