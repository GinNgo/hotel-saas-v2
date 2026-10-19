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
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingPageComponent } from './booking.page';
import { BookingHoldPage } from './booking-hold.page';
import { BookingStatusPage } from './booking-status.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { QuoteDto } from '../../core/models/reservation.model';
import {
  PublicPropertyDto,
  PublicRoomTypeAvailabilityDto,
  GuestHoldDto,
  GuestBookingDetailDto
} from '../../core/models/public-booking.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('Public Booking Pages Suite — Angular 22 Signals Architecture', () => {
  let mockBookingService: any;
  let mockAlertService: any;
  let mockRouter: any;

  const sampleProperties: PublicPropertyDto[] = [
    {
      propertyId: 'prop-dalat-1',
      tenantId: 'tenant-pine-1',
      name: 'Đà Lạt Pine Resort',
      slug: 'da-lat-pine-resort',
      code: 'DLP01',
      propertyType: 'Resort',
      allowedRentalTypes: ['Daily', 'Hourly', 'Overnight'],
      tenantBrandName: 'Pine Group',
      provinceName: 'Lâm Đồng',
      districtName: 'TP. Đà Lạt',
      wardName: 'Phường 10',
      addressLine: '12 Hoàng Hoa Thám',
      starRating: 4,
      reviewCount: 120,
      ratingAverage: 4.8,
      thumbnailUrl: '/images/dalat-pine-resort.png',
      galleryUrls: ['/images/dalat-pine-resort.png'],
      hourlyPriceFrom: 200000,
      overnightPriceFrom: 650000,
      dailyPriceFrom: 950000,
      availableRoomTypes: [
        {
          roomTypeId: 'rt-pine-deluxe',
          code: 'PINE-DLX',
          name: 'Deluxe Double Pine View',
          bedConfiguration: '1 Giường đôi King',
          areaSqm: 32,
          maxGuests: 2,
          hourlyRate: 200000,
          overnightRate: 650000,
          dailyRate: 950000,
          availableRoomsCount: 4,
          availableRooms: 4,
          calculatedQuoteTotal: 950000,
          amenities: ['Wifi', 'AC'],
          images: ['/images/deluxe-double-pine.png']
        }
      ]
    },
    {
      propertyId: 'prop-saigon-2',
      tenantId: 'tenant-riverside-2',
      name: 'Sài Gòn Riverside Tower',
      slug: 'sai-gon-riverside-tower',
      code: 'SGR02',
      propertyType: 'Hotel',
      allowedRentalTypes: ['Daily', 'Hourly', 'Overnight'],
      tenantBrandName: 'Riverside Collection',
      provinceName: 'TP. Hồ Chí Minh',
      districtName: 'Quận 1',
      wardName: 'Bến Nghé',
      addressLine: '18 Tôn Đức Thắng',
      starRating: 5,
      reviewCount: 350,
      ratingAverage: 4.9,
      thumbnailUrl: '/images/saigon-riverside-tower.png',
      galleryUrls: ['/images/saigon-riverside-tower.png'],
      hourlyPriceFrom: 350000,
      overnightPriceFrom: 1100000,
      dailyPriceFrom: 1600000,
      availableRoomTypes: [
        {
          roomTypeId: 'rt-river-suite',
          code: 'SGR-STE',
          name: 'Executive Suite River View',
          bedConfiguration: '1 Giường King',
          areaSqm: 48,
          maxGuests: 2,
          hourlyRate: 350000,
          overnightRate: 1100000,
          dailyRate: 1600000,
          availableRoomsCount: 2,
          availableRooms: 2,
          calculatedQuoteTotal: 1600000,
          amenities: ['Wifi', 'Bathtub'],
          images: ['/images/executive-suite-river.png']
        }
      ]
    }
  ] as unknown as PublicPropertyDto[];

  const sampleHold: GuestHoldDto = {
    reservationId: 'res-hold-001',
    holdToken: 'tok-hold-abc-123',
    lookupToken: 'tok-hold-abc-123',
    propertyName: 'Đà Lạt Pine Resort',
    roomTypeName: 'Deluxe Double Pine View',
    checkInTime: '2026-10-18T14:00:00Z',
    checkOutTime: '2026-10-20T12:00:00Z',
    totalEstimatedAmount: 1900000,
    depositAmount: 500000,
    expiresAtUtc: new Date(Date.now() + 600000).toISOString(),
    remainingSeconds: 600
  } as unknown as GuestHoldDto;

  const sampleBookingDetail: GuestBookingDetailDto = {
    reservationId: 'res-hold-001',
    confirmationCode: 'BOOK-98765',
    lookupToken: 'tok-hold-abc-123',
    status: 'Confirmed',
    guestName: 'Nguyễn Văn Khách',
    guestPhone: '0909123456',
    guestEmail: 'guest@example.vn',
    propertyName: 'Đà Lạt Pine Resort',
    propertyAddress: '12 Hoàng Hoa Thám, Đà Lạt',
    propertyPhone: '02633 123 456',
    roomTypeName: 'Deluxe Double Pine View',
    assignedRoomNumber: '102',
    rentalType: 'Daily',
    checkInTime: '2026-10-18T14:00:00Z',
    checkOutTime: '2026-10-20T12:00:00Z',
    totalAmount: 1900000,
    paidAmount: 1900000,
    depositPaid: 500000,
    remainingBalance: 0,
    createdAt: '2026-10-17T10:00:00Z'
  } as unknown as GuestBookingDetailDto;

  beforeEach(() => {
    mockBookingService = {
      getProperties: vi.fn().mockReturnValue(of(sampleProperties)),
      getPropertyBySlug: vi.fn().mockReturnValue(of(sampleProperties[0])),
      getAvailability: vi.fn().mockReturnValue(of([])),
      getDestinationSuggestions: vi.fn().mockReturnValue(of([])),
      createHold: vi.fn().mockReturnValue(of(sampleHold)),
      getBookingByToken: vi.fn().mockReturnValue(of(sampleBookingDetail)),
      confirmBooking: vi.fn().mockReturnValue(of(sampleBookingDetail)),
      cancelHold: vi.fn().mockReturnValue(of({ success: true }))
    };

    mockAlertService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      toastSuccess: vi.fn(),
      toastError: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };
  });

  // =========================================================================
  // 1. BOOKING DISCOVERY & CATALOG PAGE
  // =========================================================================
  describe('1. BookingPageComponent — Multi-Property Discovery', () => {
    let fixture: ComponentFixture<BookingPageComponent>;
    let component: BookingPageComponent;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [BookingPageComponent],
        providers: [
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService },
          { provide: Router, useValue: mockRouter },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParams: {}, queryParamMap: { get: () => null } }
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(BookingPageComponent);
      component = fixture.componentInstance;
    });

    it('should initialize and load properties into reactive signals', () => {
      component.ngOnInit();
      expect(mockBookingService.getProperties).toHaveBeenCalled();
      expect(component.properties().length).toBe(2);
      expect(component.filteredProperties().length).toBe(2);
    });

    it('restores sidebar facets from the search URL', () => {
      TestBed.inject(ActivatedRoute).snapshot.queryParams = {
        selectedTenantId: 'tenant-pine-1', maxDistanceMeters: '1000',
        minPrice: '200000', maxPrice: '500000', sortBy: 'price_desc',
      };
      component.ngOnInit();
      expect(component.selectedTenantId()).toBe('tenant-pine-1');
      expect(component.maxDistanceMeters()).toBe(1000);
      expect(component.minPrice()).toBe(200000);
      expect(component.maxPrice()).toBe(500000);
      expect(component.selectedPriceRangeKey()).toBe('200_500');
      expect(component.sortBy()).toBe('price_desc');
    });

    it('serializes sidebar changes and clears them on reset', () => {
      component.ngOnInit();
      component.selectTenantBrand('tenant-pine-1');
      component.setMaxDistance(1000);
      component.applyPriceRange('200_500', 200000, 500000);
      component.onSortChange('price_desc');
      expect(mockRouter.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({
        queryParams: expect.objectContaining({ selectedTenantId: 'tenant-pine-1',
          maxDistanceMeters: 1000, minPrice: 200000, maxPrice: 500000, sortBy: 'price_desc' }),
      }));
      component.resetSidebarFilters();
      expect(mockRouter.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({
        queryParams: expect.objectContaining({ selectedTenantId: null,
          maxDistanceMeters: null, minPrice: null, maxPrice: null, sortBy: 'recommended' }),
      }));
    });

    it('resets facets on Back and rejects invalid numeric URL values', () => {
      const params = new BehaviorSubject<Record<string, string>>({
        maxDistanceMeters: '1000', minPrice: '200000', maxPrice: '500000', sortBy: 'price_desc',
      });
      Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParams', { value: params });
      component.ngOnInit();
      params.next({ maxDistanceMeters: '-1', minPrice: 'NaN', maxPrice: 'Infinity', sortBy: 'unknown' });
      expect(component.maxDistanceMeters()).toBeNull();
      expect(component.minPrice()).toBeNull();
      expect(component.maxPrice()).toBeNull();
      expect(component.sortBy()).toBe('recommended');
      params.next({});
      expect(component.selectedTenantId()).toBeNull();
      expect(component.selectedPriceRangeKey()).toBe('all');
    });

    it('ignores pending results after an invalid stay URL', () => {
      const pending = new Subject<PublicPropertyDto[]>();
      mockBookingService.getProperties.mockReturnValue(pending);
      const params = new BehaviorSubject<Record<string, string>>({});
      Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParams', { value: params });
      component.ngOnInit();
      params.next({ checkInDate: 'not-a-date' });
      pending.next(sampleProperties);
      expect(component.properties()).toEqual([]);
      expect(component.loadError()).toBe(true);
      expect(component.isLoading()).toBe(false);
    });

    it('keeps empty results empty instead of inserting demo properties', () => {
      mockBookingService.getProperties.mockReturnValue(of([]));
      component.ngOnInit();
      expect(component.properties()).toEqual([]);
      expect(component.smartFilterChips()).toEqual([]);
      expect(component.loadError()).toBe(false);
    });

    it('does not fabricate property identity, photos, prices or room metadata', () => {
      mockBookingService.getProperties.mockReturnValue(of([{
        propertyId: 'minimal', name: 'Minimal', slug: 'minimal', propertyType: 'Hotel',
        allowedRentalTypes: ['Daily'], availableRoomTypes: [{ roomTypeId: 'room', name: 'Room' }],
      }]));
      component.ngOnInit();
      const property = component.properties()[0];
      expect(property.tenantId).toBe('');
      expect(property.tenantBrandName).toBe('');
      expect(property.addressLine).toBe('');
      expect(property.provinceName).toBe('');
      expect(property.thumbnailUrl).toBe('');
      expect(property.galleryUrls).toEqual([]);
      expect(property.startingPriceForSelectedMode).toBe(0);
      expect(property.allowedRentalTypes).toEqual(['Daily']);
      expect(component.tenantBrandFacets()).toEqual([]);
      const room = property.availableRoomTypes[0];
      expect(room.images).toEqual([]);
      expect(room.amenities).toEqual([]);
      expect(room.availableRoomsCount).toBe(0);
      expect(room.areaSqm).toBeUndefined();
      expect(component.getRoomDisplayPrice(room)).toBe(0);
      component.applyPriceRange('under_200', 0, 200000);
      expect(component.filteredProperties()).toEqual([]);
      component.resetSidebarFilters();
      component.setMaxDistance(1000);
      expect(component.filteredProperties()).toEqual([]);
    });

    it('preserves published mode prices and does not open an empty gallery', () => {
      component.ngOnInit();
      expect(component.properties()[0].startingPriceForSelectedMode).toBe(950000);
      component.openPhotoGallery({ ...component.properties()[0], thumbnailUrl: '', galleryUrls: [] });
      expect(component.isGalleryOpen()).toBe(false);
    });

    it('does not assume rental support or a landmark distance when unpublished', () => {
      mockBookingService.getProperties.mockReturnValue(of([{
        propertyId: 'minimal', name: 'Minimal', slug: 'minimal',
        nearbyLandmarks: [{ landmarkId: 'lm', name: 'Landmark' }],
      }]));
      component.ngOnInit();
      expect(component.properties()[0].allowedRentalTypes).toEqual([]);
      expect(component.properties()[0].nearbyLandmarks).toEqual([]);
      expect(component.filteredProperties()).toEqual([]);
    });

    it('exposes a retryable error without inserting demo properties', () => {
      mockBookingService.getProperties.mockReturnValue(throwError(() => new Error('Unavailable')));
      component.ngOnInit();
      expect(component.properties()).toEqual([]);
      expect(component.loadError()).toBe(true);
      mockBookingService.getProperties.mockReturnValue(of(sampleProperties));
      component.retryProperties();
      expect(component.loadError()).toBe(false);
      expect(component.properties().length).toBe(2);
    });

    it('does not invent review counts, stars or room types when missing', () => {
      mockBookingService.getProperties.mockReturnValue(of([{
        ...sampleProperties[0], reviewCount: undefined, ratingAverage: undefined,
        starRating: undefined, availableRoomTypes: [],
      }]));
      component.ngOnInit();
      const property = component.properties()[0];
      expect(property.reviewCount).toBe(0);
      expect(property.ratingAverage).toBe(0);
      expect(property.starRating).toBe(0);
      expect(property.availableRoomTypes).toEqual([]);
    });

    it('should filter properties when tenant brand facet is selected', () => {
      component.ngOnInit();
      component.selectTenantBrand('tenant-pine-1');
      expect(component.selectedTenantId()).toBe('tenant-pine-1');
      expect(component.filteredProperties().length).toBe(1);
      expect(component.filteredProperties()[0].name).toBe('Đà Lạt Pine Resort');

      // Clear filter
      component.selectTenantBrand(null);
      expect(component.selectedTenantId()).toBeNull();
      expect(component.filteredProperties().length).toBe(2);
    });

    it('should open and close room detail modal', () => {
      component.ngOnInit();
      const prop = sampleProperties[0];
      const room = prop.availableRoomTypes[0];

      component.openRoomDetailModal(prop, room);
      expect(component.isRoomDetailOpen()).toBe(true);
      expect(component.selectedRoomDetail()).toEqual(room);
      expect(component.selectedRoomPropertyName()).toBe(prop.name);

      component.closeRoomDetailModal();
      expect(component.isRoomDetailOpen()).toBe(false);
    });

    it('should open and close photo gallery modal', () => {
      component.ngOnInit();
      const prop = sampleProperties[0];
      component.openPhotoGallery(prop);

      expect(component.isGalleryOpen()).toBe(true);
      expect(component.selectedGalleryTitle()).toBe(prop.name);
      expect(component.selectedGalleryPhotos().length).toBeGreaterThan(0);

      component.closePhotoGallery();
      expect(component.isGalleryOpen()).toBe(false);
    });

    it('should create hold and navigate to booking hold page', () => {
      component.ngOnInit();
      const prop = sampleProperties[0];
      const room = prop.availableRoomTypes[0];

      component.createHoldAndProceed(prop, room);
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/booking/hold'],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            propertySlug: prop.slug,
            propertyId: prop.propertyId,
            roomTypeId: room.roomTypeId
          })
        })
      );
    });
  });

  // =========================================================================
  // 2. BOOKING HOLD PAGE (10-MINUTE SOFT-HOLD & VOUCHER)
  // =========================================================================
  describe('2. BookingHoldPage — Guest Hold & Voucher', () => {
    let fixture: ComponentFixture<BookingHoldPage>;
    let component: BookingHoldPage;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [BookingHoldPage],
        providers: [
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService },
          { provide: Router, useValue: mockRouter },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParams: {
                  propertySlug: 'da-lat-pine-resort',
                  roomTypeId: 'rt-pine-deluxe',
                  rentalType: 'Daily',
                  checkInDate: '2099-10-20',
                  checkOutDate: '2099-10-22',
                  guests: 4
                },
                paramMap: { get: () => 'tok-hold-abc-123' }
              }
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(BookingHoldPage);
      component = fixture.componentInstance;
    });

    it('should load booking hold detail by route param token', () => {
      component.ngOnInit();
      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-hold-abc-123');
      expect(component.booking()).toEqual(sampleBookingDetail);
    });

    it('should format countdown timer correctly', () => {
      expect(component.formatCountdown(125)).toBe('02:05');
      expect(component.formatCountdown(600)).toBe('10:00');
    });

    it('should validate customer fields before confirmation', () => {
      component.guestName = '';
      component.guestPhone = '';
      component.confirmBooking();

      expect(mockAlertService.error).toHaveBeenCalledWith('Vui lòng điền đầy đủ Họ tên và Số điện thoại.');
      expect(mockBookingService.createHold).not.toHaveBeenCalled();
      expect(component.fieldError('name')).toBe('Vui lòng nhập họ và tên.');
      expect(component.fieldError('phone')).toBe('Vui lòng nhập số điện thoại.');
    });

    function prepareQuote(): void {
      component.property.set({ ...sampleProperties[0], allowedRentalTypes: ['Daily'], checkInTime: '14:00', checkOutTime: '12:00' });
      component.quote.set({ totalAmount: 1900000, expiresAtUtc: '2099-10-19T00:00:00Z' } as QuoteDto);
      component.guestName = 'Nguyễn Văn Khách';
      component.guestPhone = '0909123456';
      component.guestEmail = 'guest@example.vn';
    }

    it('creates a real hold using the chosen dates, guests and Daily enum', () => {
      prepareQuote();
      component.guestName = 'Nguyễn Văn Khách';
      component.guestPhone = '0909123456';
      component.guestEmail = 'guest@example.vn';
      component.confirmBooking();

      expect(mockBookingService.createHold).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/booking/hold', 'tok-hold-abc-123']
      );
      expect(mockBookingService.createHold.mock.calls[0][0]).toMatchObject({ rentalType: 3, numberOfGuests: 4,
        startAtUtc: '2099-10-20T07:00:00.000Z', endAtUtc: '2099-10-22T05:00:00.000Z', expectedTotalAmount: 1900000 });
    });

    it('keeps failed requests on the form and reuses the idempotency key', () => {
      prepareQuote();
      mockBookingService.createHold.mockReturnValue(throwError(() => new Error('Network')));
      component.confirmBooking();
      const key = mockBookingService.createHold.mock.calls[0][0].idempotencyKey;
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(component.error()).not.toBe('');
      expect(component.isSubmitting()).toBe(false);
      component.confirmBooking();
      expect(mockBookingService.createHold.mock.calls[1][0].idempotencyKey).toBe(key);
    });

    it('rejects an expired quote without sending or navigating', () => {
      prepareQuote();
      component.quote.set({ totalAmount: 1900000, expiresAtUtc: '2000-01-01T00:00:00Z' } as QuoteDto);
      component.confirmBooking();
      expect(mockBookingService.createHold).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. BOOKING STATUS PAGE
  // =========================================================================
  describe('3. BookingStatusPage — Reservation Confirmation & Lookup', () => {
    let fixture: ComponentFixture<BookingStatusPage>;
    let component: BookingStatusPage;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [BookingStatusPage],
        providers: [
          { provide: PublicBookingService, useValue: mockBookingService },
          { provide: AlertService, useValue: mockAlertService },
          { provide: Router, useValue: mockRouter },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of({ get: () => 'tok-hold-abc-123' }),
              snapshot: { paramMap: { get: () => 'tok-hold-abc-123' } }
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(BookingStatusPage);
      component = fixture.componentInstance;
    });

    it('should load reservation details by token on init', () => {
      component.ngOnInit();
      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-hold-abc-123');
      expect(component.booking()).toEqual(sampleBookingDetail);
    });

    it('should allow search by new token input', () => {
      component.searchToken = 'tok-new-search-999';
      component.onSearch();

      expect(mockBookingService.getBookingByToken).toHaveBeenCalledWith('tok-new-search-999');
    });
  });
});
