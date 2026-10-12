using System.Security;
using System.Text.RegularExpressions;
using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RefreshToken;
using HotelSaas.Application.Auth.Commands.SwitchContext;
using HotelSaas.Application.Auth.Queries.GetMyMemberships;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.Commands.CreateRoom;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomType;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Application.Rooms.Queries.GetRooms;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests;

/// <summary>
/// End-to-end integration tests for P1B-02B covering Fail-Closed Query Filters,
/// EF Concurrency Tokens & Mutation Guards, Deterministic Context Resolution,
/// and Atomic Refresh Token Rotation with Row-Level Locking and Family Revocation.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P1B02B_ContextAuthorizationIntegrationTests
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
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class MockUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; }
        public string Email { get; set; } = "test@user.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Manager;
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

    private sealed class TestConfiguration : IConfiguration
    {
        private readonly Dictionary<string, string> _values;

        public TestConfiguration(Dictionary<string, string> values) => _values = values;

        public string? this[string key]
        {
            get => _values.TryGetValue(key, out var val) ? val : null;
            set => _values[key] = value ?? string.Empty;
        }

        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => NullChangeToken.Instance;
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection(this, key);

        private sealed class NullChangeToken : Microsoft.Extensions.Primitives.IChangeToken
        {
            public static readonly NullChangeToken Instance = new();
            public bool HasChanged => false;
            public bool ActiveChangeCallbacks => false;
            public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new NoopDisposable();
            private sealed class NoopDisposable : IDisposable { public void Dispose() { } }
        }

        private sealed class TestConfigurationSection : IConfigurationSection
        {
            private readonly TestConfiguration _parent;
            public string Key { get; }
            public string Path => Key;
            public string? Value { get => _parent[Key]; set => _parent[Key] = value!; }

            public TestConfigurationSection(TestConfiguration parent, string key)
            {
                _parent = parent;
                Key = key;
            }

            public string? this[string key]
            {
                get => _parent[$"{Key}:{key}"];
                set => _parent[$"{Key}:{key}"] = value!;
            }

            public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
            public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => _parent.GetReloadToken();
            public IConfigurationSection GetSection(string key) => _parent.GetSection($"{Key}:{key}");
        }
    }

    private static IConfiguration CreateConfiguration(string connString, string testSchema)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var dict = new Dictionary<string, string>
        {
            {"ConnectionStrings:DefaultConnection", builder.ConnectionString},
            {"JwtSettings:SecretKey", "SuperSecretKeyForP1B02BTestingMustBeAtLeast32BytesLong!"},
            {"JwtSettings:Issuer", "HotelSaas"},
            {"JwtSettings:Audience", "HotelSaasClient"},
            {"JwtSettings:AccessTokenExpirationMinutes", "15"},
            {"JwtSettings:RefreshTokenExpirationDays", "7"}
        };
        return new TestConfiguration(dict);
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
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

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b02b_test_[a-zA-Z0-9]+$"))
            return;

        try
        {
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

    // ── Group 3: Hardened Global Query Filters & Fail-Closed ─────────────────

    [Fact]
    public async Task Group3_FailClosed_WhenTenantIdIsNull_ReturnsZeroRows()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();

            // Setup schema & data
            var setupTenant = new MockTenantService { TenantId = tenantId };
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema, setupTenant))
            {
                await migrateCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var rt = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, Name = "Standard", Code = "STD", BasePrice = 100, MaxOccupancy = 2 };
                var room = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, RoomTypeId = rt.Id, RoomNumber = "101", Floor = 1 };

                migrateCtx.Tenants.Add(tenant);
                migrateCtx.Properties.Add(prop);
                migrateCtx.RoomTypes.Add(rt);
                migrateCtx.Rooms.Add(room);
                await migrateCtx.SaveChangesAsync();
            }

            // Query with NULL TenantId (Fail-Closed)
            var nullTenantService = new MockTenantService { TenantId = null };
            await using (var testCtx = CreateDbContext(conn.ConnectionString, testSchema, nullTenantService))
            {
                var rooms = await testCtx.Rooms.ToListAsync();
                Assert.Empty(rooms); // Zero rows! Data leak strictly prevented.
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group3_PropertyScoped_QueryFilter_IsolatesBranches()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C" };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C" };
                var rt1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, Name = "Standard 1", Code = "STD1", BasePrice = 100, MaxOccupancy = 2 };
                var rt2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, Name = "Standard 2", Code = "STD2", BasePrice = 100, MaxOccupancy = 2 };
                var room1 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, RoomTypeId = rt1.Id, RoomNumber = "101", Floor = 1 };
                var room2 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, RoomTypeId = rt2.Id, RoomNumber = "201", Floor = 2 };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(prop1, prop2);
                ctx.RoomTypes.AddRange(rt1, rt2);
                ctx.Rooms.AddRange(room1, room2);
                await ctx.SaveChangesAsync();
            }

            // Staff pinned to P1 queries Rooms
            var propService = new MockPropertyService { PropertyId = p1, IsTenantWide = false };
            await using (var staffCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService))
            {
                var rooms = await staffCtx.Rooms.ToListAsync();
                Assert.Single(rooms);
                Assert.Equal("101", rooms[0].RoomNumber);
                Assert.Equal(p1, rooms[0].PropertyId);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group3_OwnerTenantWide_Excludes_Inactive_Branch_Rooms()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C" };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C" };
                var rt1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, Name = "Standard 1", Code = "STD1", BasePrice = 100, MaxOccupancy = 2 };
                var rt2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, Name = "Standard 2", Code = "STD2", BasePrice = 100, MaxOccupancy = 2 };
                var room1 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, RoomTypeId = rt1.Id, RoomNumber = "101", Floor = 1 };
                var room2 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, RoomTypeId = rt2.Id, RoomNumber = "201", Floor = 2 };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(prop1, prop2);
                ctx.RoomTypes.AddRange(rt1, rt2);
                ctx.Rooms.AddRange(room1, room2);
                await ctx.SaveChangesAsync();
            }

            // Owner views Tenant-Wide with P2 excluded (PO Decision 3)
            var ownerPropService = new MockPropertyService
            {
                PropertyId = null,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };

            await using (var ownerCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, ownerPropService))
            {
                var rooms = await ownerCtx.Rooms.ToListAsync();
                Assert.Single(rooms);
                Assert.Equal("101", rooms[0].RoomNumber); // P2 room excluded!
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group3_MutationGuard_ModifyingScopeFields_ThrowsSecurityException()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var rtId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propService = new MockPropertyService { PropertyId = p1, IsTenantWide = false };

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C" };
                var rt = new RoomType { Id = rtId, TenantId = tenantId, PropertyId = p1, Name = "Standard", Code = "STD", BasePrice = 100, MaxOccupancy = 2 };
                var room = new Room { Id = roomId, TenantId = tenantId, PropertyId = p1, RoomTypeId = rtId, RoomNumber = "101", Floor = 1 };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.RoomTypes.Add(rt);
                ctx.Rooms.Add(room);
                await ctx.SaveChangesAsync();
            }

            // 1. Attempt to tamper with scope fields on tracked entity:
            // EF Core detects modification to alternate key property and rejects it fail-closed
            await using (var updateCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService))
            {
                var room = await updateCtx.Rooms.FirstAsync(r => r.Id == roomId);
                room.PropertyId = Guid.NewGuid(); // Tampering with immutable PropertyId!

                await Assert.ThrowsAsync<InvalidOperationException>(() => updateCtx.SaveChangesAsync());
            }

            // 2. Attempt cross-property mutation with detached entity targeting a different branch
            var p2 = Guid.NewGuid();
            var roomP2Id = Guid.NewGuid();
            await using (var setupCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, new MockPropertyService { PropertyId = p2, IsTenantWide = false }))
            {
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C" };
                var rt2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, Name = "Standard 2", Code = "STD2", BasePrice = 100, MaxOccupancy = 2 };
                var roomP2 = new Room { Id = roomP2Id, TenantId = tenantId, PropertyId = p2, RoomTypeId = rt2.Id, RoomNumber = "201", Floor = 2 };

                setupCtx.Properties.Add(prop2);
                setupCtx.RoomTypes.Add(rt2);
                setupCtx.Rooms.Add(roomP2);
                await setupCtx.SaveChangesAsync();
            }

            // User scoped to P1 attempts to Remove room from P2 using detached entity with forged P1 scope
            await using (var attackCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propService))
            {
                var forgedRoom = new Room { Id = roomP2Id, TenantId = tenantId, PropertyId = p1, RoomTypeId = rtId, RoomNumber = "201" };
                attackCtx.Rooms.Remove(forgedRoom);

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => attackCtx.SaveChangesAsync());
                Assert.Equal("ERR_IMMUTABLE_SCOPE_FIELDS", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ── Group 6: Refresh Token Lifecycle, Locking & Family Revocation ────────

    [Fact]
    public async Task Group6_RefreshToken_AtomicRotation_And_Locking_Succeeds()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var propId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "R", Code = "R" };
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = propId, StaffRole = StaffRole.Manager, IsActive = true };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                ctx.TenantStaffMembers.Add(staff);
                await ctx.SaveChangesAsync();
            }

            var (accessToken, refreshToken, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "TenantStaff", tenantId, null, propId, "PropertyScoped", "Manager");

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                ctx.RefreshTokens.Add(new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Token = refreshToken,
                    ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
                });
                await ctx.SaveChangesAsync();
            }

            // Execute refresh handler
            await using (var refreshCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);
                var handler = new RefreshTokenCommandHandler(refreshCtx, jwtService, membershipLookup);
                var response = await handler.Handle(new RefreshTokenCommand(accessToken, refreshToken), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.NotEqual(refreshToken, response.RefreshToken);

                // Verify old token is marked revoked with ReplacedByToken
                var oldTokenInDb = await refreshCtx.RefreshTokens.FirstAsync(rt => rt.Token == refreshToken);
                Assert.NotNull(oldTokenInDb.RevokedAtUtc);
                Assert.Equal(response.RefreshToken, oldTokenInDb.ReplacedByToken);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group6_RefreshToken_ConcurrentRequest_Within5Seconds_Returns409Conflict()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var userId = Guid.NewGuid();
            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);

            var tenantService = new MockTenantService();
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                ctx.Users.Add(user);

                // Seed token revoked 2 seconds ago (within 5-second window)
                ctx.RefreshTokens.Add(new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Token = "t0_token",
                    ReplacedByToken = "t1_token",
                    RevokedAtUtc = DateTime.UtcNow.AddSeconds(-2),
                    ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
                });
                await ctx.SaveChangesAsync();
            }

            var (expiredAccessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "Customer", null, null);

            await using (var refreshCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);
                var handler = new RefreshTokenCommandHandler(refreshCtx, jwtService, membershipLookup);
                var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                    handler.Handle(new RefreshTokenCommand(expiredAccessToken, "t0_token"), CancellationToken.None));

                Assert.Equal("ERR_REFRESH_CONCURRENCY", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group6_RefreshToken_Reuse_Outside5Seconds_RevokesEntireFamily()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var userId = Guid.NewGuid();
            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);

            var tenantService = new MockTenantService();
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                ctx.Users.Add(user);

                // Chain: T0 -> T1 -> T2
                // T0 was revoked 30 seconds ago
                var t0 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t0", ReplacedByToken = "t1", RevokedAtUtc = DateTime.UtcNow.AddSeconds(-30), ExpiresAtUtc = DateTime.UtcNow.AddDays(7) };
                var t1 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t1", ReplacedByToken = "t2", RevokedAtUtc = DateTime.UtcNow.AddSeconds(-15), ExpiresAtUtc = DateTime.UtcNow.AddDays(7) };
                var t2 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t2", ExpiresAtUtc = DateTime.UtcNow.AddDays(7) }; // Active

                // Independent Device session: B0 -> B1
                var b0 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "b0", ReplacedByToken = "b1", RevokedAtUtc = DateTime.UtcNow.AddSeconds(-20), ExpiresAtUtc = DateTime.UtcNow.AddDays(7) };
                var b1 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "b1", ExpiresAtUtc = DateTime.UtcNow.AddDays(7) }; // Active

                ctx.RefreshTokens.AddRange(t0, t1, t2, b0, b1);
                await ctx.SaveChangesAsync();
            }

            var (expiredAccessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "Customer", null, null);

            // Attacker reuses T0 outside 5 seconds
            await using (var refreshCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);
                var handler = new RefreshTokenCommandHandler(refreshCtx, jwtService, membershipLookup);
                var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                    handler.Handle(new RefreshTokenCommand(expiredAccessToken, "t0"), CancellationToken.None));

                Assert.Contains("ERR_TOKEN_REUSED", ex.Message);
            }

            // Verify: T2 is now REVOKED, but B1 remains ACTIVE!
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var t2InDb = await verifyCtx.RefreshTokens.FirstAsync(rt => rt.Token == "t2");
                Assert.NotNull(t2InDb.RevokedAtUtc); // Family revoked!

                var b1InDb = await verifyCtx.RefreshTokens.FirstAsync(rt => rt.Token == "b1");
                Assert.Null(b1InDb.RevokedAtUtc); // Device B session preserved!
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group6_SwitchContext_SwitchesProperty_And_IssuesScopedTokens()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var propId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "R", Code = "R" };
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = propId, StaffRole = StaffRole.Manager, IsActive = true };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                ctx.TenantStaffMembers.Add(staff);
                await ctx.SaveChangesAsync();
            }

            var userContext = new MockUserContext { UserId = userId, TenantId = tenantId };

            await using (var switchCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new SwitchContextCommandHandler(switchCtx, userContext, membershipLookup, jwtService);
                var response = await handler.Handle(new SwitchContextCommand(propId), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.Equal(propId, response.CurrentContext.PropertyId);
                Assert.Equal("PropertyScoped", response.CurrentContext.Scope);

                // Verify new refresh token persisted
                var rtInDb = await switchCtx.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == response.RefreshToken);
                Assert.NotNull(rtInDb);
                Assert.Equal(userId, rtInDb.UserId);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group1_RefreshToken_TamperedClaimsAlias_ThrowsUnauthorized()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);
            var tenantService = new MockTenantService();

            var userId = Guid.NewGuid();
            var t1 = Guid.NewGuid();
            var t2 = Guid.NewGuid();

            var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var key = System.Text.Encoding.UTF8.GetBytes(config["JwtSettings:SecretKey"]!);
            var creds = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);

            var claims = new List<System.Security.Claims.Claim>
            {
                new("sub", userId.ToString()),
                new("tenantId", t1.ToString()),
                new("tid", t2.ToString()) // Mismatched alias!
            };

            var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                issuer: config["JwtSettings:Issuer"],
                audience: config["JwtSettings:Audience"],
                claims: claims,
                notBefore: DateTime.UtcNow.AddMinutes(-10),
                expires: DateTime.UtcNow.AddMinutes(-5),
                signingCredentials: creds);

            var tamperedTokenStr = tokenHandler.WriteToken(jwt);

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            var handler = new RefreshTokenCommandHandler(ctx, jwtService, membershipLookup);

            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler.Handle(new RefreshTokenCommand(tamperedTokenStr, "dummy_refresh"), CancellationToken.None));
            Assert.Contains("ERR_TOKEN_TAMPERED", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group1_RefreshToken_RevokedMembership_ThrowsUnauthorized()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "R", Code = "R" };
                // Membership is INACTIVE (revoked)
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = propId, StaffRole = StaffRole.Manager, IsActive = false };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                ctx.TenantStaffMembers.Add(staff);
                ctx.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "rf_token", ExpiresAtUtc = DateTime.UtcNow.AddDays(7) });
                await ctx.SaveChangesAsync();
            }

            var (accessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "TenantStaff", tenantId, null, propId, "PropertyScoped", "Manager");

            await using (var refreshCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new RefreshTokenCommandHandler(refreshCtx, jwtService, membershipLookup);
                var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                    handler.Handle(new RefreshTokenCommand(accessToken, "rf_token"), CancellationToken.None));
                Assert.Contains("ERR_MEMBERSHIP_REVOKED", ex.Message);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group1_RefreshToken_InactiveTenant_ThrowsUnauthorized()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                // Tenant is Suspended
                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C", Status = TenantStatus.Suspended };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "R", Code = "R" };
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = propId, StaffRole = StaffRole.Manager, IsActive = true };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                ctx.TenantStaffMembers.Add(staff);
                ctx.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "rf_token", ExpiresAtUtc = DateTime.UtcNow.AddDays(7) });
                await ctx.SaveChangesAsync();
            }

            var (accessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "TenantStaff", tenantId, null, propId, "PropertyScoped", "Manager");

            await using (var refreshCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new RefreshTokenCommandHandler(refreshCtx, jwtService, membershipLookup);
                var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                    handler.Handle(new RefreshTokenCommand(accessToken, "rf_token"), CancellationToken.None));
                Assert.Contains("ERR_TENANT_INACTIVE", ex.Message);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group2_MembershipLookup_PropertyValidation_Tests()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var pActive = Guid.NewGuid();
            var pInactive = Guid.NewGuid();
            var pTenantB = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantServiceA = new MockTenantService { TenantId = tenantA };
            var tenantServiceB = new MockTenantService { TenantId = tenantB };

            await using (var ctxA = CreateDbContext(conn.ConnectionString, testSchema, tenantServiceA))
            {
                await ctxA.Database.MigrateAsync();

                var tA = new Tenant { Id = tenantA, Name = "TA", Code = "TA", Slug = "ta", Address = "A", City = "C" };
                var propActive = new Property { Id = pActive, TenantId = tenantA, Name = "PA", Code = "PA", Slug = "pa", Address = "A", City = "C", Status = PropertyStatus.Active };
                var propInactive = new Property { Id = pInactive, TenantId = tenantA, Name = "PI", Code = "PI", Slug = "pi", Address = "A", City = "C", Status = PropertyStatus.Inactive };

                var user = new User { Id = userId, Username = "u", Email = "u@ta.com", PasswordHash = "h", FullName = "U", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantA, Name = "R", Code = "R" };
                var ownerStaff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantA, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };

                ctxA.Tenants.Add(tA);
                ctxA.Properties.AddRange(propActive, propInactive);
                ctxA.Users.Add(user);
                ctxA.AccessRoles.Add(role);
                ctxA.TenantStaffMembers.Add(ownerStaff);
                await ctxA.SaveChangesAsync();
            }

            // Seed Tenant B and its property under tenantServiceB
            await using (var ctxB = CreateDbContext(conn.ConnectionString, testSchema, tenantServiceB))
            {
                var tB = new Tenant { Id = tenantB, Name = "TB", Code = "TB", Slug = "tb", Address = "B", City = "C" };
                var propB = new Property { Id = pTenantB, TenantId = tenantB, Name = "PB", Code = "PB", Slug = "pb", Address = "B", City = "C", Status = PropertyStatus.Active };

                ctxB.Tenants.Add(tB);
                ctxB.Properties.Add(propB);
                await ctxB.SaveChangesAsync();
            }

            // Test 1: Non-existent property ID
            var resNonexistent = await membershipLookup.ResolveMembershipAsync(tenantA, userId, Guid.NewGuid());
            Assert.Equal(MembershipLookupStatus.PropertyNotFound, resNonexistent.Status);

            // Test 2: Cross-tenant property ID (Property of Tenant B requested from Tenant A)
            var resCrossTenant = await membershipLookup.ResolveMembershipAsync(tenantA, userId, pTenantB);
            Assert.Equal(MembershipLookupStatus.PropertyNotFound, resCrossTenant.Status);

            // Test 3: Inactive property
            var resInactive = await membershipLookup.ResolveMembershipAsync(tenantA, userId, pInactive);
            Assert.Equal(MembershipLookupStatus.PropertyInactive, resInactive.Status);

            // Test 4: Active valid property
            var resActive = await membershipLookup.ResolveMembershipAsync(tenantA, userId, pActive);
            Assert.Equal(MembershipLookupStatus.Success, resActive.Status);
            Assert.Equal(PropertyStatus.Active, resActive.PropertyStatus);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group3_MutationGuard_Owner_TamperingScope_OnDetachedEntity_ThrowsForbidden()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var roomP2Id = Guid.NewGuid();
            var rtId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var ownerPropService = new MockPropertyService { PropertyId = null, IsTenantWide = true };

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, ownerPropService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C" };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C" };
                var rt2 = new RoomType { Id = rtId, TenantId = tenantId, PropertyId = p2, Name = "Standard", Code = "STD", BasePrice = 100, MaxOccupancy = 2 };
                var roomP2 = new Room { Id = roomP2Id, TenantId = tenantId, PropertyId = p2, RoomTypeId = rtId, RoomNumber = "201", Floor = 2 };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(prop1, prop2);
                ctx.RoomTypes.Add(rt2);
                ctx.Rooms.Add(roomP2);
                await ctx.SaveChangesAsync();
            }

            // Owner attempts to update a detached entity targeting Room P2 with forged PropertyId = P1
            await using (var updateCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, ownerPropService))
            {
                var forgedRoom = new Room { Id = roomP2Id, TenantId = tenantId, PropertyId = p1, RoomTypeId = rtId, RoomNumber = "201-tampered" };
                updateCtx.Rooms.Update(forgedRoom);

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => updateCtx.SaveChangesAsync());
                Assert.Equal("ERR_IMMUTABLE_SCOPE_FIELDS", ex.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group4_Owner_SwitchContext_PreservesTenantWideScope()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var propId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService { TenantId = tenantId };
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop = new Property { Id = propId, TenantId = tenantId, Name = "P", Code = "P", Slug = "p", Address = "A", City = "C" };
                var user = new User { Id = userId, Username = "owner", Email = "owner@t.com", PasswordHash = "h", FullName = "Owner", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "Owner", Code = "OWNER" };
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                ctx.TenantStaffMembers.Add(staff);
                await ctx.SaveChangesAsync();
            }

            var userContext = new MockUserContext { UserId = userId, TenantId = tenantId, IsTenantWide = true };

            await using (var switchCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new SwitchContextCommandHandler(switchCtx, userContext, membershipLookup, jwtService);
                var response = await handler.Handle(new SwitchContextCommand(propId), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.Equal(propId, response.CurrentContext.PropertyId);
                Assert.Equal("TenantWide", response.CurrentContext.Scope); // Preserves TenantWide!
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group6_RealRace_TwoConcurrentRefreshRequests_OneSucceeds_OneReturns409Conflict()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var userId = Guid.NewGuid();
            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService();
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                ctx.Users.Add(user);

                ctx.RefreshTokens.Add(new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Token = "t0_concurrent",
                    ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
                });
                await ctx.SaveChangesAsync();
            }

            var (expiredAccessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "Customer", null, null);

            var readyBarrier = new Barrier(2);
            var task1 = Task.Run(async () =>
            {
                readyBarrier.SignalAndWait();
                await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
                var handler1 = new RefreshTokenCommandHandler(ctx1, jwtService, membershipLookup);
                try
                {
                    return await handler1.Handle(new RefreshTokenCommand(expiredAccessToken, "t0_concurrent"), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    return (object)ex;
                }
            });

            var task2 = Task.Run(async () =>
            {
                readyBarrier.SignalAndWait();
                await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
                var handler2 = new RefreshTokenCommandHandler(ctx2, jwtService, membershipLookup);
                try
                {
                    return await handler2.Handle(new RefreshTokenCommand(expiredAccessToken, "t0_concurrent"), CancellationToken.None);
                }
                catch (Exception ex)
                {
                    return (object)ex;
                }
            });

            var results = await Task.WhenAll(task1, task2);

            var successCount = results.Count(r => r is LoginResponse);
            var conflictCount = results.Count(r => r is ConflictException ce && ce.ErrorCode == "ERR_REFRESH_CONCURRENCY");

            Assert.Equal(1, successCount); // Exactly one succeeds!
            Assert.Equal(1, conflictCount); // Exactly one receives 409 Conflict!
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group6_RealRace_RotationHoldsUsersLockFirst_RevocationWaits_ThenRevokesNewToken()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var userId = Guid.NewGuid();
            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var tenantService = new MockTenantService();
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();

                var user = new User { Id = userId, Username = "u", Email = "u@t.com", PasswordHash = "h", FullName = "U", IsActive = true };
                ctx.Users.Add(user);

                // Chain: T0 -> T1 -> T2
                var t0 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t0", ReplacedByToken = "t1", RevokedAtUtc = DateTime.UtcNow.AddSeconds(-30), ExpiresAtUtc = DateTime.UtcNow.AddDays(7) };
                var t1 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t1", ReplacedByToken = "t2", RevokedAtUtc = DateTime.UtcNow.AddSeconds(-15), ExpiresAtUtc = DateTime.UtcNow.AddDays(7) };
                var t2 = new RefreshToken { Id = Guid.NewGuid(), UserId = userId, Token = "t2", ExpiresAtUtc = DateTime.UtcNow.AddDays(7) }; // Active

                ctx.RefreshTokens.AddRange(t0, t1, t2);
                await ctx.SaveChangesAsync();
            }

            var (expiredAccessToken, _, _) = jwtService.GenerateTokens(userId, "u@t.com", "U", "Customer", null, null);

            var lockAcquired = new ManualResetEventSlim(false);

            // Thread 1: Rotation T2 -> T3 acquires lock on Users row and holds it
            var taskRotation = Task.Run(async () =>
            {
                await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
                await using var tx1 = await ctx1.BeginTransactionAsync();
                await ctx1.LockUserRowAsync(userId);
                lockAcquired.Set(); // Signal that Connection 1 holds the lock!
                await Task.Delay(300); // Give Thread 2 time to begin and block on the same Users row

                // Perform rotation T2 -> T3 inside Tx1
                var t2 = await ctx1.RefreshTokens.FirstAsync(rt => rt.Token == "t2");
                t2.RevokedAtUtc = DateTime.UtcNow;
                t2.ReplacedByToken = "t3";
                ctx1.RefreshTokens.Add(new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Token = "t3",
                    ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
                });
                await ctx1.SaveChangesAsync();
                await tx1.CommitAsync();
            });

            // Thread 2: Revocation of reused T0 starts, waits for lock on Users row, then unblocks
            var taskRevocation = Task.Run(async () =>
            {
                lockAcquired.Wait(); // Ensure Thread 1 already took the lock
                await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
                var handler2 = new RefreshTokenCommandHandler(ctx2, jwtService, membershipLookup);

                // Thread 2 will block at LockUserRowAsync until Thread 1 commits Tx1
                var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                    handler2.Handle(new RefreshTokenCommand(expiredAccessToken, "t0"), CancellationToken.None));
                Assert.Contains("ERR_TOKEN_REUSED", ex.Message);
            });

            await Task.WhenAll(taskRotation, taskRevocation);

            // Verify: T3 was committed by Task 1, but Task 2 woke up, performed fresh read, and revoked T3 as well!
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var t3InDb = await verifyCtx.RefreshTokens.FirstAsync(rt => rt.Token == "t3");
                Assert.NotNull(t3InDb.RevokedAtUtc); // Zero Escaped Tokens! T3 was revoked!
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // GROUP 7: TARGET PROPERTY UNIFICATION & MEMBERSHIP RESOLVER MUTATION TESTS
    // =========================================================================

    [Fact]
    public async Task Group7_TargetProperty_Owner_HeaderP1_BodyP2_Revoked_ThrowsContextMismatch_NoRecordCreated()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var rtP2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService
            {
                PropertyId = p1,
                HeaderPropertyId = p1,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };
            var userContext = new MockUserContext
            {
                UserId = userId,
                TenantId = tenantId,
                PropertyId = p1,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };

            var seedPropService = new MockPropertyService { IsTenantWide = true };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, seedPropService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "owner", Email = "owner@t.com", PasswordHash = "h", FullName = "Owner", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "OwnerRole", Code = "OWNER" };

                // Owner has tenant-wide membership, BUT explicit membership at P2 is REVOKED (IsActive = false)
                var ownerStaff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };
                var revokedStaffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Owner, IsActive = false };

                var roomTypeP2 = new RoomType { Id = rtP2Id, TenantId = tenantId, PropertyId = p2, Name = "RT2", Code = "RT2", BasePrice = 100, MaxOccupancy = 2 };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(ownerStaff, revokedStaffP2);
                seedCtx.RoomTypes.Add(roomTypeP2);
                await seedCtx.SaveChangesAsync();
            }

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            // Execute CreateRoom with Header P1 and Body targeting P2
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                var handler = new CreateRoomCommandHandler(reqCtx, tenantService, propertyService, userContext, membershipLookup);
                var cmd = new CreateRoomCommand(
                    RoomNumber: "101",
                    RoomTypeId: rtP2Id,
                    Floor: 1,
                    Notes: "Attempting create with Header P1 and Body P2",
                    PropertyId: p2);

                var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
                Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
            }

            // Verify: Database has ZERO new rooms created
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var roomsP2 = await verifyCtx.Rooms.IgnoreQueryFilters().Where(r => r.PropertyId == p2).ToListAsync();
                Assert.Empty(roomsP2);

                var roomsP1 = await verifyCtx.Rooms.IgnoreQueryFilters().Where(r => r.PropertyId == p1).ToListAsync();
                Assert.Empty(roomsP1);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group7_TargetProperty_Owner_OnlyBodyP2_Revoked_ThrowsMembershipRevoked_NoRecordCreated()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var rtP2Id = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            // NO Header X-Property-Id: Owner operates in pure tenant-wide mode without header
            var propertyService = new MockPropertyService
            {
                PropertyId = null,
                HeaderPropertyId = null,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };
            var userContext = new MockUserContext
            {
                UserId = userId,
                TenantId = tenantId,
                PropertyId = null,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };

            var seedPropService = new MockPropertyService { IsTenantWide = true };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, seedPropService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "owner", Email = "owner@t.com", PasswordHash = "h", FullName = "Owner", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "OwnerRole", Code = "OWNER" };

                // Owner has tenant-wide membership, BUT explicit membership at P2 is REVOKED (IsActive = false)
                var ownerStaff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };
                var revokedStaffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Owner, IsActive = false };

                var roomTypeP2 = new RoomType { Id = rtP2Id, TenantId = tenantId, PropertyId = p2, Name = "RT2", Code = "RT2", BasePrice = 100, MaxOccupancy = 2 };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(ownerStaff, revokedStaffP2);
                seedCtx.RoomTypes.Add(roomTypeP2);
                await seedCtx.SaveChangesAsync();
            }

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            // Execute CreateRoom with ONLY body specifying P2 (no header)
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                var handler = new CreateRoomCommandHandler(reqCtx, tenantService, propertyService, userContext, membershipLookup);
                var cmd = new CreateRoomCommand(
                    RoomNumber: "102",
                    RoomTypeId: rtP2Id,
                    Floor: 1,
                    Notes: "Attempting create with ONLY body specifying P2",
                    PropertyId: p2);

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
                Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex.ErrorCode);
            }

            // Verify: Database has ZERO new rooms created
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var roomsP2 = await verifyCtx.Rooms.IgnoreQueryFilters().Where(r => r.PropertyId == p2).ToListAsync();
                Assert.Empty(roomsP2);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group7_TargetProperty_RoomType_Owner_HeaderP1_BodyP2_ThrowsContextMismatch_NoRecordCreated()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService
            {
                PropertyId = p1,
                HeaderPropertyId = p1,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };
            var userContext = new MockUserContext
            {
                UserId = userId,
                TenantId = tenantId,
                PropertyId = p1,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "owner", Email = "owner@t.com", PasswordHash = "h", FullName = "Owner", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "OwnerRole", Code = "OWNER" };

                var ownerStaff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };
                var revokedStaffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Owner, IsActive = false };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(ownerStaff, revokedStaffP2);
                await seedCtx.SaveChangesAsync();
            }

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            // Execute CreateRoomType with Header P1 and Body targeting P2
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                var handler = new CreateRoomTypeCommandHandler(reqCtx, tenantService, propertyService, userContext, membershipLookup);
                var cmd = new CreateRoomTypeCommand(
                    Name: "VIP Type",
                    Code: "VIP-MISMATCH",
                    Description: null,
                    BasePrice: 500,
                    MaxOccupancy: 2,
                    BedType: null,
                    SquareMeters: null,
                    ImageUrl: null,
                    PropertyId: p2);

                var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
                Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
            }

            // Verify: Database has ZERO room types created with code VIP-MISMATCH
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var rtP2 = await verifyCtx.RoomTypes.IgnoreQueryFilters().Where(rt => rt.Code == "VIP-MISMATCH").ToListAsync();
                Assert.Empty(rtP2);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group7_TargetProperty_RoomType_Owner_OnlyBodyP2_Revoked_ThrowsMembershipRevoked_NoRecordCreated()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            // NO Header X-Property-Id: Owner operates in pure tenant-wide mode without header
            var propertyService = new MockPropertyService
            {
                PropertyId = null,
                HeaderPropertyId = null,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };
            var userContext = new MockUserContext
            {
                UserId = userId,
                TenantId = tenantId,
                PropertyId = null,
                IsTenantWide = true,
                ExcludedPropertyIds = new[] { p2 }
            };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "T", Code = "T", Slug = "t", Address = "A", City = "C" };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "P1", Code = "P1", Slug = "p1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "P2", Code = "P2", Slug = "p2", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "owner", Email = "owner@t.com", PasswordHash = "h", FullName = "Owner", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "OwnerRole", Code = "OWNER" };

                var ownerStaff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = null, StaffRole = StaffRole.Owner, IsActive = true };
                var revokedStaffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Owner, IsActive = false };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(ownerStaff, revokedStaffP2);
                await seedCtx.SaveChangesAsync();
            }

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            // Execute CreateRoomType with ONLY body specifying P2 (no header)
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService))
            {
                var handler = new CreateRoomTypeCommandHandler(reqCtx, tenantService, propertyService, userContext, membershipLookup);
                var cmd = new CreateRoomTypeCommand(
                    Name: "VIP Type 2",
                    Code: "VIP-REVOKED",
                    Description: null,
                    BasePrice: 500,
                    MaxOccupancy: 2,
                    BedType: null,
                    SquareMeters: null,
                    ImageUrl: null,
                    PropertyId: p2);

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
                Assert.Equal("ERR_MEMBERSHIP_REVOKED", ex.ErrorCode);
            }

            // Verify: Database has ZERO room types created with code VIP-REVOKED
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var rtP2 = await verifyCtx.RoomTypes.IgnoreQueryFilters().Where(rt => rt.Code == "VIP-REVOKED").ToListAsync();
                Assert.Empty(rtP2);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_MultiBranchStaff_Login_DoesNotPickFirstBranch_ReturnsAllMemberships()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var role1Id = Guid.NewGuid();
            var role2Id = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var hasher = new PasswordHasherService();
            var tenantService = new MockTenantService { TenantId = tenantId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Grand Hotel Group", Code = "GHG", Slug = "ghg", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch 1", Code = "B1", Slug = "b1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "Branch 2", Code = "B2", Slug = "b2", Address = "A", City = "C", Status = PropertyStatus.Active };

                var user = new User
                {
                    Id = userId,
                    Username = "multistaff",
                    Email = "multistaff@ghg.com",
                    PasswordHash = hasher.Hash("Password123!"),
                    FullName = "Multi Staff",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role1 = new AccessRole { Id = role1Id, TenantId = tenantId, Name = "ManagerRole", Code = "MGR" };
                var role2 = new AccessRole { Id = role2Id, TenantId = tenantId, Name = "ReceptionRole", Code = "REC" };

                // User has active staff membership at P1 and at P2, but NO tenant-wide role
                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role1Id, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };
                var staffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role2Id, PropertyId = p2, StaffRole = StaffRole.Receptionist, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.AddRange(role1, role2);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                await seedCtx.SaveChangesAsync();
            }

            // Execute Login
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new LoginCommandHandler(reqCtx, hasher, jwtService);
                var response = await handler.Handle(new LoginCommand("multistaff@ghg.com", "Password123!"), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.NotNull(response.Memberships);
                Assert.Equal(2, response.Memberships.Count);

                // Verify both branch memberships are returned in bootstrap payload
                Assert.Contains(response.Memberships, m => m.PropertyId == p1 && m.StaffRole == "Manager");
                Assert.Contains(response.Memberships, m => m.PropertyId == p2 && m.StaffRole == "Receptionist");

                // Verify access token does NOT implicitly select the first branch
                var principal = jwtService.GetPrincipalFromExpiredToken(response.AccessToken);
                var propClaim = principal.FindFirst("propertyId")?.Value;
                var pidClaim = principal.FindFirst("pid")?.Value;
                var scopeClaim = principal.FindFirst("scope")?.Value;

                Assert.Null(propClaim);
                Assert.Null(pidClaim);
                Assert.Null(scopeClaim);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_GetMyMembershipsQuery_ReturnsAllValidActiveContexts()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenantId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Resort Group", Code = "RG", Slug = "rg", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Beach Resort", Code = "BR", Slug = "br", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "Mountain Villa", Code = "MV", Slug = "mv", Address = "A", City = "C", Status = PropertyStatus.Active };

                var user = new User { Id = userId, Username = "resortstaff", Email = "staff@rg.com", PasswordHash = "h", FullName = "Staff", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "StaffRole", Code = "STF" };

                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };
                var staffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Manager, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                await seedCtx.SaveChangesAsync();
            }

            // Execute GetMyMembershipsQuery
            await using (var reqCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                var handler = new GetMyMembershipsQueryHandler(reqCtx, userContext);
                var memberships = await handler.Handle(new GetMyMembershipsQuery(), CancellationToken.None);

                Assert.NotNull(memberships);
                Assert.Equal(2, memberships.Count);
                Assert.Contains(memberships, m => m.PropertyId == p1 && m.PropertyName == "Beach Resort");
                Assert.Contains(memberships, m => m.PropertyId == p2 && m.PropertyName == "Mountain Villa");
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_MultiBranchStaff_CallingBusinessEndpointWithoutProperty_ResolvesPropertyRequired()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Chain Group", Code = "CG", Slug = "cg", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch 1", Code = "B1", Slug = "b1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "Branch 2", Code = "B2", Slug = "b2", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "staff", Email = "staff@cg.com", PasswordHash = "h", FullName = "Staff", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "StaffRole", Code = "STF" };

                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };
                var staffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p2, StaffRole = StaffRole.Receptionist, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                await seedCtx.SaveChangesAsync();
            }

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            // TargetPropertyId = null for multi-branch staff calling without choosing branch
            var lookupResult = await membershipLookup.ResolveMembershipAsync(tenantId, userId, null);

            Assert.Equal(MembershipLookupStatus.PropertyRequired, lookupResult.Status);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_DbContext_NullContext_TwoBranches_ReturnsTwoMemberships_BootstrapToken()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var role1Id = Guid.NewGuid();
            var role2Id = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var hasher = new PasswordHasherService();

            var setupTenantService = new MockTenantService { TenantId = tenantId };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, setupTenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Grand Hotel Group", Code = "GHG", Slug = "ghg", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch 1", Code = "B1", Slug = "b1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "Branch 2", Code = "B2", Slug = "b2", Address = "A", City = "C", Status = PropertyStatus.Active };

                var user = new User
                {
                    Id = userId,
                    Username = "multistaff_nullctx",
                    Email = "multistaff_nullctx@ghg.com",
                    PasswordHash = hasher.Hash("Password123!"),
                    FullName = "Multi Staff Null Ctx",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role1 = new AccessRole { Id = role1Id, TenantId = tenantId, Name = "ManagerRole", Code = "MGR" };
                var role2 = new AccessRole { Id = role2Id, TenantId = tenantId, Name = "ReceptionRole", Code = "REC" };

                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role1Id, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };
                var staffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role2Id, PropertyId = p2, StaffRole = StaffRole.Receptionist, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.AddRange(role1, role2);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                await seedCtx.SaveChangesAsync();
            }

            // CRITICAL VERIFICATION: Fresh DbContext with BOTH TenantId and PropertyId NULL
            var nullTenantService = new MockTenantService { TenantId = null };
            var nullPropertyService = new MockPropertyService { PropertyId = null, IsTenantWide = false };

            await using (var loginCtx = CreateDbContext(conn.ConnectionString, testSchema, nullTenantService, nullPropertyService))
            {
                var handler = new LoginCommandHandler(loginCtx, hasher, jwtService);
                var response = await handler.Handle(new LoginCommand("multistaff_nullctx@ghg.com", "Password123!"), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.NotNull(response.Memberships);
                Assert.Equal(2, response.Memberships.Count);

                Assert.Contains(response.Memberships, m => m.PropertyId == p1 && m.StaffRole == "Manager");
                Assert.Contains(response.Memberships, m => m.PropertyId == p2 && m.StaffRole == "Receptionist");

                var principal = jwtService.GetPrincipalFromExpiredToken(response.AccessToken);
                Assert.Null(principal.FindFirst("propertyId")?.Value);
                Assert.Null(principal.FindFirst("pid")?.Value);
                Assert.Null(principal.FindFirst("scope")?.Value);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_DbContext_NullContext_SingleBranch_ResolvesContextDirectly()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var role1Id = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var hasher = new PasswordHasherService();

            var setupTenantService = new MockTenantService { TenantId = tenantId };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, setupTenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Single Branch Hotel", Code = "SBH", Slug = "sbh", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch 1", Code = "B1", Slug = "b1", Address = "A", City = "C", Status = PropertyStatus.Active };

                var user = new User
                {
                    Id = userId,
                    Username = "singlestaff_nullctx",
                    Email = "singlestaff_nullctx@sbh.com",
                    PasswordHash = hasher.Hash("Password123!"),
                    FullName = "Single Staff Null Ctx",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role1 = new AccessRole { Id = role1Id, TenantId = tenantId, Name = "ManagerRole", Code = "MGR" };
                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role1Id, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(prop1);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role1);
                seedCtx.TenantStaffMembers.Add(staffP1);
                await seedCtx.SaveChangesAsync();
            }

            // CRITICAL VERIFICATION: Fresh DbContext with BOTH TenantId and PropertyId NULL
            var nullTenantService = new MockTenantService { TenantId = null };
            var nullPropertyService = new MockPropertyService { PropertyId = null, IsTenantWide = false };

            await using (var loginCtx = CreateDbContext(conn.ConnectionString, testSchema, nullTenantService, nullPropertyService))
            {
                var handler = new LoginCommandHandler(loginCtx, hasher, jwtService);
                var response = await handler.Handle(new LoginCommand("singlestaff_nullctx@sbh.com", "Password123!"), CancellationToken.None);

                Assert.NotNull(response.AccessToken);
                Assert.NotNull(response.RefreshToken);
                Assert.NotNull(response.Memberships);
                Assert.Single(response.Memberships);
                Assert.Equal(p1, response.Memberships[0].PropertyId);

                var principal = jwtService.GetPrincipalFromExpiredToken(response.AccessToken);
                var propClaim = principal.FindFirst("propertyId")?.Value ?? principal.FindFirst("pid")?.Value;
                var scopeClaim = principal.FindFirst("scope")?.Value;

                Assert.Equal(p1.ToString(), propClaim);
                Assert.Equal("PropertyScoped", scopeClaim);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_DbContext_NullContext_WrongPassword_ThrowsUnauthorized_BeforeMembershipLookup()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var hasher = new PasswordHasherService();

            var setupTenantService = new MockTenantService { TenantId = tenantId };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, setupTenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Secure Hotel", Code = "SH", Slug = "sh", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch 1", Code = "B1", Slug = "b1", Address = "A", City = "C", Status = PropertyStatus.Active };
                var user = new User { Id = userId, Username = "secstaff", Email = "secstaff@sh.com", PasswordHash = hasher.Hash("CorrectPassword!"), FullName = "Staff", IsActive = true };
                var role = new AccessRole { Id = roleId, TenantId = tenantId, Name = "Role", Code = "ROL" };
                var staff = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = roleId, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(prop1);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.TenantStaffMembers.Add(staff);
                await seedCtx.SaveChangesAsync();
            }

            var nullTenantService = new MockTenantService { TenantId = null };
            var nullPropertyService = new MockPropertyService { PropertyId = null, IsTenantWide = false };

            await using (var loginCtx = CreateDbContext(conn.ConnectionString, testSchema, nullTenantService, nullPropertyService))
            {
                var handler = new LoginCommandHandler(loginCtx, hasher, jwtService);
                await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                    handler.Handle(new LoginCommand("secstaff@sh.com", "WrongPassword!"), CancellationToken.None));
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Group8_Bootstrap_HttpPipeline_EndToEnd_Login_Memberships_SwitchContext_BusinessEndpoint()
    {
        var testSchema = $"p1b02b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var role1Id = Guid.NewGuid();
            var role2Id = Guid.NewGuid();

            var config = CreateConfiguration(conn.ConnectionString, testSchema);
            var jwtService = new JwtService(config);
            var hasher = new PasswordHasherService();
            var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);

            var setupTenantService = new MockTenantService { TenantId = tenantId };
            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, setupTenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant { Id = tenantId, Name = "Pipeline Hotel Group", Code = "PHG", Slug = "phg", Address = "A", City = "C", Status = TenantStatus.Active };
                var prop1 = new Property { Id = p1, TenantId = tenantId, Name = "Branch Alpha", Code = "BA", Slug = "ba", Address = "A", City = "C", Status = PropertyStatus.Active };
                var prop2 = new Property { Id = p2, TenantId = tenantId, Name = "Branch Beta", Code = "BB", Slug = "bb", Address = "A", City = "C", Status = PropertyStatus.Active };

                var user = new User
                {
                    Id = userId,
                    Username = "pipeline_staff",
                    Email = "pipeline_staff@phg.com",
                    PasswordHash = hasher.Hash("SecureP@ss123"),
                    FullName = "Pipeline Staff",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role1 = new AccessRole { Id = role1Id, TenantId = tenantId, Name = "ManagerRole", Code = "MGR" };
                var role2 = new AccessRole { Id = role2Id, TenantId = tenantId, Name = "ReceptionRole", Code = "REC" };

                var staffP1 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role1Id, PropertyId = p1, StaffRole = StaffRole.Manager, IsActive = true };
                var staffP2 = new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, RoleId = role2Id, PropertyId = p2, StaffRole = StaffRole.Receptionist, IsActive = true };

                var rtP1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, Name = "Standard P1", Code = "STD-P1", BasePrice = 100, MaxOccupancy = 2 };
                var rtP2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, Name = "Standard P2", Code = "STD-P2", BasePrice = 100, MaxOccupancy = 2 };

                var roomP1 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p1, RoomTypeId = rtP1.Id, RoomNumber = "101-ALPHA", Floor = 1, Status = RoomStatus.Clean, IsActive = true };
                var roomP2 = new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = p2, RoomTypeId = rtP2.Id, RoomNumber = "201-BETA", Floor = 2, Status = RoomStatus.Clean, IsActive = true };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.AddRange(role1, role2);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                seedCtx.RoomTypes.AddRange(rtP1, rtP2);
                seedCtx.Rooms.AddRange(roomP1, roomP2);
                await seedCtx.SaveChangesAsync();
            }

            // ── STEP 1: HTTP Login in Null Ambient Context ──────────────────────
            var nullTenantService = new MockTenantService { TenantId = null };
            var nullPropertyService = new MockPropertyService { PropertyId = null, IsTenantWide = false };

            LoginResponse loginResult;
            await using (var loginCtx = CreateDbContext(conn.ConnectionString, testSchema, nullTenantService, nullPropertyService))
            {
                var loginHandler = new LoginCommandHandler(loginCtx, hasher, jwtService);
                loginResult = await loginHandler.Handle(new LoginCommand("pipeline_staff@phg.com", "SecureP@ss123"), CancellationToken.None);
            }

            Assert.NotNull(loginResult.AccessToken);
            Assert.NotNull(loginResult.RefreshToken);
            Assert.NotNull(loginResult.Memberships);
            Assert.Equal(2, loginResult.Memberships.Count);

            // Bootstrap token has NO property scope
            var bootstrapPrincipal = jwtService.GetPrincipalFromExpiredToken(loginResult.AccessToken);
            Assert.Null(bootstrapPrincipal.FindFirst("propertyId")?.Value);
            Assert.Null(bootstrapPrincipal.FindFirst("pid")?.Value);
            Assert.Null(bootstrapPrincipal.FindFirst("scope")?.Value);

            // ── STEP 2: HTTP GET /api/auth/me/memberships with bootstrap token ──
            var membershipsHttpContext = new DefaultHttpContext();
            membershipsHttpContext.Request.Path = "/api/auth/me/memberships";
            membershipsHttpContext.User = bootstrapPrincipal;
            membershipsHttpContext.Response.Body = new MemoryStream();

            var reqTenantSvc = new MockTenantService();
            var reqPropSvc = new MockPropertyService();
            var reqUserCtx = new CurrentUserContext(reqTenantSvc, reqPropSvc);

            var membershipsCalled = false;
            IReadOnlyList<UserMembershipDto>? retrievedMemberships = null;

            var membershipsMiddleware = new TenantPropertyContextMiddleware(async ctx =>
            {
                membershipsCalled = true;
                await using var qCtx = CreateDbContext(conn.ConnectionString, testSchema, reqTenantSvc, reqPropSvc);
                var qHandler = new GetMyMembershipsQueryHandler(qCtx, reqUserCtx);
                retrievedMemberships = await qHandler.Handle(new GetMyMembershipsQuery(), CancellationToken.None);
                ctx.Response.StatusCode = StatusCodes.Status200OK;
            }, NullLogger<TenantPropertyContextMiddleware>.Instance);

            await membershipsMiddleware.InvokeAsync(membershipsHttpContext, reqTenantSvc, reqPropSvc, reqUserCtx, membershipLookup);

            Assert.True(membershipsCalled);
            Assert.Equal(StatusCodes.Status200OK, membershipsHttpContext.Response.StatusCode);
            Assert.NotNull(retrievedMemberships);
            Assert.Equal(2, retrievedMemberships.Count);
            Assert.Contains(retrievedMemberships, m => m.PropertyId == p1 && m.PropertyName == "Branch Alpha");
            Assert.Contains(retrievedMemberships, m => m.PropertyId == p2 && m.PropertyName == "Branch Beta");

            // ── STEP 3: HTTP GET /api/rooms with bootstrap token (Business endpoint without branch context) ──
            var roomsHttpContext = new DefaultHttpContext();
            roomsHttpContext.Request.Path = "/api/rooms";
            roomsHttpContext.User = bootstrapPrincipal;
            var roomsResponseStream = new MemoryStream();
            roomsHttpContext.Response.Body = roomsResponseStream;

            var businessEndpointReached = false;
            var businessMiddleware = new TenantPropertyContextMiddleware(ctx =>
            {
                businessEndpointReached = true;
                return Task.CompletedTask;
            }, NullLogger<TenantPropertyContextMiddleware>.Instance);

            await businessMiddleware.InvokeAsync(roomsHttpContext, reqTenantSvc, reqPropSvc, reqUserCtx, membershipLookup);

            // Verified: Middleware blocks business endpoint with 403 ERR_PROPERTY_REQUIRED
            Assert.False(businessEndpointReached);
            Assert.Equal(StatusCodes.Status403Forbidden, roomsHttpContext.Response.StatusCode);
            roomsResponseStream.Seek(0, SeekOrigin.Begin);
            using (var reader = new StreamReader(roomsResponseStream))
            {
                var body = await reader.ReadToEndAsync();
                Assert.Contains("ERR_PROPERTY_REQUIRED", body);
            }

            // ── STEP 4: HTTP POST /api/auth/switch-context to P1 ─────────────────
            var switchHttpContext = new DefaultHttpContext();
            switchHttpContext.Request.Path = "/api/auth/switch-context";
            switchHttpContext.User = bootstrapPrincipal;
            switchHttpContext.Response.Body = new MemoryStream();

            var switchCalled = false;
            SwitchContextResponse? switchResult = null;

            var switchMiddleware = new TenantPropertyContextMiddleware(async ctx =>
            {
                switchCalled = true;
                await using var swCtx = CreateDbContext(conn.ConnectionString, testSchema, reqTenantSvc, reqPropSvc);
                var swHandler = new SwitchContextCommandHandler(swCtx, reqUserCtx, membershipLookup, jwtService);
                switchResult = await swHandler.Handle(new SwitchContextCommand(p1), CancellationToken.None);
                ctx.Response.StatusCode = StatusCodes.Status200OK;
            }, NullLogger<TenantPropertyContextMiddleware>.Instance);

            await switchMiddleware.InvokeAsync(switchHttpContext, reqTenantSvc, reqPropSvc, reqUserCtx, membershipLookup);

            Assert.True(switchCalled);
            Assert.Equal(StatusCodes.Status200OK, switchHttpContext.Response.StatusCode);
            Assert.NotNull(switchResult);
            Assert.Equal(p1, switchResult.CurrentContext.PropertyId);
            Assert.Equal("PropertyScoped", switchResult.CurrentContext.Scope);

            // ── STEP 5: HTTP GET /api/rooms with scoped token for P1 ────────────
            var scopedPrincipal = jwtService.GetPrincipalFromExpiredToken(switchResult.AccessToken);
            var scopedRoomsContext = new DefaultHttpContext();
            scopedRoomsContext.Request.Path = "/api/rooms";
            scopedRoomsContext.User = scopedPrincipal;
            scopedRoomsContext.Response.Body = new MemoryStream();

            var scopedBusinessReached = false;
            PagedResult<RoomDto>? queryResult = null;

            var scopedBusinessMiddleware = new TenantPropertyContextMiddleware(async ctx =>
            {
                scopedBusinessReached = true;
                await using var roomsCtx = CreateDbContext(conn.ConnectionString, testSchema, reqTenantSvc, reqPropSvc);
                var roomsHandler = new GetRoomsQueryHandler(roomsCtx);
                queryResult = await roomsHandler.Handle(new GetRoomsQuery(), CancellationToken.None);
                ctx.Response.StatusCode = StatusCodes.Status200OK;
            }, NullLogger<TenantPropertyContextMiddleware>.Instance);

            await scopedBusinessMiddleware.InvokeAsync(scopedRoomsContext, reqTenantSvc, reqPropSvc, reqUserCtx, membershipLookup);

            Assert.True(scopedBusinessReached);
            Assert.Equal(StatusCodes.Status200OK, scopedRoomsContext.Response.StatusCode);
            Assert.NotNull(queryResult);
            Assert.Single(queryResult.Items);
            Assert.Equal("101-ALPHA", queryResult.Items[0].RoomNumber);
            Assert.Equal(p1, queryResult.Items[0].PropertyId);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
