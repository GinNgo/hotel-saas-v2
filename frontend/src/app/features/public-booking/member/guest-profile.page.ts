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
import { A11yModule } from '@angular/cdk/a11y';
import { AuthService } from '../../../core/services/auth.service';
import { GuestAccountService } from '../../../core/services/guest-account.service';
import { AlertService } from '../../../core/services/alert.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { PublicBookingService } from '../../../core/services/public-booking.service';
import {
  GuestMeDto,
  GuestBookingSummaryDto,
  GuestProfileResponseDto,
  LoyaltyPointLedgerItemDto,
  GuestInvoiceRecordDto,
  SocialAccountItemDto,
} from '../../../core/models/guest-account.model';
import { PublicPropertyDto } from '../../../core/models/public-booking.model';
import { PhoneOtpModalComponent } from '../../auth/phone-otp-modal/phone-otp-modal.component';

@Component({
  selector: 'app-guest-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, A11yModule, PhoneOtpModalComponent],
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
            class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <i class="pi pi-search text-xs text-indigo-600"></i>
            <span>Tra cứu mã đặt phòng</span>
          </a>
          <a
            routerLink="/booking"
            class="min-h-11 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
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
                  width="80"
                  height="80"
                  loading="lazy"
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
                aria-label="Thay đổi ảnh đại diện hoặc họ tên"
                class="absolute -bottom-2 -right-2 min-w-11 min-h-11 w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-indigo-950 flex items-center justify-center text-xs cursor-pointer shadow-xs transition-transform hover:scale-105"
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
                } @else if (profileLoaded() && !isSyntheticEmail()) {
                  <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30">
                    <i class="pi pi-exclamation-circle text-[11px]"></i> Email chưa xác thực
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

        <!-- BANNER GỢI Ý BỔ SUNG EMAIL CHO TÀI KHOẢN ĐĂNG KÝ BẰNG SĐT -->
        @if (isSyntheticEmail()) {
          <div class="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                <i class="pi pi-envelope text-lg"></i>
              </div>
              <div>
                <div class="text-xs font-bold text-amber-950">Tài khoản được đăng ký bằng Số điện thoại (Chưa liên kết Email cá nhân)</div>
                <p class="text-[11px] text-amber-800/90 mt-0.5">
                  Thêm địa chỉ Email để tự động nhận vé phòng PDF, mã QR check-in và hóa đơn VAT điện tử về hộp thư cá nhân.
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="startEditing()"
              class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <i class="pi pi-plus text-xs mr-1"></i>
              <span>Cập nhật Email ngay</span>
            </button>
          </div>
        } @else if (profileLoaded() && !isEmailVerified()) {
          <div role="status" class="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                <i class="pi pi-envelope text-lg"></i>
              </div>
              <div>
                <div class="text-xs font-bold text-amber-950">Email chưa xác thực</div>
                <p class="text-[11px] text-amber-800/90 mt-0.5">
                  Vui lòng xác thực địa chỉ email <strong>{{ user()?.email }}</strong> để bảo vệ tài khoản và nhận hóa đơn điện tử.
                </p>
                @if (verificationFeedback()) {
                  <p class="text-[11px] font-semibold text-emerald-800 mt-1">{{ verificationFeedback() }}</p>
                }
              </div>
            </div>
            <button
              type="button"
              (click)="resendVerificationEmail()"
              [disabled]="isResendingVerification()"
              class="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50 self-start sm:self-auto inline-flex items-center gap-1.5"
            >
              @if (isResendingVerification()) {
                <i class="pi pi-spin pi-spinner text-xs"></i>
                <span>Đang gửi...</span>
              } @else {
                <i class="pi pi-send text-xs"></i>
                <span>Gửi lại email xác thực</span>
              }
            </button>
          </div>
        }

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
              <div class="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">{{ bookings().length }}</div>
              <div class="text-xs text-slate-500 mt-1 tabular-nums">
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
              <div class="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono tabular-nums">
                {{ (loyaltyData()?.totalPoints || 0) | number }}
              </div>
              <div class="text-xs text-slate-500 mt-1 tabular-nums">
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
              <div class="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums truncate">
                {{ totalSpentVnd() | number:'1.0-0' }}₫
              </div>
              <div class="text-xs text-slate-500 mt-1">
                Tích điểm tự động sau trả phòng
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đặc quyền hội viên</span>
              <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <i class="pi pi-shield text-base"></i>
              </div>
            </div>
            <div class="mt-2.5">
              <div class="text-lg font-extrabold text-slate-900">Giữ phòng 15 phút</div>
              <div class="text-xs text-slate-500 mt-1">
                Quản lý đơn đặt phòng, đổi lịch &amp; hóa đơn VAT
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
                            width="64"
                            height="64"
                            loading="lazy"
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
                          type="url"
                          [(ngModel)]="editAvatarUrl"
                          name="avatarUrl"
                          class="w-full min-h-11 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                          placeholder="Dán đường dẫn ảnh đại diện cá nhân (https://...)"
                        />
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-[11px] text-slate-500">Để trống để dùng ảnh chữ cái viết tắt từ tên của bạn.</span>
                          @if (editAvatarUrl) {
                            <button
                              type="button"
                              (click)="clearAvatarUrl()"
                              class="min-h-11 text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
                    class="min-h-11 inline-flex items-center gap-1.5 px-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    <span>Xem tất cả (<span class="tabular-nums">{{ bookings().length }}</span>)</span>
                    <i class="pi pi-arrow-right text-[10px]"></i>
                  </button>
                </div>

                @if (bookings().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="text-xs text-slate-600">
                      Bạn chưa có chuyến lưu trú nào gắn với tài khoản này. Khám phá các khách sạn &amp; cơ sở lưu trú ngay!
                    </div>
                    <a
                      routerLink="/booking"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shrink-0 self-start sm:self-auto"
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
                          <p class="text-xs text-slate-500 mt-0.5 tabular-nums inline-flex items-center gap-1 flex-wrap">
                            <span>Mã: <span class="font-mono font-semibold text-slate-700">{{ b.reference }}</span></span>
                            <span>•</span>
                            <span>{{ b.checkInDate }}</span>
                            <i class="pi pi-arrow-right text-[9px]" aria-hidden="true"></i>
                            <span>{{ b.checkOutDate }}</span>
                          </p>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-3">
                          <span class="font-mono font-extrabold text-indigo-600 text-sm tabular-nums">{{ b.totalAmount | number }}₫</span>
                          <a
                            [routerLink]="['/booking/status', b.lookupToken || b.reference]"
                            class="min-h-11 inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
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
                          [routerLink]="['/booking/status', b.lookupToken || b.reference]"
                          class="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline font-semibold mt-1"
                        >
                          Xem chi tiết <i class="pi pi-arrow-right text-[10px]"></i>
                        </a>
                      </div>
                    </article>
                  }
                </div>
              }

              <!-- Danh sách Hóa đơn & Sổ cái (GET /api/guest/invoices) -->
              <div class="pt-6 border-t border-slate-100 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Hóa đơn lưu trú của bạn</h3>
                    <p class="text-xs text-slate-500">Hóa đơn phát sinh từ các đơn đặt phòng đã xác nhận hoặc trả phòng</p>
                  </div>
                  <button
                    type="button"
                    (click)="loadInvoices()"
                    class="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
                  >
                    Tải lại hóa đơn
                  </button>
                </div>

                @if (isLoadingInvoices()) {
                  <div class="py-6 text-center text-slate-500 text-xs">
                    <i class="pi pi-spin pi-spinner text-indigo-600 mr-1"></i>
                    <span>Đang tải danh sách hóa đơn...</span>
                  </div>
                } @else if (invoices().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                    Chưa có hóa đơn lưu trú nào được ghi nhận cho tài khoản này.
                  </div>
                } @else {
                  <div class="space-y-3">
                    @for (inv of invoices(); track inv.invoiceId) {
                      <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="space-y-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono font-bold text-slate-900 text-xs">{{ inv.invoiceNumber }}</span>
                            <span class="text-xs font-semibold text-slate-700">{{ inv.propertyName }}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{{ inv.status }}</span>
                          </div>
                          <p class="text-xs text-slate-500">
                            Mã đặt phòng: <span class="font-mono">{{ inv.reservationCode }}</span> • {{ inv.roomName }} • {{ inv.issuedAt }}
                          </p>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                          <span class="font-mono tabular-nums font-extrabold text-emerald-700 text-sm mr-1">{{ inv.grandTotal | number:'1.0-0' }}₫</span>
                          <button
                            type="button"
                            (click)="openInvoicePreview(inv)"
                            class="min-h-11 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center"
                          >
                            Xem chi tiết
                          </button>
                          <a
                            [routerLink]="['/print/invoice', inv.reservationId || inv.invoiceId]"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            <i class="pi pi-print text-[11px]"></i>
                            <span>In hóa đơn</span>
                          </a>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Thông tin xuất hóa đơn VAT doanh nghiệp (PUT /api/guest/vat-profile) -->
              <div class="pt-6 border-t border-slate-100 space-y-3">
                <div>
                  <h3 class="text-base font-bold text-slate-900">Thông tin xuất hóa đơn VAT</h3>
                  <p class="text-xs text-slate-500">Lưu thông tin doanh nghiệp để sử dụng khi cần xuất hóa đơn GTGT</p>
                </div>
                <form (ngSubmit)="saveVatProfile()" class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label for="vat-company-name" class="block text-[11px] font-bold text-slate-600 mb-1">Tên công ty</label>
                    <input
                      id="vat-company-name"
                      type="text"
                      [(ngModel)]="vatCompanyName"
                      name="vatCompanyName"
                      placeholder="Công ty TNHH..."
                      class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label for="vat-tax-code" class="block text-[11px] font-bold text-slate-600 mb-1">Mã số thuế</label>
                    <input
                      id="vat-tax-code"
                      type="text"
                      [(ngModel)]="vatTaxCode"
                      name="vatTaxCode"
                      placeholder="010xxxxxxx"
                      class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label for="vat-company-address" class="block text-[11px] font-bold text-slate-600 mb-1">Địa chỉ xuất hóa đơn</label>
                    <input
                      id="vat-company-address"
                      type="text"
                      [(ngModel)]="vatAddress"
                      name="vatAddress"
                      placeholder="Địa chỉ đăng ký kinh doanh..."
                      class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <div class="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      [disabled]="isSavingVat()"
                      class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {{ isSavingVat() ? 'Đang lưu...' : 'Lưu thông tin VAT' }}
                    </button>
                  </div>
                </form>
              </div>
            }

            @case ('loyalty') {
              <div class="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 class="text-xl font-bold text-slate-900">Hội viên và điểm thưởng</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Số dư điểm thưởng thực tế từ hệ thống sổ cái điểm</p>
                </div>
                <button
                  type="button"
                  (click)="openEnrollModal()"
                  class="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <i class="pi pi-id-card text-xs"></i>
                  <span>Đăng ký thẻ hội viên</span>
                </button>
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

                @if (loyalty.memberships && loyalty.memberships.length > 0) {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    @for (m of loyalty.memberships; track m.membershipId) {
                      <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-bold text-slate-900 text-sm">{{ m.tenantBrandName || m.enrolledPropertyName }}</span>
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{{ m.tier }}</span>
                        </div>
                        <div class="text-xs text-slate-500">
                          Mã thẻ: <span class="font-mono font-semibold text-slate-700">{{ m.memberCode }}</span> • {{ m.enrolledPropertyName }}
                        </div>
                        <div class="flex items-center justify-between text-xs pt-1">
                          <span class="text-slate-600">Điểm hiện có: <strong class="font-mono text-indigo-700">{{ m.pointsBalance | number }}</strong></span>
                          <span class="text-emerald-700 font-semibold">Ưu đãi {{ m.discountPercent }}%</span>
                        </div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <p class="text-sm text-slate-600">
                  Chưa có dữ liệu hội viên theo tài khoản. Điểm thưởng sẽ được tích lũy khi bạn hoàn tất chuyến lưu trú.
                </p>
              }

              <!-- Sổ cái biến động điểm thưởng (GET /api/guest/loyalty-ledger) -->
              <div class="pt-6 border-t border-slate-100 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Lịch sử sổ cái điểm thưởng</h3>
                    <p class="text-xs text-slate-500">Chi tiết giao dịch tích điểm, tiêu điểm và hoàn điểm</p>
                  </div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    @for (f of ledgerFilters; track f.value) {
                      <button
                        type="button"
                        (click)="filterLedger(f.value)"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors"
                        [ngClass]="ledgerFilter() === f.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                      >
                        {{ f.label }}
                      </button>
                    }
                  </div>
                </div>

                @if (isLoadingLedger()) {
                  <div class="py-6 text-center text-slate-500 text-xs">
                    <i class="pi pi-spin pi-spinner text-indigo-600 mr-1"></i>
                    <span>Đang tải lịch sử điểm thưởng...</span>
                  </div>
                } @else if (loyaltyLedger().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                    Chưa phát sinh giao dịch biến động điểm thưởng nào.
                  </div>
                } @else {
                  <div class="space-y-2">
                    @for (item of loyaltyLedger(); track item.id) {
                      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 flex items-center justify-between gap-3 text-xs">
                        <div class="space-y-0.5 min-w-0">
                          <div class="font-bold text-slate-900 truncate">{{ item.description || item.type }}</div>
                          <div class="text-slate-500 truncate">
                            {{ item.propertyName }} • Mã đơn: <span class="font-mono">{{ item.reservationCode }}</span> • {{ item.createdAt }}
                          </div>
                        </div>
                        <div class="text-right shrink-0">
                          <div
                            class="font-mono font-extrabold text-sm"
                            [ngClass]="item.pointsDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                          >
                            {{ item.pointsDelta >= 0 ? '+' : '' }}{{ item.pointsDelta | number }} điểm
                          </div>
                          <div class="text-[11px] text-slate-500 font-mono">Số dư: {{ item.balanceAfter | number }}</div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @case ('security') {
              <div class="border-b border-slate-100 pb-4">
                <h2 class="text-xl font-bold text-slate-900">Bảo mật tài khoản &amp; Liên kết đăng nhập</h2>
                <p class="text-xs text-slate-500 mt-0.5">Quản lý mật khẩu đăng nhập và các tài khoản liên kết Google</p>
              </div>

              <!-- 1. LIÊN KẾT TÀI KHOẢN MẠNG XÃ HỘI (GOOGLE) -->
              <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Tài khoản liên kết</h3>
                    <p class="text-xs text-slate-500">Đăng nhập một chạm bằng tài khoản Google đã xác thực</p>
                  </div>
                  @if (!hasLinkedGoogle()) {
                    <button
                      type="button"
                      (click)="linkGoogle()"
                      [disabled]="isLinkingSocial()"
                      class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 self-start sm:self-auto"
                    >
                      @if (isLinkingSocial()) {
                        <i class="pi pi-spin pi-spinner text-xs"></i>
                        <span>Đang liên kết Google...</span>
                      } @else {
                        <i class="pi pi-google text-rose-600 text-xs"></i>
                        <span>Liên kết tài khoản Google</span>
                      }
                    </button>
                  }
                </div>

                @if (isLoadingSocialAccounts()) {
                  <div class="py-4 text-xs text-slate-500">
                    <i class="pi pi-spin pi-spinner text-indigo-600 mr-1"></i>
                    <span>Đang tải danh sách liên kết...</span>
                  </div>
                } @else if (socialAccounts().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-600">
                    Bạn chưa liên kết tài khoản mạng xã hội nào. Liên kết Google để đăng nhập nhanh và đồng bộ đặt phòng.
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (acc of socialAccounts(); track acc.id) {
                      <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="space-y-0.5 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{{ acc.provider }}</span>
                            <span class="text-xs font-bold text-slate-900 truncate">{{ acc.providerEmail }}</span>
                          </div>
                          <p class="text-[11px] text-slate-500">
                            Đăng nhập gần nhất: {{ acc.lastLoginAtUtc | date:'dd/MM/yyyy HH:mm':'+0700' }}
                          </p>
                        </div>
                        <button
                          type="button"
                          (click)="unlinkSocial(acc.provider)"
                          [disabled]="unlinkingProvider() === acc.provider || (!hasLocalPassword() && socialAccounts().length <= 1)"
                          [title]="!hasLocalPassword() && socialAccounts().length <= 1 ? 'Cần có mật khẩu hoặc phương thức khác trước khi hủy liên kết duy nhất' : 'Hủy liên kết tài khoản'"
                          class="min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-start sm:self-auto"
                        >
                          {{ unlinkingProvider() === acc.provider ? 'Đang hủy...' : 'Hủy liên kết' }}
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (!hasLocalPassword() && socialAccounts().length <= 1 && socialAccounts().length > 0) {
                  <p class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Tài khoản của bạn chưa có mật khẩu cục bộ, nên không thể hủy phương thức đăng nhập Google duy nhất.
                  </p>
                }
              </div>

              <!-- 2. ĐỔI MẬT KHẨU (CHANGE PASSWORD) -->
              <div class="pt-6 border-t border-slate-100 space-y-4">
                <div>
                  <h3 class="text-base font-bold text-slate-900">Đổi mật khẩu</h3>
                  <p class="text-xs text-slate-500">Mật khẩu mới cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt</p>
                </div>

                @if (!hasLocalPassword() && socialAccountsLoaded()) {
                  <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    Tài khoản hiện đang đăng nhập bằng Google / SMS OTP và chưa thiết lập mật khẩu cục bộ.
                  </div>
                } @else {
                  <form (ngSubmit)="submitChangePassword()" class="max-w-lg space-y-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div>
                      <label for="profile-current-password" class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
                      <input
                        id="profile-current-password"
                        type="password"
                        [(ngModel)]="currentPassword"
                        name="currentPassword"
                        autocomplete="current-password"
                        required
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label for="profile-new-password" class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                      <input
                        id="profile-new-password"
                        type="password"
                        [(ngModel)]="newPassword"
                        name="newPassword"
                        autocomplete="new-password"
                        required
                        minlength="8"
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label for="profile-confirm-password" class="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                      <input
                        id="profile-confirm-password"
                        type="password"
                        [(ngModel)]="confirmNewPassword"
                        name="confirmNewPassword"
                        autocomplete="new-password"
                        required
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    @if (changePasswordError()) {
                      <div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                        {{ changePasswordError() }}
                      </div>
                    }

                    <button
                      type="submit"
                      [disabled]="isChangingPassword()"
                      class="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {{ isChangingPassword() ? 'Đang cập nhật...' : 'Cập nhật mật khẩu' }}
                    </button>
                  </form>
                }
              </div>
            }
          }
        </section>

        <a routerLink="/booking" class="inline-flex min-h-11 items-center gap-1.5 text-indigo-700 hover:underline font-semibold text-sm">
          <span>Tiếp tục khám phá chỗ nghỉ</span>
          <i class="pi pi-arrow-right text-xs"></i>
        </a>
      }

      <!-- Modal Xác thực & Liên kết SĐT qua Firebase SMS OTP -->
      <app-phone-otp-modal
        [visible]="showPhoneOtpModal()"
        (visibleChange)="showPhoneOtpModal.set($event)"
        [mode]="'link'"
        (verified)="onPhoneLinked($event)"
      />

      <!-- Modal Đăng ký thẻ hội viên cơ sở (POST /api/guest/memberships/enroll) -->
      @if (showEnrollModal()) {
        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enroll-modal-title"
          (keydown.escape)="closeEnrollModal()"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div class="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 id="enroll-modal-title" class="text-base font-black text-slate-900">Đăng ký thẻ hội viên mới</h3>
                <p class="text-xs text-slate-500">Nhận ngay 50 điểm thưởng chào mừng khi gia nhập</p>
              </div>
              <button
                type="button"
                (click)="closeEnrollModal()"
                aria-label="Đóng hộp thoại đăng ký hội viên"
                class="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            @if (isLoadingEnrollProperties()) {
              <div class="py-6 text-center text-xs text-slate-500">
                <i class="pi pi-spin pi-spinner text-indigo-600 mr-1"></i>
                <span>Đang tải danh sách cơ sở lưu trú...</span>
              </div>
            } @else if (enrollProperties().length === 0) {
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Hiện chưa có cơ sở khả dụng hoặc bạn đã gia nhập tất cả các chuỗi hiện có.
              </div>
            } @else {
              <div class="space-y-3">
                <label for="enroll-property-select" class="block text-xs font-bold text-slate-700">Chọn cơ sở tham gia</label>
                <select
                  id="enroll-property-select"
                  [ngModel]="selectedEnrollPropertyId()"
                  (ngModelChange)="selectedEnrollPropertyId.set($event)"
                  name="selectedEnrollPropertyId"
                  class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                >
                  @for (prop of enrollProperties(); track prop.propertyId) {
                    <option [value]="prop.propertyId">{{ prop.name }} ({{ prop.tenantBrandName }})</option>
                  }
                </select>
              </div>
            }

            @if (enrollError()) {
              <div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {{ enrollError() }}
              </div>
            }

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="closeEnrollModal()"
                [disabled]="isEnrolling()"
                class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                (click)="confirmEnrollMembership()"
                [disabled]="isEnrolling() || !selectedEnrollPropertyId()"
                class="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {{ isEnrolling() ? 'Đang đăng ký...' : 'Đăng ký ngay (+50 điểm)' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Chi tiết hóa đơn (GET /api/guest/invoices/{id}/print) -->
      @if (selectedInvoicePrint(); as inv) {
        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-preview-title"
          (keydown.escape)="selectedInvoicePrint.set(null)"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div class="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 id="invoice-preview-title" class="text-base font-black text-slate-900">Hóa đơn {{ inv.invoiceNumber }}</h3>
                <p class="text-xs text-slate-500">{{ inv.propertyName }} • Mã đặt phòng {{ inv.reservationCode }}</p>
              </div>
              <button
                type="button"
                (click)="selectedInvoicePrint.set(null)"
                aria-label="Đóng xem trước hóa đơn"
                class="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
            <div class="p-5 overflow-y-auto space-y-4 text-xs">
              <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span class="text-slate-500 block">Phòng:</span>
                  <strong class="text-slate-900">{{ inv.roomName }} {{ inv.roomNumber ? '(' + inv.roomNumber + ')' : '' }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block">Thanh toán:</span>
                  <strong class="text-slate-900">{{ inv.paymentMethod }} ({{ inv.status }})</strong>
                </div>
              </div>
              @if (inv.lineItems && inv.lineItems.length > 0) {
                <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  @for (line of inv.lineItems; track line.id) {
                    <div class="p-3 flex items-center justify-between gap-2">
                      <span>{{ line.description }} (x{{ line.quantity }})</span>
                      <span class="font-mono tabular-nums font-bold">{{ line.amount | number:'1.0-0' }}₫</span>
                    </div>
                  }
                </div>
              }
              <div class="space-y-1.5 pt-2 border-t border-slate-200 tabular-nums">
                <div class="flex justify-between text-slate-600">
                  <span>Tạm tính:</span>
                  <span class="font-mono">{{ inv.subTotal | number:'1.0-0' }}₫</span>
                </div>
                @if (inv.discountTotal > 0) {
                  <div class="flex justify-between text-emerald-700">
                    <span>Giảm giá:</span>
                    <span class="font-mono">-{{ inv.discountTotal | number:'1.0-0' }}₫</span>
                  </div>
                }
                <div class="flex justify-between text-slate-600">
                  <span>Thuế GTGT:</span>
                  <span class="font-mono">{{ inv.taxAmount | number:'1.0-0' }}₫</span>
                </div>
                <div class="flex justify-between font-black text-sm text-indigo-700 pt-1">
                  <span>Tổng thanh toán:</span>
                  <span class="font-mono">{{ inv.grandTotal | number:'1.0-0' }}₫</span>
                </div>
              </div>
            </div>
            <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="selectedInvoicePrint.set(null)"
                class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
              <a
                [routerLink]="['/print/invoice', inv.reservationId || inv.invoiceId]"
                (click)="selectedInvoicePrint.set(null)"
                class="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                <i class="pi pi-print text-xs"></i>
                <span>In hóa đơn chính thức</span>
              </a>
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class GuestProfilePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly guestAccountService = inject(GuestAccountService);
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly socialAuth = inject(SocialAuthService, { optional: true });
  private readonly publicBookingService = inject(PublicBookingService, { optional: true });

  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  readonly isGuest = computed(() => ['Customer', 'Guest'].includes(this.user()?.globalRole ?? ''));
  readonly isSyntheticEmail = computed(() => {
    const email = this.user()?.email || '';
    return email.endsWith('@phone.hotelsaas.local') || email.includes('phone_') || !email.includes('@');
  });
  readonly activeTab = signal<string>('account');

  readonly currentFullName = signal<string>('');
  readonly currentAvatarUrl = signal<string>('');
  readonly phoneNumber = signal<string>('');
  readonly isEmailVerified = signal<boolean>(false);
  readonly profileLoaded = signal<boolean>(false);
  readonly showPhoneOtpModal = signal<boolean>(false);
  readonly isResendingVerification = signal<boolean>(false);
  readonly verificationFeedback = signal<string>('');

  readonly userInitials = computed(() => {
    const name = (this.currentFullName() || this.user()?.fullName || 'Khách').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  onAvatarImgError(_event: Event): void {
    this.currentAvatarUrl.set('');
  }

  clearAvatarUrl(): void {
    this.editAvatarUrl = '';
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

  readonly loyaltyData = signal<GuestProfileResponseDto | null>(null);
  readonly loyaltyLedger = signal<LoyaltyPointLedgerItemDto[]>([]);
  readonly isLoadingLedger = signal<boolean>(false);
  readonly ledgerFilter = signal<string>('');
  readonly invoices = signal<GuestInvoiceRecordDto[]>([]);
  readonly isLoadingInvoices = signal<boolean>(false);
  readonly selectedInvoicePrint = signal<GuestInvoiceRecordDto | null>(null);
  readonly isSavingVat = signal<boolean>(false);

  readonly showEnrollModal = signal<boolean>(false);
  readonly isLoadingEnrollProperties = signal<boolean>(false);
  readonly enrollProperties = signal<PublicPropertyDto[]>([]);
  readonly selectedEnrollPropertyId = signal<string>('');
  readonly isEnrolling = signal<boolean>(false);
  readonly enrollError = signal<string>('');

  readonly socialAccounts = signal<SocialAccountItemDto[]>([]);
  readonly hasLocalPassword = signal<boolean>(true);
  readonly socialAccountsLoaded = signal<boolean>(false);
  readonly isLoadingSocialAccounts = signal<boolean>(false);
  readonly isLinkingSocial = signal<boolean>(false);
  readonly unlinkingProvider = signal<string | null>(null);
  readonly hasLinkedGoogle = computed(() =>
    this.socialAccounts().some(a => a.provider.toLowerCase() === 'google')
  );

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  readonly isChangingPassword = signal<boolean>(false);
  readonly changePasswordError = signal<string>('');

  vatCompanyName = '';
  vatTaxCode = '';
  vatAddress = '';

  readonly ledgerFilters = [
    { value: '', label: 'Tất cả' },
    { value: 'Earned', label: 'Cộng điểm' },
    { value: 'Redeemed', label: 'Đổi điểm' },
    { value: 'Refunded', label: 'Hoàn điểm' },
  ];

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
    { id: 'security', label: 'Bảo mật & Liên kết' },
  ];

  ngOnInit(): void {
    if (this.isGuest()) {
      this.loadProfile();
      this.loadBookings();
      this.loadLoyalty();
      this.loadInvoices();
      this.loadSocialAccounts();
    }
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    if (tabId === 'bookings') {
      if (this.bookings().length === 0) {
        this.loadBookings();
      }
      if (this.invoices().length === 0) {
        this.loadInvoices();
      }
    } else if (tabId === 'loyalty') {
      if (!this.loyaltyData()) {
        this.loadLoyalty();
      } else if (this.loyaltyLedger().length === 0) {
        this.loadLoyaltyLedger();
      }
    } else if (tabId === 'security') {
      this.loadSocialAccounts();
    }
  }

  loadProfile(): void {
    this.guestAccountService
      .getMe()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me: GuestMeDto) => {
          this.profileLoaded.set(true);
          this.currentFullName.set(me.fullName);
          this.phoneNumber.set(me.phoneNumber || '');
          this.isEmailVerified.set(me.emailVerified);
          this.currentAvatarUrl.set(me.avatarUrl || this.user()?.avatarUrl || '');
        },
        error: () => {
          this.profileLoaded.set(true);
          this.currentFullName.set(this.user()?.fullName || '');
          this.currentAvatarUrl.set(this.user()?.avatarUrl || '');
        },
      });
  }

  resendVerificationEmail(): void {
    if (this.isResendingVerification() || typeof this.guestAccountService.resendVerificationEmail !== 'function') {
      return;
    }
    const email = this.user()?.email;
    this.isResendingVerification.set(true);
    this.verificationFeedback.set('');

    this.guestAccountService
      .resendVerificationEmail(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isResendingVerification.set(false);
          const msg = res?.message || 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư (kể cả thư rác).';
          this.verificationFeedback.set(msg);
          this.alert.success(msg);
        },
        error: (err) => {
          this.isResendingVerification.set(false);
          this.alert.error(err?.error?.message || 'Không thể gửi lại email xác thực lúc này.');
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
          if (data) {
            this.vatCompanyName = data.companyName || '';
            this.vatTaxCode = data.companyTaxCode || '';
            this.vatAddress = data.companyAddress || '';
          }
        },
        error: () => {
          this.loyaltyData.set(null);
        },
      });
    this.loadLoyaltyLedger();
  }

  loadLoyaltyLedger(): void {
    if (typeof this.guestAccountService.getLoyaltyLedger !== 'function') {
      return;
    }
    this.isLoadingLedger.set(true);
    this.guestAccountService
      .getLoyaltyLedger(this.ledgerFilter() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.isLoadingLedger.set(false);
          this.loyaltyLedger.set(items || []);
        },
        error: () => {
          this.isLoadingLedger.set(false);
          this.loyaltyLedger.set([]);
        },
      });
  }

  filterLedger(filterType: string): void {
    this.ledgerFilter.set(filterType);
    this.loadLoyaltyLedger();
  }

  loadInvoices(): void {
    if (typeof this.guestAccountService.getInvoices !== 'function') {
      return;
    }
    this.isLoadingInvoices.set(true);
    this.guestAccountService
      .getInvoices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.isLoadingInvoices.set(false);
          this.invoices.set(items || []);
        },
        error: () => {
          this.isLoadingInvoices.set(false);
          this.invoices.set([]);
        },
      });
  }

  saveVatProfile(): void {
    if (typeof this.guestAccountService.updateVatProfile !== 'function') {
      return;
    }
    this.isSavingVat.set(true);
    this.guestAccountService
      .updateVatProfile({
        companyName: this.vatCompanyName.trim() || null,
        companyTaxCode: this.vatTaxCode.trim() || null,
        companyAddress: this.vatAddress.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingVat.set(false);
          this.alert.success('Cập nhật thông tin xuất hóa đơn VAT thành công.');
        },
        error: (err) => {
          this.isSavingVat.set(false);
          this.alert.error(err?.error?.message || 'Không thể cập nhật thông tin VAT lúc này.');
        },
      });
  }

  openInvoicePreview(inv: GuestInvoiceRecordDto): void {
    if (typeof this.guestAccountService.getInvoicePrintView === 'function') {
      this.guestAccountService
        .getInvoicePrintView(inv.reservationId || inv.invoiceId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detail) => this.selectedInvoicePrint.set(detail || inv),
          error: () => this.selectedInvoicePrint.set(inv),
        });
    } else {
      this.selectedInvoicePrint.set(inv);
    }
  }

  openEnrollModal(): void {
    this.enrollError.set('');
    this.selectedEnrollPropertyId.set('');
    this.showEnrollModal.set(true);

    if (!this.publicBookingService || typeof this.publicBookingService.getProperties !== 'function') {
      this.enrollProperties.set([]);
      return;
    }

    this.isLoadingEnrollProperties.set(true);
    const enrolledTenantIds = new Set((this.loyaltyData()?.memberships ?? []).map(m => m.tenantId));

    this.publicBookingService
      .getProperties({ page: 1, pageSize: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (props) => {
          this.isLoadingEnrollProperties.set(false);
          const eligible = (props || []).filter(p => !enrolledTenantIds.has(p.tenantId));
          this.enrollProperties.set(eligible);
          if (eligible.length > 0) {
            this.selectedEnrollPropertyId.set(eligible[0].propertyId);
          }
        },
        error: () => {
          this.isLoadingEnrollProperties.set(false);
          this.enrollProperties.set([]);
        },
      });
  }

  closeEnrollModal(): void {
    if (this.isEnrolling()) return;
    this.showEnrollModal.set(false);
  }

  confirmEnrollMembership(): void {
    const propertyId = this.selectedEnrollPropertyId().trim();
    if (!propertyId || this.isEnrolling() || typeof this.guestAccountService.enrollMembership !== 'function') {
      return;
    }

    this.isEnrolling.set(true);
    this.enrollError.set('');

    this.guestAccountService
      .enrollMembership(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (membership) => {
          this.isEnrolling.set(false);
          this.showEnrollModal.set(false);
          this.alert.success(`Đăng ký thành viên ${membership.enrolledPropertyName} thành công!`);
          this.loadLoyalty();
        },
        error: (err) => {
          this.isEnrolling.set(false);
          this.enrollError.set(err?.error?.message || 'Không thể đăng ký thẻ hội viên lúc này.');
        },
      });
  }

  loadSocialAccounts(): void {
    if (typeof this.guestAccountService.getSocialAccounts !== 'function') {
      return;
    }
    this.isLoadingSocialAccounts.set(true);
    this.guestAccountService
      .getSocialAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isLoadingSocialAccounts.set(false);
          this.socialAccountsLoaded.set(true);
          this.hasLocalPassword.set(res.hasPassword);
          this.socialAccounts.set(res.accounts || []);
        },
        error: () => {
          this.isLoadingSocialAccounts.set(false);
        },
      });
  }

  async linkGoogle(): Promise<void> {
    if (this.isLinkingSocial() || typeof this.guestAccountService.linkGoogleAccount !== 'function') {
      return;
    }
    if (!this.socialAuth) {
      this.alert.error('Chức năng liên kết Google chưa được cấu hình.');
      return;
    }

    this.isLinkingSocial.set(true);
    try {
      const socialUser = await this.socialAuth.signInWithGoogle();
      const idToken = socialUser.idToken;
      if (!idToken) {
        throw new Error('Không nhận được mã xác thực Google.');
      }
      this.guestAccountService
        .linkGoogleAccount(idToken)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isLinkingSocial.set(false);
            this.alert.success('Liên kết tài khoản Google thành công.');
            this.loadSocialAccounts();
          },
          error: (err) => {
            this.isLinkingSocial.set(false);
            this.alert.error(err?.error?.message || 'Không thể liên kết tài khoản Google.');
          },
        });
    } catch (err) {
      this.isLinkingSocial.set(false);
      const msg = err instanceof Error && err.message ? err.message : 'Liên kết Google không thành công.';
      this.alert.error(msg);
    }
  }

  unlinkSocial(provider: string): void {
    if (!provider || this.unlinkingProvider() || typeof this.guestAccountService.unlinkSocialAccount !== 'function') {
      return;
    }
    this.unlinkingProvider.set(provider);
    this.guestAccountService
      .unlinkSocialAccount(provider)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.unlinkingProvider.set(null);
          this.alert.success(res?.message || `Đã hủy liên kết ${provider}.`);
          this.loadSocialAccounts();
        },
        error: (err) => {
          this.unlinkingProvider.set(null);
          this.alert.error(err?.error?.message || `Không thể hủy liên kết ${provider}.`);
        },
      });
  }

  submitChangePassword(): void {
    if (this.isChangingPassword() || typeof this.guestAccountService.changePassword !== 'function') {
      return;
    }

    const currentPwd = this.currentPassword;
    const nextPwd = this.newPassword;
    const confirmPwd = this.confirmNewPassword;

    if (!currentPwd || !nextPwd) {
      this.changePasswordError.set('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (nextPwd !== confirmPwd) {
      this.changePasswordError.set('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }
    if (
      nextPwd.length < 8 ||
      !/[A-Z]/.test(nextPwd) ||
      !/[a-z]/.test(nextPwd) ||
      !/[0-9]/.test(nextPwd) ||
      !/[^a-zA-Z0-9]/.test(nextPwd)
    ) {
      this.changePasswordError.set('Mật khẩu mới phải từ 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.');
      return;
    }
    if (nextPwd === currentPwd) {
      this.changePasswordError.set('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    this.isChangingPassword.set(true);
    this.changePasswordError.set('');

    this.guestAccountService
      .changePassword({ currentPassword: currentPwd, newPassword: nextPwd })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isChangingPassword.set(false);
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmNewPassword = '';
          this.alert.success(res?.message || 'Đổi mật khẩu thành công.');
        },
        error: (err) => {
          this.isChangingPassword.set(false);
          this.changePasswordError.set(err?.error?.message || 'Không thể đổi mật khẩu lúc này.');
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
    this.phoneNumber.set('');
    this.isEmailVerified.set(false);
    this.profileLoaded.set(false);
    this.verificationFeedback.set('');
    this.bookings.set([]);
    this.loyaltyData.set(null);
    this.loyaltyLedger.set([]);
    this.invoices.set([]);
    this.selectedInvoicePrint.set(null);
    this.showEnrollModal.set(false);
    this.enrollProperties.set([]);
    this.enrollError.set('');
    this.socialAccounts.set([]);
    this.socialAccountsLoaded.set(false);
    this.hasLocalPassword.set(true);
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.changePasswordError.set('');
    this.vatCompanyName = '';
    this.vatTaxCode = '';
    this.vatAddress = '';
    this.auth.logout();
  }
}
