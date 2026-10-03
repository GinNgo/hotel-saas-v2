namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the billing cycle frequency for a subscription.
/// </summary>
public enum BillingCycle
{
    /// <summary>
    /// Billed every month.
    /// </summary>
    Monthly = 0,

    /// <summary>
    /// Billed every year.
    /// </summary>
    Annual = 1
}
