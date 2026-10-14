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

namespace HotelSaas.Application.Loyalty.Queries.GetMyInvoices;

public sealed class GetMyInvoicesQueryHandler : IRequestHandler<GetMyInvoicesQuery, List<GuestInvoiceRecordDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetMyInvoicesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<List<GuestInvoiceRecordDto>> Handle(GetMyInvoicesQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        var userPhone = user.PhoneNumber?.Trim();
        var userEmail = user.Email.Trim();

        var reservations = await _context.Reservations
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Tenant)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.Payments)
            .Where(r => r.GuestUserId == userId ||
                        (!string.IsNullOrEmpty(userPhone) && r.GuestPhone == userPhone) ||
                        r.GuestEmail == userEmail)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        var reservationIds = reservations.Select(r => r.Id).ToList();

        var existingInvoices = await _context.Invoices
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .Where(i => reservationIds.Contains(i.ReservationId))
            .ToDictionaryAsync(i => i.ReservationId, cancellationToken);

        var results = new List<GuestInvoiceRecordDto>();

        foreach (var res in reservations)
        {
            existingInvoices.TryGetValue(res.Id, out var inv);

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
                status = paidAmount > 0 ? "PartiallyPaid" : "Paid"; // Default online holds / checked-in as paid or partially
            }

            var invoiceNumber = inv?.InvoiceNumber ?? $"HD-{res.CreatedAtUtc:yyyyMM}-{res.ConfirmationCode.Replace("RES-", "")}";
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
                // Synthesize standard folio line items
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

            var paymentMethod = res.Payments.FirstOrDefault(p => p.Status == PaymentStatus.Completed)?.Method.ToString() ?? "Chuyển khoản / Điểm thưởng";

            results.Add(new GuestInvoiceRecordDto
            {
                InvoiceId = inv?.Id ?? res.Id,
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
                TaxAmount = Math.Round(res.TotalAmount * 0.08m, 0), // Standard 8% VAT
                GrandTotal = res.TotalAmount,
                PaidAmount = paidAmount > 0 ? paidAmount : res.TotalAmount,
                PaymentMethod = paymentMethod,
                IssuedAt = res.CreatedAtUtc.ToString("dd/MM/yyyy HH:mm"),
                LineItems = lineItems
            });
        }

        return results;
    }
}
