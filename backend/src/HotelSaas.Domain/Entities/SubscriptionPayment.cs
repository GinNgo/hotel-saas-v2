using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a payment transaction for a subscription billing cycle.
/// </summary>
public class SubscriptionPayment : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this payment belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the subscription this payment is for.
    /// </summary>
    public Guid SubscriptionId { get; set; }

    /// <summary>
    /// Navigation property to the associated subscription.
    /// </summary>
    public Subscription? Subscription { get; set; }

    /// <summary>
    /// Payment amount in the subscription's currency.
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Method used for payment (VNPay, Cash, BankTransfer, etc.).
    /// </summary>
    public PaymentMethod Method { get; set; }

    /// <summary>
    /// Current status of the payment transaction.
    /// </summary>
    public PaymentStatus Status { get; set; }

    /// <summary>
    /// External transaction reference from the payment gateway, if applicable.
    /// </summary>
    public string? TransactionRef { get; set; }

    /// <summary>
    /// Invoice number associated with this payment, if applicable.
    /// </summary>
    public string? InvoiceNumber { get; set; }

    /// <summary>
    /// UTC timestamp when the payment was completed; null if pending or failed.
    /// </summary>
    public DateTime? PaidAtUtc { get; set; }
}
