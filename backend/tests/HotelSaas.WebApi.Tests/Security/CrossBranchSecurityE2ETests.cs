using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
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

namespace HotelSaas.WebApi.Tests.Security;

/// <summary>
/// Full HTTP E2E security tests proving strict cross-branch and cross-tenant isolation
/// across the real ASP.NET Core pipeline (JwtBearer Auth -> TenantPropertyContextMiddleware
/// -> IMembershipLookupService -> PermissionAuthorizationHandler -> EF Core Global Query Filters).
/// Never mocks ICurrentTenantService or ICurrentPropertyService in the HTTP test server.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class CrossBranchSecurityE2ETests
{
    private const string TestJwtSecretKey = "SuperSecretKeyForCrossBranchSecurityE2ETests_Min32Bytes!";

    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
        {
            var envBuilder = new NpgsqlConnectionStringBuilder(envConn)
            {
                Pooling = false,
                PersistSecurityInfo = true
            };
            return envBuilder.ConnectionString;
        }

        return "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Pooling=false;Persist Security Info=true;";
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

    private sealed class SeedTenantContext : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class SeedPropertyContext : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private static ApplicationDbContext CreateSeedDbContext(string connString, string testSchema, Guid? tenantId)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false,
            PersistSecurityInfo = true
        };

        var tenantSvc = new SeedTenantContext { TenantId = tenantId };
        var propSvc = new SeedPropertyContext { IsTenantWide = true };
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    private sealed class RealSecurityWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public RealSecurityWebApplicationFactory(string connectionString, string testSchema)
        {
            _connectionString = connectionString;
            _testSchema = testSchema;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var testConnBuilder = new NpgsqlConnectionStringBuilder(_connectionString)
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
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = testConnBuilder.ConnectionString,
                    ["JwtSettings:SecretKey"] = TestJwtSecretKey,
                    ["JwtSettings:Issuer"] = "HotelSaas",
                    ["JwtSettings:Audience"] = "HotelSaasClient",
                    ["JwtSettings:AccessTokenExpirationMinutes"] = "15",
                    ["JwtSettings:RefreshTokenExpirationDays"] = "7",
                    ["SkipStartupDatabaseInit"] = "true"
                });
            });
        }
    }

    private sealed record SeededWorld(
        Guid Tenant1Id,
        Guid BranchAId,
        Guid BranchBId,
        Guid ReceptionistAUserId,
        Guid ReceptionistBUserId,
        Guid OwnerTenant1UserId,
        Guid RoomAId,
        Guid RoomBId,
        Guid ReservationAId,
        Guid ReservationBId,
        string PaymentBTransactionRef,
        Guid Tenant2Id,
        Guid BranchT2Id,
        Guid UserT2Id,
        Guid ReservationT2Id,
        string PaymentT2TransactionRef);

    private static async Task<SeededWorld> SeedIsolationWorldAsync(string baseConnStr, string testSchema)
    {
        var tenant1Id = Guid.NewGuid();
        var branchAId = Guid.NewGuid();
        var branchBId = Guid.NewGuid();
        var recAUserId = Guid.NewGuid();
        var recBUserId = Guid.NewGuid();
        var ownerT1UserId = Guid.NewGuid();
        var roleT1Id = Guid.NewGuid();
        var ownerRoleT1Id = Guid.NewGuid();
        var roomTypeAId = Guid.NewGuid();
        var roomTypeBId = Guid.NewGuid();
        var roomAId = Guid.NewGuid();
        var roomBId = Guid.NewGuid();
        var resAId = Guid.NewGuid();
        var resBId = Guid.NewGuid();
        const string payBRef = "TXN-BRANCH-B-SECRET-001";

        var tenant2Id = Guid.NewGuid();
        var branchT2Id = Guid.NewGuid();
        var userT2Id = Guid.NewGuid();
        var roleT2Id = Guid.NewGuid();
        var roomTypeT2Id = Guid.NewGuid();
        var roomT2Id = Guid.NewGuid();
        var resT2Id = Guid.NewGuid();
        const string payT2Ref = "TXN-TENANT-2-SECRET-999";

        var hasher = new PasswordHasherService();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var fnRooms = new PermissionFunction { Id = Guid.NewGuid(), Code = "ROOMS", Name = "Rooms Management", ModuleCode = "ROOMS", SupportedActionMask = 127, IsActive = true };
        var fnReservations = new PermissionFunction { Id = Guid.NewGuid(), Code = "RESERVATIONS", Name = "Reservations Management", ModuleCode = "RESERVATIONS", SupportedActionMask = 127, IsActive = true };
        var fnCheckInOut = new PermissionFunction { Id = Guid.NewGuid(), Code = "CHECK_IN_OUT", Name = "Check-In / Check-Out", ModuleCode = "RESERVATIONS", SupportedActionMask = 127, IsActive = true };
        var fnPayments = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments Management", ModuleCode = "PAYMENTS", SupportedActionMask = 127, IsActive = true };
        var fnReports = new PermissionFunction { Id = Guid.NewGuid(), Code = "REPORTS", Name = "Reports Analytics", ModuleCode = "REPORTS", SupportedActionMask = 127, IsActive = true };

        // Migrate schema and seed Tenant 1
        await using (var ctx1 = CreateSeedDbContext(baseConnStr, testSchema, tenant1Id))
        {
            await ctx1.Database.MigrateAsync();

            var tenant1 = new Tenant
            {
                Id = tenant1Id,
                Name = "LuxeStay Hospitality Group",
                Code = "LUXE1",
                Slug = "luxestay-t1",
                Address = "101 Nguyen Hue",
                City = "Ho Chi Minh City",
                Status = TenantStatus.Active
            };

            var branchA = new Property
            {
                Id = branchAId,
                TenantId = tenant1Id,
                Name = "LuxeStay Saigon Branch A",
                Code = "SGN-A",
                Slug = "luxestay-saigon-a",
                Address = "101 Nguyen Hue, Q1",
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
                TenantId = tenant1Id,
                Name = "LuxeStay Da Lat Branch B",
                Code = "DLI-B",
                Slug = "luxestay-dalat-b",
                Address = "20 Tran Phu",
                City = "Da Lat",
                Status = PropertyStatus.Active,
                CheckInTime = new TimeOnly(14, 0),
                CheckOutTime = new TimeOnly(12, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12
            };

            var roleRec = new AccessRole { Id = roleT1Id, TenantId = tenant1Id, Name = "Front Desk Receptionist", Code = "REC" };
            var roleOwner = new AccessRole { Id = ownerRoleT1Id, TenantId = tenant1Id, Name = "Tenant Owner", Code = "OWN" };

            var recAUser = new User
            {
                Id = recAUserId,
                Username = "rec_branch_a",
                Email = "rec_a@luxestay.local",
                PasswordHash = hasher.Hash("P@ssword123!"),
                FullName = "Receptionist Branch A",
                IsActive = true,
                GlobalRole = GlobalUserRole.Customer
            };

            var recBUser = new User
            {
                Id = recBUserId,
                Username = "rec_branch_b",
                Email = "rec_b@luxestay.local",
                PasswordHash = hasher.Hash("P@ssword123!"),
                FullName = "Receptionist Branch B",
                IsActive = true,
                GlobalRole = GlobalUserRole.Customer
            };

            var ownerUser = new User
            {
                Id = ownerT1UserId,
                Username = "owner_tenant1",
                Email = "owner_t1@luxestay.local",
                PasswordHash = hasher.Hash("P@ssword123!"),
                FullName = "Owner Tenant 1",
                IsActive = true,
                GlobalRole = GlobalUserRole.Customer
            };

            var staffRecA = new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                UserId = recAUserId,
                RoleId = roleT1Id,
                PropertyId = branchAId,
                StaffRole = StaffRole.Receptionist,
                IsActive = true
            };

            var staffRecB = new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                UserId = recBUserId,
                RoleId = roleT1Id,
                PropertyId = branchBId,
                StaffRole = StaffRole.Receptionist,
                IsActive = true
            };

            var staffOwner = new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                UserId = ownerT1UserId,
                RoleId = ownerRoleT1Id,
                PropertyId = null, // TenantWide authority within Tenant 1 only
                StaffRole = StaffRole.Owner,
                IsActive = true
            };

            var roomTypeA = new RoomType { Id = roomTypeAId, TenantId = tenant1Id, PropertyId = branchAId, Name = "Deluxe Saigon", Code = "DLX-A", BasePrice = 1200000m, MaxOccupancy = 2 };
            var roomTypeB = new RoomType { Id = roomTypeBId, TenantId = tenant1Id, PropertyId = branchBId, Name = "Pine Suite Da Lat", Code = "STE-B", BasePrice = 1500000m, MaxOccupancy = 2 };

            var roomA = new Room { Id = roomAId, TenantId = tenant1Id, PropertyId = branchAId, RoomTypeId = roomTypeAId, RoomNumber = "A101", Floor = 1, Status = RoomStatus.Clean };
            var roomB = new Room { Id = roomBId, TenantId = tenant1Id, PropertyId = branchBId, RoomTypeId = roomTypeBId, RoomNumber = "B201", Floor = 2, Status = RoomStatus.Clean };

            var rateA = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                PropertyId = branchAId,
                RoomTypeId = roomTypeAId,
                FirstHours = 2,
                FirstHoursPrice = 300000m,
                AdditionalHourPrice = 100000m,
                NightlyPrice = 1200000m,
                Currency = "VND",
                EffectiveFrom = today.AddDays(-5),
                EffectiveTo = today.AddDays(60),
                CreatedByUserId = ownerT1UserId,
                IsActive = true
            };

            var rateB = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                PropertyId = branchBId,
                RoomTypeId = roomTypeBId,
                FirstHours = 2,
                FirstHoursPrice = 400000m,
                AdditionalHourPrice = 120000m,
                NightlyPrice = 1500000m,
                Currency = "VND",
                EffectiveFrom = today.AddDays(-5),
                EffectiveTo = today.AddDays(60),
                CreatedByUserId = ownerT1UserId,
                IsActive = true
            };

            var resA = new Reservation
            {
                Id = resAId,
                TenantId = tenant1Id,
                PropertyId = branchAId,
                RoomId = roomAId,
                GuestName = "Khach Hang Chi Nhanh A",
                GuestEmail = "guest_a@example.com",
                GuestPhone = "0901000111",
                CheckInDate = today,
                CheckOutDate = today.AddDays(1),
                NumberOfGuests = 2,
                TotalAmount = 1200000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = "RES-BRANCH-A-001"
            };

            var resB = new Reservation
            {
                Id = resBId,
                TenantId = tenant1Id,
                PropertyId = branchBId,
                RoomId = roomBId,
                GuestName = "Khach Hang Bi Mat Chi Nhanh B",
                GuestEmail = "secret_guest_b@example.com",
                GuestPhone = "0902000222",
                CheckInDate = today,
                CheckOutDate = today.AddDays(1),
                NumberOfGuests = 2,
                TotalAmount = 1500000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = "RES-BRANCH-B-SECRET"
            };

            var payB = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant1Id,
                PropertyId = branchBId,
                ReservationId = resBId,
                Amount = 1500000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = payBRef,
                PaidAtUtc = DateTime.UtcNow
            };

            ctx1.PermissionFunctions.AddRange(fnRooms, fnReservations, fnCheckInOut, fnPayments, fnReports);
            ctx1.Tenants.Add(tenant1);
            ctx1.Properties.AddRange(branchA, branchB);
            ctx1.AccessRoles.AddRange(roleRec, roleOwner);

            foreach (var fn in new[] { fnRooms, fnReservations, fnCheckInOut, fnPayments, fnReports })
            {
                ctx1.RolePermissions.Add(new RolePermission { RoleId = roleT1Id, FunctionId = fn.Id, ActionMask = 127 });
                ctx1.RolePermissions.Add(new RolePermission { RoleId = ownerRoleT1Id, FunctionId = fn.Id, ActionMask = 127 });
            }

            ctx1.Users.AddRange(recAUser, recBUser, ownerUser);
            ctx1.TenantStaffMembers.AddRange(staffRecA, staffRecB, staffOwner);
            ctx1.RoomTypes.AddRange(roomTypeA, roomTypeB);
            ctx1.Rooms.AddRange(roomA, roomB);
            ctx1.RoomTypeRates.AddRange(rateA, rateB);
            ctx1.Reservations.AddRange(resA, resB);
            ctx1.Payments.Add(payB);

            await ctx1.SaveChangesAsync();
        }

        // Seed Tenant 2 completely isolated
        await using (var ctx2 = CreateSeedDbContext(baseConnStr, testSchema, tenant2Id))
        {
            var tenant2 = new Tenant
            {
                Id = tenant2Id,
                Name = "Rival Resort Corporation",
                Code = "RIVAL2",
                Slug = "rival-t2",
                Address = "99 Tran Hung Dao",
                City = "Ha Noi",
                Status = TenantStatus.Active
            };

            var branchT2 = new Property
            {
                Id = branchT2Id,
                TenantId = tenant2Id,
                Name = "Rival Hanoi Flagship",
                Code = "HAN-01",
                Slug = "rival-hanoi",
                Address = "99 Tran Hung Dao",
                City = "Ha Noi",
                Status = PropertyStatus.Active,
                CheckInTime = new TimeOnly(14, 0),
                CheckOutTime = new TimeOnly(12, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12
            };

            var roleT2 = new AccessRole { Id = roleT2Id, TenantId = tenant2Id, Name = "Rival Receptionist", Code = "RREC" };
            var userT2 = new User
            {
                Id = userT2Id,
                Username = "rec_tenant2",
                Email = "rec_t2@rival.local",
                PasswordHash = hasher.Hash("P@ssword123!"),
                FullName = "Receptionist Tenant 2",
                IsActive = true,
                GlobalRole = GlobalUserRole.Customer
            };

            var staffT2 = new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant2Id,
                UserId = userT2Id,
                RoleId = roleT2Id,
                PropertyId = branchT2Id,
                StaffRole = StaffRole.Receptionist,
                IsActive = true
            };

            var roomTypeT2 = new RoomType { Id = roomTypeT2Id, TenantId = tenant2Id, PropertyId = branchT2Id, Name = "Rival Royal", Code = "ROY-T2", BasePrice = 2500000m, MaxOccupancy = 2 };
            var roomT2 = new Room { Id = roomT2Id, TenantId = tenant2Id, PropertyId = branchT2Id, RoomTypeId = roomTypeT2Id, RoomNumber = "T2-901", Floor = 9, Status = RoomStatus.Clean };
            var resT2 = new Reservation
            {
                Id = resT2Id,
                TenantId = tenant2Id,
                PropertyId = branchT2Id,
                RoomId = roomT2Id,
                GuestName = "VIP Guest Tenant 2",
                GuestEmail = "vip_t2@rival.local",
                GuestPhone = "0988999888",
                CheckInDate = today,
                CheckOutDate = today.AddDays(2),
                NumberOfGuests = 2,
                TotalAmount = 5000000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = "RES-TENANT2-SECRET"
            };
            var payT2 = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant2Id,
                PropertyId = branchT2Id,
                ReservationId = resT2Id,
                Amount = 5000000m,
                Method = PaymentMethod.VNPay,
                Status = PaymentStatus.Completed,
                TransactionRef = payT2Ref,
                PaidAtUtc = DateTime.UtcNow
            };

            ctx2.Tenants.Add(tenant2);
            ctx2.Properties.Add(branchT2);
            ctx2.AccessRoles.Add(roleT2);
            foreach (var fn in new[] { fnRooms, fnReservations, fnCheckInOut, fnPayments, fnReports })
            {
                ctx2.RolePermissions.Add(new RolePermission { RoleId = roleT2Id, FunctionId = fn.Id, ActionMask = 127 });
            }
            ctx2.Users.Add(userT2);
            ctx2.TenantStaffMembers.Add(staffT2);
            ctx2.RoomTypes.Add(roomTypeT2);
            ctx2.Rooms.Add(roomT2);
            ctx2.Reservations.Add(resT2);
            ctx2.Payments.Add(payT2);

            await ctx2.SaveChangesAsync();
        }

        return new SeededWorld(
            tenant1Id, branchAId, branchBId, recAUserId, recBUserId, ownerT1UserId,
            roomAId, roomBId, resAId, resBId, payBRef,
            tenant2Id, branchT2Id, userT2Id, resT2Id, payT2Ref);
    }

    private static HttpRequestMessage CreateAuthorizedRequest(
        HttpMethod method,
        string url,
        string bearerToken,
        Guid? headerPropertyId = null,
        Guid? headerTenantId = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        if (headerPropertyId.HasValue)
        {
            req.Headers.Add("X-Property-Id", headerPropertyId.Value.ToString());
        }
        if (headerTenantId.HasValue)
        {
            req.Headers.Add("X-Tenant-Id", headerTenantId.Value.ToString());
        }
        return req;
    }

    [Fact]
    public async Task CrossBranchAndCrossTenant_FullHttpPipeline_EnforcesFailClosedIsolation()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"wk6_sec_e2e_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var world = await SeedIsolationWorldAsync(baseConnStr, testSchema);

            await using var factory = new RealSecurityWebApplicationFactory(baseConnStr, testSchema);
            using var client = factory.CreateClient();

            // Sign real JWT tokens through the real DI IJwtService (zero mocked services)
            using var diScope = factory.Services.CreateScope();
            var jwtService = diScope.ServiceProvider.GetRequiredService<IJwtService>();

            var fullStaffPerms = new[] { "ROOMS:127", "RESERVATIONS:127", "CHECK_IN_OUT:127", "PAYMENTS:127", "REPORTS:127" };

            var (recAToken, _, _) = jwtService.GenerateTokens(
                world.ReceptionistAUserId,
                "rec_a@luxestay.local",
                "Receptionist Branch A",
                "Customer",
                world.Tenant1Id,
                fullStaffPerms,
                propertyId: world.BranchAId,
                scope: "PropertyScoped",
                staffRole: "Receptionist");

            var (recBToken, _, _) = jwtService.GenerateTokens(
                world.ReceptionistBUserId,
                "rec_b@luxestay.local",
                "Receptionist Branch B",
                "Customer",
                world.Tenant1Id,
                fullStaffPerms,
                propertyId: world.BranchBId,
                scope: "PropertyScoped",
                staffRole: "Receptionist");

            var (ownerT1Token, _, _) = jwtService.GenerateTokens(
                world.OwnerTenant1UserId,
                "owner_t1@luxestay.local",
                "Owner Tenant 1",
                "Customer",
                world.Tenant1Id,
                fullStaffPerms,
                propertyId: null,
                scope: "TenantWide",
                staffRole: "Owner");

            // Baseline positive checks: confirm legitimate same-branch traffic succeeds with strict scoping
            using (var okRoomsReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/rooms", recAToken, world.BranchAId))
            {
                var okRoomsResp = await client.SendAsync(okRoomsReq);
                Assert.Equal(HttpStatusCode.OK, okRoomsResp.StatusCode);
                var okRoomsBody = await okRoomsResp.Content.ReadAsStringAsync();
                Assert.Contains("A101", okRoomsBody);
                Assert.DoesNotContain("B201", okRoomsBody);
                Assert.DoesNotContain("T2-901", okRoomsBody);
            }

            using (var okBRoomsReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/rooms", recBToken, world.BranchBId))
            {
                var okBRoomsResp = await client.SendAsync(okBRoomsReq);
                Assert.Equal(HttpStatusCode.OK, okBRoomsResp.StatusCode);
                var okBRoomsBody = await okBRoomsResp.Content.ReadAsStringAsync();
                Assert.Contains("B201", okBRoomsBody);
                Assert.DoesNotContain("A101", okBRoomsBody);
            }

            // TC01: ReceptionistA calls GET /api/rooms with spoofed header X-Property-Id: {BranchB} -> 403 Forbidden
            using (var tc01Req = CreateAuthorizedRequest(HttpMethod.Get, "/api/rooms", recAToken, world.BranchBId))
            {
                var tc01Resp = await client.SendAsync(tc01Req);
                Assert.Equal(HttpStatusCode.Forbidden, tc01Resp.StatusCode);
                var tc01Body = await tc01Resp.Content.ReadAsStringAsync();
                Assert.Contains("ERR_PROPERTY_FORBIDDEN", tc01Body);
                Assert.DoesNotContain("B201", tc01Body);
                Assert.DoesNotContain(world.RoomBId.ToString(), tc01Body);
            }

            // TC02: ReceptionistA attempts POST /api/reservations/{ReservationOfBranchB}/check-in?propertyId={BranchB}
            // Variant A (header spoofed to BranchB) -> 403 Forbidden by TenantPropertyContextMiddleware
            using (var tc02SpoofHeaderReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/reservations/{world.ReservationBId}/check-in?propertyId={world.BranchBId}",
                recAToken,
                world.BranchBId))
            {
                var tc02SpoofResp = await client.SendAsync(tc02SpoofHeaderReq);
                Assert.Equal(HttpStatusCode.Forbidden, tc02SpoofResp.StatusCode);
                var tc02SpoofBody = await tc02SpoofResp.Content.ReadAsStringAsync();
                Assert.Contains("ERR_PROPERTY_FORBIDDEN", tc02SpoofBody);
            }

            // Variant B (keeps X-Property-Id: BranchA, queries ?propertyId=BranchB) -> rejected fail-closed (never succeeds)
            using (var tc02MismatchReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/reservations/{world.ReservationBId}/check-in?propertyId={world.BranchBId}",
                recAToken,
                world.BranchAId))
            {
                var tc02MismatchResp = await client.SendAsync(tc02MismatchReq);
                Assert.True(
                    tc02MismatchResp.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.BadRequest,
                    $"Expected 403 or 400 when keeping BranchA header with BranchB query, got {(int)tc02MismatchResp.StatusCode}");
            }

            // Variant C (keeps BranchA context everywhere on ReservationB) -> 404 NotFound (EF query filter hides BranchB record)
            using (var tc02HiddenReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/reservations/{world.ReservationBId}/check-in?propertyId={world.BranchAId}",
                recAToken,
                world.BranchAId))
            {
                var tc02HiddenResp = await client.SendAsync(tc02HiddenReq);
                Assert.Equal(HttpStatusCode.NotFound, tc02HiddenResp.StatusCode);
            }

            // Assert Branch B reservation and room states remain completely untouched in PostgreSQL
            await using (var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, world.Tenant1Id))
            {
                var resB = await verifyCtx.Reservations.IgnoreQueryFilters()
                    .AsNoTracking()
                    .FirstAsync(r => r.Id == world.ReservationBId);
                var roomB = await verifyCtx.Rooms.IgnoreQueryFilters()
                    .AsNoTracking()
                    .FirstAsync(r => r.Id == world.RoomBId);

                Assert.Equal(ReservationStatus.Confirmed, resB.Status);
                Assert.Equal(RoomStatus.Clean, roomB.Status);
            }

            // TC03: ReceptionistA calls GET /api/payments?propertyId={BranchB} & GET /api/reservations/{ReservationOfBranchB}/folio?propertyId={BranchB} -> 403 Forbidden
            using (var tc03PaymentsReq = CreateAuthorizedRequest(
                HttpMethod.Get,
                $"/api/payments?propertyId={world.BranchBId}",
                recAToken,
                world.BranchBId))
            {
                var tc03PaymentsResp = await client.SendAsync(tc03PaymentsReq);
                Assert.Equal(HttpStatusCode.Forbidden, tc03PaymentsResp.StatusCode);
                var tc03PaymentsBody = await tc03PaymentsResp.Content.ReadAsStringAsync();
                Assert.DoesNotContain(world.PaymentBTransactionRef, tc03PaymentsBody);
            }

            using (var tc03FolioReq = CreateAuthorizedRequest(
                HttpMethod.Get,
                $"/api/reservations/{world.ReservationBId}/folio?propertyId={world.BranchBId}",
                recAToken,
                world.BranchBId))
            {
                var tc03FolioResp = await client.SendAsync(tc03FolioReq);
                Assert.Equal(HttpStatusCode.Forbidden, tc03FolioResp.StatusCode);
                var tc03FolioBody = await tc03FolioResp.Content.ReadAsStringAsync();
                Assert.DoesNotContain("RES-BRANCH-B-SECRET", tc03FolioBody);
                Assert.DoesNotContain(world.PaymentBTransactionRef, tc03FolioBody);
            }

            // TC04: ReceptionistA calls GET /api/reports/revenue-summary?propertyId={BranchB} with X-Property-Id: {BranchB} -> 403 Forbidden
            using (var tc04Req = CreateAuthorizedRequest(
                HttpMethod.Get,
                $"/api/reports/revenue-summary?propertyId={world.BranchBId}",
                recAToken,
                world.BranchBId))
            {
                var tc04Resp = await client.SendAsync(tc04Req);
                Assert.Equal(HttpStatusCode.Forbidden, tc04Resp.StatusCode);
                var tc04Body = await tc04Resp.Content.ReadAsStringAsync();
                Assert.Contains("ERR_PROPERTY_FORBIDDEN", tc04Body);
                Assert.DoesNotContain("totalRevenue", tc04Body);
            }

            // TC05: Token has PropertyId=BranchA, but attacker spoofs BOTH query ?propertyId={BranchB} AND header X-Property-Id: {BranchB} -> 403 Forbidden
            foreach (var spoofedUrl in new[]
            {
                $"/api/payments?propertyId={world.BranchBId}",
                $"/api/payments/shift-report?propertyId={world.BranchBId}",
                $"/api/reports/revenue-summary?propertyId={world.BranchBId}"
            })
            {
                using var tc05Req = CreateAuthorizedRequest(HttpMethod.Get, spoofedUrl, recAToken, world.BranchBId);
                var tc05Resp = await client.SendAsync(tc05Req);
                Assert.Equal(HttpStatusCode.Forbidden, tc05Resp.StatusCode);
                var tc05Body = await tc05Resp.Content.ReadAsStringAsync();
                Assert.Contains("ERR_PROPERTY_FORBIDDEN", tc05Body);
            }

            // TC06 (Cross-Tenant): Tenant 1 user attempts to access Tenant 2 resources -> blocked 403 / 404 without revealing existence
            // 6a: ReceptionistA (Tenant 1, BranchA) spoofs X-Property-Id: BranchT2 (Tenant 2) -> 403 Forbidden
            using (var tc06RecReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/rooms", recAToken, world.BranchT2Id))
            {
                var tc06RecResp = await client.SendAsync(tc06RecReq);
                Assert.Equal(HttpStatusCode.Forbidden, tc06RecResp.StatusCode);
                var tc06RecBody = await tc06RecResp.Content.ReadAsStringAsync();
                Assert.DoesNotContain("T2-901", tc06RecBody);
            }

            // 6b: Owner of Tenant 1 (TenantWide scope!) spoofs X-Property-Id: BranchT2 (Tenant 2) -> 404 NotFound / 403 Forbidden (membership lookup fails closed on TenantId boundary)
            using (var tc06OwnerReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/rooms", ownerT1Token, world.BranchT2Id))
            {
                var tc06OwnerResp = await client.SendAsync(tc06OwnerReq);
                Assert.True(
                    tc06OwnerResp.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden,
                    $"Expected 404 or 403 when Tenant1 Owner requests Tenant2 property, got {(int)tc06OwnerResp.StatusCode}");
                var tc06OwnerBody = await tc06OwnerResp.Content.ReadAsStringAsync();
                Assert.DoesNotContain("T2-901", tc06OwnerBody);
            }

            // 6c: ReceptionistA (Tenant 1) queries Tenant 2 reservation folio under valid BranchA context -> 404 NotFound (zero existence leakage)
            using (var tc06FolioReq = CreateAuthorizedRequest(
                HttpMethod.Get,
                $"/api/reservations/{world.ReservationT2Id}/folio?propertyId={world.BranchAId}",
                recAToken,
                world.BranchAId))
            {
                var tc06FolioResp = await client.SendAsync(tc06FolioReq);
                Assert.Equal(HttpStatusCode.NotFound, tc06FolioResp.StatusCode);
                var tc06FolioBody = await tc06FolioResp.Content.ReadAsStringAsync();
                Assert.DoesNotContain("RES-TENANT2-SECRET", tc06FolioBody);
                Assert.DoesNotContain(world.PaymentT2TransactionRef, tc06FolioBody);
            }
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task MultiBranch_SameTenant_D23RolesAndSignalRIsolation_FullPipeline_EnforcesStrictIsolation()
    {
        var baseConnStr = GetConnectionString();
        ValidateTestDatabaseTarget(baseConnStr);

        var testSchema = $"wk6_mb_sig_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var world = await SeedIsolationWorldAsync(baseConnStr, testSchema);

            var cashierRoleId = Guid.NewGuid();
            var cashier1AUserId = Guid.NewGuid();
            var cashier2AUserId = Guid.NewGuid();
            var futureResAId = Guid.NewGuid();
            const string futureCode = "RES-MB-D23-001";

            await using (var ctxExtra = CreateSeedDbContext(baseConnStr, testSchema, world.Tenant1Id))
            {
                // Restrict Receptionist role on PAYMENTS to Read|Create (ActionMask=3, NO Approve=16 bit)
                // so Receptionist joins _frontdesk SignalR group (sanitized financials) and cannot approve refunds.
                var recPaymentsPerm = await ctxExtra.RolePermissions
                    .Include(rp => rp.Function)
                    .Include(rp => rp.Role)
                    .FirstAsync(rp => rp.Role!.Code == "REC" && rp.Role.TenantId == world.Tenant1Id && rp.Function!.Code == "PAYMENTS");
                recPaymentsPerm.ActionMask = 3;

                var roleCashier = new AccessRole
                {
                    Id = cashierRoleId,
                    TenantId = world.Tenant1Id,
                    Name = "Branch Financial Cashier",
                    Code = "CASHIER"
                };
                ctxExtra.AccessRoles.Add(roleCashier);

                var functions = await ctxExtra.PermissionFunctions.AsNoTracking().ToListAsync();
                foreach (var fn in functions)
                {
                    ctxExtra.RolePermissions.Add(new RolePermission
                    {
                        RoleId = cashierRoleId,
                        FunctionId = fn.Id,
                        ActionMask = 127
                    });
                }

                var hasher = new PasswordHasherService();
                var cashier1User = new User
                {
                    Id = cashier1AUserId,
                    Username = "cashier_1_a",
                    Email = "cashier1_a@luxestay.local",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Cashier One Branch A",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };
                var cashier2User = new User
                {
                    Id = cashier2AUserId,
                    Username = "cashier_2_a",
                    Email = "cashier2_a@luxestay.local",
                    PasswordHash = hasher.Hash("P@ssword123!"),
                    FullName = "Cashier Two Branch A",
                    IsActive = true,
                    GlobalRole = GlobalUserRole.Customer
                };
                ctxExtra.Users.AddRange(cashier1User, cashier2User);

                ctxExtra.TenantStaffMembers.AddRange(
                    new TenantStaff
                    {
                        Id = Guid.NewGuid(),
                        TenantId = world.Tenant1Id,
                        UserId = cashier1AUserId,
                        RoleId = cashierRoleId,
                        PropertyId = world.BranchAId,
                        StaffRole = StaffRole.Manager,
                        IsActive = true
                    },
                    new TenantStaff
                    {
                        Id = Guid.NewGuid(),
                        TenantId = world.Tenant1Id,
                        UserId = cashier2AUserId,
                        RoleId = cashierRoleId,
                        PropertyId = world.BranchAId,
                        StaffRole = StaffRole.Manager,
                        IsActive = true
                    });

                var roomA = await ctxExtra.Rooms.AsNoTracking().FirstAsync(r => r.Id == world.RoomAId);
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                ctxExtra.Reservations.Add(new Reservation
                {
                    Id = futureResAId,
                    TenantId = world.Tenant1Id,
                    PropertyId = world.BranchAId,
                    RoomId = roomA.Id,
                    GuestName = "Khach Hoan Tien Da Chi Nhanh",
                    GuestEmail = "guest_mb_d23@example.com",
                    GuestPhone = "0909888777",
                    CheckInDate = today.AddDays(30),
                    CheckOutDate = today.AddDays(32),
                    NumberOfGuests = 2,
                    TotalAmount = 1200000m,
                    Status = ReservationStatus.Confirmed,
                    ConfirmationCode = futureCode
                });

                await ctxExtra.SaveChangesAsync();
            }

            await using var factory = new RealSecurityWebApplicationFactory(baseConnStr, testSchema);
            using var client = factory.CreateClient();

            using var diScope = factory.Services.CreateScope();
            var jwtService = diScope.ServiceProvider.GetRequiredService<IJwtService>();

            var recLimitedPerms = new[] { "ROOMS:127", "RESERVATIONS:127", "CHECK_IN_OUT:127", "PAYMENTS:3", "REPORTS:127" };
            var fullCashierPerms = new[] { "ROOMS:127", "RESERVATIONS:127", "CHECK_IN_OUT:127", "PAYMENTS:127", "REPORTS:127" };

            var (recNoFinAToken, _, _) = jwtService.GenerateTokens(
                world.ReceptionistAUserId, "rec_a@luxestay.local", "Receptionist Branch A",
                "Customer", world.Tenant1Id, recLimitedPerms,
                propertyId: world.BranchAId, scope: "PropertyScoped", staffRole: "Receptionist");

            var (recBToken, _, _) = jwtService.GenerateTokens(
                world.ReceptionistBUserId, "rec_b@luxestay.local", "Receptionist Branch B",
                "Customer", world.Tenant1Id, recLimitedPerms,
                propertyId: world.BranchBId, scope: "PropertyScoped", staffRole: "Receptionist");

            var (cashier1AToken, _, _) = jwtService.GenerateTokens(
                cashier1AUserId, "cashier1_a@luxestay.local", "Cashier One Branch A",
                "Customer", world.Tenant1Id, fullCashierPerms,
                propertyId: world.BranchAId, scope: "PropertyScoped", staffRole: "Manager");

            var (cashier2AToken, _, _) = jwtService.GenerateTokens(
                cashier2AUserId, "cashier2_a@luxestay.local", "Cashier Two Branch A",
                "Customer", world.Tenant1Id, fullCashierPerms,
                propertyId: world.BranchAId, scope: "PropertyScoped", staffRole: "Manager");

            // 1. Live SignalR WebSocket connections across 2 branches in the SAME tenant
            await using var recNoFinAWs = await SignalRTestWebSocketClient.ConnectAsync(factory, recNoFinAToken);
            await using var cashier1AWs = await SignalRTestWebSocketClient.ConnectAsync(factory, cashier1AToken);
            await using var recBWs = await SignalRTestWebSocketClient.ConnectAsync(factory, recBToken);

            var (joinRecAOk, joinRecAErr) = await recNoFinAWs.InvokeJoinPropertyAsync(world.BranchAId);
            Assert.True(joinRecAOk, $"Receptionist A failed to join own Branch A: {joinRecAErr}");

            // Same-tenant cross-branch JoinProperty MUST be rejected fail-closed
            var (joinCrossOk, joinCrossErr) = await recNoFinAWs.InvokeJoinPropertyAsync(world.BranchBId);
            Assert.False(joinCrossOk);
            Assert.Contains("ERR_PROPERTY_FORBIDDEN", joinCrossErr ?? string.Empty);

            var (joinCashierOk, joinCashierErr) = await cashier1AWs.InvokeJoinPropertyAsync(world.BranchAId);
            Assert.True(joinCashierOk, $"Cashier 1A failed to join Branch A: {joinCashierErr}");

            var (joinRecBOk, joinRecBErr) = await recBWs.InvokeJoinPropertyAsync(world.BranchBId);
            Assert.True(joinRecBOk, $"Receptionist B failed to join own Branch B: {joinRecBErr}");

            // 2. Collect payment at Branch A -> triggers SignalR ReceiveBookingPaymentConfirmed with financial masking
            using (var payReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/payments?propertyId={world.BranchAId}",
                recNoFinAToken,
                world.BranchAId))
            {
                payReq.Content = JsonContent.Create(new
                {
                    reservationId = futureResAId,
                    amount = 1200000m,
                    method = PaymentMethod.Cash,
                    transactionRef = "CASH-MB-D23-001",
                    idempotencyKey = "idem-mb-d23-pay-001",
                    isDeposit = false
                });
                var payResp = await client.SendAsync(payReq);
                Assert.Equal(HttpStatusCode.Created, payResp.StatusCode);
            }

            var cashierPayPayload = await cashier1AWs.WaitForEventAsync("ReceiveBookingPaymentConfirmed", TimeSpan.FromSeconds(5));
            Assert.Equal(1200000m, GetDecimalProperty(cashierPayPayload, "paidAmount"));
            Assert.Equal(1200000m, GetDecimalProperty(cashierPayPayload, "totalAmount"));
            Assert.Equal("Cash", GetStringProperty(cashierPayPayload, "paymentMethod"));

            var recPayPayload = await recNoFinAWs.WaitForEventAsync("ReceiveBookingPaymentConfirmed", TimeSpan.FromSeconds(5));
            Assert.Equal(0m, GetDecimalProperty(recPayPayload, "paidAmount"));
            Assert.Equal(0m, GetDecimalProperty(recPayPayload, "totalAmount"));
            Assert.Equal(string.Empty, GetStringProperty(recPayPayload, "paymentMethod"));

            // 3. Cancel reservation at Branch A -> creates D23 pending refund + SignalR ReceiveBookingCancellationRequested
            using (var cancelReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/reservations/{futureResAId}/cancel?propertyId={world.BranchAId}",
                cashier1AToken,
                world.BranchAId))
            {
                cancelReq.Content = JsonContent.Create(new { reason = "Same-tenant multi-branch D23 E2E test" });
                var cancelResp = await client.SendAsync(cancelReq);
                Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);
            }

            var cashierCancelPayload = await cashier1AWs.WaitForEventAsync("ReceiveBookingCancellationRequested", TimeSpan.FromSeconds(5));
            Assert.Equal(futureCode, GetStringProperty(cashierCancelPayload, "confirmationCode"));
            Assert.Equal(1200000m, GetDecimalProperty(cashierCancelPayload, "refundableAmount"));

            var recCancelPayload = await recNoFinAWs.WaitForEventAsync("ReceiveBookingCancellationRequested", TimeSpan.FromSeconds(5));
            Assert.Equal(futureCode, GetStringProperty(recCancelPayload, "confirmationCode"));
            Assert.Equal(0m, GetDecimalProperty(recCancelPayload, "refundableAmount"));

            // Same-tenant Branch B listener MUST have received 0 notifications from Branch A
            await Task.Delay(350);
            Assert.Empty(recBWs.DrainQueuedEvents());

            // 4. Locate pending refund id via Cashier 1A
            Guid refundPaymentId;
            using (var listRefundReq = CreateAuthorizedRequest(
                HttpMethod.Get,
                $"/api/payments/refunds?propertyId={world.BranchAId}&searchTerm={futureCode}",
                cashier1AToken,
                world.BranchAId))
            {
                var listRefundResp = await client.SendAsync(listRefundReq);
                Assert.Equal(HttpStatusCode.OK, listRefundResp.StatusCode);
                using var doc = JsonDocument.Parse(await listRefundResp.Content.ReadAsStringAsync());
                var items = doc.RootElement.TryGetProperty("data", out var dataEl)
                    ? dataEl.GetProperty("items")
                    : doc.RootElement.GetProperty("items");
                Assert.True(items.GetArrayLength() >= 1);
                refundPaymentId = Guid.Parse(GetStringProperty(items[0], "paymentId")!);
            }

            // 5. Same-branch low-privilege Receptionist MUST be rejected 403 on D23 approve
            using (var recApproveReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/payments/refunds/{refundPaymentId}/approve?propertyId={world.BranchAId}",
                recNoFinAToken,
                world.BranchAId))
            {
                recApproveReq.Content = JsonContent.Create(new { notes = "Unauthorized receptionist attempt" });
                var recApproveResp = await client.SendAsync(recApproveReq);
                Assert.Equal(HttpStatusCode.Forbidden, recApproveResp.StatusCode);
            }

            // 6. Cashier 1A approves the refund
            using (var approveReq = CreateAuthorizedRequest(
                HttpMethod.Post,
                $"/api/payments/refunds/{refundPaymentId}/approve?propertyId={world.BranchAId}",
                cashier1AToken,
                world.BranchAId))
            {
                approveReq.Content = JsonContent.Create(new { notes = "Cashier 1A approved D23 refund" });
                var approveResp = await client.SendAsync(approveReq);
                Assert.Equal(HttpStatusCode.OK, approveResp.StatusCode);
            }

            // 7. Two independent Cashier accounts concurrently call confirm-payout -> exactly 1x 200 OK, 1x 409 Conflict
            async Task<(HttpStatusCode Status, string Body)> ConfirmPayoutAsAsync(string token, string bankRef)
            {
                using var req = CreateAuthorizedRequest(
                    HttpMethod.Post,
                    $"/api/payments/refunds/{refundPaymentId}/confirm-payout?propertyId={world.BranchAId}",
                    token,
                    world.BranchAId);
                req.Content = JsonContent.Create(new
                {
                    payoutMethod = PaymentMethod.BankTransfer,
                    bankTransactionRef = bankRef,
                    notes = "Concurrent independent cashier payout test"
                });
                var resp = await client.SendAsync(req);
                return (resp.StatusCode, await resp.Content.ReadAsStringAsync());
            }

            var payoutResults = await Task.WhenAll(
                ConfirmPayoutAsAsync(cashier1AToken, "MB-PAYOUT-CASHIER1A"),
                ConfirmPayoutAsAsync(cashier2AToken, "MB-PAYOUT-CASHIER2A"));

            Assert.Single(payoutResults, r => r.Status == HttpStatusCode.OK);
            var conflictResult = Assert.Single(payoutResults, r => r.Status == HttpStatusCode.Conflict);
            Assert.Contains("ERR_ALREADY_COMPLETED", conflictResult.Body);

            // Verify zero duplicate completed refund records in PostgreSQL
            await using (var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, world.Tenant1Id))
            {
                var refundRows = await verifyCtx.Payments
                    .AsNoTracking()
                    .Where(p => p.ReservationId == futureResAId && p.TransactionRef != null && p.TransactionRef.StartsWith("REFUND-"))
                    .ToListAsync();

                var completedRefund = Assert.Single(refundRows);
                Assert.Equal(PaymentStatus.Completed, completedRefund.Status);
                Assert.Equal(1200000m, completedRefund.Amount);
            }
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }

    private static bool TryGetPropertyCaseInsensitive(JsonElement element, string name, out JsonElement value)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }
        }
        value = default;
        return false;
    }

    private static decimal GetDecimalProperty(JsonElement element, string name)
        => TryGetPropertyCaseInsensitive(element, name, out var prop) ? prop.GetDecimal() : throw new InvalidOperationException($"Missing property '{name}'.");

    private static string? GetStringProperty(JsonElement element, string name)
        => TryGetPropertyCaseInsensitive(element, name, out var prop) ? prop.GetString() : throw new InvalidOperationException($"Missing property '{name}'.");

    private sealed class SignalRTestWebSocketClient : IAsyncDisposable
    {
        private const char RecordSeparator = '\u001e';
        private readonly WebSocket _ws;
        private readonly CancellationTokenSource _cts = new();
        private readonly Channel<JsonDocument> _frames = Channel.CreateUnbounded<JsonDocument>();
        private readonly List<(string Target, JsonElement Payload)> _queuedEvents = new();
        private readonly Task _readerTask;
        private int _invocationSeq;

        private SignalRTestWebSocketClient(WebSocket ws)
        {
            _ws = ws;
            _readerTask = Task.Run(ReadLoopAsync);
        }

        public static async Task<SignalRTestWebSocketClient> ConnectAsync(RealSecurityWebApplicationFactory factory, string accessToken)
        {
            var wsClient = factory.Server.CreateWebSocketClient();
            var uri = new Uri($"ws://localhost/hubs/notifications?access_token={Uri.EscapeDataString(accessToken)}");
            var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);

            var handshakeBytes = Encoding.UTF8.GetBytes("{\"protocol\":\"json\",\"version\":1}" + RecordSeparator);
            await ws.SendAsync(handshakeBytes, WebSocketMessageType.Text, endOfMessage: true, CancellationToken.None);

            var client = new SignalRTestWebSocketClient(ws);
            var handshakeFrame = await client.ReadNextFrameAsync(TimeSpan.FromSeconds(5));
            using (handshakeFrame)
            {
                if (handshakeFrame.RootElement.TryGetProperty("error", out var errProp) && errProp.ValueKind == JsonValueKind.String)
                {
                    throw new InvalidOperationException($"SignalR handshake error: {errProp.GetString()}");
                }
            }

            return client;
        }

        public async Task<(bool Success, string? Error)> InvokeJoinPropertyAsync(Guid propertyId)
        {
            var invId = Interlocked.Increment(ref _invocationSeq).ToString();
            var payload = JsonSerializer.Serialize(new
            {
                type = 1,
                invocationId = invId,
                target = "JoinProperty",
                arguments = new[] { propertyId.ToString() }
            }) + RecordSeparator;

            await _ws.SendAsync(Encoding.UTF8.GetBytes(payload), WebSocketMessageType.Text, endOfMessage: true, _cts.Token);

            var deadline = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < deadline)
            {
                var remaining = deadline - DateTime.UtcNow;
                using var frame = await ReadNextFrameAsync(remaining > TimeSpan.Zero ? remaining : TimeSpan.FromMilliseconds(50));
                var root = frame.RootElement;
                var msgType = root.TryGetProperty("type", out var tProp) ? tProp.GetInt32() : 0;
                if (msgType == 6) continue; // Ping
                if (msgType == 1 && root.TryGetProperty("target", out var targetProp) && root.TryGetProperty("arguments", out var argsProp))
                {
                    _queuedEvents.Add((targetProp.GetString() ?? string.Empty, argsProp[0].Clone()));
                    continue;
                }
                if (msgType == 3 && root.TryGetProperty("invocationId", out var invProp) && invProp.GetString() == invId)
                {
                    if (root.TryGetProperty("error", out var errProp) && errProp.ValueKind == JsonValueKind.String)
                    {
                        return (false, errProp.GetString());
                    }
                    return (true, null);
                }
            }

            throw new TimeoutException($"Timed out waiting for JoinProperty({propertyId}) completion.");
        }

        public async Task<JsonElement> WaitForEventAsync(string target, TimeSpan timeout)
        {
            for (var i = 0; i < _queuedEvents.Count; i++)
            {
                if (string.Equals(_queuedEvents[i].Target, target, StringComparison.Ordinal))
                {
                    var match = _queuedEvents[i].Payload;
                    _queuedEvents.RemoveAt(i);
                    return match;
                }
            }

            var deadline = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < deadline)
            {
                var remaining = deadline - DateTime.UtcNow;
                using var frame = await ReadNextFrameAsync(remaining > TimeSpan.Zero ? remaining : TimeSpan.FromMilliseconds(50));
                var root = frame.RootElement;
                var msgType = root.TryGetProperty("type", out var tProp) ? tProp.GetInt32() : 0;
                if (msgType == 6) continue;
                if (msgType == 1 && root.TryGetProperty("target", out var targetProp) && root.TryGetProperty("arguments", out var argsProp))
                {
                    var eventTarget = targetProp.GetString() ?? string.Empty;
                    var eventPayload = argsProp[0].Clone();
                    if (string.Equals(eventTarget, target, StringComparison.Ordinal))
                    {
                        return eventPayload;
                    }
                    _queuedEvents.Add((eventTarget, eventPayload));
                }
            }

            throw new TimeoutException($"Timed out waiting for SignalR event '{target}'.");
        }

        public IReadOnlyList<(string Target, JsonElement Payload)> DrainQueuedEvents()
        {
            while (_frames.Reader.TryRead(out var frame))
            {
                using (frame)
                {
                    var root = frame.RootElement;
                    var msgType = root.TryGetProperty("type", out var tProp) ? tProp.GetInt32() : 0;
                    if (msgType == 1 && root.TryGetProperty("target", out var targetProp) && root.TryGetProperty("arguments", out var argsProp))
                    {
                        _queuedEvents.Add((targetProp.GetString() ?? string.Empty, argsProp[0].Clone()));
                    }
                }
            }
            var snapshot = _queuedEvents.ToList();
            _queuedEvents.Clear();
            return snapshot;
        }

        private async Task<JsonDocument> ReadNextFrameAsync(TimeSpan timeout)
        {
            using var waitCts = new CancellationTokenSource(timeout);
            return await _frames.Reader.ReadAsync(waitCts.Token);
        }

        private async Task ReadLoopAsync()
        {
            var buffer = new byte[8192];
            var sb = new StringBuilder();
            try
            {
                while (!_cts.IsCancellationRequested && _ws.State == WebSocketState.Open)
                {
                    var result = await _ws.ReceiveAsync(buffer, _cts.Token);
                    if (result.MessageType == WebSocketMessageType.Close) break;
                    sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                    var text = sb.ToString();
                    int sepIdx;
                    var start = 0;
                    while ((sepIdx = text.IndexOf(RecordSeparator, start)) >= 0)
                    {
                        var frameJson = text[start..sepIdx];
                        start = sepIdx + 1;
                        if (!string.IsNullOrWhiteSpace(frameJson))
                        {
                            await _frames.Writer.WriteAsync(JsonDocument.Parse(frameJson), _cts.Token);
                        }
                    }
                    sb.Clear();
                    if (start < text.Length)
                    {
                        sb.Append(text[start..]);
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (WebSocketException)
            {
            }
            finally
            {
                _frames.Writer.TryComplete();
            }
        }

        public async ValueTask DisposeAsync()
        {
            _cts.Cancel();
            if (_ws.State == WebSocketState.Open)
            {
                try
                {
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test complete", CancellationToken.None);
                }
                catch
                {
                }
            }
            try
            {
                await _readerTask;
            }
            catch
            {
            }
            _ws.Dispose();
            _cts.Dispose();
        }
    }
}
