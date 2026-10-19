import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { TokenStorageService } from '../services/token-storage.service';
import { authGuard } from './auth.guard';

describe('Management portal guard', () => {
  function check(role: string | null, expired = false) {
    const redirect = {} as UrlTree;
    const router = { navigate: vi.fn(), createUrlTree: vi.fn().mockReturnValue(redirect) };
    const injector = Injector.create({ providers: [
      { provide: Router, useValue: router },
      { provide: TokenStorageService, useValue: {
        getAccessToken: () => role ? 'token' : null,
        isTokenExpired: () => expired,
        getDecodedToken: () => role ? { globalRole: role } : null
      } }
    ] });
    const result = runInInjectionContext(injector, () => authGuard(
      {} as ActivatedRouteSnapshot, { url: '/admin/payments?date=2026-10-18' } as RouterStateSnapshot
    ));
    return { result, router, redirect };
  }

  it('preserves the staff destination and selects the management login portal', () => {
    const { result, router, redirect } = check(null);
    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { portal: 'admin', returnUrl: '/admin/payments?date=2026-10-18' }
    });
  });

  it.each(['Customer', 'Guest'])('keeps %s out of the management layout', role => {
    const { result, router, redirect } = check(role);
    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/booking/profile']);
  });

  it.each(['TenantStaff', 'SuperAdmin'])('allows the existing %s role', role => {
    expect(check(role).result).toBe(true);
  });

  it('fails closed for unrecognized roles', () => {
    const { result, router, redirect } = check('Unknown');
    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden']);
  });

  it('requires login again for expired staff tokens', () => {
    const { result, redirect } = check('TenantStaff', true);
    expect(result).toBe(redirect);
  });
});
