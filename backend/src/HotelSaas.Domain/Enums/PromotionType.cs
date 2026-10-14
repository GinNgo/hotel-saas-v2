namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the type of discount a promotion applies.
/// </summary>
public enum PromotionType
{
    /// <summary>
    /// Discount applied as a percentage of the total.
    /// </summary>
    PercentDiscount = 0,

    /// <summary>
    /// Discount applied as a fixed monetary amount.
    /// </summary>
    FixedDiscount = 1,

    /// <summary>
    /// One or more complimentary nights included in the stay.
    /// </summary>
    FreeNight = 2
}
