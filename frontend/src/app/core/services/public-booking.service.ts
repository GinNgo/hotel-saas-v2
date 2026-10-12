import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  PublicPropertyDto,
  PublicRoomTypeDto,
  PublicRoomTypeAvailabilityDto,
  GuestHoldDto,
  GuestBookingDetailDto,
  CalculatePublicQuoteRequest,
  CreateGuestHoldRequest,
  ConfirmGuestBookingRequest
} from '../models/public-booking.model';
import { QuoteDto } from '../models/reservation.model';

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/public`;

  /**
   * Retrieves all active properties available for public booking.
   */
  getProperties(search?: string): Observable<PublicPropertyDto[]> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<any>(`${this.apiUrl}/properties`, { params }).pipe(
      map(res => (res.data ? res.data : res) as PublicPropertyDto[])
    );
  }

  /**
   * Retrieves a property by its public slug or ID.
   */
  getPropertyBySlug(slug: string): Observable<PublicPropertyDto> {
    return this.http.get<any>(`${this.apiUrl}/properties/${encodeURIComponent(slug)}`).pipe(
      map(res => (res.data ? res.data : res) as PublicPropertyDto)
    );
  }

  /**
   * Retrieves all available room types for a specific property.
   */
  getRoomTypes(slug: string): Observable<PublicRoomTypeDto[]> {
    return this.http.get<any>(`${this.apiUrl}/properties/${encodeURIComponent(slug)}/room-types`).pipe(
      map(res => (res.data ? res.data : res) as PublicRoomTypeDto[])
    );
  }

  /**
   * Retrieves real-time room type availability and pricing estimates for a stay interval.
   */
  getAvailability(
    slug: string,
    query: {
      rentalType: number;
      startAtUtc: string;
      endAtUtc: string;
      checkInDate?: string;
      checkOutDate?: string;
    }
  ): Observable<PublicRoomTypeAvailabilityDto[]> {
    let params = new HttpParams()
      .set('rentalType', query.rentalType.toString())
      .set('startAtUtc', query.startAtUtc)
      .set('endAtUtc', query.endAtUtc);

    if (query.checkInDate) {
      params = params.set('checkInDate', query.checkInDate);
    }
    if (query.checkOutDate) {
      params = params.set('checkOutDate', query.checkOutDate);
    }

    return this.http.get<any>(`${this.apiUrl}/properties/${encodeURIComponent(slug)}/availability`, { params }).pipe(
      map(res => (res.data ? res.data : res) as PublicRoomTypeAvailabilityDto[])
    );
  }

  /**
   * Requests an authoritative quote calculation from the server's Pricing Engine.
   */
  calculateQuote(request: CalculatePublicQuoteRequest): Observable<QuoteDto> {
    return this.http.post<any>(`${this.apiUrl}/quotes`, request).pipe(
      map(res => (res.data ? res.data : res) as QuoteDto)
    );
  }

  /**
   * Places a 15-minute room hold under row lock with server auto-assigned physical room.
   */
  createHold(request: CreateGuestHoldRequest): Observable<GuestHoldDto> {
    const headers: Record<string, string> = {};
    if (request.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey;
    }

    return this.http.post<any>(`${this.apiUrl}/bookings/hold`, request, { headers }).pipe(
      map(res => (res.data ? res.data : res) as GuestHoldDto)
    );
  }

  /**
   * Looks up booking details via cryptographically secure lookup token (PII protected).
   */
  getBookingByToken(lookupToken: string): Observable<GuestBookingDetailDto> {
    return this.http.get<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}`).pipe(
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto)
    );
  }

  /**
   * Confirms a held booking with deposit payment. Replay is idempotent.
   */
  confirmBooking(lookupToken: string, request?: ConfirmGuestBookingRequest): Observable<GuestBookingDetailDto> {
    const headers: Record<string, string> = {};
    if (request?.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey;
    }

    return this.http.post<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}/confirm`, request ?? {}, { headers }).pipe(
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto)
    );
  }
}
