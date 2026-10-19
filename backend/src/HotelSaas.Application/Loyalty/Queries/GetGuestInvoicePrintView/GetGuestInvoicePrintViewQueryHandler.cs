using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Queries.GetGuestInvoicePrintView;

public sealed class GetGuestInvoicePrintViewQueryHandler : IRequestHandler<GetGuestInvoicePrintViewQuery, GuestInvoiceRecordDto>
{
    private readonly IApplicationDbContext _context;

    public GetGuestInvoicePrintViewQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<GuestInvoiceRecordDto> Handle(GetGuestInvoicePrintViewQuery request, CancellationToken cancellationToken)
    {
        // Try to load as Invoice first
        var invoice = await _context.Invoices
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Property)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Tenant)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceOrReservationId, cancellationToken);

        Reservation? res = invoice?.Reservation;

        if (res == null)
        {
            // If not found as Invoice Id, try as Reservation Id
            res = await _context.Reservations
                .AsNoTracking()
                .Include(r => r.Property)
                .Include(r => r.Tenant)
                .Include(r => r.Room)
                    .ThenInclude(rm => rm!.RoomType)
                .Include(r => r.Payments)
                .FirstOrDefaultAsync(r => r.Id == request.InvoiceOrReservationId, cancellationToken);
        }

        if (res == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin hóa đơn hoặc đặt phòng.");
        }

        var rentalType = "Daily";
        var snap = ReservationSnapshotHelper.TryDeserialize(res.Notes);
        if (snap != null)
        {
            rentalType = snap.RentalType.ToString();
        }

        var paidAmount = res.Payments
            .Where(p => p.Status == PaymentStatus.Completed)
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

        var invoiceNumber = invoice?.InvoiceNumber ?? $"HD-{res.CreatedAtUtc:yyyyMM}-{res.ConfirmationCode.Replace("RES-", "")}";
        var lineItems = new List<GuestFolioLineItemDto>();

        if (invoice?.InvoiceItems != null && invoice.InvoiceItems.Count > 0)
        {
            lineItems = invoice.InvoiceItems.Select(item => new GuestFolioLineItemDto
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

        var paymentMethod = res.Payments.FirstOrDefault(p => p.Status == PaymentStatus.Completed)?.Method.ToString() ?? "Chuyển khoản QR / Điểm thưởng";

        return new GuestInvoiceRecordDto
        {
            InvoiceId = invoice?.Id ?? res.Id,
            InvoiceNumber = invoiceNumber,
            ReservationId = res.Id,
            ReservationCode = res.ConfirmationCode,
            TenantBrandName = res.Tenant?.Name ?? "Chuỗi khách sạn",
            PropertyName = res.Property?.Name ?? "Cơ sở lưu trú",
            PropertyType = res.Property?.PropertyType.ToString() ?? "Hotel",
            PropertyAddress = res.Property?.Address ?? string.Empty,
            PropertyTaxCode = "0109988776",
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
            TaxAmount = Math.Round(res.TotalAmount * 0.08m, 0),
            GrandTotal = res.TotalAmount,
            PaidAmount = paidAmount > 0 ? paidAmount : res.TotalAmount,
            PaymentMethod = paymentMethod,
            IssuedAt = res.CreatedAtUtc.ToString("dd/MM/yyyy HH:mm"),
            LineItems = lineItems
        };
    }
}
