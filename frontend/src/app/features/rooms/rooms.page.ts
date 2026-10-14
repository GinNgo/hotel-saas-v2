import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { ReservationDto, CreateReservationRequest, RentalType } from '../../core/models/reservation.model';
import { RoomTypeDto } from '../../core/models/room-type.model';
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
        subtitle="Quản lý sơ đồ Rack phòng theo từng tầng, theo dõi trạng thái buồng phòng và tiếp nhận khách tại quầy (Quick Walk-in)."
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
              <span>Sơ đồ phòng</span>
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
      } @else {
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
      }
    </div>

    <!-- Quick Walk-in Modal Dialog -->
    @if (isWalkinModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-5 my-8">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="pi pi-user-plus text-emerald-600"></i>
                <span>Tiếp khách vãng lai tại quầy (Quick Walk-in)</span>
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Nhận phòng trực tiếp tại quầy lễ tân với đầy đủ chế độ thuê theo giờ, qua đêm hoặc theo ngày.
              </p>
            </div>
            <button
              type="button"
              (click)="closeWalkinModal()"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>

          <form [formGroup]="walkinForm" (ngSubmit)="submitWalkin()" class="space-y-4">
            <!-- Room Selection -->
            <div class="space-y-1">
              <label class="block text-xs font-bold text-slate-700">Phòng tiếp nhận <span class="text-rose-500">*</span></label>
              <select
                formControlName="roomId"
                (change)="onWalkinRoomSelected()"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:border-emerald-500 focus:outline-hidden bg-white"
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
              <div class="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  (click)="setWalkinRentalType(1)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 1 ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-clock text-xs"></i>
                  <span>Theo Giờ</span>
                </button>
                <button
                  type="button"
                  (click)="setWalkinRentalType(2)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 2 ? 'bg-white text-purple-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-moon text-xs"></i>
                  <span>Qua Đêm</span>
                </button>
                <button
                  type="button"
                  (click)="setWalkinRentalType(3)"
                  [ngClass]="walkinForm.get('rentalType')?.value === 3 ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'"
                  class="py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i class="pi pi-calendar text-xs"></i>
                  <span>Theo Ngày</span>
                </button>
              </div>
            </div>

            <!-- Rental Duration Details -->
            @if (walkinForm.get('rentalType')?.value === 1) {
              <!-- Hourly: duration hours -->
              <div class="p-3 bg-sky-50 rounded-xl border border-sky-200/80 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-sky-800">Thời lượng thuê theo giờ:</span>
                  <span class="text-xs font-mono font-bold text-sky-900">{{ walkinForm.get('hourlyHours')?.value }} tiếng</span>
                </div>
                <div class="flex items-center gap-2">
                  @for (hrs of [1, 2, 3, 4, 6]; track hrs) {
                    <button
                      type="button"
                      (click)="walkinForm.patchValue({ hourlyHours: hrs })"
                      [ngClass]="walkinForm.get('hourlyHours')?.value === hrs ? 'bg-sky-600 text-white font-bold' : 'bg-white text-sky-800 hover:bg-sky-100'"
                      class="flex-1 py-1 rounded-lg border border-sky-300 text-xs transition-colors cursor-pointer"
                    >
                      {{ hrs }}h
                    </button>
                  }
                </div>
              </div>
            } @else if (walkinForm.get('rentalType')?.value === 2) {
              <!-- Overnight notice -->
              <div class="p-3 bg-purple-50 rounded-xl border border-purple-200/80 text-xs text-purple-800 space-y-1">
                <div class="font-bold flex items-center gap-1.5">
                  <i class="pi pi-info-circle text-xs"></i>
                  <span>Chế độ Qua đêm tiêu chuẩn</span>
                </div>
                <p class="text-[11px] text-purple-700">
                  Nhận phòng ngay bây giờ và trả phòng vào 12:00 trưa ngày mai.
                </p>
              </div>
            } @else {
              <!-- Daily: nights count -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="block text-xs font-bold text-slate-700">Ngày nhận phòng</label>
                  <input
                    type="date"
                    formControlName="checkInDate"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-hidden"
                  />
                </div>
                <div class="space-y-1">
                  <label class="block text-xs font-bold text-slate-700">Ngày trả phòng</label>
                  <input
                    type="date"
                    formControlName="checkOutDate"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            }

            <!-- Guest Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="block text-xs font-bold text-slate-700">Tên khách hàng <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  formControlName="guestName"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div class="space-y-1">
                <label class="block text-xs font-bold text-slate-700">Số điện thoại</label>
                <input
                  type="tel"
                  formControlName="guestPhone"
                  placeholder="0912 345 678"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <!-- Row: Guest Count & Customer Notes -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1">
                <label class="block text-xs font-bold text-slate-700">Số người ở</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  formControlName="numberOfGuests"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div class="sm:col-span-2 space-y-1">
                <label class="block text-xs font-bold text-slate-700">Ghi chú lễ tân / Khách yêu cầu</label>
                <input
                  type="text"
                  formControlName="notes"
                  placeholder="Thanh toán tiền mặt, lấy thêm chăn gối..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <!-- Form Actions -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeWalkinModal()"
                class="px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                [disabled]="walkinForm.invalid || isSubmittingWalkin()"
                class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
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
  `
})
export class RoomsPage implements OnInit {
  private readonly roomService = inject(RoomService);
  private readonly reservationService = inject(ReservationService);
  private readonly roomTypeService = inject(RoomTypeService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  readonly RoomStatus = RoomStatus;

  rooms = signal<ExtendedRoomDto[]>([]);
  roomTypes = signal<RoomTypeDto[]>([]);
  isLoading = signal<boolean>(false);
  isSubmittingWalkin = signal<boolean>(false);

  viewMode = signal<'rack' | 'table'>('rack');
  searchQuery = signal<string>('');
  selectedFloor = signal<number | 'ALL'>('ALL');
  selectedRoomTypeId = signal<string | 'ALL'>('ALL');
  selectedStatus = signal<string | 'ALL'>('ALL');

  isWalkinModalOpen = signal<boolean>(false);

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
