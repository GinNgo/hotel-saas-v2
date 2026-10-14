using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.DTOs;

/// <summary>
/// DTO representing physical room availability for a requested time window.
/// </summary>
public sealed record RoomAvailabilityDto
{
    public Guid RoomId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public int Floor { get; init; }
    public Guid RoomTypeId { get; init; }
    public string RoomTypeName { get; init; } = string.Empty;
    public RoomStatus HousekeepingStatus { get; init; }
    public bool IsAvailable { get; init; }
    public string? ConflictReason { get; init; }
}
