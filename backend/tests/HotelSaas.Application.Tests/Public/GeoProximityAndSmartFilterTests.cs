using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

public sealed class GeoProximityAndSmartFilterTests
{
    private readonly ILocationLookupService _locationService = new LocationLookupService();

    // ── 1. HAVERSINE DISTANCE ACCURACY TESTS ────────────────────────────────

    [Fact]
    public void CalculateDistanceMeters_ComputesAccurateMetersBetweenKnownCoordinates()
    {
        // Ben Thanh Market: 10.7725, 106.6980
        // Nguyen Hue Walking Street: 10.7745, 106.7036
        // Expected distance: ~650m - 700m
        var meters = GeoProximityHelper.CalculateDistanceMeters(10.7725, 106.6980, 10.7745, 106.7036);
        Assert.InRange(meters, 600.0, 750.0);

        var km = GeoProximityHelper.CalculateDistanceKm(10.7725, 106.6980, 10.7745, 106.7036);
        Assert.InRange(km, 0.6, 0.75);
    }

    [Theory]
    [InlineData(450.0, "Cách 450m")]
    [InlineData(999.0, "Cách 999m")]
    [InlineData(1000.0, "Cách 1.0km")]
    [InlineData(1850.0, "Cách 1.9km")]
    [InlineData(3200.0, "Cách 3.2km")]
    public void FormatDistance_FormatsMetersAndKilometersCorrectly(double meters, string expected)
    {
        var formatted = GeoProximityHelper.FormatDistance(meters);
        Assert.Equal(expected, formatted);
    }

    // ── 2. 3-LAYER AUTO-MATCHING OF NEARBY LANDMARKS ─────────────────────────

    [Fact]
    public void AutoMatchNearbyLandmarks_Layer1_GpsProximity_MatchesClosestLandmarksAndZone()
    {
        // Property in Vung Tau close to Bai Sau (10.3340, 107.0890)
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Khách sạn Biển Nhớ Vũng Tàu",
            Address = "12 Thùy Vân, Phường Thắng Tam",
            City = "Vũng Tàu",
            Latitude = 10.3345,
            Longitude = 107.0895,
            Status = PropertyStatus.Active
        };

        GeoProximityHelper.AutoMatchNearbyLandmarks(property, _locationService);

        Assert.False(string.IsNullOrWhiteSpace(property.NearbyLandmarksJson));
        Assert.Equal("vung-tau", property.TouristZoneSlug);
        Assert.Contains("Vũng Tàu", property.TouristZoneName ?? string.Empty);

        using var doc = JsonDocument.Parse(property.NearbyLandmarksJson);
        var root = doc.RootElement;
        Assert.True(root.GetArrayLength() > 0);

        var firstLandmark = root[0];
        Assert.True(firstLandmark.TryGetProperty("Name", out var nameProp));
        Assert.True(firstLandmark.TryGetProperty("DistanceMeters", out var distProp));
        Assert.InRange(distProp.GetDouble(), 0.0, 5000.0);
    }

    [Fact]
    public void AutoMatchNearbyLandmarks_Layer2_ProvinceAdministrative_AssignsTopLandmarks()
    {
        // Property without GPS coordinates but located in Da Lat
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Homestay Mộng Mơ",
            Address = "Khu Hòa Bình",
            City = "Đà Lạt",
            Latitude = null,
            Longitude = null,
            Status = PropertyStatus.Active
        };

        GeoProximityHelper.AutoMatchNearbyLandmarks(property, _locationService, provinceCode: "68");

        Assert.False(string.IsNullOrWhiteSpace(property.NearbyLandmarksJson));
        Assert.Equal("da-lat", property.TouristZoneSlug);

        using var doc = JsonDocument.Parse(property.NearbyLandmarksJson);
        var array = doc.RootElement.EnumerateArray().ToList();
        Assert.NotEmpty(array);
        Assert.Contains(array, el => el.GetProperty("Name").GetString()!.Contains("Chợ đêm") ||
                                     el.GetProperty("Name").GetString()!.Contains("Hồ Xuân Hương"));
    }

    [Fact]
    public void AutoMatchNearbyLandmarks_Layer3_AddressTextMatching_DetectsFamousLandmark()
    {
        // Property with no coordinates and no province code, but address states "Chợ Bến Thành"
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Khách Sạn Sài Gòn Phố",
            Address = "150 Lê Lợi, gần Chợ Bến Thành",
            City = "",
            Latitude = null,
            Longitude = null,
            Status = PropertyStatus.Active
        };

        GeoProximityHelper.AutoMatchNearbyLandmarks(property, _locationService);

        Assert.False(string.IsNullOrWhiteSpace(property.NearbyLandmarksJson));
        using var doc = JsonDocument.Parse(property.NearbyLandmarksJson);
        var names = doc.RootElement.EnumerateArray()
            .Select(x => x.GetProperty("Name").GetString())
            .ToList();

        Assert.Contains(names, n => n != null && n.Contains("Chợ Bến Thành"));
    }

    // ── 3. UNACCENTED LANDMARK QUERY MATCHING ────────────────────────────────

    [Theory]
    [InlineData("nha nghi gan bai sau vung tau gia re", "bai-sau-vung-tau", "vung-tau")]
    [InlineData("khach san gan cho dem da lat", "cho-dem-da-lat", "da-lat")]
    [InlineData("homestay ho tuyen lam", "ho-tuyen-lam", "da-lat")]
    [InlineData("resort bai chay ha long", "bai-chay-ha-long", "ha-long")]
    [InlineData("khach san gan bien my khe da nang", "bai-bien-my-khe", "da-nang")]
    public void UnaccentedLandmarkQuery_ResolvesTargetLandmarkAndTouristZone(
        string userQuery, string expectedLandmarkSlug, string expectedZoneSlug)
    {
        var landmarks = _locationService.SearchLandmarks(userQuery);
        Assert.NotEmpty(landmarks);

        var matched = landmarks.FirstOrDefault(l => l.Slug == expectedLandmarkSlug);
        Assert.NotNull(matched);
        Assert.Equal(expectedZoneSlug, matched.TouristZoneSlug);
    }

    [Fact]
    public void VietnameseTextNormalizer_MatchesFlexibleLandmarkVariations()
    {
        Assert.True(VietnameseTextNormalizer.Matches("nha nghi gan bai sau vung tau gia re", "Bãi Sau"));
        Assert.True(VietnameseTextNormalizer.Matches("KHACH SAN CHO BEN THANH", "cho ben thanh"));
        Assert.True(VietnameseTextNormalizer.Matches("Khách sạn gần Hồ Hoàn Kiếm Hà Nội", "Hồ Hoàn Kiếm"));
        Assert.True(VietnameseTextNormalizer.Matches("Khu vực gần Hồ Gươm (Hồ Hoàn Kiếm)", "Hồ Gươm"));
    }

    // ── 4. SMART FILTER CHIPS GENERATION (ZERO-HALLUCINATION) ───────────────

    [Fact]
    public void BuildSmartFilterChips_GeneratesAuthoritativeChipsFromRealResults()
    {
        var sampleProperties = new List<PublicPropertyDto>
        {
            new PublicPropertyDto
            {
                Id = Guid.NewGuid(),
                Name = "Khách sạn Biển Đẹp",
                StartingPrice = 250000m,
                StarRating = 4,
                AllowHourlyBooking = true,
                AllowOvernightBooking = true,
                NearbyLandmarks = new List<PublicLandmarkDistanceDto>
                {
                    new PublicLandmarkDistanceDto("Bãi Sau Vũng Tàu", "Beach", 0.3, "Cách 300m")
                }
            },
            new PublicPropertyDto
            {
                Id = Guid.NewGuid(),
                Name = "Nhà nghỉ Hoàng Gia",
                StartingPrice = 180000m,
                StarRating = 3,
                AllowHourlyBooking = true,
                AllowOvernightBooking = false,
                NearbyLandmarks = new List<PublicLandmarkDistanceDto>
                {
                    new PublicLandmarkDistanceDto("Bãi Sau Vũng Tàu", "Beach", 0.8, "Cách 800m")
                }
            }
        };

        var targetLandmark = _locationService.GetLandmarkBySlug("bai-sau-vung-tau");
        var chips = GeoProximityHelper.BuildSmartFilterChips(sampleProperties, targetLandmark: targetLandmark);

        Assert.NotEmpty(chips);
        Assert.Contains(chips, c => c.FilterKey == "maxDistanceMeters" && Convert.ToInt32(c.FilterValue) == 1000);
        Assert.Contains(chips, c => c.Category == "price");
        Assert.Contains(chips, c => c.Category == "rating" && Convert.ToInt32(c.FilterValue) == 4);
    }

    // ── 5. SMART RADIUS FALLBACK IN GETPUBLICPROPERTIESQUERY ─────────────────

    [Fact]
    public async Task GetPublicProperties_TriggersSmartRadiusFallback_WhenNarrowRadiusYieldsLessThan2Properties()
    {
        // Target landmark: Bãi Sau Vũng Tàu (~10.3340, 107.0890)
        // Prop 1 is very close (~400m)
        // Prop 2 is further away (~2500m)
        var prop1 = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Khách sạn Sát Bãi Sau",
            Code = "BS01",
            Slug = "khach-san-sat-bai-sau",
            Address = "10 Thùy Vân, Vũng Tàu",
            City = "Vũng Tàu",
            Latitude = 10.3350,
            Longitude = 107.0895,
            TouristZoneSlug = "vung-tau",
            TouristZoneName = "Vũng Tàu",
            Status = PropertyStatus.Active
        };

        var prop2 = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Khách sạn Trung Tâm Vũng Tàu",
            Code = "BS02",
            Slug = "khach-san-trung-tam-vung-tau",
            Address = "25 Lê Lợi, Vũng Tàu",
            City = "Vũng Tàu",
            Latitude = 10.3550,
            Longitude = 107.0750,
            TouristZoneSlug = "vung-tau",
            TouristZoneName = "Vũng Tàu",
            Status = PropertyStatus.Active
        };

        var context = new GetPublicPropertiesSyntheticTests.TestApplicationDbContext(new[] { prop1, prop2 });
        var handler = new GetPublicPropertiesQueryHandler(context, _locationService);

        // Search for Bãi Sau with strict maxDistanceMeters = 500m
        // Normally only prop1 is <= 500m (count = 1 < 2), so smart radius fallback expands to 5km
        var query = new GetPublicPropertiesQuery(
            DestinationKeyword: "Bãi Sau Vũng Tàu",
            MaxDistanceMeters: 500);

        var results = await handler.Handle(query, CancellationToken.None);

        Assert.True(results.Count >= 2);
        // Prop1 within narrow radius should not be marked as expanded
        var r1 = results.First(p => p.Id == prop1.Id);
        Assert.False(r1.IsExpandedNearbySuggestion);

        // Prop2 which was pulled in by the fallback should have IsExpandedNearbySuggestion = true
        var r2 = results.First(p => p.Id == prop2.Id);
        Assert.True(r2.IsExpandedNearbySuggestion);
    }
}
