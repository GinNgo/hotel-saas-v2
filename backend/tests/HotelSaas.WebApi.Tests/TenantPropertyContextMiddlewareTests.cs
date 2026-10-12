using System.Security.Claims;
using System.Text.Json;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
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
}
