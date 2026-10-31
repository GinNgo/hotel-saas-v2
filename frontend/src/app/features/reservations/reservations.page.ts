import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  ReservationDto,
  ReservationDetailDto,
  RoomAvailabilityDto,
  QuoteDto,
  RentalType,
  RENTAL_TYPE_LABELS,
  ReservationStatus,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_BADGE_CLASSES,
  CreateReservationRequest
} from '../../core/models/reservation.model';
import { RoomTypeDto } from '../../core/models/room-type.model';
import { RoomService } from '../../core/services/room.service';
import { RoomDto } from '../../core/models/room.model';
import { LocationService } from '../../core/services/location.service';
import { Province, Ward } from '../../core/models/location.model';
import { PolicyService } from '../../core/services/policy.service';
import { PropertyPoliciesDto } from '../../core/models/policy.model';
import { PaymentService } from '../../core/services/payment.service';
import { RoomStatus } from '../../core/models/enums';
import {
  PaymentDto,
  FolioDto,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  PaymentSummaryDto,
  CreatePaymentRequest as CreatePaymentDtoRequest
} from '../../core/models/payment.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DateRangeFilterComponent, DateRangeFilterValue } from '../../shared/components/date-range-filter/date-range-filter.component';

/** Helper to get today's date formatted as YYYY-MM-DD in Vietnam timezone (UTC+7) */
export function getTodayVnDateString(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vnDate = new Date(utc + (7 * 3600000));
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Helper to add days to a YYYY-MM-DD string */
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a YYYY-MM-DD date string to dd/MM/yyyy for Vietnamese UI presentation */
export function formatVnDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, DateRangeFilterComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Đặt phòng</h1>
            @if (activeProperty(); as prop) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {{ prop.name }}
              </span>
            }
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi danh sách đặt phòng, kiểm tra tồn phòng theo khoảng thời gian và tạo booking nội bộ với báo giá chính sách thật.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <!-- View Mode Toggle -->
          <div class="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              (click)="setViewMode('table')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer"
              [class.bg-white]="viewMode() === 'table'"
              [class.text-slate-800]="viewMode() === 'table'"
              [class.shadow-xs]="viewMode() === 'table'"
              [class.text-slate-500]="viewMode() !== 'table'"
              title="Xem danh sách bảng đặt phòng"
            >
              <i class="pi pi-list"></i>
              <span>Danh sách</span>
            </button>
            <button
              type="button"
              (click)="setViewMode('timeline')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer"
              [class.bg-white]="viewMode() === 'timeline'"
              [class.text-slate-800]="viewMode() === 'timeline'"
              [class.shadow-xs]="viewMode() === 'timeline'"
              [class.text-slate-500]="viewMode() !== 'timeline'"
              title="Xem sơ đồ lịch phòng theo thời gian (Timeline Gantt Grid)"
            >
              <i class="pi pi-calendar"></i>
              <span>Sơ đồ Timeline</span>
            </button>
          </div>

          <button
            type="button"
            (click)="onRefreshCurrentView()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <i class="pi pi-refresh" [class.animate-spin]="isLoading() || isTimelineLoading()"></i>
            <span>Làm mới</span>
          </button>

          @if (canReadPayment()) {
            <button
              type="button"
              (click)="openSummaryModal()"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              title="Xem tổng kết thu ngân trong ngày"
            >
              <i class="pi pi-wallet text-indigo-600"></i>
              <span>Báo cáo thu ngân</span>
            </button>
          }

          @if (canCreate()) {
            <button
              type="button"
              (click)="openCreateModal()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-xs shadow-emerald-600/30 cursor-pointer"
            >
              <i class="pi pi-plus"></i>
              <span>Tạo đặt phòng mới</span>
            </button>
          }
        </div>
      </div>

      @if (viewMode() === 'table') {
        <!-- Filters & Search Bar -->
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <!-- Search box -->
          <div class="lg:col-span-3">
            <label class="block text-xs font-medium text-slate-600 mb-1">Tìm kiếm</label>
            <div class="relative">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                placeholder="Mã đặt phòng, tên khách, SĐT, số phòng..."
                class="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <!-- Status filter -->
          <div class="lg:col-span-3">
            <label class="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
            <select
              [value]="selectedStatus() ?? ''"
              (change)="onStatusChange($event)"
              class="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option [value]="ReservationStatus.Confirmed">Đã xác nhận</option>
              <option [value]="ReservationStatus.CheckedIn">Đang lưu trú</option>
              <option [value]="ReservationStatus.PendingPayment">Chờ thanh toán</option>
              <option [value]="ReservationStatus.CheckedOut">Đã trả phòng</option>
              <option [value]="ReservationStatus.Cancelled">Đã hủy</option>
              <option [value]="ReservationStatus.NoShow">Vắng mặt (No-show)</option>
            </select>
          </div>

          <!-- Formatted Date Range Filter Component -->
          <div class="sm:col-span-2 lg:col-span-6">
            <app-date-range-filter
              label="Ngày lưu trú"
              [initialFromDate]="dateFrom()"
              [initialToDate]="dateTo()"
              (filterChange)="onDateRangeFilterChange($event)"
            />
          </div>
        </div>

        @if (searchQuery() || selectedStatus() !== null || dateFrom() || dateTo()) {
          <div class="flex justify-end pt-1">
            <button
              type="button"
              (click)="resetFilters()"
              class="text-xs text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
            >
              <i class="pi pi-filter-slash mr-1 text-[10px]"></i>Xóa bộ lọc
            </button>
          </div>
        }
      </div>

      <!-- Main Content / Table -->
      @if (isLoading()) {
        <div class="bg-white p-12 rounded-xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3">
          <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-slate-500">Đang tải danh sách đặt phòng...</span>
        </div>
      } @else if (errorMessage()) {
        <div class="bg-rose-50 p-6 rounded-xl border border-rose-200 text-center space-y-3">
          <i class="pi pi-exclamation-triangle text-2xl text-rose-600"></i>
          <p class="text-sm font-semibold text-rose-900">{{ errorMessage() }}</p>
          <button
            type="button"
            (click)="loadReservations()"
            class="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
          >
            Thử lại
          </button>
        </div>
      } @else if (reservations().length === 0) {
        <app-empty-state
          title="Chưa có đơn đặt phòng nào"
          description="Hiện tại không có đơn đặt phòng nào khớp với điều kiện lọc tại chi nhánh này."
          icon="pi pi-calendar"
        ></app-empty-state>
      } @else {
        <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th class="py-3 px-4">Mã đặt phòng</th>
                  <th class="py-3 px-4">Khách hàng</th>
                  <th class="py-3 px-4">Phòng & Loại phòng</th>
                  <th class="py-3 px-4">Hình thức</th>
                  <th class="py-3 px-4">Thời gian</th>
                  <th class="py-3 px-4 text-right">Tổng tiền</th>
                  <th class="py-3 px-4 text-center">Trạng thái</th>
                  <th class="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (res of reservations(); track res.id) {
                  <tr class="hover:bg-slate-50/60 transition-colors">
                    <!-- Confirmation code -->
                    <td class="py-3 px-4 font-mono font-bold text-emerald-700">
                      {{ res.confirmationCode }}
                    </td>

                    <!-- Guest -->
                    <td class="py-3 px-4">
                      <div class="font-semibold text-slate-800">{{ res.guestName }}</div>
                      <div class="text-[11px] text-slate-500">{{ res.guestPhone || res.guestEmail }}</div>
                    </td>

                    <!-- Room & RoomType -->
                    <td class="py-3 px-4">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-800 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                          {{ res.roomNumber }}
                        </span>
                        <span class="text-slate-600">{{ res.roomTypeName }}</span>
                      </div>
                    </td>

                    <!-- Rental Type -->
                    <td class="py-3 px-4">
                      @if (res.rentalType === RentalType.Hourly) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <i class="pi pi-clock mr-1 text-[9px]"></i>Theo giờ
                        </span>
                      } @else {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          <i class="pi pi-moon mr-1 text-[9px]"></i>Theo đêm
                        </span>
                      }
                    </td>

                    <!-- Dates -->
                    <td class="py-3 px-4 text-slate-600">
                      @if (res.rentalType === RentalType.Hourly) {
                        <div>{{ res.checkInDate }}</div>
                        <div class="text-[11px] text-slate-500">{{ formatUtcTime(res.startAtUtc) }} – {{ formatUtcTime(res.endAtUtc) }}</div>
                      } @else {
                        <div>{{ res.checkInDate }} ➔ {{ res.checkOutDate }}</div>
                        <div class="text-[11px] text-slate-500">{{ getNightCount(res.checkInDate, res.checkOutDate) }} đêm</div>
                      }
                    </td>

                    <!-- Total Amount -->
                    <td class="py-3 px-4 text-right font-bold text-slate-800">
                      {{ res.totalAmount | number:'1.0-0' }} đ
                    </td>

                    <!-- Status -->
                    <td class="py-3 px-4 text-center">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                        [ngClass]="getStatusBadgeClass(res.status)"
                      >
                        {{ getStatusLabel(res.status) }}
                      </span>
                    </td>

                    <!-- Action -->
                    <td class="py-3 px-4 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          (click)="viewDetails(res)"
                          class="px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition cursor-pointer"
                          title="Xem chi tiết và bảng kê giá"
                        >
                          Chi tiết
                        </button>

                        @if (canCheckInOut()) {
                          @if (res.status === ReservationStatus.Confirmed || res.status === ReservationStatus.PendingPayment) {
                            <button
                              type="button"
                              [disabled]="actionReservationId() === res.id || isActionLoading()"
                              (click)="openCheckInModal(res)"
                              class="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 rounded-md transition cursor-pointer flex items-center gap-1"
                              title="Mở thủ tục nhận phòng"
                            >
                              <i class="pi pi-sign-in text-[10px]" [class.animate-spin]="actionReservationId() === res.id"></i>
                              <span>Nhận phòng</span>
                            </button>
                          }
                          @if (res.status === ReservationStatus.CheckedIn) {
                            <button
                              type="button"
                              [disabled]="actionReservationId() === res.id || isActionLoading()"
                              (click)="openCheckOutModal(res)"
                              class="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 rounded-md transition cursor-pointer flex items-center gap-1"
                              title="Mở thủ tục trả phòng"
                            >
                              <i class="pi pi-sign-out text-[10px]" [class.animate-spin]="actionReservationId() === res.id"></i>
                              <span>Trả phòng</span>
                            </button>
                          }
                        }

                        @if (canCancel()) {
                          @if (res.status === ReservationStatus.Confirmed || res.status === ReservationStatus.PendingPayment) {
                            <button
                              type="button"
                              [disabled]="actionReservationId() === res.id || isActionLoading()"
                              (click)="openCancelModal(res)"
                              class="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-md transition cursor-pointer"
                              title="Hủy đặt phòng"
                            >
                              Hủy
                            </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Hiển thị <span class="font-semibold">{{ reservations().length }}</span> / <span class="font-semibold">{{ totalCount() }}</span> đơn đặt phòng
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                [disabled]="currentPage() <= 1"
                (click)="goToPage(currentPage() - 1)"
                class="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Trước
              </button>
              <span class="font-medium text-slate-700">Trang {{ currentPage() }} / {{ totalPages() }}</span>
              <button
                type="button"
                [disabled]="currentPage() >= totalPages()"
                (click)="goToPage(currentPage() + 1)"
                class="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      }
      }

      <!-- SƠ ĐỒ LỊCH PHÒNG THEO THỜI GIAN (ROOM TIMELINE / GANTT GRID) -->
      @if (viewMode() === 'timeline') {
        <div class="space-y-4">
          <!-- Timeline Controls Bar -->
          <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Left: Navigation & Date Picker -->
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="goToToday()"
                class="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition border border-emerald-200 cursor-pointer"
              >
                Hôm nay
              </button>

              <div class="inline-flex rounded-lg border border-slate-200 bg-white shadow-2xs">
                <button
                  type="button"
                  (click)="goToPreviousDays()"
                  class="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition rounded-l-lg border-r border-slate-200 cursor-pointer"
                  title="Khoảng thời gian trước"
                >
                  <i class="pi pi-chevron-left text-xs"></i>
                </button>
                <button
                  type="button"
                  (click)="goToNextDays()"
                  class="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition rounded-r-lg cursor-pointer"
                  title="Khoảng thời gian tiếp theo"
                >
                  <i class="pi pi-chevron-right text-xs"></i>
                </button>
              </div>

              <!-- Start Date Picker -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-slate-500 font-medium">Từ ngày:</span>
                <input
                  type="date"
                  [value]="timelineStartDate()"
                  (change)="onTimelineStartDateChange($event)"
                  class="px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                />
              </div>

              <!-- Duration Selector -->
              <div class="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  (click)="setTimelineDaysCount(7)"
                  class="px-2.5 py-1 rounded-md transition cursor-pointer"
                  [class.bg-white]="timelineDaysCount() === 7"
                  [class.text-slate-800]="timelineDaysCount() === 7"
                  [class.shadow-xs]="timelineDaysCount() === 7"
                  [class.text-slate-500]="timelineDaysCount() !== 7"
                >
                  7 ngày
                </button>
                <button
                  type="button"
                  (click)="setTimelineDaysCount(14)"
                  class="px-2.5 py-1 rounded-md transition cursor-pointer"
                  [class.bg-white]="timelineDaysCount() === 14"
                  [class.text-slate-800]="timelineDaysCount() === 14"
                  [class.shadow-xs]="timelineDaysCount() === 14"
                  [class.text-slate-500]="timelineDaysCount() !== 14"
                >
                  14 ngày
                </button>
              </div>
            </div>

            <!-- Right: Filter by floor & room type -->
            <div class="flex flex-wrap items-center gap-2">
              <select
                [value]="timelineFloorFilter() ?? ''"
                (change)="onTimelineFloorChange($event)"
                class="px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-700"
              >
                <option value="">Tất cả các tầng</option>
                @for (floor of timelineFloors(); track floor) {
                  <option [value]="floor">Tầng {{ floor }}</option>
                }
              </select>

              <select
                [value]="timelineRoomTypeFilter() ?? ''"
                (change)="onTimelineRoomTypeChange($event)"
                class="px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-700"
              >
                <option value="">Tất cả loại phòng</option>
                @for (rt of roomTypes(); track rt.id) {
                  <option [value]="rt.id">{{ rt.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Timeline Legend -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold text-slate-700">Trạng thái:</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Đã xác nhận</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>Đang lưu trú</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Chờ thanh toán</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                <span>Đã trả phòng</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
                <span>Theo giờ</span>
              </span>
            </div>

            <div class="text-slate-500 text-[11px] flex items-center gap-1">
              <i class="pi pi-info-circle text-emerald-600"></i>
              <span>Nhấp vào ô trống để đặt phòng nhanh cho ngày đó. Nhấp vào đơn để xem chi tiết.</span>
            </div>
          </div>

          <!-- Timeline Gantt Grid Container -->
          @if (isTimelineLoading()) {
            <div class="bg-white p-12 rounded-xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3">
              <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-xs text-slate-500">Đang tải dữ liệu sơ đồ phòng...</span>
            </div>
          } @else if (filteredTimelineRooms().length === 0) {
            <app-empty-state
              title="Không có phòng nào phù hợp"
              description="Hiện tại không có phòng nào trong danh mục hoặc không khớp với bộ lọc tầng/loại phòng đã chọn."
              icon="pi pi-building"
            ></app-empty-state>
          } @else {
            <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full border-collapse text-xs select-none">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <!-- Room header cell (Sticky left) -->
                      <th class="py-3 px-3 min-w-[150px] max-w-[170px] sticky left-0 z-20 bg-slate-100 border-r border-slate-200 text-left font-bold text-slate-800">
                        Phòng / Tầng
                      </th>

                      <!-- Date header cells -->
                      @for (col of timelineDates(); track col.dateStr) {
                        <th
                          class="py-2.5 px-2 text-center min-w-[110px] border-r border-slate-200 font-semibold"
                          [class.bg-emerald-50]="col.isToday"
                          [class.text-emerald-800]="col.isToday"
                          [class.bg-slate-50]="!col.isToday && !col.isWeekend"
                          [class.bg-slate-100/70]="!col.isToday && col.isWeekend"
                        >
                          <div class="text-[10px] uppercase font-bold tracking-wider" [class.text-emerald-700]="col.isToday" [class.text-slate-500]="!col.isToday">
                            {{ col.dayOfWeek }}
                          </div>
                          <div class="text-xs font-bold mt-0.5 flex items-center justify-center gap-1">
                            <span>{{ col.dayNumber }}/{{ col.month }}</span>
                            @if (col.isToday) {
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600" title="Hôm nay"></span>
                            }
                          </div>
                        </th>
                      }
                    </tr>
                  </thead>

                  <tbody class="divide-y divide-slate-100">
                    @for (room of filteredTimelineRooms(); track room.id) {
                      <tr class="hover:bg-slate-50/50 transition-colors">
                        <!-- Sticky Room Label Column -->
                        <td class="py-2.5 px-3 sticky left-0 z-10 bg-white border-r border-slate-200 shadow-2xs">
                          <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-800 text-xs">P.{{ room.roomNumber }}</span>
                            <span class="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">T{{ room.floor }}</span>
                          </div>
                          <div class="text-[10px] text-slate-500 truncate max-w-[125px]" [title]="room.roomTypeName">
                            {{ room.roomTypeName }}
                          </div>
                        </td>

                        <!-- Date Cells for this room -->
                        @for (col of timelineDates(); track col.dateStr) {
                          <td
                            class="p-1 border-r border-slate-200/80 align-top h-14 relative group transition-colors"
                            [class.bg-emerald-50/20]="col.isToday"
                          >
                            @let bookings = getRoomBookingsForDate(room.id, col.dateStr);

                            @if (bookings.length > 0) {
                              <div class="space-y-1">
                                @for (b of bookings; track b.id) {
                                  <div
                                    (click)="viewDetails(b)"
                                    [title]="getBookingTooltip(b)"
                                    class="p-1.5 rounded-md text-[10px] font-semibold transition cursor-pointer shadow-xs truncate flex flex-col justify-between"
                                    [ngClass]="getTimelineBookingBadgeClass(b, col.dateStr)"
                                  >
                                    <div class="flex items-center justify-between gap-1">
                                      <span class="truncate font-bold">{{ b.guestName }}</span>
                                      @if (b.rentalType === RentalType.Hourly) {
                                        <i class="pi pi-clock text-[9px]"></i>
                                      }
                                    </div>
                                    <div class="text-[9px] opacity-90 truncate">
                                      @if (b.rentalType === RentalType.Hourly) {
                                        {{ formatUtcTime(b.startAtUtc) }} - {{ formatUtcTime(b.endAtUtc) }}
                                      } @else {
                                        {{ b.confirmationCode }}
                                      }
                                    </div>
                                  </div>
                                }
                              </div>
                            } @else {
                              <!-- Free Cell -> Click to Quick Book -->
                              <button
                                type="button"
                                (click)="openCreateModalWithPrefill(room, col.dateStr)"
                                class="w-full h-full min-h-[44px] rounded-md border border-dashed border-transparent hover:border-emerald-300 hover:bg-emerald-50/60 transition flex items-center justify-center text-slate-300 hover:text-emerald-700 cursor-pointer"
                                [title]="'Đặt nhanh phòng ' + room.roomNumber + ' cho ngày ' + col.dateStr"
                              >
                                <i class="pi pi-plus text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                              </button>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }

      <!-- MODAL 1: VIEW RESERVATION DETAILS (IMMUTABLE SNAPSHOT) -->
      @if (selectedReservationDetail(); as detail) {
        <div
          class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          (click)="closeDetailModal()"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white rounded-2xl border border-slate-200/80 w-[min(54rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
          >
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-bold text-slate-900">Chi tiết đơn đặt phòng</h3>
                  <span class="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    {{ detail.confirmationCode }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-1">Bản chụp snapshot giá và chính sách bất biến tại thời điểm đặt.</p>
              </div>
              <button
                type="button"
                (click)="closeDetailModal()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-5 overflow-y-auto overflow-x-hidden text-xs flex-1 min-h-0">
              <!-- Customer & Room Info Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thông tin khách hàng</div>
                  <div class="text-sm font-bold text-slate-800">{{ detail.guestName }}</div>
                  <div class="text-slate-600"><i class="pi pi-envelope mr-1.5 text-slate-400"></i>{{ detail.guestEmail }}</div>
                  @if (detail.guestPhone) {
                    <div class="text-slate-600"><i class="pi pi-phone mr-1.5 text-slate-400"></i>{{ detail.guestPhone }}</div>
                  }
                  <div class="text-slate-600"><i class="pi pi-users mr-1.5 text-slate-400"></i>{{ detail.numberOfGuests }} khách</div>
                </div>

                <div class="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phòng & Thời gian</div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{{ detail.roomNumber }}</span>
                    <span class="text-slate-700 font-semibold">{{ detail.roomTypeName }}</span>
                  </div>
                  <div class="text-slate-600 font-medium">
                    Hình thức: {{ detail.rentalType === RentalType.Hourly ? 'Thuê theo giờ' : 'Thuê theo đêm' }}
                  </div>
                  <div class="text-slate-600">
                    {{ detail.checkInDate }} @if (detail.rentalType === RentalType.Hourly) { ({{ formatUtcTime(detail.startAtUtc) }} – {{ formatUtcTime(detail.endAtUtc) }}) } @else { ➔ {{ detail.checkOutDate }} }
                  </div>
                  <div>
                    Trạng thái:
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border" [ngClass]="getStatusBadgeClass(detail.status)">
                      {{ getStatusLabel(detail.status) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Immutable Pricing Breakdown -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <i class="pi pi-receipt text-emerald-600"></i>
                    Bảng kê giá snapshot (Không đổi khi bảng giá cập nhật)
                  </span>
                  <span class="text-[11px] text-slate-400 font-medium">Đơn vị: VND</span>
                </div>

                <div class="border border-slate-200 rounded-xl overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                        <th class="py-2.5 px-3">Khoản mục</th>
                        <th class="py-2.5 px-3 text-right">Đơn giá</th>
                        <th class="py-2.5 px-3 text-center">Số lượng</th>
                        <th class="py-2.5 px-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (item of detail.breakdown; track $index) {
                        <tr class="hover:bg-slate-50/50">
                          <td class="py-2 px-3 font-medium text-slate-800">{{ item.description }}</td>
                          <td class="py-2 px-3 text-right text-slate-600">{{ item.unitPrice | number:'1.0-0' }} đ</td>
                          <td class="py-2 px-3 text-center text-slate-600">{{ item.quantity }}</td>
                          <td class="py-2 px-3 text-right font-semibold text-slate-800">{{ item.amount | number:'1.0-0' }} đ</td>
                        </tr>
                      }
                      <tr class="bg-emerald-50/60 font-bold text-slate-900 border-t border-emerald-200">
                        <td colspan="3" class="py-2.5 px-3 text-right text-emerald-900">Tổng cộng:</td>
                        <td class="py-2.5 px-3 text-right text-sm text-emerald-800">{{ detail.totalAmount | number:'1.0-0' }} đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Financial Folio Statement & Payment Collection -->
              @if (canReadFolio()) {
                <div class="space-y-3 pt-3 border-t border-slate-200">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <i class="pi" [ngClass]="detail.status === ReservationStatus.Cancelled ? 'pi-file-check text-indigo-600' : 'pi-credit-card text-emerald-600'"></i>
                      {{ detail.status === ReservationStatus.Cancelled ? 'Đối soát tài chính sau hủy' : 'Bảng kê công nợ & Thanh toán (Folio)' }}
                    </span>
                    @if (folio(); as f) {
                      @if (f.reservationId === detail.id) {
                        @let badge = getFolioSettlementBadge(f, detail);
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          [ngClass]="badge.badgeClass"
                        >
                          <i class="pi mr-1 text-[9px]" [ngClass]="badge.iconClass"></i>
                          {{ badge.label }}
                        </span>
                      }
                    }
                  </div>

                  <!-- Folio KPI Metrics -->
                  @if (isLoadingFolio()) {
                    <div class="py-4 flex items-center justify-center gap-2 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                      <i class="pi pi-spinner animate-spin text-emerald-600 text-sm"></i>
                      <span>Đang tải số liệu công nợ folio...</span>
                    </div>
                  } @else if (folio(); as f) {
                    @if (f.reservationId === detail.id) {
                      @if (detail.status === ReservationStatus.Cancelled) {
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div class="text-[10px] text-slate-500 font-medium">Tổng giá trị ban đầu</div>
                            <div class="text-sm font-bold text-slate-800 mt-0.5">
                              {{ f.totalAmount | number:'1.0-0' }} đ
                            </div>
                          </div>

                          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div class="text-[10px] text-slate-500 font-medium">Đã thanh toán thực tế</div>
                            <div class="text-sm font-bold text-slate-800 mt-0.5">
                              {{ f.paidAmount | number:'1.0-0' }} đ
                            </div>
                          </div>

                          <div class="bg-rose-50/50 p-2.5 rounded-xl border border-rose-200/60">
                            <div class="text-[10px] text-rose-700 font-medium">Phí hủy áp dụng</div>
                            <div class="text-sm font-bold text-rose-800 mt-0.5">
                              {{ (f.cancellationFee ?? detail.cancellationFee ?? 0) | number:'1.0-0' }} đ
                            </div>
                            @if ((f.cancellationFee ?? detail.cancellationFee ?? 0) === 0) {
                              <div class="text-[10px] text-emerald-600 font-medium mt-0.5">Miễn phí hủy</div>
                            }
                          </div>

                          @if ((f.refundableAmount ?? detail.refundableAmount ?? 0) > 0) {
                            <div class="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70">
                              <div class="text-[10px] text-amber-700 font-medium">Khoản hoàn dự kiến</div>
                              <div class="text-sm font-bold text-amber-800 mt-0.5">
                                {{ (f.refundableAmount ?? detail.refundableAmount ?? 0) | number:'1.0-0' }} đ
                              </div>
                              <div class="text-[10px] font-medium mt-0.5" [ngClass]="f.refundStatus === 'Refunded' ? 'text-emerald-700' : 'text-amber-700'">
                                {{ f.refundStatus === 'Refunded' ? '(Đã chi trả)' : '(Chờ duyệt chuyển khoản)' }}
                              </div>
                            </div>
                          } @else if ((f.netCollectibleAmount ?? 0) > 0) {
                            <div class="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
                              <div class="text-[10px] text-rose-700 font-medium">Số tiền còn phải thu</div>
                              <div class="text-sm font-bold text-rose-800 mt-0.5">
                                {{ f.netCollectibleAmount | number:'1.0-0' }} đ
                              </div>
                              <div class="text-[10px] text-rose-600 font-medium mt-0.5">Thu bổ sung phí hủy</div>
                            </div>
                          } @else {
                            <div class="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
                              <div class="text-[10px] text-slate-500 font-medium">Dư nợ sau hủy</div>
                              <div class="text-sm font-bold text-slate-700 mt-0.5">
                                0 đ
                              </div>
                              <div class="text-[10px] text-slate-500 font-medium mt-0.5">Không phát sinh nợ</div>
                            </div>
                          }
                        </div>
                      } @else {
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div class="text-[10px] text-slate-500 font-medium">Tổng tiền phòng</div>
                            <div class="text-sm font-bold text-slate-800 mt-0.5">
                              {{ f.totalAmount | number:'1.0-0' }} đ
                            </div>
                          </div>

                          <div class="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/60">
                            <div class="text-[10px] text-emerald-700 font-medium">Đã thanh toán</div>
                            <div class="text-sm font-bold text-emerald-700 mt-0.5">
                              {{ f.paidAmount | number:'1.0-0' }} đ
                            </div>
                          </div>

                          <div class="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                            <div class="text-[10px] text-amber-700 font-medium">Dư nợ còn lại</div>
                            <div class="text-sm font-bold text-amber-800 mt-0.5">
                              {{ f.remainingBalance | number:'1.0-0' }} đ
                            </div>
                          </div>
                        </div>
                      }
                    }
                  } @else {
                    <div class="py-3 px-4 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 text-center flex items-center justify-between gap-2">
                      <span>Không thể tải thông tin công nợ Folio.</span>
                      <button
                        type="button"
                        (click)="loadFolio(detail.id, detail.propertyId)"
                        class="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-100 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  }

                  <!-- Payment Audit History Table -->
                  @if (folio(); as f) {
                    @if (f.reservationId === detail.id && f.payments?.length) {
                      <div class="border border-slate-200 rounded-xl overflow-x-auto">
                        <div class="bg-slate-100/70 px-3 py-1.5 font-semibold text-[11px] text-slate-700 border-b border-slate-200">
                          Lịch sử thu tiền & đặt cọc
                        </div>
                        <table class="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr class="bg-slate-50 text-slate-500 border-b border-slate-200">
                              <th class="py-1.5 px-3">Thời gian</th>
                              <th class="py-1.5 px-3">Phương thức</th>
                              <th class="py-1.5 px-3">Mã GD / Ghi chú</th>
                              <th class="py-1.5 px-3 text-right">Số tiền</th>
                              <th class="py-1.5 px-3 text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100">
                            @for (pay of f.payments; track pay.id) {
                              <tr class="hover:bg-slate-50/50">
                                <td class="py-1.5 px-3 text-slate-600">{{ formatUtcTime(pay.createdAtUtc) }}</td>
                                <td class="py-1.5 px-3 font-medium text-slate-800">
                                  <span class="inline-flex items-center gap-1">
                                    <i class="pi" [ngClass]="pay.method === PaymentMethod.Cash ? 'pi-money-bill text-emerald-600' : 'pi-building-columns text-blue-600'"></i>
                                    {{ pay.methodName }}
                                  </span>
                                </td>
                                <td class="py-1.5 px-3 text-slate-600 truncate max-w-[150px]" [title]="pay.transactionRef || ''">
                                  {{ pay.transactionRef || '—' }}
                                </td>
                                <td class="py-1.5 px-3 text-right font-semibold text-slate-800">
                                  {{ pay.amount | number:'1.0-0' }} đ
                                </td>
                                <td class="py-1.5 px-3 text-center">
                                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    {{ pay.statusName }}
                                  </span>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Record Manual Payment Section -->
                  @if (canCreatePayment() && folio(); as f) {
                    @if (f.reservationId === detail.id && !f.isFullyPaid && !isLoadingFolio() && detail.status !== ReservationStatus.Cancelled && detail.status !== ReservationStatus.CheckedOut) {
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <i class="pi pi-plus-circle text-emerald-600"></i>
                            Ghi nhận thu tiền / cọc thủ công
                          </span>
                          <button
                            type="button"
                            (click)="fillFullRemaining()"
                            class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            Thu đủ dư nợ ({{ f.remainingBalance | number:'1.0-0' }} đ)
                          </button>
                        </div>

                        <form [formGroup]="paymentForm" (ngSubmit)="onRecordPayment(detail)" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                          <div>
                            <label class="block text-[11px] font-medium text-slate-600 mb-1">Số tiền thu (VND) *</label>
                            <input
                              type="number"
                              formControlName="amount"
                              min="1000"
                              [max]="f.remainingBalance"
                              class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                            />
                          </div>

                          <div>
                            <label class="block text-[11px] font-medium text-slate-600 mb-1">Phương thức *</label>
                            <select
                              formControlName="method"
                              class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                            >
                              <option [value]="PaymentMethod.Cash">Tiền mặt</option>
                              <option [value]="PaymentMethod.BankTransfer">Chuyển khoản</option>
                            </select>
                          </div>

                          <div>
                            <label class="block text-[11px] font-medium text-slate-600 mb-1">Mã tham chiếu / Ghi chú</label>
                            <input
                              type="text"
                              formControlName="transactionRef"
                              placeholder="Mã GD ngân hàng, số biên lai..."
                              class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                            />
                          </div>

                          <div class="sm:col-span-3 flex justify-end pt-1">
                            <button
                              type="submit"
                              [disabled]="paymentForm.invalid || isSubmittingPayment() || isLoadingFolio()"
                              class="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <i class="pi pi-check" [class.animate-spin]="isSubmittingPayment()"></i>
                              <span>Xác nhận thu tiền</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    }
                  }
                </div>
              }

              <!-- Applied Operational Policies -->
              @if (detail.appliedPolicies; as pol) {
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div class="font-bold text-slate-700">Chính sách vận hành áp dụng:</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>• Đệm dọn phòng tối thiểu: <b>{{ pol.bufferMinutes }} phút</b></div>
                    <div>• Giới hạn thuê giờ: <b>{{ pol.maxHourlyHours }} giờ</b></div>
                    <div>• Giờ nhận phòng đêm: <b>{{ pol.checkInTime }}</b></div>
                    <div>• Giờ trả phòng đêm: <b>{{ pol.checkOutTime }}</b></div>
                  </div>
                </div>
              }

              @if (detail.cancelledAtUtc) {
                <div class="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200 text-xs space-y-1.5">
                  <div class="font-bold text-rose-900 flex items-center gap-1.5">
                    <i class="pi pi-ban text-rose-600"></i> Thông tin hủy đặt phòng
                  </div>
                  <div class="text-rose-800">Thời gian hủy: <b>{{ formatVietnamFullDateTime(detail.cancelledAtUtc) }}</b></div>
                  @if (detail.cancellationReason) {
                    <div class="text-rose-800">Lý do hủy: <b>{{ detail.cancellationReason }}</b></div>
                  }
                </div>
              }

              @if (detail.notes && !isSystemNote(detail.notes)) {
                <div class="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs">
                  <span class="font-semibold text-amber-900">Ghi chú của khách:</span>
                  <p class="text-amber-800 mt-0.5">{{ detail.notes }}</p>
                </div>
              } @else if (detail.notes && isSystemNote(detail.notes)) {
                <div class="bg-slate-100/80 p-3 rounded-xl border border-slate-200 text-xs">
                  <span class="font-semibold text-slate-700 flex items-center gap-1.5">
                    <i class="pi pi-info-circle text-slate-500"></i> Ghi chú hệ thống:
                  </span>
                  <p class="text-slate-600 mt-0.5">{{ detail.notes }}</p>
                </div>
              }
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <div class="flex items-center gap-2">
                  @if (canCheckInOut()) {
                    @if (detail.status === ReservationStatus.Confirmed || detail.status === ReservationStatus.PendingPayment) {
                      <button
                        type="button"
                        [disabled]="isActionLoading()"
                        (click)="openCheckInModal(detail)"
                        class="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <i class="pi pi-sign-in" [class.animate-spin]="isActionLoading()"></i>
                        <span>Nhận phòng</span>
                      </button>
                    }
                    @if (detail.status === ReservationStatus.CheckedIn) {
                      <button
                        type="button"
                        [disabled]="isActionLoading()"
                        (click)="openCheckOutModal(detail)"
                        class="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Trả phòng"
                      >
                        <i class="pi pi-sign-out" [class.animate-spin]="isActionLoading()"></i>
                        <span>Trả phòng</span>
                      </button>
                      @if (folio()?.reservationId === detail.id && (folio()?.remainingBalance ?? 0) > 0) {
                        <span class="text-[11px] text-amber-700 font-medium">
                          <i class="pi pi-exclamation-triangle mr-1"></i>Còn nợ {{ folio()?.remainingBalance | number:'1.0-0' }} đ (thu đủ trước khi trả phòng)
                        </span>
                      }
                    }
                  }
                  @if (canCancel()) {
                    @if (detail.status === ReservationStatus.Confirmed || detail.status === ReservationStatus.PendingPayment) {
                      <button
                        type="button"
                        [disabled]="isActionLoading()"
                        (click)="openCancelModal(detail)"
                        class="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <i class="pi pi-times-circle"></i>
                        <span>Hủy đặt phòng</span>
                      </button>
                    }
                  }
                </div>
              </div>

              <button
                type="button"
                (click)="closeDetailModal()"
                class="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 2: CREATE NEW RESERVATION -->
      @if (isCreateModalOpen()) {
        <div
          class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          (click)="closeCreateModal()"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white rounded-2xl border border-slate-200/80 w-[min(64rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
          >
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div>
                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                  <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-calendar-plus text-sm"></i>
                  </div>
                  <span>Tạo đặt phòng mới (Nội bộ)</span>
                </h3>
                <p class="text-xs text-slate-500 mt-1">
                  Chi nhánh: <b class="text-slate-700">{{ activeProperty()?.name }}</b>.
                  Chọn thời gian, tính giá thật và phân phòng vật lý.
                </p>
              </div>
              <button
                type="button"
                (click)="closeCreateModal()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <!-- Modal Form -->
            <form [formGroup]="createForm" (ngSubmit)="onSubmitCreate()" class="p-6 space-y-5 flex-1 min-h-0 overflow-y-auto text-xs">
              <!-- Section 1: Rental Type & Schedule -->
              <div class="space-y-3">
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">1. Hình thức & Thời gian lưu trú</div>

                <!-- Rental Type Radios -->
                <div class="flex flex-wrap items-center gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      formControlName="rentalType"
                      [value]="RentalType.Overnight"
                      (change)="onRentalTypeChanged()"
                      class="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span class="font-semibold text-slate-800">Thuê theo đêm</span>
                  </label>

                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      formControlName="rentalType"
                      [value]="RentalType.Hourly"
                      (change)="onRentalTypeChanged()"
                      class="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span class="font-semibold text-slate-800">Thuê theo giờ</span>
                  </label>

                  <button
                    type="button"
                    (click)="applyDayUsePreset()"
                    class="px-2.5 py-1 rounded-md text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer"
                    [class.bg-amber-100]="isDayUsePresetActive()"
                    [class.border-amber-300]="isDayUsePresetActive()"
                    [class.text-amber-900]="isDayUsePresetActive()"
                    [class.bg-slate-100]="!isDayUsePresetActive()"
                    [class.border-slate-200]="!isDayUsePresetActive()"
                    [class.text-slate-600]="!isDayUsePresetActive()"
                    title="Cài đặt nhanh thuê theo giờ trong ngày (08:00 đến 18:00)"
                  >
                    <i class="pi pi-sun text-amber-500"></i>
                    <span>Trong ngày (Day-use: 08:00 - 18:00)</span>
                  </button>
                </div>

                <!-- Overnight date inputs -->
                @if (createForm.get('rentalType')?.value === RentalType.Overnight) {
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Ngày nhận phòng *</label>
                      <input
                        type="date"
                        formControlName="checkInDate"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">
                        Giờ nhận phòng *
                        @if (branchPolicies()?.checkInTime) {
                          <span class="text-[10px] text-emerald-600 font-normal ml-1">(Chuẩn: {{ branchPolicies()?.checkInTime?.slice(0, 5) }})</span>
                        } @else {
                          <span class="text-[10px] text-amber-600 font-normal ml-1">(Chọn giờ)</span>
                        }
                      </label>
                      <input
                        type="time"
                        formControlName="checkInTime"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Ngày trả phòng *</label>
                      <input
                        type="date"
                        formControlName="checkOutDate"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">
                        Giờ trả phòng *
                        @if (branchPolicies()?.checkOutTime) {
                          <span class="text-[10px] text-emerald-600 font-normal ml-1">(Chuẩn: {{ branchPolicies()?.checkOutTime?.slice(0, 5) }})</span>
                        } @else {
                          <span class="text-[10px] text-amber-600 font-normal ml-1">(Chọn giờ)</span>
                        }
                      </label>
                      <input
                        type="time"
                        formControlName="checkOutTime"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                } @else {
                  <!-- Hourly inputs -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Ngày thuê *</label>
                      <input
                        type="date"
                        formControlName="hourlyDate"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu *</label>
                      <input
                        type="time"
                        formControlName="hourlyStartTime"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc *</label>
                      <input
                        type="time"
                        formControlName="hourlyEndTime"
                        (change)="onScheduleInputsChanged()"
                        class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                }
              </div>

              <!-- Section 2: Room Type & Verification Button -->
              <div class="space-y-3 pt-2 border-t border-slate-100">
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2. Loại phòng & Kiểm tra phòng trống</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div class="sm:col-span-2">
                    <label class="block text-xs font-bold text-slate-700 mb-1">Loại phòng *</label>
                    <select
                      formControlName="roomTypeId"
                      (change)="onRoomTypeSelected()"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-semibold"
                    >
                      <option value="">-- Chọn loại phòng --</option>
                      @for (rt of roomTypes(); track rt.id) {
                        <option [value]="rt.id">{{ rt.name }} ({{ rt.code }})</option>
                      }
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      [disabled]="isCalculatingQuote() || !canCheckAvailability()"
                      (click)="onCalculateQuoteAndAvailability()"
                      class="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i class="pi pi-calculator" [class.animate-spin]="isCalculatingQuote()"></i>
                      <span>Kiểm tra & Tính giá</span>
                    </button>
                  </div>
                </div>

                @if (quoteError()) {
                  <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <i class="pi pi-times-circle mr-1"></i>{{ quoteError() }}
                  </div>
                }

                <!-- Calculated Quote Display -->
                @if (calculatedQuote(); as quote) {
                  <div class="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <i class="pi pi-check-circle text-emerald-600"></i>
                        Báo giá chính thức từ Quote Engine (TTL 5 phút)
                      </span>
                      <span class="text-sm font-bold text-emerald-800">{{ quote.totalAmount | number:'1.0-0' }} đ</span>
                    </div>

                    <div class="divide-y divide-emerald-200/50 bg-white/80 rounded-lg p-2.5 border border-emerald-200/60">
                      @for (item of quote.breakdown; track $index) {
                        <div class="flex justify-between py-1 text-[11px] text-slate-700">
                          <span>{{ item.description }} (x{{ item.quantity }})</span>
                          <span class="font-medium">{{ item.amount | number:'1.0-0' }} đ</span>
                        </div>
                      }
                      <div class="pt-2 mt-1 flex justify-between items-center text-xs text-amber-900 font-bold border-t border-emerald-200">
                        <span class="flex items-center gap-1.5">
                          <i class="pi pi-shield text-amber-600"></i>
                          <span>Tiền cọc yêu cầu giữ chỗ (50%):</span>
                        </span>
                        <span class="text-emerald-700 font-extrabold">{{ estimatedDeposit() | number:'1.0-0' }} đ</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- Physical Room Selection (Grouped by Floor) -->
                @if (availableRooms().length > 0) {
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <label class="block text-xs font-medium text-slate-700">
                        Chọn phòng vật lý cụ thể *
                        <span class="text-[11px] font-normal text-slate-500">({{ availableCount() }} phòng khả dụng)</span>
                      </label>
                      <span class="text-[10px] text-slate-400">Gom nhóm theo tầng lầu</span>
                    </div>

                    <div class="space-y-2.5">
                      @for (fg of availableRoomsByFloor(); track fg.floor) {
                        <div class="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 space-y-1.5">
                          <div class="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                            <span class="flex items-center gap-1.5">
                              <i class="pi pi-building text-slate-400 text-xs"></i>
                              Tầng {{ fg.floor }}
                            </span>
                            <span
                              class="text-[10px] px-1.5 py-0.5 rounded font-normal"
                              [class.bg-emerald-100]="fg.availableCount > 0"
                              [class.text-emerald-800]="fg.availableCount > 0"
                              [class.bg-slate-200]="fg.availableCount === 0"
                              [class.text-slate-600]="fg.availableCount === 0"
                            >
                              {{ fg.availableCount }}/{{ fg.totalCount }} phòng trống
                            </span>
                          </div>

                          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            @for (r of fg.rooms; track r.roomId) {
                              <button
                                type="button"
                                [disabled]="!r.isAvailable"
                                (click)="selectRoom(r)"
                                class="p-2.5 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer"
                                [class.border-emerald-600]="selectedRoomId() === r.roomId"
                                [class.bg-emerald-50]="selectedRoomId() === r.roomId"
                                [class.border-slate-200]="selectedRoomId() !== r.roomId && r.isAvailable"
                                [class.bg-white]="selectedRoomId() !== r.roomId && r.isAvailable"
                                [class.opacity-40]="!r.isAvailable"
                                [class.cursor-not-allowed]="!r.isAvailable"
                                [class.bg-slate-100]="!r.isAvailable"
                                [title]="r.conflictReason || 'Phòng sẵn sàng'"
                              >
                                <div class="flex items-center justify-between">
                                  <span class="font-bold text-sm text-slate-800">Phòng {{ r.roomNumber }}</span>
                                  @if (selectedRoomId() === r.roomId) {
                                    <i class="pi pi-check text-xs text-emerald-700"></i>
                                  }
                                </div>
                                <div class="text-[10px] text-slate-500 mt-1">
                                  Tầng {{ r.floor }} • {{ r.isAvailable ? 'Sẵn sàng' : 'Bận' }}
                                </div>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Section 3: Guest Information -->
              <div class="space-y-3 pt-2 border-t border-slate-100">
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">3. Thông tin khách hàng & Ghi chú</div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Họ và tên khách hàng *</label>
                    <input
                      type="text"
                      formControlName="guestName"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Email *</label>
                    <input
                      type="email"
                      formControlName="guestEmail"
                      placeholder="khachhang@example.com"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại</label>
                    <input
                      type="tel"
                      formControlName="guestPhone"
                      placeholder="0912 345 678"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">CCCD / Hộ chiếu</label>
                    <input
                      type="text"
                      formControlName="identityNumber"
                      placeholder="079... hoặc số Passport"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Quốc tịch</label>
                    <input
                      type="text"
                      formControlName="nationality"
                      placeholder="Việt Nam"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Số lượng khách *</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      formControlName="numberOfGuests"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-bold"
                    />
                  </div>

                  <!-- 2-level Administrative Hierarchy: Province -> Ward -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Tỉnh / Thành phố</span>
                      @if (isLoadingProvinces()) {
                        <i class="pi pi-spin pi-spinner text-slate-400 text-[10px]"></i>
                      }
                    </label>
                    <select
                      formControlName="provinceCode"
                      (change)="onProvinceChange($event)"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    >
                      <option value="">-- Chọn Tỉnh / Thành phố --</option>
                      @for (prov of provinces(); track prov.code) {
                        <option [value]="prov.code">{{ prov.name }}</option>
                      }
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Phường / Xã</span>
                      @if (isLoadingWards()) {
                        <i class="pi pi-spin pi-spinner text-slate-400 text-[10px]"></i>
                      }
                    </label>
                    <select
                      formControlName="wardCode"
                      (change)="onWardChange($event)"
                      [disabled]="!createForm.get('provinceCode')?.value || isLoadingWards()"
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs disabled:bg-slate-100 disabled:opacity-60 font-medium"
                    >
                      <option value="">-- Chọn Phường / Xã --</option>
                      @for (w of wards(); track w.code) {
                        <option [value]="w.code">{{ w.name }}</option>
                      }
                    </select>
                  </div>

                  <div class="sm:col-span-2 lg:col-span-1">
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Địa chỉ chi tiết</label>
                    <input
                      type="text"
                      formControlName="addressDetail"
                      placeholder="Số nhà, tên đường..."
                      class="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">Ghi chú đặt phòng</label>
                  <textarea
                    rows="2"
                    formControlName="customerNotes"
                    placeholder="Yêu cầu riêng của khách (ví dụ: tầng cao, check-in muộn)..."
                    class="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs"
                  ></textarea>
                </div>
              </div>

              <!-- Modal Actions -->
              <div class="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  (click)="closeCreateModal()"
                  class="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  [disabled]="isSubmitting() || !canSubmitCreate()"
                  class="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition shadow-sm shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <i class="pi pi-check" [class.animate-spin]="isSubmitting()"></i>
                  <span>Xác nhận tạo đặt phòng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL 3: CANCEL RESERVATION -->
      @if (cancelModalReservation(); as targetRes) {
        <div
          class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          (click)="closeCancelModal()"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white rounded-2xl border border-slate-200/80 w-[min(30rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
          >
            <div class="px-6 py-4 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <i class="pi pi-exclamation-circle text-base"></i>
                </div>
                <h3 class="text-base font-bold text-rose-950">Xác nhận hủy đặt phòng</h3>
              </div>
              <button
                type="button"
                (click)="closeCancelModal()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <div class="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              <p class="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn hủy đơn đặt phòng <span class="font-bold text-slate-900 font-mono">{{ targetRes.confirmationCode }}</span> của khách <span class="font-bold text-slate-900">{{ targetRes.guestName }}</span>?
              </p>
              <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 space-y-1.5">
                <div>Phòng: <span class="font-bold text-slate-800">Phòng {{ targetRes.roomNumber }}</span> ({{ targetRes.roomTypeName }})</div>
                <div>Thời gian: <span class="font-medium text-slate-800">{{ targetRes.checkInDate }}</span> @if (targetRes.rentalType === RentalType.Overnight) { ➔ <span class="font-medium text-slate-800">{{ targetRes.checkOutDate }}</span> }</div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5">Lý do hủy đặt phòng</label>
                <textarea
                  [value]="cancellationReasonInput()"
                  (input)="onCancellationReasonInput($event)"
                  rows="3"
                  placeholder="Nhập lý do khách hủy hoặc ghi chú hủy phòng..."
                  class="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 bg-white shadow-2xs"
                ></textarea>
              </div>
            </div>

            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                [disabled]="isActionLoading()"
                (click)="closeCancelModal()"
                class="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                [disabled]="isActionLoading()"
                (click)="confirmCancelReservation()"
                class="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 rounded-xl transition shadow-sm shadow-rose-600/30 flex items-center gap-2 cursor-pointer"
              >
                <i class="pi pi-times-circle" [class.animate-spin]="isActionLoading()"></i>
                <span>Xác nhận hủy</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: CHECK-IN (XÁC NHẬN NHẬN PHÒNG & ĐỐI CHIẾU CCCD) -->
      @if (isCheckInModalOpen()) {
        @if (checkInModalReservation(); as res) {
          <div
            class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
            role="dialog"
            aria-modal="true"
            (click)="closeCheckInModal()"
          >
            <div
              (click)="$event.stopPropagation()"
              class="bg-white rounded-2xl border border-slate-200/80 w-[min(42rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
            >
              <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <i class="pi pi-sign-in text-sm"></i>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Thủ tục nhận phòng (Check-in)</h3>
                    <span class="font-mono text-xs font-bold text-emerald-700">Mã: {{ res.confirmationCode }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="closeCheckInModal()"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <i class="pi pi-times text-sm"></i>
                </button>
              </div>

              <div class="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
                <!-- Room & Guest Info Card -->
                <div class="grid grid-cols-2 gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Khách hàng</span>
                    <span class="font-bold text-slate-900 text-sm">{{ res.guestName }}</span>
                    <span class="text-slate-500 text-[11px] block mt-0.5">{{ res.guestPhone || 'Không có SĐT' }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Phòng được giao</span>
                    <span class="font-bold text-emerald-800 text-sm">Phòng {{ res.roomNumber }}</span>
                    <span class="text-slate-500 text-[11px] block mt-0.5">{{ res.roomTypeName }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Thời gian nhận</span>
                    <span class="font-semibold text-slate-800">{{ res.checkInDate }} ({{ formatUtcTime(res.startAtUtc) }})</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Thời gian trả</span>
                    <span class="font-semibold text-slate-800">{{ res.checkOutDate }} ({{ formatUtcTime(res.endAtUtc) }})</span>
                  </div>
                </div>

                <!-- Identity Document Verification Step (Desk Verification) -->
                <div class="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div class="flex items-center justify-between">
                    <label class="block font-bold text-slate-800">
                      <i class="pi pi-id-card text-emerald-600 mr-1"></i>
                      Xác minh giấy tờ tùy thân (Kiểm tra tại quầy)
                    </label>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Đối chiếu trực quan
                    </span>
                  </div>
                  <label class="flex items-start gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 cursor-pointer hover:bg-slate-50 transition-colors shadow-2xs">
                    <input
                      type="checkbox"
                      [checked]="isIdentityVerified()"
                      (change)="toggleIdentityVerified()"
                      class="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span class="leading-relaxed">
                      Lễ tân xác nhận đã <b>đối chiếu trực tiếp giấy tờ tùy thân gốc</b> (CCCD / Hộ chiếu) của khách tại quầy. Hệ thống không lưu trữ hoặc truyền tải số giấy tờ qua API để tuân thủ quy định bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP).
                    </span>
                  </label>
                </div>

                <!-- Notes -->
                <div class="space-y-1.5">
                  <label class="block font-bold text-slate-700">Ghi chú nhận phòng</label>
                  <textarea
                    [value]="checkInNotesInput()"
                    (input)="onCheckInNotesInput($event)"
                    rows="2"
                    placeholder="Ghi chú thêm (vd: khách yêu cầu thẻ phòng phụ, lưu ý chìa khóa)..."
                    class="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white shadow-2xs"
                  ></textarea>
                </div>

                <!-- Operational Notice -->
                <div class="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <i class="pi pi-info-circle text-emerald-600 mt-0.5 shrink-0"></i>
                  <div>
                    Khi xác nhận, trạng thái phòng vật lý <b>Phòng {{ res.roomNumber }}</b> sẽ tự động chuyển sang màu đỏ <b>Occupied (Đang có khách)</b>.
                  </div>
                </div>
              </div>

              <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  (click)="closeCheckInModal()"
                  class="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  [disabled]="isActionLoading() || !isIdentityVerified()"
                  (click)="confirmCheckInModal()"
                  class="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <i class="pi pi-check" [class.animate-spin]="isActionLoading()"></i>
                  <span>Xác nhận nhận phòng</span>
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- MODAL: CHECK-OUT (TRẢ PHÒNG & KIỂM TRA CÔNG NỢ FOLIO) -->
      @if (isCheckOutModalOpen()) {
        @if (checkOutModalReservation(); as res) {
          <div
            class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
            role="dialog"
            aria-modal="true"
            (click)="closeCheckOutModal()"
          >
            <div
              (click)="$event.stopPropagation()"
              class="bg-white rounded-2xl border border-slate-200/80 w-[min(42rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
            >
              <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <i class="pi pi-sign-out text-sm"></i>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Thủ tục trả phòng (Check-out)</h3>
                    <span class="font-mono text-xs font-bold text-amber-700">Mã: {{ res.confirmationCode }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="closeCheckOutModal()"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <i class="pi pi-times text-sm"></i>
                </button>
              </div>

              <div class="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
                <!-- Room & Guest Info Card -->
                <div class="grid grid-cols-2 gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Khách hàng</span>
                    <span class="font-bold text-slate-900 text-sm">{{ res.guestName }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-[11px] block font-medium">Phòng trả</span>
                    <span class="font-bold text-amber-800 text-sm">Phòng {{ res.roomNumber }}</span>
                    <span class="text-slate-500 text-[11px] block mt-0.5">{{ res.roomTypeName }}</span>
                  </div>
                </div>

                <!-- Folio Financial Audit Card -->
                <div class="space-y-2">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i class="pi pi-wallet text-amber-600"></i>
                    Bảng kê công nợ & Quyết toán (Folio)
                  </span>

                  @if (isLoadingCheckOutFolio()) {
                    <div class="py-4 flex items-center justify-center gap-2 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                      <i class="pi pi-spinner animate-spin text-amber-600 text-sm"></i>
                      <span>Đang tải số liệu công nợ folio...</span>
                    </div>
                  } @else if (checkOutFolioError(); as errorMsg) {
                    <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-exclamation-triangle text-rose-600 text-sm shrink-0"></i>
                        <span>{{ errorMsg }}</span>
                      </div>
                      <button
                        type="button"
                        (click)="retryCheckOutFolio()"
                        class="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-100 rounded-xl transition shrink-0 cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  } @else if (checkOutFolio(); as f) {
                    <div class="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span class="text-[10px] text-slate-400 font-medium block">Tổng tiền phòng</span>
                        <span class="text-xs font-bold text-slate-800 font-mono">{{ f.totalAmount | number:'1.0-0' }} đ</span>
                      </div>
                      <div>
                        <span class="text-[10px] text-emerald-600 font-medium block">Đã thanh toán</span>
                        <span class="text-xs font-bold text-emerald-700 font-mono">{{ f.paidAmount | number:'1.0-0' }} đ</span>
                      </div>
                      <div>
                        <span class="text-[10px] text-amber-600 font-medium block">Số dư còn nợ</span>
                        <span class="text-xs font-bold text-amber-800 font-mono">{{ f.remainingBalance | number:'1.0-0' }} đ</span>
                      </div>
                    </div>

                    @if (f.remainingBalance > 0) {
                      <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                        <div class="flex items-center gap-1.5 font-bold">
                          <i class="pi pi-exclamation-triangle text-rose-600"></i>
                          <span>Chưa thể trả phòng: Còn dư nợ {{ f.remainingBalance | number:'1.0-0' }} đ</span>
                        </div>
                        <p class="text-[11px] text-rose-700">
                          Quy định POL-IO03 yêu cầu thanh toán đủ 100% công nợ trước khi hoàn tất trả phòng.
                        </p>
                      </div>
                    } @else {
                      <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                        <i class="pi pi-check-circle text-emerald-600 text-base"></i>
                        <div>
                          <b>Đã thanh toán đủ (100%)</b>. Hóa đơn hợp lệ, sẵn sàng bàn giao phòng.
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Housekeeping Notification Info -->
                <div class="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <i class="pi pi-sparkles text-amber-600 mt-0.5 shrink-0"></i>
                  <div>
                    Khi hoàn tất, phòng <b>Phòng {{ res.roomNumber }}</b> sẽ tự động chuyển sang màu cam <b>Dirty (Cần dọn dẹp)</b> và bắn tín hiệu sang Bảng buồng phòng để nhân viên đi dọn.
                  </div>
                </div>
              </div>

              <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  (click)="closeCheckOutModal()"
                  class="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  [disabled]="isActionLoading() || isLoadingCheckOutFolio() || !!checkOutFolioError() || !checkOutFolio() || checkOutFolio()!.remainingBalance > 0"
                  (click)="confirmCheckOutModal()"
                  class="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm shadow-amber-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <i class="pi pi-check" [class.animate-spin]="isActionLoading()"></i>
                  <span>Hoàn tất trả phòng</span>
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- MODAL 4: CASHIER SUMMARY (BÁO CÁO THU NGÂN) -->
      @if (isSummaryModalOpen()) {
        <div
          class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          (click)="closeSummaryModal()"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white rounded-2xl border border-slate-200/80 w-[min(34rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
          >
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <i class="pi pi-chart-bar text-sm"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Báo cáo thu ngân trong ngày</h3>
                  <p class="text-xs text-slate-500 mt-0.5">Thống kê giao dịch tiền mặt & chuyển khoản hôm nay (UTC+7)</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="loadCashierSummary()"
                  [disabled]="isLoadingSummary()"
                  title="Làm mới số liệu"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  <i class="pi pi-refresh text-xs" [class.animate-spin]="isLoadingSummary()"></i>
                </button>
                <button
                  type="button"
                  (click)="closeSummaryModal()"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  <i class="pi pi-times text-sm"></i>
                </button>
              </div>
            </div>

            <div class="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              @if (isLoadingSummary()) {
                <div class="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                  <i class="pi pi-spinner animate-spin text-2xl text-emerald-600"></i>
                  <span>Đang tải số liệu tổng hợp...</span>
                </div>
              } @else if (summaryError()) {
                <div class="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div class="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                    <i class="pi pi-exclamation-circle text-lg"></i>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-semibold text-slate-800">Không thể tải báo cáo thu ngân</p>
                    <p class="text-[11px] text-slate-500 max-w-xs">{{ summaryError() }}</p>
                  </div>
                  <button
                    type="button"
                    (click)="retrySummary()"
                    class="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <i class="pi pi-refresh text-xs"></i>
                    <span>Thử lại</span>
                  </button>
                </div>
              } @else if (paymentSummary(); as summary) {
                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <div class="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Tổng thực thu</div>
                    <div class="text-xl font-bold text-emerald-700 mt-1">{{ (summary.totalCollected ?? 0) | number:'1.0-0' }} đ</div>
                    <div class="text-[11px] text-emerald-600 mt-0.5">{{ summary.completedCount ?? 0 }} giao dịch thành công</div>
                  </div>
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ngày báo cáo</div>
                    <div class="text-lg font-bold text-slate-800 mt-1">{{ formatVnDateDisplay(summary.date) }}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">Múi giờ Việt Nam (UTC+7)</div>
                  </div>
                </div>

                <div class="space-y-2.5 pt-2">
                  <div class="text-xs font-semibold text-slate-800">Chi tiết theo phương thức thanh toán:</div>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div class="flex items-center gap-2 text-slate-700">
                        <i class="pi pi-money-bill text-emerald-600"></i>
                        <span>Tiền mặt (Cash)</span>
                      </div>
                      <span class="font-bold text-slate-900">{{ (summary.cashCollected ?? 0) | number:'1.0-0' }} đ</span>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div class="flex items-center gap-2 text-slate-700">
                        <i class="pi pi-credit-card text-blue-600"></i>
                        <span>Chuyển khoản (Bank Transfer)</span>
                      </div>
                      <span class="font-bold text-slate-900">{{ (summary.bankTransferCollected ?? 0) | number:'1.0-0' }} đ</span>
                    </div>

                    @if ((summary.creditCardCollected ?? 0) > 0) {
                      <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div class="flex items-center gap-2 text-slate-700">
                          <i class="pi pi-credit-card text-purple-600"></i>
                          <span>Thẻ tín dụng / POS (Card)</span>
                        </div>
                        <span class="font-bold text-slate-900">{{ summary.creditCardCollected | number:'1.0-0' }} đ</span>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="py-8 text-center text-xs text-slate-500">
                  Không có dữ liệu báo cáo cho ngày hôm nay.
                </div>
              }
            </div>

            <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                (click)="closeSummaryModal()"
                class="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ReservationsPage implements OnInit, OnDestroy {
  // Dialogs are controlled via Angular @if state signals with fixed backdrop overlays.
  private readonly reservationService = inject(ReservationService);
  private readonly roomTypeService = inject(RoomTypeService);
  private readonly roomService = inject(RoomService, { optional: true });
  private readonly locationService = inject(LocationService, { optional: true });
  private readonly policyService = inject(PolicyService);
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);

  // Constants
  readonly RentalType = RentalType;
  readonly ReservationStatus = ReservationStatus;
  readonly PaymentMethod = PaymentMethod;
  readonly PaymentStatus = PaymentStatus;

  // View Mode: 'table' (Danh sách) vs 'timeline' (Sơ đồ lịch phòng theo thời gian)
  readonly viewMode = signal<'table' | 'timeline'>('table');

  // Timeline / Gantt State
  readonly timelineStartDate = signal<string>(getTodayVnDateString());
  readonly timelineDaysCount = signal<number>(7);
  readonly timelineRooms = signal<RoomDto[]>([]);
  readonly timelineReservations = signal<ReservationDto[]>([]);
  readonly isTimelineLoading = signal<boolean>(false);
  readonly timelineFloorFilter = signal<number | null>(null);
  readonly timelineRoomTypeFilter = signal<string | null>(null);

  // Administrative Divisions (2-level hierarchy: Province -> Ward)
  readonly provinces = signal<Province[]>([]);
  readonly wards = signal<Ward[]>([]);
  readonly isLoadingProvinces = signal<boolean>(false);
  readonly isLoadingWards = signal<boolean>(false);
  readonly selectedRentalMode = signal<'overnight' | 'hourly' | 'dayuse'>('overnight');

  // Context & Permissions
  readonly activeProperty = computed(() => {
    const id = this.authService.activePropertyId();
    if (!id) return null;
    return {
      id,
      name: this.authService.activePropertyName() || '',
      code: this.authService.activePropertyCode() || ''
    };
  });
  readonly canCreate = computed(() => this.authService.hasPermission('RESERVATIONS', 2)); // PermissionAction.Create = 2
  readonly canCheckInOut = computed(() => this.authService.hasPermission('CHECK_IN_OUT', 4)); // PermissionAction.Update = 4 on CHECK_IN_OUT
  readonly canCancel = computed(() => this.authService.hasPermission('RESERVATIONS', 4)); // PermissionAction.Update = 4 on RESERVATIONS
  readonly canCreatePayment = computed(() => this.authService.hasPermission('PAYMENTS', 2)); // PermissionAction.Create = 2 on PAYMENTS
  readonly canReadPayment = computed(() => this.authService.hasPermission('PAYMENTS', 1)); // PermissionAction.Read = 1 on PAYMENTS
  readonly canReadFolio = computed(() => this.authService.hasPermission('RESERVATIONS', 1)); // PermissionAction.Read = 1 on RESERVATIONS (as per SDD-06:100)
  readonly canReadRoomTypes = computed(() => this.authService.hasPermission('ROOM_TYPES', 1)); // PermissionAction.Read = 1 on ROOM_TYPES

  // Page State
  readonly reservations = signal<ReservationDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()) || 1);

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Filters
  readonly searchQuery = signal<string>('');
  readonly selectedStatus = signal<number | null>(null);
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');

  // Modals & Details
  readonly selectedReservationDetail = signal<ReservationDetailDto | null>(null);
  readonly detailReservationId = signal<string | null>(null);
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly cancelModalReservation = signal<ReservationDto | ReservationDetailDto | null>(null);
  readonly cancelModalTargetPropertyId = signal<string | null>(null);
  readonly cancellationReasonInput = signal<string>('');
  readonly actionReservationId = signal<string | null>(null);
  readonly isActionLoading = signal<boolean>(false);

  // Check-In Modal State
  readonly isCheckInModalOpen = signal<boolean>(false);
  readonly checkInModalReservation = signal<ReservationDto | ReservationDetailDto | null>(null);
  readonly isIdentityVerified = signal<boolean>(false);
  readonly checkInNotesInput = signal<string>('');

  // Check-Out Modal State
  readonly isCheckOutModalOpen = signal<boolean>(false);
  readonly checkOutModalReservation = signal<ReservationDto | ReservationDetailDto | null>(null);
  readonly checkOutFolio = signal<FolioDto | null>(null);
  readonly isLoadingCheckOutFolio = signal<boolean>(false);
  readonly checkOutFolioError = signal<string | null>(null);

  // Create Modal State
  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly branchPolicies = signal<PropertyPoliciesDto | null>(null);
  readonly calculatedQuote = signal<QuoteDto | null>(null);
  readonly availableRooms = signal<RoomAvailabilityDto[]>([]);
  readonly availableCount = computed(() => this.availableRooms().filter(r => r.isAvailable).length);
  readonly selectedRoomId = signal<string | null>(null);
  readonly isCalculatingQuote = signal<boolean>(false);
  readonly quoteError = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly modalTargetPropertyId = signal<string | null>(null);
  readonly verifiedScheduleKey = signal<string | null>(null);

  // Grouped rooms by floor for intuitive selection
  readonly availableRoomsByFloor = computed(() => {
    const rooms = this.availableRooms();
    const map = new Map<number, RoomAvailabilityDto[]>();
    for (const r of rooms) {
      const floor = r.floor ?? 1;
      if (!map.has(floor)) {
        map.set(floor, []);
      }
      map.get(floor)!.push(r);
    }
    const sortedFloors = Array.from(map.keys()).sort((a, b) => a - b);
    return sortedFloors.map(floor => {
      const floorRooms = map.get(floor)!;
      return {
        floor,
        availableCount: floorRooms.filter(r => r.isAvailable).length,
        totalCount: floorRooms.length,
        rooms: floorRooms
      };
    });
  });

  // Estimated deposit required (50% rule)
  readonly estimatedDeposit = computed(() => {
    const quote = this.calculatedQuote();
    return quote ? Math.round(quote.totalAmount * 0.5) : 0;
  });

  // Timeline Computeds
  readonly timelineDates = computed(() => {
    const start = this.timelineStartDate();
    const count = this.timelineDaysCount();
    const dates: Array<{
      dateStr: string;
      dayOfWeek: string;
      dayNumber: number;
      month: number;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    const todayStr = getTodayVnDateString();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 0; i < count; i++) {
      const dStr = addDaysToDateString(start, i);
      const parts = dStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayIdx = d.getDay();
      dates.push({
        dateStr: dStr,
        dayOfWeek: dayNames[dayIdx],
        dayNumber: d.getDate(),
        month: d.getMonth() + 1,
        isToday: dStr === todayStr,
        isWeekend: dayIdx === 0 || dayIdx === 6
      });
    }

    return dates;
  });

  readonly timelineFloors = computed(() => {
    const floors = new Set<number>();
    for (const r of this.timelineRooms()) {
      if (r.floor !== undefined && r.floor !== null) {
        floors.add(r.floor);
      }
    }
    return Array.from(floors).sort((a, b) => a - b);
  });

  readonly filteredTimelineRooms = computed(() => {
    let list = this.timelineRooms();
    const floorFilter = this.timelineFloorFilter();
    const roomTypeFilter = this.timelineRoomTypeFilter();

    if (floorFilter !== null) {
      list = list.filter(r => r.floor === floorFilter);
    }
    if (roomTypeFilter) {
      list = list.filter(r => r.roomTypeId === roomTypeFilter);
    }
    return list;
  });

  createForm!: FormGroup;

  // Folio & Cashier State
  readonly folio = signal<FolioDto | null>(null);
  readonly isLoadingFolio = signal<boolean>(false);
  readonly isSubmittingPayment = signal<boolean>(false);
  readonly isSummaryModalOpen = signal<boolean>(false);
  readonly paymentSummary = signal<PaymentSummaryDto | null>(null);
  readonly isLoadingSummary = signal<boolean>(false);
  readonly summaryError = signal<string | null>(null);
  readonly formatVnDateDisplay = formatVnDateDisplay;

  paymentForm!: FormGroup;

  // Subscriptions & Request Generation Trackers
  private listSub?: Subscription;
  private roomTypesSub?: Subscription;
  private policiesSub?: Subscription;
  private detailSub?: Subscription;
  private quoteSub?: Subscription;
  private availabilitySub?: Subscription;
  private submitSub?: Subscription;
  private lifecycleSub?: Subscription;
  private folioSub?: Subscription;
  private paymentSub?: Subscription;
  private summarySub?: Subscription;
  private timelineRoomsSub?: Subscription;
  private timelineResSub?: Subscription;
  private provincesSub?: Subscription;
  private wardsSub?: Subscription;

  private listRequestId = 0;
  private detailRequestId = 0;
  private quoteRequestId = 0;
  private lifecycleRequestId = 0;
  private folioRequestId = 0;

  // Idempotency Key & Logical Submission State
  private currentSubmissionKey: string | null = null;
  private lastSubmittedFingerprint: string | null = null;
  private currentPaymentIdempotencyKey: string | null = null;
  private lastPaymentFingerprint: string | null = null;

  constructor() {
    this.initCreateForm();
    this.initPaymentForm();

    // Auto-reload reservations when active branch changes
    try {
      effect(() => {
        const propId = this.authService.activePropertyId();
        untracked(() => this.handlePropertyContextChange(propId));
      });
    } catch {
      // Ignored in headless tests
    }
  }

  ngOnInit(): void {
    const propId = this.activeProperty()?.id ?? null;
    if (propId) {
      this.loadReservations();
      this.loadRoomTypes();
      this.loadBranchPolicies(propId);
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingRequests();
  }

  handlePropertyContextChange(newPropertyId: string | null): void {
    this.cancelPendingRequests();

    this.reservations.set([]);
    this.totalCount.set(0);
    this.roomTypes.set([]);
    this.branchPolicies.set(null);
    this.selectedReservationDetail.set(null);
    this.detailReservationId.set(null);
    this.folio.set(null);
    this.paymentSummary.set(null);
    this.summaryError.set(null);
    this.isSummaryModalOpen.set(false);
    this.isSubmittingPayment.set(false);
    this.currentSubmissionKey = null;
    this.lastSubmittedFingerprint = null;
    this.currentPaymentIdempotencyKey = null;
    this.lastPaymentFingerprint = null;

    if (this.isCreateModalOpen()) {
      this.closeCreateModal();
    }

    this.closeCancelModal();
    this.actionReservationId.set(null);
    this.isActionLoading.set(false);

    this.timelineRooms.set([]);
    this.timelineReservations.set([]);

    if (newPropertyId) {
      this.loadReservations();
      this.loadRoomTypes();
      this.loadBranchPolicies(newPropertyId);
      if (this.viewMode() === 'timeline') {
        this.loadTimelineData();
      }
    }
  }

  cancelPendingRequests(): void {
    this.listSub?.unsubscribe();
    this.roomTypesSub?.unsubscribe();
    this.policiesSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    this.quoteSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    this.submitSub?.unsubscribe();
    this.lifecycleSub?.unsubscribe();
    this.folioSub?.unsubscribe();
    this.paymentSub?.unsubscribe();
    this.summarySub?.unsubscribe();
    this.timelineRoomsSub?.unsubscribe();
    this.timelineResSub?.unsubscribe();
    this.provincesSub?.unsubscribe();
    this.wardsSub?.unsubscribe();
  }

  loadBranchPolicies(propId: string): void {
    this.policiesSub?.unsubscribe();
    if (!propId || !this.authService.hasPermission('PROPERTIES', 1)) {
      this.branchPolicies.set(null);
      return;
    }

    this.policiesSub = this.policyService.getPolicies(propId).subscribe({
      next: (policies) => {
        this.branchPolicies.set(policies);
        if (this.isCreateModalOpen() && this.createForm) {
          const inTime = policies.checkInTime ? policies.checkInTime.slice(0, 5) : '';
          const outTime = policies.checkOutTime ? policies.checkOutTime.slice(0, 5) : '';
          if (inTime && !this.createForm.get('checkInTime')?.dirty) {
            this.createForm.patchValue({ checkInTime: inTime });
            if (!this.createForm.get('checkInDate')?.dirty && !this.createForm.get('checkOutDate')?.dirty) {
              const dates = this.getDefaultOvernightDates(inTime);
              this.createForm.patchValue({ checkInDate: dates.checkInDate, checkOutDate: dates.checkOutDate });
            }
          }
          if (outTime && !this.createForm.get('checkOutTime')?.dirty) {
            this.createForm.patchValue({ checkOutTime: outTime });
          }
        }
      },
      error: () => {
        this.branchPolicies.set(null);
      }
    });
  }

  private initCreateForm(): void {
    const today = getTodayVnDateString();
    const policies = this.branchPolicies();
    const defaultCheckIn = policies?.checkInTime ? policies.checkInTime.slice(0, 5) : '';
    const defaultCheckOut = policies?.checkOutTime ? policies.checkOutTime.slice(0, 5) : '';
    const dates = this.getDefaultOvernightDates(defaultCheckIn);

    this.createForm = this.fb.group({
      rentalType: [RentalType.Overnight, Validators.required],
      checkInDate: [dates.checkInDate, Validators.required],
      checkInTime: [defaultCheckIn, [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
      checkOutDate: [dates.checkOutDate, Validators.required],
      checkOutTime: [defaultCheckOut, [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
      hourlyDate: [today],
      hourlyStartTime: ['09:00'],
      hourlyEndTime: ['12:00'],
      roomTypeId: ['', Validators.required],
      guestName: ['', [Validators.required, Validators.maxLength(200)]],
      guestEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      guestPhone: [''],
      identityNumber: [''],
      nationality: ['Việt Nam'],
      provinceCode: [''],
      provinceName: [''],
      wardCode: [''],
      wardName: [''],
      addressDetail: [''],
      numberOfGuests: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
      customerNotes: ['']
    });
  }

  private getDefaultOvernightDates(checkInTime: string): { checkInDate: string; checkOutDate: string } {
    const today = getTodayVnDateString();
    const start = checkInTime ? new Date(`${today}T${checkInTime}:00+07:00`) : null;
    const checkInDate = start && start.getTime() < Date.now() - 30 * 60_000
      ? addDaysToDateString(today, 1)
      : today;
    return { checkInDate, checkOutDate: addDaysToDateString(checkInDate, 1) };
  }

  private initPaymentForm(): void {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1000)]],
      method: [PaymentMethod.Cash, Validators.required],
      transactionRef: ['']
    });
  }

  loadReservations(): void {
    const propId = this.activeProperty()?.id;
    if (!propId) {
      this.reservations.set([]);
      this.totalCount.set(0);
      return;
    }

    this.listSub?.unsubscribe();
    const reqId = ++this.listRequestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.listSub = this.reservationService.getReservations({
      propertyId: propId,
      status: this.selectedStatus() ?? undefined,
      from: this.dateFrom() || undefined,
      to: this.dateTo() || undefined,
      search: this.searchQuery() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize()
    }).subscribe({
      next: (res) => {
        if (reqId !== this.listRequestId || this.activeProperty()?.id !== propId) return;
        this.reservations.set(res.items || []);
        this.totalCount.set(res.totalCount || 0);
        this.isLoading.set(false);
      },
      error: (err) => {
        if (reqId !== this.listRequestId || this.activeProperty()?.id !== propId) return;
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Không thể tải danh sách đặt phòng. Vui lòng thử lại.');
      }
    });
  }

  private loadRoomTypes(): void {
    const propId = this.activeProperty()?.id;
    if (!propId || !this.canReadRoomTypes()) {
      this.roomTypes.set([]);
      return;
    }

    this.roomTypesSub?.unsubscribe();
    this.roomTypesSub = this.roomTypeService.getRoomTypes(undefined, 1, 100).subscribe({
      next: (res) => {
        if (this.activeProperty()?.id !== propId) return;
        this.roomTypes.set(res.items || []);
      },
      error: () => {
        this.roomTypes.set([]);
      }
    });
  }

  // Filter Event Handlers
  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.currentPage.set(1);
    this.loadReservations();
  }

  onStatusChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedStatus.set(val ? parseInt(val, 10) : null);
    this.currentPage.set(1);
    this.loadReservations();
  }

  onDateFromChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.dateFrom.set(val);
    this.currentPage.set(1);
    this.loadReservations();
  }

  onDateToChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.dateTo.set(val);
    this.currentPage.set(1);
    this.loadReservations();
  }

  onDateRangeFilterChange(val: DateRangeFilterValue | null): void {
    if (!val) {
      this.dateFrom.set('');
      this.dateTo.set('');
    } else {
      this.dateFrom.set(val.fromDate || '');
      this.dateTo.set(val.toDate || '');
    }
    this.currentPage.set(1);
    this.loadReservations();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedStatus.set(null);
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
    this.loadReservations();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadReservations();
  }

  onPageSizeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.pageSize.set(parseInt(val, 10) || 20);
    this.currentPage.set(1);
    this.loadReservations();
  }

  // Detail Modal
  viewDetails(res: ReservationDto): void {
    const propId = this.activeProperty()?.id;
    if (!propId) return;

    this.detailSub?.unsubscribe();
    this.folioSub?.unsubscribe();
    const reqId = ++this.detailRequestId;

    // Immediately reset folio and payment state when opening/switching reservations
    this.detailReservationId.set(res.id);
    this.selectedReservationDetail.set(null);
    this.folio.set(null);
    this.isLoadingFolio.set(true);
    this.currentPaymentIdempotencyKey = null;
    this.lastPaymentFingerprint = null;
    this.initPaymentForm();

    this.detailSub = this.reservationService.getReservationById(res.id, propId).subscribe({
      next: (detail) => {
        if (reqId !== this.detailRequestId || this.activeProperty()?.id !== propId || this.detailReservationId() !== res.id) return;
        this.selectedReservationDetail.set(detail);
      },
      error: () => {
        if (reqId !== this.detailRequestId || this.activeProperty()?.id !== propId) return;
        this.alertService.toastError('Không thể tải chi tiết đặt phòng.');
      }
    });

    this.loadFolio(res.id, propId);
  }

  closeDetailModal(): void {
    this.detailSub?.unsubscribe();
    this.folioSub?.unsubscribe();
    this.detailReservationId.set(null);
    this.selectedReservationDetail.set(null);
    this.folio.set(null);
    this.isLoadingFolio.set(false);
    this.currentPaymentIdempotencyKey = null;
    this.lastPaymentFingerprint = null;
    this.initPaymentForm();
  }

  // Create Modal
  openCreateModal(): void {
    const propId = this.activeProperty()?.id;
    if (!propId) return;

    if (!this.branchPolicies()) {
      this.loadBranchPolicies(propId);
    }

    this.initCreateForm();
    this.resetCalculatedQuoteAndAvailability();
    this.loadProvinces();
    this.modalTargetPropertyId.set(propId);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.quoteSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    this.submitSub?.unsubscribe();
    this.isCreateModalOpen.set(false);
    this.modalTargetPropertyId.set(null);
    this.currentSubmissionKey = null;
    this.lastSubmittedFingerprint = null;
    this.resetCalculatedQuoteAndAvailability();
  }

  onRentalTypeChanged(): void {
    this.resetCalculatedQuoteAndAvailability();
  }

  onScheduleInputsChanged(): void {
    this.resetCalculatedQuoteAndAvailability();
  }

  onRoomTypeSelected(): void {
    this.resetCalculatedQuoteAndAvailability();
  }

  private resetCalculatedQuoteAndAvailability(): void {
    this.quoteSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    this.calculatedQuote.set(null);
    this.availableRooms.set([]);
    this.selectedRoomId.set(null);
    this.quoteError.set(null);
    this.verifiedScheduleKey.set(null);
    this.currentSubmissionKey = null;
    this.lastSubmittedFingerprint = null;
  }

  getCurrentScheduleKey(): string {
    const form = this.createForm.value;
    const rentalType = form.rentalType as RentalType;
    const roomTypeId = form.roomTypeId;
    if (rentalType === RentalType.Overnight) {
      return `${rentalType}_${roomTypeId}_${form.checkInDate}_${form.checkInTime}_${form.checkOutDate}_${form.checkOutTime}`;
    } else {
      return `${rentalType}_${roomTypeId}_${form.hourlyDate}_${form.hourlyStartTime}_${form.hourlyEndTime}`;
    }
  }

  canCheckAvailability(): boolean {
    const roomTypeId = this.createForm.get('roomTypeId')?.value;
    if (!roomTypeId) return false;

    const rentalType = this.createForm.get('rentalType')?.value;
    if (rentalType === RentalType.Overnight) {
      const checkIn = this.createForm.get('checkInDate')?.value;
      const checkOut = this.createForm.get('checkOutDate')?.value;
      const inTime = this.createForm.get('checkInTime')?.value;
      const outTime = this.createForm.get('checkOutTime')?.value;
      return !!checkIn && !!checkOut && checkOut > checkIn && !!inTime && !!outTime;
    } else {
      const hDate = this.createForm.get('hourlyDate')?.value;
      const startT = this.createForm.get('hourlyStartTime')?.value;
      const endT = this.createForm.get('hourlyEndTime')?.value;
      return !!hDate && !!startT && !!endT && endT > startT;
    }
  }

  onCalculateQuoteAndAvailability(): void {
    const propId = this.activeProperty()?.id;
    if (!propId || !this.canCheckAvailability()) return;

    const form = this.createForm.value;
    const rentalType = form.rentalType as RentalType;
    const roomTypeId = form.roomTypeId;
    const currentScheduleKey = this.getCurrentScheduleKey();

    let startAtUtc: string;
    let endAtUtc: string;
    let checkInDate: string | undefined;
    let checkOutDate: string | undefined;

    if (rentalType === RentalType.Overnight) {
      checkInDate = form.checkInDate;
      checkOutDate = form.checkOutDate;
      const checkInTime = form.checkInTime;
      const checkOutTime = form.checkOutTime;
      if (!checkInTime || !checkOutTime) return;
      startAtUtc = new Date(`${checkInDate}T${checkInTime}:00+07:00`).toISOString();
      endAtUtc = new Date(`${checkOutDate}T${checkOutTime}:00+07:00`).toISOString();
    } else {
      checkInDate = form.hourlyDate;
      checkOutDate = form.hourlyDate;
      startAtUtc = new Date(`${form.hourlyDate}T${form.hourlyStartTime}:00+07:00`).toISOString();
      endAtUtc = new Date(`${form.hourlyDate}T${form.hourlyEndTime}:00+07:00`).toISOString();
    }

    this.quoteSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    const reqId = ++this.quoteRequestId;

    this.isCalculatingQuote.set(true);
    this.quoteError.set(null);
    this.calculatedQuote.set(null);
    this.availableRooms.set([]);
    this.selectedRoomId.set(null);
    this.verifiedScheduleKey.set(null);

    this.quoteSub = this.reservationService.calculateQuote({
      propertyId: propId,
      roomTypeId: roomTypeId,
      rentalType: rentalType,
      startAtUtc: startAtUtc,
      endAtUtc: endAtUtc,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate
    }).subscribe({
      next: (quote) => {
        if (
          reqId !== this.quoteRequestId ||
          this.activeProperty()?.id !== propId ||
          !this.isCreateModalOpen() ||
          this.getCurrentScheduleKey() !== currentScheduleKey
        ) {
          this.isCalculatingQuote.set(false);
          return;
        }

        this.calculatedQuote.set(quote);

        this.availabilitySub = this.reservationService.getAvailability({
          propertyId: propId,
          rentalType: rentalType,
          startAtUtc: startAtUtc,
          endAtUtc: endAtUtc,
          roomTypeId: roomTypeId,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate
        }).subscribe({
          next: (rooms) => {
            if (
              reqId !== this.quoteRequestId ||
              this.activeProperty()?.id !== propId ||
              !this.isCreateModalOpen() ||
              this.getCurrentScheduleKey() !== currentScheduleKey
            ) {
              this.isCalculatingQuote.set(false);
              return;
            }

            this.availableRooms.set(rooms || []);
            this.verifiedScheduleKey.set(currentScheduleKey);
            this.isCalculatingQuote.set(false);

            const firstAvail = rooms.find(r => r.isAvailable);
            if (firstAvail) {
              this.selectedRoomId.set(firstAvail.roomId);
            }
          },
          error: (err) => {
            if (reqId !== this.quoteRequestId || this.activeProperty()?.id !== propId) return;
            this.isCalculatingQuote.set(false);
            this.quoteError.set(err?.error?.message || 'Không thể kiểm tra tình trạng phòng trống.');
          }
        });
      },
      error: (err) => {
        if (reqId !== this.quoteRequestId || this.activeProperty()?.id !== propId) return;
        this.isCalculatingQuote.set(false);
        const validationErrors = err?.error?.errors as Record<string, string[]> | undefined;
        const validationMessage = validationErrors && Object.values(validationErrors).flat().find(Boolean);
        this.quoteError.set(validationMessage || err?.error?.message || 'Không thể tính giá đặt phòng theo chính sách hiện hành.');
      }
    });
  }

  selectRoom(room: RoomAvailabilityDto): void {
    if (!room.isAvailable) return;
    this.selectedRoomId.set(room.roomId);
  }

  canSubmitCreate(): boolean {
    return (
      this.canCreate() &&
      !this.isSubmitting() &&
      this.isCreateModalOpen() &&
      this.modalTargetPropertyId() === this.activeProperty()?.id &&
      this.createForm.valid &&
      this.calculatedQuote() !== null &&
      this.verifiedScheduleKey() !== null &&
      this.verifiedScheduleKey() === this.getCurrentScheduleKey() &&
      this.selectedRoomId() !== null &&
      this.availableCount() > 0
    );
  }

  onSubmitCreate(): void {
    if (!this.canSubmitCreate()) return;

    const propId = this.activeProperty()?.id;
    const roomId = this.selectedRoomId();
    const quote = this.calculatedQuote();
    if (!propId || !roomId || !quote) return;

    const form = this.createForm.value;
    const rentalType = form.rentalType as RentalType;

    let startAtUtc: string;
    let endAtUtc: string;
    let checkInDate: string | undefined;
    let checkOutDate: string | undefined;

    if (rentalType === RentalType.Overnight) {
      checkInDate = form.checkInDate;
      checkOutDate = form.checkOutDate;
      const checkInTime = form.checkInTime;
      const checkOutTime = form.checkOutTime;
      if (!checkInTime || !checkOutTime) {
        this.alertService.toastError('Vui lòng nhập giờ nhận phòng và giờ trả phòng hợp lệ.');
        return;
      }
      startAtUtc = new Date(`${checkInDate}T${checkInTime}:00+07:00`).toISOString();
      endAtUtc = new Date(`${checkOutDate}T${checkOutTime}:00+07:00`).toISOString();
    } else {
      checkInDate = form.hourlyDate;
      checkOutDate = form.hourlyDate;
      startAtUtc = new Date(`${form.hourlyDate}T${form.hourlyStartTime}:00+07:00`).toISOString();
      endAtUtc = new Date(`${form.hourlyDate}T${form.hourlyEndTime}:00+07:00`).toISOString();
    }

    let notes = form.customerNotes?.trim() || '';
    const guestDetails: string[] = [];
    if (form.identityNumber?.trim()) {
      guestDetails.push(`CCCD/Passport: ${form.identityNumber.trim()}`);
    }
    if (form.nationality?.trim()) {
      guestDetails.push(`Quốc tịch: ${form.nationality.trim()}`);
    }
    if (form.provinceName || form.wardName || form.addressDetail?.trim()) {
      const addrParts = [form.addressDetail?.trim(), form.wardName, form.provinceName].filter(Boolean);
      if (addrParts.length > 0) {
        guestDetails.push(`Địa chỉ: ${addrParts.join(', ')}`);
      }
    }
    if (guestDetails.length > 0) {
      const guestHeader = `[${guestDetails.join(' | ')}]`;
      notes = notes ? `${guestHeader} ${notes}` : guestHeader;
    }

    const currentFingerprint = `${propId}_${roomId}_${rentalType}_${startAtUtc}_${endAtUtc}_${form.guestName.trim()}_${form.guestEmail.trim()}_${form.guestPhone?.trim() || ''}_${form.identityNumber?.trim() || ''}_${form.provinceCode || ''}_${form.wardCode || ''}_${form.numberOfGuests}_${notes}_${quote.totalAmount}`;
    if (!this.currentSubmissionKey || this.lastSubmittedFingerprint !== currentFingerprint) {
      this.currentSubmissionKey = 'IDEMP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      this.lastSubmittedFingerprint = currentFingerprint;
    }

    const payload: CreateReservationRequest = {
      propertyId: propId,
      roomId: roomId,
      rentalType: rentalType,
      startAtUtc: startAtUtc,
      endAtUtc: endAtUtc,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      guestName: form.guestName.trim(),
      guestEmail: form.guestEmail.trim(),
      guestPhone: form.guestPhone?.trim() || undefined,
      numberOfGuests: form.numberOfGuests,
      customerNotes: notes || undefined,
      expectedTotalAmount: quote.totalAmount,
      idempotencyKey: this.currentSubmissionKey
    };

    this.submitSub?.unsubscribe();
    this.isSubmitting.set(true);

    this.submitSub = this.reservationService.createReservation(payload).subscribe({
      next: (created) => {
        if (this.activeProperty()?.id !== propId || !this.isCreateModalOpen()) {
          this.isSubmitting.set(false);
          return;
        }

        this.currentSubmissionKey = null;
        this.lastSubmittedFingerprint = null;
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.alertService.toastSuccess(`Tạo đặt phòng thành công! Mã xác nhận: ${created.confirmationCode}`);
        this.loadReservations();
        if (this.viewMode() === 'timeline') {
          this.loadTimelineData();
        }
      },
      error: (err) => {
        if (this.activeProperty()?.id !== propId || !this.isCreateModalOpen()) {
          this.isSubmitting.set(false);
          return;
        }

        this.isSubmitting.set(false);
        const errMsg = err?.error?.message || 'Tạo đặt phòng thất bại. Vui lòng kiểm tra lại.';
        this.alertService.toastError(errMsg);
      }
    });
  }

  // Stay Lifecycle Actions
  onCheckIn(res: ReservationDto | ReservationDetailDto): void {
    if (!this.canCheckInOut() || this.isActionLoading() || this.actionReservationId() !== null) {
      return;
    }
    const propId = this.activeProperty()?.id;
    if (!propId || res.propertyId !== propId) {
      return;
    }

    const reqId = ++this.lifecycleRequestId;
    this.actionReservationId.set(res.id);
    this.isActionLoading.set(true);

    this.lifecycleSub?.unsubscribe();
    this.lifecycleSub = this.reservationService.checkIn(res.id, propId).subscribe({
      next: (updated) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.actionReservationId.set(null);
        this.isActionLoading.set(false);
        this.alertService.toastSuccess(`Nhận phòng thành công cho đơn ${updated.confirmationCode}!`);
        if (this.selectedReservationDetail()?.id === res.id) {
          this.selectedReservationDetail.set(updated);
        }
        // Notify Housekeeping Board via real-time signal
        this.roomService?.notifyRoomStatusChanged?.(res.roomId, RoomStatus.Occupied, res.roomNumber);
        this.loadReservations();
      },
      error: (err) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.actionReservationId.set(null);
        this.isActionLoading.set(false);
        const errMsg = err?.error?.message || 'Nhận phòng thất bại. Vui lòng kiểm tra trạng thái phòng.';
        this.alertService.toastError(errMsg);
      }
    });
  }

  onCheckOut(res: ReservationDto | ReservationDetailDto): void {
    if (!this.canCheckInOut() || this.isActionLoading() || this.actionReservationId() !== null) {
      return;
    }
    const propId = this.activeProperty()?.id;
    if (!propId || res.propertyId !== propId) {
      return;
    }

    // Enforce POL-IO03: Settle outstanding balance before checkout
    const currentFolio = this.folio();
    if (currentFolio && currentFolio.reservationId === res.id && currentFolio.remainingBalance > 0) {
      this.alertService.toastError(`Đơn đặt phòng còn dư nợ ${currentFolio.remainingBalance.toLocaleString('vi-VN')} đ. Vui lòng thu đủ tiền trước khi trả phòng.`);
      return;
    }

    const reqId = ++this.lifecycleRequestId;
    this.actionReservationId.set(res.id);
    this.isActionLoading.set(true);

    this.lifecycleSub?.unsubscribe();
    this.lifecycleSub = this.reservationService.checkOut(res.id, propId).subscribe({
      next: (updated) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.actionReservationId.set(null);
        this.isActionLoading.set(false);
        this.alertService.toastSuccess(`Trả phòng thành công cho đơn ${updated.confirmationCode}! Phòng đã chuyển sang trạng thái Cần dọn dẹp (Dirty).`);
        if (this.selectedReservationDetail()?.id === res.id) {
          this.selectedReservationDetail.set(updated);
        }
        // Realtime notification to Housekeeping Board: Room transitions to Dirty automatically
        this.roomService?.notifyRoomStatusChanged?.(res.roomId, RoomStatus.Dirty, res.roomNumber);
        this.loadReservations();
      },
      error: (err) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.actionReservationId.set(null);
        this.isActionLoading.set(false);
        const errMsg = err?.error?.message || 'Trả phòng thất bại.';
        this.alertService.toastError(errMsg);
      }
    });
  }

  // Check-In Modal Handlers
  openCheckInModal(res: ReservationDto | ReservationDetailDto): void {
    if (!this.canCheckInOut() || this.isActionLoading()) return;
    if (this.selectedReservationDetail()?.id === res.id) this.closeDetailModal();
    this.checkInModalReservation.set(res);
    this.isIdentityVerified.set(false);
    this.checkInNotesInput.set('');
    this.isCheckInModalOpen.set(true);
  }

  closeCheckInModal(): void {
    this.isCheckInModalOpen.set(false);
    this.checkInModalReservation.set(null);
    this.isIdentityVerified.set(false);
    this.checkInNotesInput.set('');
  }

  toggleIdentityVerified(): void {
    this.isIdentityVerified.update((v) => !v);
  }

  onCheckInNotesInput(event: Event): void {
    this.checkInNotesInput.set((event.target as HTMLTextAreaElement).value);
  }

  confirmCheckInModal(): void {
    const res = this.checkInModalReservation();
    if (!res || !this.isIdentityVerified()) return;
    this.closeCheckInModal();
    this.onCheckIn(res);
  }

  // Check-Out Modal Handlers
  openCheckOutModal(res: ReservationDto | ReservationDetailDto): void {
    if (!this.canCheckInOut() || this.isActionLoading()) return;
    const propId = this.activeProperty()?.id;
    if (!propId || res.propertyId !== propId) return;
    if (this.selectedReservationDetail()?.id === res.id) this.closeDetailModal();

    this.checkOutModalReservation.set(res);
    this.isCheckOutModalOpen.set(true);
    this.isLoadingCheckOutFolio.set(true);
    this.checkOutFolio.set(null);
    this.checkOutFolioError.set(null);

    this.paymentService.getFolio(res.id, propId).subscribe({
      next: (folio) => {
        if (this.checkOutModalReservation()?.id === res.id) {
          this.checkOutFolio.set(folio);
          this.checkOutFolioError.set(null);
          this.isLoadingCheckOutFolio.set(false);
        }
      },
      error: (err) => {
        if (this.checkOutModalReservation()?.id === res.id) {
          this.isLoadingCheckOutFolio.set(false);
          this.checkOutFolioError.set(err?.error?.message || 'Không thể tải bảng kê công nợ Folio. Vui lòng kiểm tra lại kết nối mạng.');
        }
      }
    });
  }

  retryCheckOutFolio(): void {
    const res = this.checkOutModalReservation();
    const propId = this.activeProperty()?.id;
    if (!res || !propId) return;

    this.isLoadingCheckOutFolio.set(true);
    this.checkOutFolioError.set(null);

    this.paymentService.getFolio(res.id, propId).subscribe({
      next: (folio) => {
        if (this.checkOutModalReservation()?.id === res.id) {
          this.checkOutFolio.set(folio);
          this.checkOutFolioError.set(null);
          this.isLoadingCheckOutFolio.set(false);
        }
      },
      error: (err) => {
        if (this.checkOutModalReservation()?.id === res.id) {
          this.isLoadingCheckOutFolio.set(false);
          this.checkOutFolioError.set(err?.error?.message || 'Không thể tải bảng kê công nợ Folio. Vui lòng kiểm tra lại kết nối mạng.');
        }
      }
    });
  }

  closeCheckOutModal(): void {
    this.isCheckOutModalOpen.set(false);
    this.checkOutModalReservation.set(null);
    this.checkOutFolio.set(null);
    this.checkOutFolioError.set(null);
  }

  confirmCheckOutModal(): void {
    const res = this.checkOutModalReservation();
    if (!res) return;
    if (this.isLoadingCheckOutFolio()) return;
    const folio = this.checkOutFolio();
    if (!folio) {
      this.alertService.toastError('Chưa xác thực được công nợ Folio từ máy chủ. Vui lòng tải lại trước khi hoàn tất.');
      return;
    }
    if (folio.remainingBalance > 0) {
      this.alertService.toastError(`Đơn đặt phòng còn dư nợ ${folio.remainingBalance.toLocaleString('vi-VN')} đ. Vui lòng thu đủ tiền trước khi trả phòng.`);
      return;
    }
    this.closeCheckOutModal();
    this.onCheckOut(res);
  }

  openCancelModal(res: ReservationDto | ReservationDetailDto): void {
    if (!this.canCancel() || this.isActionLoading()) return;
    const propId = this.activeProperty()?.id;
    if (!propId || res.propertyId !== propId) return;
    if (this.selectedReservationDetail()?.id === res.id) this.closeDetailModal();

    this.cancelModalReservation.set(res);
    this.cancelModalTargetPropertyId.set(propId);
    this.cancellationReasonInput.set('');
  }

  closeCancelModal(): void {
    this.cancelModalReservation.set(null);
    this.cancelModalTargetPropertyId.set(null);
    this.cancellationReasonInput.set('');
  }

  onCancellationReasonInput(event: Event): void {
    this.cancellationReasonInput.set((event.target as HTMLTextAreaElement).value);
  }

  confirmCancelReservation(): void {
    if (!this.canCancel() || this.isActionLoading()) return;

    const target = this.cancelModalReservation();
    const propId = this.activeProperty()?.id;
    const modalPropId = this.cancelModalTargetPropertyId();

    if (!target || !propId || target.propertyId !== propId || modalPropId !== propId) {
      this.closeCancelModal();
      return;
    }

    const reqId = ++this.lifecycleRequestId;
    this.isActionLoading.set(true);
    const reason = this.cancellationReasonInput().trim() || undefined;

    this.lifecycleSub?.unsubscribe();
    this.lifecycleSub = this.reservationService.cancel(target.id, propId, reason).subscribe({
      next: (updated) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.isActionLoading.set(false);
        this.closeCancelModal();
        this.alertService.toastSuccess(`Hủy đơn đặt phòng ${updated.confirmationCode} thành công.`);
        if (this.selectedReservationDetail()?.id === target.id) {
          this.selectedReservationDetail.set(updated);
        }
        this.loadReservations();
      },
      error: (err) => {
        if (reqId !== this.lifecycleRequestId || this.activeProperty()?.id !== propId) {
          return;
        }
        this.isActionLoading.set(false);
        const errMsg = err?.error?.message || 'Hủy đặt phòng thất bại.';
        this.alertService.toastError(errMsg);
      }
    });
  }

  // Formatting helpers
  getStatusLabel(status: ReservationStatus): string {
    return RESERVATION_STATUS_LABELS[status] || 'Không xác định';
  }

  getStatusBadgeClass(status: ReservationStatus): string {
    return RESERVATION_STATUS_BADGE_CLASSES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  }

  formatVietnamFullDateTime(utcDateStr?: string | null): string {
    if (!utcDateStr) return '';
    try {
      const d = new Date(utcDateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '';
    }
  }

  isSystemNote(note?: string | null): boolean {
    if (!note) return false;
    const n = note.toLowerCase();
    return n.includes('15-min hold') || n.includes('guest online reservation') || n.startsWith('{');
  }

  getFolioSettlementBadge(f: FolioDto, detail: ReservationDetailDto): { label: string; badgeClass: string; iconClass: string } {
    if (detail.status === ReservationStatus.Cancelled) {
      if (f.refundStatus === 'Refunded') {
        return { label: 'Đã hoàn tiền', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconClass: 'pi-check-circle' };
      }
      if (f.refundStatus === 'PendingApproval' || (f.refundableAmount ?? detail.refundableAmount ?? 0) > 0) {
        return { label: 'Chờ duyệt hoàn tiền', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', iconClass: 'pi-clock' };
      }
      if ((f.netCollectibleAmount ?? 0) > 0) {
        return { label: 'Còn phải thu phí hủy', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200', iconClass: 'pi-exclamation-triangle' };
      }
      return { label: 'Đã hủy — Không phát sinh nợ', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', iconClass: 'pi-check' };
    }

    if (f.isFullyPaid) {
      return { label: 'Đã thanh toán đủ', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconClass: 'pi-check-circle' };
    }
    return { label: 'Còn dư nợ', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', iconClass: 'pi-clock' };
  }

  formatUtcTime(utcDateStr: string): string {
    if (!utcDateStr) return '';
    try {
      const d = new Date(utcDateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    } catch {
      return '';
    }
  }

  getNightCount(checkIn: string, checkOut: string): number {
    try {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }

  // Folio & Cashier Methods
  loadFolio(reservationId: string, propertyId: string): void {
    if (!this.canReadFolio()) {
      this.folio.set(null);
      this.isLoadingFolio.set(false);
      return;
    }
    this.folioSub?.unsubscribe();
    const reqId = ++this.folioRequestId;
    this.isLoadingFolio.set(true);

    this.folioSub = this.paymentService.getFolio(reservationId, propertyId).subscribe({
      next: (folio) => {
        // Discard stale responses if branch changed, request ID changed, or user opened another reservation
        if (reqId !== this.folioRequestId ||
            this.activeProperty()?.id !== propertyId ||
            this.detailReservationId() !== reservationId ||
            (this.selectedReservationDetail() && this.selectedReservationDetail()!.id !== reservationId) ||
            folio.reservationId !== reservationId) {
          return;
        }
        this.folio.set(folio);
        this.isLoadingFolio.set(false);
        if (folio.remainingBalance > 0) {
          this.paymentForm.patchValue({
            amount: folio.remainingBalance,
            method: PaymentMethod.Cash,
            transactionRef: ''
          });
        }
      },
      error: () => {
        if (reqId !== this.folioRequestId ||
            this.activeProperty()?.id !== propertyId ||
            this.detailReservationId() !== reservationId) {
          return;
        }
        this.isLoadingFolio.set(false);
        this.folio.set(null);
      }
    });
  }

  fillFullRemaining(): void {
    const currentDetail = this.selectedReservationDetail();
    const folio = this.folio();
    if (!currentDetail || !folio || folio.reservationId !== currentDetail.id || this.detailReservationId() !== currentDetail.id) {
      return;
    }
    const rem = folio.remainingBalance;
    if (rem > 0) {
      this.paymentForm.patchValue({ amount: rem });
    }
  }

  getOrCreatePaymentIdempotencyKey(reservationId: string, amount: number, method: number): string {
    const fp = `${reservationId}_${amount}_${method}`;
    if (!this.currentPaymentIdempotencyKey || this.lastPaymentFingerprint !== fp) {
      this.currentPaymentIdempotencyKey = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.lastPaymentFingerprint = fp;
    }
    return this.currentPaymentIdempotencyKey;
  }

  onRecordPayment(detail: ReservationDetailDto): void {
    if (!this.canCreatePayment() || this.isSubmittingPayment() || this.paymentForm.invalid) {
      return;
    }
    const propId = this.activeProperty()?.id;
    if (!propId || detail.propertyId !== propId) {
      this.alertService.toastError('Không thể thực hiện thanh toán do sai lệch chi nhánh.');
      return;
    }

    if (this.selectedReservationDetail()?.id !== detail.id || this.detailReservationId() !== detail.id) {
      this.alertService.toastError('Đơn đặt phòng đang xem không khớp.');
      return;
    }

    const folio = this.folio();
    if (!folio || folio.reservationId !== detail.id || this.isLoadingFolio()) {
      this.alertService.toastError('Đang tải dữ liệu công nợ folio, vui lòng đợi trong giây lát.');
      return;
    }

    const formVal = this.paymentForm.value;
    const amount = Number(formVal.amount);
    const remaining = folio.remainingBalance;

    if (amount <= 0) {
      this.alertService.toastError('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }

    if (amount > remaining) {
      this.alertService.toastError(`Số tiền thanh toán (${amount.toLocaleString('vi-VN')} đ) vượt quá dư nợ còn lại (${remaining.toLocaleString('vi-VN')} đ).`);
      return;
    }

    this.isSubmittingPayment.set(true);
    const idemKey = this.getOrCreatePaymentIdempotencyKey(detail.id, amount, Number(formVal.method));

    const payload: CreatePaymentDtoRequest = {
      reservationId: detail.id,
      amount: amount,
      method: Number(formVal.method),
      transactionRef: formVal.transactionRef?.trim() || undefined,
      idempotencyKey: idemKey
    };

    this.paymentSub?.unsubscribe();
    this.paymentSub = this.paymentService.createPayment(payload, propId).subscribe({
      next: (payment) => {
        if (this.activeProperty()?.id !== propId) return;
        this.isSubmittingPayment.set(false);
        this.currentPaymentIdempotencyKey = null;
        this.lastPaymentFingerprint = null;
        this.alertService.toastSuccess(`Thu tiền thành công: ${payment.amount.toLocaleString('vi-VN')} đ (${payment.methodName}).`);

        if (this.selectedReservationDetail()?.id === detail.id) {
          this.loadFolio(detail.id, propId);
        }
        this.paymentSummary.set(null);
        this.loadReservations();
        if (detail.status === ReservationStatus.PendingPayment && this.selectedReservationDetail()?.id === detail.id) {
          this.viewDetails({ id: detail.id, propertyId: propId } as ReservationDto);
        }
      },
      error: (err) => {
        if (this.activeProperty()?.id !== propId) return;
        this.isSubmittingPayment.set(false);
        // Idempotency key is retained on failure for reliable client retry
        const code = err?.error?.code;
        const msg = err?.error?.message;
        if (code === 'ERR_AMOUNT_EXCEEDS_BALANCE') {
          this.alertService.toastError('Số tiền thanh toán vượt quá số dư cần trả.');
        } else if (code === 'ERR_FOLIO_ALREADY_PAID') {
          this.alertService.toastError('Đơn đặt phòng đã được thanh toán đủ.');
        } else if (code === 'ERR_IDEMPOTENCY_PAYLOAD_MISMATCH') {
          this.alertService.toastError('Yêu cầu thanh toán xung đột với giao dịch trước đó.');
        } else {
          this.alertService.toastError(msg || 'Ghi nhận thanh toán thất bại.');
        }
      }
    });
  }

  loadCashierSummary(): void {
    const propId = this.activeProperty()?.id;
    if (!propId) {
      this.alertService.toastError('Vui lòng chọn chi nhánh để xem báo cáo thu ngân.');
      return;
    }
    this.isLoadingSummary.set(true);
    this.summaryError.set(null);

    const todayVn = getTodayVnDateString();
    this.summarySub?.unsubscribe();
    this.summarySub = this.paymentService.getPaymentSummary(propId, todayVn).subscribe({
      next: (sum) => {
        if (this.activeProperty()?.id !== propId) return;
        this.paymentSummary.set(sum);
        this.isLoadingSummary.set(false);
      },
      error: (err) => {
        if (this.activeProperty()?.id !== propId) return;
        this.isLoadingSummary.set(false);
        const msg = err?.error?.message || 'Không thể tải báo cáo thu ngân.';
        this.summaryError.set(msg);
        this.alertService.toastError(msg);
      }
    });
  }

  openSummaryModal(): void {
    const propId = this.activeProperty()?.id;
    if (!propId) {
      this.alertService.toastError('Vui lòng chọn chi nhánh để xem báo cáo thu ngân.');
      return;
    }
    this.isSummaryModalOpen.set(true);
    this.paymentSummary.set(null);
    this.loadCashierSummary();
  }

  retrySummary(): void {
    this.loadCashierSummary();
  }

  closeSummaryModal(): void {
    this.summarySub?.unsubscribe();
    this.isSummaryModalOpen.set(false);
    this.summaryError.set(null);
  }

  // ── View Mode & Timeline Methods ──────────────────────────────────────────

  setViewMode(mode: 'table' | 'timeline'): void {
    this.viewMode.set(mode);
    if (mode === 'timeline') {
      this.loadTimelineData();
    }
  }

  onRefreshCurrentView(): void {
    if (this.viewMode() === 'timeline') {
      this.loadTimelineData();
    } else {
      this.loadReservations();
    }
  }

  loadTimelineData(): void {
    const propId = this.activeProperty()?.id;
    if (!propId) {
      this.timelineRooms.set([]);
      this.timelineReservations.set([]);
      return;
    }

    this.isTimelineLoading.set(true);
    const startDate = this.timelineStartDate();
    const endDate = addDaysToDateString(startDate, this.timelineDaysCount() + 1);

    // 1. Load rooms for property
    this.timelineRoomsSub?.unsubscribe();
    if (this.roomService) {
      this.timelineRoomsSub = this.roomService.getRooms({ pageSize: 100 }).subscribe({
        next: (res) => {
          this.timelineRooms.set(res.items || []);
        },
        error: () => {
          this.timelineRooms.set([]);
        }
      });
    }

    // 2. Load reservations in timeline window
    this.timelineResSub?.unsubscribe();
    this.timelineResSub = this.reservationService.getTimelineReservations(propId, startDate, endDate).subscribe({
      next: (items) => {
        this.timelineReservations.set(items || []);
        this.isTimelineLoading.set(false);
      },
      error: () => {
        this.timelineReservations.set([]);
        this.isTimelineLoading.set(false);
      }
    });
  }

  goToToday(): void {
    this.timelineStartDate.set(getTodayVnDateString());
    this.loadTimelineData();
  }

  goToPreviousDays(): void {
    const current = this.timelineStartDate();
    const count = this.timelineDaysCount();
    this.timelineStartDate.set(addDaysToDateString(current, -count));
    this.loadTimelineData();
  }

  goToNextDays(): void {
    const current = this.timelineStartDate();
    const count = this.timelineDaysCount();
    this.timelineStartDate.set(addDaysToDateString(current, count));
    this.loadTimelineData();
  }

  onTimelineStartDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.timelineStartDate.set(val);
      this.loadTimelineData();
    }
  }

  setTimelineDaysCount(days: number): void {
    this.timelineDaysCount.set(days);
    this.loadTimelineData();
  }

  onTimelineFloorChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.timelineFloorFilter.set(val ? parseInt(val, 10) : null);
  }

  onTimelineRoomTypeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.timelineRoomTypeFilter.set(val || null);
  }

  getRoomBookingsForDate(roomId: string, dateStr: string): ReservationDto[] {
    return this.timelineReservations().filter(res => {
      if (res.roomId !== roomId) return false;
      if (res.status === ReservationStatus.Cancelled) return false;

      if (res.rentalType === RentalType.Hourly) {
        return res.checkInDate === dateStr;
      } else {
        // Overnight: checkInDate <= dateStr < checkOutDate
        return res.checkInDate <= dateStr && dateStr < res.checkOutDate;
      }
    });
  }

  getTimelineBookingBadgeClass(res: ReservationDto, dateStr: string): string {
    if (res.rentalType === RentalType.Hourly) {
      return 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200';
    }
    switch (res.status) {
      case ReservationStatus.Confirmed:
        return 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200';
      case ReservationStatus.CheckedIn:
        return 'bg-blue-100 text-blue-900 border border-blue-300 hover:bg-blue-200';
      case ReservationStatus.PendingPayment:
        return 'bg-yellow-100 text-yellow-900 border border-yellow-300 hover:bg-yellow-200';
      case ReservationStatus.CheckedOut:
        return 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  }

  getBookingTooltip(res: ReservationDto): string {
    const rentalTypeLabel = res.rentalType === RentalType.Hourly ? 'Theo giờ' : 'Theo đêm';
    const statusLabel = this.getStatusLabel(res.status);
    return `${res.confirmationCode} - ${res.guestName}\n${rentalTypeLabel} | ${statusLabel}\nSĐT: ${res.guestPhone || 'Không có'}\nTổng tiền: ${res.totalAmount.toLocaleString('vi-VN')} đ`;
  }

  openCreateModalWithPrefill(room: RoomDto, dateStr: string): void {
    this.openCreateModal();
    const nextDay = addDaysToDateString(dateStr, 1);
    this.createForm.patchValue({
      rentalType: RentalType.Overnight,
      checkInDate: dateStr,
      checkOutDate: nextDay,
      roomTypeId: room.roomTypeId
    });
    this.onCalculateQuoteAndAvailability();
    this.selectedRoomId.set(room.id);
  }

  // ── Day-Use & Location (Administrative Divisions) Methods ──────────────────

  isDayUsePresetActive(): boolean {
    const val = this.createForm?.value;
    return (
      val?.rentalType === RentalType.Hourly &&
      val?.hourlyStartTime === '08:00' &&
      val?.hourlyEndTime === '18:00'
    );
  }

  applyDayUsePreset(): void {
    this.createForm.patchValue({
      rentalType: RentalType.Hourly,
      hourlyDate: this.createForm.get('checkInDate')?.value || getTodayVnDateString(),
      hourlyStartTime: '08:00',
      hourlyEndTime: '18:00'
    });
    this.onRentalTypeChanged();
  }

  loadProvinces(): void {
    if (this.provinces().length > 0 || this.isLoadingProvinces()) return;
    this.isLoadingProvinces.set(true);
    this.provincesSub?.unsubscribe();
    this.provincesSub = this.locationService?.getProvinces().subscribe({
      next: (list) => {
        this.provinces.set(list || []);
        this.isLoadingProvinces.set(false);
      },
      error: () => {
        this.isLoadingProvinces.set(false);
      }
    });
  }

  onProvinceChange(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    const selected = this.provinces().find(p => p.code === code);
    this.createForm.patchValue({
      provinceCode: code,
      provinceName: selected?.name || '',
      wardCode: '',
      wardName: ''
    });
    this.wards.set([]);

    if (!code) return;

    this.isLoadingWards.set(true);
    this.wardsSub?.unsubscribe();
    this.wardsSub = this.locationService?.getWards(code).subscribe({
      next: (list) => {
        this.wards.set(list || []);
        this.isLoadingWards.set(false);
      },
      error: () => {
        this.isLoadingWards.set(false);
      }
    });
  }

  onWardChange(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    const selected = this.wards().find(w => w.code === code);
    this.createForm.patchValue({
      wardCode: code,
      wardName: selected?.name || ''
    });
  }
}

