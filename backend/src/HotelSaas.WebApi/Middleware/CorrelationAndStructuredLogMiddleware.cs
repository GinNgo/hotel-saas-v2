using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.WebApi.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Serilog.Context;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Thread-safe in-memory Prometheus metrics registry for Hotel SaaS Platform v2.
/// Tracks HTTP latency, multi-tenant isolation blocks, SignalR connections, VNPay IPN, SePay webhooks, and 429 rate limits.
/// </summary>
public static class SystemMetricsRegistry
{
    private const int MaxMetricCardinality = 256;
    private static readonly object CardinalityLock = new();

    private static readonly double[] LatencyBucketBounds = [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];
    private static readonly string[] LatencyBucketLabels = ["0.05", "0.1", "0.25", "0.5", "1", "2.5", "5"];
    private static readonly long[] LatencyBucketCounts = new long[LatencyBucketBounds.Length];
    private static long _latencyTotalCount;
    private static long _latencyTotalMicroseconds;

    private static readonly string[] KnownSepayWebhookStatuses =
    [
        "confirmed",
        "partial",
        "duplicate",
        "ignored",
        "expired_hold_alert",
        "rejected_unconfigured_bank_account",
        "auth_failed",
        "error"
    ];

    private static readonly string[] KnownRateLimitPolicies =
    [
        "auth",
        "webhooks",
        "public-print",
        "public-api",
        "ai-chat"
    ];

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
    private static readonly ConcurrentDictionary<string, long> SepayWebhookCounts = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, long> RateLimitedCounts = new(StringComparer.OrdinalIgnoreCase);

    static SystemMetricsRegistry()
    {
        foreach (var status in KnownSepayWebhookStatuses)
        {
            SepayWebhookCounts.TryAdd(status, 0);
        }

        foreach (var policy in KnownRateLimitPolicies)
        {
            RateLimitedCounts.TryAdd(policy, 0);
        }
    }

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

        var clampedElapsedMs = Math.Max(0d, elapsedMs);
        var elapsedSeconds = clampedElapsedMs / 1000.0;
        Interlocked.Increment(ref _latencyTotalCount);
        Interlocked.Add(ref _latencyTotalMicroseconds, (long)Math.Round(clampedElapsedMs * 1000.0));
        for (var i = 0; i < LatencyBucketBounds.Length; i++)
        {
            if (elapsedSeconds <= LatencyBucketBounds[i])
            {
                Interlocked.Increment(ref LatencyBucketCounts[i]);
            }
        }

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

    public static void RecordSepayWebhook(string status)
    {
        var normalized = string.IsNullOrWhiteSpace(status) ? "unknown" : status.Trim().ToLowerInvariant();
        IncrementBounded(SepayWebhookCounts, normalized, "other_overflow");
    }

    public static void RecordRateLimited(string policy)
    {
        var normalized = string.IsNullOrWhiteSpace(policy) ? "default" : policy.Trim().ToLowerInvariant();
        IncrementBounded(RateLimitedCounts, normalized, "other_overflow");
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

        sb.AppendLine("# HELP hotelsaas_http_request_duration_seconds HTTP request latency distribution in seconds.");
        sb.AppendLine("# TYPE hotelsaas_http_request_duration_seconds histogram");
        long runningBucketCount = 0;
        for (var i = 0; i < LatencyBucketLabels.Length; i++)
        {
            var bucketCount = Interlocked.Read(ref LatencyBucketCounts[i]);
            if (bucketCount > runningBucketCount)
            {
                runningBucketCount = bucketCount;
            }
            sb.AppendLine($"hotelsaas_http_request_duration_seconds_bucket{{le=\"{LatencyBucketLabels[i]}\"}} {runningBucketCount}");
        }
        var totalLatencyCount = Math.Max(runningBucketCount, Interlocked.Read(ref _latencyTotalCount));
        var totalLatencySeconds = Interlocked.Read(ref _latencyTotalMicroseconds) / 1_000_000.0;
        sb.AppendLine($"hotelsaas_http_request_duration_seconds_bucket{{le=\"+Inf\"}} {totalLatencyCount}");
        sb.AppendLine($"hotelsaas_http_request_duration_seconds_sum {totalLatencySeconds.ToString("0.######", CultureInfo.InvariantCulture)}");
        sb.AppendLine($"hotelsaas_http_request_duration_seconds_count {totalLatencyCount}");

        sb.AppendLine("# HELP hotelsaas_sepay_webhook_total Total SePay VietQR webhook callbacks grouped by processing status.");
        sb.AppendLine("# TYPE hotelsaas_sepay_webhook_total counter");
        foreach (var kvp in SepayWebhookCounts.OrderBy(k => k.Key, StringComparer.Ordinal))
        {
            sb.AppendLine($"hotelsaas_sepay_webhook_total{{status=\"{EscapeLabelValue(kvp.Key)}\"}} {kvp.Value}");
        }

        sb.AppendLine("# HELP hotelsaas_rate_limited_total Total HTTP 429 Too Many Requests responses grouped by rate limiter policy.");
        sb.AppendLine("# TYPE hotelsaas_rate_limited_total counter");
        foreach (var kvp in RateLimitedCounts.OrderBy(k => k.Key, StringComparer.Ordinal))
        {
            sb.AppendLine($"hotelsaas_rate_limited_total{{policy=\"{EscapeLabelValue(kvp.Key)}\"}} {kvp.Value}");
        }

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
    public void RecordSepayWebhook(string status) => SystemMetricsRegistry.RecordSepayWebhook(status);
    public void RecordRateLimited(string policy) => SystemMetricsRegistry.RecordRateLimited(policy);
}

/// <summary>
/// Enriches every request with a Correlation ID (X-Correlation-Id), pushes multi-tenant and branch
/// context properties into Serilog structured LogContext, and records Prometheus operational metrics.
/// </summary>
public sealed class CorrelationAndStructuredLogMiddleware
{
    public const string CorrelationIdHeaderName = "X-Correlation-Id";
    public const string RequestStartTimestampItemKey = "RequestStartTimestamp";
    public const string RequestPayloadItemKey = "RequestPayload";
    public const string ResponsePayloadItemKey = "ResponsePayload";
    private const int MaxPayloadCaptureChars = 16384;
    private const long MaxRequestBodyContentLength = 65536;

    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationAndStructuredLogMiddleware> _logger;

    public CorrelationAndStructuredLogMiddleware(
        RequestDelegate next,
        ILogger<CorrelationAndStructuredLogMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public static bool IsObservabilityProbePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        var normalized = path.Length > 1 ? path.TrimEnd('/') : path;
        return normalized.Equals("/health", StringComparison.OrdinalIgnoreCase) ||
               normalized.Equals("/health/live", StringComparison.OrdinalIgnoreCase) ||
               normalized.Equals("/health/ready", StringComparison.OrdinalIgnoreCase) ||
               normalized.Equals("/metrics", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsPayloadCaptureEligiblePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        return path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) &&
               !path.StartsWith("/api/platform/observability/logs", StringComparison.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(
        HttpContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext)
    {
        var correlationId = ResolveOrGenerateCorrelationId(context);
        context.Items[CorrelationIdHeaderName] = correlationId;
        context.Items["CorrelationId"] = correlationId;
        context.Items[RequestStartTimestampItemKey] = Stopwatch.GetTimestamp();
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
        var observabilityControl = context.RequestServices.GetService(typeof(IObservabilityControlService)) as IObservabilityControlService;
        var capturePayload = (observabilityControl?.IsPayloadLoggingEnabled ?? false) &&
                             IsPayloadCaptureEligiblePath(path);

        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("ClientIp", clientIp))
        using (LogContext.PushProperty("RequestMethod", method))
        using (LogContext.PushProperty("RequestPath", path))
        {
            string? capturedRequestPayload = null;
            if (capturePayload &&
                IsJsonContentType(context.Request.ContentType) &&
                (!context.Request.ContentLength.HasValue || context.Request.ContentLength.Value <= MaxRequestBodyContentLength))
            {
                context.Request.EnableBuffering();
                using var reqReader = new StreamReader(
                    context.Request.Body,
                    Encoding.UTF8,
                    detectEncodingFromByteOrderMarks: false,
                    bufferSize: 1024,
                    leaveOpen: true);
                var rawRequest = await ReadBoundedAsync(reqReader, MaxPayloadCaptureChars);
                if (context.Request.Body.CanSeek)
                {
                    context.Request.Body.Position = 0;
                }

                capturedRequestPayload = ObservabilityControlService.SanitizePayload(rawRequest);
                if (!string.IsNullOrWhiteSpace(capturedRequestPayload))
                {
                    context.Items[RequestPayloadItemKey] = capturedRequestPayload;
                }
            }

            string? capturedResponsePayload = null;
            if (capturePayload)
            {
                var originalBody = context.Response.Body;
                using var responseBuffer = new MemoryStream();
                context.Response.Body = responseBuffer;
                try
                {
                    await _next(context);
                }
                finally
                {
                    context.Response.Body = originalBody;
                    if (responseBuffer.Length > 0)
                    {
                        responseBuffer.Position = 0;
                        await responseBuffer.CopyToAsync(originalBody);

                        if (IsJsonContentType(context.Response.ContentType))
                        {
                            responseBuffer.Position = 0;
                            using var respReader = new StreamReader(
                                responseBuffer,
                                Encoding.UTF8,
                                detectEncodingFromByteOrderMarks: false,
                                bufferSize: 1024,
                                leaveOpen: true);
                            var rawResponse = await ReadBoundedAsync(respReader, MaxPayloadCaptureChars);
                            capturedResponsePayload = ObservabilityControlService.SanitizePayload(rawResponse);
                            if (!string.IsNullOrWhiteSpace(capturedResponsePayload))
                            {
                                context.Items[ResponsePayloadItemKey] = capturedResponsePayload;
                            }
                        }
                    }
                }
            }
            else
            {
                await _next(context);
            }

            sw.Stop();

            var tenantId = tenantService.TenantId;
            var propertyId = propertyService.PropertyId;
            var isTenantWide = propertyService.IsTenantWide;
            var statusCode = context.Response.StatusCode;
            var elapsedMs = Math.Round(sw.Elapsed.TotalMilliseconds, 2);

            using (LogContext.PushProperty("TenantId", tenantId?.ToString() ?? "anonymous"))
            using (LogContext.PushProperty("PropertyId", propertyId?.ToString() ?? (isTenantWide ? "tenant-wide" : "unscoped")))
            using (LogContext.PushProperty("UserId", userContext.IsAuthenticated && userContext.UserId != Guid.Empty ? userContext.UserId.ToString() : "anonymous"))
            using (LogContext.PushProperty("StatusCode", statusCode))
            using (LogContext.PushProperty("ElapsedMs", elapsedMs))
            using (!string.IsNullOrWhiteSpace(capturedRequestPayload)
                ? LogContext.PushProperty(RequestPayloadItemKey, capturedRequestPayload)
                : null)
            using (!string.IsNullOrWhiteSpace(capturedResponsePayload)
                ? LogContext.PushProperty(ResponsePayloadItemKey, capturedResponsePayload)
                : null)
            {
                var errorCode = context.Items.TryGetValue("ErrorCode", out var codeObj) ? codeObj?.ToString() : null;
                if (!IsObservabilityProbePath(path))
                {
                    SystemMetricsRegistry.RecordHttpRequest(method, path, statusCode, elapsedMs, tenantId, propertyId, errorCode);
                }

                var exceptionAlreadyLogged = context.Items.TryGetValue(ExceptionHandlingMiddleware.ExceptionLoggedItemKey, out var loggedObj)
                    && loggedObj is true;
                var structuredLoggingEnabled = observabilityControl?.IsStructuredRequestLoggingEnabled ?? true;

                if (structuredLoggingEnabled && statusCode >= 500 && !exceptionAlreadyLogged)
                {
                    _logger.LogError(
                        "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]",
                        method, path, statusCode, elapsedMs, correlationId, tenantId, propertyId);
                }
                else if (structuredLoggingEnabled && statusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
                {
                    _logger.LogWarning(
                        "Security/Isolation Gate: HTTP {Method} {Path} blocked with {StatusCode} ({ErrorCode}) in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]",
                        method, path, statusCode, errorCode ?? "AUTH_DENIED", elapsedMs, correlationId, tenantId, propertyId);
                }
                else if (capturePayload &&
                         (!string.IsNullOrWhiteSpace(capturedRequestPayload) || !string.IsNullOrWhiteSpace(capturedResponsePayload)))
                {
                    _logger.LogInformation(
                        "HTTP Payload {Method} {Path} responded {StatusCode} in {ElapsedMs}ms [CorrelationId={CorrelationId}]",
                        method, path, statusCode, elapsedMs, correlationId);
                }
            }
        }
    }

    private static bool IsJsonContentType(string? contentType)
    {
        return !string.IsNullOrWhiteSpace(contentType) &&
               contentType.Contains("json", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> ReadBoundedAsync(StreamReader reader, int maxChars)
    {
        var buffer = new char[Math.Min(maxChars, 1024)];
        var sb = new StringBuilder();
        while (sb.Length < maxChars)
        {
            var toRead = Math.Min(buffer.Length, maxChars - sb.Length);
            var read = await reader.ReadAsync(buffer.AsMemory(0, toRead));
            if (read <= 0)
            {
                break;
            }
            sb.Append(buffer, 0, read);
        }
        return sb.ToString();
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
