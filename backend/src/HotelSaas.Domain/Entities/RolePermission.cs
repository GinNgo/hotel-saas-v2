using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Join entity linking an <see cref="AccessRole"/> to a <see cref="PermissionFunction"/>
/// with a bitmask specifying which actions are granted.
/// </summary>
public class RolePermission : BaseEntity
{
    /// <summary>
    /// Foreign key to the role this permission belongs to.
    /// </summary>
    public Guid RoleId { get; set; }

    /// <summary>
    /// Navigation property to the associated role.
    /// </summary>
    public AccessRole? Role { get; set; }

    /// <summary>
    /// Foreign key to the permission function being granted.
    /// </summary>
    public Guid FunctionId { get; set; }

    /// <summary>
    /// Navigation property to the associated permission function.
    /// </summary>
    public PermissionFunction? Function { get; set; }

    /// <summary>
    /// Bitmask of granted actions (e.g., Read=1, Create=2, Update=4, Delete=8).
    /// </summary>
    public int ActionMask { get; set; }
}
