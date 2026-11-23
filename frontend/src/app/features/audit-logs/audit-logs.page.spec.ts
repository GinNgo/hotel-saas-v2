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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuditLogsPage } from './audit-logs.page';
import { AuditLogService } from '../../core/services/audit-log.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { AuditLogDetail, AuditLogListItem } from '../../core/models/audit-log.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('AuditLogsPage — T03-C UI Tests', () => {
  let fixture: ComponentFixture<AuditLogsPage>;
  let component: AuditLogsPage;
  let mockAuditLogService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let mockRouter: any;

  const sampleItems: AuditLogListItem[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: '11111111-1111-1111-1111-111111111111',
      propertyId: '22222222-2222-2222-2222-222222222222',
      propertyName: 'Khách sạn LuxeStay Đà Lạt',
      propertyCode: 'DL-01',
      userId: '33333333-3333-3333-3333-333333333333',
      userFullName: 'Nguyễn Văn Quản Lý',
      userEmail: 'manager@luxestay.vn',
      action: 'Update',
      entityName: 'RoomTypeRate',
      entityId: '44444444-4444-4444-4444-444444444444',
      createdAtUtc: '2026-10-29T10:30:00Z',
      changedFields: ['NightlyPrice', 'ChangeReason'],
      changeSummary: 'Cập nhật giá theo đêm phòng Deluxe từ 850.000 đ thành 950.000 đ'
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: '11111111-1111-1111-1111-111111111111',
      propertyId: '22222222-2222-2222-2222-222222222222',
      propertyName: 'Khách sạn LuxeStay Đà Lạt',
      propertyCode: 'DL-01',
      userId: '33333333-3333-3333-3333-333333333333',
      userFullName: 'Nguyễn Văn Quản Lý',
      userEmail: 'manager@luxestay.vn',
      action: 'Create',
      entityName: 'PropertySurchargePolicy',
      entityId: '55555555-5555-5555-5555-555555555555',
      createdAtUtc: '2026-10-29T09:15:00Z',
      changedFields: ['SurchargeType', 'FlatAmount'],
      changeSummary: 'Tạo mới phụ thu Early Check-in'
    }
  ];

  const sampleDetail: AuditLogDetail = {
    ...sampleItems[0],
    ipAddress: '192.168.1.100',
    oldValues: '{"NightlyPrice":850000}',
    newValues: '{"NightlyPrice":950000}',
    changes: [
      {
        fieldName: 'NightlyPrice',
        oldValue: '850000',
        newValue: '950000'
      },
      {
        fieldName: 'ChangeReason',
        oldValue: 'Giá mùa thường',
        newValue: 'Điều chỉnh cao điểm Festival Hoa'
      }
    ]
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    mockAuditLogService = {
      getAuditLogs: vi.fn().mockReturnValue(of({
        success: true,
        data: {
          items: sampleItems,
          totalCount: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        },
        message: null,
        timestamp: new Date().toISOString()
      })),
      getAuditLogById: vi.fn().mockReturnValue(of({
        success: true,
        data: sampleDetail,
        message: null,
        timestamp: new Date().toISOString()
      }))
    };

    mockAuthService = {
      currentUser: {
        id: 'owner-user-id',
        email: 'owner@luxestay.vn',
        fullName: 'Trần Đại Gia (Owner)',
        globalRole: 'Owner',
        tenantId: '11111111-1111-1111-1111-111111111111'
      },
      activePropertyId: vi.fn().mockReturnValue('22222222-2222-2222-2222-222222222222'),
      activePropertyCode: vi.fn().mockReturnValue('DL-01'),
      activeRoleName: vi.fn().mockReturnValue('Owner'),
      memberships: [
        {
          tenantId: '11111111-1111-1111-1111-111111111111',
          propertyId: '22222222-2222-2222-2222-222222222222',
          propertyName: 'Khách sạn LuxeStay Đà Lạt',
          staffRole: 'Owner'
        }
      ]
    };

    mockAlertService = {
      error: vi.fn(),
      success: vi.fn(),
      toastSuccess: vi.fn(),
      toastWarning: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogsPage],
      providers: [
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('1. should initialize and automatically load audit logs for authorized Owner', () => {
    fixture.detectChanges();

    expect(component.isAuthorized()).toBe(true);
    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalled();
    expect(component.auditLogs().length).toBe(2);
    expect(component.totalRecords()).toBe(2);
  });

  it('2. should block unauthorized roles (e.g. Receptionist) and display restricted access notice', () => {
    mockAuthService.currentUser = {
      id: 'reception-id',
      email: 'reception@luxestay.vn',
      fullName: 'Lễ Tân A',
      globalRole: 'Staff',
      tenantId: '11111111-1111-1111-1111-111111111111'
    };
    mockAuthService.activeRoleName.mockReturnValue('Receptionist');
    mockAuthService.memberships = [
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        propertyId: '22222222-2222-2222-2222-222222222222',
        staffRole: 'Receptionist'
      }
    ];

    fixture = TestBed.createComponent(AuditLogsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isAuthorized()).toBe(false);
    expect(mockAuditLogService.getAuditLogs).not.toHaveBeenCalled();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Hạn chế quyền truy cập');
  });

  it('3. should pass filters (action, entityName, dates) to audit log service', () => {
    fixture.detectChanges();

    component.selectedAction = 'Update';
    component.selectedEntityName = 'RoomTypeRate';
    component.fromDate = '2026-10-01';
    component.toDate = '2026-10-31';
    component.onFilterChange();

    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
      action: 'Update',
      entityName: 'RoomTypeRate',
      propertyId: '22222222-2222-2222-2222-222222222222',
      page: 1,
      pageSize: 20
    }));
  });

  it('4. should open detail modal and fetch full diff when user clicks View Details', () => {
    fixture.detectChanges();

    component.openDetail('00000000-0000-0000-0000-000000000001');

    expect(mockAuditLogService.getAuditLogById).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '22222222-2222-2222-2222-222222222222'
    );
    expect(component.isDetailModalOpen()).toBe(true);
    expect(component.selectedDetail()).toEqual(sampleDetail);
  });

  it('5. should format currency cleanly with Vietnamese Dong and thousand separators', () => {
    expect(component.formatFieldValue('NightlyPrice', '850000')).toBe('850.000 ₫');
    expect(component.formatFieldValue('NightlyPrice', '950000')).toBe('950.000 ₫');
    expect(component.formatFieldValue('FlatAmount', '50000')).toBe('50.000 ₫');
  });

  it('6. should format boolean values cleanly into Vietnamese descriptions', () => {
    expect(component.formatFieldValue('IsActive', 'True')).toBe('Hoạt động (Có)');
    expect(component.formatFieldValue('IsActive', 'False')).toBe('Vô hiệu (Không)');
    expect(component.formatFieldValue('UnknownField', null)).toBe('—');
  });

  it('7. should reset filters back to defaults on resetFilters()', () => {
    component.selectedAction = 'Delete';
    component.selectedEntityName = 'Invoice';
    component.fromDate = '2026-01-01';
    component.toDate = '2026-01-31';

    component.resetFilters();

    expect(component.selectedAction).toBe('');
    expect(component.selectedEntityName).toBe('');
    expect(component.fromDate).toBe('');
    expect(component.toDate).toBe('');
    expect(component.currentPage()).toBe(1);
  });

  it('8. should update page number on page change and reload logs', () => {
    fixture.detectChanges();

    component.onPageChange(2);

    expect(component.currentPage()).toBe(2);
    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
      page: 2
    }));
  });

  it('9. should return "So sánh" for Update action and "Xem chi tiết" for Create and Delete', () => {
    expect(component.getActionButtonLabel('Update')).toBe('So sánh');
    expect(component.getActionButtonLabel('Create')).toBe('Xem chi tiết');
    expect(component.getActionButtonLabel('Delete')).toBe('Xem chi tiết');
    expect(component.getActionButtonLabel(undefined)).toBe('Xem chi tiết');
  });

  it('10. should format EffectiveTo with exclusive domain boundary note', () => {
    const formatted = component.formatFieldValue('EffectiveTo', '2026-11-01');
    expect(formatted).toContain('01/11/2026');
    expect(formatted).toContain('31/10/2026');
    expect(formatted).toContain('exclusive');

    const formattedFrom = component.formatFieldValue('EffectiveFrom', '2026-10-01');
    expect(formattedFrom).toContain('01/10/2026');
    expect(formattedFrom).toContain('00:00');
  });

  it('11. should generate human-friendly summary in Vietnamese and hide raw GUIDs', () => {
    const rawSummary = 'Tạo mới RoomTypeRate (Currency=VND, IsActive=true, FirstHours=2, RoomTypeId=e03f8ded-8329-4bd8-a62f-8c92325ff2d9)';
    const friendly = component.getFriendlySummary(rawSummary, 'Create', 'RoomTypeRate');

    expect(friendly).toContain('Bảng giá phòng');
    expect(friendly).toContain('Tiền tệ=VND');
    expect(friendly).toContain('Trạng thái=Hoạt động');
    expect(friendly).toContain('Số giờ đầu=2h');
    expect(friendly).not.toContain('e03f8ded-8329-4bd8-a62f-8c92325ff2d9');

    const updateRaw = 'Cập nhật RoomTypeRate: NightlyPrice: 850000 -> 950000';
    const friendlyUpdate = component.getFriendlySummary(updateRaw, 'Update', 'RoomTypeRate');
    expect(friendlyUpdate).toContain('Giá theo đêm: 850.000 ₫ → 950.000 ₫');
  });

  it('12. should separate business fields from technical reference IDs', () => {
    const mixedChanges = [
      { fieldName: 'NightlyPrice', oldValue: '850000', newValue: '950000' },
      { fieldName: 'RoomTypeId', oldValue: null, newValue: 'e03f8ded-8329-4bd8-a62f-8c92325ff2d9' },
      { fieldName: 'CreatedByUserId', oldValue: null, newValue: '9dbc31d3-9d3d-4558-8b1b-8df29eb54beb' },
      { fieldName: 'IsActive', oldValue: 'false', newValue: 'true' }
    ];

    const business = component.getBusinessChanges(mixedChanges);
    const technical = component.getTechnicalChanges(mixedChanges);

    expect(business.length).toBe(2);
    expect(business.map(b => b.fieldName)).toEqual(['NightlyPrice', 'IsActive']);

    expect(technical.length).toBe(2);
    expect(technical.map(t => t.fieldName)).toEqual(['RoomTypeId', 'CreatedByUserId']);
  });

  it('13. should copy text to clipboard and trigger alert notification', () => {
    (navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };

    component.copyToClipboard('test-entity-id-1234', 'Mã đối tượng');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-entity-id-1234');
  });

  it('14. should close detail modal when Escape key is pressed', () => {
    component.isDetailModalOpen.set(true);
    component.selectedDetail.set(sampleDetail);

    component.onEscapePress();

    expect(component.isDetailModalOpen()).toBe(false);
    expect(component.selectedDetail()).toBe(null);
  });

  it('15. should paginate CSV export in chunks of pageSize 100 until hasNextPage is false without exceeding backend limit', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-csv');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });

    const page1Items = Array.from({ length: 100 }, (_, i) => ({
      ...sampleItems[0],
      id: `p1-${i}`
    }));
    const page2Items = Array.from({ length: 25 }, (_, i) => ({
      ...sampleItems[1],
      id: `p2-${i}`
    }));

    component.auditLogs.set(sampleItems);
    component.totalRecords.set(125);
    mockAuditLogService.getAuditLogs.mockReset();
    mockAuditLogService.getAuditLogs
      .mockReturnValueOnce(of({
        success: true,
        data: { items: page1Items, totalCount: 125, page: 1, pageSize: 100, totalPages: 2, hasPreviousPage: false, hasNextPage: true },
        message: null,
        timestamp: new Date().toISOString()
      }))
      .mockReturnValueOnce(of({
        success: true,
        data: { items: page2Items, totalCount: 125, page: 2, pageSize: 100, totalPages: 2, hasPreviousPage: true, hasNextPage: false },
        message: null,
        timestamp: new Date().toISOString()
      }));

    component.exportToCsv();

    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledTimes(2);
    expect(mockAuditLogService.getAuditLogs).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, pageSize: 100 }));
    expect(mockAuditLogService.getAuditLogs).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, pageSize: 100 }));
    expect(component.exporting()).toBe(false);
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('125 bản ghi'));
  });

  it('16. should display Vietnamese labels for platform audit entities (TenantStatus, PropertyPublishApproval, SubscriptionUpgrade, GuestReview)', () => {
    expect(component.getEntityDisplayLabel('TenantStatus')).toBe('Trạng thái thuê bao');
    expect(component.getEntityDisplayLabel('PropertyPublishApproval')).toBe('Duyệt xuất bản cơ sở');
    expect(component.getEntityDisplayLabel('SubscriptionUpgrade')).toBe('Nâng cấp gói cước');
    expect(component.getEntityDisplayLabel('GuestReview')).toBe('Đánh giá khách lưu trú');
    expect(component.getEntityDisplayLabel('SepayExpiredHoldAlert')).toBe('Cảnh báo chuyển khoản quá hạn SePay');
    expect(component.getEntityDisplayLabel('SepayBankAccountConfigWarning')).toBe('Cảnh báo chưa cấu hình STK SePay');
  });

  it('17. should expose all 18 canonical actions (including LoginFailed) with clean Vietnamese labels and unlock GuestReview for Owners', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const actionOptionEls = Array.from(el.querySelectorAll('#filter-action option')) as HTMLOptionElement[];
    const actionOptions = actionOptionEls.map(opt => opt.value).filter(Boolean);

    const expectedActions = [
      'Create',
      'Update',
      'Delete',
      'Cancel',
      'Reschedule',
      'MarkNoShow',
      'NightAuditAutoNoShow',
      'RegenerateSmartLockPin',
      'RevokeSmartLockPin',
      'CheckInDepositWarning',
      'OverrideLateCheckOutSurcharge',
      'ApproveRefund',
      'RejectRefund',
      'ConfirmRefundPayout',
      'StatusToggle',
      'PublishApproval',
      'Upgrade',
      'LoginFailed'
    ];

    expect(actionOptions.length).toBe(18);
    for (const action of expectedActions) {
      expect(actionOptions).toContain(action);
      expect(component.getActionLabel(action)).not.toBe(action);
      // Custom actions should use semantic color badges (not dull slate fallback)
      expect(component.getActionBadgeClass(action)).not.toContain('bg-slate-100');
    }

    // No raw English parenthetical keys like "(ApproveRefund)" or "(LoginFailed)" in dropdown labels
    for (const opt of actionOptionEls) {
      if (opt.value) {
        expect(opt.textContent).not.toContain(`(${opt.value})`);
      }
    }

    const entityOptions = Array.from(el.querySelectorAll('#filter-entity option'))
      .map(opt => (opt as HTMLOptionElement).value);
    expect(entityOptions).toContain('SepayExpiredHoldAlert');
    expect(entityOptions).toContain('SepayBankAccountConfigWarning');
    expect(entityOptions).toContain('GuestReview');
    expect(entityOptions).toContain('Auth');
  });

  it('18. should display explicit warning toast when CSV export hits the 1,000-row cap', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-csv');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });

    component.auditLogs.set(sampleItems);
    component.totalRecords.set(1250);
    mockAuditLogService.getAuditLogs.mockReset();
    mockAuditLogService.getAuditLogs.mockImplementation(({ page }: { page: number }) => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        ...sampleItems[0],
        id: `p${page}-${i}`
      }));
      return of({
        success: true,
        data: { items, totalCount: 1250, page, pageSize: 100, totalPages: 13, hasPreviousPage: page > 1, hasNextPage: page < 13 },
        message: null,
        timestamp: new Date().toISOString()
      });
    });

    component.exportToCsv();

    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledTimes(10);
    expect(mockAlertService.toastWarning).toHaveBeenCalledWith(
      expect.stringContaining('1.000'),
      'Giới hạn xuất CSV',
      6000
    );
    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
  });

  it('19. should pass pasted UUID directly in search param instead of forcing entityId', () => {
    fixture.detectChanges();
    mockAuditLogService.getAuditLogs.mockClear();

    const pastedUuid = '44444444-4444-4444-4444-444444444444';
    component.searchKeyword = pastedUuid;
    component.onFilterChange();

    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
      search: pastedUuid
    }));
    const lastArg = mockAuditLogService.getAuditLogs.mock.calls[0][0];
    expect(lastArg.entityId).toBeUndefined();
  });

  it('20. should localize custom action summaries naturally in Vietnamese without raw English prefixes', () => {
    expect(component.getFriendlySummary('ApproveRefund Payment', 'ApproveRefund', 'Payment'))
      .toBe('Phê duyệt hoàn tiền cho Giao dịch thanh toán');
    expect(component.getFriendlySummary('RejectRefund Payment', 'RejectRefund', 'Payment'))
      .toBe('Từ chối yêu cầu hoàn tiền cho Giao dịch thanh toán');
    expect(component.getFriendlySummary('ConfirmRefundPayout Payment', 'ConfirmRefundPayout', 'Payment'))
      .toBe('Xác nhận đã chi hoàn tiền cho Giao dịch thanh toán');
    expect(component.getFriendlySummary('RegenerateSmartLockPin Reservation', 'RegenerateSmartLockPin', 'Reservation'))
      .toBe('Cấp lại mã PIN khóa thông minh cho Đơn đặt phòng');
    expect(component.getFriendlySummary('RevokeSmartLockPin Reservation', 'RevokeSmartLockPin', 'Reservation'))
      .toBe('Thu hồi mã PIN khóa thông minh của Đơn đặt phòng');
    expect(component.getFriendlySummary('Cancel Reservation', 'Cancel', 'Reservation'))
      .toBe('Hủy Đơn đặt phòng');
    expect(component.getFriendlySummary('LoginFailed Auth', 'LoginFailed', 'Auth'))
      .toBe('Ghi nhận lần đăng nhập thất bại');
    expect(component.getFriendlySummary('StatusToggle Tenant', 'StatusToggle', 'Tenant'))
      .toBe('Thay đổi trạng thái hoạt động của Doanh nghiệp / Chuỗi khách sạn');
    expect(component.getFriendlySummary('PublishApproval Property', 'PublishApproval', 'Property'))
      .toBe('Phê duyệt xuất bản Cơ sở & Chi nhánh');
    expect(component.getFriendlySummary('Upgrade Tenant', 'Upgrade', 'Tenant'))
      .toBe('Nâng cấp gói dịch vụ cho Doanh nghiệp / Chuỗi khách sạn');
    expect(component.getFriendlySummary('OverrideLateCheckOutSurcharge Reservation', 'OverrideLateCheckOutSurcharge', 'Reservation'))
      .toBe('Miễn hoặc điều chỉnh phụ thu trả phòng muộn cho Đơn đặt phòng');
    expect(component.getFriendlySummary('CheckInDepositWarning Reservation', 'CheckInDepositWarning', 'Reservation'))
      .toBe('Cảnh báo thiếu tiền cọc khi nhận phòng cho Đơn đặt phòng');
  });

  it('21. should render Branch/Property filter select for Owners with PROPERTIES:1 permission and show propertyName in table', async () => {
    TestBed.resetTestingModule();
    const mockPropertyMgmt = {
      getTenantProperties: vi.fn().mockReturnValue(of([
        { id: '22222222-2222-2222-2222-222222222222', name: 'Khách sạn LuxeStay Đà Lạt', code: 'DL-01' },
        { id: '99999999-9999-9999-9999-999999999999', name: 'LuxeStay Nha Trang', code: 'NT-02' }
      ]))
    };
    const ownerAuth = {
      ...mockAuthService,
      hasPermission: vi.fn((code: string, action: number) => code === 'PROPERTIES' && action === 1)
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogsPage],
      providers: [
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: AuthService, useValue: ownerAuth },
        { provide: AlertService, useValue: mockAlertService },
        { provide: PropertyManagementService, useValue: mockPropertyMgmt },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    const ownerFixture = TestBed.createComponent(AuditLogsPage);
    const ownerComp = ownerFixture.componentInstance;
    ownerFixture.detectChanges();

    const el = ownerFixture.nativeElement as HTMLElement;
    const branchSelect = el.querySelector('#filter-property') as HTMLSelectElement | null;
    expect(branchSelect).not.toBeNull();
    expect(el.textContent).toContain('Chi nhánh / Doanh nghiệp');
    expect(el.textContent).toContain('Khách sạn LuxeStay Đà Lạt');
    expect(el.querySelector('[data-testid="date-preset-today"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="open-grafana-logs-btn"]')).toBeNull();

    mockAuditLogService.getAuditLogs.mockClear();
    ownerComp.selectedPropertyId = '99999999-9999-9999-9999-999999999999';
    ownerComp.onFilterChange();
    expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: '99999999-9999-9999-9999-999999999999'
    }));
  });

  it('22. should show "Mở Grafana Log" header link and tenantName column value for SuperAdmin', async () => {
    TestBed.resetTestingModule();
    const superAdminLogs: AuditLogListItem[] = [
      {
        ...sampleItems[0],
        tenantName: 'Tập đoàn LuxeStay Holdings'
      }
    ];
    mockAuditLogService.getAuditLogs.mockReturnValue(of({
      success: true,
      data: {
        items: superAdminLogs,
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      message: null,
      timestamp: new Date().toISOString()
    }));

    const superAdminAuth = {
      ...mockAuthService,
      currentUser: {
        id: 'sa-1',
        email: 'admin@hotelsaas.vn',
        fullName: 'SuperAdmin',
        globalRole: 'SuperAdmin',
        tenantId: null
      },
      activePropertyId: vi.fn().mockReturnValue(null),
      hasPermission: vi.fn().mockReturnValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogsPage],
      providers: [
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: AuthService, useValue: superAdminAuth },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    const saFixture = TestBed.createComponent(AuditLogsPage);
    saFixture.detectChanges();

    const el = saFixture.nativeElement as HTMLElement;
    const grafanaLink = el.querySelector('[data-testid="open-grafana-logs-btn"]') as HTMLAnchorElement | null;
    expect(grafanaLink).not.toBeNull();
    expect(grafanaLink?.getAttribute('href')).toBe('/grafana/d/hotelsaas-ops-logs-vn');
    expect(grafanaLink?.getAttribute('target')).toBe('_blank');
    expect(grafanaLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.textContent).toContain('Tập đoàn LuxeStay Holdings');
  });
});

