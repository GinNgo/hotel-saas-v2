import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, unwrapApiEnvelope } from '../models/api-response.model';
import { RevenueSummaryDto, PmsKpiDto, GroupAnalyticsDto } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  getRoomTypes(): Observable<Array<{ id: string; name: string }>> {
    return this.http.get<Array<{ id: string; name: string }>>(`${this.apiUrl}/room-types`);
  }

  /**
   * Retrieves financial revenue metrics, payment method distributions, and daily timeline.
   */
  getRevenueSummary(fromDate?: string, toDate?: string, propertyId?: string, roomTypeId?: string): Observable<RevenueSummaryDto> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (propertyId) params = params.set('propertyId', propertyId);
    if (roomTypeId) params = params.set('roomTypeId', roomTypeId);

    return this.http
      .get<ApiEnvelope<RevenueSummaryDto> | RevenueSummaryDto>(`${this.apiUrl}/revenue-summary`, { params })
      .pipe(map(unwrapApiEnvelope));
  }

  /**
   * Retrieves hospitality PMS metrics: Occupancy rate, ADR, RevPAR, and operational stats.
   */
  getPmsKpi(fromDate?: string, toDate?: string, propertyId?: string, roomTypeId?: string): Observable<PmsKpiDto> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (propertyId) params = params.set('propertyId', propertyId);
    if (roomTypeId) params = params.set('roomTypeId', roomTypeId);

    return this.http
      .get<ApiEnvelope<PmsKpiDto> | PmsKpiDto>(`${this.apiUrl}/pms-kpi`, { params })
      .pipe(map(unwrapApiEnvelope));
  }

  /**
   * Retrieves consolidated multi-property portfolio group analytics.
   */
  getGroupAnalytics(fromDate?: string, toDate?: string): Observable<GroupAnalyticsDto> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);

    return this.http
      .get<ApiEnvelope<GroupAnalyticsDto> | GroupAnalyticsDto>(`${this.apiUrl}/group-analytics`, { params })
      .pipe(map(unwrapApiEnvelope));
  }

  /**
   * Downloads Excel-friendly UTF-8 BOM CSV report.
   */
  exportCsv(fromDate?: string, toDate?: string, propertyId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (propertyId) params = params.set('propertyId', propertyId);

    return this.http.get(`${this.apiUrl}/export-csv`, {
      params,
      responseType: 'blob'
    });
  }

  exportExcel(fromDate?: string, toDate?: string, propertyId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (propertyId) params = params.set('propertyId', propertyId);
    return this.http.get(`${this.apiUrl}/export-excel`, { params, responseType: 'blob' });
  }

  exportPdf(fromDate?: string, toDate?: string, propertyId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (propertyId) params = params.set('propertyId', propertyId);
    return this.http.get(`${this.apiUrl}/export-pdf`, { params, responseType: 'blob' });
  }
}
