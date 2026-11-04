import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  GuestDirectoryItemDto,
  GuestDetailDto,
  UpdateGuestNotesRequest
} from '../models/guest.model';
import { ApiResponse, PagedResult } from '../models/api-response.model';

export interface GetGuestDirectoryFilter {
  search?: string;
  loyaltyTier?: string;
  isVip?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GuestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/guests';

  getGuestDirectory(filter?: GetGuestDirectoryFilter): Observable<PagedResult<GuestDirectoryItemDto>> {
    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search.trim());
    if (filter?.loyaltyTier) params = params.set('loyaltyTier', filter.loyaltyTier);
    if (filter?.isVip !== undefined) params = params.set('isVip', filter.isVip.toString());
    if (filter?.page) params = params.set('page', filter.page.toString());
    if (filter?.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    return this.http
      .get<ApiResponse<PagedResult<GuestDirectoryItemDto>>>(this.baseUrl, { params })
      .pipe(map(res => res.data || { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0, hasPreviousPage: false, hasNextPage: false }));
  }

  getGuestHistory(phoneNumber: string): Observable<GuestDetailDto> {
    const params = new HttpParams().set('phoneNumber', phoneNumber.trim());
    return this.http
      .get<ApiResponse<GuestDetailDto>>(`${this.baseUrl}/history`, { params })
      .pipe(map(res => res.data!));
  }

  updateGuestNotes(payload: UpdateGuestNotesRequest): Observable<boolean> {
    return this.http
      .put<ApiResponse<boolean>>(`${this.baseUrl}/notes`, payload)
      .pipe(map(res => res.success));
  }
}
