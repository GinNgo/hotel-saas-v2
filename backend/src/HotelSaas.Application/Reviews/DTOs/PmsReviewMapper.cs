using System;
using System.Collections.Generic;
using System.Linq;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.Reviews.DTOs;

internal static class PmsReviewMapper
{
    public static Guid RequireTenantId(ICurrentTenantService tenantService)
    {
        var tenantId = tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("ERR_TENANT_REQUIRED: Yêu cầu ngữ cảnh doanh nghiệp (Tenant) hợp lệ.");
        }

        return tenantId.Value;
    }

    public static void EnsureMutationBranchAccess(
        GuestReview review,
        Guid tenantId,
        ICurrentPropertyService propertyService)
    {
        if (review.TenantId != tenantId)
        {
            throw new ForbiddenException(
                "ERR_CROSS_TENANT_ACCESS",
                "Bạn không có quyền thao tác đánh giá của doanh nghiệp khác.");
        }

        var reviewPropertyId = review.Reservation?.PropertyId;

        if (!propertyService.IsTenantWide)
        {
            var boundPropertyId = propertyService.PropertyId ?? propertyService.TokenPropertyId;
            if (!boundPropertyId.HasValue ||
                boundPropertyId.Value == Guid.Empty ||
                !reviewPropertyId.HasValue ||
                reviewPropertyId.Value != boundPropertyId.Value)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_FORBIDDEN",
                    "Bạn không có quyền thao tác đánh giá của chi nhánh khác.");
            }

            return;
        }

        if (reviewPropertyId.HasValue &&
            propertyService.ExcludedPropertyIds != null &&
            propertyService.ExcludedPropertyIds.Contains(reviewPropertyId.Value))
        {
            throw new ForbiddenException(
                "ERR_MEMBERSHIP_REVOKED",
                "Quyền nhân sự tại chi nhánh này đã bị thu hồi.");
        }

        if (propertyService.HeaderPropertyId.HasValue &&
            (!reviewPropertyId.HasValue || reviewPropertyId.Value != propertyService.HeaderPropertyId.Value))
        {
            throw new ForbiddenException(
                "ERR_PROPERTY_FORBIDDEN",
                "Chi nhánh làm việc hiện tại (X-Property-Id) không khớp với đánh giá này.");
        }
    }

    public static PmsGuestReviewItemDto ToPmsItemDto(GuestReview review)
    {
        var reservation = review.Reservation;
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation?.Notes);

        var guestName = !string.IsNullOrWhiteSpace(reservation?.GuestName)
            ? reservation!.GuestName
            : (!string.IsNullOrWhiteSpace(review.User?.FullName) ? review.User!.FullName : "Khách lưu trú");

        var roomTypeName = !string.IsNullOrWhiteSpace(snapshot?.RoomTypeName)
            ? snapshot!.RoomTypeName
            : (reservation?.Room?.RoomType?.Name ?? "Tiêu chuẩn");

        var rentalType = snapshot?.RentalType.ToString() ?? "Daily";

        return new PmsGuestReviewItemDto
        {
            Id = review.Id,
            ReservationId = review.ReservationId,
            ConfirmationCode = reservation?.ConfirmationCode ?? string.Empty,
            PropertyId = reservation?.PropertyId ?? Guid.Empty,
            PropertyName = reservation?.Property?.Name ?? string.Empty,
            PropertyCode = reservation?.Property?.Code,
            GuestName = guestName,
            GuestPhone = reservation?.GuestPhone,
            RoomNumber = reservation?.Room?.RoomNumber,
            RoomTypeName = roomTypeName,
            RentalType = rentalType,
            CheckInDate = reservation?.CheckInDate,
            CheckOutDate = reservation?.CheckOutDate,
            Rating = review.OverallRating,
            CleanlinessRating = review.CleanlinessRating,
            LocationRating = review.LocationRating,
            ServiceRating = review.ServiceRating,
            ValueRating = review.ValueRating,
            Comment = review.Comment,
            OwnerReply = review.OwnerReply,
            RepliedAtUtc = review.RepliedAtUtc.HasValue ? SpecifyUtc(review.RepliedAtUtc.Value) : null,
            IsPublished = review.IsPublished,
            CreatedAtUtc = SpecifyUtc(review.CreatedAtUtc),
            UpdatedAtUtc = SpecifyUtc(review.UpdatedAtUtc)
        };
    }

    public static PmsReviewsSummaryDto BuildSummary(IReadOnlyList<GuestReview> reviews)
    {
        var total = reviews.Count;
        var avg = total > 0 ? Math.Round(reviews.Average(r => r.OverallRating), 1) : 0d;

        static double ComputeSubAvg(IReadOnlyList<GuestReview> source, Func<GuestReview, int?> selector, double fallback)
        {
            var values = source.Select(selector).Where(v => v.HasValue).Select(v => v!.Value).ToList();
            return values.Count > 0 ? Math.Round(values.Average(), 1) : fallback;
        }

        var publishedCount = reviews.Count(r => r.IsPublished);
        var repliedCount = reviews.Count(r => !string.IsNullOrWhiteSpace(r.OwnerReply));

        return new PmsReviewsSummaryDto
        {
            AverageRating = avg,
            TotalCount = total,
            PublishedCount = publishedCount,
            HiddenCount = total - publishedCount,
            RepliedCount = repliedCount,
            UnansweredCount = total - repliedCount,
            CleanlinessAverage = ComputeSubAvg(reviews, r => r.CleanlinessRating, avg),
            LocationAverage = ComputeSubAvg(reviews, r => r.LocationRating, avg),
            ServiceAverage = ComputeSubAvg(reviews, r => r.ServiceRating, avg),
            ValueAverage = ComputeSubAvg(reviews, r => r.ValueRating, avg),
            RatingDistribution = new Dictionary<int, int>
            {
                { 5, reviews.Count(r => r.OverallRating == 5) },
                { 4, reviews.Count(r => r.OverallRating == 4) },
                { 3, reviews.Count(r => r.OverallRating == 3) },
                { 2, reviews.Count(r => r.OverallRating == 2) },
                { 1, reviews.Count(r => r.OverallRating == 1) }
            }
        };
    }

    private static DateTime SpecifyUtc(DateTime value)
        => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
