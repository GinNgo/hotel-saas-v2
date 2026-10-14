using System;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Public availability summary aggregated by room type for a specified stay interval.
/// </summary>
public sealed class PublicRoomTypeAvailabilityDto
{
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxOccupancy { get; set; }
    public string? BedType { get; set; }
    public decimal? SquareMeters { get; set; }
    public string? ImageUrl { get; set; }
    public int TotalRooms { get; set; }
    public int AvailableRooms { get; set; }
    public bool IsAvailable => AvailableRooms > 0;
    public decimal EstimatedPrice { get; set; }
}
