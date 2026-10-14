namespace HotelSaas.Application.Rooms.DTOs;

/// <summary>
/// Data transfer object representing a physical room.
/// </summary>
/// <param name="Id">The unique identifier of the room.</param>
/// <param name="PropertyId">The identifier of the associated property branch.</param>
/// <param name="RoomNumber">The room number or identifier displayed to guests.</param>
/// <param name="Floor">The floor number where the room is located.</param>
/// <param name="Status">The current housekeeping and occupancy status of the room as a string.</param>
/// <param name="Notes">Optional internal notes about the room.</param>
/// <param name="IsActive">Whether the room is active and available for booking.</param>
/// <param name="RoomTypeId">The identifier of the associated room type.</param>
/// <param name="RoomTypeName">The display name of the associated room type.</param>
/// <param name="RoomTypeCode">The code of the associated room type.</param>
/// <param name="BasePrice">The base nightly price for this room from its room type.</param>
/// <param name="CreatedAtUtc">Timestamp when the room was created (UTC).</param>
public sealed record RoomDto(
    Guid Id,
    Guid PropertyId,
    string RoomNumber,
    int Floor,
    string Status,
    string? Notes,
    bool IsActive,
    Guid RoomTypeId,
    string RoomTypeName,
    string RoomTypeCode,
    decimal BasePrice,
    DateTime CreatedAtUtc);
