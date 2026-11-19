using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reports.Common;
using HotelSaas.Application.Reports.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reports.Queries.GetRevenueSummary;

public sealed class GetRevenueSummaryQueryHandler : IRequestHandler<GetRevenueSummaryQuery, RevenueSummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetRevenueSummaryQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<RevenueSummaryDto> Handle(GetRevenueSummaryQuery request, CancellationToken cancellationToken)
    {
        var tenantId = ReportScopeHelper.EnsureTenantId(_currentUser, "Yêu cầu ngữ cảnh khách sạn / doanh nghiệp hợp lệ.");
        var effectivePropertyId = ReportScopeHelper.ResolveScopedPropertyId(_currentUser, request.PropertyId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveFrom = request.FromDate ?? today.AddDays(-29);
        var effectiveTo = request.ToDate ?? today;

        if (effectiveFrom > effectiveTo)
        {
            throw new BadRequestException("ERR_INVALID_DATE_RANGE", "Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        }

        var reservationsQuery = _context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId &&
                        r.Status != ReservationStatus.Cancelled &&
                        r.Status != ReservationStatus.PendingPayment &&
                        r.Status != ReservationStatus.NoShow &&
                        r.CheckInDate <= effectiveTo &&
                        r.CheckOutDate >= effectiveFrom);

        if (effectivePropertyId.HasValue)
        {
            reservationsQuery = reservationsQuery.Where(r => r.PropertyId == effectivePropertyId.Value);
        }

        if (request.RoomTypeId.HasValue && request.RoomTypeId != Guid.Empty)
        {
            var roomsQuery = _context.Rooms.AsNoTracking()
                .Where(room => room.TenantId == tenantId && room.RoomTypeId == request.RoomTypeId.Value);
            if (effectivePropertyId.HasValue)
            {
                roomsQuery = roomsQuery.Where(room => room.PropertyId == effectivePropertyId.Value);
            }
            var roomIds = roomsQuery.Select(room => room.Id);
            reservationsQuery = reservationsQuery.Where(reservation => roomIds.Contains(reservation.RoomId));
        }

        var reservations = await reservationsQuery
            .Select(r => new { r.CheckInDate, r.CheckOutDate, r.TotalAmount })
            .ToListAsync(cancellationToken);

        var totalRevenue = reservations.Sum(r => r.TotalAmount);
        var totalBookings = reservations.Count;

        var paymentsQuery = _context.Payments
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId &&
                        p.Status == PaymentStatus.Completed &&
                        p.PaidAtUtc >= effectiveFrom.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) &&
                        p.PaidAtUtc <= effectiveTo.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc));

        if (effectivePropertyId.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.PropertyId == effectivePropertyId.Value);
        }

        if (request.RoomTypeId.HasValue && request.RoomTypeId != Guid.Empty)
        {
            var reservationIds = reservationsQuery.Select(reservation => reservation.Id);
            paymentsQuery = paymentsQuery.Where(payment => reservationIds.Contains(payment.ReservationId));
        }

        var completedPayments = await paymentsQuery
            .Select(p => new { p.Method, p.Amount, p.TransactionRef })
            .ToListAsync(cancellationToken);

        var paymentTotals = completedPayments
            .Where(p => p.TransactionRef == null ||
                        !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase))
            .GroupBy(p => p.Method)
            .Select(group => new { Method = group.Key, Amount = group.Sum(p => p.Amount), Count = group.Count() })
            .ToList();

        decimal paymentAmount(PaymentMethod method) => paymentTotals.FirstOrDefault(p => p.Method == method)?.Amount ?? 0m;
        int paymentCount(PaymentMethod method) => paymentTotals.FirstOrDefault(p => p.Method == method)?.Count ?? 0;

        var paymentBreakdown = new List<PaymentMethodBreakdownDto>
        {
            new() { Method = "VNPay", Amount = paymentAmount(PaymentMethod.VNPay), Count = paymentCount(PaymentMethod.VNPay) },
            new() { Method = "Tiền mặt (Cash)", Amount = paymentAmount(PaymentMethod.Cash), Count = paymentCount(PaymentMethod.Cash) },
            new() { Method = "Chuyển khoản (Bank)", Amount = paymentAmount(PaymentMethod.BankTransfer), Count = paymentCount(PaymentMethod.BankTransfer) },
            new() { Method = "Thẻ tín dụng (Card)", Amount = paymentAmount(PaymentMethod.CreditCard), Count = paymentCount(PaymentMethod.CreditCard) }
        };

        var dailySeries = new List<DailyRevenuePointDto>();
        for (var d = effectiveFrom; d <= effectiveTo; d = d.AddDays(1))
        {
            var dayRes = reservations
                .Where(r => (r.CheckInDate == r.CheckOutDate && r.CheckInDate == d) ||
                            (r.CheckInDate <= d && r.CheckOutDate > d))
                .ToList();
            var dayRev = dayRes.Sum(r =>
            {
                var nights = Math.Max(1, r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber);
                return r.TotalAmount / nights;
            });

            dailySeries.Add(new DailyRevenuePointDto
            {
                Date = d.ToString("yyyy-MM-dd"),
                DisplayDate = d.ToString("dd/MM"),
                Revenue = Math.Round(dayRev, 0),
                BookingsCount = dayRes.Count
            });
        }

        return new RevenueSummaryDto
        {
            TenantId = tenantId,
            FromDate = effectiveFrom.ToString("yyyy-MM-dd"),
            ToDate = effectiveTo.ToString("yyyy-MM-dd"),
            TotalRevenue = totalRevenue,
            TotalBookings = totalBookings,
            AverageBookingValue = totalBookings > 0 ? Math.Round(totalRevenue / totalBookings, 0) : 0m,
            PaymentBreakdown = paymentBreakdown,
            DailySeries = dailySeries
        };
    }
}
