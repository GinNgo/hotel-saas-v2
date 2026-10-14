import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  RoomTypeRateDto,
  RoomTypeRateAuditDto,
  CreateRoomTypeRateRequest
} from '../models/rate.model';

@Injectable({ providedIn: 'root' })
export class RateService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/room-types`;

  getRates(roomTypeId: string, propertyId?: string): Observable<RoomTypeRateDto[]> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http
      .get<ApiResponse<RoomTypeRateDto[]>>(`${this.apiUrl}/${roomTypeId}/rates`, { params })
      .pipe(map(res => res.data || []));
  }

  getRateHistory(roomTypeId: string, propertyId?: string): Observable<RoomTypeRateAuditDto[]> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http
      .get<ApiResponse<RoomTypeRateAuditDto[]>>(`${this.apiUrl}/${roomTypeId}/rates/history`, { params })
      .pipe(map(res => res.data || []));
  }

  createRate(roomTypeId: string, request: CreateRoomTypeRateRequest): Observable<RoomTypeRateDto> {
    return this.http
      .post<ApiResponse<RoomTypeRateDto>>(`${this.apiUrl}/${roomTypeId}/rates`, request)
      .pipe(map(res => res.data as RoomTypeRateDto));
  }
}
