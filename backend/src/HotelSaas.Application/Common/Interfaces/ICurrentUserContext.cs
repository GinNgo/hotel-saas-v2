using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Represents the authenticated and verified identity, tenant, property, and staff context for the current request.
/// Populated once per request by TenantPropertyContextMiddleware.
/// </summary>
public interface ICurrentUserContext
{
    /// <summary>Authenticated user identifier.</summary>
    Guid UserId { get; }

    /// <summary>User email address.</summary>
    string Email { get; }

    /// <summary>Platform-level user role.</summary>
    GlobalUserRole GlobalRole { get; }

    /// <summary>Current tenant identifier if established.</summary>
    Guid? TenantId { get; }

    /// <summary>Current tenant lifecycle status if established.</summary>
    TenantStatus? TenantStatus { get; }

    /// <summary>Currently selected or assigned property identifier if established.</summary>
    Guid? PropertyId { get; }

    /// <summary>Currently selected or assigned property lifecycle status if established.</summary>
    PropertyStatus? PropertyStatus { get; }

    /// <summary>Staff role derived from the authoritative membership record.</summary>
    StaffRole? StaffRole { get; }

    /// <summary>Authoritative RBAC role identifier for the current context.</summary>
    Guid? RoleId { get; }

    /// <summary>Indicates whether the user operates with tenant-wide authority.</summary>
    bool IsTenantWide { get; }

    /// <summary>Indicates whether the current request is authenticated.</summary>
    bool IsAuthenticated { get; }

    /// <summary>List of property IDs explicitly excluded for the current caller (e.g., inactive exact memberships).</summary>
    IReadOnlyList<Guid> ExcludedPropertyIds { get; }

    /// <summary>Verified client IP address from the trusted connection context, if available.</summary>
    string? IpAddress => null;

    /// <summary>Sets the verified client IP address for the current request lifecycle.</summary>
    void SetIpAddress(string? ipAddress) { }

    /// <summary>
    /// Enforces that a valid tenant context is established, throwing an exception if missing (Fail-Closed).
    /// </summary>
    void EnsureTenantContext();

    /// <summary>
    /// Enforces that a valid property context is established, throwing an exception if missing (Fail-Closed).
    /// </summary>
    void EnsurePropertyContext();

    /// <summary>
    /// Sets the authenticated user identity and platform role.
    /// </summary>
    void SetUser(Guid userId, string email, GlobalUserRole globalRole);

    /// <summary>
    /// Sets the authoritative tenant, property, and staff membership context.
    /// </summary>
    void SetMembershipContext(
        Guid tenantId,
        TenantStatus tenantStatus,
        Guid? propertyId,
        PropertyStatus? propertyStatus,
        StaffRole? staffRole,
        Guid? roleId,
        bool isTenantWide);
}
