using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicBrands;
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
        private readonly DbSet<RoomType>? _roomTypes;
        private readonly DbSet<Room>? _rooms;
        private readonly DbSet<Reservation>? _reservations;

        public MarketplaceFakeDbContext(
            IEnumerable<Property> properties,
            IEnumerable<Tenant>? tenants = null,
            IEnumerable<RoomTypeRate>? rates = null,
            IEnumerable<GuestReview>? reviews = null,
            IEnumerable<RoomType>? roomTypes = null,
            IEnumerable<Room>? rooms = null,
            IEnumerable<Reservation>? reservations = null)
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
            _roomTypes = roomTypes != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<RoomType>(roomTypes)
                : null;
            _rooms = rooms != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Room>(rooms)
                : null;
            _reservations = reservations != null
                ? new GetPublicPropertiesSyntheticTests.TestAsyncDbSet<Reservation>(reservations)
                : null;
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
        public DbSet<RoomType> RoomTypes => _roomTypes ?? throw new NotImplementedException();
        public DbSet<Room> Rooms => _rooms ?? throw new NotImplementedException();
        public DbSet<Reservation> Reservations => _reservations ?? throw new NotImplementedException();
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
        Assert.Equal(string.Empty, single.ThumbnailUrl);
        Assert.Empty(single.GalleryUrls);
        Assert.Equal(220000m, single.HourlyStartingPrice);
        Assert.Equal(680000m, single.NightlyPriceOrStarting());

        // Suspended tenant must never match TenantSlug filter
        var suspendedResult = await handler.Handle(
            new GetPublicPropertiesQuery(TenantSlug: "suspended-brand"),
            CancellationToken.None);
        Assert.Empty(suspendedResult);

        // Zero-review 5-star property receives honest 0.0 rating and 0 reviewCount (never fabricated 4.9)
        var villaOnly = await handler.Handle(
            new GetPublicPropertiesQuery(PropertyTypes: new[] { PropertyType.Villa }),
            CancellationToken.None);
        var villa = Assert.Single(villaOnly);
        Assert.Equal(0.0, villa.RatingAverage);
        Assert.Equal(0, villa.ReviewCount);
        Assert.Equal(string.Empty, villa.ThumbnailUrl);
        Assert.Empty(villa.GalleryUrls);
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
            TaxRatePercent = 8.0m,
            ServiceFeeRatePercent = 5.0m,
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
        var roomTypes = new[]
        {
            new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                Name = "Studio Suite",
                Code = "STD",
                BasePrice = 1150000m,
                MaxOccupancy = 2,
                ImageUrl = "https://cdn.example.vn/rooms/studio-suite.jpg"
            },
            new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                Name = "Penthouse",
                Code = "PTH",
                BasePrice = 2400000m,
                MaxOccupancy = 4,
                ImageUrl = "https://cdn.example.vn/rooms/penthouse.jpg"
            }
        };

        var handler = new GetPublicPropertyBySlugQueryHandler(
            new MarketplaceFakeDbContext(new[] { property }, new[] { tenant }, new[] { rate }, roomTypes: roomTypes),
            LocationService);

        var dto = await handler.Handle(new GetPublicPropertyBySlugQuery("urban-express-suites-quan-1"), CancellationToken.None);

        Assert.Equal(tenant.Id, dto.TenantId);
        Assert.Equal("Urban Express Aparthotel & Motel", dto.TenantBrandName);
        Assert.Equal("urban-express-stays", dto.TenantSlug);
        Assert.Equal(PropertyType.Apartment, dto.PropertyType);
        Assert.Equal("Căn hộ dịch vụ", dto.PropertyTypeName);
        Assert.Equal(4, dto.StarRating);
        Assert.Equal(0.0, dto.RatingAverage);
        Assert.Equal(0, dto.ReviewCount);
        Assert.Equal(8.0m, dto.TaxRatePercent);
        Assert.Equal(5.0m, dto.ServiceFeeRatePercent);
        Assert.Equal("Phường Bến Nghé", dto.WardName);
        Assert.False(string.IsNullOrWhiteSpace(dto.ProvinceCode));
        Assert.Equal(320000m, dto.HourlyStartingPrice);
        Assert.Equal(1150000m, dto.OvernightStartingPrice);
        Assert.Equal(1150000m, dto.StartingPrice);
        Assert.True(dto.AllowHourlyBooking);
        Assert.False(dto.AllowDailyBooking);
        Assert.Null(dto.ImageUrl);
        Assert.Equal("https://cdn.example.vn/rooms/studio-suite.jpg", dto.ThumbnailUrl);
        Assert.Equal(2, dto.GalleryUrls.Count);
        Assert.DoesNotContain(dto.GalleryUrls, u => u.Contains("unsplash.com", StringComparison.OrdinalIgnoreCase));
        Assert.NotEmpty(dto.NearbyLandmarks);

        // 1-arg constructor must still succeed when Tenants/GuestReviews/RoomTypes are null or unimplemented
        var minimalHandler = new GetPublicPropertyBySlugQueryHandler(
            new MarketplaceFakeDbContext(new[] { property }, tenants: null, rates: new[] { rate }, reviews: null));
        var minimalDto = await minimalHandler.Handle(new GetPublicPropertyBySlugQuery("urban-express-suites-quan-1"), CancellationToken.None);
        Assert.Equal(property.Name, minimalDto.TenantBrandName);
        Assert.Equal(property.Slug, minimalDto.TenantSlug);
        Assert.Equal(0.0, minimalDto.RatingAverage);
        Assert.Equal(string.Empty, minimalDto.ThumbnailUrl);
        Assert.Empty(minimalDto.GalleryUrls);
    }

    [Fact]
    public async Task Handle_ServerFiltersAndPagination_FilterByPriceGuestsDatesPublishedAndReturnPagedTotal()
    {
        var tenantId = Guid.NewGuid();
        var tenant = new Tenant { Id = tenantId, Name = "Honest Stays", Slug = "honest-stays", Status = TenantStatus.Active };

        var p1Id = Guid.NewGuid();
        var p2Id = Guid.NewGuid();
        var p3Id = Guid.NewGuid();
        var pDraftId = Guid.NewGuid();

        var properties = new[]
        {
            new Property { Id = p1Id, TenantId = tenantId, Name = "Alpha Budget", Code = "P1", Slug = "alpha", Address = "1 Lê Lợi", City = "Hà Nội", Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = p2Id, TenantId = tenantId, Name = "Beta Family", Code = "P2", Slug = "beta", Address = "2 Lê Lợi", City = "Hà Nội", Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = p3Id, TenantId = tenantId, Name = "Gamma Luxury", Code = "P3", Slug = "gamma", Address = "3 Lê Lợi", City = "Hà Nội", Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = pDraftId, TenantId = tenantId, Name = "Delta Draft", Code = "P4", Slug = "delta", Address = "4 Lê Lợi", City = "Hà Nội", Status = PropertyStatus.Active, IsPublished = false }
        };

        var rt1Id = Guid.NewGuid();
        var rt2Id = Guid.NewGuid();
        var rt3Id = Guid.NewGuid();
        var roomTypes = new[]
        {
            new RoomType { Id = rt1Id, TenantId = tenantId, PropertyId = p1Id, Name = "Single", Code = "S1", BasePrice = 300000m, MaxOccupancy = 1, ImageUrl = "https://cdn.example.vn/p1.jpg" },
            new RoomType { Id = rt2Id, TenantId = tenantId, PropertyId = p2Id, Name = "Family", Code = "F2", BasePrice = 800000m, MaxOccupancy = 4, ImageUrl = "https://cdn.example.vn/p2.jpg" },
            new RoomType { Id = rt3Id, TenantId = tenantId, PropertyId = p3Id, Name = "Suite", Code = "S3", BasePrice = 2500000m, MaxOccupancy = 4 }
        };

        var room1Id = Guid.NewGuid();
        var room2Id = Guid.NewGuid();
        var room3Id = Guid.NewGuid();
        var rooms = new[]
        {
            new Room { Id = room1Id, TenantId = tenantId, PropertyId = p1Id, RoomTypeId = rt1Id, RoomNumber = "101", IsActive = true },
            new Room { Id = room2Id, TenantId = tenantId, PropertyId = p2Id, RoomTypeId = rt2Id, RoomNumber = "201", IsActive = true },
            new Room { Id = room3Id, TenantId = tenantId, PropertyId = p3Id, RoomTypeId = rt3Id, RoomNumber = "301", IsActive = true }
        };

        var reservations = new[]
        {
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = p3Id,
                RoomId = room3Id,
                CheckInDate = new DateOnly(2027, 5, 10),
                CheckOutDate = new DateOnly(2027, 5, 12),
                Status = ReservationStatus.Confirmed
            }
        };

        var rates = new[]
        {
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = p1Id, RoomTypeId = rt1Id, NightlyPrice = 300000m, IsActive = true },
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = p2Id, RoomTypeId = rt2Id, NightlyPrice = 800000m, IsActive = true },
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = p3Id, RoomTypeId = rt3Id, NightlyPrice = 2500000m, IsActive = true },
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = pDraftId, NightlyPrice = 500000m, IsActive = true }
        };

        var handler = new GetPublicPropertiesQueryHandler(
            new MarketplaceFakeDbContext(properties, new[] { tenant }, rates, null, roomTypes, rooms, reservations),
            LocationService);

        // 1. OnlyPublished excludes draft
        var publishedOnly = await handler.Handle(new GetPublicPropertiesQuery(OnlyPublished: true), CancellationToken.None);
        Assert.Equal(3, publishedOnly.Count);
        Assert.DoesNotContain(publishedOnly, p => p.Id == pDraftId);

        // 2. MinPrice / MaxPrice filter
        var midRange = await handler.Handle(
            new GetPublicPropertiesQuery(MinPrice: 400000m, MaxPrice: 1000000m, OnlyPublished: true),
            CancellationToken.None);
        var midSingle = Assert.Single(midRange);
        Assert.Equal(p2Id, midSingle.Id);
        Assert.Equal("https://cdn.example.vn/p2.jpg", midSingle.ThumbnailUrl);

        // 3. Guests + CheckInDate/CheckOutDate excludes p1 (capacity 1 < 3) and p3 (booked 2027-05-10..12)
        var availFor3 = await handler.Handle(
            new GetPublicPropertiesQuery(
                Guests: 3,
                CheckInDate: new DateOnly(2027, 5, 10),
                CheckOutDate: new DateOnly(2027, 5, 12),
                OnlyPublished: true),
            CancellationToken.None);
        var availSingle = Assert.Single(availFor3);
        Assert.Equal(p2Id, availSingle.Id);

        // 4. Server-side pagination preserves TotalCount
        var page2 = await handler.Handle(
            new GetPublicPropertiesQuery(Page: 2, PageSize: 2, OnlyPublished: true, SortBy: "price_asc"),
            CancellationToken.None);
        var pagedList = Assert.IsType<PagedPropertyList>(page2);
        Assert.Equal(3, pagedList.TotalCount);
        var lastItem = Assert.Single(pagedList);
        Assert.Equal(p3Id, lastItem.Id);
    }

    [Fact]
    public async Task GetPublicBrandsQuery_AggregatesActiveBrandsWithHonestRatingsAndZeroStockMedia()
    {
        var activeBrand = new Tenant { Id = Guid.NewGuid(), Name = "Grand Hotel Group", Slug = "grand-hotel-group", Status = TenantStatus.Active };
        var emptyBrand = new Tenant { Id = Guid.NewGuid(), Name = "No Branches Brand", Slug = "no-branches", Status = TenantStatus.Active };
        var suspendedBrand = new Tenant { Id = Guid.NewGuid(), Name = "Suspended Brand", Slug = "suspended", Status = TenantStatus.Suspended };

        var p1Id = Guid.NewGuid();
        var p2Id = Guid.NewGuid();
        var properties = new[]
        {
            new Property { Id = p1Id, TenantId = activeBrand.Id, Name = "Grand Hà Nội", Code = "GH1", Slug = "grand-hn", Address = "15 Ngô Quyền", City = "Hà Nội", PropertyType = PropertyType.Hotel, Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = p2Id, TenantId = activeBrand.Id, Name = "Grand Đà Nẵng", Code = "GH2", Slug = "grand-dn", Address = "200 Võ Nguyên Giáp", City = "Đà Nẵng", PropertyType = PropertyType.Resort, Status = PropertyStatus.Active, IsPublished = true },
            new Property { Id = Guid.NewGuid(), TenantId = suspendedBrand.Id, Name = "Suspended Hotel", Code = "SH1", Slug = "susp-1", Address = "1 ABC", City = "Hà Nội", PropertyType = PropertyType.Hotel, Status = PropertyStatus.Active, IsPublished = true }
        };
        var rates = new[]
        {
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = p1Id, NightlyPrice = 1200000m, IsActive = true },
            new RoomTypeRate { Id = Guid.NewGuid(), PropertyId = p2Id, NightlyPrice = 950000m, IsActive = true }
        };
        var reviews = new[]
        {
            new GuestReview { Id = Guid.NewGuid(), OverallRating = 5, IsPublished = true, Reservation = new Reservation { PropertyId = p1Id } },
            new GuestReview { Id = Guid.NewGuid(), OverallRating = 4, IsPublished = true, Reservation = new Reservation { PropertyId = p1Id } }
        };

        var ctx = new MarketplaceFakeDbContext(properties, new[] { activeBrand, emptyBrand, suspendedBrand }, rates, reviews);
        var handler = new GetPublicBrandsQueryHandler(ctx, LocationService);
        var brands = await handler.Handle(new GetPublicBrandsQuery(), CancellationToken.None);

        var brand = Assert.Single(brands);
        Assert.Equal(activeBrand.Id, brand.TenantId);
        Assert.Equal("grand-hotel-group", brand.Slug);
        Assert.Equal(2, brand.TotalProperties);
        Assert.Equal(4.5, brand.RatingAverage);
        Assert.Equal(2, brand.ReviewCount);
        Assert.Equal(950000m, brand.StartingPrice);
        Assert.Null(brand.LogoUrl);
        Assert.Contains("Hà Nội", brand.Provinces);
        Assert.Contains("Đà Nẵng", brand.Provinces);
        Assert.Contains(PropertyType.Hotel, brand.PropertyTypes);
        Assert.Contains(PropertyType.Resort, brand.PropertyTypes);
    }

    [Fact]
    public async Task PublicController_GetPropertiesAndGetBrands_ForwardQueryParamsAndSetTotalHeader()
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
            minPrice: 200000m,
            maxPrice: 1500000m,
            guests: 2,
            page: 2,
            pageSize: 10,
            onlyPublished: true,
            sortBy: "price_asc",
            cancellationToken: CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(controller.Response.Headers.ContainsKey("X-Total-Count"));
        var dispatched = Assert.IsType<GetPublicPropertiesQuery>(sender.LastRequest);
        Assert.Equal("viet-homestay-boutique", dispatched.TenantSlug);
        Assert.Equal("01", dispatched.ProvinceCode);
        Assert.Equal(200000m, dispatched.MinPrice);
        Assert.Equal(1500000m, dispatched.MaxPrice);
        Assert.Equal(2, dispatched.Guests);
        Assert.Equal(2, dispatched.Page);
        Assert.Equal(10, dispatched.PageSize);
        Assert.True(dispatched.OnlyPublished);
        Assert.Equal("price_asc", dispatched.SortBy);
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
