import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { ContextSelectorDialogComponent } from '../../features/auth/context-selector/context-selector.dialog';
import { UserMembershipDto } from '../../core/models/auth.model';

/**
 * Admin Layout chung cho hệ thống quản trị Hotel SaaS.
 * Định hướng Visual:
 * - Nền sáng, trung tính ấm (#fbfbfa, slate-50/stone-50). Không dùng sidebar đen nặng nề.
 * - Sidebar hiện đại, nền trắng kem nhạt, phân cách bằng viền mảnh và bóng đổ siêu nhẹ.
 * - Thanh Topbar tích hợp Bộ chuyển chi nhánh (Context Switcher) trực quan, hiển thị chi nhánh hiện hành.
 * - Tôn trọng prefers-reduced-motion, animation tinh tế.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AsyncPipe,
    ContextSelectorDialogComponent
  ],
  template: `
    <div class="flex h-screen w-screen overflow-hidden bg-[#fbfbfa]">
      <!-- Mobile Sidebar Backdrop -->
      @if (isMobileSidebarOpen()) {
        <div
          class="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden transition-opacity"
          (click)="toggleMobileSidebar()"
        ></div>
      }

      <!-- Sidebar Nền sáng trung tính -->
      <aside
        class="fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-slate-200/80 transition-transform duration-200 ease-out shadow-xs"
        [class.translate-x-0]="isMobileSidebarOpen()"
        [class.-translate-x-full]="!isMobileSidebarOpen()"
        [class.lg:translate-x-0]="true"
      >
        <!-- Logo Header -->
        <div class="flex items-center gap-3 px-6 h-16 border-b border-slate-100 bg-white">
          <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-xs shadow-emerald-600/30">
            <i class="pi pi-building text-base"></i>
          </div>
          <div>
            <span class="text-base font-bold text-slate-800 tracking-tight">Hotel SaaS</span>
            <span class="block text-[11px] text-emerald-700 font-medium">Bản quyền 2026</span>
          </div>
        </div>

        <!-- Navigation Menu -->
        <nav class="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          <!-- Active Modules Group -->
          <div class="space-y-1">
            <div class="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nghiệp vụ hoạt động</div>

            <a
              routerLink="/dashboard"
              routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="onNavItemClick()"
              class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
            >
              <i class="pi pi-home text-base text-emerald-700"></i>
              <span>Tổng quan</span>
            </a>

            @if (hasRoomsPermission()) {
              <a
                routerLink="/rooms"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-th-large text-base text-emerald-700"></i>
                <span>Quản lý phòng</span>
              </a>
            }

            @if (hasRoomTypesPermission()) {
              <a
                routerLink="/room-types"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-tags text-base text-emerald-700"></i>
                <span>Loại phòng</span>
              </a>
            }

            @if (hasHousekeepingPermission()) {
              <a
                routerLink="/housekeeping"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-sparkles text-base text-amber-600"></i>
                <span>Buồng phòng</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mới</span>
              </a>
            }

            @if (hasPoliciesPermission()) {
              <a
                routerLink="/policies"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-sliders-h text-base text-emerald-700"></i>
                <span>Chính sách chi nhánh</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mới</span>
              </a>
            }

            @if (hasRatesPermission()) {
              <a
                routerLink="/rates"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-dollar text-base text-emerald-700"></i>
                <span>Bảng giá phòng</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mới</span>
              </a>
            }

            @if (hasReservationsPermission()) {
              <a
                routerLink="/reservations"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-calendar text-base text-emerald-700"></i>
                <span>Đặt phòng</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mới</span>
              </a>
            }

            @if (hasPaymentsPermission()) {
              <a
                routerLink="/payments"
                routerLinkActive="bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600 shadow-2xs"
                (click)="onNavItemClick()"
                class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
              >
                <i class="pi pi-wallet text-base text-emerald-700"></i>
                <span>Thu ngân & Giao dịch</span>
                <span class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mới</span>
              </a>
            }
          </div>

          <!-- Pending Review & Roadmap Group (Chưa triển khai / Bị Blocker) -->
          <div class="space-y-1 pt-2 border-t border-slate-100">
            <div class="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Chờ duyệt & Roadmap</span>
              <i class="pi pi-lock text-[10px] text-slate-400"></i>
            </div>

            <!-- Khách hàng -->
            <button
              type="button"
              (click)="showUnimplementedNotice('guests')"
              class="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer text-left"
              title="Quản lý khách hàng (Chưa triển khai)"
            >
              <div class="flex items-center gap-2.5 truncate">
                <i class="pi pi-users text-sm"></i>
                <span class="truncate">Khách hàng</span>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 shrink-0">Chưa có</span>
            </button>

            <!-- Nhân sự & Phân quyền -->
            <button
              type="button"
              (click)="showUnimplementedNotice('staff')"
              class="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer text-left"
              title="Nhân sự & Phân quyền (Chưa có API được duyệt)"
            >
              <div class="flex items-center gap-2.5 truncate">
                <i class="pi pi-id-card text-sm"></i>
                <span class="truncate">Nhân sự & Roles</span>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 shrink-0">Chưa có</span>
            </button>
          </div>
        </nav>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-slate-100 bg-slate-50/50">
          <div class="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Phiên bản v2.0</span>
            <span class="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
            </span>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
        <!-- Topbar Header Nền sáng hiện đại -->
        <header class="flex items-center justify-between h-16 px-3 sm:px-4 lg:px-6 bg-white border-b border-slate-200/80 z-10 shadow-2xs">
          <!-- Left: Toggle & Active Branch Context -->
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              (click)="toggleMobileSidebar()"
              class="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Mở thanh điều hướng"
            >
              <i class="pi pi-bars text-base sm:text-lg"></i>
            </button>

            <!-- Context Switcher Pill (Bấm để chọn/đổi chi nhánh) -->
            <button
              type="button"
              (click)="openBranchSwitcher()"
              class="group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 cursor-pointer shadow-2xs text-left max-w-[155px] sm:max-w-[240px] lg:max-w-none min-w-0"
              title="Nhấn để đổi chi nhánh làm việc"
              aria-label="Đổi chi nhánh làm việc"
            >
              <div class="flex items-center justify-center min-w-[24px] px-1.5 h-6 sm:h-7 rounded-lg bg-emerald-600 text-white text-[10px] sm:text-xs font-bold shrink-0 whitespace-nowrap">
                {{ authService.activePropertyCode() || 'CN' }}
              </div>
              <div class="min-w-0 pr-1 truncate">
                <div class="text-[11px] sm:text-xs font-semibold text-slate-800 group-hover:text-emerald-800 truncate">
                  {{ authService.activePropertyName() || 'Chưa chọn chi nhánh' }}
                </div>
                <div class="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-emerald-700 truncate hidden sm:block">
                  Nhấn để đổi chi nhánh
                </div>
              </div>
              <i class="pi pi-chevron-down text-[9px] sm:text-[10px] text-slate-400 group-hover:text-emerald-600 ml-0.5 sm:ml-1 shrink-0"></i>
            </button>
          </div>

          <!-- Right: User Avatar & Logout -->
          @if (authService.currentUser$ | async; as user) {
            <div class="flex items-center gap-2 sm:gap-4 shrink-0">
              <!-- User Info Pill -->
              <div class="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 py-1">
                <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 shrink-0">
                  {{ user.fullName.charAt(0).toUpperCase() }}
                </div>
                <div class="hidden md:block text-right">
                  <div class="text-xs font-semibold text-slate-800 leading-tight">{{ user.fullName }}</div>
                  <div class="text-[10px] text-slate-500 leading-tight">
                    {{ authService.activeRoleName() || user.globalRole || 'Nhân viên' }}
                  </div>
                </div>
              </div>

              <div class="h-4 sm:h-5 w-px bg-slate-200 hidden sm:block"></div>

              <!-- Logout Button -->
              <button
                type="button"
                (click)="logout()"
                class="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200/80"
                title="Đăng xuất khỏi hệ thống"
                aria-label="Đăng xuất khỏi hệ thống"
              >
                <i class="pi pi-sign-out"></i>
                <span class="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          }
        </header>

        <!-- Main Page View Container -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#fbfbfa]">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- Modal Đổi chi nhánh từ Topbar -->
    <app-context-selector-dialog
      [(visible)]="showBranchDialog"
      [requireSelection]="false"
      (contextSwitched)="onBranchChanged($event)"
    />
  `
})
export class AdminLayoutComponent {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  isMobileSidebarOpen = signal(false);
  showBranchDialog = false;

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

  showUnimplementedNotice(key: string): void {
    this.isMobileSidebarOpen.set(false);
    switch (key) {
      case 'pricing':
        this.alertService.showNotice(
          'Bảng giá phòng & Lịch sử (Task tiếp theo)',
          'Chức năng Quản lý Bảng giá phòng (Rates) và Lịch sử giá sẽ được triển khai ở task P2-RATES-UI-01 ngay sau khi hoàn thành Chính sách chi nhánh.'
        );
        break;
      case 'reservations':
        this.alertService.showNotice(
          'Đặt phòng (Chưa triển khai)',
          'Chức năng Đặt phòng & Check-in đang ở giai đoạn thiết kế đặc tả P3A (chờ PO phê duyệt 6 quyết định sản phẩm). Chưa có API và cơ sở dữ liệu.'
        );
        break;
      case 'guests':
        this.alertService.showNotice(
          'Quản lý Khách hàng (Chưa triển khai)',
          'Module Khách hàng chưa được phát triển hoặc chưa có API backend được phê duyệt.'
        );
        break;
      case 'staff':
        this.alertService.showNotice(
          'Nhân sự & Phân quyền (Chưa triển khai)',
          'Module Quản lý Nhân sự & Phân quyền (RBAC) chưa có API backend được phê duyệt.'
        );
        break;
      case 'payments':
        this.alertService.showNotice(
          'Thanh toán & Thu chi (Lộ trình P4-P7)',
          'Module Cổng thanh toán VNPay/VietQR và Folio nằm trong lộ trình các phase tiếp theo.'
        );
        break;
      default:
        this.alertService.showNotice('Chưa triển khai', 'Tính năng đang trong quá trình phát triển.');
        break;
    }
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  onNavItemClick(): void {
    this.isMobileSidebarOpen.set(false);
  }

  openBranchSwitcher(): void {
    this.showBranchDialog = true;
  }

  onBranchChanged(membership: UserMembershipDto): void {
    this.showBranchDialog = false;
    // Tải lại router view để các component lấy dữ liệu theo context mới
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(currentUrl);
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
