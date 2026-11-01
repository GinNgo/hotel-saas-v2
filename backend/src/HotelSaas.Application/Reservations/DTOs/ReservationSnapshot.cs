using System;
using System.Collections.Generic;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.DTOs;

/// <summary>
/// Immutable booking pricing and operational policy snapshot preserved when the reservation is created.
/// Guarantees that future rate modifications, surcharge changes, or policy adjustments never alter historical booking records.
/// </summary>
public sealed class ReservationSnapshot
{
    public RentalType RentalType { get; set; }
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public int BufferMinutes { get; set; }
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "VND";
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; set; } = Array.Empty<QuoteBreakdownItemDto>();
    public AppliedPoliciesDto AppliedPolicies { get; set; } = null!;
    public string? CustomerNotes { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime? HoldExpiresAtUtc { get; set; }
    public string? LookupToken { get; set; }
    public decimal? DepositRequired { get; set; }
    public bool IsOnlineHold { get; set; }
    public int HoldExtensionCount { get; set; }
    public DateTime? HoldExtendedAtUtc { get; set; }
    public DateTime? TokenExpiresAtUtc { get; set; }
    public bool IsTokenRevoked { get; set; }
}
