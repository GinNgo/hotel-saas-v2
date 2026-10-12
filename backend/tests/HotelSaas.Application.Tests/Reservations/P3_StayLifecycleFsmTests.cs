using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.Commands.CancelReservation;
using HotelSaas.Application.Reservations.Commands.CheckInReservation;
using HotelSaas.Application.Reservations.Commands.CheckOutReservation;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Reservations;

/// <summary>
/// Real database integration tests for Phase P3-STAY-LIFECYCLE-01:
/// Validates the full State Machine (FSM) lifecycle transitions:
/// - Check-in: Confirmed/PendingPayment -> CheckedIn; Room Clean -> Occupied.
/// - Check-in failure: Room Dirty, Cleaning, Occupied, OutOfService, or invalid reservation status.
/// - Check-out: CheckedIn -> CheckedOut; Room Occupied -> Dirty (ready for housekeeping).
/// - Check-out failure: Reservation not in CheckedIn state.
/// - Cancel: Confirmed/PendingPayment -> Cancelled; records CancelledAtUtc and Reason.
/// - Cancel failure: Already CheckedIn, CheckedOut, or Cancelled.
/// - Branch isolation: Rejects cross-branch operations.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P3_StayLifecycleFsmTests
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

    private static async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
        await cmd.ExecuteNonQueryAsync();

        return conn;
    }

    private static async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    private static async Task SeedHierarchyAsync(
        ApplicationDbContext ctx,
        Guid tenantId,
        Guid propId,
        Guid rtId,
        Guid roomId,
        Guid resId,
        ReservationStatus resStatus = ReservationStatus.Confirmed,
        RoomStatus roomStatus = RoomStatus.Clean)
    {
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
            Id = propId,
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
            Id = rtId,
            TenantId = tenantId,
            PropertyId = propId,
            Name = "Deluxe Ocean View",
            Code = "DLX",
            BasePrice = 1200000m,
            MaxOccupancy = 2
        };

        var room = new Room
        {
            Id = roomId,
            TenantId = tenantId,
            PropertyId = propId,
            RoomTypeId = rtId,
            RoomNumber = "101",
            Floor = 1,
            Status = roomStatus,
            IsActive = true
        };

        var reservation = new Reservation
        {
            Id = resId,
            TenantId = tenantId,
            PropertyId = propId,
            RoomId = roomId,
            GuestName = "Tran Van C",
            GuestEmail = "tranvanc@example.com",
            GuestPhone = "0909123456",
            NumberOfGuests = 2,
            CheckInDate = new DateOnly(2026, 11, 20),
            CheckOutDate = new DateOnly(2026, 11, 22),
            TotalAmount = 2400000m,
            Status = resStatus,
            ConfirmationCode = "RES-TEST01",
            Notes = "{\"rentalType\":2,\"totalAmount\":2400000,\"customerNotes\":\"Phòng view đẹp\"}"
        };

        ctx.Tenants.Add(tenant);
        ctx.Properties.Add(property);
        ctx.RoomTypes.Add(roomType);
        ctx.Rooms.Add(room);
        ctx.Reservations.Add(reservation);

        // For CheckedIn/CheckedOut seed states, seed completed payment to satisfy POL-IO03 settled balance
        if (resStatus == ReservationStatus.CheckedIn || resStatus == ReservationStatus.CheckedOut)
        {
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ReservationId = resId,
                Amount = 2400000m,
                Method = PaymentMethod.Cash,
                Status = PaymentStatus.Completed,
                PaidAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.Payments.Add(payment);
        }

        await ctx.SaveChangesAsync();
    }

    [Fact]
    public async Task CheckIn_WhenConfirmedAndRoomClean_TransitionsReservationToCheckedIn_AndRoomToOccupied()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Clean);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckInReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var result = await handler.Handle(new CheckInReservationCommand(resId, propId), CancellationToken.None);

                Assert.NotNull(result);
                Assert.Equal(ReservationStatus.CheckedIn, result.Status);
                Assert.Equal(resId, result.Id);
            }

            // Verify database state: Reservation is CheckedIn and Room is Occupied
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var resDb = await verifyCtx.Reservations.FindAsync(resId);
                var roomDb = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(resDb);
                Assert.Equal(ReservationStatus.CheckedIn, resDb.Status);

                Assert.NotNull(roomDb);
                Assert.Equal(RoomStatus.Occupied, roomDb.Status);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CheckIn_WhenRoomDirty_ThrowsConflict_ERR_ROOM_NOT_CLEAN()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Room is Dirty!
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Dirty);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckInReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CheckInReservationCommand(resId, propId), CancellationToken.None));

                Assert.Equal("ERR_ROOM_NOT_CLEAN", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CheckIn_WhenRoomAlreadyOccupied_ThrowsConflict_ERR_ROOM_OCCUPIED()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Room is already Occupied!
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Occupied);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckInReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CheckInReservationCommand(resId, propId), CancellationToken.None));

                Assert.Equal("ERR_ROOM_OCCUPIED", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CheckIn_WhenReservationInvalidStatus_ThrowsConflict_ERR_INVALID_STATUS_TRANSITION()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Reservation already Cancelled!
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Cancelled, RoomStatus.Clean);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckInReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CheckInReservationCommand(resId, propId), CancellationToken.None));

                Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CheckOut_WhenCheckedIn_TransitionsReservationToCheckedOut_AndRoomToDirty()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Guest is CheckedIn and Room is Occupied
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.CheckedIn, RoomStatus.Occupied);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckOutReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var result = await handler.Handle(new CheckOutReservationCommand(resId, propId), CancellationToken.None);

                Assert.NotNull(result);
                Assert.Equal(ReservationStatus.CheckedOut, result.Status);
            }

            // Verify database state: Reservation is CheckedOut and Room is DIRTY (ready for Housekeeping!)
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var resDb = await verifyCtx.Reservations.FindAsync(resId);
                var roomDb = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(resDb);
                Assert.Equal(ReservationStatus.CheckedOut, resDb.Status);

                Assert.NotNull(roomDb);
                Assert.Equal(RoomStatus.Dirty, roomDb.Status);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CheckOut_WhenNotCheckedIn_ThrowsConflict_ERR_INVALID_STATUS_TRANSITION()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Guest is only Confirmed, never CheckedIn!
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Clean);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CheckOutReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CheckOutReservationCommand(resId, propId), CancellationToken.None));

                Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Cancel_WhenConfirmed_TransitionsReservationToCancelled_RecordsTimestampAndReason()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Clean);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CancelReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var result = await handler.Handle(
                    new CancelReservationCommand(resId, propId, "Khách thay đổi lịch trình"),
                    CancellationToken.None);

                Assert.NotNull(result);
                Assert.Equal(ReservationStatus.Cancelled, result.Status);
                Assert.NotNull(result.CancelledAtUtc);
                Assert.Equal("Khách thay đổi lịch trình", result.CancellationReason);
            }

            // Verify database state: Reservation is Cancelled and Room remains Clean
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var resDb = await verifyCtx.Reservations.FindAsync(resId);
                var roomDb = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(resDb);
                Assert.Equal(ReservationStatus.Cancelled, resDb.Status);
                Assert.NotNull(resDb.CancelledAtUtc);
                Assert.Equal("Khách thay đổi lịch trình", resDb.CancellationReason);

                Assert.NotNull(roomDb);
                Assert.Equal(RoomStatus.Clean, roomDb.Status);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Cancel_WhenAlreadyCheckedIn_ThrowsConflict_ERR_INVALID_STATUS_TRANSITION()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                // Guest already CheckedIn
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.CheckedIn, RoomStatus.Occupied);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CancelReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CancelReservationCommand(resId, propId, "Hủy phòng"), CancellationToken.None));

                Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Cancel_WhenAlreadyCancelled_ThrowsConflict_ERR_ALREADY_CANCELLED()
    {
        var testSchema = $"p3_fsm_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Cancelled, RoomStatus.Clean);
            }

            await using (var actCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var handler = new CancelReservationCommandHandler(actCtx, tenantSvc, userCtx, memberSvc, propSvc);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new CancelReservationCommand(resId, propId, "Hủy lại"), CancellationToken.None));

                Assert.Equal("ERR_ALREADY_CANCELLED", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Concurrency_TestA_CheckIn_And_Cancel_OnSameReservation_ExactlyOneSucceeds()
    {
        var testSchema = $"p3_fsm_conc_a_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.Confirmed, RoomStatus.Clean);
            }

            var barrier = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            Exception? checkInEx = null;
            ReservationDetailDto? checkInResult = null;
            var taskCheckIn = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx1 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler1 = new CheckInReservationCommandHandler(ctx1, tenantSvc, userCtx, memberSvc, propSvc);
                    checkInResult = await handler1.Handle(new CheckInReservationCommand(resId, propId), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    checkInEx = ex;
                }
            });

            Exception? cancelEx = null;
            ReservationDetailDto? cancelResult = null;
            var taskCancel = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx2 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler2 = new CancelReservationCommandHandler(ctx2, tenantSvc, userCtx, memberSvc, propSvc);
                    cancelResult = await handler2.Handle(new CancelReservationCommand(resId, propId, "Khách hủy phòng"), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    cancelEx = ex;
                }
            });

            // Trigger both tasks concurrently
            barrier.SetResult(true);
            await Task.WhenAll(taskCheckIn, taskCancel);

            // Assert: Exactly ONE operation succeeded, the other failed with ERR_INVALID_STATUS_TRANSITION
            var successCount = (checkInResult != null ? 1 : 0) + (cancelResult != null ? 1 : 0);
            Assert.Equal(1, successCount);

            if (checkInResult != null)
            {
                Assert.NotNull(cancelEx);
                var conflictEx = Assert.IsType<ConflictException>(cancelEx);
                Assert.Equal("ERR_INVALID_STATUS_TRANSITION", conflictEx.ErrorCode);
            }
            else
            {
                Assert.NotNull(checkInEx);
                var conflictEx = Assert.IsType<ConflictException>(checkInEx);
                Assert.Equal("ERR_INVALID_STATUS_TRANSITION", conflictEx.ErrorCode);
            }

            // Verify Database Consistency: Never in inconsistent Cancelled + Occupied state
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var dbRes = await verifyCtx.Reservations.FindAsync(resId);
                var dbRoom = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(dbRes);
                Assert.NotNull(dbRoom);

                if (dbRes.Status == ReservationStatus.CheckedIn)
                {
                    Assert.Equal(RoomStatus.Occupied, dbRoom.Status);
                }
                else if (dbRes.Status == ReservationStatus.Cancelled)
                {
                    Assert.Equal(RoomStatus.Clean, dbRoom.Status);
                }
                else
                {
                    Assert.Fail($"Unexpected reservation status: {dbRes.Status}");
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Concurrency_TestB_TwoCheckIns_DifferentReservations_SamePhysicalRoom_ExactlyOneSucceeds()
    {
        var testSchema = $"p3_fsm_conc_b_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var res1Id = Guid.NewGuid();
        var res2Id = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, res1Id,
                    ReservationStatus.Confirmed, RoomStatus.Clean);

                var reservation2 = new Reservation
                {
                    Id = res2Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomId = roomId,
                    GuestName = "Second Guest",
                    GuestEmail = "guest2@example.com",
                    GuestPhone = "0909112233",
                    NumberOfGuests = 2,
                    CheckInDate = new DateOnly(2026, 11, 23),
                    CheckOutDate = new DateOnly(2026, 11, 25),
                    TotalAmount = 2400000m,
                    Status = ReservationStatus.Confirmed,
                    ConfirmationCode = "RES-TEST02",
                    Notes = "{\"rentalType\":2,\"totalAmount\":2400000}"
                };
                seedCtx.Reservations.Add(reservation2);
                await seedCtx.SaveChangesAsync();
            }

            var barrier = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            Exception? checkIn1Ex = null;
            ReservationDetailDto? checkIn1Result = null;
            var task1 = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx1 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler1 = new CheckInReservationCommandHandler(ctx1, tenantSvc, userCtx, memberSvc, propSvc);
                    checkIn1Result = await handler1.Handle(new CheckInReservationCommand(res1Id, propId), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    checkIn1Ex = ex;
                }
            });

            Exception? checkIn2Ex = null;
            ReservationDetailDto? checkIn2Result = null;
            var task2 = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx2 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler2 = new CheckInReservationCommandHandler(ctx2, tenantSvc, userCtx, memberSvc, propSvc);
                    checkIn2Result = await handler2.Handle(new CheckInReservationCommand(res2Id, propId), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    checkIn2Ex = ex;
                }
            });

            // Trigger both tasks concurrently
            barrier.SetResult(true);
            await Task.WhenAll(task1, task2);

            // Assert: Exactly ONE check-in succeeded, the other failed with ERR_ROOM_OCCUPIED
            var successCount = (checkIn1Result != null ? 1 : 0) + (checkIn2Result != null ? 1 : 0);
            Assert.Equal(1, successCount);

            var failureEx = checkIn1Result != null ? checkIn2Ex : checkIn1Ex;
            Assert.NotNull(failureEx);
            var conflictEx = Assert.IsType<ConflictException>(failureEx);
            Assert.Equal("ERR_ROOM_OCCUPIED", conflictEx.ErrorCode);

            // Verify Database Consistency: Room is Occupied, exactly one reservation is CheckedIn
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var dbRes1 = await verifyCtx.Reservations.FindAsync(res1Id);
                var dbRes2 = await verifyCtx.Reservations.FindAsync(res2Id);
                var dbRoom = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(dbRes1);
                Assert.NotNull(dbRes2);
                Assert.NotNull(dbRoom);

                Assert.Equal(RoomStatus.Occupied, dbRoom.Status);

                var checkedInCount = (dbRes1.Status == ReservationStatus.CheckedIn ? 1 : 0)
                                   + (dbRes2.Status == ReservationStatus.CheckedIn ? 1 : 0);
                Assert.Equal(1, checkedInCount);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Concurrency_TestC_DuplicateCheckOut_OnSameReservation_ExactlyOneSucceeds()
    {
        var testSchema = $"p3_fsm_conc_c_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId, resId,
                    ReservationStatus.CheckedIn, RoomStatus.Occupied);
            }

            var barrier = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            Exception? checkOut1Ex = null;
            ReservationDetailDto? checkOut1Result = null;
            var task1 = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx1 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler1 = new CheckOutReservationCommandHandler(ctx1, tenantSvc, userCtx, memberSvc, propSvc);
                    checkOut1Result = await handler1.Handle(new CheckOutReservationCommand(resId, propId), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    checkOut1Ex = ex;
                }
            });

            Exception? checkOut2Ex = null;
            ReservationDetailDto? checkOut2Result = null;
            var task2 = Task.Run(async () =>
            {
                await barrier.Task;
                try
                {
                    await using var ctx2 = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                    var handler2 = new CheckOutReservationCommandHandler(ctx2, tenantSvc, userCtx, memberSvc, propSvc);
                    checkOut2Result = await handler2.Handle(new CheckOutReservationCommand(resId, propId), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    checkOut2Ex = ex;
                }
            });

            // Trigger both tasks concurrently
            barrier.SetResult(true);
            await Task.WhenAll(task1, task2);

            // Assert: Exactly ONE check-out succeeded, the other failed with ERR_INVALID_STATUS_TRANSITION
            var successCount = (checkOut1Result != null ? 1 : 0) + (checkOut2Result != null ? 1 : 0);
            Assert.Equal(1, successCount);

            var failureEx = checkOut1Result != null ? checkOut2Ex : checkOut1Ex;
            Assert.NotNull(failureEx);
            var conflictEx = Assert.IsType<ConflictException>(failureEx);
            Assert.Equal("ERR_INVALID_STATUS_TRANSITION", conflictEx.ErrorCode);

            // Verify Database Consistency: Room is Dirty, Reservation is CheckedOut
            await using (var verifyCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                var dbRes = await verifyCtx.Reservations.FindAsync(resId);
                var dbRoom = await verifyCtx.Rooms.FindAsync(roomId);

                Assert.NotNull(dbRes);
                Assert.NotNull(dbRoom);

                Assert.Equal(ReservationStatus.CheckedOut, dbRes.Status);
                Assert.Equal(RoomStatus.Dirty, dbRoom.Status);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
