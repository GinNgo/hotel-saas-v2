import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  GuestMeDto,
  GuestPagedBookingsDto,
  GuestProfileResponseDto,
  LoyaltyPointLedgerItemDto,
  GuestInvoiceRecordDto,
  UpdateGuestVatProfileRequest,
} from '../models/guest-account.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class GuestAccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/guest`;

  getMe(): Observable<GuestMeDto> {
    return this.http
      .get<ApiResponse<GuestMeDto>>(`${this.apiUrl}/me`)
      .pipe(map((res) => res.data));
  }

  updateMe(fullName: string, avatarUrl?: string | null): Observable<GuestMeDto> {
    return this.http
      .patch<ApiResponse<GuestMeDto>>(`${this.apiUrl}/me`, { fullName, avatarUrl })
      .pipe(map((res) => res.data));
  }

  getBookings(page = 1, pageSize = 10): Observable<GuestPagedBookingsDto> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http
      .get<ApiResponse<GuestPagedBookingsDto>>(`${this.apiUrl}/bookings`, { params })
      .pipe(map((res) => res.data));
  }

  getLoyaltyProfile(): Observable<GuestProfileResponseDto> {
    return this.http
      .get<ApiResponse<GuestProfileResponseDto>>(`${this.apiUrl}/profile`)
      .pipe(map((res) => res.data));
  }

  getLoyaltyLedger(filterType?: string): Observable<LoyaltyPointLedgerItemDto[]> {
    let params = new HttpParams();
    if (filterType?.trim()) {
      params = params.set('filterType', filterType.trim());
    }

    return this.http
      .get<ApiResponse<LoyaltyPointLedgerItemDto[]>>(`${this.apiUrl}/loyalty-ledger`, { params })
      .pipe(map((res) => res.data ?? []));
  }

  getInvoices(): Observable<GuestInvoiceRecordDto[]> {
    return this.http
      .get<ApiResponse<GuestInvoiceRecordDto[]>>(`${this.apiUrl}/invoices`)
      .pipe(map((res) => res.data ?? []));
  }

  getInvoicePrintView(invoiceOrReservationId: string): Observable<GuestInvoiceRecordDto> {
    return this.http
      .get<ApiResponse<GuestInvoiceRecordDto>>(`${this.apiUrl}/invoices/${encodeURIComponent(invoiceOrReservationId)}/print`)
      .pipe(map((res) => res.data));
  }

  updateVatProfile(request: UpdateGuestVatProfileRequest): Observable<boolean> {
    return this.http
      .put<ApiResponse<boolean>>(`${this.apiUrl}/vat-profile`, request)
      .pipe(map((res) => Boolean(res.data)));
  }
}
