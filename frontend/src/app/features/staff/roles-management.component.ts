import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StaffService } from '../../core/services/staff.service';
import { AlertService } from '../../core/services/alert.service';
import { LoadingOverlayService } from '../../core/services/loading-overlay.service';
import {
  PermissionFunctionDto,
  RoleDetailDto,
  RolePermissionDto,
  RolePermissionInput,
  CreateRoleRequest,
  UpdateRoleRequest
} from '../../core/models/staff.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PermissionsMatrixComponent } from './permissions-matrix.component';
import {
  RoleScopeFilter,
  RoleStatusFilter,
  RolePermissionLevelFilter,
  PermissionMatrixRow,
  formatCrudBadge,
  countActivePermissions,
  filterRoles,
  isRoleActive,
  normalizeRoleCode,
  getVietnameseFunctionName,
  calculateRowMaskScore
} from './roles-management.utils';

type RoleSortField = 'name' | 'staffCount';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, A11yModule, EmptyStateComponent, PermissionsMatrixComponent],
  template: `
    <div class="space-y-5" data-testid="roles-management-root">
      <!-- Standalone Header -->
      @if (showHeader()) {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-700">
          <div>
            <div class="flex items-center flex-wrap gap-2.5">
              <h1 class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Quản lý Vai trò &amp; Phân quyền (Roles Management)
              </h1>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap">
                Phân quyền RBAC
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Danh sách các chức vụ trong hệ thống, mô tả phạm vi trách nhiệm và cấu hình ma trận quyền Xem, Thêm, Sửa, Xóa (CRUD).
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              (click)="loadRolesAndFunctions()"
              class="min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              aria-label="Làm mới danh sách vai trò"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()" aria-hidden="true"></i>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              (click)="openCreateRoleModal()"
              class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <i class="pi pi-plus-circle text-xs" aria-hidden="true"></i>
              <span>Tạo chức vụ mới</span>
            </button>
          </div>
        </div>
      }

      <!-- KPI Summary Strip -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng số vai trò</div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">{{ roles().length }}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Đang áp dụng trên hệ thống</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <i class="pi pi-shield text-base" aria-hidden="true"></i>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vai trò mặc định</div>
            <div class="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 mt-0.5 tabular-nums">{{ systemRolesCount() }}</div>
            <div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Chuẩn hóa vận hành khách sạn</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <i class="pi pi-verified text-base" aria-hidden="true"></i>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vai trò tùy biến (Tenant)</div>
            <div class="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 mt-0.5 tabular-nums">{{ customRolesCount() }}</div>
            <div class="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">Cho phép tùy chỉnh ma trận CRUD</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
            <i class="pi pi-sliders-h text-base" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- Search Bar & Filter Dropdowns Toolbar -->
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs space-y-3.5" data-testid="roles-filter-toolbar">
        <!-- Row 1: Search Input + 3 Filter Dropdowns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <!-- 1. Search Bar by Name, Code, or Description -->
          <div class="relative sm:col-span-2 lg:col-span-4">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" aria-hidden="true"></i>
            <input
              type="text"
              data-testid="roles-search-input"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm theo tên vai trò, mã hoặc mô tả..."
              aria-label="Tìm kiếm vai trò"
              class="w-full min-h-11 pl-9 pr-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                class="min-w-11 min-h-11 inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <i class="pi pi-times text-xs" aria-hidden="true"></i>
              </button>
            }
          </div>

          <!-- 2. Status Filter Dropdown (Trạng thái vai trò) -->
          <div class="relative lg:col-span-3">
            <i class="pi pi-check-circle absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs pointer-events-none" aria-hidden="true"></i>
            <select
              data-testid="roles-status-filter"
              [ngModel]="statusFilter()"
              (ngModelChange)="statusFilter.set($event)"
              aria-label="Lọc theo trạng thái vai trò"
              class="w-full min-h-11 pl-8 pr-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Trạng thái: Tất cả ({{ roles().length }})</option>
              <option value="ACTIVE">Đang hoạt động ({{ activeRolesCount() }})</option>
              <option value="INACTIVE">Tạm ngưng ({{ inactiveRolesCount() }})</option>
              <option value="ASSIGNED">Đã gán nhân sự ({{ assignedRolesCount() }})</option>
              <option value="UNASSIGNED">Chưa gán nhân sự ({{ unassignedRolesCount() }})</option>
            </select>
          </div>

          <!-- 3. Role Scope / Type Filter Dropdown (Phân loại vai trò) -->
          <div class="relative lg:col-span-3">
            <i class="pi pi-filter absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 text-xs pointer-events-none" aria-hidden="true"></i>
            <select
              data-testid="roles-scope-filter"
              [ngModel]="scopeFilter()"
              (ngModelChange)="scopeFilter.set($event)"
              aria-label="Lọc theo phân loại vai trò"
              class="w-full min-h-11 pl-8 pr-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Phân loại: Tất cả ({{ roles().length }})</option>
              <option value="SYSTEM">Vai trò Hệ thống ({{ systemRolesCount() }})</option>
              <option value="CUSTOM">Vai trò Tùy biến ({{ customRolesCount() }})</option>
            </select>
          </div>

          <!-- 4. Permission Coverage Level Filter Dropdown (Mức độ phân quyền) -->
          <div class="relative sm:col-span-2 lg:col-span-2">
            <i class="pi pi-shield absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-xs pointer-events-none" aria-hidden="true"></i>
            <select
              data-testid="roles-permission-filter"
              [ngModel]="permissionLevelFilter()"
              (ngModelChange)="permissionLevelFilter.set($event)"
              aria-label="Lọc theo mức độ cấp quyền"
              class="w-full min-h-11 pl-8 pr-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Mức quyền: Tất cả</option>
              <option value="FULL_ACCESS">Toàn quyền quản trị</option>
              <option value="OPERATIONAL">Quyền nghiệp vụ</option>
              <option value="LIMITED">Quyền tác vụ / Giới hạn</option>
            </select>
          </div>
        </div>

        <!-- Row 2: Quick Status Chips + Reset Filters + View Mode Switcher -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div class="flex items-center flex-wrap gap-1.5">
            <span class="font-semibold text-slate-600 dark:text-slate-300 mr-0.5">Nhanh theo trạng thái:</span>
            <button
              type="button"
              (click)="statusFilter.set('ALL')"
              class="min-h-11 px-3 py-2 rounded-md font-semibold transition-colors cursor-pointer border tabular-nums"
              [ngClass]="statusFilter() === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'"
            >
              Tất cả ({{ roles().length }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('ACTIVE')"
              class="min-h-11 px-3 py-2 rounded-md font-semibold transition-colors cursor-pointer border tabular-nums"
              [ngClass]="statusFilter() === 'ACTIVE' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/70'"
            >
              Đang hoạt động ({{ activeRolesCount() }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('INACTIVE')"
              class="min-h-11 px-3 py-2 rounded-md font-semibold transition-colors cursor-pointer border tabular-nums"
              [ngClass]="statusFilter() === 'INACTIVE' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100/70'"
            >
              Tạm ngưng ({{ inactiveRolesCount() }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('ASSIGNED')"
              class="min-h-11 px-3 py-2 rounded-md font-semibold transition-colors cursor-pointer border tabular-nums"
              [ngClass]="statusFilter() === 'ASSIGNED' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100/70'"
            >
              Có nhân sự ({{ assignedRolesCount() }})
            </button>

            @if (hasActiveFilters()) {
              <button
                type="button"
                data-testid="roles-reset-filters"
                (click)="resetFilters()"
                class="min-h-11 inline-flex items-center gap-1 px-3 py-2 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer ml-1"
              >
                <i class="pi pi-filter-slash text-[10px]" aria-hidden="true"></i>
                <span>Xóa bộ lọc</span>
              </button>
            }
          </div>

          <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
            <span class="text-slate-500 dark:text-slate-400 tabular-nums">
              Tìm thấy <strong class="text-slate-800 dark:text-slate-100">{{ filteredRoles().length }}</strong> / {{ roles().length }} vai trò
            </span>

            <!-- View Mode Switcher -->
            <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                (click)="viewMode.set('table')"
                class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'table' ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
                aria-label="Chế độ bảng dữ liệu"
              >
                <i class="pi pi-table text-xs" aria-hidden="true"></i>
                <span>Bảng dữ liệu</span>
              </button>
              <button
                type="button"
                (click)="switchToInlineMatrixView()"
                class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'matrix' ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
                aria-label="Chế độ ma trận phân quyền CRUD"
              >
                <i class="pi pi-sliders-h text-xs" aria-hidden="true"></i>
                <span>Ma trận quyền CRUD</span>
              </button>
              <button
                type="button"
                (click)="viewMode.set('cards')"
                class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'cards' ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
                aria-label="Chế độ thẻ lưới"
              >
                <i class="pi pi-th-large text-xs" aria-hidden="true"></i>
                <span>Thẻ lưới</span>
              </button>
            </div>

            @if (!showHeader()) {
              <button
                type="button"
                (click)="openCreateRoleModal()"
                class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <i class="pi pi-plus-circle text-xs" aria-hidden="true"></i>
                <span>Tạo chức vụ mới</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Loading / Empty / Data Views -->
      @if (loading()) {
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-10 text-center text-slate-400 space-y-2 shadow-2xs">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-600" aria-hidden="true"></i>
          <div class="text-xs font-medium">Đang tải danh sách vai trò và ma trận phân quyền...</div>
        </div>
      } @else if (filteredRoles().length === 0) {
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-2xs space-y-3 text-center">
          <app-empty-state
            iconClass="pi pi-shield"
            title="Không tìm thấy vai trò phù hợp"
            description="Không có chức vụ nào khớp với từ khóa hoặc bộ lọc trạng thái hiện tại."
          ></app-empty-state>
          @if (hasActiveFilters()) {
            <div>
              <button
                type="button"
                (click)="resetFilters()"
                class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <i class="pi pi-filter-slash text-xs" aria-hidden="true"></i>
                <span>Đặt lại toàn bộ bộ lọc</span>
              </button>
            </div>
          }
        </div>
      } @else if (viewMode() === 'table') {
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- RESPONSIVE DATA TABLE OF EXISTING USER ROLES                        -->
        <!-- Columns: Role Name, Description, Status, CRUD Permissions, Actions  -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
          <!-- Mobile Cards (< md) -->
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            @for (role of filteredRoles(); track role.id) {
              <div class="p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center flex-wrap gap-1.5">
                      <span class="font-bold text-slate-900 dark:text-slate-100 text-sm">{{ role.name }}</span>
                      @if (role.isSystemRole) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Hệ thống
                        </span>
                      } @else {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Tùy biến Tenant
                        </span>
                      }
                    </div>
                    <div class="text-[11px] font-mono text-slate-400 mt-0.5">Mã: {{ role.code }}</div>
                  </div>
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums shrink-0">
                    <i class="pi pi-users text-[10px]" aria-hidden="true"></i>
                    <span>{{ role.staffCount }}</span>
                  </span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300">
                  {{ role.description || 'Chức vụ thực hiện các nghiệp vụ được phân công trong khách sạn.' }}
                </p>
                <div class="flex items-center justify-end gap-2">
                  @if (role.isSystemRole) {
                    <button
                      type="button"
                      (click)="openEditRoleModal(role)"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer"
                      [attr.aria-label]="'Xem quyền ' + role.name"
                    >
                      <i class="pi pi-eye text-[11px]" aria-hidden="true"></i>
                      <span>Xem quyền</span>
                    </button>
                    <button
                      type="button"
                      (click)="cloneRoleToCustom(role)"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer"
                      [attr.aria-label]="'Nhân bản vai trò ' + role.name + ' thành vai trò tùy biến'"
                    >
                      <i class="pi pi-copy text-[11px]" aria-hidden="true"></i>
                      <span>Nhân bản</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="openEditRoleModal(role)"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer"
                      [attr.aria-label]="'Chỉnh sửa quyền ' + role.name"
                    >
                      <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                      <span>Chỉnh sửa quyền</span>
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteRole(role)"
                      class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                      [attr.aria-label]="'Xóa chức vụ ' + role.name"
                    >
                      <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300 tabular-nums" data-testid="roles-data-table">
              <thead class="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="px-4 py-3.5 min-w-[190px]" [attr.aria-sort]="getAriaSort('name')">
                    <button
                      type="button"
                      (click)="toggleSort('name')"
                      class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Role Name (Tên vai trò)</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('name')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-4 py-3.5 min-w-[210px]">Description (Mô tả nhiệm vụ)</th>
                  <th scope="col" class="px-4 py-3.5 whitespace-nowrap">Status (Trạng thái)</th>
                  <th scope="col" class="px-4 py-3.5 min-w-[230px]">Phân quyền tính năng (CRUD)</th>
                  <th scope="col" class="px-3 py-3.5 text-center whitespace-nowrap" [attr.aria-sort]="getAriaSort('staffCount')">
                    <button
                      type="button"
                      (click)="toggleSort('staffCount')"
                      class="min-h-11 inline-flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Nhân sự</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('staffCount')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-4 py-3.5 text-right whitespace-nowrap">Actions (Thao tác)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (role of filteredRoles(); track role.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors align-top">
                    <!-- Column 1: Role Name, Code & Classification Badge -->
                    <td class="px-5 py-4">
                      <div class="flex items-start gap-3">
                        <div
                          class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border"
                          [ngClass]="role.isSystemRole
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'"
                        >
                          <i class="pi" [ngClass]="role.isSystemRole ? 'pi-lock' : 'pi-sliders-h'" aria-hidden="true"></i>
                        </div>
                        <div class="space-y-1 min-w-0">
                          <div class="flex items-center flex-wrap gap-1.5">
                            <span class="font-bold text-slate-900 dark:text-slate-100 text-sm">{{ role.name }}</span>
                            @if (role.isSystemRole) {
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Hệ thống
                              </span>
                            } @else {
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Tùy biến Tenant
                              </span>
                            }
                          </div>
                          <div class="text-[11px] font-mono text-slate-400">
                            Mã: <span class="text-slate-600 dark:text-slate-300 font-semibold">{{ role.code }}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Column 2: Description -->
                    <td class="px-5 py-4">
                      <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {{ role.description || 'Chức vụ thực hiện các nghiệp vụ được phân công trong khách sạn.' }}
                      </p>
                      <div class="mt-2 flex items-center flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>
                          <strong class="text-slate-700 dark:text-slate-200">{{ getRoleStats(role).modulesWithAccess }}</strong>/{{ permissionFunctions().length || 17 }} tính năng
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong class="text-emerald-700 dark:text-emerald-400">{{ getRoleStats(role).totalCrudGrants }}</strong> quyền CRUD
                        </span>
                      </div>
                    </td>

                    <!-- Column 3: Role Status (Active / Inactive & Staff Assignment) -->
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="flex flex-col items-start gap-1">
                        @if (role.isSystemRole) {
                          <span
                            title="Vai trò mặc định hệ thống (chỉ đọc)"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                            <span>{{ isActiveRole(role) ? 'Đang hoạt động' : 'Tạm ngưng' }}</span>
                          </span>
                        } @else {
                          <button
                            type="button"
                            (click)="toggleRoleActiveStatus(role)"
                            [title]="'Nhấn để chuyển trạng thái hoạt động của vai trò ' + role.name"
                            [attr.aria-label]="'Chuyển trạng thái hoạt động của vai trò ' + role.name"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-bold border transition-colors cursor-pointer"
                            [ngClass]="isActiveRole(role)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80'"
                          >
                            <span
                              class="w-1.5 h-1.5 rounded-full"
                              [ngClass]="isActiveRole(role) ? 'bg-emerald-500' : 'bg-amber-500'"
                              aria-hidden="true"
                            ></span>
                            <span>{{ isActiveRole(role) ? 'Đang hoạt động' : 'Tạm ngưng' }}</span>
                          </button>
                        }
                        <span class="text-[10px] text-slate-400 tabular-nums">
                          {{ (role.staffCount || 0) > 0 ? 'Đang áp dụng (' + role.staffCount + ' NS)' : 'Chưa gán nhân sự' }}
                        </span>
                      </div>
                    </td>

                    <!-- Column 4: Active CRUD Permission Badges (Vietnamese Names) -->
                    <td class="px-5 py-4">
                      <div class="flex flex-wrap gap-1.5 max-w-md">
                        @for (p of getActivePermissions(role.permissions).slice(0, 5); track p.functionId) {
                          <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-medium">
                            <span class="font-bold text-slate-900 dark:text-slate-100">{{ getVietnameseName(p) }}</span>
                            <span class="text-emerald-700 dark:text-emerald-400 text-[9px] font-extrabold">
                              {{ getCrudShortSummary(p) }}
                            </span>
                          </span>
                        }
                        @if (getActivePermissions(role.permissions).length > 5) {
                          <button
                            type="button"
                            (click)="openEditRoleModal(role)"
                            class="min-h-11 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer tabular-nums"
                          >
                            +{{ getActivePermissions(role.permissions).length - 5 }} tính năng khác
                          </button>
                        }
                        @if (getActivePermissions(role.permissions).length === 0) {
                          <span class="text-[11px] text-slate-400 italic">Chưa cấp quyền cụ thể</span>
                        }
                      </div>
                    </td>

                    <!-- Column 4: Assigned Staff Count -->
                    <td class="px-4 py-4 text-center whitespace-nowrap">
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                        <i class="pi pi-users text-[10px]" aria-hidden="true"></i>
                        <span>{{ role.staffCount }}</span>
                      </span>
                    </td>

                    <!-- Column 5: Actions Column for Viewing/Cloning/Editing Permissions -->
                    <td class="px-5 py-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        @if (role.isSystemRole) {
                          <button
                            type="button"
                            (click)="openEditRoleModal(role)"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                            [attr.aria-label]="'Xem quyền ' + role.name"
                          >
                            <i class="pi pi-eye text-[11px]" aria-hidden="true"></i>
                            <span>Xem quyền</span>
                          </button>
                          <button
                            type="button"
                            (click)="cloneRoleToCustom(role)"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                            [attr.aria-label]="'Nhân bản vai trò ' + role.name + ' thành vai trò tùy biến'"
                            title="Nhân bản thành vai trò tùy biến để chỉnh sửa"
                          >
                            <i class="pi pi-copy text-[11px]" aria-hidden="true"></i>
                            <span>Nhân bản</span>
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="openEditRoleModal(role)"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                            [attr.aria-label]="'Chỉnh sửa quyền ' + role.name"
                          >
                            <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                            <span>Chỉnh sửa quyền</span>
                          </button>
                          <button
                            type="button"
                            (click)="confirmDeleteRole(role)"
                            class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            [attr.aria-label]="'Xóa chức vụ ' + role.name"
                            title="Xóa chức vụ"
                          >
                            <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Table Footer Legend -->
          <div class="px-5 py-3 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div class="tabular-nums">
              Hiển thị <strong class="text-slate-800 dark:text-slate-100">{{ filteredRoles().length }}</strong> / {{ roles().length }} vai trò người dùng
            </div>
            <div class="flex items-center flex-wrap gap-3">
              <span class="inline-flex items-center gap-1">
                <span class="font-bold text-emerald-700">R</span>: Xem (Read)
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="font-bold text-sky-700">C</span>: Thêm (Create)
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="font-bold text-amber-700">U</span>: Sửa (Update)
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="font-bold text-rose-700">D</span>: Xóa (Delete)
              </span>
            </div>
          </div>
        </div>
      } @else if (viewMode() === 'matrix') {
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- INLINE PERMISSIONS MATRIX VIEW (PermissionsMatrixComponent)         -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-5 shadow-xs space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Cấu hình Ma trận Phân quyền trực tiếp
              </div>
              <div class="flex items-center flex-wrap gap-2 mt-1">
                @for (r of roles(); track r.id) {
                  <button
                    type="button"
                    (click)="selectRoleForInlineMatrix(r)"
                    class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    [ngClass]="selectedInlineRole()?.id === r.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-indigo-50/50 hover:border-indigo-200'"
                  >
                    <i class="pi text-[10px]" [ngClass]="r.isSystemRole ? 'pi-lock' : 'pi-sliders-h'" aria-hidden="true"></i>
                    <span>{{ r.name }}</span>
                  </button>
                }
              </div>
            </div>

            @if (selectedInlineRole(); as activeRole) {
              @if (activeRole.isSystemRole) {
                <div class="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
                  <span class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    <i class="pi pi-lock text-xs" aria-hidden="true"></i>
                    <span>Vai trò hệ thống (Chỉ đọc)</span>
                  </span>
                  <button
                    type="button"
                    (click)="cloneRoleToCustom(activeRole)"
                    class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <i class="pi pi-copy text-xs" aria-hidden="true"></i>
                    <span>Nhân bản thành vai trò tùy biến</span>
                  </button>
                </div>
              } @else {
                <button
                  type="button"
                  (click)="saveInlineMatrixRole()"
                  [disabled]="submittingRole()"
                  class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 self-start md:self-center"
                >
                  @if (submittingRole()) {
                    <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                  } @else {
                    <i class="pi pi-save text-xs" aria-hidden="true"></i>
                  }
                  <span>Lưu quyền cho "{{ activeRole.name }}"</span>
                </button>
              }
            }
          </div>

          <app-permissions-matrix
            [rows]="inlineMatrixRows()"
            [readonly]="selectedInlineRole()?.isSystemRole ?? false"
            (rowsChange)="inlineMatrixRows.set($event)"
          ></app-permissions-matrix>
        </div>
      } @else {
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- ALTERNATIVE CARD GRID VIEW                                          -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (role of filteredRoles(); track role.id) {
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm">{{ role.name }}</h3>
                      @if (role.isSystemRole) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Hệ thống
                        </span>
                      } @else {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Tùy biến Tenant
                        </span>
                      }
                    </div>
                    <div class="text-[11px] font-mono text-slate-400 mt-0.5">
                      Mã: {{ role.code }}
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                      <i class="pi pi-users text-[10px]" aria-hidden="true"></i>
                      {{ role.staffCount }} nhân sự
                    </span>
                  </div>
                </div>

                <p class="text-xs text-slate-500 dark:text-slate-400 min-h-[32px] line-clamp-2">
                  {{ role.description || 'Chức vụ thực hiện các nghiệp vụ được phân công trong khách sạn.' }}
                </p>

                <div class="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quyền tính năng (CRUD):</div>
                  <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    @for (p of getActivePermissions(role.permissions); track p.functionId) {
                      <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 font-medium">
                        <span class="font-bold text-slate-900 dark:text-slate-100">{{ getVietnameseName(p) }}</span>
                        <span class="text-emerald-700 dark:text-emerald-400 text-[9px] font-bold">
                          {{ getCrudShortSummary(p) }}
                        </span>
                      </span>
                    }
                    @if (getActivePermissions(role.permissions).length === 0) {
                      <span class="text-[11px] text-slate-400 italic">Chưa cấp quyền cụ thể</span>
                    }
                  </div>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                @if (role.isSystemRole) {
                  <button
                    type="button"
                    (click)="openEditRoleModal(role)"
                    class="min-h-11 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-eye mr-1 text-[11px]" aria-hidden="true"></i> Xem quyền
                  </button>
                  <button
                    type="button"
                    (click)="cloneRoleToCustom(role)"
                    class="min-h-11 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-copy mr-1 text-[11px]" aria-hidden="true"></i> Nhân bản
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="openEditRoleModal(role)"
                    class="min-h-11 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-pencil mr-1 text-[11px]" aria-hidden="true"></i> Chỉnh sửa quyền
                  </button>
                  <button
                    type="button"
                    (click)="confirmDeleteRole(role)"
                    class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                    [attr.aria-label]="'Xóa chức vụ ' + role.name"
                    title="Xóa chức vụ"
                  >
                    <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- MODAL: CẤU HÌNH CHỨC VỤ & MA TRẬN CẤP QUYỀN CRUD                        -->
      <!-- (Sử dụng PermissionsMatrixComponent)                                    -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (showRoleModal()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="closeRoleModal()"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-5xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 id="role-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i class="pi pi-shield text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>
                  @if (isEditingSystemRole()) {
                    Chi tiết Quyền Vai trò Hệ thống (Chỉ đọc)
                  } @else if (isEditingRole()) {
                    Chỉnh sửa Quyền Chức vụ &amp; Ma trận CRUD
                  } @else {
                    Tạo Chức vụ Mới &amp; Cấp quyền CRUD
                  }
                </span>
              </h2>
              <button
                type="button"
                (click)="closeRoleModal()"
                aria-label="Đóng cửa sổ cấu hình vai trò"
                class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            @if (isEditingSystemRole()) {
              <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <i class="pi pi-lock text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true"></i>
                  <span>Vai trò chuẩn hệ thống được khóa ở chế độ chỉ đọc. Hãy nhân bản thành vai trò tùy biến để chỉnh sửa phân quyền riêng.</span>
                </div>
              </div>
            }

            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label for="role-code-input" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã chức vụ (Code) *</label>
                  <input
                    id="role-code-input"
                    type="text"
                    [(ngModel)]="roleForm.code"
                    [disabled]="isEditingRole()"
                    placeholder="VD: ACCOUNTANT, SALES, SECURITY"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                  />
                  <p class="text-[10px] text-slate-400 mt-1">Chữ hoa, số và gạch dưới (không đổi sau khi tạo).</p>
                </div>

                <div>
                  <label for="role-name-input" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tên chức vụ hiển thị *</label>
                  <input
                    id="role-name-input"
                    type="text"
                    [(ngModel)]="roleForm.name"
                    [disabled]="isEditingSystemRole()"
                    placeholder="VD: Kế toán trưởng, Nhân viên kinh doanh"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                  />
                </div>

                <div>
                  <label for="role-desc-input" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mô tả chức năng &amp; quyền hạn</label>
                  <input
                    id="role-desc-input"
                    type="text"
                    [(ngModel)]="roleForm.description"
                    [disabled]="isEditingSystemRole()"
                    placeholder="Mô tả phạm vi trách nhiệm của vị trí này..."
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
                <div>
                  <div class="font-bold text-slate-800 dark:text-slate-100 text-xs">Trạng thái kích hoạt vai trò (Status)</div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">Cho phép gán chức vụ này cho các tài khoản nhân sự trong chi nhánh</div>
                </div>
                <select
                  [(ngModel)]="roleForm.isActive"
                  [disabled]="isEditingSystemRole()"
                  aria-label="Trạng thái kích hoạt vai trò"
                  class="min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                >
                  <option [ngValue]="true">Đang hoạt động (Active)</option>
                  <option [ngValue]="false">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <!-- Embedded PermissionsMatrixComponent -->
              <app-permissions-matrix
                [rows]="matrixRows()"
                [readonly]="isEditingSystemRole()"
                (rowsChange)="matrixRows.set($event)"
              ></app-permissions-matrix>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                (click)="closeRoleModal()"
                class="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ isEditingSystemRole() ? 'Đóng' : 'Hủy bỏ' }}
              </button>
              @if (isEditingSystemRole()) {
                <button
                  type="button"
                  (click)="cloneCurrentModalRole()"
                  class="min-h-11 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <i class="pi pi-copy text-xs" aria-hidden="true"></i>
                  <span>Nhân bản thành vai trò tùy biến</span>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="submitRole()"
                  [disabled]="submittingRole()"
                  class="min-h-11 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  @if (submittingRole()) {
                    <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
                  }
                  <span>{{ isEditingRole() ? 'Cập nhật chức vụ' : 'Tạo chức vụ' }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class RolesManagementComponent implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly alertService = inject(AlertService);
  private readonly loadingOverlay = inject(LoadingOverlayService);
  private readonly destroyRef = inject(DestroyRef);

  readonly showHeader = input<boolean>(true);
  readonly rolesChanged = output<void>();

  readonly loading = signal<boolean>(false);
  readonly submittingRole = signal<boolean>(false);
  readonly roles = signal<RoleDetailDto[]>([]);
  readonly permissionFunctions = signal<PermissionFunctionDto[]>([]);

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<RoleStatusFilter>('ALL');
  readonly scopeFilter = signal<RoleScopeFilter>('ALL');
  readonly permissionLevelFilter = signal<RolePermissionLevelFilter>('ALL');
  readonly viewMode = signal<'table' | 'matrix' | 'cards'>('table');
  readonly sortField = signal<RoleSortField | null>(null);
  readonly sortDirection = signal<'asc' | 'desc'>('asc');

  readonly showRoleModal = signal<boolean>(false);
  readonly isEditingRole = signal<boolean>(false);
  readonly isEditingSystemRole = signal<boolean>(false);
  editingRoleId = '';
  private modalSourceRole: RoleDetailDto | null = null;

  roleForm = {
    code: '',
    name: '',
    description: '',
    isActive: true
  };

  readonly matrixRows = signal<PermissionMatrixRow[]>([]);

  /** State for inline matrix editor tab */
  readonly selectedInlineRole = signal<RoleDetailDto | null>(null);
  readonly inlineMatrixRows = signal<PermissionMatrixRow[]>([]);

  readonly systemRolesCount = computed(() =>
    this.roles().filter(r => r.isSystemRole).length
  );

  readonly customRolesCount = computed(() =>
    this.roles().filter(r => !r.isSystemRole).length
  );

  readonly activeRolesCount = computed(() =>
    this.roles().filter(r => isRoleActive(r)).length
  );

  readonly inactiveRolesCount = computed(() =>
    this.roles().filter(r => !isRoleActive(r)).length
  );

  readonly assignedRolesCount = computed(() =>
    this.roles().filter(r => (r.staffCount || 0) > 0).length
  );

  readonly unassignedRolesCount = computed(() =>
    this.roles().filter(r => (r.staffCount || 0) === 0).length
  );

  readonly hasActiveFilters = computed(() =>
    this.searchQuery().trim().length > 0 ||
    this.statusFilter() !== 'ALL' ||
    this.scopeFilter() !== 'ALL' ||
    this.permissionLevelFilter() !== 'ALL'
  );

  readonly filteredRoles = computed(() => {
    const base = filterRoles(
      this.roles(),
      this.searchQuery(),
      this.scopeFilter(),
      this.statusFilter(),
      this.permissionLevelFilter()
    );
    const field = this.sortField();
    if (!field) return base;
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (field === 'staffCount') {
        return ((a.staffCount || 0) - (b.staffCount || 0)) * dir;
      }
      return a.name.localeCompare(b.name, 'vi') * dir;
    });
  });

  ngOnInit(): void {
    this.loadRolesAndFunctions();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showRoleModal() && !this.submittingRole()) {
      this.closeRoleModal();
    }
  }

  toggleSort(field: RoleSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'staffCount' ? 'desc' : 'asc');
    }
  }

  getAriaSort(field: RoleSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(field: RoleSortField): string {
    if (this.sortField() !== field) return 'pi-sort-alt text-slate-400';
    return this.sortDirection() === 'asc' ? 'pi-sort-amount-up text-indigo-600' : 'pi-sort-amount-down text-indigo-600';
  }

  loadRolesAndFunctions(): void {
    this.loading.set(true);

    this.staffService.getPermissionFunctions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: funcs => this.permissionFunctions.set(funcs),
      error: err => {
        this.alertService.toastError(this.extractApiError(err, 'Không thể tải danh sách chức năng phân quyền.'));
      }
    });

    this.staffService.getRolesWithPermissions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: details => {
        this.roles.set(details);
        this.loading.set(false);
        const currentInline = this.selectedInlineRole();
        const target = currentInline
          ? details.find(d => d.id === currentInline.id) || details[0]
          : details[0];
        if (target) {
          this.selectRoleForInlineMatrix(target);
        }
      },
      error: err => {
        this.loading.set(false);
        this.alertService.toastError(this.extractApiError(err, 'Không thể tải danh sách vai trò từ máy chủ.'));
      }
    });
  }

  private extractApiError(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string; detail?: string; title?: string }; message?: string } | null;
    return httpErr?.error?.message || httpErr?.error?.detail || httpErr?.error?.title || httpErr?.message || fallback;
  }

  private buildMatrixRowsForRole(role?: RoleDetailDto): PermissionMatrixRow[] {
    const functions = this.permissionFunctions();
    const permMap = new Map((role?.permissions || []).map(p => [p.functionId, p]));

    return functions.map(f => {
      const existing =
        permMap.get(f.id) || (role?.permissions || []).find(p => p.functionCode === f.code);
      return {
        functionId: f.id,
        code: f.code,
        name: getVietnameseFunctionName(f.code, f.name),
        moduleCode: f.moduleCode,
        canRead: existing ? (existing.canRead ?? (existing.actionMask & 1) !== 0) : !role,
        canCreate: existing ? (existing.canCreate ?? (existing.actionMask & 2) !== 0) : false,
        canUpdate: existing ? (existing.canUpdate ?? (existing.actionMask & 4) !== 0) : false,
        canDelete: existing ? (existing.canDelete ?? (existing.actionMask & 8) !== 0) : false
      };
    });
  }

  switchToInlineMatrixView(): void {
    if (!this.selectedInlineRole() && this.roles().length > 0) {
      this.selectRoleForInlineMatrix(this.roles()[0]);
    }
    this.viewMode.set('matrix');
  }

  selectRoleForInlineMatrix(role: RoleDetailDto): void {
    this.selectedInlineRole.set(role);
    this.inlineMatrixRows.set(this.buildMatrixRowsForRole(role));
  }

  saveInlineMatrixRole(): void {
    const role = this.selectedInlineRole();
    if (!role) return;
    if (role.isSystemRole) {
      this.alertService.toastError('Vai trò hệ thống là chỉ đọc. Vui lòng nhân bản thành vai trò tùy biến để chỉnh sửa.');
      return;
    }

    const permissions: RolePermissionInput[] = this.inlineMatrixRows().map(r => ({
      functionId: r.functionId,
      canRead: r.canRead,
      canCreate: r.canCreate,
      canUpdate: r.canUpdate,
      canDelete: r.canDelete
    }));

    this.submittingRole.set(true);
    const overlayTaskId = this.loadingOverlay.begin(`Đang lưu ma trận phân quyền cho "${role.name}"...`);
    const req: UpdateRoleRequest = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions
    };

    this.staffService.updateRole(role.id, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadingOverlay.end(overlayTaskId);
        this.submittingRole.set(false);
        this.alertService.toastSuccess(`Đã lưu ma trận phân quyền cho "${role.name}".`);
        this.loadRolesAndFunctions();
        this.rolesChanged.emit();
      },
      error: err => {
        this.loadingOverlay.end(overlayTaskId);
        this.submittingRole.set(false);
        this.alertService.toastError(this.extractApiError(err, 'Không thể lưu ma trận phân quyền.'));
      }
    });
  }

  getActivePermissions(permissions: RolePermissionDto[]): RolePermissionDto[] {
    return (permissions || []).filter(p => this.getCrudShortSummary(p).length > 0);
  }

  getVietnameseName(p: RolePermissionDto): string {
    return getVietnameseFunctionName(p.functionCode, p.functionName);
  }

  getCrudShortSummary(p: RolePermissionDto): string {
    return formatCrudBadge(p);
  }

  getPermissionScore(p: RolePermissionDto): number {
    const canRead = p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0;
    const canCreate = p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0;
    const canUpdate = p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0;
    const canDelete = p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0;
    return calculateRowMaskScore({ canRead, canCreate, canUpdate, canDelete });
  }

  getRoleStats(role: RoleDetailDto) {
    return countActivePermissions(role.permissions || [], this.permissionFunctions().length || 17);
  }

  isActiveRole(role: RoleDetailDto): boolean {
    return isRoleActive(role);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.scopeFilter.set('ALL');
    this.permissionLevelFilter.set('ALL');
  }

  toggleRoleActiveStatus(role: RoleDetailDto): void {
    if (role.isSystemRole) {
      this.alertService.toastError('Không thể thay đổi trạng thái vai trò mặc định hệ thống.');
      return;
    }

    const nextStatus = !isRoleActive(role);
    const permissions: RolePermissionInput[] = (role.permissions || []).map(p => ({
      functionId: p.functionId,
      canRead: p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0,
      canCreate: p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0,
      canUpdate: p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0,
      canDelete: p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0
    }));

    const req: UpdateRoleRequest = {
      id: role.id,
      name: role.name,
      description: role.description,
      isActive: nextStatus,
      permissions
    };

    this.staffService.updateRole(role.id, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.alertService.toastSuccess(
          `Đã chuyển vai trò "${role.name}" sang trạng thái ${nextStatus ? 'Đang hoạt động' : 'Tạm ngưng'}.`
        );
        this.loadRolesAndFunctions();
        this.rolesChanged.emit();
      },
      error: err => {
        this.alertService.toastError(this.extractApiError(err, 'Không thể cập nhật trạng thái vai trò.'));
      }
    });
  }

  openCreateRoleModal(): void {
    this.isEditingRole.set(false);
    this.isEditingSystemRole.set(false);
    this.editingRoleId = '';
    this.modalSourceRole = null;
    this.roleForm = {
      code: '',
      name: '',
      description: '',
      isActive: true
    };
    this.matrixRows.set(this.buildMatrixRowsForRole(undefined));
    this.showRoleModal.set(true);
  }

  openEditRoleModal(role: RoleDetailDto): void {
    this.isEditingRole.set(true);
    this.isEditingSystemRole.set(Boolean(role.isSystemRole));
    this.editingRoleId = role.id;
    this.modalSourceRole = role;
    this.roleForm = {
      code: role.code,
      name: role.name,
      description: role.description || '',
      isActive: isRoleActive(role)
    };
    this.matrixRows.set(this.buildMatrixRowsForRole(role));
    this.showRoleModal.set(true);
  }

  cloneRoleToCustom(role: RoleDetailDto): void {
    this.isEditingRole.set(false);
    this.isEditingSystemRole.set(false);
    this.editingRoleId = '';
    this.modalSourceRole = null;
    const baseCode = normalizeRoleCode(role.code) || 'ROLE';
    this.roleForm = {
      code: `${baseCode}_CUSTOM`,
      name: `${role.name} (Bản sao)`,
      description: role.description || '',
      isActive: true
    };
    this.matrixRows.set(this.buildMatrixRowsForRole(role));
    this.showRoleModal.set(true);
  }

  cloneCurrentModalRole(): void {
    if (!this.modalSourceRole) return;
    this.cloneRoleToCustom(this.modalSourceRole);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
  }

  submitRole(): void {
    if (this.isEditingSystemRole()) {
      this.alertService.toastError('Vai trò hệ thống là chỉ đọc. Vui lòng nhân bản thành vai trò tùy biến để chỉnh sửa.');
      return;
    }

    if (!this.roleForm.name.trim()) {
      this.alertService.toastError('Vui lòng nhập tên chức vụ.');
      return;
    }

    const normalizedCode = normalizeRoleCode(this.roleForm.code);
    if (!this.isEditingRole() && !normalizedCode) {
      this.alertService.toastError('Vui lòng nhập mã chức vụ hợp lệ (chữ in hoa).');
      return;
    }

    const permissions: RolePermissionInput[] = this.matrixRows().map(r => ({
      functionId: r.functionId,
      canRead: r.canRead,
      canCreate: r.canCreate,
      canUpdate: r.canUpdate,
      canDelete: r.canDelete
    }));

    this.submittingRole.set(true);
    const overlayTaskId = this.loadingOverlay.begin(
      this.isEditingRole()
        ? `Đang cập nhật vai trò "${this.roleForm.name.trim()}"...`
        : `Đang khởi tạo vai trò "${this.roleForm.name.trim()}"...`
    );

    if (this.isEditingRole()) {
      const req: UpdateRoleRequest = {
        id: this.editingRoleId,
        name: this.roleForm.name.trim(),
        description: this.roleForm.description?.trim(),
        isActive: this.roleForm.isActive,
        permissions
      };

      this.staffService.updateRole(this.editingRoleId, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadingOverlay.end(overlayTaskId);
          this.submittingRole.set(false);
          this.closeRoleModal();
          this.alertService.toastSuccess('Cập nhật chức vụ và phân quyền CRUD thành công.');
          this.loadRolesAndFunctions();
          this.rolesChanged.emit();
        },
        error: err => {
          this.loadingOverlay.end(overlayTaskId);
          this.submittingRole.set(false);
          this.alertService.toastError(this.extractApiError(err, 'Không thể cập nhật chức vụ.'));
        }
      });
    } else {
      const req: CreateRoleRequest = {
        code: normalizedCode,
        name: this.roleForm.name.trim(),
        description: this.roleForm.description?.trim(),
        isActive: this.roleForm.isActive,
        permissions
      };

      this.staffService.createRole(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadingOverlay.end(overlayTaskId);
          this.submittingRole.set(false);
          this.closeRoleModal();
          this.alertService.toastSuccess('Tạo chức vụ mới và cấp quyền CRUD thành công.');
          this.loadRolesAndFunctions();
          this.rolesChanged.emit();
        },
        error: err => {
          this.loadingOverlay.end(overlayTaskId);
          this.submittingRole.set(false);
          this.alertService.toastError(this.extractApiError(err, 'Không thể tạo chức vụ.'));
        }
      });
    }
  }

  async confirmDeleteRole(role: RoleDetailDto): Promise<void> {
    if (role.isSystemRole) {
      this.alertService.toastError('Không thể xóa vai trò mặc định hệ thống.');
      return;
    }

    const confirmed = await this.alertService.confirmDelete({
      title: 'Xóa chức vụ tùy biến?',
      text: `Bạn có chắc chắn muốn xóa chức vụ "${role.name}" (${role.code})?`
    });
    if (confirmed) {
      this.staffService.deleteRole(role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.toastSuccess('Đã xóa chức vụ thành công.');
          this.loadRolesAndFunctions();
          this.rolesChanged.emit();
        },
        error: err => {
          this.alertService.toastError(this.extractApiError(err, 'Không thể xóa chức vụ.'));
        }
      });
    }
  }
}
