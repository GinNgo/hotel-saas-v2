using System;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.Commands.CreateRoom;
using HotelSaas.Application.Rooms.Commands.DeleteRoom;
using HotelSaas.Application.Rooms.Commands.UpdateRoom;
using HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomType;
using HotelSaas.Application.RoomTypes.Commands.DeleteRoomType;
using HotelSaas.Application.RoomTypes.Commands.UpdateRoomType;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Rooms;

/// <summary>
/// Integration tests on real PostgreSQL database for Phase P2B-01:
/// - Room housekeeping state machine and atomic optimistic concurrency
/// - Branch isolation and scope immutability
/// - Branch uniqueness for RoomNumber and RoomType.Code
/// - Active booking protection, historical soft delete, and unused hard delete
/// - Fail-closed membership verification and security guards
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P2B01_RoomAndRoomTypeHardeningTests
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
                $"[CRITICAL SECURITY ALERT] Target database '{builder.Database}' is NOT an authorized test database! " +
                "Refusing to execute DDL/DML. Target database name must contain '_test'.");
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
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Owner;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsurePropertyContext() { }
        public void EnsureTenantContext() { }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide) { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
    }

    private sealed class MockMembershipLookupService : IMembershipLookupService
    {
        public MembershipLookupStatus StatusToReturn { get; set; } = MembershipLookupStatus.Success;
        public string? ErrorMessageToReturn { get; set; }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            if (StatusToReturn != MembershipLookupStatus.Success)
            {
                return Task.FromResult(MembershipLookupResult.Failed(
                    StatusToReturn,
                    ErrorMessageToReturn ?? "Mock membership lookup failure"));
            }

            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                Domain.Enums.StaffRole.Owner,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }
    }

    private sealed class BarrierSynchronizedMembershipLookupService : IMembershipLookupService
    {
        private readonly Barrier _barrier;
        private readonly IMembershipLookupService _inner;

        public BarrierSynchronizedMembershipLookupService(Barrier barrier, IMembershipLookupService? inner = null)
        {
            _barrier = barrier;
            _inner = inner ?? new MockMembershipLookupService();
        }

        public async Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            _barrier.SignalAndWait(cancellationToken);
            return await _inner.ResolveMembershipAsync(tenantId, userId, targetPropertyId, cancellationToken);
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
        if (!Regex.IsMatch(testSchema, @"^p2b01_test_[a-zA-Z0-9]+$"))
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
        catch { }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    private async Task SeedBaseDataAsync(
        ApplicationDbContext ctx,
        Guid tenantId,
        Guid prop1Id,
        Guid prop2Id,
        Guid roomTypeIdProp1,
        Guid roomTypeIdProp2,
        Guid roomId1Prop1,
        Guid roomId2Prop1)
    {
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Khách Sạn Biển Đông",
            Code = $"BD-{tenantId:N}"[..12],
            Slug = $"bien-dong-{tenantId:N}"[..24],
            Address = "123 Tran Phu",
            City = "Da Nang",
            Status = TenantStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Tenants.Add(tenant);

        var prop1 = new Property
        {
            Id = prop1Id,
            TenantId = tenantId,
            Name = "Chi nhánh Quận Hải Châu",
            Code = $"BD-HC-{prop1Id:N}"[..12],
            Slug = $"chi-nhanh-hai-chau-{prop1Id:N}",
            Address = "123 Tran Phu, Hai Chau",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        var prop2 = new Property
        {
            Id = prop2Id,
            TenantId = tenantId,
            Name = "Chi nhánh Sơn Trà",
            Code = $"BD-ST-{prop2Id:N}"[..12],
            Slug = $"chi-nhanh-son-tra-{prop2Id:N}",
            Address = "45 Vo Nguyen Giap, Son Tra",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Properties.AddRange(prop1, prop2);

        var rtProp1 = new RoomType
        {
            Id = roomTypeIdProp1,
            TenantId = tenantId,
            PropertyId = prop1Id,
            Name = "Deluxe Sea View",
            Code = "DELUXE",
            BasePrice = 1200000m,
            MaxOccupancy = 2,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        var rtProp2 = new RoomType
        {
            Id = roomTypeIdProp2,
            TenantId = tenantId,
            PropertyId = prop2Id,
            Name = "Standard Garden",
            Code = "STANDARD",
            BasePrice = 800000m,
            MaxOccupancy = 2,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.RoomTypes.AddRange(rtProp1, rtProp2);

        var room1 = new Room
        {
            Id = roomId1Prop1,
            TenantId = tenantId,
            PropertyId = prop1Id,
            RoomTypeId = roomTypeIdProp1,
            RoomNumber = "101",
            Floor = 1,
            Status = RoomStatus.Dirty,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        var room2 = new Room
        {
            Id = roomId2Prop1,
            TenantId = tenantId,
            PropertyId = prop1Id,
            RoomTypeId = roomTypeIdProp1,
            RoomNumber = "102",
            Floor = 1,
            Status = RoomStatus.Clean,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Rooms.AddRange(room1, room2);

        await ctx.SaveChangesAsync();
    }

    // ── 1. Housekeeping State Machine Transitions ─────────────────────────────

    [Fact]
    public async Task UpdateRoomStatus_ValidHousekeepingTransitions_SucceedsAndUpdatesStatus()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomStatusCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Step 1: Dirty -> Cleaning
            var res1 = await handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Cleaning, RoomStatus.Dirty), CancellationToken.None);
            Assert.Equal("Cleaning", res1.Status);

            // Step 2: Cleaning -> Clean
            var res2 = await handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Clean, RoomStatus.Cleaning), CancellationToken.None);
            Assert.Equal("Clean", res2.Status);

            // Step 3: Clean -> OutOfService
            var res3 = await handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.OutOfService, RoomStatus.Clean), CancellationToken.None);
            Assert.Equal("OutOfService", res3.Status);

            // Step 4: OutOfService -> Dirty
            var res4 = await handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Dirty, RoomStatus.OutOfService), CancellationToken.None);
            Assert.Equal("Dirty", res4.Status);

            // Verify final state in DB directly
            var freshRoom = await ctx.Rooms.IgnoreQueryFilters().FirstAsync(r => r.Id == r1Id);
            Assert.Equal(RoomStatus.Dirty, freshRoom.Status);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task UpdateRoomStatus_ProhibitedTransitions_ThrowsBadRequestException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid(); // Status: Dirty
            var r2Id = Guid.NewGuid(); // Status: Clean

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomStatusCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Dirty -> Clean directly is forbidden (must pass through Cleaning)
            var ex1 = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Clean, RoomStatus.Dirty), CancellationToken.None));
            Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex1.ErrorCode);

            // Clean -> Occupied is forbidden (only P3 check-in can set Occupied)
            var ex2 = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(new UpdateRoomStatusCommand(r2Id, RoomStatus.Occupied, RoomStatus.Clean), CancellationToken.None));
            Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex2.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── 2. Optimistic Concurrency and Stale State Guard ───────────────────────

    [Fact]
    public async Task UpdateRoomStatus_WhenExpectedOldStatusDoesNotMatch_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid(); // Status: Dirty
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomStatusCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Client thinks the room is Cleaning, but it is Dirty in DB
            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                handler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Clean, RoomStatus.Cleaning), CancellationToken.None));
            Assert.Equal("ERR_STALE_STATE", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task UpdateRoomStatus_TwoConnectionsConcurrencyRace_OneWinsAndOneReceivesStaleState()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid(); // Status: Dirty
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            // Rendezvous barrier: ensures both concurrent handlers read the Dirty room from DB
            // before EITHER is allowed to issue the atomic raw SQL UPDATE
            using var barrier = new Barrier(2);
            var barrierLookup = new BarrierSynchronizedMembershipLookupService(barrier);

            // Two distinct DbContext connections simulating two concurrent users
            await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);

            var handler1 = new UpdateRoomStatusCommandHandler(ctx1, tenantService, propService, userContext, barrierLookup);
            var handler2 = new UpdateRoomStatusCommandHandler(ctx2, tenantService, propService, userContext, barrierLookup);

            // Both users saw the room as Dirty and attempt concurrent updates
            // User 1 wants Dirty -> Cleaning
            // User 2 wants Dirty -> OutOfService
            var task1 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler1.Handle(
                        new UpdateRoomStatusCommand(r1Id, RoomStatus.Cleaning, RoomStatus.Dirty),
                        CancellationToken.None);
                    return (Success: true, Status: res.Status, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Status: (string?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var task2 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler2.Handle(
                        new UpdateRoomStatusCommand(r1Id, RoomStatus.OutOfService, RoomStatus.Dirty),
                        CancellationToken.None);
                    return (Success: true, Status: res.Status, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Status: (string?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var results = await Task.WhenAll(task1, task2);

            // Exactly one must succeed and exactly one must fail with ERR_STALE_STATE
            var winner = results.Single(r => r.Success);
            var loser = results.Single(r => !r.Success);

            Assert.Equal("ERR_STALE_STATE", loser.ErrorCode);
            Assert.Contains(winner.Status, new[] { "Cleaning", "OutOfService" });

            // Verify final state in DB matches the winner
            await using var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var currentRoom = await verifyCtx.Rooms.IgnoreQueryFilters().FirstAsync(r => r.Id == r1Id);
            Assert.Equal(winner.Status, currentRoom.Status.ToString());
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── 3. Room Mutability, Context Mismatch & Cross-Branch RoomType ──────────

    [Fact]
    public async Task UpdateRoom_CrossBranchRoomType_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid(); // Belong to Prop1
            var rt2Id = Guid.NewGuid(); // Belong to Prop2
            var r1Id = Guid.NewGuid();  // Room in Prop1
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Attempt to assign rt2Id (belongs to Property 2) to Room 1 (belongs to Property 1)
            var command = new UpdateRoomCommand(
                Id: r1Id,
                RoomNumber: "101",
                RoomTypeId: rt2Id,
                Floor: 1,
                Notes: "Updated notes",
                IsActive: true);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_MISMATCH", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task UpdateRoom_DuplicateRoomNumberInSameBranch_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid(); // RoomNumber: 101
            var r2Id = Guid.NewGuid(); // RoomNumber: 102

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Attempt to change Room 2's number to "101" (already used by Room 1 in Property 1)
            var duplicateCmd = new UpdateRoomCommand(
                Id: r2Id,
                RoomNumber: "101",
                RoomTypeId: rt1Id,
                Floor: 1,
                Notes: null,
                IsActive: true);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(duplicateCmd, CancellationToken.None));
            Assert.Equal("ERR_CONFLICT", ex.ErrorCode);

            // Updating Room 2 with its own room number succeeds
            var validCmd = new UpdateRoomCommand(
                Id: r2Id,
                RoomNumber: "102",
                RoomTypeId: rt1Id,
                Floor: 2,
                Notes: "Moved to floor 2",
                IsActive: true);

            var updated = await handler.Handle(validCmd, CancellationToken.None);
            Assert.Equal("102", updated.RoomNumber);
            Assert.Equal(2, updated.Floor);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_ConcurrentDuplicateRoomNumber_OneWinsOneReceivesConflict()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            // Rendezvous barrier: ensures both concurrent handlers check uniqueness and prepare insert concurrently
            // before either commits SaveChangesAsync to PostgreSQL
            using var barrier = new Barrier(2);
            var barrierLookup = new BarrierSynchronizedMembershipLookupService(barrier);

            await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);

            var handler1 = new CreateRoomCommandHandler(ctx1, tenantService, propService, userContext, barrierLookup);
            var handler2 = new CreateRoomCommandHandler(ctx2, tenantService, propService, userContext, barrierLookup);

            // Both attempt to create RoomNumber "301" in Property 1 concurrently
            var duplicateRoomNumber = "301";
            var task1 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler1.Handle(
                        new CreateRoomCommand(duplicateRoomNumber, rt1Id, 3, "Concurrent room 1", prop1Id),
                        CancellationToken.None);
                    return (Success: true, Id: (Guid?)res.Id, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Id: (Guid?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var task2 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler2.Handle(
                        new CreateRoomCommand(duplicateRoomNumber, rt1Id, 3, "Concurrent room 2", prop1Id),
                        CancellationToken.None);
                    return (Success: true, Id: (Guid?)res.Id, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Id: (Guid?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var results = await Task.WhenAll(task1, task2);

            var winner = results.Single(r => r.Success);
            var loser = results.Single(r => !r.Success);

            Assert.Equal("ERR_CONFLICT", loser.ErrorCode);
            Assert.NotNull(winner.Id);

            // Verify in DB directly: exactly 1 room with RoomNumber 301 exists in Property 1
            await using var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var rooms = await verifyCtx.Rooms.IgnoreQueryFilters()
                .Where(r => r.TenantId == tenantId && r.PropertyId == prop1Id && r.RoomNumber == duplicateRoomNumber)
                .ToListAsync();

            Assert.Single(rooms);
            Assert.Equal(winner.Id.Value, rooms[0].Id);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task UpdateRoom_ContextMismatchHeaderVersusRoom_ThrowsBadRequestException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid(); // Room in Prop 1
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            // Header indicates Property 2, but target room is in Property 1
            var propService = new MockPropertyService { PropertyId = prop2Id, HeaderPropertyId = prop2Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop2Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var cmd = new UpdateRoomCommand(
                Id: r1Id,
                RoomNumber: "101-Renamed",
                RoomTypeId: rt1Id,
                Floor: 1,
                Notes: null,
                IsActive: true);

            var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── 4. Room Deletion Guards and Retention ─────────────────────────────────

    [Fact]
    public async Task DeleteRoom_WithActiveReservation_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);

                // Add active reservation to Room 1
                var activeRes = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomId = r1Id,
                    GuestName = "Tran Van A",
                    GuestEmail = "vana@gmail.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                    NumberOfGuests = 2,
                    TotalAmount = 2400000m,
                    Status = ReservationStatus.Confirmed,
                    ConfirmationCode = "RES-ACTIVE-01",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                seedCtx.Reservations.Add(activeRes);
                await seedCtx.SaveChangesAsync();
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new DeleteRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(new DeleteRoomCommand(r1Id), CancellationToken.None));
            Assert.Equal("ERR_ROOM_HAS_ACTIVE_BOOKINGS", ex.ErrorCode);

            // Verify room still exists and remains active in DB
            var roomStillExists = await ctx.Rooms.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == r1Id);
            Assert.NotNull(roomStillExists);
            Assert.True(roomStillExists.IsActive);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task DeleteRoom_WithHistoricalReservation_SoftDeletesRoom()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);

                // Add historical (checked out) reservation to Room 1
                var historicalRes = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomId = r1Id,
                    GuestName = "Le Thi B",
                    GuestEmail = "thib@gmail.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
                    NumberOfGuests = 1,
                    TotalAmount = 1200000m,
                    Status = ReservationStatus.CheckedOut,
                    ConfirmationCode = "RES-PAST-01",
                    CreatedAtUtc = DateTime.UtcNow.AddDays(-5),
                    UpdatedAtUtc = DateTime.UtcNow.AddDays(-2)
                };
                seedCtx.Reservations.Add(historicalRes);
                await seedCtx.SaveChangesAsync();
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new DeleteRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var deleted = await handler.Handle(new DeleteRoomCommand(r1Id), CancellationToken.None);
            Assert.True(deleted);

            // Verify room is soft deleted: record exists, but IsActive is false
            var softDeletedRoom = await ctx.Rooms.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == r1Id);
            Assert.NotNull(softDeletedRoom);
            Assert.False(softDeletedRoom.IsActive);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task DeleteRoom_WithNoReservations_HardDeletesRoom()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new DeleteRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var deleted = await handler.Handle(new DeleteRoomCommand(r1Id), CancellationToken.None);
            Assert.True(deleted);

            // Verify room is hard deleted from DB
            var deletedRoom = await ctx.Rooms.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == r1Id);
            Assert.Null(deletedRoom);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── 5. RoomType Uniqueness and In-Use Guard ───────────────────────────────

    [Fact]
    public async Task UpdateRoomType_DuplicateCodeInSameBranch_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid(); // Code: DELUXE
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            var extraRtId = Guid.NewGuid();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);

                // Add a second room type to Property 1 with Code: SUITE
                var rtSuite = new RoomType
                {
                    Id = extraRtId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    Name = "Executive Suite",
                    Code = "SUITE",
                    BasePrice = 2500000m,
                    MaxOccupancy = 4,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                seedCtx.RoomTypes.Add(rtSuite);
                await seedCtx.SaveChangesAsync();
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new UpdateRoomTypeCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            // Attempt to update SUITE to use Code "DELUXE" (already taken in Property 1)
            var duplicateCmd = new UpdateRoomTypeCommand(
                Id: extraRtId,
                Name: "Executive Suite",
                Code: "DELUXE",
                Description: null,
                BasePrice: 2500000m,
                MaxOccupancy: 4,
                BedType: "King",
                SquareMeters: 45m,
                ImageUrl: null);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(duplicateCmd, CancellationToken.None));
            Assert.Equal("ERR_CONFLICT", ex.ErrorCode);

            // Updating SUITE with its own Code "SUITE" succeeds
            var validCmd = new UpdateRoomTypeCommand(
                Id: extraRtId,
                Name: "Presidential Suite",
                Code: "SUITE",
                Description: "Top floor",
                BasePrice: 3000000m,
                MaxOccupancy: 4,
                BedType: "King",
                SquareMeters: 50m,
                ImageUrl: null);

            var updated = await handler.Handle(validCmd, CancellationToken.None);
            Assert.Equal("Presidential Suite", updated.Name);
            Assert.Equal("SUITE", updated.Code);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_ConcurrentDuplicateCode_OneWinsOneReceivesConflict()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            // Rendezvous barrier: ensures both concurrent handlers check uniqueness and prepare insert concurrently
            // before either commits SaveChangesAsync to PostgreSQL
            using var barrier = new Barrier(2);
            var barrierLookup = new BarrierSynchronizedMembershipLookupService(barrier);

            await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);

            var handler1 = new CreateRoomTypeCommandHandler(ctx1, tenantService, propService, userContext, barrierLookup);
            var handler2 = new CreateRoomTypeCommandHandler(ctx2, tenantService, propService, userContext, barrierLookup);

            // Both attempt to create RoomType with Code "VIP_SUITE" in Property 1 concurrently
            var duplicateCode = "VIP_SUITE";
            var task1 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler1.Handle(
                        new CreateRoomTypeCommand("VIP Suite 1", duplicateCode, "Desc 1", 5000000m, 4, "King", 60m, null, prop1Id),
                        CancellationToken.None);
                    return (Success: true, Id: (Guid?)res.Id, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Id: (Guid?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var task2 = Task.Run(async () =>
            {
                try
                {
                    var res = await handler2.Handle(
                        new CreateRoomTypeCommand("VIP Suite 2", duplicateCode, "Desc 2", 5000000m, 4, "King", 60m, null, prop1Id),
                        CancellationToken.None);
                    return (Success: true, Id: (Guid?)res.Id, ErrorCode: (string?)null);
                }
                catch (ConflictException cex)
                {
                    return (Success: false, Id: (Guid?)null, ErrorCode: cex.ErrorCode);
                }
            });

            var results = await Task.WhenAll(task1, task2);

            var winner = results.Single(r => r.Success);
            var loser = results.Single(r => !r.Success);

            Assert.Equal("ERR_CONFLICT", loser.ErrorCode);
            Assert.NotNull(winner.Id);

            // Verify in DB directly: exactly 1 room type with Code VIP_SUITE exists in Property 1
            await using var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var roomTypes = await verifyCtx.RoomTypes.IgnoreQueryFilters()
                .Where(rt => rt.TenantId == tenantId && rt.PropertyId == prop1Id && rt.Code == duplicateCode)
                .ToListAsync();

            Assert.Single(roomTypes);
            Assert.Equal(winner.Id.Value, roomTypes[0].Id);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task DeleteRoomType_WhenRoomsAreLinked_ThrowsConflictException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid(); // Has room1 and room2 linked!
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new DeleteRoomTypeCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(new DeleteRoomTypeCommand(rt1Id), CancellationToken.None));
            Assert.Equal("ERR_ROOMTYPE_IN_USE", ex.ErrorCode);

            // Verify room type is not deleted
            var rtExists = await ctx.RoomTypes.IgnoreQueryFilters().FirstOrDefaultAsync(rt => rt.Id == rt1Id);
            Assert.NotNull(rtExists);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task DeleteRoomType_WhenNoRoomsLinked_DeletesSuccessfully()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            var unlinkedRtId = Guid.NewGuid();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);

                var unlinkedRt = new RoomType
                {
                    Id = unlinkedRtId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    Name = "Temporary Type",
                    Code = "TEMP",
                    BasePrice = 500000m,
                    MaxOccupancy = 1,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                seedCtx.RoomTypes.Add(unlinkedRt);
                await seedCtx.SaveChangesAsync();
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);
            var handler = new DeleteRoomTypeCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);

            var deleted = await handler.Handle(new DeleteRoomTypeCommand(unlinkedRtId), CancellationToken.None);
            Assert.True(deleted);

            // Verify room type is deleted from DB
            var rtExists = await ctx.RoomTypes.IgnoreQueryFilters().FirstOrDefaultAsync(rt => rt.Id == unlinkedRtId);
            Assert.Null(rtExists);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── 6. Fail-Closed Security & Revocation Enforcement ──────────────────────

    [Fact]
    public async Task SecurityFailClosed_WhenMembershipRevoked_MutationsThrowForbiddenException()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };

            // Mock membership lookup returns MembershipRevoked
            var membershipLookup = new MockMembershipLookupService
            {
                StatusToReturn = MembershipLookupStatus.MembershipRevoked,
                ErrorMessageToReturn = "Tài khoản nhân sự tại chi nhánh đã bị vô hiệu hóa."
            };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);

            // 1. UpdateRoomStatus
            var statusHandler = new UpdateRoomStatusCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);
            var ex1 = await Assert.ThrowsAsync<ForbiddenException>(() =>
                statusHandler.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Cleaning, RoomStatus.Dirty), CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex1.ErrorCode);

            // 2. UpdateRoom
            var roomHandler = new UpdateRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);
            var ex2 = await Assert.ThrowsAsync<ForbiddenException>(() =>
                roomHandler.Handle(new UpdateRoomCommand(r1Id, "101", rt1Id, 1, null, true), CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex2.ErrorCode);

            // 3. DeleteRoom
            var deleteRoomHandler = new DeleteRoomCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);
            var ex3 = await Assert.ThrowsAsync<ForbiddenException>(() =>
                deleteRoomHandler.Handle(new DeleteRoomCommand(r1Id), CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex3.ErrorCode);

            // 4. UpdateRoomType
            var rtHandler = new UpdateRoomTypeCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);
            var ex4 = await Assert.ThrowsAsync<ForbiddenException>(() =>
                rtHandler.Handle(new UpdateRoomTypeCommand(rt1Id, "New Name", "DELUXE", null, 1000m, 2, null, null, null), CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex4.ErrorCode);

            // 5. DeleteRoomType
            var deleteRtHandler = new DeleteRoomTypeCommandHandler(ctx, tenantService, propService, userContext, membershipLookup);
            var ex5 = await Assert.ThrowsAsync<ForbiddenException>(() =>
                deleteRtHandler.Handle(new DeleteRoomTypeCommand(rt1Id), CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex5.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task SecurityFailClosed_WhenTenantOrUserContextMissing_ThrowsUnauthorized()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var r1Id = Guid.NewGuid();
            var r2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseDataAsync(seedCtx, tenantId, prop1Id, prop2Id, rt1Id, rt2Id, r1Id, r2Id);
            }

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService);

            // Context without TenantId
            var missingTenant = new MockTenantService { TenantId = null };
            var handlerNoTenant = new UpdateRoomStatusCommandHandler(ctx, missingTenant, propService, userContext, membershipLookup);
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handlerNoTenant.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Cleaning, RoomStatus.Dirty), CancellationToken.None));

            // Context without UserId
            var missingUser = new MockUserContext { UserId = Guid.Empty };
            var handlerNoUser = new UpdateRoomStatusCommandHandler(ctx, tenantService, propService, missingUser, membershipLookup);
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handlerNoUser.Handle(new UpdateRoomStatusCommand(r1Id, RoomStatus.Cleaning, RoomStatus.Dirty), CancellationToken.None));
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
