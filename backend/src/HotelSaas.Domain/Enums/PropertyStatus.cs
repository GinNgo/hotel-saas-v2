namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the operational lifecycle status of a physical property (branch).
/// </summary>
public enum PropertyStatus
{
    /// <summary>
    /// Property is inactive or closed.
    /// </summary>
    Inactive = 0,

    /// <summary>
    /// Property is active and operational.
    /// </summary>
    Active = 1,

    /// <summary>
    /// Property is temporarily suspended.
    /// </summary>
    Suspended = 2
}
