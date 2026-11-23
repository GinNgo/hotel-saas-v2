import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../models/api-response.model';
import { environment } from '../../../environments/environment';

function extractCorrelationId(error: HttpErrorResponse): string | null {
  const body = error.error;
  if (body && typeof body === 'object' && 'correlationId' in body) {
    const raw = (body as { correlationId?: unknown }).correlationId;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  const fromHeader = error.headers?.get('X-Correlation-Id')?.trim();
  return fromHeader || null;
}

function appendCorrelationId(message: string, correlationId: string | null): string {
  if (!correlationId || message.includes(correlationId)) {
    return message;
  }
  return `${message} (Mã tra cứu: ${correlationId})`;
}

/** Xử lý lỗi HTTP: 401→refresh token, 403→redirect, 400→hiện validation errors, 429/500→toast lỗi kèm Mã tra cứu */
export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const notification = inject(NotificationService);
  const apiPath = new URL(environment.apiUrl, 'http://localhost').pathname.replace(/\/$/, '');
  const requestPath = new URL(req.url, 'http://localhost').pathname;
  const publicPath = `${apiPath}/public`;
  const isPublicBooking = requestPath === publicPath || requestPath.startsWith(`${publicPath}/`);
  const isHealthProbe = requestPath === '/health' || requestPath.startsWith('/health/');
  const isPublicAuth = ['login', 'register', 'partner-register', 'social-login', 'google-login', 'verify-phone-firebase', 'refresh-token']
    .some(endpoint => requestPath === `${apiPath}/auth/${endpoint}`);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Không xử lý lỗi từ refresh-token endpoint hoặc health probe (tránh loop / toast ngoài ý muốn)
      if (isHealthProbe || isPublicAuth || (isPublicBooking && (error.status === 401 || error.status === 403))) {
        return throwError(() => error);
      }

      const correlationId = extractCorrelationId(error);

      if (error.status === 401) {
        // Token hết hạn → thử refresh
        const refreshToken = tokenStorage.getRefreshToken();
        if (refreshToken) {
          return authService.refreshToken().pipe(
            switchMap(() => {
              // Retry request gốc với token mới
              const newToken = tokenStorage.getAccessToken();
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(retryReq);
            }),
            catchError(() => {
              // Refresh cũng fail → logout
              authService.logout();
              notification.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
              return throwError(() => error);
            })
          );
        } else {
          authService.logout();
          return throwError(() => error);
        }
      }

      if (error.status === 403) {
        const isStaffOrPropertyEndpoint =
          requestPath.startsWith(`${apiPath}/staff`) ||
          requestPath.startsWith(`${apiPath}/properties`) ||
          requestPath.startsWith(`${apiPath}/rooms`) ||
          requestPath.startsWith(`${apiPath}/audit-logs`) ||
          requestPath.startsWith(`${apiPath}/reports`) ||
          requestPath.startsWith(`${apiPath}/subscriptions`) ||
          requestPath.startsWith(`${apiPath}/guests`);
        const isSuperAdmin = authService.currentUser?.globalRole === 'SuperAdmin';
        if (isStaffOrPropertyEndpoint || isSuperAdmin || req.method !== 'GET') {
          return throwError(() => error);
        }
        notification.error(appendCorrelationId('Bạn không có quyền thực hiện thao tác này.', correlationId));
        router.navigate(['/forbidden']);
        return throwError(() => error);
      }

      if (error.status === 404) {
        const body = error.error as ApiResponse<unknown>;
        notification.error(body?.message || 'Không tìm thấy dữ liệu.');
        return throwError(() => error);
      }

      if (error.status === 409) {
        const body = error.error as ApiResponse<unknown>;
        notification.error(body?.message || 'Dữ liệu bị trùng.');
        return throwError(() => error);
      }

      if (error.status === 429) {
        const body = error.error as ApiResponse<unknown> | null;
        const baseMsg =
          body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()
            ? body.message.trim()
            : 'Bạn gửi yêu cầu quá nhanh. Vui lòng chờ giây lát và thử lại.';
        notification.error(appendCorrelationId(baseMsg, correlationId));
        return throwError(() => error);
      }

      if (error.status >= 500) {
        if (!requestPath.endsWith('/audit-logs')) {
          notification.error(appendCorrelationId('Lỗi hệ thống. Vui lòng thử lại sau.', correlationId));
        }
        return throwError(() => error);
      }

      // 400 / 422 validation errors — KHÔNG toast, để component tự xử lý hiện lỗi trên form
      if (error.status === 400 || error.status === 422) {
        return throwError(() => error);
      }

      // Các lỗi ngoài dự kiến (mất mạng status 0, 408, 413, ...)
      const body = error.error as ApiResponse<unknown> | null;
      const unexpectedMsg =
        error.status === 0
          ? 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.'
          : (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) ||
            'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.';
      notification.error(appendCorrelationId(unexpectedMsg, correlationId));
      return throwError(() => error);
    })
  );
};
