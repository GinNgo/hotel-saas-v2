using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Queries.GetDashboardSummary;

public sealed record GetDashboardSummaryQuery(Guid? PropertyId = null) : IRequest<DashboardSummaryDto>;

public sealed class GetDashboardSummaryQueryHandler
    : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _currentUser;

    public GetDashboardSummaryQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<DashboardSummaryDto> Handle(
        GetDashboardSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId ?? _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        Guid? effectivePropertyId;
        if (!_currentUser.IsTenantWide)
        {
            if (!_currentUser.PropertyId.HasValue || _currentUser.PropertyId.Value == Guid.Empty)
            {
                throw new ForbiddenException("ERR_PROPERTY_REQUIRED", "Yêu cầu chỉ định chi nhánh làm việc.");
            }

            if (request.PropertyId.HasValue &&
                request.PropertyId.Value != Guid.Empty &&
                request.PropertyId.Value != _currentUser.PropertyId.Value)
            {
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Bạn không có quyền truy cập số liệu của chi nhánh khác.");
            }

            effectivePropertyId = _currentUser.PropertyId.Value;
        }
        else
        {
            effectivePropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
                ? request.PropertyId.Value
                : _propertyService.PropertyId;
        }

        if (effectivePropertyId.HasValue && _propertyService.ExcludedPropertyIds.Contains(effectivePropertyId.Value))
        {
            throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự tại chi nhánh này đã bị thu hồi.");
        }

        var tz = ReservationTimeHelper.GetVietnamTimeZone();
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var businessDate = DateOnly.FromDateTime(nowVn);
        var todayStartUtc = TimeZoneInfo.ConvertTimeToUtc(businessDate.ToDateTime(TimeOnly.MinValue), tz);
        var todayEndUtc = todayStartUtc.AddDays(1);

        var roomsQuery = _context.Rooms
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId.Value && r.IsActive);

        if (effectivePropertyId.HasValue)
        {
            roomsQuery = roomsQuery.Where(r => r.PropertyId == effectivePropertyId.Value);
        }
        else if (_propertyService.ExcludedPropertyIds.Count > 0)
        {
            roomsQuery = roomsQuery.Where(r => !_propertyService.ExcludedPropertyIds.Contains(r.PropertyId));
        }

        var roomStatuses = await roomsQuery
            .Select(r => r.Status)
            .ToListAsync(cancellationToken);

        var totalRooms = roomStatuses.Count;
        var cleanRooms = roomStatuses.Count(s => s == RoomStatus.Clean);
        var occupiedRooms = roomStatuses.Count(s => s == RoomStatus.Occupied);
        var dirtyRooms = roomStatuses.Count(s => s == RoomStatus.Dirty);
        var cleaningRooms = roomStatuses.Count(s => s == RoomStatus.Cleaning);
        var oosRooms = roomStatuses.Count(s => s == RoomStatus.OutOfService);

        var reservationsQuery = _context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId.Value);

        if (effectivePropertyId.HasValue)
        {
            reservationsQuery = reservationsQuery.Where(r => r.PropertyId == effectivePropertyId.Value);
        }
        else if (_propertyService.ExcludedPropertyIds.Count > 0)
        {
            reservationsQuery = reservationsQuery.Where(r => !_propertyService.ExcludedPropertyIds.Contains(r.PropertyId));
        }

        var reservations = await reservationsQuery
            .Select(r => new { r.Status, r.CheckInDate, r.CheckOutDate, r.NumberOfGuests, r.TotalAmount })
            .ToListAsync(cancellationToken);

        var todayCheckIns = reservations.Count(r =>
            r.CheckInDate == businessDate &&
            (r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.CheckedIn));

        var todayCheckOuts = reservations.Count(r =>
            r.CheckOutDate == businessDate &&
            (r.Status == ReservationStatus.CheckedIn || r.Status == ReservationStatus.CheckedOut));

        var checkedInList = reservations.Where(r => r.Status == ReservationStatus.CheckedIn).ToList();
        var inHouseGuests = checkedInList.Sum(r => Math.Max(1, r.NumberOfGuests));
        var upcomingConfirmed = reservations.Count(r =>
            r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.PendingPayment);
        var pendingDeposits = reservations.Count(r => r.Status == ReservationStatus.PendingPayment);
        var totalActiveReservations = reservations.Count(r =>
            r.Status != ReservationStatus.Cancelled && r.Status != ReservationStatus.NoShow);
        var totalBookingRevenue = reservations
            .Where(r => r.Status != ReservationStatus.Cancelled && r.Status != ReservationStatus.NoShow)
            .Sum(r => r.TotalAmount);

        var paymentsQuery = _context.Payments
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId.Value &&
                        p.Status == PaymentStatus.Completed &&
                        p.PaidAtUtc >= todayStartUtc &&
                        p.PaidAtUtc < todayEndUtc);

        if (effectivePropertyId.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.PropertyId == effectivePropertyId.Value);
        }
        else if (_propertyService.ExcludedPropertyIds.Count > 0)
        {
            paymentsQuery = paymentsQuery.Where(p => !_propertyService.ExcludedPropertyIds.Contains(p.PropertyId));
        }

        var todayPayments = await paymentsQuery
            .Select(p => new { p.Amount, p.TransactionRef })
            .ToListAsync(cancellationToken);

        var todayRevenue = todayPayments
            .Where(p => p.TransactionRef == null ||
                        !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount);

        var readyRate = totalRooms > 0 ? Math.Round((double)cleanRooms / totalRooms * 100, 1) : 0.0;
        var occupancyRate = totalRooms > 0 ? Math.Round((double)occupiedRooms / totalRooms * 100, 1) : 0.0;

        return new DashboardSummaryDto(
            TenantId: tenantId.Value,
            PropertyId: effectivePropertyId,
            BusinessDate: businessDate,
            TotalRooms: totalRooms,
            CleanRooms: cleanRooms,
            OccupiedRooms: occupiedRooms,
            DirtyRooms: dirtyRooms,
            CleaningRooms: cleaningRooms,
            OutOfServiceRooms: oosRooms,
            ReadyRatePercent: readyRate,
            OccupancyRatePercent: occupancyRate,
            TodayCheckInsCount: todayCheckIns,
            TodayCheckOutsCount: todayCheckOuts,
            InHouseGuestsCount: inHouseGuests,
            CheckedInCount: checkedInList.Count,
            UpcomingConfirmedCount: upcomingConfirmed,
            PendingDepositsCount: pendingDeposits,
            TodayRevenue: todayRevenue,
            TotalBookingRevenue: totalBookingRevenue,
            TotalActiveReservations: totalActiveReservations
        );
    }
}
