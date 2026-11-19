import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { PublicBookingService } from './public-booking.service';
import { environment } from '../../../environments/environment';

describe('PublicBookingService', () => {
  let mockHttp: any;
  let service: PublicBookingService;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        PublicBookingService,
        { provide: HttpClient, useValue: mockHttp }
      ]
    });

    service = runInInjectionContext(injector, () => injector.get(PublicBookingService));
  });

  it('1. should call GET /public/properties with optional search parameter', () => {
    const mockProperties = [
      { id: 'p1', name: 'Danang Beach Hotel', slug: 'danang-beach' }
    ];
    mockHttp.get.mockReturnValue(of(mockProperties));

    service.getProperties('beach').subscribe(data => {
      expect(data.length).toBe(1);
      expect(data[0].slug).toBe('danang-beach');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/properties`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('skips entries without tenant identity and builds 1-branch brand fallback description', async () => {
    mockHttp.get.mockReturnValue(of([
      { id: 'unknown', name: 'Independent hotel' },
      { id: 'known', name: 'Branch', tenantId: 'brand-id', tenantBrandName: 'Real Brand' },
    ]));
    const brands = await firstValueFrom(service.getTenantBrands());
      expect(brands).toHaveLength(1);
      expect(brands[0].tenantId).toBe('brand-id');
      expect(brands[0].slug).toBe('real-brand');
      expect(brands[0].totalProperties).toBe(1);
      expect(brands[0].ratingAverage).toBe(0);
      expect(brands[0].reviewCount).toBe(0);
      expect(brands[0].description).toContain('Hệ thống lưu trú gồm 1 cơ sở');
  });

  it('aggregates multi-branch & single-branch brands with tenantSlug, ratings, reviews, provinces, and propertyTypes', async () => {
    mockHttp.get.mockReturnValue(of([
      {
        id: 'b1',
        name: 'Branch 1',
        tenantId: 't-1',
        tenantBrandName: 'Chuỗi Đà Lạt Chill',
        tenantSlug: 'chuoi-da-lat-chill',
        propertyType: 'Homestay',
        provinceName: 'Lâm Đồng',
        ratingAverage: 4.8,
        reviewCount: 15,
        imageUrl: 'https://cdn.example.com/1.jpg',
      },
      {
        id: 'b2',
        name: 'Branch 2',
        tenantId: 't-1',
        tenantBrandName: 'Chuỗi Đà Lạt Chill',
        tenantSlug: 'chuoi-da-lat-chill',
        propertyType: 'Villa',
        city: 'Khánh Hòa',
        ratingAverage: 4.4,
        reviewCount: 5,
      },
      {
        id: 'b3',
        name: 'Solo Boutique',
        tenantId: 't-2',
        tenantBrandName: 'Solo Boutique Hotel',
        tenantSlug: 'solo-boutique-hotel',
        propertyType: 1,
        provinceName: 'Hà Nội',
        ratingAverage: 0,
        reviewCount: 0,
      },
    ]));

    const brands = await firstValueFrom(service.getTenantBrands());
    expect(brands).toHaveLength(2);

    const dalatBrand = brands.find(b => b.slug === 'chuoi-da-lat-chill')!;
    expect(dalatBrand.totalProperties).toBe(2);
    expect(dalatBrand.ratingAverage).toBe(4.6);
    expect(dalatBrand.reviewCount).toBe(20);
    expect(dalatBrand.provinces).toEqual(['Lâm Đồng', 'Khánh Hòa']);
    expect(dalatBrand.propertyTypes).toEqual(['Homestay', 'Villa']);
    expect(dalatBrand.logoUrl).toBe('https://cdn.example.com/1.jpg');

    const soloBrand = brands.find(b => b.slug === 'solo-boutique-hotel')!;
    expect(soloBrand.totalProperties).toBe(1);
    expect(soloBrand.propertyTypes).toEqual(['Hotel']);
  });

  it('2. should call GET /public/properties/{slug} for single property details', () => {
    const mockProperty = { id: 'p1', name: 'Danang Beach Hotel', slug: 'danang-beach' };
    mockHttp.get.mockReturnValue(of(mockProperty));

    service.getPropertyBySlug('danang-beach').subscribe(data => {
      expect(data.id).toBe('p1');
      expect(data.name).toBe('Danang Beach Hotel');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/properties/danang-beach`
    );
  });

  it('3. should call GET /public/properties/{slug}/room-types for active room types', () => {
    const mockRoomTypes = [
      { id: 'rt1', name: 'Deluxe Ocean View', basePrice: 1000000 }
    ];
    mockHttp.get.mockReturnValue(of(mockRoomTypes));

    service.getRoomTypes('danang-beach').subscribe(data => {
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('Deluxe Ocean View');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/properties/danang-beach/room-types`
    );
  });

  it('4. should call GET /public/properties/{slug}/availability with stay interval parameters', () => {
    const mockAvail = [
      { roomTypeId: 'rt1', roomTypeName: 'Deluxe Ocean View', availableRooms: 3, isAvailable: true }
    ];
    mockHttp.get.mockReturnValue(of(mockAvail));

    service.getAvailability('danang-beach', {
      rentalType: 2,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z',
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-16'
    }).subscribe(data => {
      expect(data.length).toBe(1);
      expect(data[0].availableRooms).toBe(3);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/properties/danang-beach/availability`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('normalizes server availability field names without inventing capacity', () => {
    mockHttp.get.mockReturnValue(of([{ roomTypeId: 'rt1', roomTypeName: 'Deluxe', availableRooms: 3, maxOccupancy: 4 }]));
    service.getAvailability('hotel', { rentalType: 3, startAtUtc: '2099-10-20T07:00:00Z', endAtUtc: '2099-10-22T05:00:00Z' }).subscribe(rooms => {
      expect(rooms[0]).toMatchObject({ availableRoomsCount: 3, maxGuests: 4, name: 'Deluxe' });
    });
  });

  it('does not fabricate guest reviews or cancellation rules', () => {
    mockHttp.get.mockReturnValue(of({ id: 'p', name: 'Hotel', checkInTime: '14:00:00', checkOutTime: '12:00:00' }));
    service.getPropertyReviews('hotel').subscribe(reviews => expect(reviews).toEqual([]));
    service.getPropertyPolicies('hotel').subscribe(policy => {
      expect(policy.cancellationPolicy).toBe('');
      expect(policy.earlyCheckInFeePerHour).toBeUndefined();
    });
  });

  it('calls POST /public/bookings/{lookupToken}/review when submitting a review', () => {
    const reviewReq = {
      lookupToken: 'token-abc',
      rating: 5,
      cleanlinessRating: 5,
      comment: 'Tuyệt vời!'
    };
    mockHttp.post.mockReturnValue(of({ id: 'rev-1', rating: 5 }));

    service.submitReview(reviewReq).subscribe(res => {
      expect(res).toBeDefined();
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/bookings/token-abc/review`,
      reviewReq
    );
  });

  it('5. should call POST /public/quotes to calculate authoritative quote', () => {
    const quoteReq = {
      propertySlug: 'danang-beach',
      roomTypeId: 'rt1',
      rentalType: 2,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z'
    };
    const mockQuote = { totalAmount: 1000000, breakdown: [] };
    mockHttp.post.mockReturnValue(of(mockQuote));

    service.calculateQuote(quoteReq).subscribe(data => {
      expect(data.totalAmount).toBe(1000000);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/quotes`,
      quoteReq
    );
  });

  it('6. should call POST /public/bookings/hold with Idempotency-Key header', () => {
    const holdReq = {
      propertySlug: 'danang-beach',
      roomTypeId: 'rt1',
      rentalType: 2,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z',
      guestName: 'Nguyen Van A',
      guestEmail: 'nguyen.a@example.com',
      guestPhone: '0901234567',
      numberOfGuests: 2,
      idempotencyKey: 'idemp-hold-001'
    };
    const mockHold = {
      reservationId: 'res-1',
      confirmationCode: 'RES-ABC123',
      lookupToken: 'token-xyz',
      depositRequired: 300000,
      secondsRemaining: 900
    };
    mockHttp.post.mockReturnValue(of(mockHold));

    service.createHold(holdReq).subscribe(data => {
      expect(data.lookupToken).toBe('token-xyz');
      expect(data.depositRequired).toBe(300000);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/bookings/hold`,
      holdReq,
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'idemp-hold-001' }
      })
    );
  });

  it('7. should call GET /public/bookings/{lookupToken} for booking details', () => {
    const mockDetail = {
      reservationId: 'res-1',
      confirmationCode: 'RES-ABC123',
      lookupToken: 'token-xyz',
      maskedGuestEmail: 'n***a@example.com',
      maskedGuestPhone: '090****567',
      status: 'PendingPayment'
    };
    mockHttp.get.mockReturnValue(of(mockDetail));

    service.getBookingByToken('token-xyz').subscribe(data => {
      expect(data.maskedGuestEmail).toBe('n***a@example.com');
      expect(data.status).toBe('PendingPayment');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/bookings/token-xyz`
    );
  });

  it('8. should call POST /public/bookings/{lookupToken}/confirm to confirm booking', () => {
    const confirmReq = {
      paymentAmount: 300000,
      paymentMethod: 'BankTransfer',
      idempotencyKey: 'idemp-confirm-001'
    };
    const mockConfirmed = {
      reservationId: 'res-1',
      status: 'Confirmed',
      paidAmount: 300000
    };
    mockHttp.post.mockReturnValue(of(mockConfirmed));

    service.confirmBooking('token-xyz', confirmReq).subscribe(data => {
      expect(data.status).toBe('Confirmed');
      expect(data.paidAmount).toBe(300000);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/public/bookings/token-xyz/confirm`,
      confirmReq,
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'idemp-confirm-001' }
      })
    );
  });
});

describe('PublicBookingService with HttpTestingController (P7 Contract Regression)', () => {
  let httpTesting: any;
  let service: PublicBookingService;
  let envInjector: any;

  beforeEach(async () => {
    const { createEnvironmentInjector, Injector, PendingTasks, ɵPendingTasksInternal } = await import('@angular/core');
    const { provideHttpClient, withNoXsrfProtection } = await import('@angular/common/http');
    const { HttpTestingController, provideHttpClientTesting } = await import('@angular/common/http/testing');

    const parent = Injector.create({ providers: [] });
    envInjector = createEnvironmentInjector(
      [
        { provide: ɵPendingTasksInternal, useValue: { add: () => () => {}, remove: () => {} } },
        { provide: PendingTasks, useValue: { add: () => () => {}, remove: () => {}, hasPendingTasks: false } },
        PublicBookingService,
        provideHttpClient(withNoXsrfProtection()),
        provideHttpClientTesting()
      ],
      parent as any
    );

    service = envInjector.get(PublicBookingService);
    httpTesting = envInjector.get(HttpTestingController);
  });

  afterEach(() => {
    if (httpTesting) {
      httpTesting.verify();
    }
  });

  it('1. should construct correct GET query URL for Vietnamese accented search "Đà Nẵng"', () => {
    const mockData = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Khách Sạn Biển Đông Đà Nẵng', slug: 'khach-san-bien-dong-da-nang' }
    ];

    service.getProperties('Đà Nẵng').subscribe(result => {
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockData[0],
        propertyId: mockData[0].id,
      });
    });

    const req = httpTesting.expectOne((r: any) =>
      r.url === `${environment.apiUrl}/public/properties` && r.params.get('search') === 'Đà Nẵng'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('1b. should serialize tenantSlug, provinceCode, comma-separated propertyTypes, and normalize list properties', () => {
    service.getProperties({
      tenantSlug: 'anantara-group',
      provinceCode: '48',
      propertyTypes: ['Hotel', 'Homestay'],
    }).subscribe(result => {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        propertyId: 'prop-99',
        id: 'prop-99',
        tenantSlug: 'anantara-group',
        propertyType: 'Homestay',
        provinceName: 'Đà Nẵng',
        addressLine: '12 Võ Nguyên Giáp',
        thumbnailUrl: 'https://cdn.example.com/a.jpg',
        startingPriceForSelectedMode: 650000,
        galleryUrls: ['https://cdn.example.com/a.jpg'],
      });
    });

    const req = httpTesting.expectOne((r: any) =>
      r.url === `${environment.apiUrl}/public/properties` &&
      r.params.get('tenantSlug') === 'anantara-group' &&
      r.params.get('provinceCode') === '48' &&
      r.params.get('propertyTypes') === 'Hotel,Homestay'
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'prop-99',
        name: 'Anantara Homestay',
        slug: 'anantara-homestay',
        tenantSlug: 'anantara-group',
        propertyType: 8,
        city: 'Đà Nẵng',
        address: '12 Võ Nguyên Giáp',
        imageUrl: 'https://cdn.example.com/a.jpg',
        galleryUrls: ['https://cdn.example.com/a.jpg'],
        startingPrice: 650000,
      },
    ]);
  });

  it('2. should send typo / fuzzy query term and receive ranked direct DTO array', () => {
    const mockRanked = [
      { id: '22222222-2222-2222-2222-222222222222', name: 'Khách Sạn Central Đà Nẵng', slug: 'central-danang' },
      { id: '88888888-8888-8888-8888-888888888888', name: 'Khách Sạn Central Đà Nẵng Tie', slug: 'central-tie' },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Khách Sạn Sài Gòn Central', slug: 'saigon-central' }
    ];

    service.getProperties('centxralz').subscribe(result => {
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('22222222-2222-2222-2222-222222222222');
      expect(result[1].id).toBe('88888888-8888-8888-8888-888888888888');
      expect(result[2].id).toBe('33333333-3333-3333-3333-333333333333');
    });

    const req = httpTesting.expectOne((r: any) =>
      r.url === `${environment.apiUrl}/public/properties` && r.params.get('search') === 'centxralz'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockRanked);
  });

  it('3. should omit search query parameter completely when query is undefined, empty, or whitespace', () => {
    const all7Properties = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Khách Sạn Biển Đông Đà Nẵng' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Khách Sạn Central Đà Nẵng' },
      { id: '88888888-8888-8888-8888-888888888888', name: 'Khách Sạn Central Đà Nẵng Tie' },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Khách Sạn Hà Nội Horizon' },
      { id: '55555555-5555-5555-5555-555555555555', name: 'Khách Sạn Hạ Long Bay' },
      { id: '77777777-7777-7777-7777-777777777777', name: 'Khách Sạn Nha Trang Pearl' },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Khách Sạn Sài Gòn Central' }
    ];

    // Case A: undefined
    service.getProperties(undefined).subscribe(res => {
      expect(res.length).toBe(7);
    });
    const req1 = httpTesting.expectOne(`${environment.apiUrl}/public/properties`);
    expect(req1.request.params.has('search')).toBe(false);
    req1.flush(all7Properties);

    // Case B: whitespace only "   "
    service.getProperties('   ').subscribe(res => {
      expect(res.length).toBe(7);
    });
    const req2 = httpTesting.expectOne(`${environment.apiUrl}/public/properties`);
    expect(req2.request.params.has('search')).toBe(false);
    req2.flush(all7Properties);
  });

  it('4. should handle no-match query and receive direct empty array []', () => {
    service.getProperties('Khách sạn Không Tồn Tại 12345').subscribe(res => {
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(0);
    });

    const req = httpTesting.expectOne((r: any) =>
      r.url === `${environment.apiUrl}/public/properties` && r.params.get('search') === 'Khách sạn Không Tồn Tại 12345'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('5. should support both direct JSON array and wrapped { data: [...] } responses', () => {
    const rawList = [{ id: 'p1', name: 'Hotel 1' }];

    // Branch A: Direct array
    service.getProperties('testA').subscribe(res => {
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ id: 'p1', propertyId: 'p1', name: 'Hotel 1' });
    });
    const reqA = httpTesting.expectOne((r: any) => r.params.get('search') === 'testA');
    reqA.flush(rawList);

    // Branch B: Wrapped { data: [...] }
    service.getProperties('testB').subscribe(res => {
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ id: 'p1', propertyId: 'p1', name: 'Hotel 1' });
    });
    const reqB = httpTesting.expectOne((r: any) => r.params.get('search') === 'testB');
    reqB.flush({ data: rawList });
  });

  it('6. should handle multiple independent consecutive search requests with distinct parameters and completions (service is transport-pure; race management belongs to caller)', () => {
    const results1 = [{ id: 'p1', name: 'Ha Noi Hotel' }];
    const results2 = [{ id: 'p2', name: 'Da Nang Hotel' }];

    const emissions1: any[] = [];
    const emissions2: any[] = [];

    // First request
    service.getProperties('Ha Noi').subscribe(res => {
      emissions1.push(res);
    });
    // Second request
    service.getProperties('Da Nang').subscribe(res => {
      emissions2.push(res);
    });

    const req1 = httpTesting.expectOne((r: any) => r.params.get('search') === 'Ha Noi');
    const req2 = httpTesting.expectOne((r: any) => r.params.get('search') === 'Da Nang');

    // Responses complete consecutively
    req1.flush(results1);
    expect(emissions1).toHaveLength(1);
    expect(emissions1[0][0]).toMatchObject(results1[0]);
    expect(emissions2).toEqual([]);

    req2.flush(results2);
    expect(emissions1).toHaveLength(1);
    expect(emissions2).toHaveLength(1);
    expect(emissions2[0][0]).toMatchObject(results2[0]);
  });

  it('7. should process independent out-of-order HTTP responses faithfully without internal race suppression (service emits per call; latest-request-wins is coordinated at component level)', () => {
    const olderData = [{ id: 'p1', name: 'Older Search' }];
    const newerData = [{ id: 'p2', name: 'Newer Search' }];

    let olderReceived: any = null;
    let newerReceived: any = null;

    service.getProperties('old-term').subscribe(res => { olderReceived = res; });
    service.getProperties('new-term').subscribe(res => { newerReceived = res; });

    const oldReq = httpTesting.expectOne((r: any) => r.params.get('search') === 'old-term');
    const newReq = httpTesting.expectOne((r: any) => r.params.get('search') === 'new-term');

    // Flush newer first, then older to prove service does not silently drop older calls
    newReq.flush(newerData);
    expect(newerReceived[0]).toMatchObject(newerData[0]);
    expect(olderReceived).toBeNull();

    oldReq.flush(olderData);
    expect(olderReceived[0]).toMatchObject(olderData[0]);
  });

  it('8. should propagate HTTP errors gracefully to subscriber', () => {
    let errorCaught: any = null;

    service.getProperties('error-case').subscribe({
      next: () => {},
      error: err => {
        errorCaught = err;
      }
    });

    const req = httpTesting.expectOne((r: any) => r.params.get('search') === 'error-case');
    req.flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });

    expect(errorCaught).toBeDefined();
    expect(errorCaught.status).toBe(500);
  });

  it('9. should call GET /public/payments/vnpay/return with vnp_* params', () => {
    let result: unknown = null;
    service.verifyVnpayReturn({
      vnp_ResponseCode: '00',
      vnp_TxnRef: 'TXN-123',
      vnp_SecureHash: 'abc'
    }).subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne((r: HttpRequest<unknown>) =>
      r.url === `${environment.apiUrl}/public/payments/vnpay/return` &&
      r.params.get('vnp_ResponseCode') === '00' &&
      r.params.get('vnp_TxnRef') === 'TXN-123' &&
      r.params.get('vnp_SecureHash') === 'abc'
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        rspCode: '00',
        message: 'Giao dịch thanh toán thành công.',
        txnRef: 'TXN-123',
        transactionNo: '999999',
        amount: 450000,
        bankCode: 'NCB'
      }
    });

    expect(result).toEqual({
      success: true,
      rspCode: '00',
      message: 'Giao dịch thanh toán thành công.',
      txnRef: 'TXN-123',
      transactionNo: '999999',
      amount: 450000,
      bankCode: 'NCB'
    });
  });

  it('10. should call GET /public/promotions and normalize live promotion deals', () => {
    let result: unknown = null;
    service.getPromotions('sunset-brand').subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne((r: HttpRequest<unknown>) =>
      r.url === `${environment.apiUrl}/public/promotions` &&
      r.params.get('tenantSlug') === 'sunset-brand'
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'promo-1',
        code: 'SUMMER20',
        name: 'Ưu đãi mùa hè 20%',
        description: 'Áp dụng cho tất cả hạng phòng.',
        discountBadge: 'GIẢM 20%',
        discountType: 'Percent',
        type: 'PercentDiscount',
        value: 20,
        minNights: 1,
        currentUsage: 2,
        startsAtUtc: '2026-10-01T00:00:00Z',
        endsAtUtc: '2026-12-31T23:59:59Z',
        tenantName: 'Sunset Hospitality',
        applicableDestinations: ['Đà Nẵng']
      }
    ]);

    expect(Array.isArray(result)).toBe(true);
    expect((result as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'promo-1',
      code: 'SUMMER20',
      title: 'Ưu đãi mùa hè 20%',
      discountValue: 20,
      expiresAt: '2026-12-31T23:59:59Z'
    });
  });

  it('11. should forward normalized promoCode in POST /public/quotes when provided', () => {
    let quoteResult: unknown = null;
    service.calculateQuote({
      propertySlug: 'danang-beach',
      roomTypeId: 'rt-1',
      rentalType: 2,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z',
      promoCode: ' summer20 '
    }).subscribe(res => {
      quoteResult = res;
    });

    const req = httpTesting.expectOne((r: HttpRequest<unknown>) =>
      r.url === `${environment.apiUrl}/public/quotes` &&
      r.params.get('promoCode') === 'SUMMER20'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      promoCode: 'SUMMER20'
    });
    req.flush({
      totalAmount: 800000,
      promoCode: 'SUMMER20',
      promoDiscountAmount: 200000,
      breakdown: []
    });

    expect(quoteResult).toMatchObject({
      totalAmount: 800000,
      promoCode: 'SUMMER20',
      promoDiscountAmount: 200000
    });
  });
});

