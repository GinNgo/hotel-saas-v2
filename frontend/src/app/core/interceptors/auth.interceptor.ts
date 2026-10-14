import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';

/**
 * Tự động gắn:
 * 1. Authorization: Bearer <accessToken> vào mọi request nếu có token.
 * 2. X-Property-Id: <activePropertyId> nếu người dùng đã chọn chi nhánh làm việc,
 *    giúp bảo đảm nhất quán giữa header và token claims theo TenantPropertyContextMiddleware.
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const tokenStorage = inject(TokenStorageService);
  const token = tokenStorage.getAccessToken();
  const activePropertyId = tokenStorage.getActivePropertyId();

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Không gắn X-Property-Id cho các endpoint auth công khai
  const isAuthPublic = req.url.includes('/auth/login') ||
                       req.url.includes('/auth/register') ||
                       req.url.includes('/auth/refresh-token');

  if (activePropertyId && !isAuthPublic) {
    headers['X-Property-Id'] = activePropertyId;
  }

  if (Object.keys(headers).length > 0) {
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
};
