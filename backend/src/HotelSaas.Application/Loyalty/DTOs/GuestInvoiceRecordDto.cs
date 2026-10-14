using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Loyalty.DTOs;

public sealed class GuestInvoiceRecordDto
{
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid ReservationId { get; set; }
    public string ReservationCode { get; set; } = string.Empty;
    public string TenantBrandName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyType { get; set; } = "Hotel";
    public string PropertyAddress { get; set; } = string.Empty;
    public string PropertyTaxCode { get; set; } = string.Empty;
    public string RentalType { get; set; } = "Daily";
    public string CheckInTime { get; set; } = string.Empty;
    public string CheckOutTime { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "Paid";
    public decimal SubTotal { get; set; }
    public decimal SurchargeTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public int PointsUsed { get; set; }
    public decimal PointsDiscountAmount { get; set; }
    public int PointsEarned { get; set; }
    public int PointsRefunded { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal PaidAmount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string IssuedAt { get; set; } = string.Empty;
    public List<GuestFolioLineItemDto> LineItems { get; set; } = new();
}
