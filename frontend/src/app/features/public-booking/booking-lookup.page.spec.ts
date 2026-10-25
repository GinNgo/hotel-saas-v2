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
import { BookingLookupPageComponent } from './booking-lookup.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('BookingLookupPageComponent (T02 — Tra cứu và trạng thái không lẫn đơn đặt phòng)', () => {
  let fixture: ComponentFixture<BookingLookupPageComponent>;
  let component: BookingLookupPageComponent;
  let mockBookingService: any;
  let mockAlertService: any;

  const sampleBookingA: GuestBookingDetailDto = {
    reservationId: 'res-aaa-111',
    confirmationCode: 'RES-AAA111',
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
    breakdown: [
      { description: 'Tiền phòng 2 đêm', unitPrice: 750000, quantity: 2, amount: 1500000 }
    ]
  };

  const sampleBookingB: GuestBookingDetailDto = {
    reservationId: 'res-bbb-222',
    confirmationCode: 'RES-BBB222',
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
      imports: [BookingLookupPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({})
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingLookupPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // 1. Mapping PendingPayment thành "Chờ thanh toán"
  it('1. should map PendingPayment status to "Chờ thanh toán" and proper badge style', () => {
    expect(component.getStatusLabel('PendingPayment')).toBe('Chờ thanh toán');
    expect(component.getStatusBadgeClass('PendingPayment')).toContain('bg-amber-50');
    expect(component.getStatusIcon('PendingPayment')).toBe('pi-clock');
  });

  // 2. Mapping các trạng thái còn lại trung thực theo backend enum
  it('2. should map all backend statuses accurately to Vietnamese labels and badge styles', () => {
    expect(component.getStatusLabel('Expired')).toBe('Đã hết hạn giữ phòng');
    expect(component.getStatusLabel('Confirmed')).toBe('Đã xác nhận');
    expect(component.getStatusLabel('CheckedIn')).toBe('Đã nhận phòng');
    expect(component.getStatusLabel('CheckedOut')).toBe('Đã trả phòng');
    expect(component.getStatusLabel('Cancelled')).toBe('Đã hủy');
    expect(component.getStatusLabel('UnknownState')).toBe('Đang cập nhật trạng thái');
    expect(component.getStatusLabel(undefined)).toBe('Đang cập nhật trạng thái');

    expect(component.getStatusBadgeClass('Confirmed')).toContain('bg-emerald-50');
    expect(component.getStatusBadgeClass('CheckedIn')).toContain('bg-blue-50');
    expect(component.getStatusBadgeClass('CheckedOut')).toContain('bg-slate-100');
    expect(component.getStatusBadgeClass('Expired')).toContain('bg-rose-50');
    expect(component.getStatusBadgeClass('Cancelled')).toContain('bg-rose-50');
  });

  // 3. Token rỗng: inline validation, không gọi API
  it('3. should validate empty token with inline error and not call getBookingByToken API', () => {
    component.searchToken = '   ';
    component.onSearch();

    expect(mockBookingService.getBookingByToken).not.toHaveBeenCalled();
    expect(component.tokenError()).toBe('Vui lòng nhập mã tra cứu đặt phòng.');
    expect(component.booking()).toBeNull();
    expect(mockAlertService.error).not.toHaveBeenCalled(); // Không dùng Toast
  });

  // 4. Token không tìm thấy (404 / ERR_INVALID_TOKEN): hiển thị panel lỗi inline, xóa dữ liệu cũ
  it('4. should display friendly inline panel error when token is not found and clear booking state', () => {
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => ({ status: 404 })));

    component.searchToken = 'tok-not-found-404';
    component.onSearch();

    expect(component.isLoading()).toBe(false);
    expect(component.booking()).toBeNull();
    expect(component.searchError()?.title).toBe('Không tìm thấy thông tin đặt phòng');
    expect(component.searchError()?.message).toContain('Không tìm thấy đơn đặt phòng với mã tra cứu này');
    expect(mockAlertService.error).not.toHaveBeenCalled(); // Không hiển thị Toast trùng lặp
  });

  // 5. Lỗi mạng và HTTP 500: thông báo thân thiện, không hiển thị stack trace
  it('5. should handle network and HTTP 500 errors gracefully with retry option and no technical leaks', () => {
    // 5a. Lỗi mạng
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => new Error('Failed to fetch')));
    component.searchToken = 'tok-network-fail';
    component.onSearch();

    expect(component.searchError()?.title).toBe('Không thể kết nối máy chủ');
    expect(component.searchError()?.message).toContain('Không thể kết nối đến hệ thống');
    expect(component.searchError()?.isRetryable).toBe(true);

    // 5b. Lỗi HTTP 500
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => ({ status: 500 })));
    component.searchToken = 'tok-server-fail';
    component.onSearch();

    expect(component.searchError()?.title).toBe('Hệ thống tạm thời gián đoạn');
    expect(component.searchError()?.message).toContain('Máy chủ đang gặp sự cố khi xử lý tra cứu');
    expect(component.searchError()?.message).not.toContain('stacktrace');
  });

  // 6. Trường hợp A: A thành công -> nhập B lỗi KHÔNG giữ lại dữ liệu A
  it('6. should clear previous booking A when search B fails or is invalid (no data leakage)', () => {
    // Lần 1: Tra cứu A thành công
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    expect(component.booking()).toEqual(sampleBookingA);

    // Lần 2: Nhập mã B không hợp lệ / lỗi
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => ({ status: 404 })));
    component.searchToken = 'tok-token-bbb-invalid';
    component.onSearch();

    // Dữ liệu A phải bị xóa hoàn toàn, không được tiếp tục hiển thị như kết quả của B
    expect(component.booking()).toBeNull();
    expect(component.searchError()?.title).toBe('Không tìm thấy thông tin đặt phòng');
    // Mã đã nhập vẫn được giữ lại trong input
    expect(component.searchToken).toBe('tok-token-bbb-invalid');
  });

  // 7. Trường hợp B (Race condition): A gửi trước, B gửi sau, A trả về muộn KHÔNG ghi đè B
  it('7. should discard late response from request A and never overwrite fresh request B', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    // Request A
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    // Request B gửi khi A chưa hoàn tất
    mockBookingService.getBookingByToken.mockReturnValue(subjectB);
    component.searchToken = 'tok-token-bbb';
    component.onSearch();

    // Request B trả về trước với dữ liệu booking B
    subjectB.next(sampleBookingB);
    expect(component.booking()).toEqual(sampleBookingB);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');

    // Request A trả về muộn
    subjectA.next(sampleBookingA);

    // Kết quả B phải được giữ nguyên, A không được ghi đè B
    expect(component.booking()).toEqual(sampleBookingB);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');
  });

  // 8. Hiển thị đúng số tiền từ DTO, phân biệt cọc yêu cầu và số tiền đã thanh toán
  it('8. should accurately display financial figures from DTO and label "Tổng còn phải thanh toán"', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Tổng tiền lưu trú
    expect(compiled.textContent).toContain('Tổng tiền lưu trú');
    expect(compiled.textContent).toMatch(/1[,.]500[,.]000 ₫/);

    // Khoản đặt cọc yêu cầu
    expect(compiled.textContent).toContain('Khoản đặt cọc yêu cầu');
    expect(compiled.textContent).toMatch(/450[,.]000 ₫/);

    // Số tiền đã thanh toán
    expect(compiled.textContent).toContain('Số tiền đã thanh toán');
    expect(compiled.textContent).toContain('0 ₫');

    // Nhãn mới: Tổng còn phải thanh toán (thay vì Còn lại thanh toán tại quầy lễ tân)
    expect(compiled.textContent).toContain('Tổng còn phải thanh toán');
    expect(compiled.textContent).not.toContain('Còn lại thanh toán tại quầy lễ tân');
    expect(compiled.textContent).not.toContain('Tiền cọc tối thiểu (30%)'); // Không hardcode 30%
  });

  // 9. Countdown giữ phòng không bị âm/NaN và tính theo deadline chính xác
  it('9. should handle hold countdown safely without negative numbers or NaN', () => {
    expect(component.formatCountdown(125)).toBe('02:05');
    expect(component.formatCountdown(0)).toBe('00:00');
    expect(component.formatCountdown(-10)).toBe('00:00');
    expect(component.formatCountdown(NaN)).toBe('00:00');

    // Deadline trong tương lai
    const futureDate = new Date(Date.now() + 60000).toISOString();
    component.startHoldCountdown(futureDate, 'PendingPayment');
    expect(component.remainingSeconds()).toBeGreaterThan(50);
    expect(component.isHoldExpired()).toBe(false);

    // Status Expired từ server
    component.startHoldCountdown(futureDate, 'Expired');
    expect(component.remainingSeconds()).toBe(0);
    expect(component.isHoldExpired()).toBe(true);
  });

  // 10. Nút in có nhãn phù hợp với trạng thái (In phiếu xác nhận vs In thông tin đặt phòng)
  it('10. should dynamic print button label based on whether booking is confirmed or pending', () => {
    expect(component.getPrintButtonLabel('PendingPayment')).toBe('In thông tin đặt phòng');
    expect(component.getPrintButtonLabel('Expired')).toBe('In thông tin đặt phòng');
    expect(component.getPrintButtonLabel('Cancelled')).toBe('In thông tin đặt phòng');

    expect(component.getPrintButtonLabel('Confirmed')).toBe('In phiếu xác nhận');
    expect(component.getPrintButtonLabel('CheckedIn')).toBe('In phiếu xác nhận');
    expect(component.getPrintButtonLabel('CheckedOut')).toBe('In phiếu xác nhận');
  });

  // 11. Hướng dẫn bước tiếp theo phù hợp theo từng trạng thái (không trùng lặp với card tài chính)
  it('11. should provide accurate Next Steps instructions per booking status', () => {
    expect(component.getNextStepMessage('PendingPayment')).toContain('Đơn đang được giữ tạm thời');
    expect(component.getNextStepMessage('Confirmed')).toContain('Đặt phòng đã được xác nhận');
    expect(component.getNextStepMessage('CheckedIn')).toContain('Bạn đã nhận phòng thành công');
    expect(component.getNextStepMessage('CheckedOut')).toContain('Bạn đã hoàn tất trả phòng');
    expect(component.getNextStepMessage('Expired')).toContain('Thời gian giữ phòng đã kết thúc');
    expect(component.getNextStepMessage('Cancelled')).toContain('Đơn đặt phòng đã được hủy');
  });

  // 12. Không để lộ PII ngoài dữ liệu được che
  it('12. should respect masked PII data from server', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Ng*** H***');
    expect(compiled.textContent).toContain('h***@example.com');
    expect(compiled.textContent).toContain('090****567');
  });

  // 13. Cấu trúc nút thao tác: Primary CTA "Xem chi tiết đặt phòng", Secondary CTA "Đặt phòng khác"
  it('13. should render correct Primary and Secondary CTA buttons with proper routes and styling', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Primary CTA
    const primaryLink = compiled.querySelector('a[href*="/booking/status/tok-token-aaa"]');
    expect(primaryLink).toBeTruthy();
    expect(primaryLink?.textContent).toContain('Xem chi tiết đặt phòng');

    // Secondary CTA
    const allLinks = Array.from(compiled.querySelectorAll('a'));
    const secondaryLink = allLinks.find(el => el.textContent?.includes('Đặt phòng khác'));
    expect(secondaryLink).toBeTruthy();
    expect(secondaryLink?.textContent).toContain('Đặt phòng khác');
  });

  // 14. Nút chỉ đường an toàn: không đưa token/PIN vào URL bản đồ, xử lý an toàn khi thiếu dữ liệu
  it('14. should construct safe directions URL without leaking tokens/PINs and handle missing address', () => {
    expect(component.hasValidDirections(sampleBookingA)).toBe(true);
    const urlA = component.getDirectionsUrl(sampleBookingA);
    expect(urlA).toContain('maps/search');
    expect(urlA).toContain(encodeURIComponent('Khách sạn LuxeStay Đà Lạt, 12 Hoàng Hoa Thám, TP. Đà Lạt'));
    expect(urlA).not.toContain('tok-token-aaa');
    expect(urlA).not.toContain('res-aaa-111');

    // Thiếu cả địa chỉ lẫn tên
    const emptyPropBooking = { ...sampleBookingA, propertyAddress: '', propertyName: '' };
    expect(component.hasValidDirections(emptyPropBooking)).toBe(false);
    expect(component.getDirectionsUrl(emptyPropBooking)).toBe('#');
    expect(component.hasValidDirections(null)).toBe(false);
  });

  // 15. Không trùng lặp thông báo thanh toán trong card tài chính
  it('15. should not duplicate PendingPayment alert inside financial summary card', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of(sampleBookingA));
    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Chỉ có thông báo ở Bước tiếp theo, không có thông báo trùng lặp bên trong Chi tiết thanh toán
    const nextStepsBox = compiled.querySelector('.bg-indigo-50\\/60');
    expect(nextStepsBox?.textContent).toContain('Bước tiếp theo');

    // Card tài chính không lặp lại khối amber cảnh báo thanh toán
    const financialCard = compiled.querySelector('.bg-white.border.border-slate-200.shadow-2xs');
    expect(financialCard?.textContent).not.toContain('Đơn đang chờ thanh toán. Vui lòng thực hiện bước tiếp theo');
  });

  // 16. Tiêu đề in thay đổi theo trạng thái (Confirmed vs PendingPayment)
  it('16. should distinguish print header title between confirmed and pending bookings', () => {
    expect(component.isConfirmedStatus('Confirmed')).toBe(true);
    expect(component.isConfirmedStatus('CheckedIn')).toBe(true);
    expect(component.isConfirmedStatus('CheckedOut')).toBe(true);

    expect(component.isConfirmedStatus('PendingPayment')).toBe(false);
    expect(component.isConfirmedStatus('Expired')).toBe(false);
    expect(component.isConfirmedStatus('Cancelled')).toBe(false);
  });

  // 17. Đổi route token A -> B trong cùng component: dọn dữ liệu A, tải B, bỏ qua phản hồi A về muộn
  it('17. should handle route queryParams token transition A -> B: clear A data immediately, load B, and ignore late response from A', () => {
    const queryParams$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingLookupPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$,
            snapshot: { queryParams: {} }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingLookupPageComponent);
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
    queryParams$.next({ token: 'tok-token-aaa' });
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-token-aaa');
    expect(dynamicComp.isLoading()).toBe(true);
    expect(dynamicComp.booking()).toBeNull();

    // 2. Chuyển sang token B khi A chưa phản hồi
    queryParams$.next({ token: 'tok-token-bbb' });
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

  // 18. Xóa token khỏi URL khi request A đang chờ: vô hiệu hóa request, xóa dữ liệu và timer, dừng loading
  it('18. should handle token removal from URL: invalidate pending request, clear data, timers, and stop loading', () => {
    const queryParams$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingLookupPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$,
            snapshot: { queryParams: {} }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingLookupPageComponent);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);

    // Bắt đầu với token A
    queryParams$.next({ token: 'tok-token-aaa' });
    expect(dynamicComp.isLoading()).toBe(true);

    // Xóa token khỏi URL
    queryParams$.next({});
    expect(dynamicComp.searchToken).toBe('');
    expect(dynamicComp.isLoading()).toBe(false);
    expect(dynamicComp.booking()).toBeNull();

    // Phản hồi A về trễ sau khi đã xóa token
    subjectA.next(sampleBookingA);
    expect(dynamicComp.booking()).toBeNull(); // Không được khôi phục dữ liệu
    expect(dynamicComp.isLoading()).toBe(false);
  });

  // 19. Reset tra cứu khi có request cũ: response cũ không khôi phục dữ liệu
  it('19. should reset search when user calls resetToSearch and ignore late in-flight response', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);

    component.searchToken = 'tok-token-aaa';
    component.onSearch();
    expect(component.isLoading()).toBe(true);

    // Gọi reset màn hình tra cứu
    component.resetToSearch();
    expect(component.isLoading()).toBe(false);
    expect(component.booking()).toBeNull();
    expect(component.searchToken).toBe('');

    // Request cũ trả về muộn
    subjectA.next(sampleBookingA);
    expect(component.booking()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  // 20. Lỗi trễ từ search A không làm hỏng search B đang chờ
  it('20. should discard late error from search A when search B is in progress', () => {
    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockImplementation((tok: string) => {
      if (tok === 'tok-token-aaa') return subjectA;
      if (tok === 'tok-token-bbb') return subjectB;
      return of(sampleBookingA);
    });

    component.searchToken = 'tok-token-aaa';
    component.onSearch();

    component.searchToken = 'tok-token-bbb';
    component.onSearch();

    // Request A báo lỗi 500 trễ
    subjectA.error({ status: 500 });

    // Không hiển thị lỗi của A
    expect(component.searchError()).toBeNull();
    expect(component.isLoading()).toBe(true);

    // Request B thành công
    subjectB.next(sampleBookingB);
    expect(component.isLoading()).toBe(false);
    expect(component.booking()?.lookupToken).toBe('tok-token-bbb');
  });

  // --- T03 REGRESSION TESTS: CLIPBOARD, REVIEWS & PRINT SAFETY ---
  describe('T03 — Clipboard, Reviews & Print Verification in Lookup Page', () => {
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

    it('21. should set isCopied to true when clipboard.writeText resolves', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      expect(writeTextMock).toHaveBeenCalledWith('tok-token-aaa');
      await Promise.resolve();

      expect(component.isCopied()).toBe(true);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    it('22. should show warning toast and keep isCopied false when clipboard.writeText rejects (no fake success)', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      await Promise.resolve();
      await Promise.resolve();

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Không thể tự động sao chép mã. Vui lòng chọn và sao chép thủ công.');
      expect(mockAlertService.toastWarning).not.toHaveBeenCalledWith(expect.stringContaining('tok-token-aaa'));
    });

    it('23. should show warning toast when navigator.clipboard is unavailable without reporting fake success', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Trình duyệt không hỗ trợ tự động sao chép. Vui lòng chọn và sao chép thủ công.');
    });

    it('24. should discard late clipboard resolve and reject when booking switches from A to B', async () => {
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

      // 1. Copy trên đơn A
      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      // 2. Chuyển sang đơn B
      component.booking.set(sampleBookingB);

      // 3. Promise A resolve muộn -> B không bị ảnh hưởng
      resolveA();
      await deferredA;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();

      // 4. Thử lại với trường hợp Promise A reject muộn
      let rejectLate!: (err: any) => void;
      const deferredLate = new Promise<void>((_, rej) => {
        rejectLate = rej;
      });
      writeTextMock.mockReturnValue(deferredLate);

      component.booking.set(sampleBookingA);
      component.copyToken('tok-token-aaa');

      component.booking.set(sampleBookingB);

      rejectLate(new Error('late clipboard error'));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    it('24b. should discard in-flight clipboard callback when resetToSearch is called', async () => {
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

      // Reset tra cứu
      component.resetToSearch();
      expect(component.booking()).toBeNull();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
    });

    it('24c. should not update signals, show toast or create timers when destroyed before Promise finishes', async () => {
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

      // Hủy component
      component.ngOnDestroy();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(mockAlertService.toastWarning).not.toHaveBeenCalled();
      expect((component as any).copyTimeout).toBeUndefined();
    });

    it('24d. should handle two consecutive copy clicks and not let earlier click overwrite later click', async () => {
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

      // Bấm copy lần 1 rồi lần 2
      component.copyToken('tok-token-aaa');
      component.copyToken('tok-token-aaa');

      // Lần 2 hoàn tất trước
      resolveClick2();
      await deferred2;
      expect(component.isCopied()).toBe(true);

      // Lần 1 hoàn tất sau - không được ghi đè hay làm hỏng trạng thái lần 2
      resolveClick1();
      await deferred1;
      expect(component.isCopied()).toBe(true);
    });

    it('24e. should clear copy timer when switching search or destroying component', () => {
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

    it('25. should not report fake success when submitReview is called without approved real API', () => {
      component.booking.set({ ...sampleBookingA, status: 'CheckedOut' });

      component.submitReview();

      expect(mockAlertService.toastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Tính năng gửi đánh giá trực tuyến hiện chưa được hỗ trợ')
      );
      expect(mockAlertService.success).not.toHaveBeenCalled();
    });

    it('26. should show review unreadiness notice in DOM when booking is CheckedOut', () => {
      component.booking.set({ ...sampleBookingA, status: 'CheckedOut' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chức năng đánh giá trực tuyến chưa khả dụng');
      expect(compiled.textContent).toContain('Hệ thống hiện tại chưa hỗ trợ gửi đánh giá trực tuyến qua API công khai');
    });

    it('27. should return correct print label and distinguish confirmed vs unconfirmed status', () => {
      expect(component.getPrintButtonLabel('Confirmed')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('CheckedIn')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('CheckedOut')).toBe('In phiếu xác nhận');
      expect(component.getPrintButtonLabel('PendingPayment')).toBe('In thông tin đặt phòng');
      expect(component.getPrintButtonLabel('Expired')).toBe('In thông tin đặt phòng');
      expect(component.getPrintButtonLabel('Cancelled')).toBe('In thông tin đặt phòng');

      expect(component.isConfirmedStatus('Confirmed')).toBe(true);
      expect(component.isConfirmedStatus('PendingPayment')).toBe(false);
      expect(component.isConfirmedStatus('Expired')).toBe(false);
    });

    it('28. should invoke window.print on printConfirmation', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      component.printConfirmation();
      expect(printSpy).toHaveBeenCalled();
    });
  });
});

