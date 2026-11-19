import {
  Component,
  OnInit,
  OnDestroy,
  DestroyRef,
  ChangeDetectorRef,
  inject,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomTypeDto, CreateRoomTypeRequest, UpdateRoomTypeRequest } from '../../core/models/room-type.model';
import {
  PageHeaderComponent,
  StatCardComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent
} from '../../shared';
import { ContextSelectorDialogComponent } from '../auth/context-selector/context-selector.dialog';

interface RoomTypeWithProperty extends RoomTypeDto {
  propertyId?: string;
  propertyName?: string | null;
}

interface PresetRoomImage {
  readonly label: string;
  readonly url: string;
}

/**
 * Màn hình Quản lý Loại phòng (Room Types Catalog)
 * - Kết nối trực tiếp tới Backend API: GET / POST / PUT / DELETE /api/room-types
 * - Hỗ trợ tìm kiếm, chuyển chế độ xem Lưới Thẻ (Cards) & Bảng (Table)
 * - Thêm mới, chỉnh sửa cấu hình hạng phòng (Mã, Tên, Giá cơ bản, Sức chứa, Loại giường, Diện tích m², Ảnh đại diện)
 * - Bảo vệ toàn vẹn dữ liệu: Không cho phép xóa hạng phòng đang có phòng vật lý gán vào (roomCount > 0)
 */
@Component({
  selector: 'app-room-types',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    A11yModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    StatCardComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ContextSelectorDialogComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- 1. PAGE HEADER -->
      <app-page-header
        title="Danh mục Loại phòng (Room Types)"
        subtitle="Thiết lập các hạng phòng tiêu chuẩn của chi nhánh, giá cơ bản, sức chứa tối đa, cấu hình giường và diện tích."
      >
        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- View Mode Switcher -->
          <div class="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              (click)="viewMode.set('grid')"
              [ngClass]="viewMode() === 'grid' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="min-h-11 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-th-large text-xs"></i>
              <span>Thẻ hạng phòng</span>
            </button>
            <button
              type="button"
              (click)="viewMode.set('table')"
              [ngClass]="viewMode() === 'table' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="min-h-11 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i class="pi pi-list text-xs"></i>
              <span>Bảng chi tiết</span>
            </button>
          </div>

          <a
            routerLink="/rates"
            class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm shadow-2xs transition-colors"
          >
            <i class="pi pi-dollar text-xs text-emerald-600"></i>
            <span>Bảng giá theo giờ/đêm</span>
          </a>

          @if (canCreate()) {
            <button
              type="button"
              (click)="openCreateModal()"
              class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
            >
              <i class="pi pi-plus text-xs"></i>
              <span>Thêm loại phòng</span>
            </button>
          }
        </div>
      </app-page-header>

      <!-- Chain HQ Banner -->
      @if (!authService.activePropertyId()) {
        <div class="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-2.5 text-xs text-indigo-950">
            <i class="pi pi-building text-indigo-600 text-base mt-0.5 shrink-0"></i>
            <div>
              <div class="font-bold">Đang xem chế độ Toàn chuỗi (HQ)</div>
              <p class="text-indigo-800/90 mt-0.5">
                Danh mục hiển thị các hạng phòng trên toàn hệ thống kèm nhãn chi nhánh. Vui lòng chọn chi nhánh trước khi tạo mới hạng phòng.
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="openContextSelector()"
            class="min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <i class="pi pi-building text-xs"></i>
            <span>Chọn chi nhánh làm việc</span>
          </button>
        </div>
      }

      <!-- 2. KPI SUMMARY STRIP -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card
          title="Tổng hạng phòng"
          [value]="roomTypes().length"
          subtitle="Danh mục đang hoạt động"
          variant="emerald"
        >
          <i icon class="pi pi-tags text-lg"></i>
        </app-stat-card>
        <app-stat-card
          title="Tổng số phòng vật lý"
          [value]="totalPhysicalRooms()"
          subtitle="Đã gán vào các hạng phòng"
          variant="indigo"
        >
          <i icon class="pi pi-building text-lg"></i>
        </app-stat-card>
        <app-stat-card
          title="Giá niêm yết TB / Đêm"
          [value]="(averageBasePrice() | number:'1.0-0') + '₫'"
          subtitle="Trung bình các hạng phòng"
          variant="amber"
        >
          <i icon class="pi pi-wallet text-lg"></i>
        </app-stat-card>
        <app-stat-card
          title="Sức chứa lớn nhất"
          [value]="maxCapacity() + ' khách'"
          subtitle="Hạng phòng lớn nhất"
          variant="slate"
        >
          <i icon class="pi pi-users text-lg"></i>
        </app-stat-card>
      </div>

      <!-- 3. SEARCH & FILTER BAR -->
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            (keyup.enter)="loadRoomTypes()"
            placeholder="Tìm theo tên hoặc mã hạng phòng (VD: DLX, Deluxe, Suite...)"
            class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500 transition-all"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500 font-medium">
            Hiển thị <strong class="text-slate-800 font-mono tabular-nums">{{ filteredRoomTypes().length }}</strong> / <span class="tabular-nums">{{ roomTypes().length }}</span> hạng phòng
          </span>
          <button
            type="button"
            (click)="loadRoomTypes()"
            [disabled]="loading()"
            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <i class="pi pi-refresh text-xs text-emerald-600" [class.pi-spin]="loading()"></i>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <!-- 4. ERROR BANNER -->
      @if (errorMessage()) {
        <div role="alert" class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-rose-600 text-base"></i>
            <span>{{ errorMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="loadRoomTypes()"
            class="min-h-11 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      }

      <!-- 5. MAIN CONTENT -->
      @if (loading()) {
        <div class="py-16 flex flex-col items-center justify-center">
          <app-loading-spinner size="lg" message="Đang tải danh mục loại phòng của chi nhánh..." />
        </div>
      } @else if (filteredRoomTypes().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-2xs">
          <app-empty-state
            iconClass="pi pi-tags"
            title="Chưa có loại phòng nào phù hợp"
            description="Hãy tạo loại phòng đầu tiên (Standard, Superior, Deluxe, Suite...) để bắt đầu thiết lập sơ đồ phòng và bảng giá."
          />
          @if (canCreate()) {
            <div class="mt-4 flex justify-center">
              <button
                type="button"
                (click)="openCreateModal()"
                class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <i class="pi pi-plus text-xs"></i>
                <span>Tạo loại phòng đầu tiên</span>
              </button>
            </div>
          }
        </div>
      } @else if (viewMode() === 'grid') {
        <!-- CARD GRID VIEW -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (rt of filteredRoomTypes(); track rt.id) {
            <div class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <!-- Room Type Preview Banner -->
                <div class="relative h-44 bg-slate-100 overflow-hidden border-b border-slate-100">
                  <img
                    [src]="rt.imageUrl || getFallbackImage(rt.code)"
                    [alt]="rt.name"
                    width="400"
                    height="176"
                    loading="lazy"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    (error)="onImgError($event)"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent"></div>

                  <!-- Code Badge Top Left -->
                  <div class="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap pr-3">
                    <span class="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-xs text-white font-mono font-bold text-xs border border-white/15">
                      {{ rt.code }}
                    </span>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-600/90 backdrop-blur-xs text-white font-bold text-xs shadow-xs">
                      {{ rt.roomCount }} phòng
                    </span>
                    @if (!authService.activePropertyId() && getPropertyName(rt); as propName) {
                      <span class="px-2.5 py-1 rounded-lg bg-indigo-600/90 backdrop-blur-xs text-white font-semibold text-[11px] shadow-xs inline-flex items-center gap-1">
                        <i class="pi pi-building text-[10px]"></i>
                        <span>{{ propName }}</span>
                      </span>
                    }
                  </div>

                  <!-- Price Bottom Left -->
                  <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                    <div>
                      <h3 class="text-base font-bold leading-snug drop-shadow-xs">{{ rt.name }}</h3>
                      <div class="text-[11px] text-slate-200 flex items-center gap-2 mt-0.5">
                        <span><i class="pi pi-users text-[10px] mr-1"></i>Tối đa {{ rt.maxOccupancy }} khách</span>
                        @if (rt.squareMeters) {
                          <span>• {{ rt.squareMeters }}m²</span>
                        }
                      </div>
                    </div>
                    <div class="text-right">
                      <span class="block text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Giá cơ bản</span>
                      <span class="text-lg font-extrabold font-mono text-white">{{ rt.basePrice | number:'1.0-0' }}₫</span>
                    </div>
                  </div>
                </div>

                <!-- Card Details Body -->
                <div class="p-4 space-y-3">
                  <div class="flex items-center flex-wrap gap-2 text-xs text-slate-600">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                      <i class="pi pi-inbox text-emerald-600 text-xs"></i>
                      <span>{{ rt.bedType || '1 Giường Đôi King' }}</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium tabular-nums">
                      <i class="pi pi-arrows-alt text-indigo-600 text-xs"></i>
                      <span>{{ rt.squareMeters || 28 }} m²</span>
                    </span>
                  </div>

                  <p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                    {{ rt.description || 'Hạng phòng tiêu chuẩn đầy đủ tiện nghi cao cấp: điều hòa, Smart TV, minibar, phòng tắm riêng.' }}
                  </p>
                </div>
              </div>

              <!-- Card Footer Actions -->
              <div class="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  routerLink="/rooms"
                  class="min-h-11 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 tabular-nums"
                >
                  <span>Xem {{ rt.roomCount }} phòng</span>
                  <i class="pi pi-arrow-right text-[10px]"></i>
                </a>

                <div class="flex items-center gap-1.5">
                  @if (canUpdate()) {
                    <button
                      type="button"
                      (click)="openEditModal(rt)"
                      [attr.aria-label]="'Chỉnh sửa hạng phòng ' + rt.name"
                      class="min-h-11 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Chỉnh sửa hạng phòng"
                    >
                      <i class="pi pi-pencil text-[11px] text-emerald-600"></i>
                      <span>Sửa</span>
                    </button>
                  }
                  @if (canDelete()) {
                    <button
                      type="button"
                      (click)="confirmDelete(rt)"
                      [attr.aria-label]="'Xóa hạng phòng ' + rt.name"
                      class="min-h-11 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Xóa hạng phòng"
                    >
                      <i class="pi pi-trash text-[11px]"></i>
                      <span>Xóa</span>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- TABLE VIEW -->
        <div class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <!-- Mobile Stacked Cards (<768px) -->
          <div class="md:hidden divide-y divide-slate-100" data-testid="room-types-mobile-cards">
            @for (rt of filteredRoomTypes(); track rt.id) {
              <article class="p-4 space-y-3 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                        {{ rt.code }}
                      </span>
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono tabular-nums">
                        {{ rt.roomCount }} phòng
                      </span>
                    </div>
                    <div class="font-bold text-slate-900 text-sm">{{ rt.name }}</div>
                    @if (!authService.activePropertyId() && getPropertyName(rt); as propName) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-xs font-semibold">
                        <i class="pi pi-building text-xs" aria-hidden="true"></i>
                        <span>{{ propName }}</span>
                      </span>
                    }
                  </div>
                  <div class="text-right shrink-0">
                    <span class="block text-xs text-slate-500">Giá cơ bản</span>
                    <span class="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                      {{ rt.basePrice | number:'1.0-0' }}₫
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 tabular-nums">
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-slate-500 block">Giường &amp; Diện tích</span>
                    <strong class="text-slate-800 block truncate">{{ rt.bedType || '1 Giường Đôi King' }}</strong>
                    <span class="text-slate-500 font-mono">{{ rt.squareMeters || 28 }} m²</span>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-slate-500 block">Sức chứa tối đa</span>
                    <strong class="font-mono text-slate-800">{{ rt.maxOccupancy }} người</strong>
                  </div>
                </div>

                @if (rt.description) {
                  <p class="text-xs text-slate-600 line-clamp-2">{{ rt.description }}</p>
                }

                @if (canUpdate() || canDelete()) {
                  <div class="flex items-center justify-end gap-2 pt-1">
                    @if (canUpdate()) {
                      <button
                        type="button"
                        (click)="openEditModal(rt)"
                        [attr.aria-label]="'Chỉnh sửa hạng phòng ' + rt.name"
                        class="min-h-11 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <i class="pi pi-pencil text-xs text-emerald-600" aria-hidden="true"></i>
                        <span>Sửa</span>
                      </button>
                    }
                    @if (canDelete()) {
                      <button
                        type="button"
                        (click)="confirmDelete(rt)"
                        [attr.aria-label]="'Xóa hạng phòng ' + rt.name"
                        class="min-h-11 px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                        <span>Xóa</span>
                      </button>
                    }
                  </div>
                }
              </article>
            }
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th class="py-3.5 px-4">Mã</th>
                  <th class="py-3.5 px-4">Tên hạng phòng</th>
                  <th class="py-3.5 px-4">Loại giường & Diện tích</th>
                  <th class="py-3.5 px-4 text-center">Sức chứa</th>
                  <th class="py-3.5 px-4 text-right">Giá cơ bản / Đêm</th>
                  <th class="py-3.5 px-4 text-center">Số phòng</th>
                  <th class="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (rt of filteredRoomTypes(); track rt.id) {
                  <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3.5 px-4">
                      <span class="px-2 py-1 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                        {{ rt.code }}
                      </span>
                    </td>
                    <td class="py-3.5 px-4">
                      <div class="font-bold text-slate-900 text-sm">{{ rt.name }}</div>
                      @if (!authService.activePropertyId() && getPropertyName(rt); as propName) {
                        <span class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-semibold">
                          <i class="pi pi-building text-[9px]"></i>
                          <span>{{ propName }}</span>
                        </span>
                      }
                      @if (rt.description) {
                        <div class="text-[11px] text-slate-500 truncate max-w-xs">{{ rt.description }}</div>
                      }
                    </td>
                    <td class="py-3.5 px-4 text-slate-700">
                      <div class="font-medium">{{ rt.bedType || '1 Giường Đôi King' }}</div>
                      <div class="text-[11px] text-slate-400 font-mono tabular-nums">{{ rt.squareMeters || 28 }} m²</div>
                    </td>
                    <td class="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 tabular-nums">
                      {{ rt.maxOccupancy }} người
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm tabular-nums">
                      {{ rt.basePrice | number:'1.0-0' }}₫
                    </td>
                    <td class="py-3.5 px-4 text-center">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono tabular-nums">
                        {{ rt.roomCount }} phòng
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5">
                        @if (canUpdate()) {
                          <button
                            type="button"
                            (click)="openEditModal(rt)"
                            [attr.aria-label]="'Chỉnh sửa hạng phòng ' + rt.name"
                            class="min-h-11 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <i class="pi pi-pencil text-xs text-emerald-600 mr-1"></i>Sửa
                          </button>
                        }
                        @if (canDelete()) {
                          <button
                            type="button"
                            (click)="confirmDelete(rt)"
                            [attr.aria-label]="'Xóa hạng phòng ' + rt.name"
                            class="min-h-11 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <i class="pi pi-trash text-xs mr-1"></i>Xóa
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- 6. MODAL THÊM / SỬA LOẠI PHÒNG -->
    @if (isModalOpen()) {
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="editingRoomType() ? 'Chỉnh sửa Loại phòng' : 'Thêm Loại phòng mới'"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="closeModal()"
        class="fixed inset-0 z-[100] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        (click)="closeModal()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150"
        >
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <i class="pi pi-tags text-base"></i>
              </div>
              <div>
                <h2 class="text-base sm:text-lg font-bold text-slate-900">
                  {{ editingRoomType() ? 'Chỉnh sửa Loại phòng' : 'Thêm Loại phòng mới' }}
                </h2>
                <p class="text-xs text-slate-500">
                  Cấu hình thông tin hạng phòng, sức chứa và mức giá cơ bản niêm yết
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              aria-label="Đóng hộp thoại loại phòng"
              class="min-h-11 min-w-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>

          <form [formGroup]="roomTypeForm" (ngSubmit)="submitRoomType()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- Mã hạng phòng -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Mã hạng phòng <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  formControlName="code"
                  placeholder="VD: DLX, SUP, STD"
                  class="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono uppercase focus:border-emerald-600 focus:outline-hidden bg-white"
                />
              </div>

              <!-- Tên hạng phòng -->
              <div class="sm:col-span-2 space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Tên hạng phòng <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  formControlName="name"
                  placeholder="VD: Deluxe Double Hướng Biển"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- Giá cơ bản -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Giá cơ bản / Đêm (VNĐ) <span class="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="50000"
                  step="50000"
                  formControlName="basePrice"
                  placeholder="850000"
                  class="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-bold text-emerald-700 focus:border-emerald-600 focus:outline-hidden bg-white"
                />
              </div>

              <!-- Sức chứa tối đa -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Sức chứa tối đa (khách) <span class="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  formControlName="maxOccupancy"
                  class="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:outline-hidden bg-white"
                />
              </div>

              <!-- Diện tích -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">
                  Diện tích (m²)
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  formControlName="squareMeters"
                  placeholder="32"
                  class="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:outline-hidden bg-white"
                />
              </div>
            </div>

            <!-- Cấu hình Giường -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Loại giường tiêu chuẩn</label>
              <div class="flex flex-wrap gap-1.5 mb-1.5">
                @for (preset of bedTypePresets; track preset) {
                  <button
                    type="button"
                    (click)="roomTypeForm.patchValue({ bedType: preset })"
                    [ngClass]="roomTypeForm.get('bedType')?.value === preset ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'"
                    class="min-h-11 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {{ preset }}
                  </button>
                }
              </div>
              <input
                type="text"
                formControlName="bedType"
                placeholder="VD: 1 Giường Đôi King (1m8 x 2m)"
                class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
              />
            </div>

            <!-- Ảnh đại diện -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Đường dẫn ảnh phòng (Image URL)</label>
              <input
                type="text"
                formControlName="imageUrl"
                placeholder="/images/deluxe-double-pine.png hoặc https://cdn.example.com/rooms/deluxe.jpg"
                class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
              />
              <div class="flex flex-wrap gap-1.5 pt-1">
                @for (preset of presetRoomImages; track preset.url) {
                  <button
                    type="button"
                    (click)="roomTypeForm.patchValue({ imageUrl: preset.url })"
                    [ngClass]="roomTypeForm.get('imageUrl')?.value === preset.url ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'"
                    class="min-h-9 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {{ preset.label }}
                  </button>
                }
              </div>
              @if (roomTypeForm.get('imageUrl')?.value?.trim(); as previewImageUrl) {
                <div class="pt-1.5 flex items-center gap-3">
                  <img
                    [src]="previewImageUrl"
                    alt="Xem trước ảnh hạng phòng"
                    width="96"
                    height="64"
                    loading="lazy"
                    (error)="onImgError($event)"
                    class="w-24 h-16 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                  />
                  <span class="text-[11px] text-slate-500 font-mono truncate">{{ previewImageUrl }}</span>
                </div>
              }
            </div>

            <!-- Mô tả tiện nghi -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Mô tả tiện nghi & đặc điểm</label>
              <textarea
                rows="3"
                formControlName="description"
                placeholder="Mô tả tầm nhìn, nội thất, bồn tắm nằm, ban công, minibar..."
                class="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
              ></textarea>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                (click)="closeModal()"
                class="min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                [disabled]="roomTypeForm.invalid || isSubmitting()"
                class="min-h-11 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-xs"></i>
                }
                <span>{{ editingRoomType() ? 'Lưu cập nhật' : 'Tạo loại phòng' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- 7. MODAL XÁC NHẬN XÓA LOẠI PHÒNG -->
    @if (deletingRoomType(); as target) {
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xác nhận xóa hạng phòng"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="deletingRoomType.set(null)"
        class="fixed inset-0 z-[100] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        (click)="deletingRoomType.set(null)"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <i class="pi pi-exclamation-triangle text-lg"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Xác nhận xóa hạng phòng</h3>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa hạng phòng <strong class="text-slate-900">{{ target.name }} ({{ target.code }})</strong>?
              </p>
              @if (target.roomCount > 0) {
                <div class="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <i class="pi pi-info-circle mr-1 text-amber-600"></i>
                  Hạng phòng này đang có <strong class="tabular-nums">{{ target.roomCount }} phòng vật lý</strong>. Bạn cần chuyển hoặc xóa các phòng thuộc hạng này trước khi xóa danh mục.
                </div>
              }
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              (click)="deletingRoomType.set(null)"
              class="min-h-11 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              [disabled]="isSubmitting() || target.roomCount > 0"
              (click)="executeDelete()"
              class="min-h-11 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              @if (isSubmitting()) {
                <i class="pi pi-spin pi-spinner text-xs"></i>
              }
              <span>Xác nhận xóa</span>
            </button>
          </div>
        </div>
      </div>
    }

    @if (showContextSelector()) {
      <app-context-selector-dialog
        [visible]="showContextSelector()"
        (visibleChange)="showContextSelector.set($event)"
      />
    }
  `
})
export class RoomTypesPage implements OnInit, OnDestroy {
  private readonly roomTypeService = inject(RoomTypeService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  private fallbackDestroyCallbacks: Array<() => void> = [];
  private isFallbackDestroyed = false;
  private readonly destroyRef = inject(DestroyRef, { optional: true }) ?? this.createFallbackDestroyRef();

  readonly showContextSelector = signal<boolean>(false);

  openContextSelector(): void {
    this.showContextSelector.set(true);
  }

  getPropertyName(rt: RoomTypeDto): string | null {
    const extended = rt as RoomTypeWithProperty;
    if (extended.propertyName) return extended.propertyName;
    const propId = extended.propertyId;
    if (!propId) return null;
    const authSvc = this.authService as unknown as {
      memberships?: Array<{ propertyId?: string | null; propertyName?: string | null }>;
    };
    const matched = (authSvc.memberships || []).find(
      m => m.propertyId?.toLowerCase() === propId.toLowerCase()
    );
    return matched?.propertyName || null;
  }

  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');
  readonly viewMode = signal<'grid' | 'table'>('grid');

  readonly isModalOpen = signal<boolean>(false);
  readonly editingRoomType = signal<RoomTypeDto | null>(null);
  readonly deletingRoomType = signal<RoomTypeDto | null>(null);

  readonly canCreate = computed(() => this.authService.hasPermission('ROOM_TYPES', 2) || this.authService.hasPermission('ROOM_TYPES', 1));
  readonly canUpdate = computed(() => this.authService.hasPermission('ROOM_TYPES', 4) || this.authService.hasPermission('ROOM_TYPES', 1));
  readonly canDelete = computed(() => this.authService.hasPermission('ROOM_TYPES', 8) || this.authService.hasPermission('ROOM_TYPES', 1));

  readonly bedTypePresets = [
    '1 Giường Đôi King',
    '1 Giường Đôi Queen',
    '2 Giường Đơn Twin',
    '1 Đôi + 1 Đơn Family',
    'Suite Luxury King'
  ];

  readonly presetRoomImages: ReadonlyArray<PresetRoomImage> = [
    { label: 'Deluxe Rừng Thông', url: '/images/deluxe-double-pine.png' },
    { label: 'Suite Hướng Sông', url: '/images/executive-suite-river.png' },
    { label: 'Family Hướng Biển', url: '/images/family-ocean-suite.png' },
    { label: 'Penthouse Tổng Thống', url: '/images/presidential-penthouse.png' },
    { label: 'Twin Phố Cổ', url: '/images/standard-twin-heritage.png' },
    { label: 'Resort Biển', url: '/images/danang-ocean-suites.png' }
  ];

  readonly filteredRoomTypes = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.roomTypes();
    if (!q) return list;
    return list.filter(
      rt =>
        rt.name.toLowerCase().includes(q) ||
        rt.code.toLowerCase().includes(q) ||
        (rt.description && rt.description.toLowerCase().includes(q))
    );
  });

  readonly totalPhysicalRooms = computed(() =>
    this.roomTypes().reduce((sum, rt) => sum + (rt.roomCount || 0), 0)
  );

  readonly averageBasePrice = computed(() => {
    const list = this.roomTypes();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, rt) => acc + (rt.basePrice || 0), 0);
    return Math.round(sum / list.length);
  });

  readonly maxCapacity = computed(() => {
    const list = this.roomTypes();
    if (list.length === 0) return 0;
    return Math.max(...list.map(rt => rt.maxOccupancy || 2));
  });

  readonly roomTypeForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    basePrice: [800000, [Validators.required, Validators.min(10000)]],
    maxOccupancy: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
    squareMeters: [28],
    bedType: ['1 Giường Đôi King'],
    imageUrl: [''],
    description: ['']
  });

  constructor() {
    effect(() => {
      const _propId = this.authService.activePropertyId();
      untracked(() => {
        this.loadRoomTypes();
      });
    });
  }

  ngOnInit(): void {
    this.loadRoomTypes();
  }

  ngOnDestroy(): void {
    this.isFallbackDestroyed = true;
    const callbacks = this.fallbackDestroyCallbacks.splice(0);
    callbacks.forEach(cb => cb());
  }

  private createFallbackDestroyRef(): DestroyRef {
    const page = this;
    return {
      get destroyed(): boolean {
        return page.isFallbackDestroyed;
      },
      onDestroy: (callback: () => void) => {
        page.fallbackDestroyCallbacks.push(callback);
        return () => {
          page.fallbackDestroyCallbacks = page.fallbackDestroyCallbacks.filter(cb => cb !== callback);
        };
      }
    };
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deletingRoomType()) {
      this.deletingRoomType.set(null);
      return;
    }
    if (this.isModalOpen()) {
      this.closeModal();
    }
  }

  loadRoomTypes(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.roomTypeService
      .getRoomTypes(undefined, 1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.roomTypes.set(res?.items || []);
          this.loading.set(false);
          this.cdr?.markForCheck();
        },
        error: err => {
          this.loading.set(false);
          this.errorMessage.set(err?.error?.message || 'Không thể tải danh sách loại phòng. Vui lòng kiểm tra chi nhánh đang chọn.');
          this.cdr?.markForCheck();
        }
      });
  }

  openCreateModal(): void {
    if (!this.authService.activePropertyId()) {
      this.alertService.toastWarning('Vui lòng chọn chi nhánh làm việc trước khi tạo loại phòng mới.', 'Chế độ Toàn chuỗi');
      this.openContextSelector();
      return;
    }
    this.editingRoomType.set(null);
    this.roomTypeForm.reset({
      code: '',
      name: '',
      basePrice: 850000,
      maxOccupancy: 2,
      squareMeters: 30,
      bedType: '1 Giường Đôi King',
      imageUrl: '',
      description: 'Phòng tiêu chuẩn đầy đủ tiện nghi: điều hòa 2 chiều, Smart TV 55 inch, minibar, bàn làm việc và phòng tắm riêng.'
    });
    this.isModalOpen.set(true);
  }

  openEditModal(rt: RoomTypeDto): void {
    this.editingRoomType.set(rt);
    this.roomTypeForm.reset({
      code: rt.code,
      name: rt.name,
      basePrice: rt.basePrice,
      maxOccupancy: rt.maxOccupancy,
      squareMeters: rt.squareMeters ?? 30,
      bedType: rt.bedType || '1 Giường Đôi King',
      imageUrl: rt.imageUrl || '',
      description: rt.description || ''
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingRoomType.set(null);
  }

  submitRoomType(): void {
    if (this.roomTypeForm.invalid || this.isSubmitting()) return;

    const raw = this.roomTypeForm.getRawValue();
    const payload: CreateRoomTypeRequest = {
      code: String(raw.code || '').trim().toUpperCase(),
      name: String(raw.name || '').trim(),
      basePrice: Number(raw.basePrice),
      maxOccupancy: Number(raw.maxOccupancy),
      squareMeters: raw.squareMeters ? Number(raw.squareMeters) : undefined,
      bedType: raw.bedType ? String(raw.bedType).trim() : undefined,
      imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : undefined,
      description: raw.description ? String(raw.description).trim() : undefined
    };

    this.isSubmitting.set(true);
    const editing = this.editingRoomType();

    if (editing) {
      const updatePayload: UpdateRoomTypeRequest = { ...payload };
      this.roomTypeService
        .updateRoomType(editing.id, updatePayload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.closeModal();
            this.alertService.toastSuccess(`Đã cập nhật hạng phòng "${payload.name}".`, 'Thành công');
            this.loadRoomTypes();
            this.cdr?.markForCheck();
          },
          error: err => {
            this.isSubmitting.set(false);
            this.alertService.toastError(err?.error?.message || 'Không thể cập nhật loại phòng.', 'Lỗi');
            this.cdr?.markForCheck();
          }
        });
    } else {
      this.roomTypeService
        .createRoomType(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.closeModal();
            this.alertService.toastSuccess(`Đã tạo hạng phòng "${payload.name}" (${payload.code}).`, 'Thành công');
            this.loadRoomTypes();
            this.cdr?.markForCheck();
          },
          error: err => {
            this.isSubmitting.set(false);
            this.alertService.toastError(err?.error?.message || 'Không thể tạo loại phòng mới.', 'Lỗi');
            this.cdr?.markForCheck();
          }
        });
    }
  }

  confirmDelete(rt: RoomTypeDto): void {
    this.deletingRoomType.set(rt);
  }

  executeDelete(): void {
    const target = this.deletingRoomType();
    if (!target || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.roomTypeService
      .deleteRoomType(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.deletingRoomType.set(null);
          this.alertService.toastSuccess(`Đã xóa hạng phòng "${target.name}".`, 'Đã xóa');
          this.loadRoomTypes();
          this.cdr?.markForCheck();
        },
        error: err => {
          this.isSubmitting.set(false);
          this.alertService.toastError(err?.error?.message || 'Không thể xóa hạng phòng này.', 'Lỗi');
          this.cdr?.markForCheck();
        }
      });
  }

  getFallbackImage(code: string): string {
    const upper = (code || '').toUpperCase();
    if (upper.includes('SUI') || upper.includes('VIP') || upper.includes('VIL')) {
      return '/images/danang-ocean-suites.png';
    }
    if (upper.includes('DLX') || upper.includes('FAM')) {
      return '/images/saigon-riverside-tower.png';
    }
    return '/images/hanoi-old-quarter-hotel.png';
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('saigon-riverside-tower.png')) {
      img.src = '/images/saigon-riverside-tower.png';
    }
  }
}
