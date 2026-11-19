import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { RoomService, GetRoomsFilter, RoomSyncStatus } from '../../core/services/room.service';
import { HousekeepingService } from '../../core/services/housekeeping.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import {
  HousekeepingPriority,
  HousekeepingStaffOptionDto,
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  HOUSEKEEPING_PRIORITY_LABELS,
  HOUSEKEEPING_TASK_STATUS_LABELS
} from '../../core/models/housekeeping.model';
import { HttpErrorResponse } from '@angular/common/http';
import { SkeletonTableComponent } from '../../shared/components/skeleton-table/skeleton-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ContextSelectorDialogComponent } from '../auth/context-selector/context-selector.dialog';

/**
 * Màn hình Quản lý Buồng phòng (Housekeeping Board).
 * Triển khai chuẩn ADMIN-COMPLETE-01 (Lát cắt C):
 * - Hiển thị trực quan danh sách phòng theo tầng và trạng thái buồng phòng.
 * - Phân trang server-side kết hợp bộ lọc (status, floor, search) gửi trực tiếp lên backend.
 * - KPI ghi rõ "trên trang đang hiển thị", không quy nạp thành tổng chi nhánh.
 * - Thao tác chuyển đổi trạng thái một chạm tuân thủ nghiêm ngặt State Machine của Backend (PATCH /api/rooms/{id}/status).
 * - Luôn gửi kèm expectedOldStatus và xử lý xung đột đồng thời 409 ERR_STALE_STATE.
 * - Kiểm tra phân quyền cập nhật buồng phòng (HOUSEKEEPING.Update / ROOMS.Update).
 */
@Component({
  selector: 'app-housekeeping',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    SkeletonTableComponent,
    EmptyStateComponent,
    PaginationComponent,
    ContextSelectorDialogComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Buồng phòng</h1>
            @if (syncStatus() === 'connected') {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200" title="Đồng bộ thời gian thực từ máy chủ">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Máy chủ: Đang kết nối</span>
                @if (lastSyncTime()) {
                  <span class="font-normal text-[10px] text-emerald-600">({{ formatLastSyncTime() }})</span>
                }
              </span>
            } @else if (syncStatus() === 'reconnecting') {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>Đang kết nối lại...</span>
              </span>
            } @else if (syncStatus() === 'offline') {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                <i class="pi pi-wifi-off text-[10px]"></i>
                <span>Ngoại tuyến (Mất mạng)</span>
              </span>
            }
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi, phân luồng dọn dẹp và cập nhật trạng thái phòng vật lý theo State Machine chi nhánh.
            <span class="inline-block font-medium text-slate-600 ml-1">
              (KPI thống kê trên trang đang hiển thị)
            </span>
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="toggleAutoSync()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            [ngClass]="autoSyncEnabled() ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'"
            [title]="autoSyncEnabled() ? 'Tự động đồng bộ máy chủ đang BẬT (định kỳ 10 giây)' : 'Tự động đồng bộ đang TẮT'"
          >
            <i class="pi" [ngClass]="autoSyncEnabled() ? 'pi-sync' : 'pi-pause'"></i>
            <span class="hidden sm:inline">{{ autoSyncEnabled() ? 'Đồng bộ định kỳ (10s): Bật' : 'Đồng bộ định kỳ (10s): Tắt' }}</span>
          </button>

          <button
            type="button"
            (click)="refreshActiveView()"
            class="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="Làm mới dữ liệu buồng phòng"
            aria-label="Làm mới dữ liệu buồng phòng"
          >
            <i class="pi pi-refresh" [class.animate-spin]="loading() || tasksLoading()"></i>
            <span class="hidden sm:inline">Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      <!-- View Switcher: Queue vs Room Board -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold" role="tablist" aria-label="Chế độ xem Buồng phòng">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeViewTab() === 'queue'"
            (click)="setViewTab('queue')"
            class="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg transition-colors cursor-pointer"
            [ngClass]="activeViewTab() === 'queue' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            <i class="pi pi-list-check text-xs"></i>
            <span>Hàng đợi Buồng phòng</span>
            @if (urgentTasksCount() > 0) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                {{ urgentTasksCount() }}
              </span>
            }
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeViewTab() === 'board'"
            (click)="setViewTab('board')"
            class="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg transition-colors cursor-pointer"
            [ngClass]="activeViewTab() === 'board' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            <i class="pi pi-th-large text-xs"></i>
            <span>Sơ đồ Phòng theo tầng</span>
          </button>
        </div>

        @if (activeViewTab() === 'queue' && canCreateTask()) {
          <button
            type="button"
            (click)="openCreateTaskModal()"
            aria-label="Tạo nhiệm vụ dọn phòng mới"
            class="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <i class="pi pi-plus text-xs"></i>
            <span>Tạo nhiệm vụ dọn phòng</span>
          </button>
        }
      </div>

      <!-- TAB 1: HANG DOI BUONG PHONG (TASK QUEUE) -->
      @if (activeViewTab() === 'queue') {
        <!-- Task Queue KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3.5 rounded-xl border border-slate-200 bg-white">
            <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng nhiệm vụ</div>
            <div class="text-xl font-bold text-slate-800 mt-1">{{ tasks().length }}</div>
          </div>
          <div class="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
            <div class="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Khẩn (Sắp check-in)</div>
            <div class="text-xl font-bold text-rose-800 mt-1">{{ urgentTasksCount() }}</div>
          </div>
          <div class="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
            <div class="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Chờ / Đang dọn</div>
            <div class="text-xl font-bold text-amber-800 mt-1">{{ activeTasksCount() }}</div>
          </div>
          <div class="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <div class="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Hoàn tất</div>
            <div class="text-xl font-bold text-emerald-800 mt-1">{{ completedTasksCount() }}</div>
          </div>
        </div>

        <!-- Task Filters -->
        <div class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2.5">
            <select
              [ngModel]="taskStatusFilter()"
              (ngModelChange)="onTaskStatusFilterChange($event)"
              aria-label="Lọc theo trạng thái nhiệm vụ dọn phòng"
              class="min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium outline-none focus:border-emerald-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option [value]="HousekeepingTaskStatus.Pending">Chờ nhận</option>
              <option [value]="HousekeepingTaskStatus.Claimed">Đã nhận việc</option>
              <option [value]="HousekeepingTaskStatus.InProgress">Đang dọn</option>
              <option [value]="HousekeepingTaskStatus.Completed">Hoàn tất sạch</option>
            </select>

            <select
              [ngModel]="taskPriorityFilter()"
              (ngModelChange)="onTaskPriorityFilterChange($event)"
              aria-label="Lọc theo mức độ ưu tiên"
              class="min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium outline-none focus:border-emerald-500"
            >
              <option value="ALL">Tất cả ưu tiên</option>
              <option [value]="HousekeepingPriority.Urgent">Khẩn cấp</option>
              <option [value]="HousekeepingPriority.High">Cao</option>
              <option [value]="HousekeepingPriority.Normal">Bình thường</option>
              <option [value]="HousekeepingPriority.Low">Thấp</option>
            </select>

            <label class="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                [ngModel]="taskAssignedToMe()"
                (ngModelChange)="onAssignedToMeChange($event)"
                aria-label="Chỉ hiện việc được giao cho tôi"
                class="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Việc của tôi</span>
            </label>
          </div>
        </div>

        <!-- Task Queue List -->
        @if (tasksLoading() && tasks().length === 0) {
          <app-skeleton-table [rows]="5" />
        } @else if (!authService.activePropertyId()) {
          <div class="bg-white rounded-2xl border border-slate-200/80 p-10 shadow-2xs">
            <app-empty-state
              iconClass="pi pi-building"
              title="Vui lòng chọn chi nhánh làm việc"
              description="Hàng đợi buồng phòng được quản lý theo từng cơ sở. Vui lòng chọn một chi nhánh để xem và phân công công việc."
              actionLabel="Chọn chi nhánh làm việc"
              actionIcon="pi pi-building"
              (actionClick)="openContextSelector()"
            />
          </div>
        } @else if (tasks().length === 0) {
          <div class="bg-white rounded-2xl border border-slate-200/80 p-10 shadow-2xs">
            <app-empty-state
              iconClass="pi pi-sparkles"
              title="Hàng đợi buồng phòng đang trống"
              description="Hiện chưa có nhiệm vụ dọn phòng nào khớp bộ lọc. Nhấn 'Tạo nhiệm vụ dọn phòng' hoặc chờ hệ thống tự tạo sau khi khách Check-out."
            />
          </div>
        } @else {
          <div class="space-y-3">
            @for (task of tasks(); track task.id) {
              <div
                class="bg-white rounded-2xl border p-4 shadow-2xs transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                [ngClass]="task.hasUpcomingCheckIn || task.effectivePriority === HousekeepingPriority.Urgent ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/90'"
              >
                <div class="space-y-2 flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-bold text-slate-900">Phòng {{ task.roomNumber }}</span>
                    <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                      Tầng {{ task.floor }}
                    </span>
                    <span class="text-xs text-slate-500">{{ task.roomTypeName }}</span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border" [ngClass]="getTaskStatusBadgeClass(task.status)">
                      {{ getTaskStatusLabel(task.status) }}
                    </span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border" [ngClass]="getPriorityBadgeClass(task.effectivePriority)">
                      {{ getPriorityLabel(task.effectivePriority) }}
                    </span>
                    @if (task.hasUpcomingCheckIn) {
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
                        <i class="pi pi-bolt text-[10px]"></i>
                        <span>Khách sắp nhận phòng{{ task.nextCheckInAtUtc ? ' (' + formatNextCheckIn(task.nextCheckInAtUtc) + ')' : '' }}</span>
                      </span>
                    }
                  </div>

                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Trạng thái phòng: <strong class="text-slate-800">{{ getStatusLabel(task.roomStatus) }}</strong>
                    </span>
                    <span>
                      Phụ trách: <strong class="text-slate-800">{{ task.assignedToName || 'Chưa phân công' }}</strong>
                    </span>
                    @if (task.notes) {
                      <span class="text-slate-500 italic">{{ task.notes }}</span>
                    }
                  </div>
                </div>

                <!-- Task Controls (>= 44x44px touch targets) -->
                @if (canUpdate() && task.status !== HousekeepingTaskStatus.Completed) {
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    @if (housekeepingStaff().length > 0) {
                      <select
                        [ngModel]="task.assignedToUserId || ''"
                        (ngModelChange)="assignTask(task, $event)"
                        [disabled]="updatingTaskId() === task.id"
                        [attr.aria-label]="'Phân công nhân viên cho phòng ' + task.roomNumber"
                        class="min-h-[44px] min-w-[44px] px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Phân công nhân viên --</option>
                        @for (staff of housekeepingStaff(); track staff.userId) {
                          <option [value]="staff.userId">{{ staff.fullName }}</option>
                        }
                      </select>
                    }

                    @if (task.status === HousekeepingTaskStatus.Pending) {
                      <button
                        type="button"
                        (click)="claimTask(task)"
                        [disabled]="updatingTaskId() === task.id"
                        [attr.aria-label]="'Tự nhận việc phòng ' + task.roomNumber"
                        class="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <i class="pi pi-hand-point-up text-xs"></i>
                        <span>Tự nhận việc</span>
                      </button>
                    }

                    @if (task.status === HousekeepingTaskStatus.Pending || task.status === HousekeepingTaskStatus.Claimed) {
                      <button
                        type="button"
                        (click)="startTask(task)"
                        [disabled]="updatingTaskId() === task.id"
                        [attr.aria-label]="'Bắt đầu dọn phòng ' + task.roomNumber"
                        class="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <i class="pi pi-play text-xs"></i>
                        <span>Bắt đầu dọn</span>
                      </button>
                    }

                    <button
                      type="button"
                      (click)="completeTask(task)"
                      [disabled]="updatingTaskId() === task.id"
                      [attr.aria-label]="'Hoàn tất sạch phòng ' + task.roomNumber"
                      class="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <i class="pi pi-check-circle text-xs"></i>
                      <span>Hoàn tất sạch</span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      }

      <!-- TAB 2: ROOM BOARD -->
      @if (activeViewTab() === 'board') {
      <!-- KPI Summary Cards (Trên trang đang hiển thị) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- All Rooms on Page -->
        <div
          (click)="setStatusFilter('ALL')"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-2xs"
          [class.ring-2]="activeStatusFilter() === 'ALL'"
          [class.ring-slate-400]="activeStatusFilter() === 'ALL'"
          [class.border-slate-300]="activeStatusFilter() === 'ALL'"
        >
          <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng phòng</div>
          <div class="text-xl font-bold text-slate-800 mt-1">{{ pageRoomsCount() }}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Trên trang đang hiển thị</div>
        </div>

        <!-- Dirty (Cần dọn) -->
        <div
          (click)="setStatusFilter(RoomStatus.Dirty)"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-rose-50/40 hover:bg-rose-50/80 hover:shadow-2xs border-rose-200/80"
          [class.ring-2]="activeStatusFilter() === RoomStatus.Dirty"
          [class.ring-rose-500]="activeStatusFilter() === RoomStatus.Dirty"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cần dọn</span>
            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div class="text-xl font-bold text-rose-800 mt-1">{{ dirtyCount() }}</div>
          <div class="text-[10px] text-rose-600 mt-0.5">Trên trang đang hiển thị</div>
        </div>

        <!-- Cleaning (Đang dọn) -->
        <div
          (click)="setStatusFilter(RoomStatus.Cleaning)"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-amber-50/40 hover:bg-amber-50/80 hover:shadow-2xs border-amber-200/80"
          [class.ring-2]="activeStatusFilter() === RoomStatus.Cleaning"
          [class.ring-amber-500]="activeStatusFilter() === RoomStatus.Cleaning"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Đang dọn</span>
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <div class="text-xl font-bold text-amber-800 mt-1">{{ cleaningCount() }}</div>
          <div class="text-[10px] text-amber-600 mt-0.5">Trên trang đang hiển thị</div>
        </div>

        <!-- Clean (Sạch sẵn sàng) -->
        <div
          (click)="setStatusFilter(RoomStatus.Clean)"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-emerald-50/40 hover:bg-emerald-50/80 hover:shadow-2xs border-emerald-200/80"
          [class.ring-2]="activeStatusFilter() === RoomStatus.Clean"
          [class.ring-emerald-500]="activeStatusFilter() === RoomStatus.Clean"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Sạch sẽ</span>
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div class="text-xl font-bold text-emerald-800 mt-1">{{ cleanCount() }}</div>
          <div class="text-[10px] text-emerald-600 mt-0.5">Trên trang đang hiển thị</div>
        </div>

        <!-- Occupied (Có khách) -->
        <div
          (click)="setStatusFilter(RoomStatus.Occupied)"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-sky-50/40 hover:bg-sky-50/80 hover:shadow-2xs border-sky-200/80"
          [class.ring-2]="activeStatusFilter() === RoomStatus.Occupied"
          [class.ring-sky-500]="activeStatusFilter() === RoomStatus.Occupied"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">Có khách</span>
            <span class="w-2 h-2 rounded-full bg-sky-500"></span>
          </div>
          <div class="text-xl font-bold text-sky-800 mt-1">{{ occupiedCount() }}</div>
          <div class="text-[10px] text-sky-600 mt-0.5">Trên trang đang hiển thị</div>
        </div>

        <!-- OutOfService (Bảo trì) -->
        <div
          (click)="setStatusFilter(RoomStatus.OutOfService)"
          class="p-3.5 rounded-xl border transition-all cursor-pointer bg-slate-100/60 hover:bg-slate-100 hover:shadow-2xs border-slate-300/80"
          [class.ring-2]="activeStatusFilter() === RoomStatus.OutOfService"
          [class.ring-slate-500]="activeStatusFilter() === RoomStatus.OutOfService"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Bảo trì</span>
            <span class="w-2 h-2 rounded-full bg-slate-500"></span>
          </div>
          <div class="text-xl font-bold text-slate-800 mt-1">{{ outOfServiceCount() }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Trên trang đang hiển thị</div>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto flex-1 max-w-lg">
          <div class="relative w-full">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [ngModel]="searchRoomNumber()"
              (ngModelChange)="onSearchInput($event)"
              (keyup.enter)="onSearchSubmit()"
              placeholder="Tìm theo số phòng..."
              aria-label="Tìm kiếm số phòng trong buồng phòng"
              class="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          <!-- Floor Filter -->
          <div class="shrink-0">
            <select
              [ngModel]="selectedFloor()"
              (ngModelChange)="onFloorChange($event)"
              aria-label="Lọc theo tầng lầu"
              class="text-xs rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            >
              <option [ngValue]="null">Tất cả tầng</option>
              @for (fl of knownFloors(); track fl) {
                <option [ngValue]="fl">Tầng {{ fl }}</option>
              }
            </select>
          </div>

          @if (hasActiveFilters()) {
            <button
              type="button"
              (click)="resetFilters()"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 font-medium transition-colors shrink-0"
              title="Xóa bộ lọc"
            >
              <i class="pi pi-filter-slash text-xs"></i>
              <span class="hidden sm:inline">Xóa lọc</span>
            </button>
          }
        </div>

        <div class="text-xs text-slate-500 font-medium self-end sm:self-auto">
          Đang hiển thị: <strong class="text-slate-800">{{ rooms().length }}</strong> phòng / Tổng: <strong class="text-slate-800">{{ totalCount() }}</strong> phòng
        </div>
      </div>

      <!-- Main Room Grid by Floor -->
      @if (loading()) {
        <app-skeleton-table [rows]="6" />
      } @else if (loadError()) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-8 text-center shadow-xs">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
            <i class="pi pi-exclamation-triangle text-xl"></i>
          </div>
          <h3 class="text-sm font-bold text-slate-800">Không thể tải danh sách buồng phòng</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{{ loadError() }}</p>
          <div class="mt-4">
            <button
              type="button"
              (click)="loadRooms()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition-colors"
            >
              <i class="pi pi-refresh"></i>
              <span>Thử lại</span>
            </button>
          </div>
        </div>
      } @else if (!authService.activePropertyId()) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-10 shadow-2xs">
          <app-empty-state
            iconClass="pi pi-building"
            title="Vui lòng chọn chi nhánh làm việc"
            description="Sơ đồ buồng phòng hiển thị theo từng cơ sở. Vui lòng chọn một chi nhánh để theo dõi và cập nhật trạng thái phòng."
            actionLabel="Chọn chi nhánh làm việc"
            actionIcon="pi pi-building"
            (actionClick)="openContextSelector()"
          />
        </div>
      } @else if (rooms().length === 0) {
        <app-empty-state
          iconClass="pi pi-sparkles"
          title="Không có phòng nào phù hợp"
          description="Không tìm thấy phòng nào theo bộ lọc hoặc tiêu chí tìm kiếm hiện tại."
          actionLabel="Xóa bộ lọc"
          actionIcon="pi pi-filter-slash"
          (actionClick)="resetFilters()"
        />
      } @else {
        <!-- Render Grouped Floors -->
        <div class="space-y-6">
          @for (floorGroup of groupedRoomsByFloor(); track floorGroup.floor) {
            <div class="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
              <!-- Floor Title Bar -->
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                  <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200/70">
                    {{ floorGroup.floor }}
                  </span>
                  <h2 class="text-sm font-bold text-slate-800">Tầng {{ floorGroup.floor }}</h2>
                  <span class="text-xs text-slate-400 font-normal">({{ floorGroup.rooms.length }} phòng trên trang)</span>
                </div>
              </div>

              <!-- Room Cards Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                @for (room of floorGroup.rooms; track room.id) {
                  <div
                    class="relative rounded-xl border p-3.5 flex flex-col justify-between transition-all duration-200"
                    [ngClass]="getCardContainerClass(room.status)"
                  >
                    <!-- Card Top: Room Number & Type -->
                    <div>
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="text-base font-mono font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                            <span>Phòng {{ room.roomNumber }}</span>
                          </div>
                          <div class="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                            {{ room.roomTypeName }}
                          </div>
                        </div>

                        <!-- Current Status Badge -->
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0"
                          [ngClass]="getStatusBadgeClass(room.status)"
                        >
                          <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getStatusDotClass(room.status)"></span>
                          {{ getStatusLabel(room.status) }}
                        </span>
                      </div>

                      <div class="text-[10px] font-mono text-emerald-700 mt-1">
                        {{ formatCurrency(room.basePrice) }} / đêm
                      </div>
                    </div>

                    <!-- Card Bottom: State Machine Transition Action Buttons -->
                    <div class="pt-3 mt-3 border-t border-slate-100">
                      @if (updatingRoomId() === room.id) {
                        <div class="py-1.5 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                          <i class="pi pi-spin pi-spinner text-emerald-600"></i>
                          <span>Đang cập nhật...</span>
                        </div>
                      } @else if (!canUpdate()) {
                        <div class="text-[11px] text-slate-400 italic text-center py-1">
                          Chỉ xem (Không có quyền cập nhật)
                        </div>
                      } @else {
                        <!-- Buttons based on current state -->
                        <div class="space-y-1.5">
                          @if (room.status === RoomStatus.Dirty) {
                            <div class="flex items-center gap-1.5">
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.Cleaning)"
                                class="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] transition-colors shadow-2xs text-center"
                                title="Bắt đầu dọn dẹp"
                              >
                                <i class="pi pi-play text-[10px] mr-1"></i> Bắt đầu dọn
                              </button>
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.OutOfService)"
                                class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                                title="Chuyển sang bảo trì"
                              >
                                <i class="pi pi-wrench text-[10px]"></i>
                              </button>
                            </div>
                          } @else if (room.status === RoomStatus.Cleaning) {
                            <div class="flex items-center gap-1.5">
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.Clean)"
                                class="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors shadow-2xs text-center"
                                title="Dọn xong, phòng sạch sẽ"
                              >
                                <i class="pi pi-check text-[10px] mr-1"></i> Dọn xong (Sạch)
                              </button>
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.Dirty)"
                                class="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[11px] transition-colors"
                                title="Dọn chưa đạt, yêu cầu dọn lại"
                              >
                                <i class="pi pi-times text-[10px]" title="Chưa đạt"></i>
                              </button>
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.OutOfService)"
                                class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                                title="Chuyển sang bảo trì"
                              >
                                <i class="pi pi-wrench text-[10px]"></i>
                              </button>
                            </div>
                          } @else if (room.status === RoomStatus.Clean) {
                            <div class="flex items-center gap-1.5">
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.Dirty)"
                                class="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors text-center border border-rose-200/80"
                                title="Đánh dấu phòng bẩn cần dọn"
                              >
                                <i class="pi pi-exclamation-circle text-[10px] mr-1"></i> Báo bẩn
                              </button>
                              <button
                                type="button"
                                (click)="changeRoomStatus(room, RoomStatus.OutOfService)"
                                class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                                title="Báo bảo trì"
                              >
                                <i class="pi pi-wrench text-[10px]"></i>
                              </button>
                            </div>
                          } @else if (room.status === RoomStatus.OutOfService) {
                            <button
                              type="button"
                              (click)="changeRoomStatus(room, RoomStatus.Dirty)"
                              class="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-[11px] transition-colors shadow-2xs text-center"
                              title="Hoàn tất bảo trì -> Chuyển sang Cần dọn trước khi đón khách"
                            >
                              <i class="pi pi-check-circle text-[10px] mr-1"></i> Bảo trì xong (Cần dọn)
                            </button>
                          } @else if (room.status === RoomStatus.Occupied) {
                            <div class="text-[11px] text-sky-800 bg-sky-50 rounded-lg py-1 px-2 text-center font-medium border border-sky-200/70">
                              <i class="pi pi-user mr-1 text-[10px]"></i> Đang có khách lưu trú
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Server Pagination Component -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <app-pagination
            [page]="currentPage()"
            [pageSize]="currentPageSize()"
            [totalCount]="totalCount()"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      }
      }

      <!-- Create Housekeeping Task Modal -->
      @if (isCreateTaskModalOpen()) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Tạo nhiệm vụ dọn phòng mới"
          (click)="closeCreateTaskModal()"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white rounded-2xl border border-slate-200 w-[min(30rem,calc(100vw-2rem))] shadow-2xl overflow-hidden"
          >
            <div class="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900">Tạo nhiệm vụ dọn phòng</h3>
              <button
                type="button"
                (click)="closeCreateTaskModal()"
                aria-label="Đóng hộp thoại tạo nhiệm vụ"
                class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
            <div class="p-5 space-y-4 text-xs">
              <div class="space-y-1">
                <label class="block font-semibold text-slate-700">Chọn phòng *</label>
                <select
                  [ngModel]="newTaskRoomId()"
                  (ngModelChange)="newTaskRoomId.set($event)"
                  aria-label="Chọn phòng cần dọn"
                  class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800"
                >
                  <option value="">-- Chọn phòng --</option>
                  @for (rm of rooms(); track rm.id) {
                    <option [value]="rm.id">Phòng {{ rm.roomNumber }} (Tầng {{ rm.floor }} - {{ getStatusLabel(rm.status) }})</option>
                  }
                </select>
              </div>
              <div class="space-y-1">
                <label class="block font-semibold text-slate-700">Mức độ ưu tiên</label>
                <select
                  [ngModel]="newTaskPriority()"
                  (ngModelChange)="newTaskPriority.set($event)"
                  aria-label="Chọn mức độ ưu tiên"
                  class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800"
                >
                  <option [value]="HousekeepingPriority.Low">Thấp</option>
                  <option [value]="HousekeepingPriority.Normal">Bình thường</option>
                  <option [value]="HousekeepingPriority.High">Cao</option>
                  <option [value]="HousekeepingPriority.Urgent">Khẩn cấp</option>
                </select>
              </div>
              @if (housekeepingStaff().length > 0) {
                <div class="space-y-1">
                  <label class="block font-semibold text-slate-700">Phân công (tùy chọn)</label>
                  <select
                    [ngModel]="newTaskAssigneeId()"
                    (ngModelChange)="newTaskAssigneeId.set($event)"
                    aria-label="Chọn nhân viên phụ trách"
                    class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="">Để nhân viên tự nhận (Chờ nhận)</option>
                    @for (staff of housekeepingStaff(); track staff.userId) {
                      <option [value]="staff.userId">{{ staff.fullName }}</option>
                    }
                  </select>
                </div>
              }
              <div class="space-y-1">
                <label class="block font-semibold text-slate-700">Ghi chú</label>
                <textarea
                  rows="2"
                  [ngModel]="newTaskNotes()"
                  (ngModelChange)="newTaskNotes.set($event)"
                  placeholder="VD: Thay ga gối, bổ sung minibar..."
                  class="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                ></textarea>
              </div>
            </div>
            <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="closeCreateTaskModal()"
                class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                [disabled]="!newTaskRoomId() || isCreatingTask()"
                (click)="submitCreateTask()"
                class="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Tạo nhiệm vụ
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (showContextSelector()) {
      <app-context-selector-dialog
        [visible]="showContextSelector()"
        (visibleChange)="showContextSelector.set($event)"
      />
    }
  `
})
export class HousekeepingPage implements OnInit, OnDestroy {
  private readonly roomService = inject(RoomService);
  private readonly housekeepingService = inject(HousekeepingService, { optional: true });
  private readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);

  showContextSelector = signal<boolean>(false);
  openContextSelector(): void {
    this.showContextSelector.set(true);
  }

  readonly RoomStatus = RoomStatus;
  readonly HousekeepingTaskStatus = HousekeepingTaskStatus;
  readonly HousekeepingPriority = HousekeepingPriority;

  activeViewTab = signal<'queue' | 'board'>('queue');
  tasks = signal<HousekeepingTaskDto[]>([]);
  tasksLoading = signal<boolean>(false);
  updatingTaskId = signal<string | null>(null);
  housekeepingStaff = signal<HousekeepingStaffOptionDto[]>([]);
  taskStatusFilter = signal<string>('ALL');
  taskPriorityFilter = signal<string>('ALL');
  taskAssignedToMe = signal<boolean>(false);
  isCreateTaskModalOpen = signal<boolean>(false);
  isCreatingTask = signal<boolean>(false);
  newTaskRoomId = signal<string>('');
  newTaskPriority = signal<HousekeepingPriority>(HousekeepingPriority.Normal);
  newTaskAssigneeId = signal<string>('');
  newTaskNotes = signal<string>('');

  urgentTasksCount = computed(() =>
    this.tasks().filter(t => t.effectivePriority === HousekeepingPriority.Urgent && t.status !== HousekeepingTaskStatus.Completed).length
  );
  activeTasksCount = computed(() =>
    this.tasks().filter(t => t.status !== HousekeepingTaskStatus.Completed).length
  );
  completedTasksCount = computed(() =>
    this.tasks().filter(t => t.status === HousekeepingTaskStatus.Completed).length
  );

  rooms = signal<RoomDto[]>([]);
  loading = signal<boolean>(false);
  loadError = signal<string | null>(null);
  updatingRoomId = signal<string | null>(null);

  // Pagination
  currentPage = signal<number>(1);
  currentPageSize = signal<number>(20);
  totalCount = signal<number>(0);

  // Filters
  activeStatusFilter = signal<string>('ALL');
  selectedFloor = signal<number | null>(null);
  searchRoomNumber = signal<string>('');
  knownFloors = signal<number[]>([1, 2, 3, 4, 5]);

  private readonly searchSubject$ = new Subject<string>();
  private searchSub?: Subscription;
  private readonly reloadTrigger$ = new Subject<void>();
  private listSub?: Subscription;
  private tasksSub?: Subscription;
  private staffSub?: Subscription;
  private taskActionSub?: Subscription;

  // Permission
  canUpdate = computed(() => {
    return this.authService.hasPermission('HOUSEKEEPING', 4) ||
           this.authService.hasPermission('HOUSEKEEPING', 2) ||
           this.authService.hasPermission('ROOMS', 4);
  });

  canCreateTask = computed(() => {
    return this.authService.hasPermission('HOUSEKEEPING', 2) || this.canUpdate();
  });

  // KPI Counters (trên trang đang hiển thị)
  pageRoomsCount = computed(() => this.rooms().length);
  cleanCount = computed(() => this.rooms().filter(r => r.status === RoomStatus.Clean).length);
  dirtyCount = computed(() => this.rooms().filter(r => r.status === RoomStatus.Dirty).length);
  cleaningCount = computed(() => this.rooms().filter(r => r.status === RoomStatus.Cleaning).length);
  occupiedCount = computed(() => this.rooms().filter(r => r.status === RoomStatus.Occupied).length);
  outOfServiceCount = computed(() => this.rooms().filter(r => r.status === RoomStatus.OutOfService).length);

  hasActiveFilters = computed(() => {
    return this.activeStatusFilter() !== 'ALL' ||
           this.selectedFloor() !== null ||
           this.searchRoomNumber().trim().length > 0;
  });

  // Group rooms on current page by floor
  groupedRoomsByFloor = computed(() => {
    const map = new Map<number, RoomDto[]>();
    for (const room of this.rooms()) {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    }

    const sortedFloors = Array.from(map.keys()).sort((a, b) => a - b);
    return sortedFloors.map(floor => ({
      floor,
      rooms: map.get(floor)!.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
    }));
  });

  // Multi-device Auto-Sync & Network Resilience
  syncStatus = signal<RoomSyncStatus>('connected');
  lastSyncTime = signal<Date | null>(null);
  autoSyncEnabled = signal<boolean>(true);
  private autoSyncTimer?: any;
  private syncInFlight = false;
  private trackedPropertyId: string | null = null;
  private pollSub?: Subscription;
  private pollGeneration = 0;
  private lastMutationTimestamp = 0;
  private isDestroyed = false;

  private readonly handleOnline = () => {
    this.syncStatus.set('connected');
    this.loadRooms();
  };

  private readonly handleOffline = () => {
    this.syncStatus.set('offline');
  };

  private invalidatePolling(): void {
    if (this.pollSub && !this.pollSub.closed) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
    this.pollGeneration++;
    this.syncInFlight = false;
  }

  constructor() {
    try {
      effect(() => {
        const propId = this.authService.activePropertyId();
        if (this.trackedPropertyId !== propId) {
          this.trackedPropertyId = propId;
          this.invalidatePolling();
          if (propId && this.autoSyncEnabled()) {
            this.startAutoSync();
          } else if (!propId) {
            this.stopAutoSync();
          }
          this.currentPage.set(1);
          this.rooms.set([]);
          this.totalCount.set(0);
          this.loadRooms();
          this.loadTasks();
          this.loadAssignableStaff();
        }
      });

      effect(() => {
        const change = this.roomService.roomStatusChanged();
        if (change) {
          // Immediately update matching room in local rooms signal if present without full reload
          this.rooms.update(list =>
            list.map(r => r.id === change.roomId ? { ...r, status: change.status } : r)
          );
        }
      });
    } catch {
      // Ignored in headless tests
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    this.searchSub = this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage.set(1);
      this.loadRooms();
    });

    this.setupRoomListStream();
    this.loadRooms();
    this.loadTasks();
    this.loadAssignableStaff();
    this.startAutoSync();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.invalidatePolling();
    this.stopAutoSync();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.searchSub?.unsubscribe();
    this.listSub?.unsubscribe();
    this.tasksSub?.unsubscribe();
    this.staffSub?.unsubscribe();
    this.taskActionSub?.unsubscribe();
  }

  setViewTab(tab: 'queue' | 'board'): void {
    this.activeViewTab.set(tab);
    if (tab === 'queue') {
      this.loadTasks();
    } else {
      this.loadRooms();
    }
  }

  refreshActiveView(): void {
    this.loadRooms();
    this.loadTasks();
  }

  loadTasks(): void {
    if (!this.housekeepingService) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    const statusFilter = this.taskStatusFilter();
    const priorityFilter = this.taskPriorityFilter();

    this.tasksSub?.unsubscribe();
    this.tasksLoading.set(true);
    this.tasksSub = this.housekeepingService.getTasks(propId, {
      status: statusFilter !== 'ALL' ? (statusFilter as HousekeepingTaskStatus) : null,
      priority: priorityFilter !== 'ALL' ? (priorityFilter as HousekeepingPriority) : null,
      assignedToMe: this.taskAssignedToMe() || null
    }).subscribe({
      next: (list) => {
        if (this.authService.activePropertyId() !== propId) return;
        this.tasks.set(list || []);
        this.tasksLoading.set(false);
      },
      error: () => {
        this.tasksLoading.set(false);
      }
    });
  }

  loadAssignableStaff(): void {
    if (!this.housekeepingService) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.staffSub?.unsubscribe();
    this.staffSub = this.housekeepingService.getAssignableStaff(propId).subscribe({
      next: (list) => {
        if (this.authService.activePropertyId() === propId) {
          this.housekeepingStaff.set(list || []);
        }
      },
      error: () => {
        this.housekeepingStaff.set([]);
      }
    });
  }

  onTaskStatusFilterChange(value: string): void {
    this.taskStatusFilter.set(value);
    this.loadTasks();
  }

  onTaskPriorityFilterChange(value: string): void {
    this.taskPriorityFilter.set(value);
    this.loadTasks();
  }

  onAssignedToMeChange(value: boolean): void {
    this.taskAssignedToMe.set(Boolean(value));
    this.loadTasks();
  }

  openCreateTaskModal(): void {
    this.newTaskRoomId.set(this.rooms()[0]?.id || '');
    this.newTaskPriority.set(HousekeepingPriority.Normal);
    this.newTaskAssigneeId.set('');
    this.newTaskNotes.set('');
    this.isCreateTaskModalOpen.set(true);
  }

  closeCreateTaskModal(): void {
    this.isCreateTaskModalOpen.set(false);
  }

  submitCreateTask(): void {
    if (!this.housekeepingService || this.isCreatingTask()) return;
    const propId = this.authService.activePropertyId();
    const roomId = this.newTaskRoomId();
    if (!propId || !roomId) return;

    this.isCreatingTask.set(true);
    this.taskActionSub?.unsubscribe();
    this.taskActionSub = this.housekeepingService.createTask({
      propertyId: propId,
      roomId,
      priority: this.newTaskPriority(),
      notes: this.newTaskNotes().trim() || null,
      assignedToUserId: this.newTaskAssigneeId() || null
    }).subscribe({
      next: (created) => {
        this.isCreatingTask.set(false);
        this.isCreateTaskModalOpen.set(false);
        this.tasks.update(list => [created, ...list]);
        this.alertService.toastSuccess(`Đã tạo nhiệm vụ dọn phòng ${created.roomNumber}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.isCreatingTask.set(false);
        this.alertService.toastError(err?.error?.message || 'Không thể tạo nhiệm vụ dọn phòng.');
      }
    });
  }

  assignTask(task: HousekeepingTaskDto, assignedToUserId: string): void {
    if (!this.housekeepingService || !assignedToUserId || this.updatingTaskId()) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.updatingTaskId.set(task.id);
    this.taskActionSub?.unsubscribe();
    this.taskActionSub = this.housekeepingService.assignTask(task.id, propId, assignedToUserId).subscribe({
      next: (updated) => {
        this.updatingTaskId.set(null);
        this.tasks.update(list => list.map(t => t.id === task.id ? updated : t));
        this.alertService.toastSuccess(`Đã phân công phòng ${updated.roomNumber} cho ${updated.assignedToName || 'nhân viên'}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingTaskId.set(null);
        this.alertService.toastError(err?.error?.message || 'Không thể phân công nhiệm vụ.');
      }
    });
  }

  claimTask(task: HousekeepingTaskDto): void {
    if (!this.housekeepingService || this.updatingTaskId()) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.updatingTaskId.set(task.id);
    this.taskActionSub?.unsubscribe();
    this.taskActionSub = this.housekeepingService.claimTask(task.id, propId).subscribe({
      next: (updated) => {
        this.updatingTaskId.set(null);
        this.tasks.update(list => list.map(t => t.id === task.id ? updated : t));
        this.alertService.toastSuccess(`Bạn đã tự nhận việc dọn phòng ${updated.roomNumber}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingTaskId.set(null);
        this.alertService.toastError(err?.error?.message || 'Công việc đã có nhân viên khác nhận.');
        if (err.status === 409) {
          this.loadTasks();
        }
      }
    });
  }

  startTask(task: HousekeepingTaskDto): void {
    if (!this.housekeepingService || this.updatingTaskId()) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.updatingTaskId.set(task.id);
    this.taskActionSub?.unsubscribe();
    this.taskActionSub = this.housekeepingService.startTask(task.id, propId).subscribe({
      next: (updated) => {
        this.updatingTaskId.set(null);
        this.tasks.update(list => list.map(t => t.id === task.id ? updated : t));
        this.rooms.update(list => list.map(r => r.id === updated.roomId ? { ...r, status: updated.roomStatus } : r));
        this.alertService.toastSuccess(`Bắt đầu dọn phòng ${updated.roomNumber}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingTaskId.set(null);
        this.alertService.toastError(err?.error?.message || 'Không thể bắt đầu dọn phòng.');
      }
    });
  }

  completeTask(task: HousekeepingTaskDto): void {
    if (!this.housekeepingService || this.updatingTaskId()) return;
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.updatingTaskId.set(task.id);
    this.taskActionSub?.unsubscribe();
    this.taskActionSub = this.housekeepingService.completeTask(task.id, propId).subscribe({
      next: (updated) => {
        this.updatingTaskId.set(null);
        this.tasks.update(list => list.map(t => t.id === task.id ? updated : t));
        this.rooms.update(list => list.map(r => r.id === updated.roomId ? { ...r, status: updated.roomStatus } : r));
        this.alertService.toastSuccess(`Phòng ${updated.roomNumber} đã hoàn tất sạch sẽ!`);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingTaskId.set(null);
        this.alertService.toastError(err?.error?.message || 'Không thể hoàn tất công việc.');
      }
    });
  }

  getTaskStatusLabel(status: HousekeepingTaskStatus): string {
    return HOUSEKEEPING_TASK_STATUS_LABELS[status] || status;
  }

  getPriorityLabel(priority: HousekeepingPriority): string {
    return HOUSEKEEPING_PRIORITY_LABELS[priority] || priority;
  }

  getTaskStatusBadgeClass(status: HousekeepingTaskStatus): string {
    switch (status) {
      case HousekeepingTaskStatus.Pending:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case HousekeepingTaskStatus.Claimed:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case HousekeepingTaskStatus.InProgress:
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case HousekeepingTaskStatus.Completed:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getPriorityBadgeClass(priority: HousekeepingPriority): string {
    switch (priority) {
      case HousekeepingPriority.Urgent:
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case HousekeepingPriority.High:
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case HousekeepingPriority.Normal:
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case HousekeepingPriority.Low:
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  formatNextCheckIn(utcIso?: string | null): string {
    if (!utcIso) return '';
    const d = new Date(utcIso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  startAutoSync(intervalMs = 10000): void {
    this.stopAutoSync();
    if (!this.authService.activePropertyId()) {
      return;
    }
    if (typeof window !== 'undefined') {
      this.autoSyncTimer = setInterval(() => {
        this.pollServerSync();
      }, intervalMs);
    }
  }

  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
    }
  }

  toggleAutoSync(): void {
    const nextState = !this.autoSyncEnabled();
    this.autoSyncEnabled.set(nextState);
    if (nextState) {
      this.startAutoSync();
      this.pollServerSync();
    } else {
      this.stopAutoSync();
    }
  }

  pollServerSync(): void {
    if (this.isDestroyed || !this.autoSyncEnabled()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.syncStatus.set('offline');
      return;
    }
    if (this.loading() || this.updatingRoomId()) {
      return;
    }

    const targetPropId = this.authService.activePropertyId();
    if (!targetPropId) return;

    const targetPage = this.currentPage();
    const targetPageSize = this.currentPageSize();
    const targetStatus = this.activeStatusFilter();
    const targetFloor = this.selectedFloor();
    const targetSearch = this.searchRoomNumber().trim();
    const requestMutationTime = this.lastMutationTimestamp;

    const filter: GetRoomsFilter = {
      page: targetPage,
      pageSize: targetPageSize
    };
    if (targetStatus !== 'ALL') {
      filter.status = targetStatus as RoomStatus;
    }
    if (targetFloor !== null && targetFloor !== undefined) {
      filter.floor = targetFloor;
    }
    if (targetSearch) {
      filter.search = targetSearch;
    }

    this.invalidatePolling();
    const gen = this.pollGeneration;
    this.syncInFlight = true;

    const isContextValid = (): boolean => {
      return (
        !this.isDestroyed &&
        gen === this.pollGeneration &&
        this.authService.activePropertyId() === targetPropId &&
        this.currentPage() === targetPage &&
        this.currentPageSize() === targetPageSize &&
        this.activeStatusFilter() === targetStatus &&
        this.selectedFloor() === targetFloor &&
        this.searchRoomNumber().trim() === targetSearch &&
        this.lastMutationTimestamp === requestMutationTime
      );
    };

    this.pollSub = this.roomService.getRooms(filter).pipe(
      catchError((err: HttpErrorResponse) => {
        if (!isContextValid()) {
          return of(null);
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.syncStatus.set('offline');
        } else {
          this.syncStatus.set('reconnecting');
        }
        return of(null);
      })
    ).subscribe({
      next: (res) => {
        if (gen === this.pollGeneration) {
          this.syncInFlight = false;
        }
        if (!isContextValid() || !res) {
          return;
        }

        this.syncStatus.set('connected');
        this.lastSyncTime.set(new Date());

        // Detect server-side updates (e.g. checkout transitioning a room to Dirty on another device)
        const currentList = this.rooms();
        for (const newRoom of res.items || []) {
          const oldRoom = currentList.find(r => r.id === newRoom.id);
          if (oldRoom && oldRoom.status !== newRoom.status) {
            if (newRoom.status === RoomStatus.Dirty && oldRoom.status === RoomStatus.Occupied) {
              this.alertService.toastWarning(`Phòng ${newRoom.roomNumber} vừa được trả phòng và chuyển sang Cần dọn (Dirty).`);
            }
          }
        }

        this.rooms.set(res.items || []);
        this.totalCount.set(res.totalCount ?? (res.items || []).length);
      },
      error: () => {
        if (gen === this.pollGeneration) {
          this.syncInFlight = false;
        }
      }
    });
  }

  formatLastSyncTime(): string {
    const t = this.lastSyncTime();
    if (!t) return '';
    const h = String(t.getHours()).padStart(2, '0');
    const m = String(t.getMinutes()).padStart(2, '0');
    const s = String(t.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private setupRoomListStream(): void {
    this.listSub = this.reloadTrigger$.pipe(
      tap(() => {
        this.loading.set(true);
        this.loadError.set(null);
      }),
      switchMap(() => {
        const filter: GetRoomsFilter = {
          page: this.currentPage(),
          pageSize: this.currentPageSize()
        };

        if (this.activeStatusFilter() !== 'ALL') {
          filter.status = this.activeStatusFilter() as RoomStatus;
        }
        if (this.selectedFloor() !== null && this.selectedFloor() !== undefined) {
          filter.floor = this.selectedFloor()!;
        }
        const search = this.searchRoomNumber().trim();
        if (search) {
          filter.search = search;
        }

        return this.roomService.getRooms(filter).pipe(
          catchError((err: HttpErrorResponse) => {
            this.loading.set(false);
            this.loadError.set('Lỗi kết nối máy chủ hoặc chưa chọn chi nhánh.');
            this.alertService.toastError('Không thể tải danh sách buồng phòng.');
            // Trả về of(null) bên trong switchMap để stream reloadTrigger$ không bị terminate
            return of(null);
          })
        );
      })
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res) {
          this.rooms.set(res.items || []);
          this.totalCount.set(res.totalCount ?? (res.items || []).length);

          const floors = new Set<number>(this.knownFloors());
          for (const r of res.items || []) {
            floors.add(r.floor);
          }
          this.knownFloors.set(Array.from(floors).sort((a, b) => a - b));
        }
      }
    });
  }

  loadRooms(): void {
    this.invalidatePolling();
    this.reloadTrigger$.next();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadRooms();
  }

  onPageSizeChange(size: number): void {
    this.currentPageSize.set(size);
    this.currentPage.set(1);
    this.loadRooms();
  }

  setStatusFilter(status: string): void {
    if (this.activeStatusFilter() === status) return;
    this.activeStatusFilter.set(status);
    this.currentPage.set(1);
    this.loadRooms();
  }

  onFloorChange(floor: number | null): void {
    this.selectedFloor.set(floor);
    this.currentPage.set(1);
    this.loadRooms();
  }

  onSearchInput(val: string): void {
    this.searchRoomNumber.set(val);
    this.searchSubject$.next(val);
  }

  onSearchSubmit(): void {
    this.currentPage.set(1);
    this.loadRooms();
  }

  resetFilters(): void {
    this.activeStatusFilter.set('ALL');
    this.selectedFloor.set(null);
    this.searchRoomNumber.set('');
    this.currentPage.set(1);
    this.loadRooms();
  }

  /**
   * Cập nhật trạng thái buồng phòng với Optimistic UI & Concurrency Lock (expectedOldStatus)
   * Sử dụng endpoint: PATCH /api/rooms/{id}/status
   */
  changeRoomStatus(room: RoomDto, targetStatus: RoomStatus): void {
    if (!this.canUpdate() || this.updatingRoomId()) return;

    const currentOldStatus = room.status as RoomStatus;
    if (targetStatus === currentOldStatus) return;

    this.updatingRoomId.set(room.id);
    this.invalidatePolling();

    this.roomService.updateRoomStatus(room.id, targetStatus, currentOldStatus).subscribe({
      next: (updated) => {
        this.updatingRoomId.set(null);
        this.lastMutationTimestamp = Date.now();
        this.invalidatePolling();
        // Cập nhật trạng thái trực tiếp trong danh sách signal
        this.rooms.update(list => list.map(r => r.id === room.id ? { ...r, status: targetStatus } : r));
        this.alertService.toastSuccess(
          `Phòng ${room.roomNumber}: Chuyển sang "${ROOM_STATUS_LABELS[targetStatus] || targetStatus}"`
        );
      },
      error: (err: HttpErrorResponse) => {
        this.updatingRoomId.set(null);
        if (err.status === 409) {
          // Xử lý xung đột stale state khi người dùng khác đã đổi trạng thái trước
          this.alertService.toastWarning(
            'Trạng thái phòng đã thay đổi trước đó bởi người dùng khác. Đang làm mới dữ liệu...'
          );
          this.loadRooms();
        } else if (err.status === 403) {
          this.alertService.toastError('Bạn không có quyền cập nhật trạng thái buồng phòng.');
        } else if (err.status === 400) {
          const msg = err.error?.message || err.error?.title || 'Chuyển đổi trạng thái không hợp lệ theo quy tắc nghiệp vụ.';
          this.alertService.toastError(msg);
        } else {
          this.alertService.toastError('Đã có lỗi xảy ra khi cập nhật trạng thái buồng phòng.');
        }
      }
    });
  }

  // Helpers
  getStatusLabel(status: string): string {
    return ROOM_STATUS_LABELS[status as RoomStatus] || status;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  getCardContainerClass(status: string): string {
    switch (status) {
      case RoomStatus.Clean:
        return 'border-emerald-200/90 bg-emerald-50/20 hover:border-emerald-300';
      case RoomStatus.Dirty:
        return 'border-rose-200/90 bg-rose-50/20 hover:border-rose-300';
      case RoomStatus.Cleaning:
        return 'border-amber-200/90 bg-amber-50/20 hover:border-amber-300';
      case RoomStatus.Occupied:
        return 'border-sky-200/90 bg-sky-50/20 hover:border-sky-300';
      case RoomStatus.OutOfService:
        return 'border-slate-200/90 bg-slate-50/40 hover:border-slate-300';
      default:
        return 'border-slate-200 bg-white';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case RoomStatus.Clean:
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case RoomStatus.Dirty:
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case RoomStatus.Cleaning:
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case RoomStatus.Occupied:
        return 'bg-sky-50 text-sky-800 border-sky-300';
      case RoomStatus.OutOfService:
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getStatusDotClass(status: string): string {
    switch (status) {
      case RoomStatus.Clean:
        return 'bg-emerald-500';
      case RoomStatus.Dirty:
        return 'bg-rose-500';
      case RoomStatus.Cleaning:
        return 'bg-amber-500 animate-pulse';
      case RoomStatus.Occupied:
        return 'bg-sky-500';
      case RoomStatus.OutOfService:
        return 'bg-slate-500';
      default:
        return 'bg-slate-400';
    }
  }
}
