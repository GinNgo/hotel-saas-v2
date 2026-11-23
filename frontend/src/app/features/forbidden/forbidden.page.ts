import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TokenStorageService } from '../../core/services/token-storage.service';

const MANAGEMENT_ROLES = new Set(['SuperAdmin', 'TenantStaff', 'TenantOwner', 'Owner']);

/**
 * Trang thông báo từ chối quyền truy cập (403 Forbidden).
 * Hiển thị khi error interceptor hoặc route guard từ chối truy cập và chuyển hướng tới /forbidden.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] shadow-xs p-8 text-center">
        <div class="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-500/30">
          <i class="pi pi-shield text-3xl" aria-hidden="true"></i>
        </div>
        <h1 class="text-xl font-bold text-[var(--text-primary)] tracking-tight">Không có quyền truy cập</h1>
        <p class="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là sự nhầm lẫn.
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            [routerLink]="primaryRoute()"
            class="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-2xs"
          >
            <i class="pi pi-home text-xs" aria-hidden="true"></i>
            <span>{{ primaryLabel() }}</span>
          </a>
          @if (!isAuthenticated()) {
            <a
              routerLink="/auth/login"
              class="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium text-sm transition-colors"
            >
              <i class="pi pi-sign-in text-xs" aria-hidden="true"></i>
              <span>Đăng nhập</span>
            </a>
          }
        </div>
      </div>
    </div>
  `
})
export class ForbiddenPage {
  private readonly tokenStorage = inject(TokenStorageService);

  readonly isAuthenticated = computed(
    () => !!this.tokenStorage.getAccessToken() && !this.tokenStorage.isTokenExpired()
  );

  readonly isManagementUser = computed(() => {
    if (!this.isAuthenticated()) return false;
    const role = this.tokenStorage.getDecodedToken()?.globalRole;
    return !!role && MANAGEMENT_ROLES.has(role);
  });

  readonly primaryRoute = computed(() => (this.isManagementUser() ? '/dashboard' : '/booking'));
  readonly primaryLabel = computed(() =>
    this.isManagementUser() ? 'Về bảng điều khiển' : 'Về trang chủ đặt phòng'
  );
}
