import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StaffService } from '../../core/services/staff.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  StaffMemberDto,
  AccessRoleDto,
  PermissionFunctionDto,
  RoleDetailDto,
  RolePermissionDto,
  RolePermissionInput,
  CreateRoleRequest,
  UpdateRoleRequest,
  StaffRole,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_BADGES,
  CreateStaffMemberRequest,
  UpdateStaffMemberRequest
} from '../../core/models/staff.model';
import { TenantPropertySummaryDto } from '../../core/models/public-booking.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { RolesManagementComponent } from './roles-management.component';
import { PermissionsMatrixComponent } from './permissions-matrix.component';

interface PermissionMatrixRow {
  functionId: string;
  code: string;
  name: string;
  moduleCode: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

type StaffSortField = 'fullName' | 'roleName' | 'propertyName' | 'isActive';

@Component({
  selector: 'app-staff',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    RolesManagementComponent,
    PermissionsMatrixComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <app-page-header
        [title]="'Quản lý Nhân sự & Phân quyền (Staff & RBAC)'"
        subtitle="Quản trị tài khoản nhân viên các chi nhánh, tạo chức vụ tùy biến và cấu hình cấp quyền xem, thêm, sửa, xóa (CRUD) theo từng phân hệ."
        badgeLabel="Phân quyền ma trận CRUD"
        badgeColor="indigo"
      >
        <div class="flex items-center gap-2.5">
          @if (activeTab() === 'staff') {
            <button
              type="button"
              (click)="loadStaff()"
              class="min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Làm mới danh sách"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()" aria-hidden="true"></i>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              (click)="openCreateModal()"
              class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <i class="pi pi-user-plus text-xs" aria-hidden="true"></i>
              <span>Thêm nhân viên</span>
            </button>
          } @else {
            <button
              type="button"
              (click)="loadRolesAndFunctions()"
              class="min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Làm mới chức vụ"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingRoles()" aria-hidden="true"></i>
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
          }
        </div>
      </app-page-header>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Phân hệ nhân sự và phân quyền">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'staff'"
          (click)="activeTab.set('staff')"
          class="min-h-11 flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer tabular-nums"
          [ngClass]="activeTab() === 'staff' ? 'border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-t-lg' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
        >
          <i class="pi pi-users text-sm" aria-hidden="true"></i>
          <span>Danh sách Nhân sự ({{ totalCount() }})</span>
        </button>

        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'roles'"
          (click)="activeTab.set('roles')"
          class="min-h-11 flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer tabular-nums"
          [ngClass]="activeTab() === 'roles' ? 'border-indigo-600 text-indigo-800 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-t-lg' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
        >
          <i class="pi pi-shield text-sm" aria-hidden="true"></i>
          <span>Chức vụ &amp; Cấp quyền CRUD ({{ rolesWithPermissions().length }})</span>
        </button>
      </div>

      <!-- Guide Banner: Quản lý tài khoản con & Cấp quyền chi nhánh -->
      <div class="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-indigo-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-slate-700 dark:text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div class="flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            <i class="pi pi-shield" aria-hidden="true"></i>
          </div>
          <div>
            <span class="font-bold text-emerald-950 dark:text-emerald-200">Phân quyền Tài khoản con &amp; Ủy quyền Chi nhánh:</span>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              Chủ cơ sở (Owner) và Quản lý (Manager) có toàn quyền tạo tài khoản con cho nhân viên trực thuộc từng chi nhánh hoặc toàn chuỗi,
              gán vai trò và cấu hình cấp quyền CRUD (<span class="font-bold text-emerald-700 dark:text-emerald-400">Xem - Thêm - Sửa - Xóa</span>) tương ứng với từng phân hệ.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 flex-wrap">
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/80 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
            <i class="pi pi-check text-[9px]" aria-hidden="true"></i>
            <span>Multi-tenant Isolation</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/80 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
            <i class="pi pi-check text-[9px]" aria-hidden="true"></i>
            <span>Ma trận CRUD RBAC</span>
          </span>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- TAB 1: DANH SÁCH NHÂN SỰ                                                -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'staff') {
        <!-- Stat Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng nhân sự</div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{{ totalCount() }}</div>
            <div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Toàn hệ thống</div>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quản lý / Chủ CS</div>
            <div class="text-2xl font-extrabold text-indigo-900 dark:text-indigo-400 mt-1 tabular-nums">{{ countManagers() }}</div>
            <div class="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">Cấp điều hành</div>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lễ tân</div>
            <div class="text-2xl font-extrabold text-emerald-900 dark:text-emerald-400 mt-1 tabular-nums">{{ countReceptionists() }}</div>
            <div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Check-in &amp; Thu ngân</div>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Buồng phòng</div>
            <div class="text-2xl font-extrabold text-amber-900 dark:text-amber-400 mt-1 tabular-nums">{{ countHousekeepers() }}</div>
            <div class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">Vệ sinh &amp; Dọn dẹp</div>
          </div>
        </div>

        <!-- Filters Toolbar -->
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div class="flex-1 flex flex-col sm:flex-row gap-2.5">
            <div class="relative flex-1">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
              <label for="staff-search-input" class="sr-only">Tìm kiếm nhân sự theo tên, email, số điện thoại</label>
              <input
                id="staff-search-input"
                type="text"
                [(ngModel)]="searchKeyword"
                (keyup.enter)="onSearch()"
                placeholder="Tìm theo tên, email, số điện thoại..."
                class="w-full min-h-11 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>

            <select
              [(ngModel)]="selectedRoleFilter"
              (change)="onFilterChange()"
              aria-label="Lọc theo chức danh nhân sự"
              class="min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option [ngValue]="null">Tất cả chức danh</option>
              <option [ngValue]="StaffRole.Owner">Chủ cơ sở (Owner)</option>
              <option [ngValue]="StaffRole.Manager">Quản lý (Manager)</option>
              <option [ngValue]="StaffRole.Receptionist">Lễ tân (Receptionist)</option>
              <option [ngValue]="StaffRole.Housekeeper">Buồng phòng (Housekeeper)</option>
            </select>

            <select
              [(ngModel)]="selectedPropertyFilter"
              (change)="onFilterChange()"
              aria-label="Lọc theo chi nhánh phân công"
              class="min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[220px]"
            >
              <option [ngValue]="null">Tất cả chi nhánh</option>
              @for (p of properties(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>

          <button
            type="button"
            (click)="onSearch()"
            class="min-h-11 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Tìm kiếm
          </button>
        </div>

        <!-- Staff Directory -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
          @if (loading()) {
            <div class="p-8 text-center text-slate-400 space-y-2">
              <i class="pi pi-spin pi-spinner text-2xl text-emerald-600" aria-hidden="true"></i>
              <div class="text-xs">Đang tải danh sách nhân sự...</div>
            </div>
          } @else if (sortedStaffList().length === 0) {
            <app-empty-state
              iconClass="pi pi-users"
              title="Chưa có nhân viên nào"
              description="Không tìm thấy nhân viên phù hợp với bộ lọc. Hãy thêm nhân viên mới để phân công quản lý chi nhánh."
            ></app-empty-state>
          } @else {
            <!-- Mobile Card View (< md) -->
            <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              @for (member of sortedStaffList(); track member.id) {
                <div class="p-4 space-y-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                        {{ member.fullName.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <div class="font-bold text-slate-900 dark:text-slate-100 truncate">{{ member.fullName }}</div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ member.email }}</div>
                        <div class="text-[11px] text-slate-400 tabular-nums">{{ member.phoneNumber || 'Chưa có SĐT' }}</div>
                      </div>
                    </div>
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0"
                      [ngClass]="getRoleBadgeClass(member.staffRole)"
                    >
                      {{ member.roleName || getRoleLabel(member.staffRole) }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    @if (member.isTenantWide) {
                      <span class="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                        <i class="pi pi-globe text-[10px]" aria-hidden="true"></i> Toàn chuỗi (HQ)
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-[11px]">
                        <i class="pi pi-building text-[10px] text-emerald-600" aria-hidden="true"></i>
                        {{ member.propertyName || 'Chi nhánh cụ thể' }}
                      </span>
                    }
                    @if (member.isActive) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span> Đang hoạt động
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true"></span> Tạm khóa
                      </span>
                    }
                  </div>

                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      (click)="openEditModal(member)"
                      [attr.aria-label]="'Chỉnh sửa phân công nhân viên ' + member.fullName"
                      class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                    >
                      <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      (click)="confirmDelete(member)"
                      [attr.aria-label]="'Thu hồi phân công nhân viên ' + member.fullName"
                      class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                    >
                      <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Desktop Table (>= md) -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                <thead class="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('fullName')">
                      <button
                        type="button"
                        (click)="toggleSort('fullName')"
                        class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                      >
                        <span>Họ và tên</span>
                        <i class="pi text-[10px]" [ngClass]="getSortIcon('fullName')" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="px-5 py-3.5">Liên hệ</th>
                    <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('roleName')">
                      <button
                        type="button"
                        (click)="toggleSort('roleName')"
                        class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                      >
                        <span>Chức danh / Vai trò</span>
                        <i class="pi text-[10px]" [ngClass]="getSortIcon('roleName')" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('propertyName')">
                      <button
                        type="button"
                        (click)="toggleSort('propertyName')"
                        class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                      >
                        <span>Phân công cơ sở</span>
                        <i class="pi text-[10px]" [ngClass]="getSortIcon('propertyName')" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('isActive')">
                      <button
                        type="button"
                        (click)="toggleSort('isActive')"
                        class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                      >
                        <span>Trạng thái</span>
                        <i class="pi text-[10px]" [ngClass]="getSortIcon('isActive')" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  @for (member of sortedStaffList(); track member.id) {
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td class="px-5 py-3.5">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                            {{ member.fullName.charAt(0).toUpperCase() }}
                          </div>
                          <div>
                            <div class="font-bold text-slate-900 dark:text-slate-100">{{ member.fullName }}</div>
                            <div class="text-[10px] text-slate-400 font-mono tabular-nums">ID: {{ member.id.slice(0, 8) }}</div>
                          </div>
                        </div>
                      </td>

                      <td class="px-5 py-3.5">
                        <div class="text-slate-800 dark:text-slate-200">{{ member.email }}</div>
                        <div class="text-[11px] text-slate-400 tabular-nums">{{ member.phoneNumber || 'Chưa có SĐT' }}</div>
                      </td>

                      <td class="px-5 py-3.5">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                          [ngClass]="getRoleBadgeClass(member.staffRole)"
                        >
                          {{ member.roleName || getRoleLabel(member.staffRole) }}
                        </span>
                      </td>

                      <td class="px-5 py-3.5">
                        @if (member.isTenantWide) {
                          <span class="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                            <i class="pi pi-globe text-[10px]" aria-hidden="true"></i> Toàn chuỗi (HQ)
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-[11px]">
                            <i class="pi pi-building text-[10px] text-emerald-600" aria-hidden="true"></i>
                            {{ member.propertyName || 'Chi nhánh cụ thể' }}
                          </span>
                        }
                      </td>

                      <td class="px-5 py-3.5">
                        @if (member.isActive) {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span> Đang hoạt động
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true"></span> Tạm khóa
                          </span>
                        }
                      </td>

                      <td class="px-5 py-3.5 text-right space-x-1">
                        <button
                          type="button"
                          (click)="openEditModal(member)"
                          [attr.aria-label]="'Chỉnh sửa phân công nhân viên ' + member.fullName"
                          class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                          title="Chỉnh sửa vai trò"
                        >
                          <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          (click)="confirmDelete(member)"
                          [attr.aria-label]="'Thu hồi phân công nhân viên ' + member.fullName"
                          class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                          title="Xóa phân công"
                        >
                          <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <app-pagination
                [totalCount]="totalCount()"
                [pageSize]="pageSize()"
                [page]="currentPage()"
                (pageChange)="onPageChange($event)"
              ></app-pagination>
            </div>
          }
        </div>
      }

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- TAB 2: QUẢN LÝ CHỨC VỤ & CẤP QUYỀN CRUD (RolesManagementComponent)     -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'roles') {
        <app-roles-management
          [showHeader]="false"
          (rolesChanged)="loadRolesAndFunctions()"
        ></app-roles-management>
      }

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- MODAL: CẤU HÌNH CHỨC VỤ & CẤP QUYỀN CRUD                                -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (showRoleModal()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-role-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="closeRoleModal()"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-5xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 id="staff-role-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i class="pi pi-shield text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>{{ isEditingRole() ? 'Chỉnh sửa Quyền Chức vụ & Ma trận CRUD' : 'Tạo Chức vụ Mới & Cấp quyền CRUD' }}</span>
              </h2>
              <button
                type="button"
                (click)="closeRoleModal()"
                aria-label="Đóng cửa sổ cấu hình chức vụ"
                class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label for="staff-role-code" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã chức vụ (Code) *</label>
                  <input
                    id="staff-role-code"
                    type="text"
                    [(ngModel)]="roleForm.code"
                    [disabled]="isEditingRole()"
                    placeholder="VD: ACCOUNTANT, SALES, SECURITY"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                  />
                  <p class="text-[10px] text-slate-400 mt-1">Chữ hoa, số và gạch dưới (không đổi sau khi tạo).</p>
                </div>

                <div>
                  <label for="staff-role-name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tên chức vụ hiển thị *</label>
                  <input
                    id="staff-role-name"
                    type="text"
                    [(ngModel)]="roleForm.name"
                    placeholder="VD: Kế toán trưởng, Nhân viên kinh doanh"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="staff-role-desc" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mô tả chức năng &amp; quyền hạn</label>
                  <input
                    id="staff-role-desc"
                    type="text"
                    [(ngModel)]="roleForm.description"
                    placeholder="Mô tả phạm vi trách nhiệm của vị trí này..."
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <app-permissions-matrix
                [rows]="matrixRows()"
                (rowsChange)="matrixRows.set($event)"
              ></app-permissions-matrix>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                (click)="closeRoleModal()"
                class="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
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
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- MODAL: THÊM NHÂN VIÊN MỚI                                               -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (showCreateModal()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-create-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="closeCreateModal()"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 id="staff-create-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i class="pi pi-user-plus text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                <span>Thêm nhân viên mới</span>
              </h2>
              <button
                type="button"
                (click)="closeCreateModal()"
                aria-label="Đóng cửa sổ thêm nhân viên"
                class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <div class="space-y-3.5 text-xs">
              <div>
                <label for="staff-create-name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Họ và tên *</label>
                <input
                  id="staff-create-name"
                  type="text"
                  [(ngModel)]="createForm.fullName"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label for="staff-create-email" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email đăng nhập *</label>
                <input
                  id="staff-create-email"
                  type="email"
                  [(ngModel)]="createForm.email"
                  placeholder="an.nguyen@hotel.com"
                  class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="staff-create-phone" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                  <input
                    id="staff-create-phone"
                    type="text"
                    [(ngModel)]="createForm.phoneNumber"
                    placeholder="0912345678"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label for="staff-create-password" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mật khẩu ban đầu (tùy chọn)</label>
                  <input
                    id="staff-create-password"
                    type="password"
                    [(ngModel)]="createForm.password"
                    placeholder="Bỏ trống để gửi email mời thiết lập"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Nếu bỏ trống, hệ thống sẽ tạo mật khẩu ngẫu nhiên an toàn và gửi liên kết kích hoạt qua email.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="staff-create-role" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức vụ / Vai trò *</label>
                  <select
                    id="staff-create-role"
                    [(ngModel)]="selectedCreateRoleId"
                    (change)="onRoleSelectionChange()"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    @for (r of allRoles(); track r.id) {
                      <option [value]="r.id">{{ r.name }} ({{ r.code }})</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="staff-create-property" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cơ sở phân công</label>
                  <select
                    id="staff-create-property"
                    [(ngModel)]="createForm.propertyId"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="null">Toàn chuỗi (HQ Tenant-wide)</option>
                    @for (p of properties(); track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                (click)="closeCreateModal()"
                class="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitCreate()"
                [disabled]="submitting()"
                class="min-h-11 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                @if (submitting()) {
                  <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
                }
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- MODAL: CHỈNH SỬA PHÂN CÔNG NHÂN VIÊN                                    -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      @if (showEditModal() && editingMember()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-edit-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="closeEditModal()"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 id="staff-edit-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i class="pi pi-pencil text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                <span>Chỉnh sửa thông tin nhân sự</span>
              </h2>
              <button
                type="button"
                (click)="closeEditModal()"
                aria-label="Đóng cửa sổ chỉnh sửa nhân sự"
                class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <div class="space-y-3.5 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 space-y-1">
                <div class="font-bold text-slate-800 dark:text-slate-100 text-sm">{{ editingMember()!.fullName }}</div>
                <div class="text-slate-500 dark:text-slate-400 tabular-nums">{{ editingMember()!.email }} &bull; {{ editingMember()!.phoneNumber || 'Chưa có SĐT' }}</div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="staff-edit-role" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức danh / Vai trò</label>
                  <select
                    id="staff-edit-role"
                    [(ngModel)]="selectedEditRoleId"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    @for (r of allRoles(); track r.id) {
                      <option [value]="r.id">{{ r.name }} ({{ r.code }})</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="staff-edit-property" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cơ sở phân công</label>
                  <select
                    id="staff-edit-property"
                    [(ngModel)]="editForm.propertyId"
                    class="w-full min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="null">Toàn chuỗi (HQ Tenant-wide)</option>
                    @for (p of properties(); track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="pt-2">
                <label class="min-h-11 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="editForm.isActive"
                    class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span class="font-semibold text-slate-800 dark:text-slate-100">Kích hoạt tài khoản làm việc</span>
                </label>
                <p class="text-[11px] text-slate-400 mt-0.5 ml-6">
                  Khi bỏ chọn, nhân viên sẽ bị tạm khóa quyền truy cập vào hệ thống PMS.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                (click)="closeEditModal()"
                class="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitEdit()"
                [disabled]="submitting()"
                class="min-h-11 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                @if (submitting()) {
                  <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
                }
                <span>Cập nhật</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class StaffPage implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly StaffRole = StaffRole;

  activeTab = signal<'staff' | 'roles'>('staff');

  staffList = signal<StaffMemberDto[]>([]);
  allRoles = signal<AccessRoleDto[]>([]);
  rolesWithPermissions = signal<RoleDetailDto[]>([]);
  permissionFunctions = signal<PermissionFunctionDto[]>([]);
  properties = signal<{ id: string; name: string }[]>([]);

  loading = signal<boolean>(false);
  loadingRoles = signal<boolean>(false);
  submitting = signal<boolean>(false);
  submittingRole = signal<boolean>(false);

  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);

  sortField = signal<StaffSortField>('fullName');
  sortDirection = signal<'asc' | 'desc'>('asc');

  searchKeyword = '';
  selectedRoleFilter: StaffRole | null = null;
  selectedPropertyFilter: string | null = null;

  showCreateModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  showRoleModal = signal<boolean>(false);
  isEditingRole = signal<boolean>(false);

  editingMember = signal<StaffMemberDto | null>(null);
  editingRoleId = '';

  selectedCreateRoleId = '';
  selectedEditRoleId = '';

  createForm: CreateStaffMemberRequest = {
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    propertyId: null,
    staffRole: StaffRole.Receptionist
  };

  editForm: UpdateStaffMemberRequest = {
    id: '',
    propertyId: null,
    staffRole: StaffRole.Receptionist,
    isActive: true
  };

  roleForm = {
    code: '',
    name: '',
    description: ''
  };

  matrixRows = signal<PermissionMatrixRow[]>([]);

  countManagers = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Manager || s.staffRole === StaffRole.Owner).length
  );

  countReceptionists = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Receptionist).length
  );

  countHousekeepers = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Housekeeper).length
  );

  sortedStaffList = computed(() => {
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    return [...this.staffList()].sort((a, b) => {
      switch (field) {
        case 'roleName':
          return (a.roleName || this.getRoleLabel(a.staffRole)).localeCompare(b.roleName || this.getRoleLabel(b.staffRole), 'vi') * dir;
        case 'propertyName':
          return (a.propertyName || (a.isTenantWide ? 'Toàn chuỗi (HQ)' : '')).localeCompare(b.propertyName || (b.isTenantWide ? 'Toàn chuỗi (HQ)' : ''), 'vi') * dir;
        case 'isActive':
          return (Number(a.isActive) - Number(b.isActive)) * dir;
        case 'fullName':
        default:
          return a.fullName.localeCompare(b.fullName, 'vi') * dir;
      }
    });
  });

  ngOnInit(): void {
    this.loadProperties();
    this.loadRolesAndFunctions();
    this.loadStaff();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showRoleModal() && !this.submittingRole()) {
      this.closeRoleModal();
    } else if (this.showEditModal() && !this.submitting()) {
      this.closeEditModal();
    } else if (this.showCreateModal() && !this.submitting()) {
      this.closeCreateModal();
    }
  }

  toggleSort(field: StaffSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'isActive' ? 'desc' : 'asc');
    }
  }

  getAriaSort(field: StaffSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(field: StaffSortField): string {
    if (this.sortField() !== field) return 'pi-sort-alt text-slate-400';
    return this.sortDirection() === 'asc' ? 'pi-sort-amount-up text-emerald-600' : 'pi-sort-amount-down text-emerald-600';
  }

  loadProperties(): void {
    this.propertyService.getTenantProperties().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (props: TenantPropertySummaryDto[]) => this.properties.set(props.map(p => ({ id: p.id, name: p.name }))),
      error: () => {}
    });
  }

  loadRolesAndFunctions(): void {
    this.loadingRoles.set(true);
    this.staffService.getRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.allRoles.set(r);
        if (r.length > 0 && !this.selectedCreateRoleId) {
          this.selectedCreateRoleId = r[0].id;
        }
      },
      error: () => {}
    });

    this.staffService.getPermissionFunctions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: f => this.permissionFunctions.set(f),
      error: () => {}
    });

    this.staffService.getRolesWithPermissions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: details => {
        this.rolesWithPermissions.set(details);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.loadingRoles.set(false);
      }
    });
  }

  loadStaff(): void {
    this.loading.set(true);
    this.staffService
      .getStaffMembers({
        search: this.searchKeyword,
        propertyId: this.selectedPropertyFilter || undefined,
        staffRole: this.selectedRoleFilter ?? undefined,
        page: this.currentPage(),
        pageSize: this.pageSize()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.staffList.set(res.items);
          this.totalCount.set(res.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.alertService.toastError('Không thể tải danh sách nhân viên.');
        }
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadStaff();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadStaff();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadStaff();
  }

  getRoleLabel(role: StaffRole): string {
    return STAFF_ROLE_LABELS[role] || 'Nhân viên';
  }

  getRoleBadgeClass(role: StaffRole): string {
    return STAFF_ROLE_BADGES[role] || 'bg-slate-100 text-slate-800 border-slate-200';
  }

  getCrudShortSummary(p: RolePermissionDto): string {
    const letters: string[] = [];
    const canRead = p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0;
    const canCreate = p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0;
    const canUpdate = p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0;
    const canDelete = p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0;
    if (canRead) letters.push('R');
    if (canCreate) letters.push('C');
    if (canUpdate) letters.push('U');
    if (canDelete) letters.push('D');
    return letters.join('');
  }

  onRoleSelectionChange(): void {
    const role = this.allRoles().find(r => r.id === this.selectedCreateRoleId);
    if (role) {
      if (role.code === 'OWNER') this.createForm.staffRole = StaffRole.Owner;
      else if (role.code === 'MANAGER') this.createForm.staffRole = StaffRole.Manager;
      else if (role.code === 'HOUSEKEEPER') this.createForm.staffRole = StaffRole.Housekeeper;
      else this.createForm.staffRole = StaffRole.Receptionist;
    }
  }

  openCreateModal(): void {
    const defaultRole = this.allRoles()[0];
    this.selectedCreateRoleId = defaultRole ? defaultRole.id : '';
    this.createForm = {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      propertyId: this.authService.activePropertyId() || null,
      staffRole: StaffRole.Receptionist
    };
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  submitCreate(): void {
    if (!this.createForm.fullName.trim() || !this.createForm.email.trim()) {
      this.alertService.toastError('Vui lòng điền họ tên và email hợp lệ.');
      return;
    }

    const trimmedPassword = (this.createForm.password || '').trim();
    if (trimmedPassword.length > 0 && trimmedPassword.length < 8) {
      this.alertService.toastError('Mật khẩu tùy chỉnh phải có ít nhất 8 ký tự.');
      return;
    }

    const payload: CreateStaffMemberRequest = {
      ...this.createForm,
      fullName: this.createForm.fullName.trim(),
      email: this.createForm.email.trim().toLowerCase(),
      phoneNumber: this.createForm.phoneNumber?.trim() || undefined,
      password: trimmedPassword || undefined,
      roleId: this.selectedCreateRoleId,
      confirmCustomerPromotion: false,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined
    };

    this.dispatchCreateStaff(payload);
  }

  private dispatchCreateStaff(payload: CreateStaffMemberRequest): void {
    this.submitting.set(true);
    this.staffService.createStaffMember(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: created => {
        this.submitting.set(false);
        this.closeCreateModal();
        const successMsg = created?.invitedViaEmail
          ? `Đã thêm nhân sự và gửi email mời thiết lập mật khẩu đến ${created.email}.`
          : 'Thêm nhân sự mới thành công.';
        this.alertService.toastSuccess(successMsg);
        this.loadStaff();
        this.loadRolesAndFunctions();
      },
      error: err => {
        this.submitting.set(false);
        if (err.error?.errorCode === 'ERR_CUSTOMER_ACCOUNT_EXISTS' && !payload.confirmCustomerPromotion) {
          void this.confirmCustomerPromotion(payload, err.error?.message);
          return;
        }
        const msg = err.error?.message || 'Không thể tạo nhân viên mới.';
        this.alertService.toastError(msg);
      }
    });
  }

  private async confirmCustomerPromotion(
    payload: CreateStaffMemberRequest,
    serverMessage?: string
  ): Promise<void> {
    const confirmed = await this.alertService.confirmAction({
      title: 'Tài khoản Khách hàng đã tồn tại',
      text:
        serverMessage ||
        'Tài khoản email này đang là Khách hàng trên hệ thống. Bạn có chắc muốn nâng cấp thành Nhân sự PMS không?',
      confirmButtonText: 'Nâng cấp thành Nhân sự',
      cancelButtonText: 'Hủy bỏ',
      icon: 'warning'
    });

    if (confirmed) {
      this.dispatchCreateStaff({ ...payload, confirmCustomerPromotion: true });
    }
  }

  openEditModal(member: StaffMemberDto): void {
    this.editingMember.set(member);
    this.selectedEditRoleId = member.roleId;
    this.editForm = {
      id: member.id,
      propertyId: member.propertyId || null,
      roleId: member.roleId,
      staffRole: member.staffRole,
      isActive: member.isActive
    };
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingMember.set(null);
  }

  submitEdit(): void {
    if (!this.editForm.id) return;

    this.editForm.roleId = this.selectedEditRoleId;

    this.submitting.set(true);
    this.staffService.updateStaffMember(this.editForm.id, this.editForm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEditModal();
        this.alertService.toastSuccess('Cập nhật nhân sự thành công.');
        this.loadStaff();
        this.loadRolesAndFunctions();
      },
      error: err => {
        this.submitting.set(false);
        const msg = err.error?.message || 'Không thể cập nhật thông tin nhân viên.';
        this.alertService.toastError(msg);
      }
    });
  }

  async confirmDelete(member: StaffMemberDto): Promise<void> {
    const confirmed = await this.alertService.confirmDelete({
      title: 'Thu hồi phân công nhân sự?',
      text: `Bạn có chắc chắn muốn thu hồi phân công nhân sự của "${member.fullName}"?`
    });
    if (confirmed) {
      this.staffService.deleteStaffMember(member.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.toastSuccess('Đã thu hồi phân công nhân sự.');
          this.loadStaff();
          this.loadRolesAndFunctions();
        },
        error: err => {
          const msg = err.error?.message || 'Không thể xóa phân công nhân sự.';
          this.alertService.toastError(msg);
        }
      });
    }
  }

  // ── Role Management Methods ──────────────────────────────────────────────

  openCreateRoleModal(): void {
    this.isEditingRole.set(false);
    this.editingRoleId = '';
    this.roleForm = {
      code: '',
      name: '',
      description: ''
    };

    const functions = this.permissionFunctions();
    this.matrixRows.set(functions.map(f => ({
      functionId: f.id,
      code: f.code,
      name: f.name,
      moduleCode: f.moduleCode,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false
    })));

    this.showRoleModal.set(true);
  }

  openEditRoleModal(role: RoleDetailDto): void {
    this.isEditingRole.set(true);
    this.editingRoleId = role.id;
    this.roleForm = {
      code: role.code,
      name: role.name,
      description: role.description || ''
    };

    const functions = this.permissionFunctions();
    const permMap = new Map(role.permissions.map(p => [p.functionId, p]));

    this.matrixRows.set(functions.map(f => {
      const existing = permMap.get(f.id) || role.permissions.find(p => p.functionCode === f.code);
      return {
        functionId: f.id,
        code: f.code,
        name: f.name,
        moduleCode: f.moduleCode,
        canRead: existing ? (existing.canRead ?? (existing.actionMask & 1) !== 0) : false,
        canCreate: existing ? (existing.canCreate ?? (existing.actionMask & 2) !== 0) : false,
        canUpdate: existing ? (existing.canUpdate ?? (existing.actionMask & 4) !== 0) : false,
        canDelete: existing ? (existing.canDelete ?? (existing.actionMask & 8) !== 0) : false
      };
    }));

    this.showRoleModal.set(true);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
  }

  toggleRow(row: PermissionMatrixRow): void {
    const allChecked = row.canRead && row.canCreate && row.canUpdate && row.canDelete;
    row.canRead = !allChecked;
    row.canCreate = !allChecked;
    row.canUpdate = !allChecked;
    row.canDelete = !allChecked;
    this.matrixRows.set([...this.matrixRows()]);
  }

  toggleAllPermissions(checked: boolean): void {
    const rows = this.matrixRows().map(r => ({
      ...r,
      canRead: checked,
      canCreate: checked,
      canUpdate: checked,
      canDelete: checked
    }));
    this.matrixRows.set(rows);
  }

  submitRole(): void {
    if (!this.roleForm.name.trim()) {
      this.alertService.toastError('Vui lòng nhập tên chức vụ.');
      return;
    }

    if (!this.isEditingRole() && !this.roleForm.code.trim()) {
      this.alertService.toastError('Vui lòng nhập mã chức vụ (chữ in hoa).');
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

    if (this.isEditingRole()) {
      const req: UpdateRoleRequest = {
        id: this.editingRoleId,
        name: this.roleForm.name.trim(),
        description: this.roleForm.description?.trim(),
        permissions
      };

      this.staffService.updateRole(this.editingRoleId, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.submittingRole.set(false);
          this.closeRoleModal();
          this.alertService.toastSuccess('Cập nhật chức vụ và phân quyền CRUD thành công.');
          this.loadRolesAndFunctions();
        },
        error: err => {
          this.submittingRole.set(false);
          this.alertService.toastError(err.error?.message || 'Không thể cập nhật chức vụ.');
        }
      });
    } else {
      const req: CreateRoleRequest = {
        code: this.roleForm.code.trim().toUpperCase(),
        name: this.roleForm.name.trim(),
        description: this.roleForm.description?.trim(),
        permissions
      };

      this.staffService.createRole(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.submittingRole.set(false);
          this.closeRoleModal();
          this.alertService.toastSuccess('Tạo chức vụ mới và cấp quyền CRUD thành công.');
          this.loadRolesAndFunctions();
        },
        error: err => {
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
      this.staffService.deleteRole(role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.toastSuccess('Đã xóa chức vụ thành công.');
          this.loadRolesAndFunctions();
        },
        error: err => {
          this.alertService.toastError(err.error?.message || 'Không thể xóa chức vụ.');
        }
      });
    }
  }
}
