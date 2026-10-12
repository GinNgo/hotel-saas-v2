namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Represents an authoritative tenant and property membership context for the user.
/// </summary>
/// <param name="Id">The membership identifier (TenantStaff ID).</param>
/// <param name="TenantId">The tenant identifier.</param>
/// <param name="TenantName">The tenant name.</param>
/// <param name="TenantCode">The tenant code.</param>
/// <param name="PropertyId">The assigned property identifier, or null for tenant-wide.</param>
/// <param name="PropertyName">The property name, or null for tenant-wide.</param>
/// <param name="PropertyCode">The property code, or null for tenant-wide.</param>
/// <param name="StaffRole">The staff role enumeration as string.</param>
/// <param name="RoleName">The display name of the assigned access role.</param>
/// <param name="IsTenantWide">Whether this membership has tenant-wide authority.</param>
public sealed record UserMembershipDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string TenantCode,
    Guid? PropertyId,
    string? PropertyName,
    string? PropertyCode,
    string StaffRole,
    string RoleName,
    bool IsTenantWide);
