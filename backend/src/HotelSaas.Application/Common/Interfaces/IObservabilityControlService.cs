using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace HotelSaas.Application.Common.Interfaces;

public sealed record ObservabilitySettingsDto(
    string MinimumLogLevel,
    bool MetricsExportEnabled,
    bool StructuredRequestLoggingEnabled,
    DateTime? UpdatedAtUtc,
    Guid? UpdatedByUserId,
    bool LokiConfigured,
    bool PrometheusConfigured,
    bool GrafanaConfigured);

public sealed record ObservabilityServiceStatusDto(
    string Name,
    string Status,
    long LatencyMs,
    string Details,
    string? Version = null);

public sealed record ObservabilityStackStatusDto(
    DateTime CheckedAtUtc,
    ObservabilitySettingsDto Settings,
    IReadOnlyList<ObservabilityServiceStatusDto> Services,
    string? PrometheusScrapeHealth,
    string? PrometheusScrapeError,
    IReadOnlyList<string> LokiLabels);

public sealed record LokiLogEntryDto(
    DateTime TimestampUtc,
    string Level,
    string Container,
    string TenantId,
    string PropertyId,
    string UserId,
    string CorrelationId,
    int? StatusCode,
    double? ElapsedMs,
    string? ErrorCode,
    string Message);

public sealed record LokiLogQueryResultDto(
    bool Available,
    string? ErrorMessage,
    string Query,
    int WindowMinutes,
    int TotalReturned,
    IReadOnlyList<LokiLogEntryDto> Entries);

/// <summary>
/// Runtime controller and proxy for SuperAdmin observability settings, PLG stack health, and Loki log queries.
/// </summary>
public interface IObservabilityControlService
{
    ObservabilitySettingsDto GetSettings();

    bool IsMetricsExportEnabled { get; }

    bool IsStructuredRequestLoggingEnabled { get; }

    ObservabilitySettingsDto UpdateSettings(
        string minimumLogLevel,
        bool metricsExportEnabled,
        bool structuredRequestLoggingEnabled,
        Guid? updatedByUserId);

    Task<ObservabilityStackStatusDto> GetStackStatusAsync(CancellationToken cancellationToken = default);

    Task<LokiLogQueryResultDto> QueryLokiLogsAsync(
        string? level,
        string? search,
        int minutes = 60,
        int limit = 50,
        CancellationToken cancellationToken = default);
}
