import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { Dialog } from 'primeng/dialog';
import { RoomService, GetRoomsFilter } from '../../core/services/room.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { RoomDto, CreateRoomRequest, UpdateRoomRequest } from '../../core/models/room.model';
import { RoomTypeDto } from '../../core/models/room-type.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { DateRangeFilterComponent, DateRangeFilterValue } from '../../shared/components/date-range-filter/date-range-filter.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonTableComponent } from '../../shared/components/skeleton-table/skeleton-table.component';
import { HttpErrorResponse } from '@angular/common/http';
import { formatBusinessDateTime } from '../../core/utils/date-time.util';

/**
 * Màn hình mẫu hoàn chỉnh: Quản lý Phòng (Rooms Catalog Reference Screen)
 * Triển khai chuẩn DELIVERY-CATALOG-01:
 * - Server-side pagination, filter, and sort (không tải toàn bộ rồi phân trang).
 * - Debounce tìm kiếm (300ms) + switchMap hủy request cũ tránh response ghi đè dữ liệu.
 * - Bộ lọc ngày dùng chung (DateRangeFilterComponent) với khoảng [start, endExclusive).
 * - Tự động quay về trang 1 khi thay đổi bất kỳ bộ lọc nào.
 * - Loading skeleton, empty state, error/retry mượt mà, không spinner vô hạn.
 * - Thông báo và xác nhận xóa bằng SweetAlert2 qua AlertService (chống double-submit, escape lỗi, reduced-motion).
 * - Xử lý chuẩn mã lỗi HTTP: 400 validation, 401 hết phiên, 403 cấm quyền, 404 không tìm thấy, 409 xung đột (trùng số phòng / đang có booking).
 */
@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    Dialog,
    DateRangeFilterComponent,
    PaginationComponent,
    EmptyStateComponent,
    SkeletonTableComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Phòng</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Mẫu Danh Mục
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi danh sách phòng vật lý, tầng lầu và trạng thái buồng phòng thời gian thực theo từng chi nhánh.
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="reloadCurrentPage()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs"
            title="Làm mới danh sách"
            aria-label="Làm mới danh sách"
          >
            <i class="pi pi-refresh" [class.animate-spin]="loading()"></i>
            <span class="hidden sm:inline">Làm mới</span>
          </button>

          @if (canCreate()) {
            <button
              type="button"
              (click)="openCreateDialog()"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs shadow-emerald-600/30"
            >
              <i class="pi pi-plus"></i>
              <span>Thêm phòng mới</span>
            </button>
          }
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Search Room Number (Debounced) -->
          <div class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              id="searchRoomInput"
              name="searchRoom"
              type="text"
              [ngModel]="searchTerm"
              (ngModelChange)="onSearchInput($event)"
              placeholder="Tìm số phòng (VD: 101)..."
              aria-label="Tìm kiếm số phòng"
              class="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          <!-- Filter by Status -->
          <div>
            <select
              id="filterStatusSelect"
              name="filterStatus"
              [ngModel]="selectedStatus"
              (ngModelChange)="onStatusChange($event)"
              aria-label="Lọc theo trạng thái buồng phòng"
              class="w-full text-xs rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            >
              @for (opt of statusFilterOptions; track opt.label) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <!-- Filter by Room Type -->
          <div>
            <select
              id="filterRoomTypeSelect"
              name="filterRoomType"
              [ngModel]="selectedRoomTypeId"
              (ngModelChange)="onRoomTypeChange($event)"
              aria-label="Lọc theo loại phòng"
              class="w-full text-xs rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            >
              @for (opt of roomTypeFilterOptions(); track opt.label) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <!-- Filter by Floor -->
          <div>
            <select
              id="filterFloorSelect"
              name="filterFloor"
              [ngModel]="selectedFloor"
              (ngModelChange)="onFloorChange($event)"
              aria-label="Lọc theo tầng"
              class="w-full text-xs rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            >
              <option [ngValue]="null">Tất cả tầng</option>
              @for (fl of floorOptions(); track fl) {
                <option [ngValue]="fl">Tầng {{ fl }}</option>
              }
            </select>
          </div>
        </div>

        <!-- Date Range Filter & Reset Row -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <app-date-range-filter
            label="Ngày tạo phòng"
            (filterChange)="onDateRangeChange($event)"
          />

          @if (hasActiveFilters()) {
            <div class="flex items-center gap-2 self-end lg:self-auto">
              <button
                type="button"
                (click)="resetAllFilters()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 font-medium transition-colors"
                aria-label="Xóa toàn bộ bộ lọc"
              >
                <i class="pi pi-filter-slash text-xs"></i>
                <span>Xóa toàn bộ lọc</span>
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Main Data Table Container -->
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <!-- Error State with Retry Button -->
        @if (loadError()) {
          <div class="py-12 px-4 text-center">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <i class="pi pi-exclamation-triangle text-xl"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">Không thể tải dữ liệu danh sách phòng</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{{ loadError() }}</p>
            <div class="mt-4">
              <button
                type="button"
                (click)="reloadCurrentPage()"
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition-colors"
                aria-label="Thử lại tải dữ liệu"
              >
                <i class="pi pi-refresh"></i>
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        } @else if (loading()) {
          <!-- Skeleton Loading (CLS Protection) -->
          <app-skeleton-table [rows]="6" />
        } @else if (displayedRooms().length === 0) {
          <!-- Empty State -->
          <app-empty-state
            iconClass="pi pi-th-large"
            title="Không tìm thấy phòng nào"
            description="Chưa có phòng nào khớp với các tiêu chí tìm kiếm hoặc chi nhánh chưa được thêm phòng."
            actionLabel="Thêm phòng mới ngay"
            actionIcon="pi pi-plus"
            (actionClick)="openCreateDialog()"
          />
        } @else {
          <!-- Responsive Table View -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('roomNumber')">
                    <div class="inline-flex items-center gap-1">
                      <span>Số phòng</span>
                      <i [class]="getSortIcon('roomNumber')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('floor')">
                    <div class="inline-flex items-center gap-1">
                      <span>Tầng</span>
                      <i [class]="getSortIcon('floor')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('roomTypeName')">
                    <div class="inline-flex items-center gap-1">
                      <span>Loại phòng</span>
                      <i [class]="getSortIcon('roomTypeName')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('basePrice')">
                    <div class="inline-flex items-center gap-1">
                      <span>Giá cơ bản</span>
                      <i [class]="getSortIcon('basePrice')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('status')">
                    <div class="inline-flex items-center gap-1">
                      <span>Trạng thái phòng</span>
                      <i [class]="getSortIcon('status')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-slate-800" (click)="setSort('createdAtUtc')">
                    <div class="inline-flex items-center gap-1">
                      <span>Ngày tạo</span>
                      <i [class]="getSortIcon('createdAtUtc')"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                @for (room of displayedRooms(); track room.id) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="py-3.5 px-4 font-mono font-bold text-sm text-slate-900">
                      {{ room.roomNumber }}
                    </td>
                    <td class="py-3.5 px-4 font-medium text-slate-600">
                      Tầng {{ room.floor }}
                    </td>
                    <td class="py-3.5 px-4">
                      <div class="font-semibold text-slate-800">{{ room.roomTypeName }}</div>
                      <div class="text-[10px] font-mono text-emerald-700">{{ room.roomTypeCode }}</div>
                    </td>
                    <td class="py-3.5 px-4 font-medium text-slate-700">
                      {{ formatCurrency(room.basePrice) }}
                    </td>
                    <td class="py-3.5 px-4">
                      <!-- Dropdown đổi nhanh trạng thái buồng phòng (PATCH) -->
                      <select
                        [value]="room.status"
                        [disabled]="!canUpdate()"
                        (change)="onQuickStatusChange(room, $event)"
                        [attr.aria-label]="'Đổi trạng thái buồng phòng ' + room.roomNumber"
                        class="text-xs font-semibold rounded-lg px-2.5 py-1 border transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs disabled:opacity-70 disabled:cursor-not-allowed"
                        [ngClass]="getStatusSelectClass(room.status)"
                      >
                        <option [value]="RoomStatus.Clean">Sạch (Sẵn sàng)</option>
                        <option [value]="RoomStatus.Dirty">Cần dọn (Bẩn)</option>
                        <option [value]="RoomStatus.Cleaning">Đang dọn dẹp</option>
                        <option [value]="RoomStatus.Occupied">Đang có khách</option>
                        <option [value]="RoomStatus.OutOfService">Bảo trì / Tạm ngưng</option>
                      </select>
                    </td>
                    <td class="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {{ formatDateTime(room.createdAtUtc) }}
                    </td>
                    <td class="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      @if (canUpdate()) {
                        <button
                          type="button"
                          (click)="openEditDialog(room)"
                          class="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Chỉnh sửa thông tin phòng"
                          [attr.aria-label]="'Chỉnh sửa thông tin phòng ' + room.roomNumber"
                        >
                          <i class="pi pi-pencil text-xs"></i>
                        </button>
                      }
                      @if (canDelete()) {
                        <button
                          type="button"
                          (click)="confirmDelete(room)"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa phòng"
                          [attr.aria-label]="'Xóa phòng ' + room.roomNumber"
                        >
                          <i class="pi pi-trash text-xs"></i>
                        </button>
                      }
                      @if (!canUpdate() && !canDelete()) {
                        <span class="text-[11px] text-slate-400 italic">Chỉ xem</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Server Pagination Component -->
          <app-pagination
            [page]="currentPage()"
            [pageSize]="currentPageSize()"
            [totalCount]="totalCount()"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        }
      </div>
    </div>

    <!-- Dialog Thêm mới / Chỉnh sửa phòng -->
    <p-dialog
      [header]="dialogMode === 'create' ? 'Thêm phòng mới' : 'Chỉnh sửa phòng'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      closeAriaLabel="Đóng hộp thoại"
      [style]="{ width: '480px', maxWidth: '95vw', maxHeight: '90vh' }"
      [contentStyle]="{ maxHeight: '75vh', overflow: 'auto' }"
    >
      <form [formGroup]="roomForm" (ngSubmit)="saveRoom()" class="space-y-4 pt-2 text-xs">
        @if (conflictError()) {
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
            <i class="pi pi-exclamation-circle text-rose-500 mt-0.5"></i>
            <span class="font-medium">{{ conflictError() }}</span>
          </div>
        }

        <!-- Room Number -->
        <div class="space-y-1">
          <label for="roomNumberInput" class="block font-medium text-slate-700">Số phòng <span class="text-rose-500">*</span></label>
          <input
            id="roomNumberInput"
            name="roomNumber"
            type="text"
            formControlName="roomNumber"
            placeholder="VD: 101, 102, 201..."
            class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          @if (roomForm.get('roomNumber')?.touched && roomForm.get('roomNumber')?.invalid) {
            <p class="text-[11px] text-rose-600">Số phòng là bắt buộc (tối đa 20 ký tự).</p>
          }
        </div>

        <!-- Floor & Room Type Row -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label for="floorInput" class="block font-medium text-slate-700">Tầng <span class="text-rose-500">*</span></label>
            <input
              id="floorInput"
              name="floor"
              type="number"
              formControlName="floor"
              min="1"
              max="150"
              placeholder="VD: 1, 2..."
              class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            @if (roomForm.get('floor')?.touched && roomForm.get('floor')?.invalid) {
              <p class="text-[11px] text-rose-600">Tầng phải $\ge 1$.</p>
            }
          </div>

          <div class="space-y-1">
            <label for="roomTypeIdSelect" class="block font-medium text-slate-700">Loại phòng <span class="text-rose-500">*</span></label>
            <select
              id="roomTypeIdSelect"
              name="roomTypeId"
              formControlName="roomTypeId"
              class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="" disabled>-- Chọn loại phòng --</option>
              @for (rt of roomTypes(); track rt.id) {
                <option [value]="rt.id">{{ rt.name }} ({{ rt.code }})</option>
              }
            </select>
            @if (roomForm.get('roomTypeId')?.touched && roomForm.get('roomTypeId')?.invalid) {
              <p class="text-[11px] text-rose-600">Loại phòng là bắt buộc.</p>
            }
          </div>
        </div>

        <!-- Initial Status (Chỉ khi tạo mới) -->
        @if (dialogMode === 'create') {
          <div class="space-y-1">
            <label for="statusSelect" class="block font-medium text-slate-700">Trạng thái khởi tạo</label>
            <select
              id="statusSelect"
              name="status"
              formControlName="status"
              class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option [value]="RoomStatus.Clean">Sạch (Sẵn sàng đón khách)</option>
              <option [value]="RoomStatus.Dirty">Cần dọn dẹp</option>
              <option [value]="RoomStatus.Cleaning">Đang dọn dẹp</option>
              <option [value]="RoomStatus.OutOfService">Bảo trì / Ngừng phục vụ</option>
            </select>
          </div>
        }

        <!-- Notes -->
        <div class="space-y-1">
          <label for="notesInput" class="block font-medium text-slate-700">Ghi chú phòng (Tùy chọn)</label>
          <textarea
            id="notesInput"
            name="notes"
            formControlName="notes"
            rows="3"
            placeholder="VD: Phòng góc nhìn ra biển, cần kiểm tra điều hòa..."
            class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            (click)="dialogVisible = false"
            [disabled]="isSubmitting()"
            class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            [disabled]="roomForm.invalid || isSubmitting()"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-2xs"
          >
            @if (isSubmitting()) {
              <i class="pi pi-spinner animate-spin"></i>
            }
            <span>{{ dialogMode === 'create' ? 'Tạo phòng' : 'Lưu thay đổi' }}</span>
          </button>
        </div>
      </form>
    </p-dialog>
  `
})
export class RoomsPage implements OnInit, OnDestroy {
  private readonly roomService = inject(RoomService);
  private readonly roomTypeService = inject(RoomTypeService);
  private readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly RoomStatus = RoomStatus;

  // Permissions
  canCreate = computed(() => this.authService.hasPermission('ROOMS', 2));
  canUpdate = computed(() => this.authService.hasPermission('ROOMS', 4));
  canDelete = computed(() => this.authService.hasPermission('ROOMS', 8));

  // Filter state variables
  searchTerm: string = '';
  selectedStatus: string = '';
  selectedRoomTypeId: string = '';
  selectedFloor: number | null = null;
  selectedDateRange: DateRangeFilterValue | null = null;

  // Pagination & Loading Signals
  rooms = signal<RoomDto[]>([]);
  roomTypes = signal<RoomTypeDto[]>([]);
  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  currentPageSize = signal<number>(20);
  loading = signal<boolean>(false);
  loadError = signal<string | null>(null);
  isSubmitting = signal<boolean>(false);
  isDeleting = signal<boolean>(false);
  conflictError = signal<string | null>(null);

  // Sorting Signals
  sortField = signal<keyof RoomDto>('roomNumber');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Debounced search trigger subject
  private readonly filterChange$ = new Subject<void>();
  private filterSub?: Subscription;

  // Dialog State
  dialogVisible: boolean = false;
  dialogMode: 'create' | 'edit' = 'create';
  editingRoomId: string | null = null;

  readonly roomForm = this.fb.group({
    roomNumber: ['', [Validators.required, Validators.maxLength(20)]],
    floor: [1, [Validators.required, Validators.min(1), Validators.max(150)]],
    roomTypeId: ['', [Validators.required]],
    status: [RoomStatus.Clean],
    notes: ['']
  });

  readonly statusFilterOptions = [
    { label: 'Tất cả trạng thái', value: '' },
    { label: 'Sạch (Sẵn sàng)', value: RoomStatus.Clean },
    { label: 'Cần dọn (Bẩn)', value: RoomStatus.Dirty },
    { label: 'Đang dọn dẹp', value: RoomStatus.Cleaning },
    { label: 'Đang có khách', value: RoomStatus.Occupied },
    { label: 'Bảo trì / Tạm ngưng', value: RoomStatus.OutOfService }
  ];

  readonly roomTypeFilterOptions = computed(() => [
    { label: 'Tất cả loại phòng', value: '' },
    ...this.roomTypes().map(rt => ({ label: `${rt.name} (${rt.code})`, value: rt.id }))
  ]);

  readonly floorOptions = computed(() => {
    const floors = new Set<number>();
    for (const r of this.rooms()) {
      floors.add(r.floor);
    }
    return Array.from(floors).sort((a, b) => a - b);
  });

  // Client-side sorted view based on current sort signals
  readonly displayedRooms = computed(() => {
    const list = [...this.rooms()];
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      let valA: any = a[field];
      let valB: any = b[field];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      // Tie-breaker: Room Number and ID
      return a.roomNumber.localeCompare(b.roomNumber);
    });
  });

  ngOnInit(): void {
    this.setupDebouncedSearch();
    this.loadRoomTypes();
    this.triggerSearch();
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
  }

  private setupDebouncedSearch(): void {
    this.filterSub = this.filterChange$.pipe(
      debounceTime(250),
      tap(() => {
        this.loading.set(true);
        this.loadError.set(null);
      }),
      switchMap(() => {
        const filter: GetRoomsFilter = {
          search: this.searchTerm || undefined,
          status: this.selectedStatus || undefined,
          roomTypeId: this.selectedRoomTypeId || undefined,
          floor: this.selectedFloor !== null ? this.selectedFloor : undefined,
          createdFromUtc: this.selectedDateRange?.startUtc || undefined,
          createdToUtc: this.selectedDateRange?.endExclusiveUtc || undefined,
          page: this.currentPage(),
          pageSize: this.currentPageSize()
        };

        return this.roomService.getRooms(filter).pipe(
          catchError((err: HttpErrorResponse) => {
            this.loading.set(false);
            this.loadError.set('Lỗi kết nối máy chủ hoặc chưa chọn chi nhánh.');
            this.alertService.toastError('Không thể tải danh sách phòng.');
            // Trả về of(null) bên trong switchMap để stream filterChange$ không bị terminate
            return of(null);
          })
        );
      })
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res) {
          this.rooms.set(res.items || []);
          this.totalCount.set(res.totalCount);
        }
      }
    });
  }

  private triggerSearch(): void {
    this.filterChange$.next();
  }

  reloadCurrentPage(): void {
    this.triggerSearch();
  }

  private loadRoomTypes(): void {
    this.roomTypeService.getRoomTypes().subscribe({
      next: (res) => this.roomTypes.set(res.items || []),
      error: () => {}
    });
  }

  // Filter change handlers (Tất cả đều reset về trang 1)
  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  onRoomTypeChange(value: string): void {
    this.selectedRoomTypeId = value;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  onFloorChange(value: number | null): void {
    this.selectedFloor = value;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  onDateRangeChange(range: DateRangeFilterValue | null): void {
    this.selectedDateRange = range;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  hasActiveFilters(): boolean {
    return !!this.searchTerm || !!this.selectedStatus || !!this.selectedRoomTypeId || this.selectedFloor !== null || !!this.selectedDateRange;
  }

  resetAllFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedRoomTypeId = '';
    this.selectedFloor = null;
    this.selectedDateRange = null;
    this.currentPage.set(1);
    this.triggerSearch();
  }

  // Pagination handlers
  onPageChange(newPage: number): void {
    this.currentPage.set(newPage);
    this.triggerSearch();
  }

  onPageSizeChange(newSize: number): void {
    this.currentPageSize.set(newSize);
    this.currentPage.set(1);
    this.triggerSearch();
  }

  // Sorting
  setSort(field: keyof RoomDto): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: keyof RoomDto): string {
    if (this.sortField() !== field) return 'pi pi-sort-alt text-[10px] text-slate-300';
    return this.sortDirection() === 'asc' ? 'pi pi-sort-amount-up text-[10px] text-emerald-600' : 'pi pi-sort-amount-down text-[10px] text-emerald-600';
  }

  // Quick Status Change with Optimistic UI & SweetAlert2 Error Handling
  onQuickStatusChange(room: RoomDto, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newStatus = target.value as RoomStatus;
    const oldStatus = room.status as RoomStatus;

    if (newStatus === oldStatus) return;

    this.roomService.updateRoomStatus(room.id, newStatus, oldStatus).subscribe({
      next: (updated) => {
        this.rooms.update(list => list.map(r => r.id === room.id ? { ...r, status: newStatus } : r));
        this.alertService.toastSuccess(`Đã chuyển phòng ${room.roomNumber} sang ${ROOM_STATUS_LABELS[newStatus] || newStatus}`);
      },
      error: (err: HttpErrorResponse) => {
        // Rollback select value
        target.value = oldStatus;
        if (err.status === 409) {
          this.alertService.toastWarning('Trạng thái phòng đã bị thay đổi bởi người khác. Vui lòng làm mới danh sách.');
          this.reloadCurrentPage();
        } else if (err.status === 403) {
          this.alertService.toastError('Bạn không có quyền cập nhật trạng thái phòng này.');
        } else {
          this.alertService.toastError('Không thể cập nhật trạng thái phòng.');
        }
      }
    });
  }

  // CRUD Dialog Handlers
  openCreateDialog(): void {
    this.dialogMode = 'create';
    this.editingRoomId = null;
    this.conflictError.set(null);
    this.roomForm.reset({
      roomNumber: '',
      floor: 1,
      roomTypeId: this.roomTypes()[0]?.id || '',
      status: RoomStatus.Clean,
      notes: ''
    });
    this.dialogVisible = true;
  }

  openEditDialog(room: RoomDto): void {
    this.dialogMode = 'edit';
    this.editingRoomId = room.id;
    this.conflictError.set(null);
    this.roomForm.patchValue({
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeId: room.roomTypeId,
      status: room.status as RoomStatus,
      notes: room.notes || ''
    });
    this.dialogVisible = true;
  }

  saveRoom(): void {
    if (this.roomForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.conflictError.set(null);
    const formVal = this.roomForm.value;

    if (this.dialogMode === 'create') {
      const payload: CreateRoomRequest = {
        roomNumber: formVal.roomNumber!.trim(),
        floor: Number(formVal.floor),
        roomTypeId: formVal.roomTypeId!,
        notes: formVal.notes ? formVal.notes.trim() : undefined
      };

      this.roomService.createRoom(payload).subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          this.dialogVisible = false;
          this.alertService.toastSuccess(`Đã tạo thành công phòng ${created.roomNumber}`);
          this.reloadCurrentPage();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 409) {
            this.conflictError.set(`Số phòng "${payload.roomNumber}" đã tồn tại trên chi nhánh này.`);
          } else if (err.status === 403) {
            this.alertService.toastError('Bạn không có quyền tạo phòng trên chi nhánh này.');
          } else {
            this.conflictError.set('Đã có lỗi xảy ra khi tạo phòng. Vui lòng kiểm tra lại thông tin.');
          }
        }
      });
    } else if (this.dialogMode === 'edit' && this.editingRoomId) {
      const payload: UpdateRoomRequest = {
        roomNumber: formVal.roomNumber!.trim(),
        floor: Number(formVal.floor),
        roomTypeId: formVal.roomTypeId!,
        notes: formVal.notes ? formVal.notes.trim() : undefined,
        isActive: true
      };

      this.roomService.updateRoom(this.editingRoomId, payload).subscribe({
        next: (updated) => {
          this.isSubmitting.set(false);
          this.dialogVisible = false;
          this.alertService.toastSuccess(`Đã cập nhật thành công phòng ${updated.roomNumber}`);
          this.reloadCurrentPage();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 409) {
            this.conflictError.set(`Số phòng "${payload.roomNumber}" đã tồn tại trên chi nhánh này.`);
          } else {
            this.conflictError.set('Đã có lỗi xảy ra khi cập nhật phòng.');
          }
        }
      });
    }
  }

  // Delete with SweetAlert2 Confirmation & 409 Conflict Handling
  async confirmDelete(room: RoomDto): Promise<void> {
    if (this.isDeleting()) return;

    const confirmed = await this.alertService.confirmDelete({
      title: 'Xác nhận xóa phòng?',
      text: `Bạn có chắc chắn muốn xóa phòng ${room.roomNumber} (Tầng ${room.floor})? Thao tác này sẽ xóa vĩnh viễn khỏi chi nhánh.`
    });

    if (!confirmed) return;

    this.isDeleting.set(true);
    this.roomService.deleteRoom(room.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.alertService.toastSuccess(`Đã xóa thành công phòng ${room.roomNumber}`);
        this.reloadCurrentPage();
      },
      error: (err: HttpErrorResponse) => {
        this.isDeleting.set(false);
        if (err.status === 409) {
          this.alertService.toastError('Không thể xóa phòng: Phòng đang có đặt phòng hoặc ràng buộc dữ liệu.');
        } else if (err.status === 403) {
          this.alertService.toastError('Bạn không có quyền thực hiện thao tác xóa phòng.');
        } else {
          this.alertService.toastError('Đã có lỗi xảy ra khi xóa phòng.');
        }
      }
    });
  }

  // Helpers
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  formatDateTime(iso: string): string {
    return formatBusinessDateTime(iso);
  }

  getStatusSelectClass(status: string): string {
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
        return 'bg-white text-slate-700 border-slate-200';
    }
  }
}
