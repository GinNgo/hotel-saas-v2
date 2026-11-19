import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { ContextSelectorDialogComponent } from '../../features/auth/context-selector/context-selector.dialog';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SystemBannerBarComponent } from '../../shared/components/system-banner-bar/system-banner-bar.component';
import { NotificationItem } from '../../shared/components/notification-bell/notification-bell.model';
import { UserMembershipDto } from '../../core/models/auth.model';

/**
 * Admin Layout chung cho hệ thống quản trị Hotel SaaS.
 * Hỗ trợ 2 Shell tách biệt: `pms-ops` (Vận hành cơ sở/chuỗi) & `governance` (Quản trị nền tảng SuperAdmin).
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    A11yModule,
    ContextSelectorDialogComponent,
    NotificationBellComponent,
    BreadcrumbComponent,
    SystemBannerBarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .skip-link {
      position: absolute;
      top: 0;
      left: 1rem;
      z-index: var(--z-toast, 100);
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--surface-card);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
      font-weight: 600;
      transform: translateY(-120%);
      transition: transform var(--duration-fast, 150ms) ease;
    }
    .skip-link:focus {
      transform: translateY(0.5rem);
    }
  `],
  template: `
    <div
      [attr.data-shell]="isSuperAdmin() ? 'governance' : 'pms-ops'"
      class="flex h-screen w-full overflow-hidden bg-[var(--surface-canvas)] text-[var(--text-primary)]"
    >
      <a href="#admin-main-content" class="skip-link">Đến nội dung chính</a>

      <!-- Mobile Sidebar Backdrop -->
      @if (isMobileSidebarOpen()) {
        <div
          class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          (click)="closeMobileSidebar()"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        id="admin-sidebar-nav"
        [attr.role]="isMobileSidebarOpen() ? 'dialog' : null"
        [attr.aria-modal]="isMobileSidebarOpen() ? 'true' : null"
        [attr.aria-label]="isMobileSidebarOpen() ? 'Thanh điều hướng quản trị' : null"
        [cdkTrapFocus]="isMobileSidebarOpen()"
        [cdkTrapFocusAutoCapture]="isMobileSidebarOpen()"
        (keydown.escape)="closeMobileSidebar()"
        class="fixed lg:static inset-y-0 left-0 z-[45] lg:z-auto flex flex-col w-64 bg-[var(--surface-card)] border-r border-[var(--border-subtle)] transition-transform duration-200 ease-out shadow-xs"
        [class.translate-x-0]="isMobileSidebarOpen()"
        [class.-translate-x-full]="!isMobileSidebarOpen()"
        [class.lg:translate-x-0]="true"
      >
        <!-- Logo Header -->
        <div class="flex items-center gap-3 px-4 lg:px-6 h-16 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
          <div
            class="flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-xs shrink-0"
            [class]="isSuperAdmin() ? 'bg-indigo-700 shadow-indigo-700/30' : 'bg-emerald-600 shadow-emerald-600/30'"
          >
            <i class="pi pi-building text-base" aria-hidden="true"></i>
          </div>
          <div class="min-w-0">
            <span class="text-base font-bold text-[var(--text-primary)] tracking-tight">Hotel SaaS</span>
            <span
              class="block text-xs font-medium"
              [class]="isSuperAdmin() ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-700 dark:text-emerald-400'"
            >
              {{ isSuperAdmin() ? 'Platform Governance' : 'Bản quyền 2026' }}
            </span>
          </div>
          <button
            type="button"
            (click)="closeMobileSidebar()"
            aria-label="Đóng thanh điều hướng"
            class="lg:hidden ml-auto inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <i class="pi pi-times text-sm" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Navigation Menu -->
        <nav aria-label="Menu quản trị" class="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          @if (!isSuperAdmin()) {
            <!-- Active Modules Group (Tenant PMS) -->
            <div class="space-y-1">
              <div class="px-3 pb-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Nghiệp vụ hoạt động</div>

              <a
                routerLink="/dashboard"
                routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-home text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                <span>Tổng quan</span>
              </a>

              @if (hasPropertiesPermission()) {
                <a
                  routerLink="/properties"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-building text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Cơ sở & Chi nhánh</span>
                  <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">HQ</span>
                </a>
              }

              @if (hasRoomsPermission()) {
                <a
                  routerLink="/rooms"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-th-large text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Quản lý phòng</span>
                </a>
              }

              @if (hasRoomTypesPermission()) {
                <a
                  routerLink="/room-types"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-tags text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Loại phòng</span>
                </a>
              }

              @if (hasHousekeepingPermission()) {
                <a
                  routerLink="/housekeeping"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-sparkles text-base text-amber-600 dark:text-amber-400" aria-hidden="true"></i>
                  <span>Buồng phòng</span>
                </a>
              }

              @if (hasPoliciesPermission()) {
                <a
                  routerLink="/policies"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-sliders-h text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Chính sách & Mẫu in</span>
                </a>
              }

              @if (hasRatesPermission()) {
                <a
                  routerLink="/rates"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-dollar text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Bảng giá phòng</span>
                </a>
              }

              @if (hasReservationsPermission()) {
                <a
                  routerLink="/reservations"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-calendar text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Đặt phòng</span>
                </a>
              }

              @if (hasPaymentsPermission()) {
                <a
                  routerLink="/payments"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-wallet text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Thu ngân & Giao dịch</span>
                </a>
              }

              @if (hasReportsPermission()) {
                <a
                  routerLink="/reports"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-chart-bar text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Báo cáo & Thống kê</span>
                </a>
              }

              @if (hasSubscriptionsPermission()) {
                <a
                  routerLink="/subscriptions"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-box text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Gói cước SaaS</span>
                </a>
              }

              @if (hasGuestsPermission()) {
                <a
                  routerLink="/guests"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-id-card text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Khách hàng (CRM)</span>
                </a>
              }

              @if (hasPromotionsPermission()) {
                <a
                  routerLink="/promotions"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-ticket text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Khuyến mãi &amp; Voucher</span>
                </a>
              }

              @if (hasReviewsPermission()) {
                <a
                  routerLink="/reviews"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-star text-base text-amber-500" aria-hidden="true"></i>
                  <span>Đánh giá khách hàng</span>
                </a>
              }

              @if (isOwnerOrManager()) {
                <a
                  routerLink="/staff"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-users text-base text-indigo-700 dark:text-indigo-400" aria-hidden="true"></i>
                  <span>Nhân sự & Phân quyền</span>
                  <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">RBAC</span>
                </a>

                <a
                  routerLink="/roles"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-shield text-base text-indigo-700 dark:text-indigo-400" aria-hidden="true"></i>
                  <span>Quản lý Vai trò</span>
                  <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Roles</span>
                </a>

                <a
                  routerLink="/audit-logs"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-history text-base text-emerald-700 dark:text-emerald-400" aria-hidden="true"></i>
                  <span>Nhật ký kiểm toán</span>
                  <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Audit</span>
                </a>

                <a
                  routerLink="/support-grants"
                  routerLinkActive="bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                  (click)="onNavItemClick()"
                  class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
                >
                  <i class="pi pi-key text-base text-indigo-700 dark:text-indigo-400" aria-hidden="true"></i>
                  <span>Ủy quyền hỗ trợ</span>
                </a>
              }
            </div>
          }

          @if (isSuperAdmin()) {
            <!-- Platform Administrator Management Group -->
            <div class="space-y-1">
              <div class="px-3 pb-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                <span>Quản trị Nền tảng</span>
                <i class="pi pi-shield text-xs text-indigo-400" aria-hidden="true"></i>
              </div>

              <a
                routerLink="/dashboard"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-chart-line text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Tổng quan Nền tảng</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">SaaS</span>
              </a>

              <a
                routerLink="/platform-tenants"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-building text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Đối tác &amp; Chi nhánh</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Tenant</span>
              </a>

              <a
                routerLink="/plans"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-sliders-v text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Cấu hình gói Tenant</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Admin</span>
              </a>

              <a
                routerLink="/contracts"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-file-edit text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Hợp đồng Đối tác</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Admin</span>
              </a>

              <a
                routerLink="/admin-banners"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-megaphone text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Banner Nền tảng</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">CMS</span>
              </a>

              <a
                routerLink="/ops-readiness"
                routerLinkActive="bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 min-h-11 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-all"
              >
                <i class="pi pi-server text-base text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                <span>Kiểm định & Giám sát SRE</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">SRE</span>
              </a>
            </div>
          }

          <!-- Quick Navigation to Public Guest Portal -->
          <div class="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
            <div class="px-3 pb-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Cổng Đặt phòng Công khai
            </div>
            <a
              routerLink="/booking"
              (click)="onNavItemClick()"
              class="flex items-center justify-between px-3.5 min-h-11 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-emerald-700 hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10 transition-all"
            >
              <div class="flex items-center gap-2.5 truncate">
                <i class="pi pi-globe text-sm text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                <span class="truncate font-medium">Trang Đặt phòng Khách</span>
              </div>
              <i class="pi pi-external-link text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
            </a>
          </div>
        </nav>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50">
          <div class="text-xs text-[var(--text-muted)] font-medium flex items-center justify-between">
            <span>Phiên bản v2.0</span>
            <span class="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none"></span> Online
            </span>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
        <!-- Topbar Header -->
        <header class="flex items-center justify-between h-16 px-3 sm:px-4 lg:px-6 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] z-30 shadow-2xs">
          <!-- Left: Toggle & Active Branch Context -->
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              #mobileMenuToggle
              type="button"
              (click)="toggleMobileSidebar()"
              [attr.aria-expanded]="isMobileSidebarOpen()"
              aria-controls="admin-sidebar-nav"
              class="lg:hidden inline-flex items-center justify-center min-h-11 min-w-11 p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors shrink-0 cursor-pointer"
              aria-label="Mở thanh điều hướng"
            >
              <i class="pi pi-bars text-base sm:text-lg" aria-hidden="true"></i>
            </button>

            @if (isSuperAdmin()) {
              <div class="flex items-center gap-2 min-h-11 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200">
                <div class="flex items-center justify-center px-2 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                  PLATFORM
                </div>
                <div class="text-xs font-semibold truncate">
                  Quản trị Nền tảng SaaS (SuperAdmin)
                </div>
              </div>
            } @else {
              <!-- Context Switcher Pill (Bấm để chọn/đổi chi nhánh hoặc quản lý chuỗi) -->
              <button
                type="button"
                (click)="openBranchSwitcher()"
                class="group flex items-center gap-2 sm:gap-2.5 min-h-11 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/80 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:border-emerald-300 transition-all duration-200 cursor-pointer shadow-2xs text-left max-w-[200px] sm:max-w-[320px] lg:max-w-none min-w-0"
                title="Nhấn để đổi chi nhánh làm việc hoặc chuyển sang HQ"
                aria-label="Đổi chi nhánh làm việc hoặc chuyển sang HQ"
              >
                <div class="flex items-center justify-center min-w-[26px] px-1.5 h-6 sm:h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold shrink-0 whitespace-nowrap shadow-xs">
                  {{ authService.activePropertyCode() || 'HQ' }}
                </div>
                <div class="min-w-0 pr-1 truncate">
                  <div class="flex items-center gap-1.5 truncate">
                    <span class="text-xs font-extrabold uppercase text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                      {{ tenantBrandName }}
                    </span>
                    <span class="text-xs font-semibold text-[var(--text-primary)] group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate">
                      {{ authService.activePropertyName() || 'Chế độ Chuỗi HQ' }}
                    </span>
                  </div>
                  <div class="text-xs text-[var(--text-muted)] group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate hidden sm:block">
                    Nhấn để đổi chi nhánh
                  </div>
                </div>
                <i class="pi pi-chevron-down text-xs text-[var(--text-muted)] group-hover:text-emerald-600 ml-0.5 sm:ml-1 shrink-0" aria-hidden="true"></i>
              </button>
            }
          </div>

          <!-- Right: User Avatar & Logout -->
          @if (currentUser(); as user) {
            <div class="flex items-center gap-2 sm:gap-3 shrink-0">
              <!-- Theme Toggle Button (Light / Dark Mode) -->
              <button
                type="button"
                (click)="themeService.toggleTheme()"
                class="inline-flex items-center justify-center min-h-11 min-w-11 w-11 h-11 rounded-xl bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all cursor-pointer"
                [attr.aria-label]="themeService.isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
                [title]="themeService.isDark() ? 'Chuyển sang chế độ Sáng (Light Mode)' : 'Chuyển sang chế độ Tối (Dark Mode)'"
                data-testid="admin-theme-toggle-btn"
              >
                <i [class]="themeService.isDark() ? 'pi pi-sun text-amber-400 text-sm' : 'pi pi-moon text-[var(--text-primary)] text-sm'" aria-hidden="true"></i>
              </button>

              <!-- Trung tâm thông báo (Notification Bell T01-A) -->
              <app-notification-bell
                [notifications]="notificationService.notifications()"
                [activeTenantId]="user.tenantId || activeTenantId"
                [activePropertyId]="authService.activePropertyId()"
                [loading]="notificationService.loading()"
                [errorMessage]="notificationService.errorMessage()"
                [canMarkAsRead]="notificationService.canMarkAsRead()"
                (notificationSelect)="onNotificationSelect($event)"
                (markAsReadRequest)="notificationService.markAsRead($event)"
                (markAllAsReadRequest)="notificationService.markAllAsRead()"
              />

              <div class="h-4 sm:h-5 w-px bg-[var(--border-subtle)] hidden sm:block" aria-hidden="true"></div>

              <!-- User Info Pill -->
              <div class="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 py-1">
                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                  {{ user.fullName.charAt(0).toUpperCase() }}
                </div>
                <div class="hidden md:block text-right">
                  <div class="text-xs font-semibold text-[var(--text-primary)] leading-tight">{{ user.fullName }}</div>
                  <div class="text-xs text-[var(--text-muted)] leading-tight">
                    {{ authService.activeRoleName() || user.globalRole || 'Nhân viên' }}
                  </div>
                </div>
              </div>

              <div class="h-4 sm:h-5 w-px bg-[var(--border-subtle)] hidden sm:block" aria-hidden="true"></div>

              <!-- Logout Button -->
              <button
                type="button"
                (click)="logout()"
                class="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 sm:px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-xl transition-colors border border-rose-200/80 dark:border-rose-500/30 cursor-pointer"
                title="Đăng xuất khỏi hệ thống"
                aria-label="Đăng xuất khỏi hệ thống"
              >
                <i class="pi pi-sign-out" aria-hidden="true"></i>
                <span class="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          }
        </header>

        <!-- Main Page View Container -->
        <main id="admin-main-content" tabindex="-1" class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--surface-canvas)] focus:outline-none">
          <app-system-banner-bar />
          <app-breadcrumb class="block mb-4 sm:mb-6" />
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- Modal Đổi chi nhánh từ Topbar -->
    <app-context-selector-dialog
      [visible]="showBranchDialog()"
      (visibleChange)="showBranchDialog.set($event)"
      [requireSelection]="false"
      (contextSwitched)="onBranchChanged($event)"
    />
  `
})
export class AdminLayoutComponent {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  readonly notificationService = inject(NotificationService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  @ViewChild('mobileMenuToggle') private mobileMenuToggle?: ElementRef<HTMLButtonElement>;

  readonly currentUser = toSignal(this.authService.currentUser$, {
    initialValue: this.authService.currentUser
  });
  readonly memberships = toSignal(this.authService.memberships$, {
    initialValue: this.authService.memberships
  });
  readonly isSuperAdmin = computed(() => this.currentUser()?.globalRole === 'SuperAdmin');

  isMobileSidebarOpen = signal(false);
  showBranchDialog = signal(false);

  constructor() {
    this.notificationService.enableRealtimeNotifications();
    effect(() => {
      const propId = this.authService.activePropertyId();
      const tenantId = this.activeTenantId;
      void this.notificationService.syncContext(tenantId, propId);
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onDocumentEscape(event: Event): void {
    if (this.isMobileSidebarOpen()) {
      event.preventDefault();
      this.closeMobileSidebar(true);
    }
  }

  get tenantBrandName(): string {
    const membership = this.memberships()[0];
    return membership?.tenantName || 'HQ Chuỗi';
  }

  get activeTenantId(): string | null {
    return this.currentUser()?.tenantId || this.memberships()[0]?.tenantId || null;
  }

  hasPropertiesPermission(): boolean {
    return this.authService.isTenantWide || this.authService.hasPermission('PROPERTIES', 1);
  }

  hasRoomsPermission(): boolean {
    return this.authService.hasPermission('ROOMS', 1);
  }

  hasRoomTypesPermission(): boolean {
    return this.authService.hasPermission('ROOM_TYPES', 1);
  }

  hasRatesPermission(): boolean {
    return this.authService.hasPermission('ROOM_TYPES', 1);
  }

  hasHousekeepingPermission(): boolean {
    return this.authService.hasPermission('HOUSEKEEPING', 1) || this.authService.hasPermission('ROOMS', 1);
  }

  hasPoliciesPermission(): boolean {
    return this.authService.hasPermission('PROPERTIES', 1);
  }

  hasReservationsPermission(): boolean {
    return this.authService.hasPermission('RESERVATIONS', 1);
  }

  hasPaymentsPermission(): boolean {
    return this.authService.hasPermission('PAYMENTS', 1);
  }

  hasGuestsPermission(): boolean {
    return this.authService.hasPermission('GUESTS', 1);
  }

  hasReportsPermission(): boolean {
    return this.authService.hasPermission('REPORTS', 1);
  }

  hasSubscriptionsPermission(): boolean {
    return this.authService.hasPermission('SUBSCRIPTIONS', 1);
  }

  hasPromotionsPermission(): boolean {
    return this.authService.hasPermission('PROMOTIONS', 1);
  }

  hasReviewsPermission(): boolean {
    return this.authService.hasPermission('REVIEWS', 1);
  }

  isOwnerOrManager(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.globalRole === 'Owner') return true;
    const activeRole = this.authService.activeRoleName();
    if (activeRole === 'Owner' || activeRole === 'Manager') return true;
    if (this.authService.hasPermission('STAFF', 1) || this.authService.hasPermission('ROLES', 1)) return true;
    return this.memberships().some(m => m.staffRole === 'Owner' || m.staffRole === 'Manager');
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(restoreFocus = true): void {
    if (!this.isMobileSidebarOpen()) return;
    this.isMobileSidebarOpen.set(false);
    if (restoreFocus) {
      queueMicrotask(() => this.mobileMenuToggle?.nativeElement.focus());
    }
  }

  onNavItemClick(): void {
    this.isMobileSidebarOpen.set(false);
  }

  openBranchSwitcher(): void {
    this.showBranchDialog.set(true);
  }

  onBranchChanged(membership: UserMembershipDto): void {
    this.showBranchDialog.set(false);
    void this.notificationService.syncContext(membership.tenantId, membership.propertyId);
    // Tải lại router view để các component lấy dữ liệu theo context mới
    const currentUrl = this.router.url;
    const currentPath = currentUrl.split('?')[0];
    const targetUrl =
      membership.propertyId === null
        ? (currentPath === '/dashboard' ? '/dashboard' : '/properties')
        : currentUrl;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      void this.router.navigateByUrl(targetUrl);
    });
  }

  onNotificationSelect(item: NotificationItem): void {
    const code = item.metadata?.confirmationCode || undefined;
    const resId = item.metadata?.reservationId || undefined;
    const roomNumber = item.metadata?.roomNumber || undefined;
    const refundableAmount = item.metadata?.refundableAmount ?? 0;
    const canReadPayments = this.authService.hasPermission('PAYMENTS', 1);
    const t = Date.now();

    switch (item.type) {
      case 'BookingCancellationRequested':
        if (refundableAmount > 0 && canReadPayments) {
          void this.router.navigate(['/payments'], {
            queryParams: { tab: 'refunds', code, reservationId: resId, t }
          });
        } else {
          void this.router.navigate(['/reservations'], {
            queryParams: { code, reservationId: resId, t }
          });
        }
        return;

      case 'BookingPaymentConfirmed':
        if (canReadPayments) {
          void this.router.navigate(['/payments'], {
            queryParams: { tab: 'cashier', code, reservationId: resId, t }
          });
        } else {
          void this.router.navigate(['/reservations'], {
            queryParams: { code, reservationId: resId, t }
          });
        }
        return;

      case 'HoldExpired':
        void this.router.navigate(['/reservations'], {
          queryParams: { view: 'timeline', code, reservationId: resId, t }
        });
        return;

      case 'RoomNeedsCleaning':
      case 'RoomCleaningCompleted':
        void this.router.navigate(['/housekeeping'], {
          queryParams: { room: roomNumber, t }
        });
        return;

      case 'NewReservation':
      case 'ReservationCancelled':
        void this.router.navigate(['/reservations'], {
          queryParams: { code, reservationId: resId, t }
        });
        return;
    }
  }

  logout(): void {
    void this.notificationService.cleanupOnLogout();
    this.authService.logout();
  }
}
