import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AdminSubscriptionPlanDto,
  CreateSubscriptionPlanRequest,
  UpdateSubscriptionPlanRequest
} from '../models/admin-plan.model';

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
export class AdminPlansService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/plans`;

  getAllPlans(): Observable<AdminSubscriptionPlanDto[]> {
    return this.http
      .get<ApiEnvelope<AdminSubscriptionPlanDto[]> | AdminSubscriptionPlanDto[]>(this.apiUrl)
      .pipe(map(res => unwrapPayload(res)));
  }

  getPlanById(id: string): Observable<AdminSubscriptionPlanDto> {
    return this.http
      .get<ApiEnvelope<AdminSubscriptionPlanDto> | AdminSubscriptionPlanDto>(`${this.apiUrl}/${id}`)
      .pipe(map(res => unwrapPayload(res)));
  }

  createPlan(req: CreateSubscriptionPlanRequest): Observable<AdminSubscriptionPlanDto> {
    return this.http
      .post<ApiEnvelope<AdminSubscriptionPlanDto> | AdminSubscriptionPlanDto>(this.apiUrl, req)
      .pipe(map(res => unwrapPayload(res)));
  }

  updatePlan(id: string, req: UpdateSubscriptionPlanRequest): Observable<AdminSubscriptionPlanDto> {
    return this.http
      .put<ApiEnvelope<AdminSubscriptionPlanDto> | AdminSubscriptionPlanDto>(`${this.apiUrl}/${id}`, req)
      .pipe(map(res => unwrapPayload(res)));
  }

  toggleActive(id: string): Observable<AdminSubscriptionPlanDto> {
    return this.http
      .patch<ApiEnvelope<AdminSubscriptionPlanDto> | AdminSubscriptionPlanDto>(`${this.apiUrl}/${id}/toggle-active`, {})
      .pipe(map(res => unwrapPayload(res)));
  }
}
