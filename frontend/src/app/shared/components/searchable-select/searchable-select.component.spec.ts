import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchableSelectComponent, SearchableSelectItem } from './searchable-select.component';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('SearchableSelectComponent', () => {
  const mockItems: SearchableSelectItem[] = [
    { value: '79', label: 'Thành phố Hồ Chí Minh', badge: 'Đô thị TW', subLabel: 'Mã: 79' },
    { value: '01', label: 'Thành phố Hà Nội', badge: 'Thủ đô', subLabel: 'Mã: 01' },
    { value: '48', label: 'Thành phố Đà Nẵng', badge: 'Đô thị TW', subLabel: 'Mã: 48' },
    { value: '68', label: 'Tỉnh Lâm Đồng', badge: 'Tỉnh', subLabel: 'Mã: 68' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableSelectComponent]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('refreshes async options and selected labels without changing query or value', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('items', mockItems);
    fixture.componentInstance.writeValue('79');
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedItem()?.label).toBe(mockItems[0].label);
    expect(fixture.componentInstance.filteredItems()).toHaveLength(4);
    fixture.componentRef.setInput('items', [{ value: '79', label: 'Tên mới' }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedItem()?.label).toBe('Tên mới');
    expect(fixture.componentInstance.filteredItems()).toHaveLength(1);
  });

  it('keeps the clear action outside the trigger button', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('items', mockItems);
    fixture.componentInstance.writeValue('79');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('button [role="button"]')).toBeNull();
    expect(element.querySelector('button[aria-label="Xóa lựa chọn"]')).not.toBeNull();
  });

  it('selects using keyboard from the searchbox', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('items', mockItems);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    const search = element.querySelector<HTMLInputElement>('input')!;
    search.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    search.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fixture.componentInstance.currentValue()).toBe('79');
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('does not mutate or emit when disabled', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    component.setDisabledState?.(true);
    const changed = vi.fn();
    component.registerOnChange(changed);
    component.selectItem(mockItems[0]);
    expect(changed).not.toHaveBeenCalled();
    expect(component.currentValue()).toBe('');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('items', mockItems);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const trigger = element.querySelector<HTMLButtonElement>('button')!;
    trigger.click();
    fixture.detectChanges();
    element.querySelector('input')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('marks a closed control touched on blur without emitting changes for writeValue', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const touched = vi.fn();
    const changed = vi.fn();
    fixture.componentInstance.registerOnTouched(touched);
    fixture.componentInstance.registerOnChange(changed);
    fixture.componentInstance.writeValue('79');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('button')!.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(touched).toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentInstance.items = mockItems;
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should toggle dropdown open and closed', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    component.toggleDropdown();
    expect(component.isOpen()).toBe(true);
    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);
  });

  it('should not open dropdown if disabled or loading', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    component.disabled = true;
    fixture.detectChanges();

    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);

    component.disabled = false;
    component.loading = true;
    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);
  });

  it('should filter items case-insensitively and accent-insensitively', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    fixture.detectChanges();

    component.searchQuery.set('da nang');
    const filtered = component.filteredItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0].value).toBe('48');

    component.searchQuery.set('HO CHI MINH');
    const hcm = component.filteredItems();
    expect(hcm.length).toBe(1);
    expect(hcm[0].value).toBe('79');
  });

  it('should select an item and emit value', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.selectionChange, 'emit');
    const onChangeSpy = vi.fn();
    component.registerOnChange(onChangeSpy);

    component.selectItem(mockItems[0]);

    expect(component.currentValue()).toBe('79');
    expect(component.selectedItem()?.label).toBe('Thành phố Hồ Chí Minh');
    expect(emitSpy).toHaveBeenCalledWith('79');
    expect(onChangeSpy).toHaveBeenCalledWith('79');
    expect(component.isOpen()).toBe(false);
  });

  it('should clear selection when clearSelection is called', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    component.writeValue('79');
    fixture.detectChanges();

    expect(component.selectedItem()?.value).toBe('79');

    const emitSpy = vi.spyOn(component.selectionChange, 'emit');
    const mockEvent = {
      stopPropagation: vi.fn()
    } as unknown as Event;

    component.clearSelection(mockEvent);

    expect(component.currentValue()).toBe('');
    expect(component.selectedItem()).toBeNull();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('');
  });

  it('should support ControlValueAccessor writeValue', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    const component = fixture.componentInstance;
    component.items = mockItems;
    component.writeValue('01');
    fixture.detectChanges();

    expect(component.currentValue()).toBe('01');
    expect(component.selectedItem()?.label).toBe('Thành phố Hà Nội');
  });
});
