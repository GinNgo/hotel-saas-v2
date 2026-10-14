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
  ConfirmGuestBookingRequest,
  PublicPropertiesFilter,
  TouristZoneDto,
  LandmarkDto
} from '../models/public-booking.model';
import { QuoteDto } from '../models/reservation.model';

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/public`;

  /**
   * Retrieves all active properties available for public booking with rich multi-criteria filters.
   */
  getProperties(filter?: string | PublicPropertiesFilter): Observable<PublicPropertyDto[]> {
    let params = new HttpParams();

    if (typeof filter === 'string') {
      if (filter.trim()) {
        params = params.set('search', filter.trim());
      }
    } else if (filter) {
      if (filter.search?.trim()) {
        params = params.set('search', filter.search.trim());
      }
      if (filter.destinationKeyword?.trim()) {
        params = params.set('destinationKeyword', filter.destinationKeyword.trim());
      }
      if (filter.rentalType !== undefined && filter.rentalType !== null) {
        params = params.set('rentalType', filter.rentalType.toString());
      }
      if (filter.propertyTypes && filter.propertyTypes.length > 0) {
        filter.propertyTypes.forEach(pt => {
          params = params.append('propertyTypes', pt.toString());
        });
      }
      if (filter.touristZoneSlug?.trim()) {
        params = params.set('touristZoneSlug', filter.touristZoneSlug.trim());
      }
      if (filter.landmarkSlug?.trim()) {
        params = params.set('landmarkSlug', filter.landmarkSlug.trim());
      }
      if (filter.maxDistanceKm !== undefined && filter.maxDistanceKm !== null) {
        params = params.set('maxDistanceKm', filter.maxDistanceKm.toString());
      }
      if ((filter as any).maxDistanceMeters !== undefined && (filter as any).maxDistanceMeters !== null) {
        params = params.set('maxDistanceMeters', (filter as any).maxDistanceMeters.toString());
      }
      const lat = (filter as any).userLatitude ?? filter.latitude;
      if (lat !== undefined && lat !== null) {
        params = params.set('userLatitude', lat.toString());
      }
      const lng = (filter as any).userLongitude ?? filter.longitude;
      if (lng !== undefined && lng !== null) {
        params = params.set('userLongitude', lng.toString());
      }
      if (filter.page) {
        params = params.set('page', filter.page.toString());
      }
      if (filter.pageSize) {
        params = params.set('pageSize', filter.pageSize.toString());
      }
    }

    return this.http.get<any>(`${this.apiUrl}/properties`, { params }).pipe(
      map(res => (res.data ? res.data : res) as PublicPropertyDto[])
    );
  }

  /**
   * Retrieves list of tourist zones for destination discovery and autocomplete.
   */
  getTouristZones(): Observable<TouristZoneDto[]> {
    return this.http.get<any>(`${this.apiUrl}/tourist-zones`).pipe(
      map(res => (res.data ? res.data : res) as TouristZoneDto[])
    );
  }

  /**
   * Retrieves landmarks for a given province or tourist zone.
   */
  getLandmarks(options?: { provinceCode?: string; touristZoneSlug?: string }): Observable<LandmarkDto[]> {
    let params = new HttpParams();
    if (options?.provinceCode) {
      params = params.set('provinceCode', options.provinceCode);
    }
    if (options?.touristZoneSlug) {
      params = params.set('touristZoneSlug', options.touristZoneSlug);
    }
    return this.http.get<any>(`${this.apiUrl}/landmarks`, { params }).pipe(
      map(res => (res.data ? res.data : res) as LandmarkDto[])
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
