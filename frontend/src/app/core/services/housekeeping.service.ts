import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CreateHousekeepingTaskRequest,
  HousekeepingPriority,
  HousekeepingStaffOptionDto,
  HousekeepingTaskDto,
  HousekeepingTaskStatus
} from '../models/housekeeping.model';
import { RoomStatus } from '../models/enums';

export interface GetHousekeepingTasksFilter {
  status?: HousekeepingTaskStatus | null;
  priority?: HousekeepingPriority | null;
  assignedToMe?: boolean | null;
}

interface RawHousekeepingTaskResponse extends Omit<HousekeepingTaskDto, 'status' | 'priority' | 'effectivePriority' | 'roomStatus'> {
  status: HousekeepingTaskStatus | number | string;
  priority: HousekeepingPriority | number | string;
  effectivePriority: HousekeepingPriority | number | string;
  roomStatus: RoomStatus | number | string;
}

function normalizeTaskStatus(value: HousekeepingTaskStatus | number | string): HousekeepingTaskStatus {
  switch (value) {
    case 1:
    case '1':
    case HousekeepingTaskStatus.Pending:
      return HousekeepingTaskStatus.Pending;
    case 2:
    case '2':
    case HousekeepingTaskStatus.InProgress:
      return HousekeepingTaskStatus.InProgress;
    case 3:
    case '3':
    case HousekeepingTaskStatus.Completed:
      return HousekeepingTaskStatus.Completed;
    case 4:
    case '4':
    case HousekeepingTaskStatus.Claimed:
      return HousekeepingTaskStatus.Claimed;
    default:
      return HousekeepingTaskStatus.Pending;
  }
}

function normalizePriority(value: HousekeepingPriority | number | string): HousekeepingPriority {
  switch (value) {
    case 1:
    case '1':
    case HousekeepingPriority.Low:
      return HousekeepingPriority.Low;
    case 2:
    case '2':
    case HousekeepingPriority.Normal:
      return HousekeepingPriority.Normal;
    case 3:
    case '3':
    case HousekeepingPriority.High:
      return HousekeepingPriority.High;
    case 4:
    case '4':
    case HousekeepingPriority.Urgent:
      return HousekeepingPriority.Urgent;
    default:
      return HousekeepingPriority.Normal;
  }
}

function normalizeRoomStatus(value: RoomStatus | number | string): RoomStatus {
  switch (value) {
    case 1:
    case '1':
    case RoomStatus.Clean:
      return RoomStatus.Clean;
    case 2:
    case '2':
    case RoomStatus.Dirty:
      return RoomStatus.Dirty;
    case 3:
    case '3':
    case RoomStatus.Cleaning:
      return RoomStatus.Cleaning;
    case 4:
    case '4':
    case RoomStatus.Occupied:
      return RoomStatus.Occupied;
    case 5:
    case '5':
    case RoomStatus.OutOfService:
      return RoomStatus.OutOfService;
    default:
      return RoomStatus.Dirty;
  }
}

function normalizeHousekeepingTask(raw: RawHousekeepingTaskResponse): HousekeepingTaskDto {
  return {
    ...raw,
    status: normalizeTaskStatus(raw.status),
    priority: normalizePriority(raw.priority),
    effectivePriority: normalizePriority(raw.effectivePriority),
    roomStatus: normalizeRoomStatus(raw.roomStatus)
  };
}

@Injectable({ providedIn: 'root' })
export class HousekeepingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/housekeeping`;

  getTasks(propertyId: string, filter?: GetHousekeepingTasksFilter): Observable<HousekeepingTaskDto[]> {
    let params = new HttpParams().set('propertyId', propertyId);
    if (filter?.status) {
      params = params.set('status', filter.status);
    }
    if (filter?.priority) {
      params = params.set('priority', filter.priority);
    }
    if (filter?.assignedToMe) {
      params = params.set('assignedToMe', 'true');
    }

    return this.http.get<RawHousekeepingTaskResponse[]>(this.apiUrl, { params }).pipe(
      map(items => (items || []).map(normalizeHousekeepingTask))
    );
  }

  getAssignableStaff(propertyId: string): Observable<HousekeepingStaffOptionDto[]> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.get<HousekeepingStaffOptionDto[]>(`${this.apiUrl}/staff`, { params });
  }

  createTask(request: CreateHousekeepingTaskRequest): Observable<HousekeepingTaskDto> {
    return this.http.post<RawHousekeepingTaskResponse>(this.apiUrl, request).pipe(
      map(normalizeHousekeepingTask)
    );
  }

  assignTask(taskId: string, propertyId: string, assignedToUserId: string): Observable<HousekeepingTaskDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http
      .post<RawHousekeepingTaskResponse>(`${this.apiUrl}/${taskId}/assign`, { assignedToUserId, propertyId }, { params })
      .pipe(map(normalizeHousekeepingTask));
  }

  claimTask(taskId: string, propertyId: string): Observable<HousekeepingTaskDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http
      .post<RawHousekeepingTaskResponse>(`${this.apiUrl}/${taskId}/claim`, null, { params })
      .pipe(map(normalizeHousekeepingTask));
  }

  startTask(taskId: string, propertyId: string): Observable<HousekeepingTaskDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http
      .post<RawHousekeepingTaskResponse>(`${this.apiUrl}/${taskId}/start`, null, { params })
      .pipe(map(normalizeHousekeepingTask));
  }

  completeTask(taskId: string, propertyId: string, notes?: string): Observable<HousekeepingTaskDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const body = notes ? { notes, propertyId } : null;
    return this.http
      .post<RawHousekeepingTaskResponse>(`${this.apiUrl}/${taskId}/complete`, body, { params })
      .pipe(map(normalizeHousekeepingTask));
  }
}
