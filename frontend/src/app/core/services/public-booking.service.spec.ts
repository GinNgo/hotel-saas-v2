import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
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
      parent
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
      expect(result).toEqual(mockData);
      expect(Array.isArray(result)).toBe(true);
    });

    const req = httpTesting.expectOne((r: any) =>
      r.url === `${environment.apiUrl}/public/properties` && r.params.get('search') === 'Đà Nẵng'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
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
      expect(res).toEqual(rawList);
    });
    const reqA = httpTesting.expectOne((r: any) => r.params.get('search') === 'testA');
    reqA.flush(rawList);

    // Branch B: Wrapped { data: [...] }
    service.getProperties('testB').subscribe(res => {
      expect(res).toEqual(rawList);
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
    expect(emissions1).toEqual([results1]);
    expect(emissions2).toEqual([]);

    req2.flush(results2);
    expect(emissions1).toEqual([results1]);
    expect(emissions2).toEqual([results2]);
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
    expect(newerReceived).toEqual(newerData);
    expect(olderReceived).toBeNull();

    oldReq.flush(olderData);
    expect(olderReceived).toEqual(olderData);
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
});

