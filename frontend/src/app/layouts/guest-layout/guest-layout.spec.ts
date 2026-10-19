import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GuestLayoutComponent } from './guest-layout';
import { AuthService } from '../../core/services/auth.service';
import { UserDto } from '../../core/models/auth.model';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document,
    HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('Marketplace guest header', () => {
  let users: BehaviorSubject<UserDto | null>;

  beforeEach(() => {
    users = new BehaviorSubject<UserDto | null>(null);
    TestBed.configureTestingModule({
      imports: [GuestLayoutComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: {
        currentUser$: users.asObservable(), currentUser: null, isLoggedIn: true,
      } }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps marketplace identity and guest sign-in without a global hold promise', () => {
    const fixture = TestBed.createComponent(GuestLayoutComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header')?.textContent).toContain('LuxeStay');
    expect(element.querySelector('header a[href*="portal=guest"]')).not.toBeNull();
    expect(element.textContent).not.toContain('miễn phí 10 phút');
    expect(element.textContent).not.toContain('Ví điểm');
    expect(element.textContent).not.toContain('Hóa đơn');
    expect(element.textContent).not.toContain('Tồn kho thời gian thực');
    expect(element.querySelector('header a[href="/booking/profile"]')).toBeNull();
  });

  it('opens navigation, closes on Escape and restores focus', () => {
    const fixture = TestBed.createComponent(GuestLayoutComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    document.body.appendChild(element);
    const toggle = element.querySelector<HTMLButtonElement>('button[aria-controls]')!;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const destination = element.querySelector<HTMLAnchorElement>('#guest-navigation a[href="/booking/destinations"]')!;
    destination.focus();
    destination.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('#guest-navigation')).toBeNull();
    expect(document.activeElement).toBe(toggle);
    element.remove();
  });

  it('preserves discovery, lookup and separate management login links', () => {
    const fixture = TestBed.createComponent(GuestLayoutComponent);
    fixture.detectChanges();
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    for (const path of ['/booking/destinations', '/booking/brands', '/booking/deals', '/booking/lookup']) {
      expect(element.querySelector('#guest-navigation a[href="' + path + '"]')).not.toBeNull();
    }
    expect(element.querySelector('#guest-navigation a[href*="portal=admin"]')).not.toBeNull();
    element.querySelector<HTMLAnchorElement>('#guest-navigation a')!.click();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('closes discovery when clicking outside without moving focus', () => {
    const fixture = TestBed.createComponent(GuestLayoutComponent);
    fixture.detectChanges();
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('updates the account destination when the guest session changes', () => {
    const fixture = TestBed.createComponent(GuestLayoutComponent);
    fixture.detectChanges();
    users.next({ fullName: 'Nguyễn An', globalRole: 'Customer' } as UserDto);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header a[href="/booking/profile"]')?.textContent).toContain('An');
    users.next(null);
    fixture.detectChanges();
    expect(element.querySelector('header a[href*="portal=guest"]')).not.toBeNull();
  });
});
