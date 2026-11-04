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
    public int StaffCount { get; init; }
}

/// <summary>
/// Chức năng phân quyền trong hệ thống.
/// </summary>
public sealed record PermissionFunctionDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string ModuleCode { get; init; } = string.Empty;
    public int SupportedActionMask { get; init; }
}

/// <summary>
/// Quyền hạn chi tiết cho từng chức năng theo ma trận CRUD.
/// </summary>
public sealed record RolePermissionDto
{
    public Guid FunctionId { get; init; }
    public string FunctionCode { get; init; } = string.Empty;
    public string FunctionName { get; init; } = string.Empty;
    public string ModuleCode { get; init; } = string.Empty;
    public int ActionMask { get; init; }
    public bool CanRead => (ActionMask & 1) != 0;
    public bool CanCreate => (ActionMask & 2) != 0;
    public bool CanUpdate => (ActionMask & 4) != 0;
    public bool CanDelete => (ActionMask & 8) != 0;
    public bool CanApprove => (ActionMask & 16) != 0;
    public bool CanExport => (ActionMask & 32) != 0;
}

/// <summary>
/// Chi tiết vai trò chức vụ kèm danh sách quyền CRUD.
/// </summary>
public sealed record RoleDetailDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsSystemRole { get; init; }
    public Guid? TenantId { get; init; }
    public int StaffCount { get; init; }
    public IReadOnlyList<RolePermissionDto> Permissions { get; init; } = Array.Empty<RolePermissionDto>();
}

/// <summary>
/// Đầu vào cấu hình quyền CRUD khi tạo hoặc cập nhật vai trò.
/// </summary>
public sealed record RolePermissionInput
{
    public Guid FunctionId { get; init; }
    public bool CanRead { get; init; }
    public bool CanCreate { get; init; }
    public bool CanUpdate { get; init; }
    public bool CanDelete { get; init; }
    public bool CanApprove { get; init; }
    public bool CanExport { get; init; }

    public int ToActionMask()
    {
        var mask = 0;
        if (CanRead) mask |= 1;
        if (CanCreate) mask |= 2;
        if (CanUpdate) mask |= 4;
        if (CanDelete) mask |= 8;
        if (CanApprove) mask |= 16;
        if (CanExport) mask |= 32;
        return mask;
    }
}
