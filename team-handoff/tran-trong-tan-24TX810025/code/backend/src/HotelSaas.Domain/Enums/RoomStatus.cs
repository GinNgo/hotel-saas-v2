namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the current housekeeping and occupancy status of a room.
/// </summary>
public enum RoomStatus
{
    /// <summary>
    /// Room has been cleaned and is ready for guests.
    /// </summary>
    Clean = 1,

    /// <summary>
    /// Room needs cleaning.
    /// </summary>
    Dirty = 2,

    /// <summary>
    /// Room is currently being cleaned.
    /// </summary>
    Cleaning = 3,

    /// <summary>
    /// Room is currently occupied by a guest.
    /// </summary>
    Occupied = 4,

    /// <summary>
    /// Room is out of service for maintenance or other reasons.
    /// </summary>
    OutOfService = 5
}
