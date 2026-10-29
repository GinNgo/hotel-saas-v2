import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, take } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

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
              <div class="mx-6 sm:mx-8 my-6 p-5 sm:p-6 bg-gradient-to-r from-amber-50/90 via-amber-50/70 to-orange-50/40 border border-amber-200/90 rounded-2xl sm:rounded-3xl text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs">
                <div class="space-y-2 max-w-2xl">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                      <i class="pi pi-clock text-[11px] text-amber-700"></i>
                      <span>Chờ thanh toán</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300/60">
                      <i class="pi pi-info-circle text-[11px]"></i>
                      <span>Đơn giữ phòng tạm thời — Chưa xác nhận</span>
                    </span>
                  </div>

                  <h2 class="text-lg sm:text-xl font-black text-amber-950 tracking-tight">
                    Phòng của bạn đang được giữ tạm thời
                  </h2>

                  <p class="text-xs sm:text-sm text-amber-900/90 font-medium leading-relaxed">
                    Vui lòng hoàn tất đặt cọc để xác nhận đặt phòng. Đơn đặt phòng chưa được xác nhận, vui lòng hoàn tất khoản đặt cọc theo quy định trước khi thời hạn giữ phòng kết thúc để phòng được bảo đảm.
                  </p>

                  @if (detail.depositRequired > 0) {
                    <div class="pt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span class="text-amber-800 font-semibold">Khoản đặt cọc yêu cầu:</span>
                      <span class="font-mono font-bold text-amber-950 text-sm bg-white/90 px-2.5 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
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

                @if (detail.holdExpiresAtUtc) {
                  <div class="shrink-0 self-stretch md:self-auto flex flex-col justify-center">
                    @if (isHoldExpired()) {
                      <div class="px-5 py-3.5 rounded-2xl bg-rose-100 text-rose-800 text-xs font-extrabold border border-rose-200 text-center shadow-2xs">
                        <i class="pi pi-exclamation-triangle text-base block mb-1"></i>
                        <span>Đã hết hạn giữ phòng</span>
                      </div>
                    } @else {
                      <div class="bg-white/95 px-5 py-3.5 rounded-2xl border border-amber-200/90 text-center shadow-xs flex flex-col items-center">
                        <span class="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Thời gian giữ phòng còn lại</span>
                        <span class="font-mono text-2xl font-black text-amber-900 block mt-0.5 tracking-wider">
                          {{ formatCountdown(remainingSeconds()) }}
                        </span>
                        <span class="text-[10px] text-amber-700/80 font-medium mt-0.5">MM:SS</span>
                      </div>
                    }
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

                <!-- KHU VỰC ĐÁNH GIÁ TRỰC TUYẾN DÀNH CHO KHÁCH LƯU TRÚ -->
                @if (reviewSubmitted()) {
                  <!-- ĐÃ GỬI ĐÁNH GIÁ THÀNH CÔNG -->
                  <div class="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 text-emerald-950 space-y-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        <i class="pi pi-check"></i>
                      </div>
                      <div>
                        <h3 class="text-sm sm:text-base font-bold text-emerald-950">Cảm ơn bạn đã gửi đánh giá!</h3>
                        <p class="text-xs text-emerald-700">Đánh giá của bạn đã được đối soát xác thực và hiển thị công khai trên hồ sơ của {{ detail.propertyName }}.</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2 border-t border-emerald-200/60 text-xs text-emerald-800">
                      <span class="font-semibold">Điểm bạn đã đánh giá:</span>
                      <div class="flex items-center text-amber-500">
                        @for (s of [1,2,3,4,5]; track s) {
                          <i class="pi" [ngClass]="s <= reviewRating() ? 'pi-star-fill' : 'pi-star text-stone-200'"></i>
                        }
                      </div>
                      <span class="font-bold">({{ reviewRating() }}/5 sao - {{ getRatingLabel(reviewRating()) }})</span>
                    </div>
                  </div>
                } @else {
                  <!-- FORM NHẬP ĐÁNH GIÁ -->
                  <section aria-label="Đánh giá kỳ nghỉ" class="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-5">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div class="space-y-0.5">
                        <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                          <i class="pi pi-star-fill text-amber-500"></i>
                          <span>Đánh giá kỳ nghỉ của bạn</span>
                        </h3>
                        <p class="text-xs text-slate-500">
                          Chia sẻ cảm nhận thực tế để hỗ trợ cơ sở hoàn thiện chất lượng và giúp cộng đồng du khách.
                        </p>
                      </div>
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 self-start sm:self-auto">
                        <i class="pi pi-shield text-[10px]"></i>
                        <span>Đánh giá xác thực 100%</span>
                      </span>
                    </div>

                    <!-- 1. Overall Rating -->
                    <div class="space-y-2">
                      <label class="block text-xs font-bold text-slate-700">
                        Đánh giá tổng quan <span class="text-rose-500">*</span>
                      </label>
                      <div class="flex flex-wrap items-center gap-3">
                        <div class="flex items-center gap-1 text-2xl cursor-pointer" role="radiogroup" aria-label="Số sao">
                          @for (star of [1,2,3,4,5]; track star) {
                            <button
                              type="button"
                              (click)="setReviewRating(star)"
                              class="text-amber-400 hover:text-amber-500 hover:scale-110 active:scale-95 transition-all p-1 cursor-pointer focus:outline-none"
                              [title]="star + ' sao'"
                              [attr.aria-label]="star + ' sao'"
                            >
                              <i class="pi text-2xl" [ngClass]="star <= reviewRating() ? 'pi-star-fill text-amber-500' : 'pi-star text-slate-200'"></i>
                            </button>
                          }
                        </div>
                        <span class="text-xs font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                          {{ reviewRating() }}/5 sao — {{ getRatingLabel(reviewRating()) }}
                        </span>
                      </div>
                    </div>

                    <!-- 2. Sub-criteria Ratings Grid -->
                    <div class="space-y-2">
                      <span class="block text-xs font-bold text-slate-700">Chi tiết từng hạng mục dịch vụ</span>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <!-- Cleanliness -->
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                          <div class="text-xs">
                            <span class="font-bold text-slate-800 block">Vệ sinh & Sạch sẽ</span>
                            <span class="text-[10px] text-slate-500">Phòng ốc, drap giường, phòng tắm</span>
                          </div>
                          <div class="flex items-center gap-1">
                            @for (s of [1,2,3,4,5]; track s) {
                              <button
                                type="button"
                                (click)="reviewCleanliness.set(s)"
                                class="text-xs p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                              >
                                <i class="pi text-xs" [ngClass]="s <= reviewCleanliness() ? 'pi-star-fill text-emerald-600' : 'pi-star text-slate-200'"></i>
                              </button>
                            }
                          </div>
                        </div>

                        <!-- Location -->
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                          <div class="text-xs">
                            <span class="font-bold text-slate-800 block">Vị trí & Cảnh quan</span>
                            <span class="text-[10px] text-slate-500">Thuận tiện đi lại, gần điểm đến</span>
                          </div>
                          <div class="flex items-center gap-1">
                            @for (s of [1,2,3,4,5]; track s) {
                              <button
                                type="button"
                                (click)="reviewLocation.set(s)"
                                class="text-xs p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                              >
                                <i class="pi text-xs" [ngClass]="s <= reviewLocation() ? 'pi-star-fill text-[#C05621]' : 'pi-star text-slate-200'"></i>
                              </button>
                            }
                          </div>
                        </div>

                        <!-- Service -->
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                          <div class="text-xs">
                            <span class="font-bold text-slate-800 block">Dịch vụ & Nhân viên</span>
                            <span class="text-[10px] text-slate-500">Thái độ tiếp đón, hỗ trợ lễ tân</span>
                          </div>
                          <div class="flex items-center gap-1">
                            @for (s of [1,2,3,4,5]; track s) {
                              <button
                                type="button"
                                (click)="reviewService.set(s)"
                                class="text-xs p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                              >
                                <i class="pi text-xs" [ngClass]="s <= reviewService() ? 'pi-star-fill text-rose-500' : 'pi-star text-slate-200'"></i>
                              </button>
                            }
                          </div>
                        </div>

                        <!-- Value -->
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                          <div class="text-xs">
                            <span class="font-bold text-slate-800 block">Đáng giá tiền</span>
                            <span class="text-[10px] text-slate-500">Mức giá so với chất lượng nhận được</span>
                          </div>
                          <div class="flex items-center gap-1">
                            @for (s of [1,2,3,4,5]; track s) {
                              <button
                                type="button"
                                (click)="reviewValue.set(s)"
                                class="text-xs p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                              >
                                <i class="pi text-xs" [ngClass]="s <= reviewValue() ? 'pi-star-fill text-amber-600' : 'pi-star text-slate-200'"></i>
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 3. Review Comment Textarea -->
                    <div class="space-y-1.5">
                      <div class="flex justify-between items-center text-xs">
                        <label for="review-comment-textarea" class="font-bold text-slate-700">
                          Nhận xét chi tiết (tùy chọn)
                        </label>
                        <span class="text-slate-400 font-mono text-[11px]">
                          {{ reviewComment().length }}/1500 ký tự
                        </span>
                      </div>
                      <textarea
                        id="review-comment-textarea"
                        rows="3"
                        maxlength="1500"
                        [ngModel]="reviewComment()"
                        (ngModelChange)="reviewComment.set($event)"
                        placeholder="Hãy chia sẻ điều bạn ưng ý nhất hoặc góp ý chân thành để cơ sở cải thiện tốt hơn..."
                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:outline-indigo-500 transition-all resize-y"
                      ></textarea>
                    </div>

                    <!-- Error Alert -->
                    @if (reviewError()) {
                      <div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                        <i class="pi pi-exclamation-circle text-rose-600 mt-0.5 shrink-0"></i>
                        <span>{{ reviewError() }}</span>
                      </div>
                    }

                    <!-- Submit Action Button -->
                    <div class="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        (click)="submitGuestReview()"
                        [disabled]="reviewSubmitting()"
                        class="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        @if (reviewSubmitting()) {
                          <i class="pi pi-spin pi-spinner text-xs"></i>
                          <span>Đang gửi đánh giá...</span>
                        } @else {
                          <i class="pi pi-send text-xs"></i>
                          <span>Gửi đánh giá xác thực</span>
                        }
                      </button>
                    </div>
                  </section>
                }
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
                    Yêu cầu giữ chỗ này đã hết hiệu lực và không còn khả dụng để làm thủ tục nhận phòng. Quý khách vui lòng kiểm tra phòng trống và đặt lại đơn mới nếu vẫn có nhu cầu lưu trú.
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'Cancelled') {
              <!-- ĐÃ HỦY -->
              <div class="mx-6 sm:mx-8 my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-100 border border-slate-200 text-slate-800 flex items-start gap-4 shadow-xs">
                <div class="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-ban text-lg"></i>
                </div>
                <div class="space-y-1">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                    Đơn đặt phòng đã hủy
                  </span>
                  <h2 class="text-sm sm:text-base font-bold text-slate-900">Đơn đặt phòng đã bị hủy</h2>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    Đơn đặt phòng này đã được hủy trên hệ thống. Quý khách không thể thực hiện thủ tục nhận phòng với mã đơn này.
                  </p>
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
                            <span class="font-bold text-slate-700 block">Thanh toán qua VietQR NAPAS 24/7 hoặc VNPay</span>
                            <!-- VietQR & VNPay Options -->
                            <div class="mt-2 space-y-2">
                              <div class="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-3">
                                <img [src]="getVietQrImageUrl(detail)" alt="VietQR" class="w-20 h-20 object-contain shrink-0" />
                                <div class="text-[10px] space-y-0.5">
                                  <div class="font-bold text-slate-800">MB Bank: 0345678910</div>
                                  <div class="text-slate-500">CTK: HOTEL SAAS RESORT</div>
                                  <div class="font-mono text-emerald-700 font-bold">Số tiền: {{ getRemainingDeposit(detail) | number:'1.0-0' }} ₫</div>
                                  <div class="text-amber-800 font-mono font-bold">CK: DATPHONG {{ detail.confirmationCode }}</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                (click)="payWithVnpay()"
                                [disabled]="isVnpayRedirecting()"
                                class="w-full py-2 px-3 rounded-lg bg-[#005BAA] hover:bg-[#004785] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                @if (isVnpayRedirecting()) {
                                  <i class="pi pi-spin pi-spinner text-xs"></i>
                                  <span>Đang chuyển hướng VNPay…</span>
                                } @else {
                                  <i class="pi pi-credit-card text-xs"></i>
                                  <span>Thanh toán Cổng VNPAY</span>
                                }
                              </button>
                            </div>
                            <p class="text-slate-500 leading-relaxed">
                              Sau khi chuyển khoản thành công, hệ thống tự động kích hoạt mã PIN SmartLock và gửi thông báo tức thì tới Lễ tân.
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

              <div class="flex items-center gap-3">
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

  // GUEST REVIEWS & RATINGS SIGNALS
  readonly reviewRating = signal<number>(5);
  readonly reviewCleanliness = signal<number>(5);
  readonly reviewLocation = signal<number>(5);
  readonly reviewService = signal<number>(5);
  readonly reviewValue = signal<number>(5);
  readonly reviewComment = signal<string>('');
  readonly reviewSubmitting = signal<boolean>(false);
  readonly reviewSubmitted = signal<boolean>(false);
  readonly reviewError = signal<string>('');

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
              this.isHoldExpired.set(fresh.status === 'Expired');
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

    // Reset review state
    this.reviewRating.set(5);
    this.reviewCleanliness.set(5);
    this.reviewLocation.set(5);
    this.reviewService.set(5);
    this.reviewValue.set(5);
    this.reviewComment.set('');
    this.reviewSubmitting.set(false);
    this.reviewSubmitted.set(false);
    this.reviewError.set('');
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

    // Reset review state for new booking lookup
    this.reviewRating.set(5);
    this.reviewCleanliness.set(5);
    this.reviewLocation.set(5);
    this.reviewService.set(5);
    this.reviewValue.set(5);
    this.reviewComment.set('');
    this.reviewSubmitting.set(false);
    this.reviewSubmitted.set(false);
    this.reviewError.set('');

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
          this.isHoldExpired.set(b.status === 'Expired');
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
            updated.remainingBalance !== b.remainingBalance
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

  readonly isVnpayRedirecting = signal<boolean>(false);

  getVietQrImageUrl(detail: GuestBookingDetailDto): string {
    const deposit = this.getRemainingDeposit(detail);
    const amount = deposit > 0 ? deposit : (detail.remainingBalance || detail.totalAmount || 0);
    const code = detail.confirmationCode || 'HOTEL';
    return `https://img.vietqr.io/image/970422-0345678910-compact2.png?amount=${Math.round(amount)}&addInfo=DATPHONG+${code}&accountName=HOTEL+SAAS+RESORT`;
  }

  payWithVnpay(): void {
    // T03: Kiểm tra điều kiện gate — chưa có bằng chứng phê duyệt cấu hình sandbox từ An, không phát request thanh toán
    const detail = this.booking();
    if (!detail || this.isVnpayRedirecting()) return;

    this.isVnpayRedirecting.set(true);
    const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/booking/status/${detail.lookupToken}` : undefined;

    this.publicBookingService.createVnpayPaymentUrl(undefined, detail.lookupToken, returnUrl).subscribe({
      next: (res) => {
        if (res?.paymentUrl && typeof window !== 'undefined') {
          window.location.href = res.paymentUrl;
        } else {
          this.isVnpayRedirecting.set(false);
          this.alertService.toastWarning('Không thể tạo liên kết thanh toán VNPay. Vui lòng thử quét mã VietQR bên cạnh.');
        }
      },
      error: () => {
        this.isVnpayRedirecting.set(false);
        this.alertService.toastWarning('Kết nối cổng VNPay tạm thời gián đoạn. Vui lòng quét mã VietQR để chuyển khoản trực tiếp.');
      }
    });
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

  setReviewRating(stars: number): void {
    this.reviewRating.set(stars);
  }

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 5: return 'Xuất sắc tuyệt vời';
      case 4: return 'Rất hài lòng';
      case 3: return 'Bình thường, tạm ổn';
      case 2: return 'Cần cải thiện chất lượng';
      case 1: return 'Rất thất vọng';
      default: return '';
    }
  }

  submitGuestReview(): void {
    const b = this.booking();
    if (!b || this.reviewSubmitting()) return;
    const rating = this.reviewRating();
    if (rating < 1 || rating > 5) {
      this.reviewError.set('Vui lòng chọn số sao từ 1 đến 5.');
      return;
    }

    this.reviewSubmitting.set(true);
    this.reviewError.set('');

    this.publicBookingService.submitReview({
      lookupToken: b.lookupToken,
      rating: this.reviewRating(),
      cleanlinessRating: this.reviewCleanliness(),
      locationRating: this.reviewLocation(),
      serviceRating: this.reviewService(),
      valueRating: this.reviewValue(),
      comment: this.reviewComment().trim() || undefined
    }).subscribe({
      next: () => {
        this.reviewSubmitting.set(false);
        this.reviewSubmitted.set(true);
        this.alertService.success('Đánh giá của bạn đã được ghi nhận thành công! Cảm ơn bạn đã phản hồi.', 'Gửi đánh giá thành công');
      },
      error: (err) => {
        this.reviewSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.';
        this.reviewError.set(msg);
        this.alertService.error(msg, 'Gửi đánh giá thất bại');
      }
    });
  }

  printConfirmation(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  ngOnDestroy(): void {
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
