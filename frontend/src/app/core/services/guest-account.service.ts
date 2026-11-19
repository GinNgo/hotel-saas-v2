import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AuthActionResponseDto,
  ChangePasswordRequest,
  GuestMeDto,
  GuestPagedBookingsDto,
  GuestProfileResponseDto,
  GuestLoyaltyMembershipDto,
  LoyaltyPointLedgerItemDto,
  GuestInvoiceRecordDto,
  LinkSocialAccountRequest,
  ResendConfirmationRequest,
  SocialAccountItemDto,
  SocialAccountsResponseDto,
  UpdateGuestVatProfileRequest,
} from '../models/guest-account.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  errorCode?: string | null;
  data: T;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class GuestAccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/guest`;
  private readonly authUrl = `${environment.apiUrl}/auth`;

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

  enrollMembership(propertyId: string): Observable<GuestLoyaltyMembershipDto> {
    return this.http
      .post<ApiResponse<GuestLoyaltyMembershipDto>>(`${this.apiUrl}/memberships/enroll`, { propertyId })
      .pipe(map((res) => res.data));
  }

  resendVerificationEmail(email?: string | null): Observable<AuthActionResponseDto> {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : null;
    const payload: ResendConfirmationRequest = {
      email: email?.trim() || null,
      appUrl,
    };
    return this.http
      .post<ApiResponse<null>>(`${this.authUrl}/resend-confirmation`, payload)
      .pipe(
        map((res) => ({
          success: Boolean(res?.success ?? true),
          message: res?.message ?? null,
          errorCode: res?.errorCode ?? null,
        }))
      );
  }

  changePassword(request: ChangePasswordRequest): Observable<AuthActionResponseDto> {
    return this.http
      .post<ApiResponse<null>>(`${this.authUrl}/change-password`, request)
      .pipe(
        map((res) => ({
          success: Boolean(res?.success ?? true),
          message: res?.message ?? null,
          errorCode: res?.errorCode ?? null,
        }))
      );
  }

  getSocialAccounts(): Observable<SocialAccountsResponseDto> {
    return this.http
      .get<ApiResponse<SocialAccountsResponseDto>>(`${this.authUrl}/social-accounts`)
      .pipe(
        map((res) => ({
          hasPassword: Boolean(res?.data?.hasPassword),
          accounts: res?.data?.accounts ?? [],
        }))
      );
  }

  linkGoogleAccount(idToken: string): Observable<SocialAccountItemDto> {
    const payload: LinkSocialAccountRequest = { idToken, provider: 'Google' };
    return this.http
      .post<ApiResponse<SocialAccountItemDto>>(`${this.authUrl}/social-accounts/link`, payload)
      .pipe(map((res) => res.data));
  }

  unlinkSocialAccount(provider: string): Observable<AuthActionResponseDto> {
    return this.http
      .delete<ApiResponse<null>>(`${this.authUrl}/social-accounts/${encodeURIComponent(provider)}`)
      .pipe(
        map((res) => ({
          success: Boolean(res?.success ?? true),
          message: res?.message ?? null,
          errorCode: res?.errorCode ?? null,
        }))
      );
  }
}
