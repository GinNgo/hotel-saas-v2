import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface SystemBannerDto {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl?: string | null;
  targetPlanCode?: string | null;
  validFromUtc?: string | null;
  validToUtc?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SaveSystemBannerRequest {
  title: string;
  imageUrl: string;
  targetUrl?: string | null;
  targetPlanCode?: string | null;
  validFromUtc?: string | null;
  validToUtc?: string | null;
  isActive: boolean;
}

interface ApiEnvelope<T> {
  data?: T;
}

function unwrapPayload<T>(res: ApiEnvelope<T> | T): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class SystemBannerService {
  private static readonly DISMISSED_KEY = 'hotelsaas_dismissed_banners_v1';

  private readonly http = inject(HttpClient, { optional: true });
  private readonly baseUrl = environment.apiUrl;

  private readonly allActiveBanners = signal<SystemBannerDto[]>([]);
  private readonly dismissedIds = signal<Set<string>>(this.loadDismissedFromSession());

  readonly visibleBanners = computed(() => {
    const dismissed = this.dismissedIds();
    return this.allActiveBanners().filter(b => !dismissed.has(b.id));
  });

  getActiveBanners(planCode?: string): Observable<SystemBannerDto[]> {
    if (!this.http) {
      return of([]);
    }
    let params = new HttpParams();
    if (planCode?.trim()) {
      params = params.set('planCode', planCode.trim());
    }
    return this.http
      .get<ApiEnvelope<SystemBannerDto[]> | SystemBannerDto[]>(`${this.baseUrl}/banners/active`, { params })
      .pipe(
        map(res => unwrapPayload(res) ?? []),
        catchError(() => of([]))
      );
  }

  refreshActiveBanners(planCode?: string): void {
    this.getActiveBanners(planCode)
      .pipe(tap(banners => this.allActiveBanners.set(banners)))
      .subscribe();
  }

  dismissForSession(bannerId: string): void {
    if (!bannerId) return;
    const next = new Set(this.dismissedIds());
    next.add(bannerId);
    this.dismissedIds.set(next);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SystemBannerService.DISMISSED_KEY, JSON.stringify(Array.from(next)));
      }
    } catch {
      // Ignore storage quota / disabled storage errors
    }
  }

  getAllBanners(): Observable<SystemBannerDto[]> {
    if (!this.http) {
      return of([]);
    }
    return this.http
      .get<ApiEnvelope<SystemBannerDto[]> | SystemBannerDto[]>(`${this.baseUrl}/admin/banners`)
      .pipe(map(res => unwrapPayload(res) ?? []));
  }

  createBanner(req: SaveSystemBannerRequest): Observable<SystemBannerDto> {
    if (!this.http) {
      throw new Error('HttpClient unavailable');
    }
    return this.http
      .post<ApiEnvelope<SystemBannerDto> | SystemBannerDto>(`${this.baseUrl}/admin/banners`, req)
      .pipe(map(res => unwrapPayload(res)));
  }

  updateBanner(id: string, req: SaveSystemBannerRequest): Observable<SystemBannerDto> {
    if (!this.http) {
      throw new Error('HttpClient unavailable');
    }
    return this.http
      .put<ApiEnvelope<SystemBannerDto> | SystemBannerDto>(`${this.baseUrl}/admin/banners/${id}`, req)
      .pipe(map(res => unwrapPayload(res)));
  }

  deleteBanner(id: string): Observable<void> {
    if (!this.http) {
      return of(void 0);
    }
    return this.http.delete<void>(`${this.baseUrl}/admin/banners/${id}`);
  }

  private loadDismissedFromSession(): Set<string> {
    try {
      if (typeof sessionStorage === 'undefined') return new Set();
      const raw = sessionStorage.getItem(SystemBannerService.DISMISSED_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
    } catch {
      return new Set();
    }
  }
}
