import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('Public portal HTTP errors', () => {
  async function request(url: string, status: number) {
    const auth = { logout: vi.fn(), refreshToken: vi.fn() };
    const router = { navigate: vi.fn() };
    const error = new HttpErrorResponse({ status, url });
    const injector = Injector.create({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: TokenStorageService, useValue: { getRefreshToken: () => null } },
      { provide: NotificationService, useValue: { error: vi.fn() } }
    ] });
    const next: HttpHandlerFn = () => throwError(() => error);
    const result = runInInjectionContext(injector, () => errorInterceptor(new HttpRequest('GET', url), next));
    await expect(firstValueFrom(result)).rejects.toBe(error);
    return { auth, router };
  }

  it.each([401, 403])('keeps anonymous public discovery in place on HTTP %s', async status => {
    const { auth, router } = await request('/api/public/properties', status);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['register', 'partner-register', 'social-login'])('lets %s display its own authentication error', async endpoint => {
    const { auth, router } = await request(`/api/auth/${endpoint}`, 401);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not bypass protected errors just because query text contains a public path', async () => {
    const { auth } = await request('/api/payments?next=/api/public/properties', 401);
    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it('retains the management forbidden redirect', async () => {
    const { router } = await request('/api/payments', 403);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
  });
});
