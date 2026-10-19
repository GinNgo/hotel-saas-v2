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
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
          <app-brand-logo size="md" variant="dark" />
          <nav aria-label="Điều hướng chính" class="flex items-center gap-2 sm:gap-4">
            <a routerLink="/booking/lookup" class="hidden sm:inline-flex items-center min-h-11 text-sm font-medium text-slate-700 hover:text-indigo-700">Tra cứu đặt phòng</a>
            <a [routerLink]="isAuthenticated() ? (isCustomer() ? '/booking/profile' : '/dashboard') : '/auth/login'"
              [queryParams]="isAuthenticated() ? {} : { portal: 'guest' }"
              class="inline-flex items-center justify-center min-h-11 max-w-36 px-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
              <span class="truncate">{{ isAuthenticated() ? (isCustomer() ? userFirstName() : 'Quản trị PMS') : 'Đăng nhập' }}</span>
            </a>
            <div #discoveryGroup class="relative" (keydown.escape)="closeMenu(menuToggle)">
              <button #menuToggle type="button" (click)="menuOpen.set(!menuOpen())"
                [attr.aria-expanded]="menuOpen()" aria-controls="guest-navigation"
                class="inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                aria-label="Khám phá và hỗ trợ">
                <span class="hidden lg:inline text-sm font-medium">Khám phá</span>
                <i class="pi pi-bars" aria-hidden="true"></i>
              </button>
              @if (menuOpen()) {
                <nav id="guest-navigation" aria-label="Khám phá và hỗ trợ"
                  class="absolute right-0 mt-3 w-64 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-lg p-2"
                  (click)="menuOpen.set(false)">
                  @for (link of exploreLinks; track link.path) {
                    <a [routerLink]="link.path" class="flex items-center min-h-11 px-3 rounded-lg text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{{ link.label }}</a>
                  }
                  <div class="border-t border-slate-200 mt-2 pt-2">
                    <a routerLink="/auth/partner-register" class="flex items-center min-h-11 px-3 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Đăng ký đối tác</a>
                    <a routerLink="/auth/login" [queryParams]="{ portal: 'admin' }" class="flex items-center min-h-11 px-3 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Cổng quản lý khách sạn</a>
                  </div>
                </nav>
              }
            </div>
          </nav>
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
