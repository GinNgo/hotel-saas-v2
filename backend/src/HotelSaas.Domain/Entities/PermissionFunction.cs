using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a discrete permission function (e.g., "ManageRooms", "ViewReservations")
/// that can be assigned to roles via a bitmask-based action mask.
/// </summary>
public class PermissionFunction : BaseEntity
{
    /// <summary>
    /// Unique code identifier for the permission function (e.g., "ROOM_MANAGEMENT").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable name of the permission function.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Module code grouping related permission functions (e.g., "ROOMS", "RESERVATIONS").
    /// </summary>
    public string ModuleCode { get; set; } = string.Empty;

    /// <summary>
    /// Bitmask of all actions this function supports (default 127 = all 7 standard CRUD+ actions).
    /// </summary>
    public int SupportedActionMask { get; set; } = 127;

    /// <summary>
    /// Whether this permission function is currently active and can be assigned.
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of role-permission assignments referencing this function.
    /// </summary>
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
