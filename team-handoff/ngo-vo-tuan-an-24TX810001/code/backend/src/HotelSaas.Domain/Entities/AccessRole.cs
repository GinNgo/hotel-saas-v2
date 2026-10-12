using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents an RBAC role that groups permissions.
/// Can be a system-defined role or a tenant-specific custom role.
/// </summary>
public class AccessRole : BaseEntity
{
    /// <summary>
    /// Unique code identifier for the role (e.g., "OWNER", "RECEPTIONIST").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable name of the role.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the role's purpose and scope.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Indicates whether this role is system-defined and cannot be modified by tenants.
    /// </summary>
    public bool IsSystemRole { get; set; }

    /// <summary>
    /// Optional tenant identifier; null for system-wide roles.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant, if tenant-scoped.
    /// </summary>
    public Tenant? Tenant { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of permission assignments for this role.
    /// </summary>
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
}
