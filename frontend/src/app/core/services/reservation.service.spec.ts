import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ReservationService } from './reservation.service';
import { RentalType, ReservationStatus } from '../models/reservation.model';

describe('ReservationService enum responses', () => {
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let service: ReservationService;

  beforeEach(() => {
    http = { get: vi.fn(), post: vi.fn() };
    const injector = Injector.create({
      providers: [ReservationService, { provide: HttpClient, useValue: http }]
    });
    service = runInInjectionContext(injector, () => injector.get(ReservationService));
  });

  it('maps list status and rental type names to the values used by the page', () => {
    http.get.mockReturnValue(of({ data: {
      items: [{ id: 'reservation-1', status: 'Confirmed', rentalType: 'Overnight' }],
      totalCount: 1,
      page: 1,
      pageSize: 20
    } }));

    service.getReservations({ propertyId: 'property-1' }).subscribe(result => {
      expect(result.items[0].status).toBe(ReservationStatus.Confirmed);
      expect(result.items[0].rentalType).toBe(RentalType.Overnight);
    });
  });

  it('maps detail and lifecycle responses consistently', () => {
    http.get.mockReturnValue(of({ data: { id: 'reservation-1', status: 'Confirmed', rentalType: 'Overnight' } }));
    http.post.mockReturnValue(of({ data: { id: 'reservation-1', status: 'CheckedIn', rentalType: 'Overnight' } }));

    service.getReservationById('reservation-1', 'property-1').subscribe(detail => {
      expect(detail.status).toBe(ReservationStatus.Confirmed);
    });
    service.checkIn('reservation-1', 'property-1').subscribe(detail => {
      expect(detail.status).toBe(ReservationStatus.CheckedIn);
    });
  });
});
