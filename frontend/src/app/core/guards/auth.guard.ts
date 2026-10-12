import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';

/** Chặn route nếu chưa đăng nhập */
export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (tokenStorage.getAccessToken() && !tokenStorage.isTokenExpired()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
