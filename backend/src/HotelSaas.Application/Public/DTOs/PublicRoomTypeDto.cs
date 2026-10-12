using System;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Public specification of a room type for guest selection and quotes.
/// </summary>
public sealed class PublicRoomTypeDto
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int MaxOccupancy { get; set; }
    public string? BedType { get; set; }
    public decimal? SquareMeters { get; set; }
    public string? ImageUrl { get; set; }
}
