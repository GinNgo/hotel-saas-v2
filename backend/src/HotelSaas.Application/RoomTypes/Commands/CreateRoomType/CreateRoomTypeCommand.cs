using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomType;

/// <summary>
/// Command to create a new room type for the current tenant.
/// </summary>
/// <param name="Name">The display name of the room type.</param>
/// <param name="Code">The unique uppercase code identifier within the tenant (e.g., "DLX").</param>
/// <param name="Description">Optional description of the room type and amenities.</param>
/// <param name="BasePrice">The base nightly price for this room type.</param>
/// <param name="MaxOccupancy">The maximum number of guests accommodated.</param>
/// <param name="BedType">Optional description of bed configuration.</param>
/// <param name="SquareMeters">Optional room area in square meters.</param>
/// <param name="ImageUrl">Optional representative image URL.</param>
/// <param name="PropertyId">Optional property identifier. If omitted, resolved to tenant's sole active property.</param>
public sealed record CreateRoomTypeCommand(
    string Name,
    string Code,
    string? Description,
    decimal BasePrice,
    int MaxOccupancy,
    string? BedType,
    decimal? SquareMeters,
    string? ImageUrl,
    Guid? PropertyId = null) : IRequest<RoomTypeDto>;

