using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// End-to-end HTTP pipeline tests for Phase P5-GUEST-BOOKING-01 (Guest Booking, Quoting, Hold & Confirm).
/// Tests run against real PostgreSQL schemas via WebApplicationFactory with full ASP.NET Core middleware,
/// routing, JWT authentication, RBAC authorization, advisory key locking, and row-level physical room locking.
/// Covers all findings from Review Round 1 & Round 2:
/// 1. Anonymous access to public discovery & hold creation (200/201).
/// 2. Anonymous request to POST /api/public/bookings/{token}/confirm returns 401 Unauthorized ("HTTP anonymous forbidden").
/// 3. Staff dual permissions: RESERVATIONS.Update AND PAYMENTS.Create required for confirm.
///    - Staff with only RESERVATIONS.Update -> 403 Forbidden.
///    - Staff with only PAYMENTS.Create -> 403 Forbidden.
///    - Staff with both permissions -> 200 OK.
/// 4. Staff with branch mismatch calling confirm returns 400 Bad Request / 403 Forbidden ("branch mismatch").
/// 5. Shared invariant across writers (Finding 1):
///    - POST /api/payments with small amount (< 30% deposit) on online hold rejected with 400 Bad Request (ERR_INSUFFICIENT_DEPOSIT).
///    - POST /api/reservations/{id}/check-in on unconfirmed online hold rejected with 409 Conflict (ERR_HOLD_NOT_CONFIRMED).
///    - Expired online hold rejected across writers: payment (409 Conflict ERR_HOLD_EXPIRED), check-in (409 Conflict ERR_HOLD_EXPIRED), confirm (409 Conflict ERR_HOLD_EXPIRED).
///    - Expired online hold frees inventory: internal booking for same slot succeeds (201 Created) without overlap.
/// 6. Missing TTL fail-closed (Finding 3): Token with null TokenExpiresAtUtc rejected with 404 NotFound.
/// 7. Staff with valid manual receipt returns 200 OK ("valid manual receipt confirm") with idempotent replay & actor audit tag [BY:{userId}].
/// 8. Shared inventory race: Last physical room left, concurrent internal booking and online hold -> one wins (201), other gets 409 Conflict.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P5_GuestBookingHttpPipelineTests
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

    private sealed class GuestBookingWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForP5GuestBookingPipelineTestingMustBe32Bytes!";

        public GuestBookingWebApplicationFactory(string connectionString, string testSchema)
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

    private static async Task<string> AuthenticateStaffAsync(HttpClient client, string email, string password, Guid propertyId)
    {
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = email,
            password = password
        });
        loginResp.EnsureSuccessStatusCode();
        var loginJson = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var loginToken = loginJson.GetProperty("accessToken").GetString()!;

        using var switchReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/switch-context");
        switchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginToken);
        switchReq.Content = JsonContent.Create(new { propertyId = propertyId });
        var switchResp = await client.SendAsync(switchReq);
        switchResp.EnsureSuccessStatusCode();
        var switchJson = await switchResp.Content.ReadFromJsonAsync<JsonElement>();
        return switchJson.GetProperty("data").GetProperty("accessToken").GetString()!;
    }

    [Fact]
    public async Task HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p5_guest_http_{Guid.NewGuid():N}";

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
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();

            var userAdminId = Guid.NewGuid();
            var userOnlyResId = Guid.NewGuid();
            var userOnlyPayId = Guid.NewGuid();
            var userNoPermId = Guid.NewGuid();
            var userProp2Id = Guid.NewGuid();

            var roleAdminId = Guid.NewGuid();
            var roleOnlyResId = Guid.NewGuid();
            var roleOnlyPayId = Guid.NewGuid();
            var roleNoPermId = Guid.NewGuid();

            var roomType1Id = Guid.NewGuid();
            var roomTypeSingleId = Guid.NewGuid();

            var room1Id = Guid.NewGuid();
            var room2Id = Guid.NewGuid();
            var roomSingleId = Guid.NewGuid();

            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Tập đoàn Khách sạn Kỳ Co P5",
                    Code = "KYCO5",
                    Slug = "ky-co-p5",
                    Address = "100 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var property1 = new Property
                {
                    Id = prop1Id,
                    TenantId = tenantId,
                    Name = "Chi nhánh Non Nước P5",
                    Code = "NNP5",
                    Slug = "non-nuoc-p5",
                    Address = "100 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                var property2 = new Property
                {
                    Id = prop2Id,
                    TenantId = tenantId,
                    Name = "Chi nhánh Mỹ Khê P5",
                    Code = "MKP5",
                    Slug = "my-khe-p5",
                    Address = "200 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                // User 1: Staff with BOTH RESERVATIONS.Update AND PAYMENTS.Create on Property 1
                var userAdmin = new User
                {
                    Id = userAdminId,
                    Username = "staff_p5_admin",
                    Email = "staff_p5_admin@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff P5 Admin (Full)",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                // User 2: Staff with ONLY RESERVATIONS.Update (lacks PAYMENTS.Create) on Property 1
                var userOnlyRes = new User
                {
                    Id = userOnlyResId,
                    Username = "staff_p5_onlyres",
                    Email = "staff_p5_onlyres@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff P5 Only Reservations",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                // User 3: Staff with ONLY PAYMENTS.Create (lacks RESERVATIONS.Update) on Property 1
                var userOnlyPay = new User
                {
                    Id = userOnlyPayId,
                    Username = "staff_p5_onlypay",
                    Email = "staff_p5_onlypay@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff P5 Only Payments",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                // User 4: Staff with read only (ActionMask 1 = Read only) on Property 1
                var userNoPerm = new User
                {
                    Id = userNoPermId,
                    Username = "staff_p5_noperm",
                    Email = "staff_p5_noperm@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff P5 Read Only",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                // User 5: Staff with full permissions on Property 2 only (for branch mismatch test)
                var userProp2 = new User
                {
                    Id = userProp2Id,
                    Username = "staff_p5_prop2",
                    Email = "staff_p5_prop2@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Staff Property 2",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                // Permissions
                var funcRes = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "RESERVATIONS",
                    Name = "Reservations Management",
                    ModuleCode = "RESERVATIONS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var funcPay = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "PAYMENTS",
                    Name = "Payments Management",
                    ModuleCode = "PAYMENTS",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                var funcCheckInOut = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "CHECK_IN_OUT",
                    Name = "Check In Out Management",
                    ModuleCode = "CHECK_IN_OUT",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                // Roles
                var roleAdmin = new AccessRole
                {
                    Id = roleAdminId,
                    TenantId = tenantId,
                    Name = "ReservationAndPaymentAdminRole",
                    Code = "FULL_ADM"
                };

                var roleOnlyRes = new AccessRole
                {
                    Id = roleOnlyResId,
                    TenantId = tenantId,
                    Name = "ReservationOnlyRole",
                    Code = "RES_ONLY"
                };

                var roleOnlyPay = new AccessRole
                {
                    Id = roleOnlyPayId,
                    TenantId = tenantId,
                    Name = "PaymentOnlyRole",
                    Code = "PAY_ONLY"
                };

                var roleNoPerm = new AccessRole
                {
                    Id = roleNoPermId,
                    TenantId = tenantId,
                    Name = "ReservationReadOnlyRole",
                    Code = "RES_RO"
                };

                // Role Permissions
                var rolePermAdminRes = new RolePermission { RoleId = roleAdminId, FunctionId = funcRes.Id, ActionMask = 127 };
                var rolePermAdminPay = new RolePermission { RoleId = roleAdminId, FunctionId = funcPay.Id, ActionMask = 127 };
                var rolePermAdminCheckInOut = new RolePermission { RoleId = roleAdminId, FunctionId = funcCheckInOut.Id, ActionMask = 127 };

                var rolePermOnlyRes = new RolePermission { RoleId = roleOnlyResId, FunctionId = funcRes.Id, ActionMask = 127 }; // No PAYMENTS
                var rolePermOnlyPay = new RolePermission { RoleId = roleOnlyPayId, FunctionId = funcPay.Id, ActionMask = 127 }; // No RESERVATIONS

                var rolePermReadOnly = new RolePermission { RoleId = roleNoPermId, FunctionId = funcRes.Id, ActionMask = 1 }; // Read only (no Update, no Pay)

                // Staff Members
                var staffAdmin = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userAdminId,
                    RoleId = roleAdminId,
                    PropertyId = prop1Id,
                    StaffRole = StaffRole.Manager,
                    IsActive = true
                };

                var staffOnlyRes = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userOnlyResId,
                    RoleId = roleOnlyResId,
                    PropertyId = prop1Id,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var staffOnlyPay = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userOnlyPayId,
                    RoleId = roleOnlyPayId,
                    PropertyId = prop1Id,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var staffNoPerm = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userNoPermId,
                    RoleId = roleNoPermId,
                    PropertyId = prop1Id,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var staffProp2 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userProp2Id,
                    RoleId = roleAdminId,
                    PropertyId = prop2Id,
                    StaffRole = StaffRole.Manager,
                    IsActive = true
                };

                // Room Type 1: Deluxe Ocean (2 physical rooms 101, 102)
                var roomType1 = new RoomType
                {
                    Id = roomType1Id,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    Name = "Deluxe Ocean View",
                    Code = "DLX-OCN",
                    BasePrice = 300000m,
                    MaxOccupancy = 2
                };

                var room1 = new Room
                {
                    Id = room1Id,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomType1Id,
                    RoomNumber = "101",
                    Floor = 1,
                    Status = RoomStatus.Clean
                };

                var room2 = new Room
                {
                    Id = room2Id,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomType1Id,
                    RoomNumber = "102",
                    Floor = 1,
                    Status = RoomStatus.Clean
                };

                var rate1 = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomType1Id,
                    FirstHours = 2,
                    FirstHoursPrice = 300000m,
                    AdditionalHourPrice = 100000m,
                    NightlyPrice = 1200000m,
                    Currency = "VND",
                    EffectiveFrom = new DateOnly(2026, 1, 1),
                    EffectiveTo = new DateOnly(2026, 12, 31),
                    CreatedByUserId = userAdminId,
                    IsActive = true
                };

                // Room Type Single: Studio Executive (ONLY 1 physical room 201 for concurrency race)
                var roomTypeSingle = new RoomType
                {
                    Id = roomTypeSingleId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    Name = "Studio Executive Single",
                    Code = "STD-SGL",
                    BasePrice = 200000m,
                    MaxOccupancy = 2
                };

                var roomSingle = new Room
                {
                    Id = roomSingleId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomTypeSingleId,
                    RoomNumber = "201",
                    Floor = 2,
                    Status = RoomStatus.Clean
                };

                var rateSingle = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomTypeSingleId,
                    FirstHours = 2,
                    FirstHoursPrice = 200000m,
                    AdditionalHourPrice = 80000m,
                    NightlyPrice = 800000m,
                    Currency = "VND",
                    EffectiveFrom = new DateOnly(2026, 1, 1),
                    EffectiveTo = new DateOnly(2026, 12, 31),
                    CreatedByUserId = userAdminId,
                    IsActive = true
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(property1, property2);
                seedCtx.Users.AddRange(userAdmin, userOnlyRes, userOnlyPay, userNoPerm, userProp2);
                seedCtx.PermissionFunctions.AddRange(funcRes, funcPay, funcCheckInOut);
                seedCtx.AccessRoles.AddRange(roleAdmin, roleOnlyRes, roleOnlyPay, roleNoPerm);
                seedCtx.RolePermissions.AddRange(rolePermAdminRes, rolePermAdminPay, rolePermAdminCheckInOut, rolePermOnlyRes, rolePermOnlyPay, rolePermReadOnly);
                seedCtx.TenantStaffMembers.AddRange(staffAdmin, staffOnlyRes, staffOnlyPay, staffNoPerm, staffProp2);
                seedCtx.RoomTypes.AddRange(roomType1, roomTypeSingle);
                seedCtx.Rooms.AddRange(room1, room2, roomSingle);
                seedCtx.RoomTypeRates.AddRange(rate1, rateSingle);

                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory
            await using var factory = new GuestBookingWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── SCENARIO 1: Anonymous Public Discovery & Hold Creation (200 / 201) ────────
            // 1.1 List properties (anonymous)
            var propsResp = await client.GetAsync("/api/public/properties");
            Assert.Equal(HttpStatusCode.OK, propsResp.StatusCode);
            var props = await propsResp.Content.ReadFromJsonAsync<IReadOnlyList<PublicPropertyDto>>();
            Assert.NotNull(props);
            Assert.Contains(props, p => p.Slug == "non-nuoc-p5");

            // 1.2 Get property detail by slug
            var propDetailResp = await client.GetAsync("/api/public/properties/non-nuoc-p5");
            Assert.Equal(HttpStatusCode.OK, propDetailResp.StatusCode);
            var propDetail = await propDetailResp.Content.ReadFromJsonAsync<PublicPropertyDto>();
            Assert.NotNull(propDetail);
            Assert.Equal("Chi nhánh Non Nước P5", propDetail.Name);

            // 1.3 Get room types by slug
            var rtypesResp = await client.GetAsync("/api/public/properties/non-nuoc-p5/room-types");
            Assert.Equal(HttpStatusCode.OK, rtypesResp.StatusCode);
            var rtypes = await rtypesResp.Content.ReadFromJsonAsync<IReadOnlyList<PublicRoomTypeDto>>();
            Assert.NotNull(rtypes);
            Assert.Contains(rtypes, rt => rt.Id == roomType1Id);

            // 1.4 Check availability for Hourly stay (2 hours: 300,000 VND)
            var availResp = await client.GetAsync($"/api/public/properties/non-nuoc-p5/availability?rentalType=1&startAtUtc=2026-11-15T07:00:00Z&endAtUtc=2026-11-15T09:00:00Z");
            Assert.Equal(HttpStatusCode.OK, availResp.StatusCode);
            var availList = await availResp.Content.ReadFromJsonAsync<IReadOnlyList<PublicRoomTypeAvailabilityDto>>();
            Assert.NotNull(availList);
            var avail1 = availList.First(a => a.RoomTypeId == roomType1Id);
            Assert.True(avail1.IsAvailable);
            Assert.Equal(2, avail1.AvailableRooms);

            // 1.5 Authoritative quote calculation
            var quoteResp = await client.PostAsJsonAsync("/api/public/quotes/calculate", new
            {
                propertySlug = "non-nuoc-p5",
                roomTypeId = roomType1Id,
                rentalType = 1, // Hourly
                startAtUtc = "2026-11-15T07:00:00Z",
                endAtUtc = "2026-11-15T09:00:00Z"
            });
            Assert.Equal(HttpStatusCode.OK, quoteResp.StatusCode);
            var quote = await quoteResp.Content.ReadFromJsonAsync<QuoteDto>();
            Assert.NotNull(quote);
            Assert.Equal(300000m, quote.TotalAmount);

            // 1.6 Invalid Idempotency-Key grammar returns 400 Bad Request
            var badKeyHoldResp = await client.PostAsJsonAsync("/api/public/bookings/hold", new
            {
                propertySlug = "non-nuoc-p5",
                roomTypeId = roomType1Id,
                rentalType = 1,
                startAtUtc = "2026-11-15T07:00:00Z",
                endAtUtc = "2026-11-15T09:00:00Z",
                guestName = "Nguyen Van A",
                guestEmail = "nguyenvana@gmail.com",
                guestPhone = "0901234567",
                numberOfGuests = 1,
                idempotencyKey = "bad key with spaces!"
            });
            Assert.Equal(HttpStatusCode.BadRequest, badKeyHoldResp.StatusCode);
            var badKeyBody = await badKeyHoldResp.Content.ReadAsStringAsync();
            Assert.Contains("ERR_INVALID_IDEMPOTENCY_KEY", badKeyBody);

            // 1.7 Anonymous room hold creation (201 Created)
            var holdKey1 = "hold-pipeline-key-001";
            var holdPayload = new
            {
                propertySlug = "non-nuoc-p5",
                roomTypeId = roomType1Id,
                rentalType = 1,
                startAtUtc = "2026-11-15T07:00:00Z",
                endAtUtc = "2026-11-15T09:00:00Z",
                guestName = "Nguyen Van A",
                guestEmail = "nguyenvana@gmail.com",
                guestPhone = "0901234567",
                numberOfGuests = 1,
                expectedTotalAmount = 300000m,
                idempotencyKey = holdKey1
            };

            var holdResp = await client.PostAsJsonAsync("/api/public/bookings/hold", holdPayload);
            Assert.Equal(HttpStatusCode.Created, holdResp.StatusCode);
            var hold = await holdResp.Content.ReadFromJsonAsync<GuestHoldDto>();
            Assert.NotNull(hold);
            Assert.NotEmpty(hold.LookupToken);
            Assert.NotEmpty(hold.ConfirmationCode);
            Assert.Equal(300000m, hold.TotalAmount);
            Assert.Equal(90000m, hold.DepositRequired); // 30% of 300,000 VND
            Assert.Equal("PendingPayment", hold.Status);
            Assert.True(hold.SecondsRemaining > 0);

            var lookupToken = hold.LookupToken;

            // 1.8 Anonymous token lookup (200 OK with PII masking)
            var tokenLookupResp = await client.GetAsync($"/api/public/bookings/{lookupToken}");
            Assert.Equal(HttpStatusCode.OK, tokenLookupResp.StatusCode);
            var detail = await tokenLookupResp.Content.ReadFromJsonAsync<GuestBookingDetailDto>();
            Assert.NotNull(detail);
            Assert.Equal("PendingPayment", detail.Status);
            Assert.Equal(300000m, detail.TotalAmount);
            Assert.Equal(90000m, detail.DepositRequired);
            Assert.Equal(0m, detail.PaidAmount);
            Assert.DoesNotContain("nguyenvana@gmail.com", detail.MaskedGuestEmail);
            Assert.Contains("***", detail.MaskedGuestPhone);

            // ── SCENARIO 2: Anonymous POST confirm forbidden (401 Unauthorized) ─────────
            var confirmPayloadValid = new
            {
                paymentAmount = 90000m,
                paymentMethod = "BankTransfer",
                transactionRef = "UNC-TEST-9999",
                propertyId = prop1Id,
                idempotencyKey = "confirm-key-attempt-01"
            };

            var anonConfirmResp = await client.PostAsJsonAsync($"/api/public/bookings/{lookupToken}/confirm", confirmPayloadValid);
            Assert.Equal(HttpStatusCode.Unauthorized, anonConfirmResp.StatusCode);

            // ── SCENARIO 3: Dual Permission Enforcement (Finding 2) ─────────────────────
            // 3.1 Staff with ONLY RESERVATIONS.Update (lacks PAYMENTS.Create) -> 403 Forbidden
            var tokenOnlyRes = await AuthenticateStaffAsync(client, "staff_p5_onlyres@hotel.com", "P@ssword123!", prop1Id);
            using var reqOnlyRes = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqOnlyRes.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenOnlyRes);
            reqOnlyRes.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqOnlyRes.Content = JsonContent.Create(confirmPayloadValid);
            var respOnlyRes = await client.SendAsync(reqOnlyRes);
            Assert.Equal(HttpStatusCode.Forbidden, respOnlyRes.StatusCode);

            // 3.2 Staff with ONLY PAYMENTS.Create (lacks RESERVATIONS.Update) -> 403 Forbidden
            var tokenOnlyPay = await AuthenticateStaffAsync(client, "staff_p5_onlypay@hotel.com", "P@ssword123!", prop1Id);
            using var reqOnlyPay = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqOnlyPay.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenOnlyPay);
            reqOnlyPay.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqOnlyPay.Content = JsonContent.Create(confirmPayloadValid);
            var respOnlyPay = await client.SendAsync(reqOnlyPay);
            Assert.Equal(HttpStatusCode.Forbidden, respOnlyPay.StatusCode);

            // 3.3 Staff with Read-only (lacks both Update and Create) -> 403 Forbidden
            var tokenNoPerm = await AuthenticateStaffAsync(client, "staff_p5_noperm@hotel.com", "P@ssword123!", prop1Id);
            using var reqNoPerm = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqNoPerm.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenNoPerm);
            reqNoPerm.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqNoPerm.Content = JsonContent.Create(confirmPayloadValid);
            var respNoPerm = await client.SendAsync(reqNoPerm);
            Assert.Equal(HttpStatusCode.Forbidden, respNoPerm.StatusCode);

            // ── SCENARIO 4: Staff with branch mismatch (400 Bad Request / 403 Forbidden) ─
            // Staff 5 is authenticated only for Property 2, trying to confirm a booking on Property 1
            var tokenProp2 = await AuthenticateStaffAsync(client, "staff_p5_prop2@hotel.com", "P@ssword123!", prop2Id);

            using var reqBranchMismatch = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqBranchMismatch.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenProp2);
            reqBranchMismatch.Headers.Add("X-Property-Id", prop2Id.ToString());
            reqBranchMismatch.Content = JsonContent.Create(new
            {
                paymentAmount = 90000m,
                paymentMethod = "BankTransfer",
                transactionRef = "UNC-TEST-BRANCH",
                propertyId = prop2Id,
                idempotencyKey = "confirm-key-branch-01"
            });

            var respBranchMismatch = await client.SendAsync(reqBranchMismatch);
            Assert.True(respBranchMismatch.StatusCode == HttpStatusCode.BadRequest || respBranchMismatch.StatusCode == HttpStatusCode.Forbidden);
            var mismatchBody = await respBranchMismatch.Content.ReadAsStringAsync();
            Assert.Contains("ERR_BRANCH_MISMATCH", mismatchBody);

            // ── SCENARIO 5: Shared Invariant Enforcement on Writers (Finding 1) ──────────
            var tokenAdmin = await AuthenticateStaffAsync(client, "staff_p5_admin@hotel.com", "P@ssword123!", prop1Id);

            // 5.1 Staff calls POST /api/payments with small amount (1,000 VND < 90,000 VND deposit) -> 400 Bad Request (ERR_INSUFFICIENT_DEPOSIT)
            using var reqSmallPay = new HttpRequestMessage(HttpMethod.Post, "/api/payments");
            reqSmallPay.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqSmallPay.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqSmallPay.Content = JsonContent.Create(new
            {
                reservationId = hold.ReservationId,
                propertyId = prop1Id,
                amount = 1000m,
                method = (int)PaymentMethod.Cash,
                transactionRef = "MANUAL-SMALL-BYPASS",
                idempotencyKey = "small-pay-attempt-01"
            });
            var respSmallPay = await client.SendAsync(reqSmallPay);
            Assert.Equal(HttpStatusCode.BadRequest, respSmallPay.StatusCode);
            var smallPayBody = await respSmallPay.Content.ReadAsStringAsync();
            Assert.Contains("ERR_INSUFFICIENT_DEPOSIT", smallPayBody);

            // 5.2 Staff calls POST /api/reservations/{id}/check-in on unconfirmed online hold -> 409 Conflict (ERR_HOLD_NOT_CONFIRMED)
            using var reqCheckInUnconfirmed = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{hold.ReservationId}/check-in?propertyId={prop1Id}");
            reqCheckInUnconfirmed.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqCheckInUnconfirmed.Headers.Add("X-Property-Id", prop1Id.ToString());
            var respCheckInUnconfirmed = await client.SendAsync(reqCheckInUnconfirmed);
            Assert.Equal(HttpStatusCode.Conflict, respCheckInUnconfirmed.StatusCode);
            var checkInUnconfirmedBody = await respCheckInUnconfirmed.Content.ReadAsStringAsync();
            Assert.Contains("ERR_HOLD_NOT_CONFIRMED", checkInUnconfirmedBody);

            // 5.3 Staff calls POST /api/public/bookings/{token}/confirm with insufficient deposit (< 30%) -> 400 Bad Request
            using var reqInsufficient = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqInsufficient.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqInsufficient.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqInsufficient.Content = JsonContent.Create(new
            {
                paymentAmount = 50000m, // Less than required 90,000 VND
                paymentMethod = "Cash",
                transactionRef = "RECEIPT-CASH-001",
                propertyId = prop1Id,
                idempotencyKey = "confirm-key-insufficient-01"
            });

            var respInsufficient = await client.SendAsync(reqInsufficient);
            Assert.Equal(HttpStatusCode.BadRequest, respInsufficient.StatusCode);
            var insufficientBody = await respInsufficient.Content.ReadAsStringAsync();
            Assert.Contains("ERR_INSUFFICIENT_DEPOSIT", insufficientBody);

            // ── SCENARIO 6: Staff valid manual receipt confirm (200 OK) + Idempotent Replay
            var validConfirmKey = "confirm-key-valid-001";
            var validConfirmPayload = new
            {
                paymentAmount = 100000m, // >= 90,000 VND
                paymentMethod = "BankTransfer",
                transactionRef = "UNC-MANUAL-REC-001",
                propertyId = prop1Id,
                idempotencyKey = validConfirmKey
            };

            using var reqValidConfirm = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqValidConfirm.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqValidConfirm.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqValidConfirm.Content = JsonContent.Create(validConfirmPayload);

            var respValidConfirm = await client.SendAsync(reqValidConfirm);
            Assert.Equal(HttpStatusCode.OK, respValidConfirm.StatusCode);
            var confirmedDetail = await respValidConfirm.Content.ReadFromJsonAsync<GuestBookingDetailDto>();
            Assert.NotNull(confirmedDetail);
            Assert.Equal("Confirmed", confirmedDetail.Status);
            Assert.Equal(100000m, confirmedDetail.PaidAmount);

            // Verify idempotency replay with same payload returns 200 OK without double payment
            using var reqReplay = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqReplay.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqReplay.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqReplay.Content = JsonContent.Create(validConfirmPayload);

            var respReplay = await client.SendAsync(reqReplay);
            Assert.Equal(HttpStatusCode.OK, respReplay.StatusCode);
            var replayDetail = await respReplay.Content.ReadFromJsonAsync<GuestBookingDetailDto>();
            Assert.NotNull(replayDetail);
            Assert.Equal("Confirmed", replayDetail.Status);
            Assert.Equal(100000m, replayDetail.PaidAmount);

            // Verify idempotency conflict when replaying same key with changed payload (409 Conflict)
            using var reqConflict = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{lookupToken}/confirm");
            reqConflict.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqConflict.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqConflict.Content = JsonContent.Create(new
            {
                paymentAmount = 150000m, // Changed amount
                paymentMethod = "BankTransfer",
                transactionRef = "UNC-MANUAL-REC-001",
                propertyId = prop1Id,
                idempotencyKey = validConfirmKey
            });

            var respConflict = await client.SendAsync(reqConflict);
            Assert.Equal(HttpStatusCode.Conflict, respConflict.StatusCode);
            var conflictBody = await respConflict.Content.ReadAsStringAsync();
            Assert.Contains("ERR_IDEMPOTENCY_", conflictBody);

            // Verify database state: exactly ONE payment created with actor audit tag [BY:{userId}]
            await using (var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var payments = await verifyCtx.Payments
                    .Where(p => p.ReservationId == hold.ReservationId)
                    .ToListAsync();

                Assert.Single(payments);
                var payment = payments[0];
                Assert.Equal(100000m, payment.Amount);
                Assert.Equal(PaymentStatus.Completed, payment.Status);
                Assert.Contains($"[IK:{validConfirmKey}]", payment.TransactionRef);
                Assert.Contains($"[BY:{userAdminId}]", payment.TransactionRef);
                Assert.Contains("UNC-MANUAL-REC-001", payment.TransactionRef);
            }

            // ── SCENARIO 6.5: Confirmed Booking Post-TTL Lifecycle (Check-in, Balance Settlement & Check-out) ──
            // Finding (Round 3): A confirmed online hold whose 15-minute hold deadline has passed must still allow:
            // 1) Staff Check-In (200 OK -> CheckedIn).
            // 2) Premature Check-Out blocked by outstanding balance (409 Conflict -> ERR_OUTSTANDING_BALANCE).
            // 3) Collection of remaining balance via POST /api/payments (200 OK).
            // 4) Check-Out with settled balance succeeds (200 OK -> CheckedOut, Room -> Dirty).

            // Age the confirmed booking's 15-min hold deadline into the past (30 minutes ago)
            await using (var ageCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var resToAge = await ageCtx.Reservations.FindAsync(hold.ReservationId);
                Assert.NotNull(resToAge);
                var snapToAge = ReservationSnapshotHelper.TryDeserialize(resToAge.Notes)!;
                snapToAge.HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-30);
                resToAge.Notes = ReservationSnapshotHelper.Serialize(snapToAge);
                await ageCtx.SaveChangesAsync();
            }

            // 6.5.1 Staff check-in succeeds even though old hold deadline is in the past
            using var reqCheckInConfirmed = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{hold.ReservationId}/check-in?propertyId={prop1Id}");
            reqCheckInConfirmed.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqCheckInConfirmed.Headers.Add("X-Property-Id", prop1Id.ToString());
            var respCheckInConfirmed = await client.SendAsync(reqCheckInConfirmed);
            Assert.Equal(HttpStatusCode.OK, respCheckInConfirmed.StatusCode);
            var checkInJson = await respCheckInConfirmed.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("CheckedIn", checkInJson.GetProperty("status").GetString());

            // 6.5.2 Premature checkout blocked by POL-IO03 outstanding balance guard (409 Conflict)
            using var reqCheckOutPremature = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{hold.ReservationId}/check-out?propertyId={prop1Id}");
            reqCheckOutPremature.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqCheckOutPremature.Headers.Add("X-Property-Id", prop1Id.ToString());
            var respCheckOutPremature = await client.SendAsync(reqCheckOutPremature);
            Assert.Equal(HttpStatusCode.Conflict, respCheckOutPremature.StatusCode);
            var prematureBody = await respCheckOutPremature.Content.ReadAsStringAsync();
            Assert.Contains("ERR_OUTSTANDING_BALANCE", prematureBody);

            // 6.5.3 Collect remaining balance (200,000 VND) via POST /api/payments on CheckedIn reservation
            using var reqPayRemaining = new HttpRequestMessage(HttpMethod.Post, "/api/payments");
            reqPayRemaining.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqPayRemaining.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqPayRemaining.Content = JsonContent.Create(new
            {
                reservationId = hold.ReservationId,
                propertyId = prop1Id,
                amount = 200000m, // 300,000 total - 100,000 deposit = 200,000 remaining
                method = (int)PaymentMethod.Cash,
                transactionRef = "FINAL-SETTLEMENT-CASH",
                idempotencyKey = "final-settle-key-01"
            });
            var respPayRemaining = await client.SendAsync(reqPayRemaining);
            Assert.Equal(HttpStatusCode.Created, respPayRemaining.StatusCode);
            var payRemainingJson = await respPayRemaining.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(200000m, payRemainingJson.GetProperty("amount").GetDecimal());

            // 6.5.4 Checkout succeeds once balance is zero -> 200 OK, Status: CheckedOut
            using var reqCheckOutSuccess = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{hold.ReservationId}/check-out?propertyId={prop1Id}");
            reqCheckOutSuccess.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqCheckOutSuccess.Headers.Add("X-Property-Id", prop1Id.ToString());
            var respCheckOutSuccess = await client.SendAsync(reqCheckOutSuccess);
            Assert.Equal(HttpStatusCode.OK, respCheckOutSuccess.StatusCode);
            var checkOutJson = await respCheckOutSuccess.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("CheckedOut", checkOutJson.GetProperty("status").GetString());

            // Verify room is now Dirty after checkout
            await using (var verifyRoomCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var finishedRoom = await verifyRoomCtx.Rooms.FindAsync(room1Id);
                Assert.NotNull(finishedRoom);
                Assert.Equal(RoomStatus.Dirty, finishedRoom.Status);
            }

            // ── SCENARIO 7: Missing TTL Fail-Closed & Expired Hold Writers Rejection (Finding 1 & 3)
            // 7.1 Seed an expired hold and a hold with missing TTL in database
            var expiredToken = "expired_token_" + Guid.NewGuid().ToString("N");
            var missingTtlToken = "missing_ttl_" + Guid.NewGuid().ToString("N");
            var expiredResId = Guid.NewGuid();
            var missingTtlResId = Guid.NewGuid();

            await using (var seedCtx2 = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var snapExpired = new ReservationSnapshot
                {
                    IsOnlineHold = true,
                    HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-10), // Expired 10 mins ago
                    LookupToken = expiredToken,
                    DepositRequired = 90000m,
                    TokenExpiresAtUtc = DateTime.UtcNow.AddDays(7),
                    IsTokenRevoked = false,
                    RoomTypeId = roomType1Id,
                    TotalAmount = 300000m
                };

                var resExpired = new Reservation
                {
                    Id = expiredResId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomId = room2Id, // Physical room 102
                    ConfirmationCode = "EXP-001",
                    GuestName = "Expired Guest",
                    GuestEmail = "expired@hotel.com",
                    GuestPhone = "0900000001",
                    CheckInDate = new DateOnly(2026, 11, 25),
                    CheckOutDate = new DateOnly(2026, 11, 25),
                    Status = ReservationStatus.PendingPayment,
                    TotalAmount = 300000m,
                    Notes = ReservationSnapshotHelper.Serialize(snapExpired),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20),
                    UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
                };

                var snapMissingTtl = new ReservationSnapshot
                {
                    IsOnlineHold = true,
                    HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(10),
                    LookupToken = missingTtlToken,
                    DepositRequired = 90000m,
                    TokenExpiresAtUtc = null, // Missing TTL
                    IsTokenRevoked = false,
                    RoomTypeId = roomType1Id,
                    TotalAmount = 300000m
                };

                var resMissingTtl = new Reservation
                {
                    Id = missingTtlResId,
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomId = room1Id,
                    ConfirmationCode = "NOTTL-001",
                    GuestName = "No TTL Guest",
                    GuestEmail = "nottl@hotel.com",
                    GuestPhone = "0900000002",
                    CheckInDate = new DateOnly(2026, 11, 26),
                    CheckOutDate = new DateOnly(2026, 11, 26),
                    Status = ReservationStatus.PendingPayment,
                    TotalAmount = 300000m,
                    Notes = ReservationSnapshotHelper.Serialize(snapMissingTtl),
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                seedCtx2.Reservations.AddRange(resExpired, resMissingTtl);
                await seedCtx2.SaveChangesAsync();
            }

            // 7.2 Missing TTL token lookup -> 404 NotFound (fail-closed)
            var respMissingTtl = await client.GetAsync($"/api/public/bookings/{missingTtlToken}");
            Assert.Equal(HttpStatusCode.NotFound, respMissingTtl.StatusCode);

            // 7.3 Expired hold payment attempt via POST /api/payments -> 409 Conflict (ERR_HOLD_EXPIRED)
            using var reqPayExpired = new HttpRequestMessage(HttpMethod.Post, "/api/payments");
            reqPayExpired.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqPayExpired.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqPayExpired.Content = JsonContent.Create(new
            {
                reservationId = expiredResId,
                propertyId = prop1Id,
                amount = 90000m,
                method = (int)PaymentMethod.Cash,
                transactionRef = "PAY-EXPIRED-HOLD",
                idempotencyKey = "pay-expired-key-01"
            });
            var respPayExpired = await client.SendAsync(reqPayExpired);
            Assert.Equal(HttpStatusCode.Conflict, respPayExpired.StatusCode);
            var payExpiredBody = await respPayExpired.Content.ReadAsStringAsync();
            Assert.Contains("ERR_HOLD_EXPIRED", payExpiredBody);

            // 7.4 Expired hold check-in attempt via POST /api/reservations/{id}/check-in -> 409 Conflict (ERR_HOLD_EXPIRED)
            using var reqCheckInExpired = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{expiredResId}/check-in?propertyId={prop1Id}");
            reqCheckInExpired.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqCheckInExpired.Headers.Add("X-Property-Id", prop1Id.ToString());
            var respCheckInExpired = await client.SendAsync(reqCheckInExpired);
            Assert.Equal(HttpStatusCode.Conflict, respCheckInExpired.StatusCode);
            var checkInExpiredBody = await respCheckInExpired.Content.ReadAsStringAsync();
            Assert.Contains("ERR_HOLD_EXPIRED", checkInExpiredBody);

            // 7.5 Expired hold confirm attempt via POST /api/public/bookings/{token}/confirm -> 409 Conflict (ERR_HOLD_EXPIRED)
            using var reqConfirmExpired = new HttpRequestMessage(HttpMethod.Post, $"/api/public/bookings/{expiredToken}/confirm");
            reqConfirmExpired.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
            reqConfirmExpired.Headers.Add("X-Property-Id", prop1Id.ToString());
            reqConfirmExpired.Content = JsonContent.Create(new
            {
                paymentAmount = 90000m,
                paymentMethod = "BankTransfer",
                transactionRef = "CONFIRM-EXPIRED-HOLD",
                propertyId = prop1Id,
                idempotencyKey = "confirm-expired-key-01"
            });
            var respConfirmExpired = await client.SendAsync(reqConfirmExpired);
            Assert.Equal(HttpStatusCode.Conflict, respConfirmExpired.StatusCode);
            var confirmExpiredBody = await respConfirmExpired.Content.ReadAsStringAsync();
            Assert.Contains("ERR_HOLD_EXPIRED", confirmExpiredBody);

            // ── SCENARIO 8: Shared Inventory Race (Online Hold vs Internal Booking) ───────
            // roomTypeSingleId has ONLY 1 physical room (roomSingleId = 201).
            // Concurrently fire:
            // - Internal staff booking via POST /api/reservations
            // - Anonymous guest hold via POST /api/public/bookings/hold
            // For the exact same time window.
            var raceStartUtc = "2026-11-20T07:00:00Z";
            var raceEndUtc = "2026-11-20T09:00:00Z";

            var internalPayload = new
            {
                propertyId = prop1Id,
                roomId = roomSingleId,
                rentalType = 1, // Hourly
                startAtUtc = raceStartUtc,
                endAtUtc = raceEndUtc,
                guestName = "Internal Guest Race",
                guestEmail = "internalrace@hotel.com",
                guestPhone = "0911112222",
                numberOfGuests = 1,
                expectedTotalAmount = 200000m,
                idempotencyKey = "race-internal-booking-key-01"
            };

            var onlinePayload = new
            {
                propertySlug = "non-nuoc-p5",
                roomTypeId = roomTypeSingleId,
                rentalType = 1, // Hourly
                startAtUtc = raceStartUtc,
                endAtUtc = raceEndUtc,
                guestName = "Online Guest Race",
                guestEmail = "onlinerace@hotel.com",
                guestPhone = "0933334444",
                numberOfGuests = 1,
                expectedTotalAmount = 200000m,
                idempotencyKey = "race-online-hold-key-01"
            };

            // Task 1: Internal staff booking
            var taskInternal = Task.Run(async () =>
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "/api/reservations");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenAdmin);
                req.Headers.Add("X-Property-Id", prop1Id.ToString());
                req.Content = JsonContent.Create(internalPayload);
                return await client.SendAsync(req);
            });

            // Task 2: Anonymous guest hold
            var taskOnline = Task.Run(async () =>
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "/api/public/bookings/hold");
                req.Content = JsonContent.Create(onlinePayload);
                return await client.SendAsync(req);
            });

            var raceResponses = await Task.WhenAll(taskInternal, taskOnline);
            var respA = raceResponses[0];
            var respB = raceResponses[1];

            var statusA = respA.StatusCode;
            var statusB = respB.StatusCode;

            // Exactly ONE must succeed (201 Created), and the other must fail with 409 Conflict
            var statuses = new[] { statusA, statusB };
            Assert.Contains(HttpStatusCode.Created, statuses);
            Assert.Contains(HttpStatusCode.Conflict, statuses);

            // Verify in database: exactly ONE active reservation exists for roomSingleId
            await using (var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                var activeRes = await verifyCtx.Reservations
                    .Where(r => r.RoomId == roomSingleId &&
                                (r.Status == ReservationStatus.PendingPayment ||
                                 r.Status == ReservationStatus.Confirmed))
                    .ToListAsync();

                Assert.Single(activeRes);
            }
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
