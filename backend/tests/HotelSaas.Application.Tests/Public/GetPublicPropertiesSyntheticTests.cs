using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

public sealed class GetPublicPropertiesSyntheticTests
{
    private static readonly Guid P1 = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid P2 = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid P2_TIE = Guid.Parse("88888888-8888-8888-8888-888888888888");
    private static readonly Guid P3 = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid P4 = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid P5 = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid P6 = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly Guid P7 = Guid.Parse("77777777-7777-7777-7777-777777777777");

    internal static readonly Property[] CatalogWithInactive = new[]
    {
        new Property
        {
            Id = P1,
            Name = "Khách Sạn Biển Đông Đà Nẵng",
            Code = "P01",
            Slug = "khach-san-bien-dong-da-nang",
            Address = "200 Võ Nguyên Giáp, Quận Sơn Trà",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P2,
            Name = "Khách Sạn Central Đà Nẵng",
            Code = "P02",
            Slug = "khach-san-central-da-nang",
            Address = "50 Nguyễn Văn Linh, Quận Hải Châu",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P3,
            Name = "Khách Sạn Sài Gòn Central",
            Code = "P03",
            Slug = "khach-san-sai-gon-central",
            Address = "123 Lê Lợi, Phường Bến Thành, Quận 1",
            City = "TP. Hồ Chí Minh",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P4,
            Name = "Khách Sạn Hà Nội Horizon",
            Code = "P04",
            Slug = "khach-san-ha-noi-horizon",
            Address = "40 Cát Linh, Quận Đống Đa",
            City = "Hà Nội",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P5,
            Name = "Khách Sạn Hạ Long Bay",
            Code = "P05",
            Slug = "khach-san-ha-long-bay",
            Address = "88 Hạ Long, Bãi Cháy",
            City = "Quảng Ninh",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P6,
            Name = "Khách Sạn Phú Quốc Sunset Resort",
            Code = "P06",
            Slug = "khach-san-phu-quoc-sunset-resort",
            Address = "Bãi Trường, Dương Tơ",
            City = "Kiên Giang",
            Status = PropertyStatus.Inactive,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P7,
            Name = "Khách Sạn Nha Trang Pearl",
            Code = "P07",
            Slug = "khach-san-nha-trang-pearl",
            Address = "12 Trần Phú, Phường Lộc Thọ",
            City = "Nha Trang",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        },
        new Property
        {
            Id = P2_TIE,
            Name = "Khách Sạn Central Đà Nẵng",
            Code = "P02B",
            Slug = "khach-san-central-da-nang-tie",
            Address = "100 Bạch Đằng, Quận Hải Châu",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        }
    };

    private static GetPublicPropertiesQueryHandler CreateHandler(IEnumerable<Property>? properties = null)
    {
        var context = new TestApplicationDbContext(properties ?? CatalogWithInactive);
        return new GetPublicPropertiesQueryHandler(context);
    }

    [Fact]
    public async Task Handle_ActiveGuard_ExcludesInactivePropertiesEvenWhenExactMatch()
    {
        var handler = CreateHandler();
        var result = await handler.Handle(new GetPublicPropertiesQuery("Khách Sạn Phú Quốc Sunset Resort"), CancellationToken.None);

        Assert.Empty(result);
        Assert.DoesNotContain(result, p => p.Id == P6);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\u0301")]
    public async Task Handle_BlankOrNormalizedEmpty_ReturnsAll7ActivePropertiesInNameAscIdAsc(string? query)
    {
        var handler = CreateHandler();
        var result = await handler.Handle(new GetPublicPropertiesQuery(query), CancellationToken.None);

        Assert.Equal(7, result.Count);
        Assert.DoesNotContain(result, p => p.Id == P6);

        var actualOrder = result.Select(p => p.Id).ToArray();
        var sortedExpected = CatalogWithInactive
            .Where(p => p.Status == PropertyStatus.Active)
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(p => p.Id)
            .Select(p => p.Id)
            .ToArray();

        Assert.Equal(sortedExpected, actualOrder);
    }

    [Fact]
    public async Task Handle_NoMatchSearch_ReturnsEmptyList()
    {
        var handler = CreateHandler();
        var result = await handler.Handle(new GetPublicPropertiesQuery("Khách sạn Không Tồn Tại 12345"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Theory]
    [InlineData("Khách Sạn Sài Gòn Central", new[] { "33333333-3333-3333-3333-333333333333" })]
    [InlineData("Khách Sạn Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" })]
    [InlineData("Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" })]
    [InlineData("Central Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" })]
    [InlineData("central central", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" })]
    [InlineData("danang", new[] { "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" })]
    [InlineData("da nag", new[] { "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" })]
    [InlineData("centraal", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" })]
    [InlineData("Haoni", new[] { "44444444-4444-4444-4444-444444444444" })]
    [InlineData("centxralz", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" })]
    [InlineData("nhxtrangg", new[] { "77777777-7777-7777-7777-777777777777" })]
    [InlineData(", -", new string[0])]
    [InlineData("Danang xyz", new string[0])]
    [InlineData("Central Đà Nẵng", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" })]
    public async Task Handle_ApprovedFixtures_MatchesExactIdOrderAndDtoShape(
        string query, string[] expectedIds)
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery(query), CancellationToken.None);

        Assert.Equal(expectedIds.Length, results.Count);

        for (int i = 0; i < expectedIds.Length; i++)
        {
            var expectedGuid = Guid.Parse(expectedIds[i]);
            var dto = results[i];

            Assert.Equal(expectedGuid, dto.Id);
            Assert.False(string.IsNullOrWhiteSpace(dto.Name));
            Assert.False(string.IsNullOrWhiteSpace(dto.Code));
            Assert.False(string.IsNullOrWhiteSpace(dto.Slug));
            Assert.False(string.IsNullOrWhiteSpace(dto.Address));
            Assert.False(string.IsNullOrWhiteSpace(dto.City));
            Assert.Equal(30, dto.BufferMinutes);
            Assert.Equal(12, dto.MaxHourlyHours);
            Assert.Null(dto.ImageUrl);
        }
    }

    [Fact]
    public async Task Handle_ShortSubstringHa_MatchesCatalogOrder()
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery("Ha"), CancellationToken.None);

        var expectedIds = new[]
        {
            P4,
            P1,
            P2,
            P2_TIE,
            P5,
            P7,
            P3
        };

        Assert.Equal(expectedIds.Length, results.Count);
        for (int i = 0; i < expectedIds.Length; i++)
        {
            Assert.Equal(expectedIds[i], results[i].Id);
        }

        Assert.DoesNotContain(results, p => p.Id == P6);
    }

    [Fact]
    public void FilterAndRank_DirectDtoOverload_MatchesFuzzyPropertyMatcherScores()
    {
        var activeDtos = CatalogWithInactive
            .Where(p => p.Status == PropertyStatus.Active)
            .Select(p => new PublicPropertyDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Slug = p.Slug,
                Address = p.Address,
                City = p.City,
                CheckInTime = p.CheckInTime,
                CheckOutTime = p.CheckOutTime,
                BufferMinutes = p.BufferMinutes,
                MaxHourlyHours = p.MaxHourlyHours
            })
            .ToList();

        var scoredResults = FuzzyPropertyMatcher.SearchProperties("centxralz", activeDtos);
        Assert.Equal(3, scoredResults.Count);

        Assert.Equal(50, scoredResults[0].Score);
        Assert.Equal("Name", scoredResults[0].BestField);
        Assert.Equal(50, scoredResults[0].NameScore);
        Assert.Equal(0, scoredResults[0].CityScore);
        Assert.Equal(0, scoredResults[0].AddressScore);

        var dtoList = GetPublicPropertiesQueryHandler.FilterAndRank(activeDtos, "centxralz");
        Assert.Equal(3, dtoList.Count);
        Assert.Equal(scoredResults[0].Property.Id, dtoList[0].Id);
    }

    [Fact]
    public async Task Handle_NfcAndNfdQueries_ProduceIdenticalOutputs()
    {
        var handler = CreateHandler();

        string[] queries = new[]
        {
            "Khách Sạn Sài Gòn Central",
            "Đà Nẵng",
            "Hà Nội",
            "Nha Trang",
            "Biển Đông"
        };

        foreach (var qNfc in queries)
        {
            string qNfd = qNfc.Normalize(NormalizationForm.FormD);

            var resNfc = await handler.Handle(new GetPublicPropertiesQuery(qNfc), CancellationToken.None);
            var resNfd = await handler.Handle(new GetPublicPropertiesQuery(qNfd), CancellationToken.None);

            Assert.Equal(resNfc.Count, resNfd.Count);

            for (int i = 0; i < resNfc.Count; i++)
            {
                Assert.Equal(resNfc[i].Id, resNfd[i].Id);
                Assert.Equal(resNfc[i].Name, resNfd[i].Name);
            }
        }
    }

    [Theory]
    [InlineData("da nang")]
    [InlineData("DA NANG")]
    [InlineData("Đà Nẵng")]
    [InlineData("ĐÀ NẴNG")]
    public async Task Handle_DWithStroke_BothCasesMatchSameProperties(string query)
    {
        var handler = CreateHandler();
        var results = await handler.Handle(new GetPublicPropertiesQuery(query), CancellationToken.None);

        Assert.Equal(3, results.Count);
        Assert.Contains(results, p => p.Id == P1);
        Assert.Contains(results, p => p.Id == P2);
        Assert.Contains(results, p => p.Id == P2_TIE);
    }

    [Fact]
    public async Task Handle_CancellationRequested_ThrowsOperationCanceledException()
    {
        var handler = CreateHandler();
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () =>
        {
            await handler.Handle(new GetPublicPropertiesQuery("Central"), cts.Token);
        });
    }

    #region Synthetic No-DB Test Infrastructure

    internal sealed class TestApplicationDbContext : IApplicationDbContext
    {
        public TestApplicationDbContext(IEnumerable<Property> properties)
        {
            Properties = new TestAsyncDbSet<Property>(properties);
            RoomTypeRates = new TestAsyncDbSet<RoomTypeRate>(Enumerable.Empty<RoomTypeRate>());
        }

        public DbSet<Property> Properties { get; }
        public DbSet<RoomTypeRate> RoomTypeRates { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
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

        public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, HotelSaas.Domain.Enums.RoomStatus expectedOldStatus, HotelSaas.Domain.Enums.RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    internal sealed class TestAsyncDbSet<T> : DbSet<T>, IOrderedQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly IQueryable<T> _source;
        private readonly TestAsyncQueryProvider<T> _provider;

        public TestAsyncDbSet(IEnumerable<T> data)
        {
            _source = data.AsQueryable();
            _provider = new TestAsyncQueryProvider<T>(_source);
        }

        public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => throw new NotImplementedException();

        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _source.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        IEnumerator<T> IEnumerable<T>.GetEnumerator() => _source.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _source.GetEnumerator();

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new TestAsyncEnumerator<T>(_source.GetEnumerator());
    }

    internal sealed class TestAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly IQueryable<TEntity> _source;

        public TestAsyncQueryProvider(IQueryable<TEntity> source)
        {
            _source = source;
        }

        public IQueryable CreateQuery(Expression expression)
        {
            Type elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(TestAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
        {
            return new TestAsyncQueryable<TElement>(expression, this);
        }

        public object? Execute(Expression expression)
        {
            var rewritten = EfExpressionRewriter.StripEfMethods(expression, _source);
            return _source.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var rewritten = EfExpressionRewriter.StripEfMethods(expression, _source);
            return _source.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            return Execute<TResult>(expression);
        }
    }

    internal sealed class TestAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public TestAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator()
        {
            return _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new TestAsyncEnumerator<TElement>(GetEnumerator());
        }
    }

    internal sealed class EfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _rootQueryable;

        private EfExpressionRewriter(IQueryable rootQueryable)
        {
            _rootQueryable = rootQueryable;
        }

        public static Expression StripEfMethods(Expression expression, IQueryable rootQueryable)
        {
            var visitor = new EfExpressionRewriter(rootQueryable);
            return visitor.Visit(expression);
        }

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking")
            {
                return Visit(node.Arguments[0]);
            }

            return base.VisitMethodCall(node);
        }

        protected override Expression VisitConstant(ConstantExpression node)
        {
            if (node.Value != null && node.Value.GetType().IsGenericType)
            {
                var genDef = node.Value.GetType().GetGenericTypeDefinition();
                if (genDef == typeof(TestAsyncDbSet<>) || genDef == typeof(TestAsyncQueryable<>))
                {
                    return _rootQueryable.Expression;
                }
            }

            return base.VisitConstant(node);
        }
    }

    internal sealed class TestAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;

        public TestAsyncEnumerator(IEnumerator<T> inner)
        {
            _inner = inner;
        }

        public T Current => _inner.Current;

        public ValueTask<bool> MoveNextAsync()
        {
            return ValueTask.FromResult(_inner.MoveNext());
        }

        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    #endregion
}
