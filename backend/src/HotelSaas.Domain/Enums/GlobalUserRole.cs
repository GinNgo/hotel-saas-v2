namespace HotelSaas.Domain.Enums;

/// <summary>
/// Defines the global roles a user can have across the platform.
/// </summary>
public enum GlobalUserRole
{
    /// <summary>
    /// Platform-wide administrator with full system access.
    /// </summary>
    SuperAdmin = 1,

    /// <summary>
    /// End-user customer who books rooms.
    /// </summary>
    Customer = 2,

    /// <summary>
    /// Staff member belonging to a specific tenant/hotel.
    /// </summary>
    TenantStaff = 3
}
