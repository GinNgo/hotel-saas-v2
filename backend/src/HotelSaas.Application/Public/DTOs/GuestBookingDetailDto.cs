using System;
using System.Collections.Generic;
using HotelSaas.Application.Quotes.DTOs;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Public booking detail view returned to the guest via secure lookup token.
/// Masks sensitive PII (Decision D02, D21) while exposing necessary status and payment reconciliation metrics.
/// </summary>
public sealed class GuestBookingDetailDto
{
    public Guid ReservationId { get; set; }
    public string ConfirmationCode { get; set; } = string.Empty;
    public string LookupToken { get; set; } = string.Empty;
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyAddress { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int NumberOfGuests { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DepositRequired { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingBalance { get; set; }
    public bool IsFullyPaid { get; set; }
    public string Status { get; set; } = string.Empty;
    public string MaskedGuestName { get; set; } = string.Empty;
    public string MaskedGuestEmail { get; set; } = string.Empty;
    public string? MaskedGuestPhone { get; set; }
    public DateTime? HoldExpiresAtUtc { get; set; }
    public int? SecondsRemaining { get; set; }
    public int HoldExtensionCount { get; set; }
    public DateTime? HoldExtendedAtUtc { get; set; }
    public bool CanExtendHold { get; set; }
    public string? SmartLockPin { get; set; }
    public string? SmartLockStatus { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public string? CancellationReason { get; set; }
    public decimal? CancellationFee { get; set; }
    public decimal? RefundableAmount { get; set; }
    public string? RefundStatus { get; set; }
    public bool IsPhoneVerified { get; set; }
    public bool HasReviewed { get; set; }
    public GuestBookingReviewSummaryDto? ExistingReview { get; set; }
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; set; } = Array.Empty<QuoteBreakdownItemDto>();
}

/// <summary>
/// Summary of an existing verified guest review attached to a booking detail lookup.
/// </summary>
public sealed class GuestBookingReviewSummaryDto
{
    public Guid Id { get; set; }
    public int Rating { get; set; }
    public int? CleanlinessRating { get; set; }
    public int? LocationRating { get; set; }
    public int? ServiceRating { get; set; }
    public int? ValueRating { get; set; }
    public string? Comment { get; set; }
    public string? OwnerReply { get; set; }
    public DateTime? RepliedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
