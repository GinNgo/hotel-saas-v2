using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a staff member's assignment to a specific tenant (hotel),
/// linking a user to a role within that property.
/// </summary>
public class TenantStaff : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this staff member belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Optional foreign key to the physical property/branch this staff member is scoped to.
    /// NULL indicates a tenant-wide assignment (e.g., Owner).
    /// </summary>
    public Guid? PropertyId { get; set; }

    /// <summary>
    /// Navigation property to the physical property, if property-scoped.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Indicates whether this assignment operates tenant-wide (PropertyId is NULL).
    /// </summary>
    public bool IsTenantWide => PropertyId == null;

    /// <summary>
    /// Foreign key to the user account.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the user.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// Foreign key to the RBAC role assigned to this staff member.
    /// </summary>
    public Guid RoleId { get; set; }

    /// <summary>
    /// Navigation property to the assigned role.
    /// </summary>
    public AccessRole? Role { get; set; }

    /// <summary>
    /// Functional staff role within the property (Owner, Manager, Receptionist, etc.).
    /// </summary>
    public StaffRole StaffRole { get; set; }

    /// <summary>
    /// Whether this staff assignment is currently active.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
