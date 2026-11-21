// @vitest-environment jsdom
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertyDetailPageComponent } from './property-detail.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { PublicPropertyDto, PublicRoomTypeAvailabilityDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';

try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}
describe('Authoritative property availability and quote', () => {
  const property = { propertyId: 'p', slug: 'hotel', name: 'Hotel', allowedRentalTypes: ['Daily', 'Hourly'], checkInTime: '14:00', checkOutTime: '12:00' } as PublicPropertyDto;
  const room = { roomTypeId: 'r', maxGuests: 4, availableRoomsCount: 1 } as PublicRoomTypeAvailabilityDto;
  const price = { totalAmount: 1234000, expiresAtUtc: '2099-10-19T00:00:00Z', roomTypeId: 'r' } as QuoteDto;
  const service = { getPropertyBySlug: vi.fn(), getAvailability: vi.fn(), calculateQuote: vi.fn(), getPropertyReviewsSummary: vi.fn() };
  const navigate = vi.fn();
  beforeEach(() => {
    navigate.mockClear();
    service.getPropertyBySlug.mockReturnValue(of(property)); service.getAvailability.mockReturnValue(of([room])); service.calculateQuote.mockReturnValue(of(price));
    service.getPropertyReviewsSummary.mockReturnValue(of(null));
    TestBed.configureTestingModule({ imports: [PropertyDetailPageComponent], providers: [
      { provide: PublicBookingService, useValue: service }, { provide: Router, useValue: { navigate } },
      { provide: ActivatedRoute, useValue: { paramMap: of(new Map([['slug', 'hotel']])), snapshot: { paramMap: new Map([['slug', 'hotel']]), queryParams: { checkInDate: '2099-10-20', checkOutDate: '2099-10-22', guests: '4', rentalType: 'Daily' } } } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  function setup() { const fixture = TestBed.createComponent(PropertyDetailPageComponent); fixture.componentInstance.ngOnInit(); return fixture.componentInstance; }
  it('restores schedule, filters capacity and obtains quote from server', () => {
    const component = setup(); component.selectRoom(room);
    expect(service.getAvailability).toHaveBeenCalledWith('hotel', expect.objectContaining({ rentalType: 3, startAtUtc: '2099-10-20T07:00:00.000Z' }));
    expect(component.quote()?.totalAmount).toBe(1234000);
    component.proceedToHold();
    expect(navigate).toHaveBeenCalledWith(['/booking/hold'], { queryParams: expect.objectContaining({ guests: 4, checkOutDate: '2099-10-22', roomTypeId: 'r' }) });
  });
  it('invalidates quote on editing and ignores a late quote response', () => {
    const response = new Subject<QuoteDto>(); service.calculateQuote.mockReturnValue(response);
    const component = setup(); component.selectRoom(room); component.updateStay('guests', 3); response.next(price);
    expect(component.quote()).toBeNull(); component.proceedToHold(); expect(navigate).not.toHaveBeenCalled();
  });
  it('does not offer rooms that cannot accommodate the requested guests', () => {
    service.getAvailability.mockReturnValue(of([{ ...room, maxGuests: 2 }]));
    expect(setup().rooms()).toEqual([]);
  });
  it('reports quote errors and never supplies a client estimated total', () => {
    service.calculateQuote.mockReturnValue(throwError(() => new Error('Offline')));
    const component = setup(); component.selectRoom(room);
    expect(component.quote()).toBeNull(); expect(component.quoteLoading()).toBe(false); expect(component.error()).not.toBe('');
  });

  it('renders dynamic check-in/out and overnight hours in rentalType select options', () => {
    service.getPropertyBySlug.mockReturnValue(of({
      ...property,
      allowedRentalTypes: ['Daily', 'Overnight'],
      checkInTime: '15:00',
      checkOutTime: '11:30',
      overnightCheckInTime: '22:00',
      overnightCheckOutTime: '09:30'
    } as PublicPropertyDto));

    const fixture = TestBed.createComponent(PropertyDetailPageComponent);
    fixture.detectChanges();
    const selectText = (fixture.nativeElement as HTMLElement).querySelector('#stay-rental-type')?.textContent ?? '';

    expect(selectText).toContain('Theo ngày (Nhận 15:00 - Trả 11:30)');
    expect(selectText).toContain('Qua đêm (22:00 - 09:30)');
  });

  it('hydrates promoCode safely from snapshot.queryParams, renders pill, and propagates to quote & hold', () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.queryParams = {
      checkInDate: '2099-10-20',
      checkOutDate: '2099-10-22',
      guests: '4',
      rentalType: 'Daily',
      promoCode: ' SUMMER20 '
    };
    service.calculateQuote.mockClear();

    const fixture = TestBed.createComponent(PropertyDetailPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.promoCode()).toBe('SUMMER20');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="detail-promo-pill"]')?.textContent).toContain('SUMMER20');

    component.selectRoom(room);
    expect(service.calculateQuote).toHaveBeenCalledWith(expect.objectContaining({
      propertySlug: 'hotel',
      roomTypeId: 'r',
      promoCode: 'SUMMER20'
    }));

    component.proceedToHold();
    expect(navigate).toHaveBeenCalledWith(['/booking/hold'], {
      queryParams: expect.objectContaining({
        propertySlug: 'hotel',
        roomTypeId: 'r',
        promoCode: 'SUMMER20'
      })
    });
  });

  it('tracks responsive mobile viewport state for DatePicker touchUI', () => {
    const originalWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
      const fixture = TestBed.createComponent(PropertyDetailPageComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.isMobileViewport()).toBe(true);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
      expect(fixture.componentInstance.isMobileViewport()).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    }
  });
});
