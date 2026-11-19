using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RefreshToken;
using HotelSaas.Application.Auth.Commands.RevokeToken;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guest.Queries.GetGuestBookingDetail;
using HotelSaas.Application.Guest.Queries.GetGuestBookings;
using HotelSaas.Application.Loyalty.Commands.EnrollPropertyMembership;
using HotelSaas.Application.Loyalty.Queries.GetGuestInvoicePrintView;
using HotelSaas.Application.Loyalty.Queries.GetMyGuestProfile;
using HotelSaas.Application.Loyalty.Queries.GetMyInvoices;
using HotelSaas.Application.Loyalty.Queries.GetMyPointTransactions;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reviews.Commands.SubmitGuestReview;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HotelSaas.Application.Tests.Loyalty;

/// <summary>
/// Verifies Wave 1 P0 fixes across Loyalty cross-tenant isolation, IDOR prevention,
/// Guest booking snapshot RentalType/LookupToken extraction, Guest review verification,
/// RefreshToken SHA-256 hashing, PermissionAuthorizationHandler SuperAdmin bypass removal,
/// and /metrics non-loopback protection.
/// </summary>
public sealed class GuestLoyaltyIsolationAndIdorTests
{
    #region Filter-Aware In-Memory Test Harness

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(MembershipLookupResult.Failed(MembershipLookupStatus.NoMembership, "No membership"));
    }

    private sealed class NoopTransaction : IDbContextTransaction
    {
        public Guid TransactionId { get; } = Guid.NewGuid();
        public void Commit() { }
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Dispose() { }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Rollback() { }
        public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FilterAwareEfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;

        private FilterAwareEfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new FilterAwareEfExpressionRewriter(effectiveRoot).Visit(expression);

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
                if (genDef == typeof(FilterAwareAsyncDbSet<>) || genDef == typeof(FilterAwareAsyncQueryable<>))
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

    private sealed class FilterAwareAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;

        public FilterAwareAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
        }

        private IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || FilterAwareEfExpressionRewriter.HasIgnoreQueryFilters(expression))
            {
                return _backingData.AsQueryable();
            }

            // Fail-closed global query filter simulation (mirrors ApplicationDbContext)
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
                typeof(FilterAwareAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new FilterAwareAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class FilterAwareAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public FilterAwareAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
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
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new AsyncEnumeratorWrapper<TElement>(GetEnumerator());
        }
    }

    private sealed class AsyncEnumeratorWrapper<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public AsyncEnumeratorWrapper(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
    }

    private sealed class FilterAwareAsyncDbSet<T> : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly List<T> _data;
        private readonly IQueryable<T> _rootQueryable;
        private readonly FilterAwareAsyncQueryProvider<T> _provider;

        public FilterAwareAsyncDbSet(List<T> data, ICurrentTenantService tenantService)
        {
            _data = data;
            _rootQueryable = _data.AsQueryable();
            _provider = new FilterAwareAsyncQueryProvider<T>(_data, tenantService);
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _rootQueryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        public override EntityEntry<T> Add(T entity)
        {
            _data.Add(entity);
            return null!;
        }

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            var enumerable = _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression);
            return new AsyncEnumeratorWrapper<T>(enumerable.GetEnumerator());
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();
    }

    private sealed class FakeApplicationDbContext : IApplicationDbContext
    {
        public List<User> UserList { get; } = new();
        public List<RefreshToken> RefreshTokenList { get; } = new();
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<Invoice> InvoiceList { get; } = new();
        public List<GuestLoyaltyMembership> MembershipList { get; } = new();
        public List<LoyaltyPointTransaction> PointTransactionList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();
        public List<TenantStaff> TenantStaffList { get; } = new();
        public List<RolePermission> RolePermissionList { get; } = new();
        public List<GuestReview> GuestReviewList { get; } = new();

        public FakeApplicationDbContext(ICurrentTenantService tenantService)
        {
            Users = new FilterAwareAsyncDbSet<User>(UserList, tenantService);
            RefreshTokens = new FilterAwareAsyncDbSet<RefreshToken>(RefreshTokenList, tenantService);
            Tenants = new FilterAwareAsyncDbSet<Tenant>(TenantList, tenantService);
            Properties = new FilterAwareAsyncDbSet<Property>(PropertyList, tenantService);
            Reservations = new FilterAwareAsyncDbSet<Reservation>(ReservationList, tenantService);
            Invoices = new FilterAwareAsyncDbSet<Invoice>(InvoiceList, tenantService);
            GuestLoyaltyMemberships = new FilterAwareAsyncDbSet<GuestLoyaltyMembership>(MembershipList, tenantService);
            LoyaltyPointTransactions = new FilterAwareAsyncDbSet<LoyaltyPointTransaction>(PointTransactionList, tenantService);
            PrintTemplateConfigs = new FilterAwareAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList, tenantService);
            TenantStaffMembers = new FilterAwareAsyncDbSet<TenantStaff>(TenantStaffList, tenantService);
            RolePermissions = new FilterAwareAsyncDbSet<RolePermission>(RolePermissionList, tenantService);
            GuestReviews = new FilterAwareAsyncDbSet<GuestReview>(GuestReviewList, tenantService);
        }

        public DbSet<User> Users { get; }
        public DbSet<RefreshToken> RefreshTokens { get; }
        public DbSet<Tenant> Tenants { get; }
        public DbSet<Property> Properties { get; }
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions { get; }
        public DbSet<TenantStaff> TenantStaffMembers { get; }
        public DbSet<RoomType> RoomTypes => throw new NotImplementedException();
        public DbSet<Room> Rooms => throw new NotImplementedException();
        public DbSet<Reservation> Reservations { get; }
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices { get; }
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships { get; }
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions { get; }
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs { get; }
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews { get; }
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());

        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private static CurrentUserContext CreateCustomerContext(
        StubTenantService tenantSvc,
        StubPropertyService propSvc,
        Guid userId,
        string email)
    {
        var ctx = new CurrentUserContext(tenantSvc, propSvc);
        ctx.SetUser(userId, email, GlobalUserRole.Customer);
        return ctx;
    }

    private static IJwtService CreateJwtService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "SuperSecretUnitTestKeyForAuthAndLoyaltyTests2026!!",
            ["JwtSettings:Issuer"] = "HotelSaas",
            ["JwtSettings:Audience"] = "HotelSaasClient",
            ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
            ["JwtSettings:RefreshTokenExpirationDays"] = "7"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new JwtService(config);
    }

    #endregion

    [Fact]
    public async Task GetMyGuestProfile_WithNullTenantContext_ReadsCrossTenantMembershipsForOwnerOnly()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var tenantA = new Tenant { Id = Guid.NewGuid(), Name = "Aurora Hotels" };
        var tenantB = new Tenant { Id = Guid.NewGuid(), Name = "Lotus Resorts" };
        var propA = new Property { Id = Guid.NewGuid(), TenantId = tenantA.Id, Name = "Aurora Saigon", Tenant = tenantA };
        var propB = new Property { Id = Guid.NewGuid(), TenantId = tenantB.Id, Name = "Lotus Da Nang", Tenant = tenantB };

        db.UserList.Add(new User
        {
            Id = ownerId,
            Email = "khach.vip@example.com",
            Username = "khach.vip@example.com",
            FullName = "Nguyễn Khách VIP",
            PhoneNumber = "0901234567",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        });

        var m1 = new GuestLoyaltyMembership
        {
            Id = Guid.NewGuid(),
            UserId = ownerId,
            TenantId = tenantA.Id,
            Tenant = tenantA,
            EnrolledPropertyId = propA.Id,
            EnrolledProperty = propA,
            MemberCode = "AUR-100001",
            Tier = LoyaltyTier.Gold,
            PointsBalance = 120,
            CompletedStaysCount = 6,
            CreatedAtUtc = DateTime.UtcNow
        };
        var m2 = new GuestLoyaltyMembership
        {
            Id = Guid.NewGuid(),
            UserId = ownerId,
            TenantId = tenantB.Id,
            Tenant = tenantB,
            EnrolledPropertyId = propB.Id,
            EnrolledProperty = propB,
            MemberCode = "LOT-200002",
            Tier = LoyaltyTier.Silver,
            PointsBalance = 50,
            CompletedStaysCount = 1,
            CreatedAtUtc = DateTime.UtcNow
        };
        var mOther = new GuestLoyaltyMembership
        {
            Id = Guid.NewGuid(),
            UserId = otherUserId,
            TenantId = tenantA.Id,
            Tenant = tenantA,
            EnrolledPropertyId = propA.Id,
            EnrolledProperty = propA,
            MemberCode = "OTHER-999",
            Tier = LoyaltyTier.Diamond,
            PointsBalance = 9999,
            CompletedStaysCount = 20,
            CreatedAtUtc = DateTime.UtcNow
        };
        db.MembershipList.AddRange(new[] { m1, m2, mOther });

        db.PointTransactionList.AddRange(new[]
        {
            new LoyaltyPointTransaction
            {
                Id = Guid.NewGuid(),
                MembershipId = m1.Id,
                TenantId = tenantA.Id,
                PropertyId = propA.Id,
                TransactionType = LoyaltyPointTransactionType.RefundedOnCancel,
                PointsDelta = 30,
                BalanceAfter = 120,
                Description = "Hoàn điểm hủy đơn",
                CreatedAtUtc = DateTime.UtcNow
            },
            new LoyaltyPointTransaction
            {
                Id = Guid.NewGuid(),
                MembershipId = mOther.Id,
                TenantId = tenantA.Id,
                PropertyId = propA.Id,
                TransactionType = LoyaltyPointTransactionType.RefundedOnCancel,
                PointsDelta = 500,
                BalanceAfter = 9999,
                Description = "Điểm của người khác",
                CreatedAtUtc = DateTime.UtcNow
            }
        });

        var handler = new GetMyGuestProfileQueryHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, ownerId, "khach.vip@example.com"),
            new LoyaltyTierRules());

        var result = await handler.Handle(new GetMyGuestProfileQuery(), CancellationToken.None);

        Assert.Equal(ownerId, result.UserId);
        Assert.Equal(170, result.TotalPoints);
        Assert.Equal(30, result.TotalPointsRefunded);
        Assert.Equal(2, result.Memberships.Count);
        Assert.DoesNotContain(result.Memberships, m => m.MemberCode == "OTHER-999");
    }

    [Fact]
    public async Task GetMyPointTransactions_And_EnrollPropertyMembership_WorkAcrossTenants_WithNullAmbientTenant()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var userId = Guid.NewGuid();
        var tenantA = new Tenant { Id = Guid.NewGuid(), Name = "Chain Alpha" };
        var propA = new Property { Id = Guid.NewGuid(), TenantId = tenantA.Id, Name = "Alpha Hanoi", Tenant = tenantA };
        db.PropertyList.Add(propA);

        var enrollHandler = new EnrollPropertyMembershipCommandHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, userId, "guest@example.com"),
            new LoyaltyTierRules(),
            tenantSvc);

        var enrolled = await enrollHandler.Handle(new EnrollPropertyMembershipCommand(propA.Id), CancellationToken.None);

        Assert.Equal(tenantA.Id, enrolled.TenantId);
        Assert.Equal(propA.Id, enrolled.EnrolledPropertyId);
        Assert.Equal(50, enrolled.PointsBalance);
        Assert.Equal(tenantA.Id, tenantSvc.TenantId);

        // Reset ambient tenant back to null (simulating next HTTP request for B2C customer)
        tenantSvc.TenantId = null;

        var ledgerHandler = new GetMyPointTransactionsQueryHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, userId, "guest@example.com"));

        var ledger = await ledgerHandler.Handle(new GetMyPointTransactionsQuery(null), CancellationToken.None);

        var tx = Assert.Single(ledger);
        Assert.Equal(50, tx.PointsDelta);
        Assert.Equal("Bonus", tx.Type);
    }

    [Fact]
    public async Task GetMyInvoices_ExcludesPhoneEmailLookalikes_UsesPropertyTaxRate_AndExcludesRefunds()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();

        var tenant = new Tenant { Id = tenantId, Name = "Grand Hotel Group" };
        var prop = new Property
        {
            Id = propId,
            TenantId = tenantId,
            Name = "Grand Saigon",
            Address = "100 Le Loi",
            TaxRatePercent = 10.00m
        };

        db.UserList.Add(new User
        {
            Id = userAId,
            Email = "user.a@example.com",
            Username = "user.a@example.com",
            FullName = "User A",
            PhoneNumber = "0909111222",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        });

        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propId,
            TaxNumber = "0312345678"
        });

        var resOwned = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tenant = tenant,
            PropertyId = propId,
            Property = prop,
            GuestUserId = userAId,
            GuestName = "User A",
            GuestEmail = "user.a@example.com",
            GuestPhone = "0909111222",
            ConfirmationCode = "RES-OWN01",
            CheckInDate = new DateOnly(2026, 11, 10),
            CheckOutDate = new DateOnly(2026, 11, 12),
            TotalAmount = 1_000_000m,
            Status = ReservationStatus.CheckedOut,
            CreatedAtUtc = DateTime.UtcNow,
            Payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Amount = 1_000_000m,
                    Method = PaymentMethod.VNPay,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "VNPAY-12345"
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Amount = 1_000_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "REFUND-COMPLETED-12345"
                }
            }
        };

        // Unlinked or other-user reservation sharing the exact same GuestPhone & GuestEmail
        var resSamePhoneNoOwner = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tenant = tenant,
            PropertyId = propId,
            Property = prop,
            GuestUserId = userBId,
            GuestName = "Spoofer",
            GuestEmail = "user.a@example.com",
            GuestPhone = "0909111222",
            ConfirmationCode = "RES-LEAK02",
            CheckInDate = new DateOnly(2026, 11, 15),
            CheckOutDate = new DateOnly(2026, 11, 16),
            TotalAmount = 5_000_000m,
            Status = ReservationStatus.Confirmed,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.ReservationList.AddRange(new[] { resOwned, resSamePhoneNoOwner });

        var handler = new GetMyInvoicesQueryHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, userAId, "user.a@example.com"));

        var invoices = await handler.Handle(new GetMyInvoicesQuery(), CancellationToken.None);

        var dto = Assert.Single(invoices);
        Assert.Equal(resOwned.Id, dto.ReservationId);
        Assert.Equal(100_000m, dto.TaxAmount); // 10% from Property.TaxRatePercent
        Assert.Equal(1_000_000m, dto.PaidAmount); // Excludes REFUND transaction
        Assert.Equal("0312345678", dto.PropertyTaxCode);
    }

    [Fact]
    public async Task GetGuestInvoicePrintView_RejectsNonOwnerWithForbiddenException_AndAllowsOwnerCrossTenant()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var ownerId = Guid.NewGuid();
        var attackerId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();

        var tenant = new Tenant { Id = tenantId, Name = "Saigon Chain" };
        var prop = new Property
        {
            Id = propId,
            TenantId = tenantId,
            Name = "Saigon Riverside",
            Address = "1 Ton Duc Thang",
            TaxRatePercent = 10.00m
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tenant = tenant,
            PropertyId = propId,
            Property = prop,
            GuestUserId = ownerId,
            ConfirmationCode = "RES-IDOR1",
            CheckInDate = new DateOnly(2026, 11, 1),
            CheckOutDate = new DateOnly(2026, 11, 3),
            TotalAmount = 2_000_000m,
            Status = ReservationStatus.CheckedOut,
            CreatedAtUtc = DateTime.UtcNow
        };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ReservationId = reservation.Id,
            Reservation = reservation,
            InvoiceNumber = "INV-2026-0001",
            TaxAmount = 200_000m,
            PropertyTaxCode = "0309998887"
        };
        db.ReservationList.Add(reservation);
        db.InvoiceList.Add(invoice);

        // Attacker attempts IDOR via InvoiceId and ReservationId
        var attackerHandler = new GetGuestInvoicePrintViewQueryHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, attackerId, "attacker@example.com"));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            attackerHandler.Handle(new GetGuestInvoicePrintViewQuery(invoice.Id), CancellationToken.None));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            attackerHandler.Handle(new GetGuestInvoicePrintViewQuery(reservation.Id), CancellationToken.None));

        // Legitimate owner succeeds cross-tenant (TenantId = null)
        var ownerHandler = new GetGuestInvoicePrintViewQueryHandler(
            db,
            CreateCustomerContext(tenantSvc, propSvc, ownerId, "owner@example.com"));

        var result = await ownerHandler.Handle(new GetGuestInvoicePrintViewQuery(invoice.Id), CancellationToken.None);
        Assert.Equal("INV-2026-0001", result.InvoiceNumber);
        Assert.Equal(200_000m, result.TaxAmount);
        Assert.Equal("0309998887", result.PropertyTaxCode);
    }

    [Fact]
    public async Task GetGuestBookings_And_Detail_ReadRentalTypeAndLookupTokenFromSnapshot()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var prop = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Central Hotel", Slug = "central-hotel" };

        var overnightRes = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = prop.Id,
            Property = prop,
            GuestUserId = userId,
            ConfirmationCode = "RES-OVN1",
            CheckInDate = new DateOnly(2026, 11, 20),
            CheckOutDate = new DateOnly(2026, 11, 21),
            TotalAmount = 800_000m,
            Status = ReservationStatus.Confirmed,
            CreatedAtUtc = DateTime.UtcNow,
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Overnight,
                LookupToken = "tok-overnight-secret"
            })
        };
        db.ReservationList.Add(overnightRes);

        var userCtx = CreateCustomerContext(tenantSvc, propSvc, userId, "guest@example.com");
        var listHandler = new GetGuestBookingsQueryHandler(db, userCtx);
        var paged = await listHandler.Handle(new GetGuestBookingsQuery(1, 10), CancellationToken.None);

        var summary = Assert.Single(paged.Items);
        Assert.Equal("Overnight", summary.RentalType);
        Assert.Equal("tok-overnight-secret", summary.LookupToken);

        var detailHandler = new GetGuestBookingDetailQueryHandler(db, userCtx);
        var detail = await detailHandler.Handle(new GetGuestBookingDetailQuery(overnightRes.Id), CancellationToken.None);

        Assert.Equal("Overnight", detail.RentalType);
        Assert.Equal("tok-overnight-secret", detail.LookupToken);
    }

    [Fact]
    public async Task SubmitGuestReview_EnforcesLookupToken_G0_06_Status_AndNoAutoUserCreation()
    {
        var tenantSvc = new StubTenantService { TenantId = null };
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var ownerId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var prop = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Beach Villa" };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = prop.Id,
            Property = prop,
            GuestUserId = null,
            GuestName = "Tran Khach",
            GuestEmail = "anon@example.com",
            ConfirmationCode = "LUX123",
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                LookupToken = "secret-lookup-token-999"
            })
        };
        db.ReservationList.Add(reservation);

        var anonHandler = new SubmitGuestReviewCommandHandler(db, tenantSvc, propSvc);

        // 1. Bare 6-char ConfirmationCode rejected for anonymous caller
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            anonHandler.Handle(new SubmitGuestReviewCommand("LUX123", 5, Comment: "Attempt"), CancellationToken.None));

        // 2. Confirmed reservation (not yet checked in) rejected per G0-06
        var exStatus = await Assert.ThrowsAsync<BadRequestException>(() =>
            anonHandler.Handle(new SubmitGuestReviewCommand("secret-lookup-token-999", 5, Comment: "Too early"), CancellationToken.None));
        Assert.Equal("ERR_INELIGIBLE_FOR_REVIEW", exStatus.ErrorCode);

        // 3. CheckedOut without GuestUserId & unauthenticated -> rejected without creating ghost User row
        reservation.Status = ReservationStatus.CheckedOut;
        var exAccount = await Assert.ThrowsAsync<BadRequestException>(() =>
            anonHandler.Handle(new SubmitGuestReviewCommand("secret-lookup-token-999", 5, Comment: "Anon"), CancellationToken.None));
        Assert.Equal("ERR_REVIEW_ACCOUNT_REQUIRED", exAccount.ErrorCode);
        Assert.Empty(db.UserList);

        // 4. Linked owner with valid LookupToken & CheckedOut succeeds
        reservation.GuestUserId = ownerId;
        var reviewDto = await anonHandler.Handle(
            new SubmitGuestReviewCommand("secret-lookup-token-999", 5, Comment: "Tuyệt vời!"),
            CancellationToken.None);

        Assert.Equal(5, reviewDto.Rating);
        Assert.Single(db.GuestReviewList);
        Assert.Empty(db.UserList);
    }

    [Fact]
    public async Task AuthRefreshAndRevoke_HashesTokensWithSha256_AndSupportsLegacyPreSeededTokens()
    {
        var tenantSvc = new StubTenantService();
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);
        var hasher = new PasswordHasherService();
        var jwtService = CreateJwtService();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "guest.auth@example.com",
            Username = "guest.auth@example.com",
            FullName = "Guest Auth",
            PasswordHash = hasher.Hash("StrongPass@2026"),
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        };
        db.UserList.Add(user);

        // 1. Login stores SHA-256 hex digest in DB, returns raw token
        var loginHandler = new LoginCommandHandler(db, hasher, jwtService);
        var loginRes = await loginHandler.Handle(new LoginCommand("guest.auth@example.com", "StrongPass@2026"), CancellationToken.None);

        var storedEntity = Assert.Single(db.RefreshTokenList);
        var expectedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(loginRes.RefreshToken))).ToLowerInvariant();
        Assert.NotEqual(loginRes.RefreshToken, storedEntity.Token);
        Assert.Equal(expectedHash, storedEntity.Token);

        // 2. Refresh validates raw token via SHA-256 hash and stores new hashed token & ReplacedByToken
        var refreshHandler = new RefreshTokenCommandHandler(db, jwtService, new StubMembershipLookupService());
        var refreshed = await refreshHandler.Handle(new RefreshTokenCommand(loginRes.AccessToken, loginRes.RefreshToken), CancellationToken.None);

        Assert.Equal(2, db.RefreshTokenList.Count);
        var newHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshed.RefreshToken))).ToLowerInvariant();
        Assert.Equal(newHash, storedEntity.ReplacedByToken);
        Assert.Equal(newHash, db.RefreshTokenList[1].Token);

        // 3. Revoke revokes hashed token via raw value
        var revokeHandler = new RevokeTokenCommandHandler(db);
        var revokedHashed = await revokeHandler.Handle(new RevokeTokenCommand(refreshed.RefreshToken), CancellationToken.None);
        Assert.True(revokedHashed);
        Assert.NotNull(db.RefreshTokenList[1].RevokedAtUtc);

        // 4. Legacy pre-seeded plaintext refresh token still works for Refresh & Revoke
        var legacyRaw = "legacy-preseeded-token-value";
        db.RefreshTokenList.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = legacyRaw,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(5)
        });
        var legacyRefreshed = await refreshHandler.Handle(new RefreshTokenCommand(refreshed.AccessToken, legacyRaw), CancellationToken.None);
        Assert.False(string.IsNullOrWhiteSpace(legacyRefreshed.RefreshToken));
        Assert.True(await revokeHandler.Handle(new RevokeTokenCommand(legacyRefreshed.RefreshToken), CancellationToken.None));

        var legacyDirectRevoke = "legacy-direct-revoke-token";
        db.RefreshTokenList.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = legacyDirectRevoke,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(5)
        });
        Assert.True(await revokeHandler.Handle(new RevokeTokenCommand(legacyDirectRevoke), CancellationToken.None));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short-secret-key")]
    [InlineData("DevOnly_SuperSecretKey_ChangeInProduction_AtLeast32Chars!")]
    [InlineData("HotelSaasPlatform2026EnterpriseSuperSecretKey32BytesLong!")]
    public void ValidateProductionJwtSecret_RejectsMissingShortAndSampleKeys(string? badKey)
    {
        Assert.Throws<InvalidOperationException>(() => Program.ValidateProductionJwtSecret(badKey));
    }

    [Fact]
    public void ValidateProductionJwtSecret_AllowsStrongUniqueKey()
    {
        Program.ValidateProductionJwtSecret("Prod_7f9a2c4e8b1d6f0a3c5e7b9d1f3a5c7e_9x2z!");
    }

    [Fact]
    public async Task PermissionAuthorizationHandler_DoesNotBypassChecksForSuperAdminWithoutRole()
    {
        var tenantSvc = new StubTenantService();
        var propSvc = new StubPropertyService();
        var db = new FakeApplicationDbContext(tenantSvc);

        var userCtx = new CurrentUserContext(tenantSvc, propSvc);
        userCtx.SetUser(Guid.NewGuid(), "superadmin@hotelsaas.platform", GlobalUserRole.SuperAdmin);

        var handler = new PermissionAuthorizationHandler(db, userCtx);
        var requirement = new PermissionRequirement("SETTINGS", PermissionAction.Update);
        var authContext = new AuthorizationHandlerContext(new[] { requirement }, new ClaimsPrincipal(), null);

        await handler.HandleAsync(authContext);

        Assert.False(authContext.HasSucceeded);
    }

    [Fact]
    public void MetricsAuthorization_AllowsLoopbackTestServerApiKeyAndSuperAdmin_RejectsExternalAnonymousOrStaff()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Metrics:ApiKey"] = "metrics-secret-key-2026"
            })
            .Build();

        // 1. TestServer (RemoteIpAddress == null) -> Allowed
        var testServerCtx = new DefaultHttpContext();
        Assert.True(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(testServerCtx, config, out _));

        // 2. Loopback 127.0.0.1 -> Allowed
        var loopbackCtx = new DefaultHttpContext();
        loopbackCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        Assert.True(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(loopbackCtx, config, out _));

        // 3. External IP anonymous -> Rejected (401)
        var externalAnonCtx = new DefaultHttpContext();
        externalAnonCtx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.42");
        Assert.False(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(externalAnonCtx, config, out var isNonSuperAdminAnon));
        Assert.False(isNonSuperAdminAnon);

        // 4. External IP TenantStaff -> Rejected (403)
        var externalStaffCtx = new DefaultHttpContext();
        externalStaffCtx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.42");
        externalStaffCtx.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("globalRole", "TenantStaff")
        }, "Bearer"));
        Assert.False(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(externalStaffCtx, config, out var isNonSuperAdminStaff));
        Assert.True(isNonSuperAdminStaff);

        // 5. External IP SuperAdmin -> Allowed
        var externalSuperAdminCtx = new DefaultHttpContext();
        externalSuperAdminCtx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.42");
        externalSuperAdminCtx.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("globalRole", "SuperAdmin")
        }, "Bearer"));
        Assert.True(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(externalSuperAdminCtx, config, out _));

        // 6. External IP with matching X-Metrics-Key -> Allowed
        var externalKeyCtx = new DefaultHttpContext();
        externalKeyCtx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.42");
        externalKeyCtx.Request.Headers["X-Metrics-Key"] = "metrics-secret-key-2026";
        Assert.True(TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(externalKeyCtx, config, out _));
    }
}
