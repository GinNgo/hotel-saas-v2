using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Ai.DTOs;

public sealed class AiSmartSearchRequest
{
    public string Query { get; set; } = string.Empty;
    public double? UserLatitude { get; set; }
    public double? UserLongitude { get; set; }
}

public sealed class AiConciergeRequest
{
    public string Message { get; set; } = string.Empty;
    public string? PropertySlug { get; set; }
}

public sealed class AiConciergeResponse
{
    public string Intent { get; set; } = string.Empty;
    public string Reply { get; set; } = string.Empty;
    public DetectedCriteriaDto DetectedCriteria { get; set; } = new();
    public List<SuggestedRoomCardDto> SuggestedRooms { get; set; } = new();
}

public sealed class DetectedCriteriaDto
{
    public string? City { get; set; }
    public int? MinGuests { get; set; }
    public List<string> Amenities { get; set; } = new();
}

public sealed class SuggestedRoomCardDto
{
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public string PropertySlug { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int StandardOccupancy { get; set; }
    public int MaxOccupancy { get; set; }
    public decimal BasePriceNight { get; set; }
    public string Description { get; set; } = string.Empty;
}

public sealed class AiUsageStatusDto
{
    public string TierName { get; set; } = string.Empty;
    public int MonthlyQuota { get; set; }
    public int UsedCount { get; set; }
    public int RemainingCount { get; set; }
    public bool IsLimitReached { get; set; }
}

public sealed class AiChatRequest
{
    public string? Message { get; set; }
    public List<AiChatHistoryMessage>? Messages { get; set; }
    public AiChatLocation? Location { get; set; }
}

public sealed class AiChatHistoryMessage
{
    public string? Role { get; set; }
    public string? Content { get; set; }
}

public sealed class AiChatLocation
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public sealed class AiChatResponse
{
    public string Text { get; set; } = string.Empty;
    public List<AiChatGroundingChunk> GroundingChunks { get; set; } = new();
}

public sealed class AiChatGroundingChunk
{
    public AiChatMapsChunk? Maps { get; set; }
}

public sealed class AiChatMapsChunk
{
    public string? Title { get; set; }
    public string? Uri { get; set; }
}

public sealed record ApplyDynamicPricingRequest(
    Guid RoomTypeId,
    decimal NightlyPrice,
    Guid? PropertyId = null,
    DateOnly? EffectiveFrom = null,
    DateOnly? EffectiveTo = null,
    int? FirstHours = null,
    decimal? FirstHoursPrice = null,
    decimal? AdditionalHourPrice = null,
    string? Currency = null,
    string? ChangeReason = null
);
