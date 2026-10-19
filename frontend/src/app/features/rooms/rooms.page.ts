import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { PaymentService } from '../../core/services/payment.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { ReservationDto, CreateReservationRequest, RentalType } from '../../core/models/reservation.model';
import { RoomTypeDto } from '../../core/models/room-type.model';
import { FolioDto, AddFolioItemRequest } from '../../core/models/payment.model';
import {
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent
} from '../../shared';

export interface ExtendedRoomDto extends RoomDto {
  activeReservation?: ReservationDto;
  rentalTypeDisplay?: 'Hourly' | 'Overnight' | 'Daily';
}

export interface TimelineDateCol {
  dateStr: string;
  dayOfWeek: string;
  dateFormatted: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface QuickMinibarCatalogItem {
  code: string;
  name: string;
  price: number;
  category: string;
  icon: string;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <app-page-header
        title="Sơ đồ Phòng & Vận hành Lễ tân"
        subtitle="Quản lý sơ đồ Rack phòng theo từng tầng, theo dõi trạng thái buồng phòng, sơ đồ Timeline Gantt và tiếp nhận khách tại quầy."
      >
        <div class="flex items-center gap-2">
          <!-- View Mode Toggle Button -->
          <div class="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              (click)="viewMode.set('rack')"
              [ngClass]="viewMode() === 'rack' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-th-large text-xs"></i>
              <span>Sơ đồ Rack</span>
            </button>
            <button
              type="button"
              (click)="viewMode.set('timeline')"
              [ngClass]="viewMode() === 'timeline' ? 'bg-white shadow-2xs text-emerald-800 font-bold' : 'text-slate-600 hover:text-slate-900'"
              class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-calendar text-xs"></i>
              <span>Timeline (Gantt)</span>
            </button>
            <button
              type="button"
              (click)="viewMode.set('table')"
              [ngClass]="viewMode() === 'table' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-list text-xs"></i>
              <span>Danh sách</span>
            </button>
          </div>

          <!-- Quick Walk-in Button -->
          <button
            type="button"
            (click)="openQuickWalkinModal()"
            class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
          >
            <i class="pi pi-user-plus text-xs"></i>
            <span>Tiếp khách (Walk-in)</span>
          </button>
        </div>
      </app-page-header>

      <!-- Status Summary Legend & KPI Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- Clean -->
        <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Trống sạch</span>
            <span class="text-xl font-extrabold text-emerald-900">{{ cleanRoomsCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <i class="pi pi-check text-sm"></i>
          </div>
        </div>

        <!-- Occupied Hourly -->
        <div class="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-sky-800 uppercase tracking-wider">Thuê theo giờ</span>
            <span class="text-xl font-extrabold text-sky-900">{{ occupiedHourlyCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
            <i class="pi pi-clock text-sm"></i>
          </div>
        </div>

        <!-- Occupied Overnight / Daily -->
        <div class="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-blue-800 uppercase tracking-wider">Đêm / Theo ngày</span>
            <span class="text-xl font-extrabold text-blue-900">{{ occupiedDailyOvernightCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <i class="pi pi-moon text-sm"></i>
          </div>
        </div>

        <!-- Dirty -->
        <div class="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-rose-800 uppercase tracking-wider">Cần dọn dẹp</span>
            <span class="text-xl font-extrabold text-rose-900">{{ dirtyRoomsCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
            <i class="pi pi-exclamation-circle text-sm"></i>
          </div>
        </div>

        <!-- Cleaning -->
        <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-amber-800 uppercase tracking-wider">Đang dọn</span>
            <span class="text-xl font-extrabold text-amber-900">{{ cleaningRoomsCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <i class="pi pi-spin pi-spinner text-sm"></i>
          </div>
        </div>

        <!-- Out Of Service -->
        <div class="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Bảo trì / Khóa</span>
            <span class="text-xl font-extrabold text-slate-900">{{ outOfServiceCount() }}</span>
          </div>
          <div class="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
            <i class="pi pi-ban text-sm"></i>
          </div>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <!-- Search Room Number -->
          <div class="relative">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm theo số phòng (101, 202...)"
              class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <!-- Floor Filter -->
          <div>
            <select
              [ngModel]="selectedFloor()"
              (ngModelChange)="selectedFloor.set($event)"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">Tất cả các tầng</option>
              @for (floor of availableFloors(); track floor) {
                <option [value]="floor">Tầng {{ floor }}</option>
              }
            </select>
          </div>

          <!-- Room Type Filter -->
          <div>
            <select
              [ngModel]="selectedRoomTypeId()"
              (ngModelChange)="selectedRoomTypeId.set($event)"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">Tất cả loại phòng</option>
              @for (rt of roomTypes(); track rt.id) {
                <option [value]="rt.id">{{ rt.name }}</option>
              }
            </select>
          </div>

          <!-- Status Filter -->
          <div>
            <select
              [ngModel]="selectedStatus()"
              (ngModelChange)="selectedStatus.set($event)"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Clean">Trống sạch (Clean)</option>
              <option value="Occupied">Đang có khách (Occupied)</option>
              <option value="Dirty">Cần dọn dẹp (Dirty)</option>
              <option value="Cleaning">Đang dọn (Cleaning)</option>
              <option value="OutOfService">Ngừng phục vụ (Out of Service)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="py-16 flex flex-col items-center justify-center gap-3">
          <app-loading-spinner size="lg" message="Đang tải sơ đồ rack phòng thời gian thực..." />
        </div>
      } @else if (filteredRooms().length === 0) {
        <app-empty-state
          iconClass="pi pi-home"
          title="Không tìm thấy phòng nào"
          description="Không có phòng nào phù hợp với điều kiện tìm kiếm và bộ lọc hiện tại."
        />
      } @else if (viewMode() === 'rack') {
        <!-- FLOOR BY FLOOR ROOM RACK GRID -->
        <div class="space-y-6">
          @for (group of roomsByFloor(); track group.floor) {
            <div class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <!-- Floor Header Banner -->
              <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded-xl bg-slate-800 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    {{ group.floor }}
                  </span>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">Tầng {{ group.floor }}</h3>
                    <span class="text-[11px] text-slate-500">
                      {{ group.rooms.length }} phòng • {{ group.cleanCount }} trống sạch • {{ group.occupiedCount }} đang ở
                    </span>
                  </div>
                </div>

                <!-- Floor quick stats chips -->
                <div class="flex items-center gap-1.5 text-[11px]">
                  <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    {{ group.cleanCount }} Sạch
                  </span>
                  <span class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                    {{ group.occupiedCount }} Ở
                  </span>
                  @if (group.dirtyCount > 0) {
                    <span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                      {{ group.dirtyCount }} Dọn
                    </span>
                  }
                </div>
              </div>

              <!-- Rooms Grid on this floor -->
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                @for (room of group.rooms; track room.id) {
                  <div
                    (click)="onRoomCardClicked(room)"
                    [ngClass]="getRoomCardClasses(room)"
                    class="rounded-xl border p-3 flex flex-col justify-between transition-all duration-150 cursor-pointer hover:shadow-md relative group select-none min-h-[110px]"
                  >
                    <!-- Top: Room Number & Status Dot -->
                    <div class="flex items-start justify-between">
                      <span class="text-base font-extrabold text-slate-900 font-mono tracking-tight group-hover:text-emerald-700">
                        {{ room.roomNumber }}
                      </span>
                      <span
                        class="w-2.5 h-2.5 rounded-full"
                        [ngClass]="getRoomDotClass(room)"
                        [title]="getRoomStatusLabel(room)"
                      ></span>
                    </div>

                    <!-- Middle: Room Type & Pricing / Guest Info -->
                    <div class="my-1.5 space-y-0.5">
                      <span class="block text-[11px] font-semibold text-slate-700 truncate">
                        {{ room.roomTypeName }}
                      </span>
                      
                      @if (room.status === 'Occupied' && room.activeReservation) {
                        <div class="text-[10px] text-slate-600 truncate flex items-center gap-1">
                          <i class="pi pi-user text-[9px] text-slate-400"></i>
                          <span class="truncate font-medium">{{ room.activeReservation.guestName }}</span>
                        </div>
                      } @else {
                        <span class="block text-[10px] text-slate-500 font-mono">
                          {{ room.basePrice | number:'1.0-0' }}₫
                        </span>
                      }
                    </div>

                    <!-- Bottom: Mode Tag / Status Action Pill -->
                    <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span [ngClass]="getRoomStatusBadgeTextClass(room)" class="font-bold">
                        {{ getRoomRentalOrStatusLabel(room) }}
                      </span>

                      @if (room.status === 'Clean') {
                        <span class="text-[10px] font-bold text-emerald-600 group-hover:underline">Walk-in →</span>
                      } @else if (room.status === 'Occupied' && room.activeReservation) {
                        <button
                          type="button"
                          (click)="$event.stopPropagation(); openFolioModalForRoom(room)"
                          class="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                          title="Thêm Minibar & Dịch vụ"
                        >
                          <i class="pi pi-plus text-[8px]"></i>
                          <span>Minibar</span>
                        </button>
                      } @else if (room.status === 'Dirty') {
                        <span class="text-[10px] font-semibold text-rose-600">Dọn dẹp</span>
                      } @else if (room.status === 'Cleaning') {
                        <span class="text-[10px] font-semibold text-amber-600">Đang dọn</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else if (viewMode() === 'table') {
        <!-- TABLE VIEW -->
        <div class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th class="py-3 px-4">Số phòng</th>
                  <th class="py-3 px-4">Tầng</th>
                  <th class="py-3 px-4">Hạng phòng</th>
                  <th class="py-3 px-4">Giá cơ bản</th>
                  <th class="py-3 px-4">Trạng thái</th>
                  <th class="py-3 px-4">Hình thức / Khách ở</th>
                  <th class="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (room of filteredRooms(); track room.id) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                      {{ room.roomNumber }}
                    </td>
                    <td class="py-3 px-4 text-slate-700">Tầng {{ room.floor }}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800">{{ room.roomTypeName }}</td>
                    <td class="py-3 px-4 font-mono text-slate-700">{{ room.basePrice | number:'1.0-0' }}₫</td>
                    <td class="py-3 px-4">
                      <app-status-badge
                        [status]="room.status"
                        type="room"
                      />
                    </td>
                    <td class="py-3 px-4">
                      @if (room.status === 'Occupied' && room.activeReservation) {
                        <div class="space-y-0.5">
                          <span class="font-bold text-slate-800">{{ room.activeReservation.guestName }}</span>
                          <div class="text-[10px] text-slate-500">
                            {{ getRentalTypeBadgeLabel(room.activeReservation.rentalType) }}
                          </div>
                        </div>
                      } @else {
                        <span class="text-slate-400">—</span>
                      }
                    </td>
                    <td class="py-3 px-4 text-right">
                      @if (room.status === 'Clean') {
                        <button
                          type="button"
                          (click)="openQuickWalkinForRoom(room)"
                          class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Walk-in
                        </button>
                      } @else if (room.status === 'Occupied') {
                        <button
                          type="button"
                          (click)="openFolioModalForRoom(room)"
                          class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 inline-flex"
                        >
                          <i class="pi pi-plus text-[10px]"></i>
                          <span>Minibar</span>
                        </button>
                      } @else if (room.status === 'Dirty') {
                        <button
                          type="button"
                          (click)="changeRoomStatus(room, RoomStatus.Cleaning)"
                          class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Bắt đầu dọn
                        </button>
                      } @else if (room.status === 'Cleaning') {
                        <button
                          type="button"
                          (click)="changeRoomStatus(room, RoomStatus.Clean)"
                          class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Xong dọn
                        </button>
                      } @else {
                        <span class="text-slate-400 text-xs">Đang phục vụ</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (viewMode() === 'timeline') {
        <!-- TIMELINE TAPE CHART (GANTT VIEW) -->
        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4 p-5">
          <!-- Timeline Controls -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 class="text-sm font-bold text-slate-800">Sơ đồ Dòng thời gian phòng (Tape Chart / Gantt)</h3>
              <span class="text-xs text-slate-500 hidden sm:inline">
                (Khoảng thời gian lưu trú theo từng ngày thực tế)
              </span>
            </div>

            <!-- Date range navigation & Zoom buttons -->
            <div class="flex items-center gap-2 flex-wrap">
              <div class="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  (click)="prevTimeline()"
                  class="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                  title="Lùi lại"
                >
                  <i class="pi pi-chevron-left text-xs"></i>
                </button>
                <button
                  type="button"
                  (click)="todayTimeline()"
                  class="px-3 py-1.5 rounded-lg font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  (click)="nextTimeline()"
                  class="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                  title="Tiếp theo"
                >
                  <i class="pi pi-chevron-right text-xs"></i>
                </button>
              </div>

              <!-- Days Selector: 7 or 14 days -->
              <div class="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  (click)="timelineDaysCount.set(7)"
                  [ngClass]="timelineDaysCount() === 7 ? 'bg-white shadow-2xs text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'"
                  class="px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  7 ngày
                </button>
                <button
                  type="button"
                  (click)="timelineDaysCount.set(14)"
                  [ngClass]="timelineDaysCount() === 14 ? 'bg-white shadow-2xs text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'"
                  class="px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  14 ngày
                </button>
              </div>
            </div>
          </div>

          <!-- Timeline Grid Container -->
          <div class="overflow-x-auto border border-slate-200 rounded-xl">
            <table class="w-full border-collapse text-xs select-none min-w-[700px]">
              <!-- Timeline Table Header -->
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200">
                  <!-- Sticky Left Header: Room Information -->
                  <th class="sticky left-0 z-20 bg-slate-50 p-3 text-left font-bold text-slate-700 min-w-[160px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Phòng / Tầng
                  </th>
                  <!-- Date Headers -->
                  @for (col of timelineDates(); track col.dateStr) {
                    <th
                      [ngClass]="{
                        'bg-emerald-50/80 text-emerald-900 border-b-2 border-b-emerald-500': col.isToday,
                        'bg-slate-100/50 text-slate-600': col.isWeekend && !col.isToday,
                        'text-slate-700': !col.isWeekend && !col.isToday
                      }"
                      class="p-2 text-center border-r border-slate-200 min-w-[120px]"
                    >
                      <div class="font-bold text-xs uppercase">{{ col.dayOfWeek }}</div>
                      <div class="text-[11px] font-semibold">{{ col.dateFormatted }}</div>
                      @if (col.isToday) {
                        <span class="inline-block px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold mt-0.5">
                          Hôm nay
                        </span>
                      }
                    </th>
                  }
                </tr>
              </thead>

              <!-- Timeline Table Body: Room Rows -->
              <tbody>
                @for (room of filteredRooms(); track room.id) {
                  <tr class="border-b border-slate-200/80 hover:bg-slate-50/40 transition-colors">
                    <!-- Sticky Left Column: Room info -->
                    <td class="sticky left-0 z-10 bg-white p-2.5 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" [ngClass]="getRoomDotClass(room)"></span>
                        <div>
                          <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>Phòng {{ room.roomNumber }}</span>
                            <span class="text-[10px] text-slate-500 font-normal">T{{ room.floor }}</span>
                          </div>
                          <div class="text-[10px] text-slate-500 truncate max-w-[120px]" [title]="room.roomTypeName">
                            {{ room.roomTypeName }}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Date Cells -->
                    @for (col of timelineDates(); track col.dateStr) {
                      <td
                        [ngClass]="{
                          'bg-emerald-50/20': col.isToday,
                          'bg-slate-50/30': col.isWeekend && !col.isToday
                        }"
                        class="p-1 border-r border-slate-200/80 h-16 align-middle relative text-center"
                      >
                        @if (getCellBooking(room, col.dateStr); as booking) {
                          <!-- Booking chip -->
                          <div
                            (click)="onTimelineBookingClick(booking, room)"
                            [ngClass]="getBookingChipClass(booking)"
                            class="rounded-lg p-1.5 text-left shadow-2xs border cursor-pointer hover:shadow-xs transition-all relative overflow-hidden group/chip"
                          >
                            <div class="flex items-center justify-between text-[10px] font-bold truncate">
                              <span class="truncate">{{ booking.guestName }}</span>
                              <span class="text-[9px] opacity-80 uppercase">{{ getBookingStatusShort(booking.status) }}</span>
                            </div>
                            <div class="text-[9px] font-mono opacity-90 truncate">
                              {{ booking.totalAmount | number:'1.0-0' }}₫
                            </div>
                            <!-- Mini button in chip -->
                            <div class="flex items-center justify-between mt-1 pt-1 border-t border-black/10 text-[9px]">
                              <span class="truncate text-[8px]">{{ booking.confirmationCode }}</span>
                              <button
                                type="button"
                                (click)="$event.stopPropagation(); openFolioModalForReservation(booking, room)"
                                class="px-1.5 py-0.5 rounded bg-white/90 hover:bg-white text-indigo-700 font-bold border border-indigo-200 text-[8px] cursor-pointer"
                                title="Thêm Minibar & Dịch vụ"
                              >
                                + Minibar
                              </button>
                            </div>
                          </div>
                        } @else {
                          <!-- Empty Room Cell: Click to Walk-in on that date -->
                          <button
                            type="button"
                            (click)="openQuickWalkinForRoomOnDate(room, col.dateStr)"
                            class="w-full h-full rounded-md opacity-0 hover:opacity-100 hover:bg-emerald-50 text-emerald-700 text-[10px] font-semibold flex items-center justify-center gap-1 transition-opacity cursor-pointer border border-dashed border-emerald-300"
                          >
                            <i class="pi pi-plus text-[9px]"></i>
                            <span>Nhận</span>
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

    <!-- Quick Walk-in Modal Dialog -->
    @if (isWalkinModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-xl w-full p-6 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <i class="pi pi-user-plus text-sm"></i>
                </div>
                <span>Tiếp khách vãng lai tại quầy (Quick Walk-in)</span>
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Nhận phòng trực tiếp tại quầy lễ tân với đầy đủ chế độ thuê theo giờ, qua đêm hoặc theo ngày.
              </p>
            </div>
            <button
              type="button"
              (click)="closeWalkinModal()"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>

          <form [formGroup]="walkinForm" (ngSubmit)="submitWalkin()" class="space-y-4">
            <!-- Room Selection -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Phòng tiếp nhận <span class="text-rose-500">*</span></label>
              <select
                formControlName="roomId"
                (change)="onWalkinRoomSelected()"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white transition"
              >
                <option value="">-- Chọn phòng sạch trống --</option>
                @for (r of cleanRoomsList(); track r.id) {
                  <option [value]="r.id">Phòng {{ r.roomNumber }} - Tầng {{ r.floor }} ({{ r.roomTypeName }} - {{ r.basePrice | number:'1.0-0' }}₫)</option>
                }
              </select>
            </div>

            <!-- Rental Mode 3 Tabs -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Chế độ thuê phòng <span class="text-rose-500">*</span></label>
              <div class="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  (click)="setWalkinRentalType(1)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 1 ? 'bg-white text-emerald-700 font-bold shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-clock text-xs"></i>
                  <span>Theo Giờ</span>
                </button>
                <button
                  type="button"
                  (click)="setWalkinRentalType(2)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 2 ? 'bg-white text-purple-700 font-bold shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-moon text-xs"></i>
                  <span>Qua Đêm</span>
                </button>
                <button
                  type="button"
                  (click)="setWalkinRentalType(3)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 3 ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-calendar text-xs"></i>
                  <span>Theo Ngày</span>
                </button>
              </div>
            </div>

            <!-- Rental Duration Details -->
            @if (walkinForm.get('rentalType')?.value === 1) {
              <!-- Hourly: duration hours -->
              <div class="p-3.5 bg-sky-50/80 rounded-xl border border-sky-200 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-sky-900">Thời lượng thuê theo giờ:</span>
                  <span class="text-xs font-mono font-bold text-sky-900 px-2 py-0.5 bg-sky-100 rounded-md border border-sky-200">{{ walkinForm.get('hourlyHours')?.value }} tiếng</span>
                </div>
                <div class="flex items-center gap-2">
                  @for (hrs of [1, 2, 3, 4, 6]; track hrs) {
                    <button
                      type="button"
                      (click)="walkinForm.patchValue({ hourlyHours: hrs })"
                      [ngClass]="walkinForm.get('hourlyHours')?.value === hrs ? 'bg-sky-600 text-white font-bold shadow-xs border-sky-600' : 'bg-white text-sky-800 hover:bg-sky-100 border-sky-200'"
                      class="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer"
                    >
                      {{ hrs }}h
                    </button>
                  }
                </div>
              </div>
            } @else if (walkinForm.get('rentalType')?.value === 2) {
              <!-- Overnight notice -->
              <div class="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
                <div class="font-bold flex items-center gap-1.5">
                  <i class="pi pi-info-circle text-purple-600 text-xs"></i>
                  <span>Chế độ Qua đêm tiêu chuẩn</span>
                </div>
                <p class="text-[11px] text-purple-700">
                  Nhận phòng ngay bây giờ và trả phòng vào 12:00 trưa ngày mai.
                </p>
              </div>
            } @else {
              <!-- Daily: nights count -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">Ngày nhận phòng</label>
                  <input
                    type="date"
                    formControlName="checkInDate"
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-slate-50 text-slate-700 focus:outline-hidden"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-bold text-slate-700">Ngày trả phòng</label>
                  <input
                    type="date"
                    formControlName="checkOutDate"
                    class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                  />
                </div>
              </div>
            }

            <!-- Guest Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">Tên khách hàng <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  formControlName="guestName"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">Số điện thoại</label>
                <input
                  type="tel"
                  formControlName="guestPhone"
                  placeholder="0912 345 678"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                />
              </div>
            </div>

            <!-- Row: Guest Count & Customer Notes -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">Số người ở</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  formControlName="numberOfGuests"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white font-medium"
                />
              </div>

              <div class="sm:col-span-2 space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">Ghi chú lễ tân / Khách yêu cầu</label>
                <input
                  type="text"
                  formControlName="notes"
                  placeholder="Thanh toán tiền mặt, lấy thêm chăn gối..."
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                />
              </div>
            </div>

            <!-- Form Actions -->
            <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeWalkinModal()"
                class="px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                [disabled]="walkinForm.invalid || isSubmittingWalkin()"
                class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                @if (isSubmittingWalkin()) {
                  <i class="pi pi-spin pi-spinner text-xs"></i>
                }
                <span>Nhận phòng ngay (Check-in)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Folio Minibar & Incidental Services Modal Dialog -->
    @if (isFolioModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-2xl w-full p-6 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <i class="pi pi-receipt text-sm"></i>
                </div>
                <h2 class="text-base sm:text-lg font-bold text-slate-900">
                  Phụ phí Minibar & Dịch vụ phụ trợ (Folio)
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                Phòng <strong class="text-slate-800 font-bold">Phòng {{ selectedFolioRoom()?.roomNumber }}</strong>
                @if (activeFolioReservation()) {
                  <span> — Khách: <strong class="text-slate-800 font-semibold">{{ activeFolioReservation()?.guestName }}</strong></span>
                  <span class="font-mono text-indigo-600 font-bold ml-1"> ({{ activeFolioReservation()?.confirmationCode }})</span>
                }
              </p>
            </div>
            <button
              type="button"
              (click)="closeFolioModal()"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>

          <!-- Folio Financial Balance Card -->
          @if (currentFolio(); as folio) {
            <div class="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4.5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/10">
              <div>
                <span class="text-[10px] uppercase font-bold tracking-wider text-slate-300">Tổng hóa đơn hiện tại</span>
                <div class="text-2xl sm:text-3xl font-black text-amber-300 mt-0.5 font-mono">
                  {{ folio.totalAmount | number:'1.0-0' }}₫
                </div>
                <div class="text-xs text-slate-300 flex items-center gap-3 mt-1.5 font-medium">
                  <span>Tiền phòng: {{ (folio.baseRoomAmount || folio.totalAmount) | number:'1.0-0' }}₫</span>
                  <span>•</span>
                  <span>Phụ phí: {{ (folio.surchargesAmount || 0) | number:'1.0-0' }}₫</span>
                </div>
              </div>
              <div class="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 w-full sm:w-auto">
                <span class="text-[10px] uppercase font-bold tracking-wider text-slate-300">Đã thanh toán / Còn lại</span>
                <div class="text-sm font-semibold mt-1">
                  Đã trả: <span class="font-mono text-emerald-300 font-bold">{{ folio.paidAmount | number:'1.0-0' }}₫</span>
                </div>
                <div class="text-xs font-bold mt-1" [ngClass]="folio.remainingBalance > 0 ? 'text-rose-300' : 'text-emerald-300'">
                  Còn lại: <span class="font-mono text-lg font-black">{{ folio.remainingBalance | number:'1.0-0' }}₫</span>
                </div>
              </div>
            </div>
          }

          <!-- Quick Minibar Grid Catalog -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <i class="pi pi-bolt text-indigo-600 text-xs"></i>
                Danh mục Minibar & Dịch vụ phổ biến (Bấm để thêm ngay)
              </span>
              @if (isAddingFolioItem()) {
                <span class="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  <i class="pi pi-spin pi-spinner text-xs"></i> Đang ghi sổ...
                </span>
              }
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              @for (item of quickMinibarCatalog; track item.code) {
                <button
                  type="button"
                  [disabled]="isAddingFolioItem()"
                  (click)="addQuickMinibarItem(item)"
                  class="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/80 hover:border-indigo-300 text-left transition-all cursor-pointer group disabled:opacity-50 shadow-2xs hover:shadow-xs"
                >
                  <div class="flex items-center justify-between">
                    <div class="w-6 h-6 rounded-lg bg-white flex items-center justify-center border border-slate-200/80">
                      <i [class]="'pi ' + item.icon + ' text-indigo-600 text-xs'"></i>
                    </div>
                    <span class="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">+ Thêm</span>
                  </div>
                  <div class="font-bold text-xs text-slate-800 mt-2 line-clamp-1" [title]="item.name">
                    {{ item.name }}
                  </div>
                  <div class="text-[11px] font-mono text-emerald-700 font-bold mt-0.5">
                    {{ item.price | number:'1.0-0' }}₫
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Custom Item Entry Form -->
          <div class="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <i class="pi pi-plus-circle text-slate-500 text-xs"></i>
              Thêm khoản phụ phí tùy chỉnh (Hỏng hóc, giặt ủi đặc biệt, đền bù)
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div class="sm:col-span-2">
                <input
                  type="text"
                  [ngModel]="customItemName()"
                  (ngModelChange)="customItemName.set($event)"
                  placeholder="Tên khoản phí / Dịch vụ..."
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                />
              </div>
              <div>
                <input
                  type="number"
                  [ngModel]="customItemPrice()"
                  (ngModelChange)="customItemPrice.set($event)"
                  placeholder="Đơn giá (VNĐ)"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs font-mono font-medium"
                />
              </div>
              <div>
                <button
                  type="button"
                  [disabled]="!customItemName().trim() || !customItemPrice() || isAddingFolioItem()"
                  (click)="submitCustomFolioItem()"
                  class="w-full h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20"
                >
                  <i class="pi pi-check text-xs"></i>
                  <span>Ghi vào Folio</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Existing Breakdown Items in Folio -->
          @if (currentFolio()?.breakdown && currentFolio()!.breakdown!.length > 0) {
            <div class="space-y-1.5">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Chi tiết các khoản trong hóa đơn:
              </span>
              <div class="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white shadow-2xs">
                @for (b of currentFolio()!.breakdown!; track b.description) {
                  <div class="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/60 transition">
                    <div>
                      <span class="font-medium text-slate-800">{{ b.description }}</span>
                      @if (b.category) {
                        <span class="text-[10px] text-slate-400 block">{{ b.category }}</span>
                      }
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-slate-900 font-mono">{{ b.amount | number:'1.0-0' }}₫</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Footer Actions -->
          <div class="pt-3.5 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              (click)="closeFolioModal()"
              class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class RoomsPage implements OnInit {
  private readonly roomService = inject(RoomService);
  private readonly reservationService = inject(ReservationService);
  private readonly roomTypeService = inject(RoomTypeService);
  private readonly paymentService = inject(PaymentService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  readonly RoomStatus = RoomStatus;

  rooms = signal<ExtendedRoomDto[]>([]);
  roomTypes = signal<RoomTypeDto[]>([]);
  isLoading = signal<boolean>(false);
  isSubmittingWalkin = signal<boolean>(false);

  viewMode = signal<'rack' | 'table' | 'timeline'>('rack');
  searchQuery = signal<string>('');
  selectedFloor = signal<number | 'ALL'>('ALL');
  selectedRoomTypeId = signal<string | 'ALL'>('ALL');
  selectedStatus = signal<string | 'ALL'>('ALL');

  isWalkinModalOpen = signal<boolean>(false);
  isFolioModalOpen = signal<boolean>(false);
  selectedFolioRoom = signal<ExtendedRoomDto | null>(null);
  activeFolioReservation = signal<ReservationDto | null>(null);
  currentFolio = signal<FolioDto | null>(null);
  isAddingFolioItem = signal<boolean>(false);

  customItemName = signal<string>('');
  customItemPrice = signal<number | null>(null);
  customItemCategory = signal<string>('Minibar');

  timelineStartDate = signal<string>(this.getTodayVnDate());
  timelineDaysCount = signal<number>(7);
  allTimelineReservations = signal<ReservationDto[]>([]);

  readonly quickMinibarCatalog: QuickMinibarCatalogItem[] = [
    { code: 'MINI-AQUA', name: 'Nước khoáng Aquafina 500ml', price: 15000, category: 'Minibar', icon: 'pi-bolt' },
    { code: 'MINI-COCA', name: 'Coca Cola / Pepsi lon', price: 20000, category: 'Minibar', icon: 'pi-box' },
    { code: 'MINI-REDBULL', name: 'Nước tăng lực Redbull (Bò Húc)', price: 25000, category: 'Minibar', icon: 'pi-bolt' },
    { code: 'MINI-BEER', name: 'Bia Heineken / Tiger lon', price: 30000, category: 'Minibar', icon: 'pi-star' },
    { code: 'MINI-NOODLE', name: 'Mì ly Handy Hảo Hảo', price: 20000, category: 'Minibar', icon: 'pi-shopping-bag' },
    { code: 'SVC-LAUNDRY', name: 'Dịch vụ Giặt sấy lấy liền (1 kg)', price: 35000, category: 'Service', icon: 'pi-sync' },
    { code: 'SVC-MOTO', name: 'Thuê xe máy theo ngày (AirBlade)', price: 150000, category: 'Service', icon: 'pi-compass' },
    { code: 'FB-BUFFET', name: 'Suất Buffet sáng tại nhà hàng', price: 120000, category: 'FoodBeverage', icon: 'pi-heart' },
  ];

  walkinForm: FormGroup = this.fb.group({
    roomId: ['', Validators.required],
    rentalType: [1, Validators.required], // 1: Hourly, 2: Overnight, 3: Daily
    hourlyHours: [2],
    checkInDate: [this.getTodayVnDate()],
    checkOutDate: [this.addDays(this.getTodayVnDate(), 1)],
    guestName: ['', Validators.required],
    guestPhone: [''],
    numberOfGuests: [2, [Validators.required, Validators.min(1)]],
    notes: ['Khách vãng lai tại quầy (Walk-in)']
  });

  // KPI Computeds
  cleanRoomsCount = computed(() => this.rooms().filter(r => r.status === 'Clean').length);
  dirtyRoomsCount = computed(() => this.rooms().filter(r => r.status === 'Dirty').length);
  cleaningRoomsCount = computed(() => this.rooms().filter(r => r.status === 'Cleaning').length);
  outOfServiceCount = computed(() => this.rooms().filter(r => r.status === 'OutOfService').length);

  occupiedHourlyCount = computed(() =>
    this.rooms().filter(r => r.status === 'Occupied' && (r.rentalTypeDisplay === 'Hourly' || r.activeReservation?.rentalType === 1)).length
  );

  occupiedDailyOvernightCount = computed(() =>
    this.rooms().filter(r => r.status === 'Occupied' && (r.rentalTypeDisplay !== 'Hourly' && r.activeReservation?.rentalType !== 1)).length
  );

  cleanRoomsList = computed(() => this.rooms().filter(r => r.status === 'Clean'));

  availableFloors = computed(() => {
    const floors = new Set<number>();
    this.rooms().forEach(r => floors.add(r.floor));
    return Array.from(floors).sort((a, b) => a - b);
  });

  filteredRooms = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const floor = this.selectedFloor();
    const rtId = this.selectedRoomTypeId();
    const status = this.selectedStatus();

    let list = this.rooms();

    if (floor !== 'ALL') {
      list = list.filter(r => r.floor === Number(floor));
    }
    if (rtId !== 'ALL') {
      list = list.filter(r => r.roomTypeId === rtId);
    }
    if (status !== 'ALL') {
      list = list.filter(r => r.status === status);
    }
    if (query) {
      list = list.filter(r =>
        r.roomNumber.toLowerCase().includes(query) ||
        r.roomTypeName.toLowerCase().includes(query)
      );
    }

    return list;
  });

  roomsByFloor = computed(() => {
    const rooms = this.filteredRooms();
    const grouped = new Map<number, ExtendedRoomDto[]>();

    rooms.forEach(r => {
      if (!grouped.has(r.floor)) {
        grouped.set(r.floor, []);
      }
      grouped.get(r.floor)!.push(r);
    });

    const result: { floor: number; rooms: ExtendedRoomDto[]; cleanCount: number; occupiedCount: number; dirtyCount: number }[] = [];
    const sortedFloors = Array.from(grouped.keys()).sort((a, b) => a - b);

    sortedFloors.forEach(f => {
      const fRooms = grouped.get(f)!;
      result.push({
        floor: f,
        rooms: fRooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
        cleanCount: fRooms.filter(r => r.status === 'Clean').length,
        occupiedCount: fRooms.filter(r => r.status === 'Occupied').length,
        dirtyCount: fRooms.filter(r => r.status === 'Dirty').length
      });
    });

    return result;
  });

  timelineDates = computed<TimelineDateCol[]>(() => {
    const startStr = this.timelineStartDate();
    const count = this.timelineDaysCount();
    const todayStr = this.getTodayVnDate();
    const cols: TimelineDateCol[] = [];

    const parts = startStr.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3) return [];

    const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 0; i < count; i++) {
      const cur = new Date(parts[0], parts[1] - 1, parts[2] + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = daysOfWeek[cur.getDay()];
      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;

      cols.push({
        dateStr,
        dayOfWeek,
        dateFormatted: `${d}/${m}`,
        isToday: dateStr === todayStr,
        isWeekend
      });
    }

    return cols;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    const propId = this.authService.activePropertyId();

    this.roomTypeService.getRoomTypes().subscribe({
      next: (res) => this.roomTypes.set(res?.items || []),
      error: () => {}
    });

    if (propId) {
      this.loadTimelineReservations();
    }

    this.roomService.getRooms({ pageSize: 100 }).subscribe({
      next: (paged) => {
        const rawRooms = (paged.items || []) as ExtendedRoomDto[];

        // If active property, load active reservations to enrich occupied rooms
        if (propId) {
          this.reservationService.getReservations({ propertyId: propId, status: 3, pageSize: 50 }).subscribe({
            next: (resPaged) => {
              const resList = resPaged.items || [];
              const enriched: ExtendedRoomDto[] = rawRooms.map(r => {
                const active = resList.find(res => res.roomId === r.id);
                if (active) {
                  const display: 'Hourly' | 'Overnight' | 'Daily' = active.rentalType === 1 ? 'Hourly' : (active.rentalType === 2 ? 'Overnight' : 'Daily');
                  return {
                    ...r,
                    activeReservation: active,
                    rentalTypeDisplay: display
                  };
                }
                return r;
              });
              this.rooms.set(enriched);
              this.isLoading.set(false);
            },
            error: () => {
              this.rooms.set(rawRooms);
              this.isLoading.set(false);
            }
          });
        } else {
          this.rooms.set(rawRooms);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.toastError('Không thể tải danh sách phòng.', 'Lỗi');
      }
    });
  }

  getRoomCardClasses(room: ExtendedRoomDto): string {
    switch (room.status) {
      case 'Clean':
        return 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50';
      case 'Occupied':
        if (room.rentalTypeDisplay === 'Hourly' || room.activeReservation?.rentalType === 1) {
          return 'border-sky-300 bg-sky-50/50 hover:border-sky-500 hover:bg-sky-50';
        }
        if (room.rentalTypeDisplay === 'Overnight' || room.activeReservation?.rentalType === 2) {
          return 'border-purple-300 bg-purple-50/50 hover:border-purple-500 hover:bg-purple-50';
        }
        return 'border-blue-300 bg-blue-50/50 hover:border-blue-500 hover:bg-blue-50';
      case 'Dirty':
        return 'border-rose-300 bg-rose-50/40 hover:border-rose-400 hover:bg-rose-50';
      case 'Cleaning':
        return 'border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50';
      case 'OutOfService':
      default:
        return 'border-slate-300 bg-slate-100 hover:border-slate-400';
    }
  }

  getRoomDotClass(room: ExtendedRoomDto): string {
    switch (room.status) {
      case 'Clean': return 'bg-emerald-500';
      case 'Occupied':
        if (room.rentalTypeDisplay === 'Hourly' || room.activeReservation?.rentalType === 1) {
          return 'bg-sky-500';
        }
        if (room.rentalTypeDisplay === 'Overnight' || room.activeReservation?.rentalType === 2) {
          return 'bg-purple-500';
        }
        return 'bg-blue-500';
      case 'Dirty': return 'bg-rose-500';
      case 'Cleaning': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  }

  getRoomStatusBadgeTextClass(room: ExtendedRoomDto): string {
    switch (room.status) {
      case 'Clean': return 'text-emerald-700';
      case 'Occupied':
        if (room.rentalTypeDisplay === 'Hourly' || room.activeReservation?.rentalType === 1) {
          return 'text-sky-700';
        }
        if (room.rentalTypeDisplay === 'Overnight' || room.activeReservation?.rentalType === 2) {
          return 'text-purple-700';
        }
        return 'text-blue-700';
      case 'Dirty': return 'text-rose-700';
      case 'Cleaning': return 'text-amber-700';
      default: return 'text-slate-600';
    }
  }

  getRoomRentalOrStatusLabel(room: ExtendedRoomDto): string {
    if (room.status === 'Clean') return 'Trống sạch';
    if (room.status === 'Occupied') {
      if (room.rentalTypeDisplay === 'Hourly' || room.activeReservation?.rentalType === 1) {
        return '⚡ Theo giờ';
      }
      if (room.rentalTypeDisplay === 'Overnight' || room.activeReservation?.rentalType === 2) {
        return '🌙 Qua đêm';
      }
      return '📅 Theo ngày';
    }
    if (room.status === 'Dirty') return 'Cần dọn dẹp';
    if (room.status === 'Cleaning') return 'Đang dọn';
    return 'Bảo trì';
  }

  getRoomStatusLabel(room: ExtendedRoomDto): string {
    return ROOM_STATUS_LABELS[room.status] || room.status;
  }

  getRentalTypeBadgeLabel(type: number): string {
    if (type === 1) return 'Thuê theo giờ';
    if (type === 2) return 'Thuê qua đêm';
    return 'Thuê theo ngày';
  }

  onRoomCardClicked(room: ExtendedRoomDto): void {
    if (room.status === 'Clean') {
      this.openQuickWalkinForRoom(room);
    } else if (room.status === 'Dirty') {
      this.changeRoomStatus(room, RoomStatus.Cleaning);
    } else if (room.status === 'Cleaning') {
      this.changeRoomStatus(room, RoomStatus.Clean);
    } else if (room.status === 'Occupied') {
      const guest = room.activeReservation?.guestName || 'Khách đang ở';
      this.alertService.toastInfo(`Đang có khách lưu trú: ${guest}`, `Phòng ${room.roomNumber}`);
    }
  }

  changeRoomStatus(room: ExtendedRoomDto, newStatus: RoomStatus): void {
    const oldStatus = room.status;
    this.roomService.updateRoomStatus(room.id, newStatus, oldStatus).subscribe({
      next: () => {
        this.alertService.toastSuccess(`Phòng ${room.roomNumber} chuyển sang: ${ROOM_STATUS_LABELS[newStatus]}`, 'Cập nhật trạng thái');
        this.loadData();
      },
      error: () => {
        this.alertService.toastError(`Không thể đổi trạng thái phòng ${room.roomNumber}.`, 'Lỗi');
      }
    });
  }

  openQuickWalkinModal(): void {
    const firstClean = this.cleanRoomsList()[0];
    this.walkinForm.reset({
      roomId: firstClean ? firstClean.id : '',
      rentalType: 1,
      hourlyHours: 2,
      checkInDate: this.getTodayVnDate(),
      checkOutDate: this.addDays(this.getTodayVnDate(), 1),
      guestName: '',
      guestPhone: '',
      numberOfGuests: 2,
      notes: 'Khách vãng lai tại quầy (Walk-in)'
    });
    this.isWalkinModalOpen.set(true);
  }

  openQuickWalkinForRoom(room: ExtendedRoomDto): void {
    this.walkinForm.reset({
      roomId: room.id,
      rentalType: 1,
      hourlyHours: 2,
      checkInDate: this.getTodayVnDate(),
      checkOutDate: this.addDays(this.getTodayVnDate(), 1),
      guestName: '',
      guestPhone: '',
      numberOfGuests: 2,
      notes: 'Khách vãng lai tại quầy (Walk-in)'
    });
    this.isWalkinModalOpen.set(true);
  }

  closeWalkinModal(): void {
    this.isWalkinModalOpen.set(false);
  }

  onWalkinRoomSelected(): void {
    // Room selected change logic if needed
  }

  setWalkinRentalType(type: number): void {
    this.walkinForm.patchValue({ rentalType: type });
  }

  submitWalkin(): void {
    if (this.walkinForm.invalid) {
      return;
    }

    const propId = this.authService.activePropertyId();
    if (!propId) {
      this.alertService.toastError('Vui lòng chọn chi nhánh làm việc trước khi tiếp nhận khách.', 'Lỗi');
      return;
    }

    this.isSubmittingWalkin.set(true);
    const formVal = this.walkinForm.value;
    const selectedRoom = this.rooms().find(r => r.id === formVal.roomId);
    if (!selectedRoom) {
      this.isSubmittingWalkin.set(false);
      return;
    }

    const now = new Date();
    let startAt = now.toISOString();
    let endAt = new Date(now.getTime() + (formVal.hourlyHours || 2) * 3600000).toISOString();
    let checkInDateStr = formVal.checkInDate;
    let checkOutDateStr = formVal.checkOutDate;

    if (formVal.rentalType === 2) {
      // Overnight: now until tomorrow 12:00
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      endAt = tomorrow.toISOString();
    } else if (formVal.rentalType === 3) {
      // Daily:
      const outD = new Date(formVal.checkOutDate);
      outD.setHours(12, 0, 0, 0);
      endAt = outD.toISOString();
    }

    const req: CreateReservationRequest = {
      propertyId: propId,
      roomId: selectedRoom.id,
      rentalType: formVal.rentalType,
      startAtUtc: startAt,
      endAtUtc: endAt,
      checkInDate: checkInDateStr,
      checkOutDate: checkOutDateStr,
      guestName: formVal.guestName,
      guestEmail: 'walkin@hotel.internal',
      guestPhone: formVal.guestPhone || undefined,
      numberOfGuests: formVal.numberOfGuests,
      customerNotes: formVal.notes,
      idempotencyKey: crypto.randomUUID()
    };

    this.reservationService.createReservation(req).subscribe({
      next: (res) => {
        // Also update room status to Occupied
        this.roomService.updateRoomStatus(selectedRoom.id, RoomStatus.Occupied, RoomStatus.Clean).subscribe({
          next: () => {
            this.isSubmittingWalkin.set(false);
            this.isWalkinModalOpen.set(false);
            this.alertService.toastSuccess(
              `Đã tạo đặt phòng ${res.confirmationCode} cho khách ${formVal.guestName} tại phòng ${selectedRoom.roomNumber}.`,
              'Nhận phòng thành công!'
            );
            this.loadData();
          },
          error: () => {
            this.isSubmittingWalkin.set(false);
            this.isWalkinModalOpen.set(false);
            this.alertService.toastSuccess(
              `Đã tạo đặt phòng ${res.confirmationCode} cho khách ${formVal.guestName}.`,
              'Nhận phòng thành công!'
            );
            this.loadData();
          }
        });
      },
      error: () => {
        this.isSubmittingWalkin.set(false);
        this.alertService.toastError('Không thể tạo đặt phòng nhận ngay. Vui lòng thử lại.', 'Lỗi');
      }
    });
  }

  // --- Timeline (Gantt Tape Chart) Methods ---
  prevTimeline(): void {
    this.timelineStartDate.set(this.addDays(this.timelineStartDate(), -this.timelineDaysCount()));
  }

  nextTimeline(): void {
    this.timelineStartDate.set(this.addDays(this.timelineStartDate(), this.timelineDaysCount()));
  }

  todayTimeline(): void {
    this.timelineStartDate.set(this.getTodayVnDate());
  }

  getCellBooking(room: ExtendedRoomDto, dateStr: string): ReservationDto | null {
    const list = this.allTimelineReservations();
    const found = list.find(res => {
      if (res.roomId !== room.id) return false;
      // Exclude Cancelled (4) or Rejected (6)
      if (res.status === 4 || res.status === 6) return false;

      if (res.checkInDate && res.checkOutDate) {
        if (res.checkInDate === res.checkOutDate) {
          return dateStr === res.checkInDate;
        }
        return dateStr >= res.checkInDate && dateStr < res.checkOutDate;
      }
      return false;
    });
    return found || null;
  }

  getBookingChipClass(booking: ReservationDto): string {
    switch (booking.status) {
      case 3: // CheckedIn
        return 'bg-emerald-100/90 text-emerald-950 border-emerald-300';
      case 1: // Confirmed
        return 'bg-sky-100/90 text-sky-950 border-sky-300';
      case 5: // Completed / CheckedOut
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-amber-100 text-amber-900 border-amber-300';
    }
  }

  getBookingStatusShort(status: number): string {
    switch (status) {
      case 0: return 'Chờ';
      case 1: return 'Đã xác nhận';
      case 2: return 'Đã thanh toán';
      case 3: return 'Đang ở';
      case 5: return 'Đã trả';
      default: return 'Khác';
    }
  }

  onTimelineBookingClick(booking: ReservationDto, room: ExtendedRoomDto): void {
    this.openFolioModalForReservation(booking, room);
  }

  openQuickWalkinForRoomOnDate(room: ExtendedRoomDto, dateStr: string): void {
    this.walkinForm.reset({
      roomId: room.id,
      rentalType: 3, // Daily by default on timeline
      hourlyHours: 2,
      checkInDate: dateStr,
      checkOutDate: this.addDays(dateStr, 1),
      guestName: '',
      guestPhone: '',
      numberOfGuests: 2,
      notes: 'Đặt phòng nhanh từ sơ đồ Timeline Gantt'
    });
    this.isWalkinModalOpen.set(true);
  }

  // --- Folio & Minibar Methods ---
  openFolioModalForRoom(room: ExtendedRoomDto): void {
    const propId = this.authService.activePropertyId();
    if (!propId) {
      this.alertService.toastError('Vui lòng chọn chi nhánh khách sạn trước.', 'Lỗi');
      return;
    }

    let activeRes = room.activeReservation;
    if (!activeRes) {
      activeRes = this.allTimelineReservations().find(r => r.roomId === room.id && r.status === 3);
    }

    if (!activeRes) {
      this.alertService.toastInfo(`Phòng ${room.roomNumber} chưa có đặt phòng đang lưu trú để ghi nhận Minibar.`, 'Thông báo');
      return;
    }
    this.openFolioModalForReservation(activeRes, room);
  }

  openFolioModalForReservation(res: ReservationDto, room?: ExtendedRoomDto): void {
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.activeFolioReservation.set(res);
    const matchedRoom = room || this.rooms().find(r => r.id === res.roomId) || null;
    this.selectedFolioRoom.set(matchedRoom);
    this.customItemName.set('');
    this.customItemPrice.set(null);
    this.isFolioModalOpen.set(true);

    this.paymentService.getFolio(res.id, propId).subscribe({
      next: (folio) => {
        this.currentFolio.set(folio);
      },
      error: () => {
        this.alertService.toastError('Không thể tải chi tiết Folio hóa đơn.', 'Lỗi');
      }
    });
  }

  closeFolioModal(): void {
    this.isFolioModalOpen.set(false);
    this.selectedFolioRoom.set(null);
    this.activeFolioReservation.set(null);
    this.currentFolio.set(null);
  }

  addQuickMinibarItem(item: QuickMinibarCatalogItem): void {
    const res = this.activeFolioReservation();
    const propId = this.authService.activePropertyId();
    if (!res || !propId) return;

    this.isAddingFolioItem.set(true);
    const req: AddFolioItemRequest = {
      propertyId: propId,
      itemCode: item.code,
      description: item.name,
      quantity: 1,
      unitPrice: item.price,
      category: item.category
    };

    this.reservationService.addFolioItem(res.id, req).subscribe({
      next: (updatedFolio) => {
        this.isAddingFolioItem.set(false);
        this.currentFolio.set(updatedFolio);
        this.alertService.toastSuccess(
          `Đã thêm "${item.name}" (${item.price.toLocaleString('vi-VN')}₫) vào hóa đơn phòng ${this.selectedFolioRoom()?.roomNumber || ''}.`,
          'Thêm phụ phí thành công!'
        );
        this.loadTimelineReservations();
      },
      error: (err) => {
        this.isAddingFolioItem.set(false);
        const msg = err?.error?.message || 'Không thể thêm khoản phí vào Folio.';
        this.alertService.toastError(msg, 'Lỗi');
      }
    });
  }

  submitCustomFolioItem(): void {
    const res = this.activeFolioReservation();
    const propId = this.authService.activePropertyId();
    const name = this.customItemName().trim();
    const price = this.customItemPrice();

    if (!res || !propId || !name || !price || price <= 0) {
      this.alertService.toastError('Vui lòng nhập tên khoản phí và giá hợp lệ.', 'Thông báo');
      return;
    }

    this.isAddingFolioItem.set(true);
    const req: AddFolioItemRequest = {
      propertyId: propId,
      itemCode: 'CUSTOM-INCIDENTAL',
      description: name,
      quantity: 1,
      unitPrice: price,
      category: this.customItemCategory()
    };

    this.reservationService.addFolioItem(res.id, req).subscribe({
      next: (updatedFolio) => {
        this.isAddingFolioItem.set(false);
        this.currentFolio.set(updatedFolio);
        this.customItemName.set('');
        this.customItemPrice.set(null);
        this.alertService.toastSuccess(
          `Đã thêm "${name}" (${price.toLocaleString('vi-VN')}₫) vào hóa đơn.`,
          'Thêm thành công!'
        );
        this.loadTimelineReservations();
      },
      error: (err) => {
        this.isAddingFolioItem.set(false);
        const msg = err?.error?.message || 'Không thể thêm khoản phí tùy chỉnh.';
        this.alertService.toastError(msg, 'Lỗi');
      }
    });
  }

  loadTimelineReservations(): void {
    const propId = this.authService.activePropertyId();
    if (!propId) return;

    this.reservationService.getReservations({ propertyId: propId, pageSize: 200 }).subscribe({
      next: (res) => {
        this.allTimelineReservations.set(res?.items || []);
      },
      error: () => {}
    });
  }

  private getTodayVnDate(): string {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vnDate = new Date(utc + (7 * 3600000));
    const y = vnDate.getFullYear();
    const m = String(vnDate.getMonth() + 1).padStart(2, '0');
    const d = String(vnDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addDays(dateStr: string, days: number): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
