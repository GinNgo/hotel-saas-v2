using HotelSaas.Application.Rooms.DTOs;
using MediatR;

namespace HotelSaas.Application.Rooms.Commands.CreateRoom;

/// <summary>
/// Command to create a new physical room in the property.
/// </summary>
/// <param name="RoomNumber">The room number or identifier displayed to guests (e.g., "101").</param>
/// <param name="RoomTypeId">The identifier of the room type classification.</param>
/// <param name="Floor">The floor number where the room is located.</param>
/// <param name="Notes">Optional internal notes regarding the room.</param>
/// <param name="PropertyId">Optional property identifier. If omitted, inferred from the associated RoomType's PropertyId.</param>
public sealed record CreateRoomCommand(
    string RoomNumber,
    Guid RoomTypeId,
    int Floor,
    string? Notes,
    Guid? PropertyId = null) : IRequest<RoomDto>;

