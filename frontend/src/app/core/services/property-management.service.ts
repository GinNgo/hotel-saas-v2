import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, unwrapApiEnvelope } from '../models/api-response.model';
import {
  TenantPropertySummaryDto,
  CreatePropertyRequest,
  UpdatePropertyRequest
} from '../models/public-booking.model';

@Injectable({ providedIn: 'root' })
export class PropertyManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/properties`;

  /**
   * Lấy danh sách toàn bộ chi nhánh (Property) thuộc Tenant Chính hiện hành kèm KPI.
   */
  getTenantProperties(): Observable<TenantPropertySummaryDto[]> {
    return this.http
      .get<ApiEnvelope<TenantPropertySummaryDto[]> | TenantPropertySummaryDto[]>(this.apiUrl)
      .pipe(map(unwrapApiEnvelope));
  }

  /**
   * Tạo mới một chi nhánh (Property) trong chuỗi của Tenant Chính.
   */
  createProperty(request: CreatePropertyRequest): Observable<{ id: string }> {
    return this.http
      .post<ApiEnvelope<{ id: string }> | { id: string }>(this.apiUrl, request)
      .pipe(map(unwrapApiEnvelope));
  }

  /**
   * Cập nhật thông tin chi nhánh (Property).
   */
  updateProperty(id: string, request: UpdatePropertyRequest): Observable<void> {
    return this.http
      .put<ApiEnvelope<void> | void>(`${this.apiUrl}/${id}`, request)
      .pipe(map(() => undefined));
  }
}
