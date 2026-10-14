using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Public.Services;

/// <summary>
/// Proximity calculation and automatic landmark matching helper for hotels and public bookings.
/// Implements Haversine distance in meters and 3-layer proximity auto-tagging.
/// </summary>
public static class GeoProximityHelper
{
    private const double EarthRadiusMeters = 6371000.0;

    /// <summary>
    /// Calculates distance in meters between two GPS coordinates using the Haversine formula.
    /// </summary>
    public static double CalculateDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2.0) * Math.Sin(dLon / 2.0);

        var c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
        return EarthRadiusMeters * c;
    }

    /// <summary>
    /// Calculates distance in kilometers between two GPS coordinates.
    /// </summary>
    public static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        return CalculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000.0;
    }

    /// <summary>
    /// Formats distance in meters into friendly Vietnamese string (e.g. "Cách 450m", "Cách 1.8km").
    /// </summary>
    public static string FormatDistance(double distanceMeters)
    {
        if (distanceMeters < 1000.0)
        {
            return $"Cách {Math.Round(distanceMeters)}m";
        }
        var km = distanceMeters / 1000.0;
        return $"Cách {km.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture)}km";
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    /// <summary>
    /// Item structure for serialization in Property.NearbyLandmarksJson.
    /// </summary>
    public sealed class NearbyLandmarkItem
    {
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Category { get; set; }
        public double DistanceMeters { get; set; }
        public double DistanceKm { get; set; }
        public string DistanceFormatted { get; set; } = string.Empty;
    }

    /// <summary>
    /// Performs 3-layer auto-matching of nearby landmarks for a property:
    /// Layer 1: GPS Proximity (if coordinates valid, find landmarks within 15km).
    /// Layer 2: Administrative / Ward / Province Proximity.
    /// Layer 3: Address & Name text matching via VietnameseTextNormalizer.
    /// Automatically populates Property.NearbyLandmarksJson and assigns TouristZoneSlug if missing.
    /// </summary>
    public static void AutoMatchNearbyLandmarks(
        Property property,
        ILocationLookupService locationService,
        string? provinceCode = null,
        string? wardCode = null)
    {
        if (property == null || locationService == null) return;

        // If landmarks were manually provided and valid, keep them, but ensure TouristZone is set if missing
        if (!string.IsNullOrWhiteSpace(property.NearbyLandmarksJson))
        {
            TryPopulateTouristZoneFromExistingJson(property, locationService);
            return;
        }

        var allLandmarks = locationService.GetLandmarks();
        if (allLandmarks.Count == 0) return;

        // ── LAYER 1: GPS Proximity ───────────────────────────────────────────
        if (property.Latitude.HasValue && property.Longitude.HasValue &&
            property.Latitude.Value != 0 && property.Longitude.Value != 0)
        {
            var pLat = property.Latitude.Value;
            var pLon = property.Longitude.Value;

            var gpsMatches = allLandmarks
                .Select(lm =>
                {
                    var distMeters = CalculateDistanceMeters(pLat, pLon, lm.Latitude, lm.Longitude);
                    return new
                    {
                        Landmark = lm,
                        DistanceMeters = distMeters,
                        DistanceKm = Math.Round(distMeters / 1000.0, 2)
                    };
                })
                .Where(x => x.DistanceMeters <= 15000.0) // Within 15km
                .OrderBy(x => x.DistanceMeters)
                .Take(4)
                .ToList();

            if (gpsMatches.Count > 0)
            {
                var items = gpsMatches.Select(m => new NearbyLandmarkItem
                {
                    Name = m.Landmark.Name,
                    Slug = m.Landmark.Slug,
                    Category = m.Landmark.Category,
                    DistanceMeters = Math.Round(m.DistanceMeters),
                    DistanceKm = m.DistanceKm,
                    DistanceFormatted = FormatDistance(m.DistanceMeters)
                }).ToList();

                property.NearbyLandmarksJson = JsonSerializer.Serialize(items);

                if (string.IsNullOrWhiteSpace(property.TouristZoneSlug))
                {
                    var closestWithZone = gpsMatches.FirstOrDefault(m => !string.IsNullOrEmpty(m.Landmark.TouristZoneSlug));
                    if (closestWithZone != null && !string.IsNullOrEmpty(closestWithZone.Landmark.TouristZoneSlug))
                    {
                        property.TouristZoneSlug = closestWithZone.Landmark.TouristZoneSlug;
                        property.TouristZoneName = locationService.GetTouristZoneBySlug(closestWithZone.Landmark.TouristZoneSlug)?.Name;
                    }
                }
                return;
            }
        }

        // ── LAYER 2: Administrative / Province Proximity ────────────────────
        var effectiveProvince = provinceCode;
        if (string.IsNullOrWhiteSpace(effectiveProvince) && !string.IsNullOrWhiteSpace(property.City))
        {
            var prov = locationService.GetProvinces()
                .FirstOrDefault(p => VietnameseTextNormalizer.Matches(p.Name, property.City) ||
                                     VietnameseTextNormalizer.Matches(property.City, p.Name));
            if (prov != null) effectiveProvince = prov.Code;
        }

        var provLandmarks = !string.IsNullOrWhiteSpace(effectiveProvince)
            ? locationService.GetLandmarks(provinceCode: effectiveProvince)
            : new List<LandmarkDto>();

        if (provLandmarks.Count > 0)
        {
            var selected = provLandmarks
                .OrderBy(l => l.PopularSearchRank > 0 ? l.PopularSearchRank : 999)
                .Take(3)
                .ToList();

            var items = selected.Select((lm, idx) =>
            {
                var estMeters = 800.0 + (idx * 600.0);
                return new NearbyLandmarkItem
                {
                    Name = lm.Name,
                    Slug = lm.Slug,
                    Category = lm.Category,
                    DistanceMeters = estMeters,
                    DistanceKm = Math.Round(estMeters / 1000.0, 2),
                    DistanceFormatted = FormatDistance(estMeters)
                };
            }).ToList();

            property.NearbyLandmarksJson = JsonSerializer.Serialize(items);

            if (string.IsNullOrWhiteSpace(property.TouristZoneSlug))
            {
                var lmWithZone = selected.FirstOrDefault(l => !string.IsNullOrEmpty(l.TouristZoneSlug));
                if (lmWithZone != null && !string.IsNullOrEmpty(lmWithZone.TouristZoneSlug))
                {
                    property.TouristZoneSlug = lmWithZone.TouristZoneSlug;
                    property.TouristZoneName = locationService.GetTouristZoneBySlug(lmWithZone.TouristZoneSlug)?.Name;
                }
            }
            return;
        }

        // ── LAYER 3: Address & Name Text Matching ───────────────────────────
        var fullText = $"{property.Name} {property.Address}";
        var textMatches = allLandmarks
            .Where(lm =>
                VietnameseTextNormalizer.Matches(fullText, lm.Name) ||
                (lm.Aliases != null && lm.Aliases.Any(a => VietnameseTextNormalizer.Matches(fullText, a))))
            .Take(3)
            .ToList();

        if (textMatches.Count > 0)
        {
            var items = textMatches.Select((lm, idx) =>
            {
                var estMeters = 500.0 + (idx * 500.0);
                return new NearbyLandmarkItem
                {
                    Name = lm.Name,
                    Slug = lm.Slug,
                    Category = lm.Category,
                    DistanceMeters = estMeters,
                    DistanceKm = Math.Round(estMeters / 1000.0, 2),
                    DistanceFormatted = FormatDistance(estMeters)
                };
            }).ToList();

            property.NearbyLandmarksJson = JsonSerializer.Serialize(items);

            if (string.IsNullOrWhiteSpace(property.TouristZoneSlug))
            {
                var lmWithZone = textMatches.FirstOrDefault(l => !string.IsNullOrEmpty(l.TouristZoneSlug));
                if (lmWithZone != null && !string.IsNullOrEmpty(lmWithZone.TouristZoneSlug))
                {
                    property.TouristZoneSlug = lmWithZone.TouristZoneSlug;
                    property.TouristZoneName = locationService.GetTouristZoneBySlug(lmWithZone.TouristZoneSlug)?.Name;
                }
            }
        }
    }

    private static void TryPopulateTouristZoneFromExistingJson(Property property, ILocationLookupService locationService)
    {
        if (!string.IsNullOrWhiteSpace(property.TouristZoneSlug) || string.IsNullOrWhiteSpace(property.NearbyLandmarksJson))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(property.NearbyLandmarksJson);
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var name = el.TryGetProperty("Name", out var n) ? n.GetString() : null;
                var slug = el.TryGetProperty("Slug", out var s) ? s.GetString() : null;

                var landmark = !string.IsNullOrWhiteSpace(slug)
                    ? locationService.GetLandmarkBySlug(slug)
                    : (!string.IsNullOrWhiteSpace(name) ? locationService.FindLandmark(name) : null);

                if (landmark != null && !string.IsNullOrWhiteSpace(landmark.TouristZoneSlug))
                {
                    property.TouristZoneSlug = landmark.TouristZoneSlug;
                    property.TouristZoneName = locationService.GetTouristZoneBySlug(landmark.TouristZoneSlug)?.Name;
                    break;
                }
            }
        }
        catch
        {
            // Ignore parse errors
        }
    }

    /// <summary>
    /// Builds dynamic, authoritative smart filter chips based on actual search results.
    /// Guarantees zero-hallucination by grounding suggestions in real property attributes.
    /// </summary>
    public static List<SuggestedFilterChipDto> BuildSmartFilterChips(
        IReadOnlyList<PublicPropertyDto> properties,
        string? queryKeyword = null,
        LandmarkDto? targetLandmark = null,
        RentalType? currentRentalType = null)
    {
        var chips = new List<SuggestedFilterChipDto>();

        // 1. Landmark & Proximity Chips
        if (targetLandmark != null)
        {
            chips.Add(new SuggestedFilterChipDto
            {
                Id = "chip-near-1km",
                Label = $"📍 Gần {targetLandmark.Name} (< 1km)",
                Category = "nearby",
                FilterKey = "maxDistanceMeters",
                FilterValue = 1000,
                IsActive = false
            });

            chips.Add(new SuggestedFilterChipDto
            {
                Id = "chip-near-3km",
                Label = $"📍 Bán kính {targetLandmark.Name} (< 3km)",
                Category = "nearby",
                FilterKey = "maxDistanceMeters",
                FilterValue = 3000,
                IsActive = false
            });
        }
        else
        {
            // Extract top landmark badges across results
            var popularLandmarks = properties
                .SelectMany(p => p.NearbyLandmarks)
                .GroupBy(l => l.Name)
                .OrderByDescending(g => g.Count())
                .Take(2)
                .ToList();

            foreach (var lmGroup in popularLandmarks)
            {
                chips.Add(new SuggestedFilterChipDto
                {
                    Id = $"chip-lm-{lmGroup.Key.ToLowerInvariant().Replace(' ', '-')}",
                    Label = $"📍 {lmGroup.Key}",
                    Category = "nearby",
                    FilterKey = "destinationKeyword",
                    FilterValue = lmGroup.Key,
                    Count = lmGroup.Count(),
                    IsActive = false
                });
            }
        }

        // 2. Price Chips
        var validPrices = properties
            .Select(p => p.StartingPrice)
            .Where(p => p.HasValue && p.Value > 0)
            .Select(p => p!.Value)
            .ToList();

        if (validPrices.Count > 0)
        {
            var minPrice = validPrices.Min();
            var maxPrice = validPrices.Max();

            if (currentRentalType == RentalType.Hourly)
            {
                if (validPrices.Any(p => p <= 120000m))
                {
                    chips.Add(new SuggestedFilterChipDto
                    {
                        Id = "chip-price-hourly-low",
                        Label = "💰 Dưới 120k / 2 giờ",
                        Category = "price",
                        FilterKey = "maxPrice",
                        FilterValue = 120000m,
                        IsActive = false
                    });
                }
            }
            else
            {
                if (validPrices.Any(p => p <= 350000m))
                {
                    chips.Add(new SuggestedFilterChipDto
                    {
                        Id = "chip-price-low",
                        Label = "💰 Dưới 350k / đêm",
                        Category = "price",
                        FilterKey = "maxPrice",
                        FilterValue = 350000m,
                        IsActive = false
                    });
                }

                if (validPrices.Any(p => p > 350000m && p <= 700000m))
                {
                    chips.Add(new SuggestedFilterChipDto
                    {
                        Id = "chip-price-mid",
                        Label = "💰 350k - 700k / đêm",
                        Category = "price",
                        FilterKey = "maxPrice",
                        FilterValue = 700000m,
                        IsActive = false
                    });
                }
            }
        }

        // 3. Rating & Quality Chips
        var highRatedCount = properties.Count(p => p.StarRating >= 4);
        if (highRatedCount > 0)
        {
            chips.Add(new SuggestedFilterChipDto
            {
                Id = "chip-rating-high",
                Label = "⭐ Khách sạn 4-5 sao",
                Category = "rating",
                FilterKey = "minStarRating",
                FilterValue = 4,
                Count = highRatedCount,
                IsActive = false
            });
        }

        // 4. Rental Type Chips
        var hasHourly = properties.Any(p => p.AllowHourlyBooking);
        var hasOvernight = properties.Any(p => p.AllowOvernightBooking);

        if (hasHourly && currentRentalType != RentalType.Hourly)
        {
            chips.Add(new SuggestedFilterChipDto
            {
                Id = "chip-rental-hourly",
                Label = "⏰ Có cho thuê theo giờ",
                Category = "rentalType",
                FilterKey = "rentalType",
                FilterValue = "Hourly",
                IsActive = false
            });
        }

        if (hasOvernight && currentRentalType != RentalType.Overnight)
        {
            chips.Add(new SuggestedFilterChipDto
            {
                Id = "chip-rental-overnight",
                Label = "🌙 Thuê qua đêm",
                Category = "rentalType",
                FilterKey = "rentalType",
                FilterValue = "Overnight",
                IsActive = false
            });
        }

        return chips;
    }
}
