using System;
using System.Collections.Generic;
using System.Linq;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Loyalty.Services;

internal static class GuestInvoiceRecordMapper
{
    public static GuestInvoiceRecordDto Map(
        Reservation res,
        Invoice? inv,
        PrintTemplateConfig? printConfig,
        string defaultPaymentMethodLabel)
    {
        var snap = ReservationSnapshotHelper.TryDeserialize(res.Notes);
        var rentalType = snap?.RentalType.ToString()
            ?? (res.CheckInDate == res.CheckOutDate ? "Hourly" : "Daily");

        var paidAmount = res.Payments
            .Where(p => p.Status == PaymentStatus.Completed &&
                        (p.TransactionRef == null ||
                         !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase)))
            .Sum(p => p.Amount);

        string status = "Paid";
        if (res.Status == ReservationStatus.Cancelled)
        {
            status = res.PointsRefunded > 0 ? "Refunded" : "Cancelled";
        }
        else if (paidAmount < res.TotalAmount)
        {
            status = paidAmount > 0 ? "PartiallyPaid" : "Paid";
        }

        var invoiceNumber = inv?.InvoiceNumber
            ?? $"HD-{res.CreatedAtUtc:yyyyMM}-{res.ConfirmationCode.Replace("RES-", "")}";

        var lineItems = new List<GuestFolioLineItemDto>();
        if (inv?.InvoiceItems != null && inv.InvoiceItems.Count > 0)
        {
            lineItems = inv.InvoiceItems.Select(item => new GuestFolioLineItemDto
            {
                Id = item.Id,
                ItemType = item.ItemCode,
                Description = item.Description,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                Amount = item.Amount
            }).ToList();
        }
        else
        {
            var grossRoomCharge = res.TotalAmount + res.PointsDiscountAmount;
            lineItems.Add(new GuestFolioLineItemDto
            {
                Id = Guid.NewGuid(),
                ItemType = "RoomCharge",
                Description = $"Tiền phòng {res.Room?.RoomType?.Name ?? "Tiêu chuẩn"} ({rentalType})",
                Quantity = 1,
                UnitPrice = grossRoomCharge,
                Amount = grossRoomCharge
            });

            if (res.PointsRedeemed > 0)
            {
                lineItems.Add(new GuestFolioLineItemDto
                {
                    Id = Guid.NewGuid(),
                    ItemType = "PointsRedemption",
                    Description = $"Thanh toán bằng {res.PointsRedeemed} điểm thưởng thành viên",
                    Quantity = res.PointsRedeemed,
                    UnitPrice = -1000m,
                    Amount = -res.PointsDiscountAmount
                });
            }
        }

        var paymentMethod = res.Payments
            .FirstOrDefault(p => p.Status == PaymentStatus.Completed &&
                                 (p.TransactionRef == null ||
                                  !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase)))
            ?.Method.ToString() ?? defaultPaymentMethodLabel;

        var taxRatePercent = res.Property?.TaxRatePercent ?? res.Tenant?.TaxRatePercent ?? 0m;
        var taxAmount = inv?.TaxAmount ?? Math.Round(res.TotalAmount * (taxRatePercent / 100m), 0);
        var propertyTaxCode = inv?.PropertyTaxCode ?? printConfig?.TaxNumber ?? string.Empty;

        return new GuestInvoiceRecordDto
        {
            InvoiceId = inv?.Id ?? res.Id,
            InvoiceNumber = invoiceNumber,
            ReservationId = res.Id,
            ReservationCode = res.ConfirmationCode,
            TenantBrandName = res.Tenant?.Name ?? "Chuỗi khách sạn",
            PropertyName = res.Property?.Name ?? "Cơ sở lưu trú",
            PropertyType = res.Property?.PropertyType.ToString() ?? "Hotel",
            PropertyAddress = res.Property?.Address ?? string.Empty,
            PropertyTaxCode = propertyTaxCode,
            RentalType = rentalType,
            CheckInTime = res.CheckInDate.ToString("dd/MM/yyyy"),
            CheckOutTime = res.CheckOutDate.ToString("dd/MM/yyyy"),
            RoomName = res.Room?.RoomType?.Name ?? "Phòng tiêu chuẩn",
            RoomNumber = res.Room?.RoomNumber ?? "P.---",
            Status = status,
            SubTotal = res.TotalAmount + res.PointsDiscountAmount,
            SurchargeTotal = 0m,
            DiscountTotal = 0m,
            PointsUsed = res.PointsRedeemed,
            PointsDiscountAmount = res.PointsDiscountAmount,
            PointsEarned = res.PointsEarned,
            PointsRefunded = res.PointsRefunded,
            TaxAmount = taxAmount,
            GrandTotal = res.TotalAmount,
            PaidAmount = paidAmount > 0 ? paidAmount : res.TotalAmount,
            PaymentMethod = paymentMethod,
            IssuedAt = res.CreatedAtUtc.ToString("dd/MM/yyyy HH:mm"),
            LineItems = lineItems
        };
    }
}
