using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.RegisterPartner;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;

namespace HotelSaas.Application.Tests.Auth;

public sealed class RegisterPartnerCommandTests
{
    private static readonly LocationLookupService LocationService = new();

    #region Local Async DbSet Helpers

    private sealed class WritableAsyncDbSet<T> : DbSet<T>, IOrderedQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        public List<T> Items { get; }
        private readonly IQueryable<T> _queryable;
        private readonly WritableAsyncQueryProvider<T> _provider;

        public WritableAsyncDbSet(IEnumerable<T>? seed = null)
        {
            Items = seed != null ? seed.ToList() : new List<T>();
            _queryable = Items.AsQueryable();
            _provider = new WritableAsyncQueryProvider<T>(_queryable);
        }

        public override IEntityType EntityType => throw new NotImplementedException();

        public override EntityEntry<T> Add(T entity)
        {
            Items.Add(entity);
            return null!;
        }

        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _queryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;
        IEnumerator<T> IEnumerable<T>.GetEnumerator() => Items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => Items.GetEnumerator();
        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new SyncAsyncEnumerator<T>(Items.GetEnumerator());
    }

    private sealed class WritableAsyncQueryProvider<TEntity> : IAsyncQueryProvider
    {
        private readonly IQueryable _root;

        public WritableAsyncQueryProvider(IQueryable root) => _root = root;

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().FirstOrDefault() ?? typeof(TEntity);
            var queryableType = typeof(WritableAsyncQueryable<>).MakeGenericType(elementType);
            return (IQueryable)Activator.CreateInstance(queryableType, expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression) =>
            new WritableAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression) =>
            _root.Provider.Execute(StripVisitor.Rewrite(expression, _root));

        public TResult Execute<TResult>(Expression expression) =>
            _root.Provider.Execute<TResult>(StripVisitor.Rewrite(expression, _root));

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var rewritten = StripVisitor.Rewrite(expression, _root);
            var resultType = typeof(TResult);
            if (resultType.IsGenericType && resultType.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var innerType = resultType.GetGenericArguments()[0];
                var compiled = typeof(IQueryProvider).GetMethods()
                    .First(m => m.Name == nameof(IQueryProvider.Execute) && m.IsGenericMethod)
                    .MakeGenericMethod(innerType)
                    .Invoke(_root.Provider, new object[] { rewritten });

                return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(innerType)
                    .Invoke(null, new[] { compiled })!;
            }
            return _root.Provider.Execute<TResult>(rewritten);
        }
    }

    private sealed class WritableAsyncQueryable<T> : EnumerableQuery<T>, IOrderedQueryable<T>, IAsyncEnumerable<T>
    {
        private readonly IQueryProvider _provider;

        public WritableAsyncQueryable(Expression expression, IQueryProvider provider) : base(expression) =>
            _provider = provider;

        IQueryProvider IQueryable.Provider => _provider;

        public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            var result = _provider.Execute<IEnumerable<T>>(((IQueryable)this).Expression);
            return new SyncAsyncEnumerator<T>(result.GetEnumerator());
        }
    }

    private sealed class StripVisitor : ExpressionVisitor
    {
        private readonly IQueryable _root;

        private StripVisitor(IQueryable root) => _root = root;

        public static Expression Rewrite(Expression expr, IQueryable root) => new StripVisitor(root).Visit(expr);

        protected override Expression VisitMethodCall(MethodCallExpression node) =>
            node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking"
                ? Visit(node.Arguments[0])
                : base.VisitMethodCall(node);

        protected override Expression VisitConstant(ConstantExpression node)
        {
            if (node.Value != null && node.Value.GetType().IsGenericType)
            {
                var def = node.Value.GetType().GetGenericTypeDefinition();
                if (def == typeof(WritableAsyncDbSet<>) || def == typeof(WritableAsyncQueryable<>))
                {
                    return _root.Expression;
                }
            }
            return base.VisitConstant(node);
        }
    }

    private sealed class SyncAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public SyncAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
    }

    private sealed class PartnerDbContextStub : IApplicationDbContext
    {
        public WritableAsyncDbSet<User> UsersSet { get; } = new();
        public WritableAsyncDbSet<Tenant> TenantsSet { get; } = new();
        public WritableAsyncDbSet<Property> PropertiesSet { get; } = new();
        public WritableAsyncDbSet<AccessRole> AccessRolesSet { get; }
        public WritableAsyncDbSet<TenantStaff> TenantStaffSet { get; } = new();
        public WritableAsyncDbSet<Subscription> SubscriptionsSet { get; } = new();
        public WritableAsyncDbSet<RoomType>? RoomTypesSet { get; }
        public WritableAsyncDbSet<Room>? RoomsSet { get; }
        public WritableAsyncDbSet<RoomTypeRate>? RoomTypeRatesSet { get; }
        public int SaveCalls { get; private set; }

        public PartnerDbContextStub(bool includeInventoryDbSets = true)
        {
            AccessRolesSet = new WritableAsyncDbSet<AccessRole>(new[]
            {
                new AccessRole
                {
                    Id = Guid.NewGuid(),
                    Code = "OWNER",
                    Name = "Chủ cơ sở",
                    IsSystemRole = true
                }
            });

            if (includeInventoryDbSets)
            {
                RoomTypesSet = new WritableAsyncDbSet<RoomType>();
                RoomsSet = new WritableAsyncDbSet<Room>();
                RoomTypeRatesSet = new WritableAsyncDbSet<RoomTypeRate>();
            }
        }

        public DbSet<User> Users => UsersSet;
        public DbSet<Tenant> Tenants => TenantsSet;
        public DbSet<Property> Properties => PropertiesSet;
        public DbSet<AccessRole> AccessRoles => AccessRolesSet;
        public DbSet<TenantStaff> TenantStaffMembers => TenantStaffSet;
        public DbSet<Subscription> Subscriptions => SubscriptionsSet;
        public DbSet<RoomType> RoomTypes => RoomTypesSet!;
        public DbSet<Room> Rooms => RoomsSet!;
        public DbSet<RoomTypeRate> RoomTypeRates => RoomTypeRatesSet!;

        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<Reservation> Reservations => throw new NotImplementedException();
        public DbSet<Payment> Payments => throw new NotImplementedException();
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
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCalls++;
            return Task.FromResult(1);
        }
    }

    private sealed class FakePasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"HASH({password})";
        public bool Verify(string password, string hash) => hash == $"HASH({password})";
    }

    private sealed class FakeUserContext : ICurrentUserContext
    {
        public Guid UserId => Guid.Empty;
        public string Email => string.Empty;
        public GlobalUserRole GlobalRole => GlobalUserRole.Customer;
        public Guid? TenantId => null;
        public TenantStatus? TenantStatus => null;
        public Guid? PropertyId => null;
        public PropertyStatus? PropertyStatus => null;
        public StaffRole? StaffRole => null;
        public Guid? RoleId => null;
        public bool IsTenantWide => false;
        public bool IsAuthenticated => false;
        public IReadOnlyList<Guid> ExcludedPropertyIds => Array.Empty<Guid>();
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide) { }
    }

    private sealed class FakeTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class FakePropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    #endregion

    private static RegisterPartnerCommandHandler CreateHandler(PartnerDbContextStub context) =>
        new(
            context,
            new FakePasswordHasher(),
            LocationService,
            new FakeUserContext(),
            new FakeTenantService(),
            new FakePropertyService());

    [Fact]
    public void Validator_BackwardCompatible8ArgsAndValidOptionalBounds_PassAndRejectInvalidInputs()
    {
        var validator = new RegisterPartnerCommandValidator();

        var legacy8Arg = new RegisterPartnerCommand(
            "Nguyễn Văn A",
            "partner@example.com",
            "Secret123!",
            "0901234567",
            "Khách Sạn Bình Minh",
            "12 Lý Thường Kiệt",
            LocationService.GetProvinces().First().Code,
            null);

        Assert.True(validator.Validate(legacy8Arg).IsValid);

        var invalidPropertyTypeZero = legacy8Arg with { PropertyType = 0 };
        Assert.False(validator.Validate(invalidPropertyTypeZero).IsValid);

        var invalidStar = legacy8Arg with { StarRating = 6 };
        Assert.False(validator.Validate(invalidStar).IsValid);

        var invalidPrice = legacy8Arg with { DefaultNightlyPrice = 0m };
        Assert.False(validator.Validate(invalidPrice).IsValid);

        var invalidLat = legacy8Arg with { Latitude = 95.0 };
        Assert.False(validator.Validate(invalidLat).IsValid);

        var validExtended = legacy8Arg with
        {
            BrandName = "Việt Homestay Group",
            PropertyType = (int)PropertyType.Homestay,
            StarRating = 4,
            Latitude = 21.0285,
            Longitude = 105.8542,
            DefaultNightlyPrice = 650000m,
            DefaultHourlyPrice = 180000m
        };
        Assert.True(validator.Validate(validExtended).IsValid);
    }

    [Fact]
    public async Task Handle_ExtendedPartnerOnboarding_SeedsBrandPropertyStarterRoomsAndReturnsSlugs()
    {
        var ctx = new PartnerDbContextStub(includeInventoryDbSets: true);
        var handler = CreateHandler(ctx);
        var haNoiCode = LocationService.GetProvinces()
            .First(p => p.Name.Contains("Hà Nội", StringComparison.OrdinalIgnoreCase)).Code;

        var cmd = new RegisterPartnerCommand(
            FullName: "Trần Minh Anh",
            Email: "minhanh@viethomestay.vn",
            Password: "Password@123",
            PhoneNumber: "0912345678",
            PropertyName: "Lá Xanh Riverside Homestay",
            Address: "25 Hàng Bè",
            ProvinceCode: haNoiCode,
            WardCode: null,
            BrandName: "Lá Xanh Hospitality",
            PropertyType: (int)PropertyType.Homestay,
            StarRating: 4,
            Latitude: 21.0338,
            Longitude: 105.8532,
            AllowHourlyBooking: true,
            AllowOvernightBooking: true,
            AllowDailyBooking: false,
            DefaultNightlyPrice: 750000m,
            DefaultHourlyPrice: 220000m);

        var response = await handler.Handle(cmd, CancellationToken.None);

        Assert.Equal("Lá Xanh Riverside Homestay", response.PropertyName);
        Assert.Equal("la-xanh-hospitality", response.TenantSlug);
        Assert.Equal("la-xanh-riverside-homestay", response.PropertySlug);
        Assert.Equal(1, ctx.SaveCalls);

        var tenant = Assert.Single(ctx.TenantsSet.Items);
        Assert.Equal("Lá Xanh Hospitality", tenant.Name);
        Assert.Equal("la-xanh-hospitality", tenant.Slug);
        Assert.Equal(PropertyType.Homestay, tenant.PropertyType);
        Assert.Equal(4, tenant.StarRating);

        var property = Assert.Single(ctx.PropertiesSet.Items);
        Assert.Equal("Lá Xanh Riverside Homestay", property.Name);
        Assert.Equal("la-xanh-riverside-homestay", property.Slug);
        Assert.Equal(PropertyType.Homestay, property.PropertyType);
        Assert.Equal(4, property.StarRating);
        Assert.Equal(21.0338, property.Latitude);
        Assert.Equal(105.8532, property.Longitude);
        Assert.True(property.AllowHourlyBooking);
        Assert.True(property.AllowOvernightBooking);
        Assert.False(property.AllowDailyBooking);
        Assert.True(property.IsPublished);
        Assert.Equal(PropertyStatus.Active, property.Status);

        var roomType = Assert.Single(ctx.RoomTypesSet!.Items);
        Assert.Equal("STD", roomType.Code);
        Assert.Equal("Phòng Tiêu Chuẩn", roomType.Name);
        Assert.Equal(750000m, roomType.BasePrice);
        Assert.Equal(2, roomType.MaxOccupancy);
        Assert.Equal("Queen", roomType.BedType);
        Assert.Equal(24m, roomType.SquareMeters);

        Assert.Equal(3, ctx.RoomsSet!.Items.Count);
        Assert.Equal(new[] { "101", "102", "103" }, ctx.RoomsSet.Items.Select(r => r.RoomNumber).ToArray());
        Assert.All(ctx.RoomsSet.Items, r =>
        {
            Assert.Equal(RoomStatus.Clean, r.Status);
            Assert.True(r.IsActive);
            Assert.Equal(1, r.Floor);
        });

        var rate = Assert.Single(ctx.RoomTypeRatesSet!.Items);
        Assert.Equal(2, rate.FirstHours);
        Assert.Equal(220000m, rate.FirstHoursPrice);
        Assert.Equal(77000m, rate.AdditionalHourPrice);
        Assert.Equal(750000m, rate.NightlyPrice);
        Assert.Equal("VND", rate.Currency);
        Assert.Equal(response.UserId, rate.CreatedByUserId);
        Assert.Equal("Khởi tạo bảng giá đối tác mới", rate.ChangeReason);
        Assert.True(rate.IsActive);
    }

    [Fact]
    public async Task Handle_Legacy8ArgCommandWithNullInventoryDbSets_UsesSafeDefaultsAndSucceeds()
    {
        var ctx = new PartnerDbContextStub(includeInventoryDbSets: false);
        var handler = CreateHandler(ctx);
        var provinceCode = LocationService.GetProvinces().First().Code;

        var legacyCmd = new RegisterPartnerCommand(
            "Lê Hoàng B",
            "hoangb@hotel.vn",
            "Secret@123",
            "0988777666",
            "Khách Sạn Ánh Dương",
            "99 Trần Phú",
            provinceCode,
            null);

        var response = await handler.Handle(legacyCmd, CancellationToken.None);

        Assert.Equal("khach-san-anh-duong", response.TenantSlug);
        Assert.Equal("khach-san-anh-duong", response.PropertySlug);
        var property = Assert.Single(ctx.PropertiesSet.Items);
        Assert.Equal(PropertyType.Hotel, property.PropertyType);
        Assert.Equal(3, property.StarRating);
        Assert.True(property.IsPublished);
    }

    [Fact]
    public async Task Handle_AddressFormatting_DoesNotDuplicatePreFormattedMapPickerAddress_AndAppendsForBareStreet()
    {
        var daNangProvince = LocationService.GetProvinces()
            .First(p => p.Name.Contains("Đà Nẵng", StringComparison.OrdinalIgnoreCase));
        var haiChauWard = LocationService.GetWardsByProvince(daNangProvince.Code)
            .First(w => w.Name.Contains("Hải Châu", StringComparison.OrdinalIgnoreCase));

        // 1. Pre-formatted Map Picker address already containing ward & province (case-insensitive)
        var ctxPreformatted = new PartnerDbContextStub(includeInventoryDbSets: true);
        var handlerPreformatted = CreateHandler(ctxPreformatted);
        var preformattedAddress = $"  88 Bạch Đằng, {haiChauWard.Name}, {daNangProvince.Name}  ";

        await handlerPreformatted.Handle(new RegisterPartnerCommand(
            FullName: "Nguyễn Map Picker",
            Email: "mappicker@hotel.vn",
            Password: "Password@123",
            PhoneNumber: "0901112233",
            PropertyName: "Đà Nẵng River Hotel",
            Address: preformattedAddress,
            ProvinceCode: daNangProvince.Code,
            WardCode: haiChauWard.Code), CancellationToken.None);

        var expectedPreformatted = $"88 Bạch Đằng, {haiChauWard.Name}, {daNangProvince.Name}";
        Assert.Equal(expectedPreformatted, Assert.Single(ctxPreformatted.TenantsSet.Items).Address);
        Assert.Equal(expectedPreformatted, Assert.Single(ctxPreformatted.PropertiesSet.Items).Address);

        // 2. Case-insensitive check when pre-formatted address uses lowercase ward/province
        var ctxCase = new PartnerDbContextStub(includeInventoryDbSets: true);
        var handlerCase = CreateHandler(ctxCase);
        var lowerCaseAddress = $"88 Bạch Đằng, {haiChauWard.Name.ToLowerInvariant()}, {daNangProvince.Name.ToLowerInvariant()}";

        await handlerCase.Handle(new RegisterPartnerCommand(
            FullName: "Nguyễn Case Test",
            Email: "casetest@hotel.vn",
            Password: "Password@123",
            PhoneNumber: "0901112244",
            PropertyName: "Đà Nẵng Case Hotel",
            Address: lowerCaseAddress,
            ProvinceCode: daNangProvince.Code,
            WardCode: haiChauWard.Code), CancellationToken.None);

        Assert.Equal(lowerCaseAddress, Assert.Single(ctxCase.PropertiesSet.Items).Address);

        // 3. Bare street address still appends ward and province cleanly
        var ctxBare = new PartnerDbContextStub(includeInventoryDbSets: true);
        var handlerBare = CreateHandler(ctxBare);

        await handlerBare.Handle(new RegisterPartnerCommand(
            FullName: "Lê Bare Street",
            Email: "barestreet@hotel.vn",
            Password: "Password@123",
            PhoneNumber: "0901112255",
            PropertyName: "Hàng Bè Boutique",
            Address: "25 Hàng Bè",
            ProvinceCode: daNangProvince.Code,
            WardCode: haiChauWard.Code), CancellationToken.None);

        var expectedBare = $"25 Hàng Bè, {haiChauWard.Name}, {daNangProvince.Name}";
        Assert.Equal(expectedBare, Assert.Single(ctxBare.TenantsSet.Items).Address);
        Assert.Equal(expectedBare, Assert.Single(ctxBare.PropertiesSet.Items).Address);
    }
}
