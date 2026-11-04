using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Audit;

/// <summary>
/// Comprehensive PostgreSQL integration and unit tests for T03-B Audit Log Query API.
/// Verifies RBAC (Owner/Manager allowed; Receptionist/Housekeeper/Customer/SuperAdmin blocked),
/// multi-tenant & multi-property isolation, nullable PropertyId policy, filtering, server-side pagination,
/// read-time sensitive field sanitization, and detail endpoint scope enforcement.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class T03B_AuditLogQueryTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
                   ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING");
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
                $"[CRITICAL SECURITY ALERT] Target database '{builder.Database}' is NOT an authorized test database!");
        }
    }

    private static async Task<NpgsqlConnection> CreateIsolatedSchemaAsync(string testSchema)
    {
        NpgsqlConnection.ClearAllPools();
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private static async Task DropIsolatedSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01b_test_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid test schema name '{testSchema}'.");
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
        NpgsqlConnection.ClearAllPools();
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "owner@luxestay.vn";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Owner;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public string? IpAddress { get; private set; } = "203.113.148.55";

        public void SetIpAddress(string? ipAddress) => IpAddress = ipAddress;
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }

        public void SetMembershipContext(
            Guid tenantId,
            TenantStatus tenantStatus,
            Guid? propertyId,
            PropertyStatus? propertyStatus,
            StaffRole? staffRole,
            Guid? roleId,
            bool isTenantWide)
        {
            TenantId = tenantId;
            TenantStatus = tenantStatus;
            PropertyId = propertyId;
            PropertyStatus = propertyStatus;
            StaffRole = staffRole;
            RoleId = roleId;
            IsTenantWide = isTenantWide;
        }
    }

    private sealed class ConfigurableMembershipLookupService : IMembershipLookupService
    {
        private readonly Func<Guid, Guid, Guid?, MembershipLookupResult> _resolver;

        public ConfigurableMembershipLookupService(Func<Guid, Guid, Guid?, MembershipLookupResult> resolver)
        {
            _resolver = resolver;
        }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_resolver(tenantId, userId, targetPropertyId));
        }

        public Task<IReadOnlyList<UserMembershipDto>> GetUserMembershipsAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<UserMembershipDto>>(Array.Empty<UserMembershipDto>());
        }
    }

    private static ApplicationDbContext CreateAuditedDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };

        var tenantInterceptor = new TenantPropertySaveChangesInterceptor(tenantService, propertyService);
        var auditInterceptor = new AuditSaveChangesInterceptor(tenantService, propertyService, userContext);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(tenantInterceptor, auditInterceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propertyService);
    }

    private sealed record SeededAuditScenario(
        Guid TenantAId,
        Guid TenantBId,
        Guid PropertyAId,
        Guid PropertyBId,
        Guid OwnerUserId,
        Guid ManagerAUserId,
        Guid ReceptionistAUserId,
        Guid HousekeeperAUserId,
        Guid CustomerUserId,
        Guid RateBranchAId,
        Guid RateBranchBId,
        Guid TenantLevelInvoiceLogId,
        Guid BranchACreateLogId,
        Guid BranchAUpdateLogId,
        Guid BranchBCreateLogId,
        Guid TenantBLogId);

    private static async Task<SeededAuditScenario> SeedAuditQueryScenarioAsync(string connString, string testSchema)
    {
        var tenantAId = Guid.NewGuid();
        var tenantBId = Guid.NewGuid();
        var propertyAId = Guid.NewGuid();
        var propertyBId = Guid.NewGuid();
        var propertyTenantBId = Guid.NewGuid();

        var ownerUserId = Guid.NewGuid();
        var managerAUserId = Guid.NewGuid();
        var receptionistAUserId = Guid.NewGuid();
        var housekeeperAUserId = Guid.NewGuid();
        var customerUserId = Guid.NewGuid();

        var rateBranchAId = Guid.NewGuid();
        var rateBranchBId = Guid.NewGuid();

        var tenantLevelInvoiceLogId = Guid.NewGuid();
        var branchACreateLogId = Guid.NewGuid();
        var branchAUpdateLogId = Guid.NewGuid();
        var branchBCreateLogId = Guid.NewGuid();
        var tenantBLogId = Guid.NewGuid();

        var tenantSvc = new StubTenantService { TenantId = tenantAId };
        var propSvc = new StubPropertyService { IsTenantWide = true };
        var userCtx = new StubUserContext { UserId = ownerUserId, TenantId = tenantAId, StaffRole = StaffRole.Owner };

        await using (var ctx = CreateAuditedDbContext(connString, testSchema, tenantSvc, propSvc, userCtx))
        {
            await ctx.Database.MigrateAsync();

            ctx.Tenants.AddRange(
                new Tenant
                {
                    Id = tenantAId,
                    Name = "LuxeStay Hospitality Group",
                    Code = "LSG-A",
                    Slug = $"luxestay-a-{tenantAId.ToString("N")[..6]}",
                    Address = "100 Nguyễn Huệ",
                    City = "Hồ Chí Minh",
                    Status = TenantStatus.Active
                },
                new Tenant
                {
                    Id = tenantBId,
                    Name = "Other Hotel Chain",
                    Code = "OHC-B",
                    Slug = $"other-b-{tenantBId.ToString("N")[..6]}",
                    Address = "200 Trần Phú",
                    City = "Nha Trang",
                    Status = TenantStatus.Active
                });

            ctx.Properties.AddRange(
                new Property
                {
                    Id = propertyAId,
                    TenantId = tenantAId,
                    Name = "LuxeStay Quận 1",
                    Code = "CN-Q1",
                    Slug = $"ls-q1-{propertyAId.ToString("N")[..6]}",
                    Address = "100 Nguyễn Huệ",
                    City = "Hồ Chí Minh",
                    Status = PropertyStatus.Active
                },
                new Property
                {
                    Id = propertyBId,
                    TenantId = tenantAId,
                    Name = "LuxeStay Đà Nẵng",
                    Code = "CN-DN",
                    Slug = $"ls-dn-{propertyBId.ToString("N")[..6]}",
                    Address = "200 Võ Nguyên Giáp",
                    City = "Đà Nẵng",
                    Status = PropertyStatus.Active
                });

            ctx.Users.AddRange(
                new User
                {
                    Id = ownerUserId,
                    Username = "owner.luxestay",
                    Email = "owner@luxestay.vn",
                    FullName = "Trần Trọng Chủ Tịch",
                    PasswordHash = "hashed_pw",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    IsActive = true
                },
                new User
                {
                    Id = managerAUserId,
                    Username = "manager.q1",
                    Email = "manager.q1@luxestay.vn",
                    FullName = "Nguyễn Quản Lý Q1",
                    PasswordHash = "hashed_pw",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    IsActive = true
                },
                new User
                {
                    Id = receptionistAUserId,
                    Username = "receptionist.q1",
                    Email = "letan.q1@luxestay.vn",
                    FullName = "Lê Lễ Tân",
                    PasswordHash = "hashed_pw",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    IsActive = true
                },
                new User
                {
                    Id = housekeeperAUserId,
                    Username = "housekeeper.q1",
                    Email = "buongphong.q1@luxestay.vn",
                    FullName = "Phạm Buồng Phòng",
                    PasswordHash = "hashed_pw",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    IsActive = true
                },
                new User
                {
                    Id = customerUserId,
                    Username = "customer.guest",
                    Email = "khachhang@gmail.com",
                    FullName = "Khách Hàng B2C",
                    PasswordHash = "hashed_pw",
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true
                });

            var baseTime = new DateTime(2026, 10, 29, 8, 0, 0, DateTimeKind.Utc);

            ctx.AuditLogs.AddRange(
                new AuditLog
                {
                    Id = branchACreateLogId,
                    TenantId = tenantAId,
                    PropertyId = propertyAId,
                    UserId = managerAUserId,
                    Action = AuditActions.Create,
                    EntityName = nameof(RoomTypeRate),
                    EntityId = rateBranchAId,
                    OldValues = null,
                    NewValues = "{\"NightlyPrice\":850000,\"FirstHours\":2,\"FirstHoursPrice\":300000,\"AdditionalHourPrice\":80000,\"Currency\":\"VND\",\"EffectiveFrom\":\"2026-11-01\",\"EffectiveTo\":\"2026-12-01\",\"IsActive\":true}",
                    IpAddress = "118.69.10.1",
                    CreatedAtUtc = baseTime.AddMinutes(10)
                },
                new AuditLog
                {
                    Id = branchAUpdateLogId,
                    TenantId = tenantAId,
                    PropertyId = propertyAId,
                    UserId = managerAUserId,
                    Action = AuditActions.Update,
                    EntityName = nameof(RoomTypeRate),
                    EntityId = rateBranchAId,
                    // Intentionally inject sensitive keys/tokens into raw DB payload to test read-time sanitizer
                    OldValues = "{\"NightlyPrice\":850000,\"ChangeReason\":\"Giá chuẩn\",\"GuestIdNumber\":\"079099001234\",\"PasswordHash\":\"$2a$11$secret\",\"SmartLockPin\":\"123456\"}",
                    NewValues = "{\"NightlyPrice\":950000,\"ChangeReason\":\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U\",\"GuestIdNumber\":\"079099009999\",\"PasswordHash\":\"$2a$11$newsecret\",\"SmartLockPin\":\"654321\"}",
                    IpAddress = "118.69.10.2",
                    CreatedAtUtc = baseTime.AddMinutes(20)
                },
                new AuditLog
                {
                    Id = branchBCreateLogId,
                    TenantId = tenantAId,
                    PropertyId = propertyBId,
                    UserId = ownerUserId,
                    Action = AuditActions.Create,
                    EntityName = nameof(PropertySurchargePolicy),
                    EntityId = rateBranchBId,
                    OldValues = null,
                    NewValues = "{\"SurchargeType\":\"EarlyCheckIn\",\"FromTime\":\"06:00:00\",\"ToTime\":\"09:00:00\",\"CalculationMethod\":\"PercentageOfNightly\",\"Percentage\":30,\"IsActive\":true}",
                    IpAddress = "14.161.20.5",
                    CreatedAtUtc = baseTime.AddMinutes(30)
                },
                new AuditLog
                {
                    Id = tenantLevelInvoiceLogId,
                    TenantId = tenantAId,
                    PropertyId = null, // Tenant-level log (nullable PropertyId)
                    UserId = ownerUserId,
                    Action = AuditActions.Delete,
                    EntityName = nameof(Invoice),
                    EntityId = Guid.NewGuid(),
                    OldValues = "{\"InvoiceNumber\":\"INV-2026-999\",\"GrandTotal\":2500000,\"GuestIdNumber\":\"079123456789\"}",
                    NewValues = null,
                    IpAddress = "14.161.20.5",
                    CreatedAtUtc = baseTime.AddMinutes(40)
                });

            await ctx.SaveChangesAsync();
        }

        // Seed Tenant B log under Tenant B context
        var tenantBSvc = new StubTenantService { TenantId = tenantBId };
        var userBCtx = new StubUserContext { UserId = Guid.NewGuid(), TenantId = tenantBId, StaffRole = StaffRole.Owner };
        await using (var ctxB = CreateAuditedDbContext(connString, testSchema, tenantBSvc, propSvc, userBCtx))
        {
            ctxB.Properties.Add(new Property
            {
                Id = propertyTenantBId,
                TenantId = tenantBId,
                Name = "Other Hotel Nha Trang",
                Code = "OH-NT",
                Slug = $"oh-nt-{propertyTenantBId.ToString("N")[..6]}",
                Address = "200 Trần Phú",
                City = "Nha Trang",
                Status = PropertyStatus.Active
            });

            ctxB.AuditLogs.Add(new AuditLog
            {
                Id = tenantBLogId,
                TenantId = tenantBId,
                PropertyId = propertyTenantBId,
                UserId = userBCtx.UserId,
                Action = AuditActions.Delete,
                EntityName = nameof(RoomTypeRate),
                EntityId = Guid.NewGuid(),
                OldValues = "{\"NightlyPrice\":1500000}",
                NewValues = null,
                IpAddress = "10.0.0.1",
                CreatedAtUtc = new DateTime(2026, 10, 29, 9, 0, 0, DateTimeKind.Utc)
            });

            await ctxB.SaveChangesAsync();
        }

        return new SeededAuditScenario(
            tenantAId,
            tenantBId,
            propertyAId,
            propertyBId,
            ownerUserId,
            managerAUserId,
            receptionistAUserId,
            housekeeperAUserId,
            customerUserId,
            rateBranchAId,
            rateBranchBId,
            tenantLevelInvoiceLogId,
            branchACreateLogId,
            branchAUpdateLogId,
            branchBCreateLogId,
            tenantBLogId);
    }

    // =========================================================================
    // SCENARIOS 1, 2, 5, 6: OWNER vs MANAGER SCOPE, TENANT & PROPERTY ISOLATION
    // =========================================================================

    [Fact]
    public async Task T03B_01_02_05_06_Owner_And_Manager_Scope_Isolation_And_NullablePropertyId_Policy()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var s = await SeedAuditQueryScenarioAsync(conn.ConnectionString, testSchema);

            var tenantSvc = new StubTenantService { TenantId = s.TenantAId };

            // 1. Owner (Tenant-Wide): Sees all 4 Tenant A logs (Branch A + Branch B + Tenant-level null PropertyId), NEVER Tenant B log
            var ownerPropSvc = new StubPropertyService { PropertyId = null, IsTenantWide = true };
            var ownerUserCtx = new StubUserContext
            {
                UserId = s.OwnerUserId,
                TenantId = s.TenantAId,
                StaffRole = StaffRole.Owner,
                IsTenantWide = true
            };
            var ownerMembershipSvc = new ConfigurableMembershipLookupService((_, _, targetProp) =>
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, targetProp, isTenantWide: true, Array.Empty<Guid>()));

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, ownerPropSvc, ownerUserCtx);
            var ownerHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, ownerPropSvc, ownerUserCtx, ownerMembershipSvc);

            var ownerResp = await ownerHandler.Handle(new GetAuditLogsQuery(Page: 1, PageSize: 20), CancellationToken.None);
            Assert.True(ownerResp.Success);
            Assert.NotNull(ownerResp.Data);
            Assert.Equal(4, ownerResp.Data!.TotalCount);

            // Sorted newest-first: tenantLevelInvoiceLogId (08:40), branchBCreateLogId (08:30), branchAUpdateLogId (08:20), branchACreateLogId (08:10)
            Assert.Equal(s.TenantLevelInvoiceLogId, ownerResp.Data.Items[0].Id);
            Assert.Null(ownerResp.Data.Items[0].PropertyId);
            Assert.Equal("Trần Trọng Chủ Tịch", ownerResp.Data.Items[0].UserFullName);

            Assert.Equal(s.BranchBCreateLogId, ownerResp.Data.Items[1].Id);
            Assert.Equal("LuxeStay Đà Nẵng", ownerResp.Data.Items[1].PropertyName);
            Assert.Equal("CN-DN", ownerResp.Data.Items[1].PropertyCode);

            Assert.Equal(s.BranchAUpdateLogId, ownerResp.Data.Items[2].Id);
            Assert.Equal("LuxeStay Quận 1", ownerResp.Data.Items[2].PropertyName);
            Assert.Equal("Nguyễn Quản Lý Q1", ownerResp.Data.Items[2].UserFullName);

            // Scenario 5: Zero cross-tenant leakage (Tenant B log is never returned)
            Assert.DoesNotContain(ownerResp.Data.Items, i => i.Id == s.TenantBLogId);
            Assert.All(ownerResp.Data.Items, i => Assert.Equal(s.TenantAId, i.TenantId));

            // 2. Branch-scoped Manager (Branch A only, IsTenantWide = false):
            // Sees ONLY the 2 logs of Branch A (does NOT see Branch B log and does NOT see tenant-level PropertyId == null log)
            var managerPropSvc = new StubPropertyService
            {
                PropertyId = s.PropertyAId,
                TokenPropertyId = s.PropertyAId,
                IsTenantWide = false
            };
            var managerUserCtx = new StubUserContext
            {
                UserId = s.ManagerAUserId,
                TenantId = s.TenantAId,
                PropertyId = s.PropertyAId,
                StaffRole = StaffRole.Manager,
                IsTenantWide = false
            };
            var managerMembershipSvc = new ConfigurableMembershipLookupService((_, _, targetProp) =>
            {
                if (targetProp == s.PropertyAId)
                {
                    return MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Manager, s.PropertyAId, isTenantWide: false, Array.Empty<Guid>());
                }
                return MembershipLookupResult.Failed(MembershipLookupStatus.PropertyForbidden, "Không có quyền truy cập chi nhánh này.");
            });

            var managerHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, managerPropSvc, managerUserCtx, managerMembershipSvc);
            var managerResp = await managerHandler.Handle(new GetAuditLogsQuery(Page: 1, PageSize: 20), CancellationToken.None);

            Assert.True(managerResp.Success);
            Assert.Equal(2, managerResp.Data!.TotalCount);
            Assert.All(managerResp.Data.Items, i => Assert.Equal(s.PropertyAId, i.PropertyId));
            Assert.DoesNotContain(managerResp.Data.Items, i => i.Id == s.BranchBCreateLogId);
            Assert.DoesNotContain(managerResp.Data.Items, i => i.Id == s.TenantLevelInvoiceLogId);

            // Scenario 6: Branch A Manager attempting to pass PropertyId = PropertyB is strictly forbidden
            var crossBranchEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                managerHandler.Handle(new GetAuditLogsQuery(PropertyId: s.PropertyBId), CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_FORBIDDEN", crossBranchEx.ErrorCode);

            // Client passing mismatched X-Property-Id header vs query parameter is rejected with ERR_CONTEXT_MISMATCH
            var mismatchedHeaderPropSvc = new StubPropertyService
            {
                PropertyId = s.PropertyAId,
                HeaderPropertyId = s.PropertyAId,
                IsTenantWide = true
            };
            var mismatchHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, mismatchedHeaderPropSvc, ownerUserCtx, ownerMembershipSvc);
            var headerEx = await Assert.ThrowsAsync<BadRequestException>(() =>
                mismatchHandler.Handle(new GetAuditLogsQuery(PropertyId: s.PropertyBId), CancellationToken.None));
            Assert.Equal("ERR_CONTEXT_MISMATCH", headerEx.ErrorCode);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 3 & 4: RBAC DENIAL FOR RECEPTIONIST, HOUSEKEEPER, CUSTOMER, SUPERADMIN
    // =========================================================================

    [Fact]
    public async Task T03B_03_04_Receptionist_Housekeeper_Customer_And_SuperAdmin_Are_Strictly_Denied()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var s = await SeedAuditQueryScenarioAsync(conn.ConnectionString, testSchema);
            var tenantSvc = new StubTenantService { TenantId = s.TenantAId };
            var propSvc = new StubPropertyService { PropertyId = s.PropertyAId, IsTenantWide = false };

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, new StubUserContext { TenantId = s.TenantAId });

            // 1. Receptionist -> Denied with ERR_FORBIDDEN on both List and Detail queries
            var receptionistCtx = new StubUserContext
            {
                UserId = s.ReceptionistAUserId,
                TenantId = s.TenantAId,
                PropertyId = s.PropertyAId,
                StaffRole = StaffRole.Receptionist,
                IsTenantWide = false
            };
            var receptionistMembership = new ConfigurableMembershipLookupService((_, _, _) =>
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Receptionist, s.PropertyAId, isTenantWide: false, Array.Empty<Guid>()));

            var recListHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, propSvc, receptionistCtx, receptionistMembership);
            var recEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                recListHandler.Handle(new GetAuditLogsQuery(PropertyId: s.PropertyAId), CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", recEx.ErrorCode);

            var recDetailHandler = new GetAuditLogByIdQueryHandler(ctx, tenantSvc, propSvc, receptionistCtx, receptionistMembership);
            var recDetailEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                recDetailHandler.Handle(new GetAuditLogByIdQuery(s.BranchACreateLogId, s.PropertyAId), CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", recDetailEx.ErrorCode);

            // 2. Housekeeper -> Denied with ERR_FORBIDDEN
            var housekeeperCtx = new StubUserContext
            {
                UserId = s.HousekeeperAUserId,
                TenantId = s.TenantAId,
                PropertyId = s.PropertyAId,
                StaffRole = StaffRole.Housekeeper,
                IsTenantWide = false
            };
            var housekeeperMembership = new ConfigurableMembershipLookupService((_, _, _) =>
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Housekeeper, s.PropertyAId, isTenantWide: false, Array.Empty<Guid>()));

            var hkHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, propSvc, housekeeperCtx, housekeeperMembership);
            var hkEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                hkHandler.Handle(new GetAuditLogsQuery(PropertyId: s.PropertyAId), CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", hkEx.ErrorCode);

            // 3. Customer -> Denied with ERR_FORBIDDEN
            var customerCtx = new StubUserContext
            {
                UserId = s.CustomerUserId,
                GlobalRole = GlobalUserRole.Customer,
                TenantId = s.TenantAId,
                StaffRole = null
            };
            var custHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, propSvc, customerCtx, receptionistMembership);
            var custEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                custHandler.Handle(new GetAuditLogsQuery(), CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", custEx.ErrorCode);

            // 4. SuperAdmin -> Denied from tenant business audit logs with ERR_FORBIDDEN
            var superAdminCtx = new StubUserContext
            {
                UserId = Guid.NewGuid(),
                GlobalRole = GlobalUserRole.SuperAdmin,
                TenantId = s.TenantAId
            };
            var saHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, propSvc, superAdminCtx, receptionistMembership);
            var saEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                saHandler.Handle(new GetAuditLogsQuery(), CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN", saEx.ErrorCode);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 7 & 8: FILTERING (DATE, ACTION, USER, ENTITY) & SERVER-SIDE PAGINATION
    // =========================================================================

    [Fact]
    public async Task T03B_07_08_Filtering_By_Date_Action_User_Entity_And_ServerSide_Pagination()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var s = await SeedAuditQueryScenarioAsync(conn.ConnectionString, testSchema);
            var tenantSvc = new StubTenantService { TenantId = s.TenantAId };
            var propSvc = new StubPropertyService { IsTenantWide = true };
            var userCtx = new StubUserContext { UserId = s.OwnerUserId, TenantId = s.TenantAId, StaffRole = StaffRole.Owner };
            var membershipSvc = new ConfigurableMembershipLookupService((_, _, targetProp) =>
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, targetProp, isTenantWide: true, Array.Empty<Guid>()));

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);
            var handler = new GetAuditLogsQueryHandler(ctx, tenantSvc, propSvc, userCtx, membershipSvc);

            // Filter by Action = "Update" (case-insensitive)
            var updateOnly = await handler.Handle(new GetAuditLogsQuery(Action: "update"), CancellationToken.None);
            Assert.Single(updateOnly.Data!.Items);
            Assert.Equal(s.BranchAUpdateLogId, updateOnly.Data.Items[0].Id);

            // Filter by UserId = ManagerAUserId -> returns exactly the 2 Branch A logs
            var managerLogs = await handler.Handle(new GetAuditLogsQuery(UserId: s.ManagerAUserId), CancellationToken.None);
            Assert.Equal(2, managerLogs.Data!.TotalCount);
            Assert.All(managerLogs.Data.Items, i => Assert.Equal(s.ManagerAUserId, i.UserId));

            // Filter by EntityName = "PropertySurchargePolicy"
            var surchargeLogs = await handler.Handle(new GetAuditLogsQuery(EntityName: nameof(PropertySurchargePolicy)), CancellationToken.None);
            Assert.Single(surchargeLogs.Data!.Items);
            Assert.Equal(s.BranchBCreateLogId, surchargeLogs.Data.Items[0].Id);

            // Filter by EntityId = RateBranchAId
            var entityIdLogs = await handler.Handle(new GetAuditLogsQuery(EntityId: s.RateBranchAId), CancellationToken.None);
            Assert.Equal(2, entityIdLogs.Data!.TotalCount);

            // Filter by Date Range [08:15 .. 08:35] -> returns branchBCreateLogId (08:30) and branchAUpdateLogId (08:20)
            var fromUtc = new DateTime(2026, 10, 29, 8, 15, 0, DateTimeKind.Utc);
            var toUtc = new DateTime(2026, 10, 29, 8, 35, 0, DateTimeKind.Utc);
            var dateFiltered = await handler.Handle(new GetAuditLogsQuery(FromUtc: fromUtc, ToUtc: toUtc), CancellationToken.None);
            Assert.Equal(2, dateFiltered.Data!.TotalCount);
            Assert.Equal(s.BranchBCreateLogId, dateFiltered.Data.Items[0].Id);
            Assert.Equal(s.BranchAUpdateLogId, dateFiltered.Data.Items[1].Id);

            // Scenario 8: Pagination (Total 4 logs, PageSize = 2 -> Page 1 has 2 items, Page 2 has 2 items)
            var page1 = await handler.Handle(new GetAuditLogsQuery(Page: 1, PageSize: 2), CancellationToken.None);
            var page2 = await handler.Handle(new GetAuditLogsQuery(Page: 2, PageSize: 2), CancellationToken.None);

            Assert.Equal(4, page1.Data!.TotalCount);
            Assert.Equal(2, page1.Data.TotalPages);
            Assert.False(page1.Data.HasPreviousPage);
            Assert.True(page1.Data.HasNextPage);
            Assert.Equal(2, page1.Data.Items.Count);

            Assert.Equal(4, page2.Data!.TotalCount);
            Assert.True(page2.Data.HasPreviousPage);
            Assert.False(page2.Data.HasNextPage);
            Assert.Equal(2, page2.Data.Items.Count);

            // Zero overlap between Page 1 and Page 2, and strictly ordered newest-first
            Assert.Empty(page1.Data.Items.Select(i => i.Id).Intersect(page2.Data.Items.Select(i => i.Id)));
            Assert.Equal(s.TenantLevelInvoiceLogId, page1.Data.Items[0].Id);
            Assert.Equal(s.BranchBCreateLogId, page1.Data.Items[1].Id);
            Assert.Equal(s.BranchAUpdateLogId, page2.Data.Items[0].Id);
            Assert.Equal(s.BranchACreateLogId, page2.Data.Items[1].Id);

            // Validator check: invalid Action or FromUtc > ToUtc fails validation
            var validator = new GetAuditLogsQueryValidator();
            var invalidActionResult = await validator.ValidateAsync(new GetAuditLogsQuery(Action: "DropTable"));
            Assert.False(invalidActionResult.IsValid);

            var invalidPageSizeResult = await validator.ValidateAsync(new GetAuditLogsQuery(PageSize: 500));
            Assert.False(invalidPageSizeResult.IsValid);

            var invalidDateResult = await validator.ValidateAsync(new GetAuditLogsQuery(FromUtc: toUtc, ToUtc: fromUtc));
            Assert.False(invalidDateResult.IsValid);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 9 & 10: SENSITIVE FIELD REDACTION & DETAIL ENDPOINT SCOPE ENFORCEMENT
    // =========================================================================

    [Fact]
    public async Task T03B_09_10_DetailEndpoint_EnforcesScope_And_SanitizesSensitiveDataInBothListAndDetail()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var s = await SeedAuditQueryScenarioAsync(conn.ConnectionString, testSchema);
            var tenantSvc = new StubTenantService { TenantId = s.TenantAId };
            var managerPropSvc = new StubPropertyService
            {
                PropertyId = s.PropertyAId,
                TokenPropertyId = s.PropertyAId,
                IsTenantWide = false
            };
            var managerUserCtx = new StubUserContext
            {
                UserId = s.ManagerAUserId,
                TenantId = s.TenantAId,
                PropertyId = s.PropertyAId,
                StaffRole = StaffRole.Manager,
                IsTenantWide = false
            };
            var managerMembershipSvc = new ConfigurableMembershipLookupService((_, _, targetProp) =>
            {
                if (targetProp == s.PropertyAId)
                {
                    return MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Manager, s.PropertyAId, isTenantWide: false, Array.Empty<Guid>());
                }
                return MembershipLookupResult.Failed(MembershipLookupStatus.PropertyForbidden, "Không có quyền truy cập chi nhánh này.");
            });

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, managerPropSvc, managerUserCtx);
            var listHandler = new GetAuditLogsQueryHandler(ctx, tenantSvc, managerPropSvc, managerUserCtx, managerMembershipSvc);
            var detailHandler = new GetAuditLogByIdQueryHandler(ctx, tenantSvc, managerPropSvc, managerUserCtx, managerMembershipSvc);

            // 1. Verify List response for Branch A Update log strips GuestIdNumber, PasswordHash, SmartLockPin, and redacts Bearer JWT
            var listResp = await listHandler.Handle(new GetAuditLogsQuery(Action: AuditActions.Update), CancellationToken.None);
            var listItem = Assert.Single(listResp.Data!.Items);
            Assert.DoesNotContain("GuestIdNumber", listItem.ChangedFields);
            Assert.DoesNotContain("PasswordHash", listItem.ChangedFields);
            Assert.DoesNotContain("SmartLockPin", listItem.ChangedFields);
            Assert.DoesNotContain("079099001234", listItem.ChangeSummary);
            Assert.DoesNotContain("$2a$11$secret", listItem.ChangeSummary);
            Assert.DoesNotContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", listItem.ChangeSummary);
            Assert.Contains("NightlyPrice: 850000 -> 950000", listItem.ChangeSummary);
            Assert.Contains("[REDACTED]", listItem.ChangeSummary);

            // 2. Verify Detail response for Branch A Update log (authorized for Branch A Manager)
            var detailResp = await detailHandler.Handle(new GetAuditLogByIdQuery(s.BranchAUpdateLogId, s.PropertyAId), CancellationToken.None);
            Assert.True(detailResp.Success);
            var detail = detailResp.Data!;
            Assert.Equal(s.BranchAUpdateLogId, detail.Id);
            Assert.Equal(s.PropertyAId, detail.PropertyId);
            Assert.Equal("LuxeStay Quận 1", detail.PropertyName);
            Assert.Equal("Nguyễn Quản Lý Q1", detail.UserFullName);
            Assert.Equal("118.69.10.2", detail.IpAddress);
            Assert.NotNull(detail.OldValues);
            Assert.NotNull(detail.NewValues);

            // Sensitive fields MUST be completely absent from OldValues, NewValues, ChangedFields, and Changes
            Assert.DoesNotContain("GuestIdNumber", detail.OldValues!);
            Assert.DoesNotContain("GuestIdNumber", detail.NewValues!);
            Assert.DoesNotContain("079099001234", detail.OldValues!);
            Assert.DoesNotContain("PasswordHash", detail.OldValues!);
            Assert.DoesNotContain("SmartLockPin", detail.OldValues!);
            Assert.DoesNotContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", detail.NewValues!);
            Assert.Contains("[REDACTED]", detail.NewValues!);
            Assert.DoesNotContain(detail.Changes, c => c.FieldName is "GuestIdNumber" or "PasswordHash" or "SmartLockPin");

            var nightlyChange = Assert.Single(detail.Changes, c => c.FieldName == nameof(RoomTypeRate.NightlyPrice));
            Assert.Equal("850000", nightlyChange.OldValue);
            Assert.Equal("950000", nightlyChange.NewValue);

            // 3. Scenario 10: Branch A Manager cannot access Branch B log detail -> ForbiddenException (ERR_PROPERTY_FORBIDDEN)
            var crossBranchDetailEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                detailHandler.Handle(new GetAuditLogByIdQuery(s.BranchBCreateLogId), CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_FORBIDDEN", crossBranchDetailEx.ErrorCode);

            // 4. Scenario 10: Branch A Manager cannot access tenant-level log (PropertyId == null) -> ForbiddenException (ERR_PROPERTY_FORBIDDEN)
            var tenantLevelDetailEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                detailHandler.Handle(new GetAuditLogByIdQuery(s.TenantLevelInvoiceLogId), CancellationToken.None));
            Assert.Equal("ERR_PROPERTY_FORBIDDEN", tenantLevelDetailEx.ErrorCode);

            // 5. Scenario 5 & 10: Accessing Tenant B log ID from Tenant A context returns NotFoundException (no cross-tenant probing)
            var ownerPropSvc = new StubPropertyService { IsTenantWide = true };
            var ownerUserCtx = new StubUserContext { UserId = s.OwnerUserId, TenantId = s.TenantAId, StaffRole = StaffRole.Owner };
            var ownerMembershipSvc = new ConfigurableMembershipLookupService((_, _, targetProp) =>
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, targetProp, isTenantWide: true, Array.Empty<Guid>()));
            var ownerDetailHandler = new GetAuditLogByIdQueryHandler(ctx, tenantSvc, ownerPropSvc, ownerUserCtx, ownerMembershipSvc);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                ownerDetailHandler.Handle(new GetAuditLogByIdQuery(s.TenantBLogId), CancellationToken.None));
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }
}
