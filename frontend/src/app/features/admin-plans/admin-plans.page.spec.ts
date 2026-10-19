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
import { of, throwError } from 'rxjs';
import { AdminPlansPage } from './admin-plans.page';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { AlertService } from '../../core/services/alert.service';
import { AdminSubscriptionPlanDto } from '../../core/models/admin-plan.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('AdminPlansPage — Platform Admin Subscription Plans Tests', () => {
  let fixture: ComponentFixture<AdminPlansPage>;
  let component: AdminPlansPage;
  let mockPlansService: any;
  let mockAlertService: any;

  const samplePlans: AdminSubscriptionPlanDto[] = [
    {
      id: 'plan-1',
      name: 'Gói Cơ Bản (Starter)',
      code: 'STARTER',
      description: 'Dành cho khách sạn mini, homestay quy mô nhỏ',
      monthlyPrice: 299000,
      yearlyPrice: 2990000,
      maxRooms: 15,
      maxProperties: 1,
      maxStaff: 3,
      features: ['Quản lý phòng', 'Thu ngân'],
      isPopular: false,
      hasVnPay: true,
      hasAdvancedReports: false,
      isActive: true,
      sortOrder: 1,
      createdAtUtc: '2026-10-01T00:00:00Z'
    },
    {
      id: 'plan-2',
      name: 'Gói Chuyên Nghiệp (Pro)',
      code: 'PRO',
      description: 'Dành cho khách sạn 2-3 sao, chuỗi boutique',
      monthlyPrice: 699000,
      yearlyPrice: 6990000,
      maxRooms: 50,
      maxProperties: 3,
      maxStaff: 10,
      features: ['Quản lý phòng', 'Thu ngân', 'Báo cáo nâng cao'],
      isPopular: true,
      hasVnPay: true,
      hasAdvancedReports: true,
      isActive: true,
      sortOrder: 2,
      createdAtUtc: '2026-10-01T00:00:00Z'
    },
    {
      id: 'plan-3',
      name: 'Gói Doanh Nghiệp (Enterprise)',
      code: 'ENTERPRISE',
      description: 'Dành cho chuỗi khách sạn quy mô lớn',
      monthlyPrice: 1599000,
      yearlyPrice: 15990000,
      maxRooms: 200,
      maxProperties: 10,
      maxStaff: 50,
      features: ['Tất cả tính năng cao cấp'],
      isPopular: false,
      hasVnPay: true,
      hasAdvancedReports: true,
      isActive: false,
      sortOrder: 3,
      createdAtUtc: '2026-10-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockPlansService = {
      getAllPlans: vi.fn().mockReturnValue(of(samplePlans)),
      createPlan: vi.fn().mockReturnValue(of(samplePlans[0])),
      updatePlan: vi.fn().mockReturnValue(of(samplePlans[0])),
      toggleActive: vi.fn().mockReturnValue(of({ ...samplePlans[2], isActive: true }))
    };

    mockAlertService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminPlansPage],
      providers: [
        { provide: AdminPlansService, useValue: mockPlansService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPlansPage);
    component = fixture.componentInstance;
  });

  it('should initialize and load subscription plans successfully', () => {
    component.ngOnInit();
    expect(mockPlansService.getAllPlans).toHaveBeenCalled();
    expect(component.plans().length).toBe(3);
    expect(component.isLoading()).toBe(false);
  });

  it('should correctly compute activePlansCount and popularPlanName', () => {
    component.ngOnInit();
    expect(component.activePlansCount()).toBe(2);
    expect(component.popularPlanName()).toBe('Gói Chuyên Nghiệp (Pro)');
  });

  it('should open create modal with clean form defaults', () => {
    component.openCreateModal();
    expect(component.showModal()).toBe(true);
    expect(component.formCode).toBe('');
    expect(component.formMonthlyPrice).toBe(299000);
    expect(component.formIsActive).toBe(true);
  });

  it('should validate form and show error if name or code is missing', () => {
    component.openCreateModal();
    component.formName = '';
    component.formCode = '';
    component.savePlan();
    expect(mockAlertService.error).toHaveBeenCalledWith('Vui lòng nhập tên gói dịch vụ');
    expect(mockPlansService.createPlan).not.toHaveBeenCalled();

    component.formName = 'Gói Mới';
    component.formCode = '';
    component.savePlan();
    expect(mockAlertService.error).toHaveBeenCalledWith('Vui lòng nhập mã gói');
  });

  it('should call createPlan and reload plans when form is valid', () => {
    component.openCreateModal();
    component.formName = 'Gói Mới';
    component.formCode = 'NEW_PLAN';
    component.formMonthlyPrice = 500000;
    component.formYearlyPrice = 5000000;
    component.formMaxRooms = 20;
    component.formMaxProperties = 2;
    component.formMaxStaff = 5;

    component.savePlan();
    expect(mockPlansService.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Gói Mới',
        code: 'NEW_PLAN',
        monthlyPrice: 500000
      })
    );
    expect(mockAlertService.success).toHaveBeenCalledWith('Đã tạo mới gói dịch vụ thành công!');
    expect(component.showModal()).toBe(false);
  });

  it('should toggle active status and update state', () => {
    component.ngOnInit();
    const inactivePlan = samplePlans[2];
    component.toggleActive(inactivePlan);
    expect(mockPlansService.toggleActive).toHaveBeenCalledWith(inactivePlan.id);
    expect(mockAlertService.success).toHaveBeenCalled();
  });
});
