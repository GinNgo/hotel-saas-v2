using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a single line item on an invoice (e.g., room charge, minibar, extra bed).
/// </summary>
public class InvoiceItem : BaseEntity
{
    /// <summary>
    /// Foreign key to the invoice this item belongs to.
    /// </summary>
    public Guid InvoiceId { get; set; }

    /// <summary>
    /// Navigation property to the parent invoice.
    /// </summary>
    public Invoice? Invoice { get; set; }

    /// <summary>
    /// Short code identifying the type of charge (e.g., "ROOM", "MINIBAR", "LAUNDRY").
    /// </summary>
    public string ItemCode { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable description of the charge.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Number of units charged.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Price per unit.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Total amount for this line item (Quantity × UnitPrice).
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Display order of this item on the invoice.
    /// </summary>
    public int SortOrder { get; set; }
}
