import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService, GetPaymentsFilter } from '../../core/services/payment.service';
import {
  PaymentDto,
  PaymentSummaryDto,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PaymentStatus,
  PAYMENT_STATUS_LABELS
} from '../../core/models/payment.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

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
 * Helper: Định dạng timestamp ISO sang chuỗi Ngày Giờ chuẩn UTC rõ ràng (dd/MM/yyyy HH:mm:ss UTC).
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
  imports: [CommonModule, FormsModule, EmptyStateComponent],
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
          iconClass="pi pi-shield"
          title="Không có quyền truy cập"
          [description]="accessDeniedMessage()"
        ></app-empty-state>
      } @else if (!activePropertyId()) {
        <app-empty-state
          iconClass="pi pi-building"
          title="Vui lòng chọn cơ sở hoạt động"
          description="Hệ thống yêu cầu xác định chi nhánh hoạt động để tra cứu dữ liệu thu ngân. Hãy chọn chi nhánh từ bộ chuyển ngữ cảnh ở thanh điều hướng trên cùng."
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
              Hai luồng dữ liệu độc lập phục vụ kiểm tra riêng biệt và không cấu thành bảng kê đối soát ca chốt két khớp dòng.
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
              <input
                id="summaryDateInput"
                type="date"
                [(ngModel)]="summaryDate"
                (ngModelChange)="onSummaryDateChange()"
                class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
              <label for="filterDateFromInput" class="block text-[11px] font-medium text-slate-500 mb-1">Từ ngày (UTC):</label>
              <input
                id="filterDateFromInput"
                type="date"
                [(ngModel)]="filterDateFrom"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <!-- Filter: Date To -->
            <div>
              <label for="filterDateToInput" class="block text-[11px] font-medium text-slate-500 mb-1">Đến ngày (UTC):</label>
              <input
                id="filterDateToInput"
                type="date"
                [(ngModel)]="filterDateTo"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              iconClass="pi pi-inbox"
              title="Không có giao dịch nào"
              description="Không tìm thấy bản ghi thanh toán nào khớp với tiêu chí tìm kiếm hoặc dải ngày đã chọn."
            ></app-empty-state>
          }

          <!-- Table Content for Payments -->
          @if (!isLoadingPayments() && !paymentsError() && payments().length > 0) {
            <div class="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th class="py-3 px-3.5">Mã Giao Dịch</th>
                    <th class="py-3 px-3.5">Đơn Đặt Phòng</th>
                    <th class="py-3 px-3.5">Số Tiền</th>
                    <th class="py-3 px-3.5">Phương Thức</th>
                    <th class="py-3 px-3.5">Trạng Thái</th>
                    <th class="py-3 px-3.5">Mã Tham Chiếu</th>
                    <th class="py-3 px-3.5">Thời Gian Tạo (UTC)</th>
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
                          <span class="inline-flex items-center gap-1">
                            <i class="pi pi-bookmark text-[10px] text-slate-400"></i>
                            {{ p.reservationId.substring(0, 8) }}...
                          </span>
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

                      <!-- CreatedAt UTC -->
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

            <!-- Pagination Controls -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div>
                Trang <span class="font-semibold text-slate-800">{{ currentPage() }}</span> /
                <span class="font-semibold text-slate-800">{{ totalPages() }}</span>
                (Tổng cộng {{ totalCount() }} giao dịch)
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="onPageChange(currentPage() - 1)"
                  [disabled]="currentPage() <= 1 || isLoadingPayments()"
                  class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-medium transition-colors"
                >
                  <i class="pi pi-chevron-left text-[10px] mr-1"></i> Trước
                </button>
                <button
                  type="button"
                  (click)="onPageChange(currentPage() + 1)"
                  [disabled]="currentPage() >= totalPages() || isLoadingPayments()"
                  class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-medium transition-colors"
                >
                  Sau <i class="pi pi-chevron-right text-[10px] ml-1"></i>
                </button>
              </div>
            </div>
          }
        </section>
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
  canReadPayments(): boolean {
    return this.authService.hasPermission('PAYMENTS', 1);
  }

  // Access Denied Persistent Latch State
  readonly isAccessDenied = signal<boolean>(false);
  readonly accessDeniedMessage = signal<string>('Bạn không có quyền xem thông tin thu ngân và giao dịch (PAYMENTS:Read). Vui lòng liên hệ quản trị viên.');

  // Stream 1: Summary State
  summaryDate = getTodayVietnamDateString();
  readonly summary = signal<PaymentSummaryDto | null>(null);
  readonly isLoadingSummary = signal<boolean>(false);
  readonly summaryError = signal<string | null>(null);
  private summaryRequestId = 0;
  private summarySub?: Subscription;

  // Stream 2: Payments List State
  filterDateFrom = '';
  filterDateTo = '';
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

  readonly totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

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
    this.totalCount.set(0);
    this.isLoadingSummary.set(false);
    this.isLoadingPayments.set(false);

    this.summaryError.set(message);
    this.paymentsError.set(message);
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

    // Xóa sạch dữ liệu cũ
    this.summary.set(null);
    this.payments.set([]);
    this.totalCount.set(0);
    this.summaryError.set(null);
    this.paymentsError.set(null);
    this.currentPage.set(1);

    if (!propId) {
      this.isLoadingSummary.set(false);
      this.isLoadingPayments.set(false);
      return;
    }

    // Tải dữ liệu cho chi nhánh mới: ngăn chặn loadPayments nếu loadSummary bị 403 đồng bộ
    this.loadSummary();
    if (this.isAccessDenied()) {
      return;
    }
    this.loadPayments();
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
    this.loadPayments();
  }

  resetFilters(): void {
    if (this.isAccessDenied()) return;
    this.filterDateFrom = '';
    this.filterDateTo = '';
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
}
