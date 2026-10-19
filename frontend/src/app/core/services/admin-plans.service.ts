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

@Injectable({ providedIn: 'root' })
export class AdminPlansService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/plans`;

  getAllPlans(): Observable<AdminSubscriptionPlanDto[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => (res.data ? res.data : res) as AdminSubscriptionPlanDto[])
    );
  }

  getPlanById(id: string): Observable<AdminSubscriptionPlanDto> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => (res.data ? res.data : res) as AdminSubscriptionPlanDto)
    );
  }

  createPlan(req: CreateSubscriptionPlanRequest): Observable<AdminSubscriptionPlanDto> {
    return this.http.post<any>(this.apiUrl, req).pipe(
      map(res => (res.data ? res.data : res) as AdminSubscriptionPlanDto)
    );
  }

  updatePlan(id: string, req: UpdateSubscriptionPlanRequest): Observable<AdminSubscriptionPlanDto> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, req).pipe(
      map(res => (res.data ? res.data : res) as AdminSubscriptionPlanDto)
    );
  }

  toggleActive(id: string): Observable<AdminSubscriptionPlanDto> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/toggle-active`, {}).pipe(
      map(res => (res.data ? res.data : res) as AdminSubscriptionPlanDto)
    );
  }
}
