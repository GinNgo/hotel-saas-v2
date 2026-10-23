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
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBookingA))
    };

    mockAlertService = {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      toastWarning: vi.fn(),
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

  // 10. Chỉ hiển thị Smart Lock PIN khi có dữ liệu thật từ Backend (không bịa fake PIN)
  it('10. should only display Smart Lock PIN when backend provides valid pin, and not render fake PIN', () => {
    // Đơn A không có Smart Lock PIN
    component.booking.set(sampleBookingA);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('886912'); // Không hiển thị mã PIN giả
    expect(compiled.textContent).not.toContain('Chạm NFC'); // Không có nút giả lập NFC

    // Đơn B có Smart Lock PIN
    component.booking.set(sampleBookingB);
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

  // 14. FIX 01: Khi Confirmed, hiển thị mã đối chiếu văn bản, KHÔNG tự bịa mã QR Fast Check-in
  it('14. should display confirmation code as reference text on Confirmed status without fake QR Fast Check-in box', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
    component.fetchBooking('tok-token-bbb');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Đặt phòng đã xác nhận');
    expect(compiled.textContent).toContain('Xuất trình Mã đặt phòng tại quầy Lễ tân');
    expect(compiled.textContent).toContain('Mã đối chiếu nhận phòng');
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
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const financialCard = compiled.querySelector('.bg-white.rounded-2xl.border.border-slate-200.p-5');
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

    // Kiểm tra class print:hidden trên smart lock PIN block khi Confirmed có PIN
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
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

    // 32. VNPay: Khóa an toàn khi chưa đủ điều kiện gate, không phát request thanh toán
    it('32. should display VNPay online payment as unavailable and not emit payment request', () => {
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
      component.fetchBooking('tok-token-aaa');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Thanh toán trực tuyến (VNPay Sandbox)');
      expect(compiled.textContent).toContain('Chưa khả dụng');

      const vnpayBtn = compiled.querySelector('button[disabled]') as HTMLButtonElement;
      expect(vnpayBtn).not.toBeNull();

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
      mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingB));
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
  });
});

