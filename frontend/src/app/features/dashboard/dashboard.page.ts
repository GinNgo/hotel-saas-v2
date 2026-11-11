import {
  Component,
  inject,
  signal,
  effect,
  computed,
  untracked,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { PaymentService } from '../../core/services/payment.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuditLogService } from '../../core/services/audit-log.service';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { AdminContractsService } from '../../core/services/admin-contracts.service';
import { NotificationService } from '../../core/services/notification.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../core/models/enums';
import { ReservationDto, ReservationStatus } from '../../core/models/reservation.model';
import { PaymentSummaryDto } from '../../core/models/payment.model';
import { TenantPropertySummaryDto } from '../../core/models/public-booking.model';
import { TenantSubscriptionDto } from '../../core/models/subscription.model';
import { AuditLogListItem } from '../../core/models/audit-log.model';
import { AdminSubscriptionPlanDto } from '../../core/models/admin-plan.model';
import { TenantContractDto } from '../../core/models/admin-contract.model';
import {
  computePlatformMetrics,
  computeChainHqMetrics,
  computePropertyRoomMetrics
} from '../../core/utils/dashboard-metrics.util';

export type DashboardViewMode = 'PLATFORM' | 'HQ' | 'PROPERTY';

/**
 * Trang Dashboard Đa Ngữ Cảnh (Multi-Context Executive & Operational Dashboard):
 * 1. PLATFORM (SuperAdmin): Tổng quan Nền tảng SaaS, Hợp đồng Đối tác, Doanh số cam kết & Cấu hình Gói cước.
 * 2. HQ (Chủ cơ sở / Cơ sở tổng - Chuỗi): Tổng quan toàn chuỗi khách sạn, KPI hợp nhất các chi nhánh, Gói cước SaaS & Nhật ký kiểm toán chuỗi.
 * 3. PROPERTY (Vận hành Cơ sở / Chi nhánh cụ thể): Sơ đồ buồng phòng, tỷ lệ phòng sạch, đơn đặt phòng & thu ngân ca trực tiếp.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, Button],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-10">
      <!-- ════════════════════════════════════════════════════════════════════════
           PHÂN HỆ 1: DASHBOARD QUẢN TRỊ NỀN TẢNG SAAS (PLATFORM SUPERADMIN)
           ════════════════════════════════════════════════════════════════════════ -->
      @if (isSuperAdmin()) {
        <!-- Platform Welcome Header -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-indigo-800/60">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                <i class="pi pi-shield text-[11px] text-amber-400"></i>
                <span>PLATFORM CONTROL CENTER</span>
              </span>
              <span class="text-xs text-indigo-300 font-medium">
                Hệ sinh thái Quản trị Đa Thuê Bao (Multi-Tenant SaaS)
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Tổng quan Nền tảng Hotel SaaS — {{ currentUser()?.fullName || 'SuperAdmin' }}
            </h1>
            <p class="text-xs sm:text-sm text-indigo-200 flex items-center gap-2 flex-wrap">
              <span class="capitalize">{{ todayDateString() }}</span>
              <span>&bull;</span>
              <span class="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                SLA Cam kết 99.9% Online
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              (click)="loadPlatformDashboard()"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-colors cursor-pointer"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingPlatform()"></i>
              <span>Làm mới</span>
            </button>
            <a
              routerLink="/plans"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <i class="pi pi-sliders-v text-xs"></i>
              <span>Cấu hình Gói cước</span>
            </a>
            <a
              routerLink="/contracts"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <i class="pi pi-file-edit text-xs"></i>
              <span>Hợp đồng Đối tác</span>
            </a>
          </div>
        </div>

        <!-- Platform KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Hợp đồng Đối tác</span>
              <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                <i class="pi pi-file-edit text-lg"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl font-extrabold text-slate-900 font-mono">{{ platformMetrics().totalContracts }}</div>
              <div class="mt-1.5 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span class="text-emerald-700 font-semibold">{{ platformMetrics().activeContracts }} hiệu lực</span>
                <span>&bull;</span>
                <span class="text-amber-700 font-semibold">{{ platformMetrics().pendingContracts }} chờ ký</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doanh số Cam kết</span>
              <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <i class="pi pi-wallet text-lg"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono truncate">
                {{ platformMetrics().totalCommittedValue | number:'1.0-0' }}₫
              </div>
              <div class="mt-1.5 text-xs text-slate-500">
                TB: {{ platformMetrics().averageContractValue | number:'1.0-0' }}₫ / hợp đồng
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gói cước SaaS Đang mở</span>
              <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <i class="pi pi-box text-lg"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl font-extrabold text-slate-900 font-mono">
                {{ platformMetrics().activePlans }}<span class="text-lg text-slate-400 font-normal">/{{ platformMetrics().totalPlans }}</span>
              </div>
              <div class="mt-1.5 text-xs text-slate-500 truncate">
                Nổi bật: <strong class="text-indigo-700">{{ platformMetrics().popularPlanName }}</strong>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cô lập Đa Thuê Bao</span>
              <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <i class="pi pi-verified text-lg"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-xl font-extrabold text-teal-700 tracking-tight">Fail-Closed 100%</div>
              <div class="mt-1.5 text-xs text-slate-500">
                Global Query Filter &bull; VietQR / VNPay Ready
              </div>
            </div>
          </div>
        </div>

        <!-- Platform Main Content: Contracts Table (2 cols) + SaaS Plans Catalog (1 col) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Recent Partner Contracts -->
          <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between pb-4 border-b border-slate-100 gap-2 flex-wrap">
                <div>
                  <h2 class="text-base font-bold text-slate-800">Hợp đồng Đối tác Khách sạn (Tenants)</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Danh sách hợp đồng pháp lý và trạng thái kích hoạt dịch vụ SaaS</p>
                </div>
                <a routerLink="/contracts" class="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1">
                  <span>Quản lý tất cả hợp đồng</span>
                  <i class="pi pi-arrow-right text-[10px]"></i>
                </a>
              </div>

              @if (loadingPlatform()) {
                <div class="py-12 text-center text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2"></i>
                  <p class="text-xs">Đang tải dữ liệu nền tảng...</p>
                </div>
              } @else if (platformContracts().length === 0) {
                <div class="py-10 text-center text-slate-500">
                  <i class="pi pi-file text-3xl text-slate-300 mb-2"></i>
                  <p class="text-sm font-medium">Chưa có hợp đồng đối tác nào được tạo.</p>
                </div>
              } @else {
                <div class="overflow-x-auto mt-3">
                  <table class="w-full text-left text-xs sm:text-sm text-slate-600">
                    <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th class="py-3 px-3">Số HĐ</th>
                        <th class="py-3 px-3">Đối tác / Chuỗi KS</th>
                        <th class="py-3 px-3">Gói cước</th>
                        <th class="py-3 px-3">Giá trị</th>
                        <th class="py-3 px-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (c of platformContracts().slice(0, 6); track c.id) {
                        <tr class="hover:bg-slate-50/80 transition-colors">
                          <td class="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {{ c.contractNumber }}
                          </td>
                          <td class="py-3 px-3">
                            <div class="font-semibold text-slate-900">{{ c.tenantName }}</div>
                            <div class="text-[11px] text-slate-400">{{ c.representativeName }}</div>
                          </td>
                          <td class="py-3 px-3">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {{ c.planName }}
                            </span>
                          </td>
                          <td class="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {{ c.contractValue | number:'1.0-0' }}₫
                          </td>
                          <td class="py-3 px-3 whitespace-nowrap">
                            @if (c.status === 'Active') {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hiệu lực
                              </span>
                            } @else if (c.status === 'PendingSignature') {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Chờ ký số
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                                {{ c.status }}
                              </span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          <!-- Right: SaaS Plans Catalog Summary -->
          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 class="text-sm font-bold text-slate-800">Danh mục Gói cước SaaS</h3>
                <p class="text-[11px] text-slate-400">Định giá & hạn mức tài nguyên Tenant</p>
              </div>
              <a routerLink="/plans" class="text-xs font-semibold text-indigo-700 hover:underline">
                Cấu hình →
              </a>
            </div>

            <div class="space-y-3">
              @for (plan of platformPlans(); track plan.id) {
                <div class="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:border-indigo-300 transition-colors space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                        {{ plan.code }}
                      </span>
                      <span class="text-xs font-bold text-slate-900 truncate">{{ plan.name }}</span>
                    </div>
                    @if (plan.isPopular) {
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        Phổ biến
                      </span>
                    }
                  </div>
                  <div class="flex items-baseline justify-between text-xs">
                    <span class="text-slate-500">Đơn giá tháng:</span>
                    <span class="font-mono font-extrabold text-indigo-700">{{ plan.monthlyPrice | number:'1.0-0' }}₫/tháng</span>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Tối đa {{ plan.maxProperties }} cơ sở</span>
                    <span>&bull;</span>
                    <span>{{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}</span>
                    <span>&bull;</span>
                    <span>{{ plan.maxStaff }} NV</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
        <!-- ════════════════════════════════════════════════════════════════════════
             THANH CHUYỂN ĐỔI NGỮ CẢNH CHO CHỦ CƠ SỞ / QUẢN LÝ CHUỖI (HQ vs PROPERTY)
             ════════════════════════════════════════════════════════════════════════ -->
        <div class="bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            @if (canViewChainHq()) {
              <button
                type="button"
                (click)="setViewMode('HQ')"
                class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                [ngClass]="viewMode() === 'HQ'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'"
              >
                <i class="pi pi-sitemap text-xs"></i>
                <span>Cơ sở tổng (Chuỗi HQ)</span>
                <span
                  class="px-1.5 py-0.2 rounded text-[10px]"
                  [ngClass]="viewMode() === 'HQ' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'"
                >
                  {{ chainMetrics().totalProperties || branchMemberships().length || 1 }} CN
                </span>
              </button>
            }

            <button
              type="button"
              (click)="setViewMode('PROPERTY')"
              class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              [ngClass]="viewMode() === 'PROPERTY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'"
            >
              <i class="pi pi-building text-xs"></i>
              <span>Chi nhánh: {{ authService.activePropertyName() || 'Hiện tại' }}</span>
              @if (authService.activePropertyCode()) {
                <span
                  class="px-1.5 py-0.2 rounded text-[10px] font-mono"
                  [ngClass]="viewMode() === 'PROPERTY' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'"
                >
                  {{ authService.activePropertyCode() }}
                </span>
              }
            </button>
          </div>

          <!-- Quick Branch Pills when user has multiple branches -->
          @if (branchMemberships().length > 1) {
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
              <span class="text-[11px] font-semibold text-slate-400 whitespace-nowrap mr-1 hidden md:inline">
                Đổi nhanh cơ sở:
              </span>
              @for (m of branchMemberships(); track m.id) {
                <button
                  type="button"
                  (click)="quickSwitchBranch(m.propertyId!)"
                  [disabled]="switchingBranchId() !== null"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  [ngClass]="authService.activePropertyId()?.toLowerCase() === m.propertyId?.toLowerCase() && viewMode() === 'PROPERTY'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'"
                >
                  @if (switchingBranchId() === m.propertyId) {
                    <i class="pi pi-spin pi-spinner text-[10px]"></i>
                  } @else {
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="authService.activePropertyId()?.toLowerCase() === m.propertyId?.toLowerCase() ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                  }
                  <span>{{ m.propertyCode || m.propertyName }}</span>
                </button>
              }
            </div>
          }
        </div>

        <!-- ════════════════════════════════════════════════════════════════════════
             PHÂN HỆ 2: DASHBOARD CHỦ CƠ SỞ & CƠ SỞ TỔNG (CHAIN HQ OVERVIEW)
             ════════════════════════════════════════════════════════════════════════ -->
        @if (viewMode() === 'HQ') {
          <!-- HQ Welcome Banner -->
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <i class="pi pi-crown text-[11px]"></i>
                  <span>TRUNG TÂM ĐIỀU HÀNH CHUỖI (HQ)</span>
                </span>
                <span class="text-xs text-slate-300 font-medium">
                  Thương hiệu: <strong class="text-white">{{ tenantBrandName() }}</strong>
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Tổng quan Cơ sở tổng & Chuỗi Chi nhánh
              </h1>
              <p class="text-xs sm:text-sm text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Chủ sở hữu / Quản lý: <strong class="text-white">{{ currentUser()?.fullName }}</strong></span>
                <span>&bull;</span>
                <span class="capitalize">{{ todayDateString() }}</span>
              </p>
            </div>

            <div class="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                (click)="loadChainHqData()"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-colors cursor-pointer"
              >
                <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingHq()"></i>
                <span>Đồng bộ chuỗi</span>
              </button>
              <a
                routerLink="/properties"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <i class="pi pi-plus text-xs"></i>
                <span>Quản lý Chi nhánh</span>
              </a>
              <a
                routerLink="/reports"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <i class="pi pi-chart-bar text-xs"></i>
                <span>Báo cáo Doanh thu</span>
              </a>
            </div>
          </div>

          <!-- HQ Chain KPI Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Cơ sở Trực thuộc</span>
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                  <i class="pi pi-sitemap text-lg"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 font-mono">{{ chainMetrics().totalProperties }}</div>
                <div class="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{{ chainMetrics().activeProperties }} cơ sở đang vận hành</span>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Quỹ phòng Chuỗi</span>
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <i class="pi pi-th-large text-lg"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-emerald-700 font-mono">{{ chainMetrics().totalRooms }}</div>
                <div class="mt-1.5 text-xs text-slate-500">
                  {{ chainMetrics().occupiedRooms }} đang có khách &bull; {{ chainMetrics().availableRooms }} phòng trống
                </div>
              </div>
            </div>

            <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Công suất Toàn chuỗi</span>
                <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                  <i class="pi pi-chart-line text-lg"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-amber-600 font-mono">{{ chainMetrics().occupancyRate }}%</div>
                <div class="mt-1.5 text-xs text-slate-500">
                  Tỷ lệ lấp đầy trung bình các chi nhánh
                </div>
              </div>
            </div>

            <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doanh thu Hôm nay (HQ)</span>
                <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                  <i class="pi pi-dollar text-lg"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono truncate">
                  {{ chainMetrics().todayChainRevenue | number:'1.0-0' }}₫
                </div>
                <div class="mt-1.5 text-xs text-slate-500">
                  Cộng dồn thời gian thực toàn chuỗi
                </div>
              </div>
            </div>
          </div>

          <!-- HQ Main Grid: Branch Comparison Matrix (2 cols) + SaaS Quota & Audit Logs (1 col) -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left 2 cols: Branch Performance Cards -->
            <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h2 class="text-base font-bold text-slate-800">Danh sách Cơ sở & Chi nhánh Trực thuộc</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Nhấn "Vào vận hành chi nhánh" để chuyển ngữ cảnh làm việc sang từng cơ sở</p>
                </div>
                <a routerLink="/properties" class="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1">
                  <span>Cấu hình chi nhánh</span>
                  <i class="pi pi-arrow-right text-[10px]"></i>
                </a>
              </div>

              @if (loadingHq()) {
                <div class="py-12 text-center text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2"></i>
                  <p class="text-xs">Đang tải danh sách chi nhánh toàn chuỗi...</p>
                </div>
              } @else if (chainProperties().length === 0) {
                <div class="py-10 text-center text-slate-500">
                  <i class="pi pi-building text-3xl text-slate-300 mb-2"></i>
                  <p class="text-sm font-medium">Chuỗi chưa có chi nhánh nào.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (prop of chainProperties(); track prop.id) {
                    <div
                      class="rounded-2xl border p-4 transition-all flex flex-col justify-between gap-4"
                      [ngClass]="authService.activePropertyId()?.toLowerCase() === prop.id.toLowerCase()
                        ? 'border-emerald-500 bg-emerald-50/30 shadow-xs'
                        : 'border-slate-200/90 bg-[#fbfbfa] hover:border-indigo-300'"
                    >
                      <div class="space-y-2.5">
                        <div class="flex items-start justify-between gap-2">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold shrink-0">
                              {{ prop.code }}
                            </span>
                            <div class="min-w-0">
                              <h3 class="text-sm font-bold text-slate-900 truncate">{{ prop.name }}</h3>
                              <p class="text-[11px] text-slate-500 truncate">{{ prop.city }} &bull; {{ prop.propertyTypeName || 'Khách sạn' }}</p>
                            </div>
                          </div>
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                            [ngClass]="prop.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
                          >
                            {{ prop.isActive !== false ? 'Đang mở' : 'Tạm ngưng' }}
                          </span>
                        </div>

                        <p class="text-xs text-slate-500 truncate flex items-center gap-1.5">
                          <i class="pi pi-map-marker text-[11px] text-slate-400"></i>
                          <span class="truncate">{{ prop.address }}</span>
                        </p>

                        <!-- Branch KPI Mini Strip -->
                        <div class="grid grid-cols-2 gap-2 pt-1">
                          <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Công suất phòng</span>
                            <span class="text-sm font-extrabold font-mono text-slate-800">
                              {{ prop.occupiedRooms }}/{{ prop.totalRooms }} phòng
                            </span>
                          </div>
                          <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Doanh thu ngày</span>
                            <span class="text-sm font-extrabold font-mono text-emerald-700">
                              {{ (prop.todayRevenue || 0) | number:'1.0-0' }}₫
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1 flex-wrap text-[10px]">
                          @if (prop.allowDailyBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-medium">Theo ngày</span>
                          }
                          @if (prop.allowOvernightBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">Qua đêm</span>
                          }
                          @if (prop.allowHourlyBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium">Theo giờ</span>
                          }
                        </div>

                        <button
                          type="button"
                          (click)="enterBranchOperations(prop)"
                          [disabled]="switchingBranchId() === prop.id"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          @if (switchingBranchId() === prop.id) {
                            <i class="pi pi-spin pi-spinner text-xs"></i>
                            <span>Đang chuyển...</span>
                          } @else {
                            <span>Vào vận hành</span>
                            <i class="pi pi-arrow-right text-[10px]"></i>
                          }
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right 1 col: SaaS Subscription & Chain Audit Logs -->
            <div class="space-y-5">
              <!-- Card 1: Gói cước SaaS & Quota -->
              <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                      <i class="pi pi-box text-sm"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800">Gói cước SaaS của Chuỗi</h3>
                      <span class="text-[11px] text-slate-400">Hạn mức tài nguyên Tenant</span>
                    </div>
                  </div>
                  <a routerLink="/subscriptions" class="text-xs font-semibold text-indigo-700 hover:underline">
                    Nâng cấp →
                  </a>
                </div>

                @if (subscription(); as sub) {
                  <div class="p-4 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Gói đang kích hoạt</span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {{ sub.status || 'Active' }}
                      </span>
                    </div>
                    <div class="text-lg font-extrabold text-white">{{ sub.tierName }}</div>
                    <div class="text-xs text-indigo-200 font-mono">
                      {{ sub.pricePerCycle | number:'1.0-0' }} {{ sub.currency || 'VND' }} / kỳ
                    </div>
                  </div>

                  <div class="space-y-3 text-xs">
                    <div>
                      <div class="flex justify-between mb-1">
                        <span class="text-slate-600 font-medium">Hạn mức Chi nhánh:</span>
                        <span class="font-mono font-bold text-slate-900">{{ sub.currentPropertyCount }}/{{ sub.maxPropertiesAllowed }} cơ sở</span>
                      </div>
                      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          class="bg-indigo-600 h-full rounded-full"
                          [style.width.%]="sub.maxPropertiesAllowed > 0 ? Math.min(100, (sub.currentPropertyCount / sub.maxPropertiesAllowed) * 100) : 0"
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div class="flex justify-between mb-1">
                        <span class="text-slate-600 font-medium">Hạn mức Quỹ phòng:</span>
                        <span class="font-mono font-bold text-slate-900">{{ sub.currentRoomCount }}/{{ sub.maxRoomsAllowed }} phòng</span>
                      </div>
                      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          class="bg-emerald-600 h-full rounded-full"
                          [style.width.%]="sub.roomUsagePercentage || 0"
                        ></div>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="text-xs text-slate-500 py-3">
                    Đang đồng bộ thông tin thuê bao SaaS của chuỗi...
                  </div>
                }
              </div>

              <!-- Card 2: Nhật ký Kiểm toán Chuỗi -->
              <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                      <i class="pi pi-history text-sm"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800">Nhật ký Kiểm toán Chuỗi</h3>
                      <span class="text-[11px] text-slate-400">Hoạt động thay đổi dữ liệu gần đây</span>
                    </div>
                  </div>
                  <a routerLink="/audit-logs" class="text-xs font-semibold text-amber-700 hover:underline">
                    Chi tiết →
                  </a>
                </div>

                @if (chainAuditLogs().length === 0) {
                  <p class="text-xs text-slate-400 py-4 text-center">Chưa có bản ghi kiểm toán mới.</p>
                } @else {
                  <div class="space-y-2.5">
                    @for (log of chainAuditLogs().slice(0, 4); track log.id) {
                      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-bold text-slate-800 truncate">{{ log.entityName }}</span>
                          <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                            {{ log.action }}
                          </span>
                        </div>
                        <p class="text-[11px] text-slate-500 line-clamp-1">
                          {{ log.changeSummary || ('Thay đổi bởi ' + (log.userFullName || log.userEmail || 'Hệ thống')) }}
                        </p>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- ════════════════════════════════════════════════════════════════════════
               PHÂN HỆ 3: DASHBOARD VẬN HÀNH CƠ SỞ / CHI NHÁNH (PROPERTY MODE)
               ════════════════════════════════════════════════════════════════════════ -->
          <!-- Welcome Header Banner -->
          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
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
              <p class="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <span class="capitalize">{{ todayDateString() }}</span>
                <span class="text-slate-300">&bull;</span>
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sẵn sàng đón khách: {{ readyRate() }}%
                </span>
              </p>
            </div>

            <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
              @if (canViewChainHq()) {
                <button
                  type="button"
                  (click)="setViewMode('HQ')"
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <i class="pi pi-sitemap text-xs"></i>
                  <span>Tổng quan Chuỗi (HQ)</span>
                </button>
              }
              @if (canManageRooms()) {
                <a routerLink="/rooms">
                  <p-button
                    label="Sơ đồ Phòng"
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
                (click)="loadDashboardData()"
                class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Real Metrics Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Tổng số phòng -->
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
                  <div class="text-3xl font-extrabold text-slate-800 tracking-tight font-mono">{{ totalRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{{ occupiedRooms() }} phòng đang có khách</span>
                  </div>
                }
              </div>
            </div>

            <!-- Card 2: Phòng sẵn sàng / Sạch -->
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
                  <div class="text-3xl font-extrabold text-teal-700 tracking-tight font-mono">{{ cleanRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500">
                    Đạt {{ readyRate() }}% tổng quỹ phòng
                  </div>
                }
              </div>
            </div>

            <!-- Card 3: Phòng bẩn / Đang dọn -->
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
                  <div class="text-3xl font-extrabold text-amber-600 tracking-tight font-mono">{{ dirtyRooms() + cleaningRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500">
                    {{ dirtyRooms() }} cần dọn &bull; {{ cleaningRooms() }} đang dọn
                  </div>
                }
              </div>
            </div>

            <!-- Card 4: Đặt phòng & Lưu trú -->
            <div class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn đặt phòng</span>
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                  <i class="pi pi-calendar text-lg"></i>
                </div>
              </div>
              <div class="mt-3">
                @if (loadingOperational()) {
                  <div class="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
                } @else {
                  <div class="text-3xl font-extrabold text-indigo-900 tracking-tight font-mono">{{ totalReservationsCount() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500">
                    {{ checkedInCount() }} đang ở &bull; {{ upcomingConfirmedCount() }} sắp đến
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Room Readiness Progress Bar -->
          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div class="flex items-center justify-between text-xs mb-2.5 flex-wrap gap-2">
              <span class="font-bold text-slate-800 flex items-center gap-2">
                <i class="pi pi-chart-pie text-emerald-600 text-sm"></i>
                Tỷ lệ vận hành buồng phòng thực tế
              </span>
              <span class="font-extrabold font-mono" [ngClass]="readyRate() >= 60 ? 'text-emerald-700' : 'text-amber-700'">
                {{ readyRate() }}% ({{ cleanRooms() }}/{{ totalRooms() }} phòng sạch)
              </span>
            </div>
            <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div class="bg-emerald-500 h-full transition-all duration-500" [style.width.%]="readyRate()"></div>
              <div class="bg-blue-500 h-full transition-all duration-500" [style.width.%]="totalRooms() > 0 ? (occupiedRooms() / totalRooms()) * 100 : 0"></div>
              <div class="bg-amber-400 h-full transition-all duration-500" [style.width.%]="totalRooms() > 0 ? (cleaningRooms() / totalRooms()) * 100 : 0"></div>
              <div class="bg-rose-500 h-full transition-all duration-500" [style.width.%]="totalRooms() > 0 ? (dirtyRooms() / totalRooms()) * 100 : 0"></div>
            </div>
            <div class="flex items-center gap-4 text-[11px] text-slate-500 mt-2.5 flex-wrap">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Sạch sẵn sàng ({{ cleanRooms() }})</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Đang có khách ({{ occupiedRooms() }})</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Đang dọn dẹp ({{ cleaningRooms() }})</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Cần dọn ngay ({{ dirtyRooms() }})</span>
            </div>
          </div>

          <!-- Main Grid: Rooms Snapshot (2 cols) + Live Reservations & Revenue (1 col) -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left: Real Rooms Snapshot (2 cols) -->
            <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div class="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 class="text-base font-bold text-slate-800">Hiện trạng phòng chi nhánh</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Danh sách phòng thực tế từ cơ sở dữ liệu</p>
                </div>
                <a routerLink="/rooms" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1">
                  <span>Mở sơ đồ Rack</span>
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
                    <div class="p-3 rounded-xl border border-slate-200/80 transition-colors bg-[#fbfbfa] hover:border-emerald-300">
                      <div class="flex items-center justify-between">
                        <span class="text-base font-bold text-slate-800 font-mono">Phòng {{ r.roomNumber }}</span>
                        <span class="text-[11px] text-slate-400 font-medium font-mono">T{{ r.floor }}</span>
                      </div>
                      <div class="text-xs text-slate-500 mt-1 truncate font-medium">
                        {{ r.roomTypeName }}
                      </div>
                      <div class="mt-2.5 flex items-center justify-between gap-1">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
                          [ngClass]="getStatusBadgeClass(r.status)"
                        >
                          {{ getStatusLabel(r.status) }}
                        </span>
                        <span class="text-[10px] font-mono text-slate-400">{{ r.basePrice | number:'1.0-0' }}₫</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right: Live Reservations & Cashier Summary (1 col) -->
            <div class="space-y-5">
              <!-- Live Card 1: Hoạt động Đặt phòng -->
              <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                      <i class="pi pi-calendar-plus text-sm"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800">Đặt phòng gần đây</h3>
                      <span class="text-[11px] text-slate-400">Dữ liệu trực tiếp từ phân hệ Lễ tân</span>
                    </div>
                  </div>
                  <a routerLink="/reservations" class="text-xs font-semibold text-emerald-700 hover:underline">
                    Tất cả →
                  </a>
                </div>

                @if (loadingOperational()) {
                  <div class="space-y-2.5 animate-pulse">
                    <div class="h-12 bg-slate-100 rounded-xl"></div>
                    <div class="h-12 bg-slate-100 rounded-xl"></div>
                  </div>
                } @else if (recentReservations().length === 0) {
                  <div class="py-6 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-4">
                    <i class="pi pi-calendar text-slate-300 text-xl mb-1.5"></i>
                    <p class="text-xs font-semibold text-slate-600">Chưa có đơn đặt phòng tại chi nhánh</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Bấm để tạo đặt phòng hoặc nhận khách Walk-in</p>
                    <a
                      routerLink="/reservations"
                      class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <i class="pi pi-plus text-[10px]"></i>
                      <span>Tạo đặt phòng</span>
                    </a>
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (res of recentReservations().slice(0, 4); track res.id) {
                      <div class="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-slate-800 truncate">{{ res.guestName }}</span>
                            <span class="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {{ res.confirmationCode }}
                            </span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5 truncate">
                            {{ res.roomNumber ? 'Phòng ' + res.roomNumber : res.roomTypeName }} &bull; {{ res.checkInDate }}
                          </div>
                        </div>
                        <div class="text-right shrink-0">
                          <div class="text-xs font-mono font-bold text-slate-900">{{ res.totalAmount | number:'1.0-0' }}₫</div>
                          <span class="inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded" [ngClass]="getReservationBadgeClass(res.status)">
                            {{ getReservationStatusLabel(res.status) }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Live Card 2: Thu ngân & Doanh thu -->
              <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                      <i class="pi pi-wallet text-sm"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800">Thu ngân & Doanh thu</h3>
                      <span class="text-[11px] text-slate-400">Tổng hợp giao dịch tại chi nhánh</span>
                    </div>
                  </div>
                  <a routerLink="/payments" class="text-xs font-semibold text-indigo-700 hover:underline">
                    Sổ quỹ →
                  </a>
                </div>

                <div class="p-4 rounded-xl bg-slate-900 text-white space-y-1">
                  <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Thực thu ca hôm nay</span>
                  <div class="text-2xl font-extrabold font-mono text-emerald-400">
                    {{ (paymentSummary()?.totalCollected || 0) | number:'1.0-0' }}₫
                  </div>
                  <div class="text-[11px] text-slate-300 flex items-center justify-between pt-1">
                    <span>Giao dịch hoàn tất:</span>
                    <span class="font-mono font-bold">{{ paymentSummary()?.completedCount || 0 }} phiếu thu</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2.5 text-xs">
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] text-slate-500 block">Tiền mặt</span>
                    <span class="font-mono font-bold text-slate-800">{{ (paymentSummary()?.cashCollected || 0) | number:'1.0-0' }}₫</span>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] text-slate-500 block">Chuyển khoản / QR</span>
                    <span class="font-mono font-bold text-slate-800">{{ (paymentSummary()?.bankTransferCollected || 0) | number:'1.0-0' }}₫</span>
                  </div>
                </div>

                <div class="pt-1 flex items-center justify-between text-xs border-t border-slate-100">
                  <span class="text-slate-500">Tổng giá trị booking:</span>
                  <span class="font-mono font-bold text-emerald-700">{{ totalBookingRevenue() | number:'1.0-0' }}₫</span>
                </div>

                <a
                  routerLink="/reports"
                  class="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <i class="pi pi-chart-bar text-xs text-emerald-600"></i>
                  <span>Xem báo cáo phân tích doanh thu</span>
                </a>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class DashboardPage implements OnInit {
  protected readonly Math = Math;
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly roomService = inject(RoomService);
  private readonly reservationService = inject(ReservationService);
  private readonly paymentService = inject(PaymentService);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly adminPlansService = inject(AdminPlansService);
  private readonly adminContractsService = inject(AdminContractsService);

  readonly currentUser = toSignal(this.authService.currentUser$, {
    initialValue: this.authService.currentUser
  });
  readonly membershipsSignal = toSignal(this.authService.memberships$, {
    initialValue: this.authService.memberships
  });

  readonly isSuperAdmin = computed(() => this.currentUser()?.globalRole === 'SuperAdmin');

  readonly branchMemberships = computed(() =>
    (this.membershipsSignal() || []).filter(m => !!m.propertyId)
  );

  readonly canViewChainHq = computed(() => {
    if (this.isSuperAdmin()) return false;
    const role = this.currentUser()?.globalRole;
    if (role === 'Owner' || this.authService.isTenantWide) return true;
    if (this.branchMemberships().length > 1) return true;
    return this.authService.hasPermission('PROPERTIES', 1);
  });

  readonly tenantBrandName = computed(() => {
    const first = (this.membershipsSignal() || [])[0];
    return first?.tenantName || 'Chuỗi Khách Sạn';
  });

  readonly viewMode = signal<'HQ' | 'PROPERTY'>('PROPERTY');
  readonly switchingBranchId = signal<string | null>(null);

  // Platform SuperAdmin state
  readonly loadingPlatform = signal(false);
  readonly platformPlans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly platformContracts = signal<TenantContractDto[]>([]);
  readonly platformMetrics = computed(() =>
    computePlatformMetrics(this.platformPlans(), this.platformContracts())
  );

  // Chain HQ state
  readonly loadingHq = signal(false);
  readonly chainProperties = signal<TenantPropertySummaryDto[]>([]);
  readonly subscription = signal<TenantSubscriptionDto | null>(null);
  readonly chainAuditLogs = signal<AuditLogListItem[]>([]);
  readonly chainMetrics = computed(() => computeChainHqMetrics(this.chainProperties()));

  // Property Operational state
  readonly canManageRooms = computed(() => this.authService.hasPermission('ROOMS', 1));
  readonly canManageRoomTypes = computed(() => this.authService.hasPermission('ROOM_TYPES', 1));

  readonly todayDateString = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  loading = signal(true);
  loadingOperational = signal(false);
  error = signal<string | null>(null);
  rooms = signal<RoomDto[]>([]);
  totalRooms = signal(0);
  cleanRooms = signal(0);
  occupiedRooms = signal(0);
  dirtyRooms = signal(0);
  cleaningRooms = signal(0);
  oosRooms = signal(0);

  readonly readyRate = computed(() => {
    const total = this.totalRooms();
    if (total <= 0) return 0;
    return Math.round((this.cleanRooms() / total) * 100);
  });

  recentReservations = signal<ReservationDto[]>([]);
  totalReservationsCount = signal(0);
  paymentSummary = signal<PaymentSummaryDto | null>(null);

  readonly checkedInCount = computed(() =>
    this.recentReservations().filter(r => r.status === ReservationStatus.CheckedIn).length
  );

  readonly upcomingConfirmedCount = computed(() =>
    this.recentReservations().filter(
      r => r.status === ReservationStatus.Confirmed || r.status === ReservationStatus.PendingPayment
    ).length
  );

  readonly totalBookingRevenue = computed(() =>
    this.recentReservations()
      .filter(r => r.status !== ReservationStatus.Cancelled && r.status !== ReservationStatus.NoShow)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  );

  constructor() {
    effect(() => {
      const superAdmin = this.isSuperAdmin();
      const propId = this.authService.activePropertyId();
      untracked(() => {
        if (superAdmin) {
          this.loadPlatformDashboard();
        } else if (propId) {
          this.loadDashboardData();
          if (this.canViewChainHq()) {
            this.loadChainHqData();
          }
        } else if (this.canViewChainHq()) {
          this.viewMode.set('HQ');
          this.loadChainHqData();
        }
      });
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const mode = params.get('mode');
      if (mode === 'hq' && this.canViewChainHq()) {
        this.viewMode.set('HQ');
        this.loadChainHqData();
      } else if (mode === 'property') {
        this.viewMode.set('PROPERTY');
      }
    });
  }

  setViewMode(mode: 'HQ' | 'PROPERTY'): void {
    this.viewMode.set(mode);
    if (mode === 'HQ') {
      this.loadChainHqData();
    } else {
      this.loadDashboardData();
    }
  }

  quickSwitchBranch(propertyId: string): void {
    if (!propertyId || this.switchingBranchId()) return;
    if (
      this.authService.activePropertyId()?.toLowerCase() === propertyId.toLowerCase() &&
      this.viewMode() === 'PROPERTY'
    ) {
      return;
    }

    this.switchingBranchId.set(propertyId);
    this.authService.switchContext(propertyId).subscribe({
      next: () => {
        this.switchingBranchId.set(null);
        this.viewMode.set('PROPERTY');
        this.loadDashboardData();
      },
      error: () => {
        this.switchingBranchId.set(null);
      }
    });
  }

  enterBranchOperations(prop: TenantPropertySummaryDto): void {
    if (!prop.id) return;
    this.switchingBranchId.set(prop.id);
    this.authService.switchContext(prop.id).subscribe({
      next: () => {
        this.switchingBranchId.set(null);
        this.notification.success(`Đã chuyển sang vận hành chi nhánh: ${prop.name}`);
        this.viewMode.set('PROPERTY');
        this.loadDashboardData();
      },
      error: () => {
        this.switchingBranchId.set(null);
        this.authService.setActivePropertyContext(prop.id, prop.name, prop.code);
        this.viewMode.set('PROPERTY');
        this.loadDashboardData();
      }
    });
  }

  loadPlatformDashboard(): void {
    this.loadingPlatform.set(true);
    this.adminPlansService.getAllPlans().subscribe({
      next: plans => {
        this.platformPlans.set(plans || []);
        this.loadingPlatform.set(false);
      },
      error: () => {
        this.loadingPlatform.set(false);
      }
    });

    this.adminContractsService.getAllContracts().subscribe({
      next: contracts => {
        this.platformContracts.set(contracts || []);
      },
      error: () => {}
    });
  }

  loadChainHqData(): void {
    if (this.isSuperAdmin()) return;
    this.loadingHq.set(true);

    this.propertyService.getTenantProperties().subscribe({
      next: props => {
        this.chainProperties.set(props || []);
        this.loadingHq.set(false);
      },
      error: () => {
        this.loadingHq.set(false);
      }
    });

    this.subscriptionService.getCurrentSubscription().subscribe({
      next: sub => {
        this.subscription.set(sub);
      },
      error: () => {}
    });

    const propId = this.authService.activePropertyId();
    if (propId) {
      this.auditLogService.getAuditLogs({ propertyId: propId, page: 1, pageSize: 6 }).subscribe({
        next: res => {
          const items = res?.data?.items || [];
          this.chainAuditLogs.set(items);
        },
        error: () => {}
      });
    }
  }

  loadDashboardData(): void {
    if (this.isSuperAdmin()) return;
    this.loadRoomsData();
    this.loadOperationalMetrics();
  }

  loadRoomsData(): void {
    if (!this.authService.activePropertyId()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.roomService.getRooms({ page: 1, pageSize: 100 }).subscribe({
      next: res => {
        this.loading.set(false);
        const items = res.items || [];
        this.rooms.set(items);
        const metrics = computePropertyRoomMetrics(items);
        this.totalRooms.set(res.totalCount ?? metrics.totalRooms);
        this.cleanRooms.set(metrics.cleanRooms);
        this.occupiedRooms.set(metrics.occupiedRooms);
        this.dirtyRooms.set(metrics.dirtyRooms);
        this.cleaningRooms.set(metrics.cleaningRooms);
        this.oosRooms.set(metrics.oosRooms);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Không thể tải dữ liệu phòng. Vui lòng thử lại.');
      }
    });
  }

  loadOperationalMetrics(): void {
    const propId = this.authService.activePropertyId();
    if (!propId) {
      this.recentReservations.set([]);
      this.totalReservationsCount.set(0);
      this.paymentSummary.set(null);
      return;
    }

    this.loadingOperational.set(true);
    this.reservationService.getReservations({ propertyId: propId, page: 1, pageSize: 20 }).subscribe({
      next: res => {
        this.recentReservations.set(res.items || []);
        this.totalReservationsCount.set(res.totalCount ?? (res.items?.length || 0));
        this.loadingOperational.set(false);
      },
      error: () => {
        this.loadingOperational.set(false);
      }
    });

    this.paymentService.getPaymentSummary(propId).subscribe({
      next: summary => {
        this.paymentSummary.set(summary);
      },
      error: () => {
        this.paymentSummary.set(null);
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

  getReservationStatusLabel(status: ReservationStatus): string {
    switch (status) {
      case ReservationStatus.PendingPayment:
        return 'Chờ thanh toán';
      case ReservationStatus.Confirmed:
        return 'Đã xác nhận';
      case ReservationStatus.CheckedIn:
        return 'Đang ở';
      case ReservationStatus.CheckedOut:
        return 'Đã trả';
      case ReservationStatus.Cancelled:
        return 'Đã hủy';
      default:
        return 'Khác';
    }
  }

  getReservationBadgeClass(status: ReservationStatus): string {
    switch (status) {
      case ReservationStatus.CheckedIn:
        return 'bg-blue-100 text-blue-800';
      case ReservationStatus.Confirmed:
        return 'bg-emerald-100 text-emerald-800';
      case ReservationStatus.CheckedOut:
        return 'bg-slate-100 text-slate-700';
      case ReservationStatus.Cancelled:
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  }
}
