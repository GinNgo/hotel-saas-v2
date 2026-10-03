namespace HotelSaas.Domain.Enums;

/// <summary>
/// Priority levels for housekeeping tasks.
/// </summary>
public enum HousekeepingPriority
{
    /// <summary>
    /// Low priority — can be deferred.
    /// </summary>
    Low = 1,

    /// <summary>
    /// Normal priority — standard cleaning schedule.
    /// </summary>
    Normal = 2,

    /// <summary>
    /// High priority — should be handled soon.
    /// </summary>
    High = 3,

    /// <summary>
    /// Urgent — requires immediate attention.
    /// </summary>
    Urgent = 4
}
