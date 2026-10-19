import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../models/api-response.model';
import { environment } from '../../../environments/environment';

/** Xử lý lỗi HTTP: 401→refresh token, 403→redirect, 400→hiện validation errors, 500→toast lỗi */
export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const notification = inject(NotificationService);
  const apiPath = new URL(environment.apiUrl, 'http://localhost').pathname.replace(/\/$/, '');
  const requestPath = new URL(req.url, 'http://localhost').pathname;
  const publicPath = `${apiPath}/public`;
  const isPublicBooking = requestPath === publicPath || requestPath.startsWith(`${publicPath}/`);
  const isPublicAuth = ['login', 'register', 'partner-register', 'social-login', 'refresh-token']
    .some(endpoint => requestPath === `${apiPath}/auth/${endpoint}`);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Không xử lý lỗi từ refresh-token endpoint (tránh loop)
      if (isPublicAuth || (isPublicBooking && (error.status === 401 || error.status === 403))) {
        return throwError(() => error);
      }

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
        notification.error('Bạn không có quyền thực hiện thao tác này.');
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

      if (error.status >= 500) {
        notification.error('Lỗi hệ thống. Vui lòng thử lại sau.');
        return throwError(() => error);
      }

      // 400 validation errors — KHÔNG toast, để component tự xử lý hiện lỗi trên form
      return throwError(() => error);
    })
  );
};
