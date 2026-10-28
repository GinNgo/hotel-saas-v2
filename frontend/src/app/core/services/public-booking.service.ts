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
  LandmarkDto,
  TenantBrandDto,
  PropertyPolicyDto,
  GuestReviewDto,
  SubmitGuestReviewRequest,
  PromotionDealDto
} from '../models/public-booking.model';
import { QuoteDto } from '../models/reservation.model';
import { of } from 'rxjs';

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
      map(res => {
        const property = (res.data ?? res) as PublicPropertyDto;
        return { ...property, propertyId: property.propertyId ?? property.id ?? '',
          thumbnailUrl: property.thumbnailUrl ?? property.imageUrl ?? '', galleryUrls: property.galleryUrls ?? [],
          nearbyLandmarks: property.nearbyLandmarks ?? [], reviewCount: property.reviewCount ?? 0, ratingAverage: property.ratingAverage ?? 0 };
      })
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
      map(res => {
        const rooms = (res.data ?? res) as PublicRoomTypeAvailabilityDto[];
        return rooms.map(room => ({ ...room, name: room.name ?? room.roomTypeName ?? '',
          maxGuests: room.maxGuests ?? room.maxOccupancy ?? 0,
          availableRoomsCount: room.availableRoomsCount ?? room.availableRooms ?? 0,
          calculatedQuoteTotal: room.calculatedQuoteTotal ?? room.estimatedPrice ?? 0,
          amenities: room.amenities ?? [], images: room.images ?? [] }));
      })
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

  /**
   * Sinh URL thanh toán trực tuyến qua Cổng VNPay Sandbox cho đơn đặt phòng.
   */
  createVnpayPaymentUrl(reservationId?: string, lookupToken?: string, returnUrl?: string): Observable<{ paymentUrl: string; transactionRef: string }> {
    return this.http.post<any>(`${environment.apiUrl}/payments/vnpay/create-url`, { reservationId, lookupToken, returnUrl }).pipe(
      map(res => (res.data ? res.data : res))
    );
  }

  /**
   * Retrieves all branches belonging to a tenant brand chain.
   */
  /**
   * Sinh mã VietQR động chuẩn NAPAS 24/7 theo đơn đặt phòng hoặc số tiền yêu cầu.
   */
  generateVietQr(payload: {
    amount: number;
    confirmationCode?: string;
    reservationId?: string;
    bankBin?: string;
    accountNumber?: string;
    accountName?: string;
    description?: string;
  }): Observable<{
    qrImageUrl: string;
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    description: string;
    confirmationCode: string;
    quickPayDeepLink: string;
  }> {
    return this.http.post<any>(`${environment.apiUrl}/public/payments/vietqr/generate`, payload).pipe(
      map(res => (res.data ? res.data : res))
    );
  }

  getPropertiesByTenant(tenantId: string): Observable<PublicPropertyDto[]> {
    return this.getProperties().pipe(
      map(props => props.filter(p => p.tenantId === tenantId))
    );
  }

  /**
   * Retrieves tenant brand chains aggregated from public properties.
   */
  getTenantBrands(): Observable<TenantBrandDto[]> {
    return this.getProperties().pipe(
      map(props => {
        const brandMap = new Map<string, TenantBrandDto>();
        for (const p of props) {
          if (!p.tenantId || !p.tenantBrandName) continue;
          const tId = p.tenantId;
          const tName = p.tenantBrandName;
          const tSlug = tName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

          if (!brandMap.has(tId)) {
            brandMap.set(tId, {
              tenantId: tId,
              name: tName,
              slug: tSlug,
              logoUrl: p.thumbnailUrl || p.imageUrl,
              description: '',
              totalProperties: 0,
              ratingAverage: 0,
              reviewCount: 0,
              properties: [],
              provinces: []
            });
          }

          const brand = brandMap.get(tId)!;
          brand.properties.push(p);
          brand.totalProperties++;
          const prov = p.provinceName || p.city;
          if (prov && !brand.provinces.includes(prov)) {
            brand.provinces.push(prov);
          }
        }
        return Array.from(brandMap.values());
      })
    );
  }

  /**
   * Retrieves a tenant brand profile by slug or tenantId.
   */
  getTenantBrandBySlug(slug: string): Observable<TenantBrandDto | null> {
    return this.getTenantBrands().pipe(
      map(brands => brands.find(b => b.slug === slug || b.tenantId === slug) ?? null)
    );
  }

  /**
   * Retrieves operational policies for a property.
   */
  getPropertyPolicies(slug: string): Observable<PropertyPolicyDto> {
    return this.getPropertyBySlug(slug).pipe(map(property => ({
      propertyId: property.propertyId || property.id || '',
      propertyName: property.name,
      checkInTime: property.checkInTime || '',
      checkOutTime: property.checkOutTime || '',
      bufferMinutes: property.bufferMinutes ?? property.cleaningBufferMinutes ?? 0,
      maxHourlyHours: property.maxHourlyHours ?? 0,
      cancellationPolicy: '',
      generalRules: [],
    })));
  }

  getPropertyReviews(_slug: string): Observable<GuestReviewDto[]> {
    return of([]);
  }
  submitReview(request: SubmitGuestReviewRequest): Observable<boolean> {
    // Contract FR10: Honest capability. Guest reviews submission endpoint is gated for a future sprint.
    return of(false);
  }

  /**
   * Retrieves active promotional deals and golden-hour discounts.
   */
  getPromotions(): Observable<PromotionDealDto[]> {
    return of([
      {
        id: 'deal-01',
        code: 'GIODAY20',
        title: 'Giờ Vàng Nghỉ Trưa - Giảm 20% Thuê Theo Giờ',
        description: 'Áp dụng cho khách đặt phòng nghỉ theo giờ từ 11:00 đến 15:00 các ngày trong tuần tại tất cả nhà nghỉ & motel.',
        discountBadge: 'GIẢM 20%',
        discountType: 'Percent',
        discountValue: 20,
        rentalType: 'Hourly',
        expiresAt: '31/12/2026',
        bannerImageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'
      },
      {
        id: 'deal-02',
        code: 'QUADEM15',
        title: 'Combo Qua Đêm Cuối Tuần - Tiết Kiệm 15%',
        description: 'Nhận phòng từ 21:00 đến 10:00 sáng hôm sau. Tặng kèm nước suối và ưu đãi trả phòng muộn 30 phút.',
        discountBadge: 'GIẢM 15%',
        discountType: 'Percent',
        discountValue: 15,
        rentalType: 'Overnight',
        expiresAt: '31/12/2026',
        bannerImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
      },
      {
        id: 'deal-03',
        code: 'DALAT50K',
        title: 'Voucher Du Lịch Đà Lạt - Giảm Ngay 50.000₫',
        description: 'Áp dụng cho mọi cơ sở lưu trú gần Chợ Đêm Đà Lạt và Hồ Xuân Hương cho đơn đặt phòng từ 300.000₫.',
        discountBadge: '-50.000₫',
        discountType: 'Amount',
        discountValue: 50000,
        applicableDestinations: ['Đà Lạt', 'Lâm Đồng'],
        expiresAt: '31/12/2026',
        minSpend: 300000,
        bannerImageUrl: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=800'
      },
      {
        id: 'deal-04',
        code: 'BIENVUNGTAU',
        title: 'Ưu Đãi Nghỉ Dưỡng Vũng Tàu Bãi Sau',
        description: 'Giảm 10% cho khách đặt phòng khách sạn & nhà nghỉ cách Bãi Sau dưới 1km.',
        discountBadge: 'GIẢM 10%',
        discountType: 'Percent',
        discountValue: 10,
        applicableDestinations: ['Vũng Tàu'],
        expiresAt: '31/12/2026',
        bannerImageUrl: 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800'
      }
    ]);
  }
}
