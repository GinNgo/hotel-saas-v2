using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.DTOs;

/// <summary>
/// Summary DTO representing a guest reservation.
/// </summary>
public record ReservationDto
{
    public Guid Id { get; init; }
    public Guid TenantId { get; init; }
    public Guid PropertyId { get; init; }
    public Guid RoomId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public Guid RoomTypeId { get; init; }
    public string RoomTypeName { get; init; } = string.Empty;
    public RentalType RentalType { get; init; }
    public DateTime StartAtUtc { get; init; }
    public DateTime EndAtUtc { get; init; }
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public string GuestName { get; init; } = string.Empty;
    public string GuestEmail { get; init; } = string.Empty;
    public string? GuestPhone { get; init; }
    public int NumberOfGuests { get; init; }
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public ReservationStatus Status { get; init; }
    public string ConfirmationCode { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public string? SmartLockPin { get; init; }
    public string? SmartLockStatus { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
