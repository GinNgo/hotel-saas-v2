import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/api-response.model';
import { RoomTypeDto, CreateRoomTypeRequest, UpdateRoomTypeRequest } from '../models/room-type.model';

@Injectable({ providedIn: 'root' })
export class RoomTypeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/room-types`;

  getRoomTypes(search?: string, page = 1, pageSize = 50): Observable<PagedResult<RoomTypeDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PagedResult<RoomTypeDto>>(this.apiUrl, { params });
  }

  getRoomTypeById(id: string): Observable<RoomTypeDto> {
    return this.http.get<RoomTypeDto>(`${this.apiUrl}/${id}`);
  }

  createRoomType(data: CreateRoomTypeRequest): Observable<RoomTypeDto> {
    return this.http.post<RoomTypeDto>(this.apiUrl, data);
  }

  updateRoomType(id: string, data: UpdateRoomTypeRequest): Observable<RoomTypeDto> {
    return this.http.put<RoomTypeDto>(`${this.apiUrl}/${id}`, { ...data, id });
  }

  deleteRoomType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
