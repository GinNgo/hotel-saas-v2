namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the accommodation rental model supported by the property.
/// </summary>
public enum RentalType
{
    /// <summary>
    /// Hourly rental with initial package and increment per hour.
    /// </summary>
    Hourly = 1,

    /// <summary>
    /// Standard overnight stay with property-level check-in and check-out schedule.
    /// </summary>
    Overnight = 2
}
