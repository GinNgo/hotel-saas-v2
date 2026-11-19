using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reviews.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Queries.GetPmsPropertyReviews;

/// <summary>
/// PMS back-office query to retrieve guest reviews scoped to the current tenant and authorized branch(es),
/// with summary KPIs, 1-5 star distribution, filters, and pagination.
/// </summary>
public sealed record GetPmsPropertyReviewsQuery(
    Guid? PropertyId = null,
    int? Rating = null,
    bool? HasReply = null,
    bool? IsPublished = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<PmsReviewsPagedResultDto>;

public sealed class GetPmsPropertyReviewsQueryHandler
    : IRequestHandler<GetPmsPropertyReviewsQuery, PmsReviewsPagedResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;

    public GetPmsPropertyReviewsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
    }

    public async Task<PmsReviewsPagedResultDto> Handle(
        GetPmsPropertyReviewsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = PmsReviewMapper.RequireTenantId(_tenantService);
        var excludedPropertyIds = _propertyService.ExcludedPropertyIds ?? Array.Empty<Guid>();

        var requestedPropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
            ? request.PropertyId.Value
            : (Guid?)null;

        Guid? effectivePropertyId;
        if (!_propertyService.IsTenantWide)
        {
            var boundPropertyId = _propertyService.PropertyId ?? _propertyService.TokenPropertyId;
            if (!boundPropertyId.HasValue || boundPropertyId.Value == Guid.Empty)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_REQUIRED",
                    "Nhân sự cấp chi nhánh bắt buộc phải có ngữ cảnh chi nhánh hợp lệ.");
            }

            if (requestedPropertyId.HasValue && requestedPropertyId.Value != boundPropertyId.Value)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_FORBIDDEN",
                    "Bạn không có quyền xem đánh giá của chi nhánh khác.");
            }

            effectivePropertyId = boundPropertyId.Value;
        }
        else
        {
            if (_propertyService.HeaderPropertyId.HasValue &&
                requestedPropertyId.HasValue &&
                _propertyService.HeaderPropertyId.Value != requestedPropertyId.Value)
            {
                throw new BadRequestException(
                    "ERR_CONTEXT_MISMATCH",
                    "Chi nhánh trong header X-Property-Id không khớp với chi nhánh được yêu cầu.");
            }

            effectivePropertyId = requestedPropertyId ?? _propertyService.PropertyId ?? _propertyService.HeaderPropertyId;
        }

        if (effectivePropertyId.HasValue)
        {
            if (excludedPropertyIds.Contains(effectivePropertyId.Value))
            {
                throw new ForbiddenException(
                    "ERR_MEMBERSHIP_REVOKED",
                    "Quyền nhân sự tại chi nhánh này đã bị thu hồi.");
            }

            var targetProperty = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == effectivePropertyId.Value, cancellationToken);

            if (targetProperty == null)
            {
                throw new NotFoundException("Không tìm thấy chi nhánh lưu trú.");
            }

            if (targetProperty.TenantId != tenantId)
            {
                throw new ForbiddenException(
                    "ERR_CROSS_TENANT_ACCESS",
                    "Bạn không có quyền truy cập đánh giá của chi nhánh thuộc doanh nghiệp khác.");
            }

            if (targetProperty.Status != PropertyStatus.Active)
            {
                throw new ConflictException(
                    "ERR_PROPERTY_INACTIVE",
                    "Chi nhánh hiện đang ngừng hoạt động.");
            }
        }

        var query = _context.GuestReviews
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Reservation)
                .ThenInclude(res => res!.Property)
            .Include(r => r.Reservation)
                .ThenInclude(res => res!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.User)
            .Where(r => r.TenantId == tenantId &&
                        r.Reservation != null &&
                        r.Reservation.Property != null &&
                        r.Reservation.Property.TenantId == tenantId &&
                        r.Reservation.Property.Status == PropertyStatus.Active);

        if (effectivePropertyId.HasValue)
        {
            var propId = effectivePropertyId.Value;
            query = query.Where(r => r.Reservation!.PropertyId == propId);
        }
        else if (excludedPropertyIds.Count > 0)
        {
            query = query.Where(r => !excludedPropertyIds.Contains(r.Reservation!.PropertyId));
        }

        var scopedReviews = await query
            .OrderByDescending(r => r.CreatedAtUtc)
            .ThenByDescending(r => r.Id)
            .ToListAsync(cancellationToken);

        var summary = PmsReviewMapper.BuildSummary(scopedReviews);

        IEnumerable<GuestReview> filtered = scopedReviews;

        if (request.Rating.HasValue)
        {
            var rating = request.Rating.Value;
            filtered = filtered.Where(r => r.OverallRating == rating);
        }

        if (request.HasReply.HasValue)
        {
            filtered = request.HasReply.Value
                ? filtered.Where(r => !string.IsNullOrWhiteSpace(r.OwnerReply))
                : filtered.Where(r => string.IsNullOrWhiteSpace(r.OwnerReply));
        }

        if (request.IsPublished.HasValue)
        {
            var published = request.IsPublished.Value;
            filtered = filtered.Where(r => r.IsPublished == published);
        }

        var mappedFiltered = filtered
            .Select(PmsReviewMapper.ToPmsItemDto)
            .ToList();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var keyword = request.Search.Trim();
            mappedFiltered = mappedFiltered
                .Where(item =>
                    ContainsIgnoreCase(item.GuestName, keyword) ||
                    ContainsIgnoreCase(item.ConfirmationCode, keyword) ||
                    ContainsIgnoreCase(item.Comment, keyword) ||
                    ContainsIgnoreCase(item.OwnerReply, keyword) ||
                    ContainsIgnoreCase(item.RoomNumber, keyword) ||
                    ContainsIgnoreCase(item.RoomTypeName, keyword) ||
                    ContainsIgnoreCase(item.PropertyName, keyword))
                .ToList();
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var totalCount = mappedFiltered.Count;

        var pagedItems = mappedFiltered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PmsReviewsPagedResultDto
        {
            Items = pagedItems,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Summary = summary
        };
    }

    private static bool ContainsIgnoreCase(string? source, string keyword)
        => !string.IsNullOrWhiteSpace(source) &&
           source.Contains(keyword, StringComparison.OrdinalIgnoreCase);
}
