import { Component, inject, signal, effect, computed, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';
import { RoomService } from '../../core/services/room.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { CommonModule } from '@angular/common';

/**
 * Trang Dashboard tổng quan hệ thống Hotel SaaS.
 * NGUYÊN TẮC QUAN TRỌNG:
 * - Chỉ hiển thị số liệu THẬT lấy từ API Backend (GET /api/rooms).
 * - Tuyệt đối không bịa số mock cho các API chưa hoàn thành (Đặt phòng, Doanh thu).
 * - Các chỉ số chưa có API được gắn nhãn rõ ràng: "Chưa hỗ trợ (Đang phát triển)".
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Button
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Welcome Header Banner -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Chi nhánh: {{ authService.activePropertyCode() || 'Chưa chọn' }}
            </span>
            <span class="text-xs text-slate-400">&bull;</span>
            <span class="text-xs text-slate-500 font-medium">
              {{ authService.activePropertyName() || 'Tất cả chi nhánh' }}
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-1.5 tracking-tight">
            Xin chào, {{ currentUser()?.fullName || 'Nhân viên' }}!
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Bảng theo dõi trạng thái phòng và vận hành thời gian thực tại chi nhánh.
          </p>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          @if (canManageRooms()) {
            <a routerLink="/rooms">
              <p-button
                label="Quản lý phòng"
                icon="pi pi-th-large"
                styleClass="p-button-success"
              />
            </a>
          }
          @if (canManageRoomTypes()) {
            <a routerLink="/room-types">
              <p-button
                label="Loại phòng"
                icon="pi pi-tags"
                [outlined]="true"
                severity="secondary"
              />
            </a>
          }
        </div>
      </div>

      <!-- Error Banner -->
      @if (error()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0"></i>
            <span>{{ error() }}</span>
          </div>
          <button
            type="button"
            (click)="loadRoomsData()"
            class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
          >
            Thử lại
          </button>
        </div>
      }

      <!-- Real Metrics Grid (Dữ liệu thật từ GET /api/rooms) -->
      <!-- Scope Disclosure Note -->
      <div class="flex items-center justify-between p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs text-slate-600">
        <div class="flex items-center gap-2">
          <i class="pi pi-info-circle text-emerald-600"></i>
          <span>
            <strong>Phạm vi dữ liệu:</strong> Tổng số phòng tính toàn chi nhánh. Trạng thái buồng phòng tính trên mẫu <strong>{{ rooms().length }} phòng</strong> hiển thị (chưa có API aggregate trạng thái toàn chi nhánh).
          </span>
        </div>
        <span class="text-[11px] font-mono text-slate-400 hidden sm:inline">Mẫu trang 1 (tối đa 100 phòng)</span>
      </div>

      <!-- Real Metrics Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1: Tổng số phòng (Dữ liệu thật từ backend CountAsync) -->
        <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số phòng</span>
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <i class="pi pi-building text-lg"></i>
            </div>
          </div>
          <div class="mt-3">
            @if (loading()) {
              <div class="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            } @else {
              <div class="text-3xl font-extrabold text-slate-800 tracking-tight">{{ totalRooms() }}</div>
              <div class="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Toàn bộ chi nhánh</span>
              </div>
            }
          </div>
        </div>

        <!-- Card 2: Phòng sẵn sàng / Sạch (Trong mẫu hiển thị) -->
        <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phòng sạch (Sẵn sàng)</span>
            <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <i class="pi pi-check-circle text-lg"></i>
            </div>
          </div>
          <div class="mt-3">
            @if (loading()) {
              <div class="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            } @else {
              <div class="text-3xl font-extrabold text-teal-700 tracking-tight">{{ cleanRooms() }}</div>
              <div class="mt-1.5 text-xs text-slate-500">
                Trong mẫu {{ rooms().length }} phòng hiển thị
              </div>
            }
          </div>
        </div>

        <!-- Card 3: Phòng bẩn / Đang dọn (Trong mẫu hiển thị) -->
        <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cần dọn / Đang dọn</span>
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <i class="pi pi-sparkles text-lg"></i>
            </div>
          </div>
          <div class="mt-3">
            @if (loading()) {
              <div class="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            } @else {
              <div class="text-3xl font-extrabold text-amber-600 tracking-tight">{{ dirtyRooms() + cleaningRooms() }}</div>
              <div class="mt-1.5 text-xs text-slate-500">
                {{ dirtyRooms() }} cần dọn &bull; {{ cleaningRooms() }} đang dọn
              </div>
            }
          </div>
        </div>

        <!-- Card 4: Bảo trì / Ngừng phục vụ (Trong mẫu hiển thị) -->
        <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bảo trì / Ngừng dùng</span>
            <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
              <i class="pi pi-wrench text-lg"></i>
            </div>
          </div>
          <div class="mt-3">
            @if (loading()) {
              <div class="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            } @else {
              <div class="text-3xl font-extrabold text-slate-700 tracking-tight">{{ oosRooms() }}</div>
              <div class="mt-1.5 text-xs text-slate-500">
                Trong mẫu {{ rooms().length }} phòng hiển thị
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Real Rooms Overview Table & Missing Feature Disclosures -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: Real Rooms Snapshot (2 cols) -->
        <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-base font-bold text-slate-800">Hiện trạng phòng chi nhánh</h2>
              <p class="text-xs text-slate-500 mt-0.5">Danh sách phòng thực tế từ cơ sở dữ liệu</p>
            </div>
            <a routerLink="/rooms" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1">
              <span>Xem tất cả</span>
              <i class="pi pi-arrow-right text-[10px]"></i>
            </a>
          </div>

          @if (loading()) {
            <div class="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <i class="pi pi-spin pi-spinner text-2xl text-emerald-600"></i>
              <span class="text-xs">Đang tải danh sách phòng...</span>
            </div>
          } @else if (rooms().length === 0) {
            <div class="py-12 text-center text-slate-400">
              <i class="pi pi-building text-3xl text-slate-300 mb-2"></i>
              <p class="text-sm font-medium text-slate-600">Chi nhánh này chưa có phòng nào.</p>
              <p class="text-xs text-slate-400 mt-1">Hãy thêm loại phòng và phòng mới để bắt đầu quản lý.</p>
              <div class="mt-4">
                <a routerLink="/rooms">
                  <p-button label="Thêm phòng ngay" icon="pi pi-plus" size="small" styleClass="p-button-success" />
                </a>
              </div>
            </div>
          } @else {
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              @for (r of rooms(); track r.id) {
                <div class="p-3 rounded-xl border border-slate-200/80 transition-colors bg-[#fbfbfa]">
                  <div class="flex items-center justify-between">
                    <span class="text-base font-bold text-slate-800">Phòng {{ r.roomNumber }}</span>
                    <span class="text-[11px] text-slate-400 font-medium">T{{ r.floor }}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 truncate font-medium">
                    {{ r.roomTypeName }}
                  </div>
                  <div class="mt-2.5">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
                      [ngClass]="getStatusBadgeClass(r.status)"
                    >
                      {{ getStatusLabel(r.status) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Right: Honest Backend Status Disclosure Cards (1 col) -->
        <div class="space-y-4">
          <!-- Pending Feature: Đặt phòng -->
          <div class="bg-amber-50/60 rounded-2xl border border-amber-200/80 p-5">
            <div class="flex items-center gap-2.5 text-amber-800 font-semibold text-sm">
              <i class="pi pi-info-circle text-base text-amber-600"></i>
              <span>Đặt phòng hôm nay (Đang phát triển)</span>
            </div>
            <div class="mt-2.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/70 text-amber-900 mb-2">
                Chưa hỗ trợ - Cần API
              </span>
              <p class="text-xs text-amber-900/80 leading-relaxed">
                Backend hiện tại chưa cung cấp endpoint báo cáo đặt phòng theo chi nhánh (thuộc phạm vi giai đoạn phát triển tiếp theo). Giao diện không bịa số giả.
              </p>
            </div>
          </div>

          <!-- Pending Feature: Báo cáo Doanh thu -->
          <div class="bg-purple-50/60 rounded-2xl border border-purple-200/80 p-5">
            <div class="flex items-center gap-2.5 text-purple-800 font-semibold text-sm">
              <i class="pi pi-chart-line text-base text-purple-600"></i>
              <span>Doanh thu tháng (Đang phát triển)</span>
            </div>
            <div class="mt-2.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-200/70 text-purple-900 mb-2">
                Chưa hỗ trợ - Cần API
              </span>
              <p class="text-xs text-purple-900/80 leading-relaxed">
                Backend hiện chưa có API tổng hợp doanh thu thực tế. Sẽ được kết nối khi hoàn thiện module Thanh toán & Hóa đơn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardPage {
  readonly authService = inject(AuthService);
  private readonly roomService = inject(RoomService);

  /** D-2: Convert Observable to Signal for consistent reactive paradigm */
  readonly currentUser = toSignal(inject(AuthService).currentUser$);

  /** D-6: RBAC-gated quick actions */
  readonly canManageRooms = computed(() => this.authService.hasPermission('ROOMS', 1));
  readonly canManageRoomTypes = computed(() => this.authService.hasPermission('ROOM_TYPES', 1));

  loading = signal(true);
  /** D-1: Error signal for user-visible error feedback */
  error = signal<string | null>(null);
  rooms = signal<RoomDto[]>([]);
  totalRooms = signal(0);
  cleanRooms = signal(0);
  dirtyRooms = signal(0);
  cleaningRooms = signal(0);
  oosRooms = signal(0);

  constructor() {
    /** D-4: Context reactivity — reload when active property changes */
    effect(() => {
      const propId = this.authService.activePropertyId();
      untracked(() => {
        this.loadRoomsData();
      });
    });
  }

  loadRoomsData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.roomService.getRooms({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => {
        this.loading.set(false);
        const items = res.items || [];
        this.rooms.set(items);
        this.totalRooms.set(res.totalCount ?? items.length);

        this.cleanRooms.set(items.filter(r => r.status === RoomStatus.Clean).length);
        this.dirtyRooms.set(items.filter(r => r.status === RoomStatus.Dirty).length);
        this.cleaningRooms.set(items.filter(r => r.status === RoomStatus.Cleaning).length);
        this.oosRooms.set(items.filter(r => r.status === RoomStatus.OutOfService).length);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Không thể tải dữ liệu phòng. Vui lòng thử lại.');
      }
    });
  }

  getStatusLabel(status: RoomStatus): string {
    return ROOM_STATUS_LABELS[status] || status;
  }

  getStatusBadgeClass(status: RoomStatus): string {
    switch (status) {
      case RoomStatus.Clean:
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case RoomStatus.Dirty:
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      case RoomStatus.Cleaning:
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case RoomStatus.Occupied:
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case RoomStatus.OutOfService:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}

