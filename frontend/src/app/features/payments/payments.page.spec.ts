import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).customElements = win.customElements;
  (globalThis as any).Node = win.Node;
  (globalThis as any).MutationObserver = win.MutationObserver;
}

import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import {
  PaymentsPage,
  getTodayVietnamDateString,
  formatUtcDateTimeString
} from './payments.page';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentSummaryDto,
  PaymentDto,
  FolioDto,
  ShiftReportDto,
  ShiftType,
  SHIFT_TYPE_LABELS
} from '../../core/models/payment.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized in test environment
}

describe('PaymentsPage — Mounted Component & Behavioral Acceptance Tests (FE-CASHIER-PAYMENTS-01)', () => {
  let fixture: ComponentFixture<PaymentsPage>;
  let component: PaymentsPage;
  let mockPaymentService: any;
  let mockAuthService: any;
  let activePropertyIdSignal: WritableSignal<string | null>;
  let activePropertyNameSignal: WritableSignal<string | null>;
  let hasPermissionMock: ReturnType<typeof vi.fn>;
  let currentUserSubject: Subject<any>;

  const sampleSummary: PaymentSummaryDto = {
    propertyId: 'prop-1111',
    date: '2026-10-12',
    totalCollected: 2500000,
    cashCollected: 1500000,
    bankTransferCollected: 1000000,
    creditCardCollected: 0,
    completedCount: 3
  };

  const samplePayments: PaymentDto[] = [
    {
      id: 'pay-001-aaaa',
      reservationId: 'res-001-bbbb',
      amount: 1500000,
      currency: 'VND',
      method: PaymentMethod.Cash,
      methodName: 'Tiền mặt',
      status: PaymentStatus.Completed,
      statusName: 'Thành công',
      transactionRef: 'REC-001',
      notes: 'Khách cọc tiền mặt tại quầy',
      createdAtUtc: '2026-10-12T02:00:00Z'
    },
    {
      id: 'pay-002-cccc',
      reservationId: 'res-002-dddd',
      amount: 1000000,
      currency: 'VND',
      method: PaymentMethod.BankTransfer,
      methodName: 'Chuyển khoản',
      status: PaymentStatus.Completed,
      statusName: 'Thành công',
      transactionRef: 'TX-BANK-999',
      notes: 'Chuyển khoản VCB',
      createdAtUtc: '2026-10-12T02:30:00Z'
    }
  ];

  const sampleFolio: FolioDto = {
    reservationId: 'res-001-bbbb',
    confirmationCode: 'CONF-12345',
    guestName: 'Nguyễn Văn A',
    guestEmail: 'nguyenvana@example.com',
    guestPhone: '0901234567',
    roomId: 'room-101',
    roomNumber: '101',
    roomTypeId: 'rt-deluxe',
    roomTypeName: 'Deluxe Ocean View',
    status: 2,
    statusName: 'Đã xác nhận',
    rentalType: 1,
    checkInDate: '2026-10-12',
    checkOutDate: '2026-10-14',
    startAtUtc: '2026-10-12T07:00:00Z',
    endAtUtc: '2026-10-14T05:00:00Z',
    totalAmount: 2000000,
    paidAmount: 500000,
    remainingBalance: 1500000,
    isFullyPaid: false,
    depositRequired: 500000,
    depositPaid: 500000,
    baseRoomAmount: 2000000,
    surchargesAmount: 0,
    servicesAmount: 0,
    breakdown: [
      {
        description: 'Tiền phòng 2 đêm',
        unitPrice: 1000000,
        quantity: 2,
        amount: 2000000
      }
    ],
    payments: [
      {
        id: 'pay-001-aaaa',
        reservationId: 'res-001-bbbb',
        amount: 500000,
        currency: 'VND',
        method: PaymentMethod.Cash,
        methodName: 'Tiền mặt',
        status: PaymentStatus.Completed,
        statusName: 'Thành công',
        transactionRef: 'REC-001',
        createdAtUtc: '2026-10-12T02:00:00Z'
      }
    ]
  };

  const sampleShiftReport: ShiftReportDto = {
    propertyId: 'prop-1111',
    date: '2026-10-12',
    shiftType: ShiftType.Morning,
    shiftName: 'Ca 1 - Sáng (06:00 - 14:00)',
    shiftStartUtc: '2026-10-11T23:00:00Z',
    shiftEndUtc: '2026-10-12T06:59:59.999Z',
    totalCollected: 1500000,
    cashCollected: 1500000,
    bankTransferCollected: 0,
    creditCardCollected: 0,
    completedCount: 1,
    payments: [
      {
        ...samplePayments[0],
        id: 'shift-pay-001',
        transactionRef: 'SHIFT-TX-001'
      }
    ]
  };

  const samplePaymentCreated: PaymentDto = {
    id: 'pay-new-999',
    reservationId: 'res-001-bbbb',
    amount: 1500000,
    currency: 'VND',
    method: PaymentMethod.Cash,
    methodName: 'Tiền mặt',
    status: PaymentStatus.Completed,
    statusName: 'Thành công',
    transactionRef: 'REC-999',
    createdAtUtc: '2026-10-12T04:00:00Z'
  };

  beforeEach(async () => {
    activePropertyIdSignal = signal<string | null>('prop-1111');
    activePropertyNameSignal = signal<string | null>('Khách sạn Biển Đông');
    hasPermissionMock = vi.fn((code: string, mask: number) => {
      if (code === 'PAYMENTS' && (mask === 1 || mask === 2)) return true;
      return false;
    });
    currentUserSubject = new Subject<any>();

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      activePropertyName: activePropertyNameSignal,
      hasPermission: hasPermissionMock,
      currentUser$: currentUserSubject.asObservable()
    };

    mockPaymentService = {
      getPaymentSummary: vi.fn().mockReturnValue(of(sampleSummary)),
      getShiftReport: vi.fn().mockReturnValue(of(sampleShiftReport)),
      getPayments: vi.fn().mockReturnValue(of({
        items: samplePayments,
        totalCount: 2,
        page: 1,
        pageSize: 10
      })),
      getFolio: vi.fn().mockReturnValue(of(sampleFolio)),
      createPayment: vi.fn().mockReturnValue(of(samplePaymentCreated))
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PaymentsPage],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PaymentService, useValue: mockPaymentService }
      ]
    }).compileComponents();
  });

  // =========================================================================
  // BAC 1: RENDERED DTO FIELDS & DATA SEPARATION
  // =========================================================================
  it('BAC 1: should mount component, automatically trigger effect, and render actual DTO fields in template', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Verify DTO signals populated via automatic effect
    expect(component.summary()).not.toBeNull();
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.summary()?.cashCollected).toBe(1500000);
    expect(component.summary()?.bankTransferCollected).toBe(1000000);
    expect(component.summary()?.creditCardCollected).toBe(0);
    expect(component.summary()?.completedCount).toBe(3);

    expect(component.payments().length).toBe(2);
    expect(component.payments()[0].transactionRef).toBe('REC-001');
    expect(component.payments()[1].transactionRef).toBe('TX-BANK-999');

    // Verify rendered DOM elements
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent || '';

    // Summary block rendered text
    expect(text).toContain('Tổng kết Thực thu trong ngày');
    expect(text).toContain('2,500,000');
    expect(text).toContain('1,500,000');
    expect(text).toContain('1,000,000');
    expect(text).toContain('3');

    // Payments list table rendered text
    expect(text).toContain('Nhật ký Giao dịch (Thời gian ghi nhận - Giờ UTC)');
    expect(text).toContain('REC-001');
    expect(text).toContain('TX-BANK-999');
    expect(text).toContain('Tiền mặt');
    expect(text).toContain('Chuyển khoản');
    expect(text).toContain('Thành công');
    expect(text).toContain('UTC');

    // Disclaimer banner rendered text
    expect(text).toContain('Lưu ý phân định dữ liệu thu ngân');
    expect(text).toContain('múi giờ Việt Nam UTC+7');
    expect(text).toContain('múi giờ chuẩn UTC');
  });

  // =========================================================================
  // BAC 2: PROPERTY SWITCH (A -> B) & STALE RESPONSE REJECTION + DISPOSAL
  // =========================================================================
  it('BAC 2: should cancel/unsubscribe active requests and reject stale late responses (success & error) on A -> B', () => {
    // Setup in-flight delayed responses for Property A
    const delayedSummarySubjectA = new Subject<PaymentSummaryDto>();
    const delayedPaymentsSubjectA = new Subject<any>();

    mockPaymentService.getPaymentSummary.mockReturnValueOnce(delayedSummarySubjectA.asObservable());
    mockPaymentService.getPayments.mockReturnValueOnce(delayedPaymentsSubjectA.asObservable());

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isLoadingSummary()).toBe(true);
    expect(component.isLoadingPayments()).toBe(true);
    expect(delayedSummarySubjectA.observed).toBe(true);
    expect(delayedPaymentsSubjectA.observed).toBe(true);

    // Switch to Property B before Property A completes
    const summaryB: PaymentSummaryDto = {
      propertyId: 'prop-2222',
      date: '2026-10-12',
      totalCollected: 999999,
      cashCollected: 999999,
      bankTransferCollected: 0,
      creditCardCollected: 0,
      completedCount: 1
    };
    const paymentsB = [
      {
        id: 'pay-B-001',
        amount: 999999,
        currency: 'VND',
        method: PaymentMethod.Cash,
        methodName: 'Tiền mặt',
        status: PaymentStatus.Completed,
        statusName: 'Thành công',
        transactionRef: 'REC-PROP-B',
        notes: 'Prop B note',
        createdAtUtc: '2026-10-12T05:00:00Z'
      }
    ];

    mockPaymentService.getPaymentSummary.mockReturnValueOnce(of(summaryB));
    mockPaymentService.getPayments.mockReturnValueOnce(of({
      items: paymentsB,
      totalCount: 1,
      page: 1,
      pageSize: 10
    }));

    activePropertyIdSignal.set('prop-2222');
    fixture.detectChanges();

    // Assert that in-flight subscriptions for Property A were unsubscribed
    expect(delayedSummarySubjectA.observed).toBe(false);
    expect(delayedPaymentsSubjectA.observed).toBe(false);

    // If Property A emits late responses (success or error), they must be rejected/ignored
    delayedSummarySubjectA.next(sampleSummary);
    delayedPaymentsSubjectA.error({ status: 500, error: { message: 'Late failure from Property A' } });

    // Assert state strictly reflects Property B
    expect(component.summary()?.propertyId).toBe('prop-2222');
    expect(component.summary()?.totalCollected).toBe(999999);
    expect(component.payments().length).toBe(1);
    expect(component.payments()[0].transactionRef).toBe('REC-PROP-B');
    expect(component.summaryError()).toBeNull();
    expect(component.paymentsError()).toBeNull();

    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('999,999');
    expect(text).toContain('REC-PROP-B');
    expect(text).not.toContain('REC-001');
  });

  // =========================================================================
  // BAC 3: POPULATED -> NONE (FAIL-CLOSED & DOM CLEANUP)
  // =========================================================================
  it('BAC 3: should fail-closed and clear DOM when property transitions from populated to none', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Verify initial populated state on Prop A
    expect(component.summary()).not.toBeNull();
    expect(component.payments().length).toBe(2);

    // Clear mock call history
    mockPaymentService.getPaymentSummary.mockClear();
    mockPaymentService.getPayments.mockClear();

    // Property becomes null
    activePropertyIdSignal.set(null);
    fixture.detectChanges();

    // Assert state cleared
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(component.isLoadingSummary()).toBe(false);
    expect(component.isLoadingPayments()).toBe(false);

    // No new HTTP calls made
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    // DOM displays empty state for missing property
    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('Vui lòng chọn cơ sở hoạt động');
    expect(text).not.toContain('2,500,000');
    expect(text).not.toContain('REC-001');
  });

  // =========================================================================
  // BAC 4: PERMISSION GATING & CENTRALIZED 403 INVALIDATION
  // =========================================================================
  it('BAC 4a: should hide forms/data and show permission denied empty state when PAYMENTS:Read is denied before mount', () => {
    hasPermissionMock.mockReturnValue(false);

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // HTTP calls must NOT be issued
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    // State is empty
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);

    // DOM displays permission empty state
    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('Không có quyền truy cập');
    expect(text).toContain('PAYMENTS:Read');
    expect(text).not.toContain('Thực thu tiền mặt tại quầy');
    expect(text).not.toContain('Thời gian ghi nhận - Giờ UTC');
  });

  it('BAC 4b: should clear both streams, cancel pending requests, and show empty state on mounted allowed -> denied same-property transition', () => {
    // 1. Mount with valid permission and populated state
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.summary()).not.toBeNull();
    expect(component.payments().length).toBe(2);

    // 2. Setup in-flight requests on Property A
    const delayedSummary = new Subject<PaymentSummaryDto>();
    const delayedPayments = new Subject<any>();
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(delayedSummary.asObservable());
    mockPaymentService.getPayments.mockReturnValueOnce(delayedPayments.asObservable());

    component.loadSummary();
    component.loadPayments();
    expect(delayedSummary.observed).toBe(true);
    expect(delayedPayments.observed).toBe(true);

    // 3. Permission revoked while mounted on same property
    hasPermissionMock.mockReturnValue(false);
    currentUserSubject.next({ id: 'user-1', email: 'user@test.com' });
    fixture.detectChanges();

    // Assert: In-flight requests cancelled immediately
    expect(delayedSummary.observed).toBe(false);
    expect(delayedPayments.observed).toBe(false);

    // Assert: Both streams cleared completely
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.totalCount()).toBe(0);

    // Late emission must be rejected
    delayedSummary.next(sampleSummary);
    delayedPayments.next({ items: samplePayments, totalCount: 2 });
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);

    // DOM displays permission denied empty state
    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('Không có quyền truy cập');
    expect(text).toContain('PAYMENTS:Read');
    expect(text).not.toContain('Thực thu tiền mặt tại quầy');
  });

  it('BAC 4c: populated summary + list 403 should clear BOTH streams, cancel pending summary requests, and reject late responses', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Summary is populated
    expect(component.summary()?.totalCollected).toBe(2500000);

    // Setup in-flight delayed summary refresh and a 403 error on payments list
    const delayedSummary = new Subject<PaymentSummaryDto>();
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(delayedSummary.asObservable());
    component.loadSummary();
    expect(delayedSummary.observed).toBe(true);

    // Payments returns 403 Forbidden
    mockPaymentService.getPayments.mockReturnValueOnce(throwError(() => ({
      status: 403,
      error: { message: 'Forbidden' }
    })));
    component.loadPayments();
    fixture.detectChanges();

    // Assert: In-flight summary subscription was cancelled immediately
    expect(delayedSummary.observed).toBe(false);

    // Assert: BOTH streams cleared
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(component.summaryError()).toContain('403 Forbidden');
    expect(component.paymentsError()).toContain('403 Forbidden');

    // Late emission on summary must NOT repopulate
    delayedSummary.next(sampleSummary);
    expect(component.summary()).toBeNull();

    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('403 Forbidden');
    expect(text).not.toContain('2,500,000');
  });

  it('BAC 4d: populated list + summary 403 should clear BOTH streams, cancel pending payments requests, and reject late responses', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Payments list is populated
    expect(component.payments().length).toBe(2);

    // Setup in-flight delayed payments refresh and a 403 error on summary
    const delayedPayments = new Subject<any>();
    mockPaymentService.getPayments.mockReturnValueOnce(delayedPayments.asObservable());
    component.loadPayments();
    expect(delayedPayments.observed).toBe(true);

    // Summary returns 403 Forbidden
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(throwError(() => ({
      status: 403,
      error: { message: 'Forbidden' }
    })));
    component.loadSummary();
    fixture.detectChanges();

    // Assert: In-flight payments subscription was cancelled immediately
    expect(delayedPayments.observed).toBe(false);

    // Assert: BOTH streams cleared
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(component.summaryError()).toContain('403 Forbidden');
    expect(component.paymentsError()).toContain('403 Forbidden');

    // Late emission on payments must NOT repopulate
    delayedPayments.next({ items: samplePayments, totalCount: 2 });
    expect(component.payments()).toEqual([]);

    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('403 Forbidden');
    expect(text).not.toContain('REC-001');
  });

  it('BAC 4e: initial context load with synchronous summary 403 blocks list loading, latches access-denied, and gates template from populating', () => {
    // Summary endpoint returns 403 Forbidden synchronously
    mockPaymentService.getPaymentSummary.mockReturnValue(throwError(() => ({
      status: 403,
      error: { message: 'Forbidden' }
    })));
    // Payments mock returns successful data
    mockPaymentService.getPayments.mockReturnValue(of({
      items: samplePayments,
      totalCount: 2,
      page: 1,
      pageSize: 10
    }));

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Assert: access-denied latch is set
    expect(component.isAccessDenied()).toBe(true);
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.totalCount()).toBe(0);

    // Assert: getPayments was blocked by the latch during initial context load
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    // Template displays permission denied empty state
    const text = fixture.nativeElement.textContent || '';
    expect(text).toContain('Không có quyền truy cập');
    expect(text).toContain('403 Forbidden');
    expect(text).not.toContain('REC-001');
    expect(text).not.toContain('2,500,000');
  });

  it('BAC 4f: populated summary + list 403 latches access-denied: blocks subsequent refresh/filter/retry, and recovers only on deliberate validated authority recovery', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Both streams initially populated
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.payments().length).toBe(2);

    // List encounters 403 Forbidden
    mockPaymentService.getPayments.mockReturnValueOnce(throwError(() => ({
      status: 403,
      error: { message: 'Forbidden' }
    })));
    component.loadPayments();
    fixture.detectChanges();

    // Assert: Both streams cleared and latch engaged
    expect(component.isAccessDenied()).toBe(true);
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);

    // Reset mocks with valid observables
    mockPaymentService.getPaymentSummary.mockClear();
    mockPaymentService.getPayments.mockClear();
    mockPaymentService.getPaymentSummary.mockReturnValue(of(sampleSummary));
    mockPaymentService.getPayments.mockReturnValue(of({ items: samplePayments, totalCount: 2 }));

    // Subsequent user actions: refresh, filter, page, retry MUST BE BLOCKED by latch
    component.loadSummary();
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();
    expect(component.summary()).toBeNull();

    component.onSummaryDateChange();
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();

    component.retrySummary();
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();

    component.retryPayments();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.onFilterChange();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.resetFilters();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.onPageChange(2);
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.isAccessDenied()).toBe(true);

    // Deliberate validated authority recovery
    component.recoverAccess();
    fixture.detectChanges();

    expect(component.isAccessDenied()).toBe(false);
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.payments().length).toBe(2);

    const text = fixture.nativeElement.textContent || '';
    expect(text).not.toContain('Không có quyền truy cập');
    expect(text).toContain('2,500,000');
    expect(text).toContain('REC-001');
  });

  it('BAC 4g: populated list + summary 403 latches access-denied: blocks subsequent refresh/filter/retry, and recovers only on deliberate validated authority recovery', () => {
    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Both streams initially populated
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.payments().length).toBe(2);

    // Summary encounters 403 Forbidden
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(throwError(() => ({
      status: 403,
      error: { message: 'Forbidden' }
    })));
    component.loadSummary();
    fixture.detectChanges();

    // Assert: Both streams cleared and latch engaged
    expect(component.isAccessDenied()).toBe(true);
    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);

    // Reset mocks with valid observables
    mockPaymentService.getPaymentSummary.mockClear();
    mockPaymentService.getPayments.mockClear();
    mockPaymentService.getPaymentSummary.mockReturnValue(of(sampleSummary));
    mockPaymentService.getPayments.mockReturnValue(of({ items: samplePayments, totalCount: 2 }));

    // Subsequent user actions: refresh, filter, page, retry MUST BE BLOCKED by latch
    component.loadPayments();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.retryPayments();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.retrySummary();
    expect(mockPaymentService.getPaymentSummary).not.toHaveBeenCalled();

    component.onFilterChange();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.resetFilters();
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    component.onPageChange(2);
    expect(mockPaymentService.getPayments).not.toHaveBeenCalled();

    expect(component.summary()).toBeNull();
    expect(component.payments()).toEqual([]);
    expect(component.isAccessDenied()).toBe(true);

    // Deliberate validated context recovery (switching property with valid permission)
    activePropertyIdSignal.set('prop-2222');
    activePropertyNameSignal.set('Khách sạn Sài Gòn');
    fixture.detectChanges();

    expect(component.isAccessDenied()).toBe(false);
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.payments().length).toBe(2);

    const text = fixture.nativeElement.textContent || '';
    expect(text).not.toContain('Không có quyền truy cập');
    expect(text).toContain('2,500,000');
    expect(text).toContain('REC-001');
  });

  // =========================================================================
  // BAC 5: INDEPENDENT ORDINARY ERRORS & SUBSCRIPTION DISPOSAL ON DESTROY
  // =========================================================================
  it('BAC 5a: ordinary 500 error on summary preserves payments list, and retry recovers', () => {
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(throwError(() => ({
      status: 500,
      error: { message: 'Lỗi máy chủ khi tính tổng kết' }
    })));

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Summary has error
    expect(component.summary()).toBeNull();
    expect(component.summaryError()).toBe('Lỗi máy chủ khi tính tổng kết');

    // Payments list is intact (ordinary 500 maintains stream isolation)
    expect(component.payments().length).toBe(2);
    expect(component.paymentsError()).toBeNull();

    // Retry summary recovers
    mockPaymentService.getPaymentSummary.mockReturnValueOnce(of(sampleSummary));
    component.retrySummary();
    fixture.detectChanges();

    expect(component.summary()).not.toBeNull();
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.summaryError()).toBeNull();
  });

  it('BAC 5b: ordinary 500 error on payments preserves summary, and retry recovers', () => {
    mockPaymentService.getPayments.mockReturnValueOnce(throwError(() => ({
      status: 500,
      error: { message: 'Lỗi máy chủ khi tải danh sách' }
    })));

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Payments has error
    expect(component.payments()).toEqual([]);
    expect(component.paymentsError()).toBe('Lỗi máy chủ khi tải danh sách');

    // Summary is intact (ordinary 500 maintains stream isolation)
    expect(component.summary()).not.toBeNull();
    expect(component.summary()?.totalCollected).toBe(2500000);
    expect(component.summaryError()).toBeNull();

    // Retry payments recovers
    mockPaymentService.getPayments.mockReturnValueOnce(of({
      items: samplePayments,
      totalCount: 2,
      page: 1,
      pageSize: 10
    }));
    component.retryPayments();
    fixture.detectChanges();

    expect(component.payments().length).toBe(2);
    expect(component.paymentsError()).toBeNull();
  });

  it('BAC 5c: should cancel all ongoing HTTP subscriptions on component destroy', () => {
    const delayedSummarySubject = new Subject<PaymentSummaryDto>();
    const delayedPaymentsSubject = new Subject<any>();

    mockPaymentService.getPaymentSummary.mockReturnValueOnce(delayedSummarySubject.asObservable());
    mockPaymentService.getPayments.mockReturnValueOnce(delayedPaymentsSubject.asObservable());

    fixture = TestBed.createComponent(PaymentsPage);
    fixture.detectChanges();

    expect(delayedSummarySubject.observed).toBe(true);
    expect(delayedPaymentsSubject.observed).toBe(true);

    // Destroy component
    fixture.destroy();

    // Subscriptions must be cancelled immediately
    expect(delayedSummarySubject.observed).toBe(false);
    expect(delayedPaymentsSubject.observed).toBe(false);
  });

  // =========================================================================
  // BAC 6: TIMEZONE BOUNDARY FUNCTIONS & FILTER PAGINATION RESET
  // =========================================================================
  describe('BAC 6: Timezone Boundary Functions & Filter Reset', () => {
    it('should map 18:00 UTC (after 17:00 UTC boundary) to the next calendar date in Vietnam (UTC+7)', () => {
      const utcDate = new Date('2026-10-12T18:00:00.000Z');
      const vnDateString = getTodayVietnamDateString(utcDate);
      expect(vnDateString).toBe('2026-10-13');
    });

    it('should map 10:00 UTC (before 17:00 UTC boundary) to the same calendar date in Vietnam (UTC+7)', () => {
      const utcDate = new Date('2026-10-12T10:00:00.000Z');
      const vnDateString = getTodayVietnamDateString(utcDate);
      expect(vnDateString).toBe('2026-10-12');
    });

    it('should format UTC timestamp clearly with explicit UTC suffix', () => {
      const formatted = formatUtcDateTimeString('2026-10-12T02:30:45Z');
      expect(formatted).toBe('12/10/2026 02:30:45 UTC');
    });

    it('should reset currentPage to 1 when filters change or are cleared', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.currentPage.set(3);
      expect(component.currentPage()).toBe(3);

      component.onFilterChange();
      expect(component.currentPage()).toBe(1);

      component.currentPage.set(4);
      component.resetFilters();
      expect(component.currentPage()).toBe(1);
    });
  });

  // =========================================================================
  // BAC 7: FOLIO STATEMENT & CASHIER COLLECTION (CASH, VIETQR, RECEIPT VOUCHER)
  // =========================================================================
  describe('BAC 7: Folio Statement & Cashier Payment Collection', () => {
    it('should load Folio statement for a reservation and populate financial breakdown', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      expect(mockPaymentService.getFolio).toHaveBeenCalledWith('res-001-bbbb', 'prop-1111');
      expect(component.folio()).not.toBeNull();
      expect(component.folio()?.confirmationCode).toBe('CONF-12345');
      expect(component.folio()?.remainingBalance).toBe(1500000);
      expect(component.paymentAmount).toBe(1500000);

      const text = fixture.nativeElement.textContent || '';
      expect(text).toContain('CONF-12345');
      expect(text).toContain('Deluxe Ocean View');
      expect(text).toContain('2,000,000');
      expect(text).toContain('1,500,000');
    });

    it('should fast-fill remaining balance when fillRemainingBalance is triggered', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.paymentAmount = 0;
      component.fillRemainingBalance(1500000);
      expect(component.paymentAmount).toBe(1500000);
    });

    it('should display unconfigured bank notice when BankTransfer is selected without fake account or auto-paying', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      component.paymentMethod.set(PaymentMethod.BankTransfer);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chưa có cấu hình VietQR chính thức');
      expect(compiled.textContent).not.toContain('VCB-9876543210');
      // Must not auto-complete payment merely on selecting BankTransfer
      expect(mockPaymentService.createPayment).not.toHaveBeenCalled();
    });

    it('should submit payment, refresh Folio, trigger Receipt Voucher Modal, and allow printing/closing', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      component.paymentAmount = 1500000;
      component.paymentMethod.set(PaymentMethod.Cash);
      component.paymentTransactionRef = 'REC-999';

      component.submitPayment('res-001-bbbb');
      fixture.detectChanges();

      expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 'res-001-bbbb',
          amount: 1500000,
          method: PaymentMethod.Cash,
          transactionRef: 'REC-999'
        }),
        'prop-1111'
      );

      // Receipt Voucher Modal triggered
      expect(component.receiptVoucher()).not.toBeNull();
      expect(component.receiptVoucher()?.amount).toBe(1500000);
      expect(component.receiptVoucher()?.guestName).toBe('Nguyễn Văn A');

      const text = fixture.nativeElement.textContent || '';
      expect(text).toContain('Phiếu Xác Nhận Thu Tiền Nội Bộ');
      expect(text).toContain('GIAO DỊCH THÀNH CÔNG');
      expect(text).toContain('1,500,000 VNĐ');
      expect(text).toContain('Phiếu xác nhận thu tiền nội bộ, không phải hóa đơn VAT');

      // Test print call
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      component.printReceipt();
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();

      // Test close receipt modal
      component.closeReceiptModal();
      fixture.detectChanges();
      expect(component.receiptVoucher()).toBeNull();
    });

    it('should display itemized charges from snapshot and separate required deposit from paid deposit', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent || '';
      expect(text).toContain('Chi tiết các khoản phí');
      expect(text).toContain('Cọc yêu cầu: 500,000 VNĐ');
      expect(text).toContain('Cọc đã thực thu: 500,000 VNĐ');
      expect(text).toContain('Tiền phòng 2 đêm');
      expect(text).toContain('Đã thanh toán (Chỉ trừ các giao dịch hoàn tất)');
    });

    it('should display "Chưa xác định" when depositPaid or baseRoomAmount is null (no structured breakdown or deposit tag)', () => {
      const indeterminateFolio: FolioDto = {
        ...sampleFolio,
        depositRequired: 500000,
        depositPaid: null,
        baseRoomAmount: null,
        surchargesAmount: null,
        servicesAmount: null,
        breakdown: []
      };
      mockPaymentService.getFolio.mockReturnValue(of(indeterminateFolio));

      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent || '';
      expect(text).toContain('Cọc yêu cầu: 500,000 VNĐ');
      expect(text).toContain('Cọc đã thực thu: Chưa xác định');
      expect(text).toContain('Phân bổ chi tiết:');
      expect(text).toContain('Chưa xác định (Không có dữ liệu breakdown cấu trúc)');
    });

    it('should submit payment with isDeposit: true when deposit tag checkbox is checked', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      component.paymentAmount = 500000;
      component.paymentMethod.set(PaymentMethod.Cash);
      component.paymentTransactionRef = 'DEP-001';
      component.toggleDepositPayment();
      expect(component.isDepositPayment()).toBe(true);

      component.submitPayment('res-001-bbbb');
      fixture.detectChanges();

      expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 'res-001-bbbb',
          amount: 500000,
          method: PaymentMethod.Cash,
          isDeposit: true
        }),
        'prop-1111'
      );
      expect(component.isDepositPayment()).toBe(false);
    });

    it('should require bank confirmation and transaction reference for BankTransfer method before submitting', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.loadFolio('res-001-bbbb');
      fixture.detectChanges();

      component.paymentAmount = 1500000;
      component.paymentMethod.set(PaymentMethod.BankTransfer);
      component.paymentTransactionRef = '';

      // 1. Without transaction ref
      component.submitPayment('res-001-bbbb');
      expect(component.folioError()).toContain('Vui lòng nhập mã giao dịch ngân hàng');
      expect(mockPaymentService.createPayment).not.toHaveBeenCalled();

      // 2. With ref but without confirmation checkbox
      component.paymentTransactionRef = 'FT241016-1234';
      component.submitPayment('res-001-bbbb');
      expect(component.folioError()).toContain('Thu ngân phải xác nhận tiền đã vào tài khoản');
      expect(mockPaymentService.createPayment).not.toHaveBeenCalled();

      // 3. With confirmation checkbox checked
      component.toggleBankTransferConfirmed();
      expect(component.isBankTransferConfirmed()).toBe(true);

      component.submitPayment('res-001-bbbb');
      expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 'res-001-bbbb',
          amount: 1500000,
          method: PaymentMethod.BankTransfer,
          transactionRef: 'FT241016-1234'
        }),
        'prop-1111'
      );
      // Confirmation reset after submission
      expect(component.isBankTransferConfirmed()).toBe(false);
    });

    it('should display shift report as "Báo cáo thu theo ca" with 06-14, 14-22, 22-06 shift options and note demo convention', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent || '';
      expect(text).toContain('Báo cáo thu theo ca');
      expect(text).toContain('quy ước cho bản demo');
      expect(text).not.toContain('chốt ca');
      expect(text).not.toContain('bàn giao ca');

      // Verify shift options
      expect(SHIFT_TYPE_LABELS[ShiftType.Morning]).toContain('06:00 - 14:00');
      expect(SHIFT_TYPE_LABELS[ShiftType.Afternoon]).toContain('14:00 - 22:00');
      expect(SHIFT_TYPE_LABELS[ShiftType.Night]).toContain('22:00 - 06:00');
    });

    it('should inspect folio when clicking reservation ID from table', () => {
      fixture = TestBed.createComponent(PaymentsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.inspectReservationFolio('res-001-bbbb');
      expect(component.searchReservationId).toBe('res-001-bbbb');
      expect(mockPaymentService.getFolio).toHaveBeenCalledWith('res-001-bbbb', 'prop-1111');
    });
  });
});
