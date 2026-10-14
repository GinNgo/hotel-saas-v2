using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicAvailability;

public sealed record GetPublicAvailabilityQuery(
    string PropertySlug,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null
) : IRequest<IReadOnlyList<PublicRoomTypeAvailabilityDto>>;

public sealed class GetPublicAvailabilityQueryHandler : IRequestHandler<GetPublicAvailabilityQuery, IReadOnlyList<PublicRoomTypeAvailabilityDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IPricingCalculator _pricingCalculator;

    public GetPublicAvailabilityQueryHandler(
        IApplicationDbContext context,
        IPricingCalculator pricingCalculator)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _pricingCalculator = pricingCalculator ?? throw new ArgumentNullException(nameof(pricingCalculator));
    }

    public async Task<IReadOnlyList<PublicRoomTypeAvailabilityDto>> Handle(GetPublicAvailabilityQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PropertySlug))
        {
            throw new BadRequestException("ERR_INVALID_SLUG", "Mã đường dẫn cơ sở không hợp lệ.");
        }

        var normalizedSlug = request.PropertySlug.Trim().ToLowerInvariant();

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Status == PropertyStatus.Active &&
                                     (p.Slug.ToLower() == normalizedSlug || p.Id.ToString() == normalizedSlug),
                                 cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
        }

        DateTime effectiveStartUtc;
        DateTime effectiveEndUtc;

        if (request.RentalType == RentalType.Hourly)
        {
            if (request.StartAtUtc == default || request.EndAtUtc == default || request.EndAtUtc <= request.StartAtUtc)
            {
                throw new BadRequestException("ERR_INVALID_SCHEDULE", "Thời gian bắt đầu và kết thúc thuê giờ không hợp lệ.");
            }
            effectiveStartUtc = request.StartAtUtc;
            effectiveEndUtc = request.EndAtUtc;
        }
        else
        {
            if (request.StartAtUtc != default && request.EndAtUtc != default && request.EndAtUtc > request.StartAtUtc)
            {
                effectiveStartUtc = request.StartAtUtc;
                effectiveEndUtc = request.EndAtUtc;
            }
            else if (request.CheckInDate.HasValue && request.CheckOutDate.HasValue)
            {
                var overnightInterval = ReservationTimeHelper.GetOvernightUtcInterval(
                    request.CheckInDate.Value, request.CheckOutDate.Value, property.CheckInTime, property.CheckOutTime);
                effectiveStartUtc = overnightInterval.StartAtUtc;
                effectiveEndUtc = overnightInterval.EndAtUtc;
            }
            else
            {
                throw new BadRequestException("ERR_INVALID_SCHEDULE", "Vui lòng chỉ định ngày nhận và trả phòng hợp lệ.");
            }
        }

        var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, property.BufferMinutes);

        var roomTypes = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(rt => rt.PropertyId == property.Id)
            .OrderBy(rt => rt.BasePrice)
            .ToListAsync(cancellationToken);

        var physicalRooms = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.PropertyId == property.Id && r.IsActive)
            .ToListAsync(cancellationToken);

        var activeReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.PropertyId == property.Id &&
                        (r.Status == ReservationStatus.PendingPayment ||
                         r.Status == ReservationStatus.Confirmed ||
                         r.Status == ReservationStatus.CheckedIn))
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var reservationsByRoom = activeReservations.ToLookup(r => r.RoomId);

        var results = new List<PublicRoomTypeAvailabilityDto>();

        foreach (var rt in roomTypes)
        {
            var roomsForType = physicalRooms.Where(r => r.RoomTypeId == rt.Id).ToList();
            int totalCount = roomsForType.Count;
            int availableCount = 0;

            foreach (var room in roomsForType)
            {
                var roomReservations = reservationsByRoom[room.Id];
                bool isBlocked = false;

                foreach (var existing in roomReservations)
                {
                    if (!ReservationTimeHelper.IsBlockingReservation(existing, nowUtc))
                    {
                        continue; // Expired online hold does not block (Decision D03)
                    }

                    var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(existing, property);
                    if (ReservationTimeHelper.HasOverlap(effectiveStartUtc, effectiveEndUtc, extStart, extEnd, bufferMinutes))
                    {
                        isBlocked = true;
                        break;
                    }
                }

                if (!isBlocked)
                {
                    availableCount++;
                }
            }

            decimal estimatedPrice = rt.BasePrice;
            try
            {
                var quote = await _pricingCalculator.CalculateAsync(
                    property, rt, request.RentalType, effectiveStartUtc, effectiveEndUtc,
                    request.CheckInDate, request.CheckOutDate, cancellationToken);
                estimatedPrice = quote.TotalAmount;
            }
            catch
            {
                // Fallback to base price if surcharge or pricing is pending configuration
            }

            results.Add(new PublicRoomTypeAvailabilityDto
            {
                RoomTypeId = rt.Id,
                RoomTypeName = rt.Name,
                Description = rt.Description,
                MaxOccupancy = rt.MaxOccupancy,
                BedType = rt.BedType,
                SquareMeters = rt.SquareMeters,
                ImageUrl = rt.ImageUrl,
                TotalRooms = totalCount,
                AvailableRooms = availableCount,
                EstimatedPrice = estimatedPrice
            });
        }

        return results;
    }
}
