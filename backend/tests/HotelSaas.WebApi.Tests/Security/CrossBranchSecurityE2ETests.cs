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
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests.Security;

/// <summary>
/// Full HTTP pipeline end-to-end security tests verifying multi-tenant and multi-branch
/// isolation across authentication, header validation, rooms, check-in, payments, folio,
/// and reporting endpoints against isolated PostgreSQL schemas.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class CrossBranchSecurityE2ETests
{
    private const string TestJwtSecretKey = "SuperSecretIntegrationTestingKeyForHotelSaas2026!Min32Chars";
    private const string DefaultPassword = "P@ssw0rd123!";
    private const string DefaultTestConnectionString =
        "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

    private const string ReceptionistAEmail = "receptionist.a@tenanta.test";
    private const string ReceptionistBEmail = "receptionist.b@tenanta.test";
    private const string ManagerAEmail = "manager.a@tenanta.test";
    private const string OwnerAEmail = "owner.a@tenanta.test";

    private static readonly Regex SafeSchemaNameRegex = new("^[a-zA-Z0-9_]+$", RegexOptions.Compiled);

    private static string GetConnectionString()
    {
        return Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
               ?? Environment.GetEnvironmentVariable("E2E_DB_CONNECTION")
               ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
               ?? DefaultTestConnectionString;
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr);
        var dbName = builder.Database ?? string.Empty;
        if (!new[] { "localhost", "127.0.0.1", "::1" }.Contains(builder.Host, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("SAFETY ABORT: security tests require the approved local PostgreSQL instance.");
        }

        if (!dbName.EndsWith("_test", StringComparison.OrdinalIgnoreCase) &&
            !dbName.Contains("test_", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(dbName, "hotel_saas_p1b01a_test", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"SAFETY ABORT: CrossBranchSecurityE2ETests must target a dedicated test database, not '{dbName}'.");
        }
    }

    private static void ValidateSchemaName(string schema)
    {
        if (string.IsNullOrWhiteSpace(schema) || !SafeSchemaNameRegex.IsMatch(schema))
        {
            throw new InvalidOperationException($"Invalid PostgreSQL test schema name '{schema}'.");
        }
    }

    internal static ApplicationDbContext CreateSeedDbContext(string baseConnStr, string schema, Guid? tenantId)
    {
        ValidateSchemaName(schema);
        var builder = new NpgsqlConnectionStringBuilder(baseConnStr)
        {
            SearchPath = schema,
            Pooling = false,
            PersistSecurityInfo = true
        };

        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(builder.ConnectionString);
        optionsBuilder.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));

        var tenantService = new CurrentTenantService { TenantId = tenantId };
        var propertyService = new CurrentPropertyService { IsTenantWide = true };
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propertyService);
        optionsBuilder.AddInterceptors(interceptor);

        return new ApplicationDbContext(optionsBuilder.Options, tenantService, propertyService);
    }

    /// <summary>
    /// Isolated WebApplicationFactory bound to a unique PostgreSQL schema for each test case.
    /// Does not mock tenant or property context services; runs the genuine HTTP security pipeline.
    /// </summary>
    private sealed class SecurityTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _baseConnectionString;
        private readonly string _testSchema;

        /// <summary>
        /// Initializes a factory configured for the specified isolated PostgreSQL schema.
        /// </summary>
        public SecurityTestWebApplicationFactory(string baseConnectionString, string testSchema)
        {
            ValidateSchemaName(testSchema);
            _baseConnectionString = baseConnectionString;
            _testSchema = testSchema;
        }

        /// <inheritdoc />
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var testConnBuilder = new NpgsqlConnectionStringBuilder(_baseConnectionString)
            {
                SearchPath = _testSchema,
                Pooling = false,
                PersistSecurityInfo = true
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

    internal sealed record SecurityTestContext(
        WebApplicationFactory<Program> Factory,
        string BaseConnectionString,
        string TestSchema,
        Guid TenantAId,
        Guid TenantBId,
        Guid BranchAId,
        Guid BranchBId,
        Guid BranchCId,
        Guid RoomAId,
        Guid RoomBId,
        Guid RoomCId,
        Guid ResAId,
        Guid ResBId,
        Guid ResCId,
        DateOnly Today);

    internal static async Task RunInIsolatedEnvironmentAsync(
        Func<SecurityTestContext, Task> action,
        bool seedPayments = true)
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"sec_e2e_{Guid.NewGuid():N}";
        ValidateSchemaName(testSchema);

        await using (var setupConn = new NpgsqlConnection(
            new NpgsqlConnectionStringBuilder(baseConnStr) { Pooling = false, PersistSecurityInfo = true }.ConnectionString))
        {
            await setupConn.OpenAsync();
            await using var createCmd = setupConn.CreateCommand();
            createCmd.CommandText = $"""CREATE SCHEMA IF NOT EXISTS "{testSchema}";""";
            await createCmd.ExecuteNonQueryAsync();
        }

        var tenantAId = Guid.NewGuid();
        var tenantBId = Guid.NewGuid();
        var branchAId = Guid.NewGuid();
        var branchBId = Guid.NewGuid();
        var branchCId = Guid.NewGuid();
        var roomAId = Guid.NewGuid();
        var roomBId = Guid.NewGuid();
        var roomCId = Guid.NewGuid();
        var resAId = Guid.NewGuid();
        var resBId = Guid.NewGuid();
        var resCId = Guid.NewGuid();

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var nowUtc = DateTime.UtcNow;

        try
        {
            await SeedIsolatedDataAsync(
                baseConnStr,
                testSchema,
                tenantAId,
                tenantBId,
                branchAId,
                branchBId,
                branchCId,
                roomAId,
                roomBId,
                roomCId,
                resAId,
                resBId,
                resCId,
                today,
                nowUtc,
                seedPayments);

            await using var factory = new SecurityTestWebApplicationFactory(baseConnStr, testSchema);
            var ctx = new SecurityTestContext(
                factory,
                baseConnStr,
                testSchema,
                tenantAId,
                tenantBId,
                branchAId,
                branchBId,
                branchCId,
                roomAId,
                roomBId,
                roomCId,
                resAId,
                resBId,
                resCId,
                today);

            await action(ctx);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var cleanupConn = new NpgsqlConnection(
                new NpgsqlConnectionStringBuilder(baseConnStr) { Pooling = false, PersistSecurityInfo = true }.ConnectionString);
            await cleanupConn.OpenAsync();
            await using var dropCmd = cleanupConn.CreateCommand();
            dropCmd.CommandText = $"""SET search_path TO public; DROP SCHEMA IF EXISTS "{testSchema}" CASCADE;""";
            await dropCmd.ExecuteNonQueryAsync();
            NpgsqlConnection.ClearAllPools();
        }
    }

    private static async Task SeedIsolatedDataAsync(
        string baseConnStr,
        string testSchema,
        Guid tenantAId,
        Guid tenantBId,
        Guid branchAId,
        Guid branchBId,
        Guid branchCId,
        Guid roomAId,
        Guid roomBId,
        Guid roomCId,
        Guid resAId,
        Guid resBId,
        Guid resCId,
        DateOnly today,
        DateTime nowUtc,
        bool seedPayments)
    {
        await using (var seedCtxA = CreateSeedDbContext(baseConnStr, testSchema, tenantAId))
        {
            await seedCtxA.Database.MigrateAsync();
            await SeedData.SeedDefaultRolesAndPermissions(seedCtxA);

            var receptionistRole = await seedCtxA.AccessRoles.FirstAsync(r => r.Code == "RECEPTIONIST");
            var managerRole = await seedCtxA.AccessRoles.FirstAsync(r => r.Code == "MANAGER");
            var ownerRole = await seedCtxA.AccessRoles.FirstAsync(r => r.Code == "OWNER");

            var tenantA = new Tenant
            {
                Id = tenantAId,
                Name = "Alpha Hospitality Group",
                Code = "TENANT-A",
                Slug = "alpha-hospitality",
                Address = "100 Nguyen Hue",
                City = "Ho Chi Minh City",
                Status = TenantStatus.Active
            };

            var branchA = new Property
            {
                Id = branchAId,
                TenantId = tenantAId,
                Name = "Branch A Saigon",
                Code = "BR-A",
                Slug = "branch-a-saigon",
                Address = "12 Le Loi",
                City = "Ho Chi Minh City",
                Status = PropertyStatus.Active,
                CheckInTime = new TimeOnly(14, 0),
                CheckOutTime = new TimeOnly(12, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12
            };

            var branchB = new Property
            {
                Id = branchBId,
                TenantId = tenantAId,
                Name = "Branch B Hanoi",
                Code = "BR-B",
                Slug = "branch-b-hanoi",
                Address = "34 Trang Tien",
                City = "Hanoi",
                Status = PropertyStatus.Active,
                CheckInTime = new TimeOnly(14, 0),
                CheckOutTime = new TimeOnly(12, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12
            };

            var roomTypeA = new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenantAId,
                PropertyId = branchAId,
                Name = "Standard A",
                Code = "STD-A",
                BasePrice = 750_000m,
                MaxOccupancy = 2
            };

            var roomTypeB = new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenantAId,
                PropertyId = branchBId,
                Name = "Deluxe B",
                Code = "DLX-B",
                BasePrice = 1_250_000m,
                MaxOccupancy = 2
            };

            var roomA = new Room
            {
                Id = roomAId,
                TenantId = tenantAId,
                PropertyId = branchAId,
                RoomTypeId = roomTypeA.Id,
                RoomNumber = "101-A",
                Floor = 1,
                Status = RoomStatus.Clean,
                IsActive = true
            };

            var roomB = new Room
            {
                Id = roomBId,
                TenantId = tenantAId,
                PropertyId = branchBId,
                RoomTypeId = roomTypeB.Id,
                RoomNumber = "201-B",
                Floor = 2,
                Status = RoomStatus.Clean,
                IsActive = true
            };

            var resA = new Reservation
            {
                Id = resAId,
                TenantId = tenantAId,
                PropertyId = branchAId,
                RoomId = roomAId,
                GuestName = "Guest Alpha One",
                GuestEmail = "guest.a@example.test",
                GuestPhone = "0901000001",
                CheckInDate = today,
                CheckOutDate = today.AddDays(2),
                NumberOfGuests = 2,
                TotalAmount = 1_500_000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = "RES-A-001"
            };

            var resB = new Reservation
            {
                Id = resBId,
                TenantId = tenantAId,
                PropertyId = branchBId,
                RoomId = roomBId,
                GuestName = "Guest Alpha Two",
                GuestEmail = "guest.b@example.test",
                GuestPhone = "0901000002",
                CheckInDate = today,
                CheckOutDate = today.AddDays(2),
                NumberOfGuests = 2,
                TotalAmount = 2_500_000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = "RES-B-001"
            };

            var passwordHash = new PasswordHasherService().Hash(DefaultPassword);

            var receptionistA = CreateStaffUser(Guid.NewGuid(), tenantAId, "recep.a", ReceptionistAEmail, "Receptionist Branch A", passwordHash, nowUtc);
            var receptionistB = CreateStaffUser(Guid.NewGuid(), tenantAId, "recep.b", ReceptionistBEmail, "Receptionist Branch B", passwordHash, nowUtc);
            var managerA = CreateStaffUser(Guid.NewGuid(), tenantAId, "manager.a", ManagerAEmail, "Manager Branch A", passwordHash, nowUtc);
            var ownerA = CreateStaffUser(Guid.NewGuid(), tenantAId, "owner.a", OwnerAEmail, "Owner Tenant A", passwordHash, nowUtc);

            var staffEntries = new[]
            {
                new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantAId,
                    PropertyId = branchAId,
                    UserId = receptionistA.Id,
                    RoleId = receptionistRole.Id,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                },
                new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantAId,
                    PropertyId = branchBId,
                    UserId = receptionistB.Id,
                    RoleId = receptionistRole.Id,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true
                },
                new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantAId,
                    PropertyId = branchAId,
                    UserId = managerA.Id,
                    RoleId = managerRole.Id,
                    StaffRole = StaffRole.Manager,
                    IsActive = true
                },
                new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantAId,
                    PropertyId = null,
                    UserId = ownerA.Id,
                    RoleId = ownerRole.Id,
                    StaffRole = StaffRole.Owner,
                    IsActive = true
                }
            };

            seedCtxA.Tenants.Add(tenantA);
            seedCtxA.Properties.AddRange(branchA, branchB);
            seedCtxA.RoomTypes.AddRange(roomTypeA, roomTypeB);
            seedCtxA.Rooms.AddRange(roomA, roomB);
            seedCtxA.Reservations.AddRange(resA, resB);
            seedCtxA.Users.AddRange(receptionistA, receptionistB, managerA, ownerA);
            seedCtxA.TenantStaffMembers.AddRange(staffEntries);

            if (seedPayments)
            {
                seedCtxA.Payments.AddRange(
                    new Payment
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantAId,
                        PropertyId = branchAId,
                        ReservationId = resAId,
                        Amount = 500_000m,
                        Method = PaymentMethod.Cash,
                        Status = PaymentStatus.Completed,
                        TransactionRef = "CASH-E2E-A",
                        PaidAtUtc = nowUtc
                    },
                    new Payment
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantAId,
                        PropertyId = branchBId,
                        ReservationId = resBId,
                        Amount = 800_000m,
                        Method = PaymentMethod.BankTransfer,
                        Status = PaymentStatus.Completed,
                        TransactionRef = "BANK-E2E-B",
                        PaidAtUtc = nowUtc
                    });
            }

            await seedCtxA.SaveChangesAsync();
        }

        await using var seedCtxB = CreateSeedDbContext(baseConnStr, testSchema, tenantBId);

        var tenantB = new Tenant
        {
            Id = tenantBId,
            Name = "Beta Luxury Resorts",
            Code = "TENANT-B",
            Slug = "beta-luxury-resorts",
            Address = "200 Vo Nguyen Giap",
            City = "Da Nang",
            Status = TenantStatus.Active
        };

        var branchC = new Property
        {
            Id = branchCId,
            TenantId = tenantBId,
            Name = "Branch C Da Nang",
            Code = "BR-C",
            Slug = "branch-c-danang",
            Address = "88 My Khe",
            City = "Da Nang",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };

        var roomTypeC = new RoomType
        {
            Id = Guid.NewGuid(),
            TenantId = tenantBId,
            PropertyId = branchCId,
            Name = "Suite C",
            Code = "STE-C",
            BasePrice = 1_600_000m,
            MaxOccupancy = 2
        };

        var roomC = new Room
        {
            Id = roomCId,
            TenantId = tenantBId,
            PropertyId = branchCId,
            RoomTypeId = roomTypeC.Id,
            RoomNumber = "301-C",
            Floor = 3,
            Status = RoomStatus.Clean,
            IsActive = true
        };

        var resC = new Reservation
        {
            Id = resCId,
            TenantId = tenantBId,
            PropertyId = branchCId,
            RoomId = roomCId,
            GuestName = "Guest Beta Three",
            GuestEmail = "guest.c@example.test",
            GuestPhone = "0901000003",
            CheckInDate = today,
            CheckOutDate = today.AddDays(2),
            NumberOfGuests = 2,
            TotalAmount = 3_200_000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "RES-C-001"
        };

        seedCtxB.Tenants.Add(tenantB);
        seedCtxB.Properties.Add(branchC);
        seedCtxB.RoomTypes.Add(roomTypeC);
        seedCtxB.Rooms.Add(roomC);
        seedCtxB.Reservations.Add(resC);
        await seedCtxB.SaveChangesAsync();
    }

    private static User CreateStaffUser(
        Guid userId,
        Guid tenantId,
        string username,
        string email,
        string fullName,
        string passwordHash,
        DateTime nowUtc)
    {
        return new User
        {
            Id = userId,
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            FullName = fullName,
            GlobalRole = GlobalUserRole.TenantStaff,
            IsActive = true,
            TenantId = tenantId,
            EmailVerifiedAtUtc = nowUtc,
            PhoneVerifiedAtUtc = nowUtc
        };
    }

    private static async Task<string> LoginAsync(HttpClient client, string email)
    {
        var resp = await client.PostAsJsonAsync("/api/auth/login", new { email, password = DefaultPassword });
        var rawBody = await resp.Content.ReadAsStringAsync();
        Assert.True(resp.StatusCode == HttpStatusCode.OK, $"Expected 200 OK from login for '{email}', got {(int)resp.StatusCode}: {rawBody}");

        using var doc = JsonDocument.Parse(rawBody);
        var token = doc.RootElement.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        return token!;
    }

    private static async Task<HttpResponseMessage> SendAuthorizedAsync(
        WebApplicationFactory<Program> factory,
        HttpMethod method,
        string url,
        string bearerToken,
        Guid? propertyIdHeader = null,
        Guid? tenantIdHeader = null,
        object? jsonBody = null)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);

        if (propertyIdHeader.HasValue)
        {
            request.Headers.TryAddWithoutValidation("X-Property-Id", propertyIdHeader.Value.ToString());
        }

        if (tenantIdHeader.HasValue)
        {
            request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantIdHeader.Value.ToString());
        }

        if (jsonBody != null)
        {
            request.Content = JsonContent.Create(jsonBody);
        }

        return await client.SendAsync(request);
    }

    private static async Task AssertErrorResponseAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string? expectedErrorCode = null)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.StatusCode == expectedStatus,
            $"Expected HTTP {(int)expectedStatus} ({expectedStatus}), got {(int)response.StatusCode}: {body}");

        if (!string.IsNullOrWhiteSpace(expectedErrorCode))
        {
            using var doc = JsonDocument.Parse(body);
            Assert.True(
                doc.RootElement.TryGetProperty("errorCode", out var codeProp),
                $"Expected JSON 'errorCode' property in error response, got: {body}");
            Assert.Equal(expectedErrorCode, codeProp.GetString());
        }
    }

    /// <summary>
    /// TC01: Verifies branch staff cannot access another branch via X-Property-Id tampering
    /// and that valid branch-scoped queries strictly return only their own branch's rooms.
    /// </summary>
    [Fact]
    public async Task CrossBranch_GetRooms_HeaderTamper_Returns403_And_ScopedQueryOnlyReturnsOwnBranch()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var recepAToken = await LoginAsync(authClient, ReceptionistAEmail);
            var recepBToken = await LoginAsync(authClient, ReceptionistBEmail);

            // Tampering X-Property-Id to Branch B must be rejected with 403 ERR_PROPERTY_FORBIDDEN.
            using var tamperResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                recepAToken,
                propertyIdHeader: ctx.BranchBId);
            await AssertErrorResponseAsync(tamperResp, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // Bidirectional check: Branch B receptionist cannot tamper X-Property-Id to Branch A.
            using var reverseTamperResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                recepBToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(reverseTamperResp, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // Valid Branch A query must return only room 101-A, never 201-B or 301-C.
            using var scopedResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            Assert.Equal(HttpStatusCode.OK, scopedResp.StatusCode);

            var roomsJson = await scopedResp.Content.ReadAsStringAsync();
            Assert.DoesNotContain("201-B", roomsJson, StringComparison.Ordinal);
            Assert.DoesNotContain("301-C", roomsJson, StringComparison.Ordinal);

            using var doc = JsonDocument.Parse(roomsJson);
            var items = doc.RootElement.GetProperty("items");
            Assert.Equal(1, items.GetArrayLength());
            Assert.Equal("101-A", items[0].GetProperty("roomNumber").GetString());
            Assert.Equal(ctx.BranchAId, Guid.Parse(items[0].GetProperty("propertyId").GetString()!));
        });
    }

    /// <summary>
    /// TC02: Verifies branch staff cannot check in another branch's reservation across
    /// tampered headers, mismatched query parameters, or own-branch context, and DB state stays unchanged.
    /// </summary>
    [Fact]
    public async Task CrossBranch_CheckInOtherBranchReservation_Returns403Or404_NeverMutates()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var recepAToken = await LoginAsync(authClient, ReceptionistAEmail);

            // Attempt 1: Spoof X-Property-Id = Branch B -> 403 ERR_PROPERTY_FORBIDDEN.
            using var resp403 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                $"/api/reservations/{ctx.ResBId}/check-in?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchBId);
            await AssertErrorResponseAsync(resp403, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // Attempt 2: Valid X-Property-Id = Branch A + tampered query propertyId = Branch B -> 400 ERR_CONTEXT_MISMATCH.
            using var resp400 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                $"/api/reservations/{ctx.ResBId}/check-in?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(resp400, HttpStatusCode.BadRequest, "ERR_CONTEXT_MISMATCH");

            // Attempt 3: Valid X-Property-Id = Branch A + query propertyId = Branch A against ResB -> 404 Not Found.
            using var resp404 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                $"/api/reservations/{ctx.ResBId}/check-in?propertyId={ctx.BranchAId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(resp404, HttpStatusCode.NotFound);

            // Verify persisted database state was never mutated.
            await using var verifyCtx = CreateSeedDbContext(ctx.BaseConnectionString, ctx.TestSchema, ctx.TenantAId);
            var resB = await verifyCtx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == ctx.ResBId);
            var roomB = await verifyCtx.Rooms.IgnoreQueryFilters().FirstAsync(r => r.Id == ctx.RoomBId);
            Assert.Equal(ReservationStatus.Confirmed, resB.Status);
            Assert.Equal(RoomStatus.Clean, roomB.Status);
        });
    }

    /// <summary>
    /// TC03: Verifies branch staff cannot read payments or financial folios belonging to another branch.
    /// </summary>
    [Fact]
    public async Task CrossBranch_PaymentsAndFolio_BlocksOtherBranchAccess()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var recepAToken = await LoginAsync(authClient, ReceptionistAEmail);

            // Tampered X-Property-Id = Branch B on payments list -> 403 ERR_PROPERTY_FORBIDDEN.
            using var paymentsResp403 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/payments?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchBId);
            await AssertErrorResponseAsync(paymentsResp403, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // Tampered X-Property-Id = Branch B on ResB folio -> 403 ERR_PROPERTY_FORBIDDEN.
            using var folioResp403 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResBId}/folio?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchBId);
            await AssertErrorResponseAsync(folioResp403, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // Valid header X-Property-Id = Branch A + tampered query propertyId = Branch B on folio -> 400 ERR_CONTEXT_MISMATCH.
            using var folioResp400 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResBId}/folio?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(folioResp400, HttpStatusCode.BadRequest, "ERR_CONTEXT_MISMATCH");

            // Valid header X-Property-Id = Branch A + query propertyId = Branch A targeting ResB -> 404 Not Found.
            using var folioResp404 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResBId}/folio?propertyId={ctx.BranchAId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(folioResp404, HttpStatusCode.NotFound);

            // Sanity check: own branch payments & folio succeed and exclude Branch B transaction refs.
            using var ownPaymentsResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/payments?propertyId={ctx.BranchAId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            Assert.Equal(HttpStatusCode.OK, ownPaymentsResp.StatusCode);
            var ownPaymentsBody = await ownPaymentsResp.Content.ReadAsStringAsync();
            Assert.Contains("CASH-E2E-A", ownPaymentsBody, StringComparison.Ordinal);
            Assert.DoesNotContain("BANK-E2E-B", ownPaymentsBody, StringComparison.Ordinal);

            using var ownFolioResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResAId}/folio?propertyId={ctx.BranchAId}",
                recepAToken,
                propertyIdHeader: ctx.BranchAId);
            Assert.Equal(HttpStatusCode.OK, ownFolioResp.StatusCode);
        });
    }

    /// <summary>
    /// TC04: Verifies branch-scoped users (Receptionist and Manager) cannot view or export another
    /// branch's reports or access multi-branch group analytics, while Tenant-Wide Owner succeeds.
    /// </summary>
    [Fact]
    public async Task CrossBranch_Reports_BlocksBranchStaffFromOtherBranchAndGroupAnalytics()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var recepAToken = await LoginAsync(authClient, ReceptionistAEmail);
            var managerAToken = await LoginAsync(authClient, ManagerAEmail);
            var ownerAToken = await LoginAsync(authClient, OwnerAEmail);

            // ReceptionistA tampering X-Property-Id to Branch B -> 403 ERR_PROPERTY_FORBIDDEN.
            using var recepRevenue403 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reports/revenue-summary?propertyId={ctx.BranchBId}",
                recepAToken,
                propertyIdHeader: ctx.BranchBId);
            await AssertErrorResponseAsync(recepRevenue403, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // ManagerA using valid own header X-Property-Id = Branch A must still be blocked on Branch B reports & exports.
            var branchReportEndpoints = new[]
            {
                $"/api/reports/revenue-summary?propertyId={ctx.BranchBId}",
                $"/api/reports/pms-kpi?propertyId={ctx.BranchBId}",
                $"/api/reports/export-csv?propertyId={ctx.BranchBId}",
                $"/api/reports/export-excel?propertyId={ctx.BranchBId}",
                $"/api/reports/export-pdf?propertyId={ctx.BranchBId}"
            };

            foreach (var endpoint in branchReportEndpoints)
            {
                using var resp = await SendAuthorizedAsync(
                    ctx.Factory,
                    HttpMethod.Get,
                    endpoint,
                    managerAToken,
                    propertyIdHeader: ctx.BranchAId);
                await AssertErrorResponseAsync(resp, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");
            }

            // ManagerA is branch-scoped (IsTenantWide = false) so group-analytics must return 403 ERR_PROPERTY_FORBIDDEN.
            using var managerGroup403WithHeader = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/reports/group-analytics",
                managerAToken,
                propertyIdHeader: ctx.BranchAId);
            await AssertErrorResponseAsync(managerGroup403WithHeader, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            using var managerGroup403WithoutHeader = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/reports/group-analytics",
                managerAToken);
            await AssertErrorResponseAsync(managerGroup403WithoutHeader, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // OwnerA is Tenant-Wide and must receive 200 with Tenant A's 2 branches only.
            var groupUrl =
                $"/api/reports/group-analytics?fromDate={ctx.Today:yyyy-MM-dd}&toDate={ctx.Today.AddDays(2):yyyy-MM-dd}";
            using var ownerGroup200 = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                groupUrl,
                ownerAToken);
            Assert.Equal(HttpStatusCode.OK, ownerGroup200.StatusCode);

            var groupJson = await ownerGroup200.Content.ReadAsStringAsync();
            Assert.DoesNotContain(ctx.BranchCId.ToString(), groupJson, StringComparison.OrdinalIgnoreCase);

            using var groupDoc = JsonDocument.Parse(groupJson);
            var data = groupDoc.RootElement.GetProperty("data");
            Assert.Equal(2, data.GetProperty("totalProperties").GetInt32());
            Assert.Equal(2, data.GetProperty("totalRooms").GetInt32());
            Assert.Equal(4_000_000m, data.GetProperty("totalRevenue").GetDecimal());
        });
    }

    /// <summary>
    /// TC05: Verifies branch staff cannot escalate privileges via switch-context to HQ (null)
    /// or to another branch to which they have no active membership.
    /// </summary>
    [Fact]
    public async Task CrossBranch_SwitchContext_BlocksBranchStaffEscalatingToHqOrOtherBranch()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var recepAToken = await LoginAsync(authClient, ReceptionistAEmail);
            var managerAToken = await LoginAsync(authClient, ManagerAEmail);
            var ownerAToken = await LoginAsync(authClient, OwnerAEmail);

            // ReceptionistA cannot switch to Branch B or HQ (null).
            using var recepSwitchOther = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                recepAToken,
                jsonBody: new { propertyId = (Guid?)ctx.BranchBId });
            await AssertErrorResponseAsync(recepSwitchOther, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            using var recepSwitchHq = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                recepAToken,
                jsonBody: new { propertyId = (Guid?)null });
            await AssertErrorResponseAsync(recepSwitchHq, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // ManagerA cannot switch to Branch B or HQ (null) either.
            using var managerSwitchOther = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                managerAToken,
                jsonBody: new { propertyId = (Guid?)ctx.BranchBId });
            await AssertErrorResponseAsync(managerSwitchOther, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            using var managerSwitchHq = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                managerAToken,
                jsonBody: new { propertyId = (Guid?)null });
            await AssertErrorResponseAsync(managerSwitchHq, HttpStatusCode.Forbidden, "ERR_PROPERTY_FORBIDDEN");

            // OwnerA (Tenant-Wide) can legitimately drill into Branch B and return to HQ scope.
            using var ownerSwitchBranchB = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                ownerAToken,
                jsonBody: new { propertyId = (Guid?)ctx.BranchBId });
            Assert.Equal(HttpStatusCode.OK, ownerSwitchBranchB.StatusCode);

            using var ownerSwitchHq = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Post,
                "/api/auth/switch-context",
                ownerAToken,
                jsonBody: new { propertyId = (Guid?)null });
            Assert.Equal(HttpStatusCode.OK, ownerSwitchHq.StatusCode);
        });
    }

    /// <summary>
    /// TC06: Verifies strict cross-tenant isolation preventing even a Tenant-Wide Owner of Tenant A
    /// from tampering X-Tenant-Id, X-Property-Id, or accessing Tenant B resources.
    /// </summary>
    [Fact]
    public async Task CrossTenant_HeaderAndResourceIsolation_BlocksTenantAFromTenantB()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var ownerAToken = await LoginAsync(authClient, OwnerAEmail);

            // Cross-tenant header tampering -> 400 ERR_CONTEXT_MISMATCH.
            using var tenantTamperResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                ownerAToken,
                tenantIdHeader: ctx.TenantBId);
            await AssertErrorResponseAsync(tenantTamperResp, HttpStatusCode.BadRequest, "ERR_CONTEXT_MISMATCH");

            // Foreign tenant property header -> 404 ERR_PROPERTY_NOT_FOUND.
            using var foreignPropertyResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                ownerAToken,
                propertyIdHeader: ctx.BranchCId);
            await AssertErrorResponseAsync(foreignPropertyResp, HttpStatusCode.NotFound, "ERR_PROPERTY_NOT_FOUND");

            // Direct resource access to Tenant B reservation via own branch or foreign branch -> 404 Not Found.
            using var foreignResOwnBranchResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResCId}?propertyId={ctx.BranchAId}",
                ownerAToken);
            await AssertErrorResponseAsync(foreignResOwnBranchResp, HttpStatusCode.NotFound);

            using var foreignResForeignBranchResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reservations/{ctx.ResCId}?propertyId={ctx.BranchCId}",
                ownerAToken);
            await AssertErrorResponseAsync(foreignResForeignBranchResp, HttpStatusCode.NotFound);

            // Direct resource access to Tenant B room -> 404 Not Found.
            using var foreignRoomResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/rooms/{ctx.RoomCId}",
                ownerAToken);
            await AssertErrorResponseAsync(foreignRoomResp, HttpStatusCode.NotFound);

            // Owner A valid tenant-wide query returns only Tenant A's rooms (101-A, 201-B), never 301-C.
            using var validOwnerRooms = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                "/api/rooms",
                ownerAToken,
                tenantIdHeader: ctx.TenantAId);
            Assert.Equal(HttpStatusCode.OK, validOwnerRooms.StatusCode);

            var body = await validOwnerRooms.Content.ReadAsStringAsync();
            Assert.Contains("101-A", body, StringComparison.Ordinal);
            Assert.Contains("201-B", body, StringComparison.Ordinal);
            Assert.DoesNotContain("301-C", body, StringComparison.Ordinal);

            using var doc = JsonDocument.Parse(body);
            Assert.Equal(2, doc.RootElement.GetProperty("items").GetArrayLength());
        });
    }

    /// <summary>
    /// Verifies uncollected reservations without completed payments accurately report 0 across
    /// all payment methods instead of simulating fake 45%/35%/20% distributions.
    /// </summary>
    [Fact]
    public async Task Reports_UncollectedReservations_DoNotSimulateFakePaymentDistribution()
    {
        await RunInIsolatedEnvironmentAsync(async ctx =>
        {
            using var authClient = ctx.Factory.CreateClient();
            var managerAToken = await LoginAsync(authClient, ManagerAEmail);
            var ownerAToken = await LoginAsync(authClient, OwnerAEmail);

            using var revenueResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                $"/api/reports/revenue-summary?propertyId={ctx.BranchAId}&fromDate={ctx.Today:yyyy-MM-dd}&toDate={ctx.Today:yyyy-MM-dd}",
                managerAToken,
                propertyIdHeader: ctx.BranchAId);
            Assert.Equal(HttpStatusCode.OK, revenueResp.StatusCode);

            using var revenueDoc = JsonDocument.Parse(await revenueResp.Content.ReadAsStringAsync());
            Assert.Equal(1_500_000m, revenueDoc.RootElement.GetProperty("totalRevenue").GetDecimal());
            Assert.Equal(1, revenueDoc.RootElement.GetProperty("totalBookings").GetInt32());

            foreach (var breakdownItem in revenueDoc.RootElement.GetProperty("paymentBreakdown").EnumerateArray())
            {
                Assert.Equal(0m, breakdownItem.GetProperty("amount").GetDecimal());
                Assert.Equal(0, breakdownItem.GetProperty("count").GetInt32());
            }

            var groupUrl =
                $"/api/reports/group-analytics?fromDate={ctx.Today:yyyy-MM-dd}&toDate={ctx.Today.AddDays(2):yyyy-MM-dd}";
            using var groupResp = await SendAuthorizedAsync(
                ctx.Factory,
                HttpMethod.Get,
                groupUrl,
                ownerAToken);
            Assert.Equal(HttpStatusCode.OK, groupResp.StatusCode);

            using var groupDoc = JsonDocument.Parse(await groupResp.Content.ReadAsStringAsync());
            var data = groupDoc.RootElement.GetProperty("data");
            Assert.Equal(4_000_000m, data.GetProperty("totalRevenue").GetDecimal());
            Assert.Equal(2, data.GetProperty("totalBookings").GetInt32());

            foreach (var distItem in data.GetProperty("paymentDistribution").EnumerateArray())
            {
                Assert.Equal(0m, distItem.GetProperty("amount").GetDecimal());
                Assert.Equal(0, distItem.GetProperty("count").GetInt32());
                Assert.Equal(0d, distItem.GetProperty("percentage").GetDouble());
            }
        }, seedPayments: false);
    }
}
