import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';
import { NotificationService } from '../services/notification.service';

/**
 * Chặn route nếu không đủ quyền.
 * Dùng: canActivate: [permissionGuard], data: { permission: 'ROOMS', action: 1 }
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const tokenStorage = inject(TokenStorageService);
  const notification = inject(NotificationService);
  const router = inject(Router);

  const permission = route.data['permission'] as string;
  const action = route.data['action'] as number;

  if (!permission || !action) return true; // Không config → cho qua

  if (tokenStorage.hasPermission(permission, action)) {
    return true;
  }

  notification.error('Bạn không có quyền truy cập trang này.');
  router.navigate(['/forbidden']);
  return false;
};
