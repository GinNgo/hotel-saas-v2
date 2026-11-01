import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RateService } from '../../core/services/rate.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomTypeRateDto, RoomTypeRateAuditDto, CreateRoomTypeRateRequest } from '../../core/models/rate.model';
import { RoomTypeDto } from '../../core/models/room-type.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonTableComponent } from '../../shared/components/skeleton-table/skeleton-table.component';

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

@Component({
  selector: 'app-rates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, SkeletonTableComponent],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Bảng giá phòng & Lịch sử hiệu lực</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Chi nhánh
            </span>
            @if (!canUpdate()) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Chỉ đọc (Read-Only)
              </span>
            }
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý bảng giá theo khoảng ngày hiệu lực, cơ chế tự động chia khoảng (interval splitting) và lịch sử kiểm toán.
          </p>
        </div>

        <!-- Top Actions -->
        <div class="flex items-center gap-2">
          <!-- Chi nhánh hiện tại -->
          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 text-xs text-slate-600 font-medium border border-slate-200/70">
            <i class="pi pi-building text-emerald-600"></i>
            <span>{{ authService.activePropertyName() || 'Chưa chọn chi nhánh' }}</span>
          </div>

          <!-- Timezone Indicator -->
          <div class="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/60 text-[11px] text-slate-500 border border-slate-200/60" title="Múi giờ Asia/Ho_Chi_Minh">
            <i class="pi pi-clock text-slate-400"></i>
            <span>UTC+7</span>
          </div>

          <!-- Nút Thiết lập bảng giá -->
          @if (canUpdate() && selectedRoomTypeId()) {
            <button
              type="button"
              (click)="openCreateModal()"
              [disabled]="isSaving() || isLoadingRates() || !propertyId()"
              aria-label="Thiết lập bảng giá mới"
              title="Thiết lập bảng giá mới"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <i class="pi pi-plus text-sm"></i>
              <span>Thiết lập bảng giá</span>
            </button>
          }
        </div>
      </div>

      <!-- Không có quyền hoặc chưa chọn chi nhánh -->
      @if (!canRead()) {
        <app-empty-state
          iconClass="pi pi-lock"
          title="Không có quyền truy cập"
          description="Bạn không có quyền xem cấu hình bảng giá phòng (yêu cầu quyền ROOM_TYPES.Read)."
        />
      } @else if (!propertyId()) {
        <app-empty-state
          iconClass="pi pi-building"
          title="Chưa chọn chi nhánh làm việc"
          description="Vui lòng bấm vào bộ chuyển chi nhánh ở thanh tiêu đề trên cùng để chọn chi nhánh cần quản lý bảng giá."
        />
      } @else {
        <!-- Room Type Selector Bar -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
              <i class="pi pi-tags"></i>
            </div>
            <div>
              <label for="roomTypeSelect" class="block text-xs font-bold text-slate-800">
                Chọn loại phòng cần quản lý bảng giá:
              </label>
              <p class="text-[11px] text-slate-400">
                Mỗi loại phòng có các khoảng bảng giá độc lập theo từng thời điểm
              </p>
            </div>
          </div>

          <div class="w-full sm:w-72">
            <select
              id="roomTypeSelect"
              [value]="selectedRoomTypeId() || ''"
              (change)="onRoomTypeChanged($any($event.target).value)"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              aria-label="Chọn loại phòng"
            >
              <option value="" disabled>--- Chọn loại phòng ---</option>
              @for (rt of roomTypes(); track rt.id) {
                <option [value]="rt.id">
                  {{ rt.name }} ({{ rt.code }})
                </option>
              }
            </select>
          </div>
        </div>

        <!-- Content Area -->
        @if (isLoadingRoomTypes()) {
          <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <app-skeleton-table [rows]="3" />
          </div>
        } @else if (roomTypes().length === 0) {
          <app-empty-state
            iconClass="pi pi-tags"
            title="Chi nhánh chưa có loại phòng"
            description="Chi nhánh hiện tại chưa tạo loại phòng nào. Vui lòng tạo loại phòng ở danh mục trước khi cấu hình bảng giá."
          />
        } @else if (!selectedRoomTypeId()) {
          <app-empty-state
            iconClass="pi pi-arrow-up"
            title="Chưa chọn loại phòng"
            description="Vui lòng chọn một loại phòng từ danh sách phía trên để xem các khoảng giá đang áp dụng và lịch sử thay đổi."
          />
        } @else {
          <!-- Selected Room Type Info Banner & BasePrice Discard Warning -->
          @if (selectedRoomType(); as currentRt) {
            <div class="bg-gradient-to-r from-slate-50 to-emerald-50/30 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-slate-800">{{ currentRt.name }}</span>
                  <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white border border-slate-200 text-emerald-700">
                    {{ currentRt.code }}
                  </span>
                  <span class="text-xs text-slate-500">
                    • Sức chứa: {{ currentRt.maxOccupancy }} khách • {{ currentRt.roomCount }} phòng
                  </span>
                </div>
                <div class="text-xs text-slate-500">
                  Giá tham chiếu cơ bản: <span class="font-semibold text-slate-700">{{ formatCurrency(currentRt.basePrice) }}</span>
                </div>
              </div>
              <p class="text-[11px] text-amber-800 bg-amber-50/80 px-3 py-1.5 rounded-lg border border-amber-200/60 leading-relaxed">
                <i class="pi pi-info-circle mr-1 text-amber-600"></i>
                <strong>Quy tắc hợp đồng:</strong> Hệ thống tính giá và báo giá không sử dụng giá cơ bản tham chiếu (BasePrice). Bảng giá theo ngày hiệu lực dưới đây là nguồn dữ liệu chính thức duy nhất.
              </p>
            </div>
          }

          <!-- Tabs Switcher -->
          <div class="flex items-center gap-2 border-b border-slate-200/80 pb-1">
            <button
              type="button"
              (click)="activeTab.set('rates')"
              class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              [ngClass]="activeTab() === 'rates' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
              aria-label="Xem bảng giá áp dụng"
            >
              <i class="pi pi-calendar"></i>
              <span>Bảng giá đang áp dụng & Sắp tới</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px]" [ngClass]="activeTab() === 'rates' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'">
                {{ rates().length }}
              </span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('history')"
              class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              [ngClass]="activeTab() === 'history' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
              aria-label="Xem lịch sử thay đổi và chia khoảng"
            >
              <i class="pi pi-history"></i>
              <span>Lịch sử thay đổi & Chia khoảng</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px]" [ngClass]="activeTab() === 'history' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'">
                {{ rateHistory().length }}
              </span>
            </button>
          </div>

          <!-- Tab 1: Active & Upcoming Rates Table -->
          @if (activeTab() === 'rates') {
            @if (isLoadingRates()) {
              <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <app-skeleton-table [rows]="4" />
              </div>
            } @else if (ratesErrorMessage()) {
              <div class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
                <div class="flex items-center gap-2.5">
                  <i class="pi pi-exclamation-triangle text-xl text-rose-600"></i>
                  <h3 class="font-bold text-sm">Không thể tải dữ liệu bảng giá</h3>
                </div>
                <p class="text-xs text-rose-700 leading-relaxed">{{ ratesErrorMessage() }}</p>
                <button
                  type="button"
                  (click)="loadRatesData()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <i class="pi pi-refresh"></i>
                  <span>Thử lại</span>
                </button>
              </div>
            } @else if (rates().length === 0) {
              <div class="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div class="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                  <i class="pi pi-calendar-times"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-800">Chưa có bảng giá hiệu lực theo ngày</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Loại phòng này chưa được cấu hình bảng giá có thời hạn hiệu lực. Để mở bán và tính tiền đặt phòng, vui lòng tạo bảng giá mới.
                </p>
                @if (canUpdate()) {
                  <div class="pt-2">
                    <button
                      type="button"
                      (click)="openCreateModal()"
                      class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <i class="pi pi-plus"></i>
                      <span>Thiết lập bảng giá ngay</span>
                    </button>
                  </div>
                }
              </div>
            } @else {
              <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse" aria-label="Bảng giá phòng theo khoảng ngày hiệu lực">
                    <thead>
                      <tr class="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th scope="col" class="py-3 px-4">Khoảng ngày hiệu lực</th>
                        <th scope="col" class="py-3 px-4">Trạng thái</th>
                        <th scope="col" class="py-3 px-4">Gói giờ đầu</th>
                        <th scope="col" class="py-3 px-4">Mỗi giờ thêm</th>
                        <th scope="col" class="py-3 px-4">Giá qua đêm</th>
                        <th scope="col" class="py-3 px-4">Lý do thay đổi</th>
                        <th scope="col" class="py-3 px-4 text-right">Ngày cấu hình</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs">
                      @for (rate of rates(); track rate.id) {
                        <tr class="hover:bg-slate-50/80 transition-colors">
                          <!-- Khoảng ngày -->
                          <td class="py-3.5 px-4 font-mono font-semibold text-slate-800">
                            <div class="flex items-center gap-1.5">
                              <i class="pi pi-calendar text-slate-400 text-xs"></i>
                              <span>{{ formatDate(rate.effectiveFrom) }}</span>
                              <i class="pi pi-arrow-right text-[10px] text-slate-400"></i>
                              <span>{{ formatDate(rate.effectiveTo) }}</span>
                            </div>
                          </td>

                          <!-- Trạng thái -->
                          <td class="py-3.5 px-4">
                            @if (getRateStatus(rate) === 'active') {
                              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                Đang áp dụng
                              </span>
                            } @else if (getRateStatus(rate) === 'upcoming') {
                              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                Sắp áp dụng
                              </span>
                            } @else {
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                Hết hiệu lực
                              </span>
                            }
                          </td>

                          <!-- Giá giờ đầu -->
                          <td class="py-3.5 px-4 text-slate-700">
                            <span class="font-bold text-slate-800">{{ formatCurrency(rate.firstHoursPrice) }}</span>
                            <span class="text-slate-400 text-[11px]"> / {{ rate.firstHours }} giờ</span>
                          </td>

                          <!-- Giá giờ thêm -->
                          <td class="py-3.5 px-4 text-slate-700">
                            <span class="font-semibold text-slate-800">{{ formatCurrency(rate.additionalHourPrice) }}</span>
                            <span class="text-slate-400 text-[11px]"> / giờ</span>
                          </td>

                          <!-- Giá qua đêm -->
                          <td class="py-3.5 px-4">
                            <span class="font-bold text-emerald-700">{{ formatCurrency(rate.nightlyPrice) }}</span>
                            <span class="text-slate-400 text-[11px]"> / đêm</span>
                          </td>

                          <!-- Lý do -->
                          <td class="py-3.5 px-4 text-slate-500 italic max-w-xs truncate" [title]="rate.changeReason || ''">
                            {{ rate.changeReason || '—' }}
                          </td>

                          <!-- Ngày tạo -->
                          <td class="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                            {{ formatDateTime(rate.createdAtUtc) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }

          <!-- Tab 2: Rate History & Interval Splitting Audit Table -->
          @if (activeTab() === 'history') {
            @if (isLoadingHistory()) {
              <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <app-skeleton-table [rows]="4" />
              </div>
            } @else if (historyErrorMessage()) {
              <div class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
                <div class="flex items-center gap-2.5">
                  <i class="pi pi-exclamation-triangle text-xl text-rose-600"></i>
                  <h3 class="font-bold text-sm">Không thể tải lịch sử thay đổi bảng giá</h3>
                </div>
                <p class="text-xs text-rose-700 leading-relaxed">{{ historyErrorMessage() }}</p>
                <button
                  type="button"
                  (click)="loadHistoryData()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <i class="pi pi-refresh"></i>
                  <span>Thử lại tải lịch sử</span>
                </button>
              </div>
            } @else if (rateHistory().length === 0) {
              <div class="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <i class="pi pi-history text-2xl text-slate-400"></i>
                <h3 class="text-sm font-bold text-slate-800">Chưa có lịch sử thay đổi bảng giá</h3>
                <p class="text-xs text-slate-500">Mọi hành vi tạo mới, chia khoảng (interval split) hoặc thay thế khoảng giá sẽ được ghi nhận tại đây.</p>
              </div>
            } @else {
              <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse" aria-label="Lịch sử thay đổi bảng giá và chia khoảng">
                    <thead>
                      <tr class="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th scope="col" class="py-3 px-4">Thao tác</th>
                        <th scope="col" class="py-3 px-4">Khoảng ngày áp dụng</th>
                        <th scope="col" class="py-3 px-4">Giá qua đêm</th>
                        <th scope="col" class="py-3 px-4">Lý do thay đổi</th>
                        <th scope="col" class="py-3 px-4">Thời gian ghi nhận</th>
                        <th scope="col" class="py-3 px-4 text-right">Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs">
                      @for (item of rateHistory(); track item.id) {
                        <tr class="hover:bg-slate-50/80 transition-colors">
                          <!-- Thao tác badge -->
                          <td class="py-3.5 px-4">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border" [ngClass]="getActionBadgeClass(item.actionType)">
                              {{ getActionLabel(item.actionType) }}
                            </span>
                          </td>

                          <!-- Khoảng ngày -->
                          <td class="py-3.5 px-4 font-mono text-slate-700">
                            @if (item.oldEffectiveFrom && item.oldEffectiveTo) {
                              <div class="text-[11px] text-slate-400 line-through flex items-center gap-1">
                                <span>{{ formatDate(item.oldEffectiveFrom) }}</span>
                                <span>→</span>
                                <span>{{ formatDate(item.oldEffectiveTo) }}</span>
                              </div>
                            }
                            <div class="font-semibold text-slate-800 flex items-center gap-1">
                              <span>{{ formatDate(item.newEffectiveFrom) }}</span>
                              <span>→</span>
                              <span>{{ formatDate(item.newEffectiveTo) }}</span>
                            </div>
                          </td>

                          <!-- Giá qua đêm -->
                          <td class="py-3.5 px-4">
                            @if (item.oldNightlyPrice !== null && item.oldNightlyPrice !== undefined) {
                              <div class="text-[11px] text-slate-400 line-through">
                                {{ formatCurrency(item.oldNightlyPrice) }}
                              </div>
                            }
                            <div class="font-bold text-emerald-700">
                              {{ formatCurrency(item.newNightlyPrice) }}
                            </div>
                          </td>

                          <!-- Lý do -->
                          <td class="py-3.5 px-4 text-slate-600 italic max-w-xs truncate" [title]="item.changeReason || ''">
                            {{ item.changeReason || '—' }}
                          </td>

                          <!-- Thời gian ghi nhận -->
                          <td class="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                            {{ formatDateTime(item.changedAtUtc) }}
                          </td>

                          <!-- Người thực hiện -->
                          <td class="py-3.5 px-4 text-right font-mono text-slate-400 text-[10px]">
                            {{ item.changedByUserId.substring(0, 8) }}...
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
        }
      }

    </div>

    <!-- Modal: Thiết lập Bảng giá mới (Create / Split Rate) -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-xl w-full p-6 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                  <i class="pi pi-calendar-plus"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Thiết lập bảng giá mới</h3>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Áp dụng cho: <strong>{{ modalTargetRoomType()?.name }}</strong> ({{ modalTargetRoomType()?.code }})
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="closeCreateModal()"
                [disabled]="isSaving()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng hộp thoại"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <!-- Explanatory note on interval splitting -->
            <div class="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-900 text-xs leading-relaxed">
              <div class="font-bold flex items-center gap-1.5 text-sky-800 mb-0.5">
                <i class="pi pi-info-circle text-sky-600"></i>
                <span>Cơ chế chia khoảng tự động (Interval Splitting):</span>
              </div>
              Nếu ngày hiệu lực mới nằm giữa khoảng giá đang có, hệ thống sẽ tự động rút ngắn khoảng cũ và tạo khoảng giá mới mà không làm mất tính toàn vẹn dữ liệu.
            </div>

            <!-- Validation Errors Alert -->
            @if (clientErrors().length > 0) {
              <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div class="font-bold flex items-center gap-1.5 text-amber-800">
                  <i class="pi pi-exclamation-circle text-amber-600"></i>
                  <span>Vui lòng kiểm tra lại thông tin:</span>
                </div>
                <ul class="list-disc pl-5 space-y-0.5 text-[11px]">
                  @for (err of clientErrors(); track $index) {
                    <li>{{ err }}</li>
                  }
                </ul>
              </div>
            }

            <!-- Server Conflict Alert (409) -->
            @if (conflictError()) {
              <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <div class="font-bold flex items-center gap-1.5 text-rose-700">
                  <i class="pi pi-ban text-rose-600"></i>
                  <span>Xung đột khoảng thời gian hiệu lực (409 Conflict):</span>
                </div>
                <p class="text-[11px] leading-relaxed">{{ conflictError() }}</p>
              </div>
            }

            <!-- Form -->
            <form [formGroup]="rateForm" (ngSubmit)="submitRate()" class="space-y-4">
              <!-- Dates Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <!-- EffectiveFrom -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">
                    Từ ngày hiệu lực <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    formControlName="effectiveFrom"
                    [min]="minEffectiveFromDate"
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white"
                    aria-label="Ngày bắt đầu hiệu lực"
                  />
                  <p class="text-[10px] text-slate-400">Không được chọn ngày trong quá khứ</p>
                </div>

                <!-- EffectiveTo -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">
                    Đến ngày hiệu lực <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    formControlName="effectiveTo"
                    [min]="rateForm.get('effectiveFrom')?.value || minEffectiveFromDate"
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white"
                    aria-label="Ngày kết thúc hiệu lực"
                  />
                  <p class="text-[10px] text-slate-400">Phải lớn hơn ngày bắt đầu</p>
                </div>
              </div>

              <!-- Hourly Prices Row -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <!-- FirstHours -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">
                    Số giờ gói đầu <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    formControlName="firstHours"
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white font-medium"
                    aria-label="Số giờ gói đầu"
                  />
                  <p class="text-[10px] text-slate-400">Mặc định: 2 giờ</p>
                </div>

                <!-- FirstHoursPrice -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">
                    Giá gói đầu (VND) <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    formControlName="firstHoursPrice"
                    placeholder="Nhập giá gói đầu..."
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white font-medium"
                    aria-label="Giá gói đầu"
                  />
                </div>

                <!-- AdditionalHourPrice -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">
                    Giá mỗi giờ thêm (VND) <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    formControlName="additionalHourPrice"
                    placeholder="Nhập giá mỗi giờ thêm..."
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white font-medium"
                    aria-label="Giá mỗi giờ thêm"
                  />
                </div>
              </div>

              <!-- Nightly Price Row -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Giá thuê qua đêm tiêu chuẩn (VND) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    formControlName="nightlyPrice"
                    placeholder="Nhập giá thuê qua đêm..."
                    class="w-full h-10 px-3.5 pr-14 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-emerald-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white"
                    aria-label="Giá thuê qua đêm tiêu chuẩn"
                  />
                  <span class="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">VND</span>
                </div>
              </div>

              <!-- Change Reason -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Lý do thay đổi / Ghi chú kiểm toán
                </label>
                <textarea
                  rows="2"
                  formControlName="changeReason"
                  placeholder="Ví dụ: Cập nhật giá mùa du lịch, áp dụng khuyến mãi hè..."
                  class="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs bg-white"
                  aria-label="Lý do thay đổi"
                ></textarea>
              </div>

              <!-- Modal Actions -->
              <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  (click)="closeCreateModal()"
                  [disabled]="isSaving()"
                  class="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  [disabled]="isSaving() || !canUpdate()"
                  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-all shadow-sm shadow-emerald-600/30 cursor-pointer disabled:cursor-not-allowed"
                >
                  @if (isSaving()) {
                    <i class="pi pi-spin pi-spinner text-xs"></i>
                    <span>Đang lưu...</span>
                  } @else {
                    <i class="pi pi-check text-xs"></i>
                    <span>Xác nhận thiết lập</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
  `
})
export class RatesPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly rateService = inject(RateService);
  private readonly roomTypeService = inject(RoomTypeService);
  private readonly alertService = inject(AlertService);

  readonly isLoadingRates = signal(false);
  readonly isLoadingHistory = signal(false);
  readonly isLoadingRoomTypes = signal(false);
  readonly isSaving = signal(false);
  readonly ratesErrorMessage = signal<string | null>(null);
  readonly historyErrorMessage = signal<string | null>(null);
  readonly clientErrors = signal<string[]>([]);
  readonly conflictError = signal<string | null>(null);

  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly selectedRoomTypeId = signal<string | null>(null);
  readonly rates = signal<RoomTypeRateDto[]>([]);
  readonly rateHistory = signal<RoomTypeRateAuditDto[]>([]);

  readonly modalTargetRoomTypeId = signal<string | null>(null);
  readonly modalTargetPropertyId = signal<string | null>(null);

  readonly activeTab = signal<'rates' | 'history'>('rates');
  readonly showCreateModal = signal(false);

  readonly minEffectiveFromDate = getTodayVnDateString();

  readonly propertyId = computed(() => this.authService.activePropertyId());
  readonly canRead = computed(() => this.authService.hasPermission('ROOM_TYPES', 1));
  readonly canUpdate = computed(() => this.authService.hasPermission('ROOM_TYPES', 4));

  readonly selectedRoomType = computed(() => {
    const id = this.selectedRoomTypeId();
    if (!id) return null;
    return this.roomTypes().find(rt => rt.id === id) || null;
  });

  readonly modalTargetRoomType = computed(() => {
    const id = this.modalTargetRoomTypeId();
    if (!id) return null;
    return this.roomTypes().find(rt => rt.id === id) || null;
  });

  rateForm!: FormGroup;

  private loadSub?: Subscription;
  private historySub?: Subscription;
  private roomTypesSub?: Subscription;
  private saveSub?: Subscription;
  private routeQuerySub?: Subscription;

  constructor() {
    this.initForm();

    try {
      effect(() => {
        const propId = this.propertyId();
        untracked(() => {
          this.handlePropertyContextChange(propId);
        });
      });
    } catch {
      // Ignored in headless tests
    }
  }

  ngOnInit(): void {
    // Check query params for initial roomTypeId
    this.routeQuerySub = this.route.queryParams.subscribe(params => {
      const qRoomTypeId = params['roomTypeId'];
      if (qRoomTypeId && qRoomTypeId !== this.selectedRoomTypeId()) {
        if (this.showCreateModal() || this.isSaving()) {
          this.cancelSave();
          this.closeCreateModal();
        }
        this.selectedRoomTypeId.set(qRoomTypeId);
        if (this.propertyId() && this.canRead()) {
          this.loadRatesData();
        }
      }
    });

    if (this.propertyId() && this.canRead()) {
      this.loadRoomTypes();
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingRequests();
    this.routeQuerySub?.unsubscribe();
  }

  private initForm(): void {
    const today = getTodayVnDateString();
    const oneYearLater = addDaysToDateString(today, 365);

    this.rateForm = this.fb.group({
      effectiveFrom: [today, [Validators.required]],
      effectiveTo: [oneYearLater, [Validators.required]],
      firstHours: [2, [Validators.required, Validators.min(1)]],
      firstHoursPrice: [null, [Validators.required, Validators.min(0)]],
      additionalHourPrice: [null, [Validators.required, Validators.min(0)]],
      nightlyPrice: [null, [Validators.required, Validators.min(0)]],
      changeReason: ['']
    });
  }

  handlePropertyContextChange(newPropId: string | null): void {
    this.cancelPendingRequests();
    this.rates.set([]);
    this.rateHistory.set([]);
    this.roomTypes.set([]);
    this.selectedRoomTypeId.set(null);
    this.modalTargetRoomTypeId.set(null);
    this.modalTargetPropertyId.set(null);
    this.isLoadingRates.set(false);
    this.isLoadingHistory.set(false);
    this.isSaving.set(false);
    this.ratesErrorMessage.set(null);
    this.historyErrorMessage.set(null);
    this.clientErrors.set([]);
    this.conflictError.set(null);
    this.showCreateModal.set(false);

    if (newPropId && this.canRead()) {
      this.loadRoomTypes();
    }
  }

  loadRoomTypes(): void {
    if (!this.canRead() || !this.propertyId()) return;

    this.isLoadingRoomTypes.set(true);
    this.roomTypesSub?.unsubscribe();

    this.roomTypesSub = this.roomTypeService.getRoomTypes(undefined, 1, 100).subscribe({
      next: res => {
        this.isLoadingRoomTypes.set(false);
        const rawItems = res.items || [];
        const list = rawItems.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
        this.roomTypes.set(list);

        // If there is an active selection already, keep it; otherwise pick first if available
        const currentSelected = this.selectedRoomTypeId();
        if (currentSelected && list.some(rt => rt.id === currentSelected)) {
          this.loadRatesData();
        } else if (list.length > 0) {
          this.selectedRoomTypeId.set(list[0].id);
          this.loadRatesData();
        }
      },
      error: err => {
        this.isLoadingRoomTypes.set(false);
        const msg = err?.error?.message || err?.message || 'Không thể tải danh sách loại phòng.';
        this.ratesErrorMessage.set(msg);
      }
    });
  }

  onRoomTypeChanged(roomTypeId: string): void {
    if (!roomTypeId || roomTypeId === this.selectedRoomTypeId()) return;

    // Reset/close modal and cancel pending save if open
    if (this.showCreateModal() || this.isSaving()) {
      this.cancelSave();
      this.closeCreateModal();
    }

    this.selectedRoomTypeId.set(roomTypeId);
    // Update query params in URL without reloading
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { roomTypeId },
      queryParamsHandling: 'merge'
    });
    this.loadRatesData();
  }

  loadRatesData(): void {
    const roomTypeId = this.selectedRoomTypeId();
    const propId = this.propertyId();
    if (!roomTypeId || !propId || !this.canRead()) return;

    // Immediately clear previous data to prevent stale display under new room type
    this.cancelRateRequests();
    this.rates.set([]);
    this.isLoadingRates.set(true);
    this.ratesErrorMessage.set(null);

    const currentReqPropId = propId;
    const currentReqRtId = roomTypeId;

    // Load active rates
    this.loadSub = this.rateService.getRates(roomTypeId, propId).subscribe({
      next: (rates: RoomTypeRateDto[]) => {
        if (this.propertyId() !== currentReqPropId || this.selectedRoomTypeId() !== currentReqRtId) return;
        this.rates.set(rates || []);
        this.isLoadingRates.set(false);
      },
      error: (err: any) => {
        if (this.propertyId() !== currentReqPropId || this.selectedRoomTypeId() !== currentReqRtId) return;
        this.isLoadingRates.set(false);
        const msg = err?.error?.message || err?.message || 'Không thể tải bảng giá phòng.';
        this.ratesErrorMessage.set(msg);
      }
    });

    // Load audit history separately
    this.loadHistoryData();
  }

  loadHistoryData(): void {
    const roomTypeId = this.selectedRoomTypeId();
    const propId = this.propertyId();
    if (!roomTypeId || !propId || !this.canRead()) return;

    this.historySub?.unsubscribe();
    this.rateHistory.set([]);
    this.isLoadingHistory.set(true);
    this.historyErrorMessage.set(null);

    const currentReqPropId = propId;
    const currentReqRtId = roomTypeId;

    this.historySub = this.rateService.getRateHistory(roomTypeId, propId).subscribe({
      next: (history: RoomTypeRateAuditDto[]) => {
        if (this.propertyId() !== currentReqPropId || this.selectedRoomTypeId() !== currentReqRtId) return;
        this.rateHistory.set(history || []);
        this.isLoadingHistory.set(false);
      },
      error: (err: any) => {
        if (this.propertyId() !== currentReqPropId || this.selectedRoomTypeId() !== currentReqRtId) return;
        this.isLoadingHistory.set(false);
        const msg = err?.error?.message || err?.message || 'Không thể tải lịch sử thay đổi bảng giá.';
        this.historyErrorMessage.set(msg);
      }
    });
  }

  openCreateModal(): void {
    const propId = this.propertyId();
    const rtId = this.selectedRoomTypeId();
    if (!this.canUpdate() || !propId || !rtId) return;

    const rt = this.roomTypes().find(r => r.id === rtId);
    if (!rt) return;

    // Snapshot target room type and property
    this.modalTargetRoomTypeId.set(rtId);
    this.modalTargetPropertyId.set(propId);
    this.clientErrors.set([]);
    this.conflictError.set(null);

    const today = getTodayVnDateString();
    const oneYearLater = addDaysToDateString(today, 365);

    // Strictly DO NOT populate prices from basePrice or synthetic heuristics
    this.rateForm.reset({
      effectiveFrom: today,
      effectiveTo: oneYearLater,
      firstHours: 2,
      firstHoursPrice: null,
      additionalHourPrice: null,
      nightlyPrice: null,
      changeReason: ''
    });

    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    if (this.isSaving()) return;
    this.showCreateModal.set(false);
    this.modalTargetRoomTypeId.set(null);
    this.modalTargetPropertyId.set(null);
    this.clientErrors.set([]);
    this.conflictError.set(null);
  }

  validateForm(): string[] {
    const errors: string[] = [];
    const val = this.rateForm.value;

    if (!val.effectiveFrom) {
      errors.push('Ngày bắt đầu hiệu lực không được để trống.');
    } else if (val.effectiveFrom < this.minEffectiveFromDate) {
      errors.push('Ngày bắt đầu hiệu lực không được nằm trong quá khứ.');
    }

    if (!val.effectiveTo) {
      errors.push('Ngày kết thúc hiệu lực không được để trống.');
    } else if (val.effectiveFrom && val.effectiveTo <= val.effectiveFrom) {
      errors.push('Ngày kết thúc hiệu lực (EffectiveTo) phải lớn hơn ngày bắt đầu (EffectiveFrom).');
    }

    if (val.firstHours === null || val.firstHours === undefined || val.firstHours === '' || Number(val.firstHours) <= 0) {
      errors.push('Số giờ gói đầu tiên phải lớn hơn 0.');
    }

    if (val.firstHoursPrice === null || val.firstHoursPrice === undefined || val.firstHoursPrice === '') {
      errors.push('Vui lòng nhập giá gói giờ đầu.');
    } else if (Number(val.firstHoursPrice) < 0) {
      errors.push('Giá gói giờ đầu không được âm.');
    }

    if (val.additionalHourPrice === null || val.additionalHourPrice === undefined || val.additionalHourPrice === '') {
      errors.push('Vui lòng nhập giá mỗi giờ thêm.');
    } else if (Number(val.additionalHourPrice) < 0) {
      errors.push('Giá mỗi giờ thêm không được âm.');
    }

    if (val.nightlyPrice === null || val.nightlyPrice === undefined || val.nightlyPrice === '') {
      errors.push('Vui lòng nhập giá thuê qua đêm tiêu chuẩn.');
    } else if (Number(val.nightlyPrice) < 0) {
      errors.push('Giá thuê qua đêm không được âm.');
    }

    return errors;
  }

  submitRate(): void {
    const targetRoomTypeId = this.modalTargetRoomTypeId();
    const targetPropertyId = this.modalTargetPropertyId();

    // Strict entry guard binding modal snapshot to current context
    if (
      this.isSaving() ||
      !this.canUpdate() ||
      !targetPropertyId ||
      !targetRoomTypeId ||
      targetPropertyId !== this.propertyId() ||
      targetRoomTypeId !== this.selectedRoomTypeId() ||
      !this.roomTypes().some(rt => rt.id === targetRoomTypeId)
    ) {
      return;
    }

    const errors = this.validateForm();
    this.clientErrors.set(errors);
    this.conflictError.set(null);

    if (errors.length > 0) {
      this.alertService.toastError('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ.');
      return;
    }

    const val = this.rateForm.value;

    const payload: CreateRoomTypeRateRequest = {
      roomTypeId: targetRoomTypeId,
      propertyId: targetPropertyId,
      firstHours: Number(val.firstHours),
      firstHoursPrice: Number(val.firstHoursPrice),
      additionalHourPrice: Number(val.additionalHourPrice),
      nightlyPrice: Number(val.nightlyPrice),
      effectiveFrom: val.effectiveFrom,
      effectiveTo: val.effectiveTo,
      currency: 'VND',
      changeReason: val.changeReason?.trim() || null
    };

    this.isSaving.set(true);
    this.saveSub?.unsubscribe();

    this.saveSub = this.rateService.createRate(targetRoomTypeId, payload).subscribe({
      next: (createdRate: RoomTypeRateDto) => {
        // Discard response if roomType or branch context changed while request was in-flight
        if (
          this.propertyId() !== targetPropertyId ||
          this.selectedRoomTypeId() !== targetRoomTypeId ||
          this.modalTargetRoomTypeId() !== targetRoomTypeId
        ) {
          return;
        }
        this.isSaving.set(false);
        this.closeCreateModal();
        this.alertService.toastSuccess('Thiết lập bảng giá thành công.');
        this.loadRatesData();
      },
      error: (err: any) => {
        // Discard error if context changed while request was in-flight
        if (
          this.propertyId() !== targetPropertyId ||
          this.selectedRoomTypeId() !== targetRoomTypeId ||
          this.modalTargetRoomTypeId() !== targetRoomTypeId
        ) {
          return;
        }
        this.isSaving.set(false);
        if (err?.status === 409) {
          const detail = err?.error?.message || 'Khoảng ngày hiệu lực bị trùng lặp hoặc xung đột với bảng giá hiện có không thể chia tự động. Vui lòng kiểm tra lại ngày bắt đầu và kết thúc.';
          this.conflictError.set(detail);
          this.alertService.toastError(detail, 'Xung đột bảng giá (409)');
        } else {
          const detail = err?.error?.message || err?.message || 'Lỗi khi thiết lập bảng giá.';
          this.alertService.toastError(detail, 'Lỗi thiết lập');
        }
      }
    });
  }

  getRateStatus(rate: RoomTypeRateDto): 'active' | 'upcoming' | 'expired' {
    const today = getTodayVnDateString();
    if (today >= rate.effectiveFrom && today < rate.effectiveTo) {
      return 'active';
    }
    if (today < rate.effectiveFrom) {
      return 'upcoming';
    }
    return 'expired';
  }

  getActionBadgeClass(actionType: string): string {
    switch (actionType) {
      case 'Created':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Split_Created':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Split_Shortened':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Replaced':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Replaced_Created':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getActionLabel(actionType: string): string {
    switch (actionType) {
      case 'Created':
        return 'Tạo mới';
      case 'Split_Created':
        return 'Chia khoảng (Tạo mới)';
      case 'Split_Shortened':
        return 'Chia khoảng (Rút ngắn)';
      case 'Replaced':
        return 'Thay thế (Hủy cũ)';
      case 'Replaced_Created':
        return 'Thay thế (Áp dụng)';
      default:
        return actionType;
    }
  }

  formatCurrency(value?: number | null): string {
    if (value === null || value === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    const parts = dateStr.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  formatDateTime(isoStr?: string | null): string {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return isoStr;
    }
  }

  private cancelRateRequests(): void {
    if (this.loadSub) {
      this.loadSub.unsubscribe();
      this.loadSub = undefined;
    }
    if (this.historySub) {
      this.historySub.unsubscribe();
      this.historySub = undefined;
    }
  }

  private cancelSave(): void {
    if (this.saveSub) {
      this.saveSub.unsubscribe();
      this.saveSub = undefined;
    }
  }

  private cancelPendingRequests(): void {
    this.cancelRateRequests();
    this.cancelSave();
    if (this.roomTypesSub) {
      this.roomTypesSub.unsubscribe();
      this.roomTypesSub = undefined;
    }
  }
}
