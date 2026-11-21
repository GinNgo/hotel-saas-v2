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
import { PrintInvoicePage } from './print-invoice.page';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { TokenStorageService } from '../../core/services/token-storage.service';
import { PrintInvoiceDto } from '../../core/models/print-document.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('PrintInvoicePage — Electronic Invoice & VietQR Print Layout Tests', () => {
  let fixture: ComponentFixture<PrintInvoicePage>;
  let component: PrintInvoicePage;
  let mockPrintService: { getInvoice: ReturnType<typeof vi.fn> };

  const sampleInvoice: PrintInvoiceDto = {
    reservationId: 'res-12345',
    invoiceNumber: 'INV-20261017-001',
    confirmationCode: 'RES-12345',
    issuedDate: '2026-10-17T08:00:00Z',
    headerCompanyName: 'TẬP ĐOÀN KHÁCH SẠN SAAS PINE',
    headerAddress: '12 Đường Hoàng Hoa Thám, Phường 10, TP. Đà Lạt',
    taxNumber: '0315894321',
    hotline: '1900 8888',
    logoUrl: null,
    propertyName: 'Đà Lạt Pine Resort & Spa',
    guestName: 'Nguyễn Văn Du Khách',
    guestEmail: 'guest@example.vn',
    guestPhone: '0988776655',
    roomNumber: '102 - Biệt thự thông reo',
    roomTypeName: 'Deluxe Pine View',
    rentalType: 'Daily',
    checkInDate: '2026-10-17',
    checkOutDate: '2026-10-19',
    numberOfGuests: 2,
    subTotal: 2600000,
    vatRate: 8,
    vatAmount: 216000,
    totalAmount: 2816000,
    paidAmount: 2816000,
    remainingAmount: 0,
    status: 'ĐÃ THANH TOÁN ĐỦ',
    paymentMethod: 'BankTransfer',
    vietQrImageUrl: '',
    showVietQrCode: false,
    bankAccountNumber: '0909123456',
    bankAccountHolder: 'NGUYEN VAN QUAN LY',
    bankName: 'MBBank',
    checkInPolicyText: 'Nhận phòng từ 14:00, trả phòng trước 12:00',
    footerNote: 'Cảm ơn Quý khách đã nghỉ dưỡng tại Đà Lạt Pine Resort!',
    items: [
      {
        description: 'Tiền phòng 2 đêm',
        quantity: 2,
        unitPrice: 1200000,
        amount: 2400000
      },
      {
        description: 'Phí dịch vụ BBQ sân vườn',
        quantity: 1,
        unitPrice: 200000,
        amount: 200000
      }
    ]
  };

  beforeEach(async () => {
    mockPrintService = {
      getInvoice: vi.fn().mockReturnValue(of(sampleInvoice))
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrintInvoicePage],
      providers: [
        { provide: PrintDocumentsService, useValue: mockPrintService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('res-12345')
              },
              queryParamMap: {
                get: vi.fn().mockReturnValue(null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrintInvoicePage);
    component = fixture.componentInstance;
  });

  it('should initialize and load invoice data by route param ID', () => {
    component.ngOnInit();
    expect(mockPrintService.getInvoice).toHaveBeenCalledWith('res-12345');
    expect(component.invoice()).toEqual(sampleInvoice);
    expect(component.isLoading()).toBe(false);
    expect(component.isPaidInFull(sampleInvoice)).toBe(true);
  });

  it('should not mark invoice as paid in full when remainingAmount > 0', () => {
    const unpaidInvoice: PrintInvoiceDto = {
      ...sampleInvoice,
      paidAmount: 1000000,
      remainingAmount: 1816000,
      status: 'CÒN CÔNG NỢ'
    };
    expect(component.isPaidInFull(unpaidInvoice)).toBe(false);
  });

  it('should handle invoice load error gracefully', () => {
    mockPrintService.getInvoice.mockReturnValue(throwError(() => new Error('Not found')));
    component.ngOnInit();
    expect(component.invoice()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('should trigger window.print when windowPrint is called', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.windowPrint();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('should route Back button to /booking/lookup when unauthenticated, /booking/profile for Customer, and /reservations for PMS staff', () => {
    const tokenStorage = TestBed.inject(TokenStorageService);

    vi.spyOn(tokenStorage, 'isTokenExpired').mockReturnValue(true);
    vi.spyOn(tokenStorage, 'getDecodedToken').mockReturnValue(null);
    expect(component.backRoute).toBe('/booking/lookup');

    vi.spyOn(tokenStorage, 'isTokenExpired').mockReturnValue(false);
    vi.spyOn(tokenStorage, 'getDecodedToken').mockReturnValue({
      sub: 'cust-1',
      email: 'guest@example.vn',
      fullName: 'Khách',
      globalRole: 'Customer',
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    expect(component.backRoute).toBe('/booking/profile');

    vi.spyOn(tokenStorage, 'getDecodedToken').mockReturnValue({
      sub: 'staff-1',
      email: 'staff@hotel.vn',
      fullName: 'Lễ tân',
      globalRole: 'TenantStaff',
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    expect(component.backRoute).toBe('/reservations');
  });
});
