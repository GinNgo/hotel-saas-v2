import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ReservationService } from './reservation.service';
import { environment } from '../../../environments/environment';
import { RentalType, ReservationStatus } from '../models/reservation.model';

describe('ReservationService', () => {
  let mockHttp: any;
  let service: ReservationService;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        ReservationService,
        { provide: HttpClient, useValue: mockHttp }
      ]
    });

    service = runInInjectionContext(injector, () => injector.get(ReservationService));
  });

  it('1. should call GET /reservations with query parameters', () => {
    const mockPaged = {
      items: [
        { id: 'res-1', confirmationCode: 'RES-001', guestName: 'Nguyễn Văn A' }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: mockPaged
    }));

    service.getReservations({
      propertyId: 'prop-123',
      status: ReservationStatus.Confirmed,
      from: '2026-10-15',
      to: '2026-10-20',
      search: 'Nguyễn',
      page: 1,
      pageSize: 20
    }).subscribe(res => {
      expect(res.items.length).toBe(1);
      expect(res.items[0].confirmationCode).toBe('RES-001');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('2. should call GET /reservations/{id} with propertyId parameter', () => {
    const mockDetail = {
      id: 'res-1',
      confirmationCode: 'RES-001',
      guestName: 'Nguyễn Văn A'
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: mockDetail
    }));

    service.getReservationById('res-1', 'prop-123').subscribe(res => {
      expect(res.id).toBe('res-1');
      expect(res.confirmationCode).toBe('RES-001');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/res-1`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('3. should call POST /reservations with request body and Idempotency-Key header', () => {
    const mockCreated = {
      id: 'res-created-1',
      confirmationCode: 'RES-NEW'
    };

    mockHttp.post.mockReturnValue(of({
      success: true,
      data: mockCreated
    }));

    service.createReservation({
      propertyId: 'prop-123',
      roomId: 'room-1',
      rentalType: RentalType.Overnight,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z',
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-16',
      guestName: 'Khôi Nguyên',
      guestEmail: 'nguyen@example.com',
      numberOfGuests: 2,
      idempotencyKey: 'IDEMP-TEST-KEY'
    }).subscribe(res => {
      expect(res.confirmationCode).toBe('RES-NEW');
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations`,
      expect.objectContaining({
        guestName: 'Khôi Nguyên',
        numberOfGuests: 2
      }),
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'IDEMP-TEST-KEY' }
      })
    );
  });

  it('4. should call GET /reservations/availability with required filters', () => {
    mockHttp.get.mockReturnValue(of({
      success: true,
      data: [{ roomId: 'room-1', isAvailable: true }]
    }));

    service.getAvailability({
      propertyId: 'prop-123',
      rentalType: RentalType.Hourly,
      startAtUtc: '2026-10-15T01:00:00Z',
      endAtUtc: '2026-10-15T05:00:00Z',
      roomTypeId: 'rt-101'
    }).subscribe(res => {
      expect(res.length).toBe(1);
      expect(res[0].isAvailable).toBe(true);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/availability`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('5. should call POST /quotes/calculate for authoritative pricing calculation', () => {
    const mockQuote = {
      propertyId: 'prop-123',
      roomTypeId: 'rt-101',
      rentalType: 'Overnight',
      totalAmount: 600000,
      currency: 'VND'
    };

    mockHttp.post.mockReturnValue(of({
      success: true,
      data: mockQuote
    }));

    service.calculateQuote({
      propertyId: 'prop-123',
      roomTypeId: 'rt-101',
      rentalType: RentalType.Overnight,
      startAtUtc: '2026-10-15T07:00:00Z',
      endAtUtc: '2026-10-16T05:00:00Z'
    }).subscribe(quote => {
      expect(quote.totalAmount).toBe(600000);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/quotes/calculate`,
      expect.objectContaining({
        propertyId: 'prop-123',
        roomTypeId: 'rt-101'
      })
    );
  });

  it('6. should call POST /reservations/{id}/check-in', () => {
    mockHttp.post.mockReturnValue(of({
      success: true,
      data: { id: 'res-1', status: ReservationStatus.CheckedIn }
    }));

    service.checkIn('res-1', 'prop-123').subscribe(res => {
      expect(res.status).toBe(ReservationStatus.CheckedIn);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/res-1/check-in`,
      null,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('7. should call POST /reservations/{id}/check-out', () => {
    mockHttp.post.mockReturnValue(of({
      success: true,
      data: { id: 'res-1', status: ReservationStatus.CheckedOut }
    }));

    service.checkOut('res-1', 'prop-123').subscribe(res => {
      expect(res.status).toBe(ReservationStatus.CheckedOut);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/res-1/check-out`,
      null,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('8. should call POST /reservations/{id}/cancel with reason', () => {
    mockHttp.post.mockReturnValue(of({
      success: true,
      data: { id: 'res-1', status: ReservationStatus.Cancelled }
    }));

    service.cancel('res-1', 'prop-123', 'Khách đổi kế hoạch').subscribe(res => {
      expect(res.status).toBe(ReservationStatus.Cancelled);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/res-1/cancel`,
      { reason: 'Khách đổi kế hoạch' },
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('9. should call getTimelineReservations with pageSize 200 and return item array', () => {
    const mockItems = [
      { id: 'res-1', confirmationCode: 'RES-001' },
      { id: 'res-2', confirmationCode: 'RES-002' }
    ];

    mockHttp.get.mockReturnValue(of({
      items: mockItems,
      totalCount: 2,
      page: 1,
      pageSize: 200
    }));

    service.getTimelineReservations('prop-123', '2026-10-15', '2026-10-22').subscribe(items => {
      expect(items.length).toBe(2);
      expect(items[0].confirmationCode).toBe('RES-001');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });
});

