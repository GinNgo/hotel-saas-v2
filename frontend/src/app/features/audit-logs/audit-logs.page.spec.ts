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
      success: vi.fn()
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
});

