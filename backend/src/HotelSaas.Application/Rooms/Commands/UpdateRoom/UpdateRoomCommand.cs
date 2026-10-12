using HotelSaas.Application.Rooms.DTOs;
using MediatR;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoom;

/// <summary>
/// Command to update an existing room's details.
/// </summary>
/// <param name="Id">The unique identifier of the room to update.</param>
/// <param name="RoomNumber">The updated room number or identifier displayed to guests.</param>
/// <param name="RoomTypeId">The updated room type identifier.</param>
/// <param name="Floor">The updated floor number.</param>
/// <param name="Notes">Optional updated internal notes about the room.</param>
/// <param name="IsActive">Whether the room is active and available for booking.</param>
/// <param name="PropertyId">Optional branch identifier for cross-context verification.</param>
public sealed record UpdateRoomCommand(
    Guid Id,
    string RoomNumber,
    Guid RoomTypeId,
    int Floor,
    string? Notes,
    bool IsActive,
    Guid? PropertyId = null) : IRequest<RoomDto>;
