using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Common;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Ai.Queries.GetDynamicPricingRecommendations;

public sealed class GetDynamicPricingRecommendationsQueryHandler : IRequestHandler<GetDynamicPricingRecommendationsQuery, DynamicPricingSummaryDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly IDynamicPricingService? _dynamicPricingService;

    public GetDynamicPricingRecommendationsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        IDynamicPricingService? dynamicPricingService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _dynamicPricingService = dynamicPricingService;
    }

    public async Task<DynamicPricingSummaryDto?> Handle(GetDynamicPricingRecommendationsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("ERR_TENANT_REQUIRED: Yêu cầu xác thực ngữ cảnh doanh nghiệp hợp lệ.");
        }

        Property? targetProperty;
        if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            targetProperty = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.PropertyId.Value, cancellationToken);

            if (targetProperty == null)
            {
                throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
            }

            if (targetProperty.TenantId != tenantId.Value)
            {
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Không có quyền truy cập cơ sở lưu trú của doanh nghiệp khác.");
            }
        }
        else if (!_currentUser.IsTenantWide && _currentUser.PropertyId.HasValue && _currentUser.PropertyId.Value != Guid.Empty)
        {
            targetProperty = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == _currentUser.PropertyId.Value, cancellationToken);

            if (targetProperty == null)
            {
                throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
            }

            if (targetProperty.TenantId != tenantId.Value)
            {
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Không có quyền truy cập cơ sở lưu trú của doanh nghiệp khác.");
            }
        }
        else
        {
            targetProperty = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId.Value && p.Status == PropertyStatus.Active)
                .OrderBy(p => p.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (targetProperty == null)
            {
                throw new NotFoundException("Không tìm thấy cơ sở lưu trú đang hoạt động.");
            }
        }

        if (!_currentUser.IsTenantWide && _currentUser.PropertyId != targetProperty.Id)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Nhân viên chi nhánh không được phép truy cập cơ sở lưu trú khác.");
        }

        if (_dynamicPricingService == null)
        {
            return null;
        }

        var tz = AiHelper.ResolveVietnamTimeZone();
        var targetDate = request.Date ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        var result = await _dynamicPricingService.GetPricingRecommendationsAsync(targetProperty.Id, targetDate, cancellationToken);

        await AiHelper.TryRecordAiUsageAsync(
            _context,
            _currentUser,
            tenantId.Value,
            "DynamicPricing",
            $"Property={targetProperty.Id}, Date={targetDate:yyyy-MM-dd}",
            $"RecommendationsCount={result.Recommendations.Count}, MarketDemand={result.MarketDemandLevel}",
            "ai-dynamic-pricing-engine",
            cancellationToken);

        return result;
    }
}
