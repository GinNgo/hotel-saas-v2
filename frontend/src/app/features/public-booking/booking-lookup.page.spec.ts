import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingLookupPageComponent } from './booking-lookup.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

describe('BookingLookupPageComponent (Spec & Unit Tests)', () => {
  let fixture: ComponentFixture<BookingLookupPageComponent>;
  let component: BookingLookupPageComponent;
  let mockBookingService: {
    getBookingByToken: ReturnType<typeof vi.fn>;
    submitReview: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  const sampleBooking: GuestBookingDetailDto = {
    reservationId: 'res-001',
    confirmationCode: 'CONF-888999',
    lookupToken: 'sample-lookup-token-123',
    propertyId: 'prop-001',
    propertyName: 'Khách Sạn Sài Gòn Central Luxury',
    propertyAddress: '123 Đồng Khởi, Quận 1, TP. Hồ Chí Minh',
    propertyPhone: '0901234567',
    roomTypeName: 'Phòng Deluxe Hướng Phố',
    assignedRoomNumber: '302',
    rentalType: 'Daily',
    startAtUtc: '2026-10-25T14:00:00Z',
    endAtUtc: '2026-10-27T12:00:00Z',
    checkInDate: '25/10/2026',
    checkOutDate: '27/10/2026',
    numberOfGuests: 2,
    totalAmount: 2400000,
    depositRequired: 720000,
    paidAmount: 720000,
    remainingBalance: 1680000,
    isFullyPaid: false,
    status: 'Confirmed',
    guestName: 'Nguyễn Văn A',
    maskedGuestName: 'N***n V*n A',
    maskedGuestEmail: 'n***@gmail.com',
    createdAtUtc: new Date().toISOString(),
    breakdown: []
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockBookingService = {
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBooking)),
      submitReview: vi.fn().mockReturnValue(of({ success: true }))
    };

    mockAlertService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [BookingLookupPageComponent],
      providers: [
        provideRouter([]),
        { provide: Router, useValue: mockRouter },
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({})
          }
        }
      ]
    });

    fixture = TestBed.createComponent(BookingLookupPageComponent);
    component = fixture.componentInstance;
  });

  it('1. should initialize with default state and not search if token is empty', () => {
    component.searchToken = '   ';
    component.onSearch();

    expect(mockBookingService.getBookingByToken).not.toHaveBeenCalled();
    expect(component.booking()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('2. should search and load booking successfully on valid token', () => {
    component.searchToken = 'sample-lookup-token-123';
    component.onSearch();

    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('sample-lookup-token-123');
    expect(component.booking()).toEqual(sampleBooking);
    expect(component.isLoading()).toBe(false);
  });

  it('3. should handle error when booking token is not found', () => {
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => new Error('Not found')));

    component.searchToken = 'invalid-token-xyz';
    component.onSearch();

    expect(component.isLoading()).toBe(false);
    expect(component.booking()).toBeNull();
    expect(mockAlertService.error).toHaveBeenCalledWith('Không tìm thấy thông tin đặt phòng với mã token này. Vui lòng kiểm tra lại.');
  });

  it('4. should auto-trigger search on init if queryParam token is present', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingLookupPageComponent],
      providers: [
        provideRouter([]),
        { provide: Router, useValue: mockRouter },
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ token: 'query-token-999' })
          }
        }
      ]
    });

    const autoFixture = TestBed.createComponent(BookingLookupPageComponent);
    const autoComponent = autoFixture.componentInstance;
    autoFixture.detectChanges();

    expect(autoComponent.searchToken).toBe('query-token-999');
    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('query-token-999');
  });

  it('5. should map status badge classes correctly for all statuses', () => {
    expect(component.getStatusBadgeClass('Hold')).toContain('amber');
    expect(component.getStatusBadgeClass('Confirmed')).toContain('indigo');
    expect(component.getStatusBadgeClass('CheckedIn')).toContain('emerald');
    expect(component.getStatusBadgeClass('CheckedOut')).toContain('slate-100');
    expect(component.getStatusBadgeClass('Cancelled')).toContain('rose');
    expect(component.getStatusBadgeClass('Unknown')).toContain('slate-50');
  });

  it('6. should map status labels in Vietnamese correctly', () => {
    expect(component.getStatusLabel('Hold')).toBe('Đang giữ phòng (Chờ nộp cọc)');
    expect(component.getStatusLabel('Confirmed')).toBe('Đã xác nhận đặt phòng');
    expect(component.getStatusLabel('CheckedIn')).toBe('Đang lưu trú tại cơ sở');
    expect(component.getStatusLabel('CheckedOut')).toBe('Đã trả phòng (Hoàn tất)');
    expect(component.getStatusLabel('Cancelled')).toBe('Đã hủy');
    expect(component.getStatusLabel('CustomStatus')).toBe('CustomStatus');
  });

  it('7. should trigger window.print when printConfirmation is called', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.printConfirmation();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('8. should submit review successfully when comment is provided and booking exists', () => {
    component.booking.set({
      ...sampleBooking,
      status: 'CheckedOut'
    });
    component.userRating.set(5);
    component.reviewComment = 'Khách sạn phục vụ rất nhiệt tình, phòng ốc sạch sẽ!';

    component.submitReview();

    expect(mockBookingService.submitReview).toHaveBeenCalledWith({
      lookupToken: sampleBooking.lookupToken,
      rating: 5,
      comment: 'Khách sạn phục vụ rất nhiệt tình, phòng ốc sạch sẽ!'
    });
    expect(component.reviewSubmitted()).toBe(true);
    expect(mockAlertService.success).toHaveBeenCalledWith('Đã gửi đánh giá thành công.');
  });

  it('9. should not submit review if comment is empty or booking is missing', () => {
    component.booking.set(null);
    component.reviewComment = 'Tuyệt vời!';
    component.submitReview();
    expect(mockBookingService.submitReview).not.toHaveBeenCalled();

    component.booking.set(sampleBooking);
    component.reviewComment = '   ';
    component.submitReview();
    expect(mockBookingService.submitReview).not.toHaveBeenCalled();
  });
});
