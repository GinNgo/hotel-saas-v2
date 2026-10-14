using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Common.Models;

/// <summary>
/// Status codes representing the outcome of deterministic membership resolution.
/// </summary>
public enum MembershipLookupStatus
{
    /// <summary>Membership successfully validated and authoritative context resolved.</summary>
    Success = 1,

    /// <summary>User not found or is marked inactive (User.IsActive == false).</summary>
    UserNotFoundOrInactive = 2,

    /// <summary>Tenant not found or not in Active status (Tenant.Status != Active).</summary>
    TenantNotFoundOrInactive = 3,

    /// <summary>
    /// Exact membership at the target property is explicitly inactive/revoked.
    /// Fail-Closed: Strictly blocks access with HTTP 403 ERR_MEMBERSHIP_REVOKED, no fallback to tenant-wide authority.
    /// </summary>
    MembershipRevoked = 4,

    /// <summary>User has no membership for the requested property and is not tenant-wide.</summary>
    PropertyForbidden = 5,

    /// <summary>
    /// Business endpoint invoked without a property ID by a user possessing only branch-scoped memberships.
    /// Fail-Closed: HTTP 403 ERR_PROPERTY_REQUIRED.
    /// </summary>
    PropertyRequired = 6,

    /// <summary>User has no membership records whatsoever under this tenant.</summary>
    NoMembership = 7,

    /// <summary>Target property does not exist or does not belong to the tenant.</summary>
    PropertyNotFound = 8,

    /// <summary>Target property exists but is not in Active status.</summary>
    PropertyInactive = 9
}

/// <summary>
/// Detailed result of authoritative membership resolution for a request.
/// </summary>
public sealed class MembershipLookupResult
{
    /// <summary>Resolution status.</summary>
    public MembershipLookupStatus Status { get; init; }

    /// <summary>Authoritative RBAC role identifier.</summary>
    public Guid? RoleId { get; init; }

    /// <summary>Authoritative staff role enum.</summary>
    public StaffRole? StaffRole { get; init; }

    /// <summary>Assigned working property identifier, or null if operating in pure tenant-wide scope.</summary>
    public Guid? PropertyId { get; init; }

    /// <summary>Actual status of the assigned working property, or null if operating in pure tenant-wide scope.</summary>
    public PropertyStatus? PropertyStatus { get; init; }

    /// <summary>True if caller possesses tenant-wide authority.</summary>
    public bool IsTenantWide { get; init; }

    /// <summary>Property IDs where the user has explicit inactive memberships (excluded from tenant-wide views).</summary>
    public IReadOnlyList<Guid> ExcludedPropertyIds { get; init; } = Array.Empty<Guid>();

    /// <summary>Human-readable error description when resolution fails.</summary>
    public string? ErrorMessage { get; init; }

    /// <summary>Creates a successful resolution result.</summary>
    public static MembershipLookupResult Succeeded(
        Guid roleId,
        StaffRole staffRole,
        Guid? propertyId,
        bool isTenantWide,
        IReadOnlyList<Guid>? excludedPropertyIds = null,
        PropertyStatus? propertyStatus = null)
    {
        return new MembershipLookupResult
        {
            Status = MembershipLookupStatus.Success,
            RoleId = roleId,
            StaffRole = staffRole,
            PropertyId = propertyId,
            PropertyStatus = propertyStatus,
            IsTenantWide = isTenantWide,
            ExcludedPropertyIds = excludedPropertyIds ?? Array.Empty<Guid>()
        };
    }

    /// <summary>Creates a failed resolution result.</summary>
    public static MembershipLookupResult Failed(MembershipLookupStatus status, string message)
    {
        return new MembershipLookupResult
        {
            Status = status,
            ErrorMessage = message
        };
    }
}
