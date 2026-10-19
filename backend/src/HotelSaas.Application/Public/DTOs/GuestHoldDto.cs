using System;
using System.Collections.Generic;
using HotelSaas.Application.Quotes.DTOs;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Return payload when an online guest creates a 15-minute temporary room hold.
/// </summary>
public sealed class GuestHoldDto
{
    public Guid ReservationId { get; set; }
    public string ConfirmationCode { get; set; } = string.Empty;
    public string LookupToken { get; set; } = string.Empty;
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public Guid AssignedRoomId { get; set; }
    public string AssignedRoomNumber { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DepositRequired { get; set; }
    public string Currency { get; set; } = "VND";
    public DateTime HoldExpiresAtUtc { get; set; }
    public int SecondsRemaining { get; set; }
    public string Status { get; set; } = "PendingPayment";
    public int PointsRedeemed { get; set; }
    public decimal PointsDiscountAmount { get; set; }
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; set; } = Array.Empty<QuoteBreakdownItemDto>();
}
