using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Serilog.Context;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Thread-safe in-memory Prometheus metrics registry for Hotel SaaS Platform v2.
/// Tracks HTTP latency, multi-tenant isolation blocks, SignalR connections, and VNPay IPN statuses.
/// </summary>
public static class SystemMetricsRegistry
{
    private const int MaxMetricCardinality = 256;
    private static readonly object CardinalityLock = new();

    private static long _totalRequests;
    private static long _totalErrors5xx;
    private static long _totalIsolationBlocks;
    private static long _activeSignalRConnections;
    private static long _vnpayIpnSuccessCount;
    private static long _vnpayIpnOrderNotFoundCount;
    private static long _vnpayIpnDuplicateCount;
    private static long _vnpayIpnInvalidAmountCount;
    private static long _vnpayIpnInvalidChecksumCount;

    private static readonly ConcurrentDictionary<string, long> RouteRequestCounts = new();
    private static readonly ConcurrentDictionary<string, long> IsolationBlockReasons = new();
    private static readonly ConcurrentDictionary<string, long> TenantActiveRequests = new();

    public static void RecordHttpRequest(
        string method,
        string path,
        int statusCode,
        double elapsedMs,
        Guid? tenantId,
        Guid? propertyId,
        string? errorCode = null)
    {
        Interlocked.Increment(ref _totalRequests);

        var normalizedRoute = NormalizeRoute(path);
        if (statusCode == StatusCodes.Status404NotFound &&
            !normalizedRoute.StartsWith("/api/", StringComparison.Ordinal) &&
            !normalizedRoute.StartsWith("/hubs/", StringComparison.Ordinal) &&
            !normalizedRoute.StartsWith("/health", StringComparison.Ordinal))
        {
            normalizedRoute = "/_unmatched";
        }

        var key = $"{method}:{normalizedRoute}:{statusCode}";
        IncrementBounded(RouteRequestCounts, key, $"OTHER:/_overflow:{statusCode}", "OTHER:/_overflow:other");

        if (statusCode >= 500)
        {
            Interlocked.Increment(ref _totalErrors5xx);
        }

        if (tenantId.HasValue)
        {
            var tenantKey = $"{tenantId.Value}:{propertyId?.ToString() ?? "tenant-wide"}";
            IncrementBounded(TenantActiveRequests, tenantKey, "_overflow");
        }

        if (statusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden or StatusCodes.Status400BadRequest &&
            !string.IsNullOrEmpty(errorCode) &&
            (errorCode.Contains("TENANT", StringComparison.OrdinalIgnoreCase) ||
             errorCode.Contains("PROPERTY", StringComparison.OrdinalIgnoreCase) ||
             errorCode.Contains("CONTEXT_MISMATCH", StringComparison.OrdinalIgnoreCase) ||
             errorCode.Contains("TOKEN_TAMPERED", StringComparison.OrdinalIgnoreCase) ||
             errorCode.Contains("MEMBERSHIP_REVOKED", StringComparison.OrdinalIgnoreCase)))
        {
            RecordIsolationBlock(errorCode);
        }
    }

    public static void RecordIsolationBlock(string errorCode)
    {
        var normalizedCode = string.IsNullOrWhiteSpace(errorCode) ? "UNKNOWN_BLOCK" : errorCode.Trim();
        Interlocked.Increment(ref _totalIsolationBlocks);
        IncrementBounded(IsolationBlockReasons, normalizedCode, "OTHER_OVERFLOW");
    }

    public static (int RouteKeys, int IsolationReasonKeys, int TenantActiveKeys) GetCardinalitySnapshot() =>
        (RouteRequestCounts.Count, IsolationBlockReasons.Count, TenantActiveRequests.Count);

    private static void IncrementBounded(
        ConcurrentDictionary<string, long> dict,
        string key,
        string overflowKey,
        string? fallbackOverflowKey = null)
    {
        if (dict.ContainsKey(key))
        {
            dict.AddOrUpdate(key, 1, (_, c) => c + 1);
            return;
        }

        lock (CardinalityLock)
        {
            if (dict.ContainsKey(key))
            {
                dict.AddOrUpdate(key, 1, (_, c) => c + 1);
                return;
            }

            if (dict.Count < MaxMetricCardinality - 1)
            {
                dict.AddOrUpdate(key, 1, (_, c) => c + 1);
                return;
            }

            if (dict.ContainsKey(overflowKey) || dict.Count < MaxMetricCardinality)
            {
                dict.AddOrUpdate(overflowKey, 1, (_, c) => c + 1);
                return;
            }

            if (!string.IsNullOrEmpty(fallbackOverflowKey) &&
                (dict.ContainsKey(fallbackOverflowKey) || dict.Count < MaxMetricCardinality))
            {
                dict.AddOrUpdate(fallbackOverflowKey, 1, (_, c) => c + 1);
                return;
            }

            foreach (var existing in dict.Keys)
            {
                if (existing.StartsWith("OTHER:/_overflow:", StringComparison.Ordinal))
                {
                    dict.AddOrUpdate(existing, 1, (_, c) => c + 1);
                    return;
                }
            }
        }
    }

    public static void RecordVnpayIpnResult(string rspCode)
    {
        switch (rspCode)
        {
            case "00":
                Interlocked.Increment(ref _vnpayIpnSuccessCount);
                break;
            case "01":
                Interlocked.Increment(ref _vnpayIpnOrderNotFoundCount);
                break;
            case "02":
                Interlocked.Increment(ref _vnpayIpnDuplicateCount);
                break;
            case "04":
                Interlocked.Increment(ref _vnpayIpnInvalidAmountCount);
                break;
            case "97":
                Interlocked.Increment(ref _vnpayIpnInvalidChecksumCount);
                break;
        }
    }

    public static void IncrementSignalRConnection() => Interlocked.Increment(ref _activeSignalRConnections);

    public static void DecrementSignalRConnection()
    {
        while (true)
        {
            var current = Interlocked.Read(ref _activeSignalRConnections);
            if (current <= 0)
            {
                return;
            }

            if (Interlocked.CompareExchange(ref _activeSignalRConnections, current - 1, current) == current)
            {
                return;
            }
        }
    }

    public static string ExportPrometheusText()
    {
        var sb = new StringBuilder();
        sb.AppendLine("# HELP hotelsaas_http_requests_total Total number of HTTP requests processed.");
        sb.AppendLine("# TYPE hotelsaas_http_requests_total counter");
        sb.AppendLine($"hotelsaas_http_requests_total {Interlocked.Read(ref _totalRequests)}");

        sb.AppendLine("# HELP hotelsaas_http_5xx_errors_total Total number of HTTP 5xx server errors.");
        sb.AppendLine("# TYPE hotelsaas_http_5xx_errors_total counter");
        sb.AppendLine($"hotelsaas_http_5xx_errors_total {Interlocked.Read(ref _totalErrors5xx)}");

        sb.AppendLine("# HELP hotelsaas_tenant_isolation_blocks_total Total cross-tenant or cross-branch access attempts blocked by fail-closed guards.");
        sb.AppendLine("# TYPE hotelsaas_tenant_isolation_blocks_total counter");
        sb.AppendLine($"hotelsaas_tenant_isolation_blocks_total {Interlocked.Read(ref _totalIsolationBlocks)}");

        if (!IsolationBlockReasons.IsEmpty)
        {
            sb.AppendLine("# HELP hotelsaas_tenant_isolation_blocks_by_reason_total Cross-tenant or cross-branch isolation blocks grouped by error code.");
            sb.AppendLine("# TYPE hotelsaas_tenant_isolation_blocks_by_reason_total counter");
            foreach (var kvp in IsolationBlockReasons)
            {
                sb.AppendLine($"hotelsaas_tenant_isolation_blocks_by_reason_total{{error_code=\"{EscapeLabelValue(kvp.Key)}\"}} {kvp.Value}");
            }
        }

        sb.AppendLine("# HELP hotelsaas_signalr_active_connections Current active SignalR NotificationHub connections.");
        sb.AppendLine("# TYPE hotelsaas_signalr_active_connections gauge");
        sb.AppendLine($"hotelsaas_signalr_active_connections {Math.Max(0, Interlocked.Read(ref _activeSignalRConnections))}");

        sb.AppendLine("# HELP hotelsaas_vnpay_ipn_total Total VNPay IPN webhook callbacks by response code.");
        sb.AppendLine("# TYPE hotelsaas_vnpay_ipn_total counter");
        sb.AppendLine($"hotelsaas_vnpay_ipn_total{{rsp_code=\"00\"}} {Interlocked.Read(ref _vnpayIpnSuccessCount)}");
        sb.AppendLine($"hotelsaas_vnpay_ipn_total{{rsp_code=\"01\"}} {Interlocked.Read(ref _vnpayIpnOrderNotFoundCount)}");
        sb.AppendLine($"hotelsaas_vnpay_ipn_total{{rsp_code=\"02\"}} {Interlocked.Read(ref _vnpayIpnDuplicateCount)}");
        sb.AppendLine($"hotelsaas_vnpay_ipn_total{{rsp_code=\"04\"}} {Interlocked.Read(ref _vnpayIpnInvalidAmountCount)}");
        sb.AppendLine($"hotelsaas_vnpay_ipn_total{{rsp_code=\"97\"}} {Interlocked.Read(ref _vnpayIpnInvalidChecksumCount)}");

        if (!RouteRequestCounts.IsEmpty)
        {
            sb.AppendLine("# HELP hotelsaas_http_route_requests_total Total HTTP requests grouped by method, normalized route, and status code.");
            sb.AppendLine("# TYPE hotelsaas_http_route_requests_total counter");
            foreach (var kvp in RouteRequestCounts)
            {
                var parts = kvp.Key.Split(':');
                if (parts.Length == 3)
                {
                    sb.AppendLine($"hotelsaas_http_route_requests_total{{method=\"{EscapeLabelValue(parts[0])}\",route=\"{EscapeLabelValue(parts[1])}\",status=\"{EscapeLabelValue(parts[2])}\"}} {kvp.Value}");
                }
            }
        }

        return sb.ToString();
    }

    private static string EscapeLabelValue(string value) =>
        value.Replace("\\", "\\\\").Replace("\"", "\\\"");

    private static string NormalizeRoute(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "/";
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < segments.Length; i++)
        {
            if (Guid.TryParse(segments[i], out _))
            {
                segments[i] = "{id}";
            }
        }
        return "/" + string.Join("/", segments).ToLowerInvariant();
    }
}

/// <summary>
/// Singleton implementation of <see cref="ISystemMetricsRecorder"/> delegating to <see cref="SystemMetricsRegistry"/>.
/// </summary>
public sealed class SystemMetricsRecorder : ISystemMetricsRecorder
{
    public void RecordVnpayIpnResult(string rspCode) => SystemMetricsRegistry.RecordVnpayIpnResult(rspCode);
    public void IncrementSignalRConnection() => SystemMetricsRegistry.IncrementSignalRConnection();
    public void DecrementSignalRConnection() => SystemMetricsRegistry.DecrementSignalRConnection();
    public void RecordIsolationBlock(string errorCode) => SystemMetricsRegistry.RecordIsolationBlock(errorCode);
}

/// <summary>
/// Enriches every request with a Correlation ID (X-Correlation-Id), pushes multi-tenant and branch
/// context properties into Serilog structured LogContext, and records Prometheus operational metrics.
/// </summary>
public sealed class CorrelationAndStructuredLogMiddleware
{
    public const string CorrelationIdHeaderName = "X-Correlation-Id";

    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationAndStructuredLogMiddleware> _logger;

    public CorrelationAndStructuredLogMiddleware(
        RequestDelegate next,
        ILogger<CorrelationAndStructuredLogMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(
        HttpContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext)
    {
        var correlationId = ResolveOrGenerateCorrelationId(context);
        context.Items[CorrelationIdHeaderName] = correlationId;
        if (!context.Response.Headers.ContainsKey(CorrelationIdHeaderName))
        {
            context.Response.Headers[CorrelationIdHeaderName] = correlationId;
        }
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey(CorrelationIdHeaderName))
            {
                context.Response.Headers[CorrelationIdHeaderName] = correlationId;
            }
            return Task.CompletedTask;
        });

        var sw = Stopwatch.StartNew();
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? "/";
        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("ClientIp", clientIp))
        using (LogContext.PushProperty("RequestMethod", method))
        using (LogContext.PushProperty("RequestPath", path))
        {
            await _next(context);
            sw.Stop();

            var tenantId = tenantService.TenantId;
            var propertyId = propertyService.PropertyId;
            var isTenantWide = propertyService.IsTenantWide;
            var userId = userContext.UserId;
            var statusCode = context.Response.StatusCode;
            var elapsedMs = Math.Round(sw.Elapsed.TotalMilliseconds, 2);

            using (LogContext.PushProperty("TenantId", tenantId?.ToString() ?? "anonymous"))
            using (LogContext.PushProperty("PropertyId", propertyId?.ToString() ?? (isTenantWide ? "tenant-wide" : "unscoped")))
            using (LogContext.PushProperty("UserId", userContext.IsAuthenticated && userContext.UserId != Guid.Empty ? userContext.UserId.ToString() : "anonymous"))
            using (LogContext.PushProperty("StatusCode", statusCode))
            using (LogContext.PushProperty("ElapsedMs", elapsedMs))
            {
                var errorCode = context.Items.TryGetValue("ErrorCode", out var codeObj) ? codeObj?.ToString() : null;
                SystemMetricsRegistry.RecordHttpRequest(method, path, statusCode, elapsedMs, tenantId, propertyId, errorCode);

                if (statusCode >= 500)
                {
                    _logger.LogError(
                        "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]",
                        method, path, statusCode, elapsedMs, correlationId, tenantId, propertyId);
                }
                else if (statusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
                {
                    _logger.LogWarning(
                        "Security/Isolation Gate: HTTP {Method} {Path} blocked with {StatusCode} ({ErrorCode}) in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]",
                        method, path, statusCode, errorCode ?? "AUTH_DENIED", elapsedMs, correlationId, tenantId, propertyId);
                }
            }
        }
    }

    private static string ResolveOrGenerateCorrelationId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(CorrelationIdHeaderName, out var existing) &&
            !string.IsNullOrWhiteSpace(existing))
        {
            return existing.ToString().Trim();
        }

        return $"req-{Guid.NewGuid():N}";
    }
}
