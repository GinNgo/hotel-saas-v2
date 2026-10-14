namespace HotelSaas.Domain.Enums;

/// <summary>
/// Supported payment methods for the platform.
/// </summary>
public enum PaymentMethod
{
    /// <summary>
    /// VNPay online payment gateway.
    /// </summary>
    VNPay = 1,

    /// <summary>
    /// Cash payment at the front desk.
    /// </summary>
    Cash = 2,

    /// <summary>
    /// Direct bank transfer.
    /// </summary>
    BankTransfer = 3,

    /// <summary>
    /// Credit or debit card payment.
    /// </summary>
    CreditCard = 4
}
