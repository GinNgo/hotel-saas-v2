using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reviews.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Queries.GetPropertyReviews;

/// <summary>
/// Query to retrieve verified reviews and aggregate ratings for an accommodation property.
/// </summary>
public sealed record GetPropertyReviewsQuery(
    string PropertySlugOrId,
    int Page = 1,
    int PageSize = 10
) : IRequest<PropertyReviewsSummaryDto>;

public sealed class GetPropertyReviewsQueryHandler : IRequestHandler<GetPropertyReviewsQuery, PropertyReviewsSummaryDto>
{
    private readonly IApplicationDbContext _context;

    public GetPropertyReviewsQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<PropertyReviewsSummaryDto> Handle(GetPropertyReviewsQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PropertySlugOrId))
        {
            throw new BadRequestException("ERR_INVALID_PROPERTY", "Mã hoặc đường dẫn cơ sở không hợp lệ.");
        }

        var normalizedKey = request.PropertySlugOrId.Trim().ToLowerInvariant();

        // 1. Authoritative property lookup (Ignore tenant filter for public review browsing)
        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Slug.ToLower() == normalizedKey || p.Id.ToString() == normalizedKey, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
        }

        // 2. Fetch published reviews for this property
        var reviewsQuery = _context.GuestReviews
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Reservation)
                .ThenInclude(res => res!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.User)
            .Where(r => r.Reservation != null && r.Reservation.PropertyId == property.Id && r.IsPublished);

        var allReviews = await reviewsQuery.ToListAsync(cancellationToken);

        int totalReviews = allReviews.Count;

        // 3. Aggregate statistics
        double avgRating = totalReviews > 0
            ? Math.Round(allReviews.Average(r => r.OverallRating), 1)
            : 0;

        var cleanlinessList = allReviews.Where(r => r.CleanlinessRating.HasValue).Select(r => r.CleanlinessRating!.Value).ToList();
        double avgCleanliness = cleanlinessList.Count > 0 ? Math.Round(cleanlinessList.Average(), 1) : avgRating;

        var locationList = allReviews.Where(r => r.LocationRating.HasValue).Select(r => r.LocationRating!.Value).ToList();
        double avgLocation = locationList.Count > 0 ? Math.Round(locationList.Average(), 1) : avgRating;

        var serviceList = allReviews.Where(r => r.ServiceRating.HasValue).Select(r => r.ServiceRating!.Value).ToList();
        double avgService = serviceList.Count > 0 ? Math.Round(serviceList.Average(), 1) : avgRating;

        var valueList = allReviews.Where(r => r.ValueRating.HasValue).Select(r => r.ValueRating!.Value).ToList();
        double avgValue = valueList.Count > 0 ? Math.Round(valueList.Average(), 1) : avgRating;

        var distribution = new Dictionary<int, int>
        {
            { 5, allReviews.Count(r => r.OverallRating == 5) },
            { 4, allReviews.Count(r => r.OverallRating == 4) },
            { 3, allReviews.Count(r => r.OverallRating == 3) },
            { 2, allReviews.Count(r => r.OverallRating == 2) },
            { 1, allReviews.Count(r => r.OverallRating == 1) }
        };

        // 4. Pagination
        int page = Math.Max(1, request.Page);
        int pageSize = Math.Clamp(request.PageSize, 1, 50);

        var pagedReviews = allReviews
            .OrderByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r =>
            {
                var guestName = r.Reservation?.GuestName;
                if (string.IsNullOrWhiteSpace(guestName))
                {
                    guestName = r.User?.FullName ?? "Khách lưu trú";
                }

                return new GuestReviewDto
                {
                    Id = r.Id,
                    PropertyId = property.Id,
                    PropertyName = property.Name,
                    GuestName = PiiMaskingHelper.MaskName(guestName),
                    Rating = r.OverallRating,
                    CleanlinessRating = r.CleanlinessRating,
                    LocationRating = r.LocationRating,
                    ServiceRating = r.ServiceRating,
                    ValueRating = r.ValueRating,
                    Comment = r.Comment,
                    OwnerReply = r.OwnerReply,
                    RepliedAt = r.RepliedAtUtc,
                    CreatedAt = r.CreatedAtUtc,
                    RentalType = "Daily",
                    RoomTypeName = r.Reservation?.Room?.RoomType?.Name ?? "Tiêu chuẩn"
                };
            })
            .ToList();

        return new PropertyReviewsSummaryDto
        {
            PropertyId = property.Id,
            PropertyName = property.Name,
            PropertySlug = property.Slug,
            AverageRating = avgRating,
            TotalReviews = totalReviews,
            CleanlinessAverage = avgCleanliness,
            LocationAverage = avgLocation,
            ServiceAverage = avgService,
            ValueAverage = avgValue,
            RatingDistribution = distribution,
            Reviews = pagedReviews
        };
    }
}
