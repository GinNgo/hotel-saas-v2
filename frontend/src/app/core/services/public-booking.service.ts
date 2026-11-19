import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
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
  PropertyType,
  ALL_PROPERTY_TYPES,
  TouristZoneDto,
  LandmarkDto,
  TenantBrandDto,
  PropertyPolicyDto,
  GuestReviewDto,
  PropertyReviewsSummaryDto,
  SubmitGuestReviewRequest,
  PromotionDealDto,
  GuestCancellationPreviewDto,
  CancelGuestBookingRequest,
  NearbyLandmarkBadgeDto,
  RentalType,
  VnpayReturnVerificationDto,
} from '../models/public-booking.model';
import { QuoteDto } from '../models/reservation.model';

/** Matches backend C# HotelSaas.Domain.Enums.PropertyType (1-based). */
const BACKEND_PROPERTY_TYPE_MAP: Readonly<Record<number, PropertyType>> = {
  1: 'Hotel',
  2: 'Resort',
  3: 'Hostel',
  4: 'BedAndBreakfast',
  5: 'Villa',
  6: 'Apartment',
  7: 'Motel',
  8: 'Homestay',
};

const VALID_PROPERTY_TYPE_SET = new Set<string>(ALL_PROPERTY_TYPES);

interface RawLandmarkPayload {
  landmarkId?: string;
  landmarkName?: string;
  name?: string;
  landmarkSlug?: string;
  slug?: string;
  category?: NearbyLandmarkBadgeDto['category'];
  distanceMeters?: number;
  distanceKm?: number;
  walkingMinutes?: number;
  drivingMinutes?: number;
  isFeatured?: boolean;
}

type RawPropertyPayload = Omit<Partial<PublicPropertyDto>, 'propertyType' | 'nearbyLandmarks'> & {
  propertyType?: PropertyType | number | string;
  nearbyLandmarks?: RawLandmarkPayload[];
};

interface ApiDataEnvelope<T> {
  data?: T;
}

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
      if (filter.tenantSlug?.trim()) {
        params = params.set('tenantSlug', filter.tenantSlug.trim());
      }
      if (filter.provinceCode?.trim()) {
        params = params.set('provinceCode', filter.provinceCode.trim());
      }
      if (filter.rentalType !== undefined && filter.rentalType !== null) {
        params = params.set('rentalType', filter.rentalType.toString());
      }
      if (filter.propertyTypes && filter.propertyTypes.length > 0) {
        const serializedTypes = filter.propertyTypes
          .map(pt => (typeof pt === 'number' ? BACKEND_PROPERTY_TYPE_MAP[pt] : String(pt).trim()))
          .filter((pt): pt is string => Boolean(pt));
        if (serializedTypes.length > 0) {
          params = params.set('propertyTypes', serializedTypes.join(','));
        }
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
      if (filter.maxDistanceMeters !== undefined && filter.maxDistanceMeters !== null) {
        params = params.set('maxDistanceMeters', filter.maxDistanceMeters.toString());
      }
      const lat = filter.userLatitude ?? filter.latitude;
      if (lat !== undefined && lat !== null) {
        params = params.set('userLatitude', lat.toString());
      }
      const lng = filter.userLongitude ?? filter.longitude;
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

    return this.http
      .get<RawPropertyPayload[] | ApiDataEnvelope<RawPropertyPayload[]>>(`${this.apiUrl}/properties`, { params })
      .pipe(
        map(res => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          return list.map(item => this.normalizeProperty(item));
        })
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
    return this.http
      .get<RawPropertyPayload | ApiDataEnvelope<RawPropertyPayload>>(
        `${this.apiUrl}/properties/${encodeURIComponent(slug)}`
      )
      .pipe(
        map(res => {
          const payload =
            res && typeof res === 'object' && 'data' in res && res.data !== undefined
              ? res.data
              : (res as RawPropertyPayload);
          return this.normalizeProperty(payload ?? {});
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
      map(res => (res.data ? res.data : res) as GuestHoldDto),
      tap(hold => this.broadcastLiveBookingPing('hold', hold?.reservationId))
    );
  }

  /**
   * Looks up booking details via cryptographically secure lookup token (PII protected).
   */
  getBookingByToken(lookupToken: string): Observable<GuestBookingDetailDto> {
    return this.http.get<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}`).pipe(
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto),
      tap(detail => this.broadcastLiveBookingPing('confirm', detail?.reservationId, detail?.propertyId, lookupToken))
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
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto),
      tap(detail => this.broadcastLiveBookingPing('confirm', detail?.reservationId, detail?.propertyId, lookupToken))
    );
  }

  /**
   * Retrieves an authoritative pre-cancellation preview with breakdown of fees, refundable amounts, and loyalty points.
   */
  getCancellationPreview(lookupToken: string): Observable<GuestCancellationPreviewDto> {
    return this.http.get<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}/cancel-preview`).pipe(
      map(res => (res.data ? res.data : res) as GuestCancellationPreviewDto)
    );
  }

  /**
   * Submits a guest cancellation request under authoritative policy calculations and records pending refund.
   */
  cancelBooking(lookupToken: string, request?: CancelGuestBookingRequest): Observable<GuestBookingDetailDto> {
    const headers: Record<string, string> = {};
    if (request?.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey;
    }

    return this.http.post<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}/cancel`, request ?? {}, { headers }).pipe(
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto),
      tap(detail => this.broadcastLiveBookingPing('cancel', detail?.reservationId, detail?.propertyId, lookupToken))
    );
  }

  /**
   * Extends active room hold timer by 5 minutes (maximum 1 extension per session).
   */
  extendHold(lookupToken: string): Observable<GuestBookingDetailDto> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${encodeURIComponent(lookupToken)}/extend`, {}).pipe(
      map(res => (res.data ? res.data : res) as GuestBookingDetailDto),
      tap(detail => this.broadcastLiveBookingPing('extend-hold', detail?.reservationId, detail?.propertyId, lookupToken))
    );
  }

  /**
   * Sinh URL thanh toán trực tuyến qua Cổng VNPay Sandbox cho đơn đặt phòng.
   */
  createVnpayPaymentUrl(
    reservationId?: string,
    lookupTokenOrReturnUrl?: string,
    returnUrl?: string
  ): Observable<{ paymentUrl: string; transactionRef: string }> {
    let payload: any = {};
    if (returnUrl) {
      payload = { reservationId, lookupToken: lookupTokenOrReturnUrl, returnUrl };
    } else if (lookupTokenOrReturnUrl && lookupTokenOrReturnUrl.startsWith('http')) {
      payload = { reservationId, returnUrl: lookupTokenOrReturnUrl };
    } else {
      payload = { reservationId, lookupToken: lookupTokenOrReturnUrl };
    }

    return this.http.post<any>(`${environment.apiUrl}/payments/vnpay/create-url`, payload).pipe(
      map(res => (res.data ? res.data : res))
    );
  }

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

  /**
   * Xác thực chữ ký kết quả trả về từ cổng VNPay thông qua endpoint read-only của máy chủ.
   */
  verifyVnpayReturn(vnpParams: Record<string, string>): Observable<VnpayReturnVerificationDto> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(vnpParams)) {
      if (value !== undefined && value !== null) {
        params = params.set(key, value);
      }
    }

    return this.http
      .get<{
        success?: boolean;
        data?: {
          rspCode?: string;
          message?: string;
          txnRef?: string;
          transactionNo?: string;
          amount?: number;
          bankCode?: string;
        };
      }>(`${this.apiUrl}/payments/vnpay/return`, { params })
      .pipe(
        map(res => ({
          success: Boolean(res?.success),
          rspCode: res?.data?.rspCode ?? (res?.success ? '00' : '99'),
          message: res?.data?.message ?? '',
          txnRef: res?.data?.txnRef,
          transactionNo: res?.data?.transactionNo,
          amount: res?.data?.amount,
          bankCode: res?.data?.bankCode
        }))
      );
  }

  /**
   * Retrieves all branches belonging to a tenant brand chain.
   */
  getPropertiesByTenant(tenantIdOrSlug: string): Observable<PublicPropertyDto[]> {
    return this.getProperties().pipe(
      map(props => props.filter(p => p.tenantId === tenantIdOrSlug || p.tenantSlug === tenantIdOrSlug))
    );
  }

  /**
   * Retrieves tenant brand chains aggregated from public properties (supports 1-branch & multi-branch brands).
   */
  getTenantBrands(): Observable<TenantBrandDto[]> {
    return this.getProperties().pipe(
      map(props => {
        const brandMap = new Map<string, { brand: TenantBrandDto; ratedSum: number; ratedCount: number }>();
        for (const p of props) {
          if (!p.tenantBrandName || (!p.tenantId && !p.tenantSlug)) continue;
          const groupKey = p.tenantSlug || p.tenantId;
          const tId = p.tenantId || groupKey;
          const tName = p.tenantBrandName;
          const tSlug = p.tenantSlug || this.slugify(tName) || tId;

          if (!brandMap.has(groupKey)) {
            brandMap.set(groupKey, {
              brand: {
                tenantId: tId,
                name: tName,
                slug: tSlug,
                logoUrl: p.thumbnailUrl || p.imageUrl || undefined,
                description: '',
                totalProperties: 0,
                ratingAverage: 0,
                reviewCount: 0,
                properties: [],
                provinces: [],
                propertyTypes: [],
              },
              ratedSum: 0,
              ratedCount: 0,
            });
          }

          const entry = brandMap.get(groupKey)!;
          const { brand } = entry;
          brand.properties.push(p);
          brand.totalProperties++;
          if (!brand.logoUrl && (p.thumbnailUrl || p.imageUrl)) {
            brand.logoUrl = p.thumbnailUrl || p.imageUrl;
          }
          brand.reviewCount += p.reviewCount ?? 0;
          if ((p.ratingAverage ?? 0) > 0) {
            entry.ratedSum += p.ratingAverage;
            entry.ratedCount++;
          }
          const prov = p.provinceName || p.city;
          if (prov && !brand.provinces.includes(prov)) {
            brand.provinces.push(prov);
          }
          if (p.propertyType && !brand.propertyTypes!.includes(p.propertyType)) {
            brand.propertyTypes!.push(p.propertyType);
          }
        }

        return Array.from(brandMap.values()).map(({ brand, ratedSum, ratedCount }) => {
          brand.ratingAverage = ratedCount > 0 ? Math.round((ratedSum / ratedCount) * 10) / 10 : 0;
          if (!brand.description) {
            const provinceText =
              brand.provinces.length > 0
                ? ` tại ${brand.provinces.slice(0, 3).join(', ')}${brand.provinces.length > 3 ? ' và nhiều địa phương khác' : ''}`
                : '';
            brand.description = `Hệ thống lưu trú gồm ${brand.totalProperties} cơ sở${provinceText}, hỗ trợ đặt phòng linh hoạt trực tuyến.`;
          }
          return brand;
        });
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

  private normalizeProperty(raw: RawPropertyPayload): PublicPropertyDto {
    const propertyId = raw.propertyId ?? raw.id ?? '';
    const thumbnailUrl = raw.thumbnailUrl ?? raw.imageUrl ?? '';
    const provinceName = raw.provinceName ?? raw.city ?? '';
    const addressLine = raw.addressLine ?? raw.address ?? '';
    const startingPriceForSelectedMode =
      raw.startingPriceForSelectedMode ??
      raw.startingPrice ??
      raw.dailyStartingPrice ??
      raw.dailyPriceFrom ??
      raw.overnightStartingPrice ??
      raw.overnightPriceFrom ??
      raw.hourlyStartingPrice ??
      raw.hourlyPriceFrom ??
      0;

    const landmarks: NearbyLandmarkBadgeDto[] = (raw.nearbyLandmarks ?? []).map((l, idx) => ({
      landmarkId: l.landmarkId || l.slug || l.landmarkSlug || `lm-${idx}-${l.name || l.landmarkName || idx}`,
      landmarkName: l.landmarkName || l.name || 'Địa danh',
      landmarkSlug: l.landmarkSlug || l.slug || 'dia-danh',
      category: l.category ?? 'Center',
      distanceMeters: l.distanceMeters ?? (typeof l.distanceKm === 'number' ? Math.round(l.distanceKm * 1000) : 0),
      walkingMinutes: l.walkingMinutes,
      drivingMinutes: l.drivingMinutes,
      isFeatured: l.isFeatured,
    }));

    const derivedRentalTypes: RentalType[] =
      Array.isArray(raw.allowedRentalTypes) && raw.allowedRentalTypes.length > 0
        ? raw.allowedRentalTypes
        : [
            ...(raw.allowHourlyBooking ? (['Hourly'] as const) : []),
            ...(raw.allowOvernightBooking ? (['Overnight'] as const) : []),
            ...(raw.allowDailyBooking ? (['Daily'] as const) : []),
          ];

    return {
      ...(raw as Partial<PublicPropertyDto>),
      propertyId,
      id: raw.id ?? propertyId,
      tenantId: raw.tenantId ?? '',
      tenantBrandName: raw.tenantBrandName ?? '',
      tenantSlug: raw.tenantSlug || undefined,
      name: raw.name ?? '',
      slug: raw.slug ?? '',
      propertyType: this.normalizePropertyType(raw.propertyType),
      addressLine,
      address: raw.address ?? addressLine,
      wardName: raw.wardName ?? '',
      provinceCode: raw.provinceCode ?? '',
      provinceName,
      city: raw.city ?? provinceName,
      thumbnailUrl,
      imageUrl: raw.imageUrl ?? thumbnailUrl,
      galleryUrls: Array.isArray(raw.galleryUrls) ? raw.galleryUrls : [],
      allowedRentalTypes: derivedRentalTypes,
      overnightCheckInTime: raw.overnightCheckInTime ?? '',
      overnightCheckOutTime: raw.overnightCheckOutTime ?? '',
      cleaningBufferMinutes: raw.cleaningBufferMinutes ?? raw.bufferMinutes ?? 0,
      ratingAverage: typeof raw.ratingAverage === 'number' ? raw.ratingAverage : 0,
      reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : 0,
      nearbyLandmarks: landmarks,
      startingPriceForSelectedMode,
      availableRoomTypes: Array.isArray(raw.availableRoomTypes) ? raw.availableRoomTypes : [],
    };
  }

  private normalizePropertyType(rawType: PropertyType | number | string | undefined): PropertyType {
    if (typeof rawType === 'number') {
      return BACKEND_PROPERTY_TYPE_MAP[rawType] ?? 'Hotel';
    }
    if (typeof rawType === 'string' && VALID_PROPERTY_TYPE_SET.has(rawType)) {
      return rawType as PropertyType;
    }
    return 'Hotel';
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
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

  getPropertyReviews(slug: string): Observable<GuestReviewDto[]> {
    return this.http.get<any>(`${this.apiUrl}/properties/${encodeURIComponent(slug)}/reviews`).pipe(
      map(res => {
        if (Array.isArray(res)) return res as GuestReviewDto[];
        if (Array.isArray(res?.data)) return res.data as GuestReviewDto[];
        if (Array.isArray(res?.reviews)) return res.reviews as GuestReviewDto[];
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getPropertyReviewsSummary(slug: string): Observable<PropertyReviewsSummaryDto> {
    return this.http.get<any>(`${this.apiUrl}/properties/${encodeURIComponent(slug)}/reviews`).pipe(
      map(res => (res.data ? res.data : res) as PropertyReviewsSummaryDto)
    );
  }

  submitReview(request: SubmitGuestReviewRequest): Observable<GuestReviewDto> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${encodeURIComponent(request.lookupToken)}/review`, request).pipe(
      map(res => (res.data ? res.data : res) as GuestReviewDto)
    );
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

  private broadcastLiveBookingPing(action: string, reservationId?: string, propertyId?: string, lookupToken?: string): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('hotelsaas-live-notifications');
        channel.postMessage({ action, reservationId, propertyId, lookupToken, timestamp: Date.now() });
        channel.close();
      }
    } catch {
      // Bỏ qua nếu môi trường không hỗ trợ BroadcastChannel
    }
  }
}
