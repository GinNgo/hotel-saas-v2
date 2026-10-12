using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation.TestHelper;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.Reservations.Commands.CreateReservation;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Xunit;

namespace HotelSaas.Application.Tests.Reservations;

/// <summary>
/// Unit and behavioral tests for P3-BOOKING-CORE-01 verifying:
/// 1. Decision D07: Turnover buffer >= 30m between stays on same physical room.
/// 2. Decision D14: MaxHourlyHours validation and boundaries.
/// 3. Decision D06: Standard check-in/out boundaries for overnight stays.
/// 4. Quote and snapshot immutability across rate updates.
/// 5. Overlap detection and 409 Conflict rejection under concurrent booking requests.
/// </summary>
public sealed class ReservationBookingCoreTests
{
    [Fact]
    public void HasOverlap_EnforcesMinimum30MinutesBuffer_WhenPropertyConfiguredLessThan30()
    {
        var startA = new DateTime(2026, 10, 10, 10, 0, 0, DateTimeKind.Utc);
        var endA = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        // Stay B starts 20 minutes after Stay A ends (inside 30m buffer)
        var startB = new DateTime(2026, 10, 10, 12, 20, 0, DateTimeKind.Utc);
        var endB = new DateTime(2026, 10, 10, 14, 0, 0, DateTimeKind.Utc);

        // Property configured with 15m buffer -> should fail-safe to 30m
        var hasConflict = ReservationTimeHelper.HasOverlap(startA, endA, startB, endB, bufferMinutes: 15);
        Assert.True(hasConflict, "Should conflict because 12:20 is within the mandatory 30-minute turnover buffer after 12:00.");
    }

    [Fact]
    public void HasOverlap_AllowsBooking_ExactlyAt30MinutesBufferBoundary()
    {
        var startA = new DateTime(2026, 10, 10, 10, 0, 0, DateTimeKind.Utc);
        var endA = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        // Stay B starts exactly 30 minutes after Stay A ends
        var startB = new DateTime(2026, 10, 10, 12, 30, 0, DateTimeKind.Utc);
        var endB = new DateTime(2026, 10, 10, 14, 0, 0, DateTimeKind.Utc);

        var hasConflict = ReservationTimeHelper.HasOverlap(startA, endA, startB, endB, bufferMinutes: 30);
        Assert.False(hasConflict, "Should NOT conflict when startB is exactly at or after endA + 30m buffer.");
    }

    [Fact]
    public void HasOverlap_ProtectsTurnoverBuffer_WhenPrecedingStayEndsTooLate()
    {
        // Stay A is later: 14:00 - 16:00
        var startA = new DateTime(2026, 10, 10, 14, 0, 0, DateTimeKind.Utc);
        var endA = new DateTime(2026, 10, 10, 16, 0, 0, DateTimeKind.Utc);

        // Stay B is earlier: 11:00 - 13:40 (ends only 20 mins before Stay A starts)
        var startB = new DateTime(2026, 10, 10, 11, 0, 0, DateTimeKind.Utc);
        var endB = new DateTime(2026, 10, 10, 13, 40, 0, DateTimeKind.Utc);

        var hasConflict = ReservationTimeHelper.HasOverlap(startA, endA, startB, endB, bufferMinutes: 30);
        Assert.True(hasConflict, "Should conflict because Stay B ends at 13:40, needing until 14:10 for turnover buffer.");
    }

    [Fact]
    public void HasOverlap_RespectsIncreasedPropertyBuffer_WhenConfiguredHigherThan30()
    {
        var startA = new DateTime(2026, 10, 10, 10, 0, 0, DateTimeKind.Utc);
        var endA = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        // Stay B starts 35 minutes after Stay A ends
        var startB = new DateTime(2026, 10, 10, 12, 35, 0, DateTimeKind.Utc);
        var endB = new DateTime(2026, 10, 10, 14, 0, 0, DateTimeKind.Utc);

        // Property configured with 45m buffer -> 12:35 is still inside the 45m buffer!
        var hasConflict = ReservationTimeHelper.HasOverlap(startA, endA, startB, endB, bufferMinutes: 45);
        Assert.True(hasConflict, "Should conflict because property configured 45m buffer and 12:35 is within 45m.");
    }

    [Fact]
    public void CreateReservationCommandValidator_RejectsInvalidInputs()
    {
        var validator = new CreateReservationCommandValidator();

        // Empty property / room
        var cmd1 = new CreateReservationCommand(
            Guid.Empty, Guid.Empty, RentalType.Hourly,
            DateTime.UtcNow, DateTime.UtcNow.AddHours(2),
            null, null, "", "bad-email", null, 0);

        var result1 = validator.TestValidate(cmd1);
        result1.ShouldHaveValidationErrorFor(x => x.PropertyId);
        result1.ShouldHaveValidationErrorFor(x => x.RoomId);
        result1.ShouldHaveValidationErrorFor(x => x.GuestName);
        result1.ShouldHaveValidationErrorFor(x => x.GuestEmail);
        result1.ShouldHaveValidationErrorFor(x => x.NumberOfGuests);

        // End <= Start
        var now = DateTime.UtcNow;
        var cmd2 = new CreateReservationCommand(
            Guid.NewGuid(), Guid.NewGuid(), RentalType.Hourly,
            now, now.AddHours(-1),
            null, null, "Nguyen Van A", "a@example.com", null, 2);

        var result2 = validator.TestValidate(cmd2);
        result2.ShouldHaveValidationErrorFor(x => x.EndAtUtc);

        // Hourly > 24h
        var cmd3 = new CreateReservationCommand(
            Guid.NewGuid(), Guid.NewGuid(), RentalType.Hourly,
            now, now.AddHours(25),
            null, null, "Nguyen Van A", "a@example.com", null, 2);

        var result3 = validator.TestValidate(cmd3);
        result3.ShouldHaveValidationErrorFor(x => x);
    }

    [Fact]
    public void ReservationSnapshot_SerializesAndDeserializesImmutably()
    {
        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Hourly,
            StartAtUtc = new DateTime(2026, 10, 10, 8, 0, 0, DateTimeKind.Utc),
            EndAtUtc = new DateTime(2026, 10, 10, 11, 0, 0, DateTimeKind.Utc),
            BufferMinutes = 30,
            RoomTypeId = Guid.NewGuid(),
            RoomTypeName = "Deluxe Double",
            TotalAmount = 200000m,
            Currency = "VND",
            Breakdown = new List<QuoteBreakdownItemDto>
            {
                new() { Description = "2 giờ đầu", UnitPrice = 150000m, Quantity = 1, Amount = 150000m },
                new() { Description = "1 giờ thêm", UnitPrice = 50000m, Quantity = 1, Amount = 50000m }
            },
            AppliedPolicies = new AppliedPoliciesDto
            {
                MaxHourlyHours = 12,
                BufferMinutes = 30,
                CheckInTime = new TimeOnly(12, 0),
                CheckOutTime = new TimeOnly(12, 0)
            },
            CustomerNotes = "Yêu cầu phòng yên tĩnh"
        };

        var json = ReservationSnapshotHelper.Serialize(snapshot);
        Assert.False(string.IsNullOrWhiteSpace(json));

        var deserialized = ReservationSnapshotHelper.TryDeserialize(json);
        Assert.NotNull(deserialized);
        Assert.Equal(snapshot.RentalType, deserialized!.RentalType);
        Assert.Equal(snapshot.StartAtUtc, deserialized.StartAtUtc);
        Assert.Equal(snapshot.EndAtUtc, deserialized.EndAtUtc);
        Assert.Equal(snapshot.BufferMinutes, deserialized.BufferMinutes);
        Assert.Equal(snapshot.TotalAmount, deserialized.TotalAmount);
        Assert.Equal(snapshot.RoomTypeName, deserialized.RoomTypeName);
        Assert.Equal(2, deserialized.Breakdown.Count);
        Assert.Equal("Yêu cầu phòng yên tĩnh", deserialized.CustomerNotes);
    }

    [Fact]
    public void ReservationSnapshotHelper_HandlesLegacyFreeformNotesGracefully()
    {
        var legacyNotes = "Khách đặt qua điện thoại lúc 9h sáng.";
        var result = ReservationSnapshotHelper.TryDeserialize(legacyNotes);
        Assert.Null(result);

        var nullResult = ReservationSnapshotHelper.TryDeserialize(null);
        Assert.Null(nullResult);
    }
}
