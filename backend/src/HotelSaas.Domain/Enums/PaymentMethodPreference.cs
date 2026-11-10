namespace HotelSaas.Domain.Enums;

/// <summary>Guest-selected payment method recorded when a public reservation is placed.</summary>
public enum PaymentMethodPreference
{
    Cash = 1,
    VietQR = 2,
    VNPay = 3,
    BankTransfer = 4
}
