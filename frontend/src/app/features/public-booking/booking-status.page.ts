import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, take } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto, GuestCancellationPreviewDto, CancelGuestBookingRequest } from '../../core/models/public-booking.model';

export interface StatusErrorState {
  title: string;
  message: string;
  isRetryable?: boolean;
}

@Component({
  selector: 'app-booking-status',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">

        <!-- 1. BREADCRUMB -->
        <nav aria-label="Breadcrumb" class="flex items-center gap-2 text-xs text-slate-500 print:hidden">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span>/</span>
          <a routerLink="/booking/lookup" class="hover:text-indigo-600 transition-colors">Tra cứu</a>
          <span>/</span>
          <span class="text-slate-800 font-semibold truncate">Trạng thái đặt phòng</span>
        </nav>

        <!-- 2. KHU VỰC NHẬP MÃ TRA CỨU (KHI CHƯA CÓ KẾT QUẢ HOẶC MUỐN TRA CỨU MÃ KHÁC) -->
        @if (!booking() && !isSearching()) {
          <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4 print:hidden">
            <div class="space-y-1">
              <h1 class="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <i class="pi pi-ticket text-indigo-600"></i>
                <span>Theo dõi trạng thái đơn đặt phòng</span>
              </h1>
              <p class="text-xs text-slate-500 leading-relaxed">
                Nhập mã tra cứu bảo mật nhận được khi giữ chỗ hoặc đặt phòng để kiểm tra trạng thái thời gian thực.
              </p>
            </div>

            <form (ngSubmit)="onSearch()" class="space-y-3 pt-1">
              <div>
                <label for="status-token-input" class="block text-xs font-bold text-slate-700 mb-1.5">
                  Mã tra cứu đặt phòng <span class="text-rose-500">*</span>
                </label>
                <div class="flex flex-col sm:flex-row gap-3">
                  <input
                    id="status-token-input"
                    type="text"
                    [(ngModel)]="searchToken"
                    name="searchToken"
                    (input)="clearTokenError()"
                    placeholder="Nhập mã tra cứu được cung cấp khi giữ phòng"
                    class="flex-1 px-4 py-2.5 rounded-xl border font-mono text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:outline-indigo-500 transition-all"
                    [ngClass]="{ 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200': tokenError() }"
                    autocomplete="off"
                    required
                  />
                  <button
                    type="submit"
                    [disabled]="!searchToken.trim()"
                    class="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2"
                  >
                    <i class="pi pi-search text-xs"></i>
                    <span>Tra cứu ngay</span>
                  </button>
                </div>

                @if (tokenError()) {
                  <p role="alert" class="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1.5">
                    <i class="pi pi-exclamation-circle text-xs"></i>
                    <span>{{ tokenError() }}</span>
                  </p>
                }
              </div>
            </form>

            <!-- LỖI KHI TÌM BẰNG FORM TRA CỨU -->
            @if (searchError(); as err) {
              <div role="alert" aria-live="assertive" class="p-4 rounded-2xl bg-rose-50/95 border border-rose-200 text-rose-900 shadow-2xs space-y-2 animate-in fade-in">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <i class="pi" [ngClass]="err.isRetryable ? 'pi-wifi text-xs' : 'pi-exclamation-triangle text-sm'"></i>
                    </div>
                    <div>
                      <h2 class="text-xs font-bold uppercase tracking-wider text-rose-900">{{ err.title }}</h2>
                      <p class="text-xs text-rose-800 mt-0.5 leading-relaxed">{{ err.message }}</p>
                      @if (err.isRetryable) {
                        <div class="pt-2">
                          <button
                            type="button"
                            (click)="onSearch()"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                          >
                            <i class="pi pi-refresh text-[10px]"></i>
                            <span>Thử lại</span>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                  <button
                    type="button"
                    (click)="dismissSearchError()"
                    class="text-rose-400 hover:text-rose-600 p-1 rounded-lg cursor-pointer shrink-0"
                    title="Đóng thông báo"
                    aria-label="Đóng thông báo"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              </div>
            }
          </section>
        }

        <!-- LOADING INDICATOR -->
        @if (isSearching()) {
          <div role="status" class="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p class="text-xs font-semibold text-slate-600">Đang đối soát trạng thái đơn đặt phòng thời gian thực...</p>
          </div>
        }

        <!-- 3. KẾT QUẢ THEO DÕI ĐẶT PHÒNG -->
        @if (booking(); as detail) {
          <article class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-200 print:hidden">

            <!-- A. HEADER & TRẠNG THÁI TỔNG QUAN -->
            <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span [class]="getStatusBadgeClass(detail.status)" class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border">
                    <i class="pi text-[11px]" [class]="getStatusIcon(detail.status)"></i>
                    <span>{{ getStatusLabel(detail.status) }}</span>
                  </span>
                  @if (detail.status !== 'Confirmed') {
                    <span class="text-xs text-slate-600 font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      Mã đơn: {{ detail.confirmationCode }}
                    </span>
                  }
                </div>
                <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{{ detail.propertyName }}</h1>
                @if (detail.propertyAddress) {
                  <p class="text-xs text-slate-500 flex items-center gap-1.5">
                    <i class="pi pi-map-marker text-indigo-600 text-xs"></i>
                    <span>{{ detail.propertyAddress }}</span>
                  </p>
                }
              </div>

              <!-- Action buttons -->
              <div class="flex flex-wrap items-center gap-2 print:hidden">
                @if (hasValidDirections(detail)) {
                  <a
                    [href]="getDirectionsUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <i class="pi pi-directions text-xs text-indigo-600"></i>
                    <span>Chỉ đường</span>
                  </a>
                }

                <button
                  type="button"
                  (click)="printConfirmation()"
                  class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  [title]="getPrintButtonLabel(detail.status)"
                >
                  <i class="pi pi-print text-xs"></i>
                  <span>{{ getPrintButtonLabel(detail.status) }}</span>
                </button>
              </div>
            </div>

            <!-- B. BOOKING STATUS HERO (DUY NHẤT 1 CARD CHÍNH THEO TRẠNG THÁI NGHIỆP VỤ) -->
            @if (detail.status === 'PendingPayment') {
              <!-- GIỮ PHÒNG TẠM THỜI — DUY NHẤT 1 HERO CARD VÀ 1 ĐỒNG HỒ COUNTDOWN -->
              <div class="mx-6 sm:mx-8 my-6 p-6 sm:p-7 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-100/30 border border-amber-200/90 rounded-3xl text-amber-950 shadow-sm space-y-5">
                <!-- Hàng trên: Thông tin giữ phòng & Countdown Timer -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <!-- Cột trái: Badges, Title, Mô tả, Tiền cọc -->
                  <div class="space-y-2.5 max-w-2xl flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100/90 text-amber-900 border border-amber-300/70">
                        <i class="pi pi-clock text-[11px] text-amber-700"></i>
                        <span>Chờ thanh toán</span>
                      </span>
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/80 text-amber-900 border border-amber-200 shadow-2xs">
                        <i class="pi pi-info-circle text-[11px] text-amber-600"></i>
                        <span>Đơn giữ phòng tạm thời — Chưa xác nhận</span>
                      </span>
                      @if (isExpiringSoon()) {
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                          <i class="pi pi-exclamation-triangle text-[11px]"></i>
                          <span>Sắp hết hạn</span>
                        </span>
                      }
                      @if (isHoldExtended() && !isHoldExpired()) {
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <i class="pi pi-history text-[11px]"></i>
                          <span>Đã gia hạn (+5 phút)</span>
                        </span>
                      }
                    </div>

                    <h2 class="text-xl sm:text-2xl font-black text-amber-950 tracking-tight">
                      Phòng của bạn đang được giữ tạm thời
                    </h2>

                    <p class="text-xs sm:text-sm text-amber-900/90 font-medium leading-relaxed">
                      Vui lòng hoàn tất đặt cọc để xác nhận đặt phòng. Đơn đặt phòng chưa được xác nhận, vui lòng hoàn tất khoản đặt cọc theo quy định trước khi thời hạn giữ phòng kết thúc để phòng được bảo đảm.
                    </p>

                    @if (detail.depositRequired > 0) {
                      <div class="pt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span class="text-amber-800 font-semibold">Khoản đặt cọc yêu cầu:</span>
                        <span class="font-mono font-bold text-amber-950 text-sm sm:text-base bg-white/95 px-3 py-1 rounded-xl border border-amber-300/80 shadow-2xs">
                          {{ detail.depositRequired | number:'1.0-0' }} ₫
                        </span>
                        @if (getRemainingDeposit(detail) > 0 && detail.paidAmount > 0) {
                          <span class="text-amber-700 font-medium text-xs">
                            (Còn thiếu: <strong class="font-mono font-bold text-amber-900">{{ getRemainingDeposit(detail) | number:'1.0-0' }} ₫</strong>)
                          </span>
                        }
                      </div>
                    }
                  </div>

                  <!-- Cột phải: Countdown Box cố định kích thước, không bị chèn ép -->
                  @if (detail.holdExpiresAtUtc) {
                    <div class="shrink-0 self-start lg:self-center">
                      @if (isHoldExpired()) {
                        <div class="px-6 py-4 rounded-2xl bg-rose-100 text-rose-800 text-xs font-extrabold border border-rose-200 text-center shadow-2xs min-w-[200px]">
                          <i class="pi pi-exclamation-triangle text-lg block mb-1"></i>
                          <span>Đã hết hạn giữ phòng</span>
                        </div>
                      } @else {
                        <div
                          class="px-6 py-4 rounded-2xl border text-center shadow-xs flex flex-col items-center justify-center min-w-[200px] transition-all"
                          [ngClass]="isExpiringSoon() ? 'bg-rose-50/95 border-rose-300 ring-2 ring-rose-500/20' : 'bg-white/95 border-amber-200/90'"
                        >
                          <span
                            class="text-[10px] uppercase font-bold tracking-wider block"
                            [ngClass]="isExpiringSoon() ? 'text-rose-800' : 'text-amber-800'"
                          >
                            Thời gian giữ phòng còn lại
                          </span>
                          <span
                            class="font-mono text-3xl font-black block mt-1 tracking-wider tabular-nums"
                            [ngClass]="isExpiringSoon() ? 'text-rose-700' : 'text-amber-900'"
                          >
                            {{ formatCountdown(remainingSeconds()) }}
                          </span>
                          <span
                            class="text-[10px] font-semibold mt-0.5"
                            [ngClass]="isExpiringSoon() ? 'text-rose-600/80' : 'text-amber-700/80'"
                          >
                            MM:SS
                          </span>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Hàng dưới: Cảnh báo sắp hết hạn (Full width, phân tách rõ ràng) -->
                @if (detail.holdExpiresAtUtc && !isHoldExpired()) {
                  @if (isExpiringSoon()) {
                    <div
                      role="alert"
                      class="w-full p-4 rounded-2xl bg-rose-50/95 border border-rose-300/80 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <i class="pi pi-exclamation-triangle text-base"></i>
                        </div>
                        <div>
                          <div class="text-xs font-bold uppercase tracking-wider text-rose-800">Cảnh báo sắp hết hạn</div>
                          <p class="text-xs sm:text-sm font-semibold text-rose-900 mt-0.5 leading-snug">
                            Thời gian giữ phòng sắp hết. Vui lòng hoàn tất đặt phòng để tránh mất phòng.
                          </p>
                        </div>
                      </div>

                      <div class="shrink-0 flex items-center gap-2 self-start sm:self-center">
                        @if (canExtendHold()) {
                          <button
                            type="button"
                            (click)="extendHold()"
                            [disabled]="isExtendingHold()"
                            class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                          >
                            @if (isExtendingHold()) {
                              <i class="pi pi-spin pi-spinner text-xs"></i>
                              <span>Đang gia hạn...</span>
                            } @else {
                              <i class="pi pi-plus-circle text-xs"></i>
                              <span>Gia hạn thêm 5 phút</span>
                            }
                          </button>
                        } @else if (isHoldExtended()) {
                          <span class="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200">
                            <i class="pi pi-check text-[11px] mr-1"></i>Đã sử dụng 1/1 lượt gia hạn
                          </span>
                        }
                      </div>
                    </div>
                  }

                  @if (extendHoldError()) {
                    <div role="alert" class="w-full p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-exclamation-circle text-rose-600 shrink-0"></i>
                        <span>{{ extendHoldError() }}</span>
                      </div>
                      <button type="button" (click)="extendHoldError.set('')" class="text-rose-400 hover:text-rose-600 p-1 rounded cursor-pointer" aria-label="Đóng thông báo lỗi gia hạn">
                        <i class="pi pi-times text-xs"></i>
                      </button>
                    </div>
                  }
                }

                @if (isHoldExpired()) {
                  <div role="alert" class="w-full p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                      <i class="pi pi-clock text-rose-600 text-base"></i>
                      <span>Thời gian giữ phòng đã hết. Vui lòng tìm và chọn phòng lại để thực hiện đặt chỗ mới.</span>
                    </div>
                    <a routerLink="/booking" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold text-center shrink-0 transition-colors">
                      Tìm phòng lại
                    </a>
                  </div>
                }
              </div>
            } @else if (detail.status === 'Confirmed') {
              <!-- ĐÃ XÁC NHẬN: CONFIRMATION HERO (MÃ ĐẶT PHÒNG NỔI BẬT & GIAO DIỆN TỐI GIẢN) -->
              <div class="mx-6 sm:mx-8 my-6 p-6 sm:p-7 bg-gradient-to-r from-emerald-50/80 via-emerald-50/50 to-green-50/30 border border-emerald-200/80 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
                <div class="flex items-start gap-4 flex-1 min-w-0">
                  <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <i class="pi pi-check text-xl font-bold"></i>
                  </div>
                  <div class="space-y-1.5">
                    <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                      Đặt phòng đã được xác nhận
                    </h2>
                    <p class="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                      Vui lòng xuất trình mã đặt phòng và giấy tờ tùy thân tại quầy lễ tân để làm thủ tục nhận phòng.
                    </p>
                  </div>
                </div>

                <!-- Box Mã đặt phòng nổi bật bên phải -->
                <div class="bg-white rounded-2xl border border-emerald-200/90 p-5 text-center shrink-0 lg:min-w-[260px] shadow-xs">
                  <div class="flex items-center justify-center mb-1">
                    <button
                      id="btn-copy-confirmation-code"
                      type="button"
                      (click)="copyConfirmationCode(detail.confirmationCode)"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-800 uppercase tracking-wider hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer group"
                      title="Sao chép mã đặt phòng"
                      aria-label="Sao chép mã đặt phòng"
                    >
                      <span>MÃ ĐẶT PHÒNG</span>
                      <i class="pi text-xs transition-transform group-hover:scale-110" [ngClass]="isCodeCopied() ? 'pi-check text-emerald-700' : 'pi-copy text-emerald-600'"></i>
                    </button>
                  </div>
                  <div
                    (click)="copyConfirmationCode(detail.confirmationCode)"
                    class="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-wider py-1 select-all cursor-pointer hover:text-emerald-700 transition-colors"
                    title="Nhấp để sao chép mã đặt phòng"
                  >
                    {{ detail.confirmationCode }}
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium mt-0.5">
                    Vui lòng cung cấp mã này tại quầy lễ tân
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'CheckedIn') {
              <!-- ĐÃ NHẬN PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-4 shadow-xs">
                <div class="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-home text-lg"></i>
                </div>
                <div class="space-y-1">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                    Bạn đang trong kỳ lưu trú
                  </span>
                  <h2 class="text-sm sm:text-base font-bold text-blue-950">Quý khách đang trong kỳ lưu trú</h2>
                  <p class="text-xs text-blue-800 leading-relaxed">
                    Thủ tục nhận phòng đã hoàn tất thành công. Chúc Quý khách có kỳ nghỉ thoải mái. Nếu cần hỗ trợ thêm bất kỳ dịch vụ nào, vui lòng liên hệ trực tiếp quầy Lễ tân.
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'CheckedOut') {
              <!-- ĐÃ TRẢ PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-200 text-slate-800 space-y-4 shadow-xs">
                <div class="flex items-start gap-4">
                  <div class="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <i class="pi pi-check text-lg"></i>
                  </div>
                  <div class="space-y-1">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                      Kỳ lưu trú đã hoàn tất
                    </span>
                    <h2 class="text-sm sm:text-base font-bold text-slate-900">Kỳ lưu trú đã kết thúc</h2>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      Quý khách đã hoàn tất trả phòng. Cảm ơn Quý khách đã sử dụng dịch vụ tại {{ detail.propertyName }}. Hẹn gặp lại Quý khách ở những chuyến đi tiếp theo!
                    </p>
                  </div>
                </div>

                <div class="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-3">
                  <i class="pi pi-info-circle text-sm text-amber-700 mt-0.5 shrink-0"></i>
                  <div class="space-y-0.5">
                    <p class="font-bold text-amber-950">Chức năng đánh giá trực tuyến chưa khả dụng</p>
                    <p class="text-amber-800 leading-relaxed text-[11px]">
                      Hệ thống hiện tại chưa hỗ trợ gửi đánh giá trực tuyến qua API công khai. Cơ sở lưu trú sẽ liên hệ trực tiếp để ghi nhận phản hồi và nâng cao chất lượng dịch vụ.
                    </p>
                  </div>
                </div>
              </div>
            } @else if (detail.status === 'Expired') {
              <!-- ĐÃ HẾT HẠN GIỮ PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-rose-50/80 border border-rose-200/90 text-rose-950 flex items-start gap-4 shadow-xs">
                <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-times-circle text-lg"></i>
                </div>
                <div class="space-y-1">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                    Đã hết hạn giữ phòng
                  </span>
                  <h2 class="text-sm sm:text-base font-bold text-rose-950">Thời gian giữ phòng đã hết hạn</h2>
                  <p class="text-xs text-rose-800 leading-relaxed">
                    Thời gian giữ phòng đã hết. Vui lòng tìm và chọn phòng lại. Yêu cầu giữ chỗ này đã hết hiệu lực và không còn khả dụng để làm thủ tục nhận phòng. Quý khách vui lòng kiểm tra phòng trống và đặt lại đơn mới nếu vẫn có nhu cầu lưu trú.
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'Cancelled') {
              <!-- ĐÃ HỦY (T04-B GUEST CANCELLATION STATE) -->
              <div class="mx-6 sm:mx-8 my-6 p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-100/90 border border-slate-200 text-slate-800 space-y-4 shadow-xs">
                <div class="flex items-start gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-slate-200 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <i class="pi pi-ban text-xl font-bold"></i>
                  </div>
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-800 border border-slate-300/80">
                        Đơn đặt phòng đã hủy
                      </span>
                      @if (detail.cancelledAtUtc) {
                        <span class="text-xs text-slate-500 font-medium">
                          Thời điểm hủy: <strong class="text-slate-800 font-mono">{{ formatVietnamFullDateTime(detail.cancelledAtUtc) }}</strong>
                        </span>
                      }
                    </div>
                    <h2 class="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Đơn đặt phòng đã được hủy trên hệ thống
                    </h2>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      Yêu cầu hủy đặt phòng đã được ghi nhận. Mã đơn này đã ngừng hiệu lực và không còn khả dụng để làm thủ tục nhận phòng.
                    </p>
                  </div>
                </div>

                @if (detail.cancellationReason) {
                  <div class="p-3.5 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-700 space-y-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lý do hủy đặt phòng:</span>
                    <p class="font-medium text-slate-800">{{ detail.cancellationReason }}</p>
                  </div>
                }

                @if (detail.cancellationFee !== undefined && detail.cancellationFee !== null) {
                  <div class="p-4 rounded-xl bg-white border border-slate-200/90 text-xs space-y-2">
                    <div class="flex justify-between items-center text-slate-600">
                      <span>Phí hủy phòng áp dụng:</span>
                      <span class="font-mono font-bold text-slate-800">{{ detail.cancellationFee | number:'1.0-0' }} ₫</span>
                    </div>

                    @if (detail.refundableAmount && detail.refundableAmount > 0) {
                      <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span class="font-bold text-emerald-800 flex items-center gap-1.5">
                          <i class="pi pi-wallet text-emerald-600"></i>
                          <span>Khoản tiền hoàn dự kiến:</span>
                        </span>
                        <div class="flex items-center gap-2">
                          <span class="font-mono font-black text-sm text-emerald-700">{{ detail.refundableAmount | number:'1.0-0' }} ₫</span>
                          @if (detail.refundStatus === 'Refunded') {
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <i class="pi pi-check text-[10px]"></i>
                              Đã hoàn tiền (Đã chi trả)
                            </span>
                          } @else {
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Chờ đối soát & duyệt hoàn tiền
                            </span>
                          }
                        </div>
                      </div>
                      <p class="text-[11px] text-slate-500 italic">
                        @if (detail.refundStatus === 'Refunded') {
                          * Khách sạn đã xác nhận chi trả khoản hoàn tiền cho quý khách theo phương thức hoàn tiền được xác nhận.
                        } @else {
                          * Lưu ý: Khoản hoàn tiền đang ở trạng thái chờ duyệt (Pending) theo quy trình D23 và chưa được chuyển trả thực tế. Quản lý khách sạn sẽ đối soát và thực hiện chi trả theo quy định.
                        }
                      </p>
                    } @else {
                      <div class="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        Đơn đặt phòng không có khoản tiền hoàn dư theo chính sách hủy đã áp dụng.
                      </div>
                    }
                  </div>
                }

                <div class="pt-2 flex flex-wrap items-center gap-3">
                  <a
                    routerLink="/booking"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs"
                  >
                    <i class="pi pi-search text-xs"></i>
                    <span>Tìm và đặt phòng khác</span>
                  </a>
                </div>
              </div>
            }

            <!-- B2. THANH TIẾN TRÌNH ĐẶT PHÒNG 3 BƯỚC (ĐÃ XÁC NHẬN -> NHẬN PHÒNG -> ĐANG LƯU TRÚ) -->
            @if (detail.status === 'Confirmed' || detail.status === 'CheckedIn' || detail.status === 'CheckedOut') {
              <section aria-label="Tiến trình đặt phòng" class="mx-6 sm:mx-8 mb-6 p-4 sm:p-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2">

                  <!-- Bước 1: Đã xác nhận -->
                  <div class="flex items-center gap-3 shrink-0">
                    <div class="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <i class="pi pi-check text-sm font-bold"></i>
                    </div>
                    <div>
                      <span class="text-xs sm:text-sm font-bold text-slate-900 block leading-tight">Đã xác nhận</span>
                      <span class="text-[11px] text-slate-500 leading-tight">Đặt phòng thành công</span>
                    </div>
                  </div>

                  <!-- Đường nối 1-2 -->
                  <div class="hidden sm:block flex-1 h-[2px] mx-3" [ngClass]="(detail.status === 'CheckedIn' || detail.status === 'CheckedOut') ? 'bg-emerald-500' : 'bg-slate-200'"></div>

                  <!-- Bước 2: Nhận phòng -->
                  <div class="flex items-center gap-3 shrink-0">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-2xs transition-colors"
                      [ngClass]="(detail.status === 'CheckedIn' || detail.status === 'CheckedOut')
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border-2 border-slate-300 text-slate-400'"
                    >
                      @if (detail.status === 'CheckedIn' || detail.status === 'CheckedOut') {
                        <i class="pi pi-check text-sm font-bold"></i>
                      } @else {
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10m0-4h18m0-6v10M7 10a2 2 0 11-4 0 2 2 0 014 0zm14 0a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                      }
                    </div>
                    <div>
                      <span class="text-xs sm:text-sm font-bold text-slate-900 block leading-tight">
                        {{ (detail.status === 'CheckedIn' || detail.status === 'CheckedOut') ? 'Đã nhận phòng' : 'Nhận phòng' }}
                      </span>
                      <span class="text-[11px] text-slate-500 leading-tight">
                        {{ (detail.status === 'CheckedIn' || detail.status === 'CheckedOut') ? 'Đã làm thủ tục' : 'Làm thủ tục tại lễ tân' }}
                      </span>
                    </div>
                  </div>

                  <!-- Đường nối 2-3 -->
                  <div class="hidden sm:block flex-1 h-[2px] mx-3" [ngClass]="detail.status === 'CheckedOut' ? 'bg-emerald-500' : (detail.status === 'CheckedIn' ? 'bg-emerald-500' : 'bg-slate-200')"></div>

                  <!-- Bước 3: Đang lưu trú -->
                  <div class="flex items-center gap-3 shrink-0">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-2xs transition-colors"
                      [ngClass]="detail.status === 'CheckedIn'
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : (detail.status === 'CheckedOut'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border-2 border-slate-300 text-slate-400')"
                    >
                      @if (detail.status === 'CheckedOut') {
                        <i class="pi pi-check text-sm font-bold"></i>
                      } @else {
                        <i class="pi pi-home text-sm"></i>
                      }
                    </div>
                    <div>
                      <span class="text-xs sm:text-sm font-bold text-slate-900 block leading-tight">
                        {{ detail.status === 'CheckedOut' ? 'Đã trả phòng' : 'Đang lưu trú' }}
                      </span>
                      <span class="text-[11px] text-slate-500 leading-tight">
                        {{ detail.status === 'CheckedOut' ? 'Hoàn tất kỳ lưu trú' : (detail.status === 'CheckedIn' ? 'Đang trong kỳ lưu trú' : 'Sử dụng phòng') }}
                      </span>
                    </div>
                  </div>

                </div>
              </section>
            }

            <!-- C. KHÓA PHÒNG ĐIỆN TỬ SMART LOCK PIN (CHỈ HIỂN THỊ KHI ĐÃ NHẬN PHÒNG & CÓ PIN THẬT ACTIVE - ẨN HOÀN TOÀN KHI CHƯA CHECK-IN & KHI IN) -->
            @if (detail.status === 'CheckedIn' && detail.smartLockPin && detail.smartLockStatus === 'Active') {
              <div class="mx-6 sm:mx-8 mb-6 p-6 sm:p-7 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl border border-slate-800 shadow-inner relative overflow-hidden print:hidden">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {{ getSmartLockStatusLabel(detail.smartLockStatus) }}
                      </span>
                    </div>

                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                      <i class="pi pi-key text-amber-400"></i>
                      <span>Mã Mở Khóa Cửa Điện Tử (Smart Lock PIN)</span>
                    </h3>
                    <p class="text-xs text-slate-300 max-w-md leading-relaxed">
                      Sử dụng mã PIN này tại bàn phím số ổ khóa điện tử trước cửa phòng trong suốt thời gian lưu trú.
                    </p>
                  </div>

                  <!-- PIN Code Display Box -->
                  <div class="bg-black/50 border border-white/10 rounded-2xl p-4 text-center shrink-0 min-w-[200px] backdrop-blur-sm shadow-md">
                    <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Mã PIN Mở Cửa</div>
                    <div class="text-3xl font-black font-mono tracking-widest text-amber-300 py-1 select-all">
                      {{ detail.smartLockPin }}
                    </div>
                    <div class="mt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        (click)="copyPin(detail.smartLockPin)"
                        class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <i class="pi pi-copy text-[10px]"></i>
                        <span>Sao chép PIN</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- D. BODY DETAILS: THÔNG TIN LƯU TRÚ VÀ CHI TIẾT THANH TOÁN (2 CỘT DESKTOP) -->
            <div class="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">

              <!-- Cột Trái: Thông tin lưu trú -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i class="pi pi-building text-slate-400"></i>
                  <span>Thông tin lưu trú</span>
                </h3>
                <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3 text-xs">
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Cơ sở lưu trú:</span>
                    <span class="font-bold text-slate-900 text-right">{{ detail.propertyName }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Hạng phòng:</span>
                    <span class="font-bold text-slate-900 text-right">{{ detail.roomTypeName }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Hình thức thuê:</span>
                    <span class="font-bold text-indigo-700">{{ getRentalTypeLabel(detail.rentalType) }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Nhận phòng (Check-in):</span>
                    <span class="font-bold text-slate-900 text-right font-mono">
                      {{ formatStayDate(detail.checkInDate, detail.startAtUtc, detail.rentalType) }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Trả phòng (Check-out):</span>
                    <span class="font-bold text-slate-900 text-right font-mono">
                      {{ formatStayDate(detail.checkOutDate, detail.endAtUtc, detail.rentalType) }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Số lượng khách:</span>
                    <span class="font-semibold text-slate-900">{{ detail.numberOfGuests }} người</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span class="text-slate-500">Khách lưu trú (Bảo mật PII):</span>
                    <span class="font-semibold text-slate-900 text-right">
                      {{ detail.maskedGuestName }}
                      @if (detail.maskedGuestEmail) {
                        <span class="text-slate-500 font-normal">({{ detail.maskedGuestEmail }})</span>
                      }
                    </span>
                  </div>
                  @if (detail.maskedGuestPhone) {
                    <div class="flex justify-between items-center pt-1">
                      <span class="text-slate-500">Số điện thoại:</span>
                      <span class="font-semibold text-slate-900 font-mono">{{ detail.maskedGuestPhone }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Cột Phải: Hóa đơn, Chi tiết thanh toán & Bảng phân rã chi phí -->
              <div class="space-y-6">
                <div class="space-y-4">
                  <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <i class="pi pi-credit-card text-slate-400"></i>
                    <span>Chi tiết thanh toán</span>
                  </h3>
                  <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
                    <div class="flex justify-between items-center text-slate-600">
                      <span>Tổng tiền lưu trú:</span>
                      <span class="font-bold text-slate-900 font-mono text-sm">{{ detail.totalAmount | number:'1.0-0' }} ₫</span>
                    </div>

                    @if (detail.depositRequired > 0) {
                      <div class="flex justify-between items-center text-slate-600">
                        <span>Khoản đặt cọc yêu cầu:</span>
                        <span class="font-mono font-semibold text-amber-700">{{ detail.depositRequired | number:'1.0-0' }} ₫</span>
                      </div>
                    }

                    <div class="flex justify-between items-center text-emerald-800 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 font-semibold">
                      <span>Số tiền đã thanh toán:</span>
                      <span class="font-mono font-bold">{{ detail.paidAmount | number:'1.0-0' }} ₫</span>
                    </div>

                    @if (detail.status === 'PendingPayment' && getRemainingDeposit(detail) > 0) {
                      <div class="flex justify-between items-center text-amber-900 bg-amber-50/90 rounded-xl p-2.5 border border-amber-200 font-semibold">
                        <span class="flex items-center gap-1.5">
                          <i class="pi pi-exclamation-circle text-amber-600 text-xs"></i>
                          <span>Cọc còn thiếu để xác nhận:</span>
                        </span>
                        <span class="font-mono font-bold text-amber-800">{{ getRemainingDeposit(detail) | number:'1.0-0' }} ₫</span>
                      </div>
                    }

                    <div class="flex justify-between items-center text-indigo-700 font-black text-sm pt-2.5 border-t border-slate-100">
                      <span>Tổng còn phải thanh toán:</span>
                      <span class="font-mono text-base">{{ detail.remainingBalance | number:'1.0-0' }} ₫</span>
                    </div>

                    @if (detail.isFullyPaid) {
                      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span class="text-slate-500">Tình trạng thanh toán:</span>
                        <span class="font-bold text-emerald-600 flex items-center gap-1">
                          <i class="pi pi-check text-[10px]"></i>
                          <span>Đã thanh toán đủ 100%</span>
                        </span>
                      </div>
                    } @else if (detail.paidAmount > 0) {
                      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span class="text-slate-500">Tình trạng thanh toán:</span>
                        <span class="font-semibold text-amber-700">Đã thanh toán một phần</span>
                      </div>
                    }

                    <!-- PHƯƠNG THỨC THANH TOÁN (GỌN GÀNG, TRUNG TÍNH, KHÔNG NÚT GIẢ TO CỒNG) -->
                    @if (detail.status === 'PendingPayment') {
                      <div class="pt-3 border-t border-slate-100">
                        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2.5">
                          <i class="pi pi-info-circle text-indigo-600 mt-0.5 text-xs shrink-0"></i>
                          <div class="space-y-1">
                            <span class="font-bold text-slate-700 block">Thanh toán trực tuyến hiện chưa khả dụng</span>
                            <p class="text-slate-500 leading-relaxed">
                              Quý khách vui lòng liên hệ trực tiếp quầy Lễ tân hoặc cơ sở lưu trú để hoàn tất khoản đặt cọc giữ phòng.
                            </p>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- BẢNG PHÂN RÃ CHI PHÍ (GỌN GÀNG DƯỚI CHI TIẾT THANH TOÁN) -->
                @if (detail.breakdown && detail.breakdown.length > 0) {
                  <div class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-2 text-xs">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <i class="pi pi-list text-slate-400"></i>
                      <span>Bảng phân rã chi phí</span>
                    </div>
                    <div class="divide-y divide-slate-100">
                      @for (item of detail.breakdown; track item.description) {
                        <div class="flex justify-between items-center text-slate-600 py-2">
                          <span>{{ item.description }} @if (item.quantity > 1) { <span class="text-slate-400 font-mono">(x{{ item.quantity }})</span> }</span>
                          <span class="font-mono font-medium text-slate-800">{{ item.amount | number:'1.0-0' }} ₫</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

            </div>

            <!-- G. FOOTER HÀNH ĐỘNG (CHUẨN HÓA THỨ TỰ ƯU TIÊN THEO TRẠNG THÁI) -->
            <div class="p-6 sm:p-8 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="copyToken(detail.lookupToken)"
                  class="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <i class="pi" [ngClass]="isCopied() ? 'pi-check text-emerald-600' : 'pi-copy'"></i>
                  <span>{{ isCopied() ? 'Đã sao chép mã' : 'Sao chép mã tra cứu' }}</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                @if (canRequestCancellation(detail)) {
                  <button
                    type="button"
                    (click)="openCancelModal()"
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                    [title]="isUnpaidHold(detail) ? 'Hủy lượt giữ phòng này' : 'Yêu cầu hủy đặt phòng và xem trước chính sách hoàn tiền'"
                  >
                    <i class="pi pi-times text-xs"></i>
                    <span>{{ isUnpaidHold(detail) ? 'Hủy giữ phòng' : 'Yêu cầu hủy đặt phòng' }}</span>
                  </button>
                }

                <button
                  type="button"
                  (click)="resetToSearch()"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-2xs"
                >
                  Tra cứu mã khác
                </button>

                @if (detail.status === 'Expired' || detail.status === 'Cancelled') {
                  <a
                    routerLink="/booking"
                    class="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    Đặt phòng khác
                  </a>
                } @else {
                  <a
                    routerLink="/booking"
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                  >
                    Đặt phòng khác
                  </a>
                }
              </div>
            </div>

          </article>

          <!-- DEDICATED A4 PRINT SHEET (CHỈ HIỂN THỊ KHI IN) -->
          <div class="hidden print:block bg-white text-slate-900 font-sans print-sheet p-0 m-0">
            <!-- 1. HEADER CHỨNG TỪ -->
            <div class="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
              <div>
                <div class="text-[11px] font-black tracking-widest text-slate-500 uppercase">
                  LUXESTAY — HOTEL SAAS PLATFORM
                </div>
                <h1 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                  {{ getPrintDocumentTitle(detail.status) }}
                </h1>
                <p class="text-[11px] text-slate-600 mt-1 italic max-w-lg leading-normal">
                  {{ getPrintStatusNote(detail.status) }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <div class="text-[11px] font-semibold text-slate-500">Mã đặt phòng</div>
                <div class="text-base font-black font-mono tracking-wider text-slate-900">
                  {{ detail.confirmationCode }}
                </div>
                <div class="mt-1 inline-block px-2 py-0.5 border border-slate-800 text-[10px] font-bold uppercase rounded">
                  {{ getStatusLabel(detail.status) }}
                </div>
                <div class="text-[10px] text-slate-500 mt-1">
                  Ngày in: {{ getCurrentPrintDate() }}
                </div>
              </div>
            </div>

            <!-- 2. THÔNG BÁO QUY ĐỊNH GIỮ PHÒNG (NẾU PENDING PAYMENT) -->
            @if (detail.status === 'PendingPayment' && detail.holdExpiresAtUtc) {
              <div class="mb-4 p-2.5 border border-amber-300 bg-amber-50/50 rounded-lg text-xs text-amber-950">
                <span class="font-bold uppercase tracking-wider text-[10px]">Hạn thanh toán giữ phòng:</span>
                <span class="font-bold ml-1">{{ formatAbsoluteDeadline(detail.holdExpiresAtUtc) }}</span>
                <span class="block text-[11px] text-amber-800 mt-0.5">
                  Vui lòng hoàn tất thanh toán trước thời điểm trên. Sau thời hạn này, phòng sẽ tự động được giải phóng cho khách khác.
                </span>
              </div>
            }

            <!-- 3. HAI CỘT THÔNG TIN: CƠ SỞ LƯU TRÚ & THÔNG TIN LƯU TRÚ -->
            <div class="grid grid-cols-2 gap-4 mb-4 text-xs">
              <!-- Cột trái: Thông tin cơ sở lưu trú -->
              <div class="border border-slate-200 rounded-lg p-3 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                  Cơ sở lưu trú & Hạng phòng
                </div>
                <div>
                  <div class="text-[11px] font-semibold text-slate-500">Tên cơ sở:</div>
                  <div class="text-xs font-bold text-slate-900">{{ detail.propertyName || 'Chưa cập nhật' }}</div>
                </div>
                @if (detail.propertyAddress) {
                  <div>
                    <div class="text-[11px] font-semibold text-slate-500">Địa chỉ:</div>
                    <div class="text-[11px] text-slate-700 leading-snug">{{ detail.propertyAddress }}</div>
                  </div>
                }
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span class="text-slate-500 text-[10px]">Hạng phòng:</span>
                    <div class="font-bold text-slate-800 text-xs">{{ detail.roomTypeName || 'Tiêu chuẩn' }}</div>
                  </div>
                  <div>
                    <span class="text-slate-500 text-[10px]">Hình thức thuê:</span>
                    <div class="font-bold text-slate-800 text-xs">{{ getRentalTypeLabel(detail.rentalType) }}</div>
                  </div>
                </div>
              </div>

              <!-- Cột phải: Thông tin khách & Lịch lưu trú -->
              <div class="border border-slate-200 rounded-lg p-3 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                  Thông tin khách & Lịch lưu trú
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <div class="text-slate-500 text-[10px]">Khách đại diện:</div>
                    <div class="font-bold text-slate-900 text-xs">{{ detail.maskedGuestName || 'Khách lưu trú' }}</div>
                  </div>
                  <div>
                    <div class="text-slate-500 text-[10px]">Số lượng khách:</div>
                    <div class="font-bold text-slate-900 text-xs">{{ detail.numberOfGuests }} khách</div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span class="text-slate-500 text-[10px]">Nhận phòng (Check-in):</span>
                    <div class="font-bold text-slate-900 text-xs">
                      {{ formatStayDate(detail.checkInDate, detail.startAtUtc, detail.rentalType) }}
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-500 text-[10px]">Trả phòng (Check-out):</span>
                    <div class="font-bold text-slate-900 text-xs">
                      {{ formatStayDate(detail.checkOutDate, detail.endAtUtc, detail.rentalType) }}
                    </div>
                  </div>
                </div>
                @if (detail.maskedGuestPhone || detail.maskedGuestEmail) {
                  <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Liên hệ: </span>
                    @if (detail.maskedGuestPhone) {
                      <span class="font-medium text-slate-700 mr-2">{{ detail.maskedGuestPhone }}</span>
                    }
                    @if (detail.maskedGuestEmail) {
                      <span class="font-medium text-slate-700">{{ detail.maskedGuestEmail }}</span>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- 4. BẢNG CHI TIẾT TÀI CHÍNH -->
            <div class="mb-4 text-xs break-inside-avoid">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Chi tiết thanh toán & Quyết toán
              </div>
              <table class="w-full border-collapse border border-slate-300 text-left text-xs">
                <thead>
                  <tr class="bg-slate-100 border-b border-slate-300">
                    <th class="py-1.5 px-3 font-bold text-slate-700">Khoản mục</th>
                    <th class="py-1.5 px-3 font-bold text-right text-slate-700 w-44">Số tiền (VNĐ)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <tr>
                    <td class="py-1.5 px-3 text-slate-800">Tổng tiền lưu trú (Đã bao gồm thuế & phí)</td>
                    <td class="py-1.5 px-3 text-right font-medium text-slate-900">{{ detail.totalAmount | number }} đ</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 px-3 text-slate-800">Khoản đặt cọc yêu cầu</td>
                    <td class="py-1.5 px-3 text-right font-medium text-slate-900">{{ detail.depositRequired | number }} đ</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 px-3 text-slate-800">Số tiền đã thanh toán</td>
                    <td class="py-1.5 px-3 text-right font-semibold text-emerald-700">{{ detail.paidAmount | number }} đ</td>
                  </tr>
                  <tr class="bg-slate-50 font-bold">
                    <td class="py-2 px-3 text-slate-900 uppercase text-[11px]">Tổng còn phải thanh toán</td>
                    <td class="py-2 px-3 text-right text-sm text-slate-900 font-mono font-bold">{{ detail.remainingBalance | number }} đ</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 5. PHÂN RÃ CHI PHÍ (NẾU CÓ) -->
            @if (detail.breakdown && detail.breakdown.length > 0) {
              <div class="mb-4 text-xs break-inside-avoid">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Bảng phân rã chi tiết các khoản mục
                </div>
                <table class="w-full border-collapse border border-slate-200 text-left text-[11px]">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th class="py-1 px-2 font-semibold">Mô tả khoản mục</th>
                      <th class="py-1 px-2 font-semibold text-center w-20">Số lượng</th>
                      <th class="py-1 px-2 font-semibold text-right w-28">Đơn giá</th>
                      <th class="py-1 px-2 font-semibold text-right w-28">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @for (item of detail.breakdown; track $index) {
                      <tr>
                        <td class="py-1 px-2 text-slate-700">{{ item.description }}</td>
                        <td class="py-1 px-2 text-center text-slate-600">{{ item.quantity }}</td>
                        <td class="py-1 px-2 text-right text-slate-600">{{ item.unitPrice | number }} đ</td>
                        <td class="py-1 px-2 text-right font-medium text-slate-800">{{ item.amount | number }} đ</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- 6. GHI CHÚ CHỨNG TỪ & ĐIỀU KHOẢN -->
            <div class="border-t border-slate-200 pt-2.5 text-[10px] text-slate-500 space-y-1 break-inside-avoid">
              <div class="flex justify-between items-center text-slate-400">
                <span>Hệ thống LuxeStay Hospitality Platform</span>
                <span>Phiếu chứng từ điện tử</span>
              </div>
              <p class="leading-relaxed">
                * Phiếu thông tin này được trích xuất trực tiếp từ hệ thống quản lý đặt phòng LuxeStay. Quý khách vui lòng xuất trình phiếu này kèm giấy tờ tùy thân hợp lệ khi làm thủ tục nhận phòng tại cơ sở lưu trú.
              </p>
            </div>
          </div>
        }


    <!-- MODAL YÊU CẦU HỦY ĐẶT PHÒNG & XEM TRƯỚC PHÍ HỦY/HOÀN TIỀN (T04-B) -->
    @if (isCancelModalOpen()) {
      <div
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cancel-title"
        (click)="closeCancelModal()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white rounded-3xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        >
          <!-- Modal Header -->
          <div class="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-rose-50/40 shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs">
                <i class="pi pi-exclamation-circle text-lg"></i>
              </div>
              <div>
                <h2 id="modal-cancel-title" class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {{ isUnpaidHold() ? 'Xác nhận hủy giữ phòng' : 'Xác nhận yêu cầu hủy đặt phòng' }}
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Mã đơn: <strong class="font-mono text-slate-800">{{ booking()?.confirmationCode }}</strong> • {{ booking()?.propertyName }}
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeCancelModal()"
              [disabled]="isCancelling()"
              class="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Đóng cửa sổ"
            >
              <i class="pi pi-times text-base"></i>
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-xs">
            @if (isLoadingCancelPreview()) {
              <div class="p-10 text-center space-y-3">
                <div class="animate-spin w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full mx-auto"></div>
                <p class="font-semibold text-slate-600">Đang đối soát chính sách hủy và tính toán số tiền hoàn dự kiến...</p>
              </div>
            } @else if (cancelPreviewError()) {
              <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2">
                <div class="flex items-center gap-2 font-bold">
                  <i class="pi pi-exclamation-triangle text-rose-600"></i>
                  <span>Không thể tải chính sách hủy</span>
                </div>
                <p>{{ cancelPreviewError() }}</p>
                <button
                  type="button"
                  (click)="loadCancelPreview()"
                  class="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            } @else if (cancelPreview(); as prev) {
              <!-- A. Hold expired notice while modal is open -->
              @if (booking()?.status === 'PendingPayment' && isHoldExpired()) {
                <div class="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5">
                  <div class="flex items-center gap-2 font-bold text-amber-950">
                    <i class="pi pi-clock text-amber-700"></i>
                    <span>Thời gian giữ phòng đã hết hạn</span>
                  </div>
                  <p class="text-amber-800 leading-relaxed">
                    Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.
                  </p>
                </div>
              } @else if (!prev.canCancel) {
                <div class="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5">
                  <div class="flex items-center gap-2 font-bold text-amber-950">
                    <i class="pi pi-lock text-amber-700"></i>
                    <span>Không thể thực hiện hủy phòng trực tuyến</span>
                  </div>
                  <p class="text-amber-800 leading-relaxed">
                    {{ prev.ineligibilityReason || 'Đơn đặt phòng này hiện không đủ điều kiện hủy trực tuyến theo chính sách của khách sạn. Vui lòng liên hệ trực tiếp quầy Lễ tân để được hỗ trợ.' }}
                  </p>
                </div>
              }

              <!-- A2. Notice for unpaid hold -->
              @if (isUnpaidHold()) {
                <div class="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <i class="pi pi-info-circle text-amber-700 text-sm mt-0.5 shrink-0"></i>
                  <div class="leading-relaxed">
                    Đơn của bạn chưa được xác nhận và chưa phát sinh thanh toán. Bạn có thể hủy lượt giữ phòng này.
                  </div>
                </div>
              }

              <!-- 1. Mốc thời gian đối soát hủy phòng & nhận phòng (Item 1) -->
              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-200/70 text-slate-700">
                  <span class="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <i class="pi pi-calendar-clock text-slate-500"></i>
                    Mốc thời gian đối soát
                  </span>
                  <span class="text-[10px] font-medium text-slate-500">Múi giờ Việt Nam (GMT+7)</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div class="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <i class="pi pi-sign-in text-sm"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Nhận phòng:</div>
                      <div class="font-bold text-slate-900 truncate font-mono text-xs">
                        {{ formatTimelineDateTime(prev.startAtUtc || booking()?.startAtUtc) }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <i class="pi pi-clock text-sm"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Yêu cầu hủy:</div>
                      <div class="font-bold text-slate-900 truncate font-mono text-xs">
                        {{ formatTimelineDateTime(cancelRequestTime()) }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Phân tích quy định thời gian áp dụng phí -->
                <div
                  class="p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                  [ngClass]="prev.isFreeCancellation ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'"
                >
                  <i class="pi text-sm shrink-0" [ngClass]="prev.isFreeCancellation ? 'pi-check-circle text-emerald-600' : 'pi-info-circle text-rose-600'"></i>
                  <span class="leading-relaxed" [innerHTML]="getCancellationTimelineFormattedHtml(prev)"></span>
                </div>
              </div>

              <!-- B. Financial breakdown card -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span class="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Đối soát tài chính & Hoàn trả</span>
                  @if (prev.isFreeCancellation) {
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Miễn phí hủy phòng
                    </span>
                  }
                </div>

                <div class="space-y-2 text-slate-700">
                  <div class="flex justify-between items-center">
                    <span>Tổng tiền phòng:</span>
                    <span class="font-mono font-semibold text-slate-900">{{ prev.totalAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span>Số tiền khách đã thanh toán:</span>
                    <span class="font-mono font-semibold text-slate-900">{{ prev.paidAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between items-center text-rose-700">
                    <span class="font-semibold text-rose-900">
                      Phí hủy áp dụng
                      @if (prev.cancellationFee > 0 && prev.totalAmount > 0) {
                        <strong class="font-bold text-rose-700">({{ getCancellationFeePercent(prev) }}%)</strong>
                      }:
                    </span>
                    <span class="font-mono font-bold text-rose-700">{{ prev.cancellationFee | number:'1.0-0' }} ₫</span>
                  </div>
                  @if (prev.pointsRefundable > 0) {
                    <div class="flex justify-between items-center text-indigo-700">
                      <span>Điểm Loyalty hoàn lại:</span>
                      <span class="font-mono font-bold">+{{ prev.pointsRefundable | number:'1.0-0' }} điểm</span>
                    </div>
                  }
                </div>

                <!-- Highlight Refundable Amount -->
                <div class="pt-3 border-t border-slate-200 flex items-center justify-between font-black text-sm text-emerald-800 bg-emerald-50/80 -mx-4 -mb-4 p-4 rounded-b-2xl">
                  <span>Khoản tiền dự kiến hoàn trả:</span>
                  <span class="font-mono text-base text-emerald-700">{{ prev.refundableAmount | number:'1.0-0' }} ₫</span>
                </div>
              </div>

              <!-- 2. Lưu ý phân tách rõ: Hủy phòng và Hoàn tiền là 2 bước riêng biệt (Item 2) -->
              @if (prev.refundableAmount > 0) {
                <div class="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-1.5 shadow-2xs">
                  <div class="font-bold flex items-center gap-1.5 text-amber-900">
                    <i class="pi pi-exclamation-triangle text-amber-700"></i>
                    <span>Quy trình hủy phòng & hoàn tiền:</span>
                  </div>
                  <p class="leading-relaxed text-[11px] text-amber-950 font-medium">
                    Đặt phòng sẽ được hủy sau khi bạn xác nhận. Khoản hoàn dự kiến <strong class="font-bold font-mono text-amber-950">{{ prev.refundableAmount | number:'1.0-0' }} ₫</strong> sẽ được khách sạn kiểm tra và xử lý theo quy trình hoàn tiền. Đây chưa phải khoản tiền đã được hoàn.
                  </p>
                </div>
              }

              <!-- C. Policy explanation note (Item 3 updated) -->
              <div class="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs space-y-1">
                <div class="font-bold flex items-center gap-1.5 text-blue-800">
                  <i class="pi pi-info-circle text-blue-600"></i>
                  <span>Chính sách hủy áp dụng:</span>
                </div>
                <p class="leading-relaxed text-[11px] text-blue-950" [innerHTML]="formatPolicyDescription(prev.policyDescription)"></p>
                @if (prev.refundableAmount > 0) {
                  <p class="text-[11px] font-semibold text-blue-950 pt-1 border-t border-blue-200/50">
                    * Lưu ý: Khoản hoàn dự kiến sẽ được khách sạn đối soát và xử lý theo phương thức hoàn tiền được xác nhận.
                  </p>
                }
              </div>

              <!-- D. Cancellation Reason (Optional) -->
              <div class="space-y-1.5">
                <label for="cancel-reason-input" class="block font-bold text-slate-700 text-xs">
                  Lý do hủy phòng (Tùy chọn):
                </label>
                <textarea
                  id="cancel-reason-input"
                  [(ngModel)]="cancelReason"
                  rows="2"
                  placeholder="Ví dụ: Thay đổi lịch trình chuyến đi, bận việc đột xuất..."
                  class="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
                ></textarea>
              </div>

              <!-- E. Verification Email / Phone (Optional) -->
              <div class="space-y-1.5">
                <label for="cancel-verification-input" class="block font-bold text-slate-700 text-xs">
                  Email hoặc Số điện thoại đối chiếu (Tùy chọn):
                </label>
                <input
                  id="cancel-verification-input"
                  type="text"
                  [(ngModel)]="cancelVerification"
                  placeholder="Nhập email hoặc số điện thoại đã dùng để đặt phòng"
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
                />
                <p class="text-[11px] text-slate-500">
                  Dùng để đối chiếu thông tin người đặt nếu bạn muốn kiểm tra chéo.
                </p>
              </div>

              <!-- Error message on submit -->
              @if (cancelError()) {
                <div role="alert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2">
                  <i class="pi pi-exclamation-triangle text-rose-600 mt-0.5 shrink-0"></i>
                  <span>{{ cancelError() }}</span>
                </div>
              }
            }
          </div>

          <!-- Modal Footer Actions -->
          <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              (click)="closeCancelModal()"
              [disabled]="isCancelling()"
              class="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Giữ lại đặt phòng
            </button>
            <button
              type="button"
              (click)="confirmCancellation()"
              [disabled]="isCancelling() || isLoadingCancelPreview() || !cancelPreview()?.canCancel || (booking()?.status === 'PendingPayment' && isHoldExpired())"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              @if (isCancelling()) {
                <i class="pi pi-spin pi-spinner text-xs"></i>
                <span>{{ isUnpaidHold() ? 'Đang hủy giữ phòng...' : 'Đang hủy đặt phòng...' }}</span>
              } @else {
                <i class="pi pi-check text-xs"></i>
                <span>{{ isUnpaidHold() ? 'Xác nhận hủy giữ phòng' : 'Xác nhận hủy đặt phòng' }}</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
      </div>
    </div>
  `
})
export class BookingStatusPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  searchToken: string = '';
  readonly tokenError = signal<string>('');
  readonly booking = signal<GuestBookingDetailDto | null>(null);
  readonly isSearching = signal<boolean>(false);
  readonly searchError = signal<StatusErrorState | null>(null);

  readonly remainingSeconds = signal<number>(0);
  readonly isHoldExpired = signal<boolean>(false);
  readonly isCopied = signal<boolean>(false);
  readonly isCodeCopied = signal<boolean>(false);
  readonly isExtendingHold = signal<boolean>(false);
    readonly extendHoldError = signal<string>('');

  // T04-B: Cancellation signals
  readonly isCancelModalOpen = signal<boolean>(false);
  readonly isLoadingCancelPreview = signal<boolean>(false);
  readonly cancelPreview = signal<GuestCancellationPreviewDto | null>(null);
  readonly cancelPreviewError = signal<string>('');
  readonly cancelRequestTime = signal<Date>(new Date());
  cancelReason: string = '';
  cancelVerification: string = '';
  readonly isCancelling = signal<boolean>(false);
  readonly cancelError = signal<string>('');

  readonly isExpiringSoon = computed(() => {
    const b = this.booking();
    return !this.isHoldExpired() && b?.status === 'PendingPayment' && this.remainingSeconds() > 0 && this.remainingSeconds() <= 180;
  });
  readonly isHoldExtended = computed(() => (this.booking()?.holdExtensionCount ?? 0) >= 1);
  readonly canExtendHold = computed(() => this.isExpiringSoon() && !this.isHoldExtended());

  private broadcastChannel?: BroadcastChannel;

  private fetchGeneration = 0;
  private timerInterval?: ReturnType<typeof setInterval>;
  private pollingInterval?: ReturnType<typeof setInterval>;
  private copyTimeout?: ReturnType<typeof setTimeout>;
  private copyCodeTimeout?: ReturnType<typeof setTimeout>;
  private copyTokenSessionId = 0;
  private copyCodeSessionId = 0;
  private copyPinSessionId = 0;
  private isDestroyed = false;
  private lastFetchedToken = '';
  private lastRouteToken: string | undefined = undefined;

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      const b = this.booking();
      const token = this.searchToken.trim() || this.lastFetchedToken.trim();
      if (token && b && b.status === 'PendingPayment') {
        const gen = this.fetchGeneration;
        this.publicBookingService.getBookingByToken(token).pipe(
          take(1)
        ).subscribe({
          next: (fresh) => {
            if (this.isDestroyed || gen !== this.fetchGeneration) return;
            this.booking.set(fresh);
            if (fresh.status === 'PendingPayment' && fresh.holdExpiresAtUtc && !this.isHoldExpired()) {
              this.startHoldCountdown(fresh.holdExpiresAtUtc, fresh.status);
              this.startPolling(token);
            } else {
              this.clearTimer();
              this.remainingSeconds.set(0);
              if (fresh.status !== 'PendingPayment') {
                this.isHoldExpired.set(fresh.status === 'Expired');
              }
              this.stopPolling();
            }
          },
          error: () => {
            if (b.holdExpiresAtUtc) {
              this.startHoldCountdown(b.holdExpiresAtUtc, b.status);
            }
          }
        });
      }
    }
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.initBroadcastSync();
    if (false) {
    }

    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot?.paramMap ?? { get: () => null });
    paramMap$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const token = params.get('token')?.trim();
      if (token) {
        if (token !== this.lastRouteToken) {
          this.lastRouteToken = token;
          this.searchToken = token;
          this.fetchBooking(token);
        }
      } else {
        const hadRouteToken = Boolean(this.lastRouteToken);
        this.lastRouteToken = '';
        if (hadRouteToken) {
          this.searchToken = '';
          this.resetToSearch();
        }
      }
    });
  }

  clearTokenError(): void {
    if (this.tokenError()) {
      this.tokenError.set('');
    }
  }

  dismissSearchError(): void {
    this.searchError.set(null);
  }

  resetToSearch(): void {
    this.fetchGeneration++;
    this.copyTokenSessionId++;
    this.copyCodeSessionId++;
    this.copyPinSessionId++;
    this.booking.set(null);
    this.searchError.set(null);
    this.tokenError.set('');
    this.clearTimer();
    this.stopPolling();
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    if (this.copyCodeTimeout) {
      clearTimeout(this.copyCodeTimeout);
      this.copyCodeTimeout = undefined;
    }
    this.isCopied.set(false);
    this.isCodeCopied.set(false);
    this.isSearching.set(false);
    this.searchToken = '';
    this.lastFetchedToken = '';
    this.isCancelModalOpen.set(false);
    this.cancelPreview.set(null);
    this.cancelPreviewError.set('');
    this.cancelError.set('');
    this.cancelReason = '';
    this.cancelVerification = '';
    this.isCancelling.set(false);
  }

  onSearch(): void {
    const token = this.searchToken.trim();
    if (!token) {
      this.tokenError.set('Vui lòng nhập mã tra cứu đặt phòng.');
      return;
    }
    this.tokenError.set('');
    this.fetchBooking(token);
  }

  fetchBooking(token: string): void {
    if (!token) return;

    this.booking.set(null); // CRITICAL T02: Xóa booking cũ ngay khi bắt đầu tra cứu mã mới
    this.searchError.set(null);
    this.tokenError.set('');
    this.clearTimer();
    this.stopPolling();
    this.copyTokenSessionId++;
    this.copyCodeSessionId++;
    this.copyPinSessionId++;
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    if (this.copyCodeTimeout) {
      clearTimeout(this.copyCodeTimeout);
      this.copyCodeTimeout = undefined;
    }
    this.isCopied.set(false);
    this.isCodeCopied.set(false);
    this.isSearching.set(true);
    this.lastFetchedToken = token;

    const currentGen = ++this.fetchGeneration;

    this.publicBookingService.getBookingByToken(token).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (b) => {
        if (currentGen !== this.fetchGeneration) return; // Guard: request A đến trễ không đè B
        this.isSearching.set(false);
        this.booking.set(b);
        if (b.status === 'PendingPayment' && b.holdExpiresAtUtc && !this.isHoldExpired()) {
          this.startHoldCountdown(b.holdExpiresAtUtc, b.status);
          this.startPolling(token);
        } else {
          this.clearTimer();
          this.remainingSeconds.set(0);
          if (b.status !== 'PendingPayment') {
            this.isHoldExpired.set(b.status === 'Expired');
          }
          this.stopPolling();
        }
      },
      error: (err) => {
        if (currentGen !== this.fetchGeneration) return; // Guard: request A đến trễ không đè B
        this.isSearching.set(false);
        this.booking.set(null);
        this.clearTimer();
        this.stopPolling();
        this.searchError.set(this.parseError(err));
      }
    });
  }

  parseError(err: any): StatusErrorState {
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
        message: 'Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng rồi thử lại.',
        isRetryable: true
      };
    }

    if (status && status >= 500) {
      return {
        title: 'Hệ thống tạm thời gián đoạn',
        message: 'Máy chủ đang gặp sự cố khi tải dữ liệu đơn. Vui lòng thử lại sau giây lát.',
        isRetryable: true
      };
    }

    const serverMsg = typeof err?.error?.message === 'string' && !/failed|exception|error|stacktrace/i.test(err.error.message)
      ? err.error.message
      : '';

    return {
      title: 'Không tìm thấy thông tin đặt phòng',
      message: serverMsg || 'Không tìm thấy thông tin đặt phòng với mã tra cứu này. Vui lòng kiểm tra lại mã đã nhập.',
      isRetryable: false
    };
  }

  startHoldCountdown(holdExpiresAtUtc?: string, status?: string): void {
    this.clearTimer();

    // Dừng countdown ngay lập tức nếu trạng thái đã được xác nhận hoặc không phải PendingPayment
    if (status !== 'PendingPayment') {
      this.remainingSeconds.set(0);
      this.isHoldExpired.set(status === 'Expired');
      this.stopPolling();
      return;
    }

    const expireTime = holdExpiresAtUtc ? new Date(holdExpiresAtUtc).getTime() : NaN;
    if (!Number.isFinite(expireTime)) {
      this.remainingSeconds.set(0);
      this.isHoldExpired.set(false);
      this.stopPolling();
      return;
    }

    let hadPositiveTime = false;
    const tick = () => {
      // Authoritative state check: nếu đơn đã được xác nhận (Confirmed/CheckedIn) thì dừng countdown ngay
      const current = this.booking();
      if (current && current.status !== 'PendingPayment') {
        this.clearTimer();
        this.remainingSeconds.set(0);
        this.isHoldExpired.set(current.status === 'Expired');
        this.stopPolling();
        return;
      }

      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      this.remainingSeconds.set(diff);
      if (diff <= 0) {
        this.isHoldExpired.set(true);
        this.clearTimer();
        this.stopPolling();
        if (hadPositiveTime) {
          this.verifyHoldStatusOnZero();
        }
      } else {
        hadPositiveTime = true;
        this.isHoldExpired.set(false);
      }
    };
    const unusedTick = () => {
      const diff = 0;
      if (diff <= 0) {
        this.isHoldExpired.set(true);
        this.clearTimer();
        this.stopPolling();
      } else {
        this.isHoldExpired.set(false);
      }
    };

    tick();
    if (this.remainingSeconds() > 0 && !this.isHoldExpired()) {
      this.timerInterval = setInterval(tick, 1000);
    }
  }

  private startPolling(token: string): void {
    this.stopPolling();
    // Đồng bộ trạng thái tự động với PMS/Cashier mỗi 5 giây khi đơn đang Chờ thanh toán
    this.pollingInterval = setInterval(() => {
      const b = this.booking();
      if (this.isDestroyed || !b || b.status !== 'PendingPayment' || this.isHoldExpired()) {
        this.stopPolling();
        return;
      }

      const pollGen = this.fetchGeneration;
      this.publicBookingService.getBookingByToken(token).pipe(
        take(1)
      ).subscribe({
        next: (updated) => {
          if (this.isDestroyed || pollGen !== this.fetchGeneration) return;
          if (updated.status !== 'PendingPayment') {
            this.booking.set(updated);
            this.stopPolling();
            this.clearTimer();
            this.remainingSeconds.set(0);
            this.isHoldExpired.set(updated.status === 'Expired');
          } else if (
            updated.paidAmount !== b.paidAmount ||
            updated.paidAmount !== b.paidAmount ||
            updated.remainingBalance !== b.remainingBalance ||
            updated.holdExpiresAtUtc !== b.holdExpiresAtUtc ||
            updated.holdExtensionCount !== b.holdExtensionCount
          ) {
            this.booking.set(updated);
            if (updated.holdExpiresAtUtc && updated.holdExpiresAtUtc !== b.holdExpiresAtUtc) {
              this.startHoldCountdown(updated.holdExpiresAtUtc, updated.status);
            }
          } else if (false
          ) {
            this.booking.set(updated);
          }
        },
        error: () => {
          // Bỏ qua lỗi polling mạng nhất thời để không làm gián đoạn giao diện khách
        }
      });
    }, 5000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  formatCountdown(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'PendingPayment':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CheckedIn':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'CheckedOut':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Expired':
      case 'Cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getStatusLabel(status?: string): string {
    if (!status) return 'Đang cập nhật trạng thái';
    const labels: Record<string, string> = {
      'PendingPayment': 'Chờ thanh toán',
      'Expired': 'Đã hết hạn giữ phòng',
      'Confirmed': 'Đã xác nhận',
      'CheckedIn': 'Đã nhận phòng',
      'CheckedOut': 'Đã trả phòng',
      'Cancelled': 'Đã hủy'
    };
    return labels[status] ?? 'Đang cập nhật trạng thái';
  }

  getStatusIcon(status?: string): string {
    switch (status) {
      case 'PendingPayment': return 'pi-clock';
      case 'Confirmed': return 'pi-check-circle';
      case 'CheckedIn': return 'pi-home';
      case 'CheckedOut': return 'pi-check';
      case 'Expired': return 'pi-times-circle';
      case 'Cancelled': return 'pi-ban';
      default: return 'pi-info-circle';
    }
  }

  getNextStepMessage(status?: string): string {
    switch (status) {
      case 'PendingPayment':
        return 'Đơn đang được giữ tạm thời và chưa xác nhận. Vui lòng hoàn tất khoản đặt cọc theo hướng dẫn hợp lệ trước khi thời hạn giữ phòng kết thúc.';
      case 'Confirmed':
        return 'Đặt phòng đã được xác nhận. Vui lòng chuẩn bị giấy tờ tùy thân khi đến nhận phòng.';
      case 'CheckedIn':
        return 'Bạn đã nhận phòng thành công. Chúc bạn có kỳ lưu trú thuận lợi.';
      case 'CheckedOut':
        return 'Bạn đã hoàn tất trả phòng. Cảm ơn bạn đã sử dụng dịch vụ.';
      case 'Expired':
        return 'Thời gian giữ phòng đã kết thúc. Vui lòng kiểm tra lại phòng trống và tạo yêu cầu giữ phòng mới nếu cần.';
      case 'Cancelled':
        return 'Đơn đặt phòng đã được hủy.';
      default:
        return 'Đang cập nhật hướng dẫn từ cơ sở lưu trú.';
    }
  }

  isConfirmedStatus(status?: string): boolean {
    return status === 'Confirmed' || status === 'CheckedIn' || status === 'CheckedOut';
  }

  hasValidDirections(detail?: GuestBookingDetailDto | null): boolean {
    if (!detail) return false;
    const address = detail.propertyAddress?.trim();
    const name = detail.propertyName?.trim();
    return Boolean(address || name);
  }

  getPrintButtonLabel(status?: string): string {
    return this.isConfirmedStatus(status) ? 'In phiếu xác nhận' : 'In thông tin đặt phòng';
  }

  getPrintDocumentTitle(status?: string): string {
    switch (status) {
      case 'PendingPayment':
        return 'THÔNG TIN ĐẶT PHÒNG — CHỜ THANH TOÁN';
      case 'Confirmed':
        return 'PHIẾU XÁC NHẬN ĐẶT PHÒNG';
      case 'CheckedIn':
        return 'THÔNG TIN LƯU TRÚ — ĐÃ NHẬN PHÒNG';
      case 'CheckedOut':
        return 'THÔNG TIN LƯU TRÚ — ĐÃ TRẢ PHÒNG';
      case 'Expired':
        return 'THÔNG TIN ĐẶT PHÒNG — ĐÃ HẾT HẠN';
      case 'Cancelled':
        return 'THÔNG TIN ĐẶT PHÒNG — ĐÃ HỦY';
      default:
        return 'THÔNG TIN ĐẶT PHÒNG';
    }
  }

  getPrintStatusNote(status?: string): string {
    switch (status) {
      case 'PendingPayment':
        return 'Đơn đang được giữ phòng tạm thời và chưa được xác nhận chính thức. Vui lòng hoàn tất các điều kiện đặt cọc theo quy định trước khi thời hạn giữ chỗ kết thúc.';
      case 'Confirmed':
        return 'Đơn đặt phòng đã được xác nhận. Vui lòng chuẩn bị giấy tờ tùy thân khi làm thủ tục nhận phòng.';
      case 'CheckedIn':
        return 'Khách đã hoàn tất thủ tục nhận phòng và đang trong kỳ lưu trú.';
      case 'CheckedOut':
        return 'Khách đã hoàn tất thủ tục trả phòng tại cơ sở lưu trú.';
      case 'Expired':
        return 'Thời gian giữ phòng tạm thời đã kết thúc. Đơn đặt phòng không còn hiệu lực giữ chỗ.';
      case 'Cancelled':
        return 'Đơn đặt phòng đã bị hủy theo yêu cầu hoặc chính sách của cơ sở lưu trú.';
      default:
        return 'Chưa xác định được trạng thái đặt phòng.';
    }
  }

  getCurrentPrintDate(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  formatAbsoluteDeadline(utcStr?: string): string {
    if (!utcStr) return '';
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${min} ngày ${dd}/${mm}/${yyyy}`;
  }

  getDirectionsUrl(): string {
    const b = this.booking();
    if (!b) return '#';
    const address = b.propertyAddress?.trim();
    const name = b.propertyName?.trim();
    const query = address ? (name ? `${name}, ${address}` : address) : (name || '');
    if (!query) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  getRentalTypeLabel(type?: string): string {
    switch (type) {
      case 'Daily': return 'Thuê theo ngày (Đêm)';
      case 'Hourly': return 'Thuê theo giờ';
      case 'Overnight': return 'Thuê qua đêm';
      default: return type || 'Tiêu chuẩn';
    }
  }

  formatStayDate(dateStr?: string, utcStr?: string, rentalType?: string): string {
    if (rentalType === 'Hourly' && utcStr) {
      const d = new Date(utcStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
      }
    }
    if (dateStr) {
      return dateStr;
    }
    if (utcStr) {
      const d = new Date(utcStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return 'Theo giờ thỏa thuận';
  }

  getSmartLockStatusLabel(status?: string): string {
    switch (status) {
      case 'Active': return 'ĐANG HOẠT ĐỘNG';
      case 'Pending': return 'CHỜ KÍCH HOẠT KHI NHẬN PHÒNG';
      case 'Expired': return 'HẾT HIỆU LỰC';
      case 'Revoked': return 'ĐÃ THU HỒI';
      default: return 'CHỜ KÍCH HOẠT';
    }
  }

  getRemainingDeposit(detail?: GuestBookingDetailDto | null): number {
    if (!detail) return 0;
    return Math.max(0, (detail.depositRequired || 0) - (detail.paidAmount || 0));
  }

  payWithVnpay(): void {
    // T03: Kiểm tra điều kiện gate — chưa có bằng chứng phê duyệt cấu hình sandbox từ An, không phát request thanh toán
    this.alertService.toastWarning('Cổng thanh toán VNPay trực tuyến hiện chưa khả dụng. Vui lòng thanh toán trực tiếp với cơ sở lưu trú.');
  }

  copyPin(pin?: string): void {
    if (!pin || this.isDestroyed) return;
    const currentBooking = this.booking();
    const contextToken = currentBooking?.lookupToken;
    const contextPin = currentBooking?.smartLockPin;
    if (!currentBooking || contextPin !== pin) return;

    const opId = ++this.copyPinSessionId;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pin).then(() => {
        if (this.isDestroyed || opId !== this.copyPinSessionId) return;
        const b = this.booking();
        if (!b || b.lookupToken !== contextToken || b.smartLockPin !== pin) return;

        this.alertService.success('Đã sao chép mã PIN mở cửa.');
      }).catch(() => {
        if (this.isDestroyed || opId !== this.copyPinSessionId) return;
        const b = this.booking();
        if (!b || b.lookupToken !== contextToken || b.smartLockPin !== pin) return;

        this.alertService.toastWarning('Không thể tự động sao chép mã PIN. Vui lòng chọn và sao chép thủ công.');
      });
    } else {
      if (this.isDestroyed || opId !== this.copyPinSessionId) return;
      this.alertService.toastWarning('Trình duyệt không hỗ trợ tự động sao chép. Vui lòng chọn và sao chép thủ công.');
    }
  }

  copyConfirmationCode(code?: string): void {
    if (!code || this.isDestroyed) return;
    const currentBooking = this.booking();
    if (currentBooking && currentBooking.confirmationCode !== code) return;

    const opId = ++this.copyCodeSessionId;

    const onSuccess = () => {
      if (this.isDestroyed || opId !== this.copyCodeSessionId) return;
      if (this.booking()?.confirmationCode !== code) return;

      this.isCodeCopied.set(true);
      if (this.copyCodeTimeout) {
        clearTimeout(this.copyCodeTimeout);
      }
      this.copyCodeTimeout = setTimeout(() => {
        if (!this.isDestroyed && opId === this.copyCodeSessionId) {
          this.isCodeCopied.set(false);
        }
        this.copyCodeTimeout = undefined;
      }, 2000);

      this.alertService.success('Mã đặt phòng đã được sao chép.', 'Sao chép thành công');
    };

    const tryExecCommandFallback = () => {
      if (typeof document !== 'undefined') {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = code;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (successful) {
            onSuccess();
            return;
          }
        } catch {
          // ignore
        }
      }
      if (this.isDestroyed || opId !== this.copyCodeSessionId) return;
      if (this.booking()?.confirmationCode !== code) return;

      this.isCodeCopied.set(false);
      this.alertService.toastWarning('Không thể tự động sao chép mã đặt phòng. Vui lòng chọn và sao chép thủ công.');
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        onSuccess();
      }).catch(() => {
        tryExecCommandFallback();
      });
    } else {
      tryExecCommandFallback();
    }
  }

  copyToken(token?: string): void {
    if (!token || this.isDestroyed) return;
    const currentBooking = this.booking();
    const contextToken = currentBooking?.lookupToken ?? token;
    if (currentBooking && currentBooking.lookupToken !== token) return;

    const opId = ++this.copyTokenSessionId;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(() => {
        if (this.isDestroyed || opId !== this.copyTokenSessionId) return;
        if (this.booking()?.lookupToken !== contextToken) return;

        this.isCopied.set(true);
        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
        }
        this.copyTimeout = setTimeout(() => {
          if (!this.isDestroyed && opId === this.copyTokenSessionId) {
            this.isCopied.set(false);
          }
          this.copyTimeout = undefined;
        }, 2000);
      }).catch(() => {
        if (this.isDestroyed || opId !== this.copyTokenSessionId) return;
        if (this.booking()?.lookupToken !== contextToken) return;

        this.isCopied.set(false);
        this.alertService.toastWarning('Không thể tự động sao chép mã tra cứu. Vui lòng chọn và sao chép thủ công.');
      });
    } else {
      if (this.isDestroyed || opId !== this.copyTokenSessionId) return;
      this.isCopied.set(false);
      this.alertService.toastWarning('Trình duyệt không hỗ trợ tự động sao chép. Vui lòng chọn và sao chép thủ công.');
    }
  }

  printConfirmation(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  extendHold(): void {
    const detail = this.booking();
    if (!detail?.lookupToken || this.isExtendingHold() || this.isHoldExpired() || !this.canExtendHold()) {
      return;
    }

    const token = detail.lookupToken;
    const gen = this.fetchGeneration;
    this.isExtendingHold.set(true);
    this.extendHoldError.set('');

    this.publicBookingService.extendHold(token).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => {
        if (this.isDestroyed || gen !== this.fetchGeneration || this.booking()?.lookupToken !== token) return;
        this.isExtendingHold.set(false);
        this.extendHoldError.set('');
        this.booking.set({
          ...updated,
          holdExtensionCount: updated.holdExtensionCount ?? 1,
          canExtendHold: false
        });
        this.startHoldCountdown(updated.holdExpiresAtUtc, updated.status);
        this.alertService.success('Đã gia hạn thêm 5 phút giữ phòng.', 'Gia hạn thành công');
      },
      error: err => {
        if (this.isDestroyed || gen !== this.fetchGeneration || this.booking()?.lookupToken !== token) return;
        this.isExtendingHold.set(false);
        const serverMsg = typeof err?.error?.message === 'string' && !/failed|exception|stacktrace/i.test(err.error.message)
          ? err.error.message
          : 'Không thể gia hạn thời gian giữ phòng lúc này. Vui lòng hoàn tất đặt phòng hoặc thử lại.';
        this.extendHoldError.set(serverMsg);
        if (err?.status === 409) {
          this.syncHoldStateFromServer(token);
        }
      }
    });
  }

  verifyHoldStatusOnZero(): void {
    const current = this.booking();
    if (!current?.lookupToken || this.isDestroyed || typeof this.publicBookingService.getBookingByToken !== 'function') return;
    const token = current.lookupToken;
    const gen = this.fetchGeneration;

    this.publicBookingService.getBookingByToken(token).pipe(
      take(1)
    ).subscribe({
      next: fresh => {
        if (this.isDestroyed || gen !== this.fetchGeneration || this.booking()?.lookupToken !== token) return;
        if (fresh.status !== 'PendingPayment') {
          this.booking.set(fresh);
          this.clearTimer();
          this.stopPolling();
          this.remainingSeconds.set(0);
          this.isHoldExpired.set(fresh.status === 'Expired');
          return;
        }
        const freshExpireMs = fresh.holdExpiresAtUtc ? new Date(fresh.holdExpiresAtUtc).getTime() : NaN;
        if (Number.isFinite(freshExpireMs) && freshExpireMs > Date.now()) {
          this.booking.set(fresh);
          this.startHoldCountdown(fresh.holdExpiresAtUtc, fresh.status);
          this.startPolling(token);
        } else {
          this.booking.set({ ...fresh, status: 'Expired' });
          this.remainingSeconds.set(0);
          this.isHoldExpired.set(true);
        }
      },
      error: () => {
        // Giữ nguyên trạng thái hết hạn cục bộ
      }
    });
  }

  syncHoldStateFromServer(token: string): void {
    if (!token || this.isDestroyed || typeof this.publicBookingService.getBookingByToken !== 'function') return;
    const gen = this.fetchGeneration;
    this.publicBookingService.getBookingByToken(token).pipe(
      take(1)
    ).subscribe({
      next: fresh => {
        if (this.isDestroyed || gen !== this.fetchGeneration || this.booking()?.lookupToken !== token) return;
        this.booking.set(fresh);
        if (fresh.status === 'PendingPayment' && fresh.holdExpiresAtUtc) {
          this.startHoldCountdown(fresh.holdExpiresAtUtc, fresh.status);
          this.startPolling(token);
        } else {
          this.clearTimer();
          this.stopPolling();
          this.remainingSeconds.set(0);
          this.isHoldExpired.set(fresh.status === 'Expired');
        }
      },
      error: () => {
        // Bỏ qua lỗi đồng bộ nền
      }
    });
  }

  private initBroadcastSync(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('hotelsaas-live-notifications');
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (this.isDestroyed) return;
          const data = event?.data;
          const current = this.booking();
          if (!data || !current?.lookupToken) return;
          if (
            (data.action === 'extend-hold' || data.action === 'confirm') &&
            (data.lookupToken === current.lookupToken || (data.reservationId && data.reservationId === current.reservationId))
          ) {
            this.syncHoldStateFromServer(current.lookupToken);
          }
        };
      }
    } catch {
      // Bỏ qua nếu không hỗ trợ BroadcastChannel
    }
  }

  
  isUnpaidHold(detail?: GuestBookingDetailDto | null): boolean {
    const d = detail !== undefined ? detail : this.booking();
    return d?.status === 'PendingPayment' && (d?.paidAmount ?? 0) === 0;
  }

  canRequestCancellation(detail?: GuestBookingDetailDto | null): boolean {
    if (!detail) return false;
    if (detail.status !== 'PendingPayment' && detail.status !== 'Confirmed') return false;
    if (detail.status === 'PendingPayment' && this.isHoldExpired()) return false;
    return true;
  }

  openCancelModal(): void {
    const b = this.booking();
    if (!b || !this.canRequestCancellation(b)) return;
    this.cancelRequestTime.set(new Date());
    this.isCancelModalOpen.set(true);
    this.cancelError.set('');
    this.cancelReason = '';
    this.cancelVerification = '';
    this.loadCancelPreview();
  }

  closeCancelModal(): void {
    if (this.isCancelling()) return;
    this.isCancelModalOpen.set(false);
  }

  loadCancelPreview(): void {
    const b = this.booking();
    if (!b?.lookupToken) return;

    this.isLoadingCancelPreview.set(true);
    this.cancelPreviewError.set('');
    this.cancelPreview.set(null);

    this.publicBookingService.getCancellationPreview(b.lookupToken).pipe(
      take(1)
    ).subscribe({
      next: preview => {
        this.isLoadingCancelPreview.set(false);
        this.cancelPreview.set(preview);
      },
      error: err => {
        this.isLoadingCancelPreview.set(false);
        const serverMsg = typeof err?.error?.message === 'string' && !/failed|exception|stacktrace/i.test(err.error.message)
          ? err.error.message
          : 'Không thể tải chính sách hủy đặt phòng vào lúc này. Vui lòng thử lại.';
        this.cancelPreviewError.set(serverMsg);
      }
    });
  }

  confirmCancellation(): void {
    const b = this.booking();
    const prev = this.cancelPreview();
    if (!b?.lookupToken || !prev?.canCancel || this.isCancelling()) return;

    if (b.status === 'PendingPayment' && this.isHoldExpired()) {
      this.cancelError.set('Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.');
      return;
    }

    this.isCancelling.set(true);
    this.cancelError.set('');

    const isHold = this.isUnpaidHold(b);

    const request: CancelGuestBookingRequest = {
      reason: this.cancelReason.trim() || undefined,
      verificationEmailOrPhone: this.cancelVerification.trim() || undefined,
      idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('cancel-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9))
    };

    this.publicBookingService.cancelBooking(b.lookupToken, request).pipe(
      take(1)
    ).subscribe({
      next: updated => {
        this.isCancelling.set(false);
        this.isCancelModalOpen.set(false);
        this.booking.set(updated);
        this.clearTimer();
        this.stopPolling();

        if (isHold) {
          this.alertService.toastSuccess('Lượt giữ phòng đã được hủy thành công.');
        } else {
          const refAmount = updated.refundableAmount ?? prev.refundableAmount ?? 0;
          if (refAmount > 0) {
            const formattedAmount = refAmount.toLocaleString('vi-VN') + ' ₫';
            this.alertService.toastSuccess(
              `Đặt phòng đã được hủy thành công. Khoản tiền hoàn dự kiến ${formattedAmount} đã được ghi nhận và đang chờ khách sạn đối soát, xử lý theo phương thức hoàn tiền được xác nhận (chưa chi trả thực tế).`
            );
          } else {
            this.alertService.toastSuccess('Đặt phòng đã được hủy thành công.');
          }
        }
      },
      error: err => {
        this.isCancelling.set(false);
        let errorMsg = 'Không thể hủy đặt phòng lúc này. Vui lòng liên hệ trực tiếp khách sạn.';
        if (err?.status === 400 && typeof err?.error?.message === 'string') {
          errorMsg = err.error.message;
        } else if (err?.status === 401 || err?.status === 403) {
          errorMsg = 'Thông tin xác nhận email hoặc số điện thoại không trùng khớp với hồ sơ đặt phòng.';
        } else if (err?.status === 409) {
          errorMsg = 'Trạng thái đơn đặt phòng đã thay đổi trên hệ thống. Vui lòng kiểm tra lại.';
          this.syncHoldStateFromServer(b.lookupToken);
        } else if (typeof err?.error?.message === 'string' && !/failed|exception|stacktrace/i.test(err.error.message)) {
          errorMsg = err.error.message;
        }
        this.cancelError.set(errorMsg);
      }
    });
  }

  formatVietnamFullDateTime(utcStr?: string): string {
    if (!utcStr) return '';
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatTimelineDateTime(dateOrUtcStr?: string | Date | null): string {
    if (!dateOrUtcStr) return '';
    const d = typeof dateOrUtcStr === 'string' ? new Date(dateOrUtcStr) : dateOrUtcStr;
    if (isNaN(d.getTime())) return '';
    try {
      const formatter = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value ?? '';
      const month = parts.find(p => p.type === 'month')?.value ?? '';
      const year = parts.find(p => p.type === 'year')?.value ?? '';
      const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
      const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
      return `${day}/${month}/${year} — ${hour}:${minute}`;
    } catch {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  getCancellationFeePercent(prev?: GuestCancellationPreviewDto | null): number {
    if (!prev || !prev.totalAmount || prev.totalAmount <= 0) return 30;
    return Math.round((prev.cancellationFee / prev.totalAmount) * 100);
  }

  getCancellationTimelineMessage(prev: GuestCancellationPreviewDto): string {
    if (this.isUnpaidHold()) {
      return 'Lượt giữ phòng chưa phát sinh thanh toán — Miễn phí hủy 100%.';
    }

    const hours = prev.hoursUntilCheckIn;
    const penaltyPercent = this.getCancellationFeePercent(prev);

    if (hours > 0) {
      if (prev.isFreeCancellation) {
        return `Còn ${hours} giờ trước nhận phòng — Miễn phí hủy 100%.`;
      }
      return `Còn ${hours} giờ trước nhận phòng — Áp dụng phí hủy ${penaltyPercent}%.`;
    } else {
      return `Đã đến hoặc qua thời điểm nhận phòng — Áp dụng phí hủy ${penaltyPercent}%.`;
    }
  }

  getCancellationTimelineFormattedHtml(prev: GuestCancellationPreviewDto): string {
    if (this.isUnpaidHold()) {
      return 'Lượt giữ phòng chưa phát sinh thanh toán — <strong class="font-bold text-emerald-800">Miễn phí hủy 100%</strong>.';
    }

    const hours = prev.hoursUntilCheckIn;
    const penaltyPercent = this.getCancellationFeePercent(prev);

    if (hours > 0) {
      if (prev.isFreeCancellation) {
        return `Còn <strong class="font-bold underline decoration-emerald-400 underline-offset-2">${hours} giờ trước nhận phòng</strong> — Áp dụng <strong class="font-bold text-emerald-800">Miễn phí hủy 100%</strong>.`;
      }
      return `Còn <strong class="font-bold text-rose-950 underline decoration-rose-300 underline-offset-2">${hours} giờ trước nhận phòng</strong> — Áp dụng <strong class="font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200">phí hủy ${penaltyPercent}%</strong>.`;
    } else {
      return `<strong class="font-bold text-rose-950">Đã qua thời điểm nhận phòng</strong> — Áp dụng <strong class="font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200">phí hủy ${penaltyPercent}%</strong>.`;
    }
  }

  formatPolicyDescription(text?: string | null): string {
    if (!text) return '';
    let res = text;
    // 1. Mức phí phạt (in đậm có nền nhẹ và viền)
    res = res.replace(
      /(phí phạt 30% tổng giá trị đơn đặt phòng|phí phạt \d+%|phí hủy \d+%|phí hủy [\d.,]+\s*₫?)/gi,
      '<strong class="font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200/80">$1</strong>'
    );
    // 2. Thời điểm bị tính phí (in đậm và gạch chân màu amber)
    res = res.replace(
      /(trong vòng \d+\s*(?:giờ|h)(?:\s*trước giờ nhận phòng)?)/gi,
      '<strong class="font-bold text-slate-900 underline decoration-amber-400 underline-offset-2">$1</strong>'
    );
    // 3. Thời hạn hủy miễn phí (in đậm và gạch chân màu xanh)
    res = res.replace(
      /(trước (?:ngày|giờ) nhận phòng ít nhất \d+\s*(?:giờ|h)|trước \d+\s*(?:giờ|h) nhận phòng)/gi,
      '<strong class="font-bold text-slate-900 underline decoration-blue-400 underline-offset-2">$1</strong>'
    );
    return res;
  }

  ngOnDestroy(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // ignore
      }
      this.broadcastChannel = undefined;
    }
    this.isDestroyed = true;
    this.copyTokenSessionId++;
    this.copyCodeSessionId++;
    this.copyPinSessionId++;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.clearTimer();
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    if (this.copyCodeTimeout) {
      clearTimeout(this.copyCodeTimeout);
      this.copyCodeTimeout = undefined;
    }
  }
}

export { BookingStatusPage as BookingStatusPageComponent };
