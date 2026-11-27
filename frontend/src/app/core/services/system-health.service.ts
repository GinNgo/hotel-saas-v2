import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemReadinessResponse {
  status?: string;
  database?: string;
  timestamp?: string;
}

export interface SystemReadinessResult {
  status: 'ready' | 'degraded';
  database: 'connected' | 'unreachable';
  timestamp: string;
  latencyMs: number;
  httpStatus: number;
  errorMessage?: string;
}

export interface ObservabilitySettingsDto {
  minimumLogLevel: string;
  metricsExportEnabled: boolean;
  structuredRequestLoggingEnabled: boolean;
  updatedAtUtc?: string | null;
  updatedByUserId?: string | null;
  lokiConfigured: boolean;
  prometheusConfigured: boolean;
  grafanaConfigured: boolean;
}

export interface UpdateObservabilitySettingsRequest {
  minimumLogLevel: string;
  metricsExportEnabled: boolean;
  structuredRequestLoggingEnabled: boolean;
}

export interface ObservabilityServiceStatusDto {
  name: string;
  status: string;
  latencyMs: number;
  details: string;
  version?: string | null;
}

export interface ObservabilityStackStatusDto {
  checkedAtUtc: string;
  settings: ObservabilitySettingsDto;
  services: ObservabilityServiceStatusDto[];
  prometheusScrapeHealth?: string | null;
  prometheusScrapeError?: string | null;
  lokiLabels: string[];
}

export interface LokiLogEntryDto {
  timestampUtc: string;
  level: string;
  container: string;
  tenantId: string;
  propertyId: string;
  userId: string;
  correlationId: string;
  statusCode?: number | null;
  elapsedMs?: number | null;
  errorCode?: string | null;
  message: string;
}

export interface LokiLogQueryResultDto {
  available: boolean;
  errorMessage?: string | null;
  query: string;
  windowMinutes: number;
  totalReturned: number;
  entries: LokiLogEntryDto[];
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Service kiểm tra sức khỏe trực tiếp của backend API & PostgreSQL qua GET /health/ready,
 * đồng thời kết nối SuperAdmin Platform Observability API (/api/platform/observability).
 */
@Injectable({ providedIn: 'root' })
export class SystemHealthService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');
  private readonly readinessUrl = `${this.apiBase.replace(/\/api$/, '')}/health/ready`;
  private readonly observabilityUrl = `${this.apiBase}/platform/observability`;

  checkReadiness(): Observable<SystemReadinessResult> {
    const startedAt = nowMs();

    return this.http.get<SystemReadinessResponse>(this.readinessUrl, { observe: 'response' }).pipe(
      map(res => {
        const latencyMs = Math.max(0, Math.round(nowMs() - startedAt));
        const body = res.body;
        const isReady = body?.status === 'ready' && res.status >= 200 && res.status < 300;
        const dbConnected = body?.database === 'connected';
        return {
          status: isReady ? 'ready' : 'degraded',
          database: dbConnected ? 'connected' : 'unreachable',
          timestamp: body?.timestamp || new Date().toISOString(),
          latencyMs,
          httpStatus: res.status
        } satisfies SystemReadinessResult;
      }),
      catchError((err: HttpErrorResponse) => {
        const latencyMs = Math.max(0, Math.round(nowMs() - startedAt));
        const body = err?.error && typeof err.error === 'object' ? (err.error as SystemReadinessResponse) : null;
        return of<SystemReadinessResult>({
          status: 'degraded',
          database: body?.database === 'connected' ? 'connected' : 'unreachable',
          timestamp: body?.timestamp || new Date().toISOString(),
          latencyMs,
          httpStatus: err?.status || 0,
          errorMessage:
            err?.status === 503
              ? 'Cơ sở dữ liệu hiện không thể kết nối.'
              : 'Không thể kết nối tới điểm kiểm tra /health/ready.'
        });
      })
    );
  }

  getObservabilityStatus(): Observable<ObservabilityStackStatusDto> {
    return this.http.get<ObservabilityStackStatusDto>(`${this.observabilityUrl}/status`);
  }

  updateObservabilitySettings(
    request: UpdateObservabilitySettingsRequest
  ): Observable<ObservabilitySettingsDto> {
    return this.http.put<ObservabilitySettingsDto>(`${this.observabilityUrl}/settings`, request);
  }

  queryLokiLogs(params: {
    level?: string;
    search?: string;
    minutes?: number;
    limit?: number;
  }): Observable<LokiLogQueryResultDto> {
    let httpParams = new HttpParams();
    if (params.level && params.level !== 'ALL') {
      httpParams = httpParams.set('level', params.level);
    }
    if (params.search && params.search.trim().length > 0) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params.minutes !== undefined) {
      httpParams = httpParams.set('minutes', String(params.minutes));
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<LokiLogQueryResultDto>(`${this.observabilityUrl}/logs`, {
      params: httpParams
    });
  }
}
