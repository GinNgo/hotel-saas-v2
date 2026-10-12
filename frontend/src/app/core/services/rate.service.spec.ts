import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { RateService } from './rate.service';
import { environment } from '../../../environments/environment';
import { CreateRoomTypeRateRequest } from '../models/rate.model';

describe('RateService', () => {
  let mockHttp: any;
  let service: RateService;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        RateService,
        { provide: HttpClient, useValue: mockHttp }
      ]
    });

    service = runInInjectionContext(injector, () => injector.get(RateService));
  });

  it('1. should call GET /room-types/{id}/rates with optional propertyId param', () => {
    mockHttp.get.mockReturnValue(of({
      success: true,
      data: [{ id: 'r1', nightlyPrice: 500000 }]
    }));

    service.getRates('rt-101', 'prop-202').subscribe(data => {
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('r1');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/room-types/rt-101/rates`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('2. should call GET /room-types/{id}/rates/history with optional propertyId param', () => {
    mockHttp.get.mockReturnValue(of({
      success: true,
      data: [{ id: 'a1', actionType: 'Created' }]
    }));

    service.getRateHistory('rt-101', 'prop-202').subscribe(data => {
      expect(data.length).toBe(1);
      expect(data[0].actionType).toBe('Created');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/room-types/rt-101/rates/history`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('3. should call POST /room-types/{id}/rates with request body', () => {
    const payload: CreateRoomTypeRateRequest = {
      roomTypeId: 'rt-101',
      propertyId: 'prop-202',
      firstHours: 2,
      firstHoursPrice: 200000,
      additionalHourPrice: 50000,
      nightlyPrice: 450000,
      effectiveFrom: '2026-10-10',
      effectiveTo: '2026-11-10'
    };

    mockHttp.post.mockReturnValue(of({
      success: true,
      data: { id: 'r-new', ...payload }
    }));

    service.createRate('rt-101', payload).subscribe(data => {
      expect(data.id).toBe('r-new');
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/room-types/rt-101/rates`,
      payload
    );
  });
});
