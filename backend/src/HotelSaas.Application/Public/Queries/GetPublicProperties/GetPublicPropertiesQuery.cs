using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicProperties;

/// <summary>
/// Query to retrieve active properties available for public discovery.
/// Preserves existing route and response contract (IReadOnlyList of PublicPropertyDto).
/// Supports typo-tolerant, diacritics-insensitive, canonical Vietnamese matching across Name, Address, and City.
/// </summary>
public sealed record GetPublicPropertiesQuery(string? Search = null) : IRequest<IReadOnlyList<PublicPropertyDto>>;

public sealed class GetPublicPropertiesQueryHandler : IRequestHandler<GetPublicPropertiesQuery, IReadOnlyList<PublicPropertyDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPublicPropertiesQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<IReadOnlyList<PublicPropertyDto>> Handle(GetPublicPropertiesQuery request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Active-only guard preserved per approved contract
        var query = _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active);

        // Project lightweight DTO with deterministic ordering
        var properties = await query
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .Select(p => new PublicPropertyDto
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
                ImageUrl = null
            })
            .ToListAsync(cancellationToken);

        return FilterAndRank(properties, request.Search);
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
