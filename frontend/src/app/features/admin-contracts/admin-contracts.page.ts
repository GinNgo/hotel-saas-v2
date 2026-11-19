import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { parseCalendarDate, formatCalendarDate } from '../../core/utils/date-time.util';
import { Router } from '@angular/router';
import { AdminContractsService } from '../../core/services/admin-contracts.service';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { PlatformGovernanceService } from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';
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

@Component({
  selector: 'app-admin-contracts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <i class="pi pi-file-edit text-[11px]"></i> Platform Contracts
            </span>
            <span class="text-xs text-slate-500">Quản trị Pháp lý & Hợp đồng Đối tác</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Quản lý Hợp đồng Dịch vụ Khách sạn (Tenant Contracts)
          </h1>
          <p class="text-sm text-slate-600 mt-1">
            Ký kết hợp đồng điện tử, cam kết chuẩn SLA 99.9%, xuất bản in hợp đồng dịch vụ phần mềm song ngữ.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="loadContracts()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
            Làm mới
          </button>
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <i class="pi pi-plus"></i>
            Tạo hợp đồng mới
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 uppercase">Tổng số hợp đồng</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">{{ contracts().length }}</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 uppercase">Hiệu lực (Active)</div>
          <div class="text-2xl font-bold text-emerald-600 mt-1">{{ activeCount() }}</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 uppercase">Chờ ký kết (Pending)</div>
          <div class="text-2xl font-bold text-amber-600 mt-1">{{ pendingCount() }}</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div class="text-xs font-medium text-slate-500 uppercase">Doanh số cam kết</div>
          <div class="text-xl font-bold text-indigo-700 mt-1">{{ totalValue() | number:'1.0-0' }} ₫</div>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="relative w-full sm:w-80">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            [ngModel]="searchKeyword()"
            (ngModelChange)="searchKeyword.set($event)"
            placeholder="Tìm theo số hợp đồng, tên khách sạn, người đại diện..."
            class="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <select
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            class="px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500"
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

      <!-- Contracts Table -->
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th class="py-3.5 px-4">Số Hợp Đồng</th>
                <th class="py-3.5 px-4">Đối Tác Khách Sạn</th>
                <th class="py-3.5 px-4">Gói & Loại HĐ</th>
                <th class="py-3.5 px-4">Thời Hạn</th>
                <th class="py-3.5 px-4">Giá Trị (VNĐ)</th>
                <th class="py-3.5 px-4">Trạng Thái</th>
                <th class="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (c of filteredContracts(); track c.id) {
                <tr class="hover:bg-slate-50/60 transition-colors">
                  <td class="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {{ c.contractNumber }}
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="font-semibold text-slate-900">{{ c.tenantName }}</div>
                    <div class="text-xs text-slate-500">{{ c.representativeName }} ({{ c.representativePhone }})</div>
                  </td>
                  <td class="py-3.5 px-4">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {{ c.planName }}
                    </span>
                    <div class="text-[11px] text-slate-500 mt-0.5">{{ c.contractType }} ({{ getBillingCycleLabel(c.billingCycle) }})</div>
                  </td>
                  <td class="py-3.5 px-4 text-xs">
                    <div>Từ: <span class="font-medium text-slate-700">{{ c.startDate }}</span></div>
                    <div>Đến: <span class="font-medium text-slate-700">{{ c.endDate }}</span></div>
                  </td>
                  <td class="py-3.5 px-4 font-bold text-slate-900">
                    {{ c.contractValue | number:'1.0-0' }} ₫
                  </td>
                  <td class="py-3.5 px-4">
                    @switch (c.status) {
                      @case ('Active') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Có hiệu lực
                        </span>
                      }
                      @case ('PendingSignature') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Chờ ký số
                        </span>
                      }
                      @case ('Draft') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Bản nháp
                        </span>
                      }
                      @case ('Terminated') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Đã chấm dứt
                        </span>
                      }
                      @default {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-500 bg-slate-100">
                          {{ c.status }}
                        </span>
                      }
                    }
                  </td>
                  <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <!-- Print Button -->
                      <a
                        [href]="'/print/contract/' + c.id"
                        target="_blank"
                        class="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="In văn bản hợp đồng"
                      >
                        <i class="pi pi-print"></i>
                      </a>

                      <!-- Sign Action (if pending or draft) -->
                      @if (c.status === 'Draft' || c.status === 'PendingSignature') {
                        <button
                          type="button"
                          (click)="signContract(c)"
                          class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Ký xác nhận điện tử & Kích hoạt"
                        >
                          <i class="pi pi-check-circle"></i>
                        </button>
                      }

                      <!-- Terminate Action (if active) -->
                      @if (c.status === 'Active') {
                        <button
                          type="button"
                          (click)="terminateContract(c)"
                          class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Chấm dứt hợp đồng"
                        >
                          <i class="pi pi-ban"></i>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
              @if (filteredContracts().length === 0) {
                <tr>
                  <td colspan="7" class="py-12 text-center text-slate-400">
                    <i class="pi pi-file text-3xl mb-2 text-slate-300"></i>
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
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-contract-modal-title"
        (keydown.escape)="showCreateModal.set(false)"
      >
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 id="create-contract-modal-title" class="text-base sm:text-lg font-bold text-slate-900">Khởi Tạo Hợp Đồng Dịch Vụ SaaS Mới</h3>
                <p class="text-xs text-slate-500 mt-0.5">Ký kết cung cấp bản quyền phần mềm quản lý khách sạn</p>
              </div>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                aria-label="Đóng cửa sổ tạo hợp đồng"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="contract-tenant-select" class="block text-xs font-semibold text-slate-700 mb-1">
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
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Gói Cước Đăng Ký</label>
                  <select
                    [(ngModel)]="newPlanCode"
                    (change)="onPlanSelected()"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500"
                  >
                    @for (p of availablePlans(); track p.id) {
                      <option [value]="p.code">{{ p.name }} ({{ p.monthlyPrice | number:'1.0-0' }} ₫/tháng)</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Chu kỳ thanh toán</label>
                  <select
                    [(ngModel)]="newBillingCycle"
                    (change)="onPlanSelected()"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="Annual">Hàng năm (Annual)</option>
                    <option value="Monthly">Hàng tháng (Monthly)</option>
                  </select>
                </div>
              </div>

              <!-- Representative Info -->
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div class="text-xs font-bold text-slate-800 uppercase tracking-wider">Người đại diện pháp lý bên khách sạn</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Họ và tên <span class="text-rose-500">*</span></label>
                    <input type="text" [(ngModel)]="newRepName" placeholder="Nhập họ tên người đại diện" class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Email <span class="text-rose-500">*</span></label>
                    <input type="email" [(ngModel)]="newRepEmail" placeholder="email@khachsan.vn" class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Số điện thoại</label>
                    <input type="text" [(ngModel)]="newRepPhone" placeholder="09xx xxx xxx" class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 bg-white" />
                  </div>
                </div>
              </div>

              <!-- Date & Value -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Ngày bắt đầu</label>
                  <p-datepicker
                    [(ngModel)]="newStartDateValue"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    iconDisplay="input"
                    appendTo="body"
                    [firstDayOfWeek]="1"
                    placeholder="dd/mm/yyyy"
                    ariaLabel="Ngày bắt đầu"
                    styleClass="w-full"
                    inputStyleClass="w-full h-10 px-3.5 pr-10 text-sm rounded-xl border border-slate-300 bg-white shadow-2xs font-medium"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Ngày kết thúc</label>
                  <p-datepicker
                    [(ngModel)]="newEndDateValue"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    iconDisplay="input"
                    appendTo="body"
                    [firstDayOfWeek]="1"
                    placeholder="dd/mm/yyyy"
                    ariaLabel="Ngày kết thúc"
                    styleClass="w-full"
                    inputStyleClass="w-full h-10 px-3.5 pr-10 text-sm rounded-xl border border-slate-300 bg-white shadow-2xs font-medium"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tổng giá trị HĐ (VNĐ)</label>
                  <input type="number" [(ngModel)]="newContractValue" class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300" />
                </div>
              </div>

              <!-- Terms -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Điều khoản & Cam kết SLA</label>
                <textarea
                  [(ngModel)]="newTerms"
                  rows="3"
                  class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500"
                ></textarea>
              </div>
            </div>

            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitCreateContract()"
                [disabled]="isSaving()"
                class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <i class="pi pi-check" [class.animate-spin]="isSaving()"></i>
                {{ isSaving() ? 'Đang tạo...' : 'Ký tạo Hợp đồng' }}
              </button>
            </div>
          </div>
        </div>
      }
  `
})
export class AdminContractsPage implements OnInit {
  private readonly contractsService = inject(AdminContractsService);
  private readonly plansService = inject(AdminPlansService);
  private readonly platformGovernanceService = inject(PlatformGovernanceService, { optional: true });
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  readonly contracts = signal<TenantContractDto[]>([]);
  readonly availablePlans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly tenantOptions = signal<SearchableSelectItem[]>([]);
  readonly loadingTenants = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly showCreateModal = signal(false);

  // Filters
  readonly searchKeyword = signal('');
  readonly statusFilter = signal('ALL');

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
    this.platformGovernanceService.getPlatformTenants().subscribe({
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
    this.contractsService.getAllContracts().subscribe({
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
    this.plansService.getAllPlans().subscribe({
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

    this.contractsService.createContract(req).subscribe({
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
    this.contractsService.updateContractStatus(c.id, {
      status: 'Active',
      note: 'Đã ký số và kích hoạt trực tuyến'
    }).subscribe({
      next: updated => {
        this.contracts.update(list => list.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
        this.alertService.success(`Đã ký điện tử và kích hoạt hợp đồng ${updated.contractNumber || c.contractNumber}!`);
      },
      error: err => {
        this.alertService.error(err.error?.message || 'Lỗi khi ký số');
      }
    });
  }

  terminateContract(c: TenantContractDto): void {
    if (!confirm(`Bạn có chắc chắn muốn chấm dứt hợp đồng ${c.contractNumber}?`)) return;

    this.contractsService.updateContractStatus(c.id, {
      status: 'Terminated',
      note: 'Chấm dứt trước hạn theo yêu cầu của đối tác hoặc quản trị viên'
    }).subscribe({
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
