using System.Text.Json;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using Serilog.Context;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Middleware bắt mọi exception và map thành chuẩn ApiResponse.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    public const string ExceptionLoggedItemKey = "ExceptionLogged";

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Khởi tạo instance mới của <see cref="ExceptionHandlingMiddleware"/>.
    /// </summary>
    /// <param name="next">Request delegate kế tiếp trong pipeline.</param>
    /// <param name="logger">Logger ghi log ngoại lệ.</param>
    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Xử lý HTTP request và bắt mọi ngoại lệ phát sinh để chuyển đổi thành ApiResponse chuẩn.
    /// </summary>
    /// <param name="context">Http context của request hiện tại.</param>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, response) = exception switch
        {
            ValidationException ex => (StatusCodes.Status400BadRequest, ApiResponse.ValidationFail(ex.Errors)),
            BadRequestException ex => (StatusCodes.Status400BadRequest, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            UnprocessableEntityException ex => (StatusCodes.Status422UnprocessableEntity, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            NotFoundException ex => (StatusCodes.Status404NotFound, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            KeyNotFoundException ex => (StatusCodes.Status404NotFound, ApiResponse.Fail("ERR_NOT_FOUND", ex.Message)),
            ConflictException ex => (StatusCodes.Status409Conflict, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            DbUpdateException ex when TryGetPostgresExclusionViolation(ex, out var exclConstraint) &&
                                      (string.Equals(exclConstraint, "EXCLUDE_RoomTypeRates_NoOverlap", StringComparison.OrdinalIgnoreCase) ||
                                       exclConstraint?.Contains("RoomTypeRates", StringComparison.OrdinalIgnoreCase) == true) =>
                (StatusCodes.Status409Conflict, ApiResponse.Fail("ERR_RATE_OVERLAP", "Khoảng ngày hiệu lực bị chồng lấn với bảng giá hiện có của loại phòng này.")),
            DbUpdateException ex when TryGetPostgresUniqueViolation(ex, out var constraint) &&
                                      (string.Equals(constraint, "UX_Room_PropertyId_RoomNumber", StringComparison.OrdinalIgnoreCase) ||
                                       string.Equals(constraint, "UX_RoomType_PropertyId_Code", StringComparison.OrdinalIgnoreCase)) =>
                string.Equals(constraint, "UX_Room_PropertyId_RoomNumber", StringComparison.OrdinalIgnoreCase)
                    ? (StatusCodes.Status409Conflict, ApiResponse.Fail("ERR_CONFLICT", "Số phòng đã tồn tại trong chi nhánh này."))
                    : (StatusCodes.Status409Conflict, ApiResponse.Fail("ERR_CONFLICT", "Mã loại phòng đã tồn tại trong chi nhánh này.")),
            InvalidOperationException ex when (
                ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("đã được sử dụng", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("đã tồn tại", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("đang có", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("chi nhánh", StringComparison.OrdinalIgnoreCase)) => (StatusCodes.Status409Conflict, ApiResponse.Fail("ERR_CONFLICT", ex.Message)),
            ForbiddenException ex => (StatusCodes.Status403Forbidden, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            UnauthorizedAccessException ex => (
                StatusCodes.Status401Unauthorized,
                ex.Message.StartsWith("ERR_") && ex.Message.IndexOf(':') > 0
                    ? ApiResponse.Fail(ex.Message[..ex.Message.IndexOf(':')].Trim(), ex.Message[(ex.Message.IndexOf(':') + 1)..].Trim())
                    : ApiResponse.Fail("ERR_UNAUTHORIZED", ex.Message)),
            _ => (StatusCodes.Status500InternalServerError, ApiResponse.Fail("ERR_SYSTEM", "Đã xảy ra lỗi hệ thống."))
        };

        var errorCode = response.ErrorCode ?? "ERR_SYSTEM";
        var correlationId = ResolveCorrelationId(context);
        response.CorrelationId = correlationId;

        context.Items["ErrorCode"] = errorCode;
        context.Items[ExceptionLoggedItemKey] = true;

        var tenantService = context.RequestServices?.GetService<ICurrentTenantService>();
        var propertyService = context.RequestServices?.GetService<ICurrentPropertyService>();
        var userContext = context.RequestServices?.GetService<ICurrentUserContext>();

        var tenantId = tenantService?.TenantId?.ToString() ?? "anonymous";
        var isTenantWide = propertyService?.IsTenantWide ?? false;
        var propertyId = propertyService?.PropertyId?.ToString() ?? (isTenantWide ? "tenant-wide" : "unscoped");
        var userId = userContext is { IsAuthenticated: true } && userContext.UserId != Guid.Empty
            ? userContext.UserId.ToString()
            : "anonymous";

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("TenantId", tenantId))
        using (LogContext.PushProperty("PropertyId", propertyId))
        using (LogContext.PushProperty("UserId", userId))
        using (LogContext.PushProperty("ErrorCode", errorCode))
        using (LogContext.PushProperty("StatusCode", statusCode))
        {
            if (statusCode >= 500)
                _logger.LogError(exception, "System error {ErrorCode} on {Method} {Path}", errorCode, context.Request.Method, context.Request.Path.Value);
            else
                _logger.LogWarning(exception, "Client error {ErrorCode} ({StatusCode}) on {Method} {Path}", errorCode, statusCode, context.Request.Method, context.Request.Path.Value);
        }

        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        if (context.Items.TryGetValue("CorrelationId", out var corrObj) &&
            corrObj is string corrStr && !string.IsNullOrWhiteSpace(corrStr))
        {
            return corrStr;
        }

        if (context.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var itemObj) &&
            itemObj is string itemStr && !string.IsNullOrWhiteSpace(itemStr))
        {
            return itemStr;
        }

        if (context.Response.Headers.TryGetValue(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var hdrVal) &&
            !string.IsNullOrWhiteSpace(hdrVal))
        {
            return hdrVal.ToString();
        }

        return context.TraceIdentifier;
    }

    private static bool TryGetPostgresUniqueViolation(DbUpdateException ex, out string? constraintName)
    {
        var current = ex.InnerException;
        while (current != null)
        {
            if (current is PostgresException pgEx && pgEx.SqlState == "23505")
            {
                constraintName = pgEx.ConstraintName;
                return true;
            }
            current = current.InnerException;
        }

        constraintName = null;
        return false;
    }

    private static bool TryGetPostgresExclusionViolation(DbUpdateException ex, out string? constraintName)
    {
        var current = ex.InnerException;
        while (current != null)
        {
            if (current is PostgresException pgEx && pgEx.SqlState == "23P01")
            {
                constraintName = pgEx.ConstraintName;
                return true;
            }
            current = current.InnerException;
        }

        constraintName = null;
        return false;
    }
}
