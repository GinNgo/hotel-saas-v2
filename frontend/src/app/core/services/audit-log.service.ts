import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PagedResult } from '../models/api-response.model';
import { AuditLogDetail, AuditLogFilterParams, AuditLogListItem } from '../models/audit-log.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly apiUrl = `${environment.apiUrl}/audit-logs`;
  private readonly platformApiUrl = `${environment.apiUrl}/platform/audit-logs`;

  private getEndpointUrl(): string {
    return this.tokenStorage.getDecodedToken()?.globalRole === 'SuperAdmin' ? this.platformApiUrl : this.apiUrl;
  }

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
    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
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

    return this.http.get<ApiResponse<PagedResult<AuditLogListItem>>>(this.getEndpointUrl(), { params: httpParams });
  }

  /**
   * Xem chi tiết một bản ghi nhật ký kiểm toán bao gồm trước/sau thay đổi (diff changes).
   */
  getAuditLogById(id: string, propertyId?: string | null): Observable<ApiResponse<AuditLogDetail>> {
    let httpParams = new HttpParams();
    if (propertyId) {
      httpParams = httpParams.set('propertyId', propertyId);
    }
    return this.http.get<ApiResponse<AuditLogDetail>>(`${this.getEndpointUrl()}/${id}`, { params: httpParams });
  }

  /**
   * Ghi nhận sự kiện hành động tuân thủ & bảo mật tường minh từ người dùng / quản trị viên.
   */
  recordAuditEvent(event: {
    action: string;
    entityName: string;
    entityId: string;
    propertyId?: string | null;
    oldValues?: unknown;
    newValues?: unknown;
  }): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.apiUrl}/events`, event);
  }
}

