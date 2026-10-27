using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

using HotelSaas.Application.Public.Services;

namespace HotelSaas.Application.Public.Queries.GetPublicProperties;

/// <summary>
/// Query to retrieve active properties available for public discovery.
/// Supports search, destination keyword, property type filters, rental types, tourist zones, landmarks,
/// user GPS coordinates, and smart fallback recommendations.
/// </summary>
public sealed record GetPublicPropertiesQuery(
    string? Search = null,
    string? DestinationKeyword = null,
    IReadOnlyList<PropertyType>? PropertyTypes = null,
    RentalType? RentalType = null,
    string? TouristZoneSlug = null,
    string? LandmarkSlug = null,
    double? MaxDistanceKm = null,
    double? MaxDistanceMeters = null,
    double? UserLatitude = null,
    double? UserLongitude = null) : IRequest<IReadOnlyList<PublicPropertyDto>>;

public sealed class GetPublicPropertiesQueryHandler : IRequestHandler<GetPublicPropertiesQuery, IReadOnlyList<PublicPropertyDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ILocationLookupService? _locationService;

    public GetPublicPropertiesQueryHandler(IApplicationDbContext context, ILocationLookupService? locationService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _locationService = locationService;
    }

    public async Task<IReadOnlyList<PublicPropertyDto>> Handle(GetPublicPropertiesQuery request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // 1. Resolve Landmark and Tourist Zone if provided or matching DestinationKeyword
        LandmarkDto? targetLandmark = null;
        string? effectiveZoneSlug = request.TouristZoneSlug?.Trim();

        if (!string.IsNullOrWhiteSpace(request.LandmarkSlug) && _locationService != null)
        {
            targetLandmark = _locationService.GetLandmarkBySlug(request.LandmarkSlug.Trim());
            if (targetLandmark != null && string.IsNullOrEmpty(effectiveZoneSlug) && !string.IsNullOrEmpty(targetLandmark.TouristZoneSlug))
            {
                effectiveZoneSlug = targetLandmark.TouristZoneSlug;
            }
        }

        if (targetLandmark == null && !string.IsNullOrWhiteSpace(request.DestinationKeyword) && _locationService != null)
        {
            targetLandmark = _locationService.FindLandmark(request.DestinationKeyword.Trim());
            if (targetLandmark != null && string.IsNullOrEmpty(effectiveZoneSlug) && !string.IsNullOrEmpty(targetLandmark.TouristZoneSlug))
            {
                effectiveZoneSlug = targetLandmark.TouristZoneSlug;
            }
            else if (string.IsNullOrEmpty(effectiveZoneSlug))
            {
                var zone = _locationService.FindTouristZone(request.DestinationKeyword.Trim());
                if (zone != null)
                {
                    effectiveZoneSlug = zone.Slug;
                }
            }
        }

        // 2. Query active properties
        var query = _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active);

        // Filter by TouristZoneSlug if specified
        if (!string.IsNullOrWhiteSpace(effectiveZoneSlug))
        {
            query = query.Where(p => p.TouristZoneSlug == effectiveZoneSlug);
        }

        // Filter by PropertyTypes if specified
        if (request.PropertyTypes != null && request.PropertyTypes.Count > 0)
        {
            var allowedTypes = request.PropertyTypes.ToList();
            query = query.Where(p => allowedTypes.Contains(p.PropertyType));
        }

        // Filter by RentalType availability
        if (request.RentalType.HasValue)
        {
            switch (request.RentalType.Value)
            {
                case RentalType.Hourly:
                    query = query.Where(p => p.AllowHourlyBooking);
                    break;
                case RentalType.Overnight:
                    query = query.Where(p => p.AllowOvernightBooking);
                    break;
                case RentalType.Daily:
                    query = query.Where(p => p.AllowDailyBooking);
                    break;
            }
        }

        // Load raw properties
        var rawProperties = await query
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        // If filtering by zone returned empty and we had an effectiveZoneSlug, only fallback if user GPS coordinates are active
        if (rawProperties.Count == 0 && !string.IsNullOrWhiteSpace(effectiveZoneSlug) && request.UserLatitude.HasValue && request.UserLongitude.HasValue)
        {
            var fallbackQuery = _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Active);

            if (request.RentalType.HasValue)
            {
                switch (request.RentalType.Value)
                {
                    case RentalType.Hourly: fallbackQuery = fallbackQuery.Where(p => p.AllowHourlyBooking); break;
                    case RentalType.Overnight: fallbackQuery = fallbackQuery.Where(p => p.AllowOvernightBooking); break;
                    case RentalType.Daily: fallbackQuery = fallbackQuery.Where(p => p.AllowDailyBooking); break;
                }
            }
            rawProperties = await fallbackQuery.ToListAsync(cancellationToken);
        }

        if (rawProperties.Count == 0)
        {
            return Array.Empty<PublicPropertyDto>();
        }

        var propertyIds = rawProperties.Select(p => p.Id).ToList();

        // 3. Load active rates to compute starting prices
        var rates = await _context.RoomTypeRates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.IsActive && propertyIds.Contains(r.PropertyId))
            .ToListAsync(cancellationToken);

        var ratesByProperty = rates.GroupBy(r => r.PropertyId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Determine reference point for proximity calculation
        double? refLat = null;
        double? refLon = null;

        if (targetLandmark != null)
        {
            refLat = targetLandmark.Latitude;
            refLon = targetLandmark.Longitude;
        }
        else if (request.UserLatitude.HasValue && request.UserLongitude.HasValue)
        {
            refLat = request.UserLatitude.Value;
            refLon = request.UserLongitude.Value;
        }

        var allDtos = new List<PublicPropertyDto>(rawProperties.Count);

        foreach (var p in rawProperties)
        {
            ratesByProperty.TryGetValue(p.Id, out var propRates);

            decimal? hourlyStart = null;
            decimal? overnightStart = null;
            decimal? dailyStart = null;

            if (propRates != null && propRates.Count > 0)
            {
                var hourlyRates = propRates.Where(r => r.FirstHoursPrice > 0).ToList();
                if (hourlyRates.Count > 0)
                    hourlyStart = hourlyRates.Min(r => r.FirstHoursPrice);

                var nightlyRates = propRates.Where(r => r.NightlyPrice > 0).ToList();
                if (nightlyRates.Count > 0)
                {
                    overnightStart = nightlyRates.Min(r => r.NightlyPrice);
                    dailyStart = overnightStart;
                }
            }

            decimal? startingPrice = request.RentalType switch
            {
                RentalType.Hourly => hourlyStart,
                RentalType.Overnight => overnightStart,
                RentalType.Daily => dailyStart ?? overnightStart,
                _ => dailyStart ?? overnightStart ?? hourlyStart
            };

            // Resolve nearby landmarks
            var nearbyLandmarks = ResolveLandmarks(p);

            string? nearestLandmarkInfo = null;
            if (nearbyLandmarks.Count > 0)
            {
                var closest = nearbyLandmarks[0];
                nearestLandmarkInfo = $"{closest.DistanceFormatted} {closest.Name}";
            }

            // Calculate distance to reference point if available
            double? distanceMeters = null;
            string? distanceFormatted = null;

            if (refLat.HasValue && refLon.HasValue && p.Latitude.HasValue && p.Longitude.HasValue)
            {
                var meters = GeoProximityHelper.CalculateDistanceMeters(refLat.Value, refLon.Value, p.Latitude.Value, p.Longitude.Value);
                distanceMeters = Math.Round(meters);
                distanceFormatted = GeoProximityHelper.FormatDistance(meters);
            }

            allDtos.Add(new PublicPropertyDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Slug = p.Slug,
                Address = p.Address,
                City = p.City,
                CheckInTime = p.CheckInTime,
                CheckOutTime = p.CheckOutTime,
                BufferMinutes = p.BufferMinutes,
                MaxHourlyHours = p.MaxHourlyHours,
                ImageUrl = null,
                PropertyType = p.PropertyType,
                PropertyTypeName = GetPropertyTypeName(p.PropertyType),
                StarRating = p.StarRating,
                Latitude = p.Latitude,
                Longitude = p.Longitude,
                TouristZoneSlug = p.TouristZoneSlug,
                TouristZoneName = SanitizeVietnameseText(p.TouristZoneName),
                AllowHourlyBooking = p.AllowHourlyBooking,
                AllowOvernightBooking = p.AllowOvernightBooking,
                AllowDailyBooking = p.AllowDailyBooking,
                HourlyStartingPrice = hourlyStart,
                OvernightStartingPrice = overnightStart,
                DailyStartingPrice = dailyStart,
                StartingPrice = startingPrice,
                NearbyLandmarks = nearbyLandmarks,
                NearestLandmarkInfo = nearestLandmarkInfo,
                DistanceMeters = distanceMeters,
                DistanceFormatted = distanceFormatted,
                IsExpandedNearbySuggestion = false
            });
        }

        // 4. Proximity distance constraint and Smart Radius Fallback
        double? maxAllowedMeters = request.MaxDistanceMeters;
        if (!maxAllowedMeters.HasValue && request.MaxDistanceKm.HasValue)
        {
            maxAllowedMeters = request.MaxDistanceKm.Value * 1000.0;
        }

        var resultList = new List<PublicPropertyDto>();

        if (maxAllowedMeters.HasValue && refLat.HasValue && refLon.HasValue)
        {
            var directMatches = allDtos
                .Where(d => d.DistanceMeters.HasValue && d.DistanceMeters.Value <= maxAllowedMeters.Value)
                .OrderBy(d => d.DistanceMeters!.Value)
                .ToList();

            resultList.AddRange(directMatches);

            // Smart Radius Fallback: If narrow radius returns fewer than 2 properties,
            // only include expanded suggestions within a realistic local radius (max 50km)
            // or same province/city, NEVER far away cities like Da Lat (300km) when user is in HCM!
            if (directMatches.Count < 2)
            {
                const double maxFallbackRadiusMeters = 50000.0; // 50km metropolitan limit
                var fallbackCandidates = allDtos
                    .Where(d => !directMatches.Any(m => m.Id == d.Id) &&
                                d.DistanceMeters.HasValue &&
                                d.DistanceMeters.Value <= maxFallbackRadiusMeters)
                    .OrderBy(d => d.DistanceMeters!.Value)
                    .Take(4)
                    .ToList();

                foreach (var fb in fallbackCandidates)
                {
                    fb.IsExpandedNearbySuggestion = true;
                    resultList.Add(fb);
                }
            }
        }
        else if (refLat.HasValue && refLon.HasValue)
        {
            // If GPS or landmark reference point is provided without strict radius limit, order directly by proximity
            // Restrict to realistic metropolitan radius (max 50km) so distant cities are not returned
            const double maxRefRadiusMeters = 50000.0;
            resultList = allDtos
                .Where(d => d.DistanceMeters.HasValue && d.DistanceMeters.Value <= maxRefRadiusMeters)
                .OrderBy(d => d.DistanceMeters!.Value)
                .ToList();
        }
        else
        {
            resultList = allDtos;
        }

        // 5. Search and filter by Search keyword or DestinationKeyword
        var effectiveQuery = !string.IsNullOrWhiteSpace(request.DestinationKeyword)
            ? request.DestinationKeyword
            : request.Search;

        // If query is a GPS placeholder (e.g. "Vị trí hiện tại", "GPS", "Gần tôi"), bypass text filtering
        bool isGpsPlaceholder = !string.IsNullOrWhiteSpace(effectiveQuery) &&
            (effectiveQuery.Contains("GPS", StringComparison.OrdinalIgnoreCase) ||
             effectiveQuery.Contains("Vị trí hiện tại", StringComparison.OrdinalIgnoreCase) ||
             effectiveQuery.Contains("Gần tôi", StringComparison.OrdinalIgnoreCase));

        if (isGpsPlaceholder)
        {
            return resultList
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenBy(d => d.DistanceMeters ?? 999999.0)
                .ToList();
        }

        // If the query was purely a landmark name and we already resolved it, avoid over-filtering with text search
        if (targetLandmark != null && !string.IsNullOrWhiteSpace(effectiveQuery) &&
            VietnameseTextNormalizer.Matches(targetLandmark.Name, effectiveQuery.Trim()))
        {
            // If sorted by distance, keep distance order
            if (refLat.HasValue && refLon.HasValue)
            {
                return resultList
                    .Where(d => d.DistanceMeters.HasValue && d.DistanceMeters.Value <= 50000.0)
                    .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                    .ThenBy(d => d.DistanceMeters ?? 999999.0)
                    .ToList();
            }
            return resultList;
        }

        return FilterAndRank(resultList, effectiveQuery);
    }

    private List<PublicLandmarkDistanceDto> ResolveLandmarks(Property property)
    {
        var list = new List<PublicLandmarkDistanceDto>();

        // Try from json if populated
        if (!string.IsNullOrWhiteSpace(property.NearbyLandmarksJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(property.NearbyLandmarksJson);
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var name = el.TryGetProperty("Name", out var n) ? n.GetString() ?? "" : "";
                    var cat = el.TryGetProperty("Category", out var c) ? c.GetString() : null;
                    var dist = el.TryGetProperty("DistanceKm", out var d) ? d.GetDouble() : 0.0;
                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        var formatted = dist < 1.0 ? $"Cách {Math.Round(dist * 1000)}m" : $"Cách {dist:0.1}km";
                        list.Add(new PublicLandmarkDistanceDto(name, cat, dist, formatted));
                    }
                }
            }
            catch
            {
                // Json parsing error ignored safely
            }
        }

        // If coordinates available and location service is available, compute closest known landmarks
        if (list.Count == 0 && property.Latitude.HasValue && property.Longitude.HasValue && _locationService != null)
        {
            var landmarks = _locationService.GetLandmarks(touristZoneSlug: property.TouristZoneSlug);
            if (landmarks.Count == 0)
            {
                landmarks = _locationService.GetLandmarks();
            }

            var computed = landmarks
                .Select(lm =>
                {
                    var dist = CalculateDistanceKm(property.Latitude.Value, property.Longitude.Value, lm.Latitude, lm.Longitude);
                    var formatted = dist < 1.0 ? $"Cách {Math.Round(dist * 1000)}m" : $"Cách {dist:0.1}km";
                    return new PublicLandmarkDistanceDto(lm.Name, lm.Category, Math.Round(dist, 1), formatted);
                })
                .Where(l => l.DistanceKm <= 20.0)
                .OrderBy(l => l.DistanceKm)
                .Take(4)
                .ToList();

            list.AddRange(computed);
        }

        return list;
    }

    public static string? SanitizeVietnameseText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;
        if (!text.Contains('?')) return text;

        return text
            .Replace("TP. H? Ch? Minh", "TP. Hồ Chí Minh")
            .Replace("H? Ch? Minh", "Hồ Chí Minh")
            .Replace("H? Ch Minh", "Hồ Chí Minh")
            .Replace("Qu?n 1", "Quận 1")
            .Replace("Trung T?m", "Trung Tâm")
            .Replace("S?n bay Qu?c t? T?n S?n Nh?t", "Sân bay Quốc tế Tân Sơn Nhất")
            .Replace("T?n S?n Nh?t", "Tân Sơn Nhất")
            .Replace("S?n bay", "Sân bay")
            .Replace("Ch? B?n Thnh", "Chợ Bến Thành")
            .Replace("Ch? B?n Th?nh", "Chợ Bến Thành")
            .Replace("Ph? Di B? Nguy?n Hu?", "Phố Đi Bộ Nguyễn Huệ")
            .Replace("Ph? Di B? Nguy?n Hu?", "Phố Đi Bộ Nguyễn Huệ")
            .Replace("Khch s?n", "Khách sạn")
            .Replace("Kh?ch s?n", "Khách sạn")
            .Replace("Nh ngh?", "Nhà nghỉ")
            .Replace("Nh? ngh?", "Nhà nghỉ");
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

    public static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var rlat1 = Math.PI * lat1 / 180.0;
        var rlat2 = Math.PI * lat2 / 180.0;
        var theta = lon1 - lon2;
        var rtheta = Math.PI * theta / 180.0;
        var dist = Math.Sin(rlat1) * Math.Sin(rlat2) + Math.Cos(rlat1) * Math.Cos(rlat2) * Math.Cos(rtheta);
        dist = Math.Acos(Math.Min(1.0, Math.Max(-1.0, dist)));
        dist = dist * 180.0 / Math.PI;
        dist = dist * 60 * 1.1515 * 1.609344;
        return dist;
    }

    /// <summary>
    /// Applies fuzzy typo-tolerant matching and relevance ranking to public property DTOs.
    /// Preserves direct DTO projection, blank bypass, and deterministic tie-breaking.
    /// </summary>
    public static IReadOnlyList<PublicPropertyDto> FilterAndRank(
        IEnumerable<PublicPropertyDto> properties,
        string? search)
    {
        var matchResults = FuzzyPropertyMatcher.SearchProperties(search, properties);
        return matchResults.Select(r => r.Property).ToList();
    }
}
