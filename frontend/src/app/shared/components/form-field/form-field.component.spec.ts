import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { FormFieldComponent, FormControlDirective } from './form-field.component';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

@Component({ standalone: true, imports: [FormFieldComponent, FormControlDirective], template: `
  <app-form-field #nameField controlId="test-name" label="Họ tên" hint="Tên người nhận phòng" [error]="error()">
    <input [appFormControl]="nameField" />
  </app-form-field>
  <app-form-field #emailField controlId="test-email" label="Email">
    <input [appFormControl]="emailField" />
  </app-form-field>
` })
class FieldHost { readonly error = signal(''); }

describe('Form field contract', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('associates each visible label and hint with the projected native control', () => {
    TestBed.configureTestingModule({ imports: [FieldHost] });
    const fixture = TestBed.createComponent(FieldHost);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('label')?.htmlFor).toBe('test-name');
    expect(element.querySelector('#test-name')?.getAttribute('aria-describedby')).toBe('test-name-hint');
    expect(element.querySelector('#test-email')).not.toBeNull();
    expect(element.querySelectorAll('#test-name')).toHaveLength(1);
  });
  it('updates error associations without dropping the field value', async () => {
    TestBed.configureTestingModule({ imports: [FieldHost] });
    const fixture = TestBed.createComponent(FieldHost);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Giữ nguyên';
    fixture.componentInstance.error.set('Vui lòng nhập họ tên');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#test-name-error')?.textContent).toContain('Vui lòng');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('test-name-hint test-name-error');
    expect(fixture.nativeElement.querySelector('#test-name-error')?.textContent).toContain('Vui lòng');
    expect(input.value).toBe('Giữ nguyên');
  });
});
