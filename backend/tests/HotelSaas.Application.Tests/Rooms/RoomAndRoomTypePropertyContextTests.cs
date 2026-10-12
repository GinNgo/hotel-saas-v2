using System;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.Commands.CreateRoom;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomType;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Rooms;

/// <summary>
/// Regression and compatibility tests for Room and RoomType creation
/// with property context resolution and branch validation (Finding 3).
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class RoomAndRoomTypePropertyContextTests
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

    private sealed class MockCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockCurrentPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class MockCurrentUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "user@hotel.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Owner;
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
                    ErrorMessageToReturn ?? "Mock failure"));
            }

            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                Domain.Enums.StaffRole.Owner,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }
    }

    private static CreateRoomTypeCommandHandler CreateRoomTypeHandler(
        ApplicationDbContext ctx,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propService = null,
        ICurrentUserContext? userContext = null,
        IMembershipLookupService? membershipLookup = null)
    {
        return new CreateRoomTypeCommandHandler(
            ctx,
            tenantService,
            propService ?? new MockCurrentPropertyService(),
            userContext ?? new MockCurrentUserContext { TenantId = tenantService.TenantId },
            membershipLookup ?? new MockMembershipLookupService());
    }

    private static CreateRoomCommandHandler CreateRoomHandler(
        ApplicationDbContext ctx,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propService = null,
        ICurrentUserContext? userContext = null,
        IMembershipLookupService? membershipLookup = null)
    {
        return new CreateRoomCommandHandler(
            ctx,
            tenantService,
            propService ?? new MockCurrentPropertyService(),
            userContext ?? new MockCurrentUserContext { TenantId = tenantService.TenantId },
            membershipLookup ?? new MockMembershipLookupService());
    }

    private static ApplicationDbContext CreateDbContext(string connString, string testSchema, ICurrentTenantService tenantService)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        return new ApplicationDbContext(options, tenantService);
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

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedTenantAndPropertiesAsync(
        ApplicationDbContext ctx,
        Guid tenantId,
        Guid prop1Id,
        Guid? prop2Id = null,
        PropertyStatus prop1Status = PropertyStatus.Active)
    {
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Khách Sạn Kim Cương",
            Code = $"KC-{tenantId:N}"[..12],
            Slug = $"kim-cuong-{tenantId:N}"[..24],
            Address = "100 Le Loi",
            City = "TP. Ho Chi Minh",
            Status = TenantStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Tenants.Add(tenant);

        var prop1 = new Property
        {
            Id = prop1Id,
            TenantId = tenantId,
            Name = "Chi nhánh Quận 1",
            Code = $"KC-Q1-{prop1Id:N}"[..12],
            Slug = $"chi-nhanh-q1-{prop1Id:N}",
            Address = "100 Le Loi, Q1",
            City = "TP. Ho Chi Minh",
            Status = prop1Status,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Properties.Add(prop1);

        if (prop2Id.HasValue)
        {
            var prop2 = new Property
            {
                Id = prop2Id.Value,
                TenantId = tenantId,
                Name = "Chi nhánh Quận 3",
                Code = $"KC-Q3-{prop2Id.Value:N}"[..12],
                Slug = $"chi-nhanh-q3-{prop2Id.Value:N}",
                Address = "50 Vo Van Tan, Q3",
                City = "TP. Ho Chi Minh",
                Status = PropertyStatus.Active,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.Properties.Add(prop2);
        }

        await ctx.SaveChangesAsync();
    }

    [Fact]
    public async Task CreateRoomType_WithExplicitValidPropertyId_SucceedsAndSetsPropertyId()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Deluxe Suite",
                Code: "DLX-SUITE",
                Description: "High-floor suite",
                BasePrice: 2000000m,
                MaxOccupancy: 2,
                BedType: "King Bed",
                SquareMeters: 45m,
                ImageUrl: null,
                PropertyId: propId);

            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(propId, result.PropertyId);
            Assert.Equal("DLX-SUITE", result.Code);

            var inDb = await ctx.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == result.Id);
            Assert.NotNull(inDb);
            Assert.Equal(propId, inDb.PropertyId);
            Assert.NotEqual(Guid.Empty, inDb.PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithExplicitPropertyId_BelongingToOtherTenant_ThrowsForbiddenException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantAId = Guid.NewGuid();
            var tenantBId = Guid.NewGuid();
            var propAId = Guid.NewGuid();
            var propBId = Guid.NewGuid();

            var tenantServiceA = new MockCurrentTenantService { TenantId = tenantAId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantServiceA);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantAId, propAId);
            await SeedTenantAndPropertiesAsync(ctx, tenantBId, propBId);

            var handler = CreateRoomTypeHandler(ctx, tenantServiceA);
            var cmd = new CreateRoomTypeCommand(
                Name: "Cross Tenant RoomType",
                Code: "CROSS-RT",
                Description: null,
                BasePrice: 1000000m,
                MaxOccupancy: 2,
                BedType: null,
                SquareMeters: null,
                ImageUrl: null,
                PropertyId: propBId); // Specifying Property of Tenant B

            var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", ex.ErrorCode);
            Assert.Contains("không thuộc quyền quản lý", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithInactiveProperty_ThrowsConflictException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId, prop1Status: PropertyStatus.Inactive);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Room Type On Inactive Property",
                Code: "INACTIVE-RT",
                Description: null,
                BasePrice: 1000000m,
                MaxOccupancy: 2,
                BedType: null,
                SquareMeters: null,
                ImageUrl: null,
                PropertyId: propId);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_INACTIVE", ex.ErrorCode);
            Assert.Contains("hoạt động", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithoutPropertyId_WhenTenantHasSingleActiveProperty_SucceedsViaBackwardCompatibility()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            // Single active property
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Standard Room",
                Code: "STD",
                Description: "Legacy style request without PropertyId",
                BasePrice: 1200000m,
                MaxOccupancy: 2,
                BedType: "Twin Beds",
                SquareMeters: 30m,
                ImageUrl: null,
                PropertyId: null); // Null property ID (legacy payload)

            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(propId, result.PropertyId); // Successfully inferred the sole active branch
            Assert.NotEqual(Guid.Empty, result.PropertyId);

            var inDb = await ctx.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == result.Id);
            Assert.NotNull(inDb);
            Assert.Equal(propId, inDb.PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithoutPropertyId_WhenTenantHasMultipleActiveProperties_ThrowsConflict_DoesNotPickArbitrarily()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            // Tenant has TWO active properties
            await SeedTenantAndPropertiesAsync(ctx, tenantId, prop1Id, prop2Id);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Ambiguous RoomType",
                Code: "AMB",
                Description: null,
                BasePrice: 1500000m,
                MaxOccupancy: 2,
                BedType: null,
                SquareMeters: null,
                ImageUrl: null,
                PropertyId: null); // Null property ID when multiple exist

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_REQUIRED", ex.ErrorCode);
            Assert.Contains("Tenant có nhiều chi nhánh. Bắt buộc phải chỉ định PropertyId", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithoutPropertyId_WhenTenantHasTwoProperties_OneActiveOneInactive_ThrowsConflict_DoesNotInfer()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            // Tenant has TWO properties total: prop1 Active, prop2 Inactive
            await SeedTenantAndPropertiesAsync(ctx, tenantId, prop1Id, prop2Id);
            var prop2 = await ctx.Properties.FindAsync(prop2Id);
            prop2!.Status = PropertyStatus.Inactive;
            await ctx.SaveChangesAsync();

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Mixed Status RoomType",
                Code: "MIXED",
                Description: null,
                BasePrice: 1500000m,
                MaxOccupancy: 2,
                BedType: null,
                SquareMeters: null,
                ImageUrl: null,
                PropertyId: null);

            // Must NOT infer even if only 1 is Active because tenant has 2 properties total!
            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_REQUIRED", ex.ErrorCode);
            Assert.Contains("Tenant có nhiều chi nhánh", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_WithoutPropertyId_WhenTenantHasSingleInactiveProperty_ThrowsConflict()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            // Single INACTIVE property
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId, prop1Status: PropertyStatus.Inactive);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand(
                Name: "Inactive Single Property RoomType",
                Code: "INACT-SINGLE",
                Description: null,
                BasePrice: 1200000m,
                MaxOccupancy: 2,
                BedType: null,
                SquareMeters: null,
                ImageUrl: null,
                PropertyId: null);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_INACTIVE", ex.ErrorCode);
            Assert.Contains("hoạt động", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_WithMatchingPropertyId_SucceedsAndAssignsPropertyId()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var roomType = new RoomType
            {
                Id = roomTypeId,
                TenantId = tenantId,
                PropertyId = propId,
                Name = "Executive Room",
                Code = "EXEC",
                BasePrice = 2500000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.RoomTypes.Add(roomType);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService);
            var cmd = new CreateRoomCommand(
                RoomNumber: "301",
                RoomTypeId: roomTypeId,
                Floor: 3,
                Notes: "Corner room",
                PropertyId: propId);

            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(propId, result.PropertyId);
            Assert.Equal("301", result.RoomNumber);
            Assert.NotEqual(Guid.Empty, result.PropertyId);

            var inDb = await ctx.Rooms.FirstOrDefaultAsync(r => r.Id == result.Id);
            Assert.NotNull(inDb);
            Assert.Equal(propId, inDb.PropertyId);
            Assert.NotEqual(Guid.Empty, inDb.PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_WithoutPropertyId_InheritsFromRoomType_SucceedsAndNeverGuidEmpty()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var roomType = new RoomType
            {
                Id = roomTypeId,
                TenantId = tenantId,
                PropertyId = propId,
                Name = "Superior Room",
                Code = "SUP",
                BasePrice = 1800000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.RoomTypes.Add(roomType);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService);
            var cmd = new CreateRoomCommand(
                RoomNumber: "201",
                RoomTypeId: roomTypeId,
                Floor: 2,
                Notes: null,
                PropertyId: null); // Null property ID (legacy payload)

            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(propId, result.PropertyId); // Inherited from roomType.PropertyId
            Assert.NotEqual(Guid.Empty, result.PropertyId);

            var inDb = await ctx.Rooms.FirstOrDefaultAsync(r => r.Id == result.Id);
            Assert.NotNull(inDb);
            Assert.Equal(propId, inDb.PropertyId);
            Assert.NotEqual(Guid.Empty, inDb.PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_WithMismatchedPropertyId_ThrowsConflictException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, prop1Id, prop2Id);

            var roomType = new RoomType
            {
                Id = roomTypeId,
                TenantId = tenantId,
                PropertyId = prop1Id, // Belongs to Property 1
                Name = "Prop1 RoomType",
                Code = "P1-RT",
                BasePrice = 1500000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.RoomTypes.Add(roomType);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService);
            var cmd = new CreateRoomCommand(
                RoomNumber: "101",
                RoomTypeId: roomTypeId,
                Floor: 1,
                Notes: null,
                PropertyId: prop2Id); // Specifying Property 2 (MISMATCH!)

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_MISMATCH", ex.ErrorCode);
            Assert.Contains("cùng chi nhánh", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_WhenTargetPropertyIsInactive_ThrowsConflictException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            // Seed property with INACTIVE status
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId, prop1Status: PropertyStatus.Inactive);

            var roomType = new RoomType
            {
                Id = roomTypeId,
                TenantId = tenantId,
                PropertyId = propId,
                Name = "Inactive Branch RoomType",
                Code = "INACT-RT",
                BasePrice = 1000000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.RoomTypes.Add(roomType);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService);
            var cmd = new CreateRoomCommand("101", roomTypeId, 1, null, propId);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_INACTIVE", ex.ErrorCode);
            Assert.Contains("hoạt động", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_DuplicateRoomNumberInSameProperty_ThrowsConflict_AllowsInDifferentProperty()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var rt1Id = Guid.NewGuid();
            var rt2Id = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, prop1Id, prop2Id);

            var rt1 = new RoomType
            {
                Id = rt1Id,
                TenantId = tenantId,
                PropertyId = prop1Id,
                Name = "RT 1",
                Code = "RT1",
                BasePrice = 1000000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            var rt2 = new RoomType
            {
                Id = rt2Id,
                TenantId = tenantId,
                PropertyId = prop2Id,
                Name = "RT 2",
                Code = "RT2",
                BasePrice = 1000000m,
                MaxOccupancy = 2,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            ctx.RoomTypes.AddRange(rt1, rt2);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService);

            // 1. Create Room "101" in Property 1 -> Success
            var cmd1 = new CreateRoomCommand("101", rt1Id, 1, null, prop1Id);
            var res1 = await handler.Handle(cmd1, CancellationToken.None);
            Assert.NotNull(res1);

            // 2. Duplicate Room "101" in Property 1 -> Throws ConflictException
            var cmdDup = new CreateRoomCommand("101", rt1Id, 1, null, prop1Id);
            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmdDup, CancellationToken.None));
            Assert.Equal("ERR_CONFLICT", ex.ErrorCode);
            Assert.Contains("Số phòng đã tồn tại", ex.Message);

            // 3. Create Room "101" in Property 2 -> Success (scoped per property!)
            var cmd2 = new CreateRoomCommand("101", rt2Id, 1, null, prop2Id);
            var res2 = await handler.Handle(cmd2, CancellationToken.None);
            Assert.NotNull(res2);
            Assert.Equal(prop2Id, res2.PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_MissingTenantContext_ThrowsUnauthorized_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = null }; // Missing tenant context

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomTypeHandler(ctx, tenantService);
            var cmd = new CreateRoomTypeCommand("RT", "RT-CODE", null, 100, 2, null, null, null, propId);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(cmd, CancellationToken.None));

            var inDb = await ctx.RoomTypes.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_MissingUserIdentityContext_ThrowsUnauthorized_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };
            var userContext = new MockCurrentUserContext { UserId = Guid.Empty }; // Missing identity context

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomTypeHandler(ctx, tenantService, userContext: userContext);
            var cmd = new CreateRoomTypeCommand("RT", "RT-CODE", null, 100, 2, null, null, null, propId);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(cmd, CancellationToken.None));

            var inDb = await ctx.RoomTypes.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoomType_MembershipRevoked_ThrowsForbidden_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };
            var membershipLookup = new MockMembershipLookupService
            {
                StatusToReturn = MembershipLookupStatus.MembershipRevoked,
                ErrorMessageToReturn = "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi."
            };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomTypeHandler(ctx, tenantService, membershipLookup: membershipLookup);
            var cmd = new CreateRoomTypeCommand("RT", "RT-CODE", null, 100, 2, null, null, null, propId);

            var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex.ErrorCode);

            var inDb = await ctx.RoomTypes.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_MissingTenantContext_ThrowsUnauthorized_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var rtId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = null }; // Missing tenant context

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomHandler(ctx, tenantService);
            var cmd = new CreateRoomCommand("101", rtId, 1, null, propId);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(cmd, CancellationToken.None));

            var inDb = await ctx.Rooms.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_MissingUserIdentityContext_ThrowsUnauthorized_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var rtId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };
            var userContext = new MockCurrentUserContext { UserId = Guid.Empty }; // Missing identity context

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var handler = CreateRoomHandler(ctx, tenantService, userContext: userContext);
            var cmd = new CreateRoomCommand("101", rtId, 1, null, propId);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(cmd, CancellationToken.None));

            var inDb = await ctx.Rooms.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CreateRoom_MembershipRevoked_ThrowsForbidden_NoRecordCreated()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var rtId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };
            var membershipLookup = new MockMembershipLookupService
            {
                StatusToReturn = MembershipLookupStatus.MembershipRevoked,
                ErrorMessageToReturn = "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi."
            };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedTenantAndPropertiesAsync(ctx, tenantId, propId);

            var rt = new RoomType
            {
                Id = rtId,
                TenantId = tenantId,
                PropertyId = propId,
                Name = "RT",
                Code = "RT",
                BasePrice = 100,
                MaxOccupancy = 2
            };
            ctx.RoomTypes.Add(rt);
            await ctx.SaveChangesAsync();

            var handler = CreateRoomHandler(ctx, tenantService, membershipLookup: membershipLookup);
            var cmd = new CreateRoomCommand("101", rtId, 1, null, propId);

            var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex.ErrorCode);

            var inDb = await ctx.Rooms.ToListAsync();
            Assert.Empty(inDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
