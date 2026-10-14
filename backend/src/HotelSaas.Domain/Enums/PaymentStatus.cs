namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the status of a payment transaction.
/// </summary>
public enum PaymentStatus
{
    /// <summary>
    /// Payment has been initiated but not yet processed.
    /// </summary>
    Pending = 1,

    /// <summary>
    /// Payment has been successfully completed.
    /// </summary>
    Completed = 2,

    /// <summary>
    /// Payment processing failed.
    /// </summary>
    Failed = 3,

    /// <summary>
    /// Payment has been refunded to the customer.
    /// </summary>
    Refunded = 4,

    /// <summary>
    /// Payment link or session has expired.
    /// </summary>
    Expired = 5
}
