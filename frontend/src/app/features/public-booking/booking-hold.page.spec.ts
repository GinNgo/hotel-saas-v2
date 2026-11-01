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
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingHoldPageComponent, BookingHoldPage } from './booking-hold.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { PublicPropertyDto, GuestBookingDetailDto, GuestHoldDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('BookingHoldPageComponent (T01 — Giữ phòng, hết hạn và thử lại an toàn)', () => {
  let fixture: ComponentFixture<BookingHoldPageComponent>;
  let component: BookingHoldPageComponent;
  let mockBookingService: any;
  let mockAlertService: any;
  let mockRouter: any;

  const sampleProperty = {
    propertyId: 'prop-dalat-1',
    tenantId: 'tenant-1',
    tenantBrandName: 'LuxeStay Collection',
    name: 'Khách sạn LuxeStay Đà Lạt',
    slug: 'luxestay-da-lat',
    code: 'LSD01',
    propertyType: 'Hotel' as any,
    allowedRentalTypes: ['Daily', 'Hourly', 'Overnight'],
    addressLine: '12 Hoàng Hoa Thám',
    wardName: 'Phường 10',
    provinceName: 'Lâm Đồng',
    provinceCode: 'VN-35',
    thumbnailUrl: '/images/prop.jpg',
    galleryUrls: ['/images/prop.jpg'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    allowDailyBooking: true,
    allowHourlyBooking: true,
    allowOvernightBooking: true,
    availableRoomTypes: []
  } as unknown as PublicPropertyDto;

  const sampleQuote: QuoteDto = {
    propertyId: 'prop-dalat-1',
    roomTypeId: 'rt-deluxe-1',
    roomTypeName: 'Phòng Deluxe Hướng Núi',
    rentalType: 'Daily',
    totalAmount: 1500000,
    currency: 'VND',
    expiresAtUtc: '2099-12-31T23:59:59Z',
    breakdown: [
      { description: 'Tiền phòng 2 đêm', unitPrice: 750000, quantity: 2, amount: 1500000 }
    ],
    appliedPolicies: {
      maxHourlyHours: 6,
      bufferMinutes: 30,
      checkInTime: '14:00' as any,
      checkOutTime: '12:00' as any
    }
  };

  const sampleBookingDetail: GuestBookingDetailDto = {
    reservationId: 'res-abc-001',
    confirmationCode: 'HOLD-001',
    lookupToken: 'tok-hold-abc-123',
    propertyId: 'prop-dalat-1',
    propertyName: 'Khách sạn LuxeStay Đà Lạt',
    propertyAddress: '12 Hoàng Hoa Thám',
    roomTypeName: 'Phòng Deluxe Hướng Núi',
    rentalType: 'Daily',
    startAtUtc: '2099-10-20T07:00:00Z',
    endAtUtc: '2099-10-22T05:00:00Z',
    numberOfGuests: 2,
    totalAmount: 1500000,
    depositRequired: 450000,
    paidAmount: 0,
    remainingBalance: 1500000,
    isFullyPaid: false,
    status: 'PendingPayment',
    maskedGuestName: 'Ng*** H***',
    maskedGuestEmail: 'h***@example.com',
    holdExpiresAtUtc: '2099-10-20T07:15:00Z',
    secondsRemaining: 900,
    createdAtUtc: '2099-10-20T07:00:00Z',
    breakdown: []
  };

  beforeEach(async () => {
    mockBookingService = {
      getPropertyBySlug: vi.fn().mockReturnValue(of(sampleProperty)),
      calculateQuote: vi.fn().mockReturnValue(of(sampleQuote)),
      createHold: vi.fn().mockReturnValue(of({
        reservationId: 'res-abc-001',
        lookupToken: 'tok-hold-abc-123',
        propertyName: sampleProperty.name,
        roomTypeName: sampleQuote.roomTypeName,
        totalAmount: 1500000,
        depositRequired: 450000,
        holdExpiresAtUtc: '2099-10-20T07:15:00Z',
        secondsRemaining: 900,
        status: 'PendingPayment'
      } as GuestHoldDto)),
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBookingDetail)),
      extendHold: vi.fn().mockReturnValue(of({
        ...sampleBookingDetail,
        holdExpiresAtUtc: '2099-10-20T07:20:00Z',
        holdExtensionCount: 1,
        canExtendHold: false
      }))
    };

    mockAlertService = {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {
                propertySlug: 'luxestay-da-lat',
                roomTypeId: 'rt-deluxe-1',
                rentalType: 'Daily',
                checkInDate: '2099-10-20',
                checkOutDate: '2099-10-22',
                guests: 2
              },
              paramMap: {
                get: vi.fn().mockReturnValue(null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingHoldPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function fillValidContactForm(): void {
    component.property.set(sampleProperty);
    component.quote.set(sampleQuote);
    component.guestName = 'Nguyễn Văn Hoàng';
    component.guestPhone = '0912345678';
    component.guestEmail = 'hoang.nguyen@example.com';
  }

  // 1. Form validation: không gọi API khi thiếu thông tin, focus field lỗi, KHÔNG hiển thị Toast (chỉ inline validation)
  it('1. should not call createHold API when contact form is invalid and focus the first invalid field without toast', () => {
    component.property.set(sampleProperty);
    component.quote.set(sampleQuote);
    component.guestName = '';
    component.guestPhone = '';
    component.guestEmail = '';

    component.confirmBooking();

    expect(mockBookingService.createHold).not.toHaveBeenCalled();
    // Không dùng popup lỗi lớn từ alertService
    expect(mockAlertService.error).not.toHaveBeenCalled();
    // Không dùng Toast cho lỗi form validation thông thường (tránh che Header/Navigation)
    expect(component.toast()).toBeNull();
    // Lỗi hiển thị inline ngay dưới từng input
    expect(component.fieldError('name', true)).toBe('Vui lòng nhập họ và tên.');
    expect(component.fieldError('phone', true)).toBe('Vui lòng nhập số điện thoại.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();

    // Xóa trạng thái lỗi khi dữ liệu đã hợp lệ
    component.guestName = 'Nguyễn Văn Hoàng';
    expect(component.fieldError('name', true)).toBe('');
    component.guestPhone = '0912345678';
    expect(component.fieldError('phone', true)).toBe('');
  });

  // 1a. Toast chỉ dùng cho sự cố hệ thống/API, có nút đóng và tự ẩn
  it('1a. should use toast only for system/API errors, allow dismissing manually', () => {
    component.showToast('Lỗi kết nối máy chủ', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.', 'error');
    expect(component.toast()).toBeTruthy();
    expect(component.toast()?.title).toBe('Lỗi kết nối máy chủ');
    expect(component.toast()?.type).toBe('error');

    component.dismissToast();
    expect(component.toast()).toBeNull();
  });

  // 1b. Validation số điện thoại: hỗ trợ VN mobile, số quốc tế hợp lệ, từ chối số sai cấu trúc
  it('1b. should validate phone numbers according to hotel business rules (VN domestic, intl format, reject malformed)', () => {
    // 1. Số điện thoại di động Việt Nam hợp lệ (0xxxxxxxxx và +84xxxxxxxxx)
    component.guestPhone = '0912345678';
    expect(component.fieldError('phone', true)).toBe('');
    expect(component.isValidPhoneNumber('0912345678')).toBe(true);

    component.guestPhone = '+84912345678';
    expect(component.fieldError('phone', true)).toBe('');
    expect(component.isValidPhoneNumber('+84912345678')).toBe(true);

    component.guestPhone = '0387654321';
    expect(component.fieldError('phone', true)).toBe('');
    component.guestPhone = '0701234567';
    expect(component.fieldError('phone', true)).toBe('');
    component.guestPhone = '0812345678';
    expect(component.fieldError('phone', true)).toBe('');
    component.guestPhone = '0581234567';
    expect(component.fieldError('phone', true)).toBe('');

    // Cho phép định dạng có dấu cách / gạch nối ngăn cách thông thường
    expect(component.isValidPhoneNumber('0912 345 678')).toBe(true);
    expect(component.isValidPhoneNumber('+84 912 345 678')).toBe(true);

    // 2. Định dạng quốc tế hợp lệ cho khách quốc tế đặt phòng (E.164: +1, +81, +44,...)
    component.guestPhone = '+14155552671';
    expect(component.fieldError('phone', true)).toBe('');
    expect(component.isValidPhoneNumber('+14155552671')).toBe(true);

    component.guestPhone = '+819012345678';
    expect(component.fieldError('phone', true)).toBe('');
    expect(component.isValidPhoneNumber('+819012345678')).toBe(true);

    component.guestPhone = '+442071838750';
    expect(component.fieldError('phone', true)).toBe('');
    expect(component.isValidPhoneNumber('+442071838750')).toBe(true);

    // 3. Từ chối chuỗi chỉ đủ số lượng nhưng sai cấu trúc
    component.guestPhone = '23456354367';
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('23456354367')).toBe(false);

    // 4. Từ chối chuỗi chứa ký tự chữ cái
    component.guestPhone = 'abc1234567';
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('abc1234567')).toBe(false);

    // 5. Từ chối số quá ngắn
    component.guestPhone = '09123';
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('09123')).toBe(false);

    // 6. Số quốc tế sai quy tắc: không suy đoán mọi số có dấu + đều hợp lệ
    component.guestPhone = '+012345678'; // Mã quốc gia không được bắt đầu bằng 0
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('+012345678')).toBe(false);

    component.guestPhone = '+84123456789012'; // +84 nhưng sai cấu trúc di động VN
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('+84123456789012')).toBe(false);

    component.guestPhone = '+123'; // Quá ngắn
    expect(component.fieldError('phone', true)).toBe('Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
    expect(component.isValidPhoneNumber('+123')).toBe(false);

    // 7. Để trống: hiển thị lỗi bắt buộc
    component.guestPhone = '';
    expect(component.fieldError('phone', true)).toBe('Vui lòng nhập số điện thoại.');

    // 8. Khi số điện thoại không hợp lệ, submit không gọi createHold và không tạo Toast
    fillValidContactForm();
    component.guestPhone = '23456354367';
    component.confirmBooking();
    expect(mockBookingService.createHold).not.toHaveBeenCalled();
    expect(component.toast()).toBeNull();

    // 9. Xóa lỗi khi dữ liệu được sửa lại hợp lệ
    component.guestPhone = '0912345678';
    expect(component.fieldError('phone', true)).toBe('');
  });

  // 1c. Kiểm tra xem có phải là email hợp lệ hay không
  it('1c. should strictly validate email format', () => {
    component.guestEmail = 'invalid-email';
    expect(component.fieldError('email', true)).toBe('Vui lòng nhập email hợp lệ.');

    component.guestEmail = 'user@';
    expect(component.fieldError('email', true)).toBe('Vui lòng nhập email hợp lệ.');

    component.guestEmail = 'user@domain';
    expect(component.fieldError('email', true)).toBe('Vui lòng nhập email hợp lệ.');

    component.guestEmail = 'user@domain.';
    expect(component.fieldError('email', true)).toBe('Vui lòng nhập email hợp lệ.');

    component.guestEmail = 'user@domain.c';
    expect(component.fieldError('email', true)).toBe('Vui lòng nhập email hợp lệ.');

    // Email hợp lệ
    component.guestEmail = 'tan.tran@hotelsaas.vn';
    expect(component.fieldError('email', true)).toBe('');

    component.guestEmail = 'guest.booking+01@gmail.com';
    expect(component.fieldError('email', true)).toBe('');
  });

  // 2. Chặn concurrent submissions (double click)
  it('2. should prevent double-click submissions and only send one in-flight request', () => {
    fillValidContactForm();
    const holdSubject = new Subject<GuestHoldDto>();
    mockBookingService.createHold.mockReturnValue(holdSubject);

    // Click lần 1
    component.confirmBooking();
    expect(component.isSubmitting()).toBe(true);
    expect(mockBookingService.createHold).toHaveBeenCalledTimes(1);

    // Click lần 2 khi request 1 đang chạy
    component.confirmBooking();
    expect(mockBookingService.createHold).toHaveBeenCalledTimes(1);

    // Hoàn tất request 1
    holdSubject.next({ lookupToken: 'tok-hold-abc-123' } as any);
    expect(component.isSubmitting()).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/booking/hold', 'tok-hold-abc-123']);
  });

  // 3. Retry cùng payload tái sử dụng idempotency key, thông báo kết nối chuẩn, không trùng lặp
  it('3. should reuse the same idempotency key when retrying the identical payload intent and keep form intact', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(throwError(() => new Error('Failed to fetch')));

    // Lần 1: Lỗi mạng
    component.confirmBooking();
    expect(mockBookingService.createHold).toHaveBeenCalledTimes(1);
    const key1 = mockBookingService.createHold.mock.calls[0][0].idempotencyKey;
    expect(key1).toBeTruthy();
    expect(component.isSubmitting()).toBe(false);
    expect(component.toast()).toBeNull(); // Không phát sinh Toast trùng lặp

    // Nội dung thông báo lỗi hệ thống theo chuẩn FIX 01
    expect(component.holdError()?.title).toBe('Không thể kết nối máy chủ');
    expect(component.holdError()?.message).toBe('Chưa xác định được kết quả giữ phòng. Vui lòng kiểm tra kết nối rồi thử lại.');
    expect(component.holdError()?.note).toBe('Thông tin đã nhập vẫn được giữ lại.');
    expect(component.holdError()?.isRetryable).toBe(true);

    // Render kiểm tra DOM giao diện inline error panel
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Không thể kết nối máy chủ');
    expect(compiled.textContent).toContain('Chưa xác định được kết quả giữ phòng. Vui lòng kiểm tra kết nối rồi thử lại.');
    expect(compiled.textContent).toContain('Thông tin đã nhập vẫn được giữ lại.');
    expect(compiled.textContent).not.toContain('Failed to fetch');
    expect(compiled.textContent).not.toContain('Thông tin đã nhập được giữ nguyên an toàn');

    // Nút đóng thông báo hoạt động
    component.clearHoldError();
    expect(component.holdError()).toBeNull();

    // Giữ nguyên thông tin form khi gặp lỗi
    expect(component.guestName).toBe('Nguyễn Văn Hoàng');
    expect(component.guestPhone).toBe('0912345678');
    expect(component.guestEmail).toBe('hoang.nguyen@example.com');

    // Lần 2: Thử lại với cùng thông tin (retry) giữ nguyên Idempotency-Key
    component.confirmBooking();
    expect(mockBookingService.createHold).toHaveBeenCalledTimes(2);
    const key2 = mockBookingService.createHold.mock.calls[1][0].idempotencyKey;
    expect(key2).toBe(key1);
    expect(component.toast()).toBeNull();
  });

  // 3b. Phân biệt lỗi HTTP 500 và hiển thị thông báo thân thiện có thể thử lại
  it('3b. should differentiate HTTP 500 error and provide friendly retryable message', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(throwError(() => ({ status: 500 })));

    component.confirmBooking();
    expect(component.holdError()?.type).toBe('server');
    expect(component.holdError()?.title).toBe('Hệ thống tạm thời gián đoạn');
    expect(component.holdError()?.message).toContain('Máy chủ đang gặp sự cố');
    expect(component.holdError()?.isRetryable).toBe(true);
    expect(component.toast()).toBeNull();
  });

  // 3c. Phân biệt lỗi nghiệp vụ HTTP 409 (Conflict) và không cho retry vô nghĩa
  it('3c. should differentiate HTTP 409 conflict and not expose technical trace', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Phòng đã được giữ bởi khách khác.' } })));

    component.confirmBooking();
    expect(component.holdError()?.type).toBe('business');
    expect(component.holdError()?.title).toBe('Phòng không còn khả dụng');
    expect(component.holdError()?.message).toBe('Phòng đã được giữ bởi khách khác.');
    expect(component.holdError()?.isRetryable).toBe(false);
    expect(component.toast()).toBeNull();
  });

  // 3d. Phân biệt lỗi nghiệp vụ HTTP 400 (Bad Request)
  it('3d. should differentiate HTTP 400 bad request without technical stack trace', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Thời gian lưu trú không hợp lệ.' } })));

    component.confirmBooking();
    expect(component.holdError()?.type).toBe('business');
    expect(component.holdError()?.title).toBe('Thông tin chưa hợp lệ');
    expect(component.holdError()?.message).toBe('Thời gian lưu trú không hợp lệ.');
    expect(component.holdError()?.isRetryable).toBe(false);
    expect(component.toast()).toBeNull();
  });

  // 4. Payload thay đổi phải sinh idempotency key mới
  it('4. should generate a new idempotency key when the payload changes', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(throwError(() => new Error('Conflict')));

    component.confirmBooking();
    const key1 = mockBookingService.createHold.mock.calls[0][0].idempotencyKey;

    // Khách hàng sửa lại tên
    component.guestName = 'Trần Văn Khác';
    component.confirmBooking();
    const key2 = mockBookingService.createHold.mock.calls[1][0].idempotencyKey;

    expect(key2).not.toBe(key1);
  });

  // 5. Quote hết hạn không thể tạo Hold
  it('5. should reject hold creation when quote has expired and display informative error', () => {
    fillValidContactForm();
    component.quote.set({
      ...sampleQuote,
      expiresAtUtc: '2020-01-01T00:00:00Z'
    });

    component.confirmBooking();

    expect(mockBookingService.createHold).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.error()).toContain('hết hiệu lực');
    expect(component.holdError()?.type).toBe('expired');
    expect(component.isQuoteExpired()).toBe(true);
    expect(component.toast()).toBeNull();
  });

  // 6. Response thiếu lookupToken không tạo success giả
  it('6. should reject hold response and display error when lookupToken is missing', () => {
    fillValidContactForm();
    mockBookingService.createHold.mockReturnValue(of({
      reservationId: 'res-abc-001',
      lookupToken: '',
      propertyName: sampleProperty.name
    } as any));

    component.confirmBooking();

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.holdError()?.title).toBe('Chưa thể xác nhận giữ phòng');
    expect(component.booking()).toBeNull();
    expect(component.toast()).toBeNull();
  });

  // 7. Refresh URL có token chỉ tải hold, không tạo hold mới
  it('7. should only load existing booking by token on refresh and never invoke createHold', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'token' ? 'tok-reloaded-777' : null)
              },
              queryParams: {}
            }
          }
        }
      ]
    });

    const refreshedFixture = TestBed.createComponent(BookingHoldPageComponent);
    const refreshedComp = refreshedFixture.componentInstance;
    refreshedComp.ngOnInit();

    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-reloaded-777');
    expect(mockBookingService.createHold).not.toHaveBeenCalled();
    expect(mockBookingService.calculateQuote).not.toHaveBeenCalled();
    expect(refreshedComp.booking()).toEqual(sampleBookingDetail);
  });

  // 8. Countdown tính theo deadline chính xác, không âm/NaN
  it('8. should calculate countdown based on deadline and safely handle zero, negative or NaN values', () => {
    expect(component.formatCountdown(125)).toBe('02:05');
    expect(component.formatCountdown(600)).toBe('10:00');
    expect(component.formatCountdown(0)).toBe('00:00');
    expect(component.formatCountdown(-15)).toBe('00:00');
    expect(component.formatCountdown(NaN)).toBe('00:00');

    // Khởi tạo countdown với deadline hợp lệ trong tương lai
    const futureDate = new Date(Date.now() + 180000).toISOString(); // +3 phút
    component.startHoldCountdown(futureDate, 'PendingPayment');
    expect(component.secondsRemaining()).toBeGreaterThan(170);
    expect(component.isExpired()).toBe(false);

    // Với deadline quá hạn
    const pastDate = new Date(Date.now() - 5000).toISOString();
    component.startHoldCountdown(pastDate, 'PendingPayment');
    expect(component.secondsRemaining()).toBe(0);
    expect(component.isExpired()).toBe(true);
  });

  // 9. Tab nền: visibilitychange tính lại thời gian theo clock thực
  it('9. should recalculate remaining time against real clock upon visibilitychange', () => {
    component.ngOnInit();
    const baseNow = Date.now();
    const futureDate = new Date(baseNow + 120000).toISOString(); // +120s
    component.booking.set({
      ...sampleBookingDetail,
      holdExpiresAtUtc: futureDate,
      status: 'PendingPayment'
    });

    component.startHoldCountdown(futureDate, 'PendingPayment');
    const initialSeconds = component.secondsRemaining();
    expect(initialSeconds).toBeGreaterThan(115);

    // Giả lập đồng hồ trôi qua 30 giây trong khi tab chạy ngầm
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(baseNow + 30000);

    // Kích hoạt visibilitychange khi tab active trở lại
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(component.secondsRemaining()).toBeLessThanOrEqual(initialSeconds - 29);
    nowSpy.mockRestore();
  });

  // 10. Server báo Expired không bị ghi đè bởi timer
  it('10. should respect server Expired status and not overwrite it with a future timer', () => {
    const futureDate = new Date(Date.now() + 600000).toISOString(); // +10 phút
    component.booking.set({
      ...sampleBookingDetail,
      holdExpiresAtUtc: futureDate,
      status: 'Expired'
    });

    component.startHoldCountdown(futureDate, 'Expired');

    expect(component.isExpired()).toBe(true);
    expect(component.secondsRemaining()).toBe(0);
    expect(component.remainingSeconds()).toBe(0);
  });

  // 11. Chống stale late response ghi đè dữ liệu mới
  it('11. should discard stale late responses from outdated request generations', () => {
    const quoteSubjectA = new Subject<QuoteDto>();
    const quoteSubjectB = new Subject<QuoteDto>();

    // Request A
    mockBookingService.calculateQuote.mockReturnValue(quoteSubjectA);
    component.loadPreview();

    // Request B (user refresh hoặc thay đổi query)
    mockBookingService.calculateQuote.mockReturnValue(quoteSubjectB);
    component.loadPreview();

    // Response A đến trễ
    quoteSubjectA.next({ ...sampleQuote, totalAmount: 9999999 });
    expect(component.quote()).toBeNull(); // Response A bị hủy/bỏ qua

    // Response B đến
    quoteSubjectB.next(sampleQuote);
    expect(component.quote()?.totalAmount).toBe(1500000);
  });

  // 12. Cleanup timer và subscription khi Destroy
  it('12. should cleanup timers and event listeners when component is destroyed', () => {
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    component.ngOnInit();
    component.startQuoteCountdown('2099-12-31T23:59:59Z');
    component.startHoldCountdown('2099-12-31T23:59:59Z', 'PendingPayment');

    component.ngOnDestroy();

    expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  // 13. Map enum status sang nhãn thân thiện cho khách hàng
  it('13. should map technical status enum into human-friendly Vietnamese labels and badge classes', () => {
    expect(component.statusLabel('PendingPayment')).toBe('Chờ thanh toán');
    expect(component.statusLabel('Confirmed')).toBe('Đã xác nhận');
    expect(component.statusLabel('CheckedIn')).toBe('Đang lưu trú');
    expect(component.statusLabel('CheckedOut')).toBe('Đã trả phòng');
    expect(component.statusLabel('Expired')).toBe('Đã hết hạn');
    expect(component.statusLabel('Cancelled')).toBe('Đã hủy');
    expect(component.statusLabel(undefined)).toBe('Đang xử lý');

    expect(component.statusBadgeClass('PendingPayment')).toContain('bg-amber-50');
    expect(component.statusBadgeClass('Confirmed')).toContain('bg-emerald-50');
    expect(component.statusBadgeClass('Expired')).toContain('bg-rose-50');
  });

  // 14. Đổi route token A -> B trong cùng component: dọn dữ liệu A, timer cũ, tải B, bỏ qua phản hồi A về muộn
  it('14. should handle route token transition A -> B: clear A data immediately, clear timer, load B, and ignore late response from A', () => {
    const paramMap$ = new Subject<any>();
    const queryParams$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$,
            queryParams: queryParams$,
            snapshot: { queryParams: {}, paramMap: { get: () => null } }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingHoldPageComponent);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockImplementation((tok: string) => {
      if (tok === 'tok-aaa') return subjectA;
      if (tok === 'tok-bbb') return subjectB;
      return of(sampleBookingDetail);
    });

    // 1. Chuyển sang token A
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-aaa' : null) });
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-aaa');
    expect(dynamicComp.loading()).toBe(true);
    expect(dynamicComp.booking()).toBeNull();

    // 2. Chuyển tiếp sang token B khi A chưa phản hồi
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-bbb' : null) });
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-bbb');
    expect(dynamicComp.booking()).toBeNull();

    // 3. Phản hồi A về muộn
    subjectA.next({ ...sampleBookingDetail, lookupToken: 'tok-aaa', confirmationCode: 'HOLD-AAA' });
    // Phải bỏ qua A, không được gán vào booking
    expect(dynamicComp.booking()).toBeNull();

    // 4. Phản hồi B về
    const bookingB = { ...sampleBookingDetail, lookupToken: 'tok-bbb', confirmationCode: 'HOLD-BBB' };
    subjectB.next(bookingB);
    expect(dynamicComp.booking()).toEqual(bookingB);
    expect(dynamicComp.booking()?.lookupToken).toBe('tok-bbb');
  });

  // 15. Chuyển từ có token về luồng không có token: dọn dữ liệu giữ phòng, dọn timer, và tải lại báo giá mới
  it('15. should handle transition from token to no-token flow: clear hold data and timers, then load room preview', () => {
    const paramMap$ = new Subject<any>();
    const queryParams$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$,
            queryParams: queryParams$,
            snapshot: { queryParams: {}, paramMap: { get: () => null } }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingHoldPageComponent);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    mockBookingService.getBookingByToken.mockReturnValue(subjectA);

    // Bắt đầu với token A
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-aaa' : null) });
    expect(dynamicComp.loading()).toBe(true);

    // Chuyển về URL không có token (quay lại chọn phòng mới)
    mockBookingService.calculateQuote.mockReturnValue(of(sampleQuote));
    paramMap$.next({ get: () => null });
    queryParams$.next({
      propertySlug: 'luxestay-da-lat',
      roomTypeId: 'rt-deluxe-1',
      checkInDate: '2099-10-20',
      checkOutDate: '2099-10-22',
      guests: 2
    });

    expect(dynamicComp.booking()).toBeNull();
    expect(dynamicComp.isExpired()).toBe(false);
    expect(mockBookingService.calculateQuote).toHaveBeenCalled();

    // Request A trả về muộn sau khi đã về luồng no-token
    subjectA.next({ ...sampleBookingDetail, lookupToken: 'tok-aaa' });
    expect(dynamicComp.booking()).toBeNull(); // Không được khôi phục booking cũ
  });

  it('reloads hourly quotes when route time or duration changes and ignores the old quote', () => {
    const queryParams = new Subject<Record<string, unknown>>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: {
          paramMap: of({ get: () => null }), queryParams,
          snapshot: { queryParams: {}, paramMap: { get: () => null } }
        } }
      ]
    });
    const dynamicFixture = TestBed.createComponent(BookingHoldPageComponent);
    const dynamicComponent = dynamicFixture.componentInstance;
    dynamicComponent.ngOnInit();
    const oldQuote = new Subject<QuoteDto>();
    mockBookingService.calculateQuote.mockReturnValueOnce(oldQuote).mockReturnValue(of(sampleQuote));
    const params = {
      propertySlug: 'luxestay-da-lat', roomTypeId: 'rt-deluxe-1',
      checkInDate: '2099-10-20', checkOutDate: '2099-10-21',
      rentalType: 'Hourly', checkInTime: '14:00', hours: 2, guests: 2
    };
    queryParams.next(params);
    queryParams.next({ ...params, checkInTime: '15:00' });
    expect(mockBookingService.calculateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      startAtUtc: '2099-10-20T08:00:00.000Z', endAtUtc: '2099-10-20T10:00:00.000Z'
    }));
    oldQuote.next({ ...sampleQuote, totalAmount: 1 });
    expect(dynamicComponent.quote()?.totalAmount).toBe(sampleQuote.totalAmount);
    queryParams.next({ ...params, checkInTime: '15:00', hours: 3 });
    expect(mockBookingService.calculateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      endAtUtc: '2099-10-20T11:00:00.000Z'
    }));
    queryParams.next({ ...params, checkInTime: '15:00', durationHours: 4 });
    expect(mockBookingService.calculateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      endAtUtc: '2099-10-20T12:00:00.000Z'
    }));
    dynamicFixture.destroy();
  });

  // 16. Lỗi trễ từ request A bị bỏ qua khi đang tải request B
  it('16. should discard late error from request A when switching to request B', () => {
    const paramMap$ = new Subject<any>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingHoldPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$,
            queryParams: of({}),
            snapshot: { queryParams: {}, paramMap: { get: () => null } }
          }
        }
      ]
    });

    const dynamicFixture = TestBed.createComponent(BookingHoldPageComponent);
    const dynamicComp = dynamicFixture.componentInstance;
    dynamicComp.ngOnInit();

    const subjectA = new Subject<GuestBookingDetailDto>();
    const subjectB = new Subject<GuestBookingDetailDto>();

    mockBookingService.getBookingByToken.mockImplementation((tok: string) => {
      if (tok === 'tok-aaa') return subjectA;
      if (tok === 'tok-bbb') return subjectB;
      return of(sampleBookingDetail);
    });

    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-aaa' : null) });
    paramMap$.next({ get: (key: string) => (key === 'token' ? 'tok-bbb' : null) });

    // Request A trả về lỗi HTTP 500 trễ
    subjectA.error({ status: 500 });

    // Lỗi của A không được làm hỏng request B đang chạy
    expect(dynamicComp.error()).toBe('');
    expect(dynamicComp.holdError()).toBeNull();

    // Request B thành công
    subjectB.next({ ...sampleBookingDetail, lookupToken: 'tok-bbb' });
    expect(dynamicComp.booking()?.lookupToken).toBe('tok-bbb');
  });

  // --- T03 REGRESSION TESTS: CLIPBOARD HANDLING & SAFETY ---
  describe('T03 — Clipboard Handling & Safety in Hold Page', () => {
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

    it('should set isCopied to true when clipboard.writeText resolves, and auto-reset after timeout', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingDetail);
      component.copyToken('tok-hold-abc-123');

      expect(writeTextMock).toHaveBeenCalledWith('tok-hold-abc-123');
      await Promise.resolve();

      expect(component.isCopied()).toBe(true);
      expect(component.toast()).toBeNull();
    });

    it('should show warning toast and keep isCopied false when clipboard.writeText rejects (no fake success)', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingDetail);
      component.copyToken('tok-hold-abc-123');

      await Promise.resolve();
      await Promise.resolve();

      expect(component.isCopied()).toBe(false);
      expect(component.toast()?.title).toBe('Sao chép mã');
      expect(component.toast()?.message).toContain('Không thể tự động sao chép');
      expect(component.toast()?.message).not.toContain('tok-hold-abc-123');
    });

    it('should show fallback warning when navigator.clipboard is unavailable without reporting fake success', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingDetail);
      component.copyToken('tok-hold-abc-123');

      expect(component.isCopied()).toBe(false);
      expect(component.toast()?.title).toBe('Sao chép mã');
      expect(component.toast()?.message).toContain('Trình duyệt không hỗ trợ tự động sao chép');
      expect(component.toast()?.message).not.toContain('tok-hold-abc-123');
    });

    it('should discard late clipboard resolve/reject when booking switches from A to B', async () => {
      let resolveA!: () => void;
      const deferredA = new Promise<void>((res) => {
        resolveA = res;
      });

      const writeTextMock = vi.fn().mockImplementation((tok: string) => {
        if (tok === 'tok-aaa') return deferredA;
        return Promise.resolve();
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      // 1. Đang ở đơn A, bấm copy
      component.booking.set({ ...sampleBookingDetail, lookupToken: 'tok-aaa' });
      component.copyToken('tok-aaa');

      // 2. Chuyển sang đơn B
      component.handleRouteTokenChange('tok-bbb', {});
      component.booking.set({ ...sampleBookingDetail, lookupToken: 'tok-bbb' });

      // 3. Promise A resolve muộn
      resolveA();
      await deferredA;

      expect(component.isCopied()).toBe(false);
      expect(component.toast()).toBeNull();

      // Thử lại với trường hợp Promise A reject muộn
      let rejectLate!: (err: any) => void;
      const deferredLate = new Promise<void>((_, rej) => {
        rejectLate = rej;
      });
      writeTextMock.mockReturnValue(deferredLate);

      component.booking.set({ ...sampleBookingDetail, lookupToken: 'tok-aaa' });
      component.copyToken('tok-aaa');

      component.handleRouteTokenChange('tok-bbb', {});
      component.booking.set({ ...sampleBookingDetail, lookupToken: 'tok-bbb' });

      rejectLate(new Error('late error'));
      await Promise.resolve();
      await Promise.resolve();

      expect(component.toast()).toBeNull();
    });

    it('should ignore in-flight clipboard callback when transitioning to no-token flow', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((res) => {
        resolvePromise = res;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set({ ...sampleBookingDetail, lookupToken: 'tok-old' });
      (component as any).activeRouteToken = 'tok-old';
      component.copyToken('tok-old');

      // Reset về no-token flow
      component.handleRouteTokenChange('', {});
      expect(component.booking()).toBeNull();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(component.toast()).toBeNull();
    });

    it('should not update signals, show toast or create timers when destroyed before Promise finishes', async () => {
      let resolvePromise!: () => void;
      const deferred = new Promise<void>((res) => {
        resolvePromise = res;
      });
      const writeTextMock = vi.fn().mockReturnValue(deferred);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingDetail);
      component.copyToken('tok-hold-abc-123');

      // Destroy component
      component.ngOnDestroy();

      resolvePromise();
      await deferred;

      expect(component.isCopied()).toBe(false);
      expect(component.toast()).toBeNull();
      expect((component as any).copyTimeout).toBeUndefined();
    });

    it('should handle two consecutive copy clicks and not let earlier click overwrite later click', async () => {
      let resolveClick1!: () => void;
      const deferred1 = new Promise<void>((res) => {
        resolveClick1 = res;
      });
      let resolveClick2!: () => void;
      const deferred2 = new Promise<void>((res) => {
        resolveClick2 = res;
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

      component.booking.set(sampleBookingDetail);

      // Click 1
      component.copyToken('tok-hold-abc-123');
      // Click 2
      component.copyToken('tok-hold-abc-123');

      // Click 2 resolves first
      resolveClick2();
      await deferred2;
      expect(component.isCopied()).toBe(true);

      // Click 1 resolves later - must not overwrite or break click 2
      resolveClick1();
      await deferred1;
      expect(component.isCopied()).toBe(true);
    });

    it('should clear copy timeout when destroyed or transitioning', () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });

      component.booking.set(sampleBookingDetail);
      component.copyToken('tok-hold-abc-123');

      // Call ngOnDestroy
      component.ngOnDestroy();
      expect((component as any).copyTimeout).toBeUndefined();
    });
  });

  describe('T02 — Hold Extension on Hold Page', () => {
    beforeEach(() => {
      component.booking.set({
        ...sampleBookingDetail,
        holdExtensionCount: 0,
        status: 'PendingPayment'
      });
      component.isExpired.set(false);
    });

    it('should compute isExpiringSoon true only when remaining seconds <= 180 and > 0', () => {
      component.secondsRemaining.set(181);
      expect(component.isExpiringSoon()).toBe(false);

      component.secondsRemaining.set(180);
      expect(component.isExpiringSoon()).toBe(true);

      component.secondsRemaining.set(60);
      expect(component.isExpiringSoon()).toBe(true);

      component.secondsRemaining.set(0);
      expect(component.isExpiringSoon()).toBe(false);
    });

    it('should compute canExtendHold true when expiring soon and holdExtensionCount < 1', () => {
      component.secondsRemaining.set(120);
      expect(component.canExtendHold()).toBe(true);
      expect(component.isHoldExtended()).toBe(false);
    });

    it('should compute canExtendHold false when holdExtensionCount >= 1', () => {
      component.booking.set({
        ...sampleBookingDetail,
        holdExtensionCount: 1,
        status: 'PendingPayment'
      });
      component.secondsRemaining.set(120);

      expect(component.isHoldExtended()).toBe(true);
      expect(component.canExtendHold()).toBe(false);
    });

    it('should compute canExtendHold false when hold is expired', () => {
      component.isExpired.set(true);
      component.secondsRemaining.set(0);

      expect(component.canExtendHold()).toBe(false);
    });

    it('should extend hold successfully, update countdown, and show success toast', () => {
      component.secondsRemaining.set(100);
      const newExpire = new Date(Date.now() + 400000).toISOString();
      mockBookingService.extendHold.mockReturnValue(of({
        ...sampleBookingDetail,
        holdExpiresAtUtc: newExpire,
        holdExtensionCount: 1,
        canExtendHold: false
      }));

      component.extendHold();

      expect(mockBookingService.extendHold).toHaveBeenCalledWith(sampleBookingDetail.lookupToken);
      expect(component.isExtendingHold()).toBe(false);
      expect(component.extendHoldError()).toBe('');
      expect(component.isHoldExtended()).toBe(true);
      expect(component.canExtendHold()).toBe(false);
      expect(mockAlertService.success).toHaveBeenCalledWith(
        'Đã gia hạn thêm 5 phút giữ phòng.',
        'Gia hạn thành công'
      );
    });

    it('should handle conflict (409) during hold extension and reload booking', () => {
      component.secondsRemaining.set(100);
      mockBookingService.extendHold.mockReturnValue(throwError(() => ({
        status: 409,
        error: { message: 'Phòng không còn khả dụng để gia hạn do xung đột lịch lưu trú.' }
      })));

      component.extendHold();

      expect(component.isExtendingHold()).toBe(false);
      expect(component.extendHoldError()).toBe('Phòng không còn khả dụng để gia hạn do xung đột lịch lưu trú.');
      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith(sampleBookingDetail.lookupToken);
    });

    it('should not trigger extendHold if already in progress or cannot extend', () => {
      component.isExtendingHold.set(true);
      component.extendHold();
      expect(mockBookingService.extendHold).not.toHaveBeenCalled();

      component.isExtendingHold.set(false);
      component.secondsRemaining.set(500); // not expiring soon
      component.extendHold();
      expect(mockBookingService.extendHold).not.toHaveBeenCalled();
    });

    it('should safely close broadcastChannel on ngOnDestroy', () => {
      const mockClose = vi.fn();
      (component as any).broadcastChannel = { close: mockClose };

      component.ngOnDestroy();

      expect(mockClose).toHaveBeenCalled();
      expect((component as any).broadcastChannel).toBeUndefined();
    });
  });
});

