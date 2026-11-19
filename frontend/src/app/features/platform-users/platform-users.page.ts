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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import {
  StatusBadgeColor,
  StatusBadgeComponent
} from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';
import {
  PlatformGlobalRole,
  PlatformGovernanceService,
  PlatformUserDto,
  PlatformUserSummaryDto
} from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';

type RoleFilterOption = 'ALL' | PlatformGlobalRole;
type StatusFilterOption = 'ALL' | 'ACTIVE' | 'LOCKED';

const EMPTY_SUMMARY: PlatformUserSummaryDto = {
  totalUsers: 0,
  superAdminCount: 0,
  tenantStaffCount: 0,
  customerCount: 0,
  activeCount: 0,
  lockedCount: 0
};

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const inner = (err as { error?: unknown }).error;
    if (typeof inner === 'object' && inner !== null) {
      const record = inner as Record<string, unknown>;
      if (typeof record['message'] === 'string' && record['message'].trim()) {
        return record['message'];
      }
      if (typeof record['detail'] === 'string' && record['detail'].trim()) {
        return record['detail'];
      }
    }
  }
  return fallback;
}

@Component({
  selector: 'app-platform-users-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    A11yModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    PaginationComponent,
    BusinessDateTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 max-w-7xl mx-auto pb-12">
      <app-page-header
        title="Quản trị Người dùng & Tài khoản Admin"
        subtitle="Quản lý tập trung tài khoản SuperAdmin nền tảng, chủ cơ sở đối tác và khách hàng đặt phòng trên toàn hệ thống."
      >
        <button
          type="button"
          (click)="loadUsers()"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
          <span>Làm mới</span>
        </button>

        <button
          type="button"
          data-testid="open-create-admin-btn"
          (click)="openCreateModal()"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <i class="pi pi-user-plus text-sm" aria-hidden="true"></i>
          <span>Tạo tài khoản Admin</span>
        </button>
      </app-page-header>

      <!-- KPI Overview -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card
          title="Tổng tài khoản"
          [value]="summary().totalUsers"
          [subtitle]="summary().activeCount + ' hoạt động • ' + summary().lockedCount + ' đã khóa'"
          variant="slate"
        >
          <i icon class="pi pi-users text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="SuperAdmin nền tảng"
          [value]="summary().superAdminCount"
          variant="indigo"
        >
          <i icon class="pi pi-shield text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="Chủ cơ sở & Nhân sự"
          [value]="summary().tenantStaffCount"
          variant="emerald"
        >
          <i icon class="pi pi-building text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="Khách hàng B2C"
          [value]="summary().customerCount"
          variant="amber"
        >
          <i icon class="pi pi-user text-lg" aria-hidden="true"></i>
        </app-stat-card>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
          <div class="relative flex-1 min-w-[240px] max-w-md">
            <label for="platform-user-search" class="sr-only">Tìm kiếm người dùng</label>
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
            <input
              id="platform-user-search"
              type="text"
              [ngModel]="searchKeyword()"
              (ngModelChange)="searchKeyword.set($event)"
              (keydown.enter)="applyFilters()"
              aria-label="Tìm kiếm người dùng"
              placeholder="Tìm theo họ tên, email, username, số điện thoại..."
              class="w-full min-h-11 pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <label for="platform-user-role-filter" class="sr-only">Lọc theo vai trò hệ thống</label>
          <select
            id="platform-user-role-filter"
            [ngModel]="roleFilter()"
            (ngModelChange)="onRoleFilterChange($event)"
            aria-label="Lọc theo vai trò hệ thống"
            class="min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="SuperAdmin">SuperAdmin</option>
            <option value="TenantStaff">TenantStaff</option>
            <option value="Customer">Customer</option>
          </select>

          <label for="platform-user-status-filter" class="sr-only">Lọc theo trạng thái tài khoản</label>
          <select
            id="platform-user-status-filter"
            [ngModel]="statusFilter()"
            (ngModelChange)="onStatusFilterChange($event)"
            aria-label="Lọc theo trạng thái tài khoản"
            class="min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          @if (hasActiveFilters()) {
            <button
              type="button"
              (click)="resetFilters()"
              class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <i class="pi pi-filter-slash text-xs" aria-hidden="true"></i>
              <span>Xóa lọc</span>
            </button>
          }

          <button
            type="button"
            data-testid="apply-filters-btn"
            (click)="applyFilters()"
            class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-colors cursor-pointer"
          >
            <i class="pi pi-filter text-xs" aria-hidden="true"></i>
            <span>Áp dụng lọc</span>
          </button>
        </div>
      </div>

      <!-- Users Data Table -->
      @if (isLoading()) {
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2" aria-hidden="true"></i>
          <p class="text-sm">Đang tải danh sách tài khoản toàn hệ thống...</p>
        </div>
      } @else if (users().length === 0) {
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
          <app-empty-state
            iconClass="pi pi-users"
            title="Không tìm thấy người dùng phù hợp"
            description="Thử thay đổi từ khóa tìm kiếm, vai trò hoặc bộ lọc trạng thái."
            actionLabel="Xóa bộ lọc"
            (actionClick)="resetFilters()"
          />
        </div>
      } @else {
        <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs overflow-hidden">
          <!-- Mobile Stacked Cards (<768px) -->
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800" data-testid="platform-users-mobile-cards">
            @for (u of users(); track u.id) {
              <article class="p-4 space-y-3 text-xs">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                      [ngClass]="normalizeRole(u.globalRole) === 'SuperAdmin'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/35'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'"
                    >
                      {{ getUserInitial(u) }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {{ u.fullName }}
                        </span>
                        @if (isCurrentUser(u)) {
                          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Đang đăng nhập
                          </span>
                        }
                      </div>
                      <div class="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                        &#64;{{ u.username }}
                      </div>
                    </div>
                  </div>
                  <app-status-badge
                    [status]="u.isActive"
                    [customLabel]="u.isActive ? 'Đang hoạt động' : 'Đã khóa'"
                    [color]="u.isActive ? 'emerald' : 'rose'"
                  />
                </div>

                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <app-status-badge
                    [status]="normalizeRole(u.globalRole)"
                    [customLabel]="getRoleLabel(u)"
                    [color]="getRoleBadgeColor(u.globalRole)"
                  />
                  <span class="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {{ u.createdAtUtc | businessDateTime }}
                  </span>
                </div>

                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 space-y-1.5">
                  <div class="font-medium text-slate-800 dark:text-slate-200 break-all">
                    <i class="pi pi-envelope mr-1.5 text-slate-400" aria-hidden="true"></i>{{ u.email }}
                  </div>
                  <div class="text-slate-600 dark:text-slate-400 tabular-nums">
                    <i class="pi pi-phone mr-1.5 text-slate-400" aria-hidden="true"></i>{{ u.phoneNumber || 'Chưa cập nhật SĐT' }}
                  </div>
                  <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-200/70 dark:border-slate-700">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">
                      {{ u.defaultTenantName || 'Nền tảng SaaS' }}
                    </span>
                    <span class="text-slate-500 dark:text-slate-400 tabular-nums">
                      {{ u.membershipsCount }} phân quyền cơ sở
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border"
                      [ngClass]="u.emailVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                    >
                      <i [class]="u.emailVerified ? 'pi pi-check-circle text-xs' : 'pi pi-clock text-xs'" aria-hidden="true"></i>
                      <span>{{ u.emailVerified ? 'Email xác thực' : 'Email chưa xác thực' }}</span>
                    </span>
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border"
                      [ngClass]="u.phoneVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                    >
                      <i [class]="u.phoneVerified ? 'pi pi-check-circle text-xs' : 'pi pi-minus-circle text-xs'" aria-hidden="true"></i>
                      <span>{{ u.phoneVerified ? 'SĐT xác thực' : 'SĐT chưa xác thực' }}</span>
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    [attr.data-testid]="'mobile-toggle-status-btn-' + u.id"
                    [disabled]="isCurrentUser(u) || busyUserId() === u.id"
                    (click)="toggleUserStatus(u)"
                    class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    [ngClass]="u.isActive
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300'"
                  >
                    <i [class]="u.isActive ? 'pi pi-lock text-xs' : 'pi pi-unlock text-xs'" aria-hidden="true"></i>
                    <span>{{ u.isActive ? 'Khóa' : 'Mở khóa' }}</span>
                  </button>

                  <button
                    type="button"
                    [attr.data-testid]="'mobile-change-role-btn-' + u.id"
                    [disabled]="isCurrentUser(u) || busyUserId() === u.id"
                    (click)="changeUserRole(u)"
                    class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    [ngClass]="normalizeRole(u.globalRole) === 'SuperAdmin'
                      ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300'"
                  >
                    <i
                      [class]="normalizeRole(u.globalRole) === 'SuperAdmin' ? 'pi pi-user-minus text-xs' : 'pi pi-shield text-xs'"
                      aria-hidden="true"
                    ></i>
                    <span>
                      {{ normalizeRole(u.globalRole) === 'SuperAdmin' ? 'Chuyển về Khách hàng' : 'Cấp SuperAdmin' }}
                    </span>
                  </button>
                </div>
              </article>
            }
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="py-3.5 px-4">Người dùng</th>
                  <th scope="col" class="py-3.5 px-4">Liên hệ &amp; Xác thực</th>
                  <th scope="col" class="py-3.5 px-4">Vai trò hệ thống</th>
                  <th scope="col" class="py-3.5 px-4">Thuê bao / Cơ sở</th>
                  <th scope="col" class="py-3.5 px-4">Ngày tạo</th>
                  <th scope="col" class="py-3.5 px-4">Trạng thái</th>
                  <th scope="col" class="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (u of users(); track u.id) {
                  <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <!-- Người dùng -->
                    <td class="py-3.5 px-4">
                      <div class="flex items-center gap-3 min-w-[200px]">
                        <div
                          class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                          [ngClass]="normalizeRole(u.globalRole) === 'SuperAdmin'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/35'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'"
                        >
                          {{ getUserInitial(u) }}
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {{ u.fullName }}
                            </span>
                            @if (isCurrentUser(u)) {
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Đang đăng nhập
                              </span>
                            }
                          </div>
                          <div class="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            &#64;{{ u.username }}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Liên hệ & Xác thực -->
                    <td class="py-3.5 px-4">
                      <div class="space-y-1.5 min-w-[210px]">
                        <div class="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          <i class="pi pi-envelope mr-1.5 text-slate-400" aria-hidden="true"></i>{{ u.email }}
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <i class="pi pi-phone mr-1.5 text-slate-400" aria-hidden="true"></i>{{ u.phoneNumber || 'Chưa cập nhật SĐT' }}
                        </div>
                        <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                            [ngClass]="u.emailVerified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                          >
                            <i [class]="u.emailVerified ? 'pi pi-check-circle text-[10px]' : 'pi pi-clock text-[10px]'" aria-hidden="true"></i>
                            <span>{{ u.emailVerified ? 'Email xác thực' : 'Email chưa xác thực' }}</span>
                          </span>
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                            [ngClass]="u.phoneVerified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                          >
                            <i [class]="u.phoneVerified ? 'pi pi-check-circle text-[10px]' : 'pi pi-minus-circle text-[10px]'" aria-hidden="true"></i>
                            <span>{{ u.phoneVerified ? 'SĐT xác thực' : 'SĐT chưa xác thực' }}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <!-- Vai trò hệ thống -->
                    <td class="py-3.5 px-4 whitespace-nowrap">
                      <app-status-badge
                        [status]="normalizeRole(u.globalRole)"
                        [customLabel]="getRoleLabel(u)"
                        [color]="getRoleBadgeColor(u.globalRole)"
                      />
                    </td>

                    <!-- Thuê bao / Cơ sở -->
                    <td class="py-3.5 px-4">
                      <div class="min-w-[160px] space-y-1">
                        <div class="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {{ u.defaultTenantName || 'Nền tảng SaaS' }}
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {{ u.membershipsCount }} phân quyền cơ sở
                        </div>
                      </div>
                    </td>

                    <!-- Ngày tạo -->
                    <td class="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {{ u.createdAtUtc | businessDateTime }}
                    </td>

                    <!-- Trạng thái -->
                    <td class="py-3.5 px-4 whitespace-nowrap">
                      <app-status-badge
                        [status]="u.isActive"
                        [customLabel]="u.isActive ? 'Đang hoạt động' : 'Đã khóa'"
                        [color]="u.isActive ? 'emerald' : 'rose'"
                      />
                    </td>

                    <!-- Thao tác -->
                    <td class="py-3.5 px-4 text-right">
                      <div class="inline-flex items-center justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          [attr.data-testid]="'toggle-status-btn-' + u.id"
                          [disabled]="isCurrentUser(u) || busyUserId() === u.id"
                          (click)="toggleUserStatus(u)"
                          class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                          [ngClass]="u.isActive
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300'"
                        >
                          <i [class]="u.isActive ? 'pi pi-lock text-xs' : 'pi pi-unlock text-xs'" aria-hidden="true"></i>
                          <span>{{ u.isActive ? 'Khóa' : 'Mở khóa' }}</span>
                        </button>

                        <button
                          type="button"
                          [attr.data-testid]="'change-role-btn-' + u.id"
                          [disabled]="isCurrentUser(u) || busyUserId() === u.id"
                          (click)="changeUserRole(u)"
                          class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                          [ngClass]="normalizeRole(u.globalRole) === 'SuperAdmin'
                            ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300'"
                        >
                          <i
                            [class]="normalizeRole(u.globalRole) === 'SuperAdmin' ? 'pi pi-user-minus text-xs' : 'pi pi-shield text-xs'"
                            aria-hidden="true"
                          ></i>
                          <span>
                            {{ normalizeRole(u.globalRole) === 'SuperAdmin' ? 'Chuyển về Khách hàng' : 'Cấp SuperAdmin' }}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination
            [page]="page()"
            [pageSize]="pageSize()"
            [totalCount]="totalCount()"
            [pageSizeOptions]="[20, 50, 100]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </section>
      }
    </div>

    <!-- Create Platform SuperAdmin Modal -->
    @if (showCreateModal()) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="closeCreateModal()"
        (click)="closeCreateModal()"
        class="fixed inset-0 z-[65] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div class="px-6 py-4 bg-indigo-950 text-white flex items-center justify-between">
            <div>
              <h2 id="create-admin-modal-title" class="text-base font-bold">
                Tạo tài khoản Quản trị Nền tảng (SuperAdmin)
              </h2>
              <p class="text-xs text-indigo-200 mt-0.5">
                Tài khoản được cấp quyền quản trị SaaS toàn cục và kích hoạt ngay lập tức.
              </p>
            </div>
            <button
              type="button"
              aria-label="Đóng hộp thoại tạo tài khoản Admin"
              (click)="closeCreateModal()"
              class="min-w-11 min-h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>

          <form [formGroup]="createAdminForm" (ngSubmit)="submitCreateAdmin()" class="p-6 space-y-4" novalidate>
            <div>
              <label for="create-admin-fullname" class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Họ và tên <span class="text-rose-600">*</span>
              </label>
              <input
                id="create-admin-fullname"
                type="text"
                formControlName="fullName"
                placeholder="Nguyễn Văn Quản Trị"
                class="w-full min-h-11 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              @if (hasFieldError('fullName')) {
                <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">Vui lòng nhập họ và tên quản trị viên.</p>
              }
            </div>

            <div>
              <label for="create-admin-email" class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Địa chỉ Email <span class="text-rose-600">*</span>
              </label>
              <input
                id="create-admin-email"
                type="email"
                formControlName="email"
                placeholder="admin@hotelsaas.vn"
                class="w-full min-h-11 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              @if (hasFieldError('email')) {
                <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">Vui lòng nhập địa chỉ email hợp lệ.</p>
              }
            </div>

            <div>
              <label for="create-admin-phone" class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Số điện thoại liên hệ (Tùy chọn)
              </label>
              <input
                id="create-admin-phone"
                type="tel"
                formControlName="phoneNumber"
                placeholder="0901234567"
                class="w-full min-h-11 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 tabular-nums"
              />
            </div>

            <div>
              <label for="create-admin-password" class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Mật khẩu khởi tạo (tối thiểu 8 ký tự) <span class="text-rose-600">*</span>
              </label>
              <input
                id="create-admin-password"
                type="password"
                formControlName="password"
                placeholder="••••••••"
                class="w-full min-h-11 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              @if (hasFieldError('password')) {
                <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">Mật khẩu phải có ít nhất 8 ký tự.</p>
              }
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeCreateModal()"
                class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                data-testid="submit-create-admin-btn"
                [disabled]="isSubmitting()"
                class="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                } @else {
                  <i class="pi pi-check text-xs" aria-hidden="true"></i>
                }
                <span>Tạo SuperAdmin</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class PlatformUsersPage implements OnInit {
  private readonly governanceService = inject(PlatformGovernanceService);
  private readonly alertService = inject(AlertService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly loggedInUserId = signal<string | null>(null);

  readonly summary = signal<PlatformUserSummaryDto>(EMPTY_SUMMARY);
  readonly users = signal<PlatformUserDto[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(50);

  readonly isLoading = signal(false);
  readonly busyUserId = signal<string | null>(null);
  readonly showCreateModal = signal(false);
  readonly isSubmitting = signal(false);

  readonly searchKeyword = signal('');
  readonly roleFilter = signal<RoleFilterOption>('ALL');
  readonly statusFilter = signal<StatusFilterOption>('ALL');

  readonly currentUserId = computed(
    () => this.loggedInUserId() ?? this.authService.currentUser?.id ?? null
  );

  readonly hasActiveFilters = computed(
    () =>
      this.searchKeyword().trim().length > 0 ||
      this.roleFilter() !== 'ALL' ||
      this.statusFilter() !== 'ALL'
  );

  readonly createAdminForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [''],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    this.loggedInUserId.set(this.authService.currentUser?.id ?? null);
    if (this.authService.currentUser$) {
      this.authService.currentUser$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(user => {
          this.loggedInUserId.set(user?.id ?? this.authService.currentUser?.id ?? null);
        });
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showCreateModal()) {
      this.closeCreateModal();
    }
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    const status = this.statusFilter();
    const isActive = status === 'ACTIVE' ? true : status === 'LOCKED' ? false : null;

    this.governanceService
      .getPlatformUsers({
        search: this.searchKeyword(),
        role: this.roleFilter(),
        isActive,
        page: this.page(),
        pageSize: this.pageSize()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.summary.set(res?.summary ?? EMPTY_SUMMARY);
          this.users.set(res?.items ?? []);
          this.totalCount.set(res?.totalCount ?? 0);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          this.isLoading.set(false);
          this.alertService.error(
            extractApiErrorMessage(err, 'Không thể tải danh sách người dùng nền tảng.')
          );
        }
      });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadUsers();
  }

  onRoleFilterChange(role: RoleFilterOption): void {
    this.roleFilter.set(role);
    this.page.set(1);
    this.loadUsers();
  }

  onStatusFilterChange(status: StatusFilterOption): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadUsers();
  }

  resetFilters(): void {
    this.searchKeyword.set('');
    this.roleFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.page.set(1);
    this.loadUsers();
  }

  onPageChange(targetPage: number): void {
    this.page.set(targetPage);
    this.loadUsers();
  }

  onPageSizeChange(targetPageSize: number): void {
    this.pageSize.set(targetPageSize);
    this.page.set(1);
    this.loadUsers();
  }

  isCurrentUser(user: PlatformUserDto): boolean {
    const currentId = this.currentUserId();
    return !!currentId && user.id === currentId;
  }

  normalizeRole(role: PlatformGlobalRole | number): PlatformGlobalRole {
    if (role === 'SuperAdmin' || role === 1) return 'SuperAdmin';
    if (role === 'TenantStaff' || role === 3) return 'TenantStaff';
    return 'Customer';
  }

  getRoleLabel(user: PlatformUserDto): string {
    if (user.globalRoleName?.trim()) {
      return user.globalRoleName;
    }
    const normalized = this.normalizeRole(user.globalRole);
    if (normalized === 'SuperAdmin') return 'Quản trị nền tảng (SuperAdmin)';
    if (normalized === 'TenantStaff') return 'Chủ cơ sở & Nhân sự';
    return 'Khách hàng B2C';
  }

  getRoleBadgeColor(role: PlatformGlobalRole | number): StatusBadgeColor {
    const normalized = this.normalizeRole(role);
    if (normalized === 'SuperAdmin') return 'purple';
    if (normalized === 'TenantStaff') return 'emerald';
    return 'blue';
  }

  getUserInitial(user: PlatformUserDto): string {
    const source = (user.fullName || user.email || '?').trim();
    return source.charAt(0).toUpperCase();
  }

  openCreateModal(): void {
    this.createAdminForm.reset({
      fullName: '',
      email: '',
      phoneNumber: '',
      password: ''
    });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.showCreateModal.set(false);
  }

  hasFieldError(controlName: 'fullName' | 'email' | 'password'): boolean {
    const ctrl = this.createAdminForm.controls[controlName];
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  submitCreateAdmin(): void {
    if (this.createAdminForm.invalid) {
      this.createAdminForm.markAllAsTouched();
      return;
    }

    const raw = this.createAdminForm.getRawValue();
    this.isSubmitting.set(true);
    this.governanceService
      .createPlatformAdmin({
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        password: raw.password,
        phoneNumber: raw.phoneNumber.trim() || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: created => {
          this.isSubmitting.set(false);
          this.showCreateModal.set(false);
          this.createAdminForm.reset();
          this.alertService.success(`Đã tạo tài khoản SuperAdmin "${created.email}" thành công.`);
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.isSubmitting.set(false);
          this.alertService.error(
            extractApiErrorMessage(err, 'Không thể tạo tài khoản SuperAdmin.')
          );
        }
      });
  }

  async toggleUserStatus(user: PlatformUserDto): Promise<void> {
    if (this.isCurrentUser(user)) {
      return;
    }

    const targetIsActive = !user.isActive;
    const actionLabel = targetIsActive ? 'Mở khóa tài khoản' : 'Khóa tài khoản';
    const confirmed = await this.alertService.confirmAction({
      title: `${actionLabel}?`,
      text: `Bạn có chắc chắn muốn ${actionLabel.toLowerCase()} "${user.fullName}" (${user.email})?`,
      confirmButtonText: targetIsActive ? 'Mở khóa' : 'Khóa tài khoản',
      cancelButtonText: 'Hủy',
      icon: 'warning'
    });
    if (!confirmed) {
      return;
    }

    this.busyUserId.set(user.id);
    this.governanceService
      .togglePlatformUserStatus(user.id, {
        targetIsActive,
        reason: `${actionLabel} từ trang Quản trị Người dùng`
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.busyUserId.set(null);
          this.alertService.success(
            updated.isActive
              ? `Đã mở khóa tài khoản "${updated.email}".`
              : `Đã khóa tài khoản "${updated.email}".`
          );
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.busyUserId.set(null);
          this.alertService.error(
            extractApiErrorMessage(err, 'Không thể cập nhật trạng thái tài khoản.')
          );
        }
      });
  }

  async changeUserRole(user: PlatformUserDto): Promise<void> {
    if (this.isCurrentUser(user)) {
      return;
    }

    const currentRole = this.normalizeRole(user.globalRole);
    const targetRole: PlatformGlobalRole =
      currentRole === 'SuperAdmin' ? 'Customer' : 'SuperAdmin';
    const actionTitle =
      targetRole === 'SuperAdmin'
        ? 'Cấp quyền SuperAdmin nền tảng?'
        : 'Chuyển tài khoản về vai trò Khách hàng?';

    const confirmed = await this.alertService.confirmAction({
      title: actionTitle,
      text: `Xác nhận cập nhật vai trò của "${user.fullName}" (${user.email}) sang ${targetRole}?`,
      confirmButtonText: targetRole === 'SuperAdmin' ? 'Cấp SuperAdmin' : 'Chuyển vai trò',
      cancelButtonText: 'Hủy',
      icon: 'warning'
    });
    if (!confirmed) {
      return;
    }

    this.busyUserId.set(user.id);
    this.governanceService
      .updatePlatformUserRole(user.id, { targetRole })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.busyUserId.set(null);
          this.alertService.success(
            `Đã cập nhật vai trò tài khoản "${updated.email}" thành ${this.normalizeRole(updated.globalRole)}.`
          );
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.busyUserId.set(null);
          this.alertService.error(
            extractApiErrorMessage(err, 'Không thể cập nhật vai trò tài khoản.')
          );
        }
      });
  }
}
