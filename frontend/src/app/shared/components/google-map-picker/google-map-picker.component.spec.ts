import '@angular/compiler';
import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleMapPickerComponent } from './google-map-picker.component';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('GoogleMapPickerComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoogleMapPickerComponent]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should initialize with default coordinates for Ho Chi Minh City', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.currentLat()).toBe(10.7769);
    expect(component.currentLng()).toBe(106.7009);
    expect(component.mapEmbedUrl()).toBeTruthy();
    expect(component.externalGoogleMapsUrl()).toContain('10.7769,106.7009');
  });

  it('should select preset and emit locationSelected', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.locationSelected, 'emit');
    const daLatPreset = component.presets.find(p => p.provinceCode === '68')!;
    expect(daLatPreset).toBeDefined();

    component.selectPreset(daLatPreset);

    expect(component.currentLat()).toBe(daLatPreset.lat);
    expect(component.currentLng()).toBe(daLatPreset.lng);
    expect(component.currentAddress()).toBe(daLatPreset.address);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      address: daLatPreset.address,
      latitude: daLatPreset.lat,
      longitude: daLatPreset.lng,
      provinceCode: '68'
    }));
  });

  it('should filter suggestions based on query', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onSearchQueryChange('nha trang');
    expect(component.showSuggestions()).toBe(true);
    expect(component.suggestions().length).toBeGreaterThan(0);
    expect(component.suggestions()[0].provinceName).toContain('Khánh Hòa');

    component.onSearchQueryChange('a'); // < 2 characters
    expect(component.showSuggestions()).toBe(false);
    expect(component.suggestions().length).toBe(0);
  });

  it('should apply suggestion and emit location', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.locationSelected, 'emit');
    const vungTauPreset = component.presets.find(p => p.name.includes('Vũng Tàu') && p.provinceCode === '79')!;

    component.applySuggestion(vungTauPreset);

    expect(component.currentAddress()).toBe(vungTauPreset.address);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      address: vungTauPreset.address,
      latitude: vungTauPreset.lat,
      longitude: vungTauPreset.lng
    }));
  });

  it('should search across all 34 Vietnam provinces including Sa Pa and Hoi An', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onSearchQueryChange('sa pa');
    expect(component.showSuggestions()).toBe(true);
    expect(component.suggestions().some(s => s.provinceName.includes('Lào Cai') && s.lat > 22)).toBe(true);

    component.onSearchQueryChange('hoi an');
    expect(component.showSuggestions()).toBe(true);
    expect(component.suggestions().some(s => s.provinceName.includes('Đà Nẵng') && s.lat > 15 && s.lng > 108)).toBe(true);
  });

  it('should parse raw coordinates and Google Maps URLs and emit on click or Enter', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.locationSelected, 'emit');

    component.onSearchQueryChange('10.7725, 106.6980');
    expect(component.showSuggestions()).toBe(true);
    expect(component.suggestions()[0].name).toContain('📌 Ghim tọa độ GPS');

    const enterEvent = { preventDefault: vi.fn() } as unknown as Event;
    component.onSearchEnter(enterEvent);
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(component.currentLat()).toBe(10.7725);
    expect(component.currentLng()).toBe(106.6980);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 10.7725,
      longitude: 106.6980
    }));

    component.onSearchQueryChange('https://www.google.com/maps/place/Da+Nang/@16.0601,108.2464,15z');
    expect(component.suggestions()[0].lat).toBe(16.0601);
    expect(component.suggestions()[0].lng).toBe(108.2464);
    component.applySuggestion(component.suggestions()[0]);
    expect(component.currentLat()).toBe(16.0601);
    expect(component.currentLng()).toBe(108.2464);

    component.onSearchQueryChange('https://maps.google.com/?q=11.9404,108.4452');
    expect(component.suggestions()[0].lat).toBe(11.9404);
    expect(component.suggestions()[0].lng).toBe(108.4452);

    component.onSearchQueryChange('95.0, 200.0');
    expect(component.suggestions().some(s => s.isRawCoord)).toBe(false);
  });

  it('should emit locationSelected when manual lat/lng inputs change with valid coordinates', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.locationSelected, 'emit');

    component.onManualLatChange(16.4637);
    expect(component.currentLat()).toBe(16.4637);
    expect(emitSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      latitude: 16.4637,
      longitude: 106.7009
    }));

    component.onManualLngChange(107.5909);
    expect(component.currentLng()).toBe(107.5909);
    expect(emitSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      latitude: 16.4637,
      longitude: 107.5909
    }));

    // Out-of-bounds input must be ignored
    component.onManualLatChange(120);
    expect(component.currentLat()).toBe(16.4637);
  });

  it('should sync updated inputs via ngOnChanges when switching branches in modal', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.initialLat = 11.9404;
    component.initialLng = 108.4452;
    component.initialAddress = '22 Bùi Thị Xuân, Đà Lạt';
    component.ngOnChanges({
      initialLat: new SimpleChange(10.7769, 11.9404, false),
      initialLng: new SimpleChange(106.7009, 108.4452, false),
      initialAddress: new SimpleChange('', '22 Bùi Thị Xuân, Đà Lạt', false)
    });

    expect(component.currentLat()).toBe(11.9404);
    expect(component.currentLng()).toBe(108.4452);
    expect(component.currentAddress()).toBe('22 Bùi Thị Xuân, Đà Lạt');
    expect(component.searchQuery()).toBe('22 Bùi Thị Xuân, Đà Lạt');
  });

  it('should locate user via 2-stage GPS fallback and show inline geoError on denial', () => {
    const fixture = TestBed.createComponent(GoogleMapPickerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.locationSelected, 'emit');
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((_ok: PositionCallback, err: PositionErrorCallback) => {
        err({ code: 3, message: 'Timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      })
      .mockImplementationOnce((ok: PositionCallback) => {
        ok({
          coords: { latitude: 10.8231, longitude: 106.6297 }
        } as GeolocationPosition);
      });

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition }
    });

    component.useCurrentLocation();

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(component.currentLat()).toBe(10.8231);
    expect(component.currentLng()).toBe(106.6297);
    expect(component.geoError()).toBeNull();
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 10.8231,
      longitude: 106.6297
    }));

    // Permission denied -> inline error
    const deniedMock = vi.fn((_ok: PositionCallback, err: PositionErrorCallback) => {
      err({ code: 1, message: 'Denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: deniedMock }
    });

    component.useCurrentLocation();
    expect(component.geoError()).toContain('Quyền truy cập vị trí');
  });
});
