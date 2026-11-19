using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Application.Public.Services;
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
    double? Longitude = null,
    bool IsPublished = false,
    TimeOnly? CheckInTime = null,
    TimeOnly? CheckOutTime = null
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
            throw new ConflictException("ERR_DUPLICATE_PROPERTY_CODE", $"Mã chi nhánh '{request.Code}' đã tồn tại trong chuỗi.");
        }

        // Check global slug uniqueness
        var slugLower = request.Slug.Trim().ToLowerInvariant();
        var slugExists = await _context.Properties
            .IgnoreQueryFilters()
            .AnyAsync(p => p.Slug == slugLower, cancellationToken);
        if (slugExists)
        {
            throw new ConflictException("ERR_DUPLICATE_PROPERTY_SLUG", $"URL Slug '{request.Slug}' đã được sử dụng. Vui lòng chọn slug khác.");
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
            CheckInTime = request.CheckInTime ?? new TimeOnly(14, 0, 0),
            CheckOutTime = request.CheckOutTime ?? new TimeOnly(12, 0, 0),
            TouristZoneSlug = request.TouristZoneSlug?.Trim(),
            TouristZoneName = touristZoneName,
            NearbyLandmarksJson = request.NearbyLandmarksJson,
            AllowHourlyBooking = request.AllowHourlyBooking,
            AllowOvernightBooking = request.AllowOvernightBooking,
            AllowDailyBooking = request.AllowDailyBooking,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsPublished = request.IsPublished,
            Status = PropertyStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        // Auto-match nearest landmarks and tourist zones if not explicitly provided
        GeoProximityHelper.AutoMatchNearbyLandmarks(property, _locationService);

        _context.Properties.Add(property);
        var starterRoomsCount = TrySeedStarterInventory(
            _context,
            tenantId,
            property.Id,
            Guid.Empty,
            changeReason: "Khởi tạo bảng giá chi nhánh mới");

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
            TotalRooms = starterRoomsCount,
            OccupiedRooms = 0,
            AvailableRooms = starterRoomsCount,
            TodayRevenue = 0m
        };
    }

    internal static int TrySeedStarterInventory(
        IApplicationDbContext context,
        Guid tenantId,
        Guid propertyId,
        Guid createdByUserId,
        decimal nightlyPrice = 500000m,
        decimal hourlyPrice = 150000m,
        string changeReason = "Khởi tạo bảng giá đối tác mới")
    {
        try
        {
            if (context.RoomTypes == null || context.Rooms == null || context.RoomTypeRates == null)
            {
                return 0;
            }

            var roomTypeId = Guid.NewGuid();
            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

            context.RoomTypes.Add(new RoomType
            {
                Id = roomTypeId,
                TenantId = tenantId,
                PropertyId = propertyId,
                Code = "STD",
                Name = "Phòng Tiêu Chuẩn",
                BasePrice = nightlyPrice,
                MaxOccupancy = 2,
                BedType = "Queen",
                SquareMeters = 24m
            });

            string[] starterRoomNumbers = ["101", "102", "103"];
            foreach (var roomNumber in starterRoomNumbers)
            {
                context.Rooms.Add(new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = roomNumber,
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true
                });
            }

            context.RoomTypeRates.Add(new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                RoomTypeId = roomTypeId,
                FirstHours = 2,
                FirstHoursPrice = hourlyPrice,
                AdditionalHourPrice = Math.Round(hourlyPrice * 0.35m, 0),
                NightlyPrice = nightlyPrice,
                Currency = "VND",
                EffectiveFrom = today.AddDays(-1),
                EffectiveTo = today.AddYears(3),
                CreatedByUserId = createdByUserId,
                ChangeReason = changeReason,
                IsActive = true
            });

            try
            {
                if (context.PropertySurchargePolicies != null)
                {
                    var nowUtc = DateTime.UtcNow;
                    context.PropertySurchargePolicies.AddRange(
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.EarlyCheckIn,
                            FromTime = new TimeOnly(0, 0, 0),
                            ToTime = new TimeOnly(6, 0, 0),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 100m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        },
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.EarlyCheckIn,
                            FromTime = new TimeOnly(6, 0, 0),
                            ToTime = new TimeOnly(9, 0, 0),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 50m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        },
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.EarlyCheckIn,
                            FromTime = new TimeOnly(9, 0, 0),
                            ToTime = new TimeOnly(14, 0, 0),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 30m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        },
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.LateCheckOut,
                            FromTime = new TimeOnly(12, 0, 0),
                            ToTime = new TimeOnly(15, 0, 0),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 30m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        },
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.LateCheckOut,
                            FromTime = new TimeOnly(15, 0, 0),
                            ToTime = new TimeOnly(18, 0, 0),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 50m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        },
                        new PropertySurchargePolicy
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PropertyId = propertyId,
                            SurchargeType = SurchargeType.LateCheckOut,
                            FromTime = new TimeOnly(18, 0, 0),
                            ToTime = new TimeOnly(23, 59, 59),
                            CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                            Percentage = 100m,
                            IsActive = true,
                            CreatedAtUtc = nowUtc,
                            UpdatedAtUtc = nowUtc
                        });
                }
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated unit test stubs.
            }

            return starterRoomNumbers.Length;
        }
        catch (NotImplementedException)
        {
            // Optional DbSets may throw NotImplementedException in isolated unit test stubs.
            return 0;
        }
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
