namespace HotelSaas.Domain.Enums;

/// <summary>
/// Types of line items that can appear on a guest folio (bill).
/// </summary>
public enum FolioItemType
{
    /// <summary>
    /// Nightly room charge.
    /// </summary>
    RoomCharge = 1,

    /// <summary>
    /// Minibar consumption charge.
    /// </summary>
    Minibar = 2,

    /// <summary>
    /// Laundry service charge.
    /// </summary>
    Laundry = 3,

    /// <summary>
    /// Restaurant or dining charge.
    /// </summary>
    Restaurant = 4,

    /// <summary>
    /// Additional surcharge (e.g., late checkout, extra bed).
    /// </summary>
    Surcharge = 5,

    /// <summary>
    /// Discount applied to the folio.
    /// </summary>
    Discount = 6,

    /// <summary>
    /// Deposit or partial payment received.
    /// </summary>
    DepositPayment = 7,

    /// <summary>
    /// Tax line item (e.g., VAT).
    /// </summary>
    Tax = 8,

    /// <summary>
    /// Service charge percentage applied to the folio.
    /// </summary>
    ServiceCharge = 9
}
