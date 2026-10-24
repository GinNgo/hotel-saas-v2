using System.Security.Claims;
using System.Text.Json;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Server-side tenant and property context middleware enforcing deterministic membership selection,
/// claims alias anti-tampering, 4-tier pipeline endpoint classification, and fail-closed security.
/// </summary>
public sealed class TenantPropertyContextMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantPropertyContextMiddleware> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Initializes a new instance of <see cref="TenantPropertyContextMiddleware"/>.
    /// </summary>
    public TenantPropertyContextMiddleware(
        RequestDelegate next,
        ILogger<TenantPropertyContextMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Invokes the context resolution and authorization pipeline for the current HTTP request.
    /// </summary>
    public async Task InvokeAsync(
        HttpContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // ── 1. Pipeline Classification: Group 1 - Anonymous / Public Endpoints ──
        if (IsPublicEndpoint(context, path))
        {
            await _next(context);
            return;
        }

        // ── Authentication Check for Groups 2, 3, 3b, 4 ─────────────────────────
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_UNAUTHORIZED", "Yêu cầu xác thực danh tính.");
            return;
        }

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_UNAUTHORIZED", "Token danh tính không hợp lệ.");
            return;
        }

        var globalRoleClaim = context.User.FindFirst("globalRole")?.Value;
        Enum.TryParse<GlobalUserRole>(globalRoleClaim, ignoreCase: true, out var globalRole);

        // ── 2. Pipeline Classification: Group 2 - Platform Endpoints ──────────
        if (path.StartsWith("/api/platform/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/admin/", StringComparison.OrdinalIgnoreCase))
        {
            if (globalRole != GlobalUserRole.SuperAdmin)
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_FORBIDDEN", "Chỉ SuperAdmin nền tảng mới có quyền truy cập endpoint quản trị.");
                return;
            }

            userContext.SetUser(userId, string.Empty, globalRole);

            await _next(context);
            return;
        }

        // ── 3. Pipeline Classification: Group 3 - Context-Bootstrap & Switching Endpoints ──
        if (path.Equals("/api/auth/switch-context", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/me/memberships", StringComparison.OrdinalIgnoreCase))
        {
            userContext.SetUser(userId, string.Empty, globalRole);

            await _next(context);
            return;
        }

        // ── 3b. Pipeline Classification: Group 3b - Customer / Guest Portal Endpoints ──────
        // Authenticated customer/guest end-users accessing their own personal bookings, profile, or loyalty (Gate G3 / US3).
        // Guests belong to the B2C platform, not a specific tenant staff organization, and do not possess TenantId/PropertyId claims.
        if (path.StartsWith("/api/guest", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/loyalty", StringComparison.OrdinalIgnoreCase))
        {
            userContext.SetUser(userId, string.Empty, globalRole);

            await _next(context);
            return;
        }

        // ── 4. Pipeline Classification: Group 4 - Business Endpoints ───────────

        // SuperAdmin isolation per P0-D24 / GAP-04: Forbidden from business endpoints without Support Grant
        if (globalRole == GlobalUserRole.SuperAdmin)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_FORBIDDEN",
                "Platform Admin không được phép truy cập trực tiếp dữ liệu nghiệp vụ của khách hàng.");
            return;
        }

        // Claims Alias Integrity: (tenantId, tid)
        var tenantIdClaim = context.User.FindFirst("tenantId")?.Value;
        var tidClaim = context.User.FindFirst("tid")?.Value;

        if (!string.IsNullOrEmpty(tenantIdClaim) && !string.IsNullOrEmpty(tidClaim) &&
            !string.Equals(tenantIdClaim, tidClaim, StringComparison.OrdinalIgnoreCase))
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_TOKEN_TAMPERED",
                "Phát hiện chữ ký claims Tenant trong token bị mâu thuẫn hoặc làm giả.");
            return;
        }

        var effectiveTenantStr = tenantIdClaim ?? tidClaim;
        if (string.IsNullOrEmpty(effectiveTenantStr) || !Guid.TryParse(effectiveTenantStr, out var tenantId))
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_TENANT_REQUIRED",
                "Token không chứa thông tin Tenant context hợp lệ.");
            return;
        }

        // Claims Alias Integrity: (propertyId, pid)
        var propertyIdClaim = context.User.FindFirst("propertyId")?.Value;
        var pidClaim = context.User.FindFirst("pid")?.Value;

        if (!string.IsNullOrEmpty(propertyIdClaim) && !string.IsNullOrEmpty(pidClaim) &&
            !string.Equals(propertyIdClaim, pidClaim, StringComparison.OrdinalIgnoreCase))
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_TOKEN_TAMPERED",
                "Phát hiện chữ ký claims Property trong token bị mâu thuẫn hoặc làm giả.");
            return;
        }

        var effectivePropertyStr = propertyIdClaim ?? pidClaim;
        Guid? tokenPropertyId = Guid.TryParse(effectivePropertyStr, out var parsedTokenPropId)
            ? parsedTokenPropId
            : null;

        // Header Integrity & Anti-Tampering: X-Tenant-Id
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var xTenantVal))
        {
            if (!Guid.TryParse(xTenantVal.ToString(), out var headerTenantId) || headerTenantId != tenantId)
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status400BadRequest, "ERR_CONTEXT_MISMATCH",
                    "X-Tenant-Id gửi trong header không khớp với TenantId trong token xác thực.");
                return;
            }
        }

        // Header Integrity & Anti-Tampering: X-Property-Id
        Guid? targetPropertyId;
        Guid? parsedHeaderPropId = null;
        if (context.Request.Headers.TryGetValue("X-Property-Id", out var xPropVal))
        {
            if (!Guid.TryParse(xPropVal.ToString(), out var headerPropId))
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status400BadRequest, "ERR_CONTEXT_MISMATCH",
                    "Header X-Property-Id không đúng định dạng GUID hợp lệ.");
                return;
            }

            // If token has a property assigned and caller is NOT Tenant-Wide, caller cannot header-override to a different branch
            if (tokenPropertyId.HasValue && tokenPropertyId.Value != headerPropId)
            {
                var scopeClaim = context.User.FindFirst("scope")?.Value;
                if (!string.Equals(scopeClaim, "TenantWide", StringComparison.OrdinalIgnoreCase))
                {
                    await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_PROPERTY_FORBIDDEN",
                        "Nhân viên được gán chi nhánh cố định không thể thao tác trên chi nhánh khác.");
                    return;
                }
            }

            targetPropertyId = headerPropId;
            parsedHeaderPropId = headerPropId;
        }
        else
        {
            targetPropertyId = tokenPropertyId;
        }

        // ── Deterministic Membership Resolution via Database (Fail-Closed) ───
        MembershipLookupResult lookupResult;
        try
        {
            lookupResult = await membershipLookupService.ResolveMembershipAsync(
                tenantId,
                userId,
                targetPropertyId,
                context.RequestAborted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fail-Closed: Database connection error during membership resolution.");
            await WriteErrorResponseAsync(context, StatusCodes.Status503ServiceUnavailable, "ERR_SERVICE_UNAVAILABLE",
                "Hệ thống xác thực cơ sở dữ liệu tạm thời không phản hồi. Vui lòng thử lại sau.");
            return;
        }

        switch (lookupResult.Status)
        {
            case MembershipLookupStatus.UserNotFoundOrInactive:
                await WriteErrorResponseAsync(context, StatusCodes.Status401Unauthorized, "ERR_USER_DEACTIVATED",
                    lookupResult.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa.");
                return;

            case MembershipLookupStatus.TenantNotFoundOrInactive:
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_TENANT_INACTIVE",
                    lookupResult.ErrorMessage ?? "Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");
                return;

            case MembershipLookupStatus.PropertyNotFound:
                await WriteErrorResponseAsync(context, StatusCodes.Status404NotFound, "ERR_PROPERTY_NOT_FOUND",
                    lookupResult.ErrorMessage ?? "Chi nhánh không tồn tại hoặc không thuộc tổ chức doanh nghiệp này.");
                return;

            case MembershipLookupStatus.PropertyInactive:
                await WriteErrorResponseAsync(context, StatusCodes.Status409Conflict, "ERR_PROPERTY_INACTIVE",
                    lookupResult.ErrorMessage ?? "Chi nhánh hiện đang tạm ngưng hoạt động.");
                return;

            case MembershipLookupStatus.MembershipRevoked:
                // PO Decision 4: Exact membership inactive strictly blocks access. Zero fallback!
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_MEMBERSHIP_REVOKED",
                    lookupResult.ErrorMessage ?? "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
                return;

            case MembershipLookupStatus.PropertyForbidden:
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_PROPERTY_FORBIDDEN",
                    lookupResult.ErrorMessage ?? "Bạn không có quyền truy cập vào chi nhánh này.");
                return;

            case MembershipLookupStatus.PropertyRequired:
                // PO Decision 2: Staff without tenant-wide authority calling business endpoint without property is denied
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_PROPERTY_REQUIRED",
                    lookupResult.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
                return;

            case MembershipLookupStatus.NoMembership:
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_FORBIDDEN",
                    lookupResult.ErrorMessage ?? "Tài khoản không thuộc tổ chức doanh nghiệp này.");
                return;

            case MembershipLookupStatus.Success:
                break;

            default:
                await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "ERR_FORBIDDEN", "Truy cập bị từ chối.");
                return;
        }

        // ── Establish Scoped Request Context ──────────────────────────────────
        tenantService.TenantId = tenantId;
        propertyService.PropertyId = lookupResult.PropertyId;
        propertyService.IsTenantWide = lookupResult.IsTenantWide;
        propertyService.ExcludedPropertyIds = lookupResult.ExcludedPropertyIds;
        propertyService.HeaderPropertyId = parsedHeaderPropId;
        propertyService.TokenPropertyId = tokenPropertyId;

        userContext.SetUser(userId, string.Empty, globalRole);
        userContext.SetMembershipContext(
            tenantId,
            TenantStatus.Active,
            lookupResult.PropertyId,
            lookupResult.PropertyStatus ?? PropertyStatus.Active,
            lookupResult.StaffRole,
            lookupResult.RoleId,
            lookupResult.IsTenantWide);

        await _next(context);
    }

    private static bool IsPublicEndpoint(HttpContext context, string path)
    {
        // Finding 1 (Critical): POST .../confirm requires authenticated staff and is never an anonymous public endpoint
        if (path.StartsWith("/api/public/bookings/", StringComparison.OrdinalIgnoreCase) &&
            path.EndsWith("/confirm", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (context.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            return true;
        }

        if (path.StartsWith("/api/public", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/print", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/health", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/register", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/partner-register", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/social-login", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/refresh-token", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    private static async Task WriteErrorResponseAsync(
        HttpContext context,
        int statusCode,
        string errorCode,
        string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var payload = new
        {
            type = statusCode switch
            {
                StatusCodes.Status400BadRequest => "BadRequest",
                StatusCodes.Status401Unauthorized => "Unauthorized",
                StatusCodes.Status403Forbidden => "Forbidden",
                StatusCodes.Status409Conflict => "Conflict",
                StatusCodes.Status503ServiceUnavailable => "ServiceUnavailable",
                _ => "Error"
            },
            title = message,
            status = statusCode,
            errorCode = errorCode
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }
}
