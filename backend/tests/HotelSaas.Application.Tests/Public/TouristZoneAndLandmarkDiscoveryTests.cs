using System;
using System.Collections.Generic;
using System.Linq;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Infrastructure.Services;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

public class TouristZoneAndLandmarkDiscoveryTests
{
    [Fact]
    public void LocationLookupService_ReturnsKnownTouristZonesAndLandmarks()
    {
        var service = new LocationLookupService();

        var zones = service.GetTouristZones();
        Assert.NotEmpty(zones);
        Assert.Contains(zones, z => z.Slug == "da-lat");
        Assert.Contains(zones, z => z.Slug == "vung-tau");
        Assert.Contains(zones, z => z.Slug == "da-nang");

        var landmarks = service.GetLandmarks();
        Assert.NotEmpty(landmarks);
        Assert.Contains(landmarks, l => l.Slug == "cho-dem-da-lat");
        Assert.Contains(landmarks, l => l.Slug == "bai-sau-vung-tau");
        Assert.Contains(landmarks, l => l.Slug == "cau-rong-da-nang");

        var daLatLandmarks = service.GetLandmarks(touristZoneSlug: "da-lat");
        Assert.All(daLatLandmarks, l => Assert.Equal("da-lat", l.TouristZoneSlug));
    }

    [Fact]
    public void HaversineDistanceCalculation_CalculatesAccurately()
    {
        // Distance between Ben Thanh Market (10.7725, 106.6980) and Nguyen Hue Walking Street (10.7745, 106.7036) is ~0.65 km
        var dist = GetPublicPropertiesQueryHandler.CalculateDistanceKm(10.7725, 106.6980, 10.7745, 106.7036);
        Assert.InRange(dist, 0.5, 0.9);
    }
}
