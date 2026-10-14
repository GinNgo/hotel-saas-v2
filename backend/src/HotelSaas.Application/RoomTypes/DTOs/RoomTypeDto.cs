namespace HotelSaas.Application.RoomTypes.DTOs;

/// <summary>
/// Data transfer object representing a room type.
/// </summary>
/// <param name="Id">The unique identifier of the room type.</param>
/// <param name="PropertyId">The identifier of the associated property branch.</param>
/// <param name="Name">The display name of the room type.</param>
/// <param name="Code">The unique code identifier within the tenant (e.g., "DLX", "STD").</param>
/// <param name="Description">Optional description of the room type and its amenities.</param>
/// <param name="BasePrice">The base nightly price for this room type.</param>
/// <param name="MaxOccupancy">The maximum number of guests accommodated.</param>
/// <param name="BedType">Optional description of bed configuration.</param>
/// <param name="SquareMeters">Optional room area in square meters.</param>
/// <param name="ImageUrl">Optional representative image URL.</param>
/// <param name="RoomCount">The number of physical rooms belonging to this room type.</param>
/// <param name="CreatedAtUtc">Timestamp when the room type was created (UTC).</param>
public sealed record RoomTypeDto(
    Guid Id,
    Guid PropertyId,
    string Name,
    string Code,
    string? Description,
    decimal BasePrice,
    int MaxOccupancy,
    string? BedType,
    decimal? SquareMeters,
    string? ImageUrl,
    int RoomCount,
    DateTime CreatedAtUtc);
