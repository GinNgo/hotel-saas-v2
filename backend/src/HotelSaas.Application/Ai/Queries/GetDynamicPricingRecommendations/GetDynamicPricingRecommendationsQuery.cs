using System;
using HotelSaas.Application.Pricing.Services;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.GetDynamicPricingRecommendations;

public sealed record GetDynamicPricingRecommendationsQuery(
    Guid? PropertyId = null,
    DateOnly? Date = null
) : IRequest<DynamicPricingSummaryDto?>;
