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
using System.Threading.Tasks;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests.Notifications;

[Collection("RealDatabaseTests")]
public sealed class HoldExpiredPipelineTests
{
    private const char RecordSeparator = '\x1e';

    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var rawConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        return new NpgsqlConnectionStringBuilder(rawConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
        }.ConnectionString;
    }

    private static ApplicationDbContext CreateSeedDbContext(string connString, string testSchema, Guid tenantId, Guid? propertyId = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };
        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService { PropertyId = propertyId, IsTenantWide = propertyId == null };
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
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

    private sealed class HoldExpiredTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;
        private readonly bool _disableBackgroundSweepHost;

        public const string TestJwtSecretKey = "SuperSecretKeyForHoldExpiredPipelineTesting32+Bytes!";

        public HoldExpiredTestWebApplicationFactory(
            string connectionString,
            string testSchema,
            bool disableBackgroundSweepHost = false)
        {
            _connectionString = connectionString;
            _testSchema = testSchema;
            _disableBackgroundSweepHost = disableBackgroundSweepHost;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var testConnBuilder = new NpgsqlConnectionStringBuilder(_connectionString)
            {
                SearchPath = _testSchema,
                Pooling = false
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

            if (_disableBackgroundSweepHost)
            {
                builder.ConfigureTestServices(services =>
                {
                    var hostedDescriptors = services
                        .Where(d => d.ServiceType == typeof(IHostedService) &&
                                    d.ImplementationType == typeof(ExpiredHoldSweepBackgroundService))
                        .ToList();
                    foreach (var d in hostedDescriptors)
                    {
                        services.Remove(d);
                    }
                });
            }
        }
    }

    [Fact]
    public async Task ExpiredHoldSweepBackgroundService_EndToEnd_EstablishesTenantPropertyContext_CommitsBeforeEmit_AndIsolatesBranches()
    {
        var baseConnStr = GetConnectionString();
        var testSchema = $"p6_holdexp_e2e_{Guid.NewGuid():N}";

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var tenant1Id = Guid.NewGuid();
            var branchAId = Guid.NewGuid();
            var branchBId = Guid.NewGuid();
            var roomAId = Guid.NewGuid();
            var roomBId = Guid.NewGuid();
            var userAId = Guid.NewGuid();
            var userBId = Guid.NewGuid();

            var tenant2Id = Guid.NewGuid();
            var branchCId = Guid.NewGuid();
            var roomCId = Guid.NewGuid();
            var userCId = Guid.NewGuid();

            var hasher = new PasswordHasherService();

            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenant1Id))
            {
                await seedCtx.Database.MigrateAsync();

                var roleId1 = Guid.NewGuid();
                seedCtx.Tenants.Add(new Tenant
                {
                    Id = tenant1Id,
                    Name = "Tenant One",
                    Code = "T1HE",
                    Slug = "t1-he",
                    Address = "1 Le Loi",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                });
                seedCtx.Properties.AddRange(
                    new Property
                    {
                        Id = branchAId,
                        TenantId = tenant1Id,
                        Name = "Branch A",
                        Code = "BRA",
                        Slug = "branch-a-he",
                        Address = "1 Le Loi",
                        City = "Da Nang",
                        Status = PropertyStatus.Active
                    },
                    new Property
                    {
                        Id = branchBId,
                        TenantId = tenant1Id,
                        Name = "Branch B",
                        Code = "BRB",
                        Slug = "branch-b-he",
                        Address = "2 Le Loi",
                        City = "Da Nang",
                        Status = PropertyStatus.Active
                    });

                var rtA = new RoomType { Id = Guid.NewGuid(), TenantId = tenant1Id, PropertyId = branchAId, Name = "Deluxe A", Code = "DLXA", BasePrice = 1000000m, MaxOccupancy = 2 };
                var rtB = new RoomType { Id = Guid.NewGuid(), TenantId = tenant1Id, PropertyId = branchBId, Name = "Deluxe B", Code = "DLXB", BasePrice = 1000000m, MaxOccupancy = 2 };
                seedCtx.RoomTypes.AddRange(rtA, rtB);
                seedCtx.Rooms.AddRange(
                    new Room { Id = roomAId, TenantId = tenant1Id, PropertyId = branchAId, RoomTypeId = rtA.Id, RoomNumber = "101", Floor = 1, Status = RoomStatus.Clean },
                    new Room { Id = roomBId, TenantId = tenant1Id, PropertyId = branchBId, RoomTypeId = rtB.Id, RoomNumber = "201", Floor = 2, Status = RoomStatus.Clean });

                seedCtx.AccessRoles.Add(new AccessRole { Id = roleId1, TenantId = tenant1Id, Name = "Staff", Code = "STF1" });
                seedCtx.Users.AddRange(
                    new User { Id = userAId, Username = "staff_a", Email = "staff_a@t1.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "Staff A", IsActive = true, GlobalRole = GlobalUserRole.Customer },
                    new User { Id = userBId, Username = "staff_b", Email = "staff_b@t1.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "Staff B", IsActive = true, GlobalRole = GlobalUserRole.Customer });
                seedCtx.TenantStaffMembers.AddRange(
                    new TenantStaff { Id = Guid.NewGuid(), TenantId = tenant1Id, UserId = userAId, RoleId = roleId1, PropertyId = branchAId, StaffRole = StaffRole.Receptionist, IsActive = true },
                    new TenantStaff { Id = Guid.NewGuid(), TenantId = tenant1Id, UserId = userBId, RoleId = roleId1, PropertyId = branchBId, StaffRole = StaffRole.Receptionist, IsActive = true });

                await seedCtx.SaveChangesAsync();
            }

            await using (var seedCtx2 = CreateSeedDbContext(baseConnStr, testSchema, tenant2Id))
            {
                var roleId2 = Guid.NewGuid();
                seedCtx2.Tenants.Add(new Tenant
                {
                    Id = tenant2Id,
                    Name = "Tenant Two",
                    Code = "T2HE",
                    Slug = "t2-he",
                    Address = "99 Nguyen Hue",
                    City = "Ho Chi Minh",
                    Status = TenantStatus.Active
                });
                seedCtx2.Properties.Add(new Property
                {
                    Id = branchCId,
                    TenantId = tenant2Id,
                    Name = "Branch C",
                    Code = "BRC",
                    Slug = "branch-c-he",
                    Address = "99 Nguyen Hue",
                    City = "Ho Chi Minh",
                    Status = PropertyStatus.Active
                });
                var rtC = new RoomType { Id = Guid.NewGuid(), TenantId = tenant2Id, PropertyId = branchCId, Name = "Suite C", Code = "SUTC", BasePrice = 1800000m, MaxOccupancy = 2 };
                seedCtx2.RoomTypes.Add(rtC);
                seedCtx2.Rooms.Add(new Room { Id = roomCId, TenantId = tenant2Id, PropertyId = branchCId, RoomTypeId = rtC.Id, RoomNumber = "301", Floor = 3, Status = RoomStatus.Clean });
                seedCtx2.AccessRoles.Add(new AccessRole { Id = roleId2, TenantId = tenant2Id, Name = "Staff", Code = "STF2" });
                seedCtx2.Users.Add(new User { Id = userCId, Username = "staff_c", Email = "staff_c@t2.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "Staff C", IsActive = true, GlobalRole = GlobalUserRole.Customer });
                seedCtx2.TenantStaffMembers.Add(new TenantStaff { Id = Guid.NewGuid(), TenantId = tenant2Id, UserId = userCId, RoleId = roleId2, PropertyId = branchCId, StaffRole = StaffRole.Receptionist, IsActive = true });

                await seedCtx2.SaveChangesAsync();
            }

            // Disable automatic timer loop in factory so we invoke the exact registered ExpiredHoldSweepBackgroundService deterministically
            // AFTER all 3 SignalR WebSocket connections complete JoinProperty
            await using var factory = new HoldExpiredTestWebApplicationFactory(baseConnStr, testSchema, disableBackgroundSweepHost: true);
            var httpClient = factory.CreateClient();

            var tokenA = await LoginAndSwitchContextAsync(httpClient, "staff_a@t1.com", "P@ssword123!", branchAId);
            var tokenB = await LoginAndSwitchContextAsync(httpClient, "staff_b@t1.com", "P@ssword123!", branchBId);
            var tokenC = await LoginAndSwitchContextAsync(httpClient, "staff_c@t2.com", "P@ssword123!", branchCId);

            using var wsA = await ConnectAndJoinPropertyAsync(factory.Server, tokenA, branchAId);
            using var wsB = await ConnectAndJoinPropertyAsync(factory.Server, tokenB, branchBId);
            using var wsC = await ConnectAndJoinPropertyAsync(factory.Server, tokenC, branchCId);

            // Seed expired, active, and confirmed reservations across Tenant 1 Branch A and Tenant 2 Branch C
            var expiredResAId = Guid.NewGuid();
            var expiredResCId = Guid.NewGuid();

            await using (var seedResCtx1 = CreateSeedDbContext(baseConnStr, testSchema, tenant1Id, branchAId))
            {
                seedResCtx1.Reservations.AddRange(
                    new Reservation
                    {
                        Id = expiredResAId,
                        TenantId = tenant1Id,
                        PropertyId = branchAId,
                        RoomId = roomAId,
                        ConfirmationCode = "RES-EXP-A1",
                        GuestName = "Expired Guest A",
                        Status = ReservationStatus.PendingPayment,
                        CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                        CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                        TotalAmount = 1000000m,
                        Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                        {
                            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                            IsOnlineHold = true,
                            RoomTypeName = "Deluxe A"
                        }),
                        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
                    },
                    new Reservation
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant1Id,
                        PropertyId = branchAId,
                        RoomId = roomAId,
                        ConfirmationCode = "RES-FUT-A2",
                        GuestName = "Future Hold Guest A",
                        Status = ReservationStatus.PendingPayment,
                        CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                        CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
                        TotalAmount = 1000000m,
                        Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                        {
                            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(10),
                            IsOnlineHold = true,
                            RoomTypeName = "Deluxe A"
                        }),
                        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
                    },
                    new Reservation
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant1Id,
                        PropertyId = branchAId,
                        RoomId = roomAId,
                        ConfirmationCode = "RES-PAID-A3",
                        GuestName = "Paid Guest A",
                        Status = ReservationStatus.Confirmed,
                        CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
                        CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)),
                        TotalAmount = 1000000m,
                        Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                        {
                            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-8),
                            IsOnlineHold = true,
                            RoomTypeName = "Deluxe A"
                        }),
                        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-23)
                    });
                await seedResCtx1.SaveChangesAsync();
            }

            await using (var seedResCtx2 = CreateSeedDbContext(baseConnStr, testSchema, tenant2Id, branchCId))
            {
                seedResCtx2.Reservations.Add(new Reservation
                {
                    Id = expiredResCId,
                    TenantId = tenant2Id,
                    PropertyId = branchCId,
                    RoomId = roomCId,
                    ConfirmationCode = "RES-EXP-C1",
                    GuestName = "Expired Guest C",
                    Status = ReservationStatus.PendingPayment,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    TotalAmount = 1800000m,
                    Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                    {
                        HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-4),
                        IsOnlineHold = true,
                        RoomTypeName = "Suite C"
                    }),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-19)
                });
                await seedResCtx2.SaveChangesAsync();
            }

            // Instantiate the real production ExpiredHoldSweepBackgroundService with WebApplicationFactory's IServiceScopeFactory
            var sweepService = ActivatorUtilities.CreateInstance<ExpiredHoldSweepBackgroundService>(factory.Services);
            var sweptFirstRun = await sweepService.ExecuteSweepIterationAsync(CancellationToken.None);
            Assert.Equal(2, sweptFirstRun);

            // Second consecutive sweep must produce 0 events (idempotency + zero duplicate)
            var sweptSecondRun = await sweepService.ExecuteSweepIterationAsync(CancellationToken.None);
            Assert.Equal(0, sweptSecondRun);

            // Collect SignalR ReceiveHoldExpired invocations across all 3 live WebSocket clients
            var eventsA = await DrainHoldExpiredFramesAsync(wsA, TimeSpan.FromMilliseconds(400));
            var eventsB = await DrainHoldExpiredFramesAsync(wsB, TimeSpan.FromMilliseconds(250));
            var eventsC = await DrainHoldExpiredFramesAsync(wsC, TimeSpan.FromMilliseconds(400));

            Assert.Single(eventsA);
            Assert.Equal("RES-EXP-A1", eventsA[0].GetProperty("confirmationCode").GetString());
            Assert.Equal("evt-holdexp-RES-EXP-A1", eventsA[0].GetProperty("eventId").GetString());
            Assert.Equal(branchAId.ToString(), eventsA[0].GetProperty("propertyId").GetString());

            Assert.Empty(eventsB);

            Assert.Single(eventsC);
            Assert.Equal("RES-EXP-C1", eventsC[0].GetProperty("confirmationCode").GetString());
            Assert.Equal("evt-holdexp-RES-EXP-C1", eventsC[0].GetProperty("eventId").GetString());
            Assert.Equal(branchCId.ToString(), eventsC[0].GetProperty("propertyId").GetString());

            // Verify PostgreSQL committed claim, notification timestamp, and AuditLog with real interceptors intact
            await using (var verifyCtx1 = CreateSeedDbContext(baseConnStr, testSchema, tenant1Id, branchAId))
            {
                var resA = await verifyCtx1.Reservations.AsNoTracking().FirstAsync(r => r.Id == expiredResAId);
                var snapA = ReservationSnapshotHelper.TryDeserialize(resA.Notes);
                Assert.NotNull(snapA);
                Assert.NotNull(snapA.HoldExpiredClaimedAtUtc);
                Assert.NotNull(snapA.HoldExpiredNotifiedAtUtc);
                Assert.Null(snapA.HoldExpiredDispatchLeaseUntilUtc);
                Assert.Equal(1, snapA.HoldExpiredDispatchAttemptCount);

                var auditExists = await verifyCtx1.AuditLogs.AsNoTracking()
                    .AnyAsync(a => a.EntityId == expiredResAId && a.TenantId == tenant1Id && a.PropertyId == branchAId);
                Assert.True(auditExists);
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
    public async Task PublicBookingLookup_GetByToken_OnExpiredHold_IsPureReadOnly_WithZeroSideEffectsAndZeroDispatch()
    {
        var baseConnStr = GetConnectionString();
        var testSchema = $"p6_lookup_ro_{Guid.NewGuid():N}";

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
            var roomId = Guid.NewGuid();
            var staffUserId = Guid.NewGuid();
            var resId = Guid.NewGuid();
            const string lookupToken = "tok_public_expired_ro_pipeline_12345";

            await using (var seedCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId))
            {
                await seedCtx.Database.MigrateAsync();

                var roleId = Guid.NewGuid();
                var hasher = new PasswordHasherService();
                seedCtx.Tenants.Add(new Tenant
                {
                    Id = tenantId,
                    Name = "RO Lookup Hotel",
                    Code = "ROHT",
                    Slug = "ro-hotel",
                    Address = "10 Bach Dang",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                });
                seedCtx.Properties.Add(new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "RO Branch",
                    Code = "ROB",
                    Slug = "ro-branch",
                    Address = "10 Bach Dang",
                    City = "Da Nang",
                    Status = PropertyStatus.Active
                });
                var rt = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, Name = "Ocean Room", Code = "OCN", BasePrice = 1200000m, MaxOccupancy = 2 };
                seedCtx.RoomTypes.Add(rt);
                seedCtx.Rooms.Add(new Room { Id = roomId, TenantId = tenantId, PropertyId = propId, RoomTypeId = rt.Id, RoomNumber = "501", Floor = 5, Status = RoomStatus.Clean });
                seedCtx.AccessRoles.Add(new AccessRole { Id = roleId, TenantId = tenantId, Name = "Staff", Code = "STF" });
                seedCtx.Users.Add(new User { Id = staffUserId, Username = "staff_ro", Email = "staff@ro.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "Staff RO", IsActive = true, GlobalRole = GlobalUserRole.Customer });
                seedCtx.TenantStaffMembers.Add(new TenantStaff { Id = Guid.NewGuid(), TenantId = tenantId, UserId = staffUserId, RoleId = roleId, PropertyId = propId, StaffRole = StaffRole.Receptionist, IsActive = true });

                seedCtx.Reservations.Add(new Reservation
                {
                    Id = resId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomId = roomId,
                    ConfirmationCode = "RES-RO-EXP1",
                    GuestName = "Public Guest",
                    GuestEmail = "public_guest@example.com",
                    GuestPhone = "0905123456",
                    Status = ReservationStatus.PendingPayment,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                    TotalAmount = 1200000m,
                    Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                    {
                        RoomTypeId = rt.Id,
                        RoomTypeName = "Ocean Room",
                        TotalAmount = 1200000m,
                        HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-10),
                        LookupToken = lookupToken,
                        TokenExpiresAtUtc = DateTime.UtcNow.AddDays(3),
                        IsOnlineHold = true,
                        HoldExpiredNotifiedAtUtc = null
                    }),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-25)
                });

                await seedCtx.SaveChangesAsync();
            }

            await using var factory = new HoldExpiredTestWebApplicationFactory(baseConnStr, testSchema, disableBackgroundSweepHost: true);
            var httpClient = factory.CreateClient();

            var token = await LoginAndSwitchContextAsync(httpClient, "staff@ro.com", "P@ssword123!", propId);
            using var ws = await ConnectAndJoinPropertyAsync(factory.Server, token, propId);

            int auditCountBefore;
            await using (var auditCheckBefore = CreateSeedDbContext(baseConnStr, testSchema, tenantId, propId))
            {
                auditCountBefore = await auditCheckBefore.AuditLogs.AsNoTracking().CountAsync();
            }

            // Anonymous HTTP GET lookup (no Bearer token) using both LookupToken and ConfirmationCode
            using var anonClient = factory.CreateClient();
            foreach (var lookupKey in new[] { lookupToken, lookupToken, "RES-RO-EXP1" })
            {
                var getResp = await anonClient.GetAsync($"/api/public/bookings/{lookupKey}");
                Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);
                var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
                Assert.Equal("Expired", body.GetProperty("status").GetString());
                Assert.Equal(0, body.GetProperty("secondsRemaining").GetInt32());
                Assert.Equal("RES-RO-EXP1", body.GetProperty("confirmationCode").GetString());
            }

            // GET query must NEVER emit SignalR or write to database/audit logs without tenant context
            var emittedDuringGet = await DrainHoldExpiredFramesAsync(ws, TimeSpan.FromMilliseconds(250));
            Assert.Empty(emittedDuringGet);

            await using var verifyCtx = CreateSeedDbContext(baseConnStr, testSchema, tenantId, propId);
            var res = await verifyCtx.Reservations.AsNoTracking().FirstAsync(r => r.Id == resId);
            var snap = ReservationSnapshotHelper.TryDeserialize(res.Notes);
            Assert.NotNull(snap);
            Assert.Null(snap.HoldExpiredNotifiedAtUtc);
            Assert.Null(snap.HoldExpiredClaimedAtUtc);
            Assert.Equal(0, snap.HoldExpiredDispatchAttemptCount);
            Assert.Equal(auditCountBefore, await verifyCtx.AuditLogs.AsNoTracking().CountAsync());
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task ExpiredHoldSweepBackgroundService_TwoConcurrentWorkers_AndSuspendedTenantInactivePropertyIsolation_E2E()
    {
        var baseConnStr = GetConnectionString();
        var testSchema = $"p6_holdexp_conc_{Guid.NewGuid():N}";

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var t1ActiveId = Guid.NewGuid();
            var b1AId = Guid.NewGuid();
            var b1BId = Guid.NewGuid();
            var room1AId = Guid.NewGuid();
            var room1BId = Guid.NewGuid();
            var staff1AId = Guid.NewGuid();
            var staff1BId = Guid.NewGuid();

            var t2SuspendedId = Guid.NewGuid();
            var b2Id = Guid.NewGuid();
            var room2Id = Guid.NewGuid();

            var t3ActiveId = Guid.NewGuid();
            var b3InactiveId = Guid.NewGuid();
            var room3Id = Guid.NewGuid();

            var resActiveId = Guid.NewGuid();
            var resSuspendedTenantId = Guid.NewGuid();
            var resInactivePropertyId = Guid.NewGuid();
            var hasher = new PasswordHasherService();

            await using (var seed1 = CreateSeedDbContext(baseConnStr, testSchema, t1ActiveId))
            {
                await seed1.Database.MigrateAsync();

                var roleId = Guid.NewGuid();
                seed1.Tenants.Add(new Tenant
                {
                    Id = t1ActiveId,
                    Name = "Active Tenant 1",
                    Code = "AT1C",
                    Slug = "at1c",
                    Address = "1 Le Loi",
                    City = "HCM",
                    Status = TenantStatus.Active
                });
                seed1.Properties.AddRange(
                    new Property
                    {
                        Id = b1AId,
                        TenantId = t1ActiveId,
                        Name = "Branch 1A",
                        Code = "B1AC",
                        Slug = "b1ac",
                        Address = "1 Le Loi",
                        City = "HCM",
                        Status = PropertyStatus.Active
                    },
                    new Property
                    {
                        Id = b1BId,
                        TenantId = t1ActiveId,
                        Name = "Branch 1B",
                        Code = "B1BC",
                        Slug = "b1bc",
                        Address = "2 Le Loi",
                        City = "HCM",
                        Status = PropertyStatus.Active
                    });
                var rt1A = new RoomType { Id = Guid.NewGuid(), TenantId = t1ActiveId, PropertyId = b1AId, Name = "DLX 1A", Code = "D1A", BasePrice = 1000000m, MaxOccupancy = 2 };
                var rt1B = new RoomType { Id = Guid.NewGuid(), TenantId = t1ActiveId, PropertyId = b1BId, Name = "DLX 1B", Code = "D1B", BasePrice = 1000000m, MaxOccupancy = 2 };
                seed1.RoomTypes.AddRange(rt1A, rt1B);
                seed1.Rooms.AddRange(
                    new Room { Id = room1AId, TenantId = t1ActiveId, PropertyId = b1AId, RoomTypeId = rt1A.Id, RoomNumber = "101", Floor = 1, Status = RoomStatus.Clean },
                    new Room { Id = room1BId, TenantId = t1ActiveId, PropertyId = b1BId, RoomTypeId = rt1B.Id, RoomNumber = "201", Floor = 2, Status = RoomStatus.Clean });
                seed1.AccessRoles.Add(new AccessRole { Id = roleId, TenantId = t1ActiveId, Name = "Staff", Code = "STF" });
                seed1.Users.AddRange(
                    new User { Id = staff1AId, Username = "st1a", Email = "st1a@conc.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "St 1A", IsActive = true, GlobalRole = GlobalUserRole.Customer },
                    new User { Id = staff1BId, Username = "st1b", Email = "st1b@conc.com", PasswordHash = hasher.Hash("P@ssword123!"), FullName = "St 1B", IsActive = true, GlobalRole = GlobalUserRole.Customer });
                seed1.TenantStaffMembers.AddRange(
                    new TenantStaff { Id = Guid.NewGuid(), TenantId = t1ActiveId, UserId = staff1AId, RoleId = roleId, PropertyId = b1AId, StaffRole = StaffRole.Receptionist, IsActive = true },
                    new TenantStaff { Id = Guid.NewGuid(), TenantId = t1ActiveId, UserId = staff1BId, RoleId = roleId, PropertyId = b1BId, StaffRole = StaffRole.Receptionist, IsActive = true });
                seed1.Reservations.Add(new Reservation
                {
                    Id = resActiveId,
                    TenantId = t1ActiveId,
                    PropertyId = b1AId,
                    RoomId = room1AId,
                    ConfirmationCode = "RES-CONC-ACTIVE-1A",
                    GuestName = "Conc Guest",
                    Status = ReservationStatus.PendingPayment,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    TotalAmount = 1000000m,
                    Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                    {
                        HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                        IsOnlineHold = true,
                        RoomTypeName = "DLX 1A"
                    }),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
                });
                await seed1.SaveChangesAsync();
            }

            await using (var seed2 = CreateSeedDbContext(baseConnStr, testSchema, t2SuspendedId, b2Id))
            {
                seed2.Tenants.Add(new Tenant
                {
                    Id = t2SuspendedId,
                    Name = "Suspended Tenant 2",
                    Code = "ST2C",
                    Slug = "st2c",
                    Address = "99 Tran Phu",
                    City = "Da Nang",
                    Status = TenantStatus.Suspended
                });
                seed2.Properties.Add(new Property
                {
                    Id = b2Id,
                    TenantId = t2SuspendedId,
                    Name = "Property in Suspended Tenant",
                    Code = "B2SC",
                    Slug = "b2sc",
                    Address = "99 Tran Phu",
                    City = "Da Nang",
                    Status = PropertyStatus.Active
                });
                var rt2 = new RoomType { Id = Guid.NewGuid(), TenantId = t2SuspendedId, PropertyId = b2Id, Name = "DLX 2", Code = "D2", BasePrice = 1000000m, MaxOccupancy = 2 };
                seed2.RoomTypes.Add(rt2);
                seed2.Rooms.Add(new Room { Id = room2Id, TenantId = t2SuspendedId, PropertyId = b2Id, RoomTypeId = rt2.Id, RoomNumber = "301", Floor = 3, Status = RoomStatus.Clean });
                seed2.Reservations.Add(new Reservation
                {
                    Id = resSuspendedTenantId,
                    TenantId = t2SuspendedId,
                    PropertyId = b2Id,
                    RoomId = room2Id,
                    ConfirmationCode = "RES-SUSPENDED-T2",
                    GuestName = "Suspended Guest",
                    Status = ReservationStatus.PendingPayment,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    TotalAmount = 1000000m,
                    Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                    {
                        HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-6),
                        IsOnlineHold = true,
                        RoomTypeName = "DLX 2"
                    }),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-21)
                });
                await seed2.SaveChangesAsync();
            }

            await using (var seed3 = CreateSeedDbContext(baseConnStr, testSchema, t3ActiveId, b3InactiveId))
            {
                seed3.Tenants.Add(new Tenant
                {
                    Id = t3ActiveId,
                    Name = "Active Tenant 3",
                    Code = "AT3C",
                    Slug = "at3c",
                    Address = "50 Hai Ba Trung",
                    City = "Ha Noi",
                    Status = TenantStatus.Active
                });
                seed3.Properties.Add(new Property
                {
                    Id = b3InactiveId,
                    TenantId = t3ActiveId,
                    Name = "Inactive Property 3",
                    Code = "B3IC",
                    Slug = "b3ic",
                    Address = "50 Hai Ba Trung",
                    City = "Ha Noi",
                    Status = PropertyStatus.Inactive
                });
                var rt3 = new RoomType { Id = Guid.NewGuid(), TenantId = t3ActiveId, PropertyId = b3InactiveId, Name = "DLX 3", Code = "D3", BasePrice = 1000000m, MaxOccupancy = 2 };
                seed3.RoomTypes.Add(rt3);
                seed3.Rooms.Add(new Room { Id = room3Id, TenantId = t3ActiveId, PropertyId = b3InactiveId, RoomTypeId = rt3.Id, RoomNumber = "401", Floor = 4, Status = RoomStatus.Clean });
                seed3.Reservations.Add(new Reservation
                {
                    Id = resInactivePropertyId,
                    TenantId = t3ActiveId,
                    PropertyId = b3InactiveId,
                    RoomId = room3Id,
                    ConfirmationCode = "RES-INACTIVE-P3",
                    GuestName = "Inactive Prop Guest",
                    Status = ReservationStatus.PendingPayment,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    TotalAmount = 1000000m,
                    Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
                    {
                        HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-7),
                        IsOnlineHold = true,
                        RoomTypeName = "DLX 3"
                    }),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-22)
                });
                await seed3.SaveChangesAsync();
            }

            await using var factory = new HoldExpiredTestWebApplicationFactory(baseConnStr, testSchema, disableBackgroundSweepHost: true);
            var httpClient = factory.CreateClient();

            var token1A = await LoginAndSwitchContextAsync(httpClient, "st1a@conc.com", "P@ssword123!", b1AId);
            var token1B = await LoginAndSwitchContextAsync(httpClient, "st1b@conc.com", "P@ssword123!", b1BId);

            using var ws1A = await ConnectAndJoinPropertyAsync(factory.Server, token1A, b1AId);
            using var ws1B = await ConnectAndJoinPropertyAsync(factory.Server, token1B, b1BId);

            // Spawn 2 separate ExpiredHoldSweepBackgroundService instances racing on the same PostgreSQL DB
            var worker1 = ActivatorUtilities.CreateInstance<ExpiredHoldSweepBackgroundService>(factory.Services);
            var worker2 = ActivatorUtilities.CreateInstance<ExpiredHoldSweepBackgroundService>(factory.Services);

            using var gate = new ManualResetEventSlim(false);
            async Task<int> RunConcurrentWorkerAsync(ExpiredHoldSweepBackgroundService w)
            {
                await Task.Run(() => gate.Wait());
                return await w.ExecuteSweepIterationAsync(CancellationToken.None);
            }

            var t1 = RunConcurrentWorkerAsync(worker1);
            var t2 = RunConcurrentWorkerAsync(worker2);
            gate.Set();
            var counts = await Task.WhenAll(t1, t2);

            Assert.Equal(1, counts[0] + counts[1]);

            var events1A = await DrainHoldExpiredFramesAsync(ws1A, TimeSpan.FromMilliseconds(450));
            var events1B = await DrainHoldExpiredFramesAsync(ws1B, TimeSpan.FromMilliseconds(250));

            Assert.Single(events1A);
            Assert.Equal("RES-CONC-ACTIVE-1A", events1A[0].GetProperty("confirmationCode").GetString());
            Assert.Equal(b1AId.ToString(), events1A[0].GetProperty("propertyId").GetString());
            Assert.Empty(events1B);

            // Suspended Tenant and Inactive Property holds must remain completely untouched
            await using var verifySuspCtx = CreateSeedDbContext(baseConnStr, testSchema, t2SuspendedId, b2Id);
            var suspRow = await verifySuspCtx.Reservations.IgnoreQueryFilters().AsNoTracking().FirstAsync(r => r.Id == resSuspendedTenantId);
            var suspSnap = ReservationSnapshotHelper.TryDeserialize(suspRow.Notes)!;
            Assert.Null(suspSnap.HoldExpiredClaimedAtUtc);
            Assert.Null(suspSnap.HoldExpiredNotifiedAtUtc);
            Assert.Equal(0, suspSnap.HoldExpiredDispatchAttemptCount);

            await using var verifyInactCtx = CreateSeedDbContext(baseConnStr, testSchema, t3ActiveId, b3InactiveId);
            var inactRow = await verifyInactCtx.Reservations.IgnoreQueryFilters().AsNoTracking().FirstAsync(r => r.Id == resInactivePropertyId);
            var inactSnap = ReservationSnapshotHelper.TryDeserialize(inactRow.Notes)!;
            Assert.Null(inactSnap.HoldExpiredClaimedAtUtc);
            Assert.Null(inactSnap.HoldExpiredNotifiedAtUtc);
            Assert.Equal(0, inactSnap.HoldExpiredDispatchAttemptCount);
        }
        finally
        {
            await using var cleanCmd = conn.CreateCommand();
            cleanCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }

    private static async Task<string> LoginAndSwitchContextAsync(HttpClient client, string email, string password, Guid propertyId)
    {
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
        var loginToken = (await loginResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("accessToken").GetString()!;

        using var switchReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/switch-context")
        {
            Content = JsonContent.Create(new { propertyId })
        };
        switchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginToken);
        var switchResp = await client.SendAsync(switchReq);
        Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);
        return (await switchResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("data").GetProperty("accessToken").GetString()!;
    }

    private static async Task<WebSocket> ConnectAndJoinPropertyAsync(TestServer server, string jwtToken, Guid propertyId)
    {
        var wsClient = server.CreateWebSocketClient();
        wsClient.ConfigureRequest = req =>
        {
            req.Headers["Authorization"] = $"Bearer {jwtToken}";
        };

        var ws = await wsClient.ConnectAsync(new Uri($"ws://localhost/hubs/notifications?access_token={Uri.EscapeDataString(jwtToken)}"), CancellationToken.None);

        // SignalR JSON Hub handshake
        await SendFrameAsync(ws, "{\"protocol\":\"json\",\"version\":1}");
        var handshakeAck = await ReceiveSingleFrameAsync(ws, TimeSpan.FromSeconds(5));
        Assert.NotNull(handshakeAck);

        // Invoke JoinProperty
        await SendFrameAsync(ws, $"{{\"type\":1,\"invocationId\":\"join-1\",\"target\":\"JoinProperty\",\"arguments\":[\"{propertyId}\"]}}");
        var joinAck = await ReceiveSingleFrameAsync(ws, TimeSpan.FromSeconds(5));
        Assert.NotNull(joinAck);
        using var ackDoc = JsonDocument.Parse(joinAck!);
        Assert.Equal(3, ackDoc.RootElement.GetProperty("type").GetInt32());
        Assert.False(ackDoc.RootElement.TryGetProperty("error", out _), $"JoinProperty failed: {joinAck}");

        return ws;
    }

    private static async Task SendFrameAsync(WebSocket ws, string jsonPayload)
    {
        var bytes = Encoding.UTF8.GetBytes(jsonPayload + RecordSeparator);
        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, endOfMessage: true, CancellationToken.None);
    }

    private static async Task<string?> ReceiveSingleFrameAsync(WebSocket ws, TimeSpan timeout)
    {
        using var cts = new CancellationTokenSource(timeout);
        var buffer = new byte[8192];
        using var ms = new MemoryStream();

        try
        {
            while (true)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    return null;
                }

                ms.Write(buffer, 0, result.Count);
                if (result.EndOfMessage)
                {
                    var text = Encoding.UTF8.GetString(ms.ToArray()).TrimEnd(RecordSeparator);
                    return text;
                }
            }
        }
        catch (OperationCanceledException)
        {
            return null;
        }
    }

    private static async Task<List<JsonElement>> DrainHoldExpiredFramesAsync(WebSocket ws, TimeSpan waitWindow)
    {
        var list = new List<JsonElement>();
        var deadline = DateTime.UtcNow + waitWindow;

        while (DateTime.UtcNow < deadline)
        {
            var remaining = deadline - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero) break;

            var raw = await ReceiveSingleFrameAsync(ws, remaining);
            if (raw == null) break;

            foreach (var segment in raw.Split(RecordSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                using var doc = JsonDocument.Parse(segment);
                if (doc.RootElement.TryGetProperty("type", out var typeProp) &&
                    typeProp.GetInt32() == 1 &&
                    doc.RootElement.TryGetProperty("target", out var targetProp) &&
                    string.Equals(targetProp.GetString(), "ReceiveHoldExpired", StringComparison.Ordinal))
                {
                    var payload = doc.RootElement.GetProperty("arguments")[0].Clone();
                    list.Add(payload);
                }
            }
        }

        return list;
    }
}
