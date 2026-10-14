using System;
using System.ComponentModel.DataAnnotations;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Properties.Commands.CreateProperty;

public sealed record CreatePropertyCommand(
    string Name,
    string Code,
    string Slug,
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
    double? Latitude = null,
    double? Longitude = null
) : IRequest<TenantPropertySummaryDto>;

public sealed class CreatePropertyCommandHandler : IRequestHandler<CreatePropertyCommand, TenantPropertySummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ILocationLookupService _locationService;

    public CreatePropertyCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        ILocationLookupService locationService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentTenantService = currentTenantService ?? throw new ArgumentNullException(nameof(currentTenantService));
        _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
    }

    public async Task<TenantPropertySummaryDto> Handle(CreatePropertyCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId
            ?? throw new UnauthorizedAccessException("Yêu cầu thông tin Tenant hợp lệ để tạo chi nhánh.");

        // Check unique code within tenant
        var codeUpper = request.Code.Trim().ToUpperInvariant();
        var codeExists = await _context.Properties
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TenantId == tenantId && p.Code == codeUpper, cancellationToken);
        if (codeExists)
        {
            throw new ValidationException($"Mã chi nhánh '{request.Code}' đã tồn tại trong chuỗi.");
        }

        // Check global slug uniqueness
        var slugLower = request.Slug.Trim().ToLowerInvariant();
        var slugExists = await _context.Properties
            .IgnoreQueryFilters()
            .AnyAsync(p => p.Slug == slugLower, cancellationToken);
        if (slugExists)
        {
            throw new ValidationException($"URL Slug '{request.Slug}' đã được sử dụng. Vui lòng chọn slug khác.");
        }

        // Resolve tourist zone name if slug passed
        var touristZoneName = request.TouristZoneName;
        if (!string.IsNullOrWhiteSpace(request.TouristZoneSlug) && string.IsNullOrWhiteSpace(touristZoneName))
        {
            var zone = _locationService.GetTouristZoneBySlug(request.TouristZoneSlug);
            touristZoneName = zone?.Name;
        }

        var property = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Code = codeUpper,
            Slug = slugLower,
            Address = request.Address.Trim(),
            City = request.City.Trim(),
            PhoneNumber = request.PhoneNumber?.Trim(),
            Email = request.Email?.Trim(),
            PropertyType = request.PropertyType,
            StarRating = Math.Clamp(request.StarRating, 0, 5),
            TouristZoneSlug = request.TouristZoneSlug?.Trim(),
            TouristZoneName = touristZoneName,
            NearbyLandmarksJson = request.NearbyLandmarksJson,
            AllowHourlyBooking = request.AllowHourlyBooking,
            AllowOvernightBooking = request.AllowOvernightBooking,
            AllowDailyBooking = request.AllowDailyBooking,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsPublished = true,
            Status = PropertyStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Properties.Add(property);
        await _context.SaveChangesAsync(cancellationToken);

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
            TotalRooms = 0,
            OccupiedRooms = 0,
            AvailableRooms = 0,
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
