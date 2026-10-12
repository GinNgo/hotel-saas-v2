import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/api-response.model';
import { RoomDto, CreateRoomRequest, UpdateRoomRequest } from '../models/room.model';
import { RoomStatus } from '../models/enums';

export interface GetRoomsFilter {
  search?: string;
  roomTypeId?: string;
  status?: RoomStatus | string;
  floor?: number;
  isActive?: boolean;
  createdFromUtc?: string;
  createdToUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateRoomStatusRequest {
  status: RoomStatus;
  expectedOldStatus: RoomStatus;
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/rooms`;

  getRooms(filter: GetRoomsFilter = {}): Observable<PagedResult<RoomDto>> {
    let params = new HttpParams()
      .set('page', (filter.page ?? 1).toString())
      .set('pageSize', (filter.pageSize ?? 50).toString());

    if (filter.search && filter.search.trim()) {
      params = params.set('search', filter.search.trim());
    }
    if (filter.roomTypeId) {
      params = params.set('roomTypeId', filter.roomTypeId);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    if (filter.floor !== undefined && filter.floor !== null) {
      params = params.set('floor', filter.floor.toString());
    }
    if (filter.isActive !== undefined && filter.isActive !== null) {
      params = params.set('isActive', filter.isActive.toString());
    }
    if (filter.createdFromUtc) {
      params = params.set('createdFromUtc', filter.createdFromUtc);
    }
    if (filter.createdToUtc) {
      params = params.set('createdToUtc', filter.createdToUtc);
    }

    return this.http.get<PagedResult<RoomDto>>(this.apiUrl, { params });
  }

  getRoomById(id: string): Observable<RoomDto> {
    return this.http.get<RoomDto>(`${this.apiUrl}/${id}`);
  }

  createRoom(data: CreateRoomRequest): Observable<RoomDto> {
    return this.http.post<RoomDto>(this.apiUrl, data);
  }

  updateRoom(id: string, data: UpdateRoomRequest): Observable<RoomDto> {
    return this.http.put<RoomDto>(`${this.apiUrl}/${id}`, { ...data, id });
  }

  updateRoomStatus(id: string, newStatus: RoomStatus, expectedOldStatus: RoomStatus): Observable<RoomDto> {
    const payload: UpdateRoomStatusRequest = {
      status: newStatus,
      expectedOldStatus: expectedOldStatus
    };
    return this.http.patch<RoomDto>(`${this.apiUrl}/${id}/status`, payload);
  }

  deleteRoom(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
