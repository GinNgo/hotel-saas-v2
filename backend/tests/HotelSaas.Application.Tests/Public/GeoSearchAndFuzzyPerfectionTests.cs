using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

/// <summary>
/// Unit tests verifying condensed tourist-zone/landmark resolution, reverse geocoding thresholds,
/// public marketplace fuzzy alias/condensed scoring, and GetPublicPropertiesQueryHandler geo/province fixes.
/// </summary>
public sealed class GeoSearchAndFuzzyPerfectionTests
{
    private static readonly LocationLookupService LocationService = new();

    private sealed class GeoFakeDbContext : IApplicationDbContext
    {
        public GeoFakeDbContext(
            IEnumerable<Property> properties,
            IEnumerable<Tenant>? tenants = null,
            IEnumerable<RoomTypeRate>? rates = null)
        {
            Properties = new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Property>(properties);
            Tenants = tenants != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Tenant>(tenants)
                : null!;
            RoomTypeRates = rates != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<RoomTypeRate>(rates)
                : new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<RoomTypeRate>(Array.Empty<RoomTypeRate>());
            GuestReviews = null!;
        }

        public DbSet<Property> Properties { get; }
        public DbSet<Tenant> Tenants { get; }
        public DbSet<RoomTypeRate> RoomTypeRates { get; }
        public DbSet<GuestReview> GuestReviews { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<RoomType> RoomTypes => throw new NotImplementedException();
        public DbSet<Room> Rooms => throw new NotImplementedException();
        public DbSet<Reservation> Reservations => throw new NotImplementedException();
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    [Theory]
    [InlineData("dalat", "da-lat")]
    [InlineData("sapa", "sa-pa")]
    [InlineData("vungtau", "vung-tau")]
    [InlineData("phuquoc", "phu-quoc")]
    [InlineData("nhatrang", "nha-trang")]
    [InlineData("danang", "da-nang")]
    [InlineData("hoian", "hoi-an")]
    [InlineData("halong", "ha-long")]
    [InlineData("quynhon", "quy-nhon")]
    [InlineData("muine", "phan-thiet-mui-ne")]
    [InlineData("saigon", "quan-1-tphcm")]
    [InlineData("tphcm", "quan-1-tphcm")]
    [InlineData("hcm", "quan-1-tphcm")]
    [InlineData("hanoi", "ha-noi-pho-co")]
    public void LocationLookupService_FindTouristZone_MatchesCondensedAndAliases(string query, string expectedSlug)
    {
        var zone = LocationService.FindTouristZone(query);
        Assert.NotNull(zone);
        Assert.Equal(expectedSlug, zone.Slug);
    }

    [Fact]
    public void LocationLookupService_FindLandmark_MatchesCondensed_WithoutStealingCityZones()
    {
        var benThanh = LocationService.FindLandmark("chobenthanh");
        Assert.NotNull(benThanh);
        Assert.Equal("cho-ben-thanh", benThanh.Slug);

        var hoanKiem = LocationService.FindLandmark("hohoankiem");
        Assert.NotNull(hoanKiem);
        Assert.Equal("ho-hoan-kiem", hoanKiem.Slug);

        // City-zone condensed names must not be hijacked into a single landmark.
        Assert.Null(LocationService.FindLandmark("dalat"));
        Assert.Null(LocationService.FindLandmark("sapa"));
        Assert.Null(LocationService.FindLandmark("saigon"));
        Assert.Null(LocationService.FindLandmark("Thành phố Huế"));
        Assert.Null(LocationService.FindLandmark("Phan Thiết"));
        Assert.Equal("cho-dem-phu-quoc", LocationService.FindLandmark("Chợ Đêm Phú Quốc")?.Slug);
        Assert.Equal("pho-co-ha-noi", LocationService.FindLandmark("Phố Cổ Hà Nội")?.Slug);
    }

    [Fact]
    public void LocationLookupService_ReverseGeocode_AppliesDistanceThresholdLabels()
    {
        // 1. Within <= 3000m of Chợ Bến Thành (10.7725, 106.6980) -> "Gần ..."
        var nearLandmark = LocationService.ReverseGeocode(10.7730, 106.6985);
        Assert.Equal("cho-ben-thanh", nearLandmark.NearestLandmarkSlug);
        Assert.StartsWith("Gần Chợ Bến Thành", nearLandmark.DisplayLabel, StringComparison.Ordinal);

        // 2. ~12km from Q1 center & ~7km from Tân Sơn Nhất (outside 3km landmark, inside 40km zone) -> "Khu vực ..."
        var inZone = LocationService.ReverseGeocode(10.8550, 106.7550);
        Assert.StartsWith("Khu vực ", inZone.DisplayLabel, StringComparison.Ordinal);

        // 3. ~18km from Tân Sơn Nhất, outside 40km zone center? Wait: use distant point > 60km away -> fallback GPS label.
        var farGps = LocationService.ReverseGeocode(14.5000, 108.5000);
        Assert.Null(farGps.NearestLandmarkSlug);
        Assert.Null(farGps.NearestZoneSlug);
        Assert.Equal("Vị trí GPS (14.5000, 108.5000)", farGps.DisplayLabel);

        // 4. Between 3km and 30km of a landmark whose tourist zone is >40km or absent (e.g., ~10km north of Sân bay Nội Bài at 21.3000, 105.8072) -> "Quanh ..."
        var aroundLandmark = LocationService.ReverseGeocode(21.3100, 105.8072);
        Assert.Equal("san-bay-noi-bai", aroundLandmark.NearestLandmarkSlug);
        Assert.StartsWith("Quanh Sân bay Quốc tế Nội Bài", aroundLandmark.DisplayLabel, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("hcm", "TP. Hồ Chí Minh", 85)]
    [InlineData("tphcm", "TP. Hồ Chí Minh", 85)]
    [InlineData("saigon", "TP. Hồ Chí Minh", 85)]
    [InlineData("sai gon", "TP. Hồ Chí Minh", 85)]
    [InlineData("sg", "TP. Hồ Chí Minh", 85)]
    [InlineData("hn", "Hà Nội", 85)]
    [InlineData("dn", "Đà Nẵng", 85)]
    [InlineData("vt", "Vũng Tàu", 85)]
    [InlineData("pq", "Phú Quốc", 85)]
    [InlineData("dl", "Đà Lạt", 85)]
    [InlineData("nt", "Nha Trang", 85)]
    [InlineData("hl", "Hạ Long", 85)]
    [InlineData("saigon", "An Lam Saigon River Retreat", 80)]
    [InlineData("saigon", "An Lam Sai Gon River Retreat", 85)]
    [InlineData("danang", "Khách Sạn Biển Đông Đà Nẵng", 78)]
    [InlineData("phuquoc", "Sunset Beach Phú Quốc Resort", 78)]
    public void FuzzyPropertyMatcher_ScorePublicField_HandlesRegionalAliasesAndCondensedMatches(
        string query,
        string field,
        int expectedScore)
    {
        var score = FuzzyPropertyMatcher.ScorePublicField(query, field);
        Assert.Equal(expectedScore, score);
    }

    [Fact]
    public void FuzzyPropertyMatcher_SearchPublicDtos_MatchesBrandProvinceWardAndPreservesLockedScoreField()
    {
        // Existing ScoreField contract remains untouched for FuzzyPropertyMatcherTests compatibility.
        Assert.Equal(0, FuzzyPropertyMatcher.ScoreField("Sài Gòn", "TP. Hồ Chí Minh"));

        var dtos = new[]
        {
            new PublicPropertyDto
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                Name = "An Lâm Retreat River",
                TenantBrandName = "An Lâm Retreats Collection",
                City = "Thuận An",
                ProvinceName = "TP. Hồ Chí Minh",
                WardName = "Phường Vĩnh Phú",
                Address = "10/4 Đường Vĩnh Phú 41"
            },
            new PublicPropertyDto
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                Name = "Mountain Pine Lodge",
                TenantBrandName = "Pine Group",
                City = "Đà Lạt",
                ProvinceName = "Lâm Đồng",
                WardName = "Phường 10",
                Address = "12 Trần Hưng Đạo"
            }
        };

        var byBrand = FuzzyPropertyMatcher.SearchProperties("An Lam Retreats", dtos);
        var brandMatch = Assert.Single(byBrand);
        Assert.Equal(dtos[0].Id, brandMatch.Property.Id);
        Assert.Equal("TouristZone", brandMatch.BestField);

        var byWard = FuzzyPropertyMatcher.SearchProperties("Vĩnh Phú", dtos);
        var wardMatch = Assert.Single(byWard);
        Assert.Equal(dtos[0].Id, wardMatch.Property.Id);

        var byAlias = FuzzyPropertyMatcher.SearchProperties("tphcm", dtos);
        var aliasMatch = Assert.Single(byAlias);
        Assert.Equal(dtos[0].Id, aliasMatch.Property.Id);
        Assert.Equal(85, aliasMatch.Score);
    }

    [Fact]
    public async Task GetPublicProperties_LandmarkSearch_IncludesNeighboringDistrictWithinRadiusWithoutZoneOverfilter()
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Saigon Group",
            Slug = "saigon-group",
            Status = TenantStatus.Active
        };

        // Property near Chợ Bến Thành (~1.1km away in District 3 / null TouristZoneSlug)
        var nearbyNoZoneProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "District 3 Boutique Stay",
            Code = "D3-STAY",
            Slug = "district-3-boutique-stay",
            Address = "150 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh",
            City = "TP. Hồ Chí Minh",
            Latitude = 10.7785,
            Longitude = 106.6902,
            TouristZoneSlug = null,
            Status = PropertyStatus.Active
        };

        // Distant Da Lat property should not match HCM landmark
        var daLatProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Da Lat Villa",
            Code = "DL-V",
            Slug = "da-lat-villa",
            Address = "10 Hồ Tùng Mậu, Đà Lạt",
            City = "Đà Lạt",
            Latitude = 11.9404,
            Longitude = 108.4452,
            TouristZoneSlug = "da-lat",
            Status = PropertyStatus.Active
        };

        var handler = new GetPublicPropertiesQueryHandler(
            new GeoFakeDbContext(new[] { nearbyNoZoneProp, daLatProp }, new[] { tenant }),
            LocationService);

        var result = await handler.Handle(
            new GetPublicPropertiesQuery(DestinationKeyword: "Chợ Bến Thành", MaxDistanceMeters: 3000),
            CancellationToken.None);

        var single = Assert.Single(result);
        Assert.Equal(nearbyNoZoneProp.Id, single.Id);
        Assert.True(single.DistanceMeters <= 3000);
    }

    [Fact]
    public async Task GetPublicProperties_ProvinceKeyword_ResolvesProvinceAndFiltersMatches()
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Vietnam Stays",
            Slug = "vietnam-stays",
            Status = TenantStatus.Active
        };

        var daNangProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Coastal Oceanfront",
            Code = "DN-01",
            Slug = "coastal-oceanfront",
            Address = "200 Võ Nguyên Giáp, Đà Nẵng",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active
        };

        var haNoiProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Capital Heritage",
            Code = "HN-01",
            Slug = "capital-heritage",
            Address = "20 Hàng Gai, Hoàn Kiếm, Hà Nội",
            City = "Hà Nội",
            Status = PropertyStatus.Active
        };

        // Pass an unused province-like query without tourist zone (use a province with no tourist zone, e.g., "Cần Thơ" / "Thừa Thiên Huế" / "Huế")
        var hueProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Imperial Riverside",
            Code = "HUE-01",
            Slug = "imperial-riverside",
            Address = "5 Lê Lợi, TP. Huế, Thừa Thiên Huế",
            City = "Huế",
            Status = PropertyStatus.Active
        };

        var handler = new GetPublicPropertiesQueryHandler(
            new GeoFakeDbContext(new[] { daNangProp, haNoiProp, hueProp }, new[] { tenant }),
            LocationService);

        // Find actual Huế province name in LocationService to verify exact province resolution
        var hueProv = LocationService.GetProvinces()
            .First(p => p.Name.Contains("Huế", StringComparison.OrdinalIgnoreCase));

        var results = await handler.Handle(
            new GetPublicPropertiesQuery(DestinationKeyword: hueProv.Name),
            CancellationToken.None);

        var matched = Assert.Single(results);
        Assert.Equal(hueProp.Id, matched.Id);
    }

    [Fact]
    public async Task GetPublicProperties_EmptyZoneWithGps_FallsBackToNearbyActiveProperties()
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Coastal Group",
            Slug = "coastal-group",
            Status = TenantStatus.Active
        };

        var nearbyProp = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Saigon Airport Suites",
            Code = "SGN-01",
            Slug = "saigon-airport-suites",
            Address = "2 Trường Sơn, Tân Bình, TP. Hồ Chí Minh",
            City = "TP. Hồ Chí Minh",
            Latitude = 10.8150,
            Longitude = 106.6600,
            TouristZoneSlug = null, // Not in 'quan-1-tphcm' zone
            Status = PropertyStatus.Active
        };

        var handler = new GetPublicPropertiesQueryHandler(
            new GeoFakeDbContext(new[] { nearbyProp }, new[] { tenant }),
            LocationService);

        var results = await handler.Handle(
            new GetPublicPropertiesQuery(
                TouristZoneSlug: "quan-1-tphcm",
                UserLatitude: 10.8185,
                UserLongitude: 106.6588,
                MaxDistanceMeters: 5000),
            CancellationToken.None);

        var matched = Assert.Single(results);
        Assert.Equal(nearbyProp.Id, matched.Id);
        Assert.True(matched.DistanceMeters <= 5000);
    }
}
