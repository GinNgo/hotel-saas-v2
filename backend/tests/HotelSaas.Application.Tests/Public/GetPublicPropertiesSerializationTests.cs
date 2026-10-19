using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

/// <summary>
/// Phase P7 Verification tests for JSON serialization, transport payload shape,
/// and public controller endpoint metadata contracts (P7-FUZZY-CONTRACT-VERIFY-02).
/// Verifies:
/// 1. Direct JSON array structure (no wrapping object).
/// 2. Exact authorized public property keys and types.
/// 3. Zero leakage of internal relevance scores, matching breakdowns, entity status, or tenancy fields.
/// 4. Behavior under production ASP.NET Core JsonSerializerOptions (CamelCase, StringEnum, WhenWritingNull).
/// 5. Preservation of Active-only filtering, blank bypass, and ranked ordering across JSON payload.
/// 6. PublicController routing and query parameter binding metadata verification.
/// </summary>
public sealed class GetPublicPropertiesSerializationTests
{
    /// <summary>
    /// Source-equivalent copy of JsonSerializerOptions configured in WebApi Program.cs (lines 54-60).
    /// Note: This is an equivalent standalone configuration instance used for unit contract testing,
    /// NOT a runtime DI-resolved instance from WebApplicationFactory, avoiding unverified runtime DI claims.
    /// </summary>
    private static readonly JsonSerializerOptions WebApiProdOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly JsonSerializerOptions DefaultCamelCaseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>
    /// Distinct test catalog where every property has unique checkIn/checkOut times,
    /// bufferMinutes, and maxHourlyHours to detect potential field swaps.
    /// </summary>
    internal static readonly Domain.Entities.Property[] DistinctTestCatalog = new[]
    {
        new Domain.Entities.Property
        {
            Id = Guid.Parse("11111111-aaaa-1111-aaaa-111111111111"),
            Name = "Khách Sạn Biển Đông Đà Nẵng",
            Code = "P-DN-01",
            Slug = "bien-dong-danang",
            Address = "101 Võ Nguyên Giáp, Sơn Trà",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 15, 0),
            CheckOutTime = new TimeOnly(11, 45, 0),
            BufferMinutes = 35,
            MaxHourlyHours = 10
        },
        new Domain.Entities.Property
        {
            Id = Guid.Parse("22222222-bbbb-2222-bbbb-222222222222"),
            Name = "Khách Sạn Hà Nội Horizon",
            Code = "P-HN-02",
            Slug = "hanoi-horizon",
            Address = "202 Cát Linh, Đống Đa",
            City = "Hà Nội",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(15, 30, 0),
            CheckOutTime = new TimeOnly(12, 15, 0),
            BufferMinutes = 45,
            MaxHourlyHours = 8
        },
        new Domain.Entities.Property
        {
            Id = Guid.Parse("33333333-cccc-3333-cccc-333333333333"),
            Name = "Khách Sạn Sài Gòn Central",
            Code = "P-SG-03",
            Slug = "saigon-central",
            Address = "303 Lê Lợi, Quận 1",
            City = "TP. Hồ Chí Minh",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(13, 0, 0),
            CheckOutTime = new TimeOnly(11, 0, 0),
            BufferMinutes = 60,
            MaxHourlyHours = 6
        }
    };

    private static readonly HashSet<string> AllowedKeysWhenNullOmitted = new(StringComparer.Ordinal)
    {
        "id",
        "name",
        "code",
        "slug",
        "address",
        "city",
        "checkInTime",
        "checkOutTime",
        "bufferMinutes",
        "maxHourlyHours",
        "propertyType",
        "propertyTypeName",
        "starRating",
        "allowHourlyBooking",
        "allowOvernightBooking",
        "allowDailyBooking",
        "nearbyLandmarks",
        "isExpandedNearbySuggestion"
    };

    private static readonly HashSet<string> AllowedKeysWhenNullIncluded = new(StringComparer.Ordinal)
    {
        "id",
        "name",
        "code",
        "slug",
        "address",
        "city",
        "checkInTime",
        "checkOutTime",
        "bufferMinutes",
        "maxHourlyHours",
        "imageUrl",
        "propertyType",
        "propertyTypeName",
        "starRating",
        "latitude",
        "longitude",
        "touristZoneSlug",
        "touristZoneName",
        "allowHourlyBooking",
        "allowOvernightBooking",
        "allowDailyBooking",
        "hourlyStartingPrice",
        "overnightStartingPrice",
        "dailyStartingPrice",
        "startingPrice",
        "nearbyLandmarks",
        "nearestLandmarkInfo",
        "distanceMeters",
        "distanceFormatted",
        "isExpandedNearbySuggestion"
    };

    private static readonly string[] ForbiddenInternalFieldSubstrings = new[]
    {
        "score",
        "Score",
        "bestField",
        "BestField",
        "nameScore",
        "cityScore",
        "addressScore",
        "status",
        "Status",
        "tenant",
        "Tenant",
        "isPublished",
        "IsPublished",
        "rooms",
        "Rooms",
        "ratePolicies",
        "secrets",
        "rowVersion"
    };

    private static GetPublicPropertiesQueryHandler CreateHandler()
    {
        var fakeContext = new GetPublicPropertiesSyntheticTests.TestApplicationDbContext(
            GetPublicPropertiesSyntheticTests.CatalogWithInactive);
        return new GetPublicPropertiesQueryHandler(fakeContext);
    }

    [Fact]
    public async Task Serialize_WithWebApiProdOptions_ProducesDirectJsonArrayWithoutWrapper()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery(null), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);

        using var doc = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(7, doc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task Serialize_EachElement_HasExactAuthorizedKeysAndZeroInternalScoreLeakage()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery("centxralz"), CancellationToken.None);

        // Serialize under WebApi production options (WhenWritingNull)
        string jsonProd = JsonSerializer.Serialize(results, WebApiProdOptions);
        using var docProd = JsonDocument.Parse(jsonProd);

        foreach (var element in docProd.RootElement.EnumerateArray())
        {
            var propNames = element.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

            // Exactly the 10 authorized keys (imageUrl is omitted because null)
            Assert.Equal(AllowedKeysWhenNullOmitted.Count, propNames.Count);
            Assert.Subset(AllowedKeysWhenNullOmitted, propNames);

            // Zero forbidden fields
            foreach (var forbidden in ForbiddenInternalFieldSubstrings)
            {
                Assert.DoesNotContain(forbidden, propNames);
            }
        }

        // Serialize under default options (WhenWritingNull disabled, imageUrl: null included)
        string jsonDefault = JsonSerializer.Serialize(results, DefaultCamelCaseOptions);
        using var docDefault = JsonDocument.Parse(jsonDefault);

        foreach (var element in docDefault.RootElement.EnumerateArray())
        {
            var propNames = element.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

            Assert.Equal(AllowedKeysWhenNullIncluded.Count, propNames.Count);
            Assert.Subset(AllowedKeysWhenNullIncluded, propNames);
            Assert.Equal(JsonValueKind.Null, element.GetProperty("imageUrl").ValueKind);

            foreach (var forbidden in ForbiddenInternalFieldSubstrings)
            {
                Assert.DoesNotContain(forbidden, propNames);
            }
        }
    }

    [Fact]
    public async Task Serialize_FieldDataTypesAndFormats_ConformStrictlyToPublicDtoContract()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery(null), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);
        using var doc = JsonDocument.Parse(json);

        var first = doc.RootElement.EnumerateArray().First();

        // 1. Id matches exact Guid of P1 ("Khách Sạn Biển Đông Đà Nẵng")
        Assert.True(Guid.TryParse(first.GetProperty("id").GetString(), out var parsedGuid));
        Assert.Equal(Guid.Parse("11111111-1111-1111-1111-111111111111"), parsedGuid);

        // 2. String fields match exact values
        Assert.Equal(JsonValueKind.String, first.GetProperty("name").ValueKind);
        Assert.Equal("Khách Sạn Biển Đông Đà Nẵng", first.GetProperty("name").GetString());

        Assert.Equal(JsonValueKind.String, first.GetProperty("code").ValueKind);
        Assert.Equal("P01", first.GetProperty("code").GetString());

        Assert.Equal(JsonValueKind.String, first.GetProperty("slug").ValueKind);
        Assert.Equal("khach-san-bien-dong-da-nang", first.GetProperty("slug").GetString());

        Assert.Equal(JsonValueKind.String, first.GetProperty("address").ValueKind);
        Assert.Equal("200 Võ Nguyên Giáp, Quận Sơn Trà", first.GetProperty("address").GetString());

        Assert.Equal(JsonValueKind.String, first.GetProperty("city").ValueKind);
        Assert.Equal("Đà Nẵng", first.GetProperty("city").GetString());

        // 3. TimeOnly serializes as exact ISO 8601 time string with seconds ("HH:mm:ss")
        Assert.Equal(JsonValueKind.String, first.GetProperty("checkInTime").ValueKind);
        Assert.Equal("14:00:00", first.GetProperty("checkInTime").GetString());

        Assert.Equal(JsonValueKind.String, first.GetProperty("checkOutTime").ValueKind);
        Assert.Equal("12:00:00", first.GetProperty("checkOutTime").GetString());

        // 4. Integer fields are numbers with exact values
        Assert.Equal(JsonValueKind.Number, first.GetProperty("bufferMinutes").ValueKind);
        Assert.Equal(30, first.GetProperty("bufferMinutes").GetInt32());

        Assert.Equal(JsonValueKind.Number, first.GetProperty("maxHourlyHours").ValueKind);
        Assert.Equal(12, first.GetProperty("maxHourlyHours").GetInt32());
    }

    [Fact]
    public async Task Serialize_DistinctPropertyCatalog_PreservesExactPerPropertyValuesWithoutFieldSwaps()
    {
        var fakeContext = new GetPublicPropertiesSyntheticTests.TestApplicationDbContext(DistinctTestCatalog);
        var handler = new GetPublicPropertiesQueryHandler(fakeContext);

        // Execute blank query to retrieve all 3 distinct properties
        var results = await handler.Handle(new GetPublicPropertiesQuery(null), CancellationToken.None);
        string json = JsonSerializer.Serialize(results, WebApiProdOptions);

        using var doc = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(3, doc.RootElement.GetArrayLength());

        var items = doc.RootElement.EnumerateArray().ToList();

        // Deterministic sort: Name ascending
        // 0: "Khách Sạn Biển Đông Đà Nẵng" (P1)
        // 1: "Khách Sạn Hà Nội Horizon" (P2)
        // 2: "Khách Sạn Sài Gòn Central" (P3)

        // Item 0: P1 (CheckIn: 14:15:00, CheckOut: 11:45:00, Buffer: 35, MaxHourly: 10)
        var p1 = items[0];
        Assert.Equal("11111111-aaaa-1111-aaaa-111111111111", p1.GetProperty("id").GetString());
        Assert.Equal("Khách Sạn Biển Đông Đà Nẵng", p1.GetProperty("name").GetString());
        Assert.Equal("P-DN-01", p1.GetProperty("code").GetString());
        Assert.Equal("bien-dong-danang", p1.GetProperty("slug").GetString());
        Assert.Equal("101 Võ Nguyên Giáp, Sơn Trà", p1.GetProperty("address").GetString());
        Assert.Equal("Đà Nẵng", p1.GetProperty("city").GetString());
        Assert.Equal("14:15:00", p1.GetProperty("checkInTime").GetString());
        Assert.Equal("11:45:00", p1.GetProperty("checkOutTime").GetString());
        Assert.Equal(35, p1.GetProperty("bufferMinutes").GetInt32());
        Assert.Equal(10, p1.GetProperty("maxHourlyHours").GetInt32());
        Assert.False(p1.TryGetProperty("imageUrl", out _));

        // Item 1: P2 (CheckIn: 15:30:00, CheckOut: 12:15:00, Buffer: 45, MaxHourly: 8)
        var p2 = items[1];
        Assert.Equal("22222222-bbbb-2222-bbbb-222222222222", p2.GetProperty("id").GetString());
        Assert.Equal("Khách Sạn Hà Nội Horizon", p2.GetProperty("name").GetString());
        Assert.Equal("P-HN-02", p2.GetProperty("code").GetString());
        Assert.Equal("hanoi-horizon", p2.GetProperty("slug").GetString());
        Assert.Equal("202 Cát Linh, Đống Đa", p2.GetProperty("address").GetString());
        Assert.Equal("Hà Nội", p2.GetProperty("city").GetString());
        Assert.Equal("15:30:00", p2.GetProperty("checkInTime").GetString());
        Assert.Equal("12:15:00", p2.GetProperty("checkOutTime").GetString());
        Assert.Equal(45, p2.GetProperty("bufferMinutes").GetInt32());
        Assert.Equal(8, p2.GetProperty("maxHourlyHours").GetInt32());
        Assert.False(p2.TryGetProperty("imageUrl", out _));

        // Item 2: P3 (CheckIn: 13:00:00, CheckOut: 11:00:00, Buffer: 60, MaxHourly: 6)
        var p3 = items[2];
        Assert.Equal("33333333-cccc-3333-cccc-333333333333", p3.GetProperty("id").GetString());
        Assert.Equal("Khách Sạn Sài Gòn Central", p3.GetProperty("name").GetString());
        Assert.Equal("P-SG-03", p3.GetProperty("code").GetString());
        Assert.Equal("saigon-central", p3.GetProperty("slug").GetString());
        Assert.Equal("303 Lê Lợi, Quận 1", p3.GetProperty("address").GetString());
        Assert.Equal("TP. Hồ Chí Minh", p3.GetProperty("city").GetString());
        Assert.Equal("13:00:00", p3.GetProperty("checkInTime").GetString());
        Assert.Equal("11:00:00", p3.GetProperty("checkOutTime").GetString());
        Assert.Equal(60, p3.GetProperty("bufferMinutes").GetInt32());
        Assert.Equal(6, p3.GetProperty("maxHourlyHours").GetInt32());
        Assert.False(p3.TryGetProperty("imageUrl", out _));

        // Under DefaultCamelCaseOptions (imageUrl included as null)
        string jsonWithNull = JsonSerializer.Serialize(results, DefaultCamelCaseOptions);
        using var docWithNull = JsonDocument.Parse(jsonWithNull);
        var p1WithNull = docWithNull.RootElement.EnumerateArray().First();
        Assert.Equal(JsonValueKind.Null, p1WithNull.GetProperty("imageUrl").ValueKind);
        Assert.Equal("14:15:00", p1WithNull.GetProperty("checkInTime").GetString());
        Assert.Equal("11:45:00", p1WithNull.GetProperty("checkOutTime").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\u0301")]
    public async Task Serialize_BlankOrNormalizedEmpty_ReturnsDirectArrayOfAll7ActivePropertiesInNameAscOrder(string? query)
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery(query), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);
        using var doc = JsonDocument.Parse(json);

        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(7, doc.RootElement.GetArrayLength());

        var names = doc.RootElement.EnumerateArray()
            .Select(e => e.GetProperty("name").GetString())
            .ToList();

        // Must be in ascending alphabetical order
        for (int i = 0; i < names.Count - 1; i++)
        {
            Assert.True(string.Compare(names[i], names[i + 1], StringComparison.OrdinalIgnoreCase) <= 0);
        }
    }

    [Fact]
    public async Task Serialize_TypoQuery_MaintainsDeterministicRankingOrderInSerializedJson()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery("centxralz"), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);
        using var doc = JsonDocument.Parse(json);

        var ids = doc.RootElement.EnumerateArray()
            .Select(e => e.GetProperty("id").GetString())
            .ToList();

        var expectedIds = new[]
        {
            "22222222-2222-2222-2222-222222222222",
            "88888888-8888-8888-8888-888888888888",
            "33333333-3333-3333-3333-333333333333"
        };

        Assert.Equal(expectedIds, ids);
    }

    [Fact]
    public async Task Serialize_NoMatchQuery_ProducesExactEmptyJsonArray()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery("Khách sạn Không Tồn Tại 12345"), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);
        Assert.Equal("[]", json.Trim());
    }

    [Fact]
    public async Task Serialize_InactiveProperty_IsNeverSerializedEvenWhenExactMatch()
    {
        var handler = CreateHandler();
        // P6 is inactive in catalog
        var results = await handler.Handle(new GetPublicPropertiesQuery("Khách Sạn Phú Quốc Sunset Resort"), CancellationToken.None);

        string json = JsonSerializer.Serialize(results, WebApiProdOptions);
        Assert.Equal("[]", json.Trim());
    }

    [Fact]
    public void Verify_PublicControllerMetadata_MatchesContractEndpointAndQueryAttributes()
    {
        // Load PublicController via reflection
        var controllerType = Type.GetType("HotelSaas.WebApi.Controllers.PublicController, HotelSaas.WebApi");
        Assert.NotNull(controllerType);

        // 1. Controller attributes
        var apiControllerAttr = controllerType.GetCustomAttribute<ApiControllerAttribute>();
        Assert.NotNull(apiControllerAttr);

        var routeAttr = controllerType.GetCustomAttribute<RouteAttribute>();
        Assert.NotNull(routeAttr);
        Assert.Equal("api/public", routeAttr.Template);

        var producesAttr = controllerType.GetCustomAttribute<ProducesAttribute>();
        Assert.NotNull(producesAttr);
        Assert.Contains("application/json", producesAttr.ContentTypes);

        // 2. GetProperties method
        var getPropertiesMethod = controllerType.GetMethod("GetProperties");
        Assert.NotNull(getPropertiesMethod);

        var httpGetAttr = getPropertiesMethod.GetCustomAttribute<HttpGetAttribute>();
        Assert.NotNull(httpGetAttr);
        Assert.Equal("properties", httpGetAttr.Template);

        var allowAnonymousAttr = getPropertiesMethod.GetCustomAttribute<AllowAnonymousAttribute>();
        Assert.NotNull(allowAnonymousAttr);

        var producesRespAttr = getPropertiesMethod.GetCustomAttribute<ProducesResponseTypeAttribute>();
        Assert.NotNull(producesRespAttr);
        Assert.Equal(StatusCodes.Status200OK, producesRespAttr.StatusCode);
        Assert.Equal(typeof(IReadOnlyList<PublicPropertyDto>), producesRespAttr.Type);

        // 3. Query parameter binding
        var searchParam = getPropertiesMethod.GetParameters().FirstOrDefault(p => p.Name == "search");
        Assert.NotNull(searchParam);
        Assert.Equal(typeof(string), searchParam.ParameterType);

        var fromQueryAttr = searchParam.GetCustomAttribute<FromQueryAttribute>();
        Assert.NotNull(fromQueryAttr);
    }
}
