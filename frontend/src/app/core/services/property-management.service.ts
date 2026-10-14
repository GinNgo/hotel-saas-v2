import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => (res.data ? res.data : res) as TenantPropertySummaryDto[])
    );
  }

  /**
   * Tạo mới một chi nhánh (Property) trong chuỗi của Tenant Chính.
   */
  createProperty(request: CreatePropertyRequest): Observable<{ id: string }> {
    return this.http.post<any>(this.apiUrl, request).pipe(
      map(res => (res.data ? res.data : res))
    );
  }

  /**
   * Cập nhật thông tin chi nhánh (Property).
   */
  updateProperty(id: string, request: UpdatePropertyRequest): Observable<void> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request).pipe(
      map(res => (res.data ? res.data : res))
    );
  }
}
