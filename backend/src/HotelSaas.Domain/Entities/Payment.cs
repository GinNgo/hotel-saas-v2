using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a payment transaction associated with a reservation.
/// </summary>
public class Payment : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this payment belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key to the reservation this payment is for.
    /// </summary>
    public Guid ReservationId { get; set; }

    /// <summary>
    /// Navigation property to the associated reservation.
    /// </summary>
    public Reservation? Reservation { get; set; }

    /// <summary>
    /// Payment amount in the property's currency.
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Method used for payment (VNPay, Cash, BankTransfer, etc.).
    /// </summary>
    public PaymentMethod Method { get; set; }

    /// <summary>
    /// Current status of the payment transaction.
    /// </summary>
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    /// <summary>
    /// External transaction reference from the payment gateway, if applicable.
    /// </summary>
    public string? TransactionRef { get; set; }

    /// <summary>
    /// UTC timestamp when the payment was completed; null if pending or failed.
    /// </summary>
    public DateTime? PaidAtUtc { get; set; }
}
