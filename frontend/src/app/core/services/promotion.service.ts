import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  CreatePromotionRequest,
  PromotionDto,
  PromotionFilterParams,
  TogglePromotionStatusRequest,
  UpdatePromotionRequest
} from '../models/promotion.model';

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/promotions`;

  getPromotions(filter?: PromotionFilterParams): Observable<PromotionDto[]> {
    let params = new HttpParams();
    if (filter?.isActive !== null && filter?.isActive !== undefined) {
      params = params.set('isActive', String(filter.isActive));
    }
    if (filter?.search && filter.search.trim().length > 0) {
      params = params.set('search', filter.search.trim());
    }

    return this.http.get<ApiResponse<PromotionDto[]>>(this.apiUrl, { params }).pipe(
      map(res => res.data ?? [])
    );
  }

  createPromotion(request: CreatePromotionRequest): Observable<PromotionDto> {
    return this.http.post<ApiResponse<PromotionDto>>(this.apiUrl, request).pipe(
      map(res => res.data as PromotionDto)
    );
  }

  updatePromotion(id: string, request: UpdatePromotionRequest): Observable<PromotionDto> {
    return this.http.put<ApiResponse<PromotionDto>>(`${this.apiUrl}/${id}`, request).pipe(
      map(res => res.data as PromotionDto)
    );
  }

  togglePromotionStatus(id: string, request?: TogglePromotionStatusRequest): Observable<PromotionDto> {
    return this.http.patch<ApiResponse<PromotionDto>>(`${this.apiUrl}/${id}/toggle`, request ?? {}).pipe(
      map(res => res.data as PromotionDto)
    );
  }
}
