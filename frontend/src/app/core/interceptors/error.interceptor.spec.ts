import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpErrorResponse, HttpHandlerFn, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

interface RequestErrorOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS';
}

describe('Public portal & CorrelationId HTTP errors', () => {
  async function request(url: string, status: number, options: RequestErrorOptions = {}) {
    const auth = { logout: vi.fn(), refreshToken: vi.fn(), currentUser: null };
    const router = { navigate: vi.fn() };
    const notification = { error: vi.fn() };
    const error = new HttpErrorResponse({
      status,
      url,
      error: options.body,
      headers: options.headers ? new HttpHeaders(options.headers) : undefined
    });
    const injector = Injector.create({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: TokenStorageService, useValue: { getRefreshToken: () => null } },
      { provide: NotificationService, useValue: notification }
    ] });
    const next: HttpHandlerFn = () => throwError(() => error);
    const req = options.method === 'DELETE' || options.method === 'OPTIONS'
      ? new HttpRequest(options.method, url)
      : new HttpRequest(options.method ?? 'GET', url);
    const result = runInInjectionContext(injector, () => errorInterceptor(req, next));
    await expect(firstValueFrom(result)).rejects.toBe(error);
    return { auth, router, notification };
  }

  it.each([401, 403])('keeps anonymous public discovery in place on HTTP %s', async status => {
    const { auth, router } = await request('/api/public/properties', status);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['register', 'partner-register', 'social-login', 'google-login', 'verify-phone-firebase'])('lets %s display its own authentication error', async endpoint => {
    const { auth, router } = await request(`/api/auth/${endpoint}`, 401);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not bypass protected errors just because query text contains a public path', async () => {
    const { auth } = await request('/api/payments?next=/api/public/properties', 401);
    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it('retains the management forbidden redirect', async () => {
    const { router, notification } = await request('/api/payments', 403);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
    expect(notification.error).toHaveBeenCalledWith('Bạn không có quyền thực hiện thao tác này.');
  });

  it('appends CorrelationId from JSON body on HTTP 500 error toast', async () => {
    const { notification } = await request('/api/reservations', 500, {
      body: { success: false, message: 'Internal failure', correlationId: 'req-body-5001' }
    });
    expect(notification.error).toHaveBeenCalledWith(
      'Lỗi hệ thống. Vui lòng thử lại sau. (Mã tra cứu: req-body-5001)'
    );
  });

  it('falls back to X-Correlation-Id response header on HTTP 502 error toast', async () => {
    const { notification } = await request('/api/reservations', 502, {
      headers: { 'X-Correlation-Id': 'req-hdr-5029' }
    });
    expect(notification.error).toHaveBeenCalledWith(
      'Lỗi hệ thống. Vui lòng thử lại sau. (Mã tra cứu: req-hdr-5029)'
    );
  });

  it('appends CorrelationId from header on HTTP 403 forbidden toast', async () => {
    const { router, notification } = await request('/api/payments', 403, {
      headers: { 'X-Correlation-Id': 'req-403-auth' }
    });
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
    expect(notification.error).toHaveBeenCalledWith(
      'Bạn không có quyền thực hiện thao tác này. (Mã tra cứu: req-403-auth)'
    );
  });

  it('appends CorrelationId from JSON body on HTTP 429 rate-limit toast', async () => {
    const { notification } = await request('/api/reservations', 429, {
      body: { message: 'Quá giới hạn truy vấn.', correlationId: 'req-429-limit' }
    });
    expect(notification.error).toHaveBeenCalledWith(
      'Quá giới hạn truy vấn. (Mã tra cứu: req-429-limit)'
    );
  });

  it('appends CorrelationId on unexpected HTTP error status (e.g. 408) without toasting 400 validation errors', async () => {
    const { notification: notif408 } = await request('/api/reservations', 408, {
      headers: { 'X-Correlation-Id': 'req-408-timeout' }
    });
    expect(notif408.error).toHaveBeenCalledWith(
      'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau. (Mã tra cứu: req-408-timeout)'
    );

    const { notification: notif400 } = await request('/api/reservations', 400, {
      body: { message: 'Validation failed', correlationId: 'req-400-val' }
    });
    expect(notif400.error).not.toHaveBeenCalled();
  });

  it('skips error toast for /health/ready degraded probes so SystemHealthService handles them cleanly', async () => {
    const { notification } = await request('/health/ready', 503, {
      body: { status: 'degraded', database: 'unreachable' }
    });
    expect(notification.error).not.toHaveBeenCalled();
  });
});
