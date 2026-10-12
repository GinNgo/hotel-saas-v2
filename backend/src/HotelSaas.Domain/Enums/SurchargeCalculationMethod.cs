namespace HotelSaas.Domain.Enums;

/// <summary>
/// Defines how a surcharge fee is computed.
/// </summary>
public enum SurchargeCalculationMethod
{
    /// <summary>
    /// Calculated as a percentage of the applicable nightly room rate (e.g., 30% or 50%).
    /// </summary>
    PercentageOfNightly = 1,

    /// <summary>
    /// Fixed flat monetary amount regardless of room rate.
    /// </summary>
    FlatAmount = 2
}
