using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Properties.Queries.GetTenantProperties;

/// <summary>
/// Query to retrieve all properties/branches owned by the current tenant, including live operational metrics.
/// </summary>
public sealed record GetTenantPropertiesQuery : IRequest<IReadOnlyList<TenantPropertySummaryDto>>;

public sealed class GetTenantPropertiesQueryHandler : IRequestHandler<GetTenantPropertiesQuery, IReadOnlyList<TenantPropertySummaryDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public GetTenantPropertiesQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentTenantService = currentTenantService ?? throw new ArgumentNullException(nameof(currentTenantService));
    }

    public async Task<IReadOnlyList<TenantPropertySummaryDto>> Handle(GetTenantPropertiesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId
            ?? throw new UnauthorizedAccessException("Yêu cầu thông tin Tenant hợp lệ để truy vấn danh sách chi nhánh.");

        var properties = await _context.Properties
            .Where(p => p.TenantId == tenantId)
            .OrderBy(p => p.Name)
            .Include(p => p.Rooms)
            .ToListAsync(cancellationToken);

        if (properties.Count == 0)
        {
            return Array.Empty<TenantPropertySummaryDto>();
        }

        var propertyIds = properties.Select(p => p.Id).ToList();

        // Calculate occupancy and today revenue
        var nowUtc = DateTime.UtcNow;
        var todayStartUtc = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, 0, 0, 0, DateTimeKind.Utc);
        var todayEndUtc = todayStartUtc.AddDays(1);

        var activeReservations = await _context.Reservations
            .Where(r => propertyIds.Contains(r.PropertyId)
                && r.Status == ReservationStatus.CheckedIn)
            .Select(r => new { r.PropertyId, r.RoomId })
            .ToListAsync(cancellationToken);

        var todayPayments = await _context.Payments
            .Where(p => propertyIds.Contains(p.PropertyId)
                && p.Status == PaymentStatus.Completed
                && p.CreatedAtUtc >= todayStartUtc
                && p.CreatedAtUtc < todayEndUtc)
            .Select(p => new { p.PropertyId, p.Amount })
            .ToListAsync(cancellationToken);

        var occupiedCountByProp = activeReservations
            .GroupBy(r => r.PropertyId)
            .ToDictionary(g => g.Key, g => g.Count());

        var revenueByProp = todayPayments
            .GroupBy(p => p.PropertyId)
            .ToDictionary(g => g.Key, g => g.Sum(p => p.Amount));

        return properties.Select(p =>
        {
            var total = p.Rooms?.Count ?? 0;
            var occupied = occupiedCountByProp.TryGetValue(p.Id, out var occ) ? occ : 0;
            var rev = revenueByProp.TryGetValue(p.Id, out var r) ? r : 0m;

            return new TenantPropertySummaryDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Slug = p.Slug,
                Address = p.Address,
                City = p.City,
                PhoneNumber = p.PhoneNumber,
                Email = p.Email,
                PropertyType = p.PropertyType,
                PropertyTypeName = GetPropertyTypeName(p.PropertyType),
                StarRating = p.StarRating,
                Status = p.Status,
                IsPublished = p.IsPublished,
                TouristZoneSlug = p.TouristZoneSlug,
                TouristZoneName = p.TouristZoneName,
                AllowHourlyBooking = p.AllowHourlyBooking,
                AllowOvernightBooking = p.AllowOvernightBooking,
                AllowDailyBooking = p.AllowDailyBooking,
                Latitude = p.Latitude,
                Longitude = p.Longitude,
                NearbyLandmarksJson = p.NearbyLandmarksJson,
                TotalRooms = total,
                OccupiedRooms = occupied,
                AvailableRooms = Math.Max(0, total - occupied),
                TodayRevenue = rev
            };
        }).ToList();
    }

    private static string GetPropertyTypeName(PropertyType propertyType) => propertyType switch
    {
        PropertyType.Hotel => "Khách sạn",
        PropertyType.Resort => "Resort nghỉ dưỡng",
        PropertyType.Hostel => "Hostel / Ký túc xá",
        PropertyType.BedAndBreakfast => "Bed & Breakfast",
        PropertyType.Villa => "Biệt thự / Villa",
        PropertyType.Apartment => "Căn hộ dịch vụ",
        PropertyType.Motel => "Nhà nghỉ / Motel",
        PropertyType.Homestay => "Homestay",
        _ => "Cơ sở lưu trú"
    };
}
