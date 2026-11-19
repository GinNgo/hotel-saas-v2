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
  let mockPrintService: { getContract: ReturnType<typeof vi.fn> };

  const sampleContract: PrintContractDto = {
    contractId: 'ct-999',
    contractNumber: 'HD-2026-0001',
    createdAtUtc: '2026-01-01T00:00:00Z',
    signedDate: '2026-01-01T08:30:00Z',
    signedAtUtc: '2026-01-01T08:30:00Z',
    status: 'Active',
    isSigned: true,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    platformCompanyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ NỀN TẢNG KHÁCH SẠN HOTEL SAAS VIỆT NAM',
    platformAddress: 'Tầng 18, Tòa nhà Innovation Hub, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    platformTaxCode: '0318889999',
    platformHotline: '1900 8899',
    platformRepresentative: 'Đại diện Pháp luật Nền tảng Hotel SaaS',
    tenantCompanyName: 'Đà Lạt Pine Resort & Spa',
    tenantCode: 'DALAT-PINE',
    tenantRepresentative: 'Nguyễn Văn Quản Lý',
    tenantEmail: 'manager@dalatpine.vn',
    tenantPhone: '0901234567',
    tenantAddress: '12 Đường Hoàng Hoa Thám, Phường 10, TP. Đà Lạt, Tỉnh Lâm Đồng',
    planCode: 'PRO',
    planName: 'Gói Chuyên Nghiệp (Pro)',
    contractType: 'Standard',
    billingCycle: 'Annual',
    contractValue: 6990000,
    maxPropertiesAllowed: 3,
    maxRoomsAllowed: 50,
    digitalSignatureHash: 'ABCD1234EFGH5678IJKL9012MNOP3456',
    termsAndConditions: 'Bên B cam kết tuân thủ chính sách bảo mật dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP.'
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
    expect(component.isContractSigned(sampleContract)).toBe(true);
  });

  it('should report unsigned contract as not signed when hash or signedAtUtc is missing', () => {
    const unsignedContract: PrintContractDto = {
      ...sampleContract,
      status: 'Draft',
      isSigned: false,
      signedAtUtc: null,
      digitalSignatureHash: ''
    };
    expect(component.isContractSigned(unsignedContract)).toBe(false);
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
