import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingFilterBarComponent } from './booking-filter-bar.component';

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
    element.querySelector('input[type="date"]')!.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
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
});
