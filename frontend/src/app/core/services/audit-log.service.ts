import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PagedResult } from '../models/api-response.model';
import { AuditLogDetail, AuditLogFilterParams, AuditLogListItem } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/audit-logs`;

  /**
   * Tra cứu danh sách nhật ký kiểm toán với bộ lọc và phân trang server-side.
   */
  getAuditLogs(params: AuditLogFilterParams): Observable<ApiResponse<PagedResult<AuditLogListItem>>> {
    let httpParams = new HttpParams();

    if (params.propertyId) {
      httpParams = httpParams.set('propertyId', params.propertyId);
    }
    if (params.userId) {
      httpParams = httpParams.set('userId', params.userId);
    }
    if (params.action) {
      httpParams = httpParams.set('action', params.action);
    }
    if (params.entityName) {
      httpParams = httpParams.set('entityName', params.entityName);
    }
    if (params.entityId) {
      httpParams = httpParams.set('entityId', params.entityId);
    }
    if (params.fromUtc) {
      httpParams = httpParams.set('fromUtc', params.fromUtc);
    }
    if (params.toUtc) {
      httpParams = httpParams.set('toUtc', params.toUtc);
    }
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize !== undefined && params.pageSize !== null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }

    return this.http.get<ApiResponse<PagedResult<AuditLogListItem>>>(this.apiUrl, { params: httpParams });
  }

  /**
   * Xem chi tiết một bản ghi nhật ký kiểm toán bao gồm trước/sau thay đổi (diff changes).
   */
  getAuditLogById(id: string, propertyId?: string | null): Observable<ApiResponse<AuditLogDetail>> {
    let httpParams = new HttpParams();
    if (propertyId) {
      httpParams = httpParams.set('propertyId', propertyId);
    }
    return this.http.get<ApiResponse<AuditLogDetail>>(`${this.apiUrl}/${id}`, { params: httpParams });
  }
}

