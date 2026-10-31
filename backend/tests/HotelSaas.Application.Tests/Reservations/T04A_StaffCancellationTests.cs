using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Reservations.Commands.CancelReservation;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Queries.GetReservationCancellationPreview;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests.Reservations;

public sealed class T04A_StaffCancellationTests
{
    private readonly ICancellationPolicyService _policyService = new CancellationPolicyService();

    [Fact]
    public void PolicyService_Overnight_MoreThan24Hours_IsFreeCancellation()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 1_000_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
            Status = ReservationStatus.Confirmed,
            PointsRedeemed = 50,
            PointsRefunded = 0
        };

        var property = new Property
        {
            Id = Guid.NewGuid(),
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0)
        };

        var asOfUtc = DateTime.UtcNow;
        var paidAmount = 1_000_000m;

        var estimate = _policyService.CalculateEstimate(reservation, property, asOfUtc, paidAmount);

        Assert.True(estimate.IsFreeCancellation);
        Assert.Equal(0m, estimate.CancellationFee);
        Assert.Equal(1_000_000m, estimate.RefundableAmount);
        Assert.Equal(50, estimate.PointsRefundable);
        Assert.True(estimate.CanCancel);
    }

    [Fact]
    public void PolicyService_Overnight_LessThan24Hours_Applies30PercentFee()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 1_000_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(10)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.Confirmed,
            PointsRedeemed = 30,
            PointsRefunded = 0
        };

        var property = new Property
        {
            Id = Guid.NewGuid(),
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0)
        };

        var asOfUtc = DateTime.UtcNow;
        var paidAmount = 300_000m; // Deposit paid 30%

        var estimate = _policyService.CalculateEstimate(reservation, property, asOfUtc, paidAmount);

        Assert.False(estimate.IsFreeCancellation);
        Assert.Equal(300_000m, estimate.CancellationFee); // 30% of 1M
        Assert.Equal(0m, estimate.RefundableAmount); // Paid 300k - Fee 300k = 0
        Assert.Equal(30, estimate.PointsRefundable);
        Assert.True(estimate.CanCancel);
    }

    [Fact]
    public void PolicyService_Hourly_LessThan2Hours_Applies30PercentFee()
    {
        var tz = ReservationTimeHelper.GetVietnamTimeZone();
        var startUtc = DateTime.UtcNow.AddMinutes(90);
        var endUtc = startUtc.AddHours(2);

        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Hourly,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 400_000m
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 400_000m,
            CheckInDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(startUtc, tz)),
            CheckOutDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(endUtc, tz)),
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapshot)
        };

        var asOfUtc = DateTime.UtcNow;
        var paidAmount = 400_000m;

        var estimate = _policyService.CalculateEstimate(reservation, null, asOfUtc, paidAmount);

        Assert.False(estimate.IsFreeCancellation);
        Assert.Equal(120_000m, estimate.CancellationFee); // 30% of 400k
        Assert.Equal(280_000m, estimate.RefundableAmount); // 400k - 120k = 280k
        Assert.True(estimate.CanCancel);
    }

    [Fact]
    public void PolicyService_CheckedIn_CannotCancel()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 500_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.CheckedIn
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 500_000m);

        Assert.False(estimate.CanCancel);
        Assert.NotNull(estimate.IneligibilityReason);
        Assert.Contains("CheckedIn", estimate.IneligibilityReason);
    }

    [Fact]
    public void PolicyService_AlreadyCancelled_CannotCancelAgain()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 500_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.Cancelled
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 0m);

        Assert.False(estimate.CanCancel);
        Assert.NotNull(estimate.IneligibilityReason);
        Assert.Contains("đã bị hủy", estimate.IneligibilityReason);
    }

    [Fact]
    public void PolicyService_PointsAlreadyRefunded_ReturnsZeroPointsRefundable()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 500_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)),
            Status = ReservationStatus.Confirmed,
            PointsRedeemed = 100,
            PointsRefunded = 100 // Already refunded
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 500_000m);

        Assert.Equal(100, estimate.PointsRedeemed);
        Assert.Equal(0, estimate.PointsRefundable);
    }

    [Fact]
    public void PolicyService_PendingPayment_ZeroPaidAmount_LessThan24Hours_ZeroCancellationFee()
    {
        // Even within 24h of check-in, an unpaid hold/pending payment has ZERO cancellation fee and ZERO refund
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 2_000_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.PendingPayment
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 0m);

        Assert.True(estimate.IsFreeCancellation);
        Assert.True(estimate.IsHold);
        Assert.Equal(0m, estimate.CancellationFee);
        Assert.Equal(0m, estimate.RefundableAmount);
        Assert.True(estimate.CanCancel);
    }

    [Fact]
    public void PolicyService_PendingPayment_WithPendingPayment_IncludesReconciliationNote()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 2_000_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.PendingPayment
        };

        var estimate = _policyService.CalculateEstimate(
            reservation,
            null,
            DateTime.UtcNow,
            0m,
            hasPendingPayments: true,
            pendingPaymentAmount: 600_000m);

        Assert.True(estimate.HasPendingPayment);
        Assert.Equal(600_000m, estimate.PendingPaymentAmount);
        Assert.Contains("IPN", estimate.PolicyDescription);
    }

    [Fact]
    public void PolicyService_Confirmed_ZeroPaidAmount_ZeroCancellationFee()
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 1_500_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            Status = ReservationStatus.Confirmed
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 0m);

        Assert.True(estimate.IsFreeCancellation);
        Assert.Equal(0m, estimate.CancellationFee);
        Assert.Equal(0m, estimate.RefundableAmount);
        Assert.True(estimate.CanCancel);
    }

    [Fact]
    public void PolicyService_ExpiredHold_CannotCancel()
    {
        var snapshot = new ReservationSnapshot
        {
            IsOnlineHold = true,
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
            TotalAmount = 1_000_000m
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TotalAmount = 1_000_000m,
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snapshot)
        };

        var estimate = _policyService.CalculateEstimate(reservation, null, DateTime.UtcNow, 0m);

        Assert.False(estimate.CanCancel);
        Assert.Contains("hết hạn", estimate.IneligibilityReason);
    }
}
