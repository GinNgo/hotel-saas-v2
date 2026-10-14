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
/// HTTP Pipeline end-to-end integration tests for Phase P4-CASH-FOLIO-01:
/// 1. Cashier authentication & branch context switching.
/// 2. GET /api/reservations/{id}/folio - Balance reconciliation before and after payments.
/// 3. POST /api/payments - Cash deposit collection & automatic transition from PendingPayment to Confirmed.
/// 4. POST /api/payments - Idempotency replay with identical key returns cached payment.
/// 5. POST /api/payments - BankTransfer payment settling remaining folio balance (isFullyPaid = true).
/// 6. Overpayment guard (400 Bad Request) & already settled guard (409 Conflict).
/// 7. GET /api/payments & GET /api/payments/summary - Audit log queries and cashier summary dashboard.
/// 8. Security gates: 403 Forbidden on missing PAYMENTS:Create / PAYMENTS:Read / RESERVATIONS:Read,
///    and 400 Bad Request on branch context mismatch.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class PaymentAndFolioHttpPipelineTests
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

    private sealed class PaymentTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForPaymentPipelineTestingMustBeAtLeast32Bytes!";

        public PaymentTestWebApplicationFactory(string connectionString, string testSchema)
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
    public async Task HttpPipeline_PaymentsAndFolio_FullCashierFlow_And_SecurityGates()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"p4_payments_http_{Guid.NewGuid():N}";

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
            var otherPropId = Guid.NewGuid();
            var cashierUserId = Guid.NewGuid();
            var cashierRoleId = Guid.NewGuid();
            var restrictedUserId = Guid.NewGuid();
            var restrictedRoleId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var resId = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            // 1. Seed Database Schema and Entities
            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Bãi Cháy",
                    Code = "KSBC",
                    Slug = "ks-bai-chay",
                    Address = "88 Ha Long",
                    City = "Quang Ninh",
                    Status = TenantStatus.Active
                };

                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Chi nhánh Bãi Cháy",
                    Code = "BC01",
                    Slug = "bai-chay-01",
                    Address = "88 Ha Long",
                    City = "Quang Ninh",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                var otherProperty = new Property
                {
                    Id = otherPropId,
                    TenantId = tenantId,
                    Name = "Chi nhánh Hòn Gai",
                    Code = "HG01",
                    Slug = "hon-gai-01",
                    Address = "12 Le Thanh Tong",
                    City = "Quang Ninh",
                    Status = PropertyStatus.Active,
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12
                };

                // Cashier User (has PAYMENTS:Create = 2, PAYMENTS:Read = 1, RESERVATIONS:Read = 1, PROPERTIES:Read = 1)
                var cashierUser = new User
                {
                    Id = cashierUserId,
                    Username = "cashier_user",
                    Email = "cashier@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Cashier Staff",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var cashierRole = new AccessRole
                {
                    Id = cashierRoleId,
                    TenantId = tenantId,
                    Name = "CashierRole",
                    Code = "CASH"
                };

                // Restricted User (has only RESERVATIONS:Read = 1, no PAYMENTS)
                var restrictedUser = new User
                {
                    Id = restrictedUserId,
                    Username = "restricted_user",
                    Email = "restricted@hotel.com",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Restricted Staff",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };

                var restrictedRole = new AccessRole
                {
                    Id = restrictedRoleId,
                    TenantId = tenantId,
                    Name = "RestrictedRole",
                    Code = "REST"
                };

                // Permissions
                var funcPayments = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "PAYMENTS",
                    Name = "Payments Management",
                    ModuleCode = "FINANCE",
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

                var funcProp = new PermissionFunction
                {
                    Id = Guid.NewGuid(),
                    Code = "PROPERTIES",
                    Name = "Properties Management",
                    ModuleCode = "PROPERTIES",
                    SupportedActionMask = 127,
                    IsActive = true
                };

                // Cashier permissions: PAYMENTS full (127), RESERVATIONS Read (1), PROPERTIES Read (1)
                var permCashier1 = new RolePermission { RoleId = cashierRoleId, FunctionId = funcPayments.Id, ActionMask = 127 };
                var permCashier2 = new RolePermission { RoleId = cashierRoleId, FunctionId = funcRes.Id, ActionMask = 1 };
                var permCashier3 = new RolePermission { RoleId = cashierRoleId, FunctionId = funcProp.Id, ActionMask = 1 };

                // Restricted permissions: only RESERVATIONS Read (1) and PROPERTIES Read (1)
                var permRestricted1 = new RolePermission { RoleId = restrictedRoleId, FunctionId = funcRes.Id, ActionMask = 1 };
                var permRestricted2 = new RolePermission { RoleId = restrictedRoleId, FunctionId = funcProp.Id, ActionMask = 1 };

                var staffCashier = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = cashierUserId,
                    RoleId = cashierRoleId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var staffRestricted = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = restrictedUserId,
                    RoleId = restrictedRoleId,
                    PropertyId = propId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                };

                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Deluxe Bay View",
                    Code = "DBV",
                    BasePrice = 1_000_000m,
                    MaxOccupancy = 2
                };

                var room = new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "301",
                    Floor = 3,
                    Status = RoomStatus.Clean,
                    IsActive = true
                };

                // Reservation total 1,000,000 VND
                var checkIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
                var checkOut = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4));
                var reservation = new Reservation
                {
                    Id = resId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomId = roomId,
                    GuestName = "Pham Quang D",
                    GuestEmail = "phamquangd@example.com",
                    GuestPhone = "0912345678",
                    CheckInDate = checkIn,
                    CheckOutDate = checkOut,
                    NumberOfGuests = 2,
                    TotalAmount = 1_000_000m,
                    Status = ReservationStatus.PendingPayment,
                    ConfirmationCode = "RES-PAY-001"
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(property, otherProperty);
                seedCtx.Users.AddRange(cashierUser, restrictedUser);
                seedCtx.AccessRoles.AddRange(cashierRole, restrictedRole);
                seedCtx.PermissionFunctions.AddRange(funcPayments, funcRes, funcProp);
                seedCtx.RolePermissions.AddRange(permCashier1, permCashier2, permCashier3, permRestricted1, permRestricted2);
                seedCtx.TenantStaffMembers.AddRange(staffCashier, staffRestricted);
                seedCtx.RoomTypes.Add(roomType);
                seedCtx.Rooms.Add(room);
                seedCtx.Reservations.Add(reservation);

                await seedCtx.SaveChangesAsync();
            }

            // 2. Start WebApplicationFactory
            await using var factory = new PaymentTestWebApplicationFactory(baseConnStr, testSchema);
            var client = factory.CreateClient();

            // ── STEP 1: Login Cashier and obtain property-scoped token ──────────────────
            var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "cashier@hotel.com",
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

            // ── STEP 2: Query Initial Folio (Total: 1,000,000, Paid: 0, Balance: 1,000,000) ──
            var folioResp1 = await client.GetAsync($"/api/reservations/{resId}/folio?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, folioResp1.StatusCode);
            var folio1 = await folioResp1.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1_000_000m, folio1.GetProperty("totalAmount").GetDecimal());
            Assert.Equal(0m, folio1.GetProperty("paidAmount").GetDecimal());
            Assert.Equal(1_000_000m, folio1.GetProperty("remainingBalance").GetDecimal());
            Assert.False(folio1.GetProperty("isFullyPaid").GetBoolean());
            Assert.Equal(0, folio1.GetProperty("payments").GetArrayLength());

            // ── STEP 3: Record Partial Payment (Cash = 2, 400,000 VND) with Idempotency Key ─────
            var payment1Request = new
            {
                reservationId = resId,
                amount = 400_000m,
                method = (int)PaymentMethod.Cash, // 2 = Cash
                transactionRef = "CASH-REC-HTTP-01",
                idempotencyKey = "IDEMP-KEY-HTTP-001"
            };

            var payResp1 = await client.PostAsJsonAsync("/api/payments", payment1Request);
            Assert.Equal(HttpStatusCode.Created, payResp1.StatusCode);
            var payJson1 = await payResp1.Content.ReadFromJsonAsync<JsonElement>();
            var payment1Id = payJson1.GetProperty("id").GetGuid();
            Assert.Equal(400_000m, payJson1.GetProperty("amount").GetDecimal());
            Assert.Equal("Cash", payJson1.GetProperty("methodName").GetString());
            Assert.Equal("Completed", payJson1.GetProperty("statusName").GetString());

            // Verify Folio after partial payment: Paid = 400,000, Remaining = 600,000
            var folioResp2 = await client.GetAsync($"/api/reservations/{resId}/folio?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, folioResp2.StatusCode);
            var folio2 = await folioResp2.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(400_000m, folio2.GetProperty("paidAmount").GetDecimal());
            Assert.Equal(600_000m, folio2.GetProperty("remainingBalance").GetDecimal());
            Assert.False(folio2.GetProperty("isFullyPaid").GetBoolean());
            Assert.Equal(1, folio2.GetProperty("payments").GetArrayLength());

            // ── STEP 4: Idempotency Replay (Re-send identical payload with same key) ───
            var replayResp = await client.PostAsJsonAsync("/api/payments", payment1Request);
            Assert.Equal(HttpStatusCode.Created, replayResp.StatusCode);
            var replayJson = await replayResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(payment1Id, replayJson.GetProperty("id").GetGuid());
            Assert.Equal(400_000m, replayJson.GetProperty("amount").GetDecimal());

            // Verify Folio remains unchanged after idempotent replay
            var folioResp3 = await client.GetAsync($"/api/reservations/{resId}/folio?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, folioResp3.StatusCode);
            var folio3 = await folioResp3.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(400_000m, folio3.GetProperty("paidAmount").GetDecimal());
            Assert.Equal(1, folio3.GetProperty("payments").GetArrayLength());

            // ── STEP 5: Overpayment rejection (Remaining 600,000, try paying 700,000) ──
            var overpayResp = await client.PostAsJsonAsync("/api/payments", new
            {
                reservationId = resId,
                amount = 700_000m,
                method = (int)PaymentMethod.Cash,
                transactionRef = "CASH-OVERPAY",
                idempotencyKey = "IDEMP-OVERPAY"
            });
            Assert.Equal(HttpStatusCode.BadRequest, overpayResp.StatusCode);

            // ── STEP 6: Settle remaining balance via BankTransfer (600,000) ─────────────
            var settleResp = await client.PostAsJsonAsync("/api/payments", new
            {
                reservationId = resId,
                amount = 600_000m,
                method = (int)PaymentMethod.BankTransfer, // 3 = BankTransfer
                transactionRef = "BANK-SETTLE-01",
                idempotencyKey = "IDEMP-SETTLE"
            });
            Assert.Equal(HttpStatusCode.Created, settleResp.StatusCode);

            // Verify Folio is fully settled: Paid = 1,000,000, Remaining = 0, isFullyPaid = true
            var folioRespFinal = await client.GetAsync($"/api/reservations/{resId}/folio?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, folioRespFinal.StatusCode);
            var folioFinal = await folioRespFinal.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1_000_000m, folioFinal.GetProperty("paidAmount").GetDecimal());
            Assert.Equal(0m, folioFinal.GetProperty("remainingBalance").GetDecimal());
            Assert.True(folioFinal.GetProperty("isFullyPaid").GetBoolean());
            Assert.Equal(2, folioFinal.GetProperty("payments").GetArrayLength());

            // ── STEP 7: Rejection on already paid folio (409 Conflict) ─────────────────
            var postSettledResp = await client.PostAsJsonAsync("/api/payments", new
            {
                reservationId = resId,
                amount = 50_000m,
                method = (int)PaymentMethod.Cash,
                transactionRef = "CASH-LATE",
                idempotencyKey = "IDEMP-LATE"
            });
            Assert.Equal(HttpStatusCode.Conflict, postSettledResp.StatusCode);

            // ── STEP 8: Query Payment History (GET /api/payments) ──────────────────────
            var historyResp = await client.GetAsync($"/api/payments?propertyId={propId}&reservationId={resId}");
            Assert.Equal(HttpStatusCode.OK, historyResp.StatusCode);
            var historyJson = await historyResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(2, historyJson.GetProperty("totalCount").GetInt32());
            Assert.Equal(2, historyJson.GetProperty("items").GetArrayLength());

            // ── STEP 9: Query Cashier Daily Summary (GET /api/payments/summary) ────────
            var vnTz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            var todayVn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz)).ToString("yyyy-MM-dd");

            var summaryResp = await client.GetAsync($"/api/payments/summary?propertyId={propId}&date={todayVn}");
            Assert.Equal(HttpStatusCode.OK, summaryResp.StatusCode);
            var summaryJson = await summaryResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1_000_000m, summaryJson.GetProperty("totalCollected").GetDecimal());
            Assert.Equal(400_000m, summaryJson.GetProperty("cashCollected").GetDecimal());
            Assert.Equal(600_000m, summaryJson.GetProperty("bankTransferCollected").GetDecimal());
            Assert.Equal(0m, summaryJson.GetProperty("creditCardCollected").GetDecimal());
            Assert.Equal(2, summaryJson.GetProperty("completedCount").GetInt32());

            // ── STEP 10: Security Gates & Permission Checks ───────────────────────────
            // 10a. Login as Restricted User (has no PAYMENTS permission)
            var restrictedClient = factory.CreateClient();
            var reLoginResp = await restrictedClient.PostAsJsonAsync("/api/auth/login", new
            {
                email = "restricted@hotel.com",
                password = "P@ssword123!"
            });
            Assert.Equal(HttpStatusCode.OK, reLoginResp.StatusCode);
            var reLoginJson = await reLoginResp.Content.ReadFromJsonAsync<JsonElement>();
            var reLoginToken = reLoginJson.GetProperty("accessToken").GetString()!;

            restrictedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reLoginToken);

            var reSwitchResp = await restrictedClient.PostAsJsonAsync("/api/auth/switch-context", new { propertyId = propId });
            Assert.Equal(HttpStatusCode.OK, reSwitchResp.StatusCode);
            var reSwitchJson = await reSwitchResp.Content.ReadFromJsonAsync<JsonElement>();
            var reScopedToken = reSwitchJson.GetProperty("data").GetProperty("accessToken").GetString()!;

            restrictedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reScopedToken);
            restrictedClient.DefaultRequestHeaders.Add("X-Property-Id", propId.ToString());

            // POST /api/payments without PAYMENTS:Create -> 403 Forbidden
            var forbiddenCreateResp = await restrictedClient.PostAsJsonAsync("/api/payments", payment1Request);
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenCreateResp.StatusCode);

            // GET /api/payments without PAYMENTS:Read -> 403 Forbidden
            var forbiddenListResp = await restrictedClient.GetAsync($"/api/payments?propertyId={propId}");
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenListResp.StatusCode);

            // GET /api/payments/summary without PAYMENTS:Read -> 403 Forbidden
            var forbiddenSummaryResp = await restrictedClient.GetAsync($"/api/payments/summary?propertyId={propId}");
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenSummaryResp.StatusCode);

            // But Restricted User has RESERVATIONS:Read -> GET folio succeeds!
            var allowedFolioResp = await restrictedClient.GetAsync($"/api/reservations/{resId}/folio?propertyId={propId}");
            Assert.Equal(HttpStatusCode.OK, allowedFolioResp.StatusCode);

            // 10b. Cross-branch context mismatch guard
            var mismatchedPropId = Guid.NewGuid();
            var mismatchResp = await client.GetAsync($"/api/reservations/{resId}/folio?propertyId={mismatchedPropId}");
            Assert.Equal(HttpStatusCode.BadRequest, mismatchResp.StatusCode);
        }
        finally
        {
            try
            {
                await using var dropCmd = conn.CreateCommand();
                dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
                await dropCmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // Best effort test cleanup
            }
        }
    }
}
