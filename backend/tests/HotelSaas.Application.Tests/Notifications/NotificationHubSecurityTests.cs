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
        private readonly object _sync = new();
        public List<PaymentConfirmedNotificationPayload> PaymentConfirmed { get; } = new();
        public List<BookingCancellationNotificationPayload> CancellationRequested { get; } = new();
        public List<HoldExpiredNotificationPayload> HoldExpired { get; } = new();

        public Task ReceiveNewReservation(ReservationNotificationPayload payload) => Task.CompletedTask;
        public Task ReceiveReservationStatusUpdated(ReservationStatusNotificationPayload payload) => Task.CompletedTask;
        public Task ReceiveHousekeepingAlert(HousekeepingNotificationPayload alert) => Task.CompletedTask;

        public Task ReceiveBookingPaymentConfirmed(PaymentConfirmedNotificationPayload notification)
        {
            lock (_sync)
            {
                PaymentConfirmed.Add(notification);
            }
            return Task.CompletedTask;
        }

        public Task ReceiveBookingCancellationRequested(BookingCancellationNotificationPayload notification)
        {
            lock (_sync)
            {
                CancellationRequested.Add(notification);
            }
            return Task.CompletedTask;
        }

        public Task ReceiveHoldExpired(HoldExpiredNotificationPayload notification)
        {
            lock (_sync)
            {
                HoldExpired.Add(notification);
            }
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
        private readonly object _sync = new();
        private readonly TestNotificationClient _defaultClient = new();
        public Dictionary<string, TestNotificationClient> GroupClients { get; } = new(StringComparer.Ordinal);

        public TestNotificationClient GetOrCreateGroupClient(string groupName)
        {
            lock (_sync)
            {
                if (!GroupClients.TryGetValue(groupName, out var c))
                {
                    c = new TestNotificationClient();
                    GroupClients[groupName] = c;
                }
                return c;
            }
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

    [Fact]
    public async Task MultiBackendHoldSweep_WithoutSharedInMemoryLock_DispatchesExactlyOnceViaPostgresAdvisoryLock()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var seedCtx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(seedCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var expiredSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-3),
            IsOnlineHold = true,
            RoomTypeName = "Executive Suite",
            LookupToken = "TOKEN-MUST-NOT-LEAK",
            HoldExpiredNotifiedAtUtc = null
        };
        var expiredRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-MULTINODE-01",
            GuestName = "Khach Multi Node",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 2_500_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-18)
        };
        seedCtx.Reservations.Add(expiredRes);
        await seedCtx.SaveChangesAsync();

        var multiClients = new MultiBranchHubClients();
        var branchClient = multiClients.GetOrCreateGroupClient(NotificationHub.GetPropertyGroupName(fixture.PropertyId.ToString()));
        var hubContext = new MultiBranchHubContext(multiClients);
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            hubContext,
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        // Simulate 2 separate backend server instances:
        // - 2 independent DbContext connections (ctxNode1, ctxNode2)
        // - useInMemoryLock: false so neither node shares the static SemaphoreSlim in RAM
        // Synchronization relies purely on PostgreSQL pg_advisory_xact_lock across database connections
        await using var ctxNode1 = fixture.CreateDbContext(tenantSvc, propSvc);
        await using var ctxNode2 = fixture.CreateDbContext(tenantSvc, propSvc);

        var node1Handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctxNode1, dispatcher, useInMemoryLock: false);
        var node2Handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctxNode2, dispatcher, useInMemoryLock: false);

        using var startGate = new ManualResetEventSlim(false);

        async Task<int> RunNodeSweepAsync(HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler handler)
        {
            await Task.Run(() => startGate.Wait());
            return await handler.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(PropertyId: null),
                CancellationToken.None);
        }

        var taskNode1 = RunNodeSweepAsync(node1Handler);
        var taskNode2 = RunNodeSweepAsync(node2Handler);

        startGate.Set();
        var counts = await Task.WhenAll(taskNode1, taskNode2);

        // One backend node sweeps 1 expired hold, the other backend node sweeps 0 (serialized by PostgreSQL pg_advisory_xact_lock)
        Assert.Equal(1, counts[0] + counts[1]);
        Assert.Contains(1, counts);
        Assert.Contains(0, counts);

        // Strictly 1 HoldExpired notification emitted across the entire cluster
        Assert.Single(branchClient.HoldExpired);
        Assert.Equal("RES-MULTINODE-01", branchClient.HoldExpired[0].ConfirmationCode);
    }

    private sealed class InspectOnDispatchNotificationDispatcher : INotificationDispatcher
    {
        private readonly Func<string, Task> _onDispatch;
        public int CallCount { get; private set; }

        public InspectOnDispatchNotificationDispatcher(Func<string, Task> onDispatch)
        {
            _onDispatch = onDispatch;
        }

        public Task NotifyNewReservationConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string roomTypeName, decimal totalAmount, decimal depositPaid, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyReservationStatusChangedAsync(string propertyId, string reservationId, string confirmationCode, string previousStatus, string newStatus, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyHousekeepingAlertAsync(string propertyId, string roomNumber, string roomStatus, string message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingPaymentConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, decimal totalAmount, decimal paidAmount, string paymentMethod, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingCancellationRequestedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string reason, decimal refundableAmount, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public async Task<bool> NotifyHoldExpiredAsync(string propertyId, string reservationId, string confirmationCode, string roomTypeName, CancellationToken cancellationToken = default)
        {
            CallCount++;
            await _onDispatch(reservationId);
            return true;
        }
    }

    private sealed class CountingFailingNotificationDispatcher : INotificationDispatcher
    {
        public int CallCount { get; private set; }
        public Task NotifyNewReservationConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string roomTypeName, decimal totalAmount, decimal depositPaid, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyReservationStatusChangedAsync(string propertyId, string reservationId, string confirmationCode, string previousStatus, string newStatus, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyHousekeepingAlertAsync(string propertyId, string roomNumber, string roomStatus, string message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingPaymentConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, decimal totalAmount, decimal paidAmount, string paymentMethod, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingCancellationRequestedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string reason, decimal refundableAmount, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<bool> NotifyHoldExpiredAsync(string propertyId, string reservationId, string confirmationCode, string roomTypeName, CancellationToken cancellationToken = default)
        {
            CallCount++;
            return Task.FromResult(false);
        }
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenTenantContextMissing_FailsClosed_WithoutDispatching()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var seedTenant = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var seedProp = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var seedCtx = fixture.CreateDbContext(seedTenant, seedProp);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(seedCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var expiredSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            IsOnlineHold = true,
            RoomTypeName = "Deluxe Room"
        };
        seedCtx.Reservations.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-NO-TENANT-01",
            GuestName = "Guest No Tenant",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_200_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await seedCtx.SaveChangesAsync();

        var nullTenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = null };
        var nullPropSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = null, IsTenantWide = false };
        await using var unscopedCtx = fixture.CreateDbContext(nullTenantSvc, nullPropSvc);

        var client = new TestNotificationClient();
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            new TestHubContext(new TestHubClients(client), new TestGroupManager()),
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            unscopedCtx,
            dispatcher,
            useInMemoryLock: true,
            currentTenantService: nullTenantSvc,
            currentPropertyService: nullPropSvc);

        var ex = await Assert.ThrowsAsync<HotelSaas.Application.Common.Exceptions.ForbiddenException>(() =>
            handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));

        Assert.Equal("ERR_TENANT_REQUIRED", ex.ErrorCode);
        Assert.Empty(client.HoldExpired);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_CommitsClaimToPostgresBeforeEmittingSignalR()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var resId = Guid.NewGuid();
        var expiredSnap = new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
        {
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            IsOnlineHold = true,
            RoomTypeName = "Premier Suite"
        };
        ctx.Reservations.Add(new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-COMMIT-FIRST-01",
            GuestName = "Commit First Guest",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_500_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(expiredSnap),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await ctx.SaveChangesAsync();

        bool committedBeforeDispatch = false;
        var inspectingDispatcher = new InspectOnDispatchNotificationDispatcher(async idStr =>
        {
            await using var observerCtx = fixture.CreateDbContext(tenantSvc, propSvc);
            var committedRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(observerCtx.Reservations),
                r => r.Id == Guid.Parse(idStr));
            var committedSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(committedRow?.Notes);
            committedBeforeDispatch = committedSnap != null
                && committedSnap.HoldExpiredClaimedAtUtc.HasValue
                && committedSnap.HoldExpiredDispatchAttemptCount == 1
                && committedSnap.HoldExpiredDispatchLeaseUntilUtc.HasValue
                && committedSnap.HoldExpiredEventId == "evt-holdexp-RES-COMMIT-FIRST-01"
                && !committedSnap.HoldExpiredNotifiedAtUtc.HasValue;
        });

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctx,
            inspectingDispatcher,
            useInMemoryLock: true,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc);

        var swept = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);

        Assert.Equal(1, swept);
        Assert.Equal(1, inspectingDispatcher.CallCount);
        Assert.True(committedBeforeDispatch, "Database Claim commit MUST be visible to an independent DB connection BEFORE SignalR dispatch occurs.");

        await using var afterCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var finalRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(afterCtx.Reservations),
            r => r.Id == resId);
        var finalSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(finalRow?.Notes);
        Assert.NotNull(finalSnap?.HoldExpiredNotifiedAtUtc);
        Assert.Null(finalSnap?.HoldExpiredDispatchLeaseUntilUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenSaveChangesFailsAndRollsBack_EmitsZeroNotifications()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };
        await using var seedCtx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(seedCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        seedCtx.Reservations.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-ROLLBACK-01",
            GuestName = "Rollback Guest",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_500_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
            {
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                IsOnlineHold = true,
                RoomTypeName = "Standard"
            }),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await seedCtx.SaveChangesAsync();

        // Simulate cross-tenant / tampered property context triggering TenantPropertySaveChangesInterceptor failure during SaveChangesAsync
        var wrongTenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = Guid.NewGuid() };
        var wrongPropSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = true };
        await using var failingSaveCtx = fixture.CreateDbContext(wrongTenantSvc, wrongPropSvc);

        var client = new TestNotificationClient();
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            new TestHubContext(new TestHubClients(client), new TestGroupManager()),
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            failingSaveCtx,
            dispatcher);

        await Assert.ThrowsAsync<HotelSaas.Application.Common.Exceptions.ForbiddenException>(() =>
            handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));

        Assert.Empty(client.HoldExpired);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_RetryIsBoundedByMaxAttempts_AndDeadLettersAfterLimit()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var resId = Guid.NewGuid();
        ctx.Reservations.Add(new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-BOUNDED-RETRY",
            GuestName = "Retry Limit Guest",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_500_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
            {
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                IsOnlineHold = true,
                RoomTypeName = "Deluxe"
            }),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await ctx.SaveChangesAsync();

        var failingDispatcher = new CountingFailingNotificationDispatcher();
        const int maxAttempts = 3;
        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctx,
            failingDispatcher,
            useInMemoryLock: true,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc,
            maxDispatchAttempts: maxAttempts);

        for (int i = 0; i < 5; i++)
        {
            var swept = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
            Assert.Equal(0, swept);
        }

        Assert.Equal(maxAttempts, failingDispatcher.CallCount);

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var res = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
            r => r.Id == resId);
        var snap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(res?.Notes);
        Assert.NotNull(snap);
        Assert.Equal(maxAttempts, snap.HoldExpiredDispatchAttemptCount);
        Assert.NotNull(snap.HoldExpiredDeadLetteredAtUtc);
        Assert.Null(snap.HoldExpiredNotifiedAtUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenReservationConfirmedBetweenClaimAndDispatch_AbortsWithoutEmitting()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(ctx.Rooms, r => r.PropertyId == fixture.PropertyId);
        Assert.NotNull(room);

        var resId = Guid.NewGuid();
        ctx.Reservations.Add(new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = room.Id,
            ConfirmationCode = "RES-PAID-RACE-01",
            GuestName = "Race Paid Guest",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_500_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
            {
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                IsOnlineHold = true,
                RoomTypeName = "Deluxe"
            }),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await ctx.SaveChangesAsync();

        // Dispatch is intercepted only if status wasn't confirmed: here we simulate reservation confirmed right after Claim?
        // Simulate concurrent confirmation inside an IApplicationDbContext wrapper right after CommitAsync of Claim phase!
        var confirmOnFirstCommitCtx = new PostFirstCommitActionDbContext(ctx, async () =>
        {
            await using var paymentCtx = fixture.CreateDbContext(tenantSvc, propSvc);
            var paidRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(paymentCtx.Reservations, r => r.Id == resId);
            paidRow.Status = ReservationStatus.Confirmed;
            await paymentCtx.SaveChangesAsync();
        });

        var client = new TestNotificationClient();
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            new TestHubContext(new TestHubClients(client), new TestGroupManager()),
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            confirmOnFirstCommitCtx,
            dispatcher,
            useInMemoryLock: true,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc);

        var swept = await handler.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);

        Assert.Equal(0, swept);
        Assert.Empty(client.HoldExpired);
    }

    private sealed class PostFirstCommitActionDbContext : IApplicationDbContext
    {
        private readonly HotelSaas.Infrastructure.Persistence.ApplicationDbContext _inner;
        private readonly Func<Task> _onFirstSave;
        private bool _triggered;

        public PostFirstCommitActionDbContext(HotelSaas.Infrastructure.Persistence.ApplicationDbContext inner, Func<Task> onFirstSave)
        {
            _inner = inner;
            _onFirstSave = onFirstSave;
        }

        public Microsoft.EntityFrameworkCore.DbSet<User> Users => _inner.Users;
        public Microsoft.EntityFrameworkCore.DbSet<RefreshToken> RefreshTokens => _inner.RefreshTokens;
        public Microsoft.EntityFrameworkCore.DbSet<Tenant> Tenants => _inner.Tenants;
        public Microsoft.EntityFrameworkCore.DbSet<Property> Properties => _inner.Properties;
        public Microsoft.EntityFrameworkCore.DbSet<AccessRole> AccessRoles => _inner.AccessRoles;
        public Microsoft.EntityFrameworkCore.DbSet<PermissionFunction> PermissionFunctions => _inner.PermissionFunctions;
        public Microsoft.EntityFrameworkCore.DbSet<RolePermission> RolePermissions => _inner.RolePermissions;
        public Microsoft.EntityFrameworkCore.DbSet<TenantStaff> TenantStaffMembers => _inner.TenantStaffMembers;
        public Microsoft.EntityFrameworkCore.DbSet<RoomType> RoomTypes => _inner.RoomTypes;
        public Microsoft.EntityFrameworkCore.DbSet<Room> Rooms => _inner.Rooms;
        public Microsoft.EntityFrameworkCore.DbSet<Reservation> Reservations => _inner.Reservations;
        public Microsoft.EntityFrameworkCore.DbSet<Payment> Payments => _inner.Payments;
        public Microsoft.EntityFrameworkCore.DbSet<Subscription> Subscriptions => _inner.Subscriptions;
        public Microsoft.EntityFrameworkCore.DbSet<SubscriptionPlan> SubscriptionPlans => _inner.SubscriptionPlans;
        public Microsoft.EntityFrameworkCore.DbSet<SystemBanner> SystemBanners => _inner.SystemBanners;
        public Microsoft.EntityFrameworkCore.DbSet<PropertySurchargePolicy> PropertySurchargePolicies => _inner.PropertySurchargePolicies;
        public Microsoft.EntityFrameworkCore.DbSet<RoomTypeRate> RoomTypeRates => _inner.RoomTypeRates;
        public Microsoft.EntityFrameworkCore.DbSet<RoomTypeRateAudit> RoomTypeRateAudits => _inner.RoomTypeRateAudits;
        public Microsoft.EntityFrameworkCore.DbSet<AuditLog> AuditLogs => _inner.AuditLogs;
        public Microsoft.EntityFrameworkCore.DbSet<Invoice> Invoices => _inner.Invoices;
        public Microsoft.EntityFrameworkCore.DbSet<InvoiceItem> InvoiceItems => _inner.InvoiceItems;
        public Microsoft.EntityFrameworkCore.DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => _inner.GuestLoyaltyMemberships;
        public Microsoft.EntityFrameworkCore.DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => _inner.LoyaltyPointTransactions;
        public Microsoft.EntityFrameworkCore.DbSet<TenantContract> TenantContracts => _inner.TenantContracts;
        public Microsoft.EntityFrameworkCore.DbSet<PrintTemplateConfig> PrintTemplateConfigs => _inner.PrintTemplateConfigs;
        public Microsoft.EntityFrameworkCore.DbSet<SocialIdentity> SocialIdentities => _inner.SocialIdentities;
        public Microsoft.EntityFrameworkCore.DbSet<GuestReview> GuestReviews => _inner.GuestReviews;
        public Microsoft.EntityFrameworkCore.DbSet<AiUsageLog> AiUsageLogs => _inner.AiUsageLogs;

        public async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            var tx = await _inner.BeginTransactionAsync(cancellationToken);
            if (!_triggered)
            {
                return new InterceptingTransaction(tx, async () =>
                {
                    _triggered = true;
                    await _onFirstSave();
                });
            }
            return tx;
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => _inner.SaveChangesAsync(cancellationToken);
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => _inner.LockUserRowAsync(userId, cancellationToken);
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockRoomTypeRowAsync(roomTypeId, tenantId, propertyId, cancellationToken);
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockRoomRowAsync(roomId, tenantId, propertyId, cancellationToken);
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockReservationRowAsync(reservationId, tenantId, propertyId, cancellationToken);
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => _inner.LockIdempotencyKeyAsync(propertyId, idempotencyKey, cancellationToken);
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) =>
            _inner.UpdateRoomStatusAtomicAsync(roomId, tenantId, propertyId, expectedOldStatus, newStatus, updatedAtUtc, cancellationToken);

        private sealed class InterceptingTransaction : Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction
        {
            private readonly Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction _inner;
            private readonly Func<Task> _afterCommit;
            public InterceptingTransaction(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction inner, Func<Task> afterCommit)
            {
                _inner = inner;
                _afterCommit = afterCommit;
            }
            public Guid TransactionId => _inner.TransactionId;
            public void Commit() => _inner.Commit();
            public async Task CommitAsync(CancellationToken cancellationToken = default)
            {
                await _inner.CommitAsync(cancellationToken);
                await _afterCommit();
            }
            public void Rollback() => _inner.Rollback();
            public Task RollbackAsync(CancellationToken cancellationToken = default) => _inner.RollbackAsync(cancellationToken);
            public void Dispose() => _inner.Dispose();
            public ValueTask DisposeAsync() => _inner.DisposeAsync();
        }
    }

    private sealed class DelegateNotificationDispatcher : INotificationDispatcher
    {
        private readonly Func<string, string, string, string, CancellationToken, Task<bool>> _onHoldExpired;
        public int CallCount { get; private set; }

        public DelegateNotificationDispatcher(Func<string, string, string, string, CancellationToken, Task<bool>> onHoldExpired)
        {
            _onHoldExpired = onHoldExpired;
        }

        public Task NotifyNewReservationConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string roomTypeName, decimal totalAmount, decimal depositPaid, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyReservationStatusChangedAsync(string propertyId, string reservationId, string confirmationCode, string previousStatus, string newStatus, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyHousekeepingAlertAsync(string propertyId, string roomNumber, string roomStatus, string message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingPaymentConfirmedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, decimal totalAmount, decimal paidAmount, string paymentMethod, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyBookingCancellationRequestedAsync(string propertyId, string reservationId, string confirmationCode, string guestName, string reason, decimal refundableAmount, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public async Task<bool> NotifyHoldExpiredAsync(string propertyId, string reservationId, string confirmationCode, string roomTypeName, CancellationToken cancellationToken = default)
        {
            CallCount++;
            return await _onHoldExpired(propertyId, reservationId, confirmationCode, roomTypeName, cancellationToken);
        }
    }

    private sealed class FailOnSecondSaveDbContext : IApplicationDbContext
    {
        private readonly HotelSaas.Infrastructure.Persistence.ApplicationDbContext _inner;
        private int _saveCount;

        public FailOnSecondSaveDbContext(HotelSaas.Infrastructure.Persistence.ApplicationDbContext inner)
        {
            _inner = inner;
        }

        public Microsoft.EntityFrameworkCore.DbSet<User> Users => _inner.Users;
        public Microsoft.EntityFrameworkCore.DbSet<RefreshToken> RefreshTokens => _inner.RefreshTokens;
        public Microsoft.EntityFrameworkCore.DbSet<Tenant> Tenants => _inner.Tenants;
        public Microsoft.EntityFrameworkCore.DbSet<Property> Properties => _inner.Properties;
        public Microsoft.EntityFrameworkCore.DbSet<AccessRole> AccessRoles => _inner.AccessRoles;
        public Microsoft.EntityFrameworkCore.DbSet<PermissionFunction> PermissionFunctions => _inner.PermissionFunctions;
        public Microsoft.EntityFrameworkCore.DbSet<RolePermission> RolePermissions => _inner.RolePermissions;
        public Microsoft.EntityFrameworkCore.DbSet<TenantStaff> TenantStaffMembers => _inner.TenantStaffMembers;
        public Microsoft.EntityFrameworkCore.DbSet<RoomType> RoomTypes => _inner.RoomTypes;
        public Microsoft.EntityFrameworkCore.DbSet<Room> Rooms => _inner.Rooms;
        public Microsoft.EntityFrameworkCore.DbSet<Reservation> Reservations => _inner.Reservations;
        public Microsoft.EntityFrameworkCore.DbSet<Payment> Payments => _inner.Payments;
        public Microsoft.EntityFrameworkCore.DbSet<Subscription> Subscriptions => _inner.Subscriptions;
        public Microsoft.EntityFrameworkCore.DbSet<SubscriptionPlan> SubscriptionPlans => _inner.SubscriptionPlans;
        public Microsoft.EntityFrameworkCore.DbSet<SystemBanner> SystemBanners => _inner.SystemBanners;
        public Microsoft.EntityFrameworkCore.DbSet<PropertySurchargePolicy> PropertySurchargePolicies => _inner.PropertySurchargePolicies;
        public Microsoft.EntityFrameworkCore.DbSet<RoomTypeRate> RoomTypeRates => _inner.RoomTypeRates;
        public Microsoft.EntityFrameworkCore.DbSet<RoomTypeRateAudit> RoomTypeRateAudits => _inner.RoomTypeRateAudits;
        public Microsoft.EntityFrameworkCore.DbSet<AuditLog> AuditLogs => _inner.AuditLogs;
        public Microsoft.EntityFrameworkCore.DbSet<Invoice> Invoices => _inner.Invoices;
        public Microsoft.EntityFrameworkCore.DbSet<InvoiceItem> InvoiceItems => _inner.InvoiceItems;
        public Microsoft.EntityFrameworkCore.DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => _inner.GuestLoyaltyMemberships;
        public Microsoft.EntityFrameworkCore.DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => _inner.LoyaltyPointTransactions;
        public Microsoft.EntityFrameworkCore.DbSet<TenantContract> TenantContracts => _inner.TenantContracts;
        public Microsoft.EntityFrameworkCore.DbSet<PrintTemplateConfig> PrintTemplateConfigs => _inner.PrintTemplateConfigs;
        public Microsoft.EntityFrameworkCore.DbSet<SocialIdentity> SocialIdentities => _inner.SocialIdentities;
        public Microsoft.EntityFrameworkCore.DbSet<GuestReview> GuestReviews => _inner.GuestReviews;
        public Microsoft.EntityFrameworkCore.DbSet<AiUsageLog> AiUsageLogs => _inner.AiUsageLogs;

        public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => _inner.BeginTransactionAsync(cancellationToken);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            _saveCount++;
            if (_saveCount == 2)
            {
                throw new OperationCanceledException("Simulated worker crash right before FinalizeClaimsAsync save.");
            }
            return _inner.SaveChangesAsync(cancellationToken);
        }

        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => _inner.LockUserRowAsync(userId, cancellationToken);
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockRoomTypeRowAsync(roomTypeId, tenantId, propertyId, cancellationToken);
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockRoomRowAsync(roomId, tenantId, propertyId, cancellationToken);
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => _inner.LockReservationRowAsync(reservationId, tenantId, propertyId, cancellationToken);
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => _inner.LockIdempotencyKeyAsync(propertyId, idempotencyKey, cancellationToken);
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default)
            => _inner.UpdateRoomStatusAtomicAsync(roomId, tenantId, propertyId, expectedOldStatus, newStatus, updatedAtUtc, cancellationToken);
    }

    private static async Task<Guid> SeedExpiredHoldAsync(
        P5_GuestBookingTests.TestFixture fixture,
        Guid roomId,
        string confirmationCode,
        int attemptCount = 0,
        DateTime? leaseUntilUtc = null,
        DateTime? deadLetteredAtUtc = null,
        string? claimOwner = null)
    {
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var resId = Guid.NewGuid();
        ctx.Reservations.Add(new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = roomId,
            ConfirmationCode = confirmationCode,
            GuestName = "Hold Stress Guest",
            Status = ReservationStatus.PendingPayment,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            TotalAmount = 1_400_000m,
            Notes = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.Serialize(new HotelSaas.Application.Reservations.DTOs.ReservationSnapshot
            {
                HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                IsOnlineHold = true,
                RoomTypeName = "Deluxe",
                HoldExpiredDispatchAttemptCount = attemptCount,
                HoldExpiredDispatchLeaseUntilUtc = leaseUntilUtc,
                HoldExpiredDeadLetteredAtUtc = deadLetteredAtUtc,
                HoldExpiredClaimOwner = claimOwner
            }),
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-20)
        });
        await ctx.SaveChangesAsync();
        return resId;
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WorkerStopsAfterClaimBeforeDispatch_BlocksInsideLeaseThenRecoversOnceAfterLeaseExpiry()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        var resId = await SeedExpiredHoldAsync(fixture, roomId, "RES-CRASH-BEFORE-DISPATCH");

        var emittedCount = 0;
        using var worker1Cts = new CancellationTokenSource();
        var crashingDispatcher = new DelegateNotificationDispatcher((_, _, _, _, ct) =>
        {
            worker1Cts.Cancel();
            ct.ThrowIfCancellationRequested();
            return Task.FromResult(true);
        });

        await using var ctxW1 = fixture.CreateDbContext(tenantSvc, propSvc);
        var handlerW1 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctxW1,
            crashingDispatcher,
            useInMemoryLock: false,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc,
            dispatchLeaseDuration: TimeSpan.FromMilliseconds(250));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handlerW1.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), worker1Cts.Token));

        Assert.Equal(1, crashingDispatcher.CallCount);
        Assert.Equal(0, emittedCount);

        // Immediately check Worker 2 within active 250ms lease -> must skip (0)
        var liveDispatcher = new DelegateNotificationDispatcher((_, _, _, _, _) =>
        {
            Interlocked.Increment(ref emittedCount);
            return Task.FromResult(true);
        });

        await using (var ctxDuringLease = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerDuringLease = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxDuringLease, liveDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc,
                dispatchLeaseDuration: TimeSpan.FromMilliseconds(250));
            var sweptDuringLease = await handlerDuringLease.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
            Assert.Equal(0, sweptDuringLease);
            Assert.Equal(0, emittedCount);
        }

        await Task.Delay(350);

        // After lease expires, Worker 2 recovers and dispatches once
        await using (var ctxW2 = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerW2 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxW2, liveDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc,
                dispatchLeaseDuration: TimeSpan.FromSeconds(5));
            var recoveredCount = await handlerW2.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None);
            Assert.Equal(1, recoveredCount);
        }

        Assert.Equal(1, emittedCount);

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var finalRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
            r => r.Id == resId);
        var finalSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(finalRow.Notes)!;
        Assert.Equal(2, finalSnap.HoldExpiredDispatchAttemptCount);
        Assert.NotNull(finalSnap.HoldExpiredNotifiedAtUtc);
        Assert.Null(finalSnap.HoldExpiredDispatchLeaseUntilUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WorkerStopsAfterDispatchBeforeFinalize_BlocksInsideLeaseThenConvergesWithSameEventId()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        var resId = await SeedExpiredHoldAsync(fixture, roomId, "RES-CRASH-AFTER-DISPATCH");

        var client = new TestNotificationClient();
        var dispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            new TestHubContext(new TestHubClients(client), new TestGroupManager()),
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        await using var rawCtxW1 = fixture.CreateDbContext(tenantSvc, propSvc);
        var failFinalizeCtx = new FailOnSecondSaveDbContext(rawCtxW1);
        var handlerW1 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            failFinalizeCtx,
            dispatcher,
            useInMemoryLock: false,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc,
            dispatchLeaseDuration: TimeSpan.FromMilliseconds(250));

        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            handlerW1.Handle(new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));

        Assert.Single(client.HoldExpired);
        Assert.Equal("evt-holdexp-RES-CRASH-AFTER-DISPATCH", client.HoldExpired[0].EventId);

        // Within active lease, Worker 2 must NOT re-emit
        await using (var ctxDuringLease = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerDuringLease = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxDuringLease, dispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc,
                dispatchLeaseDuration: TimeSpan.FromMilliseconds(250));
            Assert.Equal(0, await handlerDuringLease.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));
            Assert.Single(client.HoldExpired);
        }

        await Task.Delay(350);

        // After lease expiry, Worker 2 converges DB NotifiedAtUtc (at-least-once with identical EventId)
        await using (var ctxW2 = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerW2 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxW2, dispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc);
            Assert.Equal(1, await handlerW2.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));
            // Subsequent sweep emits 0 additional events
            Assert.Equal(0, await handlerW2.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));
        }

        Assert.Equal(2, client.HoldExpired.Count);
        Assert.All(client.HoldExpired, evt => Assert.Equal("evt-holdexp-RES-CRASH-AFTER-DISPATCH", evt.EventId));

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var finalRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
            r => r.Id == resId);
        var finalSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(finalRow.Notes)!;
        Assert.Equal(2, finalSnap.HoldExpiredDispatchAttemptCount);
        Assert.NotNull(finalSnap.HoldExpiredNotifiedAtUtc);
        Assert.Null(finalSnap.HoldExpiredDispatchLeaseUntilUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenLeaseExpiresDuringSlowDispatch_Worker2TakesOver_AndZombieWorker1IsFenced()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        var resId = await SeedExpiredHoldAsync(fixture, roomId, "RES-LEASE-RACE-01");

        var w1EnteredDispatch = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseW1Dispatch = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var slowDispatcherW1 = new DelegateNotificationDispatcher(async (_, _, _, _, _) =>
        {
            w1EnteredDispatch.TrySetResult();
            return await releaseW1Dispatch.Task;
        });

        await using var ctxW1 = fixture.CreateDbContext(tenantSvc, propSvc);
        var handlerW1 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
            ctxW1,
            slowDispatcherW1,
            useInMemoryLock: false,
            currentTenantService: tenantSvc,
            currentPropertyService: propSvc,
            dispatchLeaseDuration: TimeSpan.FromMilliseconds(150));

        var w1Task = handlerW1.Handle(
            new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId),
            CancellationToken.None);

        await w1EnteredDispatch.Task;
        await Task.Delay(250); // 150ms lease expires while W1 is still stalled in NotifyHoldExpiredAsync

        var w2Dispatched = 0;
        var fastDispatcherW2 = new DelegateNotificationDispatcher((_, _, _, _, _) =>
        {
            Interlocked.Increment(ref w2Dispatched);
            return Task.FromResult(true);
        });

        string? w2Owner;
        DateTime? w2NotifiedAt;
        await using (var ctxW2 = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerW2 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxW2,
                fastDispatcherW2,
                useInMemoryLock: false,
                currentTenantService: tenantSvc,
                currentPropertyService: propSvc,
                dispatchLeaseDuration: TimeSpan.FromSeconds(10));
            var sweptW2 = await handlerW2.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId),
                CancellationToken.None);
            Assert.Equal(1, sweptW2);
            Assert.Equal(1, w2Dispatched);
        }

        await using (var midCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var midRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(midCtx.Reservations),
                r => r.Id == resId);
            var midSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(midRow.Notes)!;
            w2Owner = midSnap.HoldExpiredClaimOwner;
            w2NotifiedAt = midSnap.HoldExpiredNotifiedAtUtc;
        }

        // Now W1 wakes up and fails late: zombie W1 MUST be fenced out and leave W2's committed record untouched
        releaseW1Dispatch.TrySetResult(false);
        var sweptW1 = await w1Task;
        Assert.Equal(0, sweptW1);

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var finalRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
            r => r.Id == resId);
        var finalSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(finalRow.Notes)!;
        Assert.Equal(w2Owner, finalSnap.HoldExpiredClaimOwner);
        Assert.Equal(w2NotifiedAt, finalSnap.HoldExpiredNotifiedAtUtc);
        Assert.Equal(2, finalSnap.HoldExpiredDispatchAttemptCount);
        Assert.Null(finalSnap.HoldExpiredLastError);
        Assert.Null(finalSnap.HoldExpiredDispatchLeaseUntilUtc);
        Assert.Null(finalSnap.HoldExpiredDeadLetteredAtUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenLeaseExpiresBeforeNextBatchItemDispatch_AbortsExpiredLeaseAndRecoversOnNextSweep()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        var h1Id = await SeedExpiredHoldAsync(fixture, roomId, "RES-BATCH-LEASE-1");
        var h2Id = await SeedExpiredHoldAsync(fixture, roomId, "RES-BATCH-LEASE-2");

        var dispatchedCodes = new List<string>();
        var batchDispatcher = new DelegateNotificationDispatcher(async (_, _, code, _, _) =>
        {
            dispatchedCodes.Add(code);
            if (code == "RES-BATCH-LEASE-1")
            {
                await Task.Delay(250); // 150ms claim lease expires before H2 dispatch begins
            }
            return true;
        });

        await using (var ctx1 = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handler1 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctx1, batchDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc,
                dispatchLeaseDuration: TimeSpan.FromMilliseconds(150));

            var swept1 = await handler1.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId),
                CancellationToken.None);
            Assert.Equal(1, swept1);
            Assert.Single(dispatchedCodes);
            Assert.Equal("RES-BATCH-LEASE-1", dispatchedCodes[0]);
        }

        // Verify H2 lease was cleared with error and not marked notified
        await using (var midCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var h2Row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(midCtx.Reservations),
                r => r.Id == h2Id);
            var h2Snap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(h2Row.Notes)!;
            Assert.Null(h2Snap.HoldExpiredNotifiedAtUtc);
            Assert.Null(h2Snap.HoldExpiredDispatchLeaseUntilUtc);
            Assert.Contains("lease expired", h2Snap.HoldExpiredLastError ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        // Second sweep immediately recovers H2 cleanly
        await using (var ctx2 = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handler2 = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctx2, batchDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc);
            var swept2 = await handler2.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId),
                CancellationToken.None);
            Assert.Equal(1, swept2);
        }

        Assert.Equal(2, dispatchedCodes.Count);
        Assert.Contains("RES-BATCH-LEASE-2", dispatchedCodes);

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var h1Final = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(
            (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
                r => r.Id == h1Id)).Notes)!;
        var h2Final = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(
            (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
                r => r.Id == h2Id)).Notes)!;
        Assert.NotNull(h1Final.HoldExpiredNotifiedAtUtc);
        Assert.NotNull(h2Final.HoldExpiredNotifiedAtUtc);
        Assert.Equal(2, h2Final.HoldExpiredDispatchAttemptCount);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_DefaultMax5Attempts_DeadLettersAfterException_AndAbandonedAttempt5SealsCleanly()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        var resMax5Id = await SeedExpiredHoldAsync(fixture, roomId, "RES-MAX5-EX");
        var resAbandoned5Id = await SeedExpiredHoldAsync(
            fixture,
            roomId,
            "RES-ABANDONED-5",
            attemptCount: 5,
            leaseUntilUtc: DateTime.UtcNow.AddSeconds(-5),
            deadLetteredAtUtc: null,
            claimOwner: "crashed-worker");

        var throwingDispatcher = new DelegateNotificationDispatcher((_, _, _, _, _) =>
            throw new InvalidOperationException("Simulated SignalR backplane outage"));

        // Run 7 sweeps using DEFAULT maxDispatchAttempts (= 5)
        for (int i = 0; i < 7; i++)
        {
            await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
            var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctx, throwingDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc);
            var swept = await handler.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId),
                CancellationToken.None);
            Assert.Equal(0, swept);
        }

        // Must execute strictly 5 attempts on RES-MAX5-EX and 0 on RES-ABANDONED-5
        Assert.Equal(HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler.DefaultMaxDispatchAttempts, throwingDispatcher.CallCount);

        await using var verifyCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var max5Snap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(
            (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
                r => r.Id == resMax5Id)).Notes)!;
        Assert.Equal(5, max5Snap.HoldExpiredDispatchAttemptCount);
        Assert.NotNull(max5Snap.HoldExpiredDeadLetteredAtUtc);
        Assert.Null(max5Snap.HoldExpiredDispatchLeaseUntilUtc);
        Assert.Null(max5Snap.HoldExpiredNotifiedAtUtc);
        Assert.Contains("Simulated SignalR backplane outage", max5Snap.HoldExpiredLastError ?? string.Empty);

        var abandonedSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(
            (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCtx.Reservations),
                r => r.Id == resAbandoned5Id)).Notes)!;
        Assert.Equal(5, abandonedSnap.HoldExpiredDispatchAttemptCount);
        Assert.NotNull(abandonedSnap.HoldExpiredDeadLetteredAtUtc);
        Assert.Null(abandonedSnap.HoldExpiredDispatchLeaseUntilUtc);
        Assert.Null(abandonedSnap.HoldExpiredNotifiedAtUtc);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_CrossTenantAndCrossPropertyScopes_FailClosedWithoutDispatching()
    {
        await using var fixture1 = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        await using var fixture2 = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);

        var wrongTenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture1.TenantId };
        var tenant1PropSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture1.PropertyId, IsTenantWide = false };
        await using var ctx = fixture2.CreateDbContext(wrongTenantSvc, tenant1PropSvc);

        var dispatcher = new DelegateNotificationDispatcher((_, _, _, _, _) => Task.FromResult(true));

        // Cross-property when non-TenantWide
        var crossBranchEx = await Assert.ThrowsAsync<HotelSaas.Application.Common.Exceptions.ForbiddenException>(() =>
        {
            var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctx, dispatcher, useInMemoryLock: false, currentTenantService: wrongTenantSvc, currentPropertyService: tenant1PropSvc);
            return handler.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(Guid.NewGuid()),
                CancellationToken.None);
        });
        Assert.Equal("ERR_CROSS_PROPERTY_MUTATION", crossBranchEx.ErrorCode);

        // Cross-tenant when TenantWide attempts to pass PropertyId belonging to Tenant 2
        var tenantWidePropSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = null, IsTenantWide = true };
        var crossTenantEx = await Assert.ThrowsAsync<HotelSaas.Application.Common.Exceptions.ForbiddenException>(() =>
        {
            var handler = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctx, dispatcher, useInMemoryLock: false, currentTenantService: wrongTenantSvc, currentPropertyService: tenantWidePropSvc);
            return handler.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture2.PropertyId),
                CancellationToken.None);
        });
        Assert.Equal("ERR_CROSS_TENANT_ACCESS", crossTenantEx.ErrorCode);
        Assert.Equal(0, dispatcher.CallCount);
    }

    [Fact]
    public async Task CheckExpiredHoldsCommandHandler_WhenCancelledAfterClaim_OrConfirmedDuringInFlightDispatch_PreservesFinalStatusAndNotNotified()
    {
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(new P5_GuestBookingTests(), roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId, IsTenantWide = false };

        Guid roomId;
        await using (var setupCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var room = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(setupCtx.Rooms, r => r.PropertyId == fixture.PropertyId);
            roomId = room.Id;
        }

        // Part A: Cancelled right after Claim commit (between Claim and Dispatch) -> 0 SignalR, clears lease
        var resCancelId = await SeedExpiredHoldAsync(fixture, roomId, "RES-CANCEL-AFTER-CLAIM");
        var cancelClient = new TestNotificationClient();
        var cancelDispatcher = new HotelSaas.Infrastructure.Services.NotificationDispatcher(
            new TestHubContext(new TestHubClients(cancelClient), new TestGroupManager()),
            NullLogger<HotelSaas.Infrastructure.Services.NotificationDispatcher>.Instance);

        await using (var rawCtxCancel = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var cancelAfterCommitCtx = new PostFirstCommitActionDbContext(rawCtxCancel, async () =>
            {
                await using var mutationCtx = fixture.CreateDbContext(tenantSvc, propSvc);
                var row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(mutationCtx.Reservations, r => r.Id == resCancelId);
                row.Status = ReservationStatus.Cancelled;
                await mutationCtx.SaveChangesAsync();
            });
            var handlerCancel = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                cancelAfterCommitCtx, cancelDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc);
            Assert.Equal(0, await handlerCancel.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));
            Assert.Empty(cancelClient.HoldExpired);
        }

        await using (var verifyCancelCtx = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
                Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyCancelCtx.Reservations),
                r => r.Id == resCancelId);
            var snap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(row.Notes)!;
            Assert.Equal(ReservationStatus.Cancelled, row.Status);
            Assert.Null(snap.HoldExpiredNotifiedAtUtc);
            Assert.Null(snap.HoldExpiredDispatchLeaseUntilUtc);
        }

        // Part B: Confirmed mid-flight INSIDE NotifyHoldExpiredAsync -> Finalize sees Confirmed, leaves Status=Confirmed, NotifiedAtUtc=null, Lease=null
        var resInFlightId = await SeedExpiredHoldAsync(fixture, roomId, "RES-CONFIRM-INFLIGHT");
        var inFlightDispatcher = new InspectOnDispatchNotificationDispatcher(async idStr =>
        {
            var id = Guid.Parse(idStr);
            await using var payCtx = fixture.CreateDbContext(tenantSvc, propSvc);
            var row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(payCtx.Reservations, r => r.Id == id);
            row.Status = ReservationStatus.Confirmed;
            await payCtx.SaveChangesAsync();
        });

        await using (var ctxInFlight = fixture.CreateDbContext(tenantSvc, propSvc))
        {
            var handlerInFlight = new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommandHandler(
                ctxInFlight, inFlightDispatcher, useInMemoryLock: false, currentTenantService: tenantSvc, currentPropertyService: propSvc);
            Assert.Equal(0, await handlerInFlight.Handle(
                new HotelSaas.Application.Public.Commands.CheckExpiredHolds.CheckExpiredHoldsCommand(fixture.PropertyId), CancellationToken.None));
            Assert.Equal(1, inFlightDispatcher.CallCount);
        }

        await using var verifyConfirmedCtx = fixture.CreateDbContext(tenantSvc, propSvc);
        var confirmedRow = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstAsync(
            Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(verifyConfirmedCtx.Reservations),
            r => r.Id == resInFlightId);
        var confirmedSnap = HotelSaas.Application.Reservations.DTOs.ReservationSnapshotHelper.TryDeserialize(confirmedRow.Notes)!;
        Assert.Equal(ReservationStatus.Confirmed, confirmedRow.Status);
        Assert.Null(confirmedSnap.HoldExpiredNotifiedAtUtc);
        Assert.Null(confirmedSnap.HoldExpiredDispatchLeaseUntilUtc);
    }
}
