using System.Collections.Generic;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Extracted criteria from natural language queries.
/// </summary>
public sealed class AiSmartExtractedFiltersDto
{
    public RentalType? RentalType { get; set; }
    public string? DestinationKeyword { get; set; }
    public string? ProvinceCode { get; set; }
    public string? TouristZoneSlug { get; set; }
    public string? LandmarkSlug { get; set; }
    public string? LandmarkName { get; set; }
    public List<PropertyType> PropertyTypes { get; set; } = new();
    public int? MinGuests { get; set; }
    public decimal? MaxPrice { get; set; }
    public double? MaxDistanceMeters { get; set; }
    public List<string> Amenities { get; set; } = new();
}

/// <summary>
/// Response payload for AI Smart Search containing zero-hallucination property results,
/// extracted criteria, dynamic filter chips, and natural Vietnamese summary.
/// </summary>
public sealed class AiSmartSearchResponseDto
{
    public string Query { get; set; } = string.Empty;
    public string SummaryMessage { get; set; } = string.Empty;
    public AiSmartExtractedFiltersDto ExtractedFilters { get; set; } = new();
    public List<SuggestedFilterChipDto> SuggestedFilterChips { get; set; } = new();
    public IReadOnlyList<PublicPropertyDto> Properties { get; set; } = new List<PublicPropertyDto>();
    public int TotalResults { get; set; }
}
