namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the status of an invoice.
/// </summary>
public enum InvoiceStatus
{
    /// <summary>
    /// Invoice is in draft and has not been issued to the guest.
    /// </summary>
    Draft = 0,

    /// <summary>
    /// Invoice has been finalized and issued.
    /// </summary>
    Issued = 1,

    /// <summary>
    /// Invoice has been voided and is no longer valid.
    /// </summary>
    Voided = 2
}
