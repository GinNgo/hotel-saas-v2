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
/// HTTP Pipeline end-to-end integration tests for Phase P3-STAY-LIFECYCLE-01:
/// Verifies HTTP endpoints for Check-in, Check-out, and Cancellation state machine (FSM):
/// Flow: Create booking -> Check-in (200 OK, Room -> Occupied) -> Check-out (200 OK, Room -> Dirty)
/// -> Clean via Housekeeping -> Invalid transitions rejected -> Cancel flow -> Permission & Branch Isolation.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class StayLifecycleHttpPipelineTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
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
                $"Target database '{builder.Database}' is NOT an authorized test database! Target database name must contain '_test'.");
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

    private sealed class LifecycleTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForBookingPipelineTestingMustBeAtLeast32Bytes!";

        public LifecycleTestWebApplicationFactory(string connectionString, string testSchema)
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
    public async Task HttpPipeline_StayLifecycle_FullFsm_And_SecurityGate()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p3_lifecycle_http_{Guid.NewGuid():N}";

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
            var userReadOnlyId = Guid.NewGuid();
            var roleReadOnlyId = Guid.NewGuid();
            var userCheckInOutOnlyId = Guid.NewGuid();
            var roleCheckInOutOnlyId = Guid.NewGuid();
            var userReservationsOnlyId = Guid.NewGuid();
            var roleReservationsOnlyId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var room1Id = Guid.NewGuid();
            var room2Id = Guid.NewGuid();
            var room3Id = Guid.NewGuid();
            var room4Id = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Xanh Lifecycle",
                    Code = "KSBXL",
                    Slug = "ksbx-lifecycle",
                    Address = "120 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Chi nhánh Non Nước",
                    Code = "NN02",
                    Slug = "non-nuoc-02",
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
                    Username = "manager_lifecycle",
                    Email = "manager_lifecycle@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Manager Lifecycle",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "LifecycleAdmin",
                    Code = "LADM"
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

                var funcCheckInOut = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "CHECK_IN_OUT",
                    Name = "Check-in / Check-out",
                    ModuleCode = "RESERVATIONS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var rolePerm1 = new RolePermission { RoleId = roleId, FunctionId = funcProp.Id, ActionMask = 127 };
                var rolePerm2 = new RolePermission { RoleId = roleId, FunctionId = funcRooms.Id, ActionMask = 127 };
                var rolePerm3 = new RolePermission { RoleId = roleId, FunctionId = funcRes.Id, ActionMask = 127 };
                var rolePerm4 = new RolePermission { RoleId = roleId, FunctionId = funcCheckInOut.Id, ActionMask = 127 };

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

                // Read-only user (Only has RESERVATIONS.Read = 1)
                var userReadOnly = new User
                {
                    Id = userReadOnlyId,
                    Username = "staff_readonly",
                    Email = "staff_readonly@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff Read Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var roleReadOnly = new AccessRole
                {
                    Id = roleReadOnlyId,
                    TenantId = tenantId,
                    Name = "ResReadOnly",
                    Code = "RERO"
                };

                var rolePermReadOnly = new RolePermission { RoleId = roleReadOnlyId, FunctionId = funcRes.Id, ActionMask = 1 }; // Read only

                var staffReadOnly = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userReadOnlyId,
                    RoleId = roleReadOnlyId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                // CheckInOutOnly user (CHECK_IN_OUT Update = 4, RESERVATIONS Read = 1, ROOMS Read = 1)
                var userCheckInOutOnly = new User
                {
                    Id = userCheckInOutOnlyId,
                    Username = "staff_checkinout",
                    Email = "staff_checkinout@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff CheckInOut Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var roleCheckInOutOnly = new AccessRole
                {
                    Id = roleCheckInOutOnlyId,
                    TenantId = tenantId,
                    Name = "CheckInOutOnly",
                    Code = "CIOO"
                };

                var rolePermCio1 = new RolePermission { RoleId = roleCheckInOutOnlyId, FunctionId = funcCheckInOut.Id, ActionMask = 4 };
                var rolePermCio2 = new RolePermission { RoleId = roleCheckInOutOnlyId, FunctionId = funcRes.Id, ActionMask = 1 };
                var rolePermCio3 = new RolePermission { RoleId = roleCheckInOutOnlyId, FunctionId = funcRooms.Id, ActionMask = 1 };
                var rolePermCio4 = new RolePermission { RoleId = roleCheckInOutOnlyId, FunctionId = funcProp.Id, ActionMask = 1 };

                var staffCheckInOutOnly = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userCheckInOutOnlyId,
                    RoleId = roleCheckInOutOnlyId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                // ReservationsOnly user (RESERVATIONS Update = 4, Read = 1; NO CHECK_IN_OUT Update)
                var userReservationsOnly = new User
                {
                    Id = userReservationsOnlyId,
                    Username = "staff_resonly",
                    Email = "staff_resonly@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff Reservations Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var roleReservationsOnly = new AccessRole
                {
                    Id = roleReservationsOnlyId,
                    TenantId = tenantId,
                    Name = "ReservationsOnly",
                    Code = "RESO"
                };

                var rolePermRes1 = new RolePermission { RoleId = roleReservationsOnlyId, FunctionId = funcRes.Id, ActionMask = 5 }; // Read (1) + Update (4)
                var rolePermRes2 = new RolePermission { RoleId = roleReservationsOnlyId, FunctionId = funcRooms.Id, ActionMask = 1 };
                var rolePermRes3 = new RolePermission { RoleId = roleReservationsOnlyId, FunctionId = funcProp.Id, ActionMask = 1 };

                var staffReservationsOnly = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userReservationsOnlyId,
                    RoleId = roleReservationsOnlyId,
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
                    RoomNumber = "201",
                    Floor = 2,
                    Status = RoomStatus.Clean
                };

                var room2 = new Room
                {
                    Id = room2Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "202",
                    Floor = 2,
                    Status = RoomStatus.Clean
                };

                var room3 = new Room
                {
                    Id = room3Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "203",
                    Floor = 2,
                    Status = RoomStatus.Clean
                };

                var room4 = new Room
                {
                    Id = room4Id,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "204",
                    Floor = 2,
                    Status = RoomStatus.Clean
                };

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
                seedCtx.Users.AddRange(user, userReadOnly, userCheckInOutOnly, userReservationsOnly);
                seedCtx.AccessRoles.AddRange(role, roleReadOnly, roleCheckInOutOnly, roleReservationsOnly);
                seedCtx.PermissionFunctions.AddRange(funcProp, funcRooms, funcRes, funcCheckInOut);
                seedCtx.RolePermissions.AddRange(
                    rolePerm1, rolePerm2, rolePerm3, rolePerm4,
                    rolePermReadOnly,
                    rolePermCio1, rolePermCio2, rolePermCio3, rolePermCio4,
                    rolePermRes1, rolePermRes2, rolePermRes3);
                seedCtx.TenantStaffMembers.AddRange(staff, staffReadOnly, staffCheckInOutOnly, staffReservationsOnly);
                seedCtx.RoomTypes.Add(roomType);
                seedCtx.Rooms.AddRange(room1, room2, room3, room4);
                seedCtx.RoomTypeRates.Add(rate);

                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory
            await using var factory = new LifecycleTestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── STEP 1: Auth & Branch Scoping ──────────────────────────────────────────
            var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "manager_lifecycle@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
            var loginJson = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
            var loginToken = loginJson.GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginToken);

            var switchResp = await client.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);
            var switchJson = await switchResp.Content.ReadFromJsonAsync<JsonElement>();
            var scopedToken = switchJson.GetProperty("data").GetProperty("accessToken").GetString()!;

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
            client.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            // ── STEP 2: Create Confirmed Reservation on Room 201 ───────────────────────
            var bookingPayload1 = new
            {
                propertyId = propId,
                roomId = room1Id,
                rentalType = 1, // Hourly
                startAtUtc = "2026-11-10T07:00:00Z",
                endAtUtc = "2026-11-10T09:00:00Z",
                guestName = "Le Van Stay",
                guestEmail = "levanstay@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-STAY-01"
            };

            var createResp = await client.PostAsJsonAsync("/api/reservations", bookingPayload1);
            Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
            var createJson = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var res1Id = createJson.GetProperty("id").GetGuid();
            Assert.Equal("Confirmed", createJson.GetProperty("status").GetString()); // Confirmed

            // Verify room is still Clean before check-in
            var roomPreCheckInResp = await client.GetAsync($"/api/rooms/{room1Id}");
            Assert.Equal(HttpStatusCode.OK, roomPreCheckInResp.StatusCode);
            var roomPreJson = await roomPreCheckInResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Clean", roomPreJson.GetProperty("status").GetString());

            // ── STEP 3: Check-in (200 OK -> Reservation: CheckedIn, Room -> Occupied) ──
            var checkInResp = await client.PostAsync($"/api/reservations/{res1Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.OK, checkInResp.StatusCode);
            var checkInJson = await checkInResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("CheckedIn", checkInJson.GetProperty("status").GetString()); // CheckedIn

            // Verify Room 201 transitioned to Occupied!
            var roomPostCheckInResp = await client.GetAsync($"/api/rooms/{room1Id}");
            var roomPostJson = await roomPostCheckInResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Occupied", roomPostJson.GetProperty("status").GetString());

            // ── STEP 4: Invalid Transition Guards during CheckedIn ─────────────────────
            // 4a. Re-check-in -> 409 Conflict (ERR_INVALID_STATUS_TRANSITION)
            var reCheckInResp = await client.PostAsync($"/api/reservations/{res1Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, reCheckInResp.StatusCode);
            var reCheckInBody = await reCheckInResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_INVALID_STATUS_TRANSITION", reCheckInBody);

            // 4b. Cancel while CheckedIn -> 409 Conflict (ERR_INVALID_STATUS_TRANSITION)
            var cancelWhileCheckedInResp = await client.PostAsJsonAsync($"/api/reservations/{res1Id}/cancel?propertyId={propId}", new
            {
                reason = "Khách muốn hủy khi đang ở"
            });
            Assert.Equal(HttpStatusCode.Conflict, cancelWhileCheckedInResp.StatusCode);
            var cancelBody = await cancelWhileCheckedInResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_INVALID_STATUS_TRANSITION", cancelBody);

            // ── STEP 5a: Attempt Check-out while unpaid -> 409 Conflict (ERR_OUTSTANDING_BALANCE) ───
            var unpaidCheckOutResp = await client.PostAsync($"/api/reservations/{res1Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, unpaidCheckOutResp.StatusCode);
            var unpaidCheckOutBody = await unpaidCheckOutResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_OUTSTANDING_BALANCE", unpaidCheckOutBody);

            // Settle balance via completed payment to satisfy POL-IO03
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                seedCtx.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    ReservationId = res1Id,
                    Amount = 300000m,
                    Method = PaymentMethod.Cash,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "SEED-SETTLE-POLIO03",
                    PaidAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                });
                await seedCtx.SaveChangesAsync();
            }

            // ── STEP 5b: Check-out after full payment (200 OK -> Reservation: CheckedOut, Room -> Dirty) ───
            var checkOutResp = await client.PostAsync($"/api/reservations/{res1Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.OK, checkOutResp.StatusCode);
            var checkOutJson = await checkOutResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("CheckedOut", checkOutJson.GetProperty("status").GetString()); // CheckedOut

            // Verify Room 201 transitioned to Dirty!
            var roomPostCheckOutResp = await client.GetAsync($"/api/rooms/{room1Id}");
            var roomPostCheckOutJson = await roomPostCheckOutResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Dirty", roomPostCheckOutJson.GetProperty("status").GetString());

            // ── STEP 6: Invalid Transition Guards during CheckedOut ────────────────────
            // 6a. Re-check-out -> 409 Conflict (ERR_INVALID_STATUS_TRANSITION)
            var reCheckOutResp = await client.PostAsync($"/api/reservations/{res1Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, reCheckOutResp.StatusCode);

            // 6b. Check-in on CheckedOut reservation -> 409 Conflict (ERR_INVALID_STATUS_TRANSITION)
            var checkInAfterCheckoutResp = await client.PostAsync($"/api/reservations/{res1Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, checkInAfterCheckoutResp.StatusCode);

            // ── STEP 7: Housekeeping Flow (Dirty -> Cleaning -> Clean) ─────────────────
            // 7a. Create new booking on Room 201 for later
            var bookingPayload2 = new
            {
                propertyId = propId,
                roomId = room1Id,
                rentalType = 1,
                startAtUtc = "2026-11-10T11:00:00Z",
                endAtUtc = "2026-11-10T13:00:00Z",
                guestName = "Pham Thi Next",
                guestEmail = "next@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-STAY-02"
            };

            var createResp2 = await client.PostAsJsonAsync("/api/reservations", bookingPayload2);
            Assert.Equal(HttpStatusCode.Created, createResp2.StatusCode);
            var res2Id = (await createResp2.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

            // 7b. Attempt check-in while Room 201 is DIRTY -> 409 Conflict (ERR_ROOM_NOT_CLEAN)
            var checkInDirtyResp = await client.PostAsync($"/api/reservations/{res2Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, checkInDirtyResp.StatusCode);
            var checkInDirtyBody = await checkInDirtyResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_ROOM_NOT_CLEAN", checkInDirtyBody);

            // 7c. Housekeeping cleans room: Dirty -> Cleaning -> Clean
            var updateCleaningResp = await client.PatchAsJsonAsync($"/api/rooms/{room1Id}/status", new
            {
                status = (int)RoomStatus.Cleaning,
                expectedOldStatus = (int)RoomStatus.Dirty
            });
            Assert.Equal(HttpStatusCode.OK, updateCleaningResp.StatusCode);

            // 7d. Attempt check-in while Room 201 is CLEANING -> 409 Conflict (ERR_ROOM_NOT_CLEAN)
            var checkInCleaningResp = await client.PostAsync($"/api/reservations/{res2Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Conflict, checkInCleaningResp.StatusCode);

            // 7e. Complete cleaning: Cleaning -> Clean
            var updateCleanResp = await client.PatchAsJsonAsync($"/api/rooms/{room1Id}/status", new
            {
                status = (int)RoomStatus.Clean,
                expectedOldStatus = (int)RoomStatus.Cleaning
            });
            Assert.Equal(HttpStatusCode.OK, updateCleanResp.StatusCode);

            // 7f. Now room is Clean -> Check-in succeeds!
            var checkInCleanResp = await client.PostAsync($"/api/reservations/{res2Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.OK, checkInCleanResp.StatusCode);
            var checkInCleanJson = await checkInCleanResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("CheckedIn", checkInCleanJson.GetProperty("status").GetString()); // CheckedIn

            // ── STEP 8: Cancellation Lifecycle on Room 202 ─────────────────────────────
            var bookingPayload3 = new
            {
                propertyId = propId,
                roomId = room2Id,
                rentalType = 1,
                startAtUtc = "2026-11-15T07:00:00Z",
                endAtUtc = "2026-11-15T09:00:00Z",
                guestName = "Hoang Van Cancel",
                guestEmail = "cancel@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-STAY-03"
            };

            var createResp3 = await client.PostAsJsonAsync("/api/reservations", bookingPayload3);
            Assert.Equal(HttpStatusCode.Created, createResp3.StatusCode);
            var res3Id = (await createResp3.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

            // Cancel reservation with reason
            var cancelResp = await client.PostAsJsonAsync($"/api/reservations/{res3Id}/cancel?propertyId={propId}", new
            {
                reason = "Khách hoãn chuyến công tác"
            });
            Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);
            var cancelJson = await cancelResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Cancelled", cancelJson.GetProperty("status").GetString()); // Cancelled
            Assert.Equal("Khách hoãn chuyến công tác", cancelJson.GetProperty("cancellationReason").GetString());
            Assert.True(cancelJson.TryGetProperty("cancelledAtUtc", out var cancelledTimeProp) && !string.IsNullOrWhiteSpace(cancelledTimeProp.GetString()));

            // Room 202 remains Clean
            var room2Resp = await client.GetAsync($"/api/rooms/{room2Id}");
            var room2Json = await room2Resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Clean", room2Json.GetProperty("status").GetString());

            // Re-cancel -> 409 Conflict (ERR_ALREADY_CANCELLED)
            var reCancelResp = await client.PostAsJsonAsync($"/api/reservations/{res3Id}/cancel?propertyId={propId}", new
            {
                reason = "Hủy lại"
            });
            Assert.Equal(HttpStatusCode.Conflict, reCancelResp.StatusCode);
            var reCancelBody = await reCancelResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_ALREADY_CANCELLED", reCancelBody);

            // ── STEP 9: Permission Security Gate (Contract Finding 2) ──────────────────
            // 9a. Read-only user (staff_readonly) lacking both Update permissions -> 403 Forbidden across all operations
            var clientReadOnly = factory.CreateClient();
            var loginReadOnlyResp = await clientReadOnly.PostAsJsonAsync("/api/auth/login", new
            {
                email = "staff_readonly@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginReadOnlyResp.StatusCode);
            var roToken = (await loginReadOnlyResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("accessToken").GetString()!;

            clientReadOnly.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", roToken);
            var switchRoResp = await clientReadOnly.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchRoResp.StatusCode);
            var scopedRoToken = (await switchRoResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            clientReadOnly.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedRoToken);
            clientReadOnly.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            var roCheckInResp = await clientReadOnly.PostAsync($"/api/reservations/{res2Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Forbidden, roCheckInResp.StatusCode);

            var roCheckOutResp = await clientReadOnly.PostAsync($"/api/reservations/{res2Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Forbidden, roCheckOutResp.StatusCode);

            var roCancelResp = await clientReadOnly.PostAsJsonAsync($"/api/reservations/{res2Id}/cancel?propertyId={propId}", new { reason = "Unauthorized cancel" });
            Assert.Equal(HttpStatusCode.Forbidden, roCancelResp.StatusCode);

            // 9b. Seed reservations on Room 203 and Room 204 for permission discrimination tests
            var createRes3Resp = await client.PostAsJsonAsync("/api/reservations", new
            {
                propertyId = propId,
                roomId = room3Id,
                rentalType = 1,
                startAtUtc = "2026-11-20T07:00:00Z",
                endAtUtc = "2026-11-20T09:00:00Z",
                guestName = "Pham CheckInOut Guard",
                guestEmail = "cio_guard@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-STAY-PERM-01"
            });
            Assert.Equal(HttpStatusCode.Created, createRes3Resp.StatusCode);
            var resPerm1Id = (await createRes3Resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

            var createRes4Resp = await client.PostAsJsonAsync("/api/reservations", new
            {
                propertyId = propId,
                roomId = room4Id,
                rentalType = 1,
                startAtUtc = "2026-11-21T07:00:00Z",
                endAtUtc = "2026-11-21T09:00:00Z",
                guestName = "Vu Reservation Guard",
                guestEmail = "res_guard@gmail.com",
                expectedTotalAmount = 300000m,
                idempotencyKey = "IDEMP-STAY-PERM-02"
            });
            Assert.Equal(HttpStatusCode.Created, createRes4Resp.StatusCode);
            var resPerm2Id = (await createRes4Resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

            // 9c. User with CHECK_IN_OUT:Update only (staff_checkinout)
            var clientCio = factory.CreateClient();
            var loginCioResp = await clientCio.PostAsJsonAsync("/api/auth/login", new
            {
                email = "staff_checkinout@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginCioResp.StatusCode);
            var cioToken = (await loginCioResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;

            clientCio.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cioToken);
            var switchCioResp = await clientCio.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchCioResp.StatusCode);
            var scopedCioToken = (await switchCioResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            clientCio.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedCioToken);
            clientCio.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            // CheckInOut staff ATTEMPT CANCEL -> 403 Forbidden (requires RESERVATIONS:Update!)
            var cioCancelForbidden = await clientCio.PostAsJsonAsync($"/api/reservations/{resPerm1Id}/cancel?propertyId={propId}", new { reason = "No permission to cancel" });
            Assert.Equal(HttpStatusCode.Forbidden, cioCancelForbidden.StatusCode);

            // CheckInOut staff ATTEMPT CHECK-IN -> 200 OK (has CHECK_IN_OUT:Update!)
            var cioCheckInOk = await clientCio.PostAsync($"/api/reservations/{resPerm1Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.OK, cioCheckInOk.StatusCode);

            // Settle balance for resPerm1Id to satisfy POL-IO03
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                seedCtx.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    ReservationId = resPerm1Id,
                    Amount = 300000m,
                    Method = PaymentMethod.Cash,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "SEED-PERM-POLIO03",
                    PaidAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                });
                await seedCtx.SaveChangesAsync();
            }

            // CheckInOut staff ATTEMPT CHECK-OUT -> 200 OK (has CHECK_IN_OUT:Update!)
            var cioCheckOutOk = await clientCio.PostAsync($"/api/reservations/{resPerm1Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.OK, cioCheckOutOk.StatusCode);

            // 9d. User with RESERVATIONS:Update only (staff_resonly)
            var clientRes = factory.CreateClient();
            var loginResResp = await clientRes.PostAsJsonAsync("/api/auth/login", new
            {
                email = "staff_resonly@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginResResp.StatusCode);
            var resToken = (await loginResResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;

            clientRes.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", resToken);
            var switchResResp = await clientRes.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, switchResResp.StatusCode);
            var scopedResToken = (await switchResResp.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("data").GetProperty("accessToken").GetString()!;

            clientRes.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scopedResToken);
            clientRes.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            // Reservations staff ATTEMPT CHECK-IN -> 403 Forbidden (requires CHECK_IN_OUT:Update!)
            var resCheckInForbidden = await clientRes.PostAsync($"/api/reservations/{resPerm2Id}/check-in?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Forbidden, resCheckInForbidden.StatusCode);

            // Reservations staff ATTEMPT CHECK-OUT -> 403 Forbidden (requires CHECK_IN_OUT:Update!)
            var resCheckOutForbidden = await clientRes.PostAsync($"/api/reservations/{resPerm1Id}/check-out?propertyId={propId}", null);
            Assert.Equal(HttpStatusCode.Forbidden, resCheckOutForbidden.StatusCode);

            // Reservations staff ATTEMPT CANCEL -> 200 OK (has RESERVATIONS:Update!)
            var resCancelOk = await clientRes.PostAsJsonAsync($"/api/reservations/{resPerm2Id}/cancel?propertyId={propId}", new { reason = "Hủy phòng hợp lệ bởi Reservations staff" });
            Assert.Equal(HttpStatusCode.OK, resCancelOk.StatusCode);

            // ── STEP 10: Branch Isolation Security Gate ────────────────────────────────
            var mismatchedPropId = Guid.NewGuid();

            // Mismatched query propertyId vs header X-Property-Id -> 400 Bad Request (ERR_CONTEXT_MISMATCH)
            var mismatchResp = await client.PostAsync($"/api/reservations/{res2Id}/check-in?propertyId={mismatchedPropId}", null);
            Assert.Equal(HttpStatusCode.BadRequest, mismatchResp.StatusCode);
        }
        finally
        {
            try
            {
                await using var cleanCmd = conn.CreateCommand();
                cleanCmd.CommandText = $"SET search_path TO public; DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
                await cleanCmd.ExecuteNonQueryAsync();
            }
            catch { }
            finally
            {
                NpgsqlConnection.ClearAllPools();
            }
        }
    }
}
