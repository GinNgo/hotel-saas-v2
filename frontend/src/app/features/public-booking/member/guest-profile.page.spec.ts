import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { UserDto } from '../../../core/models/auth.model';
import { GuestProfilePageComponent } from './guest-profile.page';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('Real-session guest account', () => {
  const users = new BehaviorSubject<UserDto | null>(null);
  const logout = vi.fn(() => users.next(null));
  beforeEach(() => {
    users.next(null); logout.mockClear();
    TestBed.configureTestingModule({ imports: [GuestProfilePageComponent], providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser$: users, currentUser: null, logout } }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('shows sign-in with returnUrl instead of a demo account', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent); fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href*="returnUrl"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Nguyễn Minh Quân');
  });
  it('switches identity and clears private account content on logout', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'a', fullName: 'Khách A', email: 'a@example.com', globalRole: 'Customer', tenantId: null }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('a@example.com');
    fixture.componentInstance.logout(); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('a@example.com');
    users.next({ id: 'b', fullName: 'Khách B', email: 'b@example.com', globalRole: 'Customer', tenantId: null }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('b@example.com');
    expect(logout).toHaveBeenCalledOnce();
  });
  it('does not show guest tools to staff or fabricate invoices', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'staff', fullName: 'Staff', email: 'staff@example.com', globalRole: 'TenantStaff', tenantId: 'tenant' }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[download]')).toBeNull();
  });
});
