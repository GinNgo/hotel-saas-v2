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
import { ActivatedRoute } from '@angular/router';
import { PrintContractPage } from './print-contract.page';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintContractDto } from '../../core/models/print-document.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('PrintContractPage — Tenant Legal Agreement Print Layout Tests', () => {
  let fixture: ComponentFixture<PrintContractPage>;
  let component: PrintContractPage;
  let mockPrintService: any;

  const sampleContract: PrintContractDto = {
    contractId: 'ct-999',
    contractNumber: 'HD-2026-0001',
    providerName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ HOTEL SAAS VIỆT NAM',
    providerAddress: 'Tầng 18, Bitexco Financial Tower, Quận 1, TP. Hồ Chí Minh',
    providerTaxCode: '0316888999',
    providerRepresentative: 'Tổng Giám Đốc Hệ Thống',
    providerHotline: '1900 8888',
    tenantName: 'Đà Lạt Pine Resort & Spa',
    tenantCode: 'DALAT-PINE',
    tenantAddress: '12 Đường Hoàng Hoa Thám, Phường 10, TP. Đà Lạt, Tỉnh Lâm Đồng',
    tenantTaxCode: '0315894321',
    representativeName: 'Nguyễn Văn Quản Lý',
    representativePhone: '0901234567',
    representativeEmail: 'manager@dalatpine.vn',
    planCode: 'PRO',
    planName: 'Gói Chuyên Nghiệp (Pro)',
    contractType: 'Standard',
    startDate: '01/01/2026',
    endDate: '01/01/2027',
    billingCycle: 'Thanh toán Hàng năm (Annual)',
    contractValue: 6990000,
    status: 'Active',
    signedAtUtc: '2026-01-01T08:30:00Z',
    digitalSignatureHash: 'SHA256:abcd1234efgh5678ijkl9012mnop3456',
    termsAndConditions: 'Bên B cam kết tuân thủ chính sách bảo mật dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP.',
    createdAt: '2026-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    mockPrintService = {
      getContract: vi.fn().mockReturnValue(of(sampleContract))
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrintContractPage],
      providers: [
        { provide: PrintDocumentsService, useValue: mockPrintService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('ct-999')
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrintContractPage);
    component = fixture.componentInstance;
  });

  it('should initialize and load contract data by route param ID', () => {
    component.ngOnInit();
    expect(mockPrintService.getContract).toHaveBeenCalledWith('ct-999');
    expect(component.contract()).toEqual(sampleContract);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle contract load error gracefully', () => {
    mockPrintService.getContract.mockReturnValue(throwError(() => new Error('Not found')));
    component.ngOnInit();
    expect(component.contract()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('should call window.print when windowPrint is triggered', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.windowPrint();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
