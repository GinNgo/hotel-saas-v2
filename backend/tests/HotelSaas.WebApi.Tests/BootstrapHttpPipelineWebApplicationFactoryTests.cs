using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests;

[CollectionDefinition("RealDatabaseTests", DisableParallelization = true)]
public class RealDatabaseTestsCollection { }

/// <summary>
/// End-to-end HTTP pipeline tests using WebApplicationFactory and HttpClient.
/// Exercises real routing, real authentication, real authorization, real middleware, and real DI.
/// Flow: Login -> Memberships -> Business endpoint blocked (403 ERR_PROPERTY_REQUIRED) -> Switch-Context -> Rooms scoped to P1.
/// Runs exclusively on an isolated PostgreSQL test database schema, ensuring dev/prod are untouched.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class BootstrapHttpPipelineWebApplicationFactoryTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
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

    private sealed class MockTenantService : Application.Common.Interfaces.ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : Application.Common.Interfaces.ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private static ApplicationDbContext CreateSeedDbContext(string connString, string testSchema, Guid tenantId)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    private sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForP1B02BTestingMustBeAtLeast32BytesLong!";

        public TestWebApplicationFactory(string connectionString, string testSchema)
        {
            _connectionString = connectionString;
            _testSchema = testSchema;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var testConnBuilder = new NpgsqlConnectionStringBuilder(_connectionString)
            {
                SearchPath = _testSchema
            };

            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", testConnBuilder.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", TestJwtSecretKey);
            builder.UseSetting("JwtSettings:Issuer", "HotelSaas");
            builder.UseSetting("JwtSettings:Audience", "HotelSaasClient");
            builder.UseSetting("JwtSettings:AccessTokenExpirationMinutes", "15");
            builder.UseSetting("JwtSettings:RefreshTokenExpirationDays", "7");
            builder.UseSetting("SkipStartupDatabaseInit", "true");

            builder.ConfigureAppConfiguration((_, config) =>
            {
                var testConfig = new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = testConnBuilder.ConnectionString,
                    ["JwtSettings:SecretKey"] = TestJwtSecretKey,
                    ["JwtSettings:Issuer"] = "HotelSaas",
                    ["JwtSettings:Audience"] = "HotelSaasClient",
                    ["JwtSettings:AccessTokenExpirationMinutes"] = "15",
                    ["JwtSettings:RefreshTokenExpirationDays"] = "7",
                    ["SkipStartupDatabaseInit"] = "true"
                };

                config.AddInMemoryCollection(testConfig);
            });
        }
    }

    [Fact]
    public async Task HttpPipeline_EndToEnd_Login_Memberships_BlockedBusiness_SwitchContext_ScopedRooms()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p1b02b_http_{Guid.NewGuid():N}";

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var tenantId = Guid.NewGuid();
            var p1 = Guid.NewGuid();
            var p2 = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var funcId = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Authoritative RBAC Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Grand Resort Group",
                    Code = "GRG",
                    Slug = "grg",
                    Address = "123 Ocean Blvd",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var prop1 = new Property
                {
                    Id = p1,
                    TenantId = tenantId,
                    Name = "Sea Branch",
                    Code = "SB",
                    Slug = "sb",
                    Address = "123 Ocean Blvd",
                    City = "Da Nang",
                    Status = PropertyStatus.Active
                };

                var prop2 = new Property
                {
                    Id = p2,
                    TenantId = tenantId,
                    Name = "Mountain Branch",
                    Code = "MB",
                    Slug = "mb",
                    Address = "456 Mountain View",
                    City = "Da Nang",
                    Status = PropertyStatus.Active
                };

                var user = new User
                {
                    Id = userId,
                    Username = "multistaff_http",
                    Email = "staff_http@resort.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "HTTP Multi Staff",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "StaffRole",
                    Code = "STF"
                };

                var func = new PermissionFunction
                {
                    Id = funcId,
                    Code = "ROOMS",
                    Name = "Room Management",
                    ModuleCode = "ROOMS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var rolePerm = new RolePermission
                {
                    RoleId = roleId,
                    FunctionId = funcId,
                    ActionMask = 127
                };

                // Multi-branch staff with memberships at P1 and P2, but NO tenant-wide role
                var staffP1 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    RoleId = roleId,
                    PropertyId = p1,
                    StaffRole = StaffRole.Manager,
                    IsActive = true
                };

                var staffP2 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    RoleId = roleId,
                    PropertyId = p2,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var rtP1 = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = p1,
                    Name = "Standard Sea",
                    Code = "STD-SEA",
                    BasePrice = 100,
                    MaxOccupancy = 2
                };

                var rtP2 = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = p2,
                    Name = "Standard Mtn",
                    Code = "STD-MTN",
                    BasePrice = 120,
                    MaxOccupancy = 2
                };

                var roomP1 = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = p1,
                    RoomTypeId = rtP1.Id,
                    RoomNumber = "101-SEA",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true
                };

                var roomP2 = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = p2,
                    RoomTypeId = rtP2.Id,
                    RoomNumber = "201-MTN",
                    Floor = 2,
                    Status = RoomStatus.Clean,
                    IsActive = true
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(prop1, prop2);
                seedCtx.Users.Add(user);
                seedCtx.AccessRoles.Add(role);
                seedCtx.PermissionFunctions.Add(func);
                seedCtx.RolePermissions.Add(rolePerm);
                seedCtx.TenantStaffMembers.AddRange(staffP1, staffP2);
                seedCtx.RoomTypes.AddRange(rtP1, rtP2);
                seedCtx.Rooms.AddRange(roomP1, roomP2);
                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory with isolated test configuration
            await using var factory = new TestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── STEP 1: Real HTTP Login ─────────────────────────────────────────
            var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "staff_http@resort.com",
                password = "P@ssword123!"
            });

            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
            var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();

            var accessToken = loginJson.GetProperty("accessToken").GetString();
            Assert.NotNull(accessToken);
            Assert.NotEmpty(accessToken);

            var memberships = loginJson.GetProperty("memberships");
            Assert.Equal(2, memberships.GetArrayLength());

            // Set Bearer token for subsequent requests
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // ── STEP 2: Real HTTP GET /api/auth/me/memberships ──────────────────
            var membershipsResponse = await client.GetAsync("/api/auth/me/memberships");
            Assert.Equal(HttpStatusCode.OK, membershipsResponse.StatusCode);
            var membershipsJson = await membershipsResponse.Content.ReadFromJsonAsync<JsonElement>();
            var membershipsData = membershipsJson.GetProperty("data");
            Assert.Equal(2, membershipsData.GetArrayLength());

            // ── STEP 3: Real HTTP GET /api/rooms with Bootstrap Token (BLOCKED) ─
            // Calling a business endpoint without choosing a branch must return 403 ERR_PROPERTY_REQUIRED
            var blockedResponse = await client.GetAsync("/api/rooms");
            Assert.Equal(HttpStatusCode.Forbidden, blockedResponse.StatusCode);
            var blockedJson = await blockedResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("ERR_PROPERTY_REQUIRED", blockedJson.GetProperty("errorCode").GetString());

            // ── STEP 4: Real HTTP POST /api/auth/switch-context to P1 ────────────
            var switchResponse = await client.PostAsJsonAsync("/api/auth/switch-context", new
            {
                propertyId = p1
            });
            Assert.Equal(HttpStatusCode.OK, switchResponse.StatusCode);
            var switchJson = await switchResponse.Content.ReadFromJsonAsync<JsonElement>();
            var switchData = switchJson.GetProperty("data");
            var scopedAccessToken = switchData.GetProperty("accessToken").GetString();
            Assert.NotNull(scopedAccessToken);

            var currentContext = switchData.GetProperty("currentContext");
            Assert.Equal(p1.ToString(), currentContext.GetProperty("propertyId").GetString());
            Assert.Equal("PropertyScoped", currentContext.GetProperty("scope").GetString());

            // Switch to scoped token
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedAccessToken);

            // ── STEP 5: Real HTTP GET /api/rooms with Scoped Token (SUCCEEDS P1) ─
            var roomsResponse = await client.GetAsync("/api/rooms");
            Assert.Equal(HttpStatusCode.OK, roomsResponse.StatusCode);
            var roomsJson = await roomsResponse.Content.ReadFromJsonAsync<JsonElement>();
            var roomsItems = roomsJson.GetProperty("items");

            // Verified: Exactly 1 room returned, and it belongs to P1 (101-SEA). P2's room is completely excluded.
            Assert.Equal(1, roomsItems.GetArrayLength());
            var singleRoom = roomsItems[0];
            Assert.Equal("101-SEA", singleRoom.GetProperty("roomNumber").GetString());
            Assert.Equal(p1.ToString(), singleRoom.GetProperty("propertyId").GetString());

            var roomId = Guid.Parse(singleRoom.GetProperty("id").GetString()!);

            // ── STEP 6: Real HTTP PATCH /api/rooms/{id}/status ──────────────────
            // 6a: Prohibited transition Clean -> Occupied returns 400 ERR_INVALID_STATUS_TRANSITION
            var invalidStatusResp = await client.PatchAsJsonAsync($"/api/rooms/{roomId}/status", new
            {
                status = "Occupied",
                expectedOldStatus = "Clean"
            });
            Assert.Equal(HttpStatusCode.BadRequest, invalidStatusResp.StatusCode);
            var invalidStatusJson = await invalidStatusResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("ERR_INVALID_STATUS_TRANSITION", invalidStatusJson.GetProperty("errorCode").GetString());

            // 6b: Valid transition Clean -> Dirty returns 200 OK
            var validStatusResp = await client.PatchAsJsonAsync($"/api/rooms/{roomId}/status", new
            {
                status = "Dirty",
                expectedOldStatus = "Clean"
            });
            Assert.Equal(HttpStatusCode.OK, validStatusResp.StatusCode);
            var validStatusJson = await validStatusResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Dirty", validStatusJson.GetProperty("status").GetString());

            // 6c: Stale state update (client sends expectedOldStatus: Clean, but room is now Dirty) returns 409 ERR_STALE_STATE
            var staleStatusResp = await client.PatchAsJsonAsync($"/api/rooms/{roomId}/status", new
            {
                status = "Cleaning",
                expectedOldStatus = "Clean"
            });
            Assert.Equal(HttpStatusCode.Conflict, staleStatusResp.StatusCode);
            var staleStatusJson = await staleStatusResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("ERR_STALE_STATE", staleStatusJson.GetProperty("errorCode").GetString());

            // 6d: Missing expectedOldStatus returns 400 ERR_VALIDATION with zero DB mutation
            var missingExpectedStatusResp = await client.PatchAsJsonAsync($"/api/rooms/{roomId}/status", new
            {
                status = "Clean"
            });
            Assert.Equal(HttpStatusCode.BadRequest, missingExpectedStatusResp.StatusCode);
            var missingExpectedStatusJson = await missingExpectedStatusResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("ERR_VALIDATION", missingExpectedStatusJson.GetProperty("errorCode").GetString());

            // ── STEP 7: Real HTTP DELETE /api/rooms/{id} ────────────────────────
            var deleteResp = await client.DeleteAsync($"/api/rooms/{roomId}");
            Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

            // Verified: Room is deleted and no longer returned in GET /api/rooms
            var roomsAfterDeleteResp = await client.GetAsync("/api/rooms");
            Assert.Equal(HttpStatusCode.OK, roomsAfterDeleteResp.StatusCode);
            var roomsAfterDeleteJson = await roomsAfterDeleteResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, roomsAfterDeleteJson.GetProperty("items").GetArrayLength());
        }
        finally
        {
            if (Regex.IsMatch(testSchema, @"^p1b02b_http_[a-zA-Z0-9]+$"))
            {
                try
                {
                    await using var cleanupCmd = conn.CreateCommand();
                    cleanupCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
                    await cleanupCmd.ExecuteNonQueryAsync();
                }
                catch { }
            }
        }
    }
}
