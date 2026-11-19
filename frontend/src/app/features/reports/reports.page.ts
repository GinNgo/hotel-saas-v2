import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  RevenueSummaryDto,
  PmsKpiDto,
  GroupAnalyticsDto,
  PropertyPerformanceDto
} from '../../core/models/report.model';
import { DateRangeFilterComponent, DateRangeFilterValue } from '../../shared/components/date-range-filter/date-range-filter.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { ChartCardComponent, ChartCardDataset } from '../../shared/components/chart-card/chart-card.component';
import { formatCalendarDate } from '../../core/utils/date-time.util';

type PropertySortField = 'propertyName' | 'totalRooms' | 'revenue' | 'occupancyRate' | 'adr' | 'revPar';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateRangeFilterComponent,
    PageHeaderComponent,
    ChartCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      <!-- Header & Action Bar -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            <i class="pi pi-chart-line text-xs" aria-hidden="true"></i> PMS Analytics &amp; Accounting
          </span>
          <span class="text-xs text-slate-600 dark:text-slate-400 font-medium">Báo cáo chuẩn Quốc tế</span>
        </div>

        <app-page-header
          title="Báo cáo Doanh thu & Chỉ số Hiệu suất PMS"
          subtitle="Phân tích tỷ lệ lấp đầy (Occupancy), giá phòng bình quân (ADR), hiệu suất doanh thu (RevPAR) và báo cáo chuỗi đa chi nhánh."
        >
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn nhanh kỳ báo cáo">
              <button type="button" (click)="selectCalendarPeriod('week')" class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Tuần này</button>
              <button type="button" (click)="selectCalendarPeriod('month')" class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Tháng này</button>
              <button type="button" (click)="selectCalendarPeriod('quarter')" class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Quý này</button>
              <button type="button" (click)="selectCalendarPeriod('year')" class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Năm nay</button>
            </div>
            <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Xuất báo cáo">
              <button
                type="button"
                (click)="exportPdf()"
                [disabled]="isExporting()"
                class="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <i class="pi pi-file-pdf" [class.pi-spin]="isExporting()" aria-hidden="true"></i>
                <span>{{ isExporting() ? 'Đang xuất PDF...' : 'Tải PDF' }}</span>
              </button>
              <button
                type="button"
                (click)="exportExcel()"
                [disabled]="isExporting()"
                class="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <i class="pi pi-file-excel" [class.pi-spin]="isExporting()" aria-hidden="true"></i>
                <span>{{ isExporting() ? 'Đang xuất Excel...' : 'Tải Excel (.xlsx)' }}</span>
              </button>
              <button
                type="button"
                (click)="exportCsv()"
                [disabled]="isExporting()"
                class="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <i class="pi pi-file-excel" [class.pi-spin]="isExporting()" [class.pi-spinner]="isExporting()" aria-hidden="true"></i>
                <span>{{ isExporting() ? 'Đang xuất CSV...' : 'Xuất Excel / CSV (BOM)' }}</span>
              </button>
            </div>
          </div>
        </app-page-header>
      </div>

      <!-- Navigation Tabs: Branch Level vs Multi-Property Group Portfolio -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto" role="tablist" aria-label="Phạm vi báo cáo">
        @if (authService.isTenantWide) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'group'"
            (click)="switchTab('group')"
            class="min-h-11 flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            [class.border-indigo-600]="activeTab() === 'group'"
            [class.text-indigo-600]="activeTab() === 'group'"
            [class.dark:text-indigo-400]="activeTab() === 'group'"
            [class.border-transparent]="activeTab() !== 'group'"
            [class.text-slate-500]="activeTab() !== 'group'"
          >
            <i class="pi pi-building text-base" aria-hidden="true"></i>
            <span>Toàn bộ Chuỗi Khách sạn (Multi-Property Group)</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">Mới</span>
          </button>
        }

        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'branch'"
          (click)="switchTab('branch')"
          class="min-h-11 flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          [class.border-emerald-600]="activeTab() === 'branch'"
          [class.text-emerald-700]="activeTab() === 'branch'"
          [class.dark:text-emerald-400]="activeTab() === 'branch'"
          [class.border-transparent]="activeTab() !== 'branch'"
          [class.text-slate-500]="activeTab() !== 'branch'"
        >
          <i class="pi pi-home text-base" aria-hidden="true"></i>
          <span>Chi nhánh Hiện tại (Single Property)</span>
        </button>
      </div>

      <!-- Date Range Filter Bar -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-2">Chọn nhanh:</span>
          <button
            type="button"
            (click)="selectQuickPeriod(7)"
            [attr.aria-pressed]="selectedDays() === 7"
            class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            [class.bg-slate-900]="selectedDays() === 7"
            [class.text-white]="selectedDays() === 7"
            [class.bg-slate-100]="selectedDays() !== 7"
            [class.text-slate-700]="selectedDays() !== 7"
          >
            7 ngày qua
          </button>
          <button
            type="button"
            (click)="selectQuickPeriod(14)"
            [attr.aria-pressed]="selectedDays() === 14"
            class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            [class.bg-slate-900]="selectedDays() === 14"
            [class.text-white]="selectedDays() === 14"
            [class.bg-slate-100]="selectedDays() !== 14"
            [class.text-slate-700]="selectedDays() !== 14"
          >
            14 ngày qua
          </button>
          <button
            type="button"
            (click)="selectQuickPeriod(30)"
            [attr.aria-pressed]="selectedDays() === 30"
            class="min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            [class.bg-slate-900]="selectedDays() === 30"
            [class.text-white]="selectedDays() === 30"
            [class.bg-slate-100]="selectedDays() !== 30"
            [class.text-slate-700]="selectedDays() !== 30"
          >
            30 ngày qua
          </button>
        </div>

        <div class="w-full lg:w-auto">
          <app-date-range-filter
            label="Khoảng ngày"
            [initialFromDate]="fromDate"
            [initialToDate]="toDate"
            (filterChange)="onReportDateFilterChange($event)"
          />
        </div>
        @if (activeTab() === 'branch') {
          <label for="report-room-type-select" class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span>Loại phòng</span>
            <select
              id="report-room-type-select"
              class="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              [ngModel]="selectedRoomTypeId()"
              (ngModelChange)="onRoomTypeChange($event)"
            >
              <option value="">Tất cả</option>
              @for (roomType of roomTypes(); track roomType.id) {
                <option [value]="roomType.id">{{ roomType.name }}</option>
              }
            </select>
          </label>
        }
      </div>

      @if (loadError(); as errorMsg) {
        <div
          role="alert"
          aria-live="polite"
          class="rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
              <i class="pi pi-exclamation-triangle text-base" aria-hidden="true"></i>
            </div>
            <div>
              <h2 class="text-sm font-bold text-rose-900 dark:text-rose-200">Không thể tải dữ liệu báo cáo</h2>
              <p class="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{{ errorMsg }}</p>
            </div>
          </div>
          <button
            type="button"
            (click)="loadData()"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-2xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
            <span>Thử lại</span>
          </button>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- TAB 1: MULTI-PROPERTY GROUP PORTFOLIO ANALYTICS                         -->
      <!-- ========================================================================= -->
      @if (activeTab() === 'group') {
        @if (groupAnalytics(); as group) {
          <!-- Group Executive KPI Strip -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <!-- Total Group Revenue -->
            <div class="rounded-2xl border border-indigo-100 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
                <span class="text-xs font-bold uppercase tracking-wider">Doanh thu toàn chuỗi</span>
                <div class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <i class="pi pi-wallet text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ group.totalRevenue | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                  Phục vụ <strong>{{ group.totalGuests }}</strong> lượt khách ({{ group.totalBookings }} đơn đặt)
                </p>
              </div>
              <div class="mt-3 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between tabular-nums">
                <span>Hủy phòng: <strong class="text-rose-600 dark:text-rose-400">{{ group.cancellationRate }}%</strong></span>
                <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{{ group.totalProperties }} khách sạn</span>
              </div>
            </div>

            <!-- Group Average Occupancy -->
            <div class="rounded-2xl border border-emerald-100 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-900 dark:to-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <span class="text-xs font-bold uppercase tracking-wider">Công suất chuỗi bình quân</span>
                <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <i class="pi pi-percentage text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ group.averageOccupancyRate }}%
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                  Đã bán <strong>{{ group.totalSoldNights }}</strong> / {{ group.totalAvailableNights }} đêm phòng
                </p>
              </div>
              <div class="mt-3 text-xs text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                Công suất lấp đầy toàn danh mục
              </div>
            </div>

            <!-- Portfolio RevPAR -->
            <div class="rounded-2xl border border-purple-100 dark:border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-white dark:from-slate-900 dark:to-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-purple-700 dark:text-purple-300">
                <span class="text-xs font-bold uppercase tracking-wider">RevPAR toàn chuỗi</span>
                <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                  <i class="pi pi-bolt text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ group.portfolioRevPar | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Doanh thu bình quân trên mỗi phòng sẵn có</p>
              </div>
              <div class="mt-3 text-xs text-purple-700 dark:text-purple-300 font-semibold">
                Hiệu suất khai thác danh mục
              </div>
            </div>

            <!-- Portfolio ADR -->
            <div class="rounded-2xl border border-blue-100 dark:border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-blue-700 dark:text-blue-300">
                <span class="text-xs font-bold uppercase tracking-wider">Giá bán bình quân (ADR)</span>
                <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <i class="pi pi-tag text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ group.portfolioAdr | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Doanh thu trung bình mỗi đêm phòng bán được</p>
              </div>
              <div class="mt-3 text-xs text-blue-700 dark:text-blue-300 font-semibold tabular-nums">
                Quy mô: {{ group.totalRooms }} phòng đang vận hành
              </div>
            </div>
          </div>

          <!-- Comparative Property Matrix -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs overflow-hidden">
            <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/50">
              <div>
                <h2 class="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <i class="pi pi-table text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                  <span>Ma trận So sánh Hiệu suất Từng Khách sạn / Chi nhánh</span>
                </h2>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Xếp hạng đóng góp doanh thu, tỷ lệ khai thác phòng và chỉ số ADR/RevPAR theo từng đơn vị kinh doanh
                </p>
              </div>
              <div class="flex items-center flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                <span>Công suất cao (≥70%)</span>
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" aria-hidden="true"></span>
                <span>Đạt chuẩn (40-69%)</span>
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" aria-hidden="true"></span>
                <span>Cần tối ưu (&lt;40%)</span>
              </div>
            </div>

            <!-- Mobile Stacked Cards (<768px) -->
            <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              @for (prop of sortedProperties(); track prop.propertyId) {
                <article class="p-4 space-y-3">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ prop.propertyName }}</div>
                      <div class="text-xs text-slate-500 font-mono">{{ prop.propertyCode }} &bull; {{ prop.city || 'TP. Hồ Chí Minh' }}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold border"
                      [class.bg-emerald-50]="prop.performanceRank === 'Top Performer'"
                      [class.text-emerald-700]="prop.performanceRank === 'Top Performer'"
                      [class.border-emerald-200]="prop.performanceRank === 'Top Performer'"
                      [class.bg-blue-50]="prop.performanceRank === 'Standard'"
                      [class.text-blue-700]="prop.performanceRank === 'Standard'"
                      [class.border-blue-200]="prop.performanceRank === 'Standard'"
                      [class.bg-rose-50]="prop.performanceRank === 'Needs Attention'"
                      [class.text-rose-700]="prop.performanceRank === 'Needs Attention'"
                      [class.border-rose-200]="prop.performanceRank === 'Needs Attention'">
                      {{ prop.performanceBadge }}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs tabular-nums">
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-500 block">Doanh thu</span>
                      <strong class="font-mono text-slate-900 dark:text-slate-100">{{ prop.revenue | number:'1.0-0' }} ₫</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-500 block">Công suất</span>
                      <strong class="font-mono text-slate-900 dark:text-slate-100">{{ prop.occupancyRate }}% ({{ prop.totalSoldNights }} đêm)</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-500 block">ADR</span>
                      <strong class="font-mono text-slate-900 dark:text-slate-100">{{ prop.adr | number:'1.0-0' }} ₫</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span class="text-slate-500 block">RevPAR</span>
                      <strong class="font-mono text-purple-700 dark:text-purple-300">{{ prop.revPar | number:'1.0-0' }} ₫</strong>
                    </div>
                  </div>
                </article>
              }
            </div>

            <!-- Desktop Table (>=768px) -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700 dark:text-slate-200 border-collapse">
                <thead class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 text-xs">
                  <tr>
                    <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getPropertyAriaSort('propertyName')">
                      <button type="button" (click)="togglePropertySort('propertyName')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>Cơ sở lưu trú</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'propertyName', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-3">Vị trí</th>
                    <th scope="col" class="py-3.5 px-3 text-center" [attr.aria-sort]="getPropertyAriaSort('totalRooms')">
                      <button type="button" (click)="togglePropertySort('totalRooms')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>Quy mô</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'totalRooms', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-3 text-right" [attr.aria-sort]="getPropertyAriaSort('revenue')">
                      <button type="button" (click)="togglePropertySort('revenue')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>Doanh thu kỳ này</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'revenue', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-3 text-center">Tỷ trọng</th>
                    <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getPropertyAriaSort('occupancyRate')">
                      <button type="button" (click)="togglePropertySort('occupancyRate')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>Công suất</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'occupancyRate', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-3 text-right" [attr.aria-sort]="getPropertyAriaSort('adr')">
                      <button type="button" (click)="togglePropertySort('adr')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>ADR</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'adr', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-3 text-right" [attr.aria-sort]="getPropertyAriaSort('revPar')">
                      <button type="button" (click)="togglePropertySort('revPar')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        <span>RevPAR</span>
                        <i class="pi text-xs" [ngClass]="getSortIcon(propertySortField() === 'revPar', propertySortDirection())" aria-hidden="true"></i>
                      </button>
                    </th>
                    <th scope="col" class="py-3.5 px-4 text-center">Xếp hạng</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (prop of sortedProperties(); track prop.propertyId) {
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                      <td class="py-4 px-4 font-bold text-slate-900 dark:text-slate-100">
                        <div class="flex items-center gap-2">
                          <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {{ prop.propertyCode.slice(0, 3) }}
                          </div>
                          <div>
                            <div class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ prop.propertyName }}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400 font-mono">Mã: {{ prop.propertyCode }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-4 px-3 text-slate-600 dark:text-slate-300 font-medium">
                        <div class="flex items-center gap-1">
                          <i class="pi pi-map-marker text-xs text-slate-400" aria-hidden="true"></i>
                          <span>{{ prop.city || 'TP. Hồ Chí Minh' }}</span>
                        </div>
                      </td>
                      <td class="py-4 px-3 text-center tabular-nums">
                        <span class="font-bold text-slate-900 dark:text-slate-100">{{ prop.totalRooms }}</span> phòng
                        <div class="text-xs text-emerald-600 dark:text-emerald-400">Trống: {{ prop.availableRooms }}</div>
                      </td>
                      <td class="py-4 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {{ prop.revenue | number:'1.0-0' }} ₫
                        <div class="text-xs text-slate-500 dark:text-slate-400 font-normal font-sans">{{ prop.bookingsCount }} đơn đặt</div>
                      </td>
                      <td class="py-4 px-3 text-center tabular-nums">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                          {{ prop.revenueContributionPercent }}%
                        </span>
                      </td>
                      <td class="py-4 px-4 min-w-[160px] tabular-nums">
                        <div class="flex items-center justify-between text-xs font-bold mb-1">
                          <span>{{ prop.occupancyRate }}%</span>
                          <span class="text-xs text-slate-500 dark:text-slate-400 font-normal">{{ prop.totalSoldNights }} đêm</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all"
                            [class.bg-emerald-500]="prop.occupancyRate >= 70"
                            [class.bg-amber-500]="prop.occupancyRate >= 40 && prop.occupancyRate < 70"
                            [class.bg-rose-500]="prop.occupancyRate < 40"
                            [style.width.%]="prop.occupancyRate"
                          ></div>
                        </div>
                      </td>
                      <td class="py-4 px-3 text-right font-mono text-slate-800 dark:text-slate-200 font-medium tabular-nums">
                        {{ prop.adr | number:'1.0-0' }} ₫
                      </td>
                      <td class="py-4 px-3 text-right font-mono text-purple-700 dark:text-purple-300 font-bold tabular-nums">
                        {{ prop.revPar | number:'1.0-0' }} ₫
                      </td>
                      <td class="py-4 px-4 text-center">
                        <span
                          class="px-2.5 py-1 rounded-full text-xs font-bold border"
                          [class.bg-emerald-50]="prop.performanceRank === 'Top Performer'"
                          [class.text-emerald-700]="prop.performanceRank === 'Top Performer'"
                          [class.border-emerald-200]="prop.performanceRank === 'Top Performer'"
                          [class.bg-blue-50]="prop.performanceRank === 'Standard'"
                          [class.text-blue-700]="prop.performanceRank === 'Standard'"
                          [class.border-blue-200]="prop.performanceRank === 'Standard'"
                          [class.bg-rose-50]="prop.performanceRank === 'Needs Attention'"
                          [class.text-rose-700]="prop.performanceRank === 'Needs Attention'"
                          [class.border-rose-200]="prop.performanceRank === 'Needs Attention'"
                        >
                          {{ prop.performanceBadge }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Detailed Distribution Charts & Insights -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Daily Revenue Comparison Chart (ChartCardComponent) -->
            <div class="lg:col-span-2">
              <app-chart-card
                title="Dòng doanh thu theo ngày giữa các chi nhánh"
                subtitle="Tiến độ thu ngân theo ngày của từng khách sạn trong chuỗi"
                chartType="bar"
                [labels]="groupDailyChartLabels()"
                [datasets]="groupDailyChartDatasets()"
                [loading]="isLoading()"
                [error]="loadError()"
                valueUnit="₫"
                emptyTitle="Chưa có dữ liệu doanh thu theo ngày"
                emptyDescription="Không có giao dịch thu ngân được ghi nhận trong khoảng thời gian đã chọn."
                (retry)="loadData()"
              />
            </div>

            <!-- Channel & Payment Mix -->
            <div class="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div class="space-y-3">
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Cơ cấu Kênh đặt phòng</h2>
                <p class="text-xs text-slate-600 dark:text-slate-400">Tỷ trọng lượt khách giữa Website B2C, Lễ tân và Khách đoàn</p>

                <div class="space-y-2.5 pt-1">
                  @for (ch of group.channelDistribution; track ch.channel) {
                    <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-1">
                      <div class="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-100">
                        <span>{{ ch.channel }}</span>
                        <span class="font-mono text-indigo-700 dark:text-indigo-300 tabular-nums">{{ ch.revenue | number:'1.0-0' }} ₫</span>
                      </div>
                      <div class="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        <span>{{ ch.bookingsCount }} lượt đặt</span>
                        <span class="font-bold">{{ ch.percentage }}%</span>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <i class="pi pi-shield text-indigo-600 dark:text-indigo-400 text-sm" aria-hidden="true"></i>
                <span>Báo cáo chuỗi tự động đồng bộ thời gian thực chuẩn kế toán khách sạn quốc tế.</span>
              </div>
            </div>
          </div>
        }
      }

      <!-- ========================================================================= -->
      <!-- TAB 2: SINGLE BRANCH TRADITIONAL REPORT                                -->
      <!-- ========================================================================= -->
      @if (activeTab() === 'branch') {
        @if (kpi(); as data) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <!-- Occupancy Rate -->
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Tỷ lệ lấp đầy</span>
                <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <i class="pi pi-percentage text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">{{ data.occupancyRate }}%</div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                  Đã bán <strong>{{ data.totalSoldNights }}</strong> / {{ data.totalAvailableNights }} đêm phòng
                </p>
              </div>
              <div class="mt-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium">Công suất thực tế tại chi nhánh</div>
            </div>

            <!-- ADR (Average Daily Rate) -->
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Giá bán bình quân (ADR)</span>
                <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <i class="pi pi-tag text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ data.averageDailyRate | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Doanh thu trung bình mỗi đêm phòng bán được</p>
              </div>
              <div class="mt-3 text-xs text-blue-700 dark:text-blue-400 font-medium">Chỉ số định giá phòng thực tế</div>
            </div>

            <!-- RevPAR -->
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Hiệu suất phòng (RevPAR)</span>
                <div class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <i class="pi pi-bolt text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ data.revPAR | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Doanh thu trên tổng số phòng sẵn có</p>
              </div>
              <div class="mt-3 text-xs text-purple-700 dark:text-purple-400 font-medium">ADR × Tỷ lệ lấp đầy</div>
            </div>

            <!-- Total Revenue -->
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Tổng doanh thu phòng</span>
                <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <i class="pi pi-wallet text-sm" aria-hidden="true"></i>
                </div>
              </div>
              <div class="mt-3">
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {{ data.totalRevenue | number:'1.0-0' }} ₫
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                  Phục vụ <strong>{{ data.totalGuests }}</strong> khách ({{ data.totalBookings }} lượt đặt)
                </p>
              </div>
              <div class="mt-3 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Tỷ lệ hủy phòng: <span class="text-rose-600 dark:text-rose-400 font-bold">{{ data.cancellationRate }}%</span>
              </div>
            </div>
          </div>

          <!-- Detailed Breakdown & Timeline -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Daily Revenue Chart (ChartCardComponent) -->
            <div class="lg:col-span-2">
              <app-chart-card
                title="Dòng doanh thu theo ngày"
                subtitle="Biểu diễn tiến độ thu ngân từ các lượt lưu trú đã xác nhận"
                chartType="bar"
                [labels]="branchDailyChartLabels()"
                [datasets]="branchDailyChartDatasets()"
                [loading]="isLoading()"
                [error]="loadError()"
                valueUnit="₫"
                emptyTitle="Chưa có dữ liệu doanh thu theo ngày"
                emptyDescription="Không có giao dịch thu ngân được ghi nhận tại chi nhánh trong giai đoạn này."
                (retry)="loadData()"
              />
            </div>

            <!-- Payment Method Breakdown -->
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Phương thức thanh toán</h2>
                <p class="text-xs text-slate-600 dark:text-slate-400 mb-4">Cơ cấu nguồn thu qua cổng online và quầy thu ngân</p>

                @if (revenueSummary(); as summary) {
                  <div class="space-y-4">
                    @for (method of summary.paymentBreakdown; track method.method) {
                      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div class="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-100">
                          <span class="flex items-center gap-2">
                            <i class="pi pi-credit-card text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                            {{ method.method }}
                          </span>
                          <span class="font-mono font-bold tabular-nums">{{ method.amount | number:'1.0-0' }} ₫</span>
                        </div>
                        <div class="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                          <span>{{ method.count }} giao dịch</span>
                          <span>
                            {{ summary.totalRevenue > 0 ? (method.amount / summary.totalRevenue * 100 | number:'1.1-1') : 0 }}%
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <i class="pi pi-shield text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                Dữ liệu đối soát tài chính chi nhánh được bảo mật
              </div>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class ReportsPage implements OnInit {
  private readonly reportService = inject(ReportService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<'group' | 'branch'>(this.resolveInitialTab());
  isLoading = signal(false);
  isExporting = signal(false);
  loadError = signal<string | null>(null);
  selectedDays = signal(30);
  roomTypes = signal<Array<{ id: string; name: string }>>([]);
  selectedRoomTypeId = signal('');

  readonly propertySortField = signal<PropertySortField>('revenue');
  readonly propertySortDirection = signal<'asc' | 'desc'>('desc');

  fromDate = '';
  toDate = '';

  kpi = signal<PmsKpiDto | null>(null);
  revenueSummary = signal<RevenueSummaryDto | null>(null);
  groupAnalytics = signal<GroupAnalyticsDto | null>(null);

  readonly sortedProperties = computed<PropertyPerformanceDto[]>(() => {
    const props = [...(this.groupAnalytics()?.properties ?? [])];
    const field = this.propertySortField();
    const dir = this.propertySortDirection() === 'asc' ? 1 : -1;

    return props.sort((a, b) => {
      if (field === 'propertyName') {
        return a.propertyName.localeCompare(b.propertyName, 'vi') * dir;
      }
      return ((a[field] ?? 0) - (b[field] ?? 0)) * dir;
    });
  });

  readonly groupDailyChartLabels = computed<readonly string[]>(() =>
    (this.groupAnalytics()?.dailyTrends ?? []).slice(-31).map(point => point.displayDate)
  );

  readonly groupDailyChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    const points = (this.groupAnalytics()?.dailyTrends ?? []).slice(-31);
    if (points.length === 0) return [];
    return [
      {
        label: 'Doanh thu toàn chuỗi',
        data: points.map(p => p.totalRevenue),
        backgroundColor: '#4f46e5',
        borderColor: '#4338ca'
      }
    ];
  });

  readonly branchDailyChartLabels = computed<readonly string[]>(() =>
    (this.revenueSummary()?.dailySeries ?? []).slice(-31).map(point => point.displayDate)
  );

  readonly branchDailyChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    const points = (this.revenueSummary()?.dailySeries ?? []).slice(-31);
    if (points.length === 0) return [];
    return [
      {
        label: 'Doanh thu chi nhánh',
        data: points.map(p => p.revenue),
        backgroundColor: '#059669',
        borderColor: '#047857'
      }
    ];
  });

  private resolveInitialTab(): 'group' | 'branch' {
    return !this.authService.isTenantWide || !!this.authService.activePropertyId()
      ? 'branch'
      : 'group';
  }

  private getScopedPropertyId(): string | undefined {
    const activePropId = this.authService.activePropertyId();
    if (!this.authService.isTenantWide || this.activeTab() === 'branch') {
      return activePropId || undefined;
    }
    return undefined;
  }

  ngOnInit(): void {
    this.activeTab.set(this.resolveInitialTab());
    this.reportService
      .getRoomTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: types => this.roomTypes.set(types), error: () => this.roomTypes.set([]) });
    this.selectQuickPeriod(30);
  }

  togglePropertySort(field: PropertySortField): void {
    if (this.propertySortField() === field) {
      this.propertySortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.propertySortField.set(field);
      this.propertySortDirection.set(field === 'propertyName' ? 'asc' : 'desc');
    }
  }

  getPropertyAriaSort(field: PropertySortField): 'ascending' | 'descending' | 'none' {
    if (this.propertySortField() !== field) return 'none';
    return this.propertySortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(isActive: boolean, dir: 'asc' | 'desc'): string {
    if (!isActive) return 'pi-sort-alt text-slate-400';
    return dir === 'asc' ? 'pi-sort-amount-up-alt text-indigo-600' : 'pi-sort-amount-down text-indigo-600';
  }

  onRoomTypeChange(roomTypeId: string): void {
    this.selectedRoomTypeId.set(roomTypeId);
    this.loadData();
  }

  switchTab(tab: 'group' | 'branch'): void {
    if (tab === 'group' && !this.authService.isTenantWide) {
      return;
    }
    this.activeTab.set(tab);
    this.loadData();
  }

  selectQuickPeriod(days: number): void {
    this.selectedDays.set(days);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    this.toDate = formatCalendarDate(end);
    this.fromDate = formatCalendarDate(start);
    this.loadData();
  }

  selectCalendarPeriod(period: 'week' | 'month' | 'quarter' | 'year'): void {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    let start: Date;
    if (period === 'week') {
      start = new Date(end);
      const daysSinceMonday = (end.getDay() + 6) % 7;
      start.setDate(end.getDate() - daysSinceMonday);
    } else if (period === 'month') {
      start = new Date(end.getFullYear(), end.getMonth(), 1, 12);
    } else if (period === 'quarter') {
      start = new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1, 12);
    } else {
      start = new Date(end.getFullYear(), 0, 1, 12);
    }
    this.fromDate = formatCalendarDate(start);
    this.toDate = formatCalendarDate(end);
    this.selectedDays.set(0);
    this.loadData();
  }

  onReportDateFilterChange(val: DateRangeFilterValue | null): void {
    if (val && val.fromDate && val.toDate) {
      this.fromDate = val.fromDate;
      this.toDate = val.toDate;
      this.selectedDays.set(0);
      this.loadData();
    }
  }

  private static readonly LOAD_ERROR_MESSAGE =
    'Không thể tải dữ liệu báo cáo. Vui lòng kiểm tra kết nối hoặc quyền truy cập rồi thử lại.';

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    if (this.activeTab() === 'group' && this.authService.isTenantWide) {
      this.reportService
        .getGroupAnalytics(this.fromDate, this.toDate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => {
            this.groupAnalytics.set(res);
            this.isLoading.set(false);
          },
          error: () => {
            this.groupAnalytics.set(null);
            this.loadError.set(ReportsPage.LOAD_ERROR_MESSAGE);
            this.isLoading.set(false);
          }
        });
    } else {
      if (this.activeTab() === 'group') {
        this.activeTab.set('branch');
      }
      const propertyId = this.authService.activePropertyId() || undefined;
      this.reportService
        .getPmsKpi(this.fromDate, this.toDate, propertyId, this.selectedRoomTypeId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => {
            this.kpi.set(res);
            this.isLoading.set(false);
          },
          error: () => {
            this.kpi.set(null);
            this.loadError.set(ReportsPage.LOAD_ERROR_MESSAGE);
            this.isLoading.set(false);
          }
        });

      this.reportService
        .getRevenueSummary(this.fromDate, this.toDate, propertyId, this.selectedRoomTypeId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => {
            this.revenueSummary.set(res);
          },
          error: () => {
            this.revenueSummary.set(null);
            this.loadError.set(ReportsPage.LOAD_ERROR_MESSAGE);
            this.isLoading.set(false);
          }
        });
    }
  }

  getMaxRevenue(): number {
    const series = this.revenueSummary()?.dailySeries ?? [];
    if (series.length === 0) return 1;
    return Math.max(...series.map(s => s.revenue), 1);
  }

  getMaxGroupDailyRevenue(): number {
    const trends = this.groupAnalytics()?.dailyTrends ?? [];
    if (trends.length === 0) return 1;
    return Math.max(...trends.map(t => t.totalRevenue), 1);
  }

  exportCsv(): void {
    this.isExporting.set(true);
    this.reportService
      .exportCsv(this.fromDate, this.toDate, this.getScopedPropertyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.isExporting.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `BaoCao_DoanhThu_${this.fromDate}_${this.toDate}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.alertService.toastSuccess('File CSV (UTF-8 BOM) đã được tải về máy tính, sẵn sàng mở bằng Excel.', 'Xuất file thành công');
        },
        error: () => {
          this.isExporting.set(false);
          this.alertService.toastError('Không thể tạo file báo cáo. Vui lòng thử lại sau.', 'Lỗi xuất báo cáo');
        }
      });
  }

  exportExcel(): void {
    this.isExporting.set(true);
    this.reportService
      .exportExcel(this.fromDate, this.toDate, this.getScopedPropertyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.isExporting.set(false);
          this.downloadBlob(blob, `BaoCao_DoanhThu_${this.fromDate}_${this.toDate}.xlsx`);
          this.alertService.toastSuccess('Báo cáo Excel đã được tải về.', 'Xuất file thành công');
        },
        error: () => {
          this.isExporting.set(false);
          this.alertService.toastError('Không thể tạo file Excel. Vui lòng thử lại sau.', 'Lỗi xuất báo cáo');
        }
      });
  }

  exportPdf(): void {
    this.isExporting.set(true);
    this.reportService
      .exportPdf(this.fromDate, this.toDate, this.getScopedPropertyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.isExporting.set(false);
          this.downloadBlob(blob, `BaoCao_DoanhThu_${this.fromDate}_${this.toDate}.pdf`);
          this.alertService.toastSuccess('Báo cáo PDF đã được tải về.', 'Xuất file thành công');
        },
        error: () => {
          this.isExporting.set(false);
          this.alertService.toastError('Không thể tạo file PDF. Vui lòng thử lại sau.', 'Lỗi xuất báo cáo');
        }
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }
}
