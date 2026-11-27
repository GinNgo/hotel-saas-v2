using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Serilog.Core;
using Serilog.Events;

namespace HotelSaas.WebApi.Services;

/// <summary>
/// Thread-safe singleton managing runtime Serilog level, metrics toggle, PLG probes, and safe Loki log queries.
/// </summary>
public sealed class ObservabilityControlService : IObservabilityControlService
{
    public const string HttpClientName = "Observability";

    private static readonly IReadOnlyDictionary<string, LogEventLevel> AllowedLevels =
        new Dictionary<string, LogEventLevel>(StringComparer.OrdinalIgnoreCase)
        {
            ["Verbose"] = LogEventLevel.Verbose,
            ["Debug"] = LogEventLevel.Debug,
            ["Information"] = LogEventLevel.Information,
            ["Warning"] = LogEventLevel.Warning,
            ["Error"] = LogEventLevel.Error,
            ["Fatal"] = LogEventLevel.Fatal
        };

    private static readonly HashSet<string> QueryableLevels =
        new(StringComparer.OrdinalIgnoreCase) { "Debug", "Information", "Warning", "Error", "Fatal" };

    private readonly LoggingLevelSwitch _levelSwitch;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _lokiUrl;
    private readonly string _prometheusUrl;
    private readonly string _grafanaUrl;
    private readonly object _sync = new();

    private volatile bool _metricsExportEnabled = true;
    private volatile bool _structuredRequestLoggingEnabled = true;
    private DateTime? _updatedAtUtc;
    private Guid? _updatedByUserId;

    public ObservabilityControlService(
        LoggingLevelSwitch levelSwitch,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _levelSwitch = levelSwitch ?? throw new ArgumentNullException(nameof(levelSwitch));
        _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        ArgumentNullException.ThrowIfNull(configuration);

        _lokiUrl = NormalizeBaseUrl(configuration["Observability:LokiUrl"]);
        _prometheusUrl = NormalizeBaseUrl(configuration["Observability:PrometheusUrl"]);
        _grafanaUrl = NormalizeBaseUrl(configuration["Observability:GrafanaUrl"]);
    }

    public bool IsMetricsExportEnabled => _metricsExportEnabled;

    public bool IsStructuredRequestLoggingEnabled => _structuredRequestLoggingEnabled;

    public ObservabilitySettingsDto GetSettings()
    {
        lock (_sync)
        {
            return new ObservabilitySettingsDto(
                MinimumLogLevel: _levelSwitch.MinimumLevel.ToString(),
                MetricsExportEnabled: _metricsExportEnabled,
                StructuredRequestLoggingEnabled: _structuredRequestLoggingEnabled,
                UpdatedAtUtc: _updatedAtUtc,
                UpdatedByUserId: _updatedByUserId,
                LokiConfigured: !string.IsNullOrWhiteSpace(_lokiUrl),
                PrometheusConfigured: !string.IsNullOrWhiteSpace(_prometheusUrl),
                GrafanaConfigured: !string.IsNullOrWhiteSpace(_grafanaUrl));
        }
    }

    public ObservabilitySettingsDto UpdateSettings(
        string minimumLogLevel,
        bool metricsExportEnabled,
        bool structuredRequestLoggingEnabled,
        Guid? updatedByUserId)
    {
        if (string.IsNullOrWhiteSpace(minimumLogLevel) ||
            !AllowedLevels.TryGetValue(minimumLogLevel.Trim(), out var parsedLevel))
        {
            throw new BadRequestException(
                "ERR_INVALID_LOG_LEVEL",
                "Mức log không hợp lệ. Chỉ chấp nhận: Verbose, Debug, Information, Warning, Error, Fatal.");
        }

        lock (_sync)
        {
            _levelSwitch.MinimumLevel = parsedLevel;
            _metricsExportEnabled = metricsExportEnabled;
            _structuredRequestLoggingEnabled = structuredRequestLoggingEnabled;
            _updatedAtUtc = DateTime.UtcNow;
            _updatedByUserId = updatedByUserId;
        }

        return GetSettings();
    }

    public async Task<ObservabilityStackStatusDto> GetStackStatusAsync(CancellationToken cancellationToken = default)
    {
        var lokiTask = ProbeLokiAsync(cancellationToken);
        var promTask = ProbePrometheusAsync(cancellationToken);
        var grafanaTask = ProbeGrafanaAsync(cancellationToken);

        await Task.WhenAll(lokiTask, promTask, grafanaTask);

        var (lokiStatus, lokiLabels) = await lokiTask;
        var (promStatus, scrapeHealth, scrapeError) = await promTask;
        var grafanaStatus = await grafanaTask;

        return new ObservabilityStackStatusDto(
            CheckedAtUtc: DateTime.UtcNow,
            Settings: GetSettings(),
            Services: new[] { lokiStatus, promStatus, grafanaStatus },
            PrometheusScrapeHealth: scrapeHealth,
            PrometheusScrapeError: scrapeError,
            LokiLabels: lokiLabels);
    }

    public async Task<LokiLogQueryResultDto> QueryLokiLogsAsync(
        string? level,
        string? search,
        int minutes = 60,
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var clampedMinutes = Math.Clamp(minutes, 5, 1440);
        var clampedLimit = Math.Clamp(limit, 1, 200);
        var logQl = BuildLokiQuery(level, search);

        if (string.IsNullOrWhiteSpace(_lokiUrl))
        {
            return new LokiLogQueryResultDto(
                Available: false,
                ErrorMessage: "Chưa cấu hình URL kết nối tới Grafana Loki (Observability:LokiUrl).",
                Query: logQl,
                WindowMinutes: clampedMinutes,
                TotalReturned: 0,
                Entries: Array.Empty<LokiLogEntryDto>());
        }

        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            var endNs = ToUnixNanoseconds(DateTime.UtcNow);
            var startNs = ToUnixNanoseconds(DateTime.UtcNow.AddMinutes(-clampedMinutes));
            var requestUri =
                $"{_lokiUrl}/loki/api/v1/query_range?query={Uri.EscapeDataString(logQl)}&start={startNs}&end={endNs}&limit={clampedLimit}&direction=backward";

            using var response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new LokiLogQueryResultDto(
                    Available: false,
                    ErrorMessage: $"Loki trả về mã lỗi HTTP {(int)response.StatusCode}.",
                    Query: logQl,
                    WindowMinutes: clampedMinutes,
                    TotalReturned: 0,
                    Entries: Array.Empty<LokiLogEntryDto>());
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var entries = ParseLokiQueryRangeResponse(json);

            return new LokiLogQueryResultDto(
                Available: true,
                ErrorMessage: null,
                Query: logQl,
                WindowMinutes: clampedMinutes,
                TotalReturned: entries.Count,
                Entries: entries);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new LokiLogQueryResultDto(
                Available: false,
                ErrorMessage: "Không thể kết nối hoặc đọc dữ liệu từ Grafana Loki.",
                Query: logQl,
                WindowMinutes: clampedMinutes,
                TotalReturned: 0,
                Entries: Array.Empty<LokiLogEntryDto>());
        }
    }

    public static string BuildLokiQuery(string? level, string? search)
    {
        var selector = new StringBuilder("{container=\"hotelsaas-backend-api\"");
        if (!string.IsNullOrWhiteSpace(level))
        {
            var trimmedLevel = level.Trim();
            if (QueryableLevels.TryGetValue(trimmedLevel, out var canonicalLevel))
            {
                selector.Append(",level=\"").Append(canonicalLevel).Append('"');
            }
        }
        selector.Append('}');

        if (!string.IsNullOrWhiteSpace(search))
        {
            var sanitized = search
                .Replace("\r", string.Empty, StringComparison.Ordinal)
                .Replace("\n", string.Empty, StringComparison.Ordinal)
                .Trim();

            if (sanitized.Length > 120)
            {
                sanitized = sanitized[..120];
            }

            if (sanitized.Length > 0)
            {
                var escaped = sanitized
                    .Replace("\\", "\\\\", StringComparison.Ordinal)
                    .Replace("\"", "\\\"", StringComparison.Ordinal);
                selector.Append(" |= \"").Append(escaped).Append('"');
            }
        }

        return selector.ToString();
    }

    internal static IReadOnlyList<LokiLogEntryDto> ParseLokiQueryRangeResponse(string json)
    {
        var entries = new List<LokiLogEntryDto>();
        if (string.IsNullOrWhiteSpace(json))
        {
            return entries;
        }

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("data", out var dataEl) ||
            !dataEl.TryGetProperty("result", out var resultEl) ||
            resultEl.ValueKind != JsonValueKind.Array)
        {
            return entries;
        }

        foreach (var stream in resultEl.EnumerateArray())
        {
            var streamContainer = "hotelsaas-backend-api";
            var streamLevel = "Information";
            var streamTenant = "anonymous";
            var streamProperty = "unscoped";

            if (stream.TryGetProperty("stream", out var streamMeta) && streamMeta.ValueKind == JsonValueKind.Object)
            {
                streamContainer = TryGetString(streamMeta, "container") ?? streamContainer;
                streamLevel = TryGetString(streamMeta, "level") ?? streamLevel;
                streamTenant = TryGetString(streamMeta, "tenant_id") ?? streamTenant;
                streamProperty = TryGetString(streamMeta, "property_id") ?? streamProperty;
            }

            if (!stream.TryGetProperty("values", out var valuesEl) || valuesEl.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var pair in valuesEl.EnumerateArray())
            {
                if (pair.ValueKind != JsonValueKind.Array || pair.GetArrayLength() < 2)
                {
                    continue;
                }

                var tsNsStr = pair[0].GetString();
                var rawLine = pair[1].GetString() ?? string.Empty;
                var fallbackTime = ParseNanosecondsUtc(tsNsStr);

                entries.Add(ParseLogLine(rawLine, fallbackTime, streamContainer, streamLevel, streamTenant, streamProperty));
            }
        }

        return entries
            .OrderByDescending(e => e.TimestampUtc)
            .ToList();
    }

    private static LokiLogEntryDto ParseLogLine(
        string rawLine,
        DateTime fallbackTimeUtc,
        string defaultContainer,
        string defaultLevel,
        string defaultTenant,
        string defaultProperty)
    {
        if (!string.IsNullOrWhiteSpace(rawLine) && rawLine.TrimStart().StartsWith('{'))
        {
            try
            {
                using var lineDoc = JsonDocument.Parse(rawLine);
                var root = lineDoc.RootElement;
                var hasProps = root.TryGetProperty("Properties", out var props) && props.ValueKind == JsonValueKind.Object;

                var timestamp = ParseTimestampUtc(
                    TryGetString(root, "@t") ?? TryGetString(root, "Timestamp"),
                    fallbackTimeUtc);

                var level = TryGetString(root, "@l")
                    ?? TryGetString(root, "Level")
                    ?? defaultLevel;

                var message = TryGetString(root, "RenderedMessage")
                    ?? TryGetString(root, "@m")
                    ?? TryGetString(root, "Message")
                    ?? TryGetString(root, "MessageTemplate")
                    ?? rawLine;

                string? ReadProp(string name)
                {
                    if (hasProps)
                    {
                        var v = TryGetScalarAsString(props, name);
                        if (!string.IsNullOrWhiteSpace(v)) return v;
                    }
                    return TryGetScalarAsString(root, name);
                }

                var correlationId = ReadProp("CorrelationId") ?? "-";
                var tenantId = ReadProp("TenantId") ?? defaultTenant;
                var propertyId = ReadProp("PropertyId") ?? defaultProperty;
                var userId = ReadProp("UserId") ?? "anonymous";
                var errorCode = ReadProp("ErrorCode");
                var statusCode = TryReadInt(hasProps ? props : root, "StatusCode") ?? TryReadInt(root, "StatusCode");
                var elapsedMs = TryReadDouble(hasProps ? props : root, "ElapsedMs") ?? TryReadDouble(root, "ElapsedMs");

                return new LokiLogEntryDto(
                    TimestampUtc: timestamp,
                    Level: level,
                    Container: defaultContainer,
                    TenantId: tenantId,
                    PropertyId: propertyId,
                    UserId: userId,
                    CorrelationId: correlationId,
                    StatusCode: statusCode,
                    ElapsedMs: elapsedMs,
                    ErrorCode: errorCode,
                    Message: message);
            }
            catch (JsonException)
            {
                // Fall back to plain line formatting below
            }
        }

        return new LokiLogEntryDto(
            TimestampUtc: fallbackTimeUtc,
            Level: defaultLevel,
            Container: defaultContainer,
            TenantId: defaultTenant,
            PropertyId: defaultProperty,
            UserId: "anonymous",
            CorrelationId: "-",
            StatusCode: null,
            ElapsedMs: null,
            ErrorCode: null,
            Message: rawLine);
    }

    private async Task<(ObservabilityServiceStatusDto Status, IReadOnlyList<string> Labels)> ProbeLokiAsync(
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_lokiUrl))
        {
            return (
                new ObservabilityServiceStatusDto("Loki", "unconfigured", 0, "Chưa cấu hình Observability:LokiUrl"),
                Array.Empty<string>());
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var readyResp = await client.GetAsync($"{_lokiUrl}/ready", cancellationToken);
            sw.Stop();

            if (!readyResp.IsSuccessStatusCode)
            {
                return (
                    new ObservabilityServiceStatusDto("Loki", "down", sw.ElapsedMilliseconds, $"HTTP {(int)readyResp.StatusCode}"),
                    Array.Empty<string>());
            }

            var labels = new List<string>();
            using var labelsResp = await client.GetAsync($"{_lokiUrl}/loki/api/v1/labels", cancellationToken);
            if (labelsResp.IsSuccessStatusCode)
            {
                var body = await labelsResp.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("data", out var dataEl) && dataEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in dataEl.EnumerateArray())
                    {
                        var val = item.GetString();
                        if (!string.IsNullOrWhiteSpace(val))
                        {
                            labels.Add(val);
                        }
                    }
                }
            }

            return (
                new ObservabilityServiceStatusDto("Loki", "up", sw.ElapsedMilliseconds, $"Sẵn sàng ({labels.Count} labels)"),
                labels);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            sw.Stop();
            return (
                new ObservabilityServiceStatusDto("Loki", "down", sw.ElapsedMilliseconds, "Không thể kết nối tới container Loki"),
                Array.Empty<string>());
        }
    }

    private async Task<(ObservabilityServiceStatusDto Status, string? ScrapeHealth, string? ScrapeError)> ProbePrometheusAsync(
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_prometheusUrl))
        {
            return (
                new ObservabilityServiceStatusDto("Prometheus", "unconfigured", 0, "Chưa cấu hình Observability:PrometheusUrl"),
                null,
                null);
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var readyResp = await client.GetAsync($"{_prometheusUrl}/-/ready", cancellationToken);
            sw.Stop();

            if (!readyResp.IsSuccessStatusCode)
            {
                return (
                    new ObservabilityServiceStatusDto("Prometheus", "down", sw.ElapsedMilliseconds, $"HTTP {(int)readyResp.StatusCode}"),
                    null,
                    null);
            }

            string? scrapeHealth = null;
            string? scrapeError = null;
            using var targetsResp = await client.GetAsync($"{_prometheusUrl}/api/v1/targets", cancellationToken);
            if (targetsResp.IsSuccessStatusCode)
            {
                var body = await targetsResp.Content.ReadAsStringAsync(cancellationToken);
                (scrapeHealth, scrapeError) = ExtractBackendTargetHealth(body);
            }

            var detail = scrapeHealth switch
            {
                "up" => "Scrape /metrics: UP",
                "down" => string.IsNullOrWhiteSpace(scrapeError) ? "Scrape /metrics: DOWN" : $"Scrape /metrics: DOWN ({scrapeError})",
                _ => "Sẵn sàng"
            };

            return (
                new ObservabilityServiceStatusDto("Prometheus", "up", sw.ElapsedMilliseconds, detail),
                scrapeHealth,
                scrapeError);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            sw.Stop();
            return (
                new ObservabilityServiceStatusDto("Prometheus", "down", sw.ElapsedMilliseconds, "Không thể kết nối tới container Prometheus"),
                null,
                null);
        }
    }

    private async Task<ObservabilityServiceStatusDto> ProbeGrafanaAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_grafanaUrl))
        {
            return new ObservabilityServiceStatusDto("Grafana", "unconfigured", 0, "Chưa cấu hình Observability:GrafanaUrl");
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var resp = await client.GetAsync($"{_grafanaUrl}/api/health", cancellationToken);
            sw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                return new ObservabilityServiceStatusDto("Grafana", "down", sw.ElapsedMilliseconds, $"HTTP {(int)resp.StatusCode}");
            }

            var body = await resp.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(body);
            var dbState = TryGetString(doc.RootElement, "database") ?? "unknown";
            var version = TryGetString(doc.RootElement, "version");
            var isUp = string.Equals(dbState, "ok", StringComparison.OrdinalIgnoreCase);

            return new ObservabilityServiceStatusDto(
                Name: "Grafana",
                Status: isUp ? "up" : "down",
                LatencyMs: sw.ElapsedMilliseconds,
                Details: isUp ? $"DB: {dbState}" : $"DB: {dbState}",
                Version: version);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            sw.Stop();
            return new ObservabilityServiceStatusDto("Grafana", "down", sw.ElapsedMilliseconds, "Không thể kết nối tới container Grafana");
        }
    }

    internal static (string? Health, string? LastError) ExtractBackendTargetHealth(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return (null, null);
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var dataEl) ||
                !dataEl.TryGetProperty("activeTargets", out var targetsEl) ||
                targetsEl.ValueKind != JsonValueKind.Array)
            {
                return (null, null);
            }

            foreach (var target in targetsEl.EnumerateArray())
            {
                string? job = null;
                if (target.TryGetProperty("labels", out var labelsEl) && labelsEl.ValueKind == JsonValueKind.Object)
                {
                    job = TryGetString(labelsEl, "job");
                }

                if (string.IsNullOrWhiteSpace(job) ||
                    string.Equals(job, "hotelsaas-backend-api", StringComparison.OrdinalIgnoreCase))
                {
                    var health = TryGetString(target, "health");
                    var lastError = TryGetString(target, "lastError");
                    return (health, string.IsNullOrWhiteSpace(lastError) ? null : lastError);
                }
            }
        }
        catch (JsonException)
        {
            return (null, null);
        }

        return (null, null);
    }

    private static string NormalizeBaseUrl(string? raw)
    {
        return string.IsNullOrWhiteSpace(raw) ? string.Empty : raw.Trim().TrimEnd('/');
    }

    private static long ToUnixNanoseconds(DateTime utcTime)
    {
        var dto = new DateTimeOffset(DateTime.SpecifyKind(utcTime, DateTimeKind.Utc));
        return dto.ToUnixTimeMilliseconds() * 1_000_000L;
    }

    private static DateTime ParseNanosecondsUtc(string? nsStr)
    {
        if (!string.IsNullOrWhiteSpace(nsStr) &&
            long.TryParse(nsStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ns))
        {
            var ms = ns / 1_000_000L;
            return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
        }
        return DateTime.UtcNow;
    }

    private static DateTime ParseTimestampUtc(string? isoStr, DateTime fallbackUtc)
    {
        if (!string.IsNullOrWhiteSpace(isoStr) &&
            DateTimeOffset.TryParse(isoStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed.UtcDateTime;
        }
        return fallbackUtc;
    }

    private static string? TryGetString(JsonElement obj, string propName)
    {
        if (obj.TryGetProperty(propName, out var el) && el.ValueKind == JsonValueKind.String)
        {
            return el.GetString();
        }
        return null;
    }

    private static string? TryGetScalarAsString(JsonElement obj, string propName)
    {
        if (!obj.TryGetProperty(propName, out var el))
        {
            return null;
        }

        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static int? TryReadInt(JsonElement obj, string propName)
    {
        if (!obj.TryGetProperty(propName, out var el))
        {
            return null;
        }

        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var val))
        {
            return val;
        }
        if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out val))
        {
            return val;
        }
        return null;
    }

    private static double? TryReadDouble(JsonElement obj, string propName)
    {
        if (!obj.TryGetProperty(propName, out var el))
        {
            return null;
        }

        if (el.ValueKind == JsonValueKind.Number && el.TryGetDouble(out var val))
        {
            return val;
        }
        if (el.ValueKind == JsonValueKind.String &&
            double.TryParse(el.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out val))
        {
            return val;
        }
        return null;
    }
}
