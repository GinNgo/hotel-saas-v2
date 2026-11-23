using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RegisterPartner;
using HotelSaas.Application.Auth.Commands.SwitchContext;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Auth.Queries.GetMyMemberships;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.Commands.CreateProperty;
using HotelSaas.Application.Staff.Commands.CreateStaffMember;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Isolation;

[Collection("RealDatabaseTests")]
public sealed class MultiTenantSaaSRbacFlowTests
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

    private sealed class MutableTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MutablePropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class MutableUserContext : ICurrentUserContext
    {
        private readonly ICurrentTenantService _tenantService;
        private readonly ICurrentPropertyService _propertyService;

        public MutableUserContext(ICurrentTenantService tenantService, ICurrentPropertyService propertyService)
        {
            _tenantService = tenantService;
            _propertyService = propertyService;
        }

        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId => _tenantService.TenantId;
        public TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId => _propertyService.PropertyId;
        public PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; }
        public Guid? RoleId { get; set; }
        public bool IsTenantWide => _propertyService.IsTenantWide;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds => _propertyService.ExcludedPropertyIds;

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
            _tenantService.TenantId = tenantId;
            TenantStatus = tenantStatus;
            _propertyService.PropertyId = propertyId;
            PropertyStatus = propertyStatus;
            StaffRole = staffRole;
            RoleId = roleId;
            _propertyService.IsTenantWide = isTenantWide;
        }
    }

    private static string BuildSchemaConnectionString(string baseConnStr, string schema)
    {
        return new NpgsqlConnectionStringBuilder(baseConnStr)
        {
            SearchPath = schema,
            Pooling = false
        }.ConnectionString;
    }

    private static ApplicationDbContext CreateDbContext(
        string schemaConnStr,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService)
    {
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propertyService);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(schemaConnStr)
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propertyService);
    }

    private static IConfiguration BuildTestConfig(string schemaConnStr)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = schemaConnStr,
                ["JwtSettings:SecretKey"] = "SuperSecretIntegrationTestSigningKeyForHotelSaas2026!!",
                ["JwtSettings:Issuer"] = "HotelSaasTest",
                ["JwtSettings:Audience"] = "HotelSaasTestClient",
                ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
                ["JwtSettings:RefreshTokenExpirationDays"] = "7"
            })
            .Build();
    }

    private static async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            CREATE SCHEMA IF NOT EXISTS ""{testSchema}"";
            SET search_path TO ""{testSchema}"", public;
        ";
        await cmd.ExecuteNonQueryAsync();

        return conn;
    }

    private static async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"DROP SCHEMA IF EXISTS ""{testSchema}"" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    [Fact]
    public async Task EndToEnd_PartnerOnboarding_MultiBranchCreation_StaffIsolation_And_HqContextSwitching_Passes()
    {
        var testSchema = $"test_rbac_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var schemaConnStr = BuildSchemaConnectionString(conn.ConnectionString, testSchema);
        var config = BuildTestConfig(schemaConnStr);
        var locationService = new LocationLookupService();
        var passwordHasher = new PasswordHasherService();
        var jwtService = new JwtService(config);
        var membershipLookup = new MembershipLookupService(config, NullLogger<MembershipLookupService>.Instance);
        var tokenHandler = new JwtSecurityTokenHandler();

        try
        {
            var haNoiCode = locationService.GetProvinces()
                .First(p => p.Name.Contains("Hà Nội", StringComparison.OrdinalIgnoreCase)).Code;

            // 1. Migrate schema and seed RBAC roles & permissions
            await using (var seedCtx = CreateDbContext(schemaConnStr, new MutableTenantService(), new MutablePropertyService()))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedData.SeedDefaultRolesAndPermissions(seedCtx);

                // Verify OWNER SUBSCRIPTIONS:127 and MANAGER DASHBOARD:Read
                var ownerRole = await seedCtx.AccessRoles.FirstAsync(r => r.Code == "OWNER");
                var managerRole = await seedCtx.AccessRoles.FirstAsync(r => r.Code == "MANAGER");
                var subsFunc = await seedCtx.PermissionFunctions.FirstAsync(f => f.Code == "SUBSCRIPTIONS");
                var dashFunc = await seedCtx.PermissionFunctions.FirstAsync(f => f.Code == "DASHBOARD");

                var ownerSubsPerm = await seedCtx.RolePermissions
                    .FirstAsync(rp => rp.RoleId == ownerRole.Id && rp.FunctionId == subsFunc.Id);
                Assert.Equal(127, ownerSubsPerm.ActionMask);

                var managerDashPerm = await seedCtx.RolePermissions
                    .FirstAsync(rp => rp.RoleId == managerRole.Id && rp.FunctionId == dashFunc.Id);
                Assert.Equal(1, managerDashPerm.ActionMask & 1);

                // Also verify EnsureRolePermissionsUpToDateAsync upgrades degraded permissions idempotently
                ownerSubsPerm.ActionMask = 1;
                seedCtx.RolePermissions.Remove(managerDashPerm);
                await seedCtx.SaveChangesAsync();

                await SeedData.SeedDefaultRolesAndPermissions(seedCtx);

                var refreshedOwnerSubs = await seedCtx.RolePermissions.AsNoTracking()
                    .FirstAsync(rp => rp.RoleId == ownerRole.Id && rp.FunctionId == subsFunc.Id);
                var refreshedManagerDash = await seedCtx.RolePermissions.AsNoTracking()
                    .FirstAsync(rp => rp.RoleId == managerRole.Id && rp.FunctionId == dashFunc.Id);
                Assert.Equal(127, refreshedOwnerSubs.ActionMask);
                Assert.Equal(1, refreshedManagerDash.ActionMask & 1);
            }

            // 2. Partner A registers a new chain -> Login immediately succeeds (no 401 Dual-Verification block)
            RegisterPartnerResponse partnerAResponse;
            await using (var regCtx = CreateDbContext(schemaConnStr, new MutableTenantService(), new MutablePropertyService()))
            {
                var regTenantSvc = new MutableTenantService();
                var regPropSvc = new MutablePropertyService();
                var regUserCtx = new MutableUserContext(regTenantSvc, regPropSvc);
                await using var scopedRegCtx = CreateDbContext(schemaConnStr, regTenantSvc, regPropSvc);

                var registerHandler = new RegisterPartnerCommandHandler(
                    scopedRegCtx,
                    passwordHasher,
                    locationService,
                    regUserCtx,
                    regTenantSvc,
                    regPropSvc);

                partnerAResponse = await registerHandler.Handle(new RegisterPartnerCommand(
                    FullName: "Partner A Owner",
                    Email: "owner.a@example.vn",
                    Password: "Partner@123",
                    PhoneNumber: "0901234567",
                    PropertyName: "Branch One Boutique",
                    Address: "15 Lý Thái Tổ",
                    ProvinceCode: haNoiCode,
                    WardCode: null,
                    BrandName: "Chain A Hospitality",
                    PropertyType: (int)PropertyType.Hotel,
                    StarRating: 4), CancellationToken.None);
            }

            // Also create Tenant B separately to assert strict cross-tenant isolation
            Guid tenantBId = Guid.NewGuid();
            await using (var tenantBCtx = CreateDbContext(schemaConnStr, new MutableTenantService { TenantId = tenantBId }, new MutablePropertyService()))
            {
                tenantBCtx.Tenants.Add(new Tenant
                {
                    Id = tenantBId,
                    Name = "Tenant B Group",
                    Code = "TNT-B",
                    Slug = "tenant-b-group",
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow
                });
                await tenantBCtx.SaveChangesAsync();
            }

            // Partner A logs in immediately
            LoginResponse partnerALogin;
            await using (var loginCtx = CreateDbContext(schemaConnStr, new MutableTenantService(), new MutablePropertyService()))
            {
                var loginHandler = new LoginCommandHandler(loginCtx, passwordHasher, jwtService);
                partnerALogin = await loginHandler.Handle(
                    new LoginCommand("owner.a@example.vn", "Partner@123"),
                    CancellationToken.None);

                Assert.False(string.IsNullOrWhiteSpace(partnerALogin.AccessToken));
                Assert.Equal(partnerAResponse.TenantId, partnerALogin.User.TenantId);
                Assert.NotNull(partnerALogin.Memberships);
                Assert.Single(partnerALogin.Memberships!);
                Assert.True(partnerALogin.Memberships![0].IsTenantWide);
            }

            // 3. Partner A creates Branch 2 -> TotalRooms == 3 & AvailableRooms == 3, GetMyMemberships lists 2 branches + HQ
            Guid branch1Id = partnerAResponse.PropertyId;
            Guid branch2Id;
            await using (var propCtx = CreateDbContext(
                schemaConnStr,
                new MutableTenantService { TenantId = partnerAResponse.TenantId },
                new MutablePropertyService { IsTenantWide = true }))
            {
                var createPropHandler = new CreatePropertyCommandHandler(
                    propCtx,
                    new MutableTenantService { TenantId = partnerAResponse.TenantId },
                    locationService);

                var branch2 = await createPropHandler.Handle(new CreatePropertyCommand(
                    Name: "Branch Two Riverside",
                    Code: "BR2",
                    Slug: $"branch-two-{Guid.NewGuid():N}"[..20],
                    Address: "88 Bạch Đằng",
                    City: "Đà Nẵng",
                    PropertyType: PropertyType.Villa,
                    StarRating: 5), CancellationToken.None);

                branch2Id = branch2.Id;
                Assert.Equal(3, branch2.TotalRooms);
                Assert.Equal(3, branch2.AvailableRooms);

                var persistedRooms = await propCtx.Rooms.IgnoreQueryFilters()
                    .Where(r => r.PropertyId == branch2Id)
                    .ToListAsync();
                Assert.Equal(3, persistedRooms.Count);
                Assert.All(persistedRooms, r => Assert.Equal(RoomStatus.Clean, r.Status));

                var branch1Policies = await propCtx.PropertySurchargePolicies.IgnoreQueryFilters()
                    .Where(sp => sp.PropertyId == branch1Id && sp.IsActive)
                    .ToListAsync();
                var branch2Policies = await propCtx.PropertySurchargePolicies.IgnoreQueryFilters()
                    .Where(sp => sp.PropertyId == branch2Id && sp.IsActive)
                    .ToListAsync();
                Assert.Equal(6, branch1Policies.Count);
                Assert.Equal(6, branch2Policies.Count);

                var membershipsUserCtx = new MutableUserContext(
                    new MutableTenantService { TenantId = partnerAResponse.TenantId },
                    new MutablePropertyService { IsTenantWide = true })
                {
                    UserId = partnerAResponse.UserId
                };
                var membershipsHandler = new GetMyMembershipsQueryHandler(propCtx, membershipsUserCtx);
                var memberships = await membershipsHandler.Handle(new GetMyMembershipsQuery(), CancellationToken.None);

                Assert.Contains(memberships, m => m.PropertyId == null && m.IsTenantWide);
                Assert.Contains(memberships, m => m.PropertyId == branch1Id);
                Assert.Contains(memberships, m => m.PropertyId == branch2Id);
            }

            // 4. Partner A creates Receptionist scoped strictly to Branch 2
            Guid staffUserId;
            await using (var staffCtx = CreateDbContext(
                schemaConnStr,
                new MutableTenantService { TenantId = partnerAResponse.TenantId },
                new MutablePropertyService { IsTenantWide = true }))
            {
                var createStaffHandler = new CreateStaffMemberCommandHandler(
                    staffCtx,
                    new MutableTenantService { TenantId = partnerAResponse.TenantId },
                    passwordHasher);

                var createdStaff = await createStaffHandler.Handle(new CreateStaffMemberCommand
                {
                    FullName = "Receptionist Branch 2",
                    Email = "receptionist.b2@example.vn",
                    PhoneNumber = "0987654321",
                    Password = "Staff@123",
                    PropertyId = branch2Id,
                    StaffRole = StaffRole.Receptionist
                }, CancellationToken.None);

                staffUserId = createdStaff.UserId;
                Assert.Equal(branch2Id, createdStaff.PropertyId);
                Assert.False(createdStaff.IsTenantWide);

                // Duplicate assignment to exact same Branch 2 is rejected
                await Assert.ThrowsAsync<InvalidOperationException>(() =>
                    createStaffHandler.Handle(new CreateStaffMemberCommand
                    {
                        FullName = "Receptionist Branch 2",
                        Email = "receptionist.b2@example.vn",
                        PropertyId = branch2Id,
                        StaffRole = StaffRole.Receptionist
                    }, CancellationToken.None));
            }

            // Receptionist logs in immediately with Branch 2 scope
            await using (var staffLoginCtx = CreateDbContext(schemaConnStr, new MutableTenantService(), new MutablePropertyService()))
            {
                var loginHandler = new LoginCommandHandler(staffLoginCtx, passwordHasher, jwtService);
                var staffLogin = await loginHandler.Handle(
                    new LoginCommand("receptionist.b2@example.vn", "Staff@123"),
                    CancellationToken.None);

                Assert.False(string.IsNullOrWhiteSpace(staffLogin.AccessToken));
                var jwt = tokenHandler.ReadJwtToken(staffLogin.AccessToken);
                Assert.Equal(branch2Id.ToString(), jwt.Claims.FirstOrDefault(c => c.Type == "propertyId")?.Value);

                // Membership isolation checks
                var branch2Lookup = await membershipLookup.ResolveMembershipAsync(partnerAResponse.TenantId, staffUserId, branch2Id);
                Assert.Equal(MembershipLookupStatus.Success, branch2Lookup.Status);

                var branch1Lookup = await membershipLookup.ResolveMembershipAsync(partnerAResponse.TenantId, staffUserId, branch1Id);
                Assert.Equal(MembershipLookupStatus.PropertyForbidden, branch1Lookup.Status);

                var tenantBLookup = await membershipLookup.ResolveMembershipAsync(tenantBId, staffUserId, null);
                Assert.Equal(MembershipLookupStatus.NoMembership, tenantBLookup.Status);

                // Branch-only staff attempting SwitchContextCommand(null) -> ForbiddenException
                var staffTenantSvc = new MutableTenantService { TenantId = partnerAResponse.TenantId };
                var staffPropSvc = new MutablePropertyService { PropertyId = branch2Id, IsTenantWide = false };
                var staffSwitchUserCtx = new MutableUserContext(staffTenantSvc, staffPropSvc)
                {
                    UserId = staffUserId,
                    Email = "receptionist.b2@example.vn"
                };

                await using var staffSwitchCtx = CreateDbContext(schemaConnStr, staffTenantSvc, staffPropSvc);
                var staffSwitchHandler = new SwitchContextCommandHandler(
                    staffSwitchCtx,
                    staffSwitchUserCtx,
                    membershipLookup,
                    jwtService);

                var forbiddenEx = await Assert.ThrowsAsync<ForbiddenException>(() =>
                    staffSwitchHandler.Handle(new SwitchContextCommand(null), CancellationToken.None));
                Assert.Equal("ERR_PROPERTY_FORBIDDEN", forbiddenEx.ErrorCode);
            }

            // 4b. Assign an existing Customer to multiple branches in the same chain
            await using (var multiCtx = CreateDbContext(
                schemaConnStr,
                new MutableTenantService { TenantId = partnerAResponse.TenantId },
                new MutablePropertyService { IsTenantWide = true }))
            {
                var existingCustomer = new User
                {
                    Id = Guid.NewGuid(),
                    Username = "customer.multi@example.vn",
                    Email = "customer.multi@example.vn",
                    PasswordHash = passwordHasher.Hash("Cust@123"),
                    FullName = "Existing Customer",
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true
                };
                multiCtx.Users.Add(existingCustomer);
                await multiCtx.SaveChangesAsync();

                var multiStaffHandler = new CreateStaffMemberCommandHandler(
                    multiCtx,
                    new MutableTenantService { TenantId = partnerAResponse.TenantId },
                    passwordHasher);

                var assignB1 = await multiStaffHandler.Handle(new CreateStaffMemberCommand
                {
                    FullName = "Existing Customer",
                    Email = "customer.multi@example.vn",
                    PhoneNumber = "0911223344",
                    PropertyId = branch1Id,
                    StaffRole = StaffRole.Manager,
                    ConfirmCustomerPromotion = true
                }, CancellationToken.None);

                var assignB2 = await multiStaffHandler.Handle(new CreateStaffMemberCommand
                {
                    FullName = "Existing Customer",
                    Email = "customer.multi@example.vn",
                    PropertyId = branch2Id,
                    StaffRole = StaffRole.Manager
                }, CancellationToken.None);

                Assert.Equal(branch1Id, assignB1.PropertyId);
                Assert.Equal(branch2Id, assignB2.PropertyId);

                var upgradedUser = await multiCtx.Users.IgnoreQueryFilters()
                    .FirstAsync(u => u.Id == existingCustomer.Id);
                Assert.Equal(GlobalUserRole.TenantStaff, upgradedUser.GlobalRole);
                Assert.Equal(partnerAResponse.TenantId, upgradedUser.TenantId);
                Assert.NotNull(upgradedUser.EmailVerifiedAtUtc);
            }

            // 5. Partner A switches: Branch 1 -> Branch 2 -> Chain HQ (null)
            await using (var switchCtx = CreateDbContext(
                schemaConnStr,
                new MutableTenantService { TenantId = partnerAResponse.TenantId },
                new MutablePropertyService { IsTenantWide = true }))
            {
                var ownerTenantSvc = new MutableTenantService { TenantId = partnerAResponse.TenantId };
                var ownerPropSvc = new MutablePropertyService { IsTenantWide = true };
                var ownerUserCtx = new MutableUserContext(ownerTenantSvc, ownerPropSvc)
                {
                    UserId = partnerAResponse.UserId,
                    Email = "owner.a@example.vn"
                };

                var switchHandler = new SwitchContextCommandHandler(
                    switchCtx,
                    ownerUserCtx,
                    membershipLookup,
                    jwtService);

                var resB1 = await switchHandler.Handle(new SwitchContextCommand(branch1Id), CancellationToken.None);
                Assert.Equal(branch1Id, resB1.CurrentContext.PropertyId);
                Assert.Equal(partnerAResponse.TenantId, resB1.CurrentContext.TenantId);

                ownerPropSvc.PropertyId = branch1Id;
                var resB2 = await switchHandler.Handle(new SwitchContextCommand(branch2Id), CancellationToken.None);
                Assert.Equal(branch2Id, resB2.CurrentContext.PropertyId);

                ownerPropSvc.PropertyId = branch2Id;
                var resHq = await switchHandler.Handle(new SwitchContextCommand(null), CancellationToken.None);
                Assert.Equal(partnerAResponse.TenantId, resHq.CurrentContext.TenantId);
                Assert.Null(resHq.CurrentContext.PropertyId);
                Assert.Equal("TenantWide", resHq.CurrentContext.Scope);
                Assert.Equal("Owner", resHq.CurrentContext.RoleName);

                var hqJwt = tokenHandler.ReadJwtToken(resHq.AccessToken);
                Assert.Equal("TenantWide", hqJwt.Claims.FirstOrDefault(c => c.Type == "scope")?.Value);
                Assert.Null(hqJwt.Claims.FirstOrDefault(c => c.Type == "propertyId"));
                Assert.Contains("SUBSCRIPTIONS:127", hqJwt.Claims.FirstOrDefault(c => c.Type == "permissions")?.Value ?? string.Empty);
            }

            // 6. Verify ReportsController requires REPORTS:1 permission
            var reportsPermAttr = typeof(ReportsController).GetCustomAttributes<RequirePermissionAttribute>().ToList();
            Assert.Contains(reportsPermAttr, a => a.FunctionCode == "REPORTS" && a.RequiredAction == 1);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
