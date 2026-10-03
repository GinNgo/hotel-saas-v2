namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of a tenant (hotel).
/// </summary>
public enum TenantStatus
{
    /// <summary>
    /// Tenant has registered but is awaiting admin approval.
    /// </summary>
    PendingApproval = 1,

    /// <summary>
    /// Tenant is active and fully operational.
    /// </summary>
    Active = 2,

    /// <summary>
    /// Tenant has been suspended by the platform administrator.
    /// </summary>
    Suspended = 3
}
