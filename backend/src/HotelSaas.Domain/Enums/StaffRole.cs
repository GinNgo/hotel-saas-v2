namespace HotelSaas.Domain.Enums;

/// <summary>
/// Roles that a staff member can hold within a specific tenant (hotel).
/// </summary>
public enum StaffRole
{
    /// <summary>
    /// Hotel owner with full tenant-level access.
    /// </summary>
    Owner = 1,

    /// <summary>
    /// Hotel manager with administrative capabilities.
    /// </summary>
    Manager = 2,

    /// <summary>
    /// Front desk receptionist handling check-in/check-out.
    /// </summary>
    Receptionist = 3,

    /// <summary>
    /// Housekeeping staff responsible for room cleaning tasks.
    /// </summary>
    Housekeeper = 4
}
