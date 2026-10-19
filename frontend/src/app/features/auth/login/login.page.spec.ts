import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { JSDOM } from 'jsdom';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginPage } from './login.page';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('Login form accessibility pilot', () => {
  const login = vi.fn();
  beforeEach(() => {
    login.mockReset();
    TestBed.configureTestingModule({ imports: [LoginPage], providers: [provideRouter([]),
      { provide: AuthService, useValue: { login, memberships: [], fetchMyMemberships: () => of([]) } },
      { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('associates errors with the real email and PrimeNG password inputs', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    fixture.componentInstance.loginForm.setValue({ email: '', password: '' });
    fixture.componentInstance.onSubmit();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('input#email')?.getAttribute('aria-describedby')).toBe('email-error');
    expect(element.querySelector('input#password')?.getAttribute('aria-describedby')).toBe('password-error');
    expect(element.querySelector('input#password')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('label[for="password"]')).not.toBeNull();
    expect(login).not.toHaveBeenCalled();
  });
  it('does not submit again while a request is pending', () => {
    const fixture = TestBed.createComponent(LoginPage);
    login.mockReturnValue(new Subject());
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    expect(login).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.loading()).toBe(true);
  });
});
