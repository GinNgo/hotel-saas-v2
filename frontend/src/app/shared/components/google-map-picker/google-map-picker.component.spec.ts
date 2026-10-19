import '@angular/compiler';
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

  afterEach(() => TestBed.resetTestingModule());

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
    const vungTauPreset = component.presets.find(p => p.provinceCode === '77')!;

    component.applySuggestion(vungTauPreset);

    expect(component.currentAddress()).toBe(vungTauPreset.address);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      address: vungTauPreset.address,
      latitude: vungTauPreset.lat,
      longitude: vungTauPreset.lng
    }));
  });
});
