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
  let mockPrintService: { getVoucher: ReturnType<typeof vi.fn> };

  const sampleVoucher: PrintVoucherDto = {
    confirmationCode: 'BOOK-98765',
    createdAtUtc: '2026-10-16T08:00:00Z',
    propertyName: 'Đà Lạt Pine Resort',
    propertyAddress: '12 Hoàng Hoa Thám, Đà Lạt',
    propertyPhone: '02633 123 456',
    propertyEmail: 'contact@dalatpine.vn',
    guestName: 'Nguyễn Văn Du Khách',
    guestEmail: 'guest@example.vn',
    guestPhone: '0988776655',
    roomTypeName: 'Deluxe Double Pine View',
    roomNumber: '204',
    rentalType: 'Daily',
    checkInDate: '2026-10-17',
    checkInTime: '14:00',
    checkOutDate: '2026-10-19',
    checkOutTime: '12:00',
    numberOfGuests: 2,
    totalAmount: 2400000,
    status: 'Confirmed',
    bedType: '1 Giường King',
    squareMeters: 32,
    policyNote: 'Nhận phòng lúc 14:00, trả phòng 12:00',
    footerNote: 'Cảm ơn Quý khách đã đặt phòng!',
    specialRequests: 'Khách yêu cầu phòng tầng cao yên tĩnh',
    qrCodeData: 'HOTEL-CHECKIN:BOOK-98765:Nguyễn Văn Du Khách'
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
    expect(component.isImageUrl(sampleVoucher.qrCodeData)).toBe(false);
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
