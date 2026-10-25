import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { CreateGuestHoldRequest, GuestBookingDetailDto, PublicPropertyDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { PublicStayContext, publicStayInterval, readPublicStay } from '../../core/models/public-stay-context';
import { FormFieldComponent, FormControlDirective } from '../../shared/components/form-field/form-field.component';

export interface HoldErrorState {
  title: string;
  message: string;
  type: 'network' | 'server' | 'business' | 'expired';
  isRetryable: boolean;
  note?: string;
}

@Component({
  selector: 'app-booking-hold-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FormFieldComponent, FormControlDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative">
      <!-- TOAST THÔNG BÁO HỆ THỐNG (LUXESTAY TOAST — VỊ TRÍ GÓC DƯỚI KHÔNG CHE HEADER/NAV) -->
      @if (toast(); as t) {
        <aside
          role="status"
          aria-live="polite"
          class="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-96 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
        >
          <div
            class="flex items-start gap-3 p-4 rounded-2xl bg-white/95 backdrop-blur-md border shadow-lg sm:shadow-xl transition-all"
            [ngClass]="{
              'border-rose-200/90 text-slate-800 ring-1 ring-rose-500/10': t.type === 'error',
              'border-amber-200/90 text-slate-800 ring-1 ring-amber-500/10': t.type === 'warning',
              'border-slate-200 text-slate-800 ring-1 ring-slate-900/5': t.type === 'info'
            }"
          >
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm shadow-2xs"
              [ngClass]="{
                'bg-rose-50 text-rose-600 border border-rose-100': t.type === 'error',
                'bg-amber-50 text-amber-700 border border-amber-100': t.type === 'warning',
                'bg-indigo-50 text-indigo-600 border border-indigo-100': t.type === 'info'
              }"
            >
              <i
                class="pi"
                [ngClass]="{
                  'pi-exclamation-circle': t.type === 'error',
                  'pi-exclamation-triangle text-amber-600': t.type === 'warning',
                  'pi-info-circle': t.type === 'info'
                }"
              ></i>
            </div>

            <div class="flex-1 min-w-0 pr-1">
              <h4
                class="text-xs font-bold tracking-wider uppercase"
                [ngClass]="{
                  'text-rose-900': t.type === 'error',
                  'text-amber-900': t.type === 'warning',
                  'text-slate-900': t.type === 'info'
                }"
              >
                {{ t.title }}
              </h4>
              <p class="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {{ t.message }}
              </p>
            </div>

            <button
              type="button"
              (click)="dismissToast()"
              class="text-slate-400 hover:text-slate-600 active:text-slate-800 p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer"
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>
        </aside>
      }

      <main class="max-w-5xl mx-auto space-y-6">
        <!-- Navigation Breadcrumb -->
        <div class="flex items-center justify-between">
          <a
            routerLink="/booking"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs"
          >
            <i class="pi pi-arrow-left text-[11px]"></i>
            <span>Quay lại danh sách chỗ nghỉ</span>
          </a>
          <span class="text-xs text-slate-500 font-medium flex items-center gap-1">
            <i class="pi pi-shield text-emerald-600 text-[11px]"></i>
            Thủ tục giữ phòng được mã hóa và bảo vệ an toàn
          </span>
        </div>

        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {{ booking() ? 'Giữ phòng thành công!' : 'Kiểm Tra & Xác Nhận Giữ Chỗ' }}
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            {{ booking()
                ? 'Thông tin giữ chỗ tạm thời của bạn đã được ghi nhận. Vui lòng hoàn tất bước tiếp theo trước khi thời hạn giữ chỗ kết thúc.'
                : 'Xác nhận thông tin lưu trú, nhập thông tin liên lạc để hệ thống cấp mã giữ phòng.' }}
          </p>
        </div>

        @if (error() && !holdError()) {
          <div role="alert" class="p-4 bg-rose-50/90 border border-rose-200 text-rose-800 rounded-2xl flex items-start justify-between gap-3 shadow-2xs">
            <div class="flex items-start gap-3">
              <i class="pi pi-exclamation-triangle text-rose-500 text-lg shrink-0 mt-0.5"></i>
              <div>
                <span class="font-bold text-xs uppercase tracking-wider block text-rose-900">Thông báo từ hệ thống</span>
                <p class="text-xs sm:text-sm mt-0.5 text-rose-700 leading-relaxed">{{ error() }}</p>
              </div>
            </div>
            <button
              type="button"
              (click)="error.set('')"
              class="text-rose-400 hover:text-rose-600 p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer"
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>
        }

        @if (loading()) {
          <div role="status" class="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
            <i class="pi pi-spin pi-spinner text-2xl text-indigo-600"></i>
            <p class="text-sm font-medium text-slate-600">Đang đối soát giá và tình trạng phòng thời gian thực…</p>
          </div>
        }

        @if (booking(); as detail) {
          <!-- VOUCHER THÀNH CÔNG SAU KHI TẠO GIỮ PHÒNG -->
          <section class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                  <i class="pi pi-check-circle"></i>
                </div>
                <div>
                  <div class="text-xs font-bold uppercase tracking-wider text-emerald-600">Đã giữ phòng tạm thời</div>
                  <h2 class="text-xl sm:text-2xl font-black text-slate-900">{{ detail.propertyName }}</h2>
                </div>
              </div>

              <div class="text-left sm:text-right space-y-1">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                  [ngClass]="statusBadgeClass(detail.status)"
                >
                  <i class="pi pi-tag text-[10px]"></i> {{ statusLabel(detail.status) }}
                </span>
                @if (detail.status === 'PendingPayment') {
                  <p class="text-[11px] text-amber-700 font-medium">
                    Phòng đang được giữ tạm thời, chưa xác nhận thanh toán
                  </p>
                }
              </div>
            </div>

            <!-- BANNER THỜI HẠN GIỮ PHÒNG NỔI BẬT -->
            @if (!isExpired() && detail.holdExpiresAtUtc) {
              <div class="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-start sm:items-center gap-3.5">
                  <div class="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                    <i class="pi pi-clock"></i>
                  </div>
                  <div>
                    <div class="text-xs font-bold uppercase tracking-wider text-amber-800">Thời hạn giữ phòng</div>
                    <p class="text-xs sm:text-sm text-slate-700 font-medium mt-0.5">
                      Vui lòng hoàn tất bước tiếp theo trước khi thời hạn giữ phòng kết thúc.
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3 shrink-0 self-start sm:self-center">
                  <div class="text-left sm:text-right">
                    <div class="font-mono text-2xl sm:text-3xl font-black text-amber-900 tracking-tight">
                      {{ formattedTimeRemaining() }}
                    </div>
                    <div class="text-[11px] text-slate-500">
                      Hết hạn lúc: {{ detail.holdExpiresAtUtc | date:'HH:mm:ss dd/MM':'+0700' }}
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Mã tra cứu & Hướng dẫn sao chép an toàn -->
            <div class="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <i class="pi pi-key text-indigo-600 text-xs"></i>
                  <span class="text-xs font-bold uppercase tracking-wider text-indigo-900/80">Mã tra cứu giữ phòng (Lookup Token)</span>
                </div>
                @if (isCopied()) {
                  <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    <i class="pi pi-check text-[11px]"></i> Đã sao chép vào bộ nhớ tạm!
                  </span>
                }
              </div>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div class="flex-1 min-w-0 bg-white px-3.5 py-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                  <span class="font-mono text-xs sm:text-sm font-bold text-indigo-950 break-all select-all block leading-relaxed">
                    {{ detail.lookupToken }}
                  </span>
                </div>
                <button
                  type="button"
                  (click)="copyToken(detail.lookupToken)"
                  class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  title="Sao chép mã tra cứu"
                  aria-label="Sao chép mã tra cứu"
                >
                  <i class="pi" [class.pi-copy]="!isCopied()" [class.pi-check]="isCopied()"></i>
                  <span>{{ isCopied() ? 'Đã sao chép' : 'Sao chép mã' }}</span>
                </button>
              </div>

              <p class="text-[11px] text-slate-500 leading-relaxed">
                Mã tra cứu dùng để mở lại đơn đặt phòng và hoàn tất thanh toán. Vui lòng lưu lại và bảo mật mã này.
              </p>
            </div>

            <!-- Lưới chi tiết đặt phòng -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Hạng phòng</span>
                <span class="text-sm font-bold text-slate-800">{{ detail.roomTypeName }}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Số lượng khách</span>
                <span class="text-sm font-bold text-slate-800">{{ detail.numberOfGuests }} khách</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Thời gian lưu trú</span>
                <span class="text-xs sm:text-sm font-bold text-indigo-900">
                  {{ detail.startAtUtc | date:'dd/MM/yyyy HH:mm':'+0700' }} → {{ detail.endAtUtc | date:'dd/MM/yyyy HH:mm':'+0700' }}
                </span>
              </div>
            </div>

            <!-- Tổng tiền & Cọc yêu cầu -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 gap-4">
              <div>
                <div class="text-xs text-indigo-900 font-medium">Tổng tiền lưu trú dự tính</div>
                <div class="text-2xl sm:text-3xl font-black text-indigo-700">{{ detail.totalAmount | number:'1.0-0' }} ₫</div>
              </div>
              <div class="sm:text-right">
                <div class="text-xs text-amber-800 font-bold uppercase tracking-wide">Đặt cọc yêu cầu theo quy định</div>
                <div class="text-xl font-extrabold text-amber-600">{{ detail.depositRequired | number:'1.0-0' }} ₫</div>
              </div>
            </div>

            @if (isExpired()) {
              <div role="status" class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <i class="pi pi-times-circle text-base shrink-0"></i>
                <span>Giữ phòng đã hết hạn. Vui lòng quay lại tìm kiếm và đặt phòng mới.</span>
              </div>
            }

            <div class="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              @if (isExpired()) {
                <a
                  routerLink="/booking"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i class="pi pi-search text-xs"></i>
                  <span>Tìm phòng mới</span>
                </a>
              } @else {
                <a
                  [routerLink]="['/booking/status', detail.lookupToken]"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Xem Trạng Thái &amp; Hướng Dẫn Thanh Toán</span>
                  <i class="pi pi-arrow-right text-xs"></i>
                </a>
              }
            </div>
          </section>
        } @else {
          <!-- FORM CHECKOUT & TÓM TẮT ĐƠN ĐẶT PHÒNG -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Cột Trái: Thông tin Người nhận phòng (7 cột) -->
            <form
              (ngSubmit)="confirmBooking()"
              [attr.aria-busy]="isSubmitting()"
              class="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5"
            >
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-user"></i>
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-800">Thông tin Khách nhận phòng</h2>
                  <p class="text-xs text-slate-400">Dùng để cấp mã giữ phòng và liên hệ xác nhận</p>
                </div>
              </div>

              <div class="space-y-4">
                <app-form-field #nameField controlId="hold-name" label="Họ và tên người đại diện" [required]="true" [error]="fieldError('name', nameControl.touched)">
                  <input
                    [appFormControl]="nameField"
                    name="name"
                    [(ngModel)]="guestName"
                    #nameControl="ngModel"
                    [disabled]="isSubmitting() || loading()"
                    required
                    autocomplete="name"
                    placeholder="Ví dụ: Nguyễn Văn Hoàng"
                    class="transition-all duration-150"
                    [class.!border-rose-300]="fieldError('name', nameControl.touched)"
                    [class.!bg-rose-50/20]="fieldError('name', nameControl.touched)"
                    [class.focus:!border-rose-400]="fieldError('name', nameControl.touched)"
                    [class.focus:!ring-rose-100]="fieldError('name', nameControl.touched)"
                  />
                </app-form-field>

                <app-form-field #phoneField controlId="hold-phone" label="Số điện thoại nhận tin nhắn" [required]="true" [error]="fieldError('phone', phoneControl.touched)">
                  <input
                    [appFormControl]="phoneField"
                    name="phone"
                    [(ngModel)]="guestPhone"
                    #phoneControl="ngModel"
                    [disabled]="isSubmitting() || loading()"
                    required
                    type="tel"
                    inputmode="tel"
                    maxlength="20"
                    autocomplete="tel"
                    placeholder="Ví dụ: 0912345678 hoặc +84912345678"
                    class="transition-all duration-150"
                    [class.!border-rose-300]="fieldError('phone', phoneControl.touched)"
                    [class.!bg-rose-50/20]="fieldError('phone', phoneControl.touched)"
                    [class.focus:!border-rose-400]="fieldError('phone', phoneControl.touched)"
                    [class.focus:!ring-rose-100]="fieldError('phone', phoneControl.touched)"
                  />
                </app-form-field>

                <app-form-field #emailField controlId="hold-email" label="Email nhận xác nhận đặt chỗ" [required]="true" [error]="fieldError('email', emailControl.touched)">
                  <input
                    [appFormControl]="emailField"
                    name="email"
                    [(ngModel)]="guestEmail"
                    #emailControl="ngModel"
                    [disabled]="isSubmitting() || loading()"
                    required
                    type="email"
                    autocomplete="email"
                    placeholder="hoang.nguyen@example.com"
                    class="transition-all duration-150"
                    [class.!border-rose-300]="fieldError('email', emailControl.touched)"
                    [class.!bg-rose-50/20]="fieldError('email', emailControl.touched)"
                    [class.focus:!border-rose-400]="fieldError('email', emailControl.touched)"
                    [class.focus:!ring-rose-100]="fieldError('email', emailControl.touched)"
                  />
                </app-form-field>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 flex items-center gap-2.5">
                <i class="pi pi-info-circle text-indigo-600 text-sm shrink-0"></i>
                <span>Phòng được giữ tạm sau khi máy chủ cấp mã. Bạn có thể thanh toán qua VNPAY hoặc chuyển khoản tại bước tiếp theo.</span>
              </div>

              <button
                type="submit"
                [disabled]="loading() || isSubmitting() || !quote() || isQuoteExpired()"
                class="w-full h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-base"></i>
                  <span>Đang xử lý giữ phòng…</span>
                } @else if (isQuoteExpired()) {
                  <i class="pi pi-clock text-base"></i>
                  <span>Báo giá đã hết hạn — Hãy kiểm tra lại giá</span>
                } @else {
                  <i class="pi pi-check text-base"></i>
                  <span>Xác Nhận Giữ Phòng Ngay</span>
                }
              </button>

              <!-- INLINE ERROR PANEL DƯỚI NÚT XÁC NHẬN GIỮ PHÒNG (KHÔNG TRÙNG TOAST, KHÔNG CHE GIAO DIỆN) -->
              @if (holdError(); as err) {
                <div
                  role="alert"
                  aria-live="assertive"
                  class="p-4 rounded-2xl bg-rose-50/95 border border-rose-200/90 text-rose-900 shadow-2xs space-y-2 transition-all animate-in fade-in"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0">
                      <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <i class="pi" [ngClass]="err.type === 'network' ? 'pi-wifi text-xs' : 'pi-exclamation-triangle text-sm'"></i>
                      </div>
                      <div class="min-w-0">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-rose-900">
                          {{ err.title }}
                        </h4>
                        <p class="text-xs text-rose-800 mt-0.5 leading-relaxed">
                          {{ err.message }}
                        </p>
                        @if (err.note || err.isRetryable) {
                          <div class="flex items-center gap-1.5 text-[11px] text-rose-700 font-medium mt-1.5 pt-1.5 border-t border-rose-200/60">
                            <i class="pi pi-shield text-[10px] text-rose-600"></i>
                            <span>{{ err.note || 'Thông tin đã nhập vẫn được giữ lại.' }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="clearHoldError()"
                      class="text-rose-400 hover:text-rose-600 active:text-rose-800 p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Đóng thông báo"
                      aria-label="Đóng thông báo"
                    >
                      <i class="pi pi-times text-xs"></i>
                    </button>
                  </div>
                </div>
              }
            </form>

            <!-- Cột Phải: Báo giá & Chi tiết chỗ nghỉ (5 cột) -->
            <section class="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5 lg:sticky lg:top-24">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-receipt"></i>
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-800">Tóm tắt Đơn Đặt</h2>
                  <p class="text-xs text-slate-400">Báo giá chính thức từ hệ thống</p>
                </div>
              </div>

              @if (quote(); as price) {
                <div class="space-y-3.5">
                  <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <div class="font-bold text-sm text-slate-900">{{ property()?.name }}</div>
                    <div class="text-xs text-indigo-700 font-semibold flex items-center gap-1.5">
                      <i class="pi pi-bed"></i> {{ price.roomTypeName }}
                    </div>
                  </div>

                  <!-- Thông tin lịch & khách từ context -->
                  <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div class="flex items-center justify-between text-slate-600">
                      <span>Hình thức thuê:</span>
                      <span class="font-bold text-slate-800">
                        {{ stay()?.rentalType === 'Hourly' ? 'Thuê theo giờ' : (stay()?.rentalType === 'Overnight' ? 'Thuê qua đêm' : 'Thuê theo ngày') }}
                      </span>
                    </div>

                    @if (stay()?.rentalType === 'Hourly') {
                      <div class="flex items-center justify-between text-slate-600">
                        <span>Thời gian:</span>
                        <span class="font-bold text-indigo-900">
                          {{ stay()?.checkInDate }} (từ {{ stay()?.checkInTime }}, {{ stay()?.durationHours }}h)
                        </span>
                      </div>
                    } @else {
                      <div class="flex items-center justify-between text-slate-600">
                        <span>Lịch lưu trú:</span>
                        <span class="font-bold text-indigo-900">
                          {{ stay()?.checkInDate }} → {{ stay()?.checkOutDate }} ({{ numberOfNights() }} đêm)
                        </span>
                      </div>
                    }

                    <div class="flex items-center justify-between text-slate-600">
                      <span>Số lượng khách:</span>
                      <span class="font-bold text-slate-800">{{ stay()?.guests ?? 1 }} khách</span>
                    </div>
                  </div>

                  <!-- Chi tiết tính giá -->
                  <div class="space-y-2 pt-1 border-t border-slate-100 text-xs">
                    <div class="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Khoản phí mục vụ</div>
                    @for (line of price.breakdown; track $index) {
                      <div class="flex items-center justify-between text-slate-700 py-0.5">
                        <span class="truncate pr-2">{{ line.description }}</span>
                        <span class="font-semibold shrink-0">{{ line.amount | number:'1.0-0' }} ₫</span>
                      </div>
                    }
                  </div>

                  <!-- Tổng tiền & Cọc -->
                  <div class="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                    <div class="flex items-baseline justify-between">
                      <span class="text-xs font-bold text-indigo-950 uppercase tracking-wide">Tổng tiền lưu trú:</span>
                      <strong class="text-xl sm:text-2xl font-black text-indigo-700">
                        {{ price.totalAmount | number:'1.0-0' }} ₫
                      </strong>
                    </div>
                    @if ((priceAny().depositRequired) !== undefined && (priceAny().depositRequired) !== null) {
                      <div class="flex items-center justify-between text-xs text-amber-800 pt-1.5 border-t border-indigo-100/80 font-medium">
                        <span>Đặt cọc giữ chỗ:</span>
                        <span class="font-bold text-amber-600">{{ priceAny().depositRequired | number:'1.0-0' }} ₫</span>
                      </div>
                    } @else {
                      <div class="pt-2 border-t border-indigo-100/80 space-y-1 text-xs">
                        <div class="flex items-center justify-between text-amber-900 font-medium">
                          <span>Đặt cọc giữ chỗ:</span>
                          <span class="text-amber-700 font-semibold">Xác định khi tạo giữ phòng</span>
                        </div>
                        <p class="text-[11px] text-slate-500 leading-relaxed">
                          Mức tiền đặt cọc chính thức sẽ do máy chủ tính toán theo chính sách cơ sở và hiển thị ngay sau khi tạo giữ chỗ (hệ thống không tự tính trước ở bước này).
                        </p>
                      </div>
                    }
                  </div>

                  <!-- Đồng hồ báo giá còn hiệu lực -->
                  <div class="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-1">
                    <div class="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span class="flex items-center gap-1.5">
                        <i class="pi pi-clock text-amber-600"></i>
                        Báo giá còn hiệu lực:
                      </span>
                      <span
                        class="font-mono text-sm px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-800"
                        [class.text-rose-600]="isQuoteExpired()"
                      >
                        {{ formatCountdown(quoteRemainingSeconds()) }}
                      </span>
                    </div>
                    <p class="text-[11px] text-amber-700/90 leading-relaxed">
                      Giá phòng có thể thay đổi sau thời gian này. Vui lòng xác nhận giữ phòng hoặc kiểm tra lại giá.
                    </p>
                    @if (isQuoteExpired()) {
                      <div class="text-[11px] font-semibold text-rose-700 pt-1 border-t border-amber-200/60 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-xs"></i>
                        Báo giá đã hết hạn. Vui lòng bấm kiểm tra lại giá bên dưới.
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="text-center py-6 text-slate-400 text-xs">
                  <i class="pi pi-info-circle text-lg mb-1 block"></i>
                  Đang chờ tính giá hoặc chưa có báo giá phòng.
                </div>
              }

              <button
                type="button"
                (click)="loadPreview()"
                [disabled]="loading() || isSubmitting()"
                class="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()"></i>
                <span>Kiểm tra lại giá phòng</span>
              </button>
            </section>
          </div>
        }
      </main>
    </div>
  `,
})
export class BookingHoldPageComponent implements OnInit, OnDestroy {
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);

  readonly submitted = signal(false);
  readonly booking = signal<GuestBookingDetailDto | null>(null);
  readonly property = signal<PublicPropertyDto | null>(null);
  readonly quote = signal<QuoteDto | null>(null);
  readonly stay = signal<PublicStayContext | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly holdError = signal<HoldErrorState | null>(null);
  readonly toast = signal<{ title: string; message: string; type?: 'warning' | 'error' | 'info' } | null>(null);
  readonly remainingSeconds = signal(0);
  readonly secondsRemaining = signal(0);
  readonly isExpired = signal(false);
  readonly isSubmitting = signal(false);
  readonly isCopied = signal(false);
  readonly quoteRemainingSeconds = signal(0);
  readonly isQuoteExpired = signal(false);

  readonly finalGrandTotal = computed(() => this.quote()?.totalAmount ?? this.booking()?.totalAmount ?? 0);
  readonly priceAny = computed<any>(() => this.quote());

  readonly numberOfNights = computed(() => {
    const s = this.stay();
    if (!s || s.rentalType === 'Hourly') return 0;
    const start = new Date(`${s.checkInDate}T00:00:00Z`).getTime();
    const end = new Date(`${s.checkOutDate}T00:00:00Z`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  });

  guestName = '';
  guestPhone = '';
  guestEmail = '';

  private timerInterval?: ReturnType<typeof setInterval>;
  private quoteTimerInterval?: ReturnType<typeof setInterval>;
  private toastTimeout?: ReturnType<typeof setTimeout>;
  private copyTimeout?: ReturnType<typeof setTimeout>;
  private copySessionId = 0;
  private isDestroyed = false;
  private currentIdempotencyKey = crypto.randomUUID();
  private lastSubmittedPayloadSig = '';
  private requestGeneration = 0;
  private holdSubmissionGeneration = 0;
  private bookingGeneration = 0;
  private activeRouteToken?: string;
  private currentQueryParams: any = {};
  private lastPreviewParamsSig = '';
  private hasInitialized = false;

  get idempotencyKey(): string {
    return this.currentIdempotencyKey;
  }

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      const currentBooking = this.booking();
      if (currentBooking) {
        this.startHoldCountdown(currentBooking.holdExpiresAtUtc, currentBooking.status);
      } else if (this.quote()) {
        this.startQuoteCountdown(this.quote()?.expiresAtUtc);
      }
    }
  };

  clearHoldTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  clearQuoteTimer(): void {
    if (this.quoteTimerInterval) {
      clearInterval(this.quoteTimerInterval);
      this.quoteTimerInterval = undefined;
    }
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot?.paramMap ?? { get: () => null });
    const queryParams$ = this.route.queryParams ?? of(this.route.snapshot?.queryParams ?? {});

    paramMap$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const token = typeof params.get === 'function' ? params.get('token') : null;
      if (token) {
        this.handleRouteTokenChange(token.trim(), this.currentQueryParams);
      } else if (this.activeRouteToken) {
        this.handleRouteTokenChange('', this.currentQueryParams);
      } else if (!this.hasInitialized) {
        const queryToken = (this.route.snapshot?.queryParams as any)?.['token']?.trim();
        if (queryToken) {
          this.handleRouteTokenChange(queryToken, this.currentQueryParams);
        } else {
          this.handleRouteTokenChange('', this.currentQueryParams);
        }
      }
    });

    queryParams$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(query => {
      this.currentQueryParams = query ?? this.route.snapshot?.queryParams ?? {};
      const queryToken = (query as any)?.['token']?.trim();
      const paramToken = typeof this.route.snapshot?.paramMap?.get === 'function' ? this.route.snapshot.paramMap.get('token') : null;
      const token = (paramToken || queryToken || '').trim();
      if (token) {
        this.handleRouteTokenChange(token, this.currentQueryParams);
      } else {
        this.handleRouteTokenChange('', this.currentQueryParams);
      }
    });
  }

  handleRouteTokenChange(token: string, queryParams: any): void {
    const isFirstRun = !this.hasInitialized;
    this.hasInitialized = true;

    if (token) {
      if (token !== this.activeRouteToken) {
        this.activeRouteToken = token;
        this.requestGeneration++;
        this.bookingGeneration++;
        this.holdSubmissionGeneration++;
        this.copySessionId++;
        this.booking.set(null);
        this.clearHoldTimer();
        this.clearQuoteTimer();
        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
          this.copyTimeout = undefined;
        }
        this.isCopied.set(false);
        this.error.set('');
        this.holdError.set(null);
        this.loadBooking(token);
      }
    } else {
      const wasTokenActive = Boolean(this.activeRouteToken);
      this.activeRouteToken = '';
      if (wasTokenActive) {
        this.bookingGeneration++;
        this.holdSubmissionGeneration++;
        this.copySessionId++;
        this.booking.set(null);
        this.clearHoldTimer();
        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
          this.copyTimeout = undefined;
        }
        this.isCopied.set(false);
        this.error.set('');
        this.holdError.set(null);
      }

      const previewSig = JSON.stringify([
        queryParams?.['propertySlug'], queryParams?.['roomTypeId'],
        queryParams?.['checkInDate'], queryParams?.['checkOutDate'],
        queryParams?.['rentalType'], queryParams?.['guests'],
        queryParams?.['checkInTime'],
        queryParams?.['durationHours'] ?? queryParams?.['hours'],
        queryParams?.['roomsCount']
      ]);
      if (wasTokenActive || (isFirstRun && previewSig) || (previewSig && previewSig !== this.lastPreviewParamsSig)) {
        this.lastPreviewParamsSig = previewSig;
        this.loadPreview();
      }
    }
  }

  loadPreview(): void {
    if (this.isSubmitting()) return;
    const generation = ++this.requestGeneration;
    this.error.set('');
    this.quote.set(null);
    this.isQuoteExpired.set(false);
    this.quoteRemainingSeconds.set(0);
    this.clearQuoteTimer();

    try {
      const params = Object.keys(this.currentQueryParams || {}).length > 0
        ? this.currentQueryParams
        : (this.route.snapshot?.queryParams ?? {});
      const stay = readPublicStay(params);
      this.stay.set(stay);
      if (!params['propertySlug'] || !params['roomTypeId']) {
        throw new Error('Vui lòng chọn cơ sở và hạng phòng trước.');
      }
      this.loading.set(true);
      this.publicBookingService.getPropertyBySlug(params['propertySlug']).pipe(
        switchMap(property => {
          if (generation !== this.requestGeneration) throw new Error('Yêu cầu đã thay đổi.');
          this.property.set(property);
          return this.publicBookingService.calculateQuote({
            propertySlug: params['propertySlug'],
            roomTypeId: params['roomTypeId'],
            ...publicStayInterval(stay, property)
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: price => {
          if (generation !== this.requestGeneration) return;
          this.quote.set(price);
          this.loading.set(false);
          this.startQuoteCountdown(price.expiresAtUtc);
        },
        error: () => {
          if (generation !== this.requestGeneration) return;
          this.loading.set(false);
          this.error.set('Chưa kiểm tra được giá. Vui lòng thử lại hoặc chọn lại phòng.');
        },
      });
    } catch (error) {
      this.loading.set(false);
      this.error.set(error instanceof Error ? error.message : 'Lựa chọn không hợp lệ.');
    }
  }

  startQuoteCountdown(expiresAtUtc?: string): void {
    this.clearQuoteTimer();

    const expireTime = expiresAtUtc ? new Date(expiresAtUtc).getTime() : NaN;
    if (!Number.isFinite(expireTime)) {
      this.quoteRemainingSeconds.set(0);
      this.isQuoteExpired.set(true);
      return;
    }

    const tickQuote = () => {
      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      this.quoteRemainingSeconds.set(diff);
      if (diff <= 0) {
        this.isQuoteExpired.set(true);
        this.clearQuoteTimer();
      } else {
        this.isQuoteExpired.set(false);
      }
    };

    tickQuote();
    if (this.quoteRemainingSeconds() > 0) {
      this.quoteTimerInterval = setInterval(tickQuote, 1000);
    }
  }

  loadBooking(token: string): void {
    this.clearQuoteTimer();
    this.clearHoldTimer();
    const generation = ++this.bookingGeneration;
    this.loading.set(true);

    this.publicBookingService.getBookingByToken(token).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: detail => {
        if (generation !== this.bookingGeneration) return;
        this.loading.set(false);
        this.booking.set(detail);

        if (detail.status === 'Confirmed' || detail.status === 'CheckedIn') {
          this.router.navigate(['/booking/status', token]);
          return;
        }

        this.startHoldCountdown(detail.holdExpiresAtUtc, detail.status);
      },
      error: () => {
        if (generation !== this.bookingGeneration) return;
        this.loading.set(false);
        this.booking.set(null);
        this.clearHoldTimer();
        this.error.set('Không tìm thấy giữ phòng hoặc không thể tải dữ liệu.');
      },
    });
  }

  startHoldCountdown(holdExpiresAtUtc?: string, status?: string): void {
    this.clearHoldTimer();

    if (status === 'Expired') {
      this.remainingSeconds.set(0);
      this.secondsRemaining.set(0);
      this.isExpired.set(true);
      return;
    }

    const expireTime = holdExpiresAtUtc ? new Date(holdExpiresAtUtc).getTime() : NaN;
    if (!Number.isFinite(expireTime)) {
      this.remainingSeconds.set(0);
      this.secondsRemaining.set(0);
      this.isExpired.set(true);
      return;
    }

    const tickHold = () => {
      if (this.booking()?.status === 'Expired') {
        this.remainingSeconds.set(0);
        this.secondsRemaining.set(0);
        this.isExpired.set(true);
        this.clearHoldTimer();
        return;
      }

      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      this.remainingSeconds.set(diff);
      this.secondsRemaining.set(diff);

      if (diff <= 0) {
        this.isExpired.set(true);
        this.clearHoldTimer();
      } else {
        this.isExpired.set(false);
      }
    };

    tickHold();
    if (this.secondsRemaining() > 0 && !this.isExpired()) {
      this.timerInterval = setInterval(tickHold, 1000);
    }
  }

  confirmBooking(): void {
    if (this.isSubmitting() || this.loading() || this.booking() || this.isQuoteExpired()) return;
    this.submitted.set(true);

    const invalidField = (['name', 'phone', 'email'] as const).find(field => this.fieldError(field, true));
    if (invalidField) {
      this.element.nativeElement.querySelector<HTMLInputElement>(`#hold-${invalidField}`)?.focus();
      return;
    }

    const price = this.quote();
    const quoteExpiresMs = price?.expiresAtUtc ? new Date(price.expiresAtUtc).getTime() : NaN;
    if (!price || !Number.isFinite(quoteExpiresMs) || quoteExpiresMs <= Date.now() || this.isQuoteExpired()) {
      this.quote.set(null);
      this.isQuoteExpired.set(true);
      const expiredMsg = 'Giá chưa có hoặc đã hết hiệu lực. Vui lòng kiểm tra lại giá.';
      this.error.set(expiredMsg);
      this.holdError.set({
        title: 'Báo giá đã hết hạn',
        message: 'Mức giá phòng đã hết thời gian hiệu lực. Vui lòng bấm kiểm tra lại giá phòng bên cạnh để cập nhật mức giá mới nhất.',
        type: 'expired',
        isRetryable: false,
      });
      this.toast.set(null);
      return;
    }

    try {
      const params = Object.keys(this.currentQueryParams || {}).length > 0
        ? this.currentQueryParams
        : (this.route.snapshot?.queryParams ?? {});
      const stay = this.stay() ?? readPublicStay(params);
      const property = this.property();
      if (!property) throw new Error('Chưa có dữ liệu cơ sở.');

      const interval = publicStayInterval(stay, property);
      const requestPayload: CreateGuestHoldRequest = {
        propertySlug: params['propertySlug'],
        roomTypeId: params['roomTypeId'],
        rentalType: interval.rentalType,
        startAtUtc: interval.startAtUtc,
        endAtUtc: interval.endAtUtc,
        guestName: this.guestName.trim(),
        guestEmail: this.guestEmail.trim(),
        guestPhone: this.guestPhone.trim(),
        numberOfGuests: stay.guests,
        expectedTotalAmount: price.totalAmount
      };

      const payloadSig = JSON.stringify({
        propertySlug: requestPayload.propertySlug,
        roomTypeId: requestPayload.roomTypeId,
        rentalType: requestPayload.rentalType,
        startAtUtc: requestPayload.startAtUtc,
        endAtUtc: requestPayload.endAtUtc,
        guestName: requestPayload.guestName,
        guestEmail: requestPayload.guestEmail,
        guestPhone: requestPayload.guestPhone,
        numberOfGuests: requestPayload.numberOfGuests,
        expectedTotalAmount: requestPayload.expectedTotalAmount
      });

      if (this.lastSubmittedPayloadSig && this.lastSubmittedPayloadSig !== payloadSig) {
        this.currentIdempotencyKey = crypto.randomUUID();
      }
      this.lastSubmittedPayloadSig = payloadSig;
      requestPayload.idempotencyKey = this.currentIdempotencyKey;

      this.error.set('');
      this.holdError.set(null);
      this.toast.set(null);
      this.isSubmitting.set(true);
      const submissionGen = ++this.holdSubmissionGeneration;

      this.publicBookingService.createHold(requestPayload).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: hold => {
          if (submissionGen !== this.holdSubmissionGeneration) return;
          this.isSubmitting.set(false);
          if (!hold || !hold.lookupToken || !hold.lookupToken.trim()) {
            const errState: HoldErrorState = {
              title: 'Chưa thể xác nhận giữ phòng',
              message: 'Hệ thống chưa nhận được mã giữ phòng hợp lệ từ máy chủ. Vui lòng thử lại cùng yêu cầu.',
              note: 'Thông tin đã nhập vẫn được giữ lại.',
              type: 'server',
              isRetryable: true,
            };
            this.holdError.set(errState);
            this.error.set(errState.message);
            this.toast.set(null);
            return;
          }
          this.holdError.set(null);
          this.error.set('');
          this.toast.set(null);
          this.router.navigate(['/booking/hold', hold.lookupToken]);
        },
        error: err => {
          if (submissionGen !== this.holdSubmissionGeneration) return;
          this.isSubmitting.set(false);
          const parsed = this.parseHoldError(err);
          this.holdError.set(parsed);
          this.error.set(parsed.message);
          this.toast.set(null);
        },
      });
    } catch (error) {
      this.isSubmitting.set(false);
      const parsed = this.parseHoldError(error);
      this.holdError.set(parsed);
      this.error.set(parsed.message);
      this.toast.set(null);
    }
  }

  onPhoneKeyDown(event: KeyboardEvent): void {
    // Retained for compatibility without blocking valid international characters
  }

  onPhoneInput(event?: Event): void {
    if (event?.target) {
      const input = event.target as HTMLInputElement;
      this.guestPhone = input.value;
    }
  }

  isValidPhoneNumber(phone: string): boolean {
    if (!phone) return false;
    const trimmed = phone.trim();
    if (!/^\+?[0-9\s.\-]+$/.test(trimmed)) {
      return false;
    }
    const cleaned = trimmed.replace(/[\s.\-]/g, '');

    // 1. Vietnamese domestic mobile: 10 digits starting with 03, 05, 07, 08, 09
    const vnDomestic = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (vnDomestic.test(cleaned)) return true;

    // 2. Vietnamese international mobile: +84 followed by 9 digits (3, 5, 7, 8, 9)
    const vnIntl = /^\+84(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (vnIntl.test(cleaned)) return true;

    // 3. International format (E.164): starts with +, country code cannot start with 0, not +84, total 7-15 digits
    const genericIntl = /^\+(?!84)[1-9][0-9]{6,14}$/;
    if (genericIntl.test(cleaned)) return true;

    return false;
  }

  fieldError(field: 'name' | 'phone' | 'email', touched: boolean | null = false): string {
    if (!this.submitted() && !touched) return '';
    if (field === 'name') return this.guestName.trim() ? '' : 'Vui lòng nhập họ và tên.';
    if (field === 'phone') {
      const phone = this.guestPhone.trim();
      if (!phone) return 'Vui lòng nhập số điện thoại.';
      if (!this.isValidPhoneNumber(phone)) {
        return 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.';
      }
      return '';
    }
    const email = this.guestEmail.trim();
    if (!email) return 'Vui lòng nhập email hợp lệ.';
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) ? '' : 'Vui lòng nhập email hợp lệ.';
  }

  copyToken(token: string): void {
    if (!token || this.isDestroyed) return;
    const currentBooking = this.booking();
    const contextToken = currentBooking?.lookupToken ?? token;
    if (currentBooking && currentBooking.lookupToken !== token) return;

    const opId = ++this.copySessionId;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(() => {
        if (this.isDestroyed || opId !== this.copySessionId) return;
        if (this.booking()?.lookupToken !== contextToken) return;

        this.isCopied.set(true);
        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
        }
        this.copyTimeout = setTimeout(() => {
          if (!this.isDestroyed && opId === this.copySessionId) {
            this.isCopied.set(false);
          }
          this.copyTimeout = undefined;
        }, 2000);
      }).catch(() => {
        if (this.isDestroyed || opId !== this.copySessionId) return;
        if (this.booking()?.lookupToken !== contextToken) return;

        this.isCopied.set(false);
        this.showToast('Sao chép mã', 'Không thể tự động sao chép mã. Vui lòng chọn và sao chép thủ công.', 'warning');
      });
    } else {
      if (this.isDestroyed || opId !== this.copySessionId) return;
      this.isCopied.set(false);
      this.showToast('Sao chép mã', 'Trình duyệt không hỗ trợ tự động sao chép. Vui lòng chọn và sao chép thủ công.', 'warning');
    }
  }

  clearHoldError(): void {
    this.holdError.set(null);
    this.error.set('');
  }

  parseHoldError(err: any): HoldErrorState {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const isProgressEvent = typeof ProgressEvent !== 'undefined' && err?.error instanceof ProgressEvent;
    const status = err?.status ?? (isProgressEvent ? 0 : undefined);
    const rawMsg = String(err?.error?.message || err?.message || err || '');
    const isNetwork =
      isOffline ||
      status === 0 ||
      err?.name === 'TimeoutError' ||
      /failed to fetch|networkerror|network request failed|load failed|connection refused|timeout/i.test(rawMsg);

    if (isNetwork) {
      return {
        title: 'Không thể kết nối máy chủ',
        message: 'Chưa xác định được kết quả giữ phòng. Vui lòng kiểm tra kết nối rồi thử lại.',
        note: 'Thông tin đã nhập vẫn được giữ lại.',
        type: 'network',
        isRetryable: true,
      };
    }

    if (status && status >= 500) {
      return {
        title: 'Hệ thống tạm thời gián đoạn',
        message: 'Máy chủ đang gặp sự cố khi xử lý lệnh giữ phòng. Yêu cầu của bạn chưa được hoàn tất, vui lòng thử lại sau giây lát.',
        note: 'Thông tin đã nhập vẫn được giữ lại.',
        type: 'server',
        isRetryable: true,
      };
    }

    if (status === 409) {
      const serverMsg = typeof err?.error?.message === 'string' && !/failed|exception|error/i.test(err.error.message)
        ? err.error.message
        : 'Hạng phòng này vừa được khách khác đặt hoặc đang trong phiên giữ chỗ. Vui lòng chọn thời gian hoặc hạng phòng khác.';
      return {
        title: 'Phòng không còn khả dụng',
        message: serverMsg,
        type: 'business',
        isRetryable: false,
      };
    }

    if (status === 400) {
      const serverMsg = typeof err?.error?.message === 'string' && !/failed|exception|error/i.test(err.error.message)
        ? err.error.message
        : 'Thông tin giữ phòng chưa hợp lệ hoặc đã có thay đổi. Vui lòng kiểm tra lại thông tin.';
      return {
        title: 'Thông tin chưa hợp lệ',
        message: serverMsg,
        type: 'business',
        isRetryable: false,
      };
    }

    const candidateMsg = typeof err?.error?.message === 'string' ? err.error.message : '';
    const isClean = candidateMsg && !/failed to fetch|object Object|stacktrace|nullreference/i.test(candidateMsg);
    return {
      title: 'Chưa thể giữ phòng',
      message: isClean
        ? candidateMsg
        : 'Hệ thống chưa thể xử lý yêu cầu giữ phòng lúc này. Vui lòng kiểm tra lại tình trạng phòng hoặc thử lại.',
      type: 'business',
      isRetryable: true,
    };
  }

  showToast(title: string, message: string, type: 'warning' | 'error' | 'info' = 'warning'): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
    this.toast.set({ title, message, type });
    this.toastTimeout = setTimeout(() => {
      this.dismissToast();
    }, 4500);
  }

  dismissToast(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
    this.toast.set(null);
  }

  formatCountdown(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  formattedTimeRemaining(): string {
    return this.formatCountdown(this.secondsRemaining());
  }

  statusLabel(status?: string): string {
    if (!status) return 'Đang xử lý';
    const labels: Record<string, string> = {
      'PendingPayment': 'Chờ thanh toán',
      'Confirmed': 'Đã xác nhận',
      'CheckedIn': 'Đang lưu trú',
      'CheckedOut': 'Đã trả phòng',
      'Cancelled': 'Đã hủy',
      'Expired': 'Đã hết hạn'
    };
    return labels[status] ?? status;
  }

  statusBadgeClass(status?: string): string {
    switch (status) {
      case 'PendingPayment':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CheckedIn':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Expired':
      case 'Cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.copySessionId++;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.clearHoldTimer();
    this.clearQuoteTimer();
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
  }
}
export { BookingHoldPageComponent as BookingHoldPage };
