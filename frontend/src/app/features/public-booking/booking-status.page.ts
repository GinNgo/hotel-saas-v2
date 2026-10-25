import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
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
          <article class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-200">

            <!-- A. HEADER & TRẠNG THÁI TỔNG QUAN -->
            <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span [class]="getStatusBadgeClass(detail.status)" class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border">
                    <i class="pi text-[11px]" [class]="getStatusIcon(detail.status)"></i>
                    <span>{{ getStatusLabel(detail.status) }}</span>
                  </span>
                  <span class="text-xs text-slate-600 font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                    Mã đơn: {{ detail.confirmationCode }}
                  </span>
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

            <!-- PRINT-ONLY HEADER CHUẨN A4 -->
            <div class="hidden print:block p-6 border-b border-slate-300">
              <div class="flex justify-between items-start">
                <div>
                  <h1 class="text-xl font-bold text-slate-900">
                    {{ isConfirmedStatus(detail.status) ? 'PHIẾU XÁC NHẬN ĐẶT PHÒNG' : 'THÔNG TIN ĐẶT PHÒNG' }}
                  </h1>
                  <p class="text-xs text-slate-600 mt-1">Hệ thống LuxeStay Hospitality Platform</p>
                </div>
                <div class="text-right">
                  <div class="text-xs font-mono font-bold text-slate-800">Mã đơn: {{ detail.confirmationCode }}</div>
                  <div class="text-[11px] font-bold mt-1" [class]="isConfirmedStatus(detail.status) ? 'text-emerald-700' : 'text-amber-700'">
                    Trạng thái: {{ getStatusLabel(detail.status) }}
                    @if (!isConfirmedStatus(detail.status)) {
                      <span> (Chưa xác nhận)</span>
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- B. THỜI HẠN GIỮ PHÒNG (NẾU ĐƠN Ở TRẠNG THÁI CHỜ THANH TOÁN & CÓ DEADLINE) -->
            @if (detail.status === 'PendingPayment' && detail.holdExpiresAtUtc) {
              <div class="px-6 sm:px-8 py-4 bg-amber-50/80 border-b border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <i class="pi pi-clock text-sm"></i>
                  </div>
                  <div>
                    <div class="text-xs font-bold uppercase tracking-wider text-amber-800">Thời hạn giữ phòng tạm thời</div>
                    <p class="text-xs text-amber-700 mt-0.5">
                      Vui lòng hoàn tất khoản thanh toán trước khi thời gian giữ chỗ kết thúc để đơn được kích hoạt.
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2 sm:text-right shrink-0">
                  @if (isHoldExpired()) {
                    <span class="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-extrabold border border-rose-200">
                      Đã hết hạn giữ phòng
                    </span>
                  } @else {
                    <div class="bg-white/90 px-3.5 py-1.5 rounded-xl border border-amber-200 shadow-2xs font-mono font-black text-amber-800 text-sm">
                      {{ formatCountdown(remainingSeconds()) }}
                    </div>
                  }
                </div>
              </div>
            }

            <!-- C. BƯỚC TIẾP THEO THEO TRẠNG THÁI (KHU VỰC HƯỚNG DẪN DUY NHẤT) -->
            <div class="p-6 sm:p-8 pb-0">
              <div class="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
                <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-compass text-sm"></i>
                </div>
                <div class="space-y-0.5">
                  <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-900">Bước tiếp theo</div>
                  <p class="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {{ getNextStepMessage(detail.status) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- D. TRẠNG THÁI NGHIỆP VỤ & HƯỚNG DẪN THỦ TỤC NHẬN PHÒNG CHUẨN BACKEND -->
            @if (detail.status === 'PendingPayment') {
              <!-- GIỮ PHÒNG TẠM THỜI — CHƯA XÁC NHẬN -->
              <div class="mx-6 sm:mx-8 my-6 p-6 sm:p-7 bg-amber-500/10 border border-amber-300/80 rounded-3xl text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div class="space-y-1.5 text-center sm:text-left">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900">
                    <i class="pi pi-info-circle text-[10px]"></i>
                    <span>Đơn giữ phòng tạm thời — Chưa xác nhận</span>
                  </div>
                  <h2 class="text-base sm:text-lg font-bold text-amber-950">
                    Vui lòng hoàn tất đặt cọc để xác nhận đặt phòng
                  </h2>
                  <p class="text-xs text-amber-800 max-w-xl leading-relaxed">
                    Phòng của bạn đang được giữ chỗ tạm thời. Để được xác nhận chính thức và đủ điều kiện làm thủ tục nhận phòng, vui lòng hoàn tất khoản đặt cọc theo quy định trước khi hết thời hạn giữ chỗ.
                  </p>
                </div>
                @if (detail.holdExpiresAtUtc && !isHoldExpired()) {
                  <div class="bg-white/95 px-4 py-3 rounded-2xl border border-amber-200 text-center shrink-0 shadow-2xs">
                    <span class="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Thời gian còn lại</span>
                    <span class="font-mono text-xl font-black text-amber-900 block mt-0.5">{{ formatCountdown(remainingSeconds()) }}</span>
                  </div>
                }
              </div>
            } @else if (detail.status === 'Confirmed') {
              <!-- ĐÃ XÁC NHẬN: HIỂN THỊ MÃ ĐẶT PHÒNG ĐỐI CHIẾU VĂN BẢN (KHÔNG TẠO QR GIẢ LẬP FAST CHECK-IN) -->
              <div class="mx-6 sm:mx-8 my-6 p-6 sm:p-7 bg-slate-900 text-white rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                <div class="space-y-2 text-center sm:text-left">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <i class="pi pi-check-circle text-[10px]"></i>
                    <span>Đặt phòng đã xác nhận</span>
                  </span>
                  <h2 class="text-base sm:text-lg font-bold text-white">Xuất trình Mã đặt phòng tại quầy Lễ tân</h2>
                  <p class="text-xs text-slate-300 max-w-lg leading-relaxed">
                    Đặt phòng của Quý khách đã được xác nhận. Khi đến cơ sở lưu trú, vui lòng xuất trình mã đơn cùng giấy tờ tùy thân hợp lệ cho Lễ tân để làm thủ tục nhận phòng.
                  </p>
                </div>

                <div class="bg-white text-slate-900 px-6 py-4 rounded-2xl text-center shrink-0 border border-slate-200 shadow-md">
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Mã đối chiếu nhận phòng</span>
                  <span class="font-mono text-lg sm:text-xl font-black text-indigo-700 tracking-wider block mt-1 select-all">
                    {{ detail.confirmationCode }}
                  </span>
                </div>
              </div>
            } @else if (detail.status === 'CheckedIn') {
              <!-- ĐÃ NHẬN PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-6 rounded-3xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-home text-lg"></i>
                </div>
                <div class="space-y-1">
                  <h2 class="text-sm sm:text-base font-bold text-blue-950">Quý khách đang trong kỳ lưu trú</h2>
                  <p class="text-xs text-blue-800 leading-relaxed">
                    Thủ tục nhận phòng đã hoàn tất thành công. Chúc Quý khách có kỳ nghỉ thoải mái. Nếu cần hỗ trợ thêm bất kỳ dịch vụ nào, vui lòng liên hệ trực tiếp quầy Lễ tân.
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'CheckedOut') {
              <!-- ĐÃ TRẢ PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-6 rounded-3xl bg-slate-100 border border-slate-200 text-slate-800 flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-check text-lg"></i>
                </div>
                <div class="space-y-1">
                  <h2 class="text-sm sm:text-base font-bold text-slate-900">Kỳ lưu trú đã kết thúc</h2>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    Quý khách đã hoàn tất trả phòng. Cảm ơn Quý khách đã sử dụng dịch vụ tại {{ detail.propertyName }}. Hẹn gặp lại Quý khách ở những chuyến đi tiếp theo!
                  </p>
                </div>

                <div class="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-3">
                  <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <i class="pi pi-info-circle text-sm"></i>
                  </div>
                  <div class="space-y-1">
                    <p class="font-bold text-amber-950">Chức năng đánh giá trực tuyến chưa khả dụng</p>
                    <p class="text-amber-800 leading-relaxed">
                      Hệ thống hiện tại chưa hỗ trợ gửi đánh giá trực tuyến qua API công khai. Cơ sở lưu trú sẽ liên hệ trực tiếp để ghi nhận phản hồi và nâng cao chất lượng dịch vụ.
                    </p>
                  </div>
                </div>
              </div>
            } @else if (detail.status === 'Expired') {
              <!-- ĐÃ HẾT HẠN GIỮ PHÒNG -->
              <div class="mx-6 sm:mx-8 my-6 p-6 rounded-3xl bg-slate-100 border border-slate-300/80 text-slate-800 flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-times-circle text-lg"></i>
                </div>
                <div class="space-y-1">
                  <h2 class="text-sm sm:text-base font-bold text-slate-900">Thời gian giữ phòng đã hết hạn</h2>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    Yêu cầu giữ chỗ này đã hết hiệu lực và không còn khả dụng để làm thủ tục nhận phòng. Quý khách vui lòng kiểm tra phòng trống và đặt lại đơn mới nếu vẫn có nhu cầu lưu trú.
                  </p>
                </div>
              </div>
            } @else if (detail.status === 'Cancelled') {
              <!-- ĐÃ HỦY -->
              <div class="mx-6 sm:mx-8 my-6 p-6 rounded-3xl bg-rose-50/80 border border-rose-200 text-rose-950 flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="pi pi-ban text-lg"></i>
                </div>
                <div class="space-y-1">
                  <h2 class="text-sm sm:text-base font-bold text-rose-950">Đơn đặt phòng đã bị hủy</h2>
                  <p class="text-xs text-rose-800 leading-relaxed">
                    Đơn đặt phòng này đã được hủy trên hệ thống. Quý khách không thể thực hiện thủ tục nhận phòng với mã đơn này.
                  </p>
                </div>
              </div>
            }

            <!-- E. KHÓA PHÒNG ĐIỆN TỬ SMART LOCK PIN (CHỈ HIỂN THỊ KHI ĐƠN ĐÃ XÁC NHẬN/NHẬN PHÒNG & CÓ PIN THẬT - ẨN KHI IN) -->
            @if (detail.smartLockPin && (detail.status === 'Confirmed' || detail.status === 'CheckedIn')) {
              <div class="mx-6 sm:mx-8 mb-6 p-6 sm:p-7 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl border border-slate-800 shadow-inner relative overflow-hidden print:hidden">
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

            <!-- F. BODY DETAILS: THÔNG TIN LƯU TRÚ VÀ CHI TIẾT THANH TOÁN -->
            <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">

              <!-- Cột Trái: Thông tin lưu trú -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i class="pi pi-building text-slate-400"></i>
                  <span>Thông tin lưu trú</span>
                </h3>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Cơ sở lưu trú:</span>
                    <span class="font-bold text-slate-900 text-right">{{ detail.propertyName }}</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Hạng phòng:</span>
                    <span class="font-bold text-slate-900 text-right">{{ detail.roomTypeName }}</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Hình thức thuê:</span>
                    <span class="font-bold text-indigo-700">{{ getRentalTypeLabel(detail.rentalType) }}</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Nhận phòng (Check-in):</span>
                    <span class="font-bold text-slate-900 text-right">
                      {{ formatStayDate(detail.checkInDate, detail.startAtUtc, detail.rentalType) }}
                    </span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Trả phòng (Check-out):</span>
                    <span class="font-bold text-slate-900 text-right">
                      {{ formatStayDate(detail.checkOutDate, detail.endAtUtc, detail.rentalType) }}
                    </span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/50">
                    <span class="text-slate-500">Số lượng khách:</span>
                    <span class="font-semibold text-slate-900">{{ detail.numberOfGuests }} người</span>
                  </div>
                  <div class="flex justify-between pt-1">
                    <span class="text-slate-500">Khách lưu trú (Bảo mật PII):</span>
                    <span class="font-semibold text-slate-900 text-right">
                      {{ detail.maskedGuestName }}
                      @if (detail.maskedGuestEmail) {
                        <span>({{ detail.maskedGuestEmail }})</span>
                      }
                    </span>
                  </div>
                  @if (detail.maskedGuestPhone) {
                    <div class="flex justify-between pt-1">
                      <span class="text-slate-500">Số điện thoại:</span>
                      <span class="font-semibold text-slate-900 font-mono">{{ detail.maskedGuestPhone }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Cột Phải: Hóa đơn & Chi tiết thanh toán (CHỈ HIỂN THỊ CÁC DÒNG TÀI CHÍNH) -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i class="pi pi-credit-card text-slate-400"></i>
                  <span>Chi tiết thanh toán</span>
                </h3>
                <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
                  <div class="flex justify-between text-slate-600">
                    <span>Tổng tiền lưu trú:</span>
                    <span class="font-bold text-slate-900 font-mono text-sm">{{ detail.totalAmount | number:'1.0-0' }} ₫</span>
                  </div>

                  @if (detail.depositRequired > 0) {
                    <div class="flex justify-between text-slate-600">
                      <span>Khoản đặt cọc yêu cầu:</span>
                      <span class="font-mono font-semibold text-amber-700">{{ detail.depositRequired | number:'1.0-0' }} ₫</span>
                    </div>
                  }

                  <div class="flex justify-between text-emerald-800 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 font-semibold">
                    <span>Số tiền đã thanh toán:</span>
                    <span class="font-mono font-bold">{{ detail.paidAmount | number:'1.0-0' }} ₫</span>
                  </div>

                  <div class="flex justify-between text-indigo-700 font-black text-sm pt-2.5 border-t border-slate-100">
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

                  <!-- CỔNG THANH TOÁN TRỰC TUYẾN — KHÓA AN TOÀN VÌ CHƯA ĐỦ ĐIỀU KIỆN GATE (T03) -->
                  @if (detail.status === 'PendingPayment') {
                    <div class="pt-3 border-t border-slate-100 space-y-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-700 flex items-center gap-1.5">
                          <i class="pi pi-credit-card text-indigo-600"></i>
                          <span>Thanh toán trực tuyến (VNPay Sandbox)</span>
                        </span>
                        <span class="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                          Chưa khả dụng
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-500 leading-relaxed">
                        Kênh thanh toán trực tuyến qua VNPay đang chờ phê duyệt cấu hình sandbox từ Quản trị viên. Quý khách vui lòng liên hệ trực tiếp cơ sở lưu trú để được hướng dẫn thanh toán cọc.
                      </p>
                      <button
                        type="button"
                        (click)="payWithVnpay()"
                        disabled
                        class="w-full py-2.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs cursor-not-allowed flex items-center justify-center gap-2"
                        title="Chức năng thanh toán trực tuyến hiện chưa khả dụng"
                      >
                        <i class="pi pi-lock text-xs"></i>
                        <span>Thanh toán qua VNPay Sandbox (Tạm khóa)</span>
                      </button>
                    </div>
                  }
                </div>

                <!-- Bảng phân rã chi phí nếu có -->
                @if (detail.breakdown && detail.breakdown.length > 0) {
                  <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bảng phân rã chi phí</div>
                    @for (item of detail.breakdown; track item.description) {
                      <div class="flex justify-between text-slate-600 py-0.5">
                        <span>{{ item.description }} @if (item.quantity > 1) { <span class="text-slate-400">(x{{ item.quantity }})</span> }</span>
                        <span class="font-mono font-medium text-slate-800">{{ item.amount | number:'1.0-0' }} ₫</span>
                      </div>
                    }
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

  private fetchGeneration = 0;
  private timerInterval?: ReturnType<typeof setInterval>;
  private copyTimeout?: ReturnType<typeof setTimeout>;
  private copyTokenSessionId = 0;
  private copyPinSessionId = 0;
  private isDestroyed = false;
  private lastFetchedToken = '';
  private lastRouteToken: string | undefined = undefined;

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      const b = this.booking();
      if (b && b.status === 'PendingPayment' && b.holdExpiresAtUtc) {
        this.startHoldCountdown(b.holdExpiresAtUtc, b.status);
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
    this.copyPinSessionId++;
    this.booking.set(null);
    this.searchError.set(null);
    this.tokenError.set('');
    this.clearTimer();
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    this.isCopied.set(false);
    this.isSearching.set(false);
    this.searchToken = '';
    this.lastFetchedToken = '';
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
    this.copyTokenSessionId++;
    this.copyPinSessionId++;
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
    this.isCopied.set(false);
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
        if (b.status === 'PendingPayment' && b.holdExpiresAtUtc) {
          this.startHoldCountdown(b.holdExpiresAtUtc, b.status);
        }
      },
      error: (err) => {
        if (currentGen !== this.fetchGeneration) return; // Guard: request A đến trễ không đè B
        this.isSearching.set(false);
        this.booking.set(null);
        this.clearTimer();
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

    if (status === 'Expired') {
      this.remainingSeconds.set(0);
      this.isHoldExpired.set(true);
      return;
    }

    const expireTime = holdExpiresAtUtc ? new Date(holdExpiresAtUtc).getTime() : NaN;
    if (!Number.isFinite(expireTime)) {
      this.remainingSeconds.set(0);
      this.isHoldExpired.set(false);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      this.remainingSeconds.set(diff);
      if (diff <= 0) {
        this.isHoldExpired.set(true);
        this.clearTimer();
      } else {
        this.isHoldExpired.set(false);
      }
    };

    tick();
    if (this.remainingSeconds() > 0 && !this.isHoldExpired()) {
      this.timerInterval = setInterval(tick, 1000);
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

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.copyTokenSessionId++;
    this.copyPinSessionId++;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.clearTimer();
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = undefined;
    }
  }
}

export { BookingStatusPage as BookingStatusPageComponent };
