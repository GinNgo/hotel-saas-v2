import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { TokenStorageService } from './core/services/token-storage.service';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document,
    HTMLElement: browser.window.HTMLElement, Node: browser.window.Node,
    Event: browser.window.Event, CustomEvent: browser.window.CustomEvent,
    EventTarget: browser.window.EventTarget });
}
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class RouteStub {}

function stubComponents(config: Routes): Routes {
  return config.map(route => ({ ...route,
    ...(route.loadComponent ? { loadComponent: () => Promise.resolve(RouteStub) } : {}),
    ...(route.children ? { children: stubComponents(route.children) } : {})
  }));
}

describe('Public and management route boundaries', () => {
  let role: string | null;
  let router: Router;

  beforeEach(() => {
    role = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(stubComponents(routes)),
      { provide: TokenStorageService, useValue: {
        getAccessToken: () => role ? 'token' : null,
        isTokenExpired: () => !role,
        getDecodedToken: () => role ? { globalRole: role } : null,
        hasPermission: () => true
      } }
    ] });
    router = TestBed.inject(Router);
  });

  it.each(['/', '/booking', '/booking/properties/demo', '/booking/lookup'])('opens %s without a session', async url => {
    await router.navigateByUrl(url);
    expect(router.url).toBe(url === '/' ? '/booking' : url);
  });

  it('sends unauthenticated management traffic to its own login portal', async () => {
    await router.navigateByUrl('/admin/dashboard');
    const destination = router.parseUrl(router.url);
    expect(destination.root.children['primary'].segments.map(segment => segment.path)).toEqual(['auth', 'login']);
    expect(destination.queryParams).toEqual({ portal: 'admin', returnUrl: '/dashboard' });
  });

  it('keeps customer tokens out of the PMS layout', async () => {
    role = 'Customer';
    await router.navigateByUrl('/admin/dashboard');
    expect(router.url).toBe('/booking/profile');
  });

  it.each(['/admin/plans', '/admin/contracts', '/admin/ops-readiness', '/plans', '/contracts', '/ops-readiness'])('blocks staff from platform page %s', async url => {
    role = 'TenantStaff';
    await router.navigateByUrl(url);
    expect(router.url).toBe('/forbidden');
  });

  it('lets the platform administrator reach plan management and ops readiness', async () => {
    role = 'SuperAdmin';
    await router.navigateByUrl('/admin/plans');
    expect(router.url).toBe('/plans');

    await router.navigateByUrl('/admin/ops-readiness');
    expect(router.url).toBe('/ops-readiness');

    await router.navigateByUrl('/ops-readiness');
    expect(router.url).toBe('/ops-readiness');
  });

  it('routes /admin/users and /platform-users exclusively to SuperAdmin', async () => {
    role = 'TenantStaff';
    await router.navigateByUrl('/admin/users');
    expect(router.url).toBe('/forbidden');

    await router.navigateByUrl('/platform-users');
    expect(router.url).toBe('/forbidden');

    role = 'SuperAdmin';
    await router.navigateByUrl('/admin/users');
    expect(router.url).toBe('/platform-users');

    await router.navigateByUrl('/admin/platform-users');
    expect(router.url).toBe('/platform-users');
  });
});
