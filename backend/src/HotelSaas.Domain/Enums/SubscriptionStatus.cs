namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of a tenant's subscription.
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>
    /// Subscription is in trial period.
    /// </summary>
    Trial = 0,

    /// <summary>
    /// Subscription is active and paid.
    /// </summary>
    Active = 1,

    /// <summary>
    /// Payment is overdue but the subscription has not been suspended yet.
    /// </summary>
    PastDue = 2,

    /// <summary>
    /// Subscription has been suspended due to non-payment or policy violation.
    /// </summary>
    Suspended = 3,

    /// <summary>
    /// Subscription has been cancelled.
    /// </summary>
    Cancelled = 4
}
