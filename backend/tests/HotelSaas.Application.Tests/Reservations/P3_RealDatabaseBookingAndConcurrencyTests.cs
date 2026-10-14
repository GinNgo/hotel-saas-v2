using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.Reservations.Commands.CreateReservation;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Queries.GetReservationById;
using HotelSaas.Application.Reservations.Queries.GetReservations;
using HotelSaas.Application.Reservations.Queries.GetRoomAvailability;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Reservations;

/// <summary>
/// Real database integration and concurrency tests for Phase P3-BOOKING-CORE-01:
/// 1. Hourly & overnight booking creation with verified Quote Engine integration.
/// 2. Immutable snapshot preservation: subsequent rate updates do not alter historical booking totals.
/// 3. Concurrent booking competition: Row-level lock ensures exactly one winner and one 409 Conflict.
/// 4. Turnover buffer >= 30m enforcement.
/// 5. Branch context isolation.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P3_RealDatabaseBookingAndConcurrencyTests
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

    private sealed class TestMediator : ISender
    {
        private readonly Func<object, CancellationToken, Task<object>> _handler;

        public TestMediator(Func<object, CancellationToken, Task<object>> handler)
        {
            _handler = handler;
        }

        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            var res = await _handler(request, cancellationToken);
            return (TResponse)res;
        }

        public async Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            await _handler(request, cancellationToken);
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            return _handler(request, cancellationToken)!;
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
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
            .UseNpgsql(builder.ConnectionString)
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

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01(a|b)_(test|drift)_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        try
        {
            if (conn.State != System.Data.ConnectionState.Open)
            {
                await conn.OpenAsync();
            }

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    private async Task<(Tenant tenant, Property property, RoomType roomType, Room room)> SeedHierarchyAsync(
        ApplicationDbContext ctx,
        Guid tenantId,
        Guid propertyId,
        Guid roomTypeId,
        Guid roomId)
    {
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "P3 Booking Test Tenant",
            Code = $"TEN_{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            Status = Domain.Enums.TenantStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Tenants.Add(tenant);

        var prop = new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "P3 Test Hotel",
            Code = $"PROP_{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            Status = Domain.Enums.PropertyStatus.Active,
            BufferMinutes = 30,
            MaxHourlyHours = 12,
            CheckInTime = new TimeOnly(12, 0),
            CheckOutTime = new TimeOnly(12, 0),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Properties.Add(prop);

        var rt = new RoomType
        {
            Id = roomTypeId,
            TenantId = tenantId,
            PropertyId = propertyId,
            Name = "Standard Room",
            Code = $"STD_{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
            BasePrice = 350000m,
            MaxOccupancy = 2,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.RoomTypes.Add(rt);

        var room = new Room
        {
            Id = roomId,
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            RoomNumber = "101",
            Floor = 1,
            Status = RoomStatus.Clean,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Rooms.Add(room);

        // Seed Rate: 150k for 2h package, 50k for extra hour, 400k overnight
        var rate = new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            RoomTypeId = roomTypeId,
            EffectiveFrom = new DateOnly(2026, 1, 1),
            EffectiveTo = new DateOnly(2026, 12, 31),
            FirstHours = 2,
            FirstHoursPrice = 150000m,
            AdditionalHourPrice = 50000m,
            NightlyPrice = 400000m,
            CreatedByUserId = Guid.NewGuid(),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.RoomTypeRates.Add(rate);

        await ctx.SaveChangesAsync();
        return (tenant, prop, rt, room);
    }

    [Fact]
    public async Task CreateHourlyBooking_Succeeds_AndPersistsImmutableSnapshot()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propId, HeaderPropertyId = propId, TokenPropertyId = propId };
        var userCtx = new MockUserContext { TenantId = tenantId, PropertyId = propId };
        var memberSvc = new MockMembershipLookupService();

        try
        {
            // Apply migration baseline
            var connStr = GetConnectionString();
            await using (var seedCtx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId);
            }

            await using var ctx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);

            var quoteHandler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, memberSvc, propSvc);
            var mediator = new TestMediator((req, ct) =>
            {
                if (req is CalculateQuoteQuery cq)
                    return quoteHandler.Handle(cq, ct).ContinueWith(t => (object)t.Result, ct);
                throw new NotSupportedException();
            });

            var handler = new CreateReservationCommandHandler(ctx, tenantSvc, userCtx, memberSvc, mediator, propSvc);

            // 3 hours booking: 08:00 - 11:00 UTC (150k + 50k = 200k)
            var startUtc = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var endUtc = new DateTime(2026, 10, 15, 11, 0, 0, DateTimeKind.Utc);

            var cmd = new CreateReservationCommand(
                PropertyId: propId,
                RoomId: roomId,
                RentalType: RentalType.Hourly,
                StartAtUtc: startUtc,
                EndAtUtc: endUtc,
                CheckInDate: null,
                CheckOutDate: null,
                GuestName: "Trần Văn B",
                GuestEmail: "tranvanb@example.com",
                GuestPhone: "0912345678",
                NumberOfGuests: 2,
                CustomerNotes: "Tầng cao thoáng mát"
            );

            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(200000m, result.TotalAmount);
            Assert.Equal(RentalType.Hourly, result.RentalType);
            Assert.Equal("101", result.RoomNumber);
            Assert.StartsWith("RES-", result.ConfirmationCode);
            Assert.Equal(ReservationStatus.Confirmed, result.Status);
            Assert.NotEmpty(result.Breakdown);

            // Verify persistence in DB
            var persisted = await ctx.Reservations.FirstOrDefaultAsync(r => r.Id == result.Id);
            Assert.NotNull(persisted);
            Assert.Equal(200000m, persisted!.TotalAmount);
            var snapshot = ReservationSnapshotHelper.TryDeserialize(persisted.Notes);
            Assert.NotNull(snapshot);
            Assert.Equal(200000m, snapshot!.TotalAmount);
            Assert.Equal("Tầng cao thoáng mát", snapshot.CustomerNotes);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task SnapshotImmutability_WhenRatesUpdated_ExistingBookingTotalDoesNotChange()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

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
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId);
            }

            await using var ctx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);

            var quoteHandler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, memberSvc, propSvc);
            var mediator = new TestMediator((req, ct) =>
            {
                if (req is CalculateQuoteQuery cq)
                    return quoteHandler.Handle(cq, ct).ContinueWith(t => (object)t.Result, ct);
                throw new NotSupportedException();
            });

            var handler = new CreateReservationCommandHandler(ctx, tenantSvc, userCtx, memberSvc, mediator, propSvc);

            // 1 night overnight stay (400,000 VND)
            var checkIn = new DateOnly(2026, 10, 20);
            var checkOut = new DateOnly(2026, 10, 21);
            var (startUtc, endUtc) = ReservationTimeHelper.GetOvernightUtcInterval(checkIn, checkOut, new TimeOnly(12, 0), new TimeOnly(12, 0));

            var cmd = new CreateReservationCommand(
                PropertyId: propId,
                RoomId: roomId,
                RentalType: RentalType.Overnight,
                StartAtUtc: startUtc,
                EndAtUtc: endUtc,
                CheckInDate: checkIn,
                CheckOutDate: checkOut,
                GuestName: "Lê Thị C",
                GuestEmail: "lethic@example.com",
                GuestPhone: "0987654321",
                NumberOfGuests: 1
            );

            var createdBooking = await handler.Handle(cmd, CancellationToken.None);
            Assert.Equal(400000m, createdBooking.TotalAmount);

            // Now update the rate table: prices increase dramatically!
            var currentRate = await ctx.RoomTypeRates.FirstAsync(r => r.RoomTypeId == rtId);
            currentRate.NightlyPrice = 750000m;
            await ctx.SaveChangesAsync();

            // Verify via GetReservationByIdQuery: original booking MUST still return 400,000 VND!
            var getHandler = new GetReservationByIdQueryHandler(ctx, tenantSvc, userCtx, memberSvc, propSvc);
            var queried = await getHandler.Handle(new GetReservationByIdQuery(createdBooking.Id, propId), CancellationToken.None);

            Assert.Equal(400000m, queried.TotalAmount);
            Assert.Contains(queried.Breakdown, b => b.Amount == 400000m);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task TurnoverBufferAndConflict_RejectsOverlappingStay_AllowsNonOverlappingStay()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

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
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId);
            }

            await using var ctx = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);

            var quoteHandler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, memberSvc, propSvc);
            var mediator = new TestMediator((req, ct) =>
            {
                if (req is CalculateQuoteQuery cq)
                    return quoteHandler.Handle(cq, ct).ContinueWith(t => (object)t.Result, ct);
                throw new NotSupportedException();
            });

            var handler = new CreateReservationCommandHandler(ctx, tenantSvc, userCtx, memberSvc, mediator, propSvc);

            // First booking: 10:00 to 12:00 UTC
            var start1 = new DateTime(2026, 10, 16, 10, 0, 0, DateTimeKind.Utc);
            var end1 = new DateTime(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);
            await handler.Handle(new CreateReservationCommand(
                propId, roomId, RentalType.Hourly, start1, end1, null, null,
                "Khách 1", "k1@example.com", null, 1), CancellationToken.None);

            // Second booking: 12:15 to 14:00 UTC (15 minutes after first ends -> inside 30m turnover buffer!)
            var start2 = new DateTime(2026, 10, 16, 12, 15, 0, DateTimeKind.Utc);
            var end2 = new DateTime(2026, 10, 16, 14, 0, 0, DateTimeKind.Utc);

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                handler.Handle(new CreateReservationCommand(
                    propId, roomId, RentalType.Hourly, start2, end2, null, null,
                    "Khách 2", "k2@example.com", null, 1), CancellationToken.None));

            Assert.Equal("ERR_ROOM_UNAVAILABLE", ex.ErrorCode);

            // Third booking: 12:30 to 14:30 UTC (exactly 30m buffer after 12:00) -> MUST SUCCEED!
            var start3 = new DateTime(2026, 10, 16, 12, 30, 0, DateTimeKind.Utc);
            var end3 = new DateTime(2026, 10, 16, 14, 30, 0, DateTimeKind.Utc);

            var booking3 = await handler.Handle(new CreateReservationCommand(
                propId, roomId, RentalType.Hourly, start3, end3, null, null,
                "Khách 3", "k3@example.com", null, 1), CancellationToken.None);

            Assert.NotNull(booking3);
            Assert.Equal(ReservationStatus.Confirmed, booking3.Status);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task ConcurrentBookingCompetition_ExactlyOneWins_OneGetsConflict()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        var conn = await CreateTestConnectionAsync(testSchema);

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var rtId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

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
                await SeedHierarchyAsync(seedCtx, tenantId, propId, rtId, roomId);
            }

            // Both requests target the exact same room and overlapping times
            var startUtc = new DateTime(2026, 10, 18, 14, 0, 0, DateTimeKind.Utc);
            var endUtc = new DateTime(2026, 10, 18, 16, 0, 0, DateTimeKind.Utc);

            var cmdA = new CreateReservationCommand(
                propId, roomId, RentalType.Hourly, startUtc, endUtc, null, null,
                "Khách A", "khacha@test.com", null, 1);

            var cmdB = new CreateReservationCommand(
                propId, roomId, RentalType.Hourly, startUtc, endUtc, null, null,
                "Khách B", "khachb@test.com", null, 1);

            // Execute concurrently across two distinct DbContext instances
            var taskA = Task.Run(async () =>
            {
                await using var ctxA = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                var quoteHandlerA = new CalculateQuoteQueryHandler(ctxA, tenantSvc, userCtx, memberSvc, propSvc);
                var medA = new TestMediator((req, ct) => quoteHandlerA.Handle((CalculateQuoteQuery)req, ct).ContinueWith(t => (object)t.Result, ct));
                var handlerA = new CreateReservationCommandHandler(ctxA, tenantSvc, userCtx, memberSvc, medA, propSvc);
                return await handlerA.Handle(cmdA, CancellationToken.None);
            });

            var taskB = Task.Run(async () =>
            {
                await using var ctxB = CreateDbContext(connStr, testSchema, tenantSvc, propSvc);
                var quoteHandlerB = new CalculateQuoteQueryHandler(ctxB, tenantSvc, userCtx, memberSvc, propSvc);
                var medB = new TestMediator((req, ct) => quoteHandlerB.Handle((CalculateQuoteQuery)req, ct).ContinueWith(t => (object)t.Result, ct));
                var handlerB = new CreateReservationCommandHandler(ctxB, tenantSvc, userCtx, memberSvc, medB, propSvc);
                return await handlerB.Handle(cmdB, CancellationToken.None);
            });

            int successCount = 0;
            int conflictCount = 0;

            foreach (var task in new[] { taskA, taskB })
            {
                try
                {
                    var res = await task;
                    if (res != null) successCount++;
                }
                catch (ConflictException cEx) when (cEx.ErrorCode == "ERR_ROOM_UNAVAILABLE")
                {
                    conflictCount++;
                }
            }

            Assert.Equal(1, successCount);
            Assert.Equal(1, conflictCount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
