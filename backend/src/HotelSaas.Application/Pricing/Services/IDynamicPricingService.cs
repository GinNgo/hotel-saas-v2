using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Pricing.Services;

public sealed record DynamicPricingAdjustmentDto(
    decimal AdjustmentAmount,
    decimal Multiplier,
    double OccupancyPercent,
    string Category,
    string Description
);

public sealed record RoomTypePricingRecommendationDto(
    Guid RoomTypeId,
    string RoomTypeName,
    int TotalRooms,
    int BookedRooms,
    double OccupancyRate,
    decimal BasePrice,
    decimal RecommendedPrice,
    decimal SurgeMultiplier,
    string Strategy,
    string Rationale
);

public sealed record DynamicPricingSummaryDto(
    Guid PropertyId,
    string PropertyName,
    DateOnly TargetDate,
    double OverallOccupancyRate,
    string MarketDemandLevel,
    IReadOnlyList<RoomTypePricingRecommendationDto> Recommendations
);

public interface IDynamicPricingService
{
    Task<DynamicPricingAdjustmentDto?> CalculateDynamicAdjustmentAsync(
        Guid propertyId,
        Guid roomTypeId,
        RentalType rentalType,
        DateOnly startDate,
        DateOnly endDate,
        decimal basePrice,
        CancellationToken cancellationToken = default);

    Task<DynamicPricingSummaryDto> GetPricingRecommendationsAsync(
        Guid propertyId,
        DateOnly targetDate,
        CancellationToken cancellationToken = default);
}
