using System;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.Services;

/// <summary>
/// Authoritative calculation result for reservation cancellation simulation and policy evaluation.
/// Pure calculation model with zero mutations.
/// </summary>
public sealed class CancellationEstimateResult
{
    public Guid ReservationId { get; set; }
    public string ConfirmationCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public RentalType RentalType { get; set; }
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int HoursUntilCheckIn { get; set; }
    public int FreeCancellationThresholdHours { get; set; }
    public bool IsBeforeCheckIn { get; set; }
    public bool IsFreeCancellation { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DepositRequired { get; set; }
    public decimal CancellationFee { get; set; }
    public decimal RefundableAmount { get; set; }
    public int PointsRedeemed { get; set; }
    public int PointsRefundable { get; set; }
    public string PolicyDescription { get; set; } = string.Empty;
    public bool CanCancel { get; set; }
    public string? IneligibilityReason { get; set; }
    public bool IsHold { get; set; }
    public bool HasPendingPayment { get; set; }
    public decimal PendingPaymentAmount { get; set; }
}

/// <summary>
/// Domain service for calculating cancellation fees, refund amounts, and policy eligibility.
/// </summary>
public interface ICancellationPolicyService
{
    CancellationEstimateResult CalculateEstimate(
        Reservation reservation,
        Property? property,
        DateTime asOfUtc,
        decimal paidAmount,
        bool hasPendingPayments = false,
        decimal pendingPaymentAmount = 0m);
}
