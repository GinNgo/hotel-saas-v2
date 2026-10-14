using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Commands.UpdateRoomType;

/// <summary>
/// Command to update an existing room type.
/// </summary>
/// <param name="Id">The unique identifier of the room type to update.</param>
/// <param name="Name">The updated display name of the room type.</param>
/// <param name="Code">The updated uppercase code identifier within the tenant.</param>
/// <param name="Description">Optional updated description of the room type and amenities.</param>
/// <param name="BasePrice">The updated base nightly price for this room type.</param>
/// <param name="MaxOccupancy">The updated maximum number of guests accommodated.</param>
/// <param name="BedType">Optional updated description of bed configuration.</param>
/// <param name="SquareMeters">Optional updated room area in square meters.</param>
/// <param name="ImageUrl">Optional updated representative image URL.</param>
/// <param name="PropertyId">Optional branch identifier for cross-context verification.</param>
public sealed record UpdateRoomTypeCommand(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    decimal BasePrice,
    int MaxOccupancy,
    string? BedType,
    decimal? SquareMeters,
    string? ImageUrl,
    Guid? PropertyId = null) : IRequest<RoomTypeDto>;
