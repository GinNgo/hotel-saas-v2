using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Reviews.DTOs;

/// <summary>
/// Aggregated review statistics and review list for an accommodation property.
/// </summary>
public sealed class PropertyReviewsSummaryDto
{
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertySlug { get; set; } = string.Empty;
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public double CleanlinessAverage { get; set; }
    public double LocationAverage { get; set; }
    public double ServiceAverage { get; set; }
    public double ValueAverage { get; set; }

    /// <summary>
    /// Rating distribution count per star: keys 1 to 5.
    /// </summary>
    public Dictionary<int, int> RatingDistribution { get; set; } = new()
    {
        { 5, 0 },
        { 4, 0 },
        { 3, 0 },
        { 2, 0 },
        { 1, 0 }
    };

    public List<GuestReviewDto> Reviews { get; set; } = new();
}
