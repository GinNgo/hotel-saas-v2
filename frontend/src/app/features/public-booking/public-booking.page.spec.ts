import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).HTMLImageElement = win.HTMLImageElement;
  (globalThis as any).customElements = win.customElements;
  (globalThis as any).Node = win.Node;
  (globalThis as any).Event = win.Event;
  (globalThis as any).UIEvent = win.UIEvent;
  (globalThis as any).CustomEvent = win.CustomEvent;
  (globalThis as any).KeyboardEvent = win.KeyboardEvent;
  (globalThis as any).MouseEvent = win.MouseEvent;
  (globalThis as any).MutationObserver = win.MutationObserver;
}

import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { BookingPage, RoomImageRenderContext } from './booking.page';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized in test environment
}
import { BookingHoldPage } from './booking-hold.page';
import { BookingStatusPage } from './booking-status.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import {
  PublicPropertyDto,
  PublicRoomTypeAvailabilityDto,
  GuestHoldDto,
  GuestBookingDetailDto
} from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';

describe('Public Booking Pages (P5-GUEST-BOOKING-01)', () => {
  let mockBookingService: any;
  let mockAlertService: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  const sampleProperties: PublicPropertyDto[] = [
    {
      id: 'prop-1',
      name: 'Khách Sạn Biển Đông',
      code: 'BD01',
      slug: 'bien-dong-01',
      address: '200 Vo Nguyen Giap',
      city: 'Da Nang',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bufferMinutes: 30,
      maxHourlyHours: 12
    }
  ];

  const sampleAvailability: PublicRoomTypeAvailabilityDto[] = [
    {
      roomTypeId: 'rt-1',
      roomTypeName: 'Deluxe Ocean View',
      description: 'Phòng view biển',
      maxOccupancy: 2,
      bedType: 'King Bed',
      squareMeters: 35,
      totalRooms: 5,
      availableRooms: 3,
      isAvailable: true,
      estimatedPrice: 1000000
    }
  ];

  const sampleQuote: QuoteDto = {
    totalAmount: 1000000,
    currency: 'VND',
    breakdown: [
      { description: 'Tiền phòng 1 đêm', unitPrice: 1000000, quantity: 1, amount: 1000000 }
    ],
    appliedPolicies: {
      maxHourlyHours: 12,
      bufferMinutes: 30,
      checkInTime: '14:00',
      checkOutTime: '12:00'
    }
  };

  const sampleHold: GuestHoldDto = {
    reservationId: 'res-001',
    confirmationCode: 'RES-TEST01',
    lookupToken: 'token-test-1234567890abcdef',
    propertyId: 'prop-1',
    propertyName: 'Khách Sạn Biển Đông',
    roomTypeId: 'rt-1',
    roomTypeName: 'Deluxe Ocean View',
    assignedRoomId: 'room-101',
    assignedRoomNumber: '101',
    rentalType: 'Overnight',
    startAtUtc: '2026-10-15T07:00:00Z',
    endAtUtc: '2026-10-16T05:00:00Z',
    checkInDate: '2026-10-15',
    checkOutDate: '2026-10-16',
    totalAmount: 1000000,
    depositRequired: 300000,
    currency: 'VND',
    holdExpiresAtUtc: '2026-10-15T07:15:00Z',
    secondsRemaining: 900,
    status: 'PendingPayment',
    breakdown: sampleQuote.breakdown
  };

  const sampleDetail: GuestBookingDetailDto = {
    reservationId: 'res-001',
    confirmationCode: 'RES-TEST01',
    lookupToken: 'token-test-1234567890abcdef',
    propertyId: 'prop-1',
    propertyName: 'Khách Sạn Biển Đông',
    propertyAddress: '200 Vo Nguyen Giap',
    roomTypeName: 'Deluxe Ocean View',
    rentalType: 'Overnight',
    startAtUtc: '2026-10-15T07:00:00Z',
    endAtUtc: '2026-10-16T05:00:00Z',
    checkInDate: '2026-10-15',
    checkOutDate: '2026-10-16',
    numberOfGuests: 2,
    totalAmount: 1000000,
    depositRequired: 300000,
    paidAmount: 300000,
    remainingBalance: 700000,
    isFullyPaid: false,
    status: 'Confirmed',
    maskedGuestName: 'N***h',
    maskedGuestEmail: 'n***h@example.com',
    maskedGuestPhone: '090****567',
    holdExpiresAtUtc: '2026-10-15T07:15:00Z',
    secondsRemaining: 850,
    createdAtUtc: '2026-10-15T07:00:00Z',
    breakdown: sampleQuote.breakdown
  };

  beforeEach(() => {
    mockBookingService = {
      getProperties: vi.fn().mockReturnValue(of(sampleProperties)),
      getPropertyBySlug: vi.fn().mockReturnValue(of(sampleProperties[0])),
      getRoomTypes: vi.fn().mockReturnValue(of([])),
      getAvailability: vi.fn().mockReturnValue(of(sampleAvailability)),
      calculateQuote: vi.fn().mockReturnValue(of(sampleQuote)),
      createHold: vi.fn().mockReturnValue(of(sampleHold)),
      getBookingByToken: vi.fn().mockReturnValue(of(sampleDetail)),
      confirmBooking: vi.fn().mockReturnValue(of(sampleDetail))
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      toastInfo: vi.fn(),
      toastWarning: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'token') return 'token-test-1234567890abcdef';
            return null;
          })
        }
      }
    };
  });

  describe('1. BookingPage', () => {
    let component: BookingPage;

    beforeEach(() => {
      const injector = Injector.create({
        providers: [
          BookingPage,
          FormBuilder,
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService },
          { provide: Router, useValue: mockRouter }
        ]
      });

      component = runInInjectionContext(injector, () => injector.get(BookingPage));
    });

    it('should initialize and load properties without auto-selecting any property or availability in two-step discovery', () => {
      component.ngOnInit();

      expect(mockBookingService.getProperties).toHaveBeenCalled();
      expect(component.properties().length).toBe(1);
      expect(component.selectedProperty()).toBeNull();
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
      expect(component.availabilityList().length).toBe(0);
    });

    it('should select a room type and load authoritative quote breakdown without hardcoding deposit', () => {
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.selectRoomType(sampleAvailability[0]);

      expect(component.selectedRoomTypeId()).toBe('rt-1');
      expect(mockBookingService.calculateQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          propertySlug: 'bien-dong-01',
          roomTypeId: 'rt-1',
          rentalType: 2
        })
      );
      expect(component.currentQuote()?.totalAmount).toBe(1000000);
      // Deposit is not estimated client-side; calculateDeposit must be undefined
      expect((component as any).calculateDeposit).toBeUndefined();
    });

    it('should submit hold request and navigate to /booking/hold/:token upon success', () => {
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.selectRoomType(sampleAvailability[0]);

      component.guestForm.patchValue({
        guestName: 'Nguyen Van A',
        guestEmail: 'nguyen.a@example.com',
        guestPhone: '0901234567',
        numberOfGuests: 2
      });

      component.submitHold();

      expect(mockBookingService.createHold).toHaveBeenCalledWith(
        expect.objectContaining({
          propertySlug: 'bien-dong-01',
          roomTypeId: 'rt-1',
          guestName: 'Nguyen Van A',
          guestEmail: 'nguyen.a@example.com'
        })
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/booking/hold', 'token-test-1234567890abcdef']);
    });

    it('should search properties with query keyword and update property list', () => {
      component.propertySearchControl.setValue('da nang');
      component.applyPropertySearch();

      expect(mockBookingService.getProperties).toHaveBeenCalledWith('da nang');
    });

    it('should enforce latest-request-wins race condition guard (stale response is discarded)', () => {
      const subject1 = new Subject<PublicPropertyDto[]>();
      const subject2 = new Subject<PublicPropertyDto[]>();

      mockBookingService.getProperties
        .mockReturnValueOnce(subject1.asObservable())
        .mockReturnValueOnce(subject2.asObservable());

      // Request 1 fired (e.g. "sai gon")
      component.loadProperties('sai gon');
      expect(component.isLoadingProperties()).toBe(true);

      // Request 2 fired immediately after (e.g. "da nang")
      component.loadProperties('da nang');
      expect(component.isLoadingProperties()).toBe(true);

      // Request 2 resolves first with Da Nang
      const daNangProps = [sampleProperties[0]];
      subject2.next(daNangProps);
      subject2.complete();

      expect(component.isLoadingProperties()).toBe(false);
      expect(component.properties()).toEqual(daNangProps);

      // Request 1 resolves later with stale Sai Gon data
      const staleProps: PublicPropertyDto[] = [{
        id: 'prop-stale',
        name: 'Khách Sạn Sài Gòn Stale',
        code: 'SGS',
        slug: 'sai-gon-stale',
        address: '123 Le Loi',
        city: 'TP HCM',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bufferMinutes: 30,
        maxHourlyHours: 12
      }];
      subject1.next(staleProps);
      subject1.complete();

      // State MUST remain Da Nang (stale request 1 discarded)
      expect(component.properties()).toEqual(daNangProps);
      expect(component.properties()[0].slug).toBe('bien-dong-01');
    });

    it('should handle empty property search results gracefully and clear selected property', () => {
      mockBookingService.getProperties.mockReturnValue(of([]));

      component.propertySearchControl.setValue('Không tồn tại');
      component.applyPropertySearch();

      expect(component.properties().length).toBe(0);
      expect(component.selectedProperty()).toBeNull();
      expect(component.availabilityList().length).toBe(0);
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
    });

    it('should handle property search error and allow retry', () => {
      mockBookingService.getProperties.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Mạng bị gián đoạn' } }))
      );

      component.loadProperties('bien dong');

      expect(component.isLoadingProperties()).toBe(false);
      expect(component.propertiesError()).toBe('Mạng bị gián đoạn');
      expect(mockAlertService.toastError).toHaveBeenCalledWith('Mạng bị gián đoạn');

      // Retry
      mockBookingService.getProperties.mockReturnValueOnce(of(sampleProperties));
      component.retryLoadProperties();

      expect(component.propertiesError()).toBeNull();
      expect(component.properties().length).toBe(1);
    });

    it('should clear property search and reload full property list', () => {
      component.propertySearchControl.setValue('ha noi');
      component.clearPropertySearch();

      expect(component.propertySearchControl.value).toBe('');
      expect(mockBookingService.getProperties).toHaveBeenCalledWith(undefined);
    });

    it('should reset room selection and quote when search switches from Property A to Property B', () => {
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.selectRoomType(sampleAvailability[0]);
      expect(component.selectedRoomTypeId()).toBe('rt-1');
      expect(component.currentQuote()).not.toBeNull();

      // Search returns Property B
      const propB: PublicPropertyDto = {
        id: 'prop-2',
        name: 'Khách Sạn Sài Gòn Central',
        code: 'SGC',
        slug: 'sai-gon-central',
        address: '123 Le Loi',
        city: 'TP HCM',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bufferMinutes: 30,
        maxHourlyHours: 12
      };
      mockBookingService.getProperties.mockReturnValue(of([propB]));
      component.loadProperties('sai gon');

      // In two-step discovery: loading properties clears selection without auto-selecting
      expect(component.selectedProperty()).toBeNull();
      expect(component.selectedRoomTypeId()).toBeNull();
      expect(component.selectedRoomType()).toBeNull();
      expect(component.currentQuote()).toBeNull();

      // Explicit selection of Property B updates selection
      component.selectProperty(propB);
      expect(component.selectedProperty()?.slug).toBe('sai-gon-central');
    });

    it('should discard late availability response from Property A when Property B is now active', () => {
      const availSubjectA = new Subject<PublicRoomTypeAvailabilityDto[]>();
      const availSubjectB = new Subject<PublicRoomTypeAvailabilityDto[]>();

      mockBookingService.getAvailability
        .mockReturnValueOnce(availSubjectA.asObservable())
        .mockReturnValueOnce(availSubjectB.asObservable());

      // Property A is active and searching availability
      component.searchForm.patchValue({ propertySlug: 'property-a' });
      component.searchAvailability();
      expect(component.isLoadingAvailability()).toBe(true);

      // User switches to Property B
      component.searchForm.patchValue({ propertySlug: 'property-b' });
      component.searchAvailability();

      // Property B resolves first
      const availB: PublicRoomTypeAvailabilityDto[] = [{
        roomTypeId: 'rt-b',
        roomTypeName: 'Room B',
        description: 'Room in Property B',
        maxOccupancy: 2,
        bedType: 'Queen',
        squareMeters: 30,
        totalRooms: 10,
        availableRooms: 5,
        isAvailable: true,
        estimatedPrice: 800000
      }];
      availSubjectB.next(availB);
      availSubjectB.complete();

      expect(component.isLoadingAvailability()).toBe(false);
      expect(component.availabilityList()).toEqual(availB);

      // Property A resolves later (stale cross-property response)
      const availA: PublicRoomTypeAvailabilityDto[] = [{
        roomTypeId: 'rt-a',
        roomTypeName: 'Room A Stale',
        description: 'Room in Property A',
        maxOccupancy: 2,
        bedType: 'King',
        squareMeters: 40,
        totalRooms: 5,
        availableRooms: 1,
        isAvailable: true,
        estimatedPrice: 1500000
      }];
      availSubjectA.next(availA);
      availSubjectA.complete();

      // Invariant: Availability list MUST still contain Property B rooms, NOT Property A rooms
      expect(component.availabilityList()).toEqual(availB);
      expect(component.availabilityList()[0].roomTypeId).toBe('rt-b');
    });

    it('should clear selection and discard pending Property A availability when search yields empty results', () => {
      // 1. Initial load with rooms available
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.selectRoomType(sampleAvailability[0]);
      expect(component.selectedRoomTypeId()).toBe('rt-1');

      // 2. Set up pending availability request for Property A
      const pendingAvailSubject = new Subject<PublicRoomTypeAvailabilityDto[]>();
      mockBookingService.getAvailability.mockReturnValue(pendingAvailSubject.asObservable());
      component.searchAvailability();
      expect(component.isLoadingAvailability()).toBe(true);

      // 3. Search yields no properties
      mockBookingService.getProperties.mockReturnValue(of([]));
      component.loadProperties('Khách sạn không tồn tại');

      expect(component.selectedProperty()).toBeNull();
      expect(component.selectedRoomTypeId()).toBeNull();
      expect(component.selectedRoomType()).toBeNull();
      expect(component.currentQuote()).toBeNull();
      expect(component.availabilityList().length).toBe(0);

      // Late response from previously pending availability arrives
      pendingAvailSubject.next(sampleAvailability);
      pendingAvailSubject.complete();

      // Invariant: Availability list must remain empty, never revived by stale response
      expect(component.availabilityList().length).toBe(0);
    });

    it('should immediately clear availabilityList and reject selectRoomType for Card A while Property B is pending', () => {
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      expect(component.availabilityList().length).toBe(1);

      // Search returns Property B, but its availability request is pending
      const pendingSubjectB = new Subject<PublicRoomTypeAvailabilityDto[]>();
      mockBookingService.getAvailability.mockReturnValue(pendingSubjectB.asObservable());

      const propB: PublicPropertyDto = {
        id: 'prop-2',
        name: 'Khách Sạn Sài Gòn Central',
        code: 'SGC',
        slug: 'sai-gon-central',
        address: '123 Le Loi',
        city: 'TP HCM',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bufferMinutes: 30,
        maxHourlyHours: 12
      };
      mockBookingService.getProperties.mockReturnValue(of([propB]));
      component.loadProperties('sai gon');

      // Invariant 1: availabilityList for Property A MUST be immediately cleared before B resolves
      expect(component.availabilityList().length).toBe(0);

      // User attempts to click a stale Card A from Property A
      component.selectRoomType(sampleAvailability[0]);

      // Invariant 2: Provenance check rejects Card A, selection remains null
      expect(component.selectedRoomTypeId()).toBeNull();
      expect(component.selectedRoomType()).toBeNull();
      expect(component.currentQuote()).toBeNull();
    });

    it('should clear availability and discard stale response when search criteria changes without manual search', () => {
      const pendingAvailSubject = new Subject<PublicRoomTypeAvailabilityDto[]>();
      mockBookingService.getAvailability.mockReturnValue(pendingAvailSubject.asObservable());

      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.searchAvailability();
      expect(component.isLoadingAvailability()).toBe(true);

      // User changes stay dates or rental type
      component.onSearchCriteriaChange();
      expect(component.availabilityList().length).toBe(0);
      expect(component.isLoadingAvailability()).toBe(false);

      // Stale response from old date criteria resolves later
      pendingAvailSubject.next(sampleAvailability);
      pendingAvailSubject.complete();

      // Invariant: Late response for old dates is discarded, availability remains empty
      expect(component.availabilityList().length).toBe(0);
    });

    it('should debounce input changes by 300ms using fake timers and avoid duplicate requests on clear or destroy', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();

        // 1. Rapid keystrokes within 300ms
        component.propertySearchControl.setValue('s');
        vi.advanceTimersByTime(100);
        component.propertySearchControl.setValue('sa');
        vi.advanceTimersByTime(100);
        component.propertySearchControl.setValue('sai');
        vi.advanceTimersByTime(100);

        // Not yet emitted due to debounce
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();

        // Advance remaining 200ms (total 300ms since last change)
        vi.advanceTimersByTime(200);
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
        expect(mockBookingService.getProperties).toHaveBeenCalledWith('sai');

        // 2. Clear search does not duplicate
        mockBookingService.getProperties.mockClear();
        component.clearPropertySearch();
        vi.advanceTimersByTime(500);
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
        expect(mockBookingService.getProperties).toHaveBeenCalledWith(undefined);

        // 3. ngOnDestroy unsubscribes so pending responses do not update state
        const pendingSub = new Subject<PublicPropertyDto[]>();
        mockBookingService.getProperties.mockReturnValue(pendingSub.asObservable());
        component.loadProperties('test');
        expect(component.isLoadingProperties()).toBe(true);

        component.ngOnDestroy();
        pendingSub.next([{ ...sampleProperties[0], name: 'Should Not Apply Post Destroy' }]);

        expect(component.properties()[0].name).toBe('Khách Sạn Biển Đông');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should cancel pending debounce timer when clearPropertySearch is called before 300ms', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();

        // 1. User types "A" into search box
        component.propertySearchControl.setValue('A');
        vi.advanceTimersByTime(100); // 100ms: timer is pending in debounce window
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();

        // 2. User clicks "✕" (Clear) before 300ms expires
        component.clearPropertySearch();

        // Immediate query for undefined must have been triggered
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
        expect(mockBookingService.getProperties).toHaveBeenCalledWith(undefined);

        // 3. Advance timers past original 300ms debounce threshold (500ms total)
        vi.advanceTimersByTime(500);

        // Assert: Pending "A" was canceled and NOT re-applied; request count remains exactly 1
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
        expect(component.propertySearchControl.value).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should cancel pending debounce timer when applyPropertySearch is called before 300ms and avoid duplicate request', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();

        // 1. User types "A" into search box
        component.propertySearchControl.setValue('A');
        vi.advanceTimersByTime(100); // 100ms: timer is pending in debounce window
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();

        // 2. User clicks "Tìm" (Manual search) before 300ms expires
        component.applyPropertySearch();

        // Immediate query for "A" must have been triggered
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
        expect(mockBookingService.getProperties).toHaveBeenCalledWith('A');

        // 3. Advance timers past original 300ms debounce threshold (500ms total)
        vi.advanceTimersByTime(500);

        // Assert: In-flight timer must NOT fire duplicate request at 300ms; total remains exactly 1
        expect(mockBookingService.getProperties).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reset isLoadingQuote and isLoadingAvailability to false when search criteria changes while requests are pending', () => {
      const pendingQuoteSub = new Subject<QuoteDto>();
      const pendingAvailSub = new Subject<PublicRoomTypeAvailabilityDto[]>();
      mockBookingService.calculateQuote.mockReturnValue(pendingQuoteSub.asObservable());
      mockBookingService.getAvailability.mockReturnValue(pendingAvailSub.asObservable());

      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.searchAvailability();
      expect(component.isLoadingAvailability()).toBe(true);

      component.selectedProperty.set(sampleProperties[0]);
      component.availabilityList.set(sampleAvailability);
      component.selectRoomType(sampleAvailability[0]);
      expect(component.isLoadingQuote()).toBe(true);

      // User changes stay dates or rental type
      component.onSearchCriteriaChange();

      // Both loading flags must be synchronously reset to false to avoid perpetual spinners
      expect(component.isLoadingAvailability()).toBe(false);
      expect(component.isLoadingQuote()).toBe(false);
      expect(component.selectedRoomTypeId()).toBeNull();
      expect(component.currentQuote()).toBeNull();
    });

    it('should reset isLoadingAvailability and isLoadingQuote to false when search yields empty results while requests are pending', () => {
      const pendingAvailSub = new Subject<PublicRoomTypeAvailabilityDto[]>();
      mockBookingService.getAvailability.mockReturnValue(pendingAvailSub.asObservable());

      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.searchAvailability();
      expect(component.isLoadingAvailability()).toBe(true);

      // Now a search query returns 0 properties
      mockBookingService.getProperties.mockReturnValue(of([]));
      component.loadProperties('non-existent');

      // Both loading flags must be synchronously reset to false
      expect(component.isLoadingAvailability()).toBe(false);
      expect(component.isLoadingQuote()).toBe(false);
      expect(component.properties().length).toBe(0);
      expect(component.selectedProperty()).toBeNull();
    });

    it('should select a property via selectProperty card click, updating slug and checking availability', () => {
      component.ngOnInit();
      const prop2: PublicPropertyDto = {
        id: 'prop-2',
        name: 'Khách Sạn Sài Gòn Central',
        code: 'SGC',
        slug: 'sai-gon-central',
        address: '123 Le Loi',
        city: 'TP HCM',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bufferMinutes: 30,
        maxHourlyHours: 12
      };
      component.properties.set([sampleProperties[0], prop2]);

      // Click card for property 2
      component.selectProperty(prop2);

      expect(component.selectedProperty()?.id).toBe('prop-2');
      expect(component.searchForm.get('propertySlug')?.value).toBe('sai-gon-central');
      expect(mockBookingService.getAvailability).toHaveBeenCalledWith(
        'sai-gon-central',
        expect.objectContaining({ rentalType: 2 })
      );
    });

    it('should switch rental type via setRentalType tab click, updating form value and triggering availability check', () => {
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      mockBookingService.getAvailability.mockClear();

      // Switch to Hourly (1)
      component.setRentalType(1);

      expect(component.searchForm.get('rentalType')?.value).toBe(1);
      expect(mockBookingService.getAvailability).toHaveBeenCalledWith(
        'bien-dong-01',
        expect.objectContaining({ rentalType: 1 })
      );

      // Calling setRentalType with same value is a no-op
      mockBookingService.getAvailability.mockClear();
      component.setRentalType(1);
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
    });

    it('should guard selectProperty against stale property cards and loading/error states', () => {
      component.ngOnInit();
      const activeProp: PublicPropertyDto = sampleProperties[0];
      const staleProp: PublicPropertyDto = {
        id: 'prop-stale',
        name: 'Stale Property Not In Current List',
        code: 'STALE',
        slug: 'stale-property',
        address: '999 Old St',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bufferMinutes: 30,
        maxHourlyHours: 12
      };

      component.properties.set([activeProp]);
      component.selectProperty(activeProp);
      mockBookingService.getAvailability.mockClear();

      // 1. Stale property not in properties() list must be blocked
      expect(component.isPropertySelectable(staleProp)).toBe(false);
      component.selectProperty(staleProp);
      expect(component.selectedProperty()?.id).toBe('prop-1'); // Not changed to prop-stale
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      // 2. When properties search is currently loading, selectProperty must be blocked
      component.isLoadingProperties.set(true);
      expect(component.isPropertySelectable(activeProp)).toBe(false);
      component.selectProperty(activeProp);
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
      component.isLoadingProperties.set(false);

      // 3. When properties search encountered an error, selectProperty must be blocked
      component.propertiesError.set('Network error loading properties');
      expect(component.isPropertySelectable(activeProp)).toBe(false);
      component.selectProperty(activeProp);
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
      component.propertiesError.set(null);

      // 4. When properties list is empty, selectProperty must be blocked
      component.properties.set([]);
      expect(component.isPropertySelectable(activeProp)).toBe(false);
      component.selectProperty(activeProp);
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
    });

    it('should clear quote immediately when switching room types and prevent holding stale quote during pending or failed quote request', () => {
      const roomA: PublicRoomTypeAvailabilityDto = sampleAvailability[0];
      const roomB: PublicRoomTypeAvailabilityDto = {
        ...sampleAvailability[0],
        roomTypeId: 'rt-2',
        roomTypeName: 'Executive Suite',
        estimatedPrice: 2000000
      };
      const quoteA: QuoteDto = {
        ...sampleQuote,
        roomTypeId: 'rt-1',
        totalAmount: 1000000
      };
      const quoteB: QuoteDto = {
        ...sampleQuote,
        roomTypeId: 'rt-2',
        totalAmount: 2000000
      };

      component.ngOnInit();
      component.properties.set(sampleProperties);
      component.selectProperty(sampleProperties[0]);
      component.availabilityList.set([roomA, roomB]);

      // 1. User selects room A and quote A loads
      mockBookingService.calculateQuote.mockReturnValue(of(quoteA));
      component.selectRoomType(roomA);
      expect(component.selectedRoomTypeId()).toBe('rt-1');
      expect(component.currentQuote()?.totalAmount).toBe(1000000);

      // 2. User switches to room B with a pending quote request
      const pendingQuoteBSub = new Subject<QuoteDto>();
      mockBookingService.calculateQuote.mockReturnValue(pendingQuoteBSub.asObservable());

      component.selectRoomType(roomB);
      expect(component.selectedRoomTypeId()).toBe('rt-2');
      // Crucial: currentQuote must be synchronously cleared to null so quote A is not displayed or held
      expect(component.currentQuote()).toBeNull();
      expect(component.isLoadingQuote()).toBe(true);

      // Attempting to submit hold while quote B is in-flight must be rejected
      component.guestForm.patchValue({
        guestName: 'Tran Van B',
        guestEmail: 'tran.b@example.com',
        numberOfGuests: 2
      });
      mockBookingService.createHold.mockClear();
      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();

      // 3. If quote B fails with error, currentQuote remains null and submitHold remains blocked
      pendingQuoteBSub.error({ error: { message: 'Pricing service timeout' } });
      expect(component.isLoadingQuote()).toBe(false);
      expect(component.currentQuote()).toBeNull();
      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();

      // 4. When quote B succeeds on retry, currentQuote is updated and hold can proceed
      mockBookingService.calculateQuote.mockReturnValue(of(quoteB));
      component.loadQuote('rt-2');
      expect(component.currentQuote()?.totalAmount).toBe(2000000);
      expect(component.currentQuote()?.roomTypeId).toBe('rt-2');

      component.submitHold();
      expect(mockBookingService.createHold).toHaveBeenCalledWith(
        expect.objectContaining({
          roomTypeId: 'rt-2',
          expectedTotalAmount: 2000000
        })
      );
    });

    it('should guard submitHold against double-submit and mismatched quote provenance', () => {
      component.ngOnInit();
      component.properties.set(sampleProperties);
      component.selectProperty(sampleProperties[0]);
      component.availabilityList.set(sampleAvailability);
      component.selectRoomType(sampleAvailability[0]);

      component.guestForm.patchValue({
        guestName: 'Le Thi C',
        guestEmail: 'le.c@example.com',
        numberOfGuests: 1
      });

      mockBookingService.createHold.mockClear();

      // 1. Double submit guard: when isSubmittingHold is true, second call is ignored
      component.isSubmittingHold.set(true);
      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();
      component.isSubmittingHold.set(false);

      // 2. Mismatched quote provenance: quote roomTypeId differs from selectedRoomType
      const mismatchedQuote: QuoteDto = {
        ...sampleQuote,
        roomTypeId: 'rt-different-room'
      };
      component.currentQuote.set(mismatchedQuote);
      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();
    });

    it('should have accessible rental button group with aria-pressed semantics and without redundant select element', () => {
      component.ngOnInit();
      // Default rental type is Overnight (2)
      expect(component.searchForm.get('rentalType')?.value).toBe(2);

      // Switching rental type updates form state correctly
      component.setRentalType(1);
      expect(component.searchForm.get('rentalType')?.value).toBe(1);

      // Verify calculateDeposit does not exist on component instance
      expect((component as any).calculateDeposit).toBeUndefined();

      // Verify Component Definition metadata exists in Ivy
      const cmpDef = (BookingPage as any).ɵcmp;
      expect(cmpDef).toBeDefined();

      // Assert template content directly from source file
      const fs = require('fs');
      const path = require('path');
      const templateContent = fs.readFileSync(path.resolve(__dirname, 'booking.page.ts'), 'utf8');
      // Extract template HTML from component source
      const templateMatch = templateContent.match(/template:\s*`([\s\S]*?)`\s*\n\}\)/);
      expect(templateMatch).not.toBeNull();
      const template = templateMatch ? templateMatch[1] : templateContent;

      // 1. Assert rental button group has role="group" and accessible label
      expect(template).toContain('role="group"');
      expect(template).toContain('aria-label="Hình thức thuê phòng"');

      // 2. Assert rental buttons use dynamic aria-pressed binding
      expect(template).toContain('[attr.aria-pressed]="searchForm.get(\'rentalType\')?.value === 2"');
      expect(template).toContain('[attr.aria-pressed]="searchForm.get(\'rentalType\')?.value === 1"');

      // 3. Assert redundant propertySlugSelect element has been completely removed
      expect(template).not.toContain('id="propertySlugSelect"');
      expect(template).not.toContain('propertySlugSelect');

      // 4. Assert sticky bottom bar has responsive layout and accessible CTA button ID
      expect(template).toContain('id="stickyBottomCtaButton"');
      expect(template).toContain('id="stickySummaryBar"');
      expect(template).toContain('w-full sm:w-auto');
      expect(template).toContain('pb-36 sm:pb-28');

      // 5. Assert semantic DOM template matches expected structure
      const roleGroupMatch = template.match(/<div[^>]*role="group"[^>]*aria-label="Hình thức thuê phòng"[^>]*>([\s\S]*?)<\/div>/);
      expect(roleGroupMatch).not.toBeNull();
      if (roleGroupMatch) {
        const groupInner = roleGroupMatch[1];
        expect(groupInner).toContain('[attr.aria-pressed]="searchForm.get(\'rentalType\')?.value === 2"');
        expect(groupInner).toContain('[attr.aria-pressed]="searchForm.get(\'rentalType\')?.value === 1"');
      }

      const stickyMatch = template.match(/<button[^>]*id="stickyBottomCtaButton"[^>]*>([\s\S]*?)<\/button>/);
      expect(stickyMatch).not.toBeNull();
      if (stickyMatch) {
        expect(stickyMatch[0]).toContain('w-full sm:w-auto');
      }
    });

    it('should execute 2-step search CTA behavior: search properties when no property selected vs search availability when property and valid dates selected', () => {
      component.ngOnInit();
      const mockPropertyListEl = { scrollIntoView: vi.fn() };
      const mockAvailEl = { scrollIntoView: vi.fn() };
      const originalDocument = (global as any).document;
      (global as any).document = {
        getElementById: vi.fn((id: string) => {
          if (id === 'propertyListSection') return mockPropertyListEl;
          if (id === 'availabilitySection') return mockAvailEl;
          return null;
        })
      };

      try {
        // --- Step 1: No property selected ---
        component.selectedProperty.set(null);
        component.searchForm.patchValue({ propertySlug: '' });
        component.propertySearchControl.setValue('Đà Nẵng', { emitEvent: false });

        // Search returns pending observable so availability is not auto-triggered
        const pendingSubject = new Subject<PublicPropertyDto[]>();
        mockBookingService.getProperties.mockReturnValue(pendingSubject.asObservable());
        mockBookingService.getAvailability.mockClear();

        component.handleMainSearchCta();

        // CTA must trigger property search and scroll to propertyListSection
        expect(mockBookingService.getProperties).toHaveBeenCalledWith('Đà Nẵng');
        expect(mockPropertyListEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
        // CTA must NOT query availability when no property is selected
        expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
        expect(component.isComboboxOpen()).toBe(false);

        // --- Step 2: Property selected with valid dates ---
        mockBookingService.getProperties.mockReturnValue(of(sampleProperties));
        component.selectedProperty.set(sampleProperties[0]);
        component.searchForm.patchValue({
          propertySlug: sampleProperties[0].slug,
          rentalType: 2,
          checkInDate: '2026-10-20',
          checkOutDate: '2026-10-22'
        });

        mockBookingService.getProperties.mockClear();
        mockBookingService.getAvailability.mockClear();

        component.handleMainSearchCta();

        // CTA must query availability and scroll to availabilitySection
        expect(mockBookingService.getAvailability).toHaveBeenCalledWith(
          sampleProperties[0].slug,
          expect.objectContaining({
            rentalType: 2,
            checkInDate: '2026-10-20',
            checkOutDate: '2026-10-22'
          })
        );
        expect(mockAvailEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();

        // --- Edge Case: Property selected but invalid dates (checkOut <= checkIn) ---
        component.searchForm.patchValue({
          checkInDate: '2026-10-22',
          checkOutDate: '2026-10-20'
        });
        mockBookingService.getAvailability.mockClear();
        mockAlertService.toastWarning.mockClear();

        component.handleMainSearchCta();

        // Availability API must NOT be called when dates are invalid
        expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
        expect(mockAlertService.toastWarning).toHaveBeenCalledWith('Vui lòng chọn ngày lưu trú hợp lệ.');
      } finally {
        if (originalDocument !== undefined) {
          (global as any).document = originalDocument;
        } else {
          delete (global as any).document;
        }
      }
    });

    it('should immediately invalidate property selection and dependent quote/availability before debounce timer fires when editing search input', () => {
      vi.useFakeTimers();
      component.ngOnInit();
      component.selectProperty(sampleProperties[0]);
      component.availabilityList.set(sampleAvailability);
      component.currentQuote.set(sampleQuote);
      expect(component.selectedProperty()).not.toBeNull();
      expect(component.availabilityList().length).toBe(1);
      expect(component.currentQuote()).not.toBeNull();

      mockBookingService.getProperties.mockClear();

      // User starts typing in combobox input
      component.propertySearchControl.setValue('Khách sạn mới');

      // Immediate Context Invalidation Contract:
      // Property, availability, and quote MUST be wiped synchronously before debounce fires!
      expect(component.selectedProperty()).toBeNull();
      expect(component.selectedRoomTypeId()).toBeNull();
      expect(component.selectedRoomType()).toBeNull();
      expect(component.currentQuote()).toBeNull();
      expect(component.availabilityList().length).toBe(0);
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(component.properties()).toEqual([]);
      expect(component.isLoadingProperties()).toBe(true);
      expect(component.isComboboxOpen()).toBe(true);
      expect(component.activeSuggestionIndex()).toBe(-1);
      expect(component.activeSuggestionId()).toBeUndefined();

      // Verify that backend getProperties has NOT been called yet (pending debounce)
      expect(mockBookingService.getProperties).not.toHaveBeenCalled();

      // Advance debounce timer by 300ms
      vi.advanceTimersByTime(300);

      // Now backend search is executed with typed query
      expect(mockBookingService.getProperties).toHaveBeenCalledWith('Khách sạn mới');

      vi.useRealTimers();
    });

    it('should guard date validity edges and auto-adjust checkout date with live announcement', () => {
      component.ngOnInit();

      // Overnight rental: checkInDate and checkOutDate validation
      component.searchForm.patchValue({ rentalType: 2 });

      // Null / empty dates
      component.searchForm.patchValue({ checkInDate: '', checkOutDate: '2026-10-25' });
      expect(component.areDatesValid()).toBe(false);

      component.searchForm.patchValue({ checkInDate: '2026-10-25', checkOutDate: '' });
      expect(component.areDatesValid()).toBe(false);

      // Equal dates (checkout <= checkin)
      component.searchForm.patchValue({ checkInDate: '2026-10-25', checkOutDate: '2026-10-25' });
      expect(component.areDatesValid()).toBe(false);

      // Reversed dates
      component.searchForm.patchValue({ checkInDate: '2026-10-26', checkOutDate: '2026-10-25' });
      expect(component.areDatesValid()).toBe(false);

      // Valid overnight dates
      component.searchForm.patchValue({ checkInDate: '2026-10-25', checkOutDate: '2026-10-26' });
      expect(component.areDatesValid()).toBe(true);

      // Hourly rental validation
      component.searchForm.patchValue({ rentalType: 1, hourlyDate: '2026-10-25', hourlyDurationHours: 3 });
      expect(component.areDatesValid()).toBe(true);

      component.searchForm.patchValue({ hourlyDate: '', hourlyDurationHours: 3 });
      expect(component.areDatesValid()).toBe(false);

      component.searchForm.patchValue({ hourlyDate: '2026-10-25', hourlyDurationHours: 0 });
      expect(component.areDatesValid()).toBe(false);

      // Auto check-out date adjustment when check-in is moved past check-out
      component.searchForm.patchValue({
        rentalType: 2,
        checkInDate: '2026-10-20',
        checkOutDate: '2026-10-21'
      });
      component.dateAdjustmentNotice.set('');

      // Move check-in to 2026-10-25 (>= checkout 2026-10-21)
      component.searchForm.patchValue({ checkInDate: '2026-10-25' });
      component.onDateChange('checkIn');

      expect(component.searchForm.get('checkOutDate')?.value).toBe('2026-10-26');
      expect(component.dateAdjustmentNotice()).toContain('2026-10-26');
      expect(component.nightCount()).toBe(1);

      // Auto check-out date adjustment forward when check-out is set before or equal to check-in (never move check-in backwards into the past)
      component.searchForm.patchValue({ checkOutDate: '2026-10-24' });
      component.onDateChange('checkOut');

      expect(component.searchForm.get('checkOutDate')?.value).toBe('2026-10-26');
      expect(component.searchForm.get('checkInDate')?.value).toBe('2026-10-25');
      expect(component.dateAdjustmentNotice()).toContain('2026-10-26');
      expect(component.nightCount()).toBe(1);
    });

    it('should manage guest stepper strictly on guestForm.numberOfGuests within 1-10 bounds without server filtering', () => {
      component.ngOnInit();

      // Initial value
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(1);

      // Decrement at lower bound (1) -> stays 1
      component.decrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(1);

      // Increment
      component.incrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(2);

      component.incrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(3);

      // Decrement
      component.decrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(2);

      // Upper bound (10)
      component.guestForm.patchValue({ numberOfGuests: 10 });
      component.incrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(10);

      // Verify no server-side availability filtering is triggered by guest count change
      mockBookingService.getAvailability.mockClear();
      component.decrementGuests();
      expect(component.guestForm.get('numberOfGuests')?.value).toBe(9);
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
    });

    it('should handle combobox keyboard navigation, option activation, selection, and escape closing', () => {
      component.ngOnInit();
      const testProps: PublicPropertyDto[] = [
        { ...sampleProperties[0], id: 'p1', name: 'Khách sạn A', slug: 'ks-a' },
        { ...sampleProperties[0], id: 'p2', name: 'Khách sạn B', slug: 'ks-b' },
        { ...sampleProperties[0], id: 'p3', name: 'Khách sạn C', slug: 'ks-c' }
      ];
      component.properties.set(testProps);

      // Initially closed
      expect(component.isComboboxOpen()).toBe(false);
      expect(component.activeSuggestionIndex()).toBe(-1);

      // ArrowDown when closed -> opens combobox and highlights index 0
      const eventDown = { key: 'ArrowDown', preventDefault: vi.fn() } as any;
      component.onComboboxKeydown(eventDown);
      expect(component.isComboboxOpen()).toBe(true);
      expect(component.activeSuggestionIndex()).toBe(0);
      expect(component.activeSuggestionId()).toBe('suggestion-0');

      // ArrowDown again -> highlights index 1
      component.onComboboxKeydown(eventDown);
      expect(component.activeSuggestionIndex()).toBe(1);
      expect(component.activeSuggestionId()).toBe('suggestion-1');

      // ArrowUp -> goes back to index 0
      const eventUp = { key: 'ArrowUp', preventDefault: vi.fn() } as any;
      component.onComboboxKeydown(eventUp);
      expect(component.activeSuggestionIndex()).toBe(0);

      // Enter -> selects highlighted option (Khách sạn A)
      const eventEnter = { key: 'Enter', preventDefault: vi.fn() } as any;
      component.onComboboxKeydown(eventEnter);

      expect(component.isComboboxOpen()).toBe(false);
      expect(component.propertySearchControl.value).toBe('Khách sạn A');
      expect(component.selectedProperty()?.slug).toBe('ks-a');

      // Re-open and Escape -> closes combobox and resets active index
      component.openCombobox();
      expect(component.isComboboxOpen()).toBe(true);

      const eventEscape = { key: 'Escape', preventDefault: vi.fn() } as any;
      component.onComboboxKeydown(eventEscape);
      expect(component.isComboboxOpen()).toBe(false);
      expect(component.activeSuggestionIndex()).toBe(-1);
    });

    it('should verify Agoda-inspired search card template semantics, a11y roles, IDs, and zero emojis', () => {
      const fs = require('fs');
      const path = require('path');
      const templateContent = fs.readFileSync(path.resolve(__dirname, 'booking.page.ts'), 'utf8');

      // 1. Assert hero card & button IDs
      expect(templateContent).toContain('id="heroSearchCard"');
      expect(templateContent).toContain('id="heroSearchButton"');
      expect(templateContent).toContain('id="propertySearchInput"');
      expect(templateContent).toContain('id="propertyListSection"');
      expect(templateContent).toContain('id="availabilitySection"');

      // 2. Assert Combobox a11y semantics
      expect(templateContent).toContain('role="combobox"');
      expect(templateContent).toContain('role="listbox"');
      expect(templateContent).toContain('role="option"');
      expect(templateContent).toContain('[attr.aria-expanded]="isComboboxOpen()"');
      expect(templateContent).toContain('aria-autocomplete="list"');
      expect(templateContent).toContain('[attr.aria-activedescendant]="activeSuggestionId()"');

      // 3. Assert live announcement regions
      expect(templateContent).toContain('role="status"');
      expect(templateContent).toContain('aria-live="polite"');

      // 4. Assert touch target standards (44px min touch target on stepper & clear buttons)
      expect(templateContent).toContain('aria-label="Giảm số lượng khách"');
      expect(templateContent).toContain('aria-label="Tăng số lượng khách"');
      expect(templateContent).toContain('aria-label="Xóa từ khóa tìm kiếm"');

      // 5. Assert zero emojis in the entire template (clean SVGs only)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(templateContent)).toBe(false);
    });

    it('should deliver nonempty property API responses on init, keyword search, clear, and CTA without auto-selecting any hotel or querying inventory', () => {
      mockBookingService.getAvailability.mockClear();

      // 1. Initial Load (Init)
      mockBookingService.getProperties.mockReturnValue(of(sampleProperties));
      component.ngOnInit();

      expect(component.properties()).toEqual(sampleProperties);
      expect(component.selectedProperty()).toBeNull();
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
      expect(component.availabilityList().length).toBe(0);

      // 2. Keyword Search
      const keywordProps: PublicPropertyDto[] = [{
        ...sampleProperties[0],
        id: 'prop-kw',
        name: 'Khách Sạn Keyword',
        slug: 'prop-keyword'
      }];
      mockBookingService.getProperties.mockReturnValue(of(keywordProps));
      component.loadProperties('keyword');

      expect(component.properties()).toEqual(keywordProps);
      expect(component.selectedProperty()).toBeNull();
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      // 3. Clear Search
      mockBookingService.getProperties.mockReturnValue(of(sampleProperties));
      component.clearPropertySearch();

      expect(component.properties()).toEqual(sampleProperties);
      expect(component.selectedProperty()).toBeNull();
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      // 4. Discovery CTA when no property selected
      const ctaProps: PublicPropertyDto[] = [{
        ...sampleProperties[0],
        id: 'prop-cta',
        name: 'Khách Sạn CTA',
        slug: 'prop-cta'
      }];
      mockBookingService.getProperties.mockReturnValue(of(ctaProps));
      component.propertySearchControl.setValue('da nang', { emitEvent: false });
      component.handleMainSearchCta();

      expect(component.properties()).toEqual(ctaProps);
      expect(component.selectedProperty()).toBeNull();
      expect(component.searchForm.get('propertySlug')?.value).toBe('');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
    });

    it('should discard deferred property responses arriving before 300ms debounce and prevent stale results from overwriting', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();

        const deferredSub = new Subject<PublicPropertyDto[]>();
        mockBookingService.getProperties.mockReturnValue(deferredSub.asObservable());

        component.loadProperties('old query');
        expect(component.isLoadingProperties()).toBe(true);

        component.propertySearchControl.setValue('new query');
        expect(component.properties()).toEqual([]);
        expect(component.isLoadingProperties()).toBe(true);

        vi.advanceTimersByTime(150);
        deferredSub.next(sampleProperties);
        deferredSub.complete();

        expect(component.properties()).toEqual([]);
        expect(component.selectedProperty()).toBeNull();
        expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reject old-option Enter keypress before 300ms debounce because suggestions are synchronously cleared', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();

        component.properties.set(sampleProperties);
        component.openCombobox();
        component.activeSuggestionIndex.set(0);
        expect(component.activeSuggestionId()).toBe('suggestion-0');

        component.propertySearchControl.setValue('bien');

        expect(component.properties()).toEqual([]);
        expect(component.activeSuggestionIndex()).toBe(-1);
        expect(component.activeSuggestionId()).toBeUndefined();

        vi.advanceTimersByTime(100);
        const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as any;
        component.onComboboxKeydown(enterEvent);

        expect(component.selectedProperty()).toBeNull();
        expect(component.searchForm.get('propertySlug')?.value).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should cancel pending debounce timer when selectSuggestion is clicked during debounce window', () => {
      vi.useFakeTimers();
      try {
        component.ngOnInit();
        mockBookingService.getProperties.mockClear();
        mockBookingService.getAvailability.mockClear();

        component.propertySearchControl.setValue('dan');
        vi.advanceTimersByTime(100);
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();

        const targetProp = sampleProperties[0];
        component.properties.set([targetProp]);
        component.selectSuggestion(targetProp);

        expect(component.selectedProperty()?.id).toBe(targetProp.id);
        expect(component.propertySearchControl.value).toBe(targetProp.name);

        vi.advanceTimersByTime(500);
        expect(mockBookingService.getProperties).not.toHaveBeenCalled();
        expect(component.selectedProperty()?.id).toBe(targetProp.id);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should ensure activeSuggestionId never points outside visible options count', () => {
      component.properties.set([]);
      component.openCombobox();
      component.activeSuggestionIndex.set(0);
      expect(component.activeSuggestionId()).toBeUndefined();

      component.properties.set(sampleProperties);
      component.activeSuggestionIndex.set(1);
      expect(component.activeSuggestionId()).toBeUndefined();

      component.activeSuggestionIndex.set(0);
      expect(component.activeSuggestionId()).toBe('suggestion-0');

      component.closeCombobox();
      expect(component.activeSuggestionId()).toBeUndefined();
    });

    it('should enforce strict date guards rejecting null, partial, malformed, and past dates across availability, quote, and hold boundaries', () => {
      component.ngOnInit();
      component.selectedProperty.set(sampleProperties[0]);
      component.searchForm.patchValue({ propertySlug: 'bien-dong-01', rentalType: 2 });
      mockBookingService.getAvailability.mockClear();
      mockBookingService.calculateQuote.mockClear();
      mockBookingService.createHold.mockClear();

      // 1. Malformed calendar dates (impossible date 2026-02-31)
      component.searchForm.patchValue({ checkInDate: '2026-02-31', checkOutDate: '2026-03-02' });
      expect(component.areDatesValid()).toBe(false);

      component.searchAvailability();
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      component.loadQuote('rt-1');
      expect(mockBookingService.calculateQuote).not.toHaveBeenCalled();
      expect(component.currentQuote()).toBeNull();

      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();

      // 2. Past dates (< today)
      component.searchForm.patchValue({ checkInDate: '2020-01-01', checkOutDate: '2020-01-05' });
      expect(component.areDatesValid()).toBe(false);

      component.searchAvailability();
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      component.loadQuote('rt-1');
      expect(mockBookingService.calculateQuote).not.toHaveBeenCalled();

      component.submitHold();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();

      // 3. Null / empty dates
      component.searchForm.patchValue({ checkInDate: '', checkOutDate: '' });
      expect(component.areDatesValid()).toBe(false);

      component.searchAvailability();
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      // 4. Reversed dates (checkout <= checkin)
      component.searchForm.patchValue({ checkInDate: '2026-10-25', checkOutDate: '2026-10-24' });
      expect(component.areDatesValid()).toBe(false);

      component.searchAvailability();
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();

      // 5. Hourly mode invalid dates
      component.searchForm.patchValue({ rentalType: 1, hourlyDate: '2020-01-01', hourlyDurationHours: 2 });
      expect(component.areDatesValid()).toBe(false);

      component.searchForm.patchValue({ hourlyDate: '2026-02-31', hourlyDurationHours: 2 });
      expect(component.areDatesValid()).toBe(false);

      component.searchForm.patchValue({ hourlyDate: '2026-10-25', hourlyDurationHours: 0 });
      expect(component.areDatesValid()).toBe(false);
    });

    it('should adjust checkout date forward on onDateChange(checkOut) conflict and never move checkInDate into the past or trigger requests for invalid dates', () => {
      component.ngOnInit();
      component.selectedProperty.set(sampleProperties[0]);
      component.searchForm.patchValue({ propertySlug: 'bien-dong-01', rentalType: 2 });
      mockBookingService.getAvailability.mockClear();

      // Case A: Valid future check-in, user sets checkout earlier than checkin
      component.searchForm.patchValue({ checkInDate: '2026-11-10', checkOutDate: '2026-11-05' });
      component.onDateChange('checkOut');

      expect(component.searchForm.get('checkOutDate')?.value).toBe('2026-11-11');
      expect(component.searchForm.get('checkInDate')?.value).toBe('2026-11-10');
      expect(component.dateAdjustmentNotice()).toContain('2026-11-11');
      expect(mockBookingService.getAvailability).toHaveBeenCalledWith('bien-dong-01', expect.objectContaining({ checkInDate: '2026-11-10', checkOutDate: '2026-11-11' }));

      // Case B: Past check-in date edited with checkout conflict
      mockBookingService.getAvailability.mockClear();
      component.searchForm.patchValue({ checkInDate: '2020-01-01', checkOutDate: '2020-01-01' });
      component.onDateChange('checkOut');

      expect(component.searchForm.get('checkOutDate')?.value).toBe('2020-01-02');
      expect(component.searchForm.get('checkInDate')?.value).toBe('2020-01-01');
      expect(mockBookingService.getAvailability).not.toHaveBeenCalled();
    });
  });

  describe('2. BookingHoldPage', () => {
    let component: BookingHoldPage;

    beforeEach(() => {
      const pendingDetail = { ...sampleDetail, status: 'PendingPayment', secondsRemaining: 900 };
      mockBookingService.getBookingByToken.mockReturnValue(of(pendingDetail));

      const injector = Injector.create({
        providers: [
          BookingHoldPage,
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          { provide: Router, useValue: mockRouter },
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService }
        ]
      });

      component = runInInjectionContext(injector, () => injector.get(BookingHoldPage));
    });

    it('should load booking details and initialize the countdown timer', () => {
      component.ngOnInit();

      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('token-test-1234567890abcdef');
      expect(component.booking()?.confirmationCode).toBe('RES-TEST01');
      expect(component.secondsRemaining()).toBe(900);
      expect(component.formattedTimeRemaining()).toBe('15:00');
      expect(component.isExpired()).toBe(false);

      component.ngOnDestroy();
    });

    it('should automatically redirect to /booking/status/:token if booking is already Confirmed', () => {
      const confirmedDetail = { ...sampleDetail, status: 'Confirmed' };
      mockBookingService.getBookingByToken.mockReturnValue(of(confirmedDetail));

      component.ngOnInit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/booking/status', 'token-test-1234567890abcdef']);
      component.ngOnDestroy();
    });

    it('should mark as expired when remaining seconds reaches 0', () => {
      const expiredDetail = { ...sampleDetail, status: 'PendingPayment', secondsRemaining: 0 };
      mockBookingService.getBookingByToken.mockReturnValue(of(expiredDetail));

      component.ngOnInit();

      expect(component.isExpired()).toBe(true);
      component.ngOnDestroy();
    });
  });

  describe('3. BookingStatusPage', () => {
    let component: BookingStatusPage;

    beforeEach(() => {
      const injector = Injector.create({
        providers: [
          BookingStatusPage,
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          { provide: Router, useValue: mockRouter },
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService }
        ]
      });

      component = runInInjectionContext(injector, () => injector.get(BookingStatusPage));
    });

    it('should load confirmed booking and render masked PII and financial metrics', () => {
      component.ngOnInit();

      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('token-test-1234567890abcdef');
      expect(component.booking()?.status).toBe('Confirmed');
      expect(component.booking()?.maskedGuestName).toBe('N***h');
      expect(component.booking()?.maskedGuestEmail).toBe('n***h@example.com');
      expect(component.booking()?.maskedGuestPhone).toBe('090****567');
      expect(component.booking()?.paidAmount).toBe(300000);
      expect(component.booking()?.remainingBalance).toBe(700000);
      expect(component.getStatusLabel('Confirmed')).toBe('Đã xác nhận');
    });
  });

  // =========================================================================
  // 4. MOUNTED DOM & BEHAVIORAL IMAGE FALLBACK ACCEPTANCE TESTS (AC-MEDIA-01 - 09)
  // =========================================================================
  describe('4. Mounted DOM & Behavioral Image Fallback Tests (GUEST-ROOM-IMAGE-FALLBACK-01 / AC-MEDIA-01 - 09)', () => {
    let fixture: ComponentFixture<BookingPage>;
    let component: BookingPage;
    let localMockBookingService: any;
    let localMockAlertService: any;
    let localMockRouter: any;

    const testPropertyA: PublicPropertyDto = {
      id: 'prop-alpha',
      name: 'Resort Biển Alpha',
      code: 'ALPHA',
      slug: 'resort-alpha',
      address: '100 Tran Phu',
      city: 'Nha Trang',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bufferMinutes: 30,
      maxHourlyHours: 12
    };

    const testPropertyB: PublicPropertyDto = {
      id: 'prop-beta',
      name: 'Khách Sạn Beta',
      code: 'BETA',
      slug: 'hotel-beta',
      address: '200 Vo Thi Sau',
      city: 'Vung Tau',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bufferMinutes: 30,
      maxHourlyHours: 12
    };

    const testRoomWithImage: PublicRoomTypeAvailabilityDto = {
      roomTypeId: 'rt-standard',
      roomTypeName: 'Standard Room Alpha',
      description: 'Phòng tiêu chuẩn có ảnh',
      maxOccupancy: 2,
      bedType: 'Queen',
      squareMeters: 28,
      imageUrl: 'https://images.hotel-saas.local/rooms/rt-standard.jpg',
      totalRooms: 5,
      availableRooms: 3,
      isAvailable: true,
      estimatedPrice: 750000
    };

    const testRoomWithoutImage: PublicRoomTypeAvailabilityDto = {
      roomTypeId: 'rt-no-img',
      roomTypeName: 'Economy Room Alpha',
      description: 'Phòng không có ảnh',
      maxOccupancy: 1,
      bedType: 'Single',
      squareMeters: 18,
      imageUrl: undefined,
      totalRooms: 3,
      availableRooms: 2,
      isAvailable: true,
      estimatedPrice: 450000
    };

    const testRoomWhitespaceImage: PublicRoomTypeAvailabilityDto = {
      roomTypeId: 'rt-space-img',
      roomTypeName: 'Whitespace Room Alpha',
      description: 'Phòng có ảnh chứa khoảng trắng',
      maxOccupancy: 2,
      bedType: 'Double',
      squareMeters: 22,
      imageUrl: '   ',
      totalRooms: 2,
      availableRooms: 1,
      isAvailable: true,
      estimatedPrice: 500000
    };

    beforeEach(async () => {
      localMockBookingService = {
        getProperties: vi.fn().mockReturnValue(of([testPropertyA, testPropertyB])),
        getPropertyBySlug: vi.fn().mockReturnValue(of(testPropertyA)),
        getRoomTypes: vi.fn().mockReturnValue(of([])),
        getAvailability: vi.fn().mockReturnValue(of([testRoomWithImage])),
        calculateQuote: vi.fn().mockReturnValue(of(sampleQuote)),
        createHold: vi.fn().mockReturnValue(of(sampleHold)),
        getBookingByToken: vi.fn().mockReturnValue(of(sampleDetail)),
        confirmBooking: vi.fn().mockReturnValue(of(sampleDetail))
      };

      localMockAlertService = {
        toastSuccess: vi.fn(),
        toastError: vi.fn(),
        toastInfo: vi.fn(),
        toastWarning: vi.fn()
      };

      localMockRouter = {
        navigate: vi.fn()
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [BookingPage],
        providers: [
          FormBuilder,
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          { provide: PublicBookingService, useValue: localMockBookingService },
          { provide: AlertService, useValue: localMockAlertService },
          { provide: Router, useValue: localMockRouter }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(BookingPage);
      component = fixture.componentInstance;
    });

    it('AC-MEDIA-01: should fail closed when Property is missing or null, displaying fallback SVG and rejecting synthetic events', () => {
      component.ngOnInit();
      fixture.detectChanges();

      // No property selected initially in two-step discovery
      expect(component.selectedProperty()).toBeNull();
      expect(component.getRoomImageContext(testRoomWithImage)).toBeNull();
      expect(component.isRoomImageRenderable(null)).toBe(false);

      // Synthetic error handler call without selectedProperty fails closed
      const fakeCtx: RoomImageRenderContext = {
        propertyId: 'prop-unknown',
        generation: 1,
        roomTypeId: 'rt-test',
        url: 'https://images.hotel-saas.local/rooms/fake.jpg',
        retryAttempt: 0
      };
      component.onRoomImageError(fakeCtx);
      expect(component.failedImageKeys().size).toBe(0);
    });

    it('AC-MEDIA-02: should render SVG fallback and disclosure badge for null, empty or whitespace URL without retry button', () => {
      localMockBookingService.getAvailability.mockReturnValue(of([testRoomWithoutImage, testRoomWhitespaceImage]));
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      // Verify null URL room card
      const imgNo = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-no-img"]');
      const svgNo = fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-no-img"]');
      const badgeNo = fixture.nativeElement.querySelector('[data-testid="room-fallback-badge-rt-no-img"]');
      const retryBtnNo = fixture.nativeElement.querySelector('button[data-testid="room-image-retry-btn-rt-no-img"]');

      expect(imgNo).toBeNull();
      expect(svgNo).not.toBeNull();
      expect(badgeNo).not.toBeNull();
      expect(badgeNo.textContent.trim()).toContain('Hình minh họa — bố trí phòng mẫu');
      expect(retryBtnNo).toBeNull();

      // Verify whitespace URL room card
      const imgSpace = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-space-img"]');
      const svgSpace = fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-space-img"]');
      const badgeSpace = fixture.nativeElement.querySelector('[data-testid="room-fallback-badge-rt-space-img"]');
      const retryBtnSpace = fixture.nativeElement.querySelector('button[data-testid="room-image-retry-btn-rt-space-img"]');

      expect(imgSpace).toBeNull();
      expect(svgSpace).not.toBeNull();
      expect(badgeSpace).not.toBeNull();
      expect(retryBtnSpace).toBeNull();
    });

    it('AC-MEDIA-03: should transition from image to SVG fallback and show retry button when mounted DOM img fires error event', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      // Initial state: image is mounted
      const img = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(img).not.toBeNull();
      expect(img.getAttribute('src')).toBe(testRoomWithImage.imageUrl);
      expect(fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-standard"]')).toBeNull();

      // Dispatch real DOM error event on mounted img
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      // Transitioned state: image destroyed, fallback SVG mounted with badge and retry button
      expect(fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]')).toBeNull();
      const fallbackSvg = fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-standard"]');
      const badge = fixture.nativeElement.querySelector('[data-testid="room-fallback-badge-rt-standard"]');
      const retryBtn = fixture.nativeElement.querySelector('button[data-testid="room-image-retry-btn-rt-standard"]');

      expect(fallbackSvg).not.toBeNull();
      expect(badge).not.toBeNull();
      expect(badge.textContent.trim()).toContain('Hình minh họa — bố trí phòng mẫu');
      expect(retryBtn).not.toBeNull();

      const expectedKey = `${testPropertyA.id}:${testRoomWithImage.roomTypeId}:${testRoomWithImage.imageUrl}`;
      expect(component.failedImageKeys().has(expectedKey)).toBe(true);
    });

    it('AC-MEDIA-04: should render new URL successfully for the same roomTypeId after previous URL encountered error', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      // Trigger error on initial image
      const img = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-standard"]')).not.toBeNull();

      // Subsequent availability response returns a NEW valid URL for rt-standard
      const newUrl = 'https://images.hotel-saas.local/rooms/rt-standard-v2.jpg';
      const updatedRoom: PublicRoomTypeAvailabilityDto = {
        ...testRoomWithImage,
        imageUrl: newUrl
      };
      localMockBookingService.getAvailability.mockReturnValue(of([updatedRoom]));
      component.searchAvailability();
      fixture.detectChanges();

      // The new URL must render as an <img> and NOT be blocked by the previous error key
      const newImg = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(newImg).not.toBeNull();
      expect(newImg.getAttribute('src')).toBe(newUrl);
      expect(fixture.nativeElement.querySelector('svg[data-testid="room-fallback-svg-rt-standard"]')).toBeNull();
    });

    it('AC-MEDIA-05: should ignore late error event dispatched by mounted DOM img of Property A after switching to Property B', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      // Mount and capture Property A img element
      const imgA = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(imgA).not.toBeNull();

      // User switches to Property B
      const roomB: PublicRoomTypeAvailabilityDto = {
        ...testRoomWithImage,
        roomTypeId: 'rt-standard',
        roomTypeName: 'Standard Room Beta',
        imageUrl: 'https://images.hotel-saas.local/rooms/rt-standard-beta.jpg'
      };
      localMockBookingService.getAvailability.mockReturnValue(of([roomB]));
      component.selectProperty(testPropertyB);
      fixture.detectChanges();

      expect(component.selectedProperty()?.id).toBe(testPropertyB.id);

      // Now late error fires from old Property A img element
      imgA.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      // Invariant: Property B must not have any error key recorded, and Property B image remains intact
      const betaKeys = Array.from(component.failedImageKeys()).filter(k => k.startsWith(`${testPropertyB.id}:`));
      expect(betaKeys.length).toBe(0);
      const imgB = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(imgB).not.toBeNull();
      expect(imgB.getAttribute('src')).toBe(roomB.imageUrl);
    });

    it('AC-MEDIA-06: should ignore late error event dispatched by mounted DOM img when availability generation has advanced', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      const imgGen1 = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(imgGen1).not.toBeNull();
      const initialGen = component.currentAvailabilityRequestId;

      // Pending search request advances generation while old DOM image is still mounted
      const pendingSubject = new Subject<any>();
      localMockBookingService.getAvailability.mockReturnValue(pendingSubject);
      component.searchAvailability();

      expect(component.currentAvailabilityRequestId).toBeGreaterThan(initialGen);

      // Late error fires on imgGen1 element (which holds initialGen context)
      imgGen1.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      // Error must be ignored because generation mismatched
      expect(component.failedImageKeys().size).toBe(0);
    });

    it('AC-MEDIA-07: should isolate image error keys across properties when roomTypeId or URL are identical', () => {
      const sharedUrl = 'https://images.hotel-saas.local/rooms/shared-photo.jpg';
      const roomA: PublicRoomTypeAvailabilityDto = { ...testRoomWithImage, imageUrl: sharedUrl };
      const roomB: PublicRoomTypeAvailabilityDto = { ...testRoomWithImage, imageUrl: sharedUrl };

      // Trigger error in Property A
      component.ngOnInit();
      localMockBookingService.getAvailability.mockReturnValue(of([roomA]));
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      const imgA = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      imgA.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      const keyA = `${testPropertyA.id}:${roomA.roomTypeId}:${sharedUrl}`;
      expect(component.failedImageKeys().has(keyA)).toBe(true);

      // Switch to Property B with same roomTypeId and same URL
      localMockBookingService.getAvailability.mockReturnValue(of([roomB]));
      component.selectProperty(testPropertyB);
      fixture.detectChanges();

      // For Property B, image must render cleanly because key is prefixed by Property B ID
      const ctxB = component.getRoomImageContext(roomB);
      expect(ctxB).not.toBeNull();
      expect(component.isRoomImageRenderable(ctxB)).toBe(true);

      const imgB = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(imgB).not.toBeNull();
      expect(imgB.getAttribute('src')).toBe(sharedUrl);
    });

    it('AC-MEDIA-08: should clear error key and remount image on explicit retry, incrementing retryAttempt and rejecting old attempt errors', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      // Trigger error
      const img = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('button[data-testid="room-image-retry-btn-rt-standard"]');
      expect(retryBtn).not.toBeNull();

      // Click retry
      retryBtn.click();
      fixture.detectChanges();

      // Invariant 1: Key is removed from failedImageKeys, image is remounted
      const expectedKey = `${testPropertyA.id}:${testRoomWithImage.roomTypeId}:${testRoomWithImage.imageUrl}`;
      expect(component.failedImageKeys().has(expectedKey)).toBe(false);
      const remountedImg = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(remountedImg).not.toBeNull();
      expect(remountedImg.getAttribute('data-render-key')).toContain(':1'); // retryAttempt incremented to 1

      // Invariant 2: A stale error from retryAttempt 0 is rejected
      const staleCtx: RoomImageRenderContext = {
        propertyId: testPropertyA.id,
        generation: component.currentAvailabilityRequestId,
        roomTypeId: testRoomWithImage.roomTypeId,
        url: testRoomWithImage.imageUrl!,
        retryAttempt: 0
      };
      component.onRoomImageError(staleCtx);
      expect(component.failedImageKeys().has(expectedKey)).toBe(false); // Stale attempt rejected!
    });

    it('AC-MEDIA-09: should preserve alt attribute with exact roomTypeName without AI inference or URL mutation', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(img).not.toBeNull();
      expect(img.getAttribute('alt')).toBe('Standard Room Alpha');
      expect(img.getAttribute('alt')).toBe(testRoomWithImage.roomTypeName);
    });

    it('review regression: refresh accepted same DTO must recreate image identity and reject old-node error', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      const oldImage = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(oldImage).not.toBeNull();

      component.searchAvailability();
      fixture.detectChanges();

      const newImage = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(newImage).not.toBeNull();
      expect(newImage).not.toBe(oldImage);

      // Old node error dispatched after generation advance must leave failedImageKeys empty
      oldImage.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(component.failedImageKeys().size).toBe(0);
    });

    it('review regression: property reset clears previous image failure on A-B-A cycle', () => {
      component.ngOnInit();
      component.selectProperty(testPropertyA);
      fixture.detectChanges();

      const imgA = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(imgA).not.toBeNull();

      // Trigger error on Property A
      imgA.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(component.failedImageKeys().size).toBe(1);

      // Switch to Property B
      component.selectProperty(testPropertyB);
      fixture.detectChanges();
      expect(component.failedImageKeys().size).toBe(0);

      // Return to Property A: failure state must be cleared and image rendered
      component.selectProperty(testPropertyA);
      fixture.detectChanges();
      expect(component.failedImageKeys().size).toBe(0);
      const restoredImg = fixture.nativeElement.querySelector('img[data-testid="room-img-rt-standard"]');
      expect(restoredImg).not.toBeNull();
    });
  });
});

