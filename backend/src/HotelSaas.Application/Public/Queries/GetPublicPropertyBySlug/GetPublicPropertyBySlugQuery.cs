using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;

public sealed record GetPublicPropertyBySlugQuery(string Slug) : IRequest<PublicPropertyDto>;

public sealed class GetPublicPropertyBySlugQueryHandler : IRequestHandler<GetPublicPropertyBySlugQuery, PublicPropertyDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ILocationLookupService? _locationService;

    public GetPublicPropertyBySlugQueryHandler(
        IApplicationDbContext context,
        ILocationLookupService? locationService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _locationService = locationService;
    }

    public async Task<PublicPropertyDto> Handle(GetPublicPropertyBySlugQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            throw new BadRequestException("ERR_INVALID_SLUG", "Mã đường dẫn cơ sở không hợp lệ.");
        }

        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

        var matchingProperties = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active && (p.Slug.ToLower() == normalizedSlug || p.Id.ToString() == normalizedSlug))
            .Take(1)
            .ToListAsync(cancellationToken);

        var property = matchingProperties.FirstOrDefault();

        if (property == null)
        {
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
        }

        var propertyIds = new[] { property.Id };
        var tenant = await PublicPropertyMappingHelper.LoadActiveTenantByIdAsync(_context, property.TenantId, cancellationToken);
        var rates = await PublicPropertyMappingHelper.LoadActiveRatesAsync(_context, propertyIds, cancellationToken);
        var reviewStats = await PublicPropertyMappingHelper.LoadPublishedReviewStatsAsync(_context, propertyIds, cancellationToken);
        var (roomTypes, _) = await PublicPropertyMappingHelper.LoadRoomTypesAsync(_context, propertyIds, cancellationToken);
        reviewStats.TryGetValue(property.Id, out var reviewStat);

        return PublicPropertyMappingHelper.BuildDto(
            property,
            tenant,
            rates,
            reviewStat,
            rentalType: null,
            _locationService,
            roomTypes: roomTypes);
    }
}
