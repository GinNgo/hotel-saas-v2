import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingFilterBarComponent } from './booking-filter-bar.component';
import { LocationService } from '../../../../core/services/location.service';
import { PublicBookingSearchFilter } from '../../../../core/models/public-booking.model';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document,
    HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('Destination picker dismissal', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({ imports: [BookingFilterBarComponent] });
    const fixture = TestBed.createComponent(BookingFilterBarComponent);
    fixture.componentRef.setInput('suggestions', [{ id: 'dalat', name: 'Đà Lạt', slug: 'da-lat',
      type: 'Province', provinceCode: '68', provinceName: 'Lâm Đồng' }]);
    fixture.detectChanges();
    fixture.componentInstance.showSuggestionsDropdown.set(true);
    fixture.detectChanges();
    return fixture;
  }

  it('closes on outside pointer down without submitting a search', () => {
    const fixture = setup();
    const searches: unknown[] = [];
    fixture.componentInstance.filterChange.subscribe(filter => searches.push(filter));
    document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(false);
    expect(searches).toEqual([]);
  });

  it('closes when focus leaves the destination field group', () => {
    const fixture = setup();
    const element: HTMLElement = fixture.nativeElement;
    const outsideTarget = element.querySelector('app-booking-date-picker, button, input:not([role="combobox"])') ?? document.body;
    outsideTarget.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(false);
  });

  it('closes with Escape and retains the typed destination', () => {
    const fixture = setup();
    fixture.componentInstance.destinationKeyword.set('Đà Lạt');
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('input[type="text"]')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(false);
    expect(fixture.componentInstance.destinationKeyword()).toBe('Đà Lạt');
  });

  it('selects a suggestion with ArrowDown and Enter and clears stale GPS on typing', () => {
    const fixture = setup();
    fixture.componentInstance.userCoords.set({ lat: 10, lng: 106 });
    fixture.componentInstance.onDestinationInput('Đà');
    expect(fixture.componentInstance.userCoords()).toBeNull();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector('input[type="text"]')!;
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('destination-option-0');
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fixture.componentInstance.destinationKeyword()).toBe('Đà Lạt');
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(false);
  });

  it('rejects invalid stay dates before emitting a search', () => {
    const fixture = setup();
    const searches: unknown[] = [];
    fixture.componentInstance.filterChange.subscribe(filter => searches.push(filter));
    fixture.componentInstance.checkInDate.set('2099-10-22');
    fixture.componentInstance.checkOutDate.set('2099-10-20');
    fixture.componentInstance.emitSearch();
    expect(searches).toEqual([]);
    expect(fixture.componentInstance.searchError()).toContain('Ngày trả phòng');
  });

  it('starts ArrowUp at the last suggestion', () => {
    const fixture = setup();
    fixture.componentInstance.activeSuggestion.set(-1);
    fixture.componentInstance.onDestinationKeydown(new window.KeyboardEvent('keydown', { key: 'ArrowUp' }) as KeyboardEvent);
    expect(fixture.componentInstance.activeSuggestion()).toBe(fixture.componentInstance.filteredSuggestions().length - 1);
  });

  it('does not dismiss before an inside suggestion click can select it', () => {
    const fixture = setup();
    const element: HTMLElement = fixture.nativeElement;
    const suggestion = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Đà Lạt') && button.textContent?.includes('Lâm Đồng'))!;
    suggestion.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(true);
    suggestion.click();
    expect(fixture.componentInstance.destinationKeyword()).toBe('Đà Lạt');
    expect(fixture.componentInstance.showSuggestionsDropdown()).toBe(false);
  });

  it('saves searches to recent search history and allows clearing', () => {
    const fixture = setup();
    const comp = fixture.componentInstance;
    comp.saveSearchToHistory('Hà Nội', 'Hà Nội', 'Province', 'Hà Nội');
    expect(comp.recentSearches().length).toBeGreaterThan(0);
    expect(comp.recentSearches()[0].keyword).toBe('Hà Nội');

    const fakeEvent = new window.Event('click');
    comp.clearAllRecentSearches(fakeEvent);
    expect(comp.recentSearches().length).toBe(0);
  });

  it('supports fuzzy search for condensed names and accents', () => {
    const fixture = setup();
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('suggestions', [
      { id: 'sapa', name: 'Sa Pa', slug: 'sa-pa', type: 'TouristZone', provinceCode: '15', provinceName: 'Lào Cai' },
      { id: 'dalat', name: 'Đà Lạt', slug: 'da-lat', type: 'Province', provinceCode: '68', provinceName: 'Lâm Đồng' },
      { id: 'phuquoc', name: 'Phú Quốc', slug: 'phu-quoc', type: 'Province', provinceCode: '91', provinceName: 'An Giang' },
    ]);
    fixture.detectChanges();

    // Query 'sapa' matches 'Sa Pa'
    comp.onDestinationInput('sapa');
    expect(comp.filteredSuggestions().some(s => s.name === 'Sa Pa')).toBe(true);

    // Query 'dalat' matches 'Đà Lạt'
    comp.onDestinationInput('dalat');
    expect(comp.filteredSuggestions().some(s => s.name === 'Đà Lạt')).toBe(true);

    // Query 'phuquoc' matches 'Phú Quốc'
    comp.onDestinationInput('phuquoc');
    expect(comp.filteredSuggestions().some(s => s.name === 'Phú Quốc')).toBe(true);
  });

  it('uses LocationService.reverseGeocode on GPS success, strips GPS placeholder on emitSearch, and never calls window.alert', () => {
    const reverseGeocodeMock = vi.fn().mockReturnValue(
      of({ displayLabel: 'Gần Chợ Bến Thành, TP. Hồ Chí Minh (250m)' })
    );
    TestBed.configureTestingModule({
      imports: [BookingFilterBarComponent],
      providers: [{ provide: LocationService, useValue: { reverseGeocode: reverseGeocodeMock } }],
    });
    const fixture = TestBed.createComponent(BookingFilterBarComponent);
    fixture.detectChanges();

    const emitted: PublicBookingSearchFilter[] = [];
    fixture.componentInstance.filterChange.subscribe(f => emitted.push(f));

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 10.7725, longitude: 106.698 } as GeolocationCoordinates,
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    try {
      fixture.componentInstance.useCurrentLocation();
      expect(alertSpy).not.toHaveBeenCalled();
      expect(reverseGeocodeMock).toHaveBeenCalledWith(10.7725, 106.698);
      expect(fixture.componentInstance.destinationKeyword()).toBe(
        '📍 Gần Chợ Bến Thành, TP. Hồ Chí Minh (250m)'
      );
      expect(fixture.componentInstance.gpsDisplayLabel()).toBe(
        '📍 Gần Chợ Bến Thành, TP. Hồ Chí Minh (250m)'
      );

      fixture.componentInstance.emitSearch();
      const latest = emitted[emitted.length - 1];
      expect(latest.destinationKeyword).toBe('');
      expect(latest.userLatitude).toBe(10.7725);
      expect(latest.userLongitude).toBe(106.698);
      expect(latest.sortBy).toBe('distance_asc');
    } finally {
      alertSpy.mockRestore();
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      } else {
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
      }
    }
  });

  it('falls back to low-accuracy geolocation on timeout (code 3) and sets inline searchError on failure without alert', () => {
    const fixture = setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

    const callOptions: PositionOptions[] = [];
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback | null, options?: PositionOptions) => {
        if (options) callOptions.push(options);
        if (callOptions.length === 1) {
          error?.({ code: 3, message: 'Timeout' } as GeolocationPositionError);
        } else {
          error?.({ code: 1, message: 'Permission denied' } as GeolocationPositionError);
        }
      }
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    try {
      fixture.componentInstance.useCurrentLocation();
      expect(getCurrentPosition).toHaveBeenCalledTimes(2);
      expect(callOptions[0].enableHighAccuracy).toBe(true);
      expect(callOptions[1].enableHighAccuracy).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.searchError()).toContain('từ chối quyền định vị');
    } finally {
      alertSpy.mockRestore();
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      } else {
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
      }
    }
  });

  it('preserves gpsDisplayLabel when initialFilter passes coordinates with empty destinationKeyword', () => {
    const fixture = setup();
    fixture.componentInstance.gpsDisplayLabel.set('📍 Gần Chợ Bến Thành (250m)');
    fixture.componentRef.setInput('initialFilter', {
      destinationKeyword: '',
      userLatitude: 10.7725,
      userLongitude: 106.698,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.destinationKeyword()).toBe('📍 Gần Chợ Bến Thành (250m)');
    expect(fixture.componentInstance.userCoords()).toEqual({ lat: 10.7725, lng: 106.698 });
  });

  it('uses canonical 34-province 2-tier quick picks and normalizes Guesthouse to Motel', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;

    const baiSau = cmp.quickLandmarkPicks.find((p) => p.slug === 'bai-sau-vung-tau');
    expect(baiSau?.provinceCode).toBe('79');
    expect(cmp.quickLandmarkPicks.some((p) => p.name.includes('Quận 1'))).toBe(false);
    expect(cmp.propertyTypeChips.some((c) => c.type === 'Guesthouse')).toBe(false);
    expect(cmp.propertyTypeChips.some((c) => c.type === 'Motel')).toBe(true);

    fixture.componentRef.setInput('initialFilter', {
      propertyTypes: ['Guesthouse', 'Hotel'],
    });
    fixture.detectChanges();

    expect(cmp.selectedPropertyTypes()).toEqual(['Motel', 'Hotel']);
  });
});
