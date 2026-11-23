import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Service kiểm tra sức khỏe trực tiếp của backend API & PostgreSQL qua GET /health/ready.
 */
@Injectable({ providedIn: 'root' })
export class SystemHealthService {
  private readonly http = inject(HttpClient);
  private readonly readinessUrl = `${environment.apiUrl.replace(/\/api\/?$/, '')}/health/ready`;

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
}
