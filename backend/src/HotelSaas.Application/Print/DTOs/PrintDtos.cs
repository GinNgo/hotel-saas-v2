using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Print.DTOs;

public sealed class PrintableInvoiceDto
{
    public Guid ReservationId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ConfirmationCode { get; set; } = string.Empty;
    public DateTime IssuedDate { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int NumberOfGuests { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatRate { get; set; } = 8m;
    public decimal VatAmount { get; set; }
    public decimal ServiceFeeAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string VietQrImageUrl { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; }
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public List<InvoiceLineItemDto> Items { get; set; } = new();
}

public sealed class InvoiceLineItemDto
{
    public string Description { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}

public sealed class PrintableVoucherDto
{
    public string ConfirmationCode { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyAddress { get; set; } = string.Empty;
    public string PropertyPhone { get; set; } = string.Empty;
    public string PropertyEmail { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public string CheckInTime { get; set; } = "14:00";
    public DateOnly CheckOutDate { get; set; }
    public string CheckOutTime { get; set; } = "12:00";
    public int NumberOfGuests { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BedType { get; set; } = string.Empty;
    public decimal SquareMeters { get; set; }
    public string PolicyNote { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string? SpecialRequests { get; set; }
    public string QrCodeData { get; set; } = string.Empty;
}

public sealed class PrintableContractDto
{
    public Guid ContractId { get; set; }
    public string ContractNumber { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime SignedDate { get; set; }
    public DateTime? SignedAtUtc { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsSigned { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string PlatformCompanyName { get; set; } = string.Empty;
    public string PlatformAddress { get; set; } = string.Empty;
    public string PlatformTaxCode { get; set; } = string.Empty;
    public string PlatformHotline { get; set; } = string.Empty;
    public string PlatformRepresentative { get; set; } = string.Empty;
    public string TenantCompanyName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string TenantRepresentative { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string TenantPhone { get; set; } = string.Empty;
    public string TenantAddress { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public string DigitalSignatureHash { get; set; } = string.Empty;
    public string TermsAndConditions { get; set; } = string.Empty;
}

public sealed class PrintTemplateSettingsDto
{
    public Guid? Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? PropertyId { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; }
    public string DefaultPaperSize { get; set; } = "A4";
}
