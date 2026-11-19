import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { JSDOM } from 'jsdom';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginPage } from './login.page';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('LoginPage security & accessibility', () => {
  const login = vi.fn();
  beforeEach(() => {
    login.mockReset();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login, memberships: [], fetchMyMemberships: () => of([]) } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ]
    });
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

  it('initializes with empty credentials and hides Facebook login button', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(fixture.componentInstance.loginForm.getRawValue()).toEqual({ email: '', password: '' });
    expect(element.textContent).not.toContain('Facebook');
    expect(element.textContent).not.toContain('Admin@123456');
    expect(element.textContent).not.toContain('HotelDev@2026!');
  });

  it('opens inline recovery guidance modal for Quên mật khẩu instead of /booking/lookup', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    const forgotLinks = Array.from(element.querySelectorAll('a')).filter(a => a.textContent?.includes('Quên mật khẩu'));
    expect(forgotLinks.length).toBe(0);

    const forgotBtn = Array.from(element.querySelectorAll('button')).find(b => b.textContent?.includes('Quên mật khẩu'));
    expect(forgotBtn).toBeDefined();
    forgotBtn?.click();
    fixture.detectChanges();

    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('does not submit again while a request is pending and never auto-retries failed logins', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.loginForm.setValue({
      email: 'superadmin@hotelsaas.platform',
      password: 'UserEnteredSecret!1'
    });
    login.mockReturnValue(new Subject());
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    expect(login).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.loading()).toBe(true);

    login.mockReset();
    fixture.componentInstance.loading.set(false);
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    fixture.componentInstance.onSubmit();
    expect(login).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.errorMessage()).toBeTruthy();
  });
});
