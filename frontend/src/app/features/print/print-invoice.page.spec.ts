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
import { PrintInvoiceDto } from '../../core/models/print-document.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('PrintInvoicePage — Electronic Invoice & VietQR Print Layout Tests', () => {
  let fixture: ComponentFixture<PrintInvoicePage>;
  let component: PrintInvoicePage;
  let mockPrintService: any;

  const sampleInvoice: PrintInvoiceDto = {
    hotelInfo: {
      headerCompanyName: 'TẬP ĐOÀN KHÁCH SẠN SAAS PINE',
      headerAddress: '12 Đường Hoàng Hoa Thám, Phường 10, TP. Đà Lạt',
      taxNumber: '0315894321',
      hotline: '1900 8888',
      bankName: 'MBBank',
      bankAccountNumber: '0909123456',
      bankAccountHolder: 'NGUYEN VAN QUAN LY',
      footerNote: 'Cảm ơn Quý khách đã nghỉ dưỡng tại Đà Lạt Pine Resort!',
      checkInPolicyText: 'Nhận phòng từ 14:00, trả phòng trước 12:00',
      showVietQrCode: true,
      defaultPaperSize: 'A4'
    },
    reservationId: 'res-12345',
    invoiceNumber: 'INV-20261017-001',
    issuedDate: '17/10/2026',
    propertyName: 'Đà Lạt Pine Resort & Spa',
    guestName: 'Nguyễn Văn Du Khách',
    guestPhone: '0988776655',
    roomNumber: '102 - Biệt thự thông reo',
    roomTypeName: 'Deluxe Pine View',
    rentalType: 'Daily',
    checkInActual: '17/10/2026 14:00',
    checkOutActual: '19/10/2026 12:00',
    roomRate: 1200000,
    durationText: '2 ngày',
    roomTotal: 2400000,
    surchargeTotal: 0,
    serviceTotal: 300000,
    discountTotal: 100000,
    loyaltyPointsUsed: 0,
    loyaltyDiscountAmount: 0,
    subTotal: 2700000,
    vatRate: 8,
    vatAmount: 216000,
    grandTotal: 2816000,
    paidAmount: 2816000,
    balanceDue: 0,
    paymentMethod: 'Chuyển khoản VietQR',
    vietQrUrl: 'https://img.vietqr.io/image/970422-0909123456-compact2.png',
    lineItems: [
      {
        name: 'Tiền phòng 2 đêm',
        quantity: 2,
        unitPrice: 1200000,
        total: 2400000
      },
      {
        name: 'Phí dịch vụ BBQ sân vườn',
        quantity: 1,
        unitPrice: 300000,
        total: 300000
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
});
