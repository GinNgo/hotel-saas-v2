using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests.Seed;

/// <summary>
/// End-to-end WebApi integration tests verifying that mock data provisioned by LocalDevDataSeeder
/// works seamlessly with real authentication, memberships, branch context switching, and room queries.
/// Exercises Ticket BE-SEED-01 in real HTTP pipeline scenarios.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class LocalDevDataSeederWebApiPipelineTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false
        };
        return builder.ConnectionString;
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
    public async Task SeededData_AllowsFullAuthAndBranchSwitchingFlow()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"seed_webapi_{Guid.NewGuid():N}";

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            // 1. Run Migrations on isolated test schema
            var builder = new NpgsqlConnectionStringBuilder(baseConnStr)
            {
                SearchPath = testSchema
            };
            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(builder.ConnectionString)
                .Options;

            await using (var migrateCtx = new ApplicationDbContext(dbOptions, null!, null!))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            // 2. Provision Mock Data via LocalDevDataSeeder
            const string seedPassword = "SeedDevPassword@2026";
            var seedOptions = new LocalDevSeedOptions
            {
                AllowTestDatabases = true,
                TargetSchema = testSchema,
                DefaultPassword = seedPassword
            };

            var seedResult = await LocalDevDataSeeder.SeedAsync(baseConnStr, seedOptions);

            // 3. Start WebApplicationFactory against the seeded database schema
            await using var factory = new TestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── FLOW A: Manager with Two Branches (manager.both@hotelsaas.local) ──
            var managerLoginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = LocalDevDataSeeder.SeedManagerBothEmail,
                password = seedPassword
            });
            Assert.Equal(HttpStatusCode.OK, managerLoginResp.StatusCode);
            var managerLoginJson = await managerLoginResp.Content.ReadFromJsonAsync<JsonElement>();

            var managerToken = managerLoginJson.GetProperty("accessToken").GetString();
            Assert.NotNull(managerToken);

            var managerMemberships = managerLoginJson.GetProperty("memberships");
            Assert.Equal(2, managerMemberships.GetArrayLength());

            // Set Bearer token
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", managerToken);

            // Fetch GET /api/auth/me/memberships
            var meMembershipsResp = await client.GetAsync("/api/auth/me/memberships");
            Assert.Equal(HttpStatusCode.OK, meMembershipsResp.StatusCode);
            var meMembershipsJson = await meMembershipsResp.Content.ReadFromJsonAsync<JsonElement>();
            var meMembershipsList = meMembershipsJson.GetProperty("data");
            Assert.Equal(2, meMembershipsList.GetArrayLength());

            // Switch to Branch 1 (CN-Q1)
            var switchToP1Resp = await client.PostAsJsonAsync("/api/auth/switch-context", new
            {
                propertyId = seedResult.Property1Id
            });
            Assert.Equal(HttpStatusCode.OK, switchToP1Resp.StatusCode);
            var switchToP1Json = await switchToP1Resp.Content.ReadFromJsonAsync<JsonElement>();
            var p1ScopedToken = switchToP1Json.GetProperty("data").GetProperty("accessToken").GetString();
            Assert.NotNull(p1ScopedToken);

            // Query /api/rooms under Branch 1 scope
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p1ScopedToken);
            var p1RoomsResp = await client.GetAsync("/api/rooms");
            Assert.Equal(HttpStatusCode.OK, p1RoomsResp.StatusCode);
            var p1RoomsJson = await p1RoomsResp.Content.ReadFromJsonAsync<JsonElement>();
            var p1Rooms = p1RoomsJson.GetProperty("items");
            Assert.Equal(3, p1Rooms.GetArrayLength()); // 101, 102, 201

            var p1RoomNumbers = new HashSet<string>();
            foreach (var r in p1Rooms.EnumerateArray())
            {
                p1RoomNumbers.Add(r.GetProperty("roomNumber").GetString()!);
                Assert.Equal(seedResult.Property1Id.ToString(), r.GetProperty("propertyId").GetString());
            }
            Assert.Contains("101", p1RoomNumbers);
            Assert.Contains("102", p1RoomNumbers);
            Assert.Contains("201", p1RoomNumbers);

            // Switch to Branch 2 (CN-PN)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", managerToken);
            var switchToP2Resp = await client.PostAsJsonAsync("/api/auth/switch-context", new
            {
                propertyId = seedResult.Property2Id
            });
            Assert.Equal(HttpStatusCode.OK, switchToP2Resp.StatusCode);
            var switchToP2Json = await switchToP2Resp.Content.ReadFromJsonAsync<JsonElement>();
            var p2ScopedToken = switchToP2Json.GetProperty("data").GetProperty("accessToken").GetString();
            Assert.NotNull(p2ScopedToken);

            // Query /api/rooms under Branch 2 scope
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p2ScopedToken);
            var p2RoomsResp = await client.GetAsync("/api/rooms");
            Assert.Equal(HttpStatusCode.OK, p2RoomsResp.StatusCode);
            var p2RoomsJson = await p2RoomsResp.Content.ReadFromJsonAsync<JsonElement>();
            var p2Rooms = p2RoomsJson.GetProperty("items");
            Assert.Equal(3, p2Rooms.GetArrayLength()); // 301, 302, 401

            var p2RoomNumbers = new HashSet<string>();
            foreach (var r in p2Rooms.EnumerateArray())
            {
                p2RoomNumbers.Add(r.GetProperty("roomNumber").GetString()!);
                Assert.Equal(seedResult.Property2Id.ToString(), r.GetProperty("propertyId").GetString());
            }
            Assert.Contains("301", p2RoomNumbers);
            Assert.Contains("302", p2RoomNumbers);
            Assert.Contains("401", p2RoomNumbers);

            // ── FLOW B: Single-Branch Receptionist (staff.single@hotelsaas.local) ──
            var recLoginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = LocalDevDataSeeder.SeedReceptionistSingleEmail,
                password = seedPassword
            });
            Assert.Equal(HttpStatusCode.OK, recLoginResp.StatusCode);
            var recLoginJson = await recLoginResp.Content.ReadFromJsonAsync<JsonElement>();
            var recMemberships = recLoginJson.GetProperty("memberships");
            Assert.Equal(1, recMemberships.GetArrayLength());
            Assert.Equal(seedResult.Property1Id.ToString(), recMemberships[0].GetProperty("propertyId").GetString());

            // ── FLOW C: Tenant Owner (owner@hotelsaas.local) ───────────────────────
            var ownerLoginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = LocalDevDataSeeder.SeedOwnerEmail,
                password = seedPassword
            });
            Assert.Equal(HttpStatusCode.OK, ownerLoginResp.StatusCode);
            var ownerLoginJson = await ownerLoginResp.Content.ReadFromJsonAsync<JsonElement>();
            var ownerMemberships = ownerLoginJson.GetProperty("memberships");
            // Tenant-wide owner has isTenantWide = true and null/omitted PropertyId (JsonIgnoreCondition.WhenWritingNull)
            Assert.True(ownerMemberships[0].GetProperty("isTenantWide").GetBoolean());
            Assert.False(ownerMemberships[0].TryGetProperty("propertyId", out var propElem) && propElem.ValueKind != JsonValueKind.Null);
        }
        finally
        {
            if (Regex.IsMatch(testSchema, @"^seed_webapi_[a-zA-Z0-9]+$"))
            {
                try
                {
                    await using var cleanupCmd = conn.CreateCommand();
                    cleanupCmd.CommandText = $"SET search_path TO public; DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
                    await cleanupCmd.ExecuteNonQueryAsync();
                }
                catch { }
                finally
                {
                    NpgsqlConnection.ClearAllPools();
                }
            }
        }
    }
}
