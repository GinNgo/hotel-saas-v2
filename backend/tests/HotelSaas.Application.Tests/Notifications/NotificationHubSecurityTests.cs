using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Tests.Public;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Hubs;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.Application.Tests.Notifications;

[Collection("SequentialTestCollection")]
public sealed class NotificationHubSecurityTests
{
    private sealed class TestHubCallerContext : HubCallerContext
    {
        private readonly ClaimsPrincipal? _user;

        public TestHubCallerContext(ClaimsPrincipal? user, string connectionId = "conn_test_123")
        {
            _user = user;
            ConnectionId = connectionId;
        }

        public override string ConnectionId { get; }
        public override string? UserIdentifier => _user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        public override ClaimsPrincipal? User => _user;
        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
        public override IFeatureCollection Features { get; } = new FeatureCollection();
        public override CancellationToken ConnectionAborted => CancellationToken.None;
        public override void Abort() { }
    }

    private sealed class TestGroupManager : IGroupManager
    {
        public List<(string ConnectionId, string GroupName)> Added { get; } = new();
        public List<(string ConnectionId, string GroupName)> Removed { get; } = new();

        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            Added.Add((connectionId, groupName));
            return Task.CompletedTask;
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            Removed.Add((connectionId, groupName));
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task JoinProperty_WhenUnauthenticated_ThrowsHubException()
    {
        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(null, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(new ClaimsPrincipal(new ClaimsIdentity())), // Unauthenticated
            Groups = groupMgr
        };

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinProperty(Guid.NewGuid().ToString()));
        Assert.Contains("ERR_UNAUTHORIZED", ex.Message);
        Assert.Empty(groupMgr.Added);
    }

    [Fact]
    public async Task JoinProperty_WhenPropertyIdInvalid_ThrowsHubException()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(null, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user),
            Groups = groupMgr
        };

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinProperty("invalid-guid"));
        Assert.Contains("ERR_INVALID_PROPERTY", ex.Message);
        Assert.Empty(groupMgr.Added);
    }

    [Fact]
    public async Task JoinProperty_WhenSuperAdmin_JoinsWithoutDatabaseMembershipRecord()
    {
        var superAdminId = Guid.NewGuid();
        var targetPropertyId = Guid.NewGuid();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, superAdminId.ToString()),
            new Claim("globalRole", "SuperAdmin")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(null, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user, "conn_super_1"),
            Groups = groupMgr
        };

        await hub.JoinProperty(targetPropertyId.ToString());

        Assert.Single(groupMgr.Added);
        Assert.Equal("conn_super_1", groupMgr.Added[0].ConnectionId);
        Assert.Equal(NotificationHub.GetPropertyGroupName(targetPropertyId.ToString()), groupMgr.Added[0].GroupName);
    }

    [Fact]
    public async Task JoinProperty_WhenPropertyNotFound_ThrowsHubException()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var staffId = Guid.NewGuid();
        var missingPropertyId = Guid.NewGuid();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
            new Claim("tenantId", fixture.TenantId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(ctx, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user),
            Groups = groupMgr
        };

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinProperty(missingPropertyId.ToString()));
        Assert.Contains("ERR_PROPERTY_NOT_FOUND", ex.Message);
        Assert.Empty(groupMgr.Added);
    }

    [Fact]
    public async Task JoinProperty_WhenCrossTenantAttempt_ThrowsHubException()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var staffId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
            new Claim("tenantId", otherTenantId.ToString()), // Cross-tenant!
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(ctx, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user),
            Groups = groupMgr
        };

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinProperty(fixture.PropertyId.ToString()));
        Assert.Contains("ERR_CROSS_TENANT_FORBIDDEN", ex.Message);
        Assert.Empty(groupMgr.Added);
    }

    [Fact]
    public async Task JoinProperty_WhenStaffHasNoMembershipForProperty_ThrowsHubException()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var staffId = Guid.NewGuid(); // User has no staff record

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
            new Claim("tenantId", fixture.TenantId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(ctx, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user),
            Groups = groupMgr
        };

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinProperty(fixture.PropertyId.ToString()));
        Assert.Contains("ERR_PROPERTY_FORBIDDEN", ex.Message);
        Assert.Empty(groupMgr.Added);
    }

    [Fact]
    public async Task JoinProperty_WhenStaffHasActiveMembership_SuccessfullyJoinsGroup()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var staffId = Guid.NewGuid();

        var userEntity = new User
        {
            Id = staffId,
            Email = "receptionist@hotelsaas.test",
            FullName = "Receptionist Staff",
            GlobalRole = GlobalUserRole.TenantStaff,
            CreatedAtUtc = DateTime.UtcNow
        };
        ctx.Users.Add(userEntity);

        var role = new AccessRole
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            Name = "Receptionist Role",
            Description = "Receptionist",
            IsSystemRole = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        ctx.AccessRoles.Add(role);

        // Seed active staff member in database
        var staff = new TenantStaff
        {
            Id = Guid.NewGuid(),
            UserId = staffId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoleId = role.Id,
            IsActive = true,
            StaffRole = StaffRole.Receptionist
        };
        ctx.TenantStaffMembers.Add(staff);
        await ctx.SaveChangesAsync();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
            new Claim("tenantId", fixture.TenantId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(ctx, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user, "conn_staff_reception_1"),
            Groups = groupMgr
        };

        await hub.JoinProperty(fixture.PropertyId.ToString());

        Assert.Single(groupMgr.Added);
        Assert.Equal("conn_staff_reception_1", groupMgr.Added[0].ConnectionId);
        Assert.Equal(NotificationHub.GetPropertyGroupName(fixture.PropertyId.ToString()), groupMgr.Added[0].GroupName);
    }
}
