using System.Collections;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// Unit tests for TenantPropertyContextMiddleware verifying 4-tier pipeline routing,
/// claims alias anti-tampering, deterministic membership selection, and fail-closed security.
/// </summary>
public sealed class TenantPropertyContextMiddlewareTests
{
    private sealed class MockTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class MockMembershipLookupService : IMembershipLookupService
    {
        public Func<Guid, Guid, Guid?, CancellationToken, Task<MembershipLookupResult>>? Handler { get; set; }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            if (Handler != null)
            {
                return Handler(tenantId, userId, targetPropertyId, cancellationToken);
            }

            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(), StaffRole.Owner, targetPropertyId, targetPropertyId == null));
        }
    }

    private static (DefaultHttpContext context, MemoryStream responseStream) CreateHttpContext(
        string path,
        ClaimsPrincipal? principal = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        if (principal != null)
        {
            context.User = principal;
        }

        var responseStream = new MemoryStream();
        context.Response.Body = responseStream;
        return (context, responseStream);
    }

    private static async Task<string> ReadResponseBodyAsync(MemoryStream stream)
    {
        stream.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync();
    }

    // ── Group 1: Pipeline Classification & Context Bootstrap ────────────────

    [Fact]
    public async Task Group1_PublicEndpoint_WithoutAuth_PassesThrough()
    {
        var (context, _) = CreateHttpContext("/api/auth/login");
        var nextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Group1_SwitchContext_WithoutPidInToken_DoesNotDeadlock()
    {
        var userId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "TestAuth"));

        var (context, _) = CreateHttpContext("/api/auth/switch-context", principal);
        var nextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Group1_GetMyMemberships_WithoutPidInToken_PassesThrough()
    {
        var userId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("globalRole", "TenantStaff")
        }, "TestAuth"));

        var (context, _) = CreateHttpContext("/api/auth/me/memberships", principal);
        var nextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Group1_SuperAdmin_CallingBusinessEndpoint_Returns403Forbidden()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "SuperAdmin"),
            new Claim("tenantId", Guid.NewGuid().ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_FORBIDDEN", doc.RootElement.GetProperty("errorCode").GetString());
    }

    // ── Group 2: Deterministic Membership Selection & PO Decisions ──────────

    [Fact]
    public async Task Group2_ExactMembershipRevoked_Returns403MembershipRevoked_NoFallback()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString()),
            new Claim("propertyId", propId.ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var mockLookup = new MockMembershipLookupService
        {
            Handler = (_, _, _, _) => Task.FromResult(MembershipLookupResult.Failed(
                MembershipLookupStatus.MembershipRevoked, "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi."))
        };

        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            mockLookup);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_MEMBERSHIP_REVOKED", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group2_StaffCallingWithoutProperty_Returns403PropertyRequired()
    {
        var tenantId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var mockLookup = new MockMembershipLookupService
        {
            Handler = (_, _, _, _) => Task.FromResult(MembershipLookupResult.Failed(
                MembershipLookupStatus.PropertyRequired, "Yêu cầu chọn chi nhánh làm việc để tiếp tục."))
        };

        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            mockLookup);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_PROPERTY_REQUIRED", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group2_OwnerCallingWithoutProperty_PopulatesExcludedPropertyIds()
    {
        var tenantId = Guid.NewGuid();
        var excludedP2 = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString())
        }, "TestAuth"));

        var (context, _) = CreateHttpContext("/api/rooms", principal);
        var propService = new MockPropertyService();
        var mockLookup = new MockMembershipLookupService
        {
            Handler = (_, _, _, _) => Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(), StaffRole.Owner, null, isTenantWide: true, new[] { excludedP2 }))
        };

        var nextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            propService,
            new CurrentUserContext(new MockTenantService(), propService),
            mockLookup);

        Assert.True(nextCalled);
        Assert.True(propService.IsTenantWide);
        Assert.Null(propService.PropertyId);
        Assert.Contains(excludedP2, propService.ExcludedPropertyIds);
    }

    // ── Group 4: Claims Alias & Anti-Tampering ───────────────────────────────

    [Fact]
    public async Task Group4_ConflictingTenantClaims_Returns401TokenTampered()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", Guid.NewGuid().ToString()),
            new Claim("tid", Guid.NewGuid().ToString()) // Different!
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_TOKEN_TAMPERED", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group4_ConflictingPropertyClaims_Returns401TokenTampered()
    {
        var tenantId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString()),
            new Claim("tid", tenantId.ToString()),
            new Claim("propertyId", Guid.NewGuid().ToString()),
            new Claim("pid", Guid.NewGuid().ToString()) // Different!
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_TOKEN_TAMPERED", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group4_HeaderTenantMismatch_Returns400BadRequest()
    {
        var tenantId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        context.Request.Headers["X-Tenant-Id"] = Guid.NewGuid().ToString(); // Different tenant!

        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_CONTEXT_MISMATCH", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group4_StaffAssignedP1_HeaderP2_Returns403PropertyForbidden()
    {
        var tenantId = Guid.NewGuid();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString()),
            new Claim("propertyId", p1.ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        context.Request.Headers["X-Property-Id"] = p2.ToString(); // Attempt to override!

        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            new MockMembershipLookupService());

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", doc.RootElement.GetProperty("errorCode").GetString());
    }

    // ── Group 7: Database Resilience (Fail-Closed) ───────────────────────────

    [Fact]
    public async Task Group7_DatabaseException_Returns503ServiceUnavailable_FailClosed()
    {
        var tenantId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString())
        }, "TestAuth"));

        var (context, stream) = CreateHttpContext("/api/rooms", principal);
        var mockLookup = new MockMembershipLookupService
        {
            Handler = (_, _, _, _) => throw new TimeoutException("Database connection timeout.")
        };

        var middleware = new TenantPropertyContextMiddleware(_ => Task.CompletedTask, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(
            context,
            new MockTenantService(),
            new MockPropertyService(),
            new CurrentUserContext(new MockTenantService(), new MockPropertyService()),
            mockLookup);

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(stream);
        var doc = JsonDocument.Parse(body);
        Assert.Equal("ERR_SERVICE_UNAVAILABLE", doc.RootElement.GetProperty("errorCode").GetString());
    }

    // ── Group 8: HTTP Pipeline Flow (Login -> Memberships -> Switch-Context -> Business) ──

    [Fact]
    public async Task Group8_HttpPipeline_BootstrapToken_CanAccessMembershipsAndSwitchContext_BlockedFromBusinessEndpointUntilSwitched()
    {
        var tenantId = Guid.NewGuid();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();
        var userId = Guid.NewGuid();

        // 1. Bootstrap token principal (issued after login for multi-branch staff)
        // Notice: Contains tenantId, but NO propertyId / pid / scope
        var bootstrapPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString())
        }, "TestAuth"));

        var mockLookup = new MockMembershipLookupService
        {
            Handler = (tId, uId, targetPropId, _) =>
            {
                if (targetPropId == null)
                {
                    // Multi-branch staff calling without property context -> PropertyRequired
                    return Task.FromResult(MembershipLookupResult.Failed(
                        MembershipLookupStatus.PropertyRequired,
                        "Yêu cầu chọn chi nhánh làm việc để tiếp tục."));
                }

                if (targetPropId == p1)
                {
                    return Task.FromResult(MembershipLookupResult.Succeeded(
                        Guid.NewGuid(), StaffRole.Manager, p1, false));
                }

                return Task.FromResult(MembershipLookupResult.Failed(
                    MembershipLookupStatus.PropertyForbidden,
                    "Không có quyền tại chi nhánh này."));
            }
        };

        var tenantService = new MockTenantService();
        var propertyService = new MockPropertyService();
        var userContext = new CurrentUserContext(tenantService, propertyService);

        // 2. HTTP GET /api/auth/me/memberships with bootstrap token: Passes through successfully!
        var (membershipsCtx, _) = CreateHttpContext("/api/auth/me/memberships", bootstrapPrincipal);
        var membershipsReached = false;
        var membershipsMiddleware = new TenantPropertyContextMiddleware(_ =>
        {
            membershipsReached = true;
            return Task.CompletedTask;
        }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await membershipsMiddleware.InvokeAsync(membershipsCtx, tenantService, propertyService, userContext, mockLookup);
        Assert.True(membershipsReached);

        // 3. HTTP GET /api/rooms with bootstrap token (Business endpoint without selecting branch): BLOCKED!
        var (roomsCtx, roomsStream) = CreateHttpContext("/api/rooms", bootstrapPrincipal);
        var roomsReached = false;
        var roomsMiddleware = new TenantPropertyContextMiddleware(_ =>
        {
            roomsReached = true;
            return Task.CompletedTask;
        }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await roomsMiddleware.InvokeAsync(roomsCtx, tenantService, propertyService, userContext, mockLookup);
        Assert.False(roomsReached);
        Assert.Equal(StatusCodes.Status403Forbidden, roomsCtx.Response.StatusCode);
        var roomsBody = await ReadResponseBodyAsync(roomsStream);
        var doc = JsonDocument.Parse(roomsBody);
        Assert.Equal("ERR_PROPERTY_REQUIRED", doc.RootElement.GetProperty("errorCode").GetString());

        // 4. HTTP POST /api/auth/switch-context with bootstrap token: Passes through successfully!
        var (switchCtx, _) = CreateHttpContext("/api/auth/switch-context", bootstrapPrincipal);
        var switchReached = false;
        var switchMiddleware = new TenantPropertyContextMiddleware(_ =>
        {
            switchReached = true;
            return Task.CompletedTask;
        }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await switchMiddleware.InvokeAsync(switchCtx, tenantService, propertyService, userContext, mockLookup);
        Assert.True(switchReached);

        // 5. HTTP GET /api/rooms with Scoped token (after switch-context to P1): Succeeded!
        var scopedPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("globalRole", "TenantStaff"),
            new Claim("tenantId", tenantId.ToString()),
            new Claim("propertyId", p1.ToString()),
            new Claim("scope", "PropertyScoped")
        }, "TestAuth"));

        var (scopedRoomsCtx, _) = CreateHttpContext("/api/rooms", scopedPrincipal);
        var scopedRoomsReached = false;
        var scopedRoomsMiddleware = new TenantPropertyContextMiddleware(_ =>
        {
            scopedRoomsReached = true;
            return Task.CompletedTask;
        }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await scopedRoomsMiddleware.InvokeAsync(scopedRoomsCtx, tenantService, propertyService, userContext, mockLookup);
        Assert.True(scopedRoomsReached);
        Assert.Equal(tenantId, tenantService.TenantId);
        Assert.Equal(p1, propertyService.PropertyId);
        Assert.False(propertyService.IsTenantWide);
    }

    // ── Group 3 & SupportAccessGrant (Wave 5/6 GAP-C11) ────────────────────

    private sealed class MiddlewareFakeDbContext : IApplicationDbContext
    {
        public MiddlewareFakeDbContext(
            IEnumerable<SupportAccessGrant>? supportGrants = null,
            IEnumerable<AccessRole>? accessRoles = null,
            IEnumerable<Property>? properties = null)
        {
            SupportAccessGrants = new AsyncDbSet<SupportAccessGrant>(supportGrants ?? Array.Empty<SupportAccessGrant>());
            AccessRoles = new AsyncDbSet<AccessRole>(accessRoles ?? Array.Empty<AccessRole>());
            Properties = new AsyncDbSet<Property>(properties ?? Array.Empty<Property>());
        }

        public DbSet<SupportAccessGrant> SupportAccessGrants { get; }
        public DbSet<AccessRole> AccessRoles { get; }
        public DbSet<Property> Properties { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
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
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
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

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);

        private sealed class AsyncDbSet<T> : DbSet<T>, IOrderedQueryable<T>, IAsyncEnumerable<T> where T : class
        {
            private readonly IQueryable<T> _queryable;
            private readonly AsyncQueryProvider<T> _provider;

            public AsyncDbSet(IEnumerable<T> items)
            {
                _queryable = items.ToList().AsQueryable();
                _provider = new AsyncQueryProvider<T>(_queryable);
            }

            public override IEntityType EntityType => null!;
            Type IQueryable.ElementType => typeof(T);
            Expression IQueryable.Expression => _queryable.Expression;
            IQueryProvider IQueryable.Provider => _provider;
            IEnumerator<T> IEnumerable<T>.GetEnumerator() => _queryable.GetEnumerator();
            IEnumerator IEnumerable.GetEnumerator() => _queryable.GetEnumerator();
            public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
                new AsyncEnumerator<T>(_queryable.GetEnumerator());
        }

        private sealed class AsyncQueryProvider<TEntity> : IAsyncQueryProvider
        {
            private readonly IQueryable _root;
            public AsyncQueryProvider(IQueryable root) => _root = root;
            public IQueryable CreateQuery(Expression expression) =>
                (IQueryable)Activator.CreateInstance(typeof(AsyncQueryable<>).MakeGenericType(expression.Type.GetGenericArguments().FirstOrDefault() ?? typeof(TEntity)), expression, this)!;
            public IQueryable<TElement> CreateQuery<TElement>(Expression expression) => new AsyncQueryable<TElement>(expression, this);
            public object? Execute(Expression expression) => _root.Provider.Execute(StripVisitor.Rewrite(expression, _root));
            public TResult Execute<TResult>(Expression expression) => _root.Provider.Execute<TResult>(StripVisitor.Rewrite(expression, _root));
            public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
            {
                var rewritten = StripVisitor.Rewrite(expression, _root);
                var expectedType = typeof(TResult).GetGenericArguments()[0];
                var result = typeof(IQueryProvider).GetMethods()
                    .First(m => m.Name == nameof(IQueryProvider.Execute) && m.IsGenericMethod)
                    .MakeGenericMethod(expectedType)
                    .Invoke(_root.Provider, new object[] { rewritten });
                return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(expectedType)
                    .Invoke(null, new[] { result })!;
            }
        }

        private sealed class AsyncQueryable<T> : EnumerableQuery<T>, IOrderedQueryable<T>, IAsyncEnumerable<T>
        {
            private readonly IQueryProvider _provider;
            public AsyncQueryable(Expression expression, IQueryProvider provider) : base(expression) => _provider = provider;
            IQueryProvider IQueryable.Provider => _provider;
            public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
                new AsyncEnumerator<T>(_provider.Execute<IEnumerable<T>>(((IQueryable)this).Expression).GetEnumerator());
        }

        private sealed class StripVisitor : ExpressionVisitor
        {
            private readonly IQueryable _root;
            private StripVisitor(IQueryable root) => _root = root;
            public static Expression Rewrite(Expression expr, IQueryable root) => new StripVisitor(root).Visit(expr);
            protected override Expression VisitMethodCall(MethodCallExpression node) =>
                node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking" ? Visit(node.Arguments[0]) : base.VisitMethodCall(node);
            protected override Expression VisitConstant(ConstantExpression node)
            {
                if (node.Value != null && node.Value.GetType().IsGenericType)
                {
                    var def = node.Value.GetType().GetGenericTypeDefinition();
                    if (def == typeof(AsyncDbSet<>) || def == typeof(AsyncQueryable<>))
                    {
                        return _root.Expression;
                    }
                }
                return base.VisitConstant(node);
            }
        }

        private sealed class AsyncEnumerator<T> : IAsyncEnumerator<T>
        {
            private readonly IEnumerator<T> _inner;
            public AsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
            public T Current => _inner.Current;
            public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
            public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        }
    }

    private static ServiceProvider BuildDbServiceProvider(IApplicationDbContext db)
    {
        var services = new ServiceCollection();
        services.AddScoped(_ => db);
        return services.BuildServiceProvider();
    }

    [Theory]
    [InlineData("/api/auth/revoke-token")]
    [InlineData("/api/auth/change-password")]
    [InlineData("/api/auth/social-accounts")]
    [InlineData("/api/auth/social-accounts/link")]
    [InlineData("/api/auth/social-accounts/Google")]
    public async Task Group3_SuperAdmin_SelfServiceAuthEndpoints_PassThroughWithoutTenantClaims(string authPath)
    {
        var userId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("globalRole", "SuperAdmin")
        }, "TestAuth"));

        var (context, _) = CreateHttpContext(authPath, principal);
        context.Request.Method = HttpMethods.Post;

        var tenantService = new MockTenantService();
        var propertyService = new MockPropertyService();
        var userContext = new CurrentUserContext(tenantService, propertyService);
        var nextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(context, tenantService, propertyService, userContext, new MockMembershipLookupService());

        Assert.True(nextCalled);
        Assert.Equal(userId, userContext.UserId);
        Assert.Equal(GlobalUserRole.SuperAdmin, userContext.GlobalRole);
    }

    [Fact]
    public async Task Group4_SuperAdmin_WithActiveReadOnlySupportGrant_GetSucceeds_And_PostReturns403ReadOnly()
    {
        var supportUserId = Guid.NewGuid();
        var targetTenantId = Guid.NewGuid();
        var ownerRoleId = Guid.NewGuid();
        var grantId = Guid.NewGuid();

        var fakeDb = new MiddlewareFakeDbContext(
            supportGrants: new[]
            {
                new SupportAccessGrant
                {
                    Id = grantId,
                    TenantId = targetTenantId,
                    GrantedByUserId = Guid.NewGuid(),
                    TargetSupportUserId = supportUserId,
                    Scope = "READ_ONLY",
                    Reason = "Read-only investigation",
                    ExpiresAtUtc = DateTime.UtcNow.AddHours(2),
                    RevokedAtUtc = null
                }
            },
            accessRoles: new[]
            {
                new AccessRole { Id = ownerRoleId, Code = "OWNER", Name = "Hotel Owner", IsSystemRole = true }
            });

        using var sp = BuildDbServiceProvider(fakeDb);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", supportUserId.ToString()),
            new Claim("globalRole", "SuperAdmin")
        }, "TestAuth"));

        // 1. GET succeeds with tenant context and role hydrated
        var (getContext, _) = CreateHttpContext("/api/rooms", principal);
        getContext.Request.Method = HttpMethods.Get;
        getContext.Request.Headers["X-Support-Grant-Id"] = grantId.ToString();
        getContext.RequestServices = sp;

        var tenantService = new MockTenantService();
        var propertyService = new MockPropertyService();
        var userContext = new CurrentUserContext(tenantService, propertyService);
        var getNextCalled = false;
        var middleware = new TenantPropertyContextMiddleware(_ => { getNextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await middleware.InvokeAsync(getContext, tenantService, propertyService, userContext, new MockMembershipLookupService());

        Assert.True(getNextCalled);
        Assert.Equal(targetTenantId, tenantService.TenantId);
        Assert.True(propertyService.IsTenantWide);
        Assert.Equal(ownerRoleId, userContext.RoleId);

        // 2. POST with READ_ONLY grant -> 403 ERR_SUPPORT_GRANT_READ_ONLY
        var (postContext, postStream) = CreateHttpContext("/api/rooms", principal);
        postContext.Request.Method = HttpMethods.Post;
        postContext.Request.Headers["X-Support-Grant-Id"] = grantId.ToString();
        postContext.RequestServices = sp;

        var postNextCalled = false;
        var postMiddleware = new TenantPropertyContextMiddleware(_ => { postNextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance);

        await postMiddleware.InvokeAsync(postContext, new MockTenantService(), new MockPropertyService(), new CurrentUserContext(new MockTenantService(), new MockPropertyService()), new MockMembershipLookupService());

        Assert.False(postNextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, postContext.Response.StatusCode);
        var postDoc = JsonDocument.Parse(await ReadResponseBodyAsync(postStream));
        Assert.Equal("ERR_SUPPORT_GRANT_READ_ONLY", postDoc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Group4_SuperAdmin_WithActiveDiagnosticSupportGrant_PutPrintTemplateSucceeds_AndWithoutGrantReturns403()
    {
        var supportUserId = Guid.NewGuid();
        var targetTenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var ownerRoleId = Guid.NewGuid();
        var grantId = Guid.NewGuid();

        var fakeDb = new MiddlewareFakeDbContext(
            supportGrants: new[]
            {
                new SupportAccessGrant
                {
                    Id = grantId,
                    TenantId = targetTenantId,
                    GrantedByUserId = Guid.NewGuid(),
                    TargetSupportUserId = supportUserId,
                    Scope = "DIAGNOSTIC",
                    Reason = "Troubleshoot print config",
                    ExpiresAtUtc = DateTime.UtcNow.AddHours(4),
                    RevokedAtUtc = null
                }
            },
            accessRoles: new[]
            {
                new AccessRole { Id = ownerRoleId, Code = "OWNER", Name = "Hotel Owner", IsSystemRole = true }
            },
            properties: new[]
            {
                new Property { Id = propertyId, TenantId = targetTenantId, Name = "Main Branch", Code = "MAIN", Status = PropertyStatus.Active }
            });

        using var sp = BuildDbServiceProvider(fakeDb);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", supportUserId.ToString()),
            new Claim("globalRole", "SuperAdmin")
        }, "TestAuth"));

        // 1. PUT /api/print/template-config WITHOUT X-Support-Grant-Id -> 403 ERR_FORBIDDEN
        var (noGrantCtx, noGrantStream) = CreateHttpContext("/api/print/template-config", principal);
        noGrantCtx.Request.Method = HttpMethods.Put;
        noGrantCtx.RequestServices = sp;
        var noGrantCalled = false;
        await new TenantPropertyContextMiddleware(_ => { noGrantCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance)
            .InvokeAsync(noGrantCtx, new MockTenantService(), new MockPropertyService(), new CurrentUserContext(new MockTenantService(), new MockPropertyService()), new MockMembershipLookupService());
        Assert.False(noGrantCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, noGrantCtx.Response.StatusCode);
        Assert.Equal("ERR_FORBIDDEN", JsonDocument.Parse(await ReadResponseBodyAsync(noGrantStream)).RootElement.GetProperty("errorCode").GetString());

        // 2. PUT /api/print/template-config WITH active DIAGNOSTIC grant & X-Property-Id -> succeeds with OWNER role
        var (diagCtx, _) = CreateHttpContext("/api/print/template-config", principal);
        diagCtx.Request.Method = HttpMethods.Put;
        diagCtx.Request.Headers["X-Support-Grant-Id"] = grantId.ToString();
        diagCtx.Request.Headers["X-Property-Id"] = propertyId.ToString();
        diagCtx.RequestServices = sp;

        var tenantService = new MockTenantService();
        var propertyService = new MockPropertyService();
        var userContext = new CurrentUserContext(tenantService, propertyService);
        var diagCalled = false;

        await new TenantPropertyContextMiddleware(_ => { diagCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance)
            .InvokeAsync(diagCtx, tenantService, propertyService, userContext, new MockMembershipLookupService());

        Assert.True(diagCalled);
        Assert.Equal(targetTenantId, tenantService.TenantId);
        Assert.Equal(propertyId, propertyService.PropertyId);
        Assert.True(propertyService.IsTenantWide);
        Assert.Equal(ownerRoleId, userContext.RoleId);
        Assert.Equal(StaffRole.Owner, userContext.StaffRole);
    }

    [Fact]
    public async Task Group4_SuperAdmin_WithExpiredOrRevokedSupportGrant_Returns403GrantInvalid()
    {
        var supportUserId = Guid.NewGuid();
        var targetTenantId = Guid.NewGuid();
        var expiredGrantId = Guid.NewGuid();
        var revokedGrantId = Guid.NewGuid();

        var fakeDb = new MiddlewareFakeDbContext(
            supportGrants: new[]
            {
                new SupportAccessGrant
                {
                    Id = expiredGrantId,
                    TenantId = targetTenantId,
                    GrantedByUserId = Guid.NewGuid(),
                    TargetSupportUserId = supportUserId,
                    Scope = "DIAGNOSTIC",
                    Reason = "Expired",
                    ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-5),
                    RevokedAtUtc = null
                },
                new SupportAccessGrant
                {
                    Id = revokedGrantId,
                    TenantId = targetTenantId,
                    GrantedByUserId = Guid.NewGuid(),
                    TargetSupportUserId = supportUserId,
                    Scope = "READ_ONLY",
                    Reason = "Revoked",
                    ExpiresAtUtc = DateTime.UtcNow.AddHours(2),
                    RevokedAtUtc = DateTime.UtcNow.AddMinutes(-1)
                }
            });

        using var sp = BuildDbServiceProvider(fakeDb);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", supportUserId.ToString()),
            new Claim("globalRole", "SuperAdmin")
        }, "TestAuth"));

        foreach (var badGrantId in new[] { expiredGrantId.ToString(), revokedGrantId.ToString(), "not-a-guid" })
        {
            var (ctx, stream) = CreateHttpContext("/api/rooms", principal);
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Headers["X-Support-Grant-Id"] = badGrantId;
            ctx.RequestServices = sp;

            var nextCalled = false;
            await new TenantPropertyContextMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, NullLogger<TenantPropertyContextMiddleware>.Instance)
                .InvokeAsync(ctx, new MockTenantService(), new MockPropertyService(), new CurrentUserContext(new MockTenantService(), new MockPropertyService()), new MockMembershipLookupService());

            Assert.False(nextCalled);
            Assert.Equal(StatusCodes.Status403Forbidden, ctx.Response.StatusCode);
            var doc = JsonDocument.Parse(await ReadResponseBodyAsync(stream));
            Assert.Equal("ERR_SUPPORT_GRANT_INVALID", doc.RootElement.GetProperty("errorCode").GetString());
        }
    }
}
