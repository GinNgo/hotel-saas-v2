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
  const service = { getPropertyBySlug: vi.fn(), getAvailability: vi.fn(), calculateQuote: vi.fn() };
  const navigate = vi.fn();
  beforeEach(() => {
    navigate.mockClear();
    service.getPropertyBySlug.mockReturnValue(of(property)); service.getAvailability.mockReturnValue(of([room])); service.calculateQuote.mockReturnValue(of(price));
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
});
