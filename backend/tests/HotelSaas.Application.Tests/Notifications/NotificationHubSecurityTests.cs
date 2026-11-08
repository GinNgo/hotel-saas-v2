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

        Assert.Equal(3, groupMgr.Added.Count);
        Assert.All(groupMgr.Added, a => Assert.Equal("conn_super_1", a.ConnectionId));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyGroupName(targetPropertyId.ToString()));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyFinancialGroupName(targetPropertyId.ToString()));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyHousekeepingGroupName(targetPropertyId.ToString()));
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

        Assert.Equal(2, groupMgr.Added.Count);
        Assert.All(groupMgr.Added, a => Assert.Equal("conn_staff_reception_1", a.ConnectionId));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyGroupName(fixture.PropertyId.ToString()));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyFrontdeskGroupName(fixture.PropertyId.ToString()));
        Assert.DoesNotContain(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyFinancialGroupName(fixture.PropertyId.ToString()));
    }

    [Fact]
    public async Task JoinProperty_WhenStaffIsManager_JoinsBothBaseAndFinancialGroups()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var managerId = Guid.NewGuid();
        var managerUser = new User
        {
            Id = managerId,
            Email = "manager@hotelsaas.test",
            FullName = "Property Manager",
            GlobalRole = GlobalUserRole.TenantStaff,
            CreatedAtUtc = DateTime.UtcNow
        };
        ctx.Users.Add(managerUser);

        var role = new AccessRole
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            Name = "Manager Role",
            Description = "Manager",
            IsSystemRole = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        ctx.AccessRoles.Add(role);

        var staff = new TenantStaff
        {
            Id = Guid.NewGuid(),
            UserId = managerId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoleId = role.Id,
            IsActive = true,
            StaffRole = StaffRole.Manager
        };
        ctx.TenantStaffMembers.Add(staff);
        await ctx.SaveChangesAsync();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, managerId.ToString()),
            new Claim("tenantId", fixture.TenantId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));

        var groupMgr = new TestGroupManager();
        var hub = new NotificationHub(ctx, NullLogger<NotificationHub>.Instance)
        {
            Context = new TestHubCallerContext(user, "conn_manager_1"),
            Groups = groupMgr
        };

        await hub.JoinProperty(fixture.PropertyId.ToString());

        // Manager joins base, financial, and housekeeping
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyGroupName(fixture.PropertyId.ToString()));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyFinancialGroupName(fixture.PropertyId.ToString()));
        Assert.Contains(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyHousekeepingGroupName(fixture.PropertyId.ToString()));
        Assert.DoesNotContain(groupMgr.Added, a => a.GroupName == NotificationHub.GetPropertyFrontdeskGroupName(fixture.PropertyId.ToString()));
    }

    private sealed class TestNotificationClient : INotificationClient
    {
        public List<PaymentConfirmedNotificationPayload> PaymentConfirmed { get; } = new();
        public List<BookingCancellationNotificationPayload> CancellationRequested { get; } = new();
        public List<HoldExpiredNotificationPayload> HoldExpired { get; } = new();

        public Task ReceiveNewReservation(ReservationNotificationPayload payload) => Task.CompletedTask;
        public Task ReceiveReservationStatusUpdated(ReservationStatusNotificationPayload payload) => Task.CompletedTask;
        public Task ReceiveHousekeepingAlert(HousekeepingNotificationPayload alert) => Task.CompletedTask;

        public Task ReceiveBookingPaymentConfirmed(PaymentConfirmedNotificationPayload notification)
        {
            PaymentConfirmed.Add(notification);
            return Task.CompletedTask;
        }

        public Task ReceiveBookingCancellationRequested(BookingCancellationNotificationPayload notification)
        {
            CancellationRequested.Add(notification);
            return Task.CompletedTask;
        }

        public Task ReceiveHoldExpired(HoldExpiredNotificationPayload notification)
        {
            HoldExpired.Add(notification);
            return Task.CompletedTask;
        }
    }

    private sealed class TestHubClients : IHubClients<INotificationClient>
    {
        private readonly TestNotificationClient _client;
        public Dictionary<string, TestNotificationClient> GroupsTargeted { get; } = new();

        public TestHubClients(TestNotificationClient client) => _client = client;

        public INotificationClient All => _client;
        public INotificationClient AllExcept(IReadOnlyList<string> excludedConnectionIds) => _client;
        public INotificationClient Client(string connectionId) => _client;
        public INotificationClient Clients(IReadOnlyList<string> connectionIds) => _client;
        public INotificationClient Group(string groupName)
        {
            if (!GroupsTargeted.TryGetValue(groupName, out var groupClient))
            {
                groupClient = _client;
                GroupsTargeted[groupName] = groupClient;
            }
            return groupClient;
        }
        public INotificationClient GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => _client;
        public INotificationClient Groups(IReadOnlyList<string> groupNames) => _client;
        public INotificationClient User(string userId) => _client;
        public INotificationClient Users(IReadOnlyList<string> userIds) => _client;
    }

    private sealed class TestHubContext : IHubContext<NotificationHub, INotificationClient>
    {
        public TestHubContext(TestHubClients clients, IGroupManager groups)
        {
            Clients = clients;
            Groups = groups;
        }

        public IHubClients<INotificationClient> Clients { get; }
        public IGroupManager Groups { get; }
    }

    [Fact]
    public async Task NotificationDispatcher_NotifyBookingPaymentConfirmedAsync_DispatchesToCorrectPropertyGroup()
    {
        var propertyId = Guid.NewGuid().ToString();
        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        await dispatcher.NotifyBookingPaymentConfirmedAsync(
            propertyId: propertyId,
            reservationId: Guid.NewGuid().ToString(),
            confirmationCode: "RES-PAY-999",
            guestName: "Le Van Test",
            totalAmount: 5000000m,
            paidAmount: 2500000m,
            paymentMethod: "VNPay");

        var financialGroup = NotificationHub.GetPropertyFinancialGroupName(propertyId);
        var frontdeskGroup = NotificationHub.GetPropertyFrontdeskGroupName(propertyId);
        Assert.True(clients.GroupsTargeted.ContainsKey(financialGroup));
        Assert.True(clients.GroupsTargeted.ContainsKey(frontdeskGroup));
        Assert.Equal(2, client.PaymentConfirmed.Count);
        Assert.Contains(client.PaymentConfirmed, p => p.ConfirmationCode == "RES-PAY-999" && p.PaidAmount == 2500000m && p.PaymentMethod == "VNPay");
        Assert.Contains(client.PaymentConfirmed, p => p.ConfirmationCode == "RES-PAY-999" && p.PaidAmount == 0m && p.PaymentMethod == string.Empty);
    }

    [Fact]
    public async Task NotificationDispatcher_NotifyBookingCancellationRequestedAsync_DispatchesToCorrectPropertyGroup()
    {
        var propertyId = Guid.NewGuid().ToString();
        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        await dispatcher.NotifyBookingCancellationRequestedAsync(
            propertyId: propertyId,
            reservationId: Guid.NewGuid().ToString(),
            confirmationCode: "RES-CNC-888",
            guestName: "Pham Thi Test",
            reason: "Huy do ban cong tac",
            refundableAmount: 1500000m);

        var frontdeskGroup = NotificationHub.GetPropertyFrontdeskGroupName(propertyId);
        var financialGroup = NotificationHub.GetPropertyFinancialGroupName(propertyId);
        Assert.True(clients.GroupsTargeted.ContainsKey(frontdeskGroup));
        Assert.True(clients.GroupsTargeted.ContainsKey(financialGroup));
        Assert.Equal(2, client.CancellationRequested.Count);
        Assert.Contains(client.CancellationRequested, c => c.RefundableAmount == 1500000m && c.TargetRoute == "/payments");
        Assert.Contains(client.CancellationRequested, c => c.RefundableAmount == 0m && c.TargetRoute == "/reservations?code=RES-CNC-888");
    }

    [Fact]
    public async Task NotificationDispatcher_NotifyHoldExpiredAsync_DispatchesToCorrectPropertyGroup()
    {
        var propertyId = Guid.NewGuid().ToString();
        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        bool result = await dispatcher.NotifyHoldExpiredAsync(
            propertyId: propertyId,
            reservationId: Guid.NewGuid().ToString(),
            confirmationCode: "RES-HLD-777",
            roomTypeName: "Deluxe Suite");

        Assert.True(result);
        var expectedGroup = NotificationHub.GetPropertyGroupName(propertyId);
        Assert.True(clients.GroupsTargeted.ContainsKey(expectedGroup));
        Assert.Single(client.HoldExpired);
        Assert.Equal("RES-HLD-777", client.HoldExpired[0].ConfirmationCode);
        Assert.Equal("Deluxe Suite", client.HoldExpired[0].RoomTypeName);
        Assert.Equal("/reservations?code=RES-HLD-777", client.HoldExpired[0].TargetRoute);
    }

    [Fact]
    public async Task NotificationDispatcher_WhenPropertyIdEmpty_DoesNotDispatch()
    {
        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        await dispatcher.NotifyBookingPaymentConfirmedAsync(
            propertyId: "",
            reservationId: Guid.NewGuid().ToString(),
            confirmationCode: "RES-NONE",
            guestName: "Anonymous",
            totalAmount: 1000m,
            paidAmount: 1000m,
            paymentMethod: "Cash");

        Assert.Empty(clients.GroupsTargeted);
        Assert.Empty(client.PaymentConfirmed);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_SweepsOnlyExpiredUnnotifiedHolds_AndMarksTimestamp()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        // 1. Expired hold not yet notified (Should be detected and swept)
        var expiredSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Room",
            HoldExpiredNotifiedAtUtc = null
        };
        var expiredRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-EXP-01",
            GuestName = "Guest Expired",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 1500000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        };
        ctx.Reservations.Add(expiredRes);

        // 2. Already notified expired hold (Should be skipped - Idempotency)
        var alreadyNotifiedSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-10),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Room",
            HoldExpiredNotifiedAtUtc = DateTime.UtcNow.AddMinutes(-8)
        };
        var alreadyNotifiedRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-NOTIFIED-02",
            GuestName = "Guest Already Notified",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 1500000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(alreadyNotifiedSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-25)
        };
        ctx.Reservations.Add(alreadyNotifiedRes);

        // 3. Active hold in the future (Should NOT be swept)
        var activeSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(10),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Room",
            HoldExpiredNotifiedAtUtc = null
        };
        var activeRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-ACTIVE-03",
            GuestName = "Guest Active Hold",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 1500000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(activeSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
        };
        ctx.Reservations.Add(activeRes);
        await ctx.SaveChangesAsync();

        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx, dispatcher);
        var sweptCount = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);

        Assert.Equal(1, sweptCount);
        Assert.Single(client.HoldExpired);
        Assert.Equal("RES-EXP-01", client.HoldExpired[0].ConfirmationCode);

        // Verify that expiredRes snapshot was updated with notification timestamp in database
        var updatedRes = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Reservations, r => r.Id == expiredRes.Id);
        Assert.NotNull(updatedRes);
        var updatedSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(updatedRes.Notes);
        Assert.NotNull(updatedSnap?.HoldExpiredNotifiedAtUtc);

        // Running sweep again should detect 0 new holds (Strict Idempotency)
        var sweepAgainCount = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
        Assert.Equal(0, sweepAgainCount);
        Assert.Single(client.HoldExpired); // Still only 1 notification emitted
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenHoldConfirmedOrCancelled_NeverSweepsAsExpired()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        // Confirmed booking with past hold expiry (paid before TTL)
        var confirmedSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-10),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Suite"
        };
        var confirmedRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-PAID-01",
            GuestName = "Guest Paid",
            Status = ReservationStatus.Confirmed,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 2000000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(confirmedSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-30)
        };
        ctx.Reservations.Add(confirmedRes);

        // Cancelled booking with past hold expiry
        var cancelledSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-15),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Suite"
        };
        var cancelledRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-CANCELLED-02",
            GuestName = "Guest Cancelled",
            Status = ReservationStatus.Cancelled,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 2000000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(cancelledSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-40)
        };
        ctx.Reservations.Add(cancelledRes);
        await ctx.SaveChangesAsync();

        var client = new TestNotificationClient();
        var clients = new TestHubClients(client);
        var hubContext = new TestHubContext(clients, new TestGroupManager());
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(hubContext, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx, dispatcher);
        var sweptCount = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);

        // Neither confirmed nor cancelled reservations may be swept as expired
        Assert.Equal(0, sweptCount);
        Assert.Empty(client.HoldExpired);
    }

    private sealed class FailingNotificationDispatcher : INotificationDispatcher
    {
        public Task NotifyNewReservationConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string roomTypeName, decimal totalAmount, decimal depositPaid, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyReservationStatusChangedAsync(string propertyId, string reservationId, string confirmationCode, string previousStatus, string newStatus, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyHousekeepingAlertAsync(string propertyId, string roomNumber, string roomStatus, string message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingPaymentConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, decimal totalAmount, decimal paidAmount, string paymentMethod, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingCancellationRequestedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string reason, decimal refundableAmount, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> NotifyHoldExpiredAsync(string propertyId, string reservationId, string confirmationCode, string roomTypeName, CancellationToken cancellationToken = default)
        {
            // Simulate network/hub failure
            return Task.FromResult(false);
        }
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenDispatchFails_DoesNotMarkTimestamp_AllowingRetry()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var expiredSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            IsOnlineHold = true,
            RoomTypeName = "Standard Room",
            HoldExpiredNotifiedAtUtc = null
        };
        var expiredRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-FAIL-RETRY",
            GuestName = "Guest Retry",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            TotalAmount = 1000000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        };
        ctx.Reservations.Add(expiredRes);
        await ctx.SaveChangesAsync();

        var failingDispatcher = new FailingNotificationDispatcher();
        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx, failingDispatcher);

        var sweptCount = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
        Assert.Equal(0, sweptCount);

        // Verify that snapshot was NOT marked as notified because dispatch failed
        var unchangedRes = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Reservations, r => r.Id == expiredRes.Id);
        Assert.NotNull(unchangedRes);
        var unchangedSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(unchangedRes.Notes);
        Assert.Null(unchangedSnap?.HoldExpiredNotifiedAtUtc);

        // Next sweep with working dispatcher succeeds and delivers exactly once without event loss
        var recoveryClient = new TestNotificationClient();
        var recoveryClients = new TestHubClients(recoveryClient);
        var recoveryHub = new TestHubContext(recoveryClients, new TestGroupManager());
        var workingDispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(recoveryHub, NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);
        var recoveryHandler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx, workingDispatcher);

        var recoveredCount = await recoveryHandler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
        Assert.Equal(1, recoveredCount);
        Assert.Single(recoveryClient.HoldExpired);
        Assert.Equal("RES-FAIL-RETRY", recoveryClient.HoldExpired[0].ConfirmationCode);
    }

    private sealed class MultiBranchHubClients : IHubClients<INotificationClient>
    {
        private readonly TestNotificationClient _defaultClient = new();
        public Dictionary<string, TestNotificationClient> GroupClients { get; } = new(StringComparer.Ordinal);

        public TestNotificationClient GetOrCreateGroupClient(string groupName)
        {
            if (!GroupClients.TryGetValue(groupName, out var c))
            {
                c = new TestNotificationClient();
                GroupClients[groupName] = c;
            }
            return c;
        }

        public INotificationClient All => _defaultClient;
        public INotificationClient AllExcept(IReadOnlyList<string> excludedConnectionIds) => _defaultClient;
        public INotificationClient Client(string connectionId) => _defaultClient;
        public INotificationClient Clients(IReadOnlyList<string> connectionIds) => _defaultClient;
        public INotificationClient Group(string groupName) => GetOrCreateGroupClient(groupName);
        public INotificationClient GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => GetOrCreateGroupClient(groupName);
        public INotificationClient Groups(IReadOnlyList<string> groupNames) => _defaultClient;
        public INotificationClient User(string userId) => _defaultClient;
        public INotificationClient Users(IReadOnlyList<string> userIds) => _defaultClient;
    }

    private sealed class MultiBranchHubContext : IHubContext<NotificationHub, INotificationClient>
    {
        public MultiBranchHubContext(MultiBranchHubClients clients)
        {
            Clients = clients;
            Groups = new TestGroupManager();
        }

        public IHubClients<INotificationClient> Clients { get; }
        public IGroupManager Groups { get; }
    }

    [Fact]
    public async Task AutomaticHoldSweep_DispatchesToBranchAReceptionOnly_BranchBReceivesZero_AndOverlappingSweepsNeverDuplicate()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvcA = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvcA);

        var branchAId = fixture.PropertyId;
        var branchBId = Guid.NewGuid();

        // Seed Branch B under the same Tenant
        ctx.Properties.Add(new Property
        {
            Id = branchBId,
            TenantId = fixture.TenantId,
            Name = "LuxeStay Branch B",
            Code = $"BRB_{Guid.NewGuid():N}"[..10],
            Slug = $"branch-b-{Guid.NewGuid():N}"[..20],
            Address = "456 Nguyen Hue"
        });
        await ctx.SaveChangesAsync();

        var roomA = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == branchAId);
        Assert.NotNull(roomA);

        // 1. Unpaid expired hold in Branch A (with sensitive LookupToken in snapshot - must NEVER leak into SignalR payload)
        var expiredSnapA = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-2),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Ocean View",
            LookupToken = "SECRET-LOOKUP-TOKEN-DO-NOT-LEAK",
            HoldExpiredNotifiedAtUtc = null
        };
        var expiredResA = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = branchAId,
            RoomId = roomA.Id,
            ConfirmationCode = "RES-BRANCH-A-EXP",
            GuestName = "Guest Branch A",
            Status = ReservationStatus.PendingPayment,
            SmartLockPin = "998877",
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_800_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnapA),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-17)
        };
        ctx.Reservations.Add(expiredResA);

        // 2. Paid/Confirmed booking in Branch A whose original hold timestamp is in the past (must NOT emit HoldExpired)
        var paidSnapA = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Ocean View"
        };
        ctx.Reservations.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = branchAId,
            RoomId = roomA.Id,
            ConfirmationCode = "RES-BRANCH-A-PAID",
            GuestName = "Guest Paid A",
            Status = ReservationStatus.Confirmed,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
            TotalAmount = 1_800_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(paidSnapA),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await ctx.SaveChangesAsync();

        var multiClients = new MultiBranchHubClients();
        var branchAClient = multiClients.GetOrCreateGroupClient(NotificationHub.GetPropertyGroupName(branchAId.ToString()));
        var branchBClient = multiClients.GetOrCreateGroupClient(NotificationHub.GetPropertyGroupName(branchBId.ToString()));

        var hubContext = new MultiBranchHubContext(multiClients);
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            hubContext,
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        // Trigger overlapping automatic sweeps across all properties (PropertyId = null, matching ExpiredHoldSweepBackgroundService)
        await using var ctx1 = fixture.CreateDbContext(tenantSvc, propSvcA);
        await using var ctx2 = fixture.CreateDbContext(tenantSvc, propSvcA);
        var handler1 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx1, dispatcher);
        var handler2 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(ctx2, dispatcher);

        var results = await Task.WhenAll(
            handler1.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(PropertyId: null), CancellationToken.None),
            handler2.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(PropertyId: null), CancellationToken.None));

        // Total swept across both concurrent sweeps is strictly 1
        Assert.Equal(1, results[0] + results[1]);

        // Branch A receptionist receives strictly 1 HoldExpired notification
        Assert.Single(branchAClient.HoldExpired);
        var payload = branchAClient.HoldExpired[0];
        Assert.Equal("RES-BRANCH-A-EXP", payload.ConfirmationCode);
        Assert.Equal(branchAId.ToString(), payload.PropertyId);
        Assert.Equal("evt-holdexp-RES-BRANCH-A-EXP", payload.EventId);

        // Verify payload never contains LookupToken, SmartLockPin, or financial amounts
        var serializedPayload = System.Text.Json.JsonSerializer.Serialize(payload);
        Assert.DoesNotContain("SECRET-LOOKUP-TOKEN-DO-NOT-LEAK", serializedPayload);
        Assert.DoesNotContain("lookupToken", serializedPayload, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("998877", serializedPayload);
        Assert.DoesNotContain("1800000", serializedPayload);

        // Branch B receptionist receives 0 notifications
        Assert.Empty(branchBClient.HoldExpired);
    }
}
