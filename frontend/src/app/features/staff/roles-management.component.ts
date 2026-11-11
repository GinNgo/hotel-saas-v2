import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  input,
  output,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-roles-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PermissionsMatrixComponent],
  template: `
    <div class="space-y-5" data-testid="roles-management-root">
      <!-- Standalone Header -->
      @if (showHeader()) {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
          <div>
            <div class="flex items-center flex-wrap gap-2.5">
              <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                Quản lý Vai trò & Phân quyền (Roles Management)
              </h1>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap">
                Phân quyền RBAC
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              Danh sách các chức vụ trong hệ thống, mô tả phạm vi trách nhiệm và cấu hình ma trận quyền Xem, Thêm, Sửa, Xóa (CRUD).
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              (click)="loadRolesAndFunctions()"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              aria-label="Làm mới danh sách vai trò"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()"></i>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              (click)="openCreateRoleModal()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <i class="pi pi-plus-circle text-xs"></i>
              <span>Tạo chức vụ mới</span>
            </button>
          </div>
        </div>
      }

      <!-- KPI Summary Strip -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng số vai trò</div>
            <div class="text-2xl font-extrabold text-slate-900 mt-0.5">{{ roles().length }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">Đang áp dụng trên hệ thống</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <i class="pi pi-shield text-base"></i>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vai trò mặc định</div>
            <div class="text-2xl font-extrabold text-emerald-800 mt-0.5">{{ systemRolesCount() }}</div>
            <div class="text-[11px] text-emerald-600 mt-0.5">Chuẩn hóa vận hành khách sạn</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <i class="pi pi-verified text-base"></i>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vai trò tùy biến (Tenant)</div>
            <div class="text-2xl font-extrabold text-indigo-800 mt-0.5">{{ customRolesCount() }}</div>
            <div class="text-[11px] text-indigo-600 mt-0.5">Cho phép tùy chỉnh ma trận CRUD</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <i class="pi pi-sliders-h text-base"></i>
          </div>
        </div>
      </div>

      <!-- Search Bar & Filter Dropdowns Toolbar -->
      <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3.5" data-testid="roles-filter-toolbar">
        <!-- Row 1: Search Input + 3 Filter Dropdowns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <!-- 1. Search Bar by Name, Code, or Description -->
          <div class="relative sm:col-span-2 lg:col-span-4">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
            <input
              type="text"
              data-testid="roles-search-input"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm theo tên vai trò, mã hoặc mô tả..."
              aria-label="Tìm kiếm vai trò"
              class="w-full h-10 pl-9 pr-8 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            }
          </div>

          <!-- 2. Status Filter Dropdown (Trạng thái vai trò) -->
          <div class="relative lg:col-span-3">
            <i class="pi pi-check-circle absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs pointer-events-none"></i>
            <select
              data-testid="roles-status-filter"
              [ngModel]="statusFilter()"
              (ngModelChange)="statusFilter.set($event)"
              aria-label="Lọc theo trạng thái vai trò"
              class="w-full h-10 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
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
            <i class="pi pi-filter absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 text-xs pointer-events-none"></i>
            <select
              data-testid="roles-scope-filter"
              [ngModel]="scopeFilter()"
              (ngModelChange)="scopeFilter.set($event)"
              aria-label="Lọc theo phân loại vai trò"
              class="w-full h-10 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Phân loại: Tất cả ({{ roles().length }})</option>
              <option value="SYSTEM">Vai trò Hệ thống ({{ systemRolesCount() }})</option>
              <option value="CUSTOM">Vai trò Tùy biến ({{ customRolesCount() }})</option>
            </select>
          </div>

          <!-- 4. Permission Coverage Level Filter Dropdown (Mức độ phân quyền) -->
          <div class="relative sm:col-span-2 lg:col-span-2">
            <i class="pi pi-shield absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-xs pointer-events-none"></i>
            <select
              data-testid="roles-permission-filter"
              [ngModel]="permissionLevelFilter()"
              (ngModelChange)="permissionLevelFilter.set($event)"
              aria-label="Lọc theo mức độ cấp quyền"
              class="w-full h-10 pl-8 pr-6 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Mức quyền: Tất cả</option>
              <option value="FULL_ACCESS">Toàn quyền quản trị</option>
              <option value="OPERATIONAL">Quyền nghiệp vụ</option>
              <option value="LIMITED">Quyền tác vụ / Giới hạn</option>
            </select>
          </div>
        </div>

        <!-- Row 2: Quick Status Chips + Reset Filters + View Mode Switcher -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
          <div class="flex items-center flex-wrap gap-1.5">
            <span class="font-semibold text-slate-600 mr-0.5">Nhanh theo trạng thái:</span>
            <button
              type="button"
              (click)="statusFilter.set('ALL')"
              class="px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer border"
              [ngClass]="statusFilter() === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'"
            >
              Tất cả ({{ roles().length }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('ACTIVE')"
              class="px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer border"
              [ngClass]="statusFilter() === 'ACTIVE' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50/60 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'"
            >
              Đang hoạt động ({{ activeRolesCount() }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('INACTIVE')"
              class="px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer border"
              [ngClass]="statusFilter() === 'INACTIVE' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50/60 text-amber-700 border-amber-200 hover:bg-amber-100/70'"
            >
              Tạm ngưng ({{ inactiveRolesCount() }})
            </button>
            <button
              type="button"
              (click)="statusFilter.set('ASSIGNED')"
              class="px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer border"
              [ngClass]="statusFilter() === 'ASSIGNED' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50/60 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70'"
            >
              Có nhân sự ({{ assignedRolesCount() }})
            </button>

            @if (hasActiveFilters()) {
              <button
                type="button"
                data-testid="roles-reset-filters"
                (click)="resetFilters()"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer ml-1"
              >
                <i class="pi pi-filter-slash text-[10px]"></i>
                <span>Xóa bộ lọc</span>
              </button>
            }
          </div>

          <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
            <span class="text-slate-500">
              Tìm thấy <strong class="text-slate-800">{{ filteredRoles().length }}</strong> / {{ roles().length }} vai trò
            </span>

            <!-- View Mode Switcher -->
            <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                (click)="viewMode.set('table')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'"
                aria-label="Chế độ bảng dữ liệu"
              >
                <i class="pi pi-table text-xs"></i>
                <span>Bảng dữ liệu</span>
              </button>
              <button
                type="button"
                (click)="switchToInlineMatrixView()"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'matrix' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'"
                aria-label="Chế độ ma trận phân quyền CRUD"
              >
                <i class="pi pi-sliders-h text-xs"></i>
                <span>Ma trận quyền CRUD</span>
              </button>
              <button
                type="button"
                (click)="viewMode.set('cards')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                [ngClass]="viewMode() === 'cards' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'"
                aria-label="Chế độ thẻ lưới"
              >
                <i class="pi pi-th-large text-xs"></i>
                <span>Thẻ lưới</span>
              </button>
            </div>

            @if (!showHeader()) {
              <button
                type="button"
                (click)="openCreateRoleModal()"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <i class="pi pi-plus-circle text-xs"></i>
                <span>Tạo chức vụ mới</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Loading / Empty / Data Views -->
      @if (loading()) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-slate-400 space-y-2 shadow-2xs">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-600"></i>
          <div class="text-xs font-medium">Đang tải danh sách vai trò và ma trận phân quyền...</div>
        </div>
      } @else if (filteredRoles().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3 text-center">
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
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <i class="pi pi-filter-slash text-xs"></i>
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
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600" data-testid="roles-data-table">
              <thead class="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" class="px-4 py-3.5 min-w-[190px]">Role Name (Tên vai trò)</th>
                  <th scope="col" class="px-4 py-3.5 min-w-[210px]">Description (Mô tả nhiệm vụ)</th>
                  <th scope="col" class="px-4 py-3.5 whitespace-nowrap">Status (Trạng thái)</th>
                  <th scope="col" class="px-4 py-3.5 min-w-[230px]">Phân quyền tính năng (CRUD)</th>
                  <th scope="col" class="px-3 py-3.5 text-center whitespace-nowrap">Nhân sự</th>
                  <th scope="col" class="px-4 py-3.5 text-right whitespace-nowrap">Actions (Thao tác)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (role of filteredRoles(); track role.id) {
                  <tr class="hover:bg-slate-50/80 transition-colors align-top">
                    <!-- Column 1: Role Name, Code & Classification Badge -->
                    <td class="px-5 py-4">
                      <div class="flex items-start gap-3">
                        <div
                          class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border"
                          [ngClass]="role.isSystemRole
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'"
                        >
                          <i class="pi" [ngClass]="role.isSystemRole ? 'pi-lock' : 'pi-sliders-h'"></i>
                        </div>
                        <div class="space-y-1 min-w-0">
                          <div class="flex items-center flex-wrap gap-1.5">
                            <span class="font-bold text-slate-900 text-sm">{{ role.name }}</span>
                            @if (role.isSystemRole) {
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Hệ thống
                              </span>
                            } @else {
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Tùy biến Tenant
                              </span>
                            }
                          </div>
                          <div class="text-[11px] font-mono text-slate-400">
                            Mã: <span class="text-slate-600 font-semibold">{{ role.code }}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Column 2: Description -->
                    <td class="px-5 py-4">
                      <p class="text-xs text-slate-700 leading-relaxed">
                        {{ role.description || 'Chức vụ thực hiện các nghiệp vụ được phân công trong khách sạn.' }}
                      </p>
                      <div class="mt-2 flex items-center flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>
                          <strong class="text-slate-700">{{ getRoleStats(role).modulesWithAccess }}</strong>/{{ permissionFunctions().length || 17 }} tính năng
                        </span>
                        <span>&bull;</span>
                        <span>
                          <strong class="text-emerald-700">{{ getRoleStats(role).totalCrudGrants }}</strong> quyền CRUD
                        </span>
                      </div>
                    </td>

                    <!-- Column 3: Role Status (Active / Inactive & Staff Assignment) -->
                    <td class="px-4 py-4 whitespace-nowrap">
                      <div class="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          (click)="toggleRoleActiveStatus(role)"
                          [title]="'Nhấn để chuyển trạng thái hoạt động của vai trò ' + role.name"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer"
                          [ngClass]="isActiveRole(role)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80'"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            [ngClass]="isActiveRole(role) ? 'bg-emerald-500' : 'bg-amber-500'"
                          ></span>
                          <span>{{ isActiveRole(role) ? 'Đang hoạt động' : 'Tạm ngưng' }}</span>
                        </button>
                        <span class="text-[10px] text-slate-400">
                          {{ (role.staffCount || 0) > 0 ? 'Đang áp dụng (' + role.staffCount + ' NS)' : 'Chưa gán nhân sự' }}
                        </span>
                      </div>
                    </td>

                    <!-- Column 4: Active CRUD Permission Badges (Vietnamese Names) -->
                    <td class="px-5 py-4">
                      <div class="flex flex-wrap gap-1.5 max-w-md">
                        @for (p of getActivePermissions(role.permissions).slice(0, 5); track p.functionId) {
                          <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                            <span class="font-bold text-slate-900">{{ getVietnameseName(p) }}</span>
                            <span class="text-emerald-700 text-[9px] font-extrabold">
                              {{ getCrudShortSummary(p) }}
                            </span>
                          </span>
                        }
                        @if (getActivePermissions(role.permissions).length > 5) {
                          <button
                            type="button"
                            (click)="openEditRoleModal(role)"
                            class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
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
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <i class="pi pi-users text-[10px]"></i>
                        <span>{{ role.staffCount }}</span>
                      </span>
                    </td>

                    <!-- Column 5: Actions Column for Editing Permissions -->
                    <td class="px-5 py-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          (click)="openEditRoleModal(role)"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border"
                          [ngClass]="role.isSystemRole
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'"
                          [attr.aria-label]="'Chỉnh sửa quyền ' + role.name"
                        >
                          <i class="pi text-[11px]" [ngClass]="role.isSystemRole ? 'pi-sliders-h' : 'pi-pencil'"></i>
                          <span>Chỉnh sửa quyền</span>
                        </button>

                        @if (!role.isSystemRole) {
                          <button
                            type="button"
                            (click)="confirmDeleteRole(role)"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            [attr.aria-label]="'Xóa chức vụ ' + role.name"
                            title="Xóa chức vụ"
                          >
                            <i class="pi pi-trash text-xs"></i>
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
          <div class="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              Hiển thị <strong class="text-slate-800">{{ filteredRoles().length }}</strong> / {{ roles().length }} vai trò người dùng
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
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Cấu hình Ma trận Phân quyền trực tiếp
              </div>
              <div class="flex items-center flex-wrap gap-2 mt-1">
                @for (r of roles(); track r.id) {
                  <button
                    type="button"
                    (click)="selectRoleForInlineMatrix(r)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    [ngClass]="selectedInlineRole()?.id === r.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-200'"
                  >
                    <i class="pi text-[10px]" [ngClass]="r.isSystemRole ? 'pi-lock' : 'pi-sliders-h'"></i>
                    <span>{{ r.name }}</span>
                  </button>
                }
              </div>
            </div>

            @if (selectedInlineRole(); as activeRole) {
              <button
                type="button"
                (click)="saveInlineMatrixRole()"
                [disabled]="submittingRole()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 self-start md:self-center"
              >
                @if (submittingRole()) {
                  <i class="pi pi-spin pi-spinner text-xs"></i>
                } @else {
                  <i class="pi pi-save text-xs"></i>
                }
                <span>Lưu quyền cho "{{ activeRole.name }}"</span>
              </button>
            }
          </div>

          <app-permissions-matrix
            [rows]="inlineMatrixRows()"
            (rowsChange)="inlineMatrixRows.set($event)"
          ></app-permissions-matrix>
        </div>
      } @else {
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- ALTERNATIVE CARD GRID VIEW                                          -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (role of filteredRoles(); track role.id) {
            <div class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-bold text-slate-900 text-sm">{{ role.name }}</h3>
                      @if (role.isSystemRole) {
                        <span class="inline-flex items-center px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Hệ thống
                        </span>
                      } @else {
                        <span class="inline-flex items-center px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Tùy biến Tenant
                        </span>
                      }
                    </div>
                    <div class="text-[11px] font-mono text-slate-400 mt-0.5">
                      Mã: {{ role.code }}
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <i class="pi pi-users text-[10px]"></i>
                      {{ role.staffCount }} nhân sự
                    </span>
                  </div>
                </div>

                <p class="text-xs text-slate-500 min-h-[32px] line-clamp-2">
                  {{ role.description || 'Chức vụ thực hiện các nghiệp vụ được phân công trong khách sạn.' }}
                </p>

                <div class="space-y-1.5 pt-2 border-t border-slate-100">
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quyền tính năng (CRUD):</div>
                  <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    @for (p of getActivePermissions(role.permissions); track p.functionId) {
                      <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60 font-medium">
                        <span class="font-bold text-slate-900">{{ getVietnameseName(p) }}</span>
                        <span class="text-emerald-700 text-[9px] font-bold">
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

              <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="openEditRoleModal(role)"
                  class="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <i class="pi pi-pencil mr-1 text-[11px]"></i> Chỉnh sửa quyền
                </button>
                @if (!role.isSystemRole) {
                  <button
                    type="button"
                    (click)="confirmDeleteRole(role)"
                    class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                    title="Xóa chức vụ"
                  >
                    <i class="pi pi-trash text-[11px]"></i>
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
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
        >
          <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 id="role-modal-title" class="text-base font-bold text-slate-900 flex items-center gap-2">
                <i class="pi pi-shield text-indigo-600"></i>
                <span>{{ isEditingRole() ? 'Chỉnh sửa Quyền Chức vụ & Ma trận CRUD' : 'Tạo Chức vụ Mới & Cấp quyền CRUD' }}</span>
              </h2>
              <button
                type="button"
                (click)="closeRoleModal()"
                aria-label="Đóng cửa sổ"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label for="role-code-input" class="block font-semibold text-slate-700 mb-1">Mã chức vụ (Code) *</label>
                  <input
                    id="role-code-input"
                    type="text"
                    [(ngModel)]="roleForm.code"
                    [disabled]="isEditingRole()"
                    placeholder="VD: ACCOUNTANT, SALES, SECURITY"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100"
                  />
                  <p class="text-[10px] text-slate-400 mt-1">Chữ hoa, số và gạch dưới (không đổi sau khi tạo).</p>
                </div>

                <div>
                  <label for="role-name-input" class="block font-semibold text-slate-700 mb-1">Tên chức vụ hiển thị *</label>
                  <input
                    id="role-name-input"
                    type="text"
                    [(ngModel)]="roleForm.name"
                    placeholder="VD: Kế toán trưởng, Nhân viên kinh doanh"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="role-desc-input" class="block font-semibold text-slate-700 mb-1">Mô tả chức năng & quyền hạn</label>
                  <input
                    id="role-desc-input"
                    type="text"
                    [(ngModel)]="roleForm.description"
                    placeholder="Mô tả phạm vi trách nhiệm của vị trí này..."
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <div class="font-bold text-slate-800 text-xs">Trạng thái kích hoạt vai trò (Status)</div>
                  <div class="text-[11px] text-slate-500">Cho phép gán chức vụ này cho các tài khoản nhân sự trong chi nhánh</div>
                </div>
                <select
                  [(ngModel)]="roleForm.isActive"
                  aria-label="Trạng thái kích hoạt vai trò"
                  class="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option [ngValue]="true">Đang hoạt động (Active)</option>
                  <option [ngValue]="false">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <!-- Embedded PermissionsMatrixComponent -->
              <app-permissions-matrix
                [rows]="matrixRows()"
                (rowsChange)="matrixRows.set($event)"
              ></app-permissions-matrix>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                (click)="closeRoleModal()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitRole()"
                [disabled]="submittingRole()"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                @if (submittingRole()) {
                  <i class="pi pi-spin pi-spinner mr-1"></i>
                }
                <span>{{ isEditingRole() ? 'Cập nhật chức vụ' : 'Tạo chức vụ' }}</span>
              </button>
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

  readonly showRoleModal = signal<boolean>(false);
  readonly isEditingRole = signal<boolean>(false);
  editingRoleId = '';

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

  readonly filteredRoles = computed(() =>
    filterRoles(
      this.roles(),
      this.searchQuery(),
      this.scopeFilter(),
      this.statusFilter(),
      this.permissionLevelFilter()
    )
  );

  ngOnInit(): void {
    this.loadRolesAndFunctions();
  }

  loadRolesAndFunctions(): void {
    this.loading.set(true);

    this.staffService.getPermissionFunctions().subscribe({
      next: funcs => this.permissionFunctions.set(funcs),
      error: () => {}
    });

    this.staffService.getRolesWithPermissions().subscribe({
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
      error: () => {
        this.loading.set(false);
      }
    });
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

    this.staffService.updateRole(role.id, req).subscribe({
      next: () => {
        this.loadingOverlay.end(overlayTaskId);
        this.submittingRole.set(false);
        this.alertService.toastSuccess(`Đã lưu ma trận điểm phân quyền cho "${role.name}".`);
        this.loadRolesAndFunctions();
        this.rolesChanged.emit();
      },
      error: err => {
        this.loadingOverlay.end(overlayTaskId);
        this.submittingRole.set(false);
        this.alertService.toastError(err.error?.message || 'Không thể lưu ma trận phân quyền.');
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

    this.staffService.updateRole(role.id, req).subscribe({
      next: () => {
        this.alertService.toastSuccess(
          `Đã chuyển vai trò "${role.name}" sang trạng thái ${nextStatus ? 'Đang hoạt động' : 'Tạm ngưng'}.`
        );
        this.loadRolesAndFunctions();
        this.rolesChanged.emit();
      },
      error: () => {
        this.alertService.toastError('Không thể cập nhật trạng thái vai trò.');
      }
    });
  }

  openCreateRoleModal(): void {
    this.isEditingRole.set(false);
    this.editingRoleId = '';
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
    this.editingRoleId = role.id;
    this.roleForm = {
      code: role.code,
      name: role.name,
      description: role.description || '',
      isActive: isRoleActive(role)
    };
    this.matrixRows.set(this.buildMatrixRowsForRole(role));
    this.showRoleModal.set(true);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
  }

  submitRole(): void {
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

      this.staffService.updateRole(this.editingRoleId, req).subscribe({
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
          this.alertService.toastError(err.error?.message || 'Không thể cập nhật chức vụ.');
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

      this.staffService.createRole(req).subscribe({
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
          this.alertService.toastError(err.error?.message || 'Không thể tạo chức vụ.');
        }
      });
    }
  }

  async confirmDeleteRole(role: RoleDetailDto): Promise<void> {
    const confirmed = await this.alertService.confirmDelete({
      title: 'Xóa chức vụ tùy biến?',
      text: `Bạn có chắc chắn muốn xóa chức vụ "${role.name}" (${role.code})?`
    });
    if (confirmed) {
      this.staffService.deleteRole(role.id).subscribe({
        next: () => {
          this.alertService.toastSuccess('Đã xóa chức vụ thành công.');
          this.loadRolesAndFunctions();
          this.rolesChanged.emit();
        },
        error: err => {
          this.alertService.toastError(err.error?.message || 'Không thể xóa chức vụ.');
        }
      });
    }
  }
}
