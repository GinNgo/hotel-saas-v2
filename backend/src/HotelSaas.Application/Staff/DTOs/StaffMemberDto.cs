using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Staff.DTOs;

/// <summary>
/// Data transfer object representing a staff member assignment in a hotel or property.
/// </summary>
public sealed record StaffMemberDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? PhoneNumber { get; init; }
    public Guid? PropertyId { get; init; }
    public string? PropertyName { get; init; }
    public bool IsTenantWide { get; init; }
    public Guid RoleId { get; init; }
    public string RoleCode { get; init; } = string.Empty;
    public string RoleName { get; init; } = string.Empty;
    public StaffRole StaffRole { get; init; }
    public string StaffRoleName { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}

/// <summary>
/// Data transfer object for available RBAC access roles.
/// </summary>
public sealed record AccessRoleDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsSystemRole { get; init; }
}
