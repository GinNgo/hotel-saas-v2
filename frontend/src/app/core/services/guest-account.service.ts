import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  GuestMeDto,
  GuestPagedBookingsDto,
  GuestBookingSummaryDto,
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

  updateMe(fullName: string): Observable<GuestMeDto> {
    return this.http
      .patch<ApiResponse<GuestMeDto>>(`${this.apiUrl}/me`, { fullName })
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

  getLoyaltyProfile(): Observable<any> {
    return this.http
      .get<ApiResponse<any>>(`${this.apiUrl}/profile`)
      .pipe(map((res) => res.data));
  }
}
