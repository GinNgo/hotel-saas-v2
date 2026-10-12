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
    public DateTime CreatedAtUtc { get; set; }
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; set; } = Array.Empty<QuoteBreakdownItemDto>();
}
