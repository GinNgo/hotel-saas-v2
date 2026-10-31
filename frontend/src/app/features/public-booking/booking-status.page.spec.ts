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
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatusPage } from './booking-status.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('BookingStatusPage (T02 — Theo dõi trạng thái đặt phòng không lẫn đơn)', () => {
  let fixture: ComponentFixture<BookingStatusPage>;
  let component: BookingStatusPage;
  let mockBookingService: any;
  let mockAlertService: any;

  const sampleBookingA: GuestBookingDetailDto = {
    reservationId: 'res-111-aaa',
    confirmationCode: 'RES-A111',
    lookupToken: 'tok-token-aaa',
    propertyId: 'prop-dalat-1',
    propertyName: 'Khách sạn LuxeStay Đà Lạt',
    propertyAddress: '12 Hoàng Hoa Thám, TP. Đà Lạt',
    roomTypeName: 'Phòng Deluxe Hướng Núi',
    rentalType: 'Daily',
    startAtUtc: '2099-10-20T07:00:00Z',
    endAtUtc: '2099-10-22T05:00:00Z',
    checkInDate: '2099-10-20',
    checkOutDate: '2099-10-22',
    numberOfGuests: 2,
    totalAmount: 1500000,
    depositRequired: 450000,
    paidAmount: 0,
    remainingBalance: 1500000,
    isFullyPaid: false,
    status: 'PendingPayment',
    maskedGuestName: 'Ng*** H***',
    maskedGuestEmail: 'h***@example.com',
    maskedGuestPhone: '090****567',
    holdExpiresAtUtc: '2099-10-20T07:15:00Z',
    secondsRemaining: 900,
    createdAtUtc: '2099-10-20T07:00:00Z',
    breakdown: []
  };

  const sampleBookingB: GuestBookingDetailDto = {
    reservationId: 'res-222-bbb',
    confirmationCode: 'RES-B222',
    lookupToken: 'tok-token-bbb',
    propertyId: 'prop-saigon-1',
    propertyName: 'LuxeStay Suites Sài Gòn',
    propertyAddress: '88 Nguyễn Huệ, Quận 1',
    roomTypeName: 'Phòng Suite Executive',
    rentalType: 'Hourly',
    startAtUtc: '2099-11-01T03:00:00Z',
    endAtUtc: '2099-11-01T07:00:00Z',
    numberOfGuests: 1,
    totalAmount: 600000,
    depositRequired: 0,
    paidAmount: 600000,
    remainingBalance: 0,
    isFullyPaid: true,
    status: 'Confirmed',
    maskedGuestName: 'Tr*** A***',
    maskedGuestEmail: 'a***@example.com',
    smartLockPin: '123456',
    smartLockStatus: 'Active',
    createdAtUtc: '2099-11-01T02:00:00Z',
    breakdown: []
  };

  beforeEach(async () => {
    mockBookingService = {
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBookingA)),
      extendHold: vi.fn(),
      getCancellationPreview: vi.fn(),
      cancelBooking: vi.fn()
    };

    mockAlertService = {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      toastWarning: vi.fn(),
      toastSuccess: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [BookingStatusPage],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'token' ? 'tok-token-aaa' : null) })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingStatusPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // 1. Khởi tạo và tự động tải booking theo route param token
  it('1. should automatically fetch and load booking by route token param on init', () => {
    component.ngOnInit();

    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-token-aaa');
    expect(component.booking()).toEqual(sampleBookingA);
  });

  // 2. Mapping các trạng thái tiếng Việt chuẩn xác
  it('2. should map all backend statuses accurately to Vietnamese labels and badge classes', () => {
    expect(component.getStatusLabel('PendingPayment')).toBe('Chờ thanh toán');
    expect(component.getStatusLabel('Expired')).toBe('Đã hết hạn giữ phòng');
    expect(component.getStatusLabel('Confirmed')).toBe('Đã xác nhận');
    expect(component.getStatusLabel('CheckedIn')).toBe('Đã nhận phòng');
    expect(component.getStatusLabel('CheckedOut')).toBe('Đã trả phòng');
    expect(component.getStatusLabel('Cancelled')).toBe('Đã hủy');
    expect(component.getStatusLabel('OtherStatus')).toBe('Đang cập nhật trạng thái');
    expect(component.getStatusLabel(undefined)).toBe('Đang cập nhật trạng thái');

    expect(component.getStatusBadgeClass('PendingPayment')).toContain('bg-amber-50');
    expect(component.getStatusBadgeClass('Confirmed')).toContain('bg-emerald-50');
    expect(component.getStatusBadgeClass('CheckedIn')).toContain('bg-blue-50');
    expect(component.getStatusBadgeClass('CheckedOut')).toContain('bg-slate-100');
    expect(component.getStatusBadgeClass('Expired')).toContain('bg-rose-50');
    expect(component.getStatusBadgeClass('Cancelled')).toContain('bg-rose-50');
  });

  // 3. Fallback search box: Token rỗng hiển thị inline validation
  it('3. should validate empty token with inline error and not call API in search fallback', () => {
    component.searchToken = '';
    component.onSearch();

    expect(component.tokenError()).toBe('Vui lòng nhập mã tra cứu đặt phòng.');
    expect(mockBookingService.getBookingByToken).not.toHaveBeenCalled();
  });

  // 4. Fallback search box: Token lỗi hiển thị error panel, booking reset thành null
  it('4. should handle token not found gracefully with friendly error and clear booking', () => {
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => ({ status: 404 })));

    component.searchToken = 'tok-not-found';
    component.onSearch();

    expect(component.booking()).toBeNull();
    expect(component.searchError()?.title).toBe('Không tìm thấy thông tin đặt phòng');
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });

  // 5. Ngăn lẫn dữ liệu: A thành công -> B lỗi KHÔNG giữ lại dữ liệu A
  it('5. should clear previous booking A when new fetch B fails (no data leakage)', () => {
    component.booking.set(sampleBookingA);

    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => ({ status: 404 })));
    component.fetchBooking('tok-token-bbb-invalid');

    expect(component.booking()).toBeNull();
    expect(component.searchError()?.title).toBe('Không tìm thấy thông tin đặt phòng');
  });

  // 6. Race condition guard: A gửi trước, B gửi sau, A về muộn KHÔNG đè B
  it('6. should reject stale response from request A and never overwrite fresh request B', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockReturnValue(subjectA);
    component.fetchBooking('tok-token-aaa');

    mockBookingService.getBookingByToken.mockReturnValue(subjectB);
    component.fetchBooking('tok-token-bbb');

    // B về trước
    subjectB.next(sampleBookingB);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');

    // A về trễ
    subjectA.next(sampleBookingA);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');
  });

  // 7. Hiển thị đúng chi tiết thanh toán và nhãn "Tổng còn phải thanh toán"
  it('7. should accurately render financial summary and label "Tổng còn phải thanh toán"', () => {
    component.booking.set(sampleBookingA);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Tổng tiền lưu trú');
    expect(compiled.textContent).toMatch(/1[,.]500[,.]000 ₫/);
    expect(compiled.textContent).toContain('Khoản đặt cọc yêu cầu');
    expect(compiled.textContent).toMatch(/450[,.]000 ₫/);
    expect(compiled.textContent).toContain('Số tiền đã thanh toán');
    expect(compiled.textContent).toContain('0 ₫');
    expect(compiled.textContent).toContain('Tổng còn phải thanh toán');
    expect(compiled.textContent).not.toContain('Còn lại thu tại quầy');
  });

  // 8. Đếm ngược thời gian giữ phòng an toàn không bị âm/NaN
  it('8. should calculate hold countdown safely without negative or NaN values', () => {
    expect(component.formatCountdown(150)).toBe('02:30');
    expect(component.formatCountdown(0)).toBe('00:00');
    expect(component.formatCountdown(-5)).toBe('00:00');
    expect(component.formatCountdown(NaN)).toBe('00:00');

    const futureDate = new Date(Date.now() + 120000).toISOString();
    component.startHoldCountdown(futureDate, 'PendingPayment');
    expect(component.remainingSeconds()).toBeGreaterThan(100);
    expect(component.isHoldExpired()).toBe(false);

    component.startHoldCountdown(futureDate, 'Expired');
    expect(component.remainingSeconds()).toBe(0);
    expect(component.isHoldExpired()).toBe(true);
  });

  // 9. Nút in thay đổi nhãn theo trạng thái đơn
  it('9. should adjust print button label according to booking confirmation status', () => {
    expect(component.getPrintButtonLabel('PendingPayment')).toBe('In thông tin đặt phòng');
    expect(component.getPrintButtonLabel('Expired')).toBe('In thông tin đặt phòng');
    expect(component.getPrintButtonLabel('Cancelled')).toBe('In thông tin đặt phòng');

    expect(component.getPrintButtonLabel('Confirmed')).toBe('In phiếu xác nhận');
    expect(component.getPrintButtonLabel('CheckedIn')).toBe('In phiếu xác nhận');
    expect(component.getPrintButtonLabel('CheckedOut')).toBe('In phiếu xác nhận');
  });

  // 10. Chỉ hiển thị Smart Lock PIN khi đã CheckedIn và Backend cung cấp PIN hợp lệ, Confirmed không hiển thị
  it('10. should only display Smart Lock PIN when CheckedIn with valid backend pin, and not display when Confirmed', () => {
    // Đơn PendingPayment không có Smart Lock PIN
    component.booking.set(sampleBookingA);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('886912'); // Không hiển thị mã PIN giả
    expect(compiled.textContent).not.toContain('Chạm NFC'); // Không có nút giả lập NFC

    // Đơn Confirmed KHÔNG hiển thị PIN (theo V3)
    component.booking.set(sampleBookingB);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('123456');
    expect(compiled.textContent).not.toContain('Sao chép PIN');

    // Đơn CheckedIn hiển thị Smart Lock PIN
    const checkedInBooking = { ...sampleBookingB, status: 'CheckedIn' };
    component.booking.set(checkedInBooking);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('123456');
    expect(compiled.textContent).toContain('Sao chép PIN');
  });

  // 11. Hướng dẫn bước tiếp theo phù hợp từng trạng thái (không trùng lặp với card tài chính)
  it('11. should provide informative Next Steps guidelines matching status', () => {
    expect(component.getNextStepMessage('PendingPayment')).toContain('Đơn đang được giữ tạm thời');
    expect(component.getNextStepMessage('Confirmed')).toContain('Đặt phòng đã được xác nhận');
    expect(component.getNextStepMessage('CheckedIn')).toContain('Bạn đã nhận phòng thành công');
    expect(component.getNextStepMessage('CheckedOut')).toContain('Bạn đã hoàn tất trả phòng');
    expect(component.getNextStepMessage('Expired')).toContain('Thời gian giữ phòng đã kết thúc');
    expect(component.getNextStepMessage('Cancelled')).toContain('Đơn đặt phòng đã được hủy');
  });

  // 12. Dọn dẹp timer và subscriptions khi component bị Destroy
  it('12. should cleanup timers and event listeners on destroy', () => {
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    component.ngOnInit();
    component.startHoldCountdown(new Date(Date.now() + 60000).toISOString(), 'PendingPayment');
    component.ngOnDestroy();

    expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  // 13. FIX 01: Khi PendingPayment, KHÔNG hiển thị Fast Check-in hay QR nhận phòng giả
  it('13. should NOT display Fast Check-in banner or QR code box when status is PendingPayment', () => {
    component.booking.set(sampleBookingA); // PendingPayment
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Thủ tục nhận phòng nhanh (Fast Check-in)');
    expect(compiled.textContent).not.toContain('Mã xác nhận phòng');
    expect(compiled.querySelector('.pi-qrcode')).toBeNull(); // Không có QR code giả

    // Phải hiển thị banner giữ phòng tạm thời
    expect(compiled.textContent).toContain('Đơn giữ phòng tạm thời — Chưa xác nhận');
    expect(compiled.textContent).toContain('Vui lòng hoàn tất đặt cọc để xác nhận đặt phòng');
  });

  // 14. FIX 01 / V3: Khi Confirmed, hiển thị Confirmation Hero với Mã đặt phòng nổi bật, KHÔNG tự bịa mã QR Fast Check-in
  it('14. should display confirmation code prominently in Confirmation Hero on Confirmed status without fake QR Fast Check-in box', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
    component.fetchBooking('tok-token-bbb');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Đặt phòng đã được xác nhận');
    expect(compiled.textContent).toContain('MÃ ĐẶT PHÒNG');
    expect(compiled.textContent).toContain('Vui lòng cung cấp mã này tại quầy lễ tân');
    expect(compiled.textContent).toContain('RES-B222');

    // Không có hộp Fast Check-in QR
    expect(compiled.textContent).not.toContain('Thủ tục nhận phòng nhanh (Fast Check-in)');
    expect(compiled.querySelector('.pi-qrcode')).toBeNull();
  });

  // 15. FIX 01: Khi Expired hoặc Cancelled, ẩn hoàn toàn chức năng nhận phòng
  it('15. should hide check-in actions and display invalidity notices when Expired or Cancelled', () => {
    // Expired
    mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingA, status: 'Expired' }));
    component.fetchBooking('tok-token-expired');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Thời gian giữ phòng đã hết hạn');
    expect(compiled.textContent).not.toContain('Xuất trình Mã đặt phòng tại quầy Lễ tân');
    expect(compiled.querySelector('.pi-qrcode')).toBeNull();

    // Cancelled
    mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingA, status: 'Cancelled' }));
    component.fetchBooking('tok-token-cancelled');
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Đơn đặt phòng đã bị hủy');
    expect(compiled.textContent).not.toContain('Xuất trình Mã đặt phòng tại quầy Lễ tân');
    expect(compiled.querySelector('.pi-qrcode')).toBeNull();
  });

  // 16. FIX 02: Không hiển thị trùng lặp thông báo thanh toán trong card tài chính
  it('16. should not render duplicate PendingPayment instructions inside financial card', () => {
    component.booking.set(sampleBookingA);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const financialCard = compiled.querySelector('.bg-white.rounded-2xl.border.border-slate-200.p-5');
    expect(financialCard).not.toBeNull();
    expect(financialCard?.textContent).not.toContain('Đơn đang chờ thanh toán. Vui lòng thực hiện bước tiếp theo');
    expect(financialCard?.textContent).not.toContain('Chưa tất toán (Thanh toán số tiền còn lại khi làm thủ tục nhận phòng)');
  });

  // 17. FIX 05: Kiểm tra chức năng Chỉ đường an toàn và không rò rỉ thông tin riêng tư
  it('17. should build safe Google Maps search URL from property info and not leak tokens or PINs', () => {
    fixture.detectChanges();
    expect(component.hasValidDirections(component.booking())).toBe(true);

    const url = component.getDirectionsUrl();
    expect(url).toContain('https://www.google.com/maps/search');
    expect(url).toContain(encodeURIComponent('Khách sạn LuxeStay Đà Lạt, 12 Hoàng Hoa Thám, TP. Đà Lạt'));
    expect(url).not.toContain('tok-token-aaa');
    expect(url).not.toContain('res-111-aaa');

    // Thiếu địa chỉ an toàn
    component.booking.set({ ...sampleBookingA, propertyAddress: '', propertyName: '' });
    expect(component.hasValidDirections(component.booking())).toBe(false);
    expect(component.getDirectionsUrl()).toBe('#');
  });

  // 18. FIX 04: "Đặt phòng khác" không phải là nút nổi bật nhất khi PendingPayment
  it('18. should not style "Đặt phòng khác" with dominant primary purple when status is PendingPayment', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const allLinks = Array.from(compiled.querySelectorAll('a'));
    const rebookBtn = allLinks.find(el => el.textContent?.includes('Đặt phòng khác'));
    expect(rebookBtn).toBeTruthy();
    // Khi PendingPayment: nút có class outline nhẹ, không phải bg-indigo-600
    expect(rebookBtn?.className).not.toContain('bg-indigo-600');
    expect(rebookBtn?.className).toContain('bg-white');

    // Khi Expired: nút Đặt phòng khác trở thành nút tím nổi bật
    mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingA, status: 'Expired' }));
    component.fetchBooking('tok-token-expired');
    fixture.detectChanges();
    const expiredLinks = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    const expiredRebookBtn = expiredLinks.find(el => el.textContent?.includes('Đặt phòng khác'));
    expect(expiredRebookBtn?.className).toContain('bg-indigo-600');
  });

  // 19. FIX 07: In ấn an toàn, tiêu đề đúng và ẩn Smart Lock PIN khỏi bản in
  it('19. should distinguish print header title and hide smart lock PIN during printing', () => {
    expect(component.isConfirmedStatus('Confirmed')).toBe(true);
    expect(component.isConfirmedStatus('CheckedIn')).toBe(true);
    expect(component.isConfirmedStatus('PendingPayment')).toBe(false);

    // Kiểm tra class print:hidden trên smart lock PIN block khi CheckedIn có PIN
    mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingB, status: 'CheckedIn' }));
    component.fetchBooking('tok-token-bbb');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const pinContainer = compiled.querySelector('.print\\:hidden.bg-gradient-to-br');
    expect(pinContainer).toBeTruthy();
  });

  // 20. Đổi route param token A -> B trong cùng component: dọn dữ liệu A, tải B, bỏ qua phản hồi A về muộn
  it('20. should handle route param token transition A -> B: clear A data immediately, load B, and ignore late response from A', () => {
    const paramMap$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingStatusPage],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$,
            snapshot: { paramMap: { get: () => null } }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingStatusPage);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockImplementation((tok: string) => {
      if (tok === 'tok-token-aaa') return subjectA;
      if (tok === 'tok-token-bbb') return subjectB;
      return of(sampleBookingA);
    });

    // 1. Chuyển sang token A
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-token-aaa' : null) });
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-token-aaa');
    expect(dynamicComp.isSearching()).toBe(true);
    expect(dynamicComp.booking()).toBeNull();

    // 2. Chuyển tiếp sang token B khi A chưa phản hồi
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-token-bbb' : null) });
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-token-bbb');
    expect(dynamicComp.booking()).toBeNull();

    // 3. Phản hồi A về muộn
    subjectA.next(sampleBookingA);
    // Bỏ qua A, booking vẫn null chờ B
    expect(dynamicComp.booking()).toBeNull();

    // 4. Phản hồi B về
    subjectB.next(sampleBookingB);
    expect(dynamicComp.booking()).toEqual(sampleBookingB);
    expect(dynamicComp.booking()?.lookupToken).toBe('tok-token-bbb');
  });

  // 21. Xóa token khỏi URL khi request A đang chờ: vô hiệu hóa request, xóa dữ liệu và timer, dừng loading
  it('21. should handle token removal from URL: invalidate pending request, clear data, timers, and stop loading', () => {
    const paramMap$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingStatusPage],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$,
            snapshot: { paramMap: { get: () => null } }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingStatusPage);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);

    // Bắt đầu với token A
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-token-aaa' : null) });
    expect(dynamicComp.isSearching()).toBe(true);

    // Xóa token khỏi URL
    paramMap$.next({ get: () => null });
    expect(dynamicComp.searchToken).toBe('');
    expect(dynamicComp.isSearching()).toBe(false);
    expect(dynamicComp.booking()).toBeNull();

    // Phản hồi A về trễ sau khi đã xóa token
    subjectA.next(sampleBookingA);
    expect(dynamicComp.booking()).toBeNull();
    expect(dynamicComp.isSearching()).toBe(false);
  });

  // 22. Reset trạng thái khi người dùng gọi resetToSearch và bỏ qua phản hồi cũ đang chờ
  it('22. should reset status view when user calls resetToSearch and ignore late in-flight response', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);

    component.fetchBooking('tok-token-aaa');
    expect(component.isSearching()).toBe(true);

    // Gọi resetToSearch (khi bấm "Tra cứu mã khác")
    component.resetToSearch();
    expect(component.isSearching()).toBe(false);
    expect(component.booking()).toBeNull();
    expect(component.searchToken).toBe('');

    // Request cũ trả về muộn
    subjectA.next(sampleBookingA);
    expect(component.booking()).toBeNull();
    expect(component.isSearching()).toBe(false);
  });

  // 23. Lỗi trễ từ fetch A không làm hỏng fetch B đang chờ
  it('23. should discard late error from fetch A when fetch B is in progress', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockImplementation((tok: string) => {
      if (tok === 'tok-token-aaa') return subjectA;
      if (tok === 'tok-token-bbb') return subjectB;
      return of(sampleBookingA);
    });

    component.fetchBooking('tok-token-aaa');
    component.fetchBooking('tok-token-bbb');

    // Request A báo lỗi 500 trễ
    subjectA.error({ status: 500 });

    // Không hiển thị lỗi của A
    expect(component.searchError()).toBeNull();
    expect(component.isSearching()).toBe(true);

    // Request B thành công
    subjectB.next(sampleBookingB);
    expect(component.isSearching()).toBe(false);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');
  });

  // --- T03 REGRESSION TESTS: CLIPBOARD, NFC/PIN SAFETY, VNPAY GUARD & PRINT SAFETY ---
  describe('T03 — Safety & Non-Fake-Success Verification in Status Page', () => {
    let originalClipboard: any;

    beforeEach(() => {
      originalClipboard = (navigator as any).clipboard;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
        writable: true
      });
    });

    // 24. Copy PIN: resolve -> thông báo thành công KHÔNG chứa giá trị PIN thô
    it('24. should report success without leaking raw PIN in alert message when copyPin resolves', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyPin('123456');

      expect(writeTextMock).toHaveBeenCalledWith('123456');
      await Promise.resolve();

      expect(mockAlertService.success).toHaveBeenCalledWith('Đã sao chép mã PIN mở cửa.');
      expect(mockAlertService.success).not.toHaveBeenCalledWith(expect.stringContaining('123456'));
    });

    // 25. Copy PIN: reject -> hiển thị cảnh báo không báo thành công giả, không chứa PIN
    it('25. should show warning toast and not report fake success when copyPin rejects', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyPin('123456');

      await Promise.resolve();
      await Promise.resolve();

      expect(mockAlertService.success).not.toHaveBeenCalled();
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Không thể tự động sao chép mã PIN. Vui lòng chọn và sao chép thủ công.');
      expect(mockAlertService.toastWarning).not.toHaveBeenCalledWith(expect.stringContaining('123456'));
    });

    // 26. Copy PIN: clipboard không hỗ trợ -> cảnh báo phù hợp
    it('26. should show fallback warning when navigator.clipboard is unavailable for copyPin', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyPin('123456');

      expect(mockAlertService.success).not.toHaveBeenCalled();
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Trình duyệt không hỗ trợ tự động sao chép. Vui lòng chọn và sao chép thủ công.');
    });

    // 27. Copy Token: resolve -> isCopied true
    it('27. should set isCopied to true when copyToken resolves', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyToken('tok-token-bbb');

      expect(writeTextMock).toHaveBeenCalledWith('tok-token-bbb');
      await Promise.resolve();

      expect(component.isCopied()).toBe(true);
    });

    // 28. Copy Token: reject -> isCopied false, không báo thành công giả
    it('28. should not report fake success when copyToken rejects', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyToken('tok-token-bbb');

      await Promise.resolve();
      await Promise.resolve();

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Không thể tự động sao chép mã tra cứu. Vui lòng chọn và sao chép thủ công.');
      expect(mockAlertService.toastWarning).not.toHaveBeenCalledWith(expect.stringContaining('tok-token-bbb'));
    });

    // 29a. Copy PIN: hai đơn có cùng mã PIN vẫn không nhận callback của nhau (cả resolve và reject)
    it('29a. should isolate copyPin callbacks when switching between two bookings that have identical PINs', async () => {
      let resolveA!: () => void;
      const deferredA = new Promise<void>((resolve) => {
        resolveA = resolve;
      });
      const writeTextMock = vi.fn().mockImplementation((pin: string) => {
        return deferredA;
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      const bookingA = { ...sampleBookingB, lookupToken: 'tok-token-aaa', smartLockPin: '123456' };
      const bookingB = { ...sampleBookingB, lookupToken: 'tok-token-bbb', smartLockPin: '123456' };

      // 1. Đang ở đơn A (PIN 123456), bấm copy PIN
      component.booking.set(bookingA);
      component.copyPin('123456');

      // 2. Chuyển sang đơn B (CŨNG CÓ PIN 123456 NHƯNG KHÁC NGỮ CẢNH ĐƠN)
      component.fetchBooking('tok-token-bbb');
      component.booking.set(bookingB);

      // 3. Promise A resolve muộn -> Không được phát thông báo thành công cho đơn B
      resolveA();
      await deferredA;

      expect(mockAlertService.success).not.toHaveBeenCalled();
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();

      // 4. Kiểm tra trường hợp Promise A reject muộn
      let rejectLate!: (err: any) => void;
      const deferredLate = new Promise<void>((_, rej) => {
        rejectLate = rej;
      });
      writeTextMock.mockReturnValue(deferredLate);

      component.booking.set(bookingA);
      component.copyPin('123456');

      component.fetchBooking('tok-token-bbb');
      component.booking.set(bookingB);

      rejectLate(new Error('late clipboard error'));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
      expect(mockAlertService.success).not.toHaveBeenCalled();
    });

    // 29b. Copy PIN: resetToSearch vô hiệu hóa callback đang chờ
    it('29b. should discard in-flight copyPin callback when resetToSearch is called', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyPin('123456');

      // Reset tra cứu
      component.resetToSearch();
      expect(component.booking()).toBeNull();

      resolvePromise();
      await deferred;

      expect(mockAlertService.success).not.toHaveBeenCalled();
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    // 29c. Copy PIN: hủy component trước khi Promise hoàn tất
    it('29c. should not show toast or update state if destroyed before copyPin finishes', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingB);
      component.copyPin('123456');

      component.ngOnDestroy();

      resolvePromise();
      await deferred;

      expect(mockAlertService.success).not.toHaveBeenCalled();
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    // 29d. Copy Token: bỏ qua phản hồi trễ nếu booking đã đổi (cả resolve và reject)
    it('29d. should discard late copyToken resolve and reject when booking changes', async () => {
      let resolveA!: () => void;
      const deferredA = new Promise<void>((resolve) => {
        resolveA = resolve;
      });
      const writeTextMock = vi.fn().mockImplementation((tok: string) => {
        if (tok === 'tok-token-aaa') return deferredA;
        return Promise.resolve();
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      // Chuyển sang đơn B
      component.booking.set(sampleBookingB);
      resolveA();
      await deferredA;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();

      // Kiểm tra reject muộn
      let rejectLate!: (err: any) => void;
      const deferredLate = new Promise<void>((_, rej) => {
        rejectLate = rej;
      });
      writeTextMock.mockReturnValue(deferredLate);

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      component.booking.set(sampleBookingB);
      rejectLate(new Error('late error'));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    // 29e. Copy Token: resetToSearch vô hiệu hóa callback đang chờ
    it('29e. should discard in-flight copyToken callback when resetToSearch is called', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      component.resetToSearch();
      expect(component.booking()).toBeNull();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    // 29f. Copy Token: hủy component trước khi Promise hoàn tất
    it('29f. should not update signals, show toast or create timers when destroyed before copyToken finishes', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      component.ngOnDestroy();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
      expect((component as any).copyTimeout).toBeUndefined();
    });

    // 29g. Hai thao tác copy liên tiếp hoàn tất ngược thứ tự: lần trước không đè lần sau
    it('29g. should handle out-of-order completion for consecutive copy clicks without overwriting state', async () => {
      let resolveClick1!: () => void;
      const deferred1 = new Promise<void>((resolve) => {
        resolveClick1 = resolve;
      });
      let resolveClick2!: () => void;
      const deferred2 = new Promise<void>((resolve) => {
        resolveClick2 = resolve;
      });

      let callCount = 0;
      const writeTextMock = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? deferred1 : deferred2;
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);

      // Bấm copy token 2 lần
      component.copyToken('tok-token-aaa');
      component.copyToken('tok-token-aaa');

      // Lần 2 hoàn tất trước
      resolveClick2();
      await deferred2;
      expect(component.isCopied()).toBe(true);

      // Lần 1 hoàn tất sau
      resolveClick1();
      await deferred1;
      expect(component.isCopied()).toBe(true);
    });

    // 29h. Dọn timer khi đổi đơn hoặc rời trang
    it('29h. should clear copy timer when switching booking or destroying component', () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      component.ngOnDestroy();
      expect((component as any).copyTimeout).toBeUndefined();
    });

    // 30. Loại bỏ PIN giả / NFC giả lập
    it('30. should not render fallback PIN (e.g. 886912) or NFC simulation button', () => {
      // Đơn Confirmed nhưng không có smartLockPin từ server
      mockBookingService.getBookingByToken.mockReturnValue(of({
        ...sampleBookingB,
        smartLockPin: undefined,
        smartLockStatus: undefined
      }));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('886912');
      expect(compiled.textContent).not.toContain('Chạm NFC');
      expect(compiled.querySelector('.pi-bolt')).toBeNull();
    });

    // 31. Đơn PendingPayment không hiển thị mã PIN mở khóa dù có giá trị
    it('31. should not display smartLockPin when status is PendingPayment', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of({
        ...sampleBookingA,
        smartLockPin: '999888'
      }));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('999888');
      expect(compiled.textContent).not.toContain('Mã Mở Khóa Cửa Điện Tử');
    });

    // 32. Phương thức thanh toán: Hiển thị thông báo trung tính khi chưa khả dụng, không hiển thị nút CTA giả bị vô hiệu hóa
    it('32. should display online payment as unavailable without fake disabled CTA button and not emit payment request', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Thanh toán trực tuyến hiện chưa khả dụng');
      expect(compiled.textContent).toContain('Quý khách vui lòng liên hệ trực tiếp quầy Lễ tân');

      // Không hiển thị nút bấm CTA giả bị vô hiệu hóa chiếm chiều ngang
      const disabledCta = compiled.querySelector('button[disabled]');
      expect(disabledCta).toBeNull();

      component.payWithVnpay();
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Cổng thanh toán VNPay trực tuyến hiện chưa khả dụng')
      );
    });

    // 33. Query string VNPay không tự ý thay đổi trạng thái booking thành đã thanh toán
    it('33. should not mark booking as confirmed or paid based on URL query string', () => {
      const paramMap$ = new Subject<any>();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [BookingStatusPage],
        providers: [
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: paramMap$,
              queryParams: of({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' })
            }
          }
        ]
      });

      const dynamicFixture = TestBed.createComponent(BookingStatusPage);
      const dynamicComp = dynamicFixture.componentInstance;
      dynamicComp.ngOnInit();

      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      paramMap$.next({ get: (k: string) => (k === 'token' ? 'tok-token-aaa' : null) });

      // Trạng thái vẫn là PendingPayment theo server response, query string vnp_ResponseCode=00 bị bỏ qua
      expect(dynamicComp.booking()?.status).toBe('PendingPayment');
      expect(dynamicComp.booking()?.isFullyPaid).toBe(false);
      expect(dynamicComp.booking()?.paidAmount).toBe(0);
      dynamicFixture.destroy();
    });

    // 34. In phiếu xác nhận: Ẩn Smart Lock PIN trên bản in (print:hidden)
    it('34. should have print:hidden on Smart Lock PIN container to prevent PIN leakage on paper', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingB, status: 'CheckedIn' }));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pinContainer = compiled.querySelector('.print\\:hidden.bg-gradient-to-br');
      expect(pinContainer).not.toBeNull();
      expect(pinContainer?.classList.contains('print:hidden')).toBe(true);
    });

    // 35. In phiếu xác nhận: Gọi window.print và phân biệt nhãn in theo trạng thái
    it('35. should differentiate print button label based on confirmation status and trigger print', () => {
      expect(component.getPrintButtonLabel('Confirmed')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('CheckedIn')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('CheckedOut')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('PendingPayment')).toBe('In thông tin đặt phòng');
      expect(component.getPrintButtonLabel('Expired')).toBe('In thông tin đặt phòng');
      expect(component.getPrintButtonLabel('Cancelled')).toBe('In thông tin đặt phòng');

      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      component.printConfirmation();
      expect(printSpy).toHaveBeenCalled();
    });

    // 36. Tiêu đề chứng từ in chuẩn A4 theo từng trạng thái
    it('36. should return accurate print document titles according to booking status', () => {
      expect(component.getPrintDocumentTitle('PendingPayment')).toBe('THÔNG TIN ĐẶT PHÒNG — CHỜ THANH TOÁN');
      expect(component.getPrintDocumentTitle('Confirmed')).toBe('PHIẾU XÁC NHẬN ĐẶT PHÒNG');
      expect(component.getPrintDocumentTitle('CheckedIn')).toBe('THÔNG TIN LƯU TRÚ — ĐÃ NHẬN PHÒNG');
      expect(component.getPrintDocumentTitle('CheckedOut')).toBe('THÔNG TIN LƯU TRÚ — ĐÃ TRẢ PHÒNG');
      expect(component.getPrintDocumentTitle('Expired')).toBe('THÔNG TIN ĐẶT PHÒNG — ĐÃ HẾT HẠN');
      expect(component.getPrintDocumentTitle('Cancelled')).toBe('THÔNG TIN ĐẶT PHÒNG — ĐÃ HỦY');
      expect(component.getPrintDocumentTitle(undefined)).toBe('THÔNG TIN ĐẶT PHÒNG');
    });

    // 37. Ghi chú nghiệp vụ chứng từ in theo từng trạng thái
    it('37. should provide correct print status notes avoiding false validity', () => {
      expect(component.getPrintStatusNote('PendingPayment')).toContain('Đơn đang được giữ phòng tạm thời');
      expect(component.getPrintStatusNote('Confirmed')).toContain('Đơn đặt phòng đã được xác nhận');
      expect(component.getPrintStatusNote('CheckedIn')).toContain('Khách đã hoàn tất thủ tục nhận phòng');
      expect(component.getPrintStatusNote('CheckedOut')).toContain('Khách đã hoàn tất thủ tục trả phòng');
      expect(component.getPrintStatusNote('Expired')).toContain('không còn hiệu lực giữ chỗ');
      expect(component.getPrintStatusNote('Cancelled')).toContain('đã bị hủy');
    });

    // 38. Cấu trúc DOM bản in A4: Có print-sheet, không rò rỉ PIN, không chứa token, ẩn màn hình chính
    it('38. should render dedicated A4 print sheet without leaking PIN or token', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Màn hình chính phải có print:hidden
      const screenArticle = compiled.querySelector('article');
      expect(screenArticle?.classList.contains('print:hidden')).toBe(true);

      // Bản in A4 chuyên biệt
      const printSheet = compiled.querySelector('.print-sheet');
      expect(printSheet).not.toBeNull();
      expect(printSheet?.classList.contains('hidden')).toBe(true);

      // Không chứa PIN thô trong bản in
      expect(printSheet?.textContent).not.toContain('123456');
      // Không chứa lookup token trong bản in
      expect(printSheet?.textContent).not.toContain('tok-token-bbb');
      // Chứa mã đặt phòng và số tiền
      expect(printSheet?.textContent).toContain('RES-B222');
      expect(printSheet?.textContent).toContain('600,000');
    });

    // 39. Định dạng thời hạn giữ phòng tuyệt đối cho PendingPayment trong bản in
    it('39. should format absolute deadline for PendingPayment without countdown MM:SS', () => {
      const deadline = component.formatAbsoluteDeadline('2099-10-20T07:15:00Z');
      expect(deadline).toMatch(/\d{2}:\d{2} ngày \d{2}\/\d{2}\/\d{4}/);
      expect(deadline).not.toContain(':00:');
    });

    // 40. Redesign V2: PendingPayment chỉ hiển thị duy nhất MỘT card Hero và MỘT countdown
    it('40. should render exactly one Booking Status Hero and one countdown timer for PendingPayment', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Header Hero có tiêu đề chuẩn V2
      expect(compiled.textContent).toContain('Phòng của bạn đang được giữ tạm thời');
      expect(compiled.textContent).toContain('Đơn đặt phòng chưa được xác nhận');

      // Chỉ có duy nhất 1 nhãn "Thời gian giữ phòng còn lại"
      const countdownLabels = Array.from(compiled.querySelectorAll('*'))
        .filter(el => el.textContent?.trim() === 'Thời gian giữ phòng còn lại');
      expect(countdownLabels.length).toBe(1);

      // Không còn thanh thông báo "Thời hạn giữ phòng tạm thời" trùng lặp trên cùng
      expect(compiled.textContent).not.toContain('Thời hạn giữ phòng tạm thời');
      // Không còn khối "Bước tiếp theo" trùng lặp trên cùng
      expect(compiled.textContent).not.toContain('Bước tiếp theo');
    });

    // 41. Redesign V2: Tính toán chính xác cọc còn thiếu để xác nhận (getRemainingDeposit)
    it('41. should accurately calculate remaining deposit and highlight it when deposit is not yet met', () => {
      // Đơn A: cọc yêu cầu 450,000, đã trả 0 -> còn thiếu 450,000
      expect(component.getRemainingDeposit(sampleBookingA)).toBe(450000);

      // Đã trả một phần 200,000 -> còn thiếu 250,000
      const partialBooking = { ...sampleBookingA, paidAmount: 200000 };
      expect(component.getRemainingDeposit(partialBooking)).toBe(250000);

      // Đã trả đủ hoặc vượt cọc -> còn thiếu 0
      const fullDepositBooking = { ...sampleBookingA, paidAmount: 450000 };
      expect(component.getRemainingDeposit(fullDepositBooking)).toBe(0);

      expect(component.getRemainingDeposit(null)).toBe(0);

      // Kiểm tra hiển thị trên DOM
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Cọc còn thiếu để xác nhận:');
      expect(compiled.textContent).toContain('450,000 ₫');
    });

    // 42. Redesign V2: Confirmed và CheckedIn KHÔNG hiển thị countdown giữ phòng
    it('42. should NOT display hold countdown timer when status is Confirmed or CheckedIn', () => {
      // Confirmed
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Thời gian giữ phòng còn lại');
      expect(compiled.textContent).not.toContain('MM:SS');

      // CheckedIn
      const checkedInBooking = { ...sampleBookingB, status: 'CheckedIn' };
      mockBookingService.getBookingByToken.mockReturnValue(of(checkedInBooking));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Thời gian giữ phòng còn lại');
      expect(compiled.textContent).not.toContain('MM:SS');
    });

    // 43. Redesign V2: Bố cục 2 cột Desktop (lg:grid-cols-2) cho thông tin lưu trú và chi tiết thanh toán
    it('43. should utilize responsive two-column grid on desktop for stay info and payment details', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const gridContainer = compiled.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
      expect(gridContainer).not.toBeNull();
      expect(compiled.textContent).toContain('Thông tin lưu trú');
      expect(compiled.textContent).toContain('Chi tiết thanh toán');
    });

    // 44. Đồng bộ trạng thái: startHoldCountdown dừng ngay khi status không phải PendingPayment
    it('44. should clear timer and reset remaining seconds when status is not PendingPayment', () => {
      component.startHoldCountdown('2099-10-20T07:15:00Z', 'Confirmed');
      expect(component.remainingSeconds()).toBe(0);
      expect(component.isHoldExpired()).toBe(false);

      component.startHoldCountdown('2099-10-20T07:15:00Z', 'CheckedIn');
      expect(component.remainingSeconds()).toBe(0);
      expect(component.isHoldExpired()).toBe(false);

      component.startHoldCountdown('2099-10-20T07:15:00Z', 'Expired');
      expect(component.remainingSeconds()).toBe(0);
      expect(component.isHoldExpired()).toBe(true);
    });

    // 45. Đồng bộ trạng thái: Khi fetchBooking trả về Confirmed, dừng countdown và polling
    it('45. should clear countdown and not poll when fetched booking is Confirmed', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('RES-FVC9ZK');
      fixture.detectChanges();

      expect(component.booking()?.status).toBe('Confirmed');
      expect(component.remainingSeconds()).toBe(0);
      expect(component.isHoldExpired()).toBe(false);
      expect((component as any).pollingInterval).toBeUndefined();
    });

    // 46. V3 Redesign: Confirmed renders modern Confirmation Hero with big checkmark, stay badges, and prominent confirmation code box
    it('46. should render V3 Confirmation Hero with checkmark, stay info badges, and prominent code box on Confirmed', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Đặt phòng đã được xác nhận');
      expect(compiled.textContent).toContain('Vui lòng xuất trình mã đặt phòng và giấy tờ tùy thân tại quầy lễ tân để làm thủ tục nhận phòng.');
      expect(compiled.textContent).toContain('MÃ ĐẶT PHÒNG');
      expect(compiled.textContent).toContain(sampleBookingB.confirmationCode);
      expect(compiled.textContent).toContain('Vui lòng cung cấp mã này tại quầy lễ tân');

      // Stay summary badges
      expect(compiled.textContent).toContain('Nhận phòng');
      expect(compiled.textContent).toContain('Trả phòng');
      expect(compiled.textContent).toContain('Số lượng khách');
    });

    // 47. V3 Redesign: Confirmation code is dynamically rendered from backend DTO, not hardcoded
    it('47. should dynamically render confirmation code from backend DTO without hardcoding', () => {
      const dynamicBooking = { ...sampleBookingB, confirmationCode: 'RES-CUSTOM-999' };
      mockBookingService.getBookingByToken.mockReturnValue(of(dynamicBooking));
      component.fetchBooking('tok-custom');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('RES-CUSTOM-999');
      expect(compiled.textContent).not.toContain('RES-4M3SQB');
    });

    // 48. V3 Redesign: copyConfirmationCode copies confirmation code (not lookupToken) and updates isCodeCopied
    it('48. should copy confirmation code and set isCodeCopied to true when copyConfirmationCode succeeds', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      component.copyConfirmationCode(sampleBookingB.confirmationCode);
      expect(writeTextMock).toHaveBeenCalledWith(sampleBookingB.confirmationCode);
      expect(writeTextMock).not.toHaveBeenCalledWith(sampleBookingB.lookupToken);

      await Promise.resolve();
      expect(component.isCodeCopied()).toBe(true);
      expect(mockAlertService.success).toHaveBeenCalledWith('Mã đặt phòng đã được sao chép.', 'Sao chép thành công');
    });

    // 49. V3 Redesign: copyConfirmationCode handles clipboard failure safely without leaking sensitive data
    it('49. should handle clipboard failure safely in copyConfirmationCode', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();

      component.copyConfirmationCode(sampleBookingB.confirmationCode);
      await Promise.resolve();
      await Promise.resolve();

      expect(component.isCodeCopied()).toBe(false);
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Không thể tự động sao chép mã đặt phòng. Vui lòng chọn và sao chép thủ công.');
    });

    // 50. V3 Redesign: Stepper rendering for Confirmed (Step 1 complete, Steps 2 & 3 pending)
    it('50. should display Stepper with Step 1 complete and Steps 2/3 pending for Confirmed status', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('RES-FVC9ZK');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Đã xác nhận');
      expect(compiled.textContent).toContain('Đặt phòng thành công');
      expect(compiled.textContent).toContain('Nhận phòng');
      expect(compiled.textContent).toContain('Làm thủ tục tại lễ tân');
      expect(compiled.textContent).toContain('Đang lưu trú');
      expect(compiled.textContent).toContain('Sử dụng phòng');

      const stepper = compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]');
      expect(stepper).not.toBeNull();
    });

    // 51. V3 Redesign: Stepper rendering for CheckedIn (Steps 1 & 2 complete, Step 3 active)
    it('51. should display Stepper with Step 1 & 2 complete and Step 3 active for CheckedIn status', () => {
      const checkedInBooking = { ...sampleBookingB, status: 'CheckedIn' };
      mockBookingService.getBookingByToken.mockReturnValue(of(checkedInBooking));
      component.fetchBooking('tok-checkedin');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const stepper = compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]');
      expect(stepper).not.toBeNull();
      expect(compiled.textContent).toContain('Đã nhận phòng');
    });

    // 52. V3 Redesign: Stepper rendering for CheckedOut (Step 3 shows Đã trả phòng / Hoàn tất kỳ lưu trú)
    it('52. should display Stepper with Đã trả phòng / Hoàn tất kỳ lưu trú for CheckedOut status', () => {
      const checkedOutBooking = { ...sampleBookingB, status: 'CheckedOut' };
      mockBookingService.getBookingByToken.mockReturnValue(of(checkedOutBooking));
      component.fetchBooking('tok-checkedout');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const stepper = compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]');
      expect(stepper).not.toBeNull();
      expect(compiled.textContent).toContain('Đã trả phòng');
      expect(compiled.textContent).toContain('Hoàn tất kỳ lưu trú');
      expect(compiled.textContent).not.toContain('Sử dụng phòng');
    });

    // 53. V3 Redesign: Stepper is completely hidden for PendingPayment, Expired, and Cancelled
    it('53. should completely hide Stepper for PendingPayment, Expired, and Cancelled statuses', () => {
      // PendingPayment
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-pending');
      fixture.detectChanges();
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]')).toBeNull();

      // Expired
      mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingA, status: 'Expired' }));
      component.fetchBooking('tok-expired');
      fixture.detectChanges();
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]')).toBeNull();

      // Cancelled
      mockBookingService.getBookingByToken.mockReturnValue(of({ ...sampleBookingA, status: 'Cancelled' }));
      component.fetchBooking('tok-cancelled');
      fixture.detectChanges();
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('section[aria-label="Tiến trình đặt phòng"]')).toBeNull();
    });

    // 54. V3 Redesign: Smart Lock PIN is completely hidden on Confirmed (no digits, no copy button, no active label)
    it('54. should not display any Smart Lock PIN elements or copy button when status is Confirmed', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-confirmed');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('MÃ PIN SMART LOCK');
      expect(compiled.textContent).not.toContain('123456');
      expect(compiled.textContent).not.toContain('Sao chép PIN');
      expect(compiled.textContent).not.toContain('PIN chưa khả dụng');
    });

    // 55. V3 Redesign: Resetting state resets isCodeCopied
    it('56. should show 3-minute warning and extend hold by +5 minutes once on BookingStatusPage when <= 3 minutes remain', () => {
      const under3MinMs = Date.now() + 120000;
      const under3MinIso = new Date(under3MinMs).toISOString();
      const extendedIso = new Date(under3MinMs + 300000).toISOString();

      mockBookingService.getBookingByToken.mockReturnValue(of({
        ...sampleBookingA,
        holdExpiresAtUtc: under3MinIso,
        secondsRemaining: 120,
        holdExtensionCount: 0,
        status: 'PendingPayment'
      }));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      expect(component.isExpiringSoon()).toBe(true);
      expect(component.canExtendHold()).toBe(true);
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Thời gian giữ phòng sắp hết. Vui lòng hoàn tất đặt phòng để tránh mất phòng.');
      expect(compiled.textContent).toContain('Gia hạn thêm 5 phút');

      mockBookingService.extendHold.mockReturnValue(of({
        ...sampleBookingA,
        holdExpiresAtUtc: extendedIso,
        secondsRemaining: 420,
        holdExtensionCount: 1,
        canExtendHold: false,
        status: 'PendingPayment'
      }));

      component.extendHold();
      fixture.detectChanges();

      expect(mockBookingService.extendHold).toHaveBeenCalledWith('tok-token-aaa');
      expect(component.booking()?.holdExtensionCount).toBe(1);
      expect(component.isHoldExtended()).toBe(true);
      expect(component.canExtendHold()).toBe(false);
      expect(component.remainingSeconds()).toBeGreaterThan(400);

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Đã gia hạn (+5 phút)');
      expect(compiled.textContent).not.toContain('Gia hạn thêm 5 phút');
    });

    it('57. should verify status with backend when countdown reaches 00:00 on BookingStatusPage', () => {
      vi.useFakeTimers();
      const baseNow = new Date('2099-10-20T07:14:58Z').getTime();
      vi.setSystemTime(baseNow);

      const expireIso = '2099-10-20T07:15:00Z';
      component.booking.set({
        ...sampleBookingA,
        holdExpiresAtUtc: expireIso,
        status: 'PendingPayment'
      });
      mockBookingService.getBookingByToken.mockReturnValue(of({
        ...sampleBookingA,
        holdExpiresAtUtc: expireIso,
        status: 'Expired',
        secondsRemaining: 0
      }));

      component.startHoldCountdown(expireIso, 'PendingPayment');
      expect(component.remainingSeconds()).toBe(2);

      vi.advanceTimersByTime(2500);
      fixture.detectChanges();

      expect(component.remainingSeconds()).toBe(0);
      expect(component.isHoldExpired()).toBe(true);
      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-token-aaa');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Thời gian giữ phòng đã hết. Vui lòng tìm và chọn phòng lại.');
      vi.useRealTimers();
    });

    it('55. should reset isCodeCopied signal when resetToSearch is called', () => {
      component.isCodeCopied.set(true);
      expect(component.isCodeCopied()).toBe(true);

      component.resetToSearch();
      expect(component.isCodeCopied()).toBe(false);
    });

  describe('T04-B — Guest Booking Cancellation Workflow & Preview UI', () => {
    const samplePreviewFree: any = {
      reservationId: 'res-111-aaa',
      confirmationCode: 'RES-A111',
      status: 'PendingPayment',
      rentalType: 'Daily',
      startAtUtc: '2099-10-20T07:00:00Z',
      endAtUtc: '2099-10-22T05:00:00Z',
      totalAmount: 1500000,
      paidAmount: 450000,
      depositRequired: 450000,
      cancellationFee: 0,
      refundableAmount: 450000,
      pointsRedeemed: 100,
      pointsRefundable: 100,
      isFreeCancellation: true,
      hoursUntilCheckIn: 72,
      freeCancellationThresholdHours: 24,
      policyDescription: 'Miễn phí hủy trước 24h nhận phòng. Hoàn 100% tiền cọc.',
      canCancel: true
    };

    const samplePreviewWithFee: any = {
      reservationId: 'res-222-bbb',
      confirmationCode: 'RES-B222',
      status: 'Confirmed',
      rentalType: 'Daily',
      startAtUtc: '2099-11-01T07:00:00Z',
      endAtUtc: '2099-11-02T05:00:00Z',
      totalAmount: 2000000,
      paidAmount: 2000000,
      depositRequired: 0,
      cancellationFee: 500000,
      refundableAmount: 1500000,
      pointsRedeemed: 0,
      pointsRefundable: 0,
      isFreeCancellation: false,
      hoursUntilCheckIn: 12,
      freeCancellationThresholdHours: 24,
      policyDescription: 'Hủy phòng muộn (trong vòng 24h). Áp dụng phí hủy 500.000 ₫.',
      canCancel: true
    };

    const samplePreviewIneligible: any = {
      reservationId: 'res-333-ccc',
      confirmationCode: 'RES-C333',
      status: 'Confirmed',
      rentalType: 'Daily',
      startAtUtc: '2099-11-01T07:00:00Z',
      endAtUtc: '2099-11-02T05:00:00Z',
      totalAmount: 1000000,
      paidAmount: 1000000,
      depositRequired: 0,
      cancellationFee: 1000000,
      refundableAmount: 0,
      pointsRedeemed: 0,
      pointsRefundable: 0,
      isFreeCancellation: false,
      hoursUntilCheckIn: 1,
      freeCancellationThresholdHours: 24,
      policyDescription: 'Không hoàn tiền khi hủy quá sát giờ nhận phòng.',
      canCancel: false,
      ineligibilityReason: 'Đã quá thời hạn cho phép hủy trực tuyến theo chính sách của khách sạn.'
    };

    // 1. Nút hủy hiển thị tương ứng theo trạng thái: PendingPayment unpaid là "Hủy giữ phòng", Confirmed là "Yêu cầu hủy đặt phòng"
    it('1. should show cancellation button when booking is PendingPayment (not expired) and Confirmed', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isHoldExpired.set(false);
      fixture.detectChanges();

      expect(component.canRequestCancellation(sampleBookingA)).toBe(true);
      expect(component.isUnpaidHold(sampleBookingA)).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Hủy giữ phòng');

      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();
      expect(component.canRequestCancellation(sampleBookingB)).toBe(true);
      expect(component.isUnpaidHold(sampleBookingB)).toBe(false);
      expect(compiled.textContent).toContain('Yêu cầu hủy đặt phòng');
    });

    // 2. Nút "Yêu cầu hủy đặt phòng" ẩn hoàn toàn khi CheckedIn, CheckedOut, Cancelled, Expired hoặc hold hết hạn
    it('2. should hide cancellation button when booking is CheckedIn, CheckedOut, Cancelled, Expired, or hold expired', () => {
      const nonCancellableStatuses = ['CheckedIn', 'CheckedOut', 'Cancelled', 'Expired'];
      for (const st of nonCancellableStatuses) {
        const b = { ...sampleBookingA, status: st };
        expect(component.canRequestCancellation(b)).toBe(false);
      }

      // Trường hợp PendingPayment nhưng hold đã hết hạn
      const expiredHold = { ...sampleBookingA, status: 'PendingPayment' };
      component.booking.set(expiredHold);
      component.isHoldExpired.set(true);
      expect(component.canRequestCancellation(expiredHold)).toBe(false);
    });

    // 3. Bấm nút hủy mở modal và gọi getCancellationPreview
    it('3. should open cancel modal and fetch cancellation preview when clicked', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      mockBookingService.getCancellationPreview.mockReturnValue(of(samplePreviewFree));

      component.openCancelModal();
      expect(component.isCancelModalOpen()).toBe(true);
      expect(mockBookingService.getCancellationPreview).toHaveBeenCalledWith('tok-token-aaa');
      expect(component.cancelPreview()).toEqual(samplePreviewFree);
    });

    // 4. Hiển thị thông tin xem trước tài chính minh bạch (total, paid, fee, refundable, points)
    it('4. should render financial breakdown in preview modal', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Đối soát tài chính & Hoàn trả');
      expect(compiled.textContent).toContain('Miễn phí hủy phòng');
      expect(compiled.textContent).toContain('1,500,000'); // Tổng tiền
      expect(compiled.textContent).toContain('450,000'); // Đã trả & Tiền hoàn
      expect(compiled.textContent).toContain('100'); // Điểm loyalty
    });

    // 5. Trường hợp có phí hủy: hiển thị đúng phí hủy và khoản hoàn dự kiến
    it('5. should display cancellation fee and adjusted refundable amount when not free cancellation', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewWithFee);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('500,000'); // Phí hủy
      expect(compiled.textContent).toContain('1,500,000'); // Tiền hoàn
      expect(compiled.textContent).toContain('Hủy phòng muộn (trong vòng 24h)');
    });

    // 6. Trường hợp không đủ điều kiện hủy: hiển thị cảnh báo ineligibility và vô hiệu hóa nút xác nhận
    it('6. should display warning and disable confirm button when canCancel is false', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewIneligible);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Không thể thực hiện hủy phòng trực tuyến');
      expect(compiled.textContent).toContain('Đã quá thời hạn cho phép hủy trực tuyến');

      const confirmBtn = compiled.querySelector('button.bg-rose-600') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);
    });

    // 7. Cho phép nhập lý do hủy và thông tin xác thực
    it('7. should capture cancel reason and verification email/phone', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);

      component.cancelReason = 'Chuyến bay bị hoãn';
      component.cancelVerification = '0901234567';

      expect(component.cancelReason).toBe('Chuyến bay bị hoãn');
      expect(component.cancelVerification).toBe('0901234567');
    });

    // 8. Đóng modal khi bấm "Giữ lại đặt phòng" và không gọi API hủy
    it('8. should close modal when dismissed without calling cancelBooking', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);

      component.closeCancelModal();
      expect(component.isCancelModalOpen()).toBe(false);
      expect(mockBookingService.cancelBooking).not.toHaveBeenCalled();
    });

    // 9. Xác nhận hủy thành công cho đơn Confirmed: gọi API, cập nhật booking sang Cancelled, hiển thị thông báo phân biệt hoàn tiền (Section 7)
    it('9. should confirm cancellation successfully and notify pending refund per Decision D23', () => {
      const confirmedBooking: GuestBookingDetailDto = {
        ...sampleBookingA,
        status: 'Confirmed',
        paidAmount: 450000
      };
      mockBookingService.getBookingByToken.mockReturnValue(of(confirmedBooking));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);
      component.cancelReason = 'Thay đổi lịch';
      component.cancelVerification = 'h***@example.com';

      const cancelledResult: GuestBookingDetailDto = {
        ...confirmedBooking,
        status: 'Cancelled',
        cancelledAtUtc: '2099-10-18T10:00:00Z',
        cancellationReason: 'Thay đổi lịch',
        cancellationFee: 0,
        refundableAmount: 450000
      };
      mockBookingService.cancelBooking.mockReturnValue(of(cancelledResult));

      component.confirmCancellation();

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith(
        'tok-token-aaa',
        expect.objectContaining({
          reason: 'Thay đổi lịch',
          verificationEmailOrPhone: 'h***@example.com'
        })
      );
      expect(component.booking()?.status).toBe('Cancelled');
      expect(component.isCancelModalOpen()).toBe(false);
      expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Khoản tiền hoàn dự kiến 450.000 ₫ đã được ghi nhận và đang chờ khách sạn đối soát, xử lý theo phương thức hoàn tiền được xác nhận')
      );
    });

    // 9b. Trường hợp không có tiền hoàn (refundableAmount = 0) cho đơn Confirmed: thông báo đơn giản, không nói chờ chuyển khoản
    it('9b. should notify simple success message when refundableAmount is 0 for Confirmed booking', () => {
      const confirmedBooking: GuestBookingDetailDto = {
        ...sampleBookingA,
        status: 'Confirmed',
        paidAmount: 450000
      };
      mockBookingService.getBookingByToken.mockReturnValue(of(confirmedBooking));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set({ ...samplePreviewFree, refundableAmount: 0 });

      const cancelledNoRefund: GuestBookingDetailDto = {
        ...confirmedBooking,
        status: 'Cancelled',
        cancelledAtUtc: '2099-10-18T10:00:00Z',
        cancellationFee: 450000,
        refundableAmount: 0
      };
      mockBookingService.cancelBooking.mockReturnValue(of(cancelledNoRefund));

      component.confirmCancellation();

      expect(component.booking()?.status).toBe('Cancelled');
      expect(mockAlertService.toastSuccess).toHaveBeenCalledWith('Đặt phòng đã được hủy thành công.');
    });

    // 9c. Trường hợp hủy lượt giữ phòng PendingPayment chưa thanh toán: thông báo hủy giữ phòng
    it('9c. should notify "Lượt giữ phòng đã được hủy thành công." when cancelling unpaid PendingPayment hold', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set({
        ...samplePreviewFree,
        paidAmount: 0,
        cancellationFee: 0,
        refundableAmount: 0,
        isHold: true
      });

      const cancelledHold: GuestBookingDetailDto = {
        ...sampleBookingA,
        status: 'Cancelled',
        cancelledAtUtc: '2099-10-18T10:00:00Z',
        cancellationFee: 0,
        refundableAmount: 0
      };
      mockBookingService.cancelBooking.mockReturnValue(of(cancelledHold));

      component.confirmCancellation();

      expect(component.booking()?.status).toBe('Cancelled');
      expect(mockAlertService.toastSuccess).toHaveBeenCalledWith('Lượt giữ phòng đã được hủy thành công.');
    });

    // 9d. Modal hiển thị tiêu đề và nội dung phân biệt giữa PendingPayment unpaid và Confirmed
    it('9d. should render modal title and banner distinguishing unpaid hold vs confirmed booking', () => {
      // PendingPayment unpaid
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#modal-cancel-title')?.textContent).toContain('Xác nhận hủy giữ phòng');
      expect(compiled.textContent).toContain('Đơn của bạn chưa được xác nhận và chưa phát sinh thanh toán. Bạn có thể hủy lượt giữ phòng này.');

      // Confirmed
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      fixture.detectChanges();
      expect(compiled.querySelector('#modal-cancel-title')?.textContent).toContain('Xác nhận yêu cầu hủy đặt phòng');
    });

    // 9e. Vô hiệu hóa và chặn hủy khi lượt giữ phòng hết hạn trong lúc modal đang mở
    it('9e. should guard against cancelling when hold expires while modal is open', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.clearTimer();
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);
      component.isHoldExpired.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.');

      const confirmBtn = compiled.querySelector('button.bg-rose-600') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);

      component.confirmCancellation();
      expect(component.cancelError()).toBe('Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.');
      expect(mockBookingService.cancelBooking).not.toHaveBeenCalled();
    });

    // 10. Xử lý lỗi khi hủy thất bại (400, 401/403, 409)
    it('10. should handle cancel errors gracefully and show informative Vietnamese messages', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);

      // 400 Bad Request
      mockBookingService.cancelBooking.mockReturnValue(throwError(() => ({
        status: 400,
        error: { message: 'Đơn đặt phòng không hợp lệ để hủy.' }
      })));
      component.confirmCancellation();
      expect(component.isCancelling()).toBe(false);
      expect(component.cancelError()).toBe('Đơn đặt phòng không hợp lệ để hủy.');

      // 403 Forbidden
      mockBookingService.cancelBooking.mockReturnValue(throwError(() => ({ status: 403 })));
      component.confirmCancellation();
      expect(component.cancelError()).toContain('Thông tin xác nhận email hoặc số điện thoại không trùng khớp');

      // 409 Conflict
      mockBookingService.cancelBooking.mockReturnValue(throwError(() => ({ status: 409 })));
      component.confirmCancellation();
      expect(component.cancelError()).toContain('Trạng thái đơn đặt phòng đã thay đổi');
    });

    // 11. Trạng thái Cancelled hiển thị chi tiết thời điểm hủy, lý do, phí hủy và khoản hoàn dự kiến
    it('11. should display cancellation metadata (date, reason, fee, refund) in Cancelled Hero Card', () => {
      const cancelledBooking: GuestBookingDetailDto = {
        ...sampleBookingA,
        status: 'Cancelled',
        cancelledAtUtc: '2099-10-18T10:00:00Z',
        cancellationReason: 'Đổi lịch công tác sang tuần sau',
        cancellationFee: 100000,
        refundableAmount: 350000
      };

      mockBookingService.getBookingByToken.mockReturnValue(of(cancelledBooking));
      component.fetchBooking('tok-token-cancelled');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Đơn đặt phòng đã được hủy trên hệ thống');
      expect(compiled.textContent).toContain('Đổi lịch công tác sang tuần sau');
      expect(compiled.textContent).toContain('100,000 ₫');
      expect(compiled.textContent).toContain('350,000 ₫');
      expect(compiled.textContent).toContain('Chờ đối soát & duyệt hoàn tiền');
      expect(component.canRequestCancellation(cancelledBooking)).toBe(false);
      expect(compiled.querySelector('button[title*="hủy đặt phòng"]')).toBeNull();
      expect(compiled.textContent).toContain('Tìm và đặt phòng khác');
    });

    // 12. Reset trạng thái cancel modal khi resetToSearch
    it('12. should reset cancel modal state when resetToSearch is called', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewFree);
      component.cancelReason = 'Some reason';

      component.resetToSearch();

      expect(component.isCancelModalOpen()).toBe(false);
      expect(component.cancelPreview()).toBeNull();
      expect(component.cancelReason).toBe('');
      expect(component.cancelError()).toBe('');
    });

    // 13. Tải preview lỗi: hiển thị nút thử lại và không cho xác nhận
    it('13. should handle preview load failure with retry button', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      mockBookingService.getCancellationPreview.mockReturnValue(throwError(() => ({
        error: { message: 'Không thể kết nối đến máy chủ.' }
      })));

      component.openCancelModal();
      fixture.detectChanges();

      expect(component.isLoadingCancelPreview()).toBe(false);
      expect(component.cancelPreviewError()).toBe('Không thể kết nối đến máy chủ.');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Không thể tải chính sách hủy');
    });

    // 14. [Ba điểm kiểm tra - Điểm 1]: Hiển thị thời điểm nhận phòng, thời điểm yêu cầu hủy và mốc đối chiếu
    it('14. should format timeline date/time and display check-in, request time and remaining hours in cancel modal', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewWithFee);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Mốc thời gian đối soát');
      expect(compiled.textContent).toContain('Nhận phòng:');
      expect(compiled.textContent).toContain('Yêu cầu hủy:');
      expect(compiled.textContent).toContain('Còn 12 giờ trước nhận phòng — Áp dụng phí hủy 25%.');

      // Helper check
      expect(component.formatTimelineDateTime('2026-10-31T07:00:00Z')).toBe('31/10/2026 — 14:00');
      expect(component.formatTimelineDateTime(null)).toBe('');
    });

    // 15. [Ba điểm kiểm tra - Điểm 2]: Thông báo rõ ràng hủy phòng và hoàn tiền là hai bước riêng biệt
    it('15. should display notice stating cancellation and refund are two separate steps', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewWithFee);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Quy trình hủy phòng & hoàn tiền:');
      expect(compiled.textContent).toContain('Đặt phòng sẽ được hủy sau khi bạn xác nhận.');
      expect(compiled.textContent).toContain('Khoản hoàn dự kiến 1,500,000 ₫ sẽ được khách sạn kiểm tra và xử lý theo quy trình hoàn tiền. Đây chưa phải khoản tiền đã được hoàn.');
    });

    // 16. [Ba điểm kiểm tra - Điểm 3]: Không mặc định hoàn tiền bằng chuyển khoản
    it('16. should state refund processed by confirmed refund method and not default to bank transfer', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewWithFee);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Khoản hoàn dự kiến sẽ được khách sạn đối soát và xử lý theo phương thức hoàn tiền được xác nhận.');
      expect(compiled.textContent).not.toContain('xử lý chuyển khoản');
    });

    // 17. In đậm các cụm thời hạn hủy miễn phí, thời điểm bị tính phí và mức phí phạt
    it('17. should bold free cancellation threshold, fee-incurring time window, and penalty percentage', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
      component.fetchBooking('tok-token-bbb');
      component.isCancelModalOpen.set(true);
      component.cancelPreview.set(samplePreviewWithFee);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // 1. Kiểm tra formatPolicyDescription in đậm các cụm từ
      const policyHtml = component.formatPolicyDescription(
        'Miễn phí hủy phòng trước ngày nhận phòng ít nhất 24 giờ. Hủy phòng trong vòng 24 giờ trước giờ nhận phòng áp dụng phí phạt 30% tổng giá trị đơn đặt phòng.'
      );
      expect(policyHtml).toContain('<strong class="font-bold text-slate-900 underline decoration-blue-400 underline-offset-2">trước ngày nhận phòng ít nhất 24 giờ</strong>');
      expect(policyHtml).toContain('<strong class="font-bold text-slate-900 underline decoration-amber-400 underline-offset-2">trong vòng 24 giờ trước giờ nhận phòng</strong>');
      expect(policyHtml).toContain('phí phạt 30% tổng giá trị đơn đặt phòng</strong>');

      // 2. Kiểm tra timeline HTML in đậm thời điểm và phí phạt
      const timelineHtml = component.getCancellationTimelineFormattedHtml(samplePreviewWithFee);
      expect(timelineHtml).toContain('<strong class="font-bold text-rose-950 underline decoration-rose-300 underline-offset-2">12 giờ trước nhận phòng</strong>');
      expect(timelineHtml).toContain('phí hủy 25%</strong>');

      // 3. Kiểm tra DOM thực tế trong modal chứa thẻ strong cho các thông tin quan trọng này
      const strongs = Array.from(compiled.querySelectorAll('strong')).map(s => s.textContent);
      expect(strongs.some(t => t?.includes('12 giờ trước nhận phòng'))).toBe(true);
      expect(strongs.some(t => t?.includes('phí hủy 25%'))).toBe(true);
      expect(strongs.some(t => t?.includes('1,500,000 ₫'))).toBe(true);
    });
  });
});
});
