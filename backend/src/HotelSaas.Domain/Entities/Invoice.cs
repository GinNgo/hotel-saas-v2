using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a formal invoice issued for a reservation, including guest and property details,
/// line-item totals, taxes, and payment tracking.
/// </summary>
public class Invoice : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this invoice belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the reservation this invoice covers.
    /// </summary>
    public Guid ReservationId { get; set; }

    /// <summary>
    /// Navigation property to the associated reservation.
    /// </summary>
    public Reservation? Reservation { get; set; }

    /// <summary>
    /// Unique invoice number for identification and reference (e.g., "INV-20260101-001").
    /// </summary>
    public string InvoiceNumber { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the invoice was issued.
    /// </summary>
    public DateTime IssuedAtUtc { get; set; }

    // ── Guest Information ───────────────────────────────────────────────

    /// <summary>
    /// Name of the guest as printed on the invoice.
    /// </summary>
    public string GuestName { get; set; } = string.Empty;

    /// <summary>
    /// Guest's identity document number (passport, CCCD, etc.).
    /// </summary>
    public string? GuestIdNumber { get; set; }

    /// <summary>
    /// Guest's contact phone number.
    /// </summary>
    public string? GuestPhone { get; set; }

    /// <summary>
    /// Guest's contact email address.
    /// </summary>
    public string? GuestEmail { get; set; }

    // ── Property Information ────────────────────────────────────────────

    /// <summary>
    /// Name of the issuing property as printed on the invoice.
    /// </summary>
    public string PropertyName { get; set; } = string.Empty;

    /// <summary>
    /// Address of the issuing property.
    /// </summary>
    public string PropertyAddress { get; set; } = string.Empty;

    /// <summary>
    /// Phone number of the issuing property.
    /// </summary>
    public string? PropertyPhone { get; set; }

    /// <summary>
    /// Tax identification code of the issuing property.
    /// </summary>
    public string? PropertyTaxCode { get; set; }

    // ── Financial Summary ───────────────────────────────────────────────

    /// <summary>
    /// Subtotal before taxes, service fees, and discounts.
    /// </summary>
    public decimal Subtotal { get; set; }

    /// <summary>
    /// Tax rate applied as a decimal (e.g., 0.10 for 10%).
    /// </summary>
    public decimal TaxRate { get; set; }

    /// <summary>
    /// Calculated tax amount.
    /// </summary>
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// Service fee rate applied as a decimal.
    /// </summary>
    public decimal ServiceFeeRate { get; set; }

    /// <summary>
    /// Calculated service fee amount.
    /// </summary>
    public decimal ServiceFeeAmount { get; set; }

    /// <summary>
    /// Total discount amount applied to the invoice.
    /// </summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>
    /// Grand total including taxes and fees, minus discounts.
    /// </summary>
    public decimal GrandTotal { get; set; }

    /// <summary>
    /// Total amount that has been paid against this invoice.
    /// </summary>
    public decimal PaidAmount { get; set; }

    /// <summary>
    /// Remaining balance (GrandTotal − PaidAmount).
    /// </summary>
    public decimal Balance { get; set; }

    /// <summary>
    /// Optional notes or remarks on the invoice.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Current status of the invoice.
    /// </summary>
    public InvoiceStatus Status { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of line items on this invoice.
    /// </summary>
    public ICollection<InvoiceItem> InvoiceItems { get; set; } = new List<InvoiceItem>();
}
