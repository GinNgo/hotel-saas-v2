import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { GuestAccountService } from '../../../core/services/guest-account.service';
import { AlertService } from '../../../core/services/alert.service';
import {
  GuestMeDto,
  GuestBookingSummaryDto,
} from '../../../core/models/guest-account.model';
import { PhoneOtpModalComponent } from '../../auth/phone-otp-modal/phone-otp-modal.component';

@Component({
  selector: 'app-guest-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PhoneOtpModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <i class="pi pi-sparkles text-[11px] text-amber-500"></i>
            <span>GUEST MEMBER DASHBOARD</span>
          </span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Bảng điều khiển Khách hàng &amp; Hội viên
          </h1>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <a
            routerLink="/booking/lookup"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <i class="pi pi-search text-xs text-indigo-600"></i>
            <span>Tra cứu mã đặt phòng</span>
          </a>
          <a
            routerLink="/booking"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <i class="pi pi-plus text-xs"></i>
            <span>Đặt phòng mới</span>
          </a>
        </div>
      </div>

      @if (!user()) {
        <section class="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-4 shadow-xs">
          <h2 class="text-xl font-semibold text-slate-900">Đăng nhập để xem Dashboard Khách hàng</h2>
          <p class="text-sm text-slate-600">
            Bạn có thể đăng nhập tài khoản khách lưu trú để quản lý lịch sử đặt phòng, hóa đơn, thẻ hội viên và ví điểm thưởng, hoặc tra cứu nhanh bằng mã giữ chỗ mà không cần đăng nhập.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              routerLink="/auth/login"
              [queryParams]="{ portal: 'guest', returnUrl: '/booking/profile' }"
              class="inline-flex min-h-11 items-center px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Đăng nhập khách hàng
            </a>
            <a
              routerLink="/booking/lookup"
              class="inline-flex min-h-11 items-center px-5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Tra cứu đặt phòng bằng mã
            </a>
          </div>
        </section>
      } @else if (!isGuest()) {
        <section class="p-6 sm:p-8 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <div class="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <i class="pi pi-shield"></i>
            <span>Phiên đăng nhập Quản trị viên / Nhân sự vận hành ({{ user()?.globalRole }})</span>
          </div>
          <p class="text-sm text-slate-700">
            Bạn đang đăng nhập bằng tài khoản quản trị khách sạn (PMS / Platform). Để xem Dashboard điều hành, vui lòng truy cập Cổng Quản lý PMS.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              routerLink="/dashboard"
              class="inline-flex min-h-11 items-center gap-2 px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              <i class="pi pi-chart-bar text-xs"></i>
              <span>Về Dashboard Quản trị (PMS)</span>
            </a>
            <button
              type="button"
              (click)="logout()"
              class="min-h-11 px-5 border border-slate-300 rounded-xl hover:bg-slate-50 text-sm font-medium cursor-pointer"
            >
              Đăng xuất để đổi sang Khách hàng
            </button>
          </div>
        </section>
      } @else {
        <!-- 1. BANNER TỔNG QUAN TÀI KHOẢN KHÁCH HÀNG -->
        <section
          class="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row justify-between gap-5 sm:items-center shadow-md"
        >
          <div class="flex items-center gap-4 sm:gap-5">
            <!-- Avatar Display -->
            <div class="relative shrink-0">
              @if (currentAvatarUrl()) {
                <img
                  [src]="currentAvatarUrl()"
                  alt="Ảnh đại diện"
                  class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-400/50 shadow-md bg-indigo-900"
                  (error)="onAvatarImgError($event)"
                />
              } @else {
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-800 border-2 border-indigo-400/40 flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl shadow-md">
                  {{ userInitials() }}
                </div>
              }
              <button
                type="button"
                (click)="startEditing()"
                class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-indigo-950 flex items-center justify-center text-[10px] cursor-pointer shadow-xs transition-transform hover:scale-110"
                title="Thay đổi ảnh đại diện hoặc họ tên"
              >
                <i class="pi pi-pencil"></i>
              </button>
            </div>

            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <i class="pi pi-star-fill text-[10px]"></i> Hội viên Chuỗi Di Sản
                </span>
                @if (isEmailVerified()) {
                  <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <i class="pi pi-verified text-[11px]"></i> Đã xác thực
                  </span>
                }
              </div>
              <h2 class="text-xl sm:text-2xl font-extrabold text-white truncate">
                Xin chào, {{ currentFullName() || user()?.fullName }}!
              </h2>
              <p class="text-xs sm:text-sm text-indigo-200 flex items-center gap-2 flex-wrap">
                <span>{{ user()?.email }}</span>
                @if (phoneNumber()) {
                  <span>• {{ phoneNumber() }}</span>
                }
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              (click)="logout()"
              class="px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <i class="pi pi-sign-out mr-1 text-xs"></i> Đăng xuất
            </button>
          </div>
        </section>

        <!-- 2. GUEST KPI METRICS STRIP (4 CARDS) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chuyến lưu trú</span>
              <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <i class="pi pi-calendar text-base"></i>
              </div>
            </div>
            <div class="mt-2.5">
              <div class="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">{{ bookings().length }}</div>
              <div class="text-xs text-slate-500 mt-1">
                {{ activeBookingsCount() }} đơn đang hiệu lực
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ví điểm thưởng</span>
              <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <i class="pi pi-star-fill text-base"></i>
              </div>
            </div>
            <div class="mt-2.5">
              <div class="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono">
                {{ (loyaltyData()?.totalPoints || 0) | number }}
              </div>
              <div class="text-xs text-slate-500 mt-1">
                Quy đổi ~ {{ (loyaltyData()?.pointsValueVnd || 0) | number }}₫
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chi tiêu tích lũy</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <i class="pi pi-wallet text-base"></i>
              </div>
            </div>
            <div class="mt-2.5">
              <div class="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono truncate">
                {{ totalSpentVnd() | number:'1.0-0' }}₫
              </div>
              <div class="text-xs text-slate-500 mt-1">
                Tích điểm tự động sau trả phòng
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đặc quyền Smart Lock</span>
              <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <i class="pi pi-key text-base"></i>
              </div>
            </div>
            <div class="mt-2.5">
              <div class="text-lg font-extrabold text-slate-900">Giữ phòng 15 phút</div>
              <div class="text-xs text-slate-500 mt-1">
                Cấp mã PIN tự động khi xác nhận
              </div>
            </div>
          </div>
        </div>

        <!-- 3. NAVIGATION TABS -->
        <nav aria-label="Các mục tài khoản" class="flex flex-wrap gap-2">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              (click)="selectTab(tab.id)"
              [attr.aria-current]="activeTab() === tab.id ? 'page' : null"
              [class.bg-indigo-600]="activeTab() === tab.id"
              [class.text-white]="activeTab() === tab.id"
              [class.bg-white]="activeTab() !== tab.id"
              [class.text-slate-700]="activeTab() !== tab.id"
              class="min-h-10 px-4 sm:px-5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer hover:border-indigo-400"
            >
              {{ tab.label }}
            </button>
          }
        </nav>

        <!-- 4. NỘI DUNG TỪNG TAB -->
        <section class="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-6 shadow-xs">
          @switch (activeTab()) {
            @case ('account') {
              <div class="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-2">
                <div>
                  <h2 class="text-lg sm:text-xl font-bold text-slate-900">Thông tin cá nhân &amp; Tổng quan</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Dữ liệu được xác thực trực tiếp theo tài khoản phiên đăng nhập</p>
                </div>
                @if (!isEditing()) {
                  <button
                    type="button"
                    (click)="startEditing()"
                    class="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
                  >
                    Chỉnh sửa họ tên
                  </button>
                }
              </div>

              @if (isEditing()) {
                <!-- FORM CHỈNH SỬA HỌ TÊN VÀ ẢNH ĐẠI DIỆN -->
                <form (ngSubmit)="saveProfile()" class="max-w-xl space-y-4 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
                  <!-- Avatar Picker -->
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Ảnh đại diện (Avatar)
                    </label>
                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-xl border border-slate-200 bg-white">
                      <div class="relative shrink-0">
                        @if (editAvatarUrl) {
                          <img
                            [src]="editAvatarUrl"
                            alt="Avatar preview"
                            class="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-sm"
                            (error)="onAvatarImgError($event)"
                          />
                        } @else {
                          <div class="w-16 h-16 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg border-2 border-slate-300">
                            {{ userInitials() }}
                          </div>
                        }
                      </div>

                      <div class="flex-1 min-w-0 w-full space-y-2">
                        <input
                          type="text"
                          [(ngModel)]="editAvatarUrl"
                          name="avatarUrl"
                          class="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                          placeholder="Dán link ảnh đại diện (URL) hoặc chọn mẫu..."
                        />
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-[11px] text-slate-500">Mẫu có sẵn:</span>
                          @for (p of avatarPresets; track p.url) {
                            <button
                              type="button"
                              (click)="selectAvatarPreset(p.url)"
                              class="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 hover:border-indigo-600 hover:text-indigo-700 bg-white cursor-pointer transition-colors"
                            >
                              {{ p.label }}
                            </button>
                          }
                          @if (editAvatarUrl) {
                            <button
                              type="button"
                              (click)="selectAvatarPreset('')"
                              class="text-[10px] px-2 py-0.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            >
                              Gỡ ảnh
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Họ và tên mới
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="editFullName"
                      name="fullName"
                      required
                      minlength="2"
                      maxlength="100"
                      class="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      placeholder="Nhập họ và tên..."
                    />
                    <p class="text-[11px] text-slate-500 mt-1">
                      Email và Số điện thoại được bảo vệ và không thể thay đổi tại màn hình này.
                    </p>
                  </div>

                  <div class="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      [disabled]="isSaving() || !editFullName.trim()"
                      class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      {{ isSaving() ? 'Đang lưu...' : 'Lưu thay đổi' }}
                    </button>
                    <button
                      type="button"
                      (click)="cancelEditing()"
                      class="px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 hover:bg-white cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              } @else {
                <dl class="grid sm:grid-cols-3 gap-6">
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Họ và tên</dt>
                    <dd class="mt-1.5 text-base font-bold text-slate-900">
                      {{ currentFullName() || user()?.fullName }}
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Địa chỉ Email</dt>
                    <dd class="mt-1.5 text-base font-medium text-slate-800 break-words">
                      {{ user()?.email }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Số điện thoại xác thực</dt>
                    <dd class="mt-1.5 flex items-center gap-2">
                      <span class="text-base font-mono font-bold" [ngClass]="phoneNumber() ? 'text-slate-900' : 'text-slate-400 italic text-xs'">
                        {{ phoneNumber() || 'Chưa liên kết' }}
                      </span>
                      <button
                        type="button"
                        (click)="showPhoneOtpModal.set(true)"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
                      >
                        <i class="pi pi-phone mr-1"></i>
                        {{ phoneNumber() ? 'Đổi SĐT' : 'Liên kết SĐT' }}
                      </button>
                    </dd>
                  </div>
                </dl>
              }

              <!-- Recent Bookings Preview inside Overview -->
              <div class="pt-6 border-t border-slate-100 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-bold text-slate-800">Đặt phòng gần đây của bạn</h3>
                  <button
                    type="button"
                    (click)="selectTab('bookings')"
                    class="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Xem tất cả ({{ bookings().length }}) →
                  </button>
                </div>

                @if (bookings().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="text-xs text-slate-600">
                      Bạn chưa có chuyến lưu trú nào gắn với tài khoản này. Khám phá 34+ khách sạn &amp; resort ngay!
                    </div>
                    <a
                      routerLink="/booking"
                      class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shrink-0 self-start sm:self-auto"
                    >
                      <span>Tìm phòng ngay</span>
                      <i class="pi pi-arrow-right text-[10px]"></i>
                    </a>
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (b of bookings().slice(0, 3); track b.id) {
                      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-900 text-sm">{{ b.property.name }}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" [ngClass]="getStatusBadgeClass(b.status)">
                              {{ b.status }}
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 mt-0.5">
                            Mã: <span class="font-mono font-semibold text-slate-700">{{ b.reference }}</span> • {{ b.checkInDate }} → {{ b.checkOutDate }}
                          </p>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-3">
                          <span class="font-mono font-extrabold text-indigo-600 text-sm">{{ b.totalAmount | number }}₫</span>
                          <a
                            [routerLink]="['/booking/status', b.id]"
                            class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                          >
                            Chi tiết
                          </a>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @case ('bookings') {
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 class="text-xl font-bold text-slate-900">Đặt phòng và hóa đơn</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Danh sách các đặt phòng gắn liền với tài khoản của bạn</p>
                </div>
                <button
                  type="button"
                  (click)="loadBookings()"
                  class="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
                >
                  Làm mới
                </button>
              </div>

              @if (isLoadingBookings()) {
                <div class="py-12 text-center text-slate-500 text-sm">
                  <i class="pi pi-spin pi-spinner text-indigo-600 text-xl mb-2"></i>
                  <p>Đang tải danh sách đặt phòng...</p>
                </div>
              } @else if (bookings().length === 0) {
                <div class="py-10 text-center space-y-3">
                  <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl">
                    <i class="pi pi-calendar-times"></i>
                  </div>
                  <h3 class="font-bold text-slate-800">Bạn chưa có đơn đặt phòng nào</h3>
                  <p class="text-xs text-slate-500 max-w-sm mx-auto">
                    Các chuyến lưu trú bạn đặt sau khi đăng nhập sẽ tự động hiển thị tại đây.
                  </p>
                  <div class="pt-2">
                    <a routerLink="/booking" class="inline-flex px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                      Khám phá chỗ nghỉ ngay
                    </a>
                  </div>
                </div>
              } @else {
                <div class="space-y-4">
                  @for (b of bookings(); track b.id) {
                    <article class="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50/50">
                      <div>
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-bold text-slate-900 text-sm">{{ b.property.name }}</span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" [ngClass]="getStatusBadgeClass(b.status)">
                            {{ b.status }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500">
                          Mã đặt chỗ: <span class="font-mono font-semibold text-slate-700">{{ b.reference }}</span> • {{ b.roomTypeName }}
                        </p>
                        <p class="text-xs text-slate-600 mt-1">
                          Lưu trú: <strong>{{ b.checkInDate }}</strong> đến <strong>{{ b.checkOutDate }}</strong> ({{ b.rentalType }})
                        </p>
                      </div>
                      <div class="text-right sm:shrink-0">
                        <span class="block text-base font-extrabold text-indigo-600">
                          {{ b.totalAmount | number }}₫
                        </span>
                        <a
                          [routerLink]="['/booking/status', b.id]"
                          class="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline font-semibold mt-1"
                        >
                          Xem chi tiết <i class="pi pi-arrow-right text-[10px]"></i>
                        </a>
                      </div>
                    </article>
                  }
                </div>
              }
            }

            @case ('loyalty') {
              <div class="border-b border-slate-100 pb-4">
                <h2 class="text-xl font-bold text-slate-900">Hội viên và điểm thưởng</h2>
                <p class="text-xs text-slate-500 mt-0.5">Số dư điểm thưởng thực tế từ hệ thống sổ cái điểm</p>
              </div>

              @if (loyaltyData(); as loyalty) {
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div class="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                    <span class="text-xs font-semibold text-indigo-600">Tổng điểm tích lũy</span>
                    <p class="text-2xl font-extrabold text-indigo-900 mt-1">{{ loyalty.totalPoints | number }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Quy đổi ~ {{ loyalty.pointsValueVnd | number }}₫</span>
                  </div>
                  <div class="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
                    <span class="text-xs font-semibold text-emerald-700">Điểm đã hoàn trả</span>
                    <p class="text-2xl font-extrabold text-emerald-900 mt-1">{{ loyalty.totalPointsRefunded | number }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Từ các đơn hủy hợp lệ</span>
                  </div>
                  <div class="bg-amber-50/70 p-4 rounded-xl border border-amber-100">
                    <span class="text-xs font-semibold text-amber-800">Thẻ hội viên</span>
                    <p class="text-2xl font-extrabold text-amber-900 mt-1">{{ loyalty.memberships?.length || 0 }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Tại các chuỗi liên kết</span>
                  </div>
                </div>
              } @else {
                <p class="text-sm text-slate-600">
                  Chưa có dữ liệu hội viên theo tài khoản. Điểm thưởng sẽ được tích lũy khi bạn hoàn tất chuyến lưu trú.
                </p>
              }
            }
          }
        </section>

        <a routerLink="/booking" class="inline-flex min-h-11 items-center text-indigo-700 hover:underline font-semibold text-sm">
          Tiếp tục khám phá chỗ nghỉ →
        </a>
      }

      <!-- Modal Xác thực & Liên kết SĐT qua Firebase SMS OTP -->
      <app-phone-otp-modal
        [visible]="showPhoneOtpModal()"
        (visibleChange)="showPhoneOtpModal.set($event)"
        [mode]="'link'"
        (verified)="onPhoneLinked($event)"
      />
    </main>
  `,
})
export class GuestProfilePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly guestAccountService = inject(GuestAccountService);
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  readonly isGuest = computed(() => ['Customer', 'Guest'].includes(this.user()?.globalRole ?? ''));
  readonly activeTab = signal<string>('account');

  readonly currentFullName = signal<string>('');
  readonly currentAvatarUrl = signal<string>('');
  readonly phoneNumber = signal<string>('');
  readonly isEmailVerified = signal<boolean>(false);
  readonly showPhoneOtpModal = signal<boolean>(false);

  readonly avatarPresets = [
    { label: 'An Ngô Võ Tuấn', url: '/images/avatars/an-ngo-vo-tuan.png' },
    { label: 'Doanh nhân VIP', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    { label: 'Khách du lịch', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  ];

  readonly userInitials = computed(() => {
    const name = (this.currentFullName() || this.user()?.fullName || 'Khách').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  onAvatarImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff';
  }

  selectAvatarPreset(url: string): void {
    this.editAvatarUrl = url;
  }

  onPhoneLinked(event: { success: boolean; phoneNumber: string }): void {
    if (event.success) {
      this.phoneNumber.set(event.phoneNumber);
      this.loadProfile();
    }
  }

  readonly isEditing = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  editFullName = '';
  editAvatarUrl = '';

  readonly bookings = signal<GuestBookingSummaryDto[]>([]);
  readonly isLoadingBookings = signal<boolean>(false);

  readonly loyaltyData = signal<any>(null);

  readonly activeBookingsCount = computed(() =>
    this.bookings().filter(
      b => b.status === 'Confirmed' || b.status === 'CheckedIn' || b.status === 'Held' || b.status === 'PendingPayment'
    ).length
  );

  readonly totalSpentVnd = computed(() =>
    this.bookings()
      .filter(b => b.status !== 'Cancelled' && b.status !== 'Expired')
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0)
  );

  readonly tabs = [
    { id: 'account', label: 'Tổng quan & Hồ sơ' },
    { id: 'bookings', label: 'Đặt phòng & Hóa đơn' },
    { id: 'loyalty', label: 'Ví điểm & Hội viên' },
  ];

  ngOnInit(): void {
    if (this.isGuest()) {
      this.loadProfile();
      this.loadBookings();
      this.loadLoyalty();
    }
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    if (tabId === 'bookings' && this.bookings().length === 0) {
      this.loadBookings();
    } else if (tabId === 'loyalty' && !this.loyaltyData()) {
      this.loadLoyalty();
    }
  }

  loadProfile(): void {
    this.guestAccountService
      .getMe()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me: GuestMeDto) => {
          this.currentFullName.set(me.fullName);
          this.phoneNumber.set(me.phoneNumber || '');
          this.isEmailVerified.set(me.emailVerified);
          this.currentAvatarUrl.set(me.avatarUrl || this.user()?.avatarUrl || '');
        },
        error: () => {
          this.currentFullName.set(this.user()?.fullName || '');
          this.currentAvatarUrl.set(this.user()?.avatarUrl || '');
        },
      });
  }

  startEditing(): void {
    this.editFullName = this.currentFullName() || this.user()?.fullName || '';
    this.editAvatarUrl = this.currentAvatarUrl() || '';
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
  }

  saveProfile(): void {
    const trimmed = this.editFullName.trim();
    if (trimmed.length < 2) return;

    this.isSaving.set(true);
    const avatarToSave = this.editAvatarUrl.trim() || null;
    this.guestAccountService
      .updateMe(trimmed, avatarToSave)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated: GuestMeDto) => {
          this.isSaving.set(false);
          this.isEditing.set(false);
          this.currentFullName.set(updated.fullName);
          this.currentAvatarUrl.set(updated.avatarUrl || '');
          this.auth.updateCurrentUser({ fullName: updated.fullName, avatarUrl: updated.avatarUrl });
          this.alert.success('Hồ sơ cá nhân và ảnh đại diện đã được cập nhật thành công.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.alert.error(err?.error?.message || 'Không thể cập nhật hồ sơ vào lúc này.');
        },
      });
  }

  loadBookings(): void {
    this.isLoadingBookings.set(true);
    this.guestAccountService
      .getBookings(1, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isLoadingBookings.set(false);
          this.bookings.set(res.items || []);
        },
        error: () => {
          this.isLoadingBookings.set(false);
          this.bookings.set([]);
        },
      });
  }

  loadLoyalty(): void {
    this.guestAccountService
      .getLoyaltyProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.loyaltyData.set(data);
        },
        error: () => {
          this.loyaltyData.set(null);
        },
      });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Confirmed':
      case 'CheckedIn':
        return 'bg-emerald-100 text-emerald-800';
      case 'PendingPayment':
      case 'Held':
        return 'bg-amber-100 text-amber-800';
      case 'Cancelled':
      case 'Expired':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  logout(): void {
    this.activeTab.set('account');
    this.currentFullName.set('');
    this.currentAvatarUrl.set('');
    this.bookings.set([]);
    this.loyaltyData.set(null);
    this.auth.logout();
  }
}
