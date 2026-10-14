using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Properties.DTOs;

/// <summary>
/// Data transfer object summarizing a branch property with operational metrics for the tenant headquarters.
/// </summary>
public sealed record TenantPropertySummaryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string? PhoneNumber { get; init; }
    public string? Email { get; init; }
    public PropertyType PropertyType { get; init; }
    public string PropertyTypeName { get; init; } = string.Empty;
    public int StarRating { get; init; }
    public PropertyStatus Status { get; init; }
    public bool IsPublished { get; init; }
    public string? TouristZoneSlug { get; init; }
    public string? TouristZoneName { get; init; }
    public bool AllowHourlyBooking { get; init; }
    public bool AllowOvernightBooking { get; init; }
    public bool AllowDailyBooking { get; init; }
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public string? NearbyLandmarksJson { get; init; }
    public int TotalRooms { get; init; }
    public int OccupiedRooms { get; init; }
    public int AvailableRooms { get; init; }
    public decimal TodayRevenue { get; init; }
}
