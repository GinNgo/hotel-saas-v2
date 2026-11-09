using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.Queries.GetGuestBookingByToken;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

/// <summary>
/// Verifies Option A (Strict Gate) dual verification for online room holds:
/// 1. Missing phone number throws ERR_INVALID_GUEST_PHONE.
/// 2. Anonymous guest without token throws ERR_PHONE_VERIFICATION_REQUIRED.
/// 3. Anonymous guest with mismatched phone token throws ERR_PHONE_MISMATCH.
/// 4. Anonymous guest with valid matching token succeeds and sets IsPhoneVerified = true.
/// 5. Authenticated guest with pre-verified phone in profile bypasses OTP and sets IsPhoneVerified = true.
/// 6. Lookup token query reveals verified phone status (IsPhoneVerified = true).
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class CreateGuestHoldPhoneVerificationTests
{
    private static IFirebaseAuthService CreateFirebaseAuthService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["Firebase:ProjectId"] = "hotelsaas-platform-test"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new FirebaseAuthService(config, NullLogger<FirebaseAuthService>.Instance);
    }

    [Fact]
    public async Task CreateGuestHold_MissingPhone_ThrowsBadRequestException()
    {
        var testSuite = new P5_GuestBookingTests();
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(testSuite, roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var firebaseAuth = CreateFirebaseAuthService();
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc, firebaseAuth);

        var startUtc = new DateTime(2026, 11, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 11, 21, 5, 0, 0, DateTimeKind.Utc);

        var cmd = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "No Phone Guest",
            GuestEmail: "nophone@example.com",
            GuestPhone: "", // Empty phone
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 11, 20),
            CheckOutDate: new DateOnly(2026, 11, 21)
        );

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_INVALID_GUEST_PHONE", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateGuestHold_AnonymousGuest_WithoutToken_ThrowsERR_PHONE_VERIFICATION_REQUIRED()
    {
        var testSuite = new P5_GuestBookingTests();
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(testSuite, roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var firebaseAuth = CreateFirebaseAuthService();
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc, firebaseAuth);

        var startUtc = new DateTime(2026, 11, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 11, 21, 5, 0, 0, DateTimeKind.Utc);

        var cmd = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Anonymous Guest",
            GuestEmail: "anon@example.com",
            GuestPhone: "0123456789",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 11, 20),
            CheckOutDate: new DateOnly(2026, 11, 21),
            FirebaseIdToken: null // Missing token!
        );

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_PHONE_VERIFICATION_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateGuestHold_AnonymousGuest_WithMismatchedPhoneToken_ThrowsERR_PHONE_MISMATCH()
    {
        var testSuite = new P5_GuestBookingTests();
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(testSuite, roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var firebaseAuth = CreateFirebaseAuthService();
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc, firebaseAuth);

        var startUtc = new DateTime(2026, 11, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 11, 21, 5, 0, 0, DateTimeKind.Utc);

        // Token is for +84999888777, but booking phone is 0123456789 (+84123456789)
        var cmd = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Mismatched Guest",
            GuestEmail: "mismatch@example.com",
            GuestPhone: "0123456789",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 11, 20),
            CheckOutDate: new DateOnly(2026, 11, 21),
            FirebaseIdToken: "dev-mock-token:+84999888777"
        );

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_PHONE_MISMATCH", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateGuestHold_AnonymousGuest_WithValidMatchingToken_Succeeds_AndSetsPhoneVerified()
    {
        var testSuite = new P5_GuestBookingTests();
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(testSuite, roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);
        var pc = new PricingCalculator(ctx);
        var firebaseAuth = CreateFirebaseAuthService();
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc, firebaseAuth);

        var startUtc = new DateTime(2026, 11, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 11, 21, 5, 0, 0, DateTimeKind.Utc);

        // User enters local "0123456789", token is verified "+84123456789"
        var cmd = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Verified Guest",
            GuestEmail: "verified@example.com",
            GuestPhone: "0123456789",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 11, 20),
            CheckOutDate: new DateOnly(2026, 11, 21),
            FirebaseIdToken: "dev-mock-token:+84123456789"
        );

        var hold = await handler.Handle(cmd, CancellationToken.None);

        Assert.NotNull(hold);
        Assert.True(hold.IsPhoneVerified);
        Assert.Equal(ReservationStatus.PendingPayment.ToString(), hold.Status);

        // Verify Reservation snapshot in DB
        var savedRes = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == hold.ReservationId);
        var snap = ReservationSnapshotHelper.TryDeserialize(savedRes.Notes);
        Assert.NotNull(snap);
        Assert.True(snap.IsPhoneVerified);
        Assert.NotNull(snap.PhoneVerifiedAtUtc);

        // Verify Query by LookupToken reflects IsPhoneVerified
        var queryHandler = new GetGuestBookingByTokenQueryHandler(ctx);
        var bookingDetail = await queryHandler.Handle(new GetGuestBookingByTokenQuery(hold.LookupToken), CancellationToken.None);
        Assert.NotNull(bookingDetail);
        Assert.True(bookingDetail.IsPhoneVerified);
    }

    [Fact]
    public async Task CreateGuestHold_AuthenticatedGuest_WithPreVerifiedPhone_BypassesToken_AndSetsPhoneVerified()
    {
        var testSuite = new P5_GuestBookingTests();
        await using var fixture = await P5_GuestBookingTests.TestFixture.CreateAsync(testSuite, roomCount: 1);
        var tenantSvc = new P5_GuestBookingTests.MockTenantService { TenantId = fixture.TenantId };
        var propSvc = new P5_GuestBookingTests.MockPropertyService { PropertyId = fixture.PropertyId };
        await using var ctx = fixture.CreateDbContext(tenantSvc, propSvc);

        // Seed authenticated customer with pre-verified phone
        var memberUser = new User
        {
            Id = Guid.NewGuid(),
            Username = "+84123456789",
            Email = "member.verified@example.com",
            FullName = "Member Nguyen Van A",
            PhoneNumber = "+84123456789",
            PhoneVerifiedAtUtc = DateTime.UtcNow.AddDays(-10),
            PasswordHash = "dummyhash",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        };
        ctx.Users.Add(memberUser);
        await ctx.SaveChangesAsync();

        var pc = new PricingCalculator(ctx);
        var firebaseAuth = CreateFirebaseAuthService();
        var handler = new CreateGuestHoldCommandHandler(ctx, pc, tenantSvc, propSvc, firebaseAuth);

        var startUtc = new DateTime(2026, 11, 20, 7, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2026, 11, 21, 5, 0, 0, DateTimeKind.Utc);

        // User is logged in and booking with their verified phone -> NO token required!
        var cmd = new CreateGuestHoldCommand(
            PropertySlug: fixture.PropertySlug,
            RoomTypeId: fixture.RoomTypeId,
            RentalType: RentalType.Overnight,
            StartAtUtc: startUtc,
            EndAtUtc: endUtc,
            GuestName: "Member Nguyen Van A",
            GuestEmail: "member.verified@example.com",
            GuestPhone: "0123456789",
            NumberOfGuests: 1,
            CheckInDate: new DateOnly(2026, 11, 20),
            CheckOutDate: new DateOnly(2026, 11, 21),
            GuestUserId: memberUser.Id,
            FirebaseIdToken: null // No token needed!
        );

        var hold = await handler.Handle(cmd, CancellationToken.None);

        Assert.NotNull(hold);
        Assert.True(hold.IsPhoneVerified);

        // Check DB snapshot
        var savedRes = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == hold.ReservationId);
        var snap = ReservationSnapshotHelper.TryDeserialize(savedRes.Notes);
        Assert.NotNull(snap);
        Assert.True(snap.IsPhoneVerified);
    }
}
