import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService, GetPaymentsFilter } from '../../core/services/payment.service';
import {
  PaymentDto,
  PaymentSummaryDto,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  FolioDto,
  ShiftReportDto,
  ShiftType,
  SHIFT_TYPE_LABELS
} from '../../core/models/payment.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

/**
 * Helper: Lấy chuỗi ngày YYYY-MM-DD theo múi giờ Việt Nam (UTC+7).
 * Sử dụng mốc thời gian thực quy đổi sang giờ Việt Nam, không phụ thuộc múi giờ trình duyệt máy khách.
 */
export function getTodayVietnamDateString(baseDate: Date = new Date()): string {
  const utcMs = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
  const vnDate = new Date(utcMs + (7 * 3600000));
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Helper: Định dạng timestamp ISO sang chuỗi Ngày Giờ theo múi giờ Việt Nam (UTC+7) (dd/MM/yyyy HH:mm:ss Giờ VN).
 */
export function formatUtcDateTimeString(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} UTC`;
  } catch {
    return isoString;
  }
}

/**
 * Trang Quản lý Thu ngân & Nhật ký Giao dịch (CHỈ ĐỌC - READ-ONLY)
 *
 * Ranh giới & Quy tắc nghiệp vụ cốt lõi:
 * 1. Phân định ranh giới 2 luồng dữ liệu độc lập:
 *    - Luồng 1 (Tổng kết Thực thu trong ngày): Tính theo ngày phát sinh tại Việt Nam (UTC+7),
 *      lọc các giao dịch Completed căn cứ trên PaidAtUtc.
 *    - Luồng 2 (Nhật ký Giao dịch): Lọc theo ngày tạo CreatedAtUtc căn cứ trên mốc giờ chuẩn UTC.
 *    - Giao diện có Disclaimer rõ ràng; không khẳng định bảng giao dịch khớp dòng với KPI ca trực.
 * 2. Fail-closed khi thiếu chi nhánh: Không gửi HTTP request khi activePropertyId là null/rỗng.
 * 3. Chống phản hồi muộn (Stale-Response Rejection): Khi đổi chi nhánh, lập tức hủy/bỏ qua kết quả cũ.
 * 4. Trạng thái tải/lỗi độc lập: Lỗi ở một luồng không làm ảnh hưởng luồng còn lại; có nút Thử lại (Retry) riêng.
 * 5. Tuân thủ phân quyền PAYMENTS:Read (Action: 1).
 */
@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, EmptyStateComponent, PaginationComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Thu ngân & Nhật ký Giao dịch</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Chỉ đọc (Read-Only)
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi tổng kết thực thu trong ngày và tra cứu lịch sử các giao dịch ghi nhận tại quầy chi nhánh.
          </p>
        </div>

        <!-- Property Context Indicator -->
        <div class="flex items-center gap-2">
          @if (activePropertyId()) {
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 text-xs text-slate-700 font-medium border border-slate-200/70 shadow-2xs">
              <i class="pi pi-building text-emerald-600"></i>
              <span>{{ activePropertyName() || 'Chi nhánh hiện hành' }}</span>
            </div>
          } @else {
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-xs text-amber-800 font-medium border border-amber-200 shadow-2xs">
              <i class="pi pi-exclamation-triangle text-amber-600"></i>
              <span>Chưa chọn cơ sở</span>
            </div>
          }
        </div>
      </div>

      <!-- Permission Denied State -->
      @if (!canReadPayments() || isAccessDenied()) {
        <app-empty-state
          [iconClass]="'pi pi-shield'"
          [title]="'Không có quyền truy cập'"
          [description]="accessDeniedMessage()"
        ></app-empty-state>
      } @else if (!activePropertyId()) {
        <app-empty-state
          [iconClass]="'pi pi-building'"
          [title]="'Vui lòng chọn cơ sở hoạt động'"
          [description]="'Hệ thống yêu cầu xác định chi nhánh hoạt động để tra cứu dữ liệu thu ngân. Hãy chọn chi nhánh từ bộ chuyển ngữ cảnh ở thanh điều hướng trên cùng.'"
        ></app-empty-state>
      } @else {
        <!-- Mandatory Disclaimer Banner -->
        <div class="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 leading-relaxed shadow-2xs">
          <div class="flex items-start gap-2.5">
            <i class="pi pi-info-circle text-amber-700 text-base mt-0.5 shrink-0"></i>
            <div>
              <span class="font-semibold">Lưu ý phân định dữ liệu thu ngân:</span>
              Bảng <span class="font-medium">"Tổng kết Thực thu trong ngày"</span> thống kê các khoản thanh toán đã hoàn tất (Completed) theo ngày thanh toán thực tế (múi giờ Việt Nam UTC+7).
              Bảng <span class="font-medium">"Nhật ký Giao dịch"</span> bên dưới truy xuất bản ghi theo thời điểm tạo (múi giờ chuẩn UTC).
              Hai luồng dữ liệu độc lập phục vụ kiểm tra riêng biệt và không cấu thành bảng kê đối soát quỹ tiền mặt khớp dòng.
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- STREAM 1: TỔNG KẾT THỰC THU TRONG NGÀY (GIỜ VIỆT NAM - UTC+7)              -->
        <!-- ========================================================================= -->
        <section class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h2 class="text-base sm:text-lg font-bold text-slate-800">
                  Tổng kết Thực thu trong ngày (Giờ Việt Nam - UTC+7)
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Thống kê các giao dịch hoàn tất (Completed) căn cứ theo mốc thanh toán trong ngày giờ Việt Nam.
              </p>
            </div>

            <!-- Date Selector & Refresh -->
            <div class="flex items-center gap-2">
              <label for="summaryDateInput" class="text-xs text-slate-500 font-medium">Ngày (VN):</label>
              <p-datepicker
                inputId="summaryDateInput"
                [(ngModel)]="summaryDateObj"
                (ngModelChange)="onSummaryDateObjChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                [maxDate]="todayDate"
                appendTo="body"
                [inputStyleClass]="'text-xs'"
              />
              <button
                type="button"
                (click)="loadSummary()"
                [disabled]="isLoadingSummary()"
                title="Làm mới tổng kết"
                class="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                <i class="pi pi-refresh text-sm" [class.animate-spin]="isLoadingSummary()"></i>
              </button>
            </div>
          </div>

          <!-- Loading State for Summary -->
          @if (isLoadingSummary()) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4 animate-pulse">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="h-28 rounded-xl bg-slate-100/80 border border-slate-200/60"></div>
              }
            </div>
          }

          <!-- Error State for Summary -->
          @if (!isLoadingSummary() && summaryError()) {
            <div class="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0"></i>
                <span>{{ summaryError() }}</span>
              </div>
              <button
                type="button"
                (click)="retrySummary()"
                class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Data Content for Summary -->
          @if (!isLoadingSummary() && !summaryError()) {
            @if (summary(); as s) {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- Total Collected KPI (Hero Card) -->
                <div class="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-4 shadow-2xs space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Tổng Thực Thu</span>
                    <i class="pi pi-wallet text-emerald-600 text-base"></i>
                  </div>
                  <div class="text-xl sm:text-2xl font-extrabold text-emerald-900 tracking-tight">
                    {{ s.totalCollected | number:'1.0-0' }} <span class="text-xs font-semibold text-emerald-700">VNĐ</span>
                  </div>
                  <div class="text-[11px] text-emerald-700 flex items-center gap-1 pt-1">
                    <i class="pi pi-check-circle text-[10px]"></i>
                    <span>{{ s.completedCount }} giao dịch hoàn tất</span>
                  </div>
                </div>

                <!-- Cash KPI Card -->
                <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Tiền Mặt</span>
                    <i class="pi pi-money-bill text-emerald-600 text-base"></i>
                  </div>
                  <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    {{ s.cashCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                  </div>
                  <div class="text-[11px] text-slate-400 pt-1">
                    Thực thu tiền mặt tại quầy
                  </div>
                </div>

                <!-- Bank Transfer KPI Card -->
                <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Chuyển Khoản</span>
                    <i class="pi pi-arrow-right-arrow-left text-blue-600 text-base"></i>
                  </div>
                  <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    {{ s.bankTransferCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                  </div>
                  <div class="text-[11px] text-slate-400 pt-1">
                    Giao dịch qua ngân hàng
                  </div>
                </div>

                <!-- Credit Card KPI Card -->
                <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Thẻ Tín Dụng</span>
                    <i class="pi pi-credit-card text-purple-600 text-base"></i>
                  </div>
                  <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    {{ s.creditCardCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                  </div>
                  <div class="text-[11px] text-slate-400 pt-1">
                    Thanh toán qua POS/Thẻ
                  </div>
                </div>
              </div>
            } @else {
              <div class="py-8 text-center text-xs text-slate-400">
                Chưa có dữ liệu tổng kết cho ngày đã chọn.
              </div>
            }
          }
        </section>

        <!-- ========================================================================= -->
        <!-- STREAM 1B: BÁO CÁO CA TRỰC THU NGÂN (SHIFT CASHIER AUDIT REPORT)            -->
        <!-- ========================================================================= -->
        <section class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h2 class="text-base sm:text-lg font-bold text-slate-800">
                  Báo cáo thu theo ca
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Thống kê các khoản thanh toán phát sinh theo các khung ca làm việc mặc định (06–14, 14–22, 22–06 giờ VN UTC+7 — quy ước cho bản demo, chưa bao gồm kiểm tiền vật lý tại két).
              </p>
            </div>

            <!-- Shift Date & Shift Selector -->
            <div class="flex flex-wrap items-center gap-2">
              <label for="shiftDateInput" class="text-xs text-slate-500 font-medium">Ngày ca:</label>
              <p-datepicker
                inputId="shiftDateInput"
                [(ngModel)]="shiftDateObj"
                (ngModelChange)="onShiftDateObjChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                [maxDate]="todayDate"
                appendTo="body"
                [inputStyleClass]="'text-xs'"
              />
              <button
                type="button"
                (click)="loadShiftReport()"
                [disabled]="isLoadingShiftReport()"
                title="Làm mới báo cáo ca"
                class="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                <i class="pi pi-refresh text-sm" [class.animate-spin]="isLoadingShiftReport()"></i>
              </button>
            </div>
          </div>

          <!-- Shift Type Buttons -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-slate-600 mr-1">Chọn ca trực:</span>
            <button
              type="button"
              (click)="selectShiftType(ShiftType.Morning)"
              [class]="selectedShiftType() === ShiftType.Morning ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Ca 1 - Sáng (06:00 - 14:00)
            </button>
            <button
              type="button"
              (click)="selectShiftType(ShiftType.Afternoon)"
              [class]="selectedShiftType() === ShiftType.Afternoon ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Ca 2 - Chiều (14:00 - 22:00)
            </button>
            <button
              type="button"
              (click)="selectShiftType(ShiftType.Night)"
              [class]="selectedShiftType() === ShiftType.Night ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Ca 3 - Đêm (22:00 - 06:00)
            </button>
          </div>

          <!-- Loading State for Shift Report -->
          @if (isLoadingShiftReport()) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4 animate-pulse">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="h-24 rounded-xl bg-slate-100/80 border border-slate-200/60"></div>
              }
            </div>
          }

          <!-- Error State for Shift Report -->
          @if (!isLoadingShiftReport() && shiftReportError()) {
            <div class="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0"></i>
                <span>{{ shiftReportError() }}</span>
              </div>
              <button
                type="button"
                (click)="loadShiftReport()"
                class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Data Content for Shift Report -->
          @if (!isLoadingShiftReport() && !shiftReportError()) {
            @if (shiftReport(); as sr) {
              <div class="space-y-4">
                <!-- Shift KPIs -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div class="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 shadow-2xs space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-amber-800 uppercase tracking-wider">Tổng Thu Theo Ca</span>
                      <i class="pi pi-calculator text-amber-600 text-base"></i>
                    </div>
                    <div class="text-xl sm:text-2xl font-extrabold text-amber-900 tracking-tight">
                      {{ sr.totalCollected | number:'1.0-0' }} <span class="text-xs font-semibold text-amber-700">VNĐ</span>
                    </div>
                    <div class="text-[11px] text-amber-700 flex items-center gap-1 pt-1">
                      <i class="pi pi-check-circle text-[10px]"></i>
                      <span>{{ sr.completedCount }} giao dịch trong ca</span>
                    </div>
                  </div>

                  <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Tiền Mặt Thu Trong Ca</span>
                      <i class="pi pi-money-bill text-emerald-600 text-base"></i>
                    </div>
                    <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                      {{ sr.cashCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1">Giao dịch tiền mặt ghi nhận hệ thống</div>
                  </div>

                  <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Chuyển Khoản Thu Trong Ca</span>
                      <i class="pi pi-arrow-right-arrow-left text-blue-600 text-base"></i>
                    </div>
                    <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                      {{ sr.bankTransferCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1">Giao dịch ngân hàng nhận trong ca</div>
                  </div>

                  <div class="rounded-xl bg-white border border-slate-200/80 p-4 shadow-2xs space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Thẻ / POS Thu Trong Ca</span>
                      <i class="pi pi-credit-card text-purple-600 text-base"></i>
                    </div>
                    <div class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                      {{ sr.creditCardCollected | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1">Giao dịch thẻ POS ghi nhận hệ thống</div>
                  </div>
                </div>

                <!-- Shift Transactions Itemized List for Audit -->
                @if (sr.payments && sr.payments.length > 0) {
                  <div class="rounded-xl border border-slate-200/80 overflow-hidden">
                    <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span class="font-bold text-slate-700 flex items-center gap-1.5">
                        <i class="pi pi-list text-amber-600"></i>
                        <span>Bảng kê các giao dịch trong {{ sr.shiftName }}:</span>
                      </span>
                      <span class="text-slate-500 font-mono">{{ sr.payments.length }} bút toán</span>
                    </div>
                    <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      @for (p of sr.payments; track p.id) {
                        <div class="p-3 text-xs flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                          <div class="flex items-center gap-2">
                            <span [class]="getMethodBadgeClass(p.method)">{{ p.methodName || getMethodLabel(p.method) }}</span>
                            <span class="font-mono text-[11px] text-slate-400">{{ formatUtc(p.createdAtUtc) }}</span>
                            @if (p.reservationId) {
                              <span class="text-[11px] font-mono text-indigo-600">Mã đơn: {{ p.reservationId.substring(0, 8) }}...</span>
                            }
                          </div>
                          <div class="flex items-center gap-3">
                            @if (p.transactionRef) {
                              <span class="text-[11px] text-slate-500 font-mono">Ref: {{ p.transactionRef }}</span>
                            }
                            <span class="font-bold text-slate-800">+{{ p.amount | number:'1.0-0' }} VNĐ</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                    Chưa có giao dịch thanh toán nào phát sinh trong {{ sr.shiftName }}.
                  </div>
                }
              </div>
            }
          }
        </section>

        <!-- ========================================================================= -->
        <!-- FOLIO & THU TIỀN TẠI QUẦY (CASHIER & FOLIO BILLING)                       -->
        <!-- ========================================================================= -->
        <section id="folio-section" class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h2 class="text-base sm:text-lg font-bold text-slate-800">
                  Hóa đơn Folio & Thu tiền tại quầy
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Tra cứu bảng kê công nợ đơn đặt phòng, thu tiền mặt hoặc chuyển khoản VietQR và xuất phiếu thu.
              </p>
            </div>

            <!-- Folio Search Bar -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <div class="relative flex-1 sm:w-72">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  [(ngModel)]="searchReservationId"
                  (keyup.enter)="loadFolio()"
                  placeholder="Nhập mã đơn đặt phòng (UUID)..."
                  class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <button
                type="button"
                (click)="loadFolio()"
                [disabled]="!searchReservationId.trim() || isLoadingFolio()"
                class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
              >
                @if (isLoadingFolio()) {
                  <i class="pi pi-spin pi-spinner text-xs"></i>
                } @else {
                  <i class="pi pi-search text-xs"></i>
                }
                <span>Tra cứu</span>
              </button>
            </div>
          </div>

          <!-- Folio Error Alert -->
          @if (folioError()) {
            <div class="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0"></i>
                <span>{{ folioError() }}</span>
              </div>
              <button
                type="button"
                (click)="loadFolio()"
                class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Folio Content -->
          @if (folio(); as f) {
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Left Column: Folio Financial Breakdown (7 cols) -->
              <div class="lg:col-span-7 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-200/70">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-sm text-slate-800">Mã: {{ f.confirmationCode || f.reservationId.substring(0, 8) }}</span>
                    @if (f.isFullyPaid) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        <i class="pi pi-check mr-1 text-[9px]"></i> Đã tất toán
                      </span>
                    } @else {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                        <i class="pi pi-clock mr-1 text-[9px]"></i> Còn nợ
                      </span>
                    }
                  </div>
                  <span class="text-xs text-slate-500 font-medium">
                    Phòng: <strong class="text-slate-800">{{ f.roomNumber || 'Chưa gán' }}</strong> ({{ f.roomTypeName || 'Tiêu chuẩn' }})
                  </span>
                </div>

                <!-- Guest & Stay details -->
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span class="text-slate-400 block text-[11px]">Khách lưu trú:</span>
                    <span class="font-semibold text-slate-800">{{ f.guestName }}</span>
                    @if (f.guestPhone) {
                      <span class="text-slate-500 block text-[11px]">{{ f.guestPhone }}</span>
                    }
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[11px]">Thời gian lưu trú:</span>
                    <span class="text-slate-700 font-mono text-[11px]">{{ f.checkInDate }} → {{ f.checkOutDate }}</span>
                  </div>
                </div>

                <!-- Financial Statement Summary with Itemized Breakdown -->
                <div class="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs">
                  <div class="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span class="flex items-center gap-1.5">
                      <i class="pi pi-list text-indigo-600 text-xs"></i>
                      <span>Chi tiết các khoản phí (Itemized Charges):</span>
                    </span>
                    @if (f.depositRequired && f.depositRequired > 0) {
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Cọc yêu cầu: {{ f.depositRequired | number:'1.0-0' }} VNĐ
                        </span>
                        @if (f.depositPaid !== null && f.depositPaid !== undefined) {
                          <span class="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Cọc đã thực thu: {{ f.depositPaid | number:'1.0-0' }} VNĐ
                          </span>
                        } @else {
                          <span class="text-[11px] font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300" title="Đã có thanh toán nhưng không có giao dịch gắn thẻ cọc có cấu trúc [PURPOSE:DEPOSIT]">
                            Cọc đã thực thu: Chưa xác định
                          </span>
                        }
                      </div>
                    }
                  </div>

                  <!-- Itemized line items if available from snapshot -->
                  @if (f.breakdown && f.breakdown.length > 0) {
                    <div class="space-y-1.5 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 text-[11px]">
                      @for (item of f.breakdown; track $index) {
                        <div class="flex justify-between items-center text-slate-600">
                          <span class="truncate max-w-[240px]" [title]="item.description">{{ item.description }}</span>
                          <span class="font-mono font-medium text-slate-700">{{ item.amount | number:'1.0-0' }} VNĐ</span>
                        </div>
                      }
                    </div>
                  }

                  <!-- Subtotal rows -->
                  <div class="space-y-1 pt-1 text-slate-600">
                    @if (f.baseRoomAmount !== null && f.baseRoomAmount !== undefined) {
                      <div class="flex justify-between items-center">
                        <span>Tiền phòng gốc:</span>
                        <span class="font-medium text-slate-800">{{ f.baseRoomAmount | number:'1.0-0' }} VNĐ</span>
                      </div>
                    } @else {
                      <div class="flex justify-between items-center text-slate-400 italic text-[11px]">
                        <span>Phân bổ chi tiết:</span>
                        <span>Chưa xác định (Không có dữ liệu breakdown cấu trúc)</span>
                      </div>
                    }
                    @if (f.surchargesAmount !== null && f.surchargesAmount !== undefined && f.surchargesAmount > 0) {
                      <div class="flex justify-between items-center text-amber-700">
                        <span>Phụ thu nhận sớm / trả muộn / lễ:</span>
                        <span class="font-medium">+{{ f.surchargesAmount | number:'1.0-0' }} VNĐ</span>
                      </div>
                    }
                    @if (f.servicesAmount !== null && f.servicesAmount !== undefined && f.servicesAmount > 0) {
                      <div class="flex justify-between items-center text-blue-700">
                        <span>Dịch vụ & Minibar:</span>
                        <span class="font-medium">+{{ f.servicesAmount | number:'1.0-0' }} VNĐ</span>
                      </div>
                    }
                    <div class="flex justify-between items-center font-semibold text-slate-800 pt-1 border-t border-slate-100">
                      <span>Tổng cộng tiền phòng & phụ phí:</span>
                      <span>{{ f.totalAmount | number:'1.0-0' }} VNĐ</span>
                    </div>
                    <div class="flex justify-between items-center text-emerald-700 font-medium">
                      <span>Đã thanh toán (Chỉ trừ các giao dịch hoàn tất):</span>
                      <span>- {{ f.paidAmount | number:'1.0-0' }} VNĐ</span>
                    </div>
                  </div>

                  <div class="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold">
                    <span class="text-slate-800">Số dư còn phải thu:</span>
                    <span [class]="f.remainingBalance > 0 ? 'text-rose-600 text-base font-extrabold' : 'text-emerald-600'">
                      {{ f.remainingBalance | number:'1.0-0' }} VNĐ
                    </span>
                  </div>
                </div>

                <!-- Prior payments in this Folio -->
                @if (f.payments && f.payments.length > 0) {
                  <div>
                    <h4 class="text-xs font-semibold text-slate-700 mb-2">Lịch sử thanh toán đơn này:</h4>
                    <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      @for (p of f.payments; track p.id) {
                        <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-100">
                          <div class="flex items-center gap-2">
                            <span [class]="getMethodBadgeClass(p.method)">{{ p.methodName || getMethodLabel(p.method) }}</span>
                            <span class="font-mono text-[11px] text-slate-400">{{ formatUtc(p.createdAtUtc) }}</span>
                          </div>
                          <span class="font-bold text-slate-800">+{{ p.amount | number:'1.0-0' }} VNĐ</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Right Column: Cashier Collection Form (5 cols) -->
              <div class="lg:col-span-5 rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4 sm:p-5 space-y-4">
                <div class="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <h3 class="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <i class="pi pi-credit-card text-indigo-600"></i>
                    Thu tiền tại quầy
                  </h3>
                  @if (f.remainingBalance > 0) {
                    <button
                      type="button"
                      (click)="fillRemainingBalance(f.remainingBalance)"
                      class="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 underline transition-colors"
                    >
                      Điền toàn bộ số dư
                    </button>
                  }
                </div>

                <!-- Payment Form Fields -->
                <div class="space-y-3 text-xs">
                  <!-- Amount -->
                  <div>
                    <label class="block text-[11px] font-medium text-slate-600 mb-1">Số tiền thu (VNĐ):</label>
                    <div class="relative">
                      <input
                        type="number"
                        [(ngModel)]="paymentAmount"
                        min="1000"
                        placeholder="Nhập số tiền..."
                        class="w-full pl-3 pr-12 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">VNĐ</span>
                    </div>
                  </div>

                  <!-- Method Selector -->
                  <div>
                    <label class="block text-[11px] font-medium text-slate-600 mb-1">Phương thức thanh toán:</label>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        (click)="paymentMethod.set(PaymentMethod.Cash)"
                        [class]="paymentMethod() === PaymentMethod.Cash ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold shadow-2xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                        class="p-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <i class="pi pi-money-bill"></i>
                        <span>Tiền mặt</span>
                      </button>
                      <button
                        type="button"
                        (click)="paymentMethod.set(PaymentMethod.BankTransfer)"
                        [class]="paymentMethod() === PaymentMethod.BankTransfer ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold shadow-2xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                        class="p-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <i class="pi pi-qrcode"></i>
                        <span>VietQR / CK</span>
                      </button>
                    </div>
                  </div>

                  <!-- Bank Transfer Guidance (No unverified fake bank accounts) -->
                  @if (paymentMethod() === PaymentMethod.BankTransfer) {
                    <div class="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 space-y-1.5 shadow-2xs">
                      <div class="flex items-start gap-1.5">
                        <i class="pi pi-info-circle text-amber-600 text-xs mt-0.5 shrink-0"></i>
                        <span class="text-[11px] font-semibold">Chưa có cấu hình VietQR chính thức:</span>
                      </div>
                      <p class="text-[10px] text-amber-800 leading-relaxed">
                        Hệ thống không hiển thị mã QR chuyển khoản do cơ sở chưa thiết lập tài khoản ngân hàng thụ hưởng được nhóm xác nhận.
                        Thu ngân vui lòng hướng dẫn khách chuyển khoản theo số tài khoản do quản lý chi nhánh chỉ định và đối chiếu số tiền thực nhận.
                      </p>
                    </div>
                  }

                  <!-- Transaction Ref -->
                  <div>
                    <label class="block text-[11px] font-medium text-slate-600 mb-1">
                      Mã tham chiếu / Ghi chú:
                      @if (paymentMethod() === PaymentMethod.BankTransfer) {
                        <span class="text-rose-600 font-bold">* (Bắt buộc với Chuyển khoản)</span>
                      }
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="paymentTransactionRef"
                      [placeholder]="paymentMethod() === PaymentMethod.BankTransfer ? 'Nhập mã giao dịch ngân hàng (FT... / Ref ID)...' : 'Mã GD / số biên lai (tùy chọn)...'"
                      class="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <!-- Bank Transfer Confirmation Checkbox -->
                  @if (paymentMethod() === PaymentMethod.BankTransfer) {
                    <label class="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 cursor-pointer">
                      <input
                        type="checkbox"
                        [checked]="isBankTransferConfirmed()"
                        (change)="toggleBankTransferConfirmed()"
                        class="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Thu ngân xác nhận tiền <b>đã vào tài khoản ngân hàng</b> chi nhánh và đã kiểm tra mã giao dịch.</span>
                    </label>
                  }

                  <!-- Deposit Payment Tag Checkbox -->
                  <label class="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="isDepositPayment()"
                      (change)="toggleDepositPayment()"
                      class="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Gắn thẻ khoản này là <b>Tiền cọc đặt phòng</b> (Hệ thống sẽ ghi nhận vào Cọc đã thực thu của Folio).</span>
                  </label>

                  <!-- Submit Payment Button -->
                  <button
                    type="button"
                    (click)="submitPayment(f.reservationId)"
                    [disabled]="paymentAmount <= 0 || isSubmittingPayment() || (paymentMethod() === PaymentMethod.BankTransfer && (!paymentTransactionRef.trim() || !isBankTransferConfirmed()))"
                    class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-2xs disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    @if (isSubmittingPayment()) {
                      <i class="pi pi-spin pi-spinner text-xs"></i>
                      <span>Đang xử lý giao dịch...</span>
                    } @else {
                      <i class="pi pi-check-circle text-xs"></i>
                      <span>Xác nhận thu {{ paymentAmount | number:'1.0-0' }} VNĐ</span>
                    }
                  </button>
                </div>
              </div>
            </div>
          } @else if (!isLoadingFolio() && !folioError()) {
            <div class="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <i class="pi pi-file-o text-xl block mb-1 text-slate-300"></i>
              Nhập mã đơn đặt phòng phía trên hoặc bấm nút <span class="font-medium text-slate-600">"Xem Folio"</span> tại bảng nhật ký để tra cứu công nợ.
            </div>
          }
        </section>

        <!-- ========================================================================= -->
        <!-- STREAM 2: NHẬT KÝ GIAO DỊCH (THỜI GIAN GHI NHẬN - GIỜ UTC)                  -->
        <!-- ========================================================================= -->
        <section class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h2 class="text-base sm:text-lg font-bold text-slate-800">
                  Nhật ký Giao dịch (Thời gian ghi nhận - Giờ UTC)
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Danh sách các bản ghi thanh toán được tạo trên hệ thống theo mốc giờ chuẩn quốc tế UTC.
              </p>
            </div>

            <!-- Page Count & Info -->
            <div class="text-xs text-slate-500">
              Tổng số: <span class="font-semibold text-slate-800">{{ totalCount() }}</span> bản ghi
            </div>
          </div>

          <!-- Filter Toolbar -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60">
            <!-- Filter: Date From -->
            <div>
              <label for="filterDateFromInput" class="block text-[11px] font-medium text-slate-500 mb-1">Từ ngày:</label>
              <p-datepicker
                inputId="filterDateFromInput"
                [(ngModel)]="filterDateFromObj"
                (ngModelChange)="onFilterDateFromChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                appendTo="body"
                placeholder="Chọn ngày"
                [inputStyleClass]="'w-full text-xs'"
              />
            </div>

            <!-- Filter: Date To -->
            <div>
              <label for="filterDateToInput" class="block text-[11px] font-medium text-slate-500 mb-1">Đến ngày:</label>
              <p-datepicker
                inputId="filterDateToInput"
                [(ngModel)]="filterDateToObj"
                (ngModelChange)="onFilterDateToChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                appendTo="body"
                placeholder="Chọn ngày"
                [inputStyleClass]="'w-full text-xs'"
              />
            </div>

            <!-- Filter: Payment Method -->
            <div>
              <label for="filterMethodSelect" class="block text-[11px] font-medium text-slate-500 mb-1">Phương thức:</label>
              <select
                id="filterMethodSelect"
                [(ngModel)]="filterMethod"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option [ngValue]="null">Tất cả phương thức</option>
                <option [ngValue]="PaymentMethod.Cash">Tiền mặt</option>
                <option [ngValue]="PaymentMethod.BankTransfer">Chuyển khoản</option>
                <option [ngValue]="PaymentMethod.CreditCard">Thẻ tín dụng</option>
                <option [ngValue]="PaymentMethod.VNPay">VNPay</option>
              </select>
            </div>

            <!-- Filter: Payment Status -->
            <div>
              <label for="filterStatusSelect" class="block text-[11px] font-medium text-slate-500 mb-1">Trạng thái:</label>
              <select
                id="filterStatusSelect"
                [(ngModel)]="filterStatus"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option [ngValue]="null">Tất cả trạng thái</option>
                <option [ngValue]="PaymentStatus.Completed">Thành công</option>
                <option [ngValue]="PaymentStatus.Processing">Đang xử lý</option>
                <option [ngValue]="PaymentStatus.Pending">Chờ xử lý</option>
                <option [ngValue]="PaymentStatus.Failed">Thất bại</option>
                <option [ngValue]="PaymentStatus.Cancelled">Đã hủy</option>
                <option [ngValue]="PaymentStatus.Refunded">Đã hoàn tiền</option>
              </select>
            </div>

            <!-- Reset Button -->
            <div class="flex items-end">
              <button
                type="button"
                (click)="resetFilters()"
                class="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
              >
                <i class="pi pi-filter-slash mr-1"></i> Đặt lại
              </button>
            </div>
          </div>

          <!-- Loading State for Payments -->
          @if (isLoadingPayments()) {
            <div class="space-y-2 py-6 animate-pulse">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="h-10 rounded-lg bg-slate-100/80"></div>
              }
            </div>
          }

          <!-- Error State for Payments -->
          @if (!isLoadingPayments() && paymentsError()) {
            <div class="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0"></i>
                <span>{{ paymentsError() }}</span>
              </div>
              <button
                type="button"
                (click)="retryPayments()"
                class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Empty State for Payments -->
          @if (!isLoadingPayments() && !paymentsError() && payments().length === 0) {
            <app-empty-state
              [iconClass]="'pi pi-inbox'"
              [title]="'Không có giao dịch nào'"
              [description]="'Không tìm thấy bản ghi thanh toán nào khớp với tiêu chí tìm kiếm hoặc dải ngày đã chọn.'"
            ></app-empty-state>
          }

          <!-- Table Content for Payments -->
          @if (!isLoadingPayments() && !paymentsError() && payments().length > 0) {
            <!-- Mobile Card Layout (shown on sm and below) -->
            <div class="space-y-3 md:hidden">
              @for (p of payments(); track p.id) {
                <div class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-sm text-slate-900">
                      {{ p.amount | number:'1.0-0' }} <span class="text-xs font-normal text-slate-500">{{ p.currency || 'VND' }}</span>
                    </span>
                    <span [class]="getStatusBadgeClass(p.status)">
                      {{ p.statusName || getStatusLabel(p.status) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span [class]="getMethodBadgeClass(p.method)">
                      {{ p.methodName || getMethodLabel(p.method) }}
                    </span>
                    <span class="text-[11px] text-slate-400 font-mono">
                      {{ formatUtc(p.createdAtUtc) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span class="font-mono" [title]="p.id">Mã: {{ p.id.substring(0, 8) }}...</span>
                    @if (p.transactionRef) {
                      <span class="font-mono">Ref: {{ p.transactionRef }}</span>
                    }
                  </div>
                  @if (p.notes) {
                    <p class="text-[11px] text-slate-400 truncate">{{ p.notes }}</p>
                  }
                </div>
              }
            </div>

            <!-- Desktop Table Layout (hidden on mobile) -->
            <div class="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs hidden md:block">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th class="py-3 px-3.5">Mã Giao Dịch</th>
                    <th class="py-3 px-3.5">Đơn Đặt Phòng</th>
                    <th class="py-3 px-3.5">Số Tiền</th>
                    <th class="py-3 px-3.5">Phương Thức</th>
                    <th class="py-3 px-3.5">Trạng Thái</th>
                    <th class="py-3 px-3.5">Mã Tham Chiếu</th>
                    <th class="py-3 px-3.5">Thời Gian Tạo (Giờ VN)</th>
                    <th class="py-3 px-3.5">Ghi Chú</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                  @for (p of payments(); track p.id) {
                    <tr class="hover:bg-slate-50/60 transition-colors">
                      <!-- Payment ID -->
                      <td class="py-3 px-3.5 font-mono text-[11px] text-slate-600" [title]="p.id">
                        {{ p.id.substring(0, 8) }}...
                      </td>

                      <!-- Reservation ID -->
                      <td class="py-3 px-3.5 font-mono text-[11px] text-slate-500" [title]="p.reservationId || ''">
                        @if (p.reservationId) {
                          <button
                            type="button"
                            (click)="inspectReservationFolio(p.reservationId)"
                            title="Tra cứu bảng kê Folio đơn này"
                            class="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
                          >
                            <i class="pi pi-bookmark text-[10px]"></i>
                            <span>{{ p.reservationId.substring(0, 8) }}...</span>
                          </button>
                        } @else {
                          <span class="text-slate-300">—</span>
                        }
                      </td>

                      <!-- Amount -->
                      <td class="py-3 px-3.5 font-bold text-slate-900">
                        {{ p.amount | number:'1.0-0' }} <span class="text-[10px] font-normal text-slate-500">{{ p.currency || 'VND' }}</span>
                      </td>

                      <!-- Method Badge -->
                      <td class="py-3 px-3.5">
                        <span [class]="getMethodBadgeClass(p.method)">
                          {{ p.methodName || getMethodLabel(p.method) }}
                        </span>
                      </td>

                      <!-- Status Badge -->
                      <td class="py-3 px-3.5">
                        <span [class]="getStatusBadgeClass(p.status)">
                          {{ p.statusName || getStatusLabel(p.status) }}
                        </span>
                      </td>

                      <!-- Transaction Ref -->
                      <td class="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                        {{ p.transactionRef || '—' }}
                      </td>

                      <!-- CreatedAt VN -->
                      <td class="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {{ formatUtc(p.createdAtUtc) }}
                      </td>

                      <!-- Notes -->
                      <td class="py-3 px-3.5 text-slate-500 max-w-xs truncate" [title]="p.notes || ''">
                        {{ p.notes || '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination Controls (Shared Component) -->
            <app-pagination
              [page]="currentPage()"
              [pageSize]="pageSize()"
              [totalCount]="totalCount()"
              [pageSizeOptions]="[10, 20, 50]"
              (pageChange)="onPageChange($event)"
              (pageSizeChange)="onPageSizeChange($event)"
            />
          }
        </section>
      <!-- ========================================================================= -->
      <!-- MODAL XUẤT PHIẾU THU TIỀN TẠI QUẦY (RECEIPT VOUCHER)                      -->
      <!-- ========================================================================= -->
      @if (receiptVoucher(); as voucher) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <!-- Modal Header -->
            <div class="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <i class="pi pi-receipt text-sm"></i>
                </div>
                <h3 class="font-bold text-sm sm:text-base tracking-tight">Phiếu Xác Nhận Thu Tiền Nội Bộ</h3>
              </div>
              <button
                type="button"
                (click)="closeReceiptModal()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <!-- Receipt Voucher Body (Printable) -->
            <div id="receipt-voucher-content" class="p-6 space-y-4 text-xs">
              <div class="text-center pb-3 border-b border-dashed border-slate-200">
                <h4 class="font-extrabold text-base text-slate-900 uppercase">{{ activePropertyName() || 'HOTEL SAAS RESORT' }}</h4>
                <p class="text-[11px] text-slate-500 mt-0.5">Chi nhánh: {{ activePropertyName() || 'Trụ sở chính' }}</p>
                <div class="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-full text-xs mt-2 border border-emerald-200">
                  GIAO DỊCH THÀNH CÔNG
                </div>
              </div>

              <div class="space-y-2.5 text-slate-700">
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">Mã giao dịch:</span>
                  <span class="font-mono font-bold text-slate-900">{{ voucher.paymentId }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">Mã đơn đặt:</span>
                  <span class="font-mono text-slate-900">{{ voucher.reservationId }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">Khách hàng:</span>
                  <span class="font-bold text-slate-900">{{ voucher.guestName }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">Phương thức:</span>
                  <span class="font-semibold text-slate-800">{{ voucher.methodName }}</span>
                </div>
                @if (voucher.transactionRef) {
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Mã tham chiếu:</span>
                    <span class="font-mono text-slate-900">{{ voucher.transactionRef }}</span>
                  </div>
                }
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">Thời gian:</span>
                  <span class="font-mono text-slate-700">{{ formatUtc(voucher.createdAtUtc) }}</span>
                </div>
              </div>

              <!-- Amount Highlight -->
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span class="text-[11px] text-slate-500 uppercase block font-bold tracking-wider">Số tiền đã thu</span>
                <span class="text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
                  {{ voucher.amount | number:'1.0-0' }} VNĐ
                </span>
              </div>

              <div class="pt-2 border-t border-dashed border-slate-200 text-center space-y-1">
                <p class="text-[10px] text-slate-600 font-bold italic">
                  * Phiếu xác nhận thu tiền nội bộ, không phải hóa đơn VAT.
                </p>
                <p class="text-[10px] text-slate-400 italic">
                  Cảm ơn quý khách đã sử dụng dịch vụ của khách sạn!
                </p>
              </div>
            </div>

            <!-- Modal Footer Actions -->
            <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="printReceipt()"
                class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <i class="pi pi-print text-xs"></i>
                <span>In phiếu thu</span>
              </button>
              <button
                type="button"
                (click)="closeReceiptModal()"
                class="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      }
      }
    </div>
  `
})
export class PaymentsPage implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);

  readonly PaymentMethod = PaymentMethod;
  readonly PaymentStatus = PaymentStatus;

  // Context Signals
  readonly activePropertyId = computed(() => this.authService.activePropertyId());
  readonly activePropertyName = computed(() => this.authService.activePropertyName());
  readonly canReadPayments = () => this.authService.hasPermission('PAYMENTS', 1);

  // Access Denied Persistent Latch State
  readonly isAccessDenied = signal<boolean>(false);
  readonly accessDeniedMessage = signal<string>('Bạn không có quyền xem thông tin thu ngân và giao dịch (PAYMENTS:Read). Vui lòng liên hệ quản trị viên.');

  // Stream 1: Summary State (Daily Revenue)
  summaryDate = getTodayVietnamDateString();
  summaryDateObj: Date = new Date();
  readonly todayDate: Date = new Date();
  readonly summary = signal<PaymentSummaryDto | null>(null);
  readonly isLoadingSummary = signal<boolean>(false);
  readonly summaryError = signal<string | null>(null);
  private summaryRequestId = 0;
  private summarySub?: Subscription;

  // Stream 1B: Shift Report State (Cashier Shift Audit)
  shiftDate = getTodayVietnamDateString();
  shiftDateObj: Date = new Date();
  readonly selectedShiftType = signal<ShiftType>(ShiftType.Morning);
  readonly ShiftType = ShiftType;
  readonly SHIFT_TYPE_LABELS = SHIFT_TYPE_LABELS;
  readonly shiftReport = signal<ShiftReportDto | null>(null);
  readonly isLoadingShiftReport = signal<boolean>(false);
  readonly shiftReportError = signal<string | null>(null);
  private shiftReportRequestId = 0;
  private shiftReportSub?: Subscription;

  // Stream 2: Payments List State
  filterDateFrom = '';
  filterDateTo = '';
  filterDateFromObj: Date | null = null;
  filterDateToObj: Date | null = null;
  filterMethod: number | null = null;
  filterStatus: number | null = null;
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly totalCount = signal<number>(0);
  readonly payments = signal<PaymentDto[]>([]);
  readonly isLoadingPayments = signal<boolean>(false);
  readonly paymentsError = signal<string | null>(null);
  private paymentsRequestId = 0;
  private paymentsSub?: Subscription;
  private authSub?: Subscription;
  private filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  // Folio & Cashier Collection State
  searchReservationId = '';
  readonly folio = signal<FolioDto | null>(null);
  readonly isLoadingFolio = signal<boolean>(false);
  readonly folioError = signal<string | null>(null);
  paymentAmount: number = 0;
  readonly paymentMethod = signal<PaymentMethod>(PaymentMethod.Cash);
  paymentTransactionRef = '';
  readonly isBankTransferConfirmed = signal<boolean>(false);
  readonly isDepositPayment = signal<boolean>(false);
  readonly isSubmittingPayment = signal<boolean>(false);
  readonly receiptVoucher = signal<{
    paymentId: string;
    reservationId: string;
    guestName: string;
    amount: number;
    methodName: string;
    transactionRef?: string;
    createdAtUtc: string;
  } | null>(null);
  private folioSub?: Subscription;
  private submitPaymentSub?: Subscription;

  constructor() {
    effect(() => {
      const propId = this.activePropertyId();
      const canRead = this.canReadPayments();
      untracked(() => {
        this.handlePropertyContextChange(propId, canRead);
      });
    });

    if (this.authService.currentUser$) {
      this.authSub = this.authService.currentUser$.subscribe(() => {
        if (!this.canReadPayments()) {
          this.handleAccessDenied('Quyền truy cập thu ngân đã bị thu hồi (PAYMENTS:Read).');
        } else if (this.isAccessDenied()) {
          this.recoverAccess();
        }
      });
    }
  }

  private cancelSummarySubscription(): void {
    if (this.summarySub && !this.summarySub.closed) {
      this.summarySub.unsubscribe();
      this.summarySub = undefined;
    }
  }

  private cancelPaymentsSubscription(): void {
    if (this.paymentsSub && !this.paymentsSub.closed) {
      this.paymentsSub.unsubscribe();
      this.paymentsSub = undefined;
    }
  }

  private cancelSubscriptions(): void {
    this.cancelSummarySubscription();
    this.cancelPaymentsSubscription();
    if (this.shiftReportSub && !this.shiftReportSub.closed) {
      this.shiftReportSub.unsubscribe();
      this.shiftReportSub = undefined;
    }
    if (this.folioSub && !this.folioSub.closed) {
      this.folioSub.unsubscribe();
      this.folioSub = undefined;
    }
    if (this.submitPaymentSub && !this.submitPaymentSub.closed) {
      this.submitPaymentSub.unsubscribe();
      this.submitPaymentSub = undefined;
    }
  }

  /**
   * Xử lý tập trung khi bị từ chối quyền (403 Forbidden hoặc quyền bị thu hồi):
   * Khóa chốt access-denied dai dẳng (persistent latch), xóa sạch cả 2 luồng dữ liệu tài chính,
   * tăng request IDs, hủy bỏ mọi subscription đang chạy, và chặn hoàn toàn mọi nỗ lực nạp dữ liệu
   * cho đến khi có sự phục hồi thẩm quyền/ngữ cảnh chủ động (deliberate validated recovery).
   */
  handleAccessDenied(message: string = 'Bạn không có quyền truy cập dữ liệu thu ngân chi nhánh này (403 Forbidden).'): void {
    this.cancelSubscriptions();
    this.summaryRequestId++;
    this.paymentsRequestId++;

    this.isAccessDenied.set(true);
    this.accessDeniedMessage.set(message);

    this.summary.set(null);
    this.payments.set([]);
    this.shiftReport.set(null);
    this.totalCount.set(0);
    this.isLoadingSummary.set(false);
    this.isLoadingPayments.set(false);
    this.isLoadingShiftReport.set(false);

    this.summaryError.set(message);
    this.paymentsError.set(message);
    this.shiftReportError.set(message);

    this.folio.set(null);
    this.folioError.set(null);
    this.receiptVoucher.set(null);
  }

  /**
   * Phục hồi quyền truy cập khi có xác nhận thẩm quyền hợp lệ mới.
   * Chỉ reset chốt access-denied khi canReadPayments() và activePropertyId() hợp lệ.
   */
  recoverAccess(): void {
    const propId = this.activePropertyId();
    if (!this.canReadPayments() || !propId) {
      return;
    }
    this.isAccessDenied.set(false);
    this.accessDeniedMessage.set('Bạn không có quyền xem thông tin thu ngân và giao dịch (PAYMENTS:Read). Vui lòng liên hệ quản trị viên.');
    this.summaryError.set(null);
    this.paymentsError.set(null);
    this.loadSummary();
    if (this.isAccessDenied()) {
      return;
    }
    this.loadPayments();
  }

  handlePropertyContextChange(propId: string | null, canRead: boolean = this.canReadPayments()): void {
    if (!canRead) {
      this.handleAccessDenied('Bạn không có quyền xem thông tin thu ngân (PAYMENTS:Read).');
      return;
    }

    // Reset chốt access-denied khi chuyển đổi cơ sở hoạt động hoặc tái xác thực thẩm quyền hợp lệ
    this.isAccessDenied.set(false);
    this.accessDeniedMessage.set('Bạn không có quyền xem thông tin thu ngân và giao dịch (PAYMENTS:Read). Vui lòng liên hệ quản trị viên.');

    // Hủy triệt để các subscription HTTP đang chạy
    this.cancelSubscriptions();

    // Stale-response rejection: Hủy request cũ bằng cách tăng ID
    this.summaryRequestId++;
    this.paymentsRequestId++;
    this.shiftReportRequestId++;

    // Xóa sạch dữ liệu cũ
    this.summary.set(null);
    this.payments.set([]);
    this.shiftReport.set(null);
    this.totalCount.set(0);
    this.summaryError.set(null);
    this.paymentsError.set(null);
    this.shiftReportError.set(null);
    this.isLoadingShiftReport.set(false);
    this.currentPage.set(1);
    this.folio.set(null);
    this.folioError.set(null);
    this.searchReservationId = '';
    this.receiptVoucher.set(null);
    this.isDepositPayment.set(false);

    if (!propId) {
      this.isLoadingSummary.set(false);
      this.isLoadingPayments.set(false);
      this.isLoadingShiftReport.set(false);
      return;
    }

    // Tải dữ liệu cho chi nhánh mới: ngăn chặn loadPayments nếu loadSummary bị 403 đồng bộ
    this.loadSummary();
    this.loadShiftReport();
    if (this.isAccessDenied()) {
      return;
    }
    this.loadPayments();
  }

  loadShiftReport(): void {
    if (this.isAccessDenied()) return;
    const propId = this.activePropertyId();
    if (!propId) {
      this.isLoadingShiftReport.set(false);
      this.shiftReport.set(null);
      return;
    }

    const currentReqId = ++this.shiftReportRequestId;
    this.isLoadingShiftReport.set(true);
    this.shiftReportError.set(null);

    this.shiftReportSub?.unsubscribe();
    this.shiftReportSub = this.paymentService.getShiftReport(propId, this.shiftDate, this.selectedShiftType()).subscribe({
      next: (report) => {
        if (currentReqId !== this.shiftReportRequestId || this.activePropertyId() !== propId) return;
        this.shiftReport.set(report);
        this.isLoadingShiftReport.set(false);
      },
      error: (err) => {
        if (currentReqId !== this.shiftReportRequestId || this.activePropertyId() !== propId) return;
        this.isLoadingShiftReport.set(false);
        this.shiftReportError.set(err?.error?.message || 'Không thể tải báo cáo ca thu ngân.');
      }
    });
  }

  onShiftDateObjChange(newDate: Date): void {
    if (!newDate) return;
    this.shiftDate = getTodayVietnamDateString(newDate);
    this.loadShiftReport();
  }

  selectShiftType(type: ShiftType): void {
    this.selectedShiftType.set(type);
    this.loadShiftReport();
  }

  ngOnInit(): void {
    // Ngữ cảnh chi nhánh và quyền được kích hoạt tự động qua context effect
  }

  ngOnDestroy(): void {
    // Hủy triệt để các subscription HTTP đang chạy và subscription auth
    this.cancelSubscriptions();
    if (this.authSub && !this.authSub.closed) {
      this.authSub.unsubscribe();
    }
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = null;
    }
    this.summaryRequestId++;
    this.paymentsRequestId++;
  }

  /**
   * Gọi API tải dữ liệu Luồng 1 (Tổng kết thực thu trong ngày - VN UTC+7)
   */
  loadSummary(): void {
    if (this.isAccessDenied()) {
      return;
    }
    const propId = this.activePropertyId();
    if (!this.canReadPayments() || !propId) {
      this.handleAccessDenied('Bạn không có quyền xem thông tin thu ngân (PAYMENTS:Read).');
      return;
    }

    this.cancelSummarySubscription();
    const currentReqId = ++this.summaryRequestId;
    this.isLoadingSummary.set(true);
    this.summaryError.set(null);

    this.summarySub = this.paymentService.getPaymentSummary(propId, this.summaryDate || undefined).subscribe({
      next: (data) => {
        // Stale response rejection
        if (currentReqId !== this.summaryRequestId) return;
        // Kiểm tra lại ngữ cảnh và quyền tại thời điểm nhận phản hồi
        if (this.isAccessDenied() || !this.canReadPayments() || this.activePropertyId() !== propId) {
          this.handleAccessDenied();
          return;
        }
        this.summary.set(data);
        this.isLoadingSummary.set(false);
      },
      error: (err) => {
        // Stale response rejection
        if (currentReqId !== this.summaryRequestId) return;
        if (err?.status === 403) {
          this.handleAccessDenied('Bạn không có quyền truy cập dữ liệu thu ngân chi nhánh này (403 Forbidden).');
        } else if (!this.isAccessDenied()) {
          // Lỗi thông thường (500, network error) duy trì tính độc lập của luồng
          this.isLoadingSummary.set(false);
          this.summaryError.set(err?.error?.message || 'Không thể tải tổng kết thực thu trong ngày.');
        }
      }
    });
  }

  retrySummary(): void {
    if (this.isAccessDenied()) return;
    this.loadSummary();
  }

  onSummaryDateChange(): void {
    if (this.isAccessDenied()) return;
    this.loadSummary();
  }

  /**
   * Gọi API tải dữ liệu Luồng 2 (Nhật ký Giao dịch - UTC)
   */
  loadPayments(): void {
    if (this.isAccessDenied()) {
      return;
    }
    const propId = this.activePropertyId();
    if (!this.canReadPayments() || !propId) {
      this.handleAccessDenied('Bạn không có quyền xem thông tin thu ngân (PAYMENTS:Read).');
      return;
    }

    this.cancelPaymentsSubscription();
    const currentReqId = ++this.paymentsRequestId;
    this.isLoadingPayments.set(true);
    this.paymentsError.set(null);

    const filter: GetPaymentsFilter = {
      propertyId: propId,
      page: this.currentPage(),
      pageSize: this.pageSize()
    };

    if (this.filterDateFrom) filter.dateFrom = this.filterDateFrom;
    if (this.filterDateTo) filter.dateTo = this.filterDateTo;
    if (this.filterMethod !== null) filter.method = this.filterMethod;
    if (this.filterStatus !== null) filter.status = this.filterStatus;

    this.paymentsSub = this.paymentService.getPayments(filter).subscribe({
      next: (res) => {
        // Stale response rejection
        if (currentReqId !== this.paymentsRequestId) return;
        // Kiểm tra lại ngữ cảnh và quyền tại thời điểm nhận phản hồi
        if (this.isAccessDenied() || !this.canReadPayments() || this.activePropertyId() !== propId) {
          this.handleAccessDenied();
          return;
        }
        this.payments.set(res.items || []);
        this.totalCount.set(res.totalCount || 0);
        this.isLoadingPayments.set(false);
      },
      error: (err) => {
        // Stale response rejection
        if (currentReqId !== this.paymentsRequestId) return;
        if (err?.status === 403) {
          this.handleAccessDenied('Bạn không có quyền truy cập nhật ký giao dịch chi nhánh này (403 Forbidden).');
        } else if (!this.isAccessDenied()) {
          // Lỗi thông thường (500, network error) duy trì tính độc lập của luồng
          this.isLoadingPayments.set(false);
          this.paymentsError.set(err?.error?.message || 'Không thể tải danh sách giao dịch thanh toán.');
        }
      }
    });
  }

  retryPayments(): void {
    if (this.isAccessDenied()) return;
    this.loadPayments();
  }

  onFilterChange(): void {
    if (this.isAccessDenied()) return;
    this.currentPage.set(1);
    // P-8: Debounce filter changes to avoid API flooding
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    this.filterDebounceTimer = setTimeout(() => {
      this.loadPayments();
      this.filterDebounceTimer = null;
    }, 300);
  }

  resetFilters(): void {
    if (this.isAccessDenied()) return;
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = null;
    }
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterDateFromObj = null;
    this.filterDateToObj = null;
    this.filterMethod = null;
    this.filterStatus = null;
    this.currentPage.set(1);
    this.loadPayments();
  }

  onPageChange(page: number): void {
    if (this.isAccessDenied()) return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadPayments();
  }

  /** P-3: Handle page size change from shared PaginationComponent */
  onPageSizeChange(newSize: number): void {
    if (this.isAccessDenied()) return;
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadPayments();
  }

  /** P-1: Convert PrimeNG DatePicker Date object to YYYY-MM-DD string for summary API */
  onSummaryDateObjChange(date: Date | null): void {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      this.summaryDate = `${y}-${m}-${d}`;
    } else {
      this.summaryDate = getTodayVietnamDateString();
    }
    this.onSummaryDateChange();
  }

  /** P-2: Convert filter DatePicker dates to YYYY-MM-DD strings */
  onFilterDateFromChange(date: Date | null): void {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      this.filterDateFrom = `${y}-${m}-${d}`;
    } else {
      this.filterDateFrom = '';
    }
    this.onFilterChange();
  }

  onFilterDateToChange(date: Date | null): void {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      this.filterDateTo = `${y}-${m}-${d}`;
    } else {
      this.filterDateTo = '';
    }
    this.onFilterChange();
  }

  formatUtc(isoString: string | null | undefined): string {
    return formatUtcDateTimeString(isoString);
  }

  getMethodLabel(method: number): string {
    return PAYMENT_METHOD_LABELS[method] || 'Khác';
  }

  getStatusLabel(status: number): string {
    return PAYMENT_STATUS_LABELS[status] || 'Không xác định';
  }

  getMethodBadgeClass(method: number): string {
    switch (method) {
      case PaymentMethod.Cash:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800';
      case PaymentMethod.BankTransfer:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800';
      case PaymentMethod.CreditCard:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800';
      case PaymentMethod.VNPay:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800';
      default:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800';
    }
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case PaymentStatus.Completed:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800';
      case PaymentStatus.Processing:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800';
      case PaymentStatus.Pending:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800';
      case PaymentStatus.Failed:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800';
      case PaymentStatus.Cancelled:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700';
      case PaymentStatus.Refunded:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800';
      default:
        return 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700';
    }
  }

  // =========================================================================
  // FOLIO & CASHIER COLLECTION METHODS
  // =========================================================================

  loadFolio(reservationId?: string): void {
    if (this.isAccessDenied()) return;
    const propId = this.activePropertyId();
    const resId = (reservationId || this.searchReservationId || '').trim();
    if (!propId || !resId) return;

    this.searchReservationId = resId;
    this.isLoadingFolio.set(true);
    this.folioError.set(null);

    if (this.folioSub && !this.folioSub.closed) {
      this.folioSub.unsubscribe();
    }

    this.folioSub = this.paymentService.getFolio(resId, propId).subscribe({
      next: (f) => {
        this.folio.set(f);
        this.isLoadingFolio.set(false);
        if (f.remainingBalance > 0) {
          this.paymentAmount = f.remainingBalance;
        } else {
          this.paymentAmount = 0;
        }
      },
      error: (err) => {
        this.isLoadingFolio.set(false);
        this.folioError.set(err?.error?.message || 'Không thể tra cứu thông tin hóa đơn Folio cho đơn đặt phòng này.');
      }
    });
  }

  fillRemainingBalance(amount: number): void {
    this.paymentAmount = Math.max(0, amount);
  }

  toggleBankTransferConfirmed(): void {
    this.isBankTransferConfirmed.update((val) => !val);
  }

  toggleDepositPayment(): void {
    this.isDepositPayment.update((val) => !val);
  }

  submitPayment(reservationId: string): void {
    if (this.isAccessDenied() || this.isSubmittingPayment()) return;
    const propId = this.activePropertyId();
    if (!propId) return;

    const amount = Number(this.paymentAmount);
    if (!amount || amount <= 0) {
      this.folioError.set('Vui lòng nhập số tiền thu hợp lệ lớn hơn 0.');
      return;
    }

    if (this.paymentMethod() === PaymentMethod.BankTransfer) {
      if (!this.paymentTransactionRef.trim()) {
        this.folioError.set('Vui lòng nhập mã giao dịch ngân hàng đối với hình thức Chuyển khoản.');
        return;
      }
      if (!this.isBankTransferConfirmed()) {
        this.folioError.set('Thu ngân phải xác nhận tiền đã vào tài khoản ngân hàng chi nhánh trước khi ghi nhận.');
        return;
      }
    }

    this.isSubmittingPayment.set(true);
    this.folioError.set(null);

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

    if (this.submitPaymentSub && !this.submitPaymentSub.closed) {
      this.submitPaymentSub.unsubscribe();
    }

    this.submitPaymentSub = this.paymentService.createPayment({
      reservationId,
      amount,
      method: this.paymentMethod(),
      transactionRef: this.paymentTransactionRef.trim() || undefined,
      idempotencyKey,
      isDeposit: this.isDepositPayment()
    }, propId).subscribe({
      next: (payment) => {
        this.isSubmittingPayment.set(false);
        const currentFolio = this.folio();
        const guestName = currentFolio?.guestName || 'Khách hàng';

        // Trigger Receipt Voucher Modal
        this.receiptVoucher.set({
          paymentId: payment.id,
          reservationId: payment.reservationId || reservationId,
          guestName,
          amount: payment.amount,
          methodName: payment.methodName || this.getMethodLabel(payment.method),
          transactionRef: payment.transactionRef,
          createdAtUtc: payment.createdAtUtc
        });

        // Reset payment form fields
        this.paymentAmount = 0;
        this.paymentTransactionRef = '';
        this.isBankTransferConfirmed.set(false);
        this.isDepositPayment.set(false);

        // Refresh Folio and both streams
        this.loadFolio(reservationId);
        this.loadSummary();
        this.loadPayments();
      },
      error: (err) => {
        this.isSubmittingPayment.set(false);
        this.folioError.set(err?.error?.message || 'Giao dịch thu tiền thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    });
  }

  inspectReservationFolio(resId: string): void {
    this.searchReservationId = resId;
    this.loadFolio(resId);
    if (typeof document !== 'undefined') {
      const el = document.getElementById('folio-section');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  printReceipt(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  closeReceiptModal(): void {
    this.receiptVoucher.set(null);
  }
}
