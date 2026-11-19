using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Reviews.DTOs;

/// <summary>
/// PMS back-office view of a verified guest review including stay, branch, and moderation metadata.
/// </summary>
public sealed class PmsGuestReviewItemDto
{
    public Guid Id { get; set; }
    public Guid ReservationId { get; set; }
    public string ConfirmationCode { get; set; } = string.Empty;
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string? PropertyCode { get; set; }
    public string GuestName { get; set; } = string.Empty;
    public string? GuestPhone { get; set; }
    public string? RoomNumber { get; set; }
    public string? RoomTypeName { get; set; }
    public string RentalType { get; set; } = "Daily";
    public DateOnly? CheckInDate { get; set; }
    public DateOnly? CheckOutDate { get; set; }
    public int Rating { get; set; }
    public int? CleanlinessRating { get; set; }
    public int? LocationRating { get; set; }
    public int? ServiceRating { get; set; }
    public int? ValueRating { get; set; }
    public string? Comment { get; set; }
    public string? OwnerReply { get; set; }
    public DateTime? RepliedAtUtc { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Aggregated KPI metrics and 1-5 star histogram for PMS review management.
/// Computed over the resolved tenant and branch scope before list filters.
/// </summary>
public sealed class PmsReviewsSummaryDto
{
    public double AverageRating { get; set; }
    public int TotalCount { get; set; }
    public int PublishedCount { get; set; }
    public int HiddenCount { get; set; }
    public int UnansweredCount { get; set; }
    public int RepliedCount { get; set; }
    public double CleanlinessAverage { get; set; }
    public double LocationAverage { get; set; }
    public double ServiceAverage { get; set; }
    public double ValueAverage { get; set; }
    public Dictionary<int, int> RatingDistribution { get; set; } = new()
    {
        { 5, 0 },
        { 4, 0 },
        { 3, 0 },
        { 2, 0 },
        { 1, 0 }
    };
}

/// <summary>
/// Paginated PMS guest review query result paired with scope-level summary KPIs.
/// </summary>
public sealed class PmsReviewsPagedResultDto
{
    public IReadOnlyList<PmsGuestReviewItemDto> Items { get; set; } = Array.Empty<PmsGuestReviewItemDto>();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
    public PmsReviewsSummaryDto Summary { get; set; } = new();
}
