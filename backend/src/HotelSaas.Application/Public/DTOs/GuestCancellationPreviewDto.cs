using System;
using System.Text.Json.Serialization;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Authoritative pre-cancellation preview calculated by the backend pricing & policy engine.
/// Provides the guest with transparent financial implications, cancellation fees, refundable amounts,
/// and loyalty point reconciliations prior to executing a cancellation.
/// </summary>
public sealed class GuestCancellationPreviewDto
{
    public Guid ReservationId { get; set; }
    public string ConfirmationCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RentalType RentalType { get; set; }
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DepositRequired { get; set; }
    public decimal CancellationFee { get; set; }
    public decimal RefundableAmount { get; set; }
    public int PointsRedeemed { get; set; }
    public int PointsRefundable { get; set; }
    public bool IsFreeCancellation { get; set; }
    public int HoursUntilCheckIn { get; set; }
    public int FreeCancellationThresholdHours { get; set; }
    public string PolicyDescription { get; set; } = string.Empty;
    public bool CanCancel { get; set; }
    public string? IneligibilityReason { get; set; }
    public bool IsHold { get; set; }
    public bool HasPendingPayment { get; set; }
    public decimal PendingPaymentAmount { get; set; }
}
