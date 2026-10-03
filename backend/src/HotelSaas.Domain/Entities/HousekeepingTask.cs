using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a housekeeping task assigned to a room, optionally assigned to a staff member.
/// </summary>
public class HousekeepingTask : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this task belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the room that requires housekeeping.
    /// </summary>
    public Guid RoomId { get; set; }

    /// <summary>
    /// Navigation property to the room.
    /// </summary>
    public Room? Room { get; set; }

    /// <summary>
    /// Optional foreign key to the staff member assigned to this task.
    /// </summary>
    public Guid? AssignedToUserId { get; set; }

    /// <summary>
    /// Navigation property to the assigned staff member.
    /// </summary>
    public User? AssignedTo { get; set; }

    /// <summary>
    /// Current status of the housekeeping task.
    /// </summary>
    public HousekeepingTaskStatus Status { get; set; }

    /// <summary>
    /// Priority level of the task.
    /// </summary>
    public HousekeepingPriority Priority { get; set; }

    /// <summary>
    /// Optional notes or special instructions for the housekeeper.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// UTC timestamp when the task was started; null if not yet started.
    /// </summary>
    public DateTime? StartedAtUtc { get; set; }

    /// <summary>
    /// UTC timestamp when the task was completed; null if not yet completed.
    /// </summary>
    public DateTime? CompletedAtUtc { get; set; }
}
