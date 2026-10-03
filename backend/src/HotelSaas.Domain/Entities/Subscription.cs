using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a tenant's subscription plan, including tier, billing cycle, and lifecycle status.
/// </summary>
public class Subscription : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this subscription belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Subscription tier determining feature availability and limits.
    /// </summary>
    public SubscriptionTier Tier { get; set; }

    /// <summary>
    /// Billing frequency for this subscription.
    /// </summary>
    public BillingCycle BillingCycle { get; set; }

    /// <summary>
    /// Current lifecycle status of the subscription.
    /// </summary>
    public SubscriptionStatus Status { get; set; }

    /// <summary>
    /// Price charged per billing cycle in the subscription's currency.
    /// </summary>
    public decimal PricePerCycle { get; set; }

    /// <summary>
    /// ISO 4217 currency code for the subscription price.
    /// </summary>
    public string Currency { get; set; } = "VND";

    /// <summary>
    /// UTC timestamp when the trial period ends; null if not on trial.
    /// </summary>
    public DateTime? TrialEndsAtUtc { get; set; }

    /// <summary>
    /// UTC timestamp when the current billing period started.
    /// </summary>
    public DateTime CurrentPeriodStartUtc { get; set; }

    /// <summary>
    /// UTC timestamp when the current billing period ends.
    /// </summary>
    public DateTime CurrentPeriodEndUtc { get; set; }

    /// <summary>
    /// Whether the subscription should automatically renew at the end of the billing period.
    /// </summary>
    public bool AutoRenew { get; set; } = true;

    /// <summary>
    /// UTC timestamp when the subscription was cancelled; null if active.
    /// </summary>
    public DateTime? CancelledAtUtc { get; set; }

    /// <summary>
    /// Reason provided for cancellation; null if not cancelled.
    /// </summary>
    public string? CancelReason { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of payments associated with this subscription.
    /// </summary>
    public ICollection<SubscriptionPayment> SubscriptionPayments { get; set; } = new List<SubscriptionPayment>();
}
