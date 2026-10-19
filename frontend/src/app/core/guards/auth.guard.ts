import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';

/** Chặn route nếu chưa đăng nhập */
export const authGuard: CanActivateFn = (_route, state) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (tokenStorage.getAccessToken() && !tokenStorage.isTokenExpired()) {
    const role = tokenStorage.getDecodedToken()?.globalRole;
    if (role === 'TenantStaff' || role === 'SuperAdmin') return true;
    return router.createUrlTree([role === 'Customer' || role === 'Guest' ? '/booking/profile' : '/forbidden']);
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { portal: 'admin', returnUrl: state.url }
  });
};

export const platformAdminGuard: CanActivateFn = (route, state) => {
  const access = authGuard(route, state);
  if (access !== true) return access;
  return inject(TokenStorageService).getDecodedToken()?.globalRole === 'SuperAdmin'
    ? true
    : inject(Router).createUrlTree(['/forbidden']);
};
