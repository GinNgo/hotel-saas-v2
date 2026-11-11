import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { A11yModule } from '@angular/cdk/a11y';

import { AuthService } from '../../../../core/services/auth.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { AlertService } from '../../../../core/services/alert.service';
import {
  RefundRequestDto,
  RefundRequestDetailDto,
  GetRefundRequestsFilter,
  ConfirmRefundPayoutRequest,
  PAYMENT_METHOD_LABELS,
  PaymentMethod
} from '../../../../core/models/payment.model';

import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

export interface ParsedTransactionRef {
  businessRef: string | null;
  idempotencyKey: string | null;
  actorUserId: string | null;
  isDeposit: boolean;
  raw: string;
}

export function parseTransactionRef(raw: string | null | undefined): ParsedTransactionRef {
  if (!raw || !raw.trim()) {
    return { businessRef: null, idempotencyKey: null, actorUserId: null, isDeposit: false, raw: '' };
  }

  const str = raw.trim();
  const isDeposit = str.includes('[PURPOSE:DEPOSIT]');

  const ikMatch = str.match(/\[IK:([^\]]+)\]/);
  const idempotencyKey = ikMatch ? ikMatch[1] : null;

  const byMatch = str.match(/\[BY:([^\]]+)\]/);
  const actorUserId = byMatch ? byMatch[1] : null;

  let cleaned = str
    .replace(/\[PURPOSE:DEPOSIT\]/g, '')
    .replace(/\[IK:[^\]]+\]/g, '')
    .replace(/\[BY:[^\]]+\]/g, '')
    .trim();

  return {
    businessRef: cleaned.length > 0 ? cleaned : null,
    idempotencyKey,
    actorUserId,
    isDeposit,
    raw: str
  };
}

export function cleanBankTransactionRef(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  let str = raw.trim();
  if (str.includes('|Notes:')) {
    str = str.split('|Notes:')[0].trim();
  }
  if (str.startsWith('BankRef:')) {
    str = str.substring(8).trim();
  }
  return str.length > 0 ? str : null;
}

@Component({
  selector: 'app-refund-approval',
  standalone: true,
  host: {
    class: 'block'
  },
  imports: [
    CommonModule,
    FormsModule,
    DatePicker,
    A11yModule,
    PaginationComponent,
    EmptyStateComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="space-y-6 pt-1">
  <!-- 1. KPI METRICS CARDS -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
    <!-- Card 1: Total Requests -->
    <div class="rounded-xl bg-white border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between h-full">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng yêu cầu hoàn</span>
          <div class="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {{ totalCount() }}
            <span class="text-xs font-normal text-slate-500 ml-1">yêu cầu</span>
          </div>
        </div>
        <div class="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
          <i class="pi pi-list text-sm"></i>
        </div>
      </div>
      <div class="text-xs text-slate-500 pt-3 mt-2 border-t border-slate-100 truncate">
        Tổng giá trị: <span class="font-semibold text-slate-800 tabular-nums whitespace-nowrap">{{ totalRefundAmount() | number:'1.0-0' }} đ</span>
      </div>
    </div>

    <!-- Card 2: Pending Approval -->
    <div class="rounded-xl bg-white border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between h-full">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs font-medium uppercase tracking-wider text-amber-700">Chờ phê duyệt</span>
          <div class="text-2xl font-bold text-amber-600 tracking-tight mt-1">
            {{ totalPendingCount() }}
            <span class="text-xs font-normal text-slate-500 ml-1">chờ duyệt</span>
          </div>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
          <i class="pi pi-clock text-sm"></i>
        </div>
      </div>
      <div class="text-xs text-amber-700 pt-3 mt-2 border-t border-slate-100 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        <span class="truncate">Cần quản lý xét duyệt (D23)</span>
      </div>
    </div>

    <!-- Card 3: Approved (Waiting Payout) -->
    <div class="rounded-xl bg-white border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between h-full">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs font-medium uppercase tracking-wider text-sky-700">Đã duyệt (Chờ chi trả)</span>
          <div class="text-2xl font-bold text-sky-600 tracking-tight mt-1">
            {{ totalApprovedCount() }}
            <span class="text-xs font-normal text-slate-500 ml-1">đã duyệt</span>
          </div>
        </div>
        <div class="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
          <i class="pi pi-verified text-sm"></i>
        </div>
      </div>
      <div class="text-xs text-sky-700 pt-3 mt-2 border-t border-slate-100 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
        <span class="truncate">Chờ thực hiện chi trả</span>
      </div>
    </div>

    <!-- Card 4: Completed -->
    <div class="rounded-xl bg-white border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between h-full">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs font-medium uppercase tracking-wider text-emerald-700">Đã hoàn tiền</span>
          <div class="text-2xl font-bold text-emerald-600 tracking-tight mt-1">
            {{ totalCompletedCount() }}
            <span class="text-xs font-normal text-slate-500 ml-1">hoàn tất</span>
          </div>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <i class="pi pi-check text-sm"></i>
        </div>
      </div>
      <div class="text-xs text-emerald-700 pt-3 mt-2 border-t border-slate-100 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span class="truncate">Đã xác nhận chi trả</span>
      </div>
    </div>
  </div>

  <!-- 2. FILTER & SEARCH TOOLBAR -->
  <div class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
    <!-- Row 1: Status Filter Segmented Chips & Refresh Button -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
        <button
          type="button"
          (click)="onFilterStatusChange('all')"
          [class]="statusFilter() === 'all' ? 'bg-slate-900 text-white font-medium shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Tất cả
        </button>
        <button
          type="button"
          (click)="onFilterStatusChange('PendingApproval')"
          [class]="statusFilter() === 'PendingApproval' ? 'bg-amber-600 text-white font-medium shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
        >
          <span>Chờ phê duyệt</span>
          @if (totalPendingCount() > 0) {
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" [class]="statusFilter() === 'PendingApproval' ? 'bg-white text-amber-700' : 'bg-amber-200/80 text-amber-900'">
              {{ totalPendingCount() }}
            </span>
          }
        </button>
        <button
          type="button"
          (click)="onFilterStatusChange('Approved')"
          [class]="statusFilter() === 'Approved' ? 'bg-sky-600 text-white font-medium shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Đã duyệt (Chờ chi trả)
        </button>
        <button
          type="button"
          (click)="onFilterStatusChange('Completed')"
          [class]="statusFilter() === 'Completed' ? 'bg-emerald-600 text-white font-medium shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Đã hoàn tất
        </button>
        <button
          type="button"
          (click)="onFilterStatusChange('Rejected')"
          [class]="statusFilter() === 'Rejected' ? 'bg-rose-600 text-white font-medium shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Đã từ chối
        </button>
      </div>

      <!-- Refresh Button -->
      <button
        type="button"
        (click)="loadRefundRequests()"
        [disabled]="isLoading()"
        title="Làm mới danh sách"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
      >
        <i class="pi pi-refresh text-xs" [class.animate-spin]="isLoading()"></i>
        <span>Làm mới</span>
      </button>
    </div>

    <!-- Row 2: Search, Date Range, Filter Actions -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
      <!-- Search Input -->
      <div class="lg:col-span-5 space-y-1">
        <label for="refundSearchInput" class="text-xs font-medium text-slate-600">Tìm kiếm theo mã đặt phòng / khách hàng</label>
        <div class="relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            id="refundSearchInput"
            type="text"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            (keyup.enter)="onSearchSubmit()"
            placeholder="Nhập mã booking hoặc tên khách để tìm kiếm..."
            class="w-full h-10 pl-9 pr-8 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs transition-colors"
          />
          @if (searchTerm) {
            <button
              type="button"
              (click)="searchTerm = ''; onSearchSubmit()"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Xóa nhanh từ khóa"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          }
        </div>
      </div>

      <!-- Date From -->
      <div class="lg:col-span-3 space-y-1">
        <label for="refundDateFrom" class="text-xs font-medium text-slate-600">Từ ngày</label>
        <p-datepicker
          inputId="refundDateFrom"
          [(ngModel)]="dateFromObj"
          (ngModelChange)="onDateFilterChange()"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          iconDisplay="input"
          appendTo="body"
          [firstDayOfWeek]="1"
          placeholder="dd/mm/yyyy"
          ariaLabel="Từ ngày"
          styleClass="w-full"
          inputStyleClass="w-full h-10 px-3 pr-10 text-xs rounded-lg border border-slate-200 bg-white font-medium focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
        />
      </div>

      <!-- Date To -->
      <div class="lg:col-span-3 space-y-1">
        <label for="refundDateTo" class="text-xs font-medium text-slate-600">Đến ngày</label>
        <p-datepicker
          inputId="refundDateTo"
          [(ngModel)]="dateToObj"
          (ngModelChange)="onDateFilterChange()"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          iconDisplay="input"
          appendTo="body"
          [firstDayOfWeek]="1"
          placeholder="dd/mm/yyyy"
          ariaLabel="Đến ngày"
          styleClass="w-full"
          inputStyleClass="w-full h-10 px-3 pr-10 text-xs rounded-lg border border-slate-200 bg-white font-medium focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
        />
      </div>

      <!-- Reset Button -->
      <div class="lg:col-span-1 flex items-center h-10">
        <button
          type="button"
          (click)="resetFilters()"
          title="Đặt lại bộ lọc"
          class="w-full sm:w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <i class="pi pi-times text-xs"></i>
          <span class="sm:hidden text-xs font-medium">Đặt lại lọc</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 3. INITIAL LOADING STATE ON THE LIST -->
  @if (isLoading() && items().length === 0) {
    <div class="bg-white rounded-xl border border-slate-200/90 p-12 flex flex-col items-center justify-center space-y-3 shadow-2xs min-h-[260px]">
      <div class="w-11 h-11 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
        <i class="pi pi-spin pi-spinner text-sky-600 text-xl"></i>
      </div>
      <div class="text-xs font-semibold text-slate-700">Đang tải danh sách yêu cầu hoàn tiền...</div>
      <div class="text-[11px] text-slate-400">Vui lòng đợi trong giây lát</div>
    </div>
  }

  <!-- 4. ERROR STATE -->
  @if (!isLoading() && errorMessage()) {
    <app-empty-state
      [iconClass]="'pi pi-exclamation-triangle text-rose-500'"
      [title]="'Không thể tải dữ liệu hoàn tiền'"
      [description]="errorMessage()!"
    ></app-empty-state>
  }

  <!-- 5. EMPTY STATE -->
  @if (!isLoading() && !errorMessage() && items().length === 0) {
    <app-empty-state
      [iconClass]="'pi pi-inbox text-slate-400'"
      [title]="'Không tìm thấy yêu cầu hoàn tiền nào'"
      [description]="'Hiện tại chưa có yêu cầu hoàn tiền nào phù hợp với điều kiện lọc đã chọn.'"
    ></app-empty-state>
  }

  <!-- 6. DATA GRID & CARDS -->
  @if (!errorMessage() && items().length > 0) {
    <div class="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden relative">
      <!-- Loading Overlay directly on the list when searching/filtering -->
      @if (isLoading()) {
        <div class="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-30 flex flex-col items-center justify-center gap-2.5 transition-all">
          <div class="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center">
            <i class="pi pi-spin pi-spinner text-sky-600 text-lg"></i>
          </div>
          <span class="text-xs font-semibold text-slate-700 bg-white/95 px-3.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
            Đang tải dữ liệu danh sách...
          </span>
        </div>
        <div class="absolute top-0 inset-x-0 h-1 bg-sky-100 overflow-hidden z-40">
          <div class="h-full bg-sky-600 animate-pulse w-full"></div>
        </div>
      }
      <!-- Desktop Table (Visible on md and up) -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-200/90 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th scope="col" class="py-3 px-4">Mã Đặt Phòng & Khách Hàng</th>
              <th scope="col" class="py-3 px-4">Chi Nhánh & Ngày Tạo</th>
              <th scope="col" class="py-3 px-4 text-right">Đã Thanh Toán / Tổng Đơn</th>
              <th scope="col" class="py-3 px-4 text-right">Phí Hủy</th>
              <th scope="col" class="py-3 px-4 text-right text-emerald-800">Được Hoàn</th>
              <th scope="col" class="py-3 px-4 text-center">Trạng Thái (D23)</th>
              <th scope="col" class="py-3 px-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (item of items(); track item.paymentId) {
              <tr class="hover:bg-slate-50/70 transition-colors">
                <!-- 1. Confirmation Code & Guest -->
                <td class="py-3.5 px-4">
                  <div class="font-bold text-slate-900 font-mono tracking-tight">{{ item.confirmationCode }}</div>
                  <div class="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                    <i class="pi pi-user text-[11px] text-slate-400"></i>
                    <span>{{ item.guestName }}</span>
                  </div>
                </td>

                <!-- 2. Property & Date -->
                <td class="py-3.5 px-4">
                  <div class="font-medium text-slate-800">{{ item.propertyName }}</div>
                  <div class="text-[11px] text-slate-500 mt-0.5 tabular-nums flex items-center gap-1">
                    <i class="pi pi-calendar text-[10px] text-slate-400"></i>
                    <span>{{ item.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                </td>

                <!-- 3. Paid & Total Amount -->
                <td class="py-3.5 px-4 text-right">
                  <div class="font-medium text-slate-800 tabular-nums whitespace-nowrap">
                    {{ item.paidAmount | number:'1.0-0' }} đ
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5 tabular-nums whitespace-nowrap">
                    Tổng: {{ item.totalAmount | number:'1.0-0' }} đ
                  </div>
                </td>

                <!-- 4. Cancellation Fee -->
                <td class="py-3.5 px-4 text-right font-medium text-rose-600 tabular-nums whitespace-nowrap">
                  {{ item.cancellationFee | number:'1.0-0' }} đ
                </td>

                <!-- 5. Refundable Amount (Prominent) -->
                <td class="py-3.5 px-4 text-right font-bold text-emerald-700 text-sm tabular-nums whitespace-nowrap">
                  {{ item.refundableAmount | number:'1.0-0' }} đ
                </td>

                <!-- 6. Status Badge -->
                <td class="py-3.5 px-4 text-center">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide border shadow-2xs whitespace-nowrap" [ngClass]="getStatusBadgeClasses(item.status)">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="getStatusBadgeDot(item.status)"></span>
                    <span>{{ item.statusName }}</span>
                  </span>
                  @if (item.approvedByUserName) {
                    <div class="text-[10px] text-slate-400 mt-1 truncate max-w-[140px] mx-auto" title="Duyệt bởi: {{ item.approvedByUserName }}">
                      Duyệt: {{ item.approvedByUserName }}
                    </div>
                  }
                </td>

                <!-- 7. Action Button -->
                <td class="py-3.5 px-4 text-center">
                  @if (item.status === 'PendingApproval' && canApproveRefund()) {
                    <button
                      type="button"
                      (click)="openDetail(item)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                    >
                      <i class="pi pi-check-square text-xs"></i>
                      <span>Xét duyệt</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="openDetail(item)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                    >
                      <i class="pi pi-eye text-xs text-slate-500"></i>
                      <span>Chi tiết</span>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Stacked Card List (Visible on sm/mobile 375px) -->
      <div class="block md:hidden divide-y divide-slate-100">
        @for (item of items(); track item.paymentId) {
          <div class="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
            <!-- Header: Code & Status -->
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="font-bold text-slate-900 font-mono text-sm tracking-tight block">
                  {{ item.confirmationCode }}
                </span>
                <span class="text-xs font-medium text-slate-700 mt-0.5 block">
                  {{ item.guestName }}
                </span>
              </div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs shrink-0 whitespace-nowrap" [ngClass]="getStatusBadgeClasses(item.status)">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="getStatusBadgeDot(item.status)"></span>
                <span>{{ item.statusName }}</span>
              </span>
            </div>

            <!-- Property Info -->
            <div class="text-xs text-slate-500 flex items-center gap-1">
              <i class="pi pi-building text-[11px] text-slate-400"></i>
              <span>Chi nhánh: {{ item.propertyName }}</span>
            </div>

            <!-- Financial Card Block -->
            <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-xs">
              <div>
                <span class="text-[11px] text-slate-400 block">Đã thanh toán:</span>
                <span class="font-semibold text-slate-700 tabular-nums whitespace-nowrap">{{ item.paidAmount | number:'1.0-0' }} đ</span>
              </div>
              <div>
                <span class="text-[11px] text-slate-400 block">Phí hủy:</span>
                <span class="font-semibold text-rose-600 tabular-nums whitespace-nowrap">{{ item.cancellationFee | number:'1.0-0' }} đ</span>
              </div>
              <div class="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                <span class="font-bold text-slate-700">Được hoàn:</span>
                <span class="font-bold text-emerald-700 text-sm tabular-nums whitespace-nowrap">{{ item.refundableAmount | number:'1.0-0' }} đ</span>
              </div>
            </div>

            <!-- Card Footer: Date & Action Button -->
            <div class="flex items-center justify-between pt-1">
              <span class="text-xs text-slate-400 tabular-nums">
                {{ item.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}
              </span>
              @if (item.status === 'PendingApproval' && canApproveRefund()) {
                <button
                  type="button"
                  (click)="openDetail(item)"
                  class="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <i class="pi pi-check-square text-xs"></i>
                  <span>Xét duyệt</span>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="openDetail(item)"
                  class="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <i class="pi pi-eye text-xs text-slate-500"></i>
                  <span>Xem chi tiết</span>
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Pagination -->
      <app-pagination
        [totalCount]="totalCount()"
        [pageSize]="pageSize"
        [page]="pageIndex"
        (pageChange)="onPageChange($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      ></app-pagination>
    </div>
  }
</div>

<!-- ========================================================================= -->
<!-- 7. REDESIGNED DETAIL MODAL & AUDIT TRAIL SIDE PANEL (D23 WORKFLOW)         -->
<!-- ========================================================================= -->
@if (isDetailOpen()) {
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
    role="dialog"
    aria-modal="true"
    aria-label="Chi tiết yêu cầu hoàn tiền"
    cdkTrapFocus
    [cdkTrapFocusAutoCapture]="true"
    (keydown.escape)="closeDetail()"
    (click)="closeDetail()"
  >
    <div
      class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
      (click)="$event.stopPropagation()"
    >
      <!-- A. Modal Header (Fixed, Sticky Top) -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-20">
        <div>
          <h3 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Chi tiết yêu cầu hoàn tiền
          </h3>
          <div class="flex items-center gap-2.5 mt-1 flex-wrap text-xs">
            <span class="text-slate-500">Mã đặt phòng:</span>
            <span class="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {{ selectedDetail()?.confirmationCode || '...' }}
            </span>
            <span class="text-slate-300">•</span>
            <span class="text-slate-500">Chi nhánh:</span>
            <span class="font-medium text-slate-700">
              {{ selectedDetail()?.propertyName || activePropertyName() }}
            </span>
            <span class="text-slate-300">•</span>
            @if (selectedDetail(); as d) {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-2xs whitespace-nowrap" [ngClass]="getStatusBadgeClasses(d.status)">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="getStatusBadgeDot(d.status)"></span>
                <span>{{ d.statusName }}</span>
              </span>
            }
          </div>
        </div>

        <button
          type="button"
          (click)="closeDetail()"
          title="Đóng hộp thoại (ESC)"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <i class="pi pi-times text-base"></i>
        </button>
      </div>

      <!-- B. Modal Body (Scrollable Independently) -->
      <div class="p-6 overflow-y-auto space-y-6">
        @if (isLoadingDetail()) {
          <div class="space-y-4 py-8 animate-pulse">
            <div class="h-6 bg-slate-100 rounded-lg w-1/3"></div>
            <div class="h-20 bg-slate-100/70 rounded-xl"></div>
            <div class="h-28 bg-slate-100/70 rounded-xl"></div>
          </div>
        } @else if (selectedDetail(); as detail) {
          <!-- B1. COMPACT 3-STEP D23 TIMELINE -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-sitemap text-sky-600"></i>
                <span>Tiến trình xử lý theo Quyết định D23</span>
              </h4>
              <span class="text-[11px] text-slate-400">Quy trình 3 bước kiểm soát FSM</span>
            </div>

            <!-- Horizontal Desktop Stepper (Hidden on mobile) -->
            <div class="hidden sm:grid sm:grid-cols-3 gap-3">
              <!-- Step 1: Cancellation Request -->
              <div class="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-1 relative">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Bước 1: Khách hủy phòng</span>
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    <i class="pi pi-check text-[9px]"></i> Đã gửi
                  </span>
                </div>
                <div class="text-xs font-semibold text-slate-800">
                  {{ detail.guestName }}
                </div>
                <div class="text-[11px] text-slate-500 leading-snug">
                  Lý do: <span class="italic text-slate-700">{{ detail.notes || 'Khách tự hủy trực tuyến' }}</span>
                </div>
                <div class="text-[10px] text-slate-400 pt-0.5 flex items-center gap-1">
                  <i class="pi pi-clock text-[9px]"></i>
                  <span>{{ detail.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </div>

              <!-- Step 2: D23 Approval -->
              <div class="p-3.5 rounded-xl border shadow-2xs space-y-1 relative"
                   [ngClass]="{
                     'border-emerald-200 bg-emerald-50/20': detail.status === 'Approved' || detail.status === 'Completed',
                     'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200': detail.status === 'PendingApproval',
                     'border-rose-200 bg-rose-50/20': detail.status === 'Rejected'
                   }">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-wide"
                        [ngClass]="{
                          'text-emerald-800': detail.status === 'Approved' || detail.status === 'Completed',
                          'text-amber-800': detail.status === 'PendingApproval',
                          'text-rose-800': detail.status === 'Rejected'
                        }">Bước 2: Phê duyệt D23</span>
                  @if (detail.status === 'Approved' || detail.status === 'Completed') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      <i class="pi pi-check text-[9px]"></i> Đã duyệt
                    </span>
                  } @else if (detail.status === 'PendingApproval') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                      <i class="pi pi-clock text-[9px]"></i> Chờ duyệt
                    </span>
                  } @else if (detail.status === 'Rejected') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                      <i class="pi pi-times text-[9px]"></i> Từ chối
                    </span>
                  }
                </div>
                <div class="text-xs font-semibold text-slate-800">
                  @if (detail.status === 'PendingApproval') {
                    Chờ Quản lý / Chủ duyệt
                  } @else if (detail.status === 'Rejected') {
                    Đã từ chối hoàn tiền
                  } @else {
                    {{ detail.approvedByUserName || 'Quản lý có thẩm quyền' }}
                  }
                </div>
                <div class="text-[11px] text-slate-500 leading-snug truncate">
                  @if (detail.status === 'PendingApproval') {
                    Cần quyền PAYMENTS:Approve
                  } @else if (detail.status === 'Rejected') {
                    Lý do: {{ detail.rejectionReason || 'Không đủ điều kiện' }}
                  } @else {
                    Hạn mức hoàn: {{ detail.refundableAmount | number:'1.0-0' }} đ
                  }
                </div>
                <div class="text-[10px] text-slate-400 pt-0.5 flex items-center gap-1">
                  <i class="pi pi-clock text-[9px]"></i>
                  <span>{{ (detail.approvedAtUtc | date:'dd/MM/yyyy HH:mm') || (detail.status === 'PendingApproval' ? 'Chờ phê duyệt' : '—') }}</span>
                </div>
              </div>

              <!-- Step 3: Payout & Reconciliation -->
              <div class="p-3.5 rounded-xl border shadow-2xs space-y-1 relative"
                   [ngClass]="{
                     'border-emerald-200 bg-emerald-50/20': detail.status === 'Completed',
                     'border-sky-300 bg-sky-50/30 ring-1 ring-sky-200': detail.status === 'Approved',
                     'border-slate-200 bg-slate-50/40 opacity-70': detail.status === 'PendingApproval',
                     'border-slate-200 bg-slate-50/40 opacity-50': detail.status === 'Rejected'
                   }">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-wide"
                        [ngClass]="{
                          'text-emerald-800': detail.status === 'Completed',
                          'text-sky-800': detail.status === 'Approved',
                          'text-slate-500': detail.status === 'PendingApproval' || detail.status === 'Rejected'
                        }">Bước 3: Chi trả & Đối soát</span>
                  @if (detail.status === 'Completed') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      <i class="pi pi-check-circle text-[9px]"></i> Đã chi trả
                    </span>
                  } @else if (detail.status === 'Approved') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
                      <i class="pi pi-wallet text-[9px]"></i> Chờ chi trả
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                      <i class="pi pi-circle text-[9px]"></i> Chưa thực hiện
                    </span>
                  }
                </div>
                <div class="text-xs font-semibold text-slate-800">
                  @if (detail.status === 'Completed') {
                    {{ cleanBankRef(detail.bankTransactionRef) ? ('Chứng từ: ' + cleanBankRef(detail.bankTransactionRef)) : 'Đã chi trả đủ' }}
                  } @else if (detail.status === 'Approved') {
                    Sẵn sàng chi trả
                  } @else {
                    Chờ hoàn tất bước 2
                  }
                </div>
                <div class="text-[11px] text-slate-500 leading-snug">
                  @if (detail.status === 'Completed') {
                    PT: {{ getMethodLabel(detail.method) }}
                  } @else {
                    PT: Chưa xác định
                  }
                </div>
                <div class="text-[10px] text-slate-400 pt-0.5 flex items-center gap-1">
                  <i class="pi pi-clock text-[9px]"></i>
                  <span>{{ (detail.paidAtUtc | date:'dd/MM/yyyy HH:mm') || 'Chưa chi trả' }}</span>
                </div>
              </div>
            </div>

            <!-- Mobile Vertical Stepper (Visible on mobile 375px) -->
            <div class="sm:hidden space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
              <div class="space-y-0.5">
                <span class="text-[10px] font-bold text-emerald-700 uppercase">Bước 1: Khách hủy phòng</span>
                <div class="text-xs font-semibold text-slate-800">{{ detail.guestName }}</div>
                <div class="text-[11px] text-slate-500">{{ detail.notes || 'Khách tự hủy trực tuyến' }} ({{ detail.createdAtUtc | date:'dd/MM/yyyy HH:mm' }})</div>
              </div>

              <div class="space-y-0.5 pt-1 border-t border-slate-100">
                <span class="text-[10px] font-bold uppercase"
                      [ngClass]="detail.status === 'PendingApproval' ? 'text-amber-700' : (detail.status === 'Rejected' ? 'text-rose-700' : 'text-emerald-700')">
                  Bước 2: Phê duyệt D23 ({{ detail.statusName }})
                </span>
                <div class="text-xs font-semibold text-slate-800">
                  @if (detail.status === 'PendingApproval') {
                    Chờ Quản lý / Chủ duyệt
                  } @else if (detail.status === 'Rejected') {
                    Đã từ chối hoàn tiền
                  } @else {
                    {{ detail.approvedByUserName || 'Quản lý có thẩm quyền' }}
                  }
                </div>
                <div class="text-[11px] text-slate-500">{{ (detail.approvedAtUtc | date:'dd/MM/yyyy HH:mm') || (detail.status === 'PendingApproval' ? 'Chờ duyệt' : '—') }}</div>
              </div>

              <div class="space-y-0.5 pt-1 border-t border-slate-100">
                <span class="text-[10px] font-bold uppercase"
                      [ngClass]="detail.status === 'Completed' ? 'text-emerald-700' : (detail.status === 'Approved' ? 'text-sky-700' : 'text-slate-500')">
                  Bước 3: Chi trả & Đối soát
                </span>
                <div class="text-xs font-semibold text-slate-800">
                  @if (detail.status === 'Completed') {
                    PT: {{ getMethodLabel(detail.method) }} ({{ cleanBankRef(detail.bankTransactionRef) || 'Đã chi trả' }})
                  } @else if (detail.status === 'Approved') {
                    Chờ xác nhận chi trả
                  } @else {
                    Chưa thực hiện
                  }
                </div>
                <div class="text-[11px] text-slate-500">{{ (detail.paidAtUtc | date:'dd/MM/yyyy HH:mm') || 'Chưa chi trả' }}</div>
              </div>
            </div>
          </div>

          <!-- B2. FINANCIAL RECONCILIATION & POLICY BOX -->
          <div class="space-y-2.5">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <i class="pi pi-calculator text-emerald-600"></i>
              <span>Đối soát tài chính & Chính sách hủy</span>
            </h4>

            <!-- 4-Stat Financial Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span class="text-slate-500 block text-[11px] font-medium">Tổng giá trị booking</span>
                <span class="text-slate-800 font-bold text-sm tabular-nums whitespace-nowrap mt-0.5 block">
                  {{ detail.totalAmount | number:'1.0-0' }} đ
                </span>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span class="text-slate-500 block text-[11px] font-medium">Đã thanh toán</span>
                <span class="text-slate-800 font-bold text-sm tabular-nums whitespace-nowrap mt-0.5 block">
                  {{ detail.paidAmount | number:'1.0-0' }} đ
                </span>
              </div>

              <div class="p-3 rounded-xl border"
                   [ngClass]="detail.cancellationFee > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200/80'">
                <span class="block text-[11px] font-medium"
                      [class.text-rose-700]="detail.cancellationFee > 0"
                      [class.text-slate-500]="detail.cancellationFee === 0">Phí phạt hủy</span>
                <span class="font-bold text-sm tabular-nums whitespace-nowrap mt-0.5 block"
                      [class.text-rose-600]="detail.cancellationFee > 0"
                      [class.text-slate-800]="detail.cancellationFee === 0">
                  {{ detail.cancellationFee | number:'1.0-0' }} đ
                </span>
              </div>

              <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 shadow-2xs">
                <span class="text-emerald-800 block text-[11px] font-bold uppercase tracking-wide">Số tiền được hoàn</span>
                <span class="text-emerald-700 font-extrabold text-base tabular-nums whitespace-nowrap mt-0.5 block">
                  {{ detail.refundableAmount | number:'1.0-0' }} đ
                </span>
              </div>
            </div>

            <!-- Cancellation Policy Details -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
              <div class="flex items-start gap-2">
                <i class="pi pi-info-circle text-sky-600 mt-0.5 shrink-0 text-sm"></i>
                <div class="leading-relaxed">
                  <span class="font-semibold text-slate-800">Chính sách hủy áp dụng:</span>
                  <span class="ml-1 text-slate-600" [innerHTML]="formatPolicyDescription(detail.policyDescription)"></span>
                </div>
              </div>
              <div class="pl-6 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>Nhận phòng: <strong class="text-slate-700">{{ detail.checkInDate | date:'dd/MM/yyyy' }}</strong></span>
                <span>Thời điểm hủy: <strong class="text-slate-700">{{ detail.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</strong></span>
                <span>Khoảng thời gian: <strong class="text-slate-700">{{ detail.hoursUntilCheckIn >= 48 ? ((detail.hoursUntilCheckIn / 24 | number:'1.0-1') + ' ngày (' + (detail.hoursUntilCheckIn | number:'1.0-0') + ' giờ) trước nhận phòng') : (detail.hoursUntilCheckIn > 0 ? ((detail.hoursUntilCheckIn | number:'1.0-1') + ' giờ trước nhận phòng') : 'Sau thời điểm nhận phòng') }}</strong></span>
                @if (detail.cancellationFee === 0) {
                  <span class="text-emerald-700 font-semibold">• Đủ điều kiện miễn phí hủy</span>
                } @else {
                  <span class="text-rose-600 font-semibold">• Áp dụng phí phạt theo mốc thời gian</span>
                }
              </div>
            </div>
          </div>

          <!-- B3. CUSTOMER & ROOM INFORMATION -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <i class="pi pi-id-card text-slate-600"></i>
              <span>Thông tin khách hàng & Phòng</span>
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 text-xs">
              <div>
                <span class="text-slate-400 block text-[11px]">Khách hàng:</span>
                <span class="font-semibold text-slate-800">{{ detail.guestName }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Số điện thoại:</span>
                <span class="font-mono text-slate-800">{{ detail.guestPhone || '—' }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Email:</span>
                <span class="font-mono text-slate-800">{{ detail.guestEmail || '—' }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Hạng phòng:</span>
                <span class="font-medium text-slate-800">{{ detail.roomTypeName }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Số phòng:</span>
                <span class="font-semibold text-slate-800">{{ detail.roomNumber }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Thời gian lưu trú:</span>
                <span class="font-medium text-slate-800">{{ detail.checkInDate | date:'dd/MM/yyyy' }} — {{ detail.checkOutDate | date:'dd/MM/yyyy' }}</span>
              </div>
            </div>
          </div>

          <!-- B4. ORIGINAL PAYMENT TRANSACTIONS (METADATA SANITIZED) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-credit-card text-slate-600"></i>
                <span>Lịch sử các giao dịch đã thu trước đó</span>
              </h4>
              <span class="text-[11px] text-slate-400">Đã kiểm toán hệ thống</span>
            </div>

            @if (detail.originalPayments.length === 0) {
              <div class="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200/60">
                Chưa ghi nhận giao dịch thanh toán gốc nào trong hệ thống.
              </div>
            } @else {
              <div class="overflow-x-auto rounded-xl border border-slate-200/80">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th class="py-2.5 px-3">Phương thức</th>
                      <th class="py-2.5 px-3 text-right">Số tiền</th>
                      <th class="py-2.5 px-3">Trạng thái</th>
                      <th class="py-2.5 px-3">Mã GD nghiệp vụ</th>
                      <th class="py-2.5 px-3">Thời điểm thu</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 bg-white">
                    @for (p of detail.originalPayments; track p.id) {
                      @let parsed = parseTxRef(p.transactionRef);
                      <tr class="hover:bg-slate-50/50">
                        <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{{ getMethodLabel(p.methodName) }}</span>
                          @if (parsed.isDeposit) {
                            <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Đặt cọc
                            </span>
                          }
                        </td>
                        <td class="py-2.5 px-3 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {{ p.amount | number:'1.0-0' }} đ
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                                [class]="p.statusName === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'">
                            {{ p.statusName }}
                          </span>
                        </td>
                        <td class="py-2.5 px-3">
                          @if (parsed.businessRef) {
                            <span class="font-mono text-slate-900 font-medium text-xs">{{ parsed.businessRef }}</span>
                          } @else if (p.methodName === 'Cash' || p.methodName === '1') {
                            <span class="text-slate-500 italic text-[11px] flex items-center gap-1">
                              <i class="pi pi-money-bill text-[10px] text-slate-400"></i>
                              <span>Thu tiền mặt tại quầy</span>
                            </span>
                          } @else {
                            <span class="text-slate-400 italic text-[11px]">Thu thủ công — Chưa có mã tham chiếu</span>
                          }
                          @if (parsed.idempotencyKey) {
                            <div class="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title="Audit Idempotency: {{ parsed.idempotencyKey }}">
                              Audit: {{ parsed.idempotencyKey }}
                            </div>
                          }
                        </td>
                        <td class="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                          {{ (p.paidAtUtc || p.createdAtUtc) | date:'dd/MM/yyyy HH:mm' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- B5. PAYOUT EVIDENCE & AUDIT RECONCILIATION SUMMARY -->
          @if (detail.status === 'Completed') {
            <div class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-xs space-y-2">
              <div class="flex items-center justify-between">
                <div class="font-bold flex items-center gap-1.5 text-emerald-800">
                  <i class="pi pi-check-circle text-base text-emerald-600"></i>
                  <span class="text-xs uppercase tracking-wide">Thông tin chi trả & Đối soát thành công</span>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Đã đối soát
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-slate-700">
                <div>
                  <span class="text-slate-500 block text-[11px]">Mã bút toán chuyển tiền:</span>
                  <span class="font-mono font-bold text-slate-900 text-xs">
                    {{ cleanBankRef(detail.bankTransactionRef) || 'Đã đối soát' }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[11px]">Phương thức chi trả:</span>
                  <span class="font-medium text-slate-800">{{ getMethodLabel(detail.method) }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[11px]">Thời điểm chi trả:</span>
                  <span class="font-medium text-slate-800 tabular-nums">{{ detail.paidAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </div>
            </div>
          } @else if (detail.status === 'Approved') {
            <div class="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 text-xs text-sky-900 flex items-start gap-2.5">
              <i class="pi pi-verified text-sky-600 text-base mt-0.5 shrink-0"></i>
              <div>
                <span class="font-bold text-sky-950 block">Yêu cầu đã được phê duyệt hạn mức</span>
                <span class="text-sky-800">Thu ngân thực hiện chi trả qua ngân hàng hoặc tiền mặt, sau đó bấm <strong>"Xác nhận chi trả"</strong> để cập nhật mã bút toán.</span>
              </div>
            </div>
          } @else if (detail.status === 'Rejected') {
            <div class="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-900 space-y-1">
              <div class="font-bold flex items-center gap-1.5 text-rose-800">
                <i class="pi pi-times-circle text-base"></i>
                <span>Lý do từ chối yêu cầu hoàn tiền:</span>
              </div>
              <p class="leading-relaxed pl-5 font-medium text-rose-950">{{ detail.rejectionReason || 'Không đủ điều kiện hoàn theo quy định' }}</p>
            </div>
          }
        }
      </div>

      <!-- C. Modal Footer (Fixed & Responsive Bottom) -->
      @if (selectedDetail(); as detail) {
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/95 sticky bottom-0 z-20">
          <div>
            @if (!canApproveRefund()) {
              <div class="text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
                <i class="pi pi-lock text-amber-600"></i>
                <span>Cần quyền Quản lý chi nhánh (Manager) hoặc Chủ khách sạn (Owner) để phê duyệt / chi trả.</span>
              </div>
            }
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <!-- Close button -->
            <button
              type="button"
              (click)="closeDetail()"
              class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Đóng
            </button>

            <!-- Actions available only for users with PAYMENTS:Approve -->
            @if (canApproveRefund()) {
              <!-- If PendingApproval: Approve or Reject -->
              @if (detail.status === 'PendingApproval') {
                <button
                  type="button"
                  (click)="promptReject()"
                  [disabled]="isSubmitting()"
                  class="px-4 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <i class="pi pi-times mr-1"></i>
                  <span>Từ chối</span>
                </button>

                <button
                  type="button"
                  (click)="promptApprove()"
                  [disabled]="isSubmitting()"
                  class="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <i class="pi pi-check text-xs"></i>
                  <span>Phê duyệt yêu cầu</span>
                </button>
              }

              <!-- If Approved: Confirm Payout -->
              @if (detail.status === 'Approved') {
                <button
                  type="button"
                  (click)="promptConfirmPayout()"
                  [disabled]="isSubmitting()"
                  class="px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <i class="pi pi-wallet text-xs"></i>
                  <span>Xác nhận chi trả</span>
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  </div>
}

<!-- ========================================================================= -->
<!-- 8. ACTION CONFIRMATION MODAL (APPROVE / REJECT / CONFIRM PAYOUT)           -->
<!-- ========================================================================= -->
@if (isActionModalOpen()) {
  <div
    class="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn"
    role="dialog"
    aria-modal="true"
    aria-label="Xác nhận thao tác hoàn tiền"
    cdkTrapFocus
    [cdkTrapFocusAutoCapture]="true"
    (keydown.escape)="closeActionModal()"
    (click)="closeActionModal()"
  >
    <div
      class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4"
      (click)="$event.stopPropagation()"
    >
      <!-- Modal Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          @if (actionModalType() === 'approve') {
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <i class="pi pi-check text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Phê duyệt Yêu cầu Hoàn tiền</h3>
              <p class="text-xs text-slate-500">Chuyển trạng thái sang "Đã duyệt - Chờ chi trả"</p>
            </div>
          } @else if (actionModalType() === 'reject') {
            <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <i class="pi pi-times text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Từ chối Yêu cầu Hoàn tiền</h3>
              <p class="text-xs text-slate-500">Hủy yêu cầu hoàn tiền và lưu lý do vào biên bản kiểm toán</p>
            </div>
          } @else if (actionModalType() === 'confirmPayout') {
            <div class="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <i class="pi pi-verified text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Xác nhận Đã Chi Trả Hoàn Tiền</h3>
              <p class="text-xs text-slate-500">Ghi nhận chi trả thủ công bởi nhân viên có thẩm quyền</p>
            </div>
          }
        </div>

        <button
          type="button"
          (click)="closeActionModal()"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <i class="pi pi-times text-sm"></i>
        </button>
      </div>

      <!-- Financial Confirmation Notice -->
      @if (selectedDetail(); as detail) {
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
          <div class="flex justify-between">
            <span class="text-slate-500">Mã đơn đặt:</span>
            <strong class="font-mono text-slate-800">{{ detail.confirmationCode }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Khách hàng:</span>
            <strong class="text-slate-800">{{ detail.guestName }}</strong>
          </div>
          <div class="flex justify-between pt-1 border-t border-slate-200/60">
            <span class="font-bold text-slate-700">Số tiền được hoàn:</span>
            <strong class="font-bold text-emerald-700 text-sm tabular-nums whitespace-nowrap">{{ detail.refundableAmount | number:'1.0-0' }} đ</strong>
          </div>
        </div>
      }

      <!-- Form Inputs based on Action Type -->
      @if (actionModalType() === 'approve') {
        <div class="space-y-1.5">
          <label for="approveNotesInput" class="text-xs font-semibold text-slate-700">Ghi chú phê duyệt (Tùy chọn):</label>
          <textarea
            id="approveNotesInput"
            [(ngModel)]="actionNotes"
            rows="3"
            placeholder="Ví dụ: Đã kiểm tra lý do hủy phòng, đồng ý hoàn 100% theo chính sách..."
            class="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
          ></textarea>
        </div>
      } @else if (actionModalType() === 'reject') {
        <div class="space-y-1.5">
          <label for="rejectReasonInput" class="text-xs font-semibold text-rose-800">
            Lý do từ chối <span class="text-rose-500 font-bold">*</span> (Bắt buộc):
          </label>
          <textarea
            id="rejectReasonInput"
            [(ngModel)]="rejectionReason"
            rows="3"
            required
            placeholder="Ví dụ: Khách vi phạm điều khoản check-in hoặc thông tin tài khoản không trùng khớp..."
            class="w-full p-2.5 text-xs rounded-lg border border-rose-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 shadow-2xs"
          ></textarea>
        </div>
      } @else if (actionModalType() === 'confirmPayout') {
        <div class="space-y-3">
          <!-- Manual Operation Disclaimer Notice -->
          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <i class="pi pi-exclamation-triangle text-amber-600 mt-0.5 shrink-0 text-sm"></i>
            <div class="leading-relaxed">
              <span class="font-bold block text-amber-950">Quy trình ghi nhận chi trả thủ công:</span>
              <span>Hệ thống không tự động chuyển tiền qua ngân hàng. Thao tác này nhằm ghi nhận nhân viên có thẩm quyền đã thực hiện chi trả thực tế cho khách qua tài khoản hoặc tiền mặt.</span>
            </div>
          </div>

          <!-- Payout Method Selection -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-700">Phương thức chi trả thực tế <span class="text-rose-500 font-bold">*</span>:</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="payoutMethod = PaymentMethod.BankTransfer"
                [class]="payoutMethod === PaymentMethod.BankTransfer ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                class="p-2.5 rounded-lg border text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <i class="pi pi-building-columns text-sm text-sky-600"></i>
                <span>Chuyển khoản (BankTransfer)</span>
              </button>
              <button
                type="button"
                (click)="payoutMethod = PaymentMethod.Cash"
                [class]="payoutMethod === PaymentMethod.Cash ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                class="p-2.5 rounded-lg border text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <i class="pi pi-wallet text-sm text-emerald-600"></i>
                <span>Tiền mặt (Cash)</span>
              </button>
            </div>
          </div>

          <!-- Transaction Reference (Mandatory) -->
          <div class="space-y-1.5">
            <label for="payoutBankRefInput" class="text-xs font-semibold text-slate-700">
              @if (payoutMethod === PaymentMethod.Cash) {
                Số phiếu chi tiền mặt / Chứng từ nội bộ <span class="text-rose-500 font-bold">*</span> (Bắt buộc):
              } @else {
                Mã giao dịch ngân hàng / Bút toán đối soát <span class="text-rose-500 font-bold">*</span> (Bắt buộc):
              }
            </label>
            <input
              id="payoutBankRefInput"
              type="text"
              [(ngModel)]="bankTransactionRef"
              [placeholder]="payoutMethod === PaymentMethod.Cash ? 'Ví dụ: PC-2026-10-001 hoặc PT-10492...' : 'Ví dụ: VCB-1039847291 hoặc FT240918239...'"
              class="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
            <p class="text-[11px] text-slate-400">
              @if (payoutMethod === PaymentMethod.Cash) {
                Nhập số phiếu chi có chữ ký xác nhận của người nhận tiền tại quầy chi nhánh.
              } @else {
                Nhập mã tham chiếu từ ủy nhiệm chi hoặc ứng dụng ngân hàng sau khi chuyển khoản.
              }
            </p>
          </div>

          <!-- Notes -->
          <div class="space-y-1.5">
            <label for="payoutNotesInput" class="text-xs font-semibold text-slate-700">Ghi chú chi trả (Tùy chọn):</label>
            <textarea
              id="payoutNotesInput"
              [(ngModel)]="actionNotes"
              rows="2"
              placeholder="Ghi chú thêm về chứng từ chi trả..."
              class="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            ></textarea>
          </div>
        </div>
      }

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          (click)="closeActionModal()"
          [disabled]="isSubmitting()"
          class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          Hủy bỏ
        </button>

        <button
          type="button"
          (click)="submitAction()"
          [disabled]="isSubmitting()"
          [ngClass]="{
            'bg-emerald-600 hover:bg-emerald-700 text-white': actionModalType() === 'approve',
            'bg-rose-600 hover:bg-rose-700 text-white': actionModalType() === 'reject',
            'bg-sky-600 hover:bg-sky-700 text-white': actionModalType() === 'confirmPayout'
          }"
          class="px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
        >
          @if (isSubmitting()) {
            <i class="pi pi-spin pi-spinner text-xs"></i>
            <span>Đang xử lý...</span>
          } @else {
            @if (actionModalType() === 'approve') {
              <i class="pi pi-check text-xs"></i>
              <span>Xác nhận Duyệt</span>
            } @else if (actionModalType() === 'reject') {
              <i class="pi pi-times text-xs"></i>
              <span>Xác nhận Từ chối</span>
            } @else if (actionModalType() === 'confirmPayout') {
              <i class="pi pi-check-circle text-xs"></i>
              <span>Xác nhận Đã Chi Trả</span>
            }
          }
        </button>
      </div>
    </div>
  </div>
}
`
})
export class RefundApprovalComponent implements OnInit, OnDestroy {
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAutoOpenCode: string | null = null;

  /** Mã đặt phòng truyền từ thông báo để tự động lọc và mở chi tiết hoàn tiền */
  readonly initialSearchCode = input<string | null>(null);
  readonly autoOpenTrigger = input<number>(0);

  // Context Signals
  readonly activePropertyId = computed(() => this.authService.activePropertyId());
  readonly activePropertyName = computed(() => this.authService.activePropertyName());

  // RBAC Permission: PAYMENTS:Approve is bit 16 per Decision D23
  readonly canApproveRefund = computed(() => this.authService.hasPermission('PAYMENTS', 16));

  // Table State
  readonly items = signal<RefundRequestDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // KPI Metrics Signals
  readonly totalPendingCount = computed(() =>
    this.items().filter(i => i.status === 'PendingApproval').length
  );
  readonly totalApprovedCount = computed(() =>
    this.items().filter(i => i.status === 'Approved').length
  );
  readonly totalCompletedCount = computed(() =>
    this.items().filter(i => i.status === 'Completed').length
  );
  readonly totalRefundAmount = computed(() =>
    this.items().reduce((acc, curr) => acc + curr.refundableAmount, 0)
  );

  // Filters
  readonly statusFilter = signal<string>('all');
  dateFromObj: Date | null = null;
  dateToObj: Date | null = null;
  searchTerm = '';
  pageIndex = 1;
  pageSize = 10;

  // Detail Modal State
  readonly isDetailOpen = signal<boolean>(false);
  readonly selectedDetail = signal<RefundRequestDetailDto | null>(null);
  readonly isLoadingDetail = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // Approval / Rejection / Payout Action Dialog States
  readonly isActionModalOpen = signal<boolean>(false);
  readonly actionModalType = signal<'approve' | 'reject' | 'confirmPayout' | null>(null);
  readonly PaymentMethod = PaymentMethod;
  actionNotes = '';
  rejectionReason = '';
  bankTransactionRef = '';
  payoutMethod: PaymentMethod = PaymentMethod.BankTransfer;

  constructor() {
    try {
      effect(() => {
        const code = this.initialSearchCode();
        const trigger = this.autoOpenTrigger();
        untracked(() => {
          if (code && code.trim() && trigger >= 0) {
            const cleanCode = code.trim().replace(/^#/, '');
            this.searchTerm = cleanCode;
            this.statusFilter.set('all');
            this.pageIndex = 1;
            this.pendingAutoOpenCode = cleanCode;
            if (this.activePropertyId()) {
              this.loadRefundRequests();
            }
          }
        });
      });
    } catch {
      // Bỏ qua trong môi trường kiểm thử độc lập
    }
  }

  ngOnInit(): void {
    const initCode = this.initialSearchCode()?.trim().replace(/^#/, '');
    if (initCode) {
      this.searchTerm = initCode;
      this.statusFilter.set('all');
      this.pageIndex = 1;
      this.pendingAutoOpenCode = initCode;
    }
    if (this.activePropertyId()) {
      this.loadRefundRequests();
    }
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  loadRefundRequests(): void {
    const propId = this.activePropertyId();
    if (!propId) {
      this.items.set([]);
      this.totalCount.set(0);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filter: GetRefundRequestsFilter = {
      propertyId: propId,
      status: this.statusFilter() !== 'all' ? this.statusFilter() : undefined,
      dateFrom: this.dateFromObj ? this.formatDateOnly(this.dateFromObj) : undefined,
      dateTo: this.dateToObj ? this.formatDateOnly(this.dateToObj) : undefined,
      searchTerm: this.searchTerm.trim() || undefined,
      page: this.pageIndex,
      pageSize: this.pageSize
    };

    this.paymentService.getRefundRequests(filter).subscribe({
      next: (res) => {
        const loadedItems = res.items || [];
        this.items.set(loadedItems);
        this.totalCount.set(res.totalCount || 0);
        this.isLoading.set(false);

        if (this.pendingAutoOpenCode) {
          const target = this.pendingAutoOpenCode.toUpperCase();
          this.pendingAutoOpenCode = null;
          const match =
            loadedItems.find(i => i.confirmationCode?.toUpperCase() === target) ||
            loadedItems.find(i => i.reservationId?.toUpperCase() === target) ||
            (loadedItems.length === 1 ? loadedItems[0] : undefined);
          if (match) {
            this.openDetail(match);
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.detail || err?.error?.message || 'Không thể tải danh sách yêu cầu hoàn tiền.';
        this.errorMessage.set(msg);
        this.alertService.toastError(msg);
      }
    });
  }

  onFilterStatusChange(status: string): void {
    this.statusFilter.set(status);
    this.pageIndex = 1;
    this.isLoading.set(true);
    this.loadRefundRequests();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.isLoading.set(true);
    this.searchDebounceTimer = setTimeout(() => {
      this.pageIndex = 1;
      this.loadRefundRequests();
    }, 300);
  }

  onSearchSubmit(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.isLoading.set(true);
    this.pageIndex = 1;
    this.loadRefundRequests();
  }

  onDateFilterChange(): void {
    this.pageIndex = 1;
    this.isLoading.set(true);
    this.loadRefundRequests();
  }

  resetFilters(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.statusFilter.set('all');
    this.dateFromObj = null;
    this.dateToObj = null;
    this.searchTerm = '';
    this.pageIndex = 1;
    this.isLoading.set(true);
    this.loadRefundRequests();
  }

  onPageChange(page: number): void {
    this.pageIndex = page;
    this.loadRefundRequests();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageIndex = 1;
    this.loadRefundRequests();
  }

  openDetail(item: RefundRequestDto): void {
    const propId = this.activePropertyId();
    if (!propId) return;

    this.isLoadingDetail.set(true);
    this.isDetailOpen.set(true);

    this.paymentService.getRefundRequestDetail(item.paymentId, propId).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.isLoadingDetail.set(false);
      },
      error: (err) => {
        this.isLoadingDetail.set(false);
        const msg = err?.error?.detail || err?.error?.message || 'Không thể tải chi tiết yêu cầu hoàn tiền.';
        this.alertService.toastError(msg);
      }
    });
  }

  closeDetail(): void {
    this.isDetailOpen.set(false);
    this.selectedDetail.set(null);
  }

  // --- Actions ---

  promptApprove(): void {
    this.actionModalType.set('approve');
    this.actionNotes = '';
    this.isActionModalOpen.set(true);
  }

  promptReject(): void {
    this.actionModalType.set('reject');
    this.rejectionReason = '';
    this.isActionModalOpen.set(true);
  }

  promptConfirmPayout(): void {
    this.actionModalType.set('confirmPayout');
    this.bankTransactionRef = '';
    this.actionNotes = '';
    this.payoutMethod = PaymentMethod.BankTransfer;
    this.isActionModalOpen.set(true);
  }

  closeActionModal(): void {
    this.isActionModalOpen.set(false);
    this.actionModalType.set(null);
  }

  submitAction(): void {
    const detail = this.selectedDetail();
    const propId = this.activePropertyId();
    if (!detail || !propId || this.isSubmitting()) return;

    const modalType = this.actionModalType();

    if (modalType === 'approve') {
      this.isSubmitting.set(true);
      this.paymentService.approveRefund(detail.paymentId, propId, this.actionNotes.trim() || undefined).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeActionModal();
          this.alertService.toastSuccess('Yêu cầu hoàn tiền đã được phê duyệt thành công.');
          this.refreshCurrentDetailAndList();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err?.error?.detail || err?.error?.message || 'Lỗi khi phê duyệt hoàn tiền.';
          this.alertService.toastError(msg);
        }
      });
    } else if (modalType === 'reject') {
      const reason = this.rejectionReason.trim();
      if (!reason) {
        this.alertService.toastWarning('Vui lòng nhập lý do từ chối yêu cầu.');
        return;
      }

      this.isSubmitting.set(true);
      this.paymentService.rejectRefund(detail.paymentId, propId, reason).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeActionModal();
          this.alertService.toastSuccess('Đã từ chối yêu cầu hoàn tiền thành công.');
          this.refreshCurrentDetailAndList();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err?.error?.detail || err?.error?.message || 'Lỗi khi từ chối hoàn tiền.';
          this.alertService.toastError(msg);
        }
      });
    } else if (modalType === 'confirmPayout') {
      const bankRef = this.bankTransactionRef.trim();
      if (!bankRef) {
        const warningMsg = this.payoutMethod === PaymentMethod.Cash
          ? 'Vui lòng nhập số phiếu chi tiền mặt / chứng từ nội bộ.'
          : 'Vui lòng nhập mã đối soát / mã giao dịch ngân hàng.';
        this.alertService.toastWarning(warningMsg);
        return;
      }

      const req: ConfirmRefundPayoutRequest = {
        payoutMethod: this.payoutMethod,
        bankTransactionRef: bankRef,
        notes: this.actionNotes.trim() || undefined
      };

      this.isSubmitting.set(true);
      this.paymentService.confirmRefundPayout(detail.paymentId, propId, req).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeActionModal();
          this.alertService.toastSuccess('Đã xác nhận chi trả hoàn tiền thành công.');
          this.refreshCurrentDetailAndList();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err?.error?.detail || err?.error?.message || 'Lỗi khi xác nhận chi trả.';
          this.alertService.toastError(msg);
        }
      });
    }
  }

  private refreshCurrentDetailAndList(): void {
    const detail = this.selectedDetail();
    const propId = this.activePropertyId();
    if (detail && propId) {
      this.paymentService.getRefundRequestDetail(detail.paymentId, propId).subscribe({
        next: (updatedDetail) => this.selectedDetail.set(updatedDetail),
        error: () => {}
      });
    }
    this.loadRefundRequests();
  }

  private formatDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getMethodLabel(method: string | number): string {
    return PAYMENT_METHOD_LABELS[method as PaymentMethod] || String(method);
  }

  parseTxRef(raw: string | null | undefined): ParsedTransactionRef {
    return parseTransactionRef(raw);
  }

  cleanBankRef(raw: string | null | undefined): string | null {
    return cleanBankTransactionRef(raw);
  }

  getStatusBadgeClasses(status: string): string {
    switch (status) {
      case 'PendingApproval':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Approved':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getStatusBadgeDot(status: string): string {
    switch (status) {
      case 'PendingApproval':
        return 'bg-amber-500';
      case 'Approved':
        return 'bg-sky-500';
      case 'Completed':
        return 'bg-emerald-500';
      case 'Rejected':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  }

  getStatusBadgeColor(status: string): 'amber' | 'blue' | 'emerald' | 'rose' | 'slate' {
    switch (status) {
      case 'PendingApproval':
        return 'amber';
      case 'Approved':
        return 'blue';
      case 'Completed':
        return 'emerald';
      case 'Rejected':
        return 'rose';
      default:
        return 'slate';
    }
  }

  formatPolicyDescription(desc: string | null | undefined): string {
    if (!desc) return '';
    return desc
      .replace(/(Ít nhất 24 giờ trước giờ nhận phòng)/g, '<strong class="text-slate-900 font-bold">$1</strong>')
      .replace(/(Ít nhất 2 giờ trước giờ nhận phòng)/g, '<strong class="text-slate-900 font-bold">$1</strong>')
      .replace(/(Trong vòng 24 giờ)/g, '<strong class="text-rose-700 font-bold">$1</strong>')
      .replace(/(Trong vòng 2 giờ)/g, '<strong class="text-rose-700 font-bold">$1</strong>')
      .replace(/(Phí phạt 30%[^\.,;]*)/g, '<strong class="text-rose-700 font-bold">$1</strong>')
      .replace(/(Phí phạt 100%[^\.,;]*)/g, '<strong class="text-rose-700 font-bold">$1</strong>')
      .replace(/(Miễn phí hủy)/g, '<strong class="text-emerald-700 font-bold">$1</strong>');
  }
}
