using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicBrands;

/// <summary>
/// Public profile summary of an active partner brand with >= 1 active property.
/// </summary>
public sealed class PublicBrandDto
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string Description { get; set; } = string.Empty;
    public int TotalProperties { get; set; }
    public double RatingAverage { get; set; }
    public int ReviewCount { get; set; }
    public decimal? StartingPrice { get; set; }
    public List<string> Provinces { get; set; } = new();
    public List<PropertyType> PropertyTypes { get; set; } = new();
    public List<PublicPropertyDto> Properties { get; set; } = new();
}

/// <summary>
/// Retrieves active tenant brands that operate at least one active property,
/// aggregating branch counts, covered provinces, property types, honest review scores, and lowest starting prices.
/// </summary>
public sealed record GetPublicBrandsQuery(bool OnlyPublished = false) : IRequest<IReadOnlyList<PublicBrandDto>>;

public sealed class GetPublicBrandsQueryHandler : IRequestHandler<GetPublicBrandsQuery, IReadOnlyList<PublicBrandDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ILocationLookupService? _locationService;

    public GetPublicBrandsQueryHandler(
        IApplicationDbContext context,
        ILocationLookupService? locationService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _locationService = locationService;
    }

    public async Task<IReadOnlyList<PublicBrandDto>> Handle(GetPublicBrandsQuery request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (activeTenants, _, tenantsAvailable) = await PublicPropertyMappingHelper.LoadTenantsMetadataAsync(
            _context,
            cancellationToken);

        if (!tenantsAvailable || activeTenants.Count == 0)
        {
            return Array.Empty<PublicBrandDto>();
        }

        var activeTenantIds = activeTenants.Keys.ToList();
        var properties = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active &&
                        activeTenantIds.Contains(p.TenantId) &&
                        (!request.OnlyPublished || p.IsPublished))
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        if (properties.Count == 0)
        {
            return Array.Empty<PublicBrandDto>();
        }

        var propertyIds = properties.Select(p => p.Id).ToList();
        var rates = await PublicPropertyMappingHelper.LoadActiveRatesAsync(_context, propertyIds, cancellationToken);
        var reviewStats = await PublicPropertyMappingHelper.LoadPublishedReviewStatsAsync(_context, propertyIds, cancellationToken);
        var (roomTypes, _) = await PublicPropertyMappingHelper.LoadRoomTypesAsync(_context, propertyIds, cancellationToken);

        var ratesByProperty = rates.GroupBy(r => r.PropertyId).ToDictionary(g => g.Key, g => g.ToList());
        var roomTypesByProperty = roomTypes.GroupBy(rt => rt.PropertyId).ToDictionary(g => g.Key, g => g.ToList());

        var propertyDtosByTenant = new Dictionary<Guid, List<PublicPropertyDto>>();
        foreach (var p in properties)
        {
            activeTenants.TryGetValue(p.TenantId, out var tenant);
            ratesByProperty.TryGetValue(p.Id, out var propRates);
            reviewStats.TryGetValue(p.Id, out var reviewStat);
            roomTypesByProperty.TryGetValue(p.Id, out var propRoomTypes);

            var dto = PublicPropertyMappingHelper.BuildDto(
                p,
                tenant,
                propRates,
                reviewStat,
                rentalType: null,
                _locationService,
                roomTypes: propRoomTypes);

            if (!propertyDtosByTenant.TryGetValue(p.TenantId, out var list))
            {
                list = new List<PublicPropertyDto>();
                propertyDtosByTenant[p.TenantId] = list;
            }
            list.Add(dto);
        }

        var brands = new List<PublicBrandDto>();
        foreach (var kvp in propertyDtosByTenant)
        {
            if (!activeTenants.TryGetValue(kvp.Key, out var tenant))
            {
                continue;
            }

            var brandProps = kvp.Value;
            if (brandProps.Count == 0)
            {
                continue;
            }

            var totalReviews = brandProps.Sum(bp => bp.ReviewCount);
            var weightedSum = brandProps.Sum(bp => bp.RatingAverage * bp.ReviewCount);
            var avgRating = totalReviews > 0 ? Math.Round(weightedSum / totalReviews, 1) : 0.0;

            var provinces = brandProps
                .Select(bp => bp.ProvinceName ?? bp.City)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var propertyTypes = brandProps
                .Select(bp => bp.PropertyType)
                .Distinct()
                .ToList();

            var candidatePrices = brandProps
                .Select(bp => bp.StartingPrice ?? bp.DailyStartingPrice ?? bp.OvernightStartingPrice ?? bp.HourlyStartingPrice)
                .Where(price => price.HasValue && price.Value > 0m)
                .Select(price => price!.Value)
                .ToList();

            decimal? lowestPrice = candidatePrices.Count > 0 ? candidatePrices.Min() : null;

            var firstRealImage = brandProps
                .Select(bp => bp.ThumbnailUrl)
                .FirstOrDefault(url => !string.IsNullOrWhiteSpace(url));

            var logoUrl = !string.IsNullOrWhiteSpace(tenant.LogoUrl)
                ? tenant.LogoUrl!.Trim()
                : (!string.IsNullOrWhiteSpace(firstRealImage) ? firstRealImage : null);

            var cleanName = GetPublicPropertiesQueryHandler.SanitizeVietnameseText(tenant.Name) ?? tenant.Name;
            var provinceSummary = provinces.Count > 0
                ? $" tại {string.Join(", ", provinces.Take(3))}{(provinces.Count > 3 ? " và nhiều địa phương khác" : string.Empty)}"
                : string.Empty;

            var description = !string.IsNullOrWhiteSpace(tenant.Description)
                ? tenant.Description!.Trim()
                : $"Hệ thống lưu trú gồm {brandProps.Count} cơ sở{provinceSummary}, hỗ trợ đặt phòng linh hoạt trực tuyến.";

            brands.Add(new PublicBrandDto
            {
                TenantId = tenant.Id,
                Name = cleanName,
                Slug = tenant.Slug,
                LogoUrl = logoUrl,
                Description = description,
                TotalProperties = brandProps.Count,
                RatingAverage = avgRating,
                ReviewCount = totalReviews,
                StartingPrice = lowestPrice,
                Provinces = provinces,
                PropertyTypes = propertyTypes,
                Properties = brandProps
            });
        }

        return brands
            .OrderByDescending(b => b.TotalProperties)
            .ThenBy(b => b.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
