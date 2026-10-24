import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-guest-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host a:focus-visible, :host button:focus-visible {
      outline: 2px solid var(--color-indigo-600, #4f46e5);
      outline-offset: 3px;
    }
    .skip-link { position: absolute; top: 0; left: 1rem; z-index: 50; padding: 1rem; background: white; transform: translateY(-110%); }
    .skip-link:focus { transform: translateY(0); }
  `],
  template: `
    <div class="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      <a href="#booking-content" class="skip-link">Đến nội dung chính</a>
      <!-- 2. LIGHT LUXURY ARCHITECTURAL HEADER (CRISP, BRIGHT & PRESTIGIOUS) -->
      <header class="bg-white/95 text-slate-800 border-b border-slate-200/80 sticky top-0 z-30 shadow-xs backdrop-blur-md">
        <!-- Top Micro Utility Bar (Breeze Light) -->
        <div class="border-b border-slate-200/70 bg-slate-50/90">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between text-[11px] text-slate-600">
            <div class="flex items-center gap-4">
              <span class="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <i class="pi pi-phone text-[10px] text-amber-600"></i>
                <span>Hotline 24/7: <strong class="text-slate-900 font-bold">1900 6868</strong></span>
              </span>
              <span class="hidden md:inline-flex items-center gap-1.5 text-slate-500">
                <i class="pi pi-shield text-[10px] text-emerald-600"></i>
                <span>Bảo đảm 100% Hoàn tiền &amp; Mở khóa Smart Lock</span>
              </span>
            </div>

            <div class="flex items-center gap-3.5">
              <a 
                routerLink="/auth/partner-register" 
                class="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 transition-colors font-bold"
              >
                <i class="pi pi-building text-[10px]"></i>
                <span>Dành cho Chủ khách sạn: Đăng ký cơ sở</span>
              </a>
              <span class="text-slate-300">|</span>
              <span class="inline-flex items-center gap-1 text-slate-600 font-semibold cursor-default">
                <span>🇻🇳 VN &bull; VND</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Main Navigation Bar -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <!-- Brand Logo (Dark Variant on Crisp White) -->
          <app-brand-logo size="md" variant="dark" />

          <!-- Center Navigation Links -->
          <nav class="hidden lg:flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-700">
            <a 
              routerLink="/booking/destinations" 
              class="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-slate-100/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-compass text-[11px] text-indigo-500"></i>
              <span>Khám Phá Địa Danh</span>
            </a>
            <a 
              routerLink="/booking/deals" 
              class="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-slate-100/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-tag text-[11px] text-amber-600"></i>
              <span>Ưu Đãi Đặc Quyền</span>
            </a>
            <a 
              routerLink="/booking/brands" 
              class="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-slate-100/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-star text-[11px] text-amber-500"></i>
              <span>Chuỗi Thương Hiệu</span>
            </a>
            <a 
              routerLink="/booking/lookup" 
              class="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-slate-100/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-search text-[11px] text-slate-400"></i>
              <span>Tra Cứu Đặt Phòng</span>
            </a>
          </nav>

          <!-- Right Action Buttons -->
          <div class="flex items-center gap-2.5">
            <!-- Tra Cứu Quick Button on Mobile -->
            <a 
              routerLink="/booking/lookup" 
              class="inline-flex lg:hidden items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all text-xs"
              title="Tra cứu đặt phòng"
            >
              <i class="pi pi-search"></i>
            </a>

            <!-- Partner B2B CTA Button -->
            <a
              routerLink="/auth/partner-register"
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 transition-all shadow-2xs"
            >
              <i class="pi pi-building text-[10px] text-amber-600"></i>
              <span>Mở Khách Sạn</span>
            </a>

            <!-- User Auth / Profile Button -->
            <a 
              [routerLink]="isAuthenticated() ? (isCustomer() ? '/booking/profile' : '/dashboard') : '/auth/login'"
              [queryParams]="isAuthenticated() ? {} : { portal: 'guest' }"
              class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs border"
              [class]="isAuthenticated() ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-900 hover:bg-indigo-600 text-white border-transparent shadow-xs'"
            >
              <i [class]="isAuthenticated() ? 'pi pi-user-check text-indigo-600' : 'pi pi-user'" class="text-xs"></i>
              <span class="truncate max-w-28">{{ isAuthenticated() ? (isCustomer() ? userFirstName() : 'Quản trị PMS') : 'Đăng nhập' }}</span>
            </a>

            <!-- Mobile & Explore Dropdown -->
            <div #discoveryGroup class="relative" (keydown.escape)="closeMenu(menuToggle)">
              <button 
                #menuToggle 
                type="button" 
                (click)="menuOpen.set(!menuOpen())"
                [attr.aria-expanded]="menuOpen()" 
                aria-controls="guest-navigation"
                class="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                aria-label="Khám phá và danh mục"
              >
                <i class="pi pi-bars text-sm"></i>
                <span class="hidden sm:inline">Menu</span>
              </button>

              @if (menuOpen()) {
                <nav 
                  id="guest-navigation" 
                  aria-label="Khám phá và hỗ trợ"
                  class="absolute right-0 mt-3 w-64 max-w-[calc(100vw-2rem)] max-h-[75dvh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-2.5 text-slate-800 z-50 animate-fade-in"
                  (click)="menuOpen.set(false)"
                >
                  <div class="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    Điều Hướng Nhanh
                  </div>
                  @for (link of exploreLinks; track link.path) {
                    <a 
                      [routerLink]="link.path" 
                      class="flex items-center min-h-10 px-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                      {{ link.label }}
                    </a>
                  }
                  <div class="border-t border-slate-100 mt-2 pt-2 space-y-1">
                    <a 
                      routerLink="/auth/partner-register" 
                      class="flex items-center gap-2 min-h-10 px-3 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl"
                    >
                      <i class="pi pi-building text-xs text-amber-600"></i>
                      <span>Đăng ký đối tác khách sạn</span>
                    </a>
                    <a 
                      routerLink="/auth/login" 
                      [queryParams]="{ portal: 'admin' }" 
                      class="flex items-center gap-2 min-h-10 px-3 text-xs text-slate-700 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"
                    >
                      <i class="pi pi-lock text-xs"></i>
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
        <router-outlet />
      </div>

      <!-- 4. FOOTER CHUYÊN NGHIỆP -->
      <footer class="bg-slate-900 text-slate-400 text-xs pt-12 pb-8 border-t border-slate-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div class="mb-3">
              <app-brand-logo size="md" variant="light" [showTagline]="false" />
            </div>
            <p class="leading-relaxed text-slate-400">
              Nền tảng Quản lý & Đặt phòng đa loại hình lưu trú (Khách sạn, Nhà nghỉ, Motel,
              Homestay, Resort) theo Địa danh, Khu du lịch và Khung giờ linh hoạt.
            </p>
          </div>

          <div>
            <h4 class="text-white font-bold uppercase tracking-wider mb-3">
              Hình thức Đặt phòng
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Hourly' }" class="hover:text-white transition-colors">Thuê phòng theo giờ (Nhà nghỉ / Motel)</a></li>
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Overnight' }" class="hover:text-white transition-colors">Đặt phòng qua đêm theo chính sách cơ sở</a></li>
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Daily' }" class="hover:text-white transition-colors">Đặt khách sạn & resort theo ngày</a></li>
              <li><a routerLink="/booking/brands" class="hover:text-white transition-colors">Đặt theo chuỗi thương hiệu</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-white font-bold uppercase tracking-wider mb-3">
              Địa danh Du lịch Nổi bật
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking/destinations/cho-dem-da-lat" class="hover:text-white transition-colors">Gần Chợ đêm Đà Lạt & Hồ Xuân Hương</a></li>
              <li><a routerLink="/booking/destinations/bai-sau-vung-tau" class="hover:text-white transition-colors">Gần Bãi Sau & Bãi Trước Vũng Tàu</a></li>
              <li><a routerLink="/booking/destinations/pho-di-bo-nguyen-hue" class="hover:text-white transition-colors">Gần Phố đi bộ Nguyễn Huệ & Bùi Viện</a></li>
              <li><a routerLink="/booking/destinations/cau-rong-da-nang" class="hover:text-white transition-colors">Gần Cầu Rồng & Biển Mỹ Khê Đà Nẵng</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-white font-bold uppercase tracking-wider mb-3">
              Hỗ trợ Khách hàng & Đối tác
            </h4>
            <ul class="space-y-2">
              <li><a routerLink="/booking/lookup" class="hover:text-white transition-colors">Tra cứu mã giữ chỗ / Đặt phòng</a></li>
              <li><a routerLink="/booking/profile" class="hover:text-white transition-colors">Tài khoản khách hàng</a></li>
              <li><a routerLink="/auth/partner-register" class="hover:text-white transition-colors">Đăng ký mở chuỗi Khách sạn / Nhà nghỉ</a></li>
              <li><a routerLink="/auth/login" [queryParams]="{ portal: 'admin' }" class="hover:text-white transition-colors">Cổng vận hành Lễ tân & Chủ cơ sở</a></li>
            </ul>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-slate-800 flex flex-wrap justify-between items-center gap-4 text-slate-500">
          <span>© 2026 Hotel SaaS Platform v2 (.NET 10 + Angular 22). All rights reserved.</span>
          <span>Xem phòng trống và giá theo lịch lưu trú bạn chọn</span>
        </div>
      </footer>
    </div>
  `,
})
export class GuestLayoutComponent {
  private readonly authService = inject(AuthService);
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
    const parts = name.trim().split(' ');
    return parts[parts.length - 1];
  });
}
