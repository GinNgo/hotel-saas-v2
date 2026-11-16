using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Tests.Public;

public sealed class PublicMarketplaceDiscoveryTests
{
    private static readonly LocationLookupService LocationService = new();

    private sealed class MarketplaceFakeDbContext : IApplicationDbContext
    {
        public MarketplaceFakeDbContext(
            IEnumerable<Property> properties,
            IEnumerable<Tenant>? tenants = null,
            IEnumerable<RoomTypeRate>? rates = null,
            IEnumerable<GuestReview>? reviews = null)
        {
            Properties = new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Property>(properties);
            Tenants = tenants != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Tenant>(tenants)
                : null!;
            RoomTypeRates = rates != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<RoomTypeRate>(rates)
                : new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<RoomTypeRate>(Array.Empty<RoomTypeRate>());
            GuestReviews = reviews != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<GuestReview>(reviews)
                : null!;
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

        public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    private sealed class RecordingSender : ISender
    {
        public object? LastRequest { get; private set; }

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;
            object result = Array.Empty<PublicPropertyDto>();
            return Task.FromResult((TResponse)result);
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            LastRequest = request;
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;
            return Task.FromResult<object?>(null);
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    [Fact]
    public async Task Handle_PopulatesTenantMetadataReviewsGalleryAndFiltersByTenantAndProvince()
    {
        var activeTenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Việt Homestay & Boutique Stays",
            Slug = "viet-homestay-boutique",
            Status = TenantStatus.Active
        };
        var inactiveTenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Suspended Brand",
            Slug = "suspended-brand",
            Status = TenantStatus.Suspended
        };

        var haNoiHomestayId = Guid.NewGuid();
        var daLatVillaId = Guid.NewGuid();

        var properties = new[]
        {
            new Property
            {
                Id = haNoiHomestayId,
                TenantId = activeTenant.Id,
                Name = "Lá Đỏ Phố Cổ Homestay",
                Code = "HN-HS",
                Slug = "la-do-pho-co-homestay",
                Address = "38 Hàng Bạc, Phường Hàng Bạc, Quận Hoàn Kiếm, Hà Nội",
                City = "Hà Nội",
                PropertyType = PropertyType.Homestay,
                StarRating = 4,
                TouristZoneSlug = "ha-noi-pho-co",
                TouristZoneName = "Hà Nội - Phố Cổ",
                Status = PropertyStatus.Active,
                IsPublished = true
            },
            new Property
            {
                Id = daLatVillaId,
                TenantId = activeTenant.Id,
                Name = "Highland Pine Villas Đà Lạt",
                Code = "DL-VL",
                Slug = "highland-pine-villas-da-lat",
                Address = "12 Trần Hưng Đạo, Phường 10, TP. Đà Lạt, Lâm Đồng",
                City = "Đà Lạt",
                PropertyType = PropertyType.Villa,
                StarRating = 5,
                TouristZoneSlug = "da-lat",
                TouristZoneName = "Đà Lạt",
                Status = PropertyStatus.Active,
                IsPublished = true
            },
            new Property
            {
                Id = Guid.NewGuid(),
                TenantId = inactiveTenant.Id,
                Name = "Suspended Property",
                Code = "SUSP",
                Slug = "suspended-property",
                Address = "1 Đường Láng, Phường Láng Hạ, Hà Nội",
                City = "Hà Nội",
                PropertyType = PropertyType.Hotel,
                StarRating = 3,
                Status = PropertyStatus.Active,
                IsPublished = true
            }
        };

        var reviews = new[]
        {
            new GuestReview
            {
                Id = Guid.NewGuid(),
                OverallRating = 5,
                IsPublished = true,
                Reservation = new Reservation { PropertyId = haNoiHomestayId }
            },
            new GuestReview
            {
                Id = Guid.NewGuid(),
                OverallRating = 4,
                IsPublished = true,
                Reservation = new Reservation { PropertyId = haNoiHomestayId }
            },
            new GuestReview
            {
                Id = Guid.NewGuid(),
                OverallRating = 1,
                IsPublished = false,
                Reservation = new Reservation { PropertyId = haNoiHomestayId }
            }
        };

        var rates = new[]
        {
            new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                PropertyId = haNoiHomestayId,
                FirstHoursPrice = 220000m,
                NightlyPrice = 680000m,
                IsActive = true
            }
        };

        var handler = new GetPublicPropertiesQueryHandler(
            new MarketplaceFakeDbContext(properties, new[] { activeTenant, inactiveTenant }, rates, reviews),
            LocationService);

        var haNoiCode = LocationService.GetProvinces()
            .First(p => p.Name.Contains("Hà Nội", StringComparison.OrdinalIgnoreCase)).Code;

        var filtered = await handler.Handle(
            new GetPublicPropertiesQuery(TenantSlug: "viet-homestay-boutique", ProvinceCode: haNoiCode),
            CancellationToken.None);

        var single = Assert.Single(filtered);
        Assert.Equal(haNoiHomestayId, single.Id);
        Assert.Equal(activeTenant.Id, single.TenantId);
        Assert.Equal("Việt Homestay & Boutique Stays", single.TenantBrandName);
        Assert.Equal("viet-homestay-boutique", single.TenantSlug);
        Assert.Equal(haNoiCode, single.ProvinceCode);
        Assert.Equal("Hà Nội", single.ProvinceName);
        Assert.Equal("Phường Hàng Bạc", single.WardName);
        Assert.Equal(4.5, single.RatingAverage);
        Assert.Equal(2, single.ReviewCount);
        Assert.Null(single.ImageUrl);
        Assert.False(string.IsNullOrWhiteSpace(single.ThumbnailUrl));
        Assert.Equal(3, single.GalleryUrls.Count);
        Assert.Equal(220000m, single.HourlyStartingPrice);
        Assert.Equal(680000m, single.NightlyPriceOrStarting());

        // Suspended tenant must never match TenantSlug filter
        var suspendedResult = await handler.Handle(
            new GetPublicPropertiesQuery(TenantSlug: "suspended-brand"),
            CancellationToken.None);
        Assert.Empty(suspendedResult);

        // Zero-review 5-star property receives deterministic 4.9 rating fallback and 0 reviewCount
        var villaOnly = await handler.Handle(
            new GetPublicPropertiesQuery(PropertyTypes: new[] { PropertyType.Villa }),
            CancellationToken.None);
        var villa = Assert.Single(villaOnly);
        Assert.Equal(4.9, villa.RatingAverage);
        Assert.Equal(0, villa.ReviewCount);
        Assert.False(string.IsNullOrWhiteSpace(villa.ProvinceCode));
    }

    [Fact]
    public async Task GetPublicPropertyBySlug_PopulatesFullMarketplaceDtoAndHandlesNullOptionalDbSets()
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Urban Express Aparthotel & Motel",
            Slug = "urban-express-stays",
            Status = TenantStatus.Active
        };
        var propertyId = Guid.NewGuid();
        var property = new Property
        {
            Id = propertyId,
            TenantId = tenant.Id,
            Name = "Urban Express Suites Quận 1",
            Code = "UEM-Q1",
            Slug = "urban-express-suites-quan-1",
            Address = "78 Tôn Thất Đạm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
            City = "TP. Hồ Chí Minh",
            PropertyType = PropertyType.Apartment,
            StarRating = 4,
            Latitude = 10.7721,
            Longitude = 106.7024,
            TouristZoneSlug = "quan-1-tphcm",
            TouristZoneName = "Trung Tâm Quận 1",
            AllowHourlyBooking = true,
            AllowOvernightBooking = true,
            AllowDailyBooking = false,
            Status = PropertyStatus.Active,
            IsPublished = true
        };
        var rate = new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            PropertyId = propertyId,
            FirstHoursPrice = 320000m,
            NightlyPrice = 1150000m,
            IsActive = true
        };

        var handler = new GetPublicPropertyBySlugQueryHandler(
            new MarketplaceFakeDbContext(new[] { property }, new[] { tenant }, new[] { rate }),
            LocationService);

        var dto = await handler.Handle(new GetPublicPropertyBySlugQuery("urban-express-suites-quan-1"), CancellationToken.None);

        Assert.Equal(tenant.Id, dto.TenantId);
        Assert.Equal("Urban Express Aparthotel & Motel", dto.TenantBrandName);
        Assert.Equal("urban-express-stays", dto.TenantSlug);
        Assert.Equal(PropertyType.Apartment, dto.PropertyType);
        Assert.Equal("Căn hộ dịch vụ", dto.PropertyTypeName);
        Assert.Equal(4, dto.StarRating);
        Assert.Equal(4.7, dto.RatingAverage);
        Assert.Equal(0, dto.ReviewCount);
        Assert.Equal("Phường Bến Nghé", dto.WardName);
        Assert.False(string.IsNullOrWhiteSpace(dto.ProvinceCode));
        Assert.Equal(320000m, dto.HourlyStartingPrice);
        Assert.Equal(1150000m, dto.OvernightStartingPrice);
        Assert.Equal(1150000m, dto.StartingPrice);
        Assert.True(dto.AllowHourlyBooking);
        Assert.False(dto.AllowDailyBooking);
        Assert.Null(dto.ImageUrl);
        Assert.False(string.IsNullOrWhiteSpace(dto.ThumbnailUrl));
        Assert.Equal(3, dto.GalleryUrls.Count);
        Assert.NotEmpty(dto.NearbyLandmarks);

        // 1-arg constructor must still succeed when Tenants/GuestReviews are null
        var minimalHandler = new GetPublicPropertyBySlugQueryHandler(
            new MarketplaceFakeDbContext(new[] { property }, tenants: null, rates: new[] { rate }, reviews: null));
        var minimalDto = await minimalHandler.Handle(new GetPublicPropertyBySlugQuery("urban-express-suites-quan-1"), CancellationToken.None);
        Assert.Equal(property.Name, minimalDto.TenantBrandName);
        Assert.Equal(property.Slug, minimalDto.TenantSlug);
    }

    [Fact]
    public async Task PublicController_GetProperties_FiltersInvalidEnumZeroAndForwardsTenantAndProvinceParams()
    {
        var sender = new RecordingSender();
        var controller = new PublicController(sender, LocationService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.GetProperties(
            propertyTypes: "Hotel,Homestay,0,999,InvalidType",
            tenantSlug: "viet-homestay-boutique",
            provinceCode: "01",
            cancellationToken: CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        var dispatched = Assert.IsType<GetPublicPropertiesQuery>(sender.LastRequest);
        Assert.Equal("viet-homestay-boutique", dispatched.TenantSlug);
        Assert.Equal("01", dispatched.ProvinceCode);
        Assert.NotNull(dispatched.PropertyTypes);
        Assert.Equal(new[] { PropertyType.Hotel, PropertyType.Homestay }, dispatched.PropertyTypes);
    }

    [Fact]
    public void RealData34ProvincesSeeder_CatalogueContainsAllSixChainsAndAllEightPropertyTypes()
    {
        var catalogue = RealData34ProvincesSeeder.Get34ProvincesCatalogue();

        Assert.True(catalogue.Count >= 43);

        var tenantCodes = catalogue.Select(p => p.TenantCode).ToHashSet(StringComparer.Ordinal);
        Assert.Contains("GHG", tenantCodes);
        Assert.Contains("VEH", tenantCodes);
        Assert.Contains("SCR", tenantCodes);
        Assert.Contains("VHG", tenantCodes);
        Assert.Contains("MBV", tenantCodes);
        Assert.Contains("UEM", tenantCodes);

        foreach (PropertyType type in Enum.GetValues<PropertyType>())
        {
            Assert.Contains(catalogue, p => p.PropertyType == type);
        }

        Assert.Equal(catalogue.Count, catalogue.Select(p => p.Slug).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(catalogue.Count, catalogue.Select(p => p.Code).Distinct(StringComparer.OrdinalIgnoreCase).Count());

        Assert.All(catalogue, item =>
        {
            Assert.NotEmpty(item.RoomTypes);
            Assert.All(item.RoomTypes, rt =>
            {
                Assert.True(rt.NightlyPrice > 0m);
                Assert.True(rt.HourlyFirstHoursPrice > 0m);
                Assert.NotEmpty(rt.RoomNumbers);
            });
        });
    }
}

internal static class PublicPropertyDtoTestExtensions
{
    internal static decimal? NightlyPriceOrStarting(this PublicPropertyDto dto) => dto.OvernightStartingPrice ?? dto.StartingPrice;
}
