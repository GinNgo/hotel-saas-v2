import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { DatePicker } from 'primeng/datepicker';
import { parseCalendarDate, formatCalendarDate } from '../../core/utils/date-time.util';
import { Router } from '@angular/router';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { AdminContractsService } from '../../core/services/admin-contracts.service';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { PlatformGovernanceService } from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { BusinessDatePipe } from '../../shared/pipes/business-date.pipe';
import {
  SearchableSelectComponent,
  SearchableSelectItem
} from '../../shared/components/searchable-select/searchable-select.component';
import {
  TenantContractDto,
  CreateTenantContractRequest,
  ContractBillingCycle
} from '../../core/models/admin-contract.model';
import { AdminSubscriptionPlanDto } from '../../core/models/admin-plan.model';

type ContractSortField = 'contractNumber' | 'tenantName' | 'startDate' | 'contractValue' | 'status';

@Component({
  selector: 'app-admin-contracts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    DatePicker,
    SearchableSelectComponent,
    PageHeaderComponent,
    BusinessDatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">
      <!-- Header -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            <i class="pi pi-file-edit text-xs" aria-hidden="true"></i> Platform Contracts
          </span>
          <span class="text-xs text-slate-600 dark:text-slate-400">Quản trị Pháp lý &amp; Hợp đồng Đối tác</span>
        </div>

        <app-page-header
          title="Quản lý Hợp đồng Dịch vụ Khách sạn (Tenant Contracts)"
          subtitle="Ký kết hợp đồng điện tử, cam kết chuẩn SLA 99.9%, xuất bản in hợp đồng dịch vụ phần mềm song ngữ."
        >
          <button
            type="button"
            (click)="loadContracts()"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            (click)="openCreateModal()"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
            <span>Tạo hợp đồng mới</span>
          </button>
        </app-page-header>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Tổng số hợp đồng</div>
          <div class="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{{ contracts().length }}</div>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Hiệu lực (Active)</div>
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{{ activeCount() }}</div>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Chờ ký kết (Pending)</div>
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{{ pendingCount() }}</div>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Doanh số cam kết</div>
          <div class="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">{{ totalValue() | number:'1.0-0' }} ₫</div>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div class="relative w-full sm:w-80">
          <label for="contract-search-input" class="sr-only">Tìm kiếm hợp đồng</label>
          <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input
            id="contract-search-input"
            type="text"
            [ngModel]="searchKeyword()"
            (ngModelChange)="searchKeyword.set($event)"
            placeholder="Tìm theo số hợp đồng, tên khách sạn, người đại diện..."
            class="w-full min-h-11 pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <select
            aria-label="Lọc theo trạng thái hợp đồng"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            class="min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Active">Hiệu lực (Active)</option>
            <option value="PendingSignature">Chờ ký số</option>
            <option value="Draft">Bản nháp</option>
            <option value="Expired">Hết hạn</option>
            <option value="Terminated">Đã chấm dứt</option>
          </select>
        </div>
      </div>

      <!-- Contracts Table + Mobile Cards -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-hidden">
        <!-- Mobile Stacked Cards (<768px) -->
        <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          @for (c of sortedContracts(); track c.id) {
            <article class="p-4 space-y-2.5 text-xs">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">{{ c.contractNumber }}</div>
                  <div class="font-semibold text-slate-800 dark:text-slate-200">{{ c.tenantName }}</div>
                  <div class="text-slate-500 dark:text-slate-400">{{ c.representativeName }} ({{ c.representativePhone }})</div>
                </div>
                <span class="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">{{ c.contractValue | number:'1.0-0' }} ₫</span>
              </div>
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                  {{ c.planName }} ({{ getBillingCycleLabel(c.billingCycle) }})
                </span>
                <span class="text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ c.startDate | businessDate }} → {{ c.endDate | businessDate }}
                </span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span class="font-semibold">{{ c.status === 'Active' ? 'Có hiệu lực' : c.status === 'PendingSignature' ? 'Chờ ký số' : c.status }}</span>
                <div class="flex items-center gap-1.5">
                  <a
                    [href]="'/print/contract/' + c.id"
                    target="_blank"
                    [attr.aria-label]="'In văn bản hợp đồng ' + c.contractNumber"
                    class="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                  >
                    <i class="pi pi-print" aria-hidden="true"></i>
                  </a>
                  @if (c.status === 'Draft' || c.status === 'PendingSignature') {
                    <button
                      type="button"
                      (click)="signContract(c)"
                      [attr.aria-label]="'Ký xác nhận và kích hoạt hợp đồng ' + c.contractNumber"
                      class="min-w-11 min-h-11 inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-xl cursor-pointer"
                    >
                      <i class="pi pi-check-circle" aria-hidden="true"></i>
                    </button>
                  }
                  @if (c.status === 'Active') {
                    <button
                      type="button"
                      (click)="terminateContract(c)"
                      [attr.aria-label]="'Chấm dứt hợp đồng ' + c.contractNumber"
                      class="min-w-11 min-h-11 inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer"
                    >
                      <i class="pi pi-ban" aria-hidden="true"></i>
                    </button>
                  }
                </div>
              </div>
            </article>
          }
          @if (sortedContracts().length === 0) {
            <div class="py-12 text-center text-slate-500 dark:text-slate-400">
              <i class="pi pi-file text-3xl mb-2 text-slate-300" aria-hidden="true"></i>
              <div>Không tìm thấy hợp đồng nào phù hợp</div>
            </div>
          }
        </div>

        <!-- Desktop Table (>=768px) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getAriaSort('contractNumber')">
                  <button type="button" (click)="toggleSort('contractNumber')" class="inline-flex items-center gap-1 font-semibold uppercase cursor-pointer">
                    <span>Số Hợp Đồng</span>
                    <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getAriaSort('tenantName')">
                  <button type="button" (click)="toggleSort('tenantName')" class="inline-flex items-center gap-1 font-semibold uppercase cursor-pointer">
                    <span>Đối Tác Khách Sạn</span>
                    <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col" class="py-3.5 px-4">Gói &amp; Loại HĐ</th>
                <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getAriaSort('startDate')">
                  <button type="button" (click)="toggleSort('startDate')" class="inline-flex items-center gap-1 font-semibold uppercase cursor-pointer">
                    <span>Thời Hạn</span>
                    <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col" class="py-3.5 px-4 text-right" [attr.aria-sort]="getAriaSort('contractValue')">
                  <button type="button" (click)="toggleSort('contractValue')" class="inline-flex items-center gap-1 font-semibold uppercase cursor-pointer">
                    <span>Giá Trị (VNĐ)</span>
                    <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col" class="py-3.5 px-4" [attr.aria-sort]="getAriaSort('status')">
                  <button type="button" (click)="toggleSort('status')" class="inline-flex items-center gap-1 font-semibold uppercase cursor-pointer">
                    <span>Trạng Thái</span>
                    <i class="pi pi-sort-alt text-xs" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col" class="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (c of sortedContracts(); track c.id) {
                <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ c.contractNumber }}
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="font-semibold text-slate-900 dark:text-slate-100">{{ c.tenantName }}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{{ c.representativeName }} ({{ c.representativePhone }})</div>
                  </td>
                  <td class="py-3.5 px-4">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      {{ c.planName }}
                    </span>
                    <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ c.contractType }} ({{ getBillingCycleLabel(c.billingCycle) }})</div>
                  </td>
                  <td class="py-3.5 px-4 text-xs tabular-nums">
                    <div>Từ: <span class="font-medium text-slate-700 dark:text-slate-200 font-mono">{{ c.startDate | businessDate }}</span></div>
                    <div>Đến: <span class="font-medium text-slate-700 dark:text-slate-200 font-mono">{{ c.endDate | businessDate }}</span></div>
                  </td>
                  <td class="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ c.contractValue | number:'1.0-0' }} ₫
                  </td>
                  <td class="py-3.5 px-4">
                    @switch (c.status) {
                      @case ('Active') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span> Có hiệu lực
                        </span>
                      }
                      @case ('PendingSignature') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span> Chờ ký số
                        </span>
                      }
                      @case ('Draft') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true"></span> Bản nháp
                        </span>
                      }
                      @case ('Terminated') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <span class="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"></span> Đã chấm dứt
                        </span>
                      }
                      @default {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                          {{ c.status }}
                        </span>
                      }
                    }
                  </td>
                  <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <a
                        [href]="'/print/contract/' + c.id"
                        target="_blank"
                        [attr.aria-label]="'In văn bản hợp đồng ' + c.contractNumber"
                        class="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        title="In văn bản hợp đồng"
                      >
                        <i class="pi pi-print" aria-hidden="true"></i>
                      </a>

                      @if (c.status === 'Draft' || c.status === 'PendingSignature') {
                        <button
                          type="button"
                          (click)="signContract(c)"
                          [attr.aria-label]="'Ký xác nhận điện tử và kích hoạt hợp đồng ' + c.contractNumber"
                          class="min-w-11 min-h-11 inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          title="Ký xác nhận điện tử & Kích hoạt"
                        >
                          <i class="pi pi-check-circle" aria-hidden="true"></i>
                        </button>
                      }

                      @if (c.status === 'Active') {
                        <button
                          type="button"
                          (click)="terminateContract(c)"
                          [attr.aria-label]="'Chấm dứt hợp đồng ' + c.contractNumber"
                          class="min-w-11 min-h-11 inline-flex items-center justify-center text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          title="Chấm dứt hợp đồng"
                        >
                          <i class="pi pi-ban" aria-hidden="true"></i>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
              @if (sortedContracts().length === 0) {
                <tr>
                  <td colspan="7" class="py-12 text-center text-slate-500 dark:text-slate-400">
                    <i class="pi pi-file text-3xl mb-2 text-slate-300" aria-hidden="true"></i>
                    <div>Không tìm thấy hợp đồng nào phù hợp</div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Contract Modal -->
    @if (showCreateModal()) {
      <div
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[65] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-contract-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="showCreateModal.set(false)"
        (click)="showCreateModal.set(false)"
      >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
          >
            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 id="create-contract-modal-title" class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Khởi Tạo Hợp Đồng Dịch Vụ SaaS Mới</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ký kết cung cấp bản quyền phần mềm quản lý khách sạn</p>
              </div>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                aria-label="Đóng cửa sổ tạo hợp đồng"
                class="min-w-11 min-h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="contract-tenant-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Đối tác khách sạn (Tenant)
                  </label>
                  <app-searchable-select
                    controlId="contract-tenant-select"
                    label="Chọn đối tác khách sạn (Tenant)"
                    [items]="tenantOptions()"
                    [(ngModel)]="newTenantId"
                    [loading]="loadingTenants()"
                    placeholder="Chọn đối tác khách sạn / chuỗi..."
                    searchPlaceholder="Tìm theo tên hoặc mã Tenant..."
                  />
                </div>
                <div>
                  <label for="contract-plan-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gói Cước Đăng Ký</label>
                  <select
                    id="contract-plan-select"
                    [(ngModel)]="newPlanCode"
                    (change)="onPlanSelected()"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    @for (p of availablePlans(); track p.id) {
                      <option [value]="p.code">{{ p.name }} ({{ p.monthlyPrice | number:'1.0-0' }} ₫/tháng)</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="contract-cycle-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chu kỳ thanh toán</label>
                  <select
                    id="contract-cycle-select"
                    [(ngModel)]="newBillingCycle"
                    (change)="onPlanSelected()"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="Annual">Hàng năm (Annual)</option>
                    <option value="Monthly">Hàng tháng (Monthly)</option>
                  </select>
                </div>
              </div>

              <!-- Representative Info -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Người đại diện pháp lý bên khách sạn</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label for="contract-rep-name" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Họ và tên <span class="text-rose-500">*</span></label>
                    <input id="contract-rep-name" type="text" [(ngModel)]="newRepName" placeholder="Nhập họ tên người đại diện" class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label for="contract-rep-email" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Email <span class="text-rose-500">*</span></label>
                    <input id="contract-rep-email" type="email" [(ngModel)]="newRepEmail" placeholder="email@khachsan.vn" class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label for="contract-rep-phone" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Số điện thoại</label>
                    <input id="contract-rep-phone" type="text" [(ngModel)]="newRepPhone" placeholder="09xx xxx xxx" class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>

              <!-- Date & Value -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="contract-start-date" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ngày bắt đầu</label>
                  <p-datepicker
                    inputId="contract-start-date"
                    [(ngModel)]="newStartDateValue"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    iconDisplay="input"
                    appendTo="body"
                    [firstDayOfWeek]="1"
                    placeholder="dd/mm/yyyy"
                    ariaLabel="Ngày bắt đầu"
                    styleClass="w-full"
                    inputStyleClass="w-full min-h-11 px-3.5 pr-10 text-sm rounded-xl border border-slate-300 bg-white shadow-2xs font-medium tabular-nums"
                  />
                </div>
                <div>
                  <label for="contract-end-date" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ngày kết thúc</label>
                  <p-datepicker
                    inputId="contract-end-date"
                    [(ngModel)]="newEndDateValue"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    iconDisplay="input"
                    appendTo="body"
                    [firstDayOfWeek]="1"
                    placeholder="dd/mm/yyyy"
                    ariaLabel="Ngày kết thúc"
                    styleClass="w-full"
                    inputStyleClass="w-full min-h-11 px-3.5 pr-10 text-sm rounded-xl border border-slate-300 bg-white shadow-2xs font-medium tabular-nums"
                  />
                </div>
                <div>
                  <label for="contract-value" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tổng giá trị HĐ (VNĐ)</label>
                  <input id="contract-value" type="number" [(ngModel)]="newContractValue" class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums" />
                </div>
              </div>

              <!-- Terms -->
              <div>
                <label for="contract-terms" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Điều khoản &amp; Cam kết SLA</label>
                <textarea
                  id="contract-terms"
                  [(ngModel)]="newTerms"
                  rows="3"
                  class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                ></textarea>
              </div>
            </div>

            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitCreateContract()"
                [disabled]="isSaving()"
                class="min-h-11 inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <i class="pi pi-check" [class.animate-spin]="isSaving()" aria-hidden="true"></i>
                <span>{{ isSaving() ? 'Đang tạo...' : 'Ký tạo Hợp đồng' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
  `
})
export class AdminContractsPage implements OnInit, HasUnsavedChanges {
  private readonly contractsService = inject(AdminContractsService);
  private readonly plansService = inject(AdminPlansService);
  private readonly platformGovernanceService = inject(PlatformGovernanceService, { optional: true });
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly contracts = signal<TenantContractDto[]>([]);
  readonly availablePlans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly tenantOptions = signal<SearchableSelectItem[]>([]);
  readonly loadingTenants = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly showCreateModal = signal(false);

  // Filters & Sort
  readonly searchKeyword = signal('');
  readonly statusFilter = signal('ALL');
  readonly sortField = signal<ContractSortField>('contractNumber');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  // New Contract Form (no hardcoded personal details)
  newTenantId = '';
  newPlanCode = 'PRO';
  newPlanName = 'Gói Chuyên Nghiệp (Pro)';
  newBillingCycle: ContractBillingCycle = 'Annual';
  newRepName = '';
  newRepEmail = '';
  newRepPhone = '';
  newStartDate = '';
  newEndDate = '';

  private initialCreateSnapshot = '';

  get newStartDateValue(): Date | null {
    return parseCalendarDate(this.newStartDate);
  }
  set newStartDateValue(val: Date | null) {
    this.newStartDate = formatCalendarDate(val);
  }

  get newEndDateValue(): Date | null {
    return parseCalendarDate(this.newEndDate);
  }
  set newEndDateValue(val: Date | null) {
    this.newEndDate = formatCalendarDate(val);
  }
  newContractValue = 6990000;
  newTerms = 'Bên A cam kết cung cấp dịch vụ hạ tầng SaaS Hotel v2 với SLA 99.9%, hỗ trợ backup hàng ngày và bảo mật tuyệt đối.';

  readonly activeCount = computed(() => this.contracts().filter(c => c.status === 'Active').length);
  readonly pendingCount = computed(() => this.contracts().filter(c => c.status === 'PendingSignature').length);
  readonly totalValue = computed(() =>
    this.contracts()
      .filter(c => c.status === 'Active')
      .reduce((sum, c) => sum + (c.contractValue || 0), 0)
  );

  readonly filteredContracts = computed(() => {
    let list = this.contracts();
    const filter = this.statusFilter();
    if (filter !== 'ALL') {
      list = list.filter(c => c.status === filter);
    }
    const kw = this.searchKeyword().trim().toLowerCase();
    if (kw) {
      list = list.filter(
        c =>
          c.contractNumber?.toLowerCase().includes(kw) ||
          c.tenantName?.toLowerCase().includes(kw) ||
          c.representativeName?.toLowerCase().includes(kw)
      );
    }
    return list;
  });

  readonly sortedContracts = computed(() => {
    const list = [...this.filteredContracts()];
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (field === 'contractValue') {
        return ((a.contractValue ?? 0) - (b.contractValue ?? 0)) * dir;
      }
      return String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'vi') * dir;
    });
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showCreateModal() && !this.isSaving()) {
      this.showCreateModal.set(false);
    }
  }

  hasUnsavedChanges(): boolean {
    return this.showCreateModal() && this.buildCreateSnapshot() !== this.initialCreateSnapshot;
  }

  private buildCreateSnapshot(): string {
    return JSON.stringify({
      newTenantId: this.newTenantId,
      newPlanCode: this.newPlanCode,
      newBillingCycle: this.newBillingCycle,
      newRepName: this.newRepName,
      newRepEmail: this.newRepEmail,
      newRepPhone: this.newRepPhone,
      newStartDate: this.newStartDate,
      newEndDate: this.newEndDate,
      newContractValue: this.newContractValue,
      newTerms: this.newTerms
    });
  }

  toggleSort(field: ContractSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'contractValue' || field === 'startDate' ? 'desc' : 'asc');
    }
  }

  getAriaSort(field: ContractSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  ngOnInit(): void {
    this.loadContracts();
    this.loadPlans();
    this.loadTenants();
    this.initDefaultDates();
  }

  loadTenants(): void {
    if (!this.platformGovernanceService) {
      return;
    }
    this.loadingTenants.set(true);
    this.platformGovernanceService
      .getPlatformTenants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.tenantOptions.set(
            (list || []).map(t => ({
              value: t.id,
              label: `${t.name} (${t.code})`,
              subLabel: t.email || t.city || t.slug,
              badge: t.subscriptionTierName
            }))
          );
          this.loadingTenants.set(false);
        },
        error: () => {
          this.loadingTenants.set(false);
        }
      });
  }

  private initDefaultDates(): void {
    const today = new Date();
    this.newStartDate = today.toISOString().split('T')[0];
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    this.newEndDate = nextYear.toISOString().split('T')[0];
  }

  loadContracts(): void {
    this.isLoading.set(true);
    this.contractsService
      .getAllContracts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.contracts.set(data);
          this.isLoading.set(false);
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Không thể tải danh sách hợp đồng');
          this.isLoading.set(false);
        }
      });
  }

  loadPlans(): void {
    this.plansService
      .getAllPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: plans => this.availablePlans.set(plans)
      });
  }

  getBillingCycleLabel(cycle?: string): string {
    switch ((cycle || '').toLowerCase()) {
      case 'monthly':
        return 'Hàng tháng';
      case 'quarterly':
        return 'Hàng quý';
      case 'annual':
      case 'yearly':
        return 'Hàng năm';
      default:
        return cycle || 'Hàng tháng';
    }
  }

  onPlanSelected(): void {
    const p = this.availablePlans().find(x => x.code === this.newPlanCode);
    if (p) {
      this.newPlanName = p.name;
      this.newContractValue = this.newBillingCycle === 'Monthly' ? p.monthlyPrice : p.yearlyPrice;
    }
  }

  openCreateModal(): void {
    if (this.contracts().length > 0 && !this.newTenantId) {
      this.newTenantId = this.contracts()[0].tenantId;
    }
    this.newRepName = '';
    this.newRepEmail = '';
    this.newRepPhone = '';
    this.newBillingCycle = 'Annual';
    this.onPlanSelected();
    this.initialCreateSnapshot = this.buildCreateSnapshot();
    this.showCreateModal.set(true);
  }

  submitCreateContract(): void {
    if (!this.newTenantId.trim()) {
      this.alertService.error('Vui lòng nhập TenantId');
      return;
    }
    if (!this.newRepName.trim() || !this.newRepEmail.trim()) {
      this.alertService.error('Vui lòng nhập họ tên và email người đại diện hợp đồng');
      return;
    }

    this.isSaving.set(true);
    const req: CreateTenantContractRequest = {
      tenantId: this.newTenantId.trim(),
      planCode: this.newPlanCode,
      planName: this.newPlanName,
      contractType: 'Standard',
      representativeName: this.newRepName.trim(),
      representativeEmail: this.newRepEmail.trim(),
      representativePhone: this.newRepPhone.trim(),
      startDate: this.newStartDate,
      endDate: this.newEndDate,
      billingCycle: this.newBillingCycle,
      contractValue: this.newContractValue,
      termsAndConditions: this.newTerms,
      notes: 'Hợp đồng tạo bởi SuperAdmin portal'
    };

    this.contractsService
      .createContract(req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.alertService.success('Đã tạo mới hợp đồng thành công!');
          this.isSaving.set(false);
          this.showCreateModal.set(false);
          this.loadContracts();
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Không thể tạo hợp đồng');
          this.isSaving.set(false);
        }
      });
  }

  signContract(c: TenantContractDto): void {
    this.contractsService
      .updateContractStatus(c.id, {
        status: 'Active',
        note: 'Đã ký số và kích hoạt trực tuyến'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.contracts.update(list => list.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
          this.alertService.success(`Đã ký điện tử và kích hoạt hợp đồng ${updated.contractNumber || c.contractNumber}!`);
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Lỗi khi ký số');
        }
      });
  }

  async terminateContract(c: TenantContractDto): Promise<void> {
    const confirmed = await this.alertService.confirmDelete({
      title: 'Chấm dứt hợp đồng?',
      text: `Bạn có chắc chắn muốn chấm dứt hợp đồng ${c.contractNumber}?`,
      confirmButtonText: 'Chấm dứt hợp đồng',
      cancelButtonText: 'Hủy bỏ'
    });
    if (!confirmed) return;

    this.contractsService
      .updateContractStatus(c.id, {
        status: 'Terminated',
        note: 'Chấm dứt trước hạn theo yêu cầu của đối tác hoặc quản trị viên'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.contracts.update(list => list.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
          this.alertService.success(`Đã chấm dứt hợp đồng ${updated.contractNumber || c.contractNumber}`);
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Lỗi khi chấm dứt hợp đồng');
        }
      });
  }
}
