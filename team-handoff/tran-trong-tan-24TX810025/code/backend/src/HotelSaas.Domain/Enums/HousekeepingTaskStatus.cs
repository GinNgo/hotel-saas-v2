namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the status of a housekeeping task.
/// </summary>
public enum HousekeepingTaskStatus
{
    /// <summary>
    /// Task has been created but not yet started.
    /// </summary>
    Pending = 1,

    /// <summary>
    /// Task is currently being worked on.
    /// </summary>
    InProgress = 2,

    /// <summary>
    /// Task has been completed.
    /// </summary>
    Completed = 3,

    /// <summary>
    /// Task has been claimed by a housekeeper but not yet started.
    /// </summary>
    Claimed = 4
}
