using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Promotions.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Promotions.Queries.GetPromotions;

/// <summary>
/// Retrieves tenant-scoped promotional campaigns with optional active status and search filters.
/// </summary>
public sealed record GetPromotionsQuery(
    bool? IsActive = null,
    string? Search = null
) : IRequest<IReadOnlyList<PromotionDto>>;

public sealed class GetPromotionsQueryHandler : IRequestHandler<GetPromotionsQuery, IReadOnlyList<PromotionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public GetPromotionsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
    }

    public async Task<IReadOnlyList<PromotionDto>> Handle(GetPromotionsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        var query = _context.Promotions
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId.Value);

        if (request.IsActive.HasValue)
        {
            query = query.Where(p => p.IsActive == request.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLowerInvariant();
            query = query.Where(p =>
                p.Code.ToLower().Contains(search) ||
                p.Name.ToLower().Contains(search) ||
                (p.Description != null && p.Description.ToLower().Contains(search)));
        }

        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .ThenBy(p => p.Code)
            .ToListAsync(cancellationToken);

        return items.Select(PromotionMapper.ToDto).ToList();
    }
}
