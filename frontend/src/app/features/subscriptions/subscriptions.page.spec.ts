import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MutationObserver: win.MutationObserver
  });
}

import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SubscriptionsPage } from './subscriptions.page';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AlertService } from '../../core/services/alert.service';
import {
  SubscriptionPackageDto,
  SubscriptionVietQrDto,
  TenantSubscriptionDto
} from '../../core/models/subscription.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('SubscriptionsPage — SePay VietQR & VNPay Feature Flag', () => {
  let fixture: ComponentFixture<SubscriptionsPage>;
  let component: SubscriptionsPage;
  let mockSubscriptionService: {
    getCurrentSubscription: ReturnType<typeof vi.fn>;
    getAvailablePlans: ReturnType<typeof vi.fn>;
    upgradeSubscription: ReturnType<typeof vi.fn>;
    confirmPayment: ReturnType<typeof vi.fn>;
    verifyVnpayReturn: ReturnType<typeof vi.fn>;
    getSubscriptionVietQr: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: {
    error: ReturnType<typeof vi.fn>;
    toastSuccess: ReturnType<typeof vi.fn>;
    toastInfo: ReturnType<typeof vi.fn>;
    toastError: ReturnType<typeof vi.fn>;
    toastWarning: ReturnType<typeof vi.fn>;
    confirmAction: ReturnType<typeof vi.fn>;
  };

  const samplePlans: SubscriptionPackageDto[] = [
    {
      tier: 1,
      name: 'Standard',
      description: 'Gói tiêu chuẩn',
      monthlyPrice: 990000,
      annualPrice: 9900000,
      maxRooms: 30,
      maxProperties: 1,
      maxStaff: 10,
      badge: '',
      isPopular: false,
      features: ['Quản lý đặt phòng']
    },
    {
      tier: 2,
      name: 'Pro',
      description: 'Gói chuyên nghiệp',
      monthlyPrice: 1990000,
      annualPrice: 19900000,
      maxRooms: 100,
      maxProperties: 5,
      maxStaff: 30,
      badge: 'Phổ biến nhất',
      isPopular: true,
      features: ['Đa chi nhánh', 'SePay VietQR']
    }
  ];

  const samplePendingSub: TenantSubscriptionDto = {
    subscriptionId: 'sub-1',
    tenantId: 'tenant-1',
    tier: 1,
    tierName: 'Standard',
    status: 'Active',
    billingCycle: 'Monthly',
    pricePerCycle: 990000,
    currency: 'VND',
    currentPeriodStartUtc: '2026-11-01T00:00:00Z',
    currentPeriodEndUtc: '2026-12-01T00:00:00Z',
    autoRenew: true,
    currentRoomCount: 10,
    maxRoomsAllowed: 30,
    currentPropertyCount: 1,
    maxPropertiesAllowed: 1,
    currentStaffCount: 4,
    maxStaffAllowed: 10,
    roomUsagePercentage: 33,
    features: [],
    isNearQuota: false,
    pendingPayment: {
      id: 'pay-sub-99',
      amount: 1990000,
      method: 'BankTransfer',
      status: 'Pending',
      transactionRef: 'SUB20261121ABC123',
      invoiceNumber: 'INV-SUB-001',
      createdAtUtc: '2026-11-21T08:00:00Z',
      targetTier: 2,
      billingCycle: 'Monthly'
    },
    recentPayments: []
  };

  const sampleVietQr: SubscriptionVietQrDto = {
    paymentId: 'pay-sub-99',
    transactionRef: 'SUB20261121ABC123',
    transferContent: 'NANGCAP SUB20261121ABC123',
    amount: 1990000,
    bankName: 'MBBank',
    bankBin: '970422',
    bankAccountNumber: '0999888777',
    bankAccountHolder: 'HOTEL SAAS PLATFORM',
    qrImageUrl: 'https://img.vietqr.io/image/970422-0999888777-compact2.png'
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockSubscriptionService = {
      getCurrentSubscription: vi.fn().mockReturnValue(of(samplePendingSub)),
      getAvailablePlans: vi.fn().mockReturnValue(of(samplePlans)),
      upgradeSubscription: vi.fn(),
      confirmPayment: vi.fn(),
      verifyVnpayReturn: vi.fn(),
      getSubscriptionVietQr: vi.fn().mockReturnValue(of(sampleVietQr))
    };

    mockAlertService = {
      error: vi.fn(),
      toastSuccess: vi.fn(),
      toastInfo: vi.fn(),
      toastError: vi.fn(),
      toastWarning: vi.fn(),
      confirmAction: vi.fn().mockResolvedValue(true)
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SubscriptionsPage],
      providers: [
        provideRouter([]),
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('hides VNPay checkout button and loads SePay VietQR details for pending subscription upgrade', () => {
    component.lastInitiation.set({
      paymentId: 'pay-sub-99',
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      targetTier: 2,
      targetTierName: 'Pro',
      billingCycle: 'Monthly',
      amount: 1990000,
      currency: 'VND',
      paymentStatus: 'Pending',
      transactionRef: 'SUB20261121ABC123',
      invoiceNumber: 'INV-SUB-001',
      paymentUrl: 'https://sandbox.vnpayment.vn/pay',
      isImmediateActivation: false,
      message: 'Pending'
    });

    fixture.detectChanges();

    expect(component.showVnpay).toBe(false);
    expect(mockSubscriptionService.getSubscriptionVietQr).toHaveBeenCalledWith('pay-sub-99');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Thanh toán qua VNPay');
    expect(text).toContain('Nâng cấp qua VietQR (SePay)');
    expect(text).toContain('MBBank');
    expect(text).toContain('0999888777');
    expect(text).toContain('HOTEL SAAS PLATFORM');
    expect(text).toContain('NANGCAP SUB20261121ABC123');
  });

  it('polls subscription status every 5 seconds and stops automatically when upgrade activates', () => {
    fixture.detectChanges();
    expect(mockSubscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);

    const activatedSub: TenantSubscriptionDto = {
      ...samplePendingSub,
      tier: 2,
      tierName: 'Pro',
      pendingPayment: null
    };
    mockSubscriptionService.getCurrentSubscription.mockReturnValue(of(activatedSub));

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();

    expect(mockSubscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(2);
    expect(component.currentSub()?.tierName).toBe('Pro');
    expect(component.activePendingPayment()).toBeNull();
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Pro'),
      'Nâng cấp thành công'
    );

    // Further timer ticks must NOT keep polling after activation
    vi.advanceTimersByTime(15000);
    expect(mockSubscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(2);
  });
});
