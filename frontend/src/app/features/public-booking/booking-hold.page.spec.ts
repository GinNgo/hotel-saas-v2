import '@angular/compiler';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingHoldPageComponent } from './booking-hold.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto, PublicPropertyDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';

describe('BookingHoldPageComponent (Hold & Countdown Tests)', () => {
  let fixture: ComponentFixture<BookingHoldPageComponent>;
  let component: BookingHoldPageComponent;
  let mockBookingService: {
    getBookingByToken: ReturnType<typeof vi.fn>;
    getPropertyBySlug: ReturnType<typeof vi.fn>;
    calculateQuote: ReturnType<typeof vi.fn>;
    createHold: ReturnType<typeof vi.fn>;
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
    reservationId: 'res-hold-123',
    confirmationCode: 'CONF-12345',
    lookupToken: 'sample-token-abc',
    propertyId: 'prop-123',
    propertyName: 'Khách Sạn Sài Gòn Central',
    propertyAddress: '123 Đồng Khởi, Q1',
    propertyPhone: '0901234567',
    roomTypeName: 'Phòng Deluxe Giường Đôi',
    assignedRoomNumber: '101',
    rentalType: 'Daily',
    startAtUtc: '2026-10-25T14:00:00Z',
    endAtUtc: '2026-10-26T12:00:00Z',
    totalAmount: 1200000,
    depositRequired: 360000,
    paidAmount: 0,
    remainingBalance: 1200000,
    isFullyPaid: false,
    status: 'Hold',
    numberOfGuests: 2,
    holdExpiresAtUtc: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    smartLockPin: '8899',
    maskedGuestName: 'N***n V*n A',
    maskedGuestEmail: 'n***@gmail.com',
    createdAtUtc: new Date().toISOString(),
    breakdown: []
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockBookingService = {
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBooking)),
      getPropertyBySlug: vi.fn().mockReturnValue(of({ slug: 'saigon-central', name: 'Khách Sạn Sài Gòn Central' } as PublicPropertyDto)),
      calculateQuote: vi.fn().mockReturnValue(of({
        totalAmount: 1200000,
        depositRequired: 360000,
        expiresAtUtc: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      } as unknown as QuoteDto)),
      createHold: vi.fn().mockReturnValue(of({ lookupToken: 'new-token-xyz' }))
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
      imports: [BookingHoldPageComponent],
      providers: [
        provideRouter([]),
        { provide: Router, useValue: mockRouter },
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: AlertService, useValue: mockAlertService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'token' ? 'sample-token-abc' : null) },
              queryParams: {}
            }
          }
        }
      ]
    });

    fixture = TestBed.createComponent(BookingHoldPageComponent);
    component = fixture.componentInstance;
  });

  it('1. should format countdown seconds to mm:ss format accurately', () => {
    expect(component.formatCountdown(900)).toBe('15:00');
    expect(component.formatCountdown(65)).toBe('01:05');
    expect(component.formatCountdown(9)).toBe('00:09');
    expect(component.formatCountdown(0)).toBe('00:00');
  });

  it('2. should load booking by token on init and start countdown', () => {
    fixture.detectChanges();

    expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('sample-token-abc');
    expect(component.booking()).toEqual(sampleBooking);
    expect(component.isExpired()).toBe(false);
    expect(component.remainingSeconds()).toBeGreaterThan(0);
  });

  it('3. should redirect to booking status page if booking is already Confirmed', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of({
      ...sampleBooking,
      status: 'Confirmed'
    }));

    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/booking/status', 'sample-token-abc']);
  });

  it('4. should mark isExpired as true when remaining seconds is 0 or status is Expired', () => {
    mockBookingService.getBookingByToken.mockReturnValue(of({
      ...sampleBooking,
      status: 'Expired',
      holdExpiresAtUtc: new Date(Date.now() - 1000).toISOString()
    }));

    fixture.detectChanges();

    expect(component.isExpired()).toBe(true);
    expect(component.remainingSeconds()).toBe(0);
  });

  it('5. should handle booking not found error honestly without crashing', () => {
    mockBookingService.getBookingByToken.mockReturnValue(throwError(() => new Error('Not found')));

    fixture.detectChanges();

    expect(component.booking()).toBeNull();
    expect(component.error()).toContain('Không tìm thấy giữ phòng');
    expect(component.loading()).toBe(false);
  });

  it('6. should validate guest contact fields before submitting hold', () => {
    component.guestName = '';
    component.guestPhone = '';
    component.guestEmail = 'invalid-email';

    component.confirmBooking();

    expect(mockAlertService.error).toHaveBeenCalled();
    expect(mockBookingService.createHold).not.toHaveBeenCalled();
  });
});
