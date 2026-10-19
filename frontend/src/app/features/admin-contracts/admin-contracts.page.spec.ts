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
import { AdminContractsPage } from './admin-contracts.page';
import { AdminContractsService } from '../../core/services/admin-contracts.service';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { AlertService } from '../../core/services/alert.service';
import { Router } from '@angular/router';
import { TenantContractDto } from '../../core/models/admin-contract.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('AdminContractsPage — Platform Contracts Management Tests', () => {
  let fixture: ComponentFixture<AdminContractsPage>;
  let component: AdminContractsPage;
  let mockContractsService: any;
  let mockPlansService: any;
  let mockAlertService: any;
  let mockRouter: any;

  const sampleContracts: TenantContractDto[] = [
    {
      id: 'contract-1',
      contractNumber: 'HD-2026-0001',
      tenantId: 'tenant-dalat-1',
      tenantName: 'Đà Lạt Pine Resort',
      planCode: 'PRO',
      planName: 'Gói Chuyên Nghiệp (Pro)',
      contractType: 'Standard',
      status: 'Active',
      representativeName: 'Nguyễn Văn Quản Lý',
      representativeEmail: 'manager@dalatpine.vn',
      representativePhone: '0901234567',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      billingCycle: 'Quarterly',
      contractValue: 6990000,
      slaCommitment: '99.9% High Availability SLA',
      digitalSignatureHash: 'SHA256:abcd1234efgh5678',
      signedAtUtc: '2026-01-01T08:00:00Z',
      createdAtUtc: '2026-01-01T00:00:00Z'
    },
    {
      id: 'contract-2',
      contractNumber: 'HD-2026-0002',
      tenantId: 'tenant-saigon-2',
      tenantName: 'Sài Gòn Riverside Tower',
      planCode: 'ENTERPRISE',
      planName: 'Gói Doanh Nghiệp (Enterprise)',
      contractType: 'Standard',
      status: 'PendingSignature',
      representativeName: 'Trần Thị Giám Đốc',
      representativeEmail: 'director@saigonriverside.vn',
      representativePhone: '0912345678',
      startDate: '2026-02-01',
      endDate: '2027-02-01',
      billingCycle: 'Quarterly',
      contractValue: 15990000,
      slaCommitment: '99.9% High Availability SLA',
      createdAtUtc: '2026-02-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockContractsService = {
      getAllContracts: vi.fn().mockReturnValue(of(sampleContracts)),
      createContract: vi.fn().mockReturnValue(of(sampleContracts[0])),
      updateContractStatus: vi.fn().mockImplementation((id, req) =>
        of({ ...sampleContracts[0], id, status: req.status, digitalSignatureHash: req.digitalSignatureHash })
      )
    };

    mockPlansService = {
      getAllPlans: vi.fn().mockReturnValue(of([
        { id: 'plan-pro-id', code: 'PRO', name: 'Gói Chuyên Nghiệp (Pro)', yearlyPrice: 6990000 },
        { id: 'plan-ent-id', code: 'ENTERPRISE', name: 'Gói Doanh Nghiệp (Enterprise)', yearlyPrice: 15990000 }
      ]))
    };

    mockAlertService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminContractsPage],
      providers: [
        { provide: AdminContractsService, useValue: mockContractsService },
        { provide: AdminPlansService, useValue: mockPlansService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminContractsPage);
    component = fixture.componentInstance;
  });

  it('should initialize and load contracts & plans', () => {
    component.ngOnInit();
    expect(mockContractsService.getAllContracts).toHaveBeenCalled();
    expect(mockPlansService.getAllPlans).toHaveBeenCalled();
    expect(component.contracts().length).toBe(2);
    expect(component.isLoading()).toBe(false);
  });

  it('should compute summary statistics correctly', () => {
    component.ngOnInit();
    expect(component.activeCount()).toBe(1);
    expect(component.pendingCount()).toBe(1);
    expect(component.totalValue()).toBe(6990000);
  });

  it('should filter contracts by keyword and status', () => {
    component.ngOnInit();

    // Filter by keyword
    component.searchKeyword.set('Đà Lạt');
    expect(component.filteredContracts().length).toBe(1);
    expect(component.filteredContracts()[0].contractNumber).toBe('HD-2026-0001');

    // Filter by status
    component.searchKeyword.set('');
    component.statusFilter.set('PendingSignature');
    expect(component.filteredContracts().length).toBe(1);
    expect(component.filteredContracts()[0].contractNumber).toBe('HD-2026-0002');
  });

  it('should sign and activate a contract electronically', () => {
    component.ngOnInit();
    const pendingContract = sampleContracts[1];
    component.signContract(pendingContract);

    expect(mockContractsService.updateContractStatus).toHaveBeenCalledWith(
      pendingContract.id,
      expect.objectContaining({ status: 'Active' })
    );
    expect(mockAlertService.success).toHaveBeenCalled();
  });

  it('should validate tenantId before submitting create contract', () => {
    component.openCreateModal();
    component.newTenantId = '';
    component.submitCreateContract();

    expect(mockAlertService.error).toHaveBeenCalledWith('Vui lòng nhập TenantId');
    expect(mockContractsService.createContract).not.toHaveBeenCalled();
  });
});
