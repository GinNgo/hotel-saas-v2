import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/api-response.model';
import {
  PaymentDto,
  FolioDto,
  CreatePaymentRequest,
  PaymentSummaryDto,
  ShiftReportDto,
  ShiftType,
  RefundRequestDto,
  RefundRequestDetailDto,
  GetRefundRequestsFilter,
  ConfirmRefundPayoutRequest
} from '../models/payment.model';

export interface GetPaymentsFilter {
  propertyId: string;
  reservationId?: string;
  method?: number;
  status?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/payments`;
  private readonly reservationsApiUrl = `${environment.apiUrl}/reservations`;

  /**
   * Retrieves the financial folio balance statement for a reservation.
   */
  getFolio(reservationId: string, propertyId: string): Observable<FolioDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.get<any>(`${this.reservationsApiUrl}/${reservationId}/folio`, { params }).pipe(
      map(res => (res.data ? res.data : res) as FolioDto)
    );
  }

  /**
   * Records a manual payment (Cash, Bank Transfer) or deposit for a reservation.
   */
  createPayment(request: CreatePaymentRequest, propertyId?: string): Observable<PaymentDto> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }

    const headers: Record<string, string> = {};
    if (request.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey;
    }
    if (propertyId) {
      headers['X-Property-Id'] = propertyId;
    }

    return this.http.post<any>(this.apiUrl, request, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as PaymentDto)
    );
  }

  /**
   * Retrieves a paginated list of payment records for a property.
   */
  getPayments(filter: GetPaymentsFilter): Observable<PagedResult<PaymentDto>> {
    let params = new HttpParams()
      .set('propertyId', filter.propertyId)
      .set('page', (filter.page ?? 1).toString())
      .set('pageSize', (filter.pageSize ?? 20).toString());

    if (filter.reservationId) {
      params = params.set('reservationId', filter.reservationId);
    }
    if (filter.method !== undefined && filter.method !== null) {
      params = params.set('method', filter.method.toString());
    }
    if (filter.status !== undefined && filter.status !== null) {
      params = params.set('status', filter.status.toString());
    }
    if (filter.dateFrom) {
      params = params.set('dateFrom', filter.dateFrom);
    }
    if (filter.dateTo) {
      params = params.set('dateTo', filter.dateTo);
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(res => (res.data ? res.data : res) as PagedResult<PaymentDto>)
    );
  }

  /**
   * Retrieves daily cashier collection summary metrics for a property.
   */
  getPaymentSummary(propertyId: string, date?: string): Observable<PaymentSummaryDto> {
    let params = new HttpParams().set('propertyId', propertyId);
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<any>(`${this.apiUrl}/summary`, { params }).pipe(
      map(res => (res.data ? res.data : res) as PaymentSummaryDto)
    );
  }

  /**
   * Retrieves shift cashier collection report and line-by-line audit for a specific shift and date.
   */
  getShiftReport(propertyId: string, date?: string, shiftType: ShiftType = ShiftType.Morning): Observable<ShiftReportDto> {
    let params = new HttpParams()
      .set('propertyId', propertyId)
      .set('shiftType', shiftType.toString());

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<any>(`${this.apiUrl}/shift-report`, { params }).pipe(
      map(res => (res.data ? res.data : res) as ShiftReportDto)
    );
  }

  // =========================================================================
  // REFUND APPROVAL MANAGEMENT APIS (Decision D23)
  // =========================================================================

  /**
   * Retrieves a paginated list of refund requests for the active property.
   */
  getRefundRequests(filter: GetRefundRequestsFilter): Observable<PagedResult<RefundRequestDto>> {
    let params = new HttpParams()
      .set('propertyId', filter.propertyId)
      .set('page', (filter.page ?? 1).toString())
      .set('pageSize', (filter.pageSize ?? 20).toString());

    if (filter.status && filter.status !== 'all') {
      params = params.set('status', filter.status);
    }
    if (filter.dateFrom) {
      params = params.set('dateFrom', filter.dateFrom);
    }
    if (filter.dateTo) {
      params = params.set('dateTo', filter.dateTo);
    }
    if (filter.searchTerm) {
      params = params.set('searchTerm', filter.searchTerm.trim());
    }

    const headers: Record<string, string> = {
      'X-Property-Id': filter.propertyId
    };

    return this.http.get<any>(`${this.apiUrl}/refunds`, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as PagedResult<RefundRequestDto>)
    );
  }

  /**
   * Retrieves complete details, original payments, and D23 audit trail for a refund request.
   */
  getRefundRequestDetail(paymentId: string, propertyId: string): Observable<RefundRequestDetailDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const headers = { 'X-Property-Id': propertyId };

    return this.http.get<any>(`${this.apiUrl}/refunds/${paymentId}`, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as RefundRequestDetailDto)
    );
  }

  /**
   * Approves a pending refund request (Owner / Property Manager with PAYMENTS:Approve).
   */
  approveRefund(paymentId: string, propertyId: string, notes?: string): Observable<RefundRequestDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const headers = { 'X-Property-Id': propertyId };

    return this.http.post<any>(`${this.apiUrl}/refunds/${paymentId}/approve`, { notes }, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as RefundRequestDto)
    );
  }

  /**
   * Rejects a pending refund request with a mandatory reason.
   */
  rejectRefund(paymentId: string, propertyId: string, reason: string): Observable<RefundRequestDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const headers = { 'X-Property-Id': propertyId };

    return this.http.post<any>(`${this.apiUrl}/refunds/${paymentId}/reject`, { reason }, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as RefundRequestDto)
    );
  }

  /**
   * Confirms refund disbursement has been completed with a bank transaction reference or voucher number.
   */
  confirmRefundPayout(paymentId: string, propertyId: string, request: ConfirmRefundPayoutRequest): Observable<RefundRequestDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const headers = { 'X-Property-Id': propertyId };

    return this.http.post<any>(`${this.apiUrl}/refunds/${paymentId}/confirm-payout`, request, { params, headers }).pipe(
      map(res => (res.data ? res.data : res) as RefundRequestDto)
    );
  }
}
