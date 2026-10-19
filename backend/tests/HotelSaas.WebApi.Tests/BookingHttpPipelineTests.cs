using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
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
/// HTTP Pipeline end-to-end integration tests for Booking Core (Phase P3-BOOKING-CORE-01).
/// Tests run against real PostgreSQL schemas via WebApplicationFactory with actual routing,
/// auth, RBAC permissions, branch isolation middleware, row-level locking, and idempotency replay.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class BookingHttpPipelineTests
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
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    private sealed class BookingTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForBookingPipelineTestingMustBeAtLeast32Bytes!";

        public BookingTestWebApplicationFactory(string connectionString, string testSchema)
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
    public async Task HttpPipeline_Reservations_FullLifecycle_And_Security()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p3_booking_http_{Guid.NewGuid():N}";

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
            var userNoPermId = Guid.NewGuid();
            var roleNoPermId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var room1Id = Guid.NewGuid();
            var room2Id = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Xanh P3",
                    Code = "KSBX3",
                    Slug = "ksbx-p3",
                    Address = "120 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Chi nhánh Non Nước",
                    Code = "NN01",
                    Slug = "non-nuoc-01",
                    Address = "120 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                var user = new User
                {
                    Id = userId,
                    Username = "manager_booking",
                    Email = "manager_booking@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Manager Booking",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "BookingAdmin",
                    Code = "BADM"
                };

                // Permissions
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

                var funcRes = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "RESERVATIONS",
                    Name = "Reservations Management",
                    ModuleCode = "RESERVATIONS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var rolePerm1 = new RolePermission { RoleId = roleId, FunctionId = funcProp.Id, ActionMask = 127 };
                var rolePerm2 = new RolePermission { RoleId = roleId, FunctionId = funcRoomType.Id, ActionMask = 127 };
                var rolePerm3 = new RolePermission { RoleId = roleId, FunctionId = funcRooms.Id, ActionMask = 127 };
                var rolePerm4 = new RolePermission { RoleId = roleId, FunctionId = funcRes.Id, ActionMask = 127 };

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

                // Read-only user (Has RESERVATIONS.Read = 1, but lacks Create = 2)
                var userNoPerm = new User
                {
                    Id = userNoPermId,
                    Username = "staff_res_readonly",
                    Email = "readonly_booking@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff Read Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var roleNoPerm = new AccessRole
                {
                    Id = roleNoPermId,
                    TenantId = tenantId,
                    Name = "ResReadOnlyRole",
                    Code = "RESRO"
                };

                var rolePermReadOnly = new RolePermission { RoleId = roleNoPermId, FunctionId = funcRes.Id, ActionMask = 1 }; // Read only

                var staffNoPerm = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userNoPermId,
                    RoleId = roleNoPermId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Deluxe Ocean View",
                    Code = "DLX",
                    BasePrice = 1200000m,
                    MaxOccupancy = 2
                };

                var room1 = new Room
                {
                    Id = room1Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "101",
                    Floor = 1,
                    Status = RoomStatus.Clean
                };

                var room2 = new Room
                {
                    Id = room2Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "102",
                    Floor = 1,
                    Status = RoomStatus.Clean
                };

                // Active RoomTypeRate
                var rate = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    FirstHours = 2,
                    FirstHoursPrice = 300000m,
                    AdditionalHourPrice = 100000m,
                    NightlyPrice = 1200000m,
                    Currency = "VND",
                    EffectiveFrom = new DateOnly(2026, 11, 1),
                    EffectiveTo = new DateOnly(2026, 11, 30),
                    CreatedByUserId = userId,
                    IsActive = true
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.Users.AddRange(user, userNoPerm);
                seedCtx.AccessRoles.AddRange(role, roleNoPerm);
                seedCtx.PermissionFunctions.AddRange(funcProp, funcRoomType, funcRooms, funcRes);
                seedCtx.RolePermissions.AddRange(rolePerm1, rolePerm2, rolePerm3, rolePerm4, rolePermReadOnly);
                seedCtx.TenantStaffMembers.AddRange(staff, staffNoPerm);
                seedCtx.RoomTypes.Add(roomType);
                seedCtx.Rooms.AddRange(room1, room2);
                seedCtx.RoomTypeRates.Add(rate);

                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory
            await using var factory = new BookingTestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── STEP 1: Auth & Branch Scoping ──────────────────────────────────────────
            var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "manager_booking@hotel.com",
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

            // ── STEP 2: POST Hourly Reservation (201 Created) ──────────────────────────
            var hourlyPayload = new
            {
                propertyId = propId,
                roomId = room1Id,
                rentalType = 1, // Hourly
                startAtUtc = "2026-11-10T07:00:00Z", // 14:00 VN
                endAtUtc = "2026-11-10T09:00:00Z",   // 16:00 VN (2 hours)
                guestName = "Nguyen Van A",
                guestEmail = "nguyenvana@gmail.com",
                guestPhone = "0901234567",
                numberOfGuests = 1,
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-HOURLY-01"
            };

            var postHourlyResp = await client.PostAsJsonAsync("/api/reservations", hourlyPayload);
            Assert.Equal(HttpStatusCode.Created, postHourlyResp.StatusCode);
            var hourlyJson = await postHourlyResp.Content.ReadFromJsonAsync<JsonElement>();
            var hourlyResId = hourlyJson.GetProperty("id").GetGuid();
            var hourlyCode = hourlyJson.GetProperty("confirmationCode").GetString()!;
            Assert.StartsWith("RES-", hourlyCode);
            Assert.Equal(300000m, hourlyJson.GetProperty("totalAmount").GetDecimal());
            Assert.True(hourlyJson.GetProperty("breakdown").GetArrayLength() > 0);
            Assert.True(hourlyJson.TryGetProperty("appliedPolicies", out _));

            // ── STEP 3: POST Overnight Reservation (201 Created) ───────────────────────
            var overnightPayload = new
            {
                propertyId = propId,
                roomId = room2Id,
                rentalType = 2, // Overnight
                startAtUtc = "2026-11-12T07:00:00Z", // 14:00 VN
                endAtUtc = "2026-11-14T05:00:00Z",   // 12:00 VN
                checkInDate = "2026-11-12",
                checkOutDate = "2026-11-14",
                guestName = "Tran Thi B",
                guestEmail = "tranthib@gmail.com",
                guestPhone = "0987654321",
                numberOfGuests = 2,
                expectedTotalAmount = 2400000m, // 2 nights * 1,200,000
                idempotencyKey = "IDEMP-OVERNIGHT-01"
            };

            var postOvernightResp = await client.PostAsJsonAsync("/api/reservations", overnightPayload);
            Assert.Equal(HttpStatusCode.Created, postOvernightResp.StatusCode);
            var overnightJson = await postOvernightResp.Content.ReadFromJsonAsync<JsonElement>();
            var overnightResId = overnightJson.GetProperty("id").GetGuid();
            Assert.Equal(2400000m, overnightJson.GetProperty("totalAmount").GetDecimal());

            // ── STEP 4: GET List (200 OK) ──────────────────────────────────────────────
            var getListResp = await client.GetAsync($"/api/reservations?propertyId={propId}&page=1&pageSize=20");
            Assert.Equal(HttpStatusCode.OK, getListResp.StatusCode);
            var listJson = await getListResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(listJson.GetProperty("totalCount").GetInt32() >= 2);

            // ── STEP 5: GET Detail (200 OK) ────────────────────────────────────────────
            var getDetailResp = await client.GetAsync($"/api/reservations/{hourlyResId}?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, getDetailResp.StatusCode);
            var detailJson = await getDetailResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Nguyen Van A", detailJson.GetProperty("guestName").GetString());
            Assert.Equal("101", detailJson.GetProperty("roomNumber").GetString());

            // ── STEP 6: GET Availability (200 OK) ──────────────────────────────────────
            // Query interval overlapping Room 101's hourly reservation + buffer
            var getAvailResp = await client.GetAsync(
                $"/api/reservations/availability?propertyId={propId}&rentalType=1&startAtUtc=2026-11-10T08:00:00Z&endAtUtc=2026-11-10T10:00:00Z");
            Assert.Equal(HttpStatusCode.OK, getAvailResp.StatusCode);
            var availJson = await getAvailResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(availJson.GetArrayLength() >= 2);

            bool room1Available = true;
            bool room2Available = false;
            foreach (var item in availJson.EnumerateArray())
            {
                if (item.GetProperty("roomId").GetGuid() == room1Id)
                    room1Available = item.GetProperty("isAvailable").GetBoolean();
                if (item.GetProperty("roomId").GetGuid() == room2Id)
                    room2Available = item.GetProperty("isAvailable").GetBoolean();
            }
            Assert.False(room1Available, "Room 101 must be unavailable due to overlap / turnover buffer");
            Assert.True(room2Available, "Room 102 must be available");

            // ── STEP 7: 403 Forbidden when lacking RESERVATIONS.Create ─────────────────
            var clientReadOnly = factory.CreateClient();
            var loginReadOnlyResp = await clientReadOnly.PostAsJsonAsync("/api/auth/login", new
            {
                email = "readonly_booking@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginReadOnlyResp.StatusCode);
            var loginReadOnlyToken = (await loginReadOnlyResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("accessToken").GetString()!;

            clientReadOnly.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginReadOnlyToken);
            var switchReadOnlyResp = await clientReadOnly.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchReadOnlyResp.StatusCode);
            var scopedReadOnlyToken = (await switchReadOnlyResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            clientReadOnly.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedReadOnlyToken);
            clientReadOnly.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            var forbiddenCreateResp = await clientReadOnly.PostAsJsonAsync("/api/reservations", new
            {
                propertyId = propId,
                roomId = room2Id,
                rentalType = 1,
                startAtUtc = "2026-11-15T07:00:00Z",
                endAtUtc = "2026-11-15T09:00:00Z",
                guestName = "Intruder",
                guestEmail = "intruder@gmail.com",
                expectedTotalAmount = 300000m
            });
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenCreateResp.StatusCode);

            // ── STEP 8: 400 Bad Request on Branch Mismatch & 403 on Header Tampering ──
            var mismatchedPropId = Guid.NewGuid();

            // 8a. Request body propertyId does not match X-Property-Id header -> 400 Bad Request
            var clientMismatch = factory.CreateClient();
            clientMismatch.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            clientMismatch.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            var mismatchedBodyPayload = new
            {
                propertyId = mismatchedPropId, // Mismatched body property!
                roomId = room1Id,
                rentalType = 1,
                startAtUtc = "2026-11-10T07:00:00Z",
                endAtUtc = "2026-11-10T09:00:00Z",
                guestName = "Mismatch Tester",
                guestEmail = "mismatch@gmail.com",
                expectedTotalAmount = 300000m
            };

            var mismatchResp = await clientMismatch.PostAsJsonAsync("/api/reservations", mismatchedBodyPayload);
            Assert.Equal(HttpStatusCode.BadRequest, mismatchResp.StatusCode);

            // 8b. Header X-Property-Id overrides token assigned branch -> 403 Forbidden
            var clientCrossBranchHeader = factory.CreateClient();
            clientCrossBranchHeader.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            clientCrossBranchHeader.DefaultRequestHeaders.Add("X-Property-Id", mismatchedPropId.ToString());

            var crossHeaderResp = await clientCrossBranchHeader.PostAsJsonAsync("/api/reservations", hourlyPayload);
            Assert.Equal(HttpStatusCode.Forbidden, crossHeaderResp.StatusCode);

            // ── STEP 9: Concurrency Competition (Row-level lock race condition) ────────
            var raceClient1 = factory.CreateClient();
            raceClient1.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            raceClient1.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            var raceClient2 = factory.CreateClient();
            raceClient2.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            raceClient2.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            var racePayload1 = new
            {
                propertyId = propId,
                roomId = room2Id,
                rentalType = 1,
                startAtUtc = "2026-11-20T07:00:00Z",
                endAtUtc = "2026-11-20T09:00:00Z",
                guestName = "Racer One",
                guestEmail = "racer1@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-RACE-01"
            };

            var racePayload2 = new
            {
                propertyId = propId,
                roomId = room2Id,
                rentalType = 1,
                startAtUtc = "2026-11-20T07:00:00Z",
                endAtUtc = "2026-11-20T09:00:00Z",
                guestName = "Racer Two",
                guestEmail = "racer2@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-RACE-02"
            };

            var raceTask1 = raceClient1.PostAsJsonAsync("/api/reservations", racePayload1);
            var raceTask2 = raceClient2.PostAsJsonAsync("/api/reservations", racePayload2);

            var raceRes1 = await raceTask1;
            var raceRes2 = await raceTask2;

            var raceStatuses = new[] { raceRes1.StatusCode, raceRes2.StatusCode };
            Assert.Contains(HttpStatusCode.Created, raceStatuses);
            Assert.Contains(HttpStatusCode.Conflict, raceStatuses);

            // ── STEP 9b: Concurrent Same-Key Across Different Rooms (Advisory Lock Serialization) ──
            var atomicRaceKey = "IDEMP-ATOMIC-SAMEKEY-DIFFROOM";
            var raceKeyPayload1 = new
            {
                propertyId = propId,
                roomId = room1Id,
                rentalType = 1,
                startAtUtc = "2026-11-21T07:00:00Z",
                endAtUtc = "2026-11-21T09:00:00Z",
                guestName = "Same Key Racer 1",
                guestEmail = "sk1@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = atomicRaceKey
            };

            var raceKeyPayload2 = new
            {
                propertyId = propId,
                roomId = room2Id, // Different room!
                rentalType = 1,
                startAtUtc = "2026-11-21T07:00:00Z",
                endAtUtc = "2026-11-21T09:00:00Z",
                guestName = "Same Key Racer 2",
                guestEmail = "sk2@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = atomicRaceKey
            };

            var sameKeyTask1 = raceClient1.PostAsJsonAsync("/api/reservations", raceKeyPayload1);
            var sameKeyTask2 = raceClient2.PostAsJsonAsync("/api/reservations", raceKeyPayload2);

            var sameKeyRes1 = await sameKeyTask1;
            var sameKeyRes2 = await sameKeyTask2;

            var sameKeyStatuses = new[] { sameKeyRes1.StatusCode, sameKeyRes2.StatusCode };
            Assert.Contains(HttpStatusCode.Created, sameKeyStatuses);
            Assert.Contains(HttpStatusCode.Conflict, sameKeyStatuses);

            var raceConflictResponse = sameKeyRes1.StatusCode == HttpStatusCode.Conflict ? sameKeyRes1 : sameKeyRes2;
            var raceConflictContent = await raceConflictResponse.Content.ReadAsStringAsync();
            Assert.Contains("ERR_IDEMPOTENCY_CONFLICT", raceConflictContent);

            // ── STEP 10: Idempotency Replay (Replaying same key & payload) ─────────────
            var replayKey = "IDEMP-REPLAY-KEY-888";
            var replayPayload = new
            {
                propertyId = propId,
                roomId = room1Id,
                rentalType = 1,
                startAtUtc = "2026-11-25T07:00:00Z",
                endAtUtc = "2026-11-25T09:00:00Z",
                guestName = "Original Guest",
                guestEmail = "original@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = replayKey
            };

            var firstCallResp = await client.PostAsJsonAsync("/api/reservations", replayPayload);
            Assert.Equal(HttpStatusCode.Created, firstCallResp.StatusCode);
            var firstJson = await firstCallResp.Content.ReadFromJsonAsync<JsonElement>();
            var originalId = firstJson.GetProperty("id").GetGuid();
            var originalCode = firstJson.GetProperty("confirmationCode").GetString()!;

            // Replay call with identical key and payload
            var replayCallResp = await client.PostAsJsonAsync("/api/reservations", replayPayload);
            Assert.Equal(HttpStatusCode.Created, replayCallResp.StatusCode);
            var replayedJson = await replayCallResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(originalId, replayedJson.GetProperty("id").GetGuid());
            Assert.Equal(originalCode, replayedJson.GetProperty("confirmationCode").GetString());

            // Verify in DB that only exactly ONE reservation was persisted for this key
            await using (var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var rowCount = await verifyCtx.Reservations
                    .CountAsync(r => r.PropertyId == propId && r.Notes != null && r.Notes.Contains(replayKey));
                Assert.Equal(1, rowCount);
            }

            // ── STEP 11: Idempotency Conflict (Same key with differing payload) ────────
            // 11a. Differing room and dates
            var conflictPayload = new
            {
                propertyId = propId,
                roomId = room2Id, // Different room!
                rentalType = 1,
                startAtUtc = "2026-11-26T07:00:00Z", // Different interval!
                endAtUtc = "2026-11-26T09:00:00Z",
                guestName = "Tampering Imposter",
                guestEmail = "imposter@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = replayKey
            };

            var conflictResp = await client.PostAsJsonAsync("/api/reservations", conflictPayload);
            Assert.Equal(HttpStatusCode.Conflict, conflictResp.StatusCode);
            var conflictBody = await conflictResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_IDEMPOTENCY_CONFLICT", conflictBody);

            // 11b. Differing guest info / guests count with same room and interval
            var guestConflictPayload = new
            {
                propertyId = propId,
                roomId = room1Id, // Same room
                rentalType = 1,
                startAtUtc = "2026-11-25T07:00:00Z", // Same interval
                endAtUtc = "2026-11-25T09:00:00Z",
                guestName = "Different Guest Name", // Differing guest name!
                guestEmail = "original@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = replayKey
            };

            var guestConflictResp = await client.PostAsJsonAsync("/api/reservations", guestConflictPayload);
            Assert.Equal(HttpStatusCode.Conflict, guestConflictResp.StatusCode);
            var guestConflictBody = await guestConflictResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_IDEMPOTENCY_CONFLICT", guestConflictBody);

            // ── STEP 12: Snapshot Immutability (Rate change does not mutate booking) ────
            // Mutate rates in database for this room type to extreme value
            await using (var updateCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var currentRate = await updateCtx.RoomTypeRates.FirstAsync(r => r.RoomTypeId == roomTypeId);
                currentRate.NightlyPrice = 9999999m;
                await updateCtx.SaveChangesAsync();
            }

            // Query existing overnight booking detail
            var verifyDetailResp = await client.GetAsync($"/api/reservations/{overnightResId}?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, verifyDetailResp.StatusCode);
            var verifyDetailJson = await verifyDetailResp.Content.ReadFromJsonAsync<JsonElement>();

            // Confirm totalAmount and breakdown stay strictly 2,400,000 VND (original snapshot)
            Assert.Equal(2400000m, verifyDetailJson.GetProperty("totalAmount").GetDecimal());

            // ── STEP 12b: Replay Reservation AFTER Rate Change in Database ─────────────
            // Replaying the original overnight reservation must replay the original snapshot (2,400,000 VND)
            // without being aborted by ERR_QUOTE_MISMATCH (which would happen if live quote was calculated first)
            var replayAfterRateChangeResp = await client.PostAsJsonAsync("/api/reservations", overnightPayload);
            Assert.Equal(HttpStatusCode.Created, replayAfterRateChangeResp.StatusCode);
            var replayAfterRateChangeJson = await replayAfterRateChangeResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(overnightResId, replayAfterRateChangeJson.GetProperty("id").GetGuid());
            Assert.Equal(2400000m, replayAfterRateChangeJson.GetProperty("totalAmount").GetDecimal());
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }
}
