import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme.service';

/**
 * Layout cho các trang xác thực (Đăng nhập, Đăng ký).
 * Định hướng Visual:
 * - Hỗ trợ cả 2 chế độ Sáng / Tối tự động theo ThemeService.
 * - Card xác thực nổi bật, bo cong mềm mại và typography rõ nét.
 *
 * Hỗ trợ chế độ `wide` (max-w-4xl) cho các trang cần nhiều không gian hơn (ví dụ: partner-register).
 * Tự động phát hiện qua URL path.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen flex flex-col justify-center items-center bg-[var(--surface-ground)] p-4 sm:p-6 transition-colors duration-200 relative">
      <!-- Top Right Floating Theme Toggle -->
      <div class="absolute top-4 right-4 z-20">
        <button
          type="button"
          (click)="themeService.toggleTheme()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--surface-card)] hover:opacity-90 text-[var(--text-main)] border border-[var(--surface-border)] shadow-xs transition-all cursor-pointer"
          [attr.aria-label]="themeService.isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
          [title]="themeService.isDark() ? 'Chuyển sang chế độ Sáng (Light Mode)' : 'Chuyển sang chế độ Tối (Dark Mode)'"
          data-testid="auth-theme-toggle-btn"
        >
          <i [class]="themeService.isDark() ? 'pi pi-sun text-amber-400 text-sm' : 'pi pi-moon text-slate-700 text-sm'"></i>
        </button>
      </div>
      <div class="w-full" [class.max-w-md]="!wide()" [class.max-w-4xl]="wide()">
        <!-- Logo & Brand Header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25 mb-3.5 transform transition-transform hover:scale-105">
            <i class="pi pi-building text-2xl"></i>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Hotel SaaS</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1 font-medium">Nền tảng Quản trị & Đặt phòng Khách sạn Cao cấp</p>
        </div>

        <!-- Auth Card Container -->
        <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-6 sm:p-8 backdrop-blur-xs">
          <router-outlet></router-outlet>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-slate-400 mt-6 space-y-1">
          <p>&copy; 2026 Hotel SaaS Platform &bull; Phiên bản 2.0</p>
          <p class="text-[11px] text-slate-400/80">Kiến trúc Cloud &bull; Bảo mật Đa chi nhánh &bull; Trải nghiệm Khách lưu trú</p>
        </div>
      </div>
    </div>
  `
})
export class AuthLayoutComponent {
  readonly themeService = inject(ThemeService);
  wide = signal(false);

  private readonly router = inject(Router);

  constructor() {
    // Detect wide mode on navigation
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      this.wide.set(e.urlAfterRedirects.includes('/partner-register'));
    });

    // Also check initial URL on first load
    this.wide.set(this.router.url.includes('/partner-register'));
  }
}

