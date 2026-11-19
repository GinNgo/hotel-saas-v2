import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .skip-link {
      position: absolute;
      top: 0;
      left: 1rem;
      z-index: var(--z-toast, 100);
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--surface-card);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
      font-weight: 600;
      transform: translateY(-120%);
      transition: transform var(--duration-fast, 150ms) ease;
    }
    .skip-link:focus {
      transform: translateY(0.5rem);
    }
  `],
  template: `
    <div class="min-h-screen flex flex-col justify-center items-center bg-[var(--surface-canvas)] dark:bg-slate-900 text-[var(--text-primary)] p-4 sm:p-6 transition-colors duration-200 relative">
      <a href="#auth-main-content" class="skip-link">Đến nội dung chính</a>

      <!-- Top Right Floating Theme Toggle -->
      <div class="absolute top-4 right-4 z-20">
        <button
          type="button"
          (click)="themeService.toggleTheme()"
          class="inline-flex items-center justify-center min-w-11 min-h-11 w-11 h-11 rounded-xl bg-[var(--surface-card)] dark:bg-slate-800 hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-subtle)] dark:border-slate-700 shadow-xs transition-all cursor-pointer"
          [attr.aria-label]="themeService.isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
          [title]="themeService.isDark() ? 'Chuyển sang chế độ Sáng (Light Mode)' : 'Chuyển sang chế độ Tối (Dark Mode)'"
          data-testid="auth-theme-toggle-btn"
        >
          <i [class]="themeService.isDark() ? 'pi pi-sun text-amber-400 text-sm' : 'pi pi-moon text-[var(--text-primary)] text-sm'" aria-hidden="true"></i>
        </button>
      </div>
      <div class="w-full" [class.max-w-md]="!wide()" [class.max-w-4xl]="wide()">
        <!-- Logo & Brand Header -->
        <header class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25 mb-3.5 transform transition-transform hover:scale-105">
            <i class="pi pi-building text-2xl" aria-hidden="true"></i>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] dark:text-slate-100 tracking-tight">Hotel SaaS</h1>
          <p class="text-xs sm:text-sm text-[var(--text-muted)] dark:text-slate-400 mt-1 font-medium">Nền tảng Quản trị & Đặt phòng Khách sạn Cao cấp</p>
        </header>

        <!-- Auth Card Container -->
        <main
          id="auth-main-content"
          tabindex="-1"
          class="bg-[var(--surface-card)] dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/70 dark:shadow-slate-950/60 border border-[var(--border-subtle)] dark:border-slate-700 p-6 sm:p-8 focus:outline-none"
        >
          <router-outlet></router-outlet>
        </main>

        <!-- Footer -->
        <footer class="text-center text-xs text-[var(--text-muted)] dark:text-slate-400 mt-6 space-y-1">
          <p>&copy; 2026 Hotel SaaS Platform &bull; Phiên bản 2.0</p>
          <p class="text-xs text-[var(--text-muted)] dark:text-slate-400/80">Kiến trúc Cloud &bull; Bảo mật Đa chi nhánh &bull; Trải nghiệm Khách lưu trú</p>
        </footer>
      </div>
    </div>
  `
})
export class AuthLayoutComponent {
  readonly themeService = inject(ThemeService);
  wide = signal(false);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Detect wide mode on navigation
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((e) => {
      this.wide.set(e.urlAfterRedirects.includes('/partner-register'));
    });

    // Also check initial URL on first load
    this.wide.set(this.router.url.includes('/partner-register'));
  }
}

