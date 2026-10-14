using HotelSaas.Domain.Enums;

namespace HotelSaas.WebApi.Models;

/// <summary>
/// Request model for updating the housekeeping or occupancy status of a room.
/// </summary>
/// <param name="Status">The new status to apply to the room.</param>
/// <param name="ExpectedOldStatus">Required expected old status for optimistic concurrency verification (fail-closed).</param>
public sealed record UpdateRoomStatusRequest(
    RoomStatus Status,
    RoomStatus? ExpectedOldStatus = null);
