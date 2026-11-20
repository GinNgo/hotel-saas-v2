import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { AiConciergeChatComponent } from '../../shared/components/ai-concierge-chat/ai-concierge-chat.component';
import { SystemBannerBarComponent } from '../../shared/components/system-banner-bar/system-banner-bar.component';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-guest-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BrandLogoComponent,
    AiConciergeChatComponent,
    SystemBannerBarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host a:focus-visible, :host button:focus-visible {
      outline: 2px solid var(--focus-ring, #0D2E28);
      outline-offset: 3px;
    }
    .skip-link { position: absolute; top: 0; left: 1rem; z-index: 50; padding: 1rem; background: var(--surface-card); color: var(--text-primary); transform: translateY(-110%); }
    .skip-link:focus { transform: translateY(0); }
  `],
  template: `
    <div [attr.data-shell]="'marketplace'" class="min-h-screen flex flex-col bg-[var(--surface-canvas)] text-[var(--text-primary)] font-sans transition-colors duration-200">
      <a href="#booking-content" class="skip-link">Đến nội dung chính</a>
      <!-- 2. LIGHT/DARK LUXURY ARCHITECTURAL HEADER -->
      <header class="bg-[var(--surface-card)]/95 text-[var(--text-primary)] border-b border-[var(--border-subtle)] sticky top-0 z-30 shadow-xs backdrop-blur-md transition-colors duration-200">
        <!-- Top Micro Utility Bar -->
        <div class="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]/80">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-9 py-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <div class="flex items-center gap-4">
              <span class="inline-flex items-center gap-1.5 hover:text-[var(--brand-primary)] transition-colors whitespace-nowrap">
                <i class="pi pi-phone text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
                <span>Hotline 24/7: <strong class="text-[var(--text-primary)] font-bold num-tabular">1900 6868</strong></span>
              </span>
              <span class="hidden md:inline-flex items-center gap-1.5 text-[var(--text-muted)] whitespace-nowrap">
                <i class="pi pi-shield text-xs text-[var(--brand-primary)]" aria-hidden="true"></i>
                <span>Chính sách hủy &amp; hoàn tiền minh bạch theo từng cơ sở</span>
              </span>
            </div>

            <div class="flex items-center gap-3.5">
              <a
                routerLink="/auth/partner-register"
                class="inline-flex items-center gap-1.5 text-[var(--brand-primary)] hover:opacity-80 transition-colors font-semibold whitespace-nowrap"
              >
                <i class="pi pi-building text-xs" aria-hidden="true"></i>
                <span>Dành cho Chủ khách sạn: Đăng ký cơ sở</span>
              </a>
              <span class="text-[var(--border-strong)]" aria-hidden="true">|</span>
              <span class="inline-flex items-center gap-1.5 text-[var(--text-muted)] font-semibold cursor-default whitespace-nowrap">
                <i class="pi pi-globe text-xs" aria-hidden="true"></i>
                <span>VN &bull; VND</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Main Navigation Bar -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 xl:gap-4">
          <!-- Brand Logo -->
          <div class="shrink-0">
            <app-brand-logo size="md" [variant]="themeService.isDark() ? 'light' : 'dark'" />
          </div>

          <!-- Center Navigation Links -->
          <nav aria-label="Điều hướng chính" class="hidden lg:flex items-center gap-0.5 xl:gap-1 text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
            <a
              routerLink="/booking/destinations"
              routerLinkActive="bg-[var(--surface-subtle)] text-[var(--brand-primary)] font-bold"
              class="px-2.5 xl:px-3.5 min-h-11 py-2 rounded-xl hover:text-[var(--brand-primary)] hover:bg-[var(--surface-subtle)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i class="pi pi-compass text-xs text-[var(--brand-primary)]" aria-hidden="true"></i>
              <span>Khám Phá Địa Danh</span>
            </a>
            <a
              routerLink="/booking/deals"
              routerLinkActive="bg-[var(--surface-subtle)] text-[var(--brand-primary)] font-bold"
              class="px-2.5 xl:px-3.5 min-h-11 py-2 rounded-xl hover:text-[var(--brand-primary)] hover:bg-[var(--surface-subtle)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i class="pi pi-tag text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
              <span>Ưu Đãi Đặc Quyền</span>
            </a>
            <a
              routerLink="/booking/brands"
              routerLinkActive="bg-[var(--surface-subtle)] text-[var(--brand-primary)] font-bold"
              class="px-2.5 xl:px-3.5 min-h-11 py-2 rounded-xl hover:text-[var(--brand-primary)] hover:bg-[var(--surface-subtle)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i class="pi pi-star text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
              <span>Chuỗi Thương Hiệu</span>
            </a>
            <a
              routerLink="/booking/lookup"
              routerLinkActive="bg-[var(--surface-subtle)] text-[var(--brand-primary)] font-bold"
              class="px-2.5 xl:px-3.5 min-h-11 py-2 rounded-xl hover:text-[var(--brand-primary)] hover:bg-[var(--surface-subtle)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i class="pi pi-search text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
              <span>Tra Cứu Đặt Phòng</span>
            </a>
          </nav>

          <!-- Right Action Buttons -->
          <div class="flex items-center gap-2 xl:gap-2.5 shrink-0">
            <!-- Theme Toggle Button (Light / Dark Mode) -->
            <button
              type="button"
              (click)="themeService.toggleTheme()"
              class="inline-flex items-center justify-center min-w-11 min-h-11 w-11 h-11 rounded-xl bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all cursor-pointer"
              [attr.aria-label]="themeService.isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
              [title]="themeService.isDark() ? 'Chuyển sang chế độ Sáng (Light Mode)' : 'Chuyển sang chế độ Tối (Dark Mode)'"
              data-testid="theme-toggle-btn"
            >
              <i [class]="themeService.isDark() ? 'pi pi-sun text-amber-400 text-sm' : 'pi pi-moon text-[var(--text-primary)] text-sm'" aria-hidden="true"></i>
            </button>

            <!-- Tra Cứu Quick Button on Mobile -->
            <a
              routerLink="/booking/lookup"
              aria-label="Tra cứu đặt phòng"
              class="inline-flex lg:hidden items-center justify-center min-w-11 min-h-11 w-11 h-11 rounded-xl bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all text-xs"
              title="Tra cứu đặt phòng"
            >
              <i class="pi pi-search" aria-hidden="true"></i>
            </a>

            <!-- Partner B2B CTA Button -->
            <a
              routerLink="/auth/partner-register"
              class="hidden sm:inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all shadow-2xs whitespace-nowrap"
            >
              <i class="pi pi-building text-xs text-[var(--brand-primary)]" aria-hidden="true"></i>
              <span>Mở Khách Sạn</span>
            </a>

            <!-- User Auth / Profile Button -->
            <a
              [routerLink]="isAuthenticated() ? (isCustomer() ? '/booking/profile' : '/dashboard') : '/auth/login'"
              [queryParams]="isAuthenticated() ? {} : { portal: 'guest' }"
              class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs border whitespace-nowrap"
              [class]="isAuthenticated() ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-strong)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]' : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] border-transparent shadow-xs'"
            >
              <i [class]="isAuthenticated() ? 'pi pi-user-check text-[var(--brand-primary)] text-xs' : 'pi pi-user text-xs'" aria-hidden="true"></i>
              <span class="truncate max-w-28">{{ isAuthenticated() ? (isCustomer() ? userFirstName() : 'Quản trị PMS') : 'Đăng nhập' }}</span>
            </a>

            <!-- Mobile & Explore Dropdown -->
            <div #discoveryGroup class="relative lg:hidden" (keydown.escape)="closeMenu(menuToggle)">
              <button
                #menuToggle
                type="button"
                (click)="menuOpen.set(!menuOpen())"
                [attr.aria-expanded]="menuOpen()"
                aria-controls="guest-navigation"
                class="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-xl bg-[var(--surface-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold transition-all cursor-pointer"
                aria-label="Khám phá và danh mục"
              >
                <i class="pi pi-bars text-sm" aria-hidden="true"></i>
                <span class="hidden sm:inline lg:hidden xl:inline">Menu</span>
              </button>

              @if (menuOpen()) {
                <nav
                  id="guest-navigation"
                  aria-label="Khám phá và hỗ trợ"
                  class="absolute right-0 mt-3 w-64 max-w-[calc(100vw-2rem)] max-h-[75dvh] overflow-y-auto rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-2xl p-2.5 text-[var(--text-primary)] z-50 animate-fade-in"
                  (click)="menuOpen.set(false)"
                >
                  <div class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1">
                    Điều Hướng Nhanh
                  </div>
                  @for (link of exploreLinks; track link.path) {
                    <a
                      [routerLink]="link.path"
                      routerLinkActive="bg-[var(--surface-subtle)] text-[var(--brand-primary)] font-bold"
                      [routerLinkActiveOptions]="{ exact: link.path === '/booking' }"
                      class="flex items-center min-h-11 px-3 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {{ link.label }}
                    </a>
                  }
                  <div class="border-t border-[var(--border-subtle)] mt-2 pt-2 space-y-1">
                    <a
                      routerLink="/auth/partner-register"
                      class="flex items-center gap-2 min-h-11 px-3 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 rounded-xl"
                    >
                      <i class="pi pi-building text-xs text-amber-600 dark:text-amber-400" aria-hidden="true"></i>
                      <span>Đăng ký đối tác khách sạn</span>
                    </a>
                    <a
                      routerLink="/auth/login"
                      [queryParams]="{ portal: 'admin' }"
                      class="flex items-center gap-2 min-h-11 px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--brand-primary)] rounded-xl"
                    >
                      <i class="pi pi-lock text-xs" aria-hidden="true"></i>
                      <span>Cổng quản lý PMS</span>
                    </a>
                  </div>
                </nav>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- 3. NỘI DUNG TRANG CON -->
      <div id="booking-content" tabindex="-1" class="flex-1">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 empty:hidden">
          <app-system-banner-bar />
        </div>
        <router-outlet />
      </div>

      <!-- 4. FOOTER CHUYÊN NGHIỆP -->
      <footer class="bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-xs pt-12 pb-8 border-t border-[var(--border-subtle)] transition-colors duration-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div class="mb-3">
              <app-brand-logo size="md" [variant]="themeService.isDark() ? 'light' : 'dark'" [showTagline]="false" />
            </div>
            <p class="leading-relaxed text-[var(--text-secondary)]">
              Nền tảng Quản lý & Đặt phòng đa loại hình lưu trú (Khách sạn, Nhà nghỉ, Motel,
              Homestay, Resort) theo Địa danh, Khu du lịch và Khung giờ linh hoạt.
            </p>
          </div>

          <div>
            <h4 class="text-[var(--text-primary)] font-bold uppercase tracking-wider mb-3">
              Hình thức Đặt phòng
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Hourly' }" class="hover:text-[var(--brand-primary)] transition-colors">Thuê phòng theo giờ (Nhà nghỉ / Motel)</a></li>
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Overnight' }" class="hover:text-[var(--brand-primary)] transition-colors">Đặt phòng qua đêm theo chính sách cơ sở</a></li>
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Daily' }" class="hover:text-[var(--brand-primary)] transition-colors">Đặt khách sạn & resort theo ngày</a></li>
              <li><a routerLink="/booking/brands" class="hover:text-[var(--brand-primary)] transition-colors">Đặt theo chuỗi thương hiệu</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-[var(--text-primary)] font-bold uppercase tracking-wider mb-3">
              Địa danh Du lịch Nổi bật
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking/destinations/cho-dem-da-lat" class="hover:text-[var(--brand-primary)] transition-colors">Gần Chợ đêm Đà Lạt & Hồ Xuân Hương</a></li>
              <li><a routerLink="/booking/destinations/bai-sau-vung-tau" class="hover:text-[var(--brand-primary)] transition-colors">Gần Bãi Sau & Bãi Trước Vũng Tàu</a></li>
              <li><a routerLink="/booking/destinations/pho-di-bo-nguyen-hue" class="hover:text-[var(--brand-primary)] transition-colors">Gần Phố đi bộ Nguyễn Huệ & Bùi Viện</a></li>
              <li><a routerLink="/booking/destinations/cau-rong-da-nang" class="hover:text-[var(--brand-primary)] transition-colors">Gần Cầu Rồng & Biển Mỹ Khê Đà Nẵng</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-[var(--text-primary)] font-bold uppercase tracking-wider mb-3">
              Hỗ trợ Khách hàng & Đối tác
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking/lookup" class="hover:text-[var(--brand-primary)] transition-colors">Tra cứu mã giữ chỗ / Đặt phòng</a></li>
              <li><a routerLink="/booking/profile" class="hover:text-[var(--brand-primary)] transition-colors">Tài khoản khách hàng</a></li>
              <li><a routerLink="/auth/partner-register" class="hover:text-[var(--brand-primary)] transition-colors">Đăng ký mở chuỗi Khách sạn / Nhà nghỉ</a></li>
              <li><a routerLink="/auth/login" [queryParams]="{ portal: 'admin' }" class="hover:text-[var(--brand-primary)] transition-colors">Cổng vận hành Lễ tân & Chủ cơ sở</a></li>
            </ul>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-[var(--border-subtle)] flex flex-wrap justify-between items-center gap-4 text-[var(--text-muted)]">
          <span>© 2026 Hotel SaaS Platform v2 (.NET 10 + Angular 22). All rights reserved.</span>
          <span>Xem phòng trống và giá theo lịch lưu trú bạn chọn</span>
        </div>
      </footer>

      <!-- AI Concierge Floating Chatbot (Gemini + Maps Data) -->
      <app-ai-concierge-chat />
    </div>
  `,
})
export class GuestLayoutComponent {
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  @ViewChild('discoveryGroup') private discoveryGroup?: ElementRef<HTMLElement>;

  @HostListener('document:pointerdown', ['$event'])
  @HostListener('document:focusin', ['$event'])
  dismissOutsideMenu(event: Event): void {
    if (!this.discoveryGroup?.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  readonly menuOpen = signal(false);
  readonly exploreLinks = [
    { path: '/booking', label: 'Tìm chỗ nghỉ' },
    { path: '/booking/destinations', label: 'Khám phá điểm đến' },
    { path: '/booking/brands', label: 'Thương hiệu khách sạn' },
    { path: '/booking/deals', label: 'Ưu đãi' },
    { path: '/booking/lookup', label: 'Tra cứu đặt phòng' },
    { path: '/booking/profile', label: 'Hồ sơ, ví điểm và hóa đơn' },
  ];
  readonly currentUser = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUser });
  readonly isAuthenticated = computed(() => !!this.currentUser() && this.authService.isLoggedIn);

  closeMenu(toggle: HTMLButtonElement): void {
    this.menuOpen.set(false);
    toggle.focus();
  }
  readonly isCustomer = computed<boolean>(() => {
    const role = this.currentUser()?.globalRole;
    return role === 'Customer' || role === 'Guest';
  });
  readonly userFirstName = computed<string>(() => {
    const name = this.currentUser()?.fullName;
    if (!name) return 'Khách';
    const cleaned = name.replace(/\([^)]*\)/g, '').trim();
    const parts = (cleaned || name.trim()).split(/\s+/);
    return parts[parts.length - 1];
  });
}
