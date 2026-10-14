import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-guest-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      <!-- 1. TOP SYSTEM BANNER (KHUYẾN MÃI TOÀN SÀN) -->
      @if (showPromoBanner()) {
        <div
          class="bg-indigo-950 text-indigo-100 text-xs py-2 px-4 flex items-center justify-between border-b border-indigo-900"
        >
          <div class="max-w-7xl mx-auto flex items-center gap-2 truncate">
            <span
              class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold uppercase text-[10px] shrink-0"
            >
              Ưu đãi mới
            </span>
            <span class="truncate">
              Đặt phòng Khách sạn, Nhà nghỉ & Motel theo giờ hoặc qua đêm gần các địa danh du lịch
              — Giữ chỗ miễn phí 10 phút!
            </span>
          </div>
          <button
            type="button"
            (click)="showPromoBanner.set(false)"
            class="text-indigo-300 hover:text-white ml-3 cursor-pointer shrink-0"
            aria-label="Đóng thông báo"
          >
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>
      }

      <!-- 2. HEADER ĐIỀU HƯỚNG GUEST PORTAL -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div
          class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
        >
          <!-- Logo & Navigation -->
          <div class="flex items-center gap-8">
            <a routerLink="/booking" class="flex items-center gap-2.5 group">
              <div
                class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-xs group-hover:bg-indigo-700 transition-colors"
              >
                H
              </div>
              <div>
                <span class="font-extrabold text-base text-slate-900 tracking-tight block leading-none">
                  HotelSaaS<span class="text-indigo-600">.vn</span>
                </span>
                <span class="text-[10px] text-slate-500 font-medium">
                  Hotel • Motel • Nhà nghỉ • Homestay
                </span>
              </div>
            </a>

            <nav class="hidden md:flex items-center gap-1">
              <a
                routerLink="/booking"
                routerLinkActive="bg-indigo-50 text-indigo-600"
                [routerLinkActiveOptions]="{ exact: true }"
                class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <i class="pi pi-search text-xs"></i>
                <span>Tìm & Đặt phòng</span>
              </a>

              <a
                routerLink="/booking/destinations"
                routerLinkActive="bg-indigo-50 text-indigo-600"
                class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <i class="pi pi-compass text-xs"></i>
                <span>Địa danh & Khu du lịch</span>
              </a>

              <a
                routerLink="/booking/brands"
                routerLinkActive="bg-indigo-50 text-indigo-600"
                class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <i class="pi pi-building text-xs"></i>
                <span>Chuỗi thương hiệu</span>
              </a>

              <a
                routerLink="/booking/deals"
                routerLinkActive="bg-indigo-50 text-indigo-600"
                class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <i class="pi pi-bolt text-amber-500 text-xs"></i>
                <span>Ưu đãi & Giờ vàng</span>
              </a>
            </nav>
          </div>

          <!-- Cụm nút chức năng bên phải -->
          <div class="flex items-center gap-2.5">
            <!-- Nút Tra cứu Đặt phòng nhanh bằng Token/Mã -->
            <a
              routerLink="/booking/lookup"
              class="px-3 py-2 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all"
            >
              <i class="pi pi-ticket text-indigo-600"></i>
              <span class="hidden sm:inline">Tra cứu đặt phòng</span>
            </a>

            <!-- Nút Đăng ký Đối tác Chuỗi / Cơ sở lưu trú -->
            <a
              routerLink="/auth/partner-register"
              class="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all"
            >
              <i class="pi pi-briefcase text-xs"></i>
              <span>Đăng ký Cơ sở / Chuỗi</span>
            </a>

            @if (isAuthenticated()) {
              <a
                routerLink="/dashboard"
                class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <i class="pi pi-th-large text-xs"></i>
                <span>Quản trị PMS</span>
              </a>
            } @else {
              <a
                routerLink="/auth/login"
                class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <i class="pi pi-user text-xs"></i>
                <span>Đăng nhập</span>
              </a>
            }
          </div>
        </div>
      </header>

      <!-- 3. NỘI DUNG TRANG CON -->
      <div class="flex-1">
        <router-outlet />
      </div>

      <!-- 4. FOOTER CHUYÊN NGHIỆP -->
      <footer class="bg-slate-900 text-slate-400 text-xs pt-12 pb-8 border-t border-slate-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div class="flex items-center gap-2 text-white font-extrabold text-base mb-3">
              <span class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-sm text-white">
                H
              </span>
              <span>HotelSaaS.vn</span>
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
              <li><a routerLink="/booking" [queryParams]="{ rentalType: 'Overnight' }" class="hover:text-white transition-colors">Đặt phòng qua đêm (21:00 - 10:00)</a></li>
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
              <li><a routerLink="/auth/partner-register" class="hover:text-white transition-colors">Đăng ký mở chuỗi Khách sạn / Nhà nghỉ</a></li>
              <li><a routerLink="/auth/login" class="hover:text-white transition-colors">Cổng vận hành Lễ tân & Chủ cơ sở</a></li>
            </ul>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-slate-800 flex flex-wrap justify-between items-center gap-4 text-slate-500">
          <span>© 2026 Hotel SaaS Platform v2 (.NET 10 + Angular 22). All rights reserved.</span>
          <span>Bảo mật đa tầng Multi-Tenant • Tồn kho thời gian thực</span>
        </div>
      </footer>
    </div>
  `,
})
export class GuestLayoutComponent {
  private readonly authService = inject(AuthService);

  readonly showPromoBanner = signal<boolean>(true);
  readonly isAuthenticated = computed<boolean>(() => this.authService.isLoggedIn);
}
