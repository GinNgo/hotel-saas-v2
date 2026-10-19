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
import { PrintVoucherPage } from './print-voucher.page';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintVoucherDto } from '../../core/models/print-document.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('PrintVoucherPage — Guest Booking Confirmation Voucher Print Layout Tests', () => {
  let fixture: ComponentFixture<PrintVoucherPage>;
  let component: PrintVoucherPage;
  let mockPrintService: any;

  const sampleVoucher: PrintVoucherDto = {
    hotelInfo: {
      headerCompanyName: 'Đà Lạt Pine Resort',
      headerAddress: '12 Hoàng Hoa Thám, Đà Lạt',
      taxNumber: '0315894321',
      hotline: '1900 8888',
      bankName: 'MBBank',
      bankAccountNumber: '0909123456',
      bankAccountHolder: 'NGUYEN VAN QUAN LY',
      footerNote: 'Cảm ơn Quý khách đã đặt phòng!',
      checkInPolicyText: 'Nhận phòng lúc 14:00, trả phòng 12:00',
      showVietQrCode: true,
      defaultPaperSize: 'A5'
    },
    confirmationCode: 'BOOK-98765',
    guestName: 'Nguyễn Văn Du Khách',
    guestPhone: '0988776655',
    guestEmail: 'guest@example.vn',
    propertyName: 'Đà Lạt Pine Resort',
    propertyAddress: '12 Hoàng Hoa Thám, Đà Lạt',
    propertyPhone: '02633 123 456',
    roomTypeName: 'Deluxe Double Pine View',
    roomCount: 1,
    checkInDate: '17/10/2026 14:00',
    checkOutDate: '19/10/2026 12:00',
    rentalType: 'Daily',
    guestCount: 2,
    totalAmount: 2400000,
    holdStatus: 'Đã xác nhận (Confirmed)',
    qrCodeUrl: 'https://img.vietqr.io/image/970422-0909123456-compact2.png',
    specialRequests: 'Khách yêu cầu phòng tầng cao yên tĩnh'
  };

  beforeEach(async () => {
    mockPrintService = {
      getVoucher: vi.fn().mockReturnValue(of(sampleVoucher))
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrintVoucherPage],
      providers: [
        { provide: PrintDocumentsService, useValue: mockPrintService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('tok-sample-123')
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrintVoucherPage);
    component = fixture.componentInstance;
  });

  it('should initialize and load voucher data by route param token', () => {
    component.ngOnInit();
    expect(mockPrintService.getVoucher).toHaveBeenCalledWith('tok-sample-123');
    expect(component.voucher()).toEqual(sampleVoucher);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle voucher load error gracefully', () => {
    mockPrintService.getVoucher.mockReturnValue(throwError(() => new Error('Not found')));
    component.ngOnInit();
    expect(component.voucher()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('should call window.print when windowPrint is triggered', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.windowPrint();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
