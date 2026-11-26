using System.Collections;
using System.Linq.Expressions;
using System.Reflection;
using System.Text.Json.Nodes;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Guests;
using HotelSaas.Application.Guests.Commands.UpdateGuestNotes;
using HotelSaas.Application.Guests.Queries.GetGuestDirectory;
using HotelSaas.Application.Guests.Queries.GetGuestHistory;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;

namespace HotelSaas.Application.Tests.Guest;

public sealed class GuestDirectoryAndNotesTests
{
    private sealed class EfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;

        private EfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new EfExpressionRewriter(effectiveRoot).Visit(expression);

        public static bool HasIgnoreQueryFilters(Expression expression)
        {
            var finder = new MethodFinder("IgnoreQueryFilters");
            finder.Visit(expression);
            return finder.Found;
        }

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking" or "Include" or "ThenInclude" or "AsSplitQuery")
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
                if (genDef == typeof(InMemoryAsyncDbSet<>) || genDef == typeof(InMemoryAsyncQueryable<>))
                {
                    return _effectiveRoot.Expression;
                }
            }

            return base.VisitConstant(node);
        }

        private sealed class MethodFinder : ExpressionVisitor
        {
            private readonly string _methodName;
            public bool Found { get; private set; }

            public MethodFinder(string methodName) => _methodName = methodName;

            protected override Expression VisitMethodCall(MethodCallExpression node)
            {
                if (node.Method.Name == _methodName)
                {
                    Found = true;
                }
                return base.VisitMethodCall(node);
            }
        }
    }

    private sealed class InMemoryAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public InMemoryAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private sealed class InMemoryAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;

        public InMemoryAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
        }

        public IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || EfExpressionRewriter.HasIgnoreQueryFilters(expression))
            {
                return _backingData.AsQueryable();
            }

            if (!_tenantService.TenantId.HasValue)
            {
                return Array.Empty<TEntity>().AsQueryable();
            }

            var tenantId = _tenantService.TenantId.Value;
            return _backingData
                .Where(e => ((ITenantScopedEntity)e).TenantId == tenantId)
                .AsQueryable();
        }

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(InMemoryAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new InMemoryAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class InMemoryAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public InMemoryAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator()
            => _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TElement>(GetEnumerator());
    }

    private sealed class InMemoryAsyncDbSet<TEntity> : DbSet<TEntity>, IQueryable<TEntity>, IAsyncEnumerable<TEntity>
        where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly InMemoryAsyncQueryProvider<TEntity> _provider;
        private readonly Expression _expression;

        public InMemoryAsyncDbSet(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _provider = new InMemoryAsyncQueryProvider<TEntity>(backingData, tenantService);
            _expression = Expression.Constant(this);
        }

        public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator()
            => _provider.ResolveEffectiveQueryable(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TEntity>(GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _backingData.Add(entity);
            return null!;
        }

        public override void AddRange(IEnumerable<TEntity> entities) => _backingData.AddRange(entities);
        public override void AddRange(params TEntity[] entities) => _backingData.AddRange(entities);

        public override EntityEntry<TEntity> Remove(TEntity entity)
        {
            _backingData.Remove(entity);
            return null!;
        }

        public override void RemoveRange(IEnumerable<TEntity> entities)
        {
            foreach (var entity in entities.ToList())
            {
                _backingData.Remove(entity);
            }
        }
    }


    public class ContextProxy : DispatchProxy
    {
        public DbSet<Reservation> Reservations { get; set; } = null!;
        public DbSet<GuestLoyaltyMembership> Memberships { get; set; } = null!;
        protected override object? Invoke(MethodInfo? method, object?[]? args) => method?.Name switch
        {
            "get_Reservations" => Reservations,
            "get_GuestLoyaltyMemberships" => Memberships,
            "SaveChangesAsync" => Task.FromResult(1),
            _ => throw new NotSupportedException(method?.Name)
        };
    }

    private static (IApplicationDbContext Db, CurrentTenantService Tenant) Context(List<Reservation> bookings, Guid tenantId)
    {
        var tenant = new CurrentTenantService { TenantId = tenantId };
        var db = DispatchProxy.Create<IApplicationDbContext, ContextProxy>();
        var proxy = (ContextProxy)(object)db;
        proxy.Reservations = new InMemoryAsyncDbSet<Reservation>(bookings, tenant);
        proxy.Memberships = new InMemoryAsyncDbSet<GuestLoyaltyMembership>([], tenant);
        return (db, tenant);
    }

    private static Reservation Booking(Guid tenant, string? phone = null, string? email = null) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, GuestName = "KhÃƒÂ¡ch thÃ¡Â»Â­ nghiÃ¡Â»â€¡m", GuestPhone = phone ?? string.Empty, GuestEmail = email ?? string.Empty,
        CheckInDate = new DateOnly(2026, 12, 1), CheckOutDate = new DateOnly(2026, 12, 2),
        Status = ReservationStatus.CheckedOut, TotalAmount = 1_000_000,
        Property = new Property { CheckInTime = new TimeOnly(14, 0), CheckOutTime = new TimeOnly(12, 0), BufferMinutes = 30 },
        CreatedAtUtc = DateTime.UtcNow
    };

    [Fact]
    public async Task Directory_IncludesPhoneLessGuests_NormalizesEmail_AndNeverMergesAnonymousNames()
    {
        var tenant = Guid.NewGuid();
        var bookings = new List<Reservation> { Booking(tenant, email: " Guest@Example.test "), Booking(tenant, email: "guest@example.test"),
            Booking(tenant), Booking(tenant), Booking(Guid.NewGuid(), email: "guest@example.test") };
        var (db, scope) = Context(bookings, tenant);
        var result = await new GetGuestDirectoryQueryHandler(db, scope).Handle(new(), default);
        Assert.Equal(3, result.TotalCount);
        var emailGuest = Assert.Single(result.Items, x => x.GuestKey == "email:guest@example.test");
        Assert.Equal(2, emailGuest.TotalBookings);
        var history = await new GetGuestHistoryQueryHandler(db, scope).Handle(new() { GuestKey = emailGuest.GuestKey }, default);
        Assert.Equal(2, history.Bookings.Count);
        var second = await new GetGuestDirectoryQueryHandler(db, scope).Handle(new(), default);
        Assert.Equal(result.Items.Select(x => x.Id), second.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task Update_PersistsFalseVipOverrideAndBlacklist_PreservesSnapshotAndOtherTenant()
    {
        var tenant = Guid.NewGuid();
        var booking = Booking(tenant, email: "vip@example.test");
        booking.TotalAmount = 9_000_000;
        booking.Notes = "{\"LookupToken\":\"fixture-token\",\"StartAtUtc\":\"2026-12-01T07:00:00Z\",\"EndAtUtc\":\"2026-12-02T05:00:00Z\",\"FutureField\":{\"preserve\":true}}";
        var other = Booking(Guid.NewGuid(), email: "vip@example.test");
        var (db, scope) = Context([booking, other], tenant);
        Assert.True(await new UpdateGuestNotesCommandHandler(db, scope).Handle(new()
        { GuestKey = "email:vip@example.test", Notes = "  Ã†Â°u tiÃƒÂªn phÃƒÂ²ng yÃƒÂªn tÃ„Â©nh  ", IsVip = false, IsBlacklisted = true }, default));
        var snapshot = ReservationSnapshotHelper.TryDeserialize(booking.Notes)!;
        Assert.False(snapshot.IsVip);
        Assert.True(snapshot.IsBlacklisted);
        Assert.Equal("fixture-token", snapshot.LookupToken);
        Assert.True(JsonNode.Parse(booking.Notes!)!["FutureField"]!["preserve"]!.GetValue<bool>());
        Assert.Null(other.Notes);
        var detail = await new GetGuestHistoryQueryHandler(db, scope).Handle(new() { GuestKey = "email:vip@example.test" }, default);
        Assert.False(detail.Profile.IsVip);
        Assert.True(detail.Profile.IsBlacklisted);
        Assert.Equal("Ã†Â°u tiÃƒÂªn phÃƒÂ²ng yÃƒÂªn tÃ„Â©nh", detail.Profile.Notes);
        await new UpdateGuestNotesCommandHandler(db, scope).Handle(new() { GuestKey = "email:vip@example.test", IsVip = null, IsBlacklisted = false }, default);
        var directory = await new GetGuestDirectoryQueryHandler(db, scope).Handle(new(), default);
        Assert.True(Assert.Single(directory.Items).IsVip);
        Assert.False(Assert.Single(directory.Items).IsBlacklisted);
    }

    [Fact]
    public async Task LegacyNotes_ConvertWithoutLosingStayTimes_AndUpdateAllMatchingBookings()
    {
        var tenant = Guid.NewGuid();
        var bookings = Enumerable.Range(0, 7).Select(_ => Booking(tenant, "0900000000")).ToList();
        var (db, scope) = Context(bookings, tenant);
        await new UpdateGuestNotesCommandHandler(db, scope).Handle(new() { PhoneNumber = "0900000000", Notes = "new", IsVip = true }, default);
        Assert.All(bookings, b =>
        {
            var snapshot = ReservationSnapshotHelper.TryDeserialize(b.Notes)!;
            Assert.True(snapshot.IsVip);
            Assert.Equal(new DateTime(2026, 12, 1, 7, 0, 0, DateTimeKind.Utc), snapshot.StartAtUtc);
        });
    }

    [Fact]
    public void Validator_RequiresIdentity_ButAcceptsPhoneLessKey()
    {
        var validator = new UpdateGuestNotesCommandValidator();
        Assert.False(validator.Validate(new UpdateGuestNotesCommand()).IsValid);
        Assert.True(validator.Validate(new UpdateGuestNotesCommand { GuestKey = "email:guest@example.test" }).IsValid);
    }
}
