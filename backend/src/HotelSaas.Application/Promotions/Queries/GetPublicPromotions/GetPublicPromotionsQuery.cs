using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Promotions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Promotions.Queries.GetPublicPromotions;

/// <summary>
/// Retrieves active, non-expired public promotional deals across active tenants with published properties.
/// </summary>
public sealed record GetPublicPromotionsQuery(
    string? TenantSlug = null
) : IRequest<IReadOnlyList<PublicPromotionDealDto>>;

public sealed class GetPublicPromotionsQueryHandler : IRequestHandler<GetPublicPromotionsQuery, IReadOnlyList<PublicPromotionDealDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPublicPromotionsQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<IReadOnlyList<PublicPromotionDealDto>> Handle(GetPublicPromotionsQuery request, CancellationToken cancellationToken)
    {
        var utcNow = DateTime.UtcNow;

        List<Promotion> activePromotions;
        try
        {
            activePromotions = await _context.Promotions
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.IsActive &&
                            p.StartsAtUtc <= utcNow &&
                            p.EndsAtUtc >= utcNow &&
                            (p.MaxUsage == null || p.CurrentUsage < p.MaxUsage))
                .OrderBy(p => p.EndsAtUtc)
                .ThenBy(p => p.Code)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            return Array.Empty<PublicPromotionDealDto>();
        }

        if (activePromotions.Count == 0)
        {
            return Array.Empty<PublicPromotionDealDto>();
        }

        var promoTenantIds = activePromotions.Select(p => p.TenantId).Distinct().ToList();

        Dictionary<Guid, Tenant> activeTenantsById = new();
        bool tenantsAvailable = false;
        try
        {
            var tenantsQuery = _context.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(t => promoTenantIds.Contains(t.Id) && t.Status == TenantStatus.Active);

            if (!string.IsNullOrWhiteSpace(request.TenantSlug))
            {
                var slugNorm = request.TenantSlug.Trim().ToLowerInvariant();
                tenantsQuery = tenantsQuery.Where(t => t.Slug.ToLower() == slugNorm);
            }

            var tenants = await tenantsQuery.ToListAsync(cancellationToken);
            activeTenantsById = tenants.ToDictionary(t => t.Id);
            tenantsAvailable = true;
        }
        catch (NotImplementedException)
        {
            tenantsAvailable = false;
        }

        ILookup<Guid, Property>? publishedPropsByTenant = null;
        bool propertiesAvailable = false;
        try
        {
            var props = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => promoTenantIds.Contains(p.TenantId) &&
                            p.Status == PropertyStatus.Active &&
                            p.IsPublished)
                .OrderBy(p => p.Name)
                .ToListAsync(cancellationToken);

            publishedPropsByTenant = props.ToLookup(p => p.TenantId);
            propertiesAvailable = true;
        }
        catch (NotImplementedException)
        {
            propertiesAvailable = false;
        }

        var result = new List<PublicPromotionDealDto>();
        foreach (var promo in activePromotions)
        {
            if (tenantsAvailable && !activeTenantsById.ContainsKey(promo.TenantId))
            {
                continue;
            }

            if (propertiesAvailable && (publishedPropsByTenant == null || !publishedPropsByTenant[promo.TenantId].Any()))
            {
                continue;
            }

            var tenantName = activeTenantsById.TryGetValue(promo.TenantId, out var tenant)
                ? tenant.Name
                : string.Empty;

            var tenantProps = publishedPropsByTenant?[promo.TenantId].ToList() ?? new List<Property>();
            var firstSlug = tenantProps.FirstOrDefault()?.Slug;
            var destinations = tenantProps
                .Select(p => p.City?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            result.Add(PromotionMapper.ToPublicDealDto(promo, tenantName, firstSlug, destinations));
        }

        return result;
    }
}
