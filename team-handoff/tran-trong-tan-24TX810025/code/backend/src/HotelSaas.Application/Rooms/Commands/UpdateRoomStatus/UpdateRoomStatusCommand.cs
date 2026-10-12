using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;

/// <summary>
/// Command to update the housekeeping or occupancy status of a room.
/// </summary>
/// <param name="Id">The unique identifier of the room.</param>
/// <param name="Status">The new status to assign to the room.</param>
/// <param name="ExpectedOldStatus">Required expected old status for optimistic concurrency verification (fail-closed).</param>
public sealed record UpdateRoomStatusCommand(
    Guid Id,
    RoomStatus Status,
    RoomStatus? ExpectedOldStatus = null) : IRequest<RoomDto>;
