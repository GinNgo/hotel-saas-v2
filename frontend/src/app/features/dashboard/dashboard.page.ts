import {
  Component,
  DestroyRef,
  inject,
  signal,
  effect,
  computed,
  untracked,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import {
  DashboardSummaryDto,
  PlatformGovernanceService,
  PlatformOverviewDto
} from '../../core/services/platform-governance.service';
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
import { ChartCardComponent, ChartCardDataset } from '../../shared/components/chart-card/chart-card.component';
import { BusinessDatePipe } from '../../shared/pipes/business-date.pipe';
import {
  computePlatformMetrics,
  computeChainHqMetrics,
  computePropertyRoomMetrics
} from '../../core/utils/dashboard-metrics.util';
import {
  getAuditActionBadgeClass,
  getAuditActionLabel,
  getAuditEntityDisplayLabel,
  getFriendlyAuditSummary
} from '../../core/utils/audit-log-display.util';
import { VndCurrencyPipe } from '../../shared/pipes/vnd-currency.pipe';

export type DashboardViewMode = 'PLATFORM' | 'HQ' | 'PROPERTY';
type PlatformContractSortField = 'contractNumber' | 'tenantName' | 'contractValue' | 'status';

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
  imports: [CommonModule, RouterLink, Button, ChartCardComponent, BusinessDatePipe, VndCurrencyPipe],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-10">
      <!-- ════════════════════════════════════════════════════════════════════════
           PHÂN HỆ 1: DASHBOARD QUẢN TRỊ NỀN TẢNG SAAS (PLATFORM SUPERADMIN)
           ════════════════════════════════════════════════════════════════════════ -->
      @if (isSuperAdmin()) {
        <!-- Platform Welcome Header -->
        <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-200 dark:border-slate-700">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <i class="pi pi-shield text-xs text-[var(--brand-primary)]" aria-hidden="true"></i>
                <span>PLATFORM CONTROL CENTER</span>
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Hệ sinh thái Quản trị Đa Thuê Bao (Multi-Tenant SaaS)
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Tổng quan Nền tảng Hotel SaaS — {{ currentUser()?.fullName || 'SuperAdmin' }}
            </h1>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
              <span class="capitalize">{{ todayDateString() }}</span>
              <span aria-hidden="true">&bull;</span>
              <span class="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                SLA Cam kết 99.9% Online
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              (click)="loadPlatformDashboard()"
              class="inline-flex items-center gap-2 min-h-11 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingPlatform()" aria-hidden="true"></i>
              <span>Làm mới</span>
            </button>
            <a
              routerLink="/platform-tenants"
              class="inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-xs font-bold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <i class="pi pi-building text-xs" aria-hidden="true"></i>
              <span>Thuê bao & Duyệt KS</span>
            </a>
            <a
              routerLink="/plans"
              class="inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <i class="pi pi-sliders-v text-xs" aria-hidden="true"></i>
              <span>Cấu hình Gói cước</span>
            </a>
            <a
              routerLink="/contracts"
              class="inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <i class="pi pi-file-edit text-xs" aria-hidden="true"></i>
              <span>Hợp đồng Đối tác</span>
            </a>
          </div>
        </div>

        <!-- Platform KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thuê bao & Chi nhánh</span>
              <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                <i class="pi pi-building text-lg" aria-hidden="true"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                {{ platformOverview()?.activeTenants ?? platformMetrics().activeContracts }}
                <span class="text-base font-normal text-slate-500 dark:text-slate-400">/ {{ platformOverview()?.totalTenants ?? platformMetrics().totalContracts }}</span>
              </div>
              <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap tabular-nums">
                <span class="text-emerald-700 dark:text-emerald-400 font-semibold">{{ platformOverview()?.publishedBranches ?? 0 }} đã xuất bản</span>
                <span aria-hidden="true">&bull;</span>
                <span class="text-amber-700 dark:text-amber-400 font-semibold">{{ platformOverview()?.publishPendingBranches ?? 0 }} chờ duyệt</span>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doanh thu SaaS (MRR / Thực thu)</span>
              <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                <i class="pi pi-wallet text-lg" aria-hidden="true"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-xl xl:text-2xl leading-tight break-words font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {{ (platformOverview()?.mrrVnd ?? platformMetrics().totalCommittedValue) | vndCurrency }}
              </div>
              <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                Đã thu: <strong class="text-slate-700 dark:text-slate-200">{{ (platformOverview()?.totalCollectedSaasRevenue ?? 0) | vndCurrency }}</strong> &bull;
                HĐ: {{ (platformOverview()?.totalCommittedContractValue ?? platformMetrics().totalCommittedValue) | vndCurrency }}
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quy mô Phòng & Nhân sự</span>
              <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                <i class="pi pi-box text-lg" aria-hidden="true"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                {{ platformOverview()?.totalRooms ?? 0 }} <span class="text-base font-normal text-slate-500 dark:text-slate-400">phòng</span>
              </div>
              <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                {{ platformOverview()?.totalStaff ?? 0 }} nhân sự &bull; Gói nổi bật: <strong class="text-indigo-700 dark:text-indigo-300">{{ platformMetrics().popularPlanName }}</strong>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tiêu thụ Gemini AI toàn sàn</span>
              <div class="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center border border-teal-100 dark:border-teal-800">
                <i class="pi pi-sparkles text-lg" aria-hidden="true"></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-extrabold text-teal-700 dark:text-teal-400 tracking-tight font-mono tabular-nums">
                {{ platformOverview()?.totalAiCalls ?? 0 }} lượt gọi
              </div>
              <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Tokens: {{ ((platformOverview()?.totalAiInputTokens ?? 0) + (platformOverview()?.totalAiOutputTokens ?? 0)) | number:'1.0-0' }} &bull; Thành công: {{ platformOverview()?.successfulAiCalls ?? 0 }}
              </div>
            </div>
          </div>
        </div>

        <!-- Platform MRR & Plan Breakdown Chart -->
        <app-chart-card
          title="Phân bổ Doanh thu MRR theo Gói dịch vụ SaaS"
          subtitle="Thống kê doanh thu định kỳ hàng tháng ước tính từ các thuê bao đang kích hoạt"
          chartType="bar"
          [labels]="platformPlanChartLabels()"
          [datasets]="platformPlanChartDatasets()"
          [loading]="loadingPlatform()"
          valueUnit="₫"
          emptyTitle="Chưa có dữ liệu doanh thu theo gói"
          emptyDescription="Chưa có gói dịch vụ hoặc thuê bao hoạt động để thống kê biểu đồ."
          (retry)="loadPlatformDashboard()"
        />

        <!-- Platform Main Content: Contracts Table (2 cols) + SaaS Plans Catalog (1 col) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Recent Partner Contracts -->
          <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                <div>
                  <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">Hợp đồng Đối tác Khách sạn (Tenants)</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Danh sách hợp đồng pháp lý và trạng thái kích hoạt dịch vụ SaaS</p>
                </div>
                <a routerLink="/contracts" class="min-h-11 px-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline inline-flex items-center gap-1">
                  <span>Quản lý tất cả hợp đồng</span>
                  <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
                </a>
              </div>

              @if (loadingPlatform()) {
                <div class="py-12 text-center text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2" aria-hidden="true"></i>
                  <p class="text-xs">Đang tải dữ liệu nền tảng...</p>
                </div>
              } @else if (platformContracts().length === 0) {
                <div class="py-10 text-center text-slate-500 dark:text-slate-400">
                  <i class="pi pi-file text-3xl text-slate-300 mb-2" aria-hidden="true"></i>
                  <p class="text-sm font-medium">Chưa có hợp đồng đối tác nào được tạo.</p>
                </div>
              } @else {
                <!-- Mobile cards -->
                <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800 mt-3">
                  @for (c of sortedPlatformContracts().slice(0, 6); track c.id) {
                    <article class="py-3 space-y-1.5 text-xs">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ c.contractNumber }}</span>
                        <span class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ c.contractValue | vndCurrency }}</span>
                      </div>
                      <div class="font-semibold text-slate-800 dark:text-slate-200">{{ c.tenantName }}</div>
                      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>{{ c.planName }}</span>
                        <span>{{ c.status === 'Active' ? 'Hiệu lực' : c.status === 'PendingSignature' ? 'Chờ ký số' : c.status }}</span>
                      </div>
                    </article>
                  }
                </div>

                <!-- Desktop table -->
                <div class="hidden md:block overflow-x-auto mt-3">
                  <table class="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th scope="col" class="py-3 px-3" [attr.aria-sort]="getContractAriaSort('contractNumber')">
                          <button type="button" (click)="toggleContractSort('contractNumber')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                            <span>Số HĐ</span>
                            <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                          </button>
                        </th>
                        <th scope="col" class="py-3 px-3" [attr.aria-sort]="getContractAriaSort('tenantName')">
                          <button type="button" (click)="toggleContractSort('tenantName')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                            <span>Đối tác / Chuỗi KS</span>
                            <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                          </button>
                        </th>
                        <th scope="col" class="py-3 px-3">Gói cước</th>
                        <th scope="col" class="py-3 px-3 text-right" [attr.aria-sort]="getContractAriaSort('contractValue')">
                          <button type="button" (click)="toggleContractSort('contractValue')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                            <span>Giá trị</span>
                            <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                          </button>
                        </th>
                        <th scope="col" class="py-3 px-3" [attr.aria-sort]="getContractAriaSort('status')">
                          <button type="button" (click)="toggleContractSort('status')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                            <span>Trạng thái</span>
                            <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                      @for (c of sortedPlatformContracts().slice(0, 6); track c.id) {
                        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                          <td class="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums">
                            {{ c.contractNumber }}
                          </td>
                          <td class="py-3 px-3">
                            <div class="font-semibold text-slate-900 dark:text-slate-100">{{ c.tenantName }}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">{{ c.representativeName }}</div>
                          </td>
                          <td class="py-3 px-3">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                              {{ c.planName }}
                            </span>
                          </td>
                          <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums">
                            {{ c.contractValue | vndCurrency }}
                          </td>
                          <td class="py-3 px-3 whitespace-nowrap">
                            @if (c.status === 'Active') {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span> Hiệu lực
                              </span>
                            } @else if (c.status === 'PendingSignature') {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span> Chờ ký số
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
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
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Danh mục Gói cước SaaS</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Định giá & hạn mức tài nguyên Tenant</p>
              </div>
              <a routerLink="/plans" class="min-h-11 inline-flex items-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                Cấu hình <i class="pi pi-arrow-right ml-1 text-xs" aria-hidden="true"></i>
              </a>
            </div>

            <div class="space-y-3">
              @for (plan of platformPlans(); track plan.id) {
                <div class="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:border-indigo-300 transition-colors space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                        {{ plan.code }}
                      </span>
                      <span class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{{ plan.name }}</span>
                    </div>
                    @if (plan.isPopular) {
                      <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shrink-0">
                        Phổ biến
                      </span>
                    }
                  </div>
                  <div class="flex items-baseline justify-between text-xs tabular-nums">
                    <span class="text-slate-500 dark:text-slate-400">Đơn giá tháng:</span>
                    <span class="font-mono font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums">{{ plan.monthlyPrice | vndCurrency:'/tháng' }}</span>
                  </div>
                  <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700 tabular-nums">
                    <span>Tối đa {{ plan.maxProperties >= 999 ? 'Không giới hạn' : plan.maxProperties + ' cơ sở' }}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>{{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>{{ plan.maxStaff >= 999 ? '∞ NV' : plan.maxStaff + ' NV' }}</span>
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
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-2.5 sm:p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            @if (canViewChainHq()) {
              <button
                type="button"
                (click)="setViewMode('HQ')"
                [attr.aria-pressed]="viewMode() === 'HQ'"
                class="min-h-11 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                [ngClass]="viewMode() === 'HQ'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700'"
              >
                <i class="pi pi-sitemap text-xs" aria-hidden="true"></i>
                <span>Cơ sở tổng (Chuỗi HQ)</span>
                <span
                  class="px-1.5 py-0.5 rounded text-xs tabular-nums"
                  [ngClass]="viewMode() === 'HQ' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
                >
                  {{ chainMetrics().totalProperties || branchMemberships().length || 1 }} CN
                </span>
              </button>
            }

            <button
              type="button"
              (click)="setViewMode('PROPERTY')"
              [attr.aria-pressed]="viewMode() === 'PROPERTY'"
              class="min-h-11 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              [ngClass]="viewMode() === 'PROPERTY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700'"
            >
              <i class="pi pi-building text-xs" aria-hidden="true"></i>
              <span>Chi nhánh: {{ authService.activePropertyName() || 'Hiện tại' }}</span>
              @if (authService.activePropertyCode()) {
                <span
                  class="px-1.5 py-0.5 rounded text-xs font-mono"
                  [ngClass]="viewMode() === 'PROPERTY' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'"
                >
                  {{ authService.activePropertyCode() }}
                </span>
              }
            </button>
          </div>

          <!-- Quick Branch Pills when user has multiple branches -->
          @if (branchMemberships().length > 1) {
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap mr-1 hidden md:inline">
                Đổi nhanh cơ sở:
              </span>
              @for (m of branchMemberships(); track m.id) {
                <button
                  type="button"
                  (click)="quickSwitchBranch(m.propertyId!)"
                  [disabled]="switchingBranchId() !== null"
                  class="min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  [ngClass]="authService.activePropertyId()?.toLowerCase() === m.propertyId?.toLowerCase() && viewMode() === 'PROPERTY'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:text-emerald-700'"
                >
                  @if (switchingBranchId() === m.propertyId) {
                    <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                  } @else {
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="authService.activePropertyId()?.toLowerCase() === m.propertyId?.toLowerCase() ? 'bg-emerald-500' : 'bg-slate-300'" aria-hidden="true"></span>
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
          <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <i class="pi pi-crown text-xs text-[var(--brand-primary)]" aria-hidden="true"></i>
                  <span>TRUNG TÂM ĐIỀU HÀNH CHUỖI (HQ)</span>
                </span>
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Thương hiệu: <strong class="text-slate-900 dark:text-slate-100">{{ tenantBrandName() }}</strong>
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Tổng quan Cơ sở tổng & Chuỗi Chi nhánh
              </h1>
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Chủ sở hữu / Quản lý: <strong class="text-slate-900 dark:text-slate-100">{{ currentUser()?.fullName }}</strong></span>
                <span aria-hidden="true">&bull;</span>
                <span class="capitalize">{{ todayDateString() }}</span>
              </p>
            </div>

            <div class="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                (click)="loadChainHqData()"
                class="min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingHq()" aria-hidden="true"></i>
                <span>Đồng bộ chuỗi</span>
              </button>
              <a
                routerLink="/properties"
                class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-xs font-bold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                <span>Quản lý Chi nhánh</span>
              </a>
              <a
                routerLink="/reports"
                class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <i class="pi pi-chart-bar text-xs" aria-hidden="true"></i>
                <span>Báo cáo Doanh thu</span>
              </a>
            </div>
          </div>

          <!-- HQ Chain KPI Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng Cơ sở Trực thuộc</span>
                <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                  <i class="pi pi-sitemap text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">{{ chainMetrics().totalProperties }}</div>
                <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                  <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                  <span>{{ chainMetrics().activeProperties }} cơ sở đang vận hành</span>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng Quỹ phòng Chuỗi</span>
                <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <i class="pi pi-th-large text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">{{ chainMetrics().totalRooms }}</div>
                <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ chainMetrics().occupiedRooms }} đang có khách &bull; {{ chainMetrics().availableRooms }} phòng trống
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Công suất Toàn chuỗi</span>
                <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                  <i class="pi pi-chart-line text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">{{ chainMetrics().occupancyRate }}%</div>
                <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Tỷ lệ lấp đầy trung bình các chi nhánh
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doanh thu Hôm nay (HQ)</span>
                <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center border border-rose-100 dark:border-rose-800">
                  <i class="pi pi-dollar text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-xl xl:text-2xl leading-tight break-words font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ chainMetrics().todayChainRevenue | vndCurrency }}
                </div>
                <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Cộng dồn thời gian thực toàn chuỗi
                </div>
              </div>
            </div>
          </div>

          <!-- HQ Branch Revenue Comparison ChartCard -->
          <app-chart-card
            title="So sánh Doanh thu hôm nay theo từng Chi nhánh"
            subtitle="Tổng hợp doanh thu ghi nhận trong ngày giữa các cơ sở trực thuộc"
            chartType="bar"
            [labels]="hqBranchChartLabels()"
            [datasets]="hqBranchChartDatasets()"
            [loading]="loadingHq()"
            valueUnit="₫"
            [heightPx]="240"
            emptyTitle="Chưa có dữ liệu chi nhánh"
            emptyDescription="Hãy thêm chi nhánh để theo dõi biểu đồ so sánh doanh thu."
            (retry)="loadChainHqData()"
          />

          <!-- HQ Main Grid: Branch Comparison Matrix (2 cols) + SaaS Quota & Audit Logs (1 col) -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left 2 cols: Branch Performance Cards -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">Danh sách Cơ sở & Chi nhánh Trực thuộc</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nhấn "Vào vận hành" để chuyển ngữ cảnh làm việc sang từng cơ sở</p>
                </div>
                <a routerLink="/properties" class="min-h-11 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                  <span>Cấu hình chi nhánh</span>
                  <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
                </a>
              </div>

              @if (loadingHq()) {
                <div class="py-12 text-center text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2" aria-hidden="true"></i>
                  <p class="text-xs">Đang tải danh sách chi nhánh toàn chuỗi...</p>
                </div>
              } @else if (chainProperties().length === 0) {
                <div class="py-10 text-center text-slate-500 dark:text-slate-400">
                  <i class="pi pi-building text-3xl text-slate-300 mb-2" aria-hidden="true"></i>
                  <p class="text-sm font-medium">Chuỗi chưa có chi nhánh nào.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (prop of chainProperties(); track prop.id) {
                    <div
                      class="rounded-2xl border p-4 transition-all flex flex-col justify-between gap-4"
                      [ngClass]="authService.activePropertyId()?.toLowerCase() === prop.id.toLowerCase()
                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30 shadow-xs'
                        : 'border-slate-200/90 dark:border-slate-700 bg-[var(--surface-subtle,#fbfbfa)] dark:bg-slate-800/70 hover:border-indigo-300'"
                    >
                      <div class="space-y-2.5">
                        <div class="flex items-start justify-between gap-2">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold shrink-0">
                              {{ prop.code }}
                            </span>
                            <div class="min-w-0">
                              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{{ prop.name }}</h3>
                              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ prop.city }} &bull; {{ prop.propertyTypeName || 'Khách sạn' }}</p>
                            </div>
                          </div>
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                            [ngClass]="prop.isActive !== false ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
                          >
                            {{ prop.isActive !== false ? 'Đang mở' : 'Tạm ngưng' }}
                          </span>
                        </div>

                        <p class="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                          <i class="pi pi-map-marker text-xs text-slate-400" aria-hidden="true"></i>
                          <span class="truncate">{{ prop.address }}</span>
                        </p>

                        <!-- Branch KPI Mini Strip -->
                        <div class="grid grid-cols-2 gap-2 pt-1 tabular-nums">
                          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700">
                            <span class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold block">Công suất phòng</span>
                            <span class="text-sm font-extrabold font-mono text-slate-800 dark:text-slate-100">
                              {{ prop.occupiedRooms }}/{{ prop.totalRooms }} phòng
                            </span>
                          </div>
                          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700">
                            <span class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold block">Doanh thu ngày</span>
                            <span class="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                              {{ (prop.todayRevenue || 0) | vndCurrency }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1 flex-wrap text-xs">
                          @if (prop.allowDailyBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">Theo ngày</span>
                          }
                          @if (prop.allowOvernightBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">Qua đêm</span>
                          }
                          @if (prop.allowHourlyBooking) {
                            <span class="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">Theo giờ</span>
                          }
                        </div>

                        <button
                          type="button"
                          (click)="enterBranchOperations(prop)"
                          [disabled]="switchingBranchId() === prop.id"
                          class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          @if (switchingBranchId() === prop.id) {
                            <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                            <span>Đang chuyển...</span>
                          } @else {
                            <span>Vào vận hành</span>
                            <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
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
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                      <i class="pi pi-box text-sm" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Gói cước SaaS của Chuỗi</h3>
                      <span class="text-xs text-slate-500 dark:text-slate-400">Hạn mức tài nguyên Tenant</span>
                    </div>
                  </div>
                  <a routerLink="/subscriptions" class="min-h-11 inline-flex items-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                    Nâng cấp <i class="pi pi-arrow-right ml-1 text-xs" aria-hidden="true"></i>
                  </a>
                </div>

                @if (subscription(); as sub) {
                  <div class="p-4 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs uppercase tracking-wider text-indigo-300 font-bold">Gói đang kích hoạt</span>
                      <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {{ sub.status || 'Active' }}
                      </span>
                    </div>
                    <div class="text-lg font-extrabold text-white">{{ sub.tierName }}</div>
                    <div class="text-xs text-indigo-200 font-mono tabular-nums">
                      {{ sub.pricePerCycle | vndCurrency:' / kỳ' }}
                    </div>
                  </div>

                  <div class="space-y-2.5 text-xs tabular-nums">
                    <div class="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-600 dark:text-slate-300 font-medium">Hạn mức Chi nhánh:</span>
                      <span class="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {{ sub.currentPropertyCount }} / {{ sub.maxPropertiesAllowed >= 999 ? 'Không giới hạn' : sub.maxPropertiesAllowed + ' cơ sở' }}
                      </span>
                    </div>
                    <div class="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-600 dark:text-slate-300 font-medium">Hạn mức Quỹ phòng:</span>
                      <span class="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {{ sub.currentRoomCount }} / {{ sub.maxRoomsAllowed >= 999 ? 'Không giới hạn' : sub.maxRoomsAllowed + ' phòng' }}
                      </span>
                    </div>
                  </div>
                } @else {
                  <div class="text-xs text-slate-500 dark:text-slate-400 py-3">
                    Đang đồng bộ thông tin thuê bao SaaS của chuỗi...
                  </div>
                }
              </div>

              <!-- Card 2: Nhật ký Kiểm toán Chuỗi -->
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                      <i class="pi pi-history text-sm" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Nhật ký Kiểm toán Chuỗi</h3>
                      <span class="text-xs text-slate-500 dark:text-slate-400">Hoạt động thay đổi dữ liệu gần đây</span>
                    </div>
                  </div>
                  <a routerLink="/audit-logs" class="min-h-11 inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline">
                    Chi tiết <i class="pi pi-arrow-right ml-1 text-xs" aria-hidden="true"></i>
                  </a>
                </div>

                @if (chainAuditLogs().length === 0) {
                  <p class="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">Chưa có bản ghi kiểm toán mới.</p>
                } @else {
                  <div class="space-y-2.5">
                    @for (log of chainAuditLogs().slice(0, 4); track log.id) {
                      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs space-y-1">
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-bold text-slate-800 dark:text-slate-100 truncate">{{ getAuditEntityLabel(log.entityName) }}</span>
                          <span
                            class="px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0"
                            [ngClass]="getAuditActionBadgeClass(log.action)"
                          >
                            {{ getAuditActionLabel(log.action) }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {{ getAuditSummary(log) }}
                        </p>
                        <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span class="truncate">{{ log.propertyName || 'Toàn chuỗi (HQ)' }}</span>
                          <span class="shrink-0 truncate">{{ log.userFullName || log.userEmail || 'Hệ thống' }}</span>
                        </div>
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
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Chi nhánh: {{ authService.activePropertyCode() || 'Chưa chọn' }}
                </span>
                <span class="text-xs text-slate-400" aria-hidden="true">&bull;</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {{ authService.activePropertyName() || 'Tất cả chi nhánh' }}
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1.5 tracking-tight">
                Xin chào, {{ currentUser()?.fullName || 'Nhân viên' }}!
              </h1>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span class="capitalize">{{ todayDateString() }}</span>
                <span class="text-slate-300" aria-hidden="true">&bull;</span>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 tabular-nums">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                  Sẵn sàng đón khách: {{ readyRate() }}%
                </span>
              </p>
            </div>

            <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
              @if (canViewChainHq()) {
                <button
                  type="button"
                  (click)="setViewMode('HQ')"
                  class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  <i class="pi pi-sitemap text-xs" aria-hidden="true"></i>
                  <span>Tổng quan Chuỗi (HQ)</span>
                </button>
              }
              @if (canManageRooms()) {
                <a routerLink="/rooms">
                  <p-button
                    label="Sơ đồ Phòng"
                    icon="pi pi-th-large"
                    styleClass="p-button-success min-h-11"
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
                    styleClass="min-h-11"
                  />
                </a>
              }
            </div>
          </div>

          <!-- Error Banner -->
          @if (error()) {
            <div role="alert" class="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-rose-600 text-base shrink-0" aria-hidden="true"></i>
                <span>{{ error() }}</span>
              </div>
              <button
                type="button"
                (click)="loadDashboardData()"
                class="min-h-11 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          }

          <!-- Real Metrics Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng số phòng</span>
                <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <i class="pi pi-building text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                @if (loading()) {
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none rounded"></div>
                } @else {
                  <div class="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-mono tabular-nums">{{ totalRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                    <span>{{ occupiedRooms() }} phòng đang có khách</span>
                  </div>
                }
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phòng sạch (Sẵn sàng)</span>
                <div class="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center border border-teal-100 dark:border-teal-800">
                  <i class="pi pi-check-circle text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                @if (loading()) {
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none rounded"></div>
                } @else {
                  <div class="text-3xl font-extrabold text-teal-700 dark:text-teal-400 tracking-tight font-mono tabular-nums">{{ cleanRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Đạt {{ readyRate() }}% tổng quỹ phòng
                  </div>
                }
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cần dọn / Đang dọn</span>
                <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                  <i class="pi pi-sparkles text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                @if (loading()) {
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none rounded"></div>
                } @else {
                  <div class="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight font-mono tabular-nums">{{ dirtyRooms() + cleaningRooms() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {{ dirtyRooms() }} cần dọn &bull; {{ cleaningRooms() }} đang dọn
                  </div>
                }
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đơn đặt phòng</span>
                <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                  <i class="pi pi-calendar text-lg" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                @if (loadingOperational()) {
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none rounded"></div>
                } @else {
                  <div class="text-3xl font-extrabold text-indigo-900 dark:text-indigo-300 tracking-tight font-mono tabular-nums">{{ totalReservationsCount() }}</div>
                  <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {{ checkedInCount() }} đang ở &bull; {{ upcomingConfirmedCount() }} sắp đến
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Room Readiness ChartCard (Replaces hand-coded CSS progress bars) -->
          <app-chart-card
            title="Tỷ lệ vận hành buồng phòng thực tế"
            [subtitle]="'Sẵn sàng đón khách ' + readyRate() + '% (' + cleanRooms() + '/' + totalRooms() + ' phòng sạch)'"
            chartType="doughnut"
            [labels]="propertyRoomChartLabels()"
            [datasets]="propertyRoomChartDatasets()"
            [loading]="loading()"
            [error]="error()"
            valueUnit="phòng"
            [heightPx]="240"
            emptyTitle="Chưa có phòng lưu trú tại chi nhánh"
            emptyDescription="Thêm phòng để theo dõi biểu đồ tình trạng buồng phòng trực tiếp."
            (retry)="loadDashboardData()"
          />

          <!-- Main Grid: Rooms Snapshot (2 cols) + Live Reservations & Revenue (1 col) -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left: Real Rooms Snapshot (2 cols) -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs">
              <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">Hiện trạng phòng chi nhánh</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Danh sách phòng thực tế từ cơ sở dữ liệu</p>
                </div>
                <a routerLink="/rooms" class="min-h-11 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:underline">
                  <span>Mở sơ đồ Rack</span>
                  <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
                </a>
              </div>

              @if (loading()) {
                <div class="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <i class="pi pi-spin pi-spinner text-2xl text-emerald-600" aria-hidden="true"></i>
                  <span class="text-xs">Đang tải danh sách phòng...</span>
                </div>
              } @else if (rooms().length === 0) {
                <div class="py-12 text-center text-slate-400">
                  <i class="pi pi-building text-3xl text-slate-300 mb-2" aria-hidden="true"></i>
                  <p class="text-sm font-medium text-slate-600 dark:text-slate-300">Chi nhánh này chưa có phòng nào.</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Hãy thêm loại phòng và phòng mới để bắt đầu quản lý.</p>
                  <div class="mt-4">
                    <a routerLink="/rooms">
                      <p-button label="Thêm phòng ngay" icon="pi pi-plus" size="small" styleClass="p-button-success min-h-11" />
                    </a>
                  </div>
                </div>
              } @else {
                <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  @for (r of rooms(); track r.id) {
                    <div class="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 transition-colors bg-[var(--surface-subtle,#fbfbfa)] dark:bg-slate-800/60 hover:border-emerald-300">
                      <div class="flex items-center justify-between">
                        <span class="text-base font-bold text-slate-800 dark:text-slate-100 font-mono tabular-nums">Phòng {{ r.roomNumber }}</span>
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono tabular-nums">T{{ r.floor }}</span>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                        {{ r.roomTypeName }}
                      </div>
                      <div class="mt-2.5 flex items-center justify-between gap-1">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                          [ngClass]="getStatusBadgeClass(r.status)"
                        >
                          {{ getStatusLabel(r.status) }}
                        </span>
                        <span class="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">{{ r.basePrice | vndCurrency }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right: Live Reservations & Cashier Summary (1 col) -->
            <div class="space-y-5">
              <!-- Live Card 1: Hoạt động Đặt phòng -->
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                      <i class="pi pi-calendar-plus text-sm" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Đặt phòng gần đây</h3>
                      <span class="text-xs text-slate-500 dark:text-slate-400">Dữ liệu trực tiếp từ phân hệ Lễ tân</span>
                    </div>
                  </div>
                  <a routerLink="/reservations" class="min-h-11 inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                    Tất cả <i class="pi pi-arrow-right ml-1 text-xs" aria-hidden="true"></i>
                  </a>
                </div>

                @if (loadingOperational()) {
                  <div class="space-y-2.5 animate-pulse motion-reduce:animate-none">
                    <div class="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div class="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                  </div>
                } @else if (recentReservations().length === 0) {
                  <div class="py-6 text-center bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4">
                    <i class="pi pi-calendar text-slate-300 text-xl mb-1.5" aria-hidden="true"></i>
                    <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Chưa có đơn đặt phòng tại chi nhánh</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bấm để tạo đặt phòng hoặc nhận khách Walk-in</p>
                    <a
                      routerLink="/reservations"
                      class="mt-3 min-h-11 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                      <span>Tạo đặt phòng</span>
                    </a>
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (res of recentReservations().slice(0, 4); track res.id) {
                      <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{{ res.guestName }}</span>
                            <span class="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              {{ res.confirmationCode }}
                            </span>
                          </div>
                          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
                            {{ res.roomNumber ? 'Phòng ' + res.roomNumber : res.roomTypeName }} &bull; {{ res.checkInDate | businessDate }}
                          </div>
                        </div>
                        <div class="text-right shrink-0">
                          <div class="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ res.totalAmount | vndCurrency }}</div>
                          <span class="inline-block text-xs font-semibold px-1.5 py-0.5 rounded" [ngClass]="getReservationBadgeClass(res.status)">
                            {{ getReservationStatusLabel(res.status) }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Live Card 2: Thu ngân & Doanh thu -->
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                      <i class="pi pi-wallet text-sm" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Thu ngân & Doanh thu</h3>
                      <span class="text-xs text-slate-500 dark:text-slate-400">Tổng hợp giao dịch tại chi nhánh</span>
                    </div>
                  </div>
                  <a routerLink="/payments" class="min-h-11 inline-flex items-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                    Sổ quỹ <i class="pi pi-arrow-right ml-1 text-xs" aria-hidden="true"></i>
                  </a>
                </div>

                <div class="p-4 rounded-xl bg-slate-900 text-white space-y-1">
                  <span class="text-xs uppercase tracking-wider text-slate-400 font-bold">Thực thu ca hôm nay</span>
                  <div class="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums">
                    {{ (paymentSummary()?.totalCollected || 0) | vndCurrency }}
                  </div>
                  <div class="text-xs text-slate-300 flex items-center justify-between pt-1 tabular-nums">
                    <span>Giao dịch hoàn tất:</span>
                    <span class="font-mono font-bold">{{ paymentSummary()?.completedCount || 0 }} phiếu thu</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <span class="text-xs text-slate-500 dark:text-slate-400 block">Tiền mặt</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-slate-100">{{ (paymentSummary()?.cashCollected || 0) | vndCurrency }}</span>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <span class="text-xs text-slate-500 dark:text-slate-400 block">Chuyển khoản / QR</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-slate-100">{{ (paymentSummary()?.bankTransferCollected || 0) | vndCurrency }}</span>
                  </div>
                </div>

                <div class="pt-1 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800 tabular-nums">
                  <span class="text-slate-500 dark:text-slate-400">Tổng giá trị booking:</span>
                  <span class="font-mono font-bold text-emerald-700 dark:text-emerald-400">{{ totalBookingRevenue() | vndCurrency }}</span>
                </div>

                <a
                  routerLink="/reports"
                  class="w-full min-h-11 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <i class="pi pi-chart-bar text-xs text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NotificationService);
  private readonly roomService = inject(RoomService);
  private readonly reservationService = inject(ReservationService);
  private readonly paymentService = inject(PaymentService);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly adminPlansService = inject(AdminPlansService);
  private readonly adminContractsService = inject(AdminContractsService);
  private readonly platformGovernanceService = inject(PlatformGovernanceService, { optional: true });

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
  readonly platformOverview = signal<PlatformOverviewDto | null>(null);
  readonly platformPlans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly platformContracts = signal<TenantContractDto[]>([]);
  readonly contractSortField = signal<PlatformContractSortField>('contractValue');
  readonly contractSortDir = signal<'asc' | 'desc'>('desc');
  readonly platformMetrics = computed(() =>
    computePlatformMetrics(this.platformPlans(), this.platformContracts())
  );

  readonly sortedPlatformContracts = computed<TenantContractDto[]>(() => {
    const list = [...this.platformContracts()];
    const field = this.contractSortField();
    const dir = this.contractSortDir() === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (field === 'contractValue') {
        return ((a.contractValue ?? 0) - (b.contractValue ?? 0)) * dir;
      }
      return String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'vi') * dir;
    });
  });

  readonly platformPlanChartLabels = computed<readonly string[]>(() => {
    const breakdown = this.platformOverview()?.planBreakdown ?? [];
    if (breakdown.length > 0) {
      return breakdown.map(p => `${p.name} (${p.activeTenantsCount} Tenant)`);
    }
    return this.platformPlans().map(p => p.name);
  });

  readonly platformPlanChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    const breakdown = this.platformOverview()?.planBreakdown ?? [];
    if (breakdown.length > 0) {
      return [
        {
          label: 'MRR ước tính',
          data: breakdown.map(p => p.estimatedMrr),
          backgroundColor: '#4f46e5',
          borderColor: '#4338ca'
        }
      ];
    }
    const plans = this.platformPlans();
    if (plans.length === 0) return [];
    return [
      {
        label: 'MRR ước tính',
        data: plans.map(p => p.estimatedMonthlyRevenue ?? 0),
        backgroundColor: '#4f46e5',
        borderColor: '#4338ca'
      }
    ];
  });

  // Chain HQ state
  readonly loadingHq = signal(false);
  readonly chainProperties = signal<TenantPropertySummaryDto[]>([]);
  readonly subscription = signal<TenantSubscriptionDto | null>(null);
  readonly chainAuditLogs = signal<AuditLogListItem[]>([]);
  readonly chainMetrics = computed(() => computeChainHqMetrics(this.chainProperties()));

  readonly hqBranchChartLabels = computed<readonly string[]>(() =>
    this.chainProperties().map(p => p.code || p.name)
  );

  readonly hqBranchChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    const props = this.chainProperties();
    if (props.length === 0) return [];
    return [
      {
        label: 'Doanh thu ngày',
        data: props.map(p => p.todayRevenue || 0),
        backgroundColor: '#059669',
        borderColor: '#047857'
      }
    ];
  });

  // Property Operational state
  readonly propertySummary = signal<DashboardSummaryDto | null>(null);
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
    const summary = this.propertySummary();
    if (summary) return Math.round(summary.readyRatePercent);
    const total = this.totalRooms();
    if (total <= 0) return 0;
    return Math.round((this.cleanRooms() / total) * 100);
  });

  readonly propertyRoomChartLabels = computed<readonly string[]>(() => {
    if (this.totalRooms() <= 0) return [];
    return ['Sạch sẵn sàng', 'Đang có khách', 'Đang dọn dẹp', 'Cần dọn ngay', 'Ngưng phục vụ'];
  });

  readonly propertyRoomChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    if (this.totalRooms() <= 0) return [];
    return [
      {
        label: 'Số phòng',
        data: [
          this.cleanRooms(),
          this.occupiedRooms(),
          this.cleaningRooms(),
          this.dirtyRooms(),
          this.oosRooms()
        ],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#64748b']
      }
    ];
  });

  recentReservations = signal<ReservationDto[]>([]);
  totalReservationsCount = signal(0);
  paymentSummary = signal<PaymentSummaryDto | null>(null);

  readonly checkedInCount = computed(() => {
    const summary = this.propertySummary();
    if (summary) return summary.checkedInCount;
    return this.recentReservations().filter(r => r.status === ReservationStatus.CheckedIn).length;
  });

  readonly upcomingConfirmedCount = computed(() => {
    const summary = this.propertySummary();
    if (summary) return summary.upcomingConfirmedCount;
    return this.recentReservations().filter(
      r => r.status === ReservationStatus.Confirmed || r.status === ReservationStatus.PendingPayment
    ).length;
  });

  readonly totalBookingRevenue = computed(() => {
    const summary = this.propertySummary();
    if (summary) return summary.totalBookingRevenue;
    return this.recentReservations()
      .filter(r => r.status !== ReservationStatus.Cancelled && r.status !== ReservationStatus.NoShow)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  });

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
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const mode = params.get('mode');
        if (mode === 'hq' && this.canViewChainHq()) {
          this.viewMode.set('HQ');
          this.loadChainHqData();
        } else if (mode === 'property') {
          this.viewMode.set('PROPERTY');
        }
      });
  }

  toggleContractSort(field: PlatformContractSortField): void {
    if (this.contractSortField() === field) {
      this.contractSortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.contractSortField.set(field);
      this.contractSortDir.set(field === 'contractValue' ? 'desc' : 'asc');
    }
  }

  getContractAriaSort(field: PlatformContractSortField): 'ascending' | 'descending' | 'none' {
    if (this.contractSortField() !== field) return 'none';
    return this.contractSortDir() === 'asc' ? 'ascending' : 'descending';
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
    this.authService
      .switchContext(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    this.authService
      .switchContext(prop.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

    this.platformGovernanceService
      ?.getPlatformOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: overview => {
          this.platformOverview.set(overview);
        },
        error: () => {
          this.platformOverview.set(null);
        }
      });

    this.adminPlansService
      .getAllPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: plans => {
          this.platformPlans.set(plans || []);
          this.loadingPlatform.set(false);
        },
        error: () => {
          this.loadingPlatform.set(false);
        }
      });

    this.adminContractsService
      .getAllContracts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: contracts => {
          this.platformContracts.set(contracts || []);
        },
        error: () => {}
      });
  }

  loadChainHqData(): void {
    if (this.isSuperAdmin()) return;

    if (this.authService.hasPermission('PROPERTIES', 1)) {
      this.loadingHq.set(true);
      this.propertyService
        .getTenantProperties()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: props => {
            this.chainProperties.set(props || []);
            this.loadingHq.set(false);
          },
          error: () => {
            this.loadingHq.set(false);
          }
        });
    } else {
      this.chainProperties.set([]);
      this.loadingHq.set(false);
    }

    if (this.authService.hasPermission('SUBSCRIPTIONS', 1)) {
      this.subscriptionService
        .getCurrentSubscription()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: sub => {
            this.subscription.set(sub);
          },
          error: () => {}
        });
    }

    const propId = this.authService.activePropertyId();
    if (
      propId &&
      (this.authService.hasPermission('AUDIT_LOGS', 1) ||
        this.authService.hasPermission('SETTINGS', 1))
    ) {
      this.auditLogService
        .getAuditLogs({ propertyId: propId, page: 1, pageSize: 6 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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
    const propId = this.authService.activePropertyId();
    if (!propId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    if (this.platformGovernanceService) {
      this.platformGovernanceService
        .getDashboardSummary(propId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: summary => {
            this.propertySummary.set(summary);
            this.totalRooms.set(summary.totalRooms);
            this.cleanRooms.set(summary.cleanRooms);
            this.occupiedRooms.set(summary.occupiedRooms);
            this.dirtyRooms.set(summary.dirtyRooms);
            this.cleaningRooms.set(summary.cleaningRooms);
            this.oosRooms.set(summary.outOfServiceRooms);
            this.totalReservationsCount.set(summary.totalActiveReservations);
            this.loading.set(false);
          },
          error: () => {
            this.propertySummary.set(null);
          }
        });
    }

    this.roomService
      .getRooms({ page: 1, pageSize: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loading.set(false);
          const items = res.items || [];
          this.rooms.set(items);
          if (!this.propertySummary()) {
            const metrics = computePropertyRoomMetrics(items);
            this.totalRooms.set(res.totalCount ?? metrics.totalRooms);
            this.cleanRooms.set(metrics.cleanRooms);
            this.occupiedRooms.set(metrics.occupiedRooms);
            this.dirtyRooms.set(metrics.dirtyRooms);
            this.cleaningRooms.set(metrics.cleaningRooms);
            this.oosRooms.set(metrics.oosRooms);
          }
        },
        error: err => {
          this.loading.set(false);
          if (!this.propertySummary()) {
            this.error.set(err?.error?.message || 'Không thể tải dữ liệu phòng. Vui lòng thử lại.');
          }
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
    this.reservationService
      .getReservations({ propertyId: propId, page: 1, pageSize: 6 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.recentReservations.set(res.items || []);
          if (!this.propertySummary()) {
            this.totalReservationsCount.set(res.totalCount ?? (res.items?.length || 0));
          }
          this.loadingOperational.set(false);
        },
        error: () => {
          this.loadingOperational.set(false);
        }
      });

    this.paymentService
      .getPaymentSummary(propId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case RoomStatus.Dirty:
        return 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      case RoomStatus.Cleaning:
        return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case RoomStatus.Occupied:
        return 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case RoomStatus.OutOfService:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
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
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case ReservationStatus.Confirmed:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case ReservationStatus.CheckedOut:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case ReservationStatus.Cancelled:
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    }
  }

  getAuditEntityLabel(entityName?: string | null): string {
    return getAuditEntityDisplayLabel(entityName);
  }

  getAuditActionLabel(action?: string | null): string {
    return getAuditActionLabel(action);
  }

  getAuditActionBadgeClass(action?: string | null): string {
    return getAuditActionBadgeClass(action);
  }

  getAuditSummary(log: AuditLogListItem): string {
    if (log.changeSummary?.trim()) {
      return getFriendlyAuditSummary(log.changeSummary, log.action, log.entityName);
    }
    return `Thay đổi bởi ${log.userFullName || log.userEmail || 'Hệ thống'}`;
  }
}
