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
import { of, throwError } from 'rxjs';

import { RefundApprovalComponent } from './refund-approval.component';
import { PaymentService } from '../../../../core/services/payment.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import {
  RefundRequestDto,
  RefundRequestDetailDto,
  PaymentMethod
} from '../../../../core/models/payment.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('RefundApprovalComponent — Task Week 05 T01 (Decision D23 Verification)', () => {
  let fixture: ComponentFixture<RefundApprovalComponent>;
  let component: RefundApprovalComponent;
  let mockPaymentService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let activePropertyIdSignal: WritableSignal<string | null>;
  let activePropertyNameSignal: WritableSignal<string | null>;
  let hasPermissionMock: ReturnType<typeof vi.fn>;

  const mockRefundItems: RefundRequestDto[] = [
    {
      paymentId: 'pay-001',
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      propertyName: 'LuxeStay Saigon',
      reservationId: 'res-001',
      confirmationCode: 'REF-BOOK-01',
      guestName: 'Tran Trong Tan',
      guestEmail: 't***@example.com',
      guestPhone: '098***321',
      totalAmount: 2000000,
      paidAmount: 2000000,
      cancellationFee: 400000,
      refundableAmount: 1600000,
      method: 'BankTransfer',
      status: 'PendingApproval',
      statusName: 'Chờ phê duyệt',
      transactionRef: 'REFUND-PENDING-REF-BOOK-01',
      bankTransactionRef: null,
      approvedByUserId: null,
      approvedByUserName: null,
      approvedAtUtc: null,
      paidAtUtc: null,
      rejectionReason: null,
      notes: null,
      createdAtUtc: new Date().toISOString()
    },
    {
      paymentId: 'pay-002',
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      propertyName: 'LuxeStay Saigon',
      reservationId: 'res-002',
      confirmationCode: 'REF-BOOK-02',
      guestName: 'Nguyen Van B',
      guestEmail: 'b***@example.com',
      guestPhone: '091***456',
      totalAmount: 1000000,
      paidAmount: 1000000,
      cancellationFee: 0,
      refundableAmount: 1000000,
      method: 'BankTransfer',
      status: 'Approved',
      statusName: 'Đã duyệt - Chờ chi trả',
      transactionRef: 'REFUND-APPROVED-REF-BOOK-02',
      bankTransactionRef: null,
      approvedByUserId: 'mgr-001',
      approvedByUserName: 'Manager Jane',
      approvedAtUtc: new Date().toISOString(),
      paidAtUtc: null,
      rejectionReason: null,
      notes: 'Đồng ý hoàn 100%',
      createdAtUtc: new Date().toISOString()
    }
  ];

  const mockDetail: RefundRequestDetailDto = {
    paymentId: 'pay-001',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    propertyName: 'LuxeStay Saigon',
    reservationId: 'res-001',
    confirmationCode: 'REF-BOOK-01',
    guestName: 'Tran Trong Tan',
    guestEmail: 't***@example.com',
    guestPhone: '098***321',
    roomTypeName: 'Deluxe Ocean View',
    roomNumber: '101',
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-12',
    startAtUtc: '2026-11-10T07:00:00Z',
    endAtUtc: '2026-11-12T05:00:00Z',
    totalAmount: 2000000,
    paidAmount: 2000000,
    cancellationFee: 400000,
    refundableAmount: 1600000,
    method: 'BankTransfer',
    status: 'PendingApproval',
    statusName: 'Chờ phê duyệt',
    transactionRef: 'REFUND-PENDING-REF-BOOK-01',
    bankTransactionRef: null,
    policyDescription: 'Hủy phòng trước 24 giờ nhận phòng được miễn phí hủy.',
    isFreeCancellation: false,
    hoursUntilCheckIn: 18,
    approvedByUserId: null,
    approvedByUserName: null,
    approvedAtUtc: null,
    paidAtUtc: null,
    rejectionReason: null,
    notes: null,
    createdAtUtc: new Date().toISOString(),
    canApprove: true,
    originalPayments: [
      {
        id: 'orig-pay-01',
        amount: 2000000,
        methodName: 'BankTransfer',
        statusName: 'Completed',
        transactionRef: 'VCB-ORIG-12345',
        paidAtUtc: new Date().toISOString(),
        createdAtUtc: new Date().toISOString()
      }
    ],
    auditTrail: [
      {
        stepTitle: 'Khách yêu cầu hủy phòng',
        description: 'Khách gửi yêu cầu hủy online.',
        performedBy: 'Khách hàng',
        timestampUtc: new Date().toISOString(),
        state: 'completed'
      },
      {
        stepTitle: 'Quản lý phê duyệt (D23)',
        description: 'Đang chờ Quản lý chi nhánh xét duyệt.',
        performedBy: null,
        timestampUtc: null,
        state: 'current'
      },
      {
        stepTitle: 'Chi trả qua ngân hàng',
        description: 'Chi trả tiền và lưu mã bút toán đối soát.',
        performedBy: null,
        timestampUtc: null,
        state: 'upcoming'
      }
    ]
  };

  beforeEach(async () => {
    activePropertyIdSignal = signal<string | null>('prop-1');
    activePropertyNameSignal = signal<string | null>('LuxeStay Saigon');
    hasPermissionMock = vi.fn().mockImplementation((func: string, action: number) => {
      // Default to Manager permissions (has PAYMENTS:Approve bit 16)
      if (func === 'PAYMENTS') return (action & 16) === 16 || action === 1;
      return false;
    });

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      activePropertyName: activePropertyNameSignal,
      hasPermission: hasPermissionMock
    };

    mockPaymentService = {
      getRefundRequests: vi.fn().mockReturnValue(of({
        items: mockRefundItems,
        totalCount: 2,
        page: 1,
        pageSize: 10
      })),
      getRefundRequestDetail: vi.fn().mockReturnValue(of(mockDetail)),
      approveRefund: vi.fn().mockReturnValue(of({
        ...mockRefundItems[0],
        status: 'Approved',
        statusName: 'Đã duyệt - Chờ chi trả'
      })),
      rejectRefund: vi.fn().mockReturnValue(of({
        ...mockRefundItems[0],
        status: 'Rejected',
        statusName: 'Đã từ chối'
      })),
      confirmRefundPayout: vi.fn().mockReturnValue(of({
        ...mockRefundItems[1],
        status: 'Completed',
        statusName: 'Đã hoàn tiền',
        bankTransactionRef: 'VCB-998877'
      }))
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      toastWarning: vi.fn(),
      toastInfo: vi.fn()
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RefundApprovalComponent],
      providers: [
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RefundApprovalComponent);
    component = fixture.componentInstance;
  });

  it('1. should load pending refunds on init and correctly calculate KPI metrics', () => {
    component.ngOnInit();
    fixture.detectChanges();

    expect(mockPaymentService.getRefundRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'prop-1',
        page: 1,
        pageSize: 10
      })
    );

    expect(component.items().length).toBe(2);
    expect(component.totalCount()).toBe(2);
    expect(component.totalPendingCount()).toBe(1);
    expect(component.totalApprovedCount()).toBe(1);
    expect(component.totalCompletedCount()).toBe(0);
    expect(component.totalRefundAmount()).toBe(2600000);
  });

  it('2. should filter by status when status tab changes', () => {
    component.onFilterStatusChange('PendingApproval');

    expect(component.statusFilter()).toBe('PendingApproval');
    expect(component.pageIndex).toBe(1);
    expect(mockPaymentService.getRefundRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PendingApproval'
      })
    );
  });

  it('3. should open detail modal and display financial breakdown and 3-step D23 stepper', () => {
    component.openDetail(mockRefundItems[0]);

    expect(mockPaymentService.getRefundRequestDetail).toHaveBeenCalledWith('pay-001', 'prop-1');
    expect(component.isDetailOpen()).toBe(true);
    expect(component.selectedDetail()).toBeDefined();

    const detail = component.selectedDetail()!;
    expect(detail.confirmationCode).toBe('REF-BOOK-01');
    expect(detail.totalAmount).toBe(2000000);
    expect(detail.paidAmount).toBe(2000000);
    expect(detail.cancellationFee).toBe(400000);
    expect(detail.refundableAmount).toBe(1600000);

    // D23 Stepper steps
    expect(detail.auditTrail.length).toBe(3);
    expect(detail.auditTrail[0].state).toBe('completed');
    expect(detail.auditTrail[1].state).toBe('current');
    expect(detail.auditTrail[2].state).toBe('upcoming');
  });

  it('4. Manager with PAYMENTS:Approve (16) should be permitted to approve refund', () => {
    expect(component.canApproveRefund()).toBe(true);

    component.openDetail(mockRefundItems[0]);
    component.promptApprove();

    expect(component.isActionModalOpen()).toBe(true);
    expect(component.actionModalType()).toBe('approve');

    component.actionNotes = 'Duyệt hoàn tiền đúng quy định';
    component.submitAction();

    expect(mockPaymentService.approveRefund).toHaveBeenCalledWith('pay-001', 'prop-1', 'Duyệt hoàn tiền đúng quy định');
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('phê duyệt thành công'));
  });

  it('5. Receptionist without PAYMENTS:Approve should NOT have approval permission (canApproveRefund=false)', () => {
    // Override hasPermission to return false for Approve bit 16
    hasPermissionMock.mockImplementation((func: string, action: number) => {
      if (func === 'PAYMENTS' && action === 1) return true; // Can Read only
      return false; // No Approve (bit 16)
    });

    expect(component.canApproveRefund()).toBe(false);
  });

  it('6. Confirm payout requires bankTransactionRef and calls service with mandatory reference', () => {
    component.openDetail(mockRefundItems[1]); // Approved item
    component.promptConfirmPayout();

    // Empty bank ref validation check
    component.bankTransactionRef = '   ';
    component.submitAction();
    expect(mockAlertService.toastWarning).toHaveBeenCalledWith(expect.stringContaining('mã đối soát'));
    expect(mockPaymentService.confirmRefundPayout).not.toHaveBeenCalled();

    // Valid submission with bank ref
    component.bankTransactionRef = 'VCB-998877';
    component.actionNotes = 'Đã đối soát';
    component.submitAction();

    expect(mockPaymentService.confirmRefundPayout).toHaveBeenCalledWith('pay-001', 'prop-1', {
      payoutMethod: PaymentMethod.BankTransfer,
      bankTransactionRef: 'VCB-998877',
      notes: 'Đã đối soát'
    });
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('xác nhận chi trả'));
  });

  it('7. Rejection requires a mandatory reason', () => {
    component.openDetail(mockRefundItems[0]);
    component.promptReject();

    component.rejectionReason = '  ';
    component.submitAction();

    expect(mockAlertService.toastWarning).toHaveBeenCalledWith(expect.stringContaining('lý do từ chối'));
    expect(mockPaymentService.rejectRefund).not.toHaveBeenCalled();

    component.rejectionReason = 'Khách hủy quá muộn so với quy định';
    component.submitAction();

    expect(mockPaymentService.rejectRefund).toHaveBeenCalledWith('pay-001', 'prop-1', 'Khách hủy quá muộn so với quy định');
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('từ chối yêu cầu'));
  });

  it('8. Double-click prevention: isSubmitting flag prevents duplicate API requests', () => {
    component.openDetail(mockRefundItems[0]);
    component.promptApprove();
    component.isSubmitting.set(true);

    component.submitAction();

    expect(mockPaymentService.approveRefund).not.toHaveBeenCalled();
  });

  it('9. Handles API error gracefully and displays SweetAlert2 toast', () => {
    mockPaymentService.getRefundRequests.mockReturnValue(
      throwError(() => ({ error: { message: 'Máy chủ bận' } }))
    );

    component.loadRefundRequests();

    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toBe('Máy chủ bận');
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Máy chủ bận');
  });

  it('10. should cleanly sanitize technical idempotency/actor metadata from transactionRef', () => {
    // Pure technical metadata without user ref
    const res1 = component.parseTxRef('[IK:pay_1793846266644_zcwrkix][BY:9dbc31d3-9d3d-4558-8b1b-8df29eb54beb]');
    expect(res1.businessRef).toBeNull();
    expect(res1.idempotencyKey).toBe('pay_1793846266644_zcwrkix');
    expect(res1.actorUserId).toBe('9dbc31d3-9d3d-4558-8b1b-8df29eb54beb');
    expect(res1.isDeposit).toBe(false);

    // Metadata with deposit tag and business reference
    const res2 = component.parseTxRef('[PURPOSE:DEPOSIT][IK:key_999][BY:usr_888] VCB-987654321');
    expect(res2.businessRef).toBe('VCB-987654321');
    expect(res2.idempotencyKey).toBe('key_999');
    expect(res2.isDeposit).toBe(true);
  });

  it('11. should cleanly parse bank reference eliminating trailing |Notes:', () => {
    // Legacy faulty composite "a|Notes:"
    expect(component.cleanBankRef('a|Notes:')).toBe('a');
    expect(component.cleanBankRef('FT240918239|Notes:ghi chu')).toBe('FT240918239');
    expect(component.cleanBankRef('BankRef:VCB-998877|Notes:')).toBe('VCB-998877');
    expect(component.cleanBankRef('')).toBeNull();
    expect(component.cleanBankRef(null)).toBeNull();
  });

  it('12. should automatically trigger debounced search on input without pressing enter', async () => {
    vi.useFakeTimers();

    component.onSearchChange('REF-BOOK-01');
    expect(component.searchTerm).toBe('REF-BOOK-01');

    // Before timer completes, shouldn't call with new term
    vi.advanceTimersByTime(200);

    // After 300ms completes, search is executed
    vi.advanceTimersByTime(150);
    expect(mockPaymentService.getRefundRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: 'REF-BOOK-01',
        page: 1
      })
    );

    vi.useRealTimers();
  });

  it('13. should support Cash payout method and validate cash voucher reference requirement', () => {
    component.openDetail(mockRefundItems[1]); // Approved item
    component.promptConfirmPayout();

    // Select Cash method
    component.payoutMethod = PaymentMethod.Cash;
    component.bankTransactionRef = '';

    component.submitAction();
    expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Vui lòng nhập số phiếu chi tiền mặt / chứng từ nội bộ.');
    expect(mockPaymentService.confirmRefundPayout).not.toHaveBeenCalled();

    // Fill valid cash receipt number
    component.bankTransactionRef = 'PC-2026-10-001';
    component.submitAction();

    expect(mockPaymentService.confirmRefundPayout).toHaveBeenCalledWith(
      'pay-001',
      'prop-1',
      expect.objectContaining({
        payoutMethod: PaymentMethod.Cash,
        bankTransactionRef: 'PC-2026-10-001'
      })
    );
  });

  it('14. should format policy description with bold tags on key thresholds', () => {
    const raw = 'Miễn phí hủy Ít nhất 24 giờ trước giờ nhận phòng. Trong vòng 24 giờ tính Phí phạt 30% tổng giá trị đơn đặt phòng.';
    const formatted = component.formatPolicyDescription(raw);

    expect(formatted).toContain('<strong class="text-emerald-700 font-bold">Miễn phí hủy</strong>');
    expect(formatted).toContain('<strong class="text-slate-900 font-bold">Ít nhất 24 giờ trước giờ nhận phòng</strong>');
    expect(formatted).toContain('<strong class="text-rose-700 font-bold">Trong vòng 24 giờ</strong>');
    expect(formatted).toContain('<strong class="text-rose-700 font-bold">Phí phạt 30% tổng giá trị đơn đặt phòng</strong>');
  });
});
