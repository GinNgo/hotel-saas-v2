import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { PaymentService, GetPaymentsFilter } from './payment.service';
import { environment } from '../../../environments/environment';
import { CreatePaymentRequest, PaymentMethod, PaymentStatus, ShiftType } from '../models/payment.model';

describe('PaymentService', () => {
  let mockHttp: any;
  let service: PaymentService;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        PaymentService,
        { provide: HttpClient, useValue: mockHttp }
      ]
    });

    service = runInInjectionContext(injector, () => injector.get(PaymentService));
  });

  it('1. should call GET /reservations/{id}/folio with propertyId query param', () => {
    const mockFolio = {
      reservationId: 'res-001',
      confirmationCode: 'BK-1001',
      totalAmount: 1000000,
      paidAmount: 300000,
      remainingBalance: 700000,
      isFullyPaid: false,
      payments: []
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: mockFolio
    }));

    service.getFolio('res-001', 'prop-001').subscribe(data => {
      expect(data.reservationId).toBe('res-001');
      expect(data.remainingBalance).toBe(700000);
      expect(data.isFullyPaid).toBe(false);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/reservations/res-001/folio`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('2. should call POST /payments with request body and Idempotency-Key / X-Property-Id headers', () => {
    const request: CreatePaymentRequest = {
      propertyId: 'prop-001',
      reservationId: 'res-001',
      amount: 500000,
      method: PaymentMethod.Cash,
      idempotencyKey: 'idem-123456',
      transactionRef: 'RECEIPT-01'
    };

    const mockResponse = {
      id: 'pay-001',
      propertyId: 'prop-001',
      reservationId: 'res-001',
      amount: 500000,
      method: PaymentMethod.Cash,
      methodName: 'Tiền mặt',
      status: PaymentStatus.Completed,
      statusName: 'Thành công',
      createdAtUtc: new Date().toISOString()
    };

    mockHttp.post.mockReturnValue(of({
      success: true,
      data: mockResponse
    }));

    service.createPayment(request, 'prop-001').subscribe(data => {
      expect(data.id).toBe('pay-001');
      expect(data.amount).toBe(500000);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/payments`,
      request,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'idem-123456',
          'X-Property-Id': 'prop-001'
        })
      })
    );
  });

  it('3. should call GET /payments with filter params', () => {
    const filter: GetPaymentsFilter = {
      propertyId: 'prop-001',
      reservationId: 'res-001',
      method: PaymentMethod.BankTransfer,
      status: PaymentStatus.Completed,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-10',
      page: 1,
      pageSize: 10
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10
      }
    }));

    service.getPayments(filter).subscribe(data => {
      expect(data.items).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/payments`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('4. should call GET /payments/summary with propertyId and date query params', () => {
    const mockSummary = {
      propertyId: 'prop-001',
      date: '2026-10-10',
      totalCollected: 1200000,
      cashCollected: 800000,
      bankTransferCollected: 400000,
      creditCardCollected: 0,
      completedCount: 2
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: mockSummary
    }));

    service.getPaymentSummary('prop-001', '2026-10-10').subscribe(data => {
      expect(data.totalCollected).toBe(1200000);
      expect(data.cashCollected).toBe(800000);
      expect(data.bankTransferCollected).toBe(400000);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/payments/summary`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });

  it('5. should call GET /payments/shift-report with propertyId, date, and shiftType', () => {
    const mockShiftReport = {
      propertyId: 'prop-001',
      date: '2026-10-16',
      shiftType: ShiftType.Morning,
      shiftName: 'Ca 1 - Sáng (06:00 - 14:00)',
      shiftStartUtc: '2026-10-15T23:00:00Z',
      shiftEndUtc: '2026-10-16T06:59:59.999Z',
      totalCollected: 950000,
      cashCollected: 650000,
      bankTransferCollected: 300000,
      creditCardCollected: 0,
      completedCount: 2,
      payments: []
    };

    mockHttp.get.mockReturnValue(of({
      success: true,
      data: mockShiftReport
    }));

    service.getShiftReport('prop-001', '2026-10-16', ShiftType.Morning).subscribe(data => {
      expect(data.shiftName).toBe('Ca 1 - Sáng (06:00 - 14:00)');
      expect(data.totalCollected).toBe(950000);
      expect(data.cashCollected).toBe(650000);
      expect(data.completedCount).toBe(2);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/payments/shift-report`,
      expect.objectContaining({
        params: expect.anything()
      })
    );
  });
});
