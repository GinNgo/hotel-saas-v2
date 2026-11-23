import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { EMPTY, catchError, expand, of, reduce } from 'rxjs';
import { AuditLogService } from '../../core/services/audit-log.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { ApiResponse, PagedResult } from '../../core/models/api-response.model';
import { AuditFieldChange, AuditLogDetail, AuditLogFilterParams, AuditLogListItem } from '../../core/models/audit-log.model';
import {
  AUDIT_ACTION_OPTIONS,
  PLATFORM_AUDIT_ENTITY_OPTIONS,
  TENANT_AUDIT_ENTITY_OPTIONS,
  getAuditActionBadgeClass,
  getAuditActionIcon,
  getAuditActionLabel,
  getAuditEntityDisplayLabel,
  getFriendlyAuditSummary
} from '../../core/utils/audit-log-display.util';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DateRangeFilterComponent, DateRangeFilterValue } from '../../shared/components/date-range-filter/date-range-filter.component';
import { BusinessDatePipe, BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';

type AuditSortField = 'createdAtUtc' | 'userFullName' | 'action' | 'entityName';

@Component({
  selector: 'app-audit-logs-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    ScrollingModule,
    PageHeaderComponent,
    PaginationComponent,
    EmptyStateComponent,
    DateRangeFilterComponent,
    BusinessDatePipe,
    BusinessDateTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- 1. PAGE HEADER -->
      <app-page-header
        [title]="'Nhật ký kiểm toán (Audit Logs)'"
        subtitle="Theo dõi và tra cứu toàn bộ lịch sử chỉnh sửa giá phòng, phụ thu và các thao tác quan trọng trong hệ thống"
      >
        @if (isSuperAdmin()) {
          <a
            href="/grafana/d/hotelsaas-ops-logs-vn"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-grafana-logs-btn"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Mở bảng tra cứu Log lỗi và hệ thống trên Grafana"
          >
            <i class="pi pi-external-link text-xs" aria-hidden="true"></i>
            <span>Mở Grafana Log</span>
          </a>
        }

        <button
          type="button"
          (click)="loadAuditLogs()"
          [disabled]="loading()"
          class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Tải lại danh sách"
        >
          <i class="pi pi-refresh text-xs text-indigo-600 dark:text-indigo-400" [class.pi-spin]="loading()" aria-hidden="true"></i>
          <span>Làm mới</span>
        </button>

        <button
          type="button"
          (click)="exportToCsv()"
          [disabled]="exporting() || loading() || auditLogs().length === 0"
          class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Xuất dữ liệu nhật ký kiểm toán ra định dạng CSV phục vụ báo cáo"
        >
          <i class="pi text-xs" [ngClass]="exporting() ? 'pi-spin pi-spinner' : 'pi-file-excel'" aria-hidden="true"></i>
          <span>{{ exporting() ? 'Đang xuất CSV...' : 'Xuất CSV' }}</span>
        </button>
      </app-page-header>

      <!-- 2. PHÂN QUYỀN: BẢO VỆ CHỈ OWNER / MANAGER -->
      @if (!isAuthorized()) {
        <div role="alert" class="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-2xs space-y-2">
          <div class="flex items-center gap-3">
            <i class="pi pi-lock text-xl text-amber-600 dark:text-amber-400" aria-hidden="true"></i>
            <h2 class="text-sm font-bold uppercase tracking-wider">Hạn chế quyền truy cập</h2>
          </div>
          <p class="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            Chức năng Nhật ký kiểm toán chỉ dành riêng cho Chủ khách sạn (Owner) và Quản lý (Manager). Tài khoản của bạn không có quyền xem lịch sử kiểm toán.
          </p>
        </div>
      } @else {

        <!-- 3. BỘ LỌC TÌM KIẾM (FILTER BAR) -->
        <section aria-label="Bộ lọc nhật ký kiểm toán" class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Lọc Hành động -->
            <div>
              <label for="filter-action" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Hành động
              </label>
              <select
                id="filter-action"
                [(ngModel)]="selectedAction"
                (change)="onFilterChange()"
                class="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Tất cả hành động</option>
                @for (opt of actionOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <!-- Lọc Loại đối tượng -->
            <div>
              <label for="filter-entity" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Đối tượng thay đổi
              </label>
              <select
                id="filter-entity"
                [(ngModel)]="selectedEntityName"
                (change)="onFilterChange()"
                class="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Tất cả đối tượng</option>
                @for (opt of tenantEntityOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
                @if (isSuperAdmin()) {
                  @for (opt of platformEntityOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                }
              </select>
            </div>

            <!-- Lọc Chi nhánh (Chỉ hiển thị cho Owner / tài khoản có quyền PROPERTIES:Read) -->
            @if (canFilterByProperty()) {
              <div>
                <label for="filter-property" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chi nhánh / Cơ sở
                </label>
                <select
                  id="filter-property"
                  [(ngModel)]="selectedPropertyId"
                  (change)="onFilterChange()"
                  class="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">Tất cả chi nhánh</option>
                  @for (prop of propertyOptions(); track prop.id) {
                    <option [value]="prop.id">
                      {{ prop.name }}@if (prop.code) { ({{ prop.code }}) }
                    </option>
                  }
                </select>
              </div>
            }

            <!-- Lọc Ngày tạo (DateRangeFilterComponent kèm chọn nhanh) -->
            <div [ngClass]="canFilterByProperty() ? 'sm:col-span-2 lg:col-span-4' : 'sm:col-span-2 lg:col-span-2'">
              <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Thời gian thực hiện</span>
              <app-date-range-filter
                #dateRangeFilter
                label="Khoảng ngày"
                [showPresets]="true"
                [initialFromDate]="fromDate"
                [initialToDate]="toDate"
                (filterChange)="onAuditDateFilterChange($event)"
              />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <!-- Tìm kiếm tự do -->
            <div class="relative flex-1 max-w-md">
              <label for="audit-search-input" class="sr-only">Tìm kiếm nhật ký kiểm toán</label>
              <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
              <input
                id="audit-search-input"
                type="text"
                [(ngModel)]="searchKeyword"
                (keyup.enter)="onFilterChange()"
                placeholder="Tìm theo tên nhân viên, email, chi nhánh, nội dung..."
                class="w-full min-h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all"
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="onFilterChange()"
                class="min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <i class="pi pi-filter text-xs" aria-hidden="true"></i>
                <span>Lọc dữ liệu</span>
              </button>
              <button
                type="button"
                (click)="resetFilters()"
                class="min-h-11 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <i class="pi pi-times text-xs" aria-hidden="true"></i>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 4. THÔNG BÁO LỖI NẾU CÓ -->
        @if (errorMessage()) {
          <div role="alert" class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
            <div class="flex items-center gap-2">
              <i class="pi pi-exclamation-circle text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true"></i>
              <span>{{ errorMessage() }}</span>
            </div>
            <button
              type="button"
              (click)="errorMessage.set('')"
              class="min-h-11 min-w-11 inline-flex items-center justify-center text-rose-500 hover:text-rose-700 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Đóng thông báo lỗi"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          </div>
        }

        <!-- 5. BẢNG DANH SÁCH NHẬT KÝ KIỂM TOÁN -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs overflow-hidden">
          @if (loading()) {
            <div role="status" class="p-12 text-center space-y-3">
              <div class="animate-spin motion-reduce:animate-none w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Đang tải nhật ký kiểm toán...</p>
            </div>
          } @else if (sortedAuditLogs().length === 0) {
            <div class="p-8">
              <app-empty-state
                title="Chưa có dữ liệu kiểm toán"
                description="Không tìm thấy bản ghi nhật ký kiểm toán nào khớp với bộ lọc hiện tại."
                iconClass="pi pi-history"
              ></app-empty-state>
            </div>
          } @else {
            <!-- Mobile Stacked Cards (<768px) -->
            <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800" data-testid="audit-mobile-cards">
              @for (log of sortedAuditLogs(); track log.id) {
                <article class="p-4 space-y-2.5 text-xs">
                  <div class="flex items-start justify-between gap-2">
                    <div class="space-y-1 min-w-0">
                      <span
                        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                        [ngClass]="getActionBadgeClass(log.action)"
                      >
                        <i class="pi text-xs" [ngClass]="getActionIcon(log.action)" aria-hidden="true"></i>
                        <span>{{ getActionLabel(log.action) }}</span>
                      </span>
                      <div class="font-bold text-slate-900 dark:text-slate-100">{{ getEntityDisplayLabel(log.entityName) }}</div>
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <i class="pi pi-building text-[10px] text-indigo-500 dark:text-indigo-400" aria-hidden="true"></i>
                        @if (isSuperAdmin() && log.tenantName) {
                          <span class="font-semibold text-indigo-700 dark:text-indigo-300">{{ log.tenantName }}</span>
                          <span class="text-slate-400" aria-hidden="true">•</span>
                        }
                        <span class="font-medium">{{ log.propertyName || (isSuperAdmin() ? 'Toàn doanh nghiệp' : 'Toàn chuỗi (HQ)') }}</span>
                      </div>
                    </div>
                    <div class="text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      <div class="font-bold text-slate-800 dark:text-slate-200">{{ log.createdAtUtc | businessDate }}</div>
                      <div>{{ formatVietnamTime(log.createdAtUtc) }}</div>
                    </div>
                  </div>
                  <div class="text-slate-600 dark:text-slate-300">
                    Người thực hiện: <strong class="text-slate-800 dark:text-slate-100">{{ log.userFullName || 'Hệ thống' }}</strong>
                  </div>
                  <p class="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {{ getFriendlySummary(log.changeSummary, log.action, log.entityName) }}
                  </p>
                  <div class="flex justify-end pt-1">
                    <button
                      type="button"
                      (click)="openDetail(log.id, log.propertyId)"
                      class="min-h-11 px-4 py-2 rounded-xl border font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      [ngClass]="log.action === 'Update'
                        ? 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'"
                    >
                      <i class="pi text-xs" [ngClass]="getActionButtonIcon(log.action)" aria-hidden="true"></i>
                      <span>{{ getActionButtonLabel(log.action) }}</span>
                    </button>
                  </div>
                </article>
              }
            </div>

            <!-- Desktop: Virtual Scroll Viewport when > 50 rows, standard Table when <= 50 rows -->
            @if (sortedAuditLogs().length > 50) {
              <div class="hidden md:block" data-testid="audit-virtual-scroll-container">
                <div class="bg-slate-50/80 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 px-4 py-3">
                  <div class="col-span-2">
                    <button type="button" (click)="toggleSort('createdAtUtc')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                      <span>Thời gian</span>
                      <i class="pi text-xs" [ngClass]="getSortIcon('createdAtUtc')" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="col-span-2">Chi nhánh / Doanh nghiệp</div>
                  <div class="col-span-2">
                    <button type="button" (click)="toggleSort('userFullName')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                      <span>Người thực hiện</span>
                      <i class="pi text-xs" [ngClass]="getSortIcon('userFullName')" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="col-span-2">
                    <button type="button" (click)="toggleSort('action')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                      <span>Hành động</span>
                      <i class="pi text-xs" [ngClass]="getSortIcon('action')" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="col-span-1">
                    <button type="button" (click)="toggleSort('entityName')" class="inline-flex items-center gap-1 font-bold uppercase cursor-pointer">
                      <span>Đối tượng</span>
                      <i class="pi text-xs" [ngClass]="getSortIcon('entityName')" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="col-span-2">Tóm tắt thay đổi</div>
                  <div class="col-span-1 text-right">Thao tác</div>
                </div>

                <cdk-virtual-scroll-viewport itemSize="84" class="h-[600px] w-full">
                  <div
                    *cdkVirtualFor="let log of sortedAuditLogs(); trackBy: trackByLogId"
                    class="grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <div class="col-span-2 font-mono tabular-nums whitespace-nowrap">
                      <div class="font-bold text-slate-800 dark:text-slate-100">{{ log.createdAtUtc | businessDate }}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">{{ formatVietnamTime(log.createdAtUtc) }}</div>
                    </div>
                    <div class="col-span-2 truncate">
                      @if (isSuperAdmin() && log.tenantName) {
                        <div class="font-bold text-indigo-700 dark:text-indigo-300 truncate" [title]="log.tenantName">{{ log.tenantName }}</div>
                      }
                      <div class="font-semibold text-slate-800 dark:text-slate-100 truncate" [title]="log.propertyName || ''">
                        {{ log.propertyName || (isSuperAdmin() ? 'Toàn doanh nghiệp' : 'Toàn chuỗi (HQ)') }}
                      </div>
                      @if (log.propertyCode) {
                        <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{{ log.propertyCode }}</div>
                      }
                    </div>
                    <div class="col-span-2 truncate">
                      <div class="font-semibold text-slate-800 dark:text-slate-100 truncate">{{ log.userFullName || 'Hệ thống' }}</div>
                      @if (log.userEmail) {
                        <div class="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{{ log.userEmail }}</div>
                      }
                    </div>
                    <div class="col-span-2">
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border" [ngClass]="getActionBadgeClass(log.action)">
                        <i class="pi text-xs" [ngClass]="getActionIcon(log.action)" aria-hidden="true"></i>
                        <span class="truncate">{{ getActionLabel(log.action) }}</span>
                      </span>
                    </div>
                    <div class="col-span-1 truncate">
                      <div class="font-bold text-slate-800 dark:text-slate-100 truncate">{{ getEntityDisplayLabel(log.entityName) }}</div>
                    </div>
                    <div class="col-span-2 truncate">
                      <p class="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                        {{ getFriendlySummary(log.changeSummary, log.action, log.entityName) }}
                      </p>
                    </div>
                    <div class="col-span-1 text-right">
                      <button
                        type="button"
                        (click)="openDetail(log.id, log.propertyId)"
                        class="min-h-11 px-3 py-1.5 rounded-xl border font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        [ngClass]="log.action === 'Update'
                          ? 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'"
                      >
                        <i class="pi text-xs" [ngClass]="getActionButtonIcon(log.action)" aria-hidden="true"></i>
                        <span>{{ getActionButtonLabel(log.action) }}</span>
                      </button>
                    </div>
                  </div>
                </cdk-virtual-scroll-viewport>
              </div>
            } @else {
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                  <thead class="bg-slate-50/80 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th scope="col" class="py-3 px-4" [attr.aria-sort]="getAriaSort('createdAtUtc')">
                        <button type="button" (click)="toggleSort('createdAtUtc')" class="inline-flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                          <span>Thời gian</span>
                          <i class="pi text-xs" [ngClass]="getSortIcon('createdAtUtc')" aria-hidden="true"></i>
                        </button>
                      </th>
                      <th scope="col" class="py-3 px-4">Chi nhánh / Doanh nghiệp</th>
                      <th scope="col" class="py-3 px-4" [attr.aria-sort]="getAriaSort('userFullName')">
                        <button type="button" (click)="toggleSort('userFullName')" class="inline-flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                          <span>Người thực hiện</span>
                          <i class="pi text-xs" [ngClass]="getSortIcon('userFullName')" aria-hidden="true"></i>
                        </button>
                      </th>
                      <th scope="col" class="py-3 px-4" [attr.aria-sort]="getAriaSort('action')">
                        <button type="button" (click)="toggleSort('action')" class="inline-flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                          <span>Hành động</span>
                          <i class="pi text-xs" [ngClass]="getSortIcon('action')" aria-hidden="true"></i>
                        </button>
                      </th>
                      <th scope="col" class="py-3 px-4" [attr.aria-sort]="getAriaSort('entityName')">
                        <button type="button" (click)="toggleSort('entityName')" class="inline-flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                          <span>Đối tượng</span>
                          <i class="pi text-xs" [ngClass]="getSortIcon('entityName')" aria-hidden="true"></i>
                        </button>
                      </th>
                      <th scope="col" class="py-3 px-4">Tóm tắt thay đổi</th>
                      <th scope="col" class="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    @for (log of sortedAuditLogs(); track log.id) {
                      <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                        <!-- Thời gian -->
                        <td class="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                          <div class="font-bold text-slate-800 dark:text-slate-100">{{ log.createdAtUtc | businessDate }}</div>
                          <div class="text-xs text-slate-500 dark:text-slate-400">{{ formatVietnamTime(log.createdAtUtc) }}</div>
                        </td>

                        <!-- Chi nhánh / Doanh nghiệp -->
                        <td class="py-3.5 px-4 max-w-[200px]">
                          @if (isSuperAdmin() && log.tenantName) {
                            <div class="font-bold text-indigo-700 dark:text-indigo-300 truncate" [title]="log.tenantName">
                              {{ log.tenantName }}
                            </div>
                          }
                          <div class="font-semibold text-slate-800 dark:text-slate-100 truncate" [title]="log.propertyName || ''">
                            {{ log.propertyName || (isSuperAdmin() ? 'Toàn doanh nghiệp' : 'Toàn chuỗi (HQ)') }}
                          </div>
                          @if (log.propertyCode) {
                            <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{{ log.propertyCode }}</div>
                          }
                        </td>

                        <!-- Người thực hiện -->
                        <td class="py-3.5 px-4">
                          @if (log.userFullName) {
                            <div class="font-semibold text-slate-800 dark:text-slate-100">{{ log.userFullName }}</div>
                            @if (log.userEmail) {
                              <div class="text-xs text-slate-500 dark:text-slate-400 font-mono">{{ log.userEmail }}</div>
                            }
                          } @else {
                            <span class="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                              <i class="pi pi-cog text-xs" aria-hidden="true"></i> Hệ thống
                            </span>
                          }
                        </td>

                        <!-- Hành động -->
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <span
                            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                            [ngClass]="getActionBadgeClass(log.action)"
                          >
                            <i class="pi text-xs" [ngClass]="getActionIcon(log.action)" aria-hidden="true"></i>
                            <span>{{ getActionLabel(log.action) }}</span>
                          </span>
                        </td>

                        <!-- Đối tượng -->
                        <td class="py-3.5 px-4">
                          <div class="font-bold text-slate-800 dark:text-slate-100">{{ getEntityDisplayLabel(log.entityName) }}</div>
                          <div class="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[150px] tabular-nums" [title]="log.entityId">
                            ID: {{ log.entityId }}
                          </div>
                        </td>

                        <!-- Tóm tắt thay đổi (Thân thiện) -->
                        <td class="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <p class="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed font-medium" [title]="log.changeSummary">
                            {{ getFriendlySummary(log.changeSummary, log.action, log.entityName) }}
                          </p>
                          @if (log.changedFields && log.changedFields.length > 0) {
                            <div class="flex flex-wrap gap-1 mt-1">
                              @for (field of log.changedFields; track field) {
                                <span
                                  class="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                                  [ngClass]="isTechnicalField(field) ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800'"
                                >
                                  {{ getFieldDisplayLabel(field) }}
                                </span>
                              }
                            </div>
                          }
                        </td>

                        <!-- Nút thao tác -->
                        <td class="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            (click)="openDetail(log.id, log.propertyId)"
                            class="min-h-11 px-3.5 py-2 rounded-xl border font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            [ngClass]="log.action === 'Update'
                              ? 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 active:bg-indigo-200 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'"
                            [title]="log.action === 'Update' ? 'Xem so sánh chi tiết trước và sau thay đổi' : 'Xem chi tiết dữ liệu kiểm toán'"
                          >
                            <i class="pi text-xs" [ngClass]="getActionButtonIcon(log.action)" aria-hidden="true"></i>
                            <span>{{ getActionButtonLabel(log.action) }}</span>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Phân trang -->
            <app-pagination
              [page]="currentPage()"
              [pageSize]="pageSize()"
              [totalCount]="totalRecords()"
              [pageSizeOptions]="[10, 20, 50, 100]"
              (pageChange)="onPageChange($event)"
              (pageSizeChange)="onPageSizeChange($event)"
            ></app-pagination>
          }
        </div>
      }
    </div>

    <!-- 6. MODAL SO SÁNH / CHI TIẾT THAY ĐỔI (DIFF DETAIL MODAL) -->
    @if (isDetailModalOpen()) {
      <div
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[65] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-audit-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="closeDetailModal()"
        (click)="closeDetailModal()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        >
          <!-- Modal Header (Sticky Top) -->
          <div class="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  [ngClass]="getActionBadgeClass(selectedDetail()?.action)"
                >
                  <i class="pi text-xs" [ngClass]="getActionIcon(selectedDetail()?.action)" aria-hidden="true"></i>
                  <span>{{ getActionLabel(selectedDetail()?.action) }}</span>
                </span>
                <span class="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  {{ getEntityDisplayLabel(selectedDetail()?.entityName) }}
                </span>
              </div>
              <h2 id="modal-audit-title" class="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {{ selectedDetail()?.action === 'Update' ? 'So sánh chi tiết thay đổi' : 'Chi tiết nhật ký kiểm toán' }}
              </h2>
              <p class="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Thời điểm: <strong class="text-slate-800 dark:text-slate-100">{{ selectedDetail()?.createdAtUtc | businessDateTime }}</strong>
              </p>
            </div>
            <button
              type="button"
              (click)="closeDetailModal()"
              class="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Đóng cửa sổ chi tiết (Esc)"
              title="Đóng (Esc)"
            >
              <i class="pi pi-times text-base" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
            @if (isDetailLoading()) {
              <div class="p-12 text-center space-y-3">
                <div class="animate-spin motion-reduce:animate-none w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Đang tải chi tiết thay đổi...</p>
              </div>
            } @else if (selectedDetail(); as item) {
              <!-- Metadata Overview Box -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs">
                <div>
                  <span class="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold tracking-wider">Người thao tác</span>
                  <span class="font-bold text-slate-800 dark:text-slate-100">{{ item.userFullName || 'Hệ thống' }}</span>
                  @if (item.userEmail) {
                    <span class="block text-xs font-mono text-slate-500 dark:text-slate-400">{{ item.userEmail }}</span>
                  }
                </div>

                <div>
                  <span class="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold tracking-wider">Chi nhánh / Doanh nghiệp</span>
                  @if (isSuperAdmin() && item.tenantName) {
                    <span class="block font-bold text-indigo-700 dark:text-indigo-300">{{ item.tenantName }}</span>
                  }
                  <span class="font-bold text-slate-800 dark:text-slate-100">{{ item.propertyName || (isSuperAdmin() ? 'Toàn doanh nghiệp' : 'Toàn hệ thống (HQ)') }}</span>
                  @if (item.propertyCode) {
                    <span class="text-xs font-mono text-slate-500 dark:text-slate-400 block">Mã: {{ item.propertyCode }}</span>
                  }
                </div>

                <div>
                  <span class="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold tracking-wider">Địa chỉ IP</span>
                  <span class="font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">{{ item.ipAddress || 'Không xác định' }}</span>
                </div>

                <div class="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200/50 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold tracking-wider">Mã định danh đối tượng (Entity ID)</span>
                    <span class="font-mono text-xs font-bold text-indigo-900 dark:text-indigo-300 select-all break-all">{{ item.entityId }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="copyToClipboard(item.entityId, 'Mã định danh đối tượng')"
                    class="min-h-11 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Sao chép Entity ID"
                  >
                    <i class="pi pi-copy text-xs text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                    <span>Sao chép ID</span>
                  </button>
                </div>
              </div>

              <!-- Tóm tắt thay đổi -->
              @if (item.changeSummary) {
                <div class="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/90 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
                  <div class="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200">
                    <i class="pi pi-info-circle text-indigo-600 dark:text-indigo-400" aria-hidden="true"></i>
                    <span>Tóm tắt nội dung nghiệp vụ:</span>
                  </div>
                  <p class="font-semibold text-slate-800 dark:text-slate-100 leading-relaxed text-xs sm:text-sm pl-4">
                    {{ getFriendlySummary(item.changeSummary, item.action, item.entityName) }}
                  </p>
                  @if (item.changeSummary !== getFriendlySummary(item.changeSummary, item.action, item.entityName)) {
                    <details class="text-xs text-slate-600 dark:text-slate-400 pl-4 pt-1 border-t border-indigo-100/60 dark:border-indigo-800">
                      <summary class="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium select-none">
                        Xem chuỗi ghi nhận gốc từ hệ thống
                      </summary>
                      <div class="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all select-all">
                        {{ item.changeSummary }}
                      </div>
                    </details>
                  }
                </div>
              }

              <!-- BẢNG CHI TIẾT THAY ĐỔI PHÂN BIỆT THEO ACTION -->
              @if (item.action === 'Create') {
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-plus-circle text-emerald-600 text-sm" aria-hidden="true"></i>
                      <span>Thông tin được tạo mới ({{ getBusinessChanges(item.changes).length }} thuộc tính)</span>
                    </h3>
                    <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Khởi tạo ban đầu
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính thiết lập</th>
                            <th scope="col" class="py-2.5 px-4 w-2/3 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">Giá trị khởi tạo</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800 dark:text-slate-100">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ change.fieldName }}</div>
                              </td>
                              <td class="py-3 px-4 bg-emerald-50/15 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 break-words select-all tabular-nums">
                                <span class="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 font-bold text-xs text-emerald-900 dark:text-emerald-200">
                                  {{ formatFieldValue(change.fieldName, change.newValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50">
                      Thao tác tạo mới bản ghi thành công trên hệ thống. Xem thông tin kỹ thuật bên dưới để đối soát các mã liên kết.
                    </div>
                  }
                </div>
              } @else if (item.action === 'Delete') {
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-trash text-rose-600 text-sm" aria-hidden="true"></i>
                      <span>Thông tin trước khi xóa ({{ getBusinessChanges(item.changes).length }} thuộc tính)</span>
                    </h3>
                    <span class="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      Đã xóa khỏi hệ thống
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính</th>
                            <th scope="col" class="py-2.5 px-4 w-2/3 bg-rose-50/40 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300">Giá trị trước khi xóa</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800 dark:text-slate-100">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ change.fieldName }}</div>
                              </td>
                              <td class="py-3 px-4 bg-rose-50/15 dark:bg-rose-950/20 text-rose-950 dark:text-rose-200 break-words select-all tabular-nums">
                                <span class="inline-block px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-700 font-semibold text-xs text-rose-900 dark:text-rose-200 line-through">
                                  {{ formatFieldValue(change.fieldName, change.oldValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50">
                      Bản ghi đã được xóa khỏi hệ thống.
                    </div>
                  }
                </div>
              } @else {
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-sliders-h text-indigo-600 text-sm" aria-hidden="true"></i>
                      <span>So sánh chi tiết giá trị trước và sau chỉnh sửa</span>
                    </h3>
                    <span class="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      Chỉnh sửa dữ liệu
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính thay đổi</th>
                            <th scope="col" class="py-2.5 px-4 w-1/3 bg-rose-50/40 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300">Giá trị trước (Cũ)</th>
                            <th scope="col" class="py-2.5 px-4 w-1/3 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">Giá trị sau (Mới)</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800 dark:text-slate-100">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ change.fieldName }}</div>
                              </td>
                              <td class="py-3 px-4 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 break-words select-all tabular-nums">
                                <span class="inline-block px-2 py-0.5 rounded bg-rose-100/70 dark:bg-rose-900/50 border border-rose-200/80 dark:border-rose-700">
                                  {{ formatFieldValue(change.fieldName, change.oldValue) }}
                                </span>
                              </td>
                              <td class="py-3 px-4 bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 break-words select-all tabular-nums">
                                <span class="inline-block px-2 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-700 font-bold">
                                  {{ formatFieldValue(change.fieldName, change.newValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50">
                      Không có thay đổi trường nghiệp vụ nào cần so sánh.
                    </div>
                  }
                </div>
              }

              <!-- KHU VỰC THÔNG TIN KỸ THUẬT -->
              @if (getTechnicalChanges(item.changes).length > 0) {
                <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <details class="group bg-slate-50/60 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 p-3 text-xs">
                    <summary class="font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center justify-between select-none">
                      <span class="flex items-center gap-2">
                        <i class="pi pi-code text-slate-500" aria-hidden="true"></i>
                        <span>Mã định danh kỹ thuật & Khai thác kiểm toán ({{ getTechnicalChanges(item.changes).length }} trường)</span>
                      </span>
                      <i class="pi pi-chevron-down text-slate-400 group-open:rotate-180 transition-transform" aria-hidden="true"></i>
                    </summary>
                    <div class="mt-3 space-y-2">
                      @for (tech of getTechnicalChanges(item.changes); track tech.fieldName) {
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-700 font-mono text-xs">
                          <div>
                            <span class="font-bold text-slate-700 dark:text-slate-200 font-sans mr-2">{{ getFieldDisplayLabel(tech.fieldName) }}:</span>
                            <span class="text-slate-500 dark:text-slate-400">({{ tech.fieldName }})</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-indigo-900 dark:text-indigo-300 font-semibold break-all select-all">{{ tech.newValue || tech.oldValue || '—' }}</span>
                            @if (tech.newValue || tech.oldValue) {
                              <button
                                type="button"
                                (click)="copyToClipboard(tech.newValue || tech.oldValue || '', getFieldDisplayLabel(tech.fieldName))"
                                [attr.aria-label]="'Sao chép ' + getFieldDisplayLabel(tech.fieldName)"
                                class="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 rounded-xl cursor-pointer"
                                [title]="'Sao chép ' + getFieldDisplayLabel(tech.fieldName)"
                              >
                                <i class="pi pi-copy text-xs" aria-hidden="true"></i>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </details>
                </div>
              }
            }
          </div>

          <!-- Modal Footer (Sticky Bottom) -->
          <div class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 shrink-0 flex items-center justify-between gap-3">
            <span class="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {{ selectedDetail()?.action === 'Create' ? 'Bản ghi kiểm toán bất biến phục vụ quản trị.' : (selectedDetail()?.action === 'Delete' ? 'Dữ liệu được lưu trữ vĩnh viễn theo quy định kiểm toán.' : 'Dữ liệu được ghi nhận tự động qua hệ thống Audit.') }}
            </span>
            <button
              type="button"
              (click)="closeDetailModal()"
              class="min-h-11 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Đóng cửa sổ chi tiết (Esc)"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AuditLogsPage implements OnInit {
  private readonly auditLogService = inject(AuditLogService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly propertyManagementService = inject(PropertyManagementService, { optional: true });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('dateRangeFilter') private dateRangeFilter?: DateRangeFilterComponent;

  readonly actionOptions = AUDIT_ACTION_OPTIONS;
  readonly tenantEntityOptions = TENANT_AUDIT_ENTITY_OPTIONS;
  readonly platformEntityOptions = PLATFORM_AUDIT_ENTITY_OPTIONS;

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly errorMessage = signal('');
  readonly auditLogs = signal<AuditLogListItem[]>([]);
  readonly propertyOptions = signal<Array<{ id: string; name: string; code?: string | null }>>([]);
  readonly totalRecords = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);

  readonly sortField = signal<AuditSortField>('createdAtUtc');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly sortedAuditLogs = computed<AuditLogListItem[]>(() => {
    const items = [...this.auditLogs()];
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    return items.sort((a, b) => {
      if (field === 'createdAtUtc') {
        const ta = new Date(a.createdAtUtc).getTime() || 0;
        const tb = new Date(b.createdAtUtc).getTime() || 0;
        return (ta - tb) * dir;
      }
      const va = String(a[field] ?? '');
      const vb = String(b[field] ?? '');
      return va.localeCompare(vb, 'vi') * dir;
    });
  });

  readonly isDetailModalOpen = signal(false);
  readonly isDetailLoading = signal(false);
  readonly selectedDetail = signal<AuditLogDetail | null>(null);

  selectedAction = '';
  selectedEntityName = '';
  selectedPropertyId = '';
  readonly isSuperAdmin = computed(() => this.authService.currentUser?.globalRole === 'SuperAdmin');
  readonly canFilterByProperty = computed(
    () =>
      !this.isSuperAdmin() &&
      typeof this.authService.hasPermission === 'function' &&
      this.authService.hasPermission('PROPERTIES', 1)
  );
  fromDate = '';
  toDate = '';
  fromUtc = '';
  toUtc = '';
  searchKeyword = '';

  /**
   * Kiểm tra quyền: Chỉ cho phép Owner và Manager truy cập.
   */
  readonly isAuthorized = computed(() => {
    const user = this.authService.currentUser;
    if (!user) return false;
    const globalRole = user.globalRole;
    if (globalRole === 'Owner' || globalRole === 'SuperAdmin' || globalRole === 'PlatformAdmin') return true;

    const activeRole = this.authService.activeRoleName();
    if (activeRole === 'Owner' || activeRole === 'Manager') return true;

    const memberships = this.authService.memberships;
    return memberships.some(m => m.staffRole === 'Owner' || m.staffRole === 'Manager');
  });

  private hasInitialLoaded = false;

  constructor() {
    this.selectedPropertyId = this.authService.activePropertyId() || '';
    try {
      effect(() => {
        const propId = this.authService.activePropertyId();
        untracked(() => {
          this.selectedPropertyId = propId || '';
          if (this.isAuthorized()) {
            this.hasInitialLoaded = true;
            this.currentPage.set(1);
            this.loadAuditLogs();
          }
        });
      });
    } catch {
      // Bỏ qua trong môi trường kiểm thử không kích hoạt effect
    }
  }

  ngOnInit(): void {
    if (this.isAuthorized() && this.canFilterByProperty()) {
      this.loadPropertyOptions();
    }
    if (!this.hasInitialLoaded && this.isAuthorized()) {
      this.loadAuditLogs();
    }
  }

  private loadPropertyOptions(): void {
    const seeded = new Map<string, { id: string; name: string; code?: string | null }>();
    for (const m of this.authService.memberships || []) {
      if (m.propertyId && !seeded.has(m.propertyId)) {
        seeded.set(m.propertyId, {
          id: m.propertyId,
          name: m.propertyName || m.propertyCode || m.propertyId,
          code: m.propertyCode || null
        });
      }
    }
    if (seeded.size > 0) {
      this.propertyOptions.set(Array.from(seeded.values()));
    }

    if (!this.propertyManagementService) {
      return;
    }

    this.propertyManagementService
      .getTenantProperties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: props => {
          const merged = new Map(seeded);
          for (const p of props || []) {
            if (p.id) {
              merged.set(p.id, { id: p.id, name: p.name, code: p.code || null });
            }
          }
          this.propertyOptions.set(Array.from(merged.values()));
        },
        error: () => {
          // Giữ nguyên danh sách chi nhánh lấy từ memberships nếu API lỗi
        }
      });
  }

  private getEffectivePropertyId(): string | undefined {
    if (this.isSuperAdmin()) {
      return undefined;
    }
    if (this.canFilterByProperty()) {
      return this.selectedPropertyId.trim() || undefined;
    }
    return this.authService.activePropertyId() || undefined;
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isDetailModalOpen()) {
      this.closeDetailModal();
    }
  }

  trackByLogId(_index: number, item: AuditLogListItem): string {
    return item.id;
  }

  toggleSort(field: AuditSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'createdAtUtc' ? 'desc' : 'asc');
    }
  }

  getAriaSort(field: AuditSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(field: AuditSortField): string {
    if (this.sortField() !== field) return 'pi-sort-alt text-slate-400';
    return this.sortDirection() === 'asc'
      ? 'pi-sort-amount-up-alt text-indigo-600'
      : 'pi-sort-amount-down text-indigo-600';
  }

  loadAuditLogs(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const params: AuditLogFilterParams = {
      action: this.selectedAction.trim() || undefined,
      entityName: this.selectedEntityName.trim() || undefined,
      propertyId: this.getEffectivePropertyId(),
      page: this.currentPage(),
      pageSize: this.pageSize()
    };

    if (this.fromUtc) {
      params.fromUtc = this.fromUtc;
    } else if (this.fromDate) {
      params.fromUtc = new Date(this.fromDate + 'T00:00:00Z').toISOString();
    }
    if (this.toUtc) {
      params.toUtc = this.toUtc;
    } else if (this.toDate) {
      params.toUtc = new Date(this.toDate + 'T23:59:59Z').toISOString();
    }
    if (this.searchKeyword.trim()) {
      params.search = this.searchKeyword.trim();
    }

    this.auditLogService
      .getAuditLogs(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.auditLogs.set(res.data.items);
            this.totalRecords.set(res.data.totalCount);
          } else {
            this.errorMessage.set(res.message || 'Không thể tải nhật ký kiểm toán.');
          }
        },
        error: err => {
          this.loading.set(false);
          const msg = err?.error?.message || 'Lỗi kết nối khi tải nhật ký kiểm toán.';
          this.errorMessage.set(msg);
        }
      });
  }

  onAuditDateFilterChange(val: DateRangeFilterValue | null): void {
    if (val) {
      this.fromDate = val.fromDate;
      this.toDate = val.toDate;
      this.fromUtc = val.startUtc;
      this.toUtc = val.endExclusiveUtc;
    } else {
      this.fromDate = '';
      this.toDate = '';
      this.fromUtc = '';
      this.toUtc = '';
    }
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  resetFilters(): void {
    this.selectedAction = '';
    this.selectedEntityName = '';
    this.selectedPropertyId = this.canFilterByProperty() ? '' : (this.authService.activePropertyId() || '');
    this.fromDate = '';
    this.toDate = '';
    this.fromUtc = '';
    this.toUtc = '';
    this.searchKeyword = '';
    this.dateRangeFilter?.clearWithoutEmit();
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  /**
   * Xuất danh sách nhật ký kiểm toán hiện tại ra file CSV theo chuẩn báo cáo kiểm toán doanh nghiệp.
   */
  exportToCsv(): void {
    if (this.auditLogs().length === 0) {
      this.alertService.toastWarning('Không có dữ liệu nhật ký kiểm toán để xuất file CSV.');
      return;
    }

    this.exporting.set(true);

    const totalCount = this.totalRecords();
    const currentItems = this.auditLogs();

    if (totalCount <= currentItems.length) {
      this.generateAndDownloadCsv(currentItems);
      this.exporting.set(false);
      return;
    }

    const EXPORT_PAGE_SIZE = 100;
    const MAX_EXPORT_PAGES = 10;
    const MAX_EXPORT_ROWS = 1000;
    let latestServerTotal = totalCount;

    const baseParams: Omit<AuditLogFilterParams, 'page' | 'pageSize'> = {
      action: this.selectedAction.trim() || undefined,
      entityName: this.selectedEntityName.trim() || undefined,
      propertyId: this.getEffectivePropertyId()
    };

    if (this.fromUtc) {
      baseParams.fromUtc = this.fromUtc;
    } else if (this.fromDate) {
      baseParams.fromUtc = new Date(this.fromDate + 'T00:00:00Z').toISOString();
    }
    if (this.toUtc) {
      baseParams.toUtc = this.toUtc;
    } else if (this.toDate) {
      baseParams.toUtc = new Date(this.toDate + 'T23:59:59Z').toISOString();
    }
    if (this.searchKeyword.trim()) {
      baseParams.search = this.searchKeyword.trim();
    }

    const fetchPage = (page: number) =>
      this.auditLogService
        .getAuditLogs({ ...baseParams, page, pageSize: EXPORT_PAGE_SIZE })
        .pipe(catchError(() => of(null)));

    fetchPage(1)
      .pipe(
        expand((res, index) => {
          const currentPageNum = index + 1;
          const data = res?.success ? res.data : null;
          if (data && typeof data.totalCount === 'number') {
            latestServerTotal = Math.max(latestServerTotal, data.totalCount);
          }
          if (!data || currentPageNum >= MAX_EXPORT_PAGES) {
            return EMPTY;
          }
          const hasMore =
            data.hasNextPage === true ||
            (data.hasNextPage === undefined &&
              data.items.length >= EXPORT_PAGE_SIZE &&
              currentPageNum * EXPORT_PAGE_SIZE < (data.totalCount ?? 0));
          return hasMore ? fetchPage(currentPageNum + 1) : EMPTY;
        }),
        reduce<ApiResponse<PagedResult<AuditLogListItem>> | null, AuditLogListItem[]>((acc, res) => {
          if (res?.success && res.data?.items?.length) {
            if (typeof res.data.totalCount === 'number') {
              latestServerTotal = Math.max(latestServerTotal, res.data.totalCount);
            }
            const remaining = MAX_EXPORT_ROWS - acc.length;
            if (remaining > 0) {
              acc.push(...res.data.items.slice(0, remaining));
            }
          }
          return acc;
        }, []),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: collected => {
          this.exporting.set(false);
          const exportItems = collected.length > 0 ? collected : currentItems;
          const hitCap = exportItems.length >= MAX_EXPORT_ROWS && latestServerTotal > MAX_EXPORT_ROWS;
          this.generateAndDownloadCsv(exportItems, hitCap ? latestServerTotal : undefined);
        },
        error: () => {
          this.exporting.set(false);
          this.generateAndDownloadCsv(currentItems);
        }
      });
  }

  private generateAndDownloadCsv(items: AuditLogListItem[], truncatedFromTotal?: number): void {
    if (!items || items.length === 0) {
      this.alertService.toastWarning('Không có dữ liệu để xuất file CSV.');
      return;
    }

    const headers = [
      'Mã kiểm toán (ID)',
      'Thời gian (UTC)',
      'Thời gian (Địa phương)',
      'Chi nhánh',
      'Mã chi nhánh',
      'Người thực hiện',
      'Email người thực hiện',
      'Hành động',
      'Đối tượng nghiệp vụ',
      'Mã đối tượng (Entity ID)',
      'Tóm tắt thay đổi',
      'Các trường thay đổi'
    ];

    const rows = items.map(item => {
      const localTime = item.createdAtUtc ? new Date(item.createdAtUtc).toLocaleString('vi-VN') : '';
      const actionLabel = this.getActionLabel(item.action);
      const entityLabel = this.getEntityDisplayLabel(item.entityName);
      const changedFieldsStr = (item.changedFields || []).map(f => this.getFieldDisplayLabel(f)).join(', ');
      const friendlySummary = this.getFriendlySummary(item.changeSummary, item.action, item.entityName);

      return [
        this.escapeCsvCell(item.id),
        this.escapeCsvCell(item.createdAtUtc),
        this.escapeCsvCell(localTime),
        this.escapeCsvCell(item.propertyName || 'Toàn chuỗi / HQ'),
        this.escapeCsvCell(item.propertyCode || 'HQ'),
        this.escapeCsvCell(item.userFullName || 'Hệ thống tự động'),
        this.escapeCsvCell(item.userEmail || ''),
        this.escapeCsvCell(actionLabel),
        this.escapeCsvCell(`${entityLabel} (${item.entityName})`),
        this.escapeCsvCell(item.entityId),
        this.escapeCsvCell(friendlySummary),
        this.escapeCsvCell(changedFieldsStr)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(h => this.escapeCsvCell(h)).join(','), ...rows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const propCode = this.authService.activePropertyCode() || 'HQ';
    link.setAttribute('download', `audit_logs_${propCode}_${dateStr}_${timeStr}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (truncatedFromTotal && truncatedFromTotal > items.length) {
      this.alertService.toastWarning(
        `Đã xuất ${items.length.toLocaleString('vi-VN')} bản ghi đầu tiên trên tổng ${truncatedFromTotal.toLocaleString('vi-VN')} bản ghi (giới hạn 1.000 dòng). Vui lòng thu hẹp khoảng ngày lọc để xuất đầy đủ.`,
        'Giới hạn xuất CSV',
        6000
      );
    } else {
      this.alertService.toastSuccess(`Đã xuất thành công ${items.length} bản ghi kiểm toán ra file CSV.`);
    }
  }

  private escapeCsvCell(val: unknown): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadAuditLogs();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  openDetail(id: string, itemPropertyId?: string | null): void {
    this.isDetailModalOpen.set(true);
    this.isDetailLoading.set(true);
    this.selectedDetail.set(null);

    const propId = itemPropertyId ?? this.getEffectivePropertyId() ?? this.authService.activePropertyId();
    this.auditLogService
      .getAuditLogById(id, propId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.isDetailLoading.set(false);
          if (res.success && res.data) {
            this.selectedDetail.set(res.data);
          } else {
            this.alertService.error(res.message || 'Không tìm thấy chi tiết nhật ký kiểm toán.');
            this.closeDetailModal();
          }
        },
        error: err => {
          this.isDetailLoading.set(false);
          this.alertService.error(err?.error?.message || 'Lỗi khi tải chi tiết kiểm toán.');
          this.closeDetailModal();
        }
      });
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.selectedDetail.set(null);
  }

  copyToClipboard(text: string, label: string): void {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.alertService.success(`Đã sao chép ${label}.`);
      }).catch(() => {
        this.alertService.toastWarning(`Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.`);
      });
    } else {
      this.alertService.toastWarning(`Trình duyệt không hỗ trợ tự động sao chép.`);
    }
  }

  getBusinessChanges(changes?: AuditFieldChange[]): AuditFieldChange[] {
    if (!changes) return [];
    return changes.filter(c => !this.isTechnicalField(c.fieldName));
  }

  getTechnicalChanges(changes?: AuditFieldChange[]): AuditFieldChange[] {
    if (!changes) return [];
    return changes.filter(c => this.isTechnicalField(c.fieldName));
  }

  isTechnicalField(fieldName: string): boolean {
    return /^(Id|TenantId|PropertyId|RoomTypeId|CreatedByUserId|UserId|ReservationId|InvoiceId)$/i.test(fieldName) ||
      /(Id|Guid)$/i.test(fieldName);
  }

  getActionButtonLabel(action?: string): string {
    return action === 'Update' ? 'So sánh' : 'Xem chi tiết';
  }

  getActionButtonIcon(action?: string): string {
    return action === 'Update' ? 'pi-sliders-h' : 'pi-eye';
  }

  getActionLabel(action?: string): string {
    return getAuditActionLabel(action);
  }

  getActionBadgeClass(action?: string): string {
    return getAuditActionBadgeClass(action);
  }

  getActionIcon(action?: string): string {
    return getAuditActionIcon(action);
  }

  getEntityDisplayLabel(name?: string): string {
    return getAuditEntityDisplayLabel(name);
  }

  getFieldDisplayLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      Name: 'Tên đối tượng',
      Code: 'Mã ký hiệu',
      Slug: 'Đường dẫn liên kết (Slug)',
      Address: 'Địa chỉ cơ sở',
      City: 'Tỉnh / Thành phố',
      PhoneNumber: 'Số điện thoại liên hệ',
      Email: 'Email liên hệ',
      StarRating: 'Xếp hạng sao',
      CheckInTime: 'Giờ nhận phòng tiêu chuẩn',
      CheckOutTime: 'Giờ trả phòng tiêu chuẩn',
      BufferMinutes: 'Thời gian dọn phòng (phút)',
      MaxHourlyHours: 'Số giờ tối đa thuê theo giờ',
      TaxRatePercent: 'Tỷ lệ thuế VAT (%)',
      RoomNumber: 'Số phòng',
      Floor: 'Tầng',
      CleanlinessStatus: 'Tình trạng vệ sinh',
      BasePrice: 'Giá phòng tiêu chuẩn',
      StandardOccupancy: 'Số khách tiêu chuẩn',
      MaxOccupancy: 'Số khách tối đa',
      ConfirmationCode: 'Mã xác nhận đơn',
      GuestName: 'Họ tên khách lưu trú',
      GuestEmail: 'Email khách lưu trú',
      GuestPhone: 'Số điện thoại khách',
      CheckInDate: 'Ngày nhận phòng',
      CheckOutDate: 'Ngày trả phòng',
      NumberOfGuests: 'Số lượng khách',
      CancellationReason: 'Lý do hủy đơn',
      Amount: 'Số tiền thanh toán',
      Method: 'Phương thức thanh toán',
      TransactionRef: 'Mã giao dịch ngân hàng',
      StaffRole: 'Chức danh nhân viên',
      RoleId: 'Chức vụ phân quyền',
      IsSystemRole: 'Vai trò mặc định hệ thống',
      Description: 'Mô tả vai trò',
      Priority: 'Mức độ ưu tiên dọn dẹp',
      AssignedToUserId: 'Nhân viên phụ trách',
      NightlyPrice: 'Giá thuê theo đêm',
      FirstHours: 'Số giờ ban đầu',
      FirstHoursPrice: 'Giá số giờ ban đầu',
      AdditionalHourPrice: 'Giá mỗi giờ tiếp theo',
      Currency: 'Đơn vị tiền tệ',
      EffectiveFrom: 'Ngày bắt đầu hiệu lực',
      EffectiveTo: 'Ngày kết thúc hiệu lực (Exclusive)',
      IsActive: 'Trạng thái hoạt động',
      ChangeReason: 'Lý do thay đổi',
      RoomTypeId: 'Mã loại phòng (RoomTypeId)',
      CreatedByUserId: 'Mã người tạo (CreatedByUserId)',
      SurchargeType: 'Loại phụ thu',
      CalculationMethod: 'Phương thức tính',
      Percentage: 'Tỷ lệ phụ thu (%)',
      FlatAmount: 'Mức tiền cố định',
      FromTime: 'Từ khung giờ',
      ToTime: 'Đến khung giờ',
      InvoiceNumber: 'Số hóa đơn',
      ReservationId: 'Mã đặt phòng (ReservationId)',
      TotalAmount: 'Tổng tiền thanh toán',
      SubTotal: 'Tổng tiền dịch vụ',
      TaxAmount: 'Tiền thuế VAT',
      DiscountAmount: 'Tiền giảm giá',
      Status: 'Trạng thái nghiệp vụ',
      IssuedAtUtc: 'Thời điểm phát hành',
      DueAtUtc: 'Hạn thanh toán',
      PaidAtUtc: 'Thời điểm thanh toán',
      Notes: 'Ghi chú nghiệp vụ',
      PaymentMethod: 'Phương thức thanh toán',
      Id: 'Mã bản ghi (ID)',
      TenantId: 'Mã định danh Tenant',
      PropertyId: 'Mã định danh Chi nhánh'
    };
    return labels[fieldName] || fieldName;
  }

  getFriendlySummary(summary: string | null | undefined, action?: string, entityName?: string): string {
    return getFriendlyAuditSummary(summary, action, entityName);
  }

  formatEffectiveTo(value: string | null): string {
    if (!value) return '—';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);

      const d = new Date(y, month - 1, day);
      d.setDate(d.getDate() - 1);
      const prevDayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const displayDate = `${m[3]}/${m[2]}/${m[1]}`;
      return `${displayDate} (Hiệu lực đến hết ngày ${prevDayStr} — mốc kết thúc exclusive)`;
    }
    return value;
  }

  formatEffectiveFrom(value: string | null): string {
    if (!value) return '—';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]} (Bắt đầu áp dụng từ 00:00)`;
    }
    return value;
  }

  formatShortDate(isoDateStr: string): string {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
  }

  formatFieldValue(fieldName: string, value: string | null): string {
    if (value === null || value === undefined || value === '') return '—';

    if (fieldName === 'EffectiveTo') {
      return this.formatEffectiveTo(value);
    }
    if (fieldName === 'EffectiveFrom') {
      return this.formatEffectiveFrom(value);
    }

    if (/Price|Amount|Fee/i.test(fieldName)) {
      const num = Number(value);
      if (!isNaN(num)) {
        return `${num.toLocaleString('vi-VN')} ₫`;
      }
    }

    if (value === 'True' || value === 'true') return 'Hoạt động (Có)';
    if (value === 'False' || value === 'false') return 'Vô hiệu (Không)';

    if (fieldName === 'FirstHours') {
      return `${value} giờ`;
    }

    if (fieldName === 'Percentage') {
      return `${value}%`;
    }

    if (/Date|Utc$/i.test(fieldName) && !isNaN(Date.parse(value))) {
      return this.formatVietnamDate(value);
    }

    return value;
  }

  formatVietnamDate(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatVietnamTime(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  formatVietnamFullDateTime(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return `${this.formatVietnamDate(utcDateStr)} lúc ${this.formatVietnamTime(utcDateStr)}`;
  }
}
