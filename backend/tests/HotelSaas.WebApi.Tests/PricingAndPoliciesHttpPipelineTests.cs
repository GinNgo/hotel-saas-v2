using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// HTTP Pipeline end-to-end tests for Property Policies, Rate Tables, and Quote Engine (Phase P2B-02).
/// Tests run against real PostgreSQL schemas via WebApplicationFactory with actual routing, auth, middleware, and DI.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class PricingAndPoliciesHttpPipelineTests
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
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    private sealed class PricingTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForPricingPoliciesTestingMustBeAtLeast32Bytes!";

        public PricingTestWebApplicationFactory(string connectionString, string testSchema)
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
    public async Task HttpPipeline_Policies_Rates_And_Quotes_EndToEnd()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p1b02b_pricing_http_{Guid.NewGuid():N}";

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
            var propId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Xanh",
                    Code = "KSBX",
                    Slug = "ksbx",
                    Address = "12 Vo Nguyen Giap",
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
                    Address = "12 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(12, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                var user = new User
                {
                    Id = userId,
                    Username = "manager_http",
                    Email = "manager@mykhe.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Manager My Khe",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "PropertyAdmin",
                    Code = "PADM"
                };

                // Permissions for PROPERTIES and ROOM_TYPES
                var funcProp = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "PROPERTIES",
                    Name = "Properties Management",
                    ModuleCode = "PROPERTIES",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var funcRoomType = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "ROOM_TYPES",
                    Name = "Room Type Management",
                    ModuleCode = "ROOM_TYPES",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var funcRooms = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "ROOMS",
                    Name = "Rooms Management",
                    ModuleCode = "ROOMS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var rolePerm1 = new RolePermission { RoleId = roleId, FunctionId = funcProp.Id, ActionMask = 127 };
                var rolePerm2 = new RolePermission { RoleId = roleId, FunctionId = funcRoomType.Id, ActionMask = 127 };
                var rolePerm3 = new RolePermission { RoleId = roleId, FunctionId = funcRooms.Id, ActionMask = 127 };

                var staff = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    RoleId = roleId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Manager,
                    IsActive = true
                };

                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Ocean Deluxe",
                    Code = "ODLX",
                    BasePrice = 1200000m,
                    MaxOccupancy = 2
                };

                var funcRes = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "RESERVATIONS",
                    Name = "Reservations Management",
                    ModuleCode = "RESERVATIONS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                // User without ROOMS or RESERVATIONS
                var userNoPerm = new User
                {
                    Id = Guid.NewGuid(),
                    Username = "staff_noperm",
                    Email = "noperm@mykhe.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff No Perm",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };
                var roleNoPerm = new AccessRole
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "NoQuoteRole",
                    Code = "NOQUOTE"
                };
                var rolePermNoQuote = new RolePermission { RoleId = roleNoPerm.Id, FunctionId = funcProp.Id, ActionMask = 127 };
                var staffNoPerm = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userNoPerm.Id,
                    RoleId = roleNoPerm.Id,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                // User with ONLY RESERVATIONS.Read
                var userRes = new User
                {
                    Id = Guid.NewGuid(),
                    Username = "staff_res",
                    Email = "res@mykhe.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff Reservations Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };
                var roleRes = new AccessRole
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "ResOnlyRole",
                    Code = "RESONLY"
                };
                var rolePermRes = new RolePermission { RoleId = roleRes.Id, FunctionId = funcRes.Id, ActionMask = 1 }; // Read only
                var staffRes = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userRes.Id,
                    RoleId = roleRes.Id,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.Users.AddRange(user, userNoPerm, userRes);
                seedCtx.AccessRoles.AddRange(role, roleNoPerm, roleRes);
                seedCtx.PermissionFunctions.AddRange(funcProp, funcRoomType, funcRooms, funcRes);
                seedCtx.RolePermissions.AddRange(rolePerm1, rolePerm2, rolePerm3, rolePermNoQuote, rolePermRes);
                seedCtx.TenantStaffMembers.AddRange(staff, staffNoPerm, staffRes);
                seedCtx.RoomTypes.Add(roomType);

                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory
            await using var factory = new PricingTestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── STEP 1: Login & Switch Context to Branch ────────────────────────
            var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "manager@mykhe.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
            var loginJson = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
            var loginToken = loginJson.GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginToken);

            var switchResp = await client.PostAsJsonAsync("/api/auth/switch-context", new
            {
                propertyId = propId
            });
            Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);
            var switchJson = await switchResp.Content.ReadFromJsonAsync<JsonElement>();
            var scopedToken = switchJson.GetProperty("data").GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            client.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            // ── STEP 2: Policies Pipeline (GET / PUT /api/properties/{id}/policies) ──
            // 2a. GET policies (verify initial defaults)
            var getPoliciesResp = await client.GetAsync($"/api/properties/{propId}/policies");
            Assert.Equal(HttpStatusCode.OK, getPoliciesResp.StatusCode);
            var policiesJson = await getPoliciesResp.Content.ReadFromJsonAsync<JsonElement>();
            var policiesData = policiesJson.GetProperty("data");
            Assert.Equal(30, policiesData.GetProperty("bufferMinutes").GetInt32());
            Assert.Equal(12, policiesData.GetProperty("maxHourlyHours").GetInt32());

            // 2b. PUT policies with invalid buffer (< 30) -> 400 Bad Request
            var invalidBufferResp = await client.PutAsJsonAsync($"/api/properties/{propId}/policies", new
            {
                checkInTime = "14:00:00",
                checkOutTime = "12:00:00",
                bufferMinutes = 20, // Invalid! Must be >= 30
                maxHourlyHours = 8
            });
            Assert.Equal(HttpStatusCode.BadRequest, invalidBufferResp.StatusCode);

            // 2c. PUT policies with invalid maxHourlyHours (> 24) -> 400 Bad Request
            var invalidMaxHoursResp = await client.PutAsJsonAsync($"/api/properties/{propId}/policies", new
            {
                checkInTime = "14:00:00",
                checkOutTime = "12:00:00",
                bufferMinutes = 45,
                maxHourlyHours = 30 // Invalid! 1..24
            });
            Assert.Equal(HttpStatusCode.BadRequest, invalidMaxHoursResp.StatusCode);

            // 2d. PUT policies with valid parameters & early/late surcharges -> 200 OK
            var validPutPoliciesResp = await client.PutAsJsonAsync($"/api/properties/{propId}/policies", new
            {
                checkInTime = "14:00:00",
                checkOutTime = "12:00:00",
                bufferMinutes = 45,
                maxHourlyHours = 8,
                surcharges = new object[]
                {
                    new
                    {
                        surchargeType = 1, // EarlyCheckIn
                        fromTime = "06:00:00",
                        toTime = "14:00:00",
                        calculationMethod = 1, // Percentage
                        percentage = (decimal?)50.0m,
                        flatAmount = (decimal?)null,
                        isActive = true
                    },
                    new
                    {
                        surchargeType = 2, // LateCheckOut
                        fromTime = "12:00:00",
                        toTime = "18:00:00",
                        calculationMethod = 2, // FlatAmount
                        percentage = (decimal?)null,
                        flatAmount = (decimal?)300000.0m,
                        isActive = true
                    }
                }
            });
            Assert.Equal(HttpStatusCode.OK, validPutPoliciesResp.StatusCode);

            // Verify updated policies in DB
            var verifyPoliciesResp = await client.GetAsync($"/api/properties/{propId}/policies");
            Assert.Equal(HttpStatusCode.OK, verifyPoliciesResp.StatusCode);
            var updatedPoliciesJson = await verifyPoliciesResp.Content.ReadFromJsonAsync<JsonElement>();
            var updatedData = updatedPoliciesJson.GetProperty("data");
            Assert.Equal(45, updatedData.GetProperty("bufferMinutes").GetInt32());
            Assert.Equal(8, updatedData.GetProperty("maxHourlyHours").GetInt32());
            Assert.Equal(2, updatedData.GetProperty("surcharges").GetArrayLength());

            // ── STEP 3: Rates Pipeline (POST / GET /api/room-types/{id}/rates & history) ──
            // 3a. POST rate with past date -> 400 Bad Request
            var pastRateResp = await client.PostAsJsonAsync($"/api/room-types/{roomTypeId}/rates", new
            {
                propertyId = propId,
                firstHours = 2,
                firstHoursPrice = 300000m,
                additionalHourPrice = 100000m,
                nightlyPrice = 1200000m,
                effectiveFrom = "2020-01-01",
                effectiveTo = "2020-01-10",
                changeReason = "Past rate attempt"
            });
            Assert.Equal(HttpStatusCode.BadRequest, pastRateResp.StatusCode);

            // 3b. POST valid future rate -> 201 Created
            var validRateResp = await client.PostAsJsonAsync($"/api/room-types/{roomTypeId}/rates", new
            {
                propertyId = propId,
                firstHours = 2,
                firstHoursPrice = 300000m,
                additionalHourPrice = 100000m,
                nightlyPrice = 1200000m,
                effectiveFrom = "2026-11-01",
                effectiveTo = "2026-11-30",
                changeReason = "Winter schedule"
            });
            Assert.Equal(HttpStatusCode.Created, validRateResp.StatusCode);

            // 3c. GET rates list -> 200 OK
            var getRatesResp = await client.GetAsync($"/api/room-types/{roomTypeId}/rates?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, getRatesResp.StatusCode);
            var ratesJson = await getRatesResp.Content.ReadFromJsonAsync<JsonElement>();
            var ratesData = ratesJson.GetProperty("data");
            Assert.True(ratesData.GetArrayLength() >= 1);

            // 3d. GET rate history -> 200 OK
            var getHistoryResp = await client.GetAsync($"/api/room-types/{roomTypeId}/rates/history?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, getHistoryResp.StatusCode);
            var historyJson = await getHistoryResp.Content.ReadFromJsonAsync<JsonElement>();
            var historyData = historyJson.GetProperty("data");
            Assert.True(historyData.GetArrayLength() >= 1);

            // ── STEP 4: Quote Engine Pipeline (POST /api/quotes/calculate) ───────
            // 4a. Hourly quote within limit (3 hours: 2 base + 1 extra = 300,000 + 100,000 = 400,000)
            var hourlyQuoteResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 1, // Hourly
                startAtUtc = "2026-11-05T08:00:00Z",
                endAtUtc = "2026-11-05T11:00:00Z"
            });
            Assert.Equal(HttpStatusCode.OK, hourlyQuoteResp.StatusCode);
            var hourlyQuoteJson = await hourlyQuoteResp.Content.ReadFromJsonAsync<JsonElement>();
            var hourlyQuoteData = hourlyQuoteJson.GetProperty("data");
            Assert.Equal(400000m, hourlyQuoteData.GetProperty("totalAmount").GetDecimal());
            Assert.NotNull(hourlyQuoteData.GetProperty("expiresAtUtc").GetString());

            // 4b. Hourly quote exceeding MaxHourlyHours (10 hours > 8 hours limit) -> 422 Unprocessable Entity
            var exceededHourlyResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 1, // Hourly
                startAtUtc = "2026-11-05T08:00:00Z",
                endAtUtc = "2026-11-05T18:00:00Z" // 10 hours!
            });
            Assert.Equal(HttpStatusCode.UnprocessableEntity, exceededHourlyResp.StatusCode);
            var exceededJson = await exceededHourlyResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("ERR_HOURLY_LIMIT_EXCEEDED", exceededJson.GetProperty("errorCode").GetString());

            // 4c. Overnight standard quote: 2 nights (Nov 10 to Nov 12 = 2 * 1,200,000 = 2,400,000)
            // Branch policy: Check-in 14:00, Check-out 12:00
            // In Vietnam time (UTC+7): 14:00 local is 07:00 UTC, 12:00 local is 05:00 UTC
            var overnightQuoteResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 2, // Overnight
                startAtUtc = "2026-11-10T07:00:00Z",
                endAtUtc = "2026-11-12T05:00:00Z",
                checkInDate = "2026-11-10",
                checkOutDate = "2026-11-12"
            });
            Assert.Equal(HttpStatusCode.OK, overnightQuoteResp.StatusCode);
            var overnightJson = await overnightQuoteResp.Content.ReadFromJsonAsync<JsonElement>();
            var overnightData = overnightJson.GetProperty("data");
            Assert.Equal(2400000m, overnightData.GetProperty("totalAmount").GetDecimal());

            // 4d. Overnight with Early Check-in Surcharge (Check-in 10:00 local = 03:00 UTC, standard is 14:00 local)
            // Policy early surcharge: 50% of nightly = 600,000. Total = 2,400,000 + 600,000 = 3,000,000.
            var earlySurchargeQuoteResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 2, // Overnight
                startAtUtc = "2026-11-10T03:00:00Z", // 10:00 local -> Early check-in
                endAtUtc = "2026-11-12T05:00:00Z",
                checkInDate = "2026-11-10",
                checkOutDate = "2026-11-12"
            });
            Assert.Equal(HttpStatusCode.OK, earlySurchargeQuoteResp.StatusCode);
            var earlyJson = await earlySurchargeQuoteResp.Content.ReadFromJsonAsync<JsonElement>();
            var earlyData = earlyJson.GetProperty("data");
            Assert.Equal(3000000m, earlyData.GetProperty("totalAmount").GetDecimal());
            var breakdown = earlyData.GetProperty("breakdown");
            Assert.Contains(breakdown.EnumerateArray(), item =>
                item.GetProperty("description").GetString()!.Contains("Phụ thu nhận phòng sớm") &&
                item.GetProperty("amount").GetDecimal() == 600000m);

            // ── STEP 5: Quote Authorization Verification (ROOMS.Read OR RESERVATIONS.Read) ──
            // 5a. User without ROOMS or RESERVATIONS permission is blocked -> 403 Forbidden
            var loginNoPermResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "noperm@mykhe.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginNoPermResp.StatusCode);
            var loginNoPermJson = await loginNoPermResp.Content.ReadFromJsonAsync<JsonElement>();
            var tokenNoPerm = loginNoPermJson.GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenNoPerm);
            var switchNoPermResp = await client.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchNoPermResp.StatusCode);
            var scopedTokenNoPerm = (await switchNoPermResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedTokenNoPerm);
            var quoteForbiddenResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 1,
                startAtUtc = "2026-11-05T08:00:00Z",
                endAtUtc = "2026-11-05T10:00:00Z"
            });
            Assert.Equal(HttpStatusCode.Forbidden, quoteForbiddenResp.StatusCode);

            // 5b. User with ONLY RESERVATIONS.Read permission succeeds -> 200 OK (OR logic)
            var loginResResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "res@mykhe.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginResResp.StatusCode);
            var loginResJson = await loginResResp.Content.ReadFromJsonAsync<JsonElement>();
            var tokenRes = loginResJson.GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenRes);
            var switchResResp = await client.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchResResp.StatusCode);
            var scopedTokenRes = (await switchResResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedTokenRes);
            var quoteResAllowedResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = propId,
                roomTypeId = roomTypeId,
                rentalType = 1,
                startAtUtc = "2026-11-05T08:00:00Z",
                endAtUtc = "2026-11-05T10:00:00Z"
            });
            Assert.Equal(HttpStatusCode.OK, quoteResAllowedResp.StatusCode);

            // 5c. Cross-branch isolation: Quote requested for different branch than token scope -> 400 Bad Request
            var otherPropId = Guid.NewGuid();
            var crossBranchQuoteResp = await client.PostAsJsonAsync("/api/quotes/calculate", new
            {
                propertyId = otherPropId,
                roomTypeId = roomTypeId,
                rentalType = 1,
                startAtUtc = "2026-11-05T08:00:00Z",
                endAtUtc = "2026-11-05T10:00:00Z"
            });
            Assert.Equal(HttpStatusCode.BadRequest, crossBranchQuoteResp.StatusCode);
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }
}
