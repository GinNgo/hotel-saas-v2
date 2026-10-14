using System;
using System.ComponentModel.DataAnnotations;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Properties.Commands.UpdateProperty;

public sealed record UpdatePropertyCommand(
    Guid PropertyId,
    string Name,
    string Address,
    string City,
    string? PhoneNumber = null,
    string? Email = null,
    PropertyType PropertyType = PropertyType.Hotel,
    int StarRating = 0,
    string? TouristZoneSlug = null,
    string? TouristZoneName = null,
    string? NearbyLandmarksJson = null,
    bool AllowHourlyBooking = true,
    bool AllowOvernightBooking = true,
    bool AllowDailyBooking = true,
    bool IsPublished = true,
    PropertyStatus Status = PropertyStatus.Active,
    double? Latitude = null,
    double? Longitude = null
) : IRequest<TenantPropertySummaryDto>;

public sealed class UpdatePropertyCommandHandler : IRequestHandler<UpdatePropertyCommand, TenantPropertySummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ILocationLookupService _locationService;

    public UpdatePropertyCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        ILocationLookupService locationService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentTenantService = currentTenantService ?? throw new ArgumentNullException(nameof(currentTenantService));
        _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
    }

    public async Task<TenantPropertySummaryDto> Handle(UpdatePropertyCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId
            ?? throw new UnauthorizedAccessException("Yêu cầu thông tin Tenant hợp lệ để cập nhật chi nhánh.");

        var property = await _context.Properties
            .Include(p => p.Rooms)
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy chi nhánh với mã '{request.PropertyId}'.");

        var touristZoneName = request.TouristZoneName;
        if (!string.IsNullOrWhiteSpace(request.TouristZoneSlug) && string.IsNullOrWhiteSpace(touristZoneName))
        {
            var zone = _locationService.GetTouristZoneBySlug(request.TouristZoneSlug);
            touristZoneName = zone?.Name;
        }

        property.Name = request.Name.Trim();
        property.Address = request.Address.Trim();
        property.City = request.City.Trim();
        property.PhoneNumber = request.PhoneNumber?.Trim();
        property.Email = request.Email?.Trim();
        property.PropertyType = request.PropertyType;
        property.StarRating = Math.Clamp(request.StarRating, 0, 5);
        property.TouristZoneSlug = request.TouristZoneSlug?.Trim();
        property.TouristZoneName = touristZoneName;
        property.NearbyLandmarksJson = request.NearbyLandmarksJson;
        property.AllowHourlyBooking = request.AllowHourlyBooking;
        property.AllowOvernightBooking = request.AllowOvernightBooking;
        property.AllowDailyBooking = request.AllowDailyBooking;
        property.IsPublished = request.IsPublished;
        property.Status = request.Status;
        property.Latitude = request.Latitude;
        property.Longitude = request.Longitude;
        property.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var total = property.Rooms?.Count ?? 0;

        return new TenantPropertySummaryDto
        {
            Id = property.Id,
            Name = property.Name,
            Code = property.Code,
            Slug = property.Slug,
            Address = property.Address,
            City = property.City,
            PhoneNumber = property.PhoneNumber,
            Email = property.Email,
            PropertyType = property.PropertyType,
            PropertyTypeName = GetPropertyTypeName(property.PropertyType),
            StarRating = property.StarRating,
            Status = property.Status,
            IsPublished = property.IsPublished,
            TouristZoneSlug = property.TouristZoneSlug,
            TouristZoneName = property.TouristZoneName,
            AllowHourlyBooking = property.AllowHourlyBooking,
            AllowOvernightBooking = property.AllowOvernightBooking,
            AllowDailyBooking = property.AllowDailyBooking,
            Latitude = property.Latitude,
            Longitude = property.Longitude,
            NearbyLandmarksJson = property.NearbyLandmarksJson,
            TotalRooms = total,
            OccupiedRooms = 0,
            AvailableRooms = total,
            TodayRevenue = 0m
        };
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
