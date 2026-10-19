import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { RoomService, GetRoomsFilter, RoomSyncStatus } from '../../core/services/room.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { HttpErrorResponse } from '@angular/common/http';
import { SkeletonTableComponent } from '../../shared/components/skeleton-table/skeleton-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

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
  imports: [
    CommonModule,
    FormsModule,
    SkeletonTableComponent,
    EmptyStateComponent,
    PaginationComponent
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
            (click)="loadRooms()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="Làm mới bảng buồng phòng"
            aria-label="Làm mới bảng buồng phòng"
          >
            <i class="pi pi-refresh" [class.animate-spin]="loading()"></i>
            <span class="hidden sm:inline">Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

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
    </div>
  `
})
export class HousekeepingPage implements OnInit, OnDestroy {
  private readonly roomService = inject(RoomService);
  private readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);

  readonly RoomStatus = RoomStatus;

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

  // Permission
  canUpdate = computed(() => {
    return this.authService.hasPermission('HOUSEKEEPING', 4) ||
           this.authService.hasPermission('HOUSEKEEPING', 2) ||
           this.authService.hasPermission('ROOMS', 4);
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
          this.currentPage.set(1);
          this.rooms.set([]);
          this.totalCount.set(0);
          this.loadRooms();
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
  }

  startAutoSync(intervalMs = 10000): void {
    this.stopAutoSync();
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
