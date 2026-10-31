import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PagedResult, ApiResponse } from '../models/api-response.model';
import {
  ReservationDto,
  ReservationDetailDto,
  RoomAvailabilityDto,
  CreateReservationRequest,
  QuoteDto,
  RentalType,
  ReservationStatus
} from '../models/reservation.model';
import { FolioDto, AddFolioItemRequest } from '../models/payment.model';

function normalizeReservation<T extends ReservationDto>(reservation: T): T {
  const status = typeof reservation.status === 'string'
    ? ReservationStatus[reservation.status as keyof typeof ReservationStatus]
    : reservation.status;
  const rentalType = typeof reservation.rentalType === 'string'
    ? RentalType[reservation.rentalType as keyof typeof RentalType]
    : reservation.rentalType;
  return { ...reservation, status, rentalType };
}

export interface GetReservationsFilter {
  propertyId: string;
  status?: number;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface GetAvailabilityFilter {
  propertyId: string;
  rentalType: RentalType;
  startAtUtc: string;
  endAtUtc: string;
  roomTypeId?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

export interface CalculateQuoteRequest {
  propertyId: string;
  roomTypeId: string;
  rentalType: RentalType;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate?: string;
  checkOutDate?: string;
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reservations`;
  private readonly quotesApiUrl = `${environment.apiUrl}/quotes`;

  /**
   * Retrieves a paginated list of reservations for the given property.
   */
  getReservations(filter: GetReservationsFilter): Observable<PagedResult<ReservationDto>> {
    let params = new HttpParams()
      .set('propertyId', filter.propertyId)
      .set('page', (filter.page ?? 1).toString())
      .set('pageSize', (filter.pageSize ?? 20).toString());

    if (filter.status !== undefined && filter.status !== null) {
      params = params.set('status', filter.status.toString());
    }
    if (filter.from) {
      params = params.set('from', filter.from);
    }
    if (filter.to) {
      params = params.set('to', filter.to);
    }
    if (filter.search && filter.search.trim()) {
      params = params.set('search', filter.search.trim());
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(res => {
        const result = (res.data ? res.data : res) as PagedResult<ReservationDto>;
        return { ...result, items: result.items.map(normalizeReservation) };
      })
    );
  }

  /**
   * Retrieves full details and immutable breakdown snapshot of a reservation.
   */
  getReservationById(id: string, propertyId: string): Observable<ReservationDetailDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.get<any>(`${this.apiUrl}/${id}`, { params }).pipe(
      map(res => normalizeReservation((res.data ? res.data : res) as ReservationDetailDto))
    );
  }

  /**
   * Creates a new internal booking with atomic locking and quote verification.
   */
  createReservation(request: CreateReservationRequest): Observable<ReservationDetailDto> {
    const headers: { [key: string]: string } = {};
    if (request.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey;
    }
    return this.http.post<any>(this.apiUrl, request, { headers }).pipe(
      map(res => normalizeReservation((res.data ? res.data : res) as ReservationDetailDto)),
      tap(detail => this.broadcastLiveReservationPing('create', detail?.id, request.propertyId))
    );
  }

  /**
   * Checks room availability across physical rooms for a time interval with turnover buffer.
   */
  getAvailability(filter: GetAvailabilityFilter): Observable<RoomAvailabilityDto[]> {
    let params = new HttpParams()
      .set('propertyId', filter.propertyId)
      .set('rentalType', filter.rentalType.toString())
      .set('startAtUtc', filter.startAtUtc)
      .set('endAtUtc', filter.endAtUtc);

    if (filter.roomTypeId) {
      params = params.set('roomTypeId', filter.roomTypeId);
    }
    if (filter.checkInDate) {
      params = params.set('checkInDate', filter.checkInDate);
    }
    if (filter.checkOutDate) {
      params = params.set('checkOutDate', filter.checkOutDate);
    }

    return this.http.get<any>(`${this.apiUrl}/availability`, { params }).pipe(
      map(res => (res.data ? res.data : res) as RoomAvailabilityDto[])
    );
  }

  /**
   * Computes authoritative price breakdown via Quote Engine.
   */
  calculateQuote(request: CalculateQuoteRequest): Observable<QuoteDto> {
    return this.http.post<ApiResponse<QuoteDto>>(`${this.quotesApiUrl}/calculate`, request).pipe(
      map(res => res.data as QuoteDto)
    );
  }

  /**
   * Check in a confirmed reservation. Transitions room to Occupied.
   */
  checkIn(id: string, propertyId: string): Observable<ReservationDetailDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.post<any>(`${this.apiUrl}/${id}/check-in`, null, { params }).pipe(
      map(res => normalizeReservation((res.data ? res.data : res) as ReservationDetailDto))
    );
  }

  /**
   * Check out a checked-in reservation. Transitions room to Dirty.
   */
  checkOut(id: string, propertyId: string): Observable<ReservationDetailDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.post<any>(`${this.apiUrl}/${id}/check-out`, null, { params }).pipe(
      map(res => normalizeReservation((res.data ? res.data : res) as ReservationDetailDto)),
      tap(() => this.broadcastLiveReservationPing('check-out', id, propertyId))
    );
  }

  /**
   * Cancel a confirmed or pending reservation.
   */
  cancel(id: string, propertyId: string, reason?: string): Observable<ReservationDetailDto> {
    const params = new HttpParams().set('propertyId', propertyId);
    const body = reason ? { reason } : {};
    return this.http.post<any>(`${this.apiUrl}/${id}/cancel`, body, { params }).pipe(
      map(res => normalizeReservation((res.data ? res.data : res) as ReservationDetailDto)),
      tap(() => this.broadcastLiveReservationPing('cancel', id, propertyId))
    );
  }

  /**
   * Retrieves reservations within a specific date window for Room Timeline / Gantt grid.
   */
  getTimelineReservations(propertyId: string, fromDate: string, toDate: string): Observable<ReservationDto[]> {
    return this.getReservations({
      propertyId,
      from: fromDate,
      to: toDate,
      pageSize: 200
    }).pipe(
      map(res => res.items)
    );
  }

  /**
   * Adds an incidental / minibar / service charge to the reservation folio.
   */
  addFolioItem(reservationId: string, request: AddFolioItemRequest): Observable<FolioDto> {
    let params = new HttpParams();
    if (request.propertyId) {
      params = params.set('propertyId', request.propertyId);
    }
    return this.http.post<any>(`${this.apiUrl}/${reservationId}/folio/items`, request, { params }).pipe(
      map(res => (res.data ? res.data : res) as FolioDto)
    );
  }

  private broadcastLiveReservationPing(action: string, reservationId?: string, propertyId?: string): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('hotelsaas-live-notifications');
        channel.postMessage({ action, reservationId, propertyId, timestamp: Date.now() });
        channel.close();
      }
    } catch {
      // Bỏ qua nếu môi trường không hỗ trợ BroadcastChannel
    }
  }
}
