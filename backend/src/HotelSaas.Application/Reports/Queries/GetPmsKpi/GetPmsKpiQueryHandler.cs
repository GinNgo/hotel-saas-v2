using System;
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

namespace HotelSaas.Application.Reports.Queries.GetPmsKpi;

public sealed class GetPmsKpiQueryHandler : IRequestHandler<GetPmsKpiQuery, PmsKpiDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPmsKpiQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PmsKpiDto> Handle(GetPmsKpiQuery request, CancellationToken cancellationToken)
    {
        var tenantId = ReportScopeHelper.EnsureTenantId(_currentUser);
        var effectivePropertyId = ReportScopeHelper.ResolveScopedPropertyId(_currentUser, request.PropertyId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveFrom = request.FromDate ?? today.AddDays(-29);
        var effectiveTo = request.ToDate ?? today;

        if (effectiveFrom > effectiveTo)
        {
            throw new BadRequestException("ERR_INVALID_DATE_RANGE", "Khoảng thời gian thống kê không hợp lệ.");
        }

        var roomsQuery = _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId);

        if (effectivePropertyId.HasValue)
        {
            roomsQuery = roomsQuery.Where(r => r.PropertyId == effectivePropertyId.Value);
        }

        if (request.RoomTypeId.HasValue && request.RoomTypeId != Guid.Empty)
        {
            roomsQuery = roomsQuery.Where(room => room.RoomTypeId == request.RoomTypeId.Value);
        }

        var totalRooms = await roomsQuery.CountAsync(cancellationToken);
        if (totalRooms == 0)
        {
            totalRooms = 1;
        }

        var totalDays = Math.Max(1, effectiveTo.DayNumber - effectiveFrom.DayNumber + 1);
        var availableRoomNights = totalRooms * totalDays;

        var allResQuery = _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId &&
                        r.CheckInDate <= effectiveTo &&
                        r.CheckOutDate >= effectiveFrom);

        if (effectivePropertyId.HasValue)
        {
            allResQuery = allResQuery.Where(r => r.PropertyId == effectivePropertyId.Value);
        }

        if (request.RoomTypeId.HasValue && request.RoomTypeId != Guid.Empty)
        {
            var scopedRoomsQuery = _context.Rooms
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(room => room.TenantId == tenantId && room.RoomTypeId == request.RoomTypeId.Value);
            if (effectivePropertyId.HasValue)
            {
                scopedRoomsQuery = scopedRoomsQuery.Where(room => room.PropertyId == effectivePropertyId.Value);
            }
            var roomIds = scopedRoomsQuery.Select(room => room.Id);
            allResQuery = allResQuery.Where(reservation => roomIds.Contains(reservation.RoomId));
        }

        var allReservations = await allResQuery
            .Select(r => new { r.CheckInDate, r.CheckOutDate, r.TotalAmount, r.NumberOfGuests, r.Status })
            .ToListAsync(cancellationToken);

        var validReservations = allReservations
            .Where(r => r.Status != ReservationStatus.Cancelled &&
                        r.Status != ReservationStatus.PendingPayment &&
                        r.Status != ReservationStatus.NoShow)
            .ToList();

        var totalSoldNights = 0;
        decimal totalRoomRevenue = 0m;
        var totalGuests = 0;
        var effectiveToExclusive = effectiveTo.AddDays(1);

        foreach (var r in validReservations)
        {
            int overlapNights;
            if (r.CheckInDate == r.CheckOutDate)
            {
                overlapNights = r.CheckInDate >= effectiveFrom && r.CheckInDate <= effectiveTo ? 1 : 0;
            }
            else
            {
                var overlapStart = r.CheckInDate > effectiveFrom ? r.CheckInDate : effectiveFrom;
                var overlapEnd = r.CheckOutDate < effectiveToExclusive ? r.CheckOutDate : effectiveToExclusive;
                overlapNights = Math.Max(0, overlapEnd.DayNumber - overlapStart.DayNumber);
            }

            if (overlapNights <= 0)
            {
                continue;
            }

            totalSoldNights += overlapNights;
            totalGuests += r.NumberOfGuests;

            var fullNights = Math.Max(1, r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber);
            totalRoomRevenue += (r.TotalAmount / fullNights) * overlapNights;
        }

        var occupancyRate = availableRoomNights > 0
            ? Math.Min(100.0, Math.Round((double)totalSoldNights / availableRoomNights * 100, 1))
            : 0.0;

        var adr = totalSoldNights > 0
            ? Math.Round(totalRoomRevenue / totalSoldNights, 0)
            : 0m;

        var revPar = availableRoomNights > 0
            ? Math.Round(totalRoomRevenue / availableRoomNights, 0)
            : 0m;

        var cancelledCount = allReservations.Count(r => r.Status == ReservationStatus.Cancelled);
        var cancellationRate = allReservations.Count > 0
            ? Math.Round((double)cancelledCount / allReservations.Count * 100, 1)
            : 0.0;

        return new PmsKpiDto
        {
            FromDate = effectiveFrom.ToString("yyyy-MM-dd"),
            ToDate = effectiveTo.ToString("yyyy-MM-dd"),
            TotalRooms = totalRooms,
            TotalAvailableNights = availableRoomNights,
            TotalSoldNights = totalSoldNights,
            OccupancyRate = occupancyRate,
            AverageDailyRate = adr,
            RevPAR = revPar,
            TotalRevenue = Math.Round(totalRoomRevenue, 0),
            TotalGuests = totalGuests,
            TotalBookings = validReservations.Count,
            CancelledBookings = cancelledCount,
            CancellationRate = cancellationRate
        };
    }
}
