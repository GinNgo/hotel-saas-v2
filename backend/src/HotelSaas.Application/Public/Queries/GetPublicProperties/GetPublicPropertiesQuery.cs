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
using HotelSaas.Application.Reservations.Services;

namespace HotelSaas.Application.Public.Queries.GetPublicProperties;

/// <summary>
/// Preserves the IReadOnlyList&lt;PublicPropertyDto&gt; contract and plain JSON array serialization
/// while carrying pre-pagination TotalCount for HTTP X-Total-Count headers.
/// </summary>
public sealed class PagedPropertyList : List<PublicPropertyDto>
{
    public int TotalCount { get; }

    public PagedPropertyList(IEnumerable<PublicPropertyDto> items, int totalCount)
        : base(items)
    {
        TotalCount = totalCount;
    }
}

/// <summary>
/// Query to retrieve active properties available for public discovery.
/// Supports search, destination keyword, property type filters, rental types, tourist zones, landmarks,
/// user GPS coordinates, tenant brand slug, province code, price range, guest capacity, dates, pagination,
/// publish guard, sorting, and smart fallback recommendations.
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
    string? ProvinceCode = null,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    int? Guests = null,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null,
    int? Page = null,
    int? PageSize = null,
    bool OnlyPublished = false,
    string? SortBy = null) : IRequest<IReadOnlyList<PublicPropertyDto>>;

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
        var (activeTenants, inactiveTenantIds, tenantsAvailable) = await PublicPropertyMappingHelper.LoadTenantsMetadataAsync(_context, cancellationToken);
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
            .Where(p => p.Status == PropertyStatus.Active && (!request.OnlyPublished || p.IsPublished));

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
                .Where(p => p.Status == PropertyStatus.Active && (!request.OnlyPublished || p.IsPublished));

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

        if (tenantsAvailable && inactiveTenantIds.Count > 0)
        {
            rawProperties = rawProperties
                .Where(p => !inactiveTenantIds.Contains(p.TenantId))
                .ToList();
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

        // 3. Load active rates, published reviews, and real room type media/capacity safely
        var rates = await PublicPropertyMappingHelper.LoadActiveRatesAsync(_context, propertyIds, cancellationToken);
        var reviewStats = await PublicPropertyMappingHelper.LoadPublishedReviewStatsAsync(_context, propertyIds, cancellationToken);
        var (roomTypes, roomTypesAvailable) = await PublicPropertyMappingHelper.LoadRoomTypesAsync(_context, propertyIds, cancellationToken);

        var roomTypesByProperty = roomTypes.GroupBy(rt => rt.PropertyId)
            .ToDictionary(g => g.Key, g => g.ToList());

        if ((request.Guests.HasValue && request.Guests.Value > 0) ||
            (request.CheckInDate.HasValue && request.CheckOutDate.HasValue))
        {
            rawProperties = await PublicPropertyMappingHelper.FilterByGuestsAndAvailabilityAsync(
                _context,
                rawProperties,
                propertyIds,
                roomTypesByProperty,
                roomTypesAvailable,
                request.Guests,
                request.CheckInDate,
                request.CheckOutDate,
                cancellationToken);

            if (rawProperties.Count == 0)
            {
                return Array.Empty<PublicPropertyDto>();
            }
        }

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
            roomTypesByProperty.TryGetValue(p.Id, out var propRoomTypes);

            // Calculate distance to reference point if available
            double? distanceMeters = null;
            string? distanceFormatted = null;

            if (refLat.HasValue && refLon.HasValue)
            {
                double? propLat = p.Latitude;
                double? propLon = p.Longitude;

                if ((!propLat.HasValue || !propLon.HasValue) &&
                    !string.IsNullOrWhiteSpace(p.TouristZoneSlug) &&
                    _locationService != null)
                {
                    var zone = _locationService.GetTouristZoneBySlug(p.TouristZoneSlug.Trim());
                    if (zone is { CenterLatitude: not null, CenterLongitude: not null })
                    {
                        propLat = zone.CenterLatitude.Value;
                        propLon = zone.CenterLongitude.Value;
                    }
                }

                if (propLat.HasValue && propLon.HasValue)
                {
                    var meters = GeoProximityHelper.CalculateDistanceMeters(refLat.Value, refLon.Value, propLat.Value, propLon.Value);
                    distanceMeters = Math.Round(meters);
                    distanceFormatted = GeoProximityHelper.FormatDistance(meters);
                }
            }

            allDtos.Add(PublicPropertyMappingHelper.BuildDto(
                p,
                tenant,
                propRates,
                reviewStat,
                request.RentalType,
                _locationService,
                distanceMeters,
                distanceFormatted,
                isExpandedNearbySuggestion: false,
                roomTypes: propRoomTypes));
        }

        if (!string.IsNullOrWhiteSpace(request.ProvinceCode))
        {
            allDtos = allDtos
                .Where(dto => PublicPropertyMappingHelper.MatchesProvinceCode(dto, request.ProvinceCode!, _locationService))
                .ToList();
        }

        if (request.MinPrice.HasValue || request.MaxPrice.HasValue)
        {
            allDtos = allDtos
                .Where(dto =>
                {
                    var price = dto.StartingPrice;
                    if (!price.HasValue || price.Value <= 0m) return false;
                    if (request.MinPrice.HasValue && price.Value < request.MinPrice.Value) return false;
                    if (request.MaxPrice.HasValue && price.Value > request.MaxPrice.Value) return false;
                    return true;
                })
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

        // Pure-GPS nationwide safety net: if a GPS user is >50km from all properties,
        // return the 6 closest active properties as expanded suggestions instead of an empty list.
        if (resultList.Count == 0 &&
            request.UserLatitude.HasValue &&
            request.UserLongitude.HasValue &&
            targetLandmark == null)
        {
            var nationwideNearest = allDtos
                .Where(d => d.DistanceMeters.HasValue)
                .OrderBy(d => d.DistanceMeters!.Value)
                .Take(6)
                .ToList();

            foreach (var fb in nationwideNearest)
            {
                fb.IsExpandedNearbySuggestion = true;
                resultList.Add(fb);
            }
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

        IReadOnlyList<PublicPropertyDto> matched;

        if (isGpsPlaceholder)
        {
            matched = resultList
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenBy(d => d.DistanceMeters ?? 999999.0)
                .ToList();
        }
        else if (targetLandmark != null && !string.IsNullOrWhiteSpace(effectiveQuery) &&
            VietnameseTextNormalizer.Matches(targetLandmark.Name, effectiveQuery.Trim()))
        {
            // If the query was purely a landmark name and we already resolved it, avoid over-filtering with text search
            if (refLat.HasValue && refLon.HasValue)
            {
                matched = resultList
                    .Where(d => (d.DistanceMeters.HasValue && d.DistanceMeters.Value <= 50000.0) ||
                                (!d.DistanceMeters.HasValue &&
                                 !string.IsNullOrWhiteSpace(targetLandmark.TouristZoneSlug) &&
                                 string.Equals(d.TouristZoneSlug, targetLandmark.TouristZoneSlug, StringComparison.OrdinalIgnoreCase)))
                    .OrderBy(d => d.DistanceMeters.HasValue ? 0 : 1)
                    .ThenBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                    .ThenBy(d => d.DistanceMeters ?? 999999.0)
                    .ToList();
            }
            else
            {
                matched = resultList;
            }
        }
        else if (string.IsNullOrWhiteSpace(request.ProvinceCode) &&
            targetLandmark == null &&
            string.IsNullOrWhiteSpace(effectiveZoneSlug) &&
            !string.IsNullOrWhiteSpace(effectiveQuery) &&
            _locationService != null)
        {
            var queryProvinceTitle = PublicPropertyMappingHelper.NormalizeProvinceTitle(effectiveQuery);
            IReadOnlyList<PublicPropertyDto>? provinceMatches = null;
            if (!string.IsNullOrEmpty(queryProvinceTitle))
            {
                var matchedProv = PublicPropertyMappingHelper.FindProvinceByTitleOrAlias(_locationService, queryProvinceTitle);
                if (matchedProv != null)
                {
                    var matches = resultList
                        .Where(dto => PublicPropertyMappingHelper.MatchesProvinceCode(dto, matchedProv.Code, _locationService))
                        .ToList();
                    if (matches.Count > 0)
                    {
                        provinceMatches = matches;
                    }
                }
            }

            matched = provinceMatches ?? FilterAndRank(resultList, effectiveQuery);
        }
        else
        {
            matched = FilterAndRank(resultList, effectiveQuery);
        }

        if (!string.IsNullOrWhiteSpace(request.SortBy))
        {
            matched = PublicPropertyMappingHelper.ApplySort(matched, request.SortBy);
        }

        if (request.Page.HasValue && request.PageSize.HasValue && request.Page.Value > 0 && request.PageSize.Value > 0)
        {
            var totalCount = matched.Count;
            var paged = matched
                .Skip((request.Page.Value - 1) * request.PageSize.Value)
                .Take(request.PageSize.Value)
                .ToList();
            return new PagedPropertyList(paged, totalCount);
        }

        return matched;
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
    internal static async Task<(Dictionary<Guid, Tenant> ActiveTenants, HashSet<Guid> InactiveTenantIds, bool Available)> LoadTenantsMetadataAsync(
        IApplicationDbContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            var tenantsSet = context.Tenants;
            if (tenantsSet is null)
            {
                return (new Dictionary<Guid, Tenant>(), new HashSet<Guid>(), false);
            }

            var tenants = await tenantsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var active = tenants
                .Where(t => t.Status == TenantStatus.Active)
                .ToDictionary(t => t.Id);
            var inactiveIds = tenants
                .Where(t => t.Status != TenantStatus.Active)
                .Select(t => t.Id)
                .ToHashSet();

            return (active, inactiveIds, true);
        }
        catch (NotImplementedException)
        {
            return (new Dictionary<Guid, Tenant>(), new HashSet<Guid>(), false);
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

    internal static async Task<(List<RoomType> RoomTypes, bool Available)> LoadRoomTypesAsync(
        IApplicationDbContext context,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
        {
            return (new List<RoomType>(), false);
        }

        try
        {
            var roomTypesSet = context.RoomTypes;
            if (roomTypesSet is null)
            {
                return (new List<RoomType>(), false);
            }

            var roomTypes = await roomTypesSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(rt => propertyIds.Contains(rt.PropertyId))
                .OrderBy(rt => rt.BasePrice)
                .ThenBy(rt => rt.Name)
                .ToListAsync(cancellationToken);

            return (roomTypes, true);
        }
        catch (NotImplementedException)
        {
            return (new List<RoomType>(), false);
        }
    }

    internal static async Task<(List<Room> Rooms, bool Available)> LoadActiveRoomsAsync(
        IApplicationDbContext context,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
        {
            return (new List<Room>(), false);
        }

        try
        {
            var roomsSet = context.Rooms;
            if (roomsSet is null)
            {
                return (new List<Room>(), false);
            }

            var rooms = await roomsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.IsActive && propertyIds.Contains(r.PropertyId))
                .ToListAsync(cancellationToken);

            return (rooms, true);
        }
        catch (NotImplementedException)
        {
            return (new List<Room>(), false);
        }
    }

    internal static async Task<(List<Reservation> Reservations, bool Available)> LoadBlockingReservationsAsync(
        IApplicationDbContext context,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
        {
            return (new List<Reservation>(), false);
        }

        try
        {
            var reservationsSet = context.Reservations;
            if (reservationsSet is null)
            {
                return (new List<Reservation>(), false);
            }

            var reservations = await reservationsSet
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => propertyIds.Contains(r.PropertyId) &&
                            (r.Status == ReservationStatus.PendingPayment ||
                             r.Status == ReservationStatus.Confirmed ||
                             r.Status == ReservationStatus.CheckedIn))
                .ToListAsync(cancellationToken);

            return (reservations, true);
        }
        catch (NotImplementedException)
        {
            return (new List<Reservation>(), false);
        }
    }

    internal static async Task<List<Property>> FilterByGuestsAndAvailabilityAsync(
        IApplicationDbContext context,
        List<Property> rawProperties,
        IReadOnlyCollection<Guid> propertyIds,
        IReadOnlyDictionary<Guid, List<RoomType>> roomTypesByProperty,
        bool roomTypesAvailable,
        int? guests,
        DateOnly? checkInDate,
        DateOnly? checkOutDate,
        CancellationToken cancellationToken)
    {
        var checkDates = checkInDate.HasValue && checkOutDate.HasValue;
        var roomsAvailable = false;
        Dictionary<Guid, List<Room>> roomsByProperty = new();
        var reservationsAvailable = false;
        ILookup<Guid, Reservation>? reservationsByRoom = null;

        if (checkDates)
        {
            var loadedRooms = await LoadActiveRoomsAsync(context, propertyIds, cancellationToken);
            roomsAvailable = loadedRooms.Available;
            if (roomsAvailable)
            {
                roomsByProperty = loadedRooms.Rooms
                    .GroupBy(r => r.PropertyId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                if (checkOutDate!.Value > checkInDate!.Value)
                {
                    var loadedRes = await LoadBlockingReservationsAsync(context, propertyIds, cancellationToken);
                    reservationsAvailable = loadedRes.Available;
                    if (reservationsAvailable)
                    {
                        reservationsByRoom = loadedRes.Reservations.ToLookup(r => r.RoomId);
                    }
                }
            }
        }

        var nowUtc = DateTime.UtcNow;
        var filtered = new List<Property>(rawProperties.Count);

        foreach (var prop in rawProperties)
        {
            var propRoomTypes = roomTypesByProperty.TryGetValue(prop.Id, out var loadedPropRoomTypes)
                ? loadedPropRoomTypes
                : (prop.RoomTypes != null ? prop.RoomTypes.ToList() : new List<RoomType>());

            if (guests.HasValue && guests.Value > 0 && (roomTypesAvailable || propRoomTypes.Count > 0))
            {
                if (!propRoomTypes.Any(rt => rt.MaxOccupancy >= guests.Value))
                {
                    continue;
                }
            }

            if (checkDates && roomsAvailable)
            {
                roomsByProperty.TryGetValue(prop.Id, out var propRooms);
                if (propRooms == null || propRooms.Count == 0)
                {
                    continue;
                }

                List<Room> eligibleRooms;
                if (guests.HasValue && guests.Value > 0 && (roomTypesAvailable || propRoomTypes.Count > 0))
                {
                    var eligibleRtIds = propRoomTypes
                        .Where(rt => rt.MaxOccupancy >= guests.Value)
                        .Select(rt => rt.Id)
                        .ToHashSet();
                    eligibleRooms = propRooms.Where(r => eligibleRtIds.Contains(r.RoomTypeId)).ToList();
                }
                else
                {
                    eligibleRooms = propRooms;
                }

                if (eligibleRooms.Count == 0)
                {
                    continue;
                }

                if (reservationsAvailable && reservationsByRoom != null && checkOutDate!.Value > checkInDate!.Value)
                {
                    var (reqStartUtc, reqEndUtc) = ReservationTimeHelper.GetOvernightUtcInterval(
                        checkInDate.Value,
                        checkOutDate.Value,
                        prop.CheckInTime,
                        prop.CheckOutTime);
                    var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, prop.BufferMinutes);

                    var hasAvailableRoom = eligibleRooms.Any(room =>
                    {
                        var roomReservations = reservationsByRoom[room.Id];
                        foreach (var existing in roomReservations)
                        {
                            if (!ReservationTimeHelper.IsBlockingReservation(existing, nowUtc))
                            {
                                continue;
                            }

                            var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(existing, prop);
                            if (ReservationTimeHelper.HasOverlap(reqStartUtc, reqEndUtc, extStart, extEnd, bufferMinutes))
                            {
                                return false;
                            }
                        }
                        return true;
                    });

                    if (!hasAvailableRoom)
                    {
                        continue;
                    }
                }
            }

            filtered.Add(prop);
        }

        return filtered;
    }

    internal static IReadOnlyList<PublicPropertyDto> ApplySort(
        IReadOnlyList<PublicPropertyDto> items,
        string sortBy)
    {
        var normalized = sortBy.Trim().ToLowerInvariant();
        return normalized switch
        {
            "price_asc" => items
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenBy(d => d.StartingPrice.HasValue && d.StartingPrice.Value > 0m ? 0 : 1)
                .ThenBy(d => d.StartingPrice ?? decimal.MaxValue)
                .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(d => d.Id)
                .ToList(),
            "price_desc" => items
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenBy(d => d.StartingPrice.HasValue && d.StartingPrice.Value > 0m ? 0 : 1)
                .ThenByDescending(d => d.StartingPrice ?? 0m)
                .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(d => d.Id)
                .ToList(),
            "rating_desc" => items
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenByDescending(d => d.RatingAverage)
                .ThenByDescending(d => d.ReviewCount)
                .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(d => d.Id)
                .ToList(),
            "distance_asc" => items
                .OrderBy(d => d.IsExpandedNearbySuggestion ? 1 : 0)
                .ThenBy(d => d.DistanceMeters ?? double.MaxValue)
                .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(d => d.Id)
                .ToList(),
            _ => items
        };
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
        bool isExpandedNearbySuggestion = false,
        IReadOnlyList<RoomType>? roomTypes = null)
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
        var ratingAverage = hasReviews ? reviewStat.Average : 0.0;

        var (provinceCode, provinceName, wardName) = ResolveLocationMetadata(p, locationService);
        var (thumbnailUrl, galleryUrls) = ResolveVisualGallery(p, roomTypes);

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
            TaxRatePercent = p.TaxRatePercent,
            ServiceFeeRatePercent = p.ServiceFeeRatePercent,
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

    internal static (string ThumbnailUrl, List<string> GalleryUrls) ResolveVisualGallery(
        Property property,
        IReadOnlyList<RoomType>? roomTypes = null)
    {
        var sourceRoomTypes = roomTypes != null && roomTypes.Count > 0
            ? roomTypes
            : (property.RoomTypes != null ? property.RoomTypes.ToList() : new List<RoomType>());

        var gallery = sourceRoomTypes
            .Select(rt => rt.ImageUrl?.Trim())
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Select(url => url!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var thumbnailUrl = gallery.Count > 0 ? gallery[0] : string.Empty;
        return (thumbnailUrl, gallery);
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
