using System;
using System.Collections.Generic;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Proximity information to a recognized tourist landmark.
/// </summary>
public sealed record PublicLandmarkDistanceDto(
    string Name,
    string? Category,
    double DistanceKm,
    string DistanceFormatted
);

/// <summary>
/// Public view of an active accommodation property for unauthenticated guest discovery.
/// </summary>
public sealed class PublicPropertyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public TimeOnly CheckInTime { get; set; }
    public TimeOnly CheckOutTime { get; set; }
    public int BufferMinutes { get; set; }
    public int MaxHourlyHours { get; set; }
    public string? ImageUrl { get; set; }

    [System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter))]
    public PropertyType PropertyType { get; set; } = PropertyType.Hotel;
    public string PropertyTypeName { get; set; } = "Khách sạn";
    public int StarRating { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? TouristZoneSlug { get; set; }
    public string? TouristZoneName { get; set; }
    public bool AllowHourlyBooking { get; set; } = true;
    public bool AllowOvernightBooking { get; set; } = true;
    public bool AllowDailyBooking { get; set; } = true;

    public decimal? HourlyStartingPrice { get; set; }
    public decimal? OvernightStartingPrice { get; set; }
    public decimal? DailyStartingPrice { get; set; }
    public decimal? StartingPrice { get; set; }

    public List<PublicLandmarkDistanceDto> NearbyLandmarks { get; set; } = new();
    public string? NearestLandmarkInfo { get; set; }

    /// <summary>
    /// Calculated proximity distance in meters from the user's location or the target landmark.
    /// </summary>
    public double? DistanceMeters { get; set; }

    /// <summary>
    /// Human-friendly distance label (e.g. "Cách 450m" or "Cách 2.3km").
    /// </summary>
    public string? DistanceFormatted { get; set; }

    /// <summary>
    /// Indicates whether this property was included as an expanded nearby fallback suggestion
    /// when the narrow radius returned few or no properties.
    /// </summary>
    public bool IsExpandedNearbySuggestion { get; set; }
}
