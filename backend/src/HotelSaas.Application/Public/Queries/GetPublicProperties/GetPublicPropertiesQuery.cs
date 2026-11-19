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
/// user GPS coordinates, tenant brand slug, province code, and smart fallback recommendations.
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
    double? UserLongitude = null,
    string? TenantSlug = null,
    string? ProvinceCode = null) : IRequest<IReadOnlyList<PublicPropertyDto>>;

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
        }

        if (targetLandmark == null && !string.IsNullOrWhiteSpace(request.DestinationKeyword) && _locationService != null)
        {
            targetLandmark = _locationService.FindLandmark(request.DestinationKeyword.Trim());
            if (targetLandmark == null && string.IsNullOrEmpty(effectiveZoneSlug))
            {
                var zone = _locationService.FindTouristZone(request.DestinationKeyword.Trim());
                if (zone != null)
                {
                    effectiveZoneSlug = zone.Slug;
                }
            }
        }

        // Load active tenants safely (supports null or unimplemented DbSets in unit tests)
        var (activeTenants, tenantsAvailable) = await PublicPropertyMappingHelper.LoadActiveTenantsAsync(_context, cancellationToken);
        List<Guid>? matchingTenantIds = null;
        string? normalizedTenantSlug = string.IsNullOrWhiteSpace(request.TenantSlug)
            ? null
            : request.TenantSlug.Trim().ToLowerInvariant();

        if (normalizedTenantSlug != null && tenantsAvailable)
        {
            matchingTenantIds = activeTenants.Values
                .Where(t => string.Equals(t.Slug, normalizedTenantSlug, StringComparison.OrdinalIgnoreCase))
                .Select(t => t.Id)
                .ToList();

            if (matchingTenantIds.Count == 0)
            {
                return Array.Empty<PublicPropertyDto>();
            }
        }

        // 2. Query active properties
        var query = _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active);

        if (matchingTenantIds != null)
        {
            query = query.Where(p => matchingTenantIds.Contains(p.TenantId));
        }

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

        // If filtering by zone returned empty and we had an effectiveZoneSlug, only fallback when GPS coordinates or a landmark are active
        if (rawProperties.Count == 0 &&
            !string.IsNullOrWhiteSpace(effectiveZoneSlug) &&
            ((request.UserLatitude.HasValue && request.UserLongitude.HasValue) || targetLandmark != null))
        {
            var fallbackQuery = _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Active);

            if (matchingTenantIds != null)
            {
                fallbackQuery = fallbackQuery.Where(p => matchingTenantIds.Contains(p.TenantId));
            }

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

        if (normalizedTenantSlug != null && !tenantsAvailable)
        {
            rawProperties = rawProperties
                .Where(p => string.Equals(p.Slug, normalizedTenantSlug, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (rawProperties.Count == 0)
        {
            return Array.Empty<PublicPropertyDto>();
        }

        var propertyIds = rawProperties.Select(p => p.Id).ToList();

        // 3. Load active rates and published reviews safely
        var rates = await PublicPropertyMappingHelper.LoadActiveRatesAsync(_context, propertyIds, cancellationToken);
        var reviewStats = await PublicPropertyMappingHelper.LoadPublishedReviewStatsAsync(_context, propertyIds, cancellationToken);

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
            activeTenants.TryGetValue(p.TenantId, out var tenant);
            reviewStats.TryGetValue(p.Id, out var reviewStat);

            // Calculate distance to reference point if available
            double? distanceMeters = null;
            string? distanceFormatted = null;

            if (refLat.HasValue && refLon.HasValue && p.Latitude.HasValue && p.Longitude.HasValue)
            {
                var meters = GeoProximityHelper.CalculateDistanceMeters(refLat.Value, refLon.Value, p.Latitude.Value, p.Longitude.Value);
                distanceMeters = Math.Round(meters);
                distanceFormatted = GeoProximityHelper.FormatDistance(meters);
            }

            allDtos.Add(PublicPropertyMappingHelper.BuildDto(
                p,
                tenant,
                propRates,
                reviewStat,
                request.RentalType,
                _locationService,
                distanceMeters,
                distanceFormatted));
        }

        if (!string.IsNullOrWhiteSpace(request.ProvinceCode))
        {
            allDtos = allDtos
                .Where(dto => PublicPropertyMappingHelper.MatchesProvinceCode(dto, request.ProvinceCode!, _locationService))
                .ToList();
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
                    .Where(d => (d.DistanceMeters.HasValue && d.DistanceMeters.Value <= 50000.0) ||
                                (!d.DistanceMeters.HasValue &&
                                 !string.IsNullOrWhiteSpace(targetLandmark.TouristZoneSlug) &&
                                 string.Equals(d.TouristZoneSlug, targetLandmark.TouristZoneSlug, StringComparison.OrdinalIgnoreCase)))
                    .OrderBy(d => d.DistanceMeters.HasValue ? 0 : 1)
                    .ThenBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                    .ThenBy(d => d.DistanceMeters ?? 999999.0)
                    .ToList();
            }
            return resultList;
        }

        // Province keyword resolution (e.g., "Đà Nẵng", "Hà Nội", "TP. Hồ Chí Minh") when no zone/landmark/code is bound
        if (string.IsNullOrWhiteSpace(request.ProvinceCode) &&
            targetLandmark == null &&
            string.IsNullOrWhiteSpace(effectiveZoneSlug) &&
            !string.IsNullOrWhiteSpace(effectiveQuery) &&
            _locationService != null)
        {
            var queryProvinceTitle = PublicPropertyMappingHelper.NormalizeProvinceTitle(effectiveQuery);
            if (!string.IsNullOrEmpty(queryProvinceTitle))
            {
                var matchedProv = PublicPropertyMappingHelper.FindProvinceByTitleOrAlias(_locationService, queryProvinceTitle);

                if (matchedProv != null)
                {
                    var provinceMatches = resultList
                        .Where(dto => PublicPropertyMappingHelper.MatchesProvinceCode(dto, matchedProv.Code, _locationService))
                        .ToList();

                    if (provinceMatches.Count > 0)
                    {
                        return provinceMatches;
                    }
                }
            }
        }

        return FilterAndRank(resultList, effectiveQuery);
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
            .Replace("Khch s?n", "Khách sạn")
            .Replace("Kh?ch s?n", "Khách sạn")
            .Replace("Nh ngh?", "Nhà nghỉ")
            .Replace("Nh? ngh?", "Nhà nghỉ");
    }

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

internal static class PublicPropertyMappingHelper
{
    private static readonly IReadOnlyDictionary<PropertyType, string[]> CuratedGalleriesByType =
        new Dictionary<PropertyType, string[]>
        {
            [PropertyType.Hotel] = new[]
            {
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Resort] = new[]
            {
                "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1549294413-26f195200c16?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Hostel] = new[]
            {
                "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1623625434462-e5e42318ae49?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.BedAndBreakfast] = new[]
            {
                "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1540518614846-7ede433c4574?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Villa] = new[]
            {
                "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Apartment] = new[]
            {
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Motel] = new[]
            {
                "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80"
            },
            [PropertyType.Homestay] = new[]
            {
                "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1200&q=80"
            }
        };

    internal static async Task<(Dictionary<Guid, Tenant> Tenants, bool Available)> LoadActiveTenantsAsync(
        IApplicationDbContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            var tenantsSet = context.Tenants;
            if (tenantsSet is null)
            {
                return (new Dictionary<Guid, Tenant>(), false);
            }

            var tenants = await tenantsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(t => t.Status == TenantStatus.Active)
                .ToListAsync(cancellationToken);

            return (tenants.ToDictionary(t => t.Id), true);
        }
        catch (NotImplementedException)
        {
            return (new Dictionary<Guid, Tenant>(), false);
        }
    }

    internal static async Task<Tenant?> LoadActiveTenantByIdAsync(
        IApplicationDbContext context,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        try
        {
            var tenantsSet = context.Tenants;
            if (tenantsSet is null)
            {
                return null;
            }

            var tenants = await tenantsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(t => t.Id == tenantId && t.Status == TenantStatus.Active)
                .Take(1)
                .ToListAsync(cancellationToken);

            return tenants.FirstOrDefault();
        }
        catch (NotImplementedException)
        {
            return null;
        }
    }

    internal static async Task<List<RoomTypeRate>> LoadActiveRatesAsync(
        IApplicationDbContext context,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
        {
            return new List<RoomTypeRate>();
        }

        try
        {
            var ratesSet = context.RoomTypeRates;
            if (ratesSet is null)
            {
                return new List<RoomTypeRate>();
            }

            return await ratesSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.IsActive && propertyIds.Contains(r.PropertyId))
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            return new List<RoomTypeRate>();
        }
    }

    internal static async Task<Dictionary<Guid, (double Average, int Count)>> LoadPublishedReviewStatsAsync(
        IApplicationDbContext context,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
        {
            return new Dictionary<Guid, (double Average, int Count)>();
        }

        try
        {
            var reviewsSet = context.GuestReviews;
            if (reviewsSet is null)
            {
                return new Dictionary<Guid, (double Average, int Count)>();
            }

            var reviews = await reviewsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.IsPublished && r.Reservation != null && propertyIds.Contains(r.Reservation.PropertyId))
                .Select(r => new { r.Reservation!.PropertyId, r.OverallRating })
                .ToListAsync(cancellationToken);

            return reviews
                .GroupBy(r => r.PropertyId)
                .ToDictionary(
                    g => g.Key,
                    g => (Math.Round(g.Average(x => x.OverallRating), 1), g.Count()));
        }
        catch (NotImplementedException)
        {
            return new Dictionary<Guid, (double Average, int Count)>();
        }
    }

    internal static PublicPropertyDto BuildDto(
        Property p,
        Tenant? tenant,
        IReadOnlyList<RoomTypeRate>? propRates,
        (double Average, int Count) reviewStat,
        RentalType? rentalType,
        ILocationLookupService? locationService,
        double? distanceMeters = null,
        string? distanceFormatted = null,
        bool isExpandedNearbySuggestion = false)
    {
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

        decimal? startingPrice = rentalType switch
        {
            RentalType.Hourly => hourlyStart,
            RentalType.Overnight => overnightStart,
            RentalType.Daily => dailyStart ?? overnightStart,
            _ => dailyStart ?? overnightStart ?? hourlyStart
        };

        var nearbyLandmarks = ResolveLandmarks(p, locationService);
        string? nearestLandmarkInfo = nearbyLandmarks.Count > 0
            ? $"{nearbyLandmarks[0].DistanceFormatted} {nearbyLandmarks[0].Name}"
            : null;

        var hasReviews = reviewStat.Count > 0;
        var reviewCount = hasReviews ? reviewStat.Count : 0;
        var ratingAverage = hasReviews
            ? reviewStat.Average
            : (p.StarRating >= 5 ? 4.9 : (p.StarRating == 4 ? 4.7 : (p.StarRating > 0 ? 4.5 : 4.6)));

        var (provinceCode, provinceName, wardName) = ResolveLocationMetadata(p, locationService);
        var (thumbnailUrl, galleryUrls) = ResolveVisualGallery(p);

        return new PublicPropertyDto
        {
            Id = p.Id,
            TenantId = p.TenantId,
            TenantBrandName = tenant != null
                ? (GetPublicPropertiesQueryHandler.SanitizeVietnameseText(tenant.Name) ?? tenant.Name)
                : (GetPublicPropertiesQueryHandler.SanitizeVietnameseText(p.Name) ?? p.Name),
            TenantSlug = tenant?.Slug ?? p.Slug,
            Name = p.Name,
            Code = p.Code,
            Slug = p.Slug,
            Address = p.Address,
            City = p.City,
            ProvinceCode = provinceCode,
            ProvinceName = provinceName,
            WardName = wardName,
            CheckInTime = p.CheckInTime,
            CheckOutTime = p.CheckOutTime,
            BufferMinutes = p.BufferMinutes,
            MaxHourlyHours = p.MaxHourlyHours,
            ImageUrl = null,
            ThumbnailUrl = thumbnailUrl,
            GalleryUrls = galleryUrls,
            PropertyType = p.PropertyType,
            PropertyTypeName = GetPropertyTypeName(p.PropertyType),
            StarRating = p.StarRating,
            RatingAverage = ratingAverage,
            ReviewCount = reviewCount,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            TouristZoneSlug = p.TouristZoneSlug,
            TouristZoneName = GetPublicPropertiesQueryHandler.SanitizeVietnameseText(p.TouristZoneName),
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
            IsExpandedNearbySuggestion = isExpandedNearbySuggestion
        };
    }

    internal static List<PublicLandmarkDistanceDto> ResolveLandmarks(Property property, ILocationLookupService? locationService)
    {
        var list = new List<PublicLandmarkDistanceDto>();

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
                        var formatted = dist < 1.0 ? $"Cách {Math.Round(dist * 1000)}m" : $"Cách {dist:0.0}km";
                        list.Add(new PublicLandmarkDistanceDto(name, cat, dist, formatted));
                    }
                }
            }
            catch
            {
                // Json parsing error ignored safely
            }
        }

        if (list.Count == 0 && property.Latitude.HasValue && property.Longitude.HasValue && locationService != null)
        {
            var landmarks = locationService.GetLandmarks(touristZoneSlug: property.TouristZoneSlug);
            if (landmarks.Count == 0)
            {
                landmarks = locationService.GetLandmarks();
            }

            var computed = landmarks
                .Select(lm =>
                {
                    var dist = GetPublicPropertiesQueryHandler.CalculateDistanceKm(property.Latitude.Value, property.Longitude.Value, lm.Latitude, lm.Longitude);
                    var formatted = dist < 1.0 ? $"Cách {Math.Round(dist * 1000)}m" : $"Cách {dist:0.0}km";
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

    internal static (string? ThumbnailUrl, List<string> GalleryUrls) ResolveVisualGallery(Property property)
    {
        if (!CuratedGalleriesByType.TryGetValue(property.PropertyType, out var pool) || pool.Length == 0)
        {
            pool = CuratedGalleriesByType[PropertyType.Hotel];
        }

        var seedText = !string.IsNullOrWhiteSpace(property.Slug)
            ? property.Slug
            : (!string.IsNullOrWhiteSpace(property.Name) ? property.Name : property.Id.ToString("N"));

        uint hash = 2166136261u;
        foreach (var ch in seedText)
        {
            hash ^= char.ToLowerInvariant(ch);
            hash *= 16777619u;
        }

        var startIndex = (int)(hash % (uint)pool.Length);
        var count = Math.Min(3, pool.Length);
        var gallery = new List<string>(count);
        for (var i = 0; i < count; i++)
        {
            gallery.Add(pool[(startIndex + i) % pool.Length]);
        }

        return (gallery[0], gallery);
    }

    internal static (string? ProvinceCode, string? ProvinceName, string? WardName) ResolveLocationMetadata(
        Property property,
        ILocationLookupService? locationService)
    {
        var provinceName = GetPublicPropertiesQueryHandler.SanitizeVietnameseText(property.City);
        string? provinceCode = null;
        string? wardName = ExtractWardFromAddress(property.Address);

        if (locationService != null)
        {
            var matchedProvince = MatchProvince(locationService, provinceName, property.TouristZoneSlug, property.Address);
            if (matchedProvince != null)
            {
                provinceCode = matchedProvince.Code;
            }
        }

        return (provinceCode, provinceName, wardName);
    }

    private static readonly IReadOnlyDictionary<string, string> LegacyProvinceCodeToCanonical =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["VN-SG"] = "79",
            ["1"] = "01",
            ["01"] = "01",
            ["4"] = "04",
            ["04"] = "04",
            ["2"] = "08",
            ["02"] = "08",
            ["8"] = "08",
            ["08"] = "08",
            ["10"] = "15",
            ["6"] = "19",
            ["06"] = "19",
            ["27"] = "24",
            ["17"] = "25",
            ["26"] = "25",
            ["30"] = "31",
            ["34"] = "33",
            ["35"] = "37",
            ["36"] = "37",
            ["45"] = "44",
            ["49"] = "48",
            ["62"] = "51",
            ["64"] = "52",
            ["58"] = "56",
            ["54"] = "66",
            ["60"] = "68",
            ["67"] = "68",
            ["70"] = "75",
            ["74"] = "79",
            ["77"] = "79",
            ["72"] = "80",
            ["87"] = "82",
            ["83"] = "86",
            ["84"] = "86",
            ["89"] = "91",
            ["93"] = "92",
            ["94"] = "92",
            ["95"] = "96"
        };

    private static readonly IReadOnlyDictionary<string, string> LegacyProvinceTitleToCanonical =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ha giang"] = "08",
            ["yen bai"] = "15",
            ["sa pa"] = "15",
            ["bac kan"] = "19",
            ["bac can"] = "19",
            ["bac giang"] = "24",
            ["hoa binh"] = "25",
            ["vinh phuc"] = "25",
            ["hai duong"] = "31",
            ["thai binh"] = "33",
            ["ha nam"] = "37",
            ["nam dinh"] = "37",
            ["quang binh"] = "44",
            ["thua thien hue"] = "46",
            ["quang nam"] = "48",
            ["hoi an"] = "48",
            ["kon tum"] = "51",
            ["mang den"] = "51",
            ["binh dinh"] = "52",
            ["quy nhon"] = "52",
            ["ninh thuan"] = "56",
            ["nha trang"] = "56",
            ["phu yen"] = "66",
            ["tuy hoa"] = "66",
            ["binh thuan"] = "68",
            ["phan thiet"] = "68",
            ["mui ne"] = "68",
            ["dak nong"] = "68",
            ["da lat"] = "68",
            ["binh phuoc"] = "75",
            ["ba ria - vung tau"] = "79",
            ["ba ria vung tau"] = "79",
            ["vung tau"] = "79",
            ["binh duong"] = "79",
            ["sai gon"] = "79",
            ["saigon"] = "79",
            ["long an"] = "80",
            ["tien giang"] = "82",
            ["sa dec"] = "82",
            ["ben tre"] = "86",
            ["tra vinh"] = "86",
            ["kien giang"] = "91",
            ["phu quoc"] = "91",
            ["chau doc"] = "91",
            ["hau giang"] = "92",
            ["soc trang"] = "92",
            ["bac lieu"] = "96"
        };

    internal static string ResolveCanonicalProvinceCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return string.Empty;

        var trimmed = code.Trim();
        if (LegacyProvinceCodeToCanonical.TryGetValue(trimmed, out var canonical))
        {
            return canonical;
        }

        var stripped = trimmed.TrimStart('0');
        if (!string.IsNullOrEmpty(stripped) && LegacyProvinceCodeToCanonical.TryGetValue(stripped, out var canonicalStripped))
        {
            return canonicalStripped;
        }

        if (trimmed.Length == 1 && char.IsDigit(trimmed[0]))
        {
            return "0" + trimmed;
        }

        return trimmed;
    }

    internal static ProvinceDto? FindProvinceByTitleOrAlias(ILocationLookupService locationService, string normalizedTitle)
    {
        if (string.IsNullOrEmpty(normalizedTitle)) return null;

        var direct = locationService.GetProvinces()
            .FirstOrDefault(p => string.Equals(
                NormalizeProvinceTitle(p.Name),
                normalizedTitle,
                StringComparison.OrdinalIgnoreCase));
        if (direct != null) return direct;

        if (LegacyProvinceTitleToCanonical.TryGetValue(normalizedTitle, out var canonicalCode))
        {
            return FindProvinceByCode(locationService, canonicalCode);
        }

        return null;
    }

    internal static bool MatchesProvinceCode(
        PublicPropertyDto dto,
        string requestedProvinceCode,
        ILocationLookupService? locationService)
    {
        var reqCanonical = ResolveCanonicalProvinceCode(requestedProvinceCode);
        if (string.IsNullOrEmpty(reqCanonical))
        {
            return true;
        }

        var dtoCanonical = ResolveCanonicalProvinceCode(dto.ProvinceCode);
        if (!string.IsNullOrEmpty(dtoCanonical) &&
            string.Equals(dtoCanonical, reqCanonical, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var dtoTitle = NormalizeProvinceTitle(dto.ProvinceName ?? dto.City);
        if (!string.IsNullOrEmpty(dtoTitle) &&
            LegacyProvinceTitleToCanonical.TryGetValue(dtoTitle, out var legacyDtoCanonical) &&
            string.Equals(legacyDtoCanonical, reqCanonical, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (locationService != null)
        {
            var targetProvince = FindProvinceByCode(locationService, reqCanonical);
            if (targetProvince != null)
            {
                var targetTitle = NormalizeProvinceTitle(targetProvince.Name);
                if (!string.IsNullOrEmpty(targetTitle) && !string.IsNullOrEmpty(dtoTitle) &&
                    (string.Equals(dtoTitle, targetTitle, StringComparison.OrdinalIgnoreCase) ||
                     dtoTitle.Contains(targetTitle, StringComparison.OrdinalIgnoreCase)))
                {
                    return true;
                }

                var normAddress = VietnameseTextNormalizer.Normalize(dto.Address);
                if (!string.IsNullOrEmpty(targetTitle) && normAddress.Contains(targetTitle, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (!string.IsNullOrEmpty(normAddress))
                {
                    foreach (var kvp in LegacyProvinceTitleToCanonical)
                    {
                        if (string.Equals(kvp.Value, targetProvince.Code, StringComparison.OrdinalIgnoreCase) &&
                            normAddress.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    internal static ProvinceDto? FindProvinceByCode(ILocationLookupService locationService, string code)
    {
        var canonical = ResolveCanonicalProvinceCode(code);
        var direct = locationService.GetProvinceByCode(canonical);
        if (direct != null)
        {
            return direct;
        }

        var key = NormalizeProvinceCodeKey(canonical);
        return locationService.GetProvinces()
            .FirstOrDefault(p => string.Equals(NormalizeProvinceCodeKey(p.Code), key, StringComparison.OrdinalIgnoreCase));
    }

    private static ProvinceDto? MatchProvince(
        ILocationLookupService locationService,
        string? city,
        string? touristZoneSlug,
        string? address)
    {
        var provinces = locationService.GetProvinces();
        var cityTitle = NormalizeProvinceTitle(city);

        if (!string.IsNullOrEmpty(cityTitle))
        {
            var exact = provinces.FirstOrDefault(pr =>
                string.Equals(NormalizeProvinceTitle(pr.Name), cityTitle, StringComparison.OrdinalIgnoreCase));
            if (exact != null) return exact;

            if (LegacyProvinceTitleToCanonical.TryGetValue(cityTitle, out var canonicalFromLegacyTitle))
            {
                var byLegacyTitle = FindProvinceByCode(locationService, canonicalFromLegacyTitle);
                if (byLegacyTitle != null) return byLegacyTitle;
            }
        }

        if (!string.IsNullOrWhiteSpace(touristZoneSlug))
        {
            var zone = locationService.GetTouristZoneBySlug(touristZoneSlug.Trim());
            if (zone != null && !string.IsNullOrWhiteSpace(zone.ProvinceCode))
            {
                var byZone = FindProvinceByCode(locationService, zone.ProvinceCode);
                if (byZone != null) return byZone;
            }
        }

        if (!string.IsNullOrEmpty(cityTitle))
        {
            var zoneByCity = locationService.FindTouristZone(city!);
            if (zoneByCity != null && !string.IsNullOrWhiteSpace(zoneByCity.ProvinceCode))
            {
                var byZone = FindProvinceByCode(locationService, zoneByCity.ProvinceCode);
                if (byZone != null) return byZone;
            }
        }

        if (!string.IsNullOrWhiteSpace(address))
        {
            var normAddress = VietnameseTextNormalizer.Normalize(address);
            var byAddress = provinces.FirstOrDefault(pr =>
            {
                var title = NormalizeProvinceTitle(pr.Name);
                return !string.IsNullOrEmpty(title) && normAddress.Contains(title, StringComparison.OrdinalIgnoreCase);
            });
            if (byAddress != null) return byAddress;

            foreach (var kvp in LegacyProvinceTitleToCanonical)
            {
                if (normAddress.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                {
                    var byLegacyAddr = FindProvinceByCode(locationService, kvp.Value);
                    if (byLegacyAddr != null) return byLegacyAddr;
                }
            }
        }

        return null;
    }

    private static string? ExtractWardFromAddress(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return null;

        var parts = address.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var rawPart in parts)
        {
            var part = GetPublicPropertiesQueryHandler.SanitizeVietnameseText(rawPart)?.Trim();
            if (string.IsNullOrEmpty(part)) continue;

            if (part.StartsWith("Phường ", StringComparison.OrdinalIgnoreCase) ||
                part.StartsWith("P.", StringComparison.OrdinalIgnoreCase) ||
                part.StartsWith("Xã ", StringComparison.OrdinalIgnoreCase) ||
                part.StartsWith("Thị trấn ", StringComparison.OrdinalIgnoreCase) ||
                part.StartsWith("Đặc khu ", StringComparison.OrdinalIgnoreCase))
            {
                return part;
            }
        }

        return null;
    }

    private static string NormalizeProvinceCodeKey(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return string.Empty;
        var trimmed = code.Trim().TrimStart('0');
        return string.IsNullOrEmpty(trimmed) ? "0" : trimmed;
    }

    internal static string NormalizeProvinceTitle(string? text)
    {
        var norm = VietnameseTextNormalizer.Normalize(text);
        if (string.IsNullOrEmpty(norm)) return string.Empty;

        string[] prefixes = ["thanh pho ", "tp. ", "tp ", "tinh "];
        foreach (var prefix in prefixes)
        {
            if (norm.StartsWith(prefix, StringComparison.Ordinal))
            {
                norm = norm[prefix.Length..].Trim();
                break;
            }
        }

        if (norm is "tphcm" or "hcm" or "tp ho chi minh")
        {
            return "ho chi minh";
        }

        return norm;
    }

    internal static string GetPropertyTypeName(PropertyType propertyType) => propertyType switch
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
