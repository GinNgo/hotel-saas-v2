import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { AlertService } from '../../core/services/alert.service';
import { AdminSubscriptionPlanDto, CreateSubscriptionPlanRequest, UpdateSubscriptionPlanRequest } from '../../core/models/admin-plan.model';

@Component({
  selector: 'app-admin-plans-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              <i class="pi pi-shield text-[11px]"></i> Platform Administrator
            </span>
            <span class="text-xs text-slate-500">Quản trị Hệ sinh thái SaaS</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Quản lý Gói dịch vụ Tenant (Subscription Plans)
          </h1>
          <p class="text-sm text-slate-600 mt-1">
            Thiết lập hạn ngạch số phòng, chi nhánh cơ sở, tính năng báo cáo và đơn giá thuê phần mềm động.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="loadPlans()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
            Làm mới
          </button>
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <i class="pi pi-plus"></i>
            Tạo gói mới
          </button>
        </div>
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng số gói cước</div>
            <div class="text-2xl font-bold text-slate-900 mt-1">{{ plans().length }}</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
            <i class="pi pi-box"></i>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">Đang kích hoạt</div>
            <div class="text-2xl font-bold text-emerald-600 mt-1">{{ activePlansCount() }}</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
            <i class="pi pi-check-circle"></i>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">Gói nổi bật nhất</div>
            <div class="text-base font-bold text-indigo-700 mt-1 truncate max-w-[180px]">
              {{ popularPlanName() || 'Chưa thiết lập' }}
            </div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
            <i class="pi pi-star-fill"></i>
          </div>
        </div>
      </div>

      <!-- Pricing Plans Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (plan of plans(); track plan.id) {
          <div
            class="relative rounded-2xl border transition-all duration-200 bg-white p-6 flex flex-col justify-between"
            [class.border-indigo-500]="plan.isPopular"
            [class.shadow-md]="plan.isPopular"
            [class.border-slate-200]="!plan.isPopular"
            [class.opacity-60]="!plan.isActive"
          >
            @if (plan.isPopular) {
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                <i class="pi pi-bolt text-[10px]"></i> Gói phổ biến nhất
              </div>
            }

            <div>
              <!-- Top Card Info -->
              <div class="flex items-center justify-between mb-3">
                <span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-slate-100 text-slate-700">
                  {{ plan.code }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-emerald-50]="plan.isActive"
                  [class.text-emerald-700]="plan.isActive"
                  [class.bg-slate-100]="!plan.isActive"
                  [class.text-slate-600]="!plan.isActive"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-500]="plan.isActive" [class.bg-slate-400]="!plan.isActive"></span>
                  {{ plan.isActive ? 'Đang mở' : 'Đã ẩn' }}
                </span>
              </div>

              <h3 class="text-xl font-bold text-slate-900">{{ plan.name }}</h3>
              <p class="text-xs text-slate-500 mt-1 min-h-[36px] line-clamp-2">
                {{ plan.description || 'Chưa có mô tả cho gói này.' }}
              </p>

              <!-- Price Box -->
              <div class="my-5 p-4 rounded-xl bg-slate-50 border border-slate-100/80">
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-black text-slate-900">
                    {{ plan.monthlyPrice | number:'1.0-0' }} ₫
                  </span>
                  <span class="text-xs text-slate-500 font-medium">/ tháng</span>
                </div>
                <div class="text-[11px] text-slate-500 mt-1">
                  Gói năm: <span class="font-semibold text-slate-700">{{ plan.yearlyPrice | number:'1.0-0' }} ₫</span> (Tiết kiệm ~2 tháng)
                </div>
              </div>

              <!-- Quotas -->
              <div class="space-y-2.5 mb-5 pb-5 border-b border-slate-100">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 flex items-center gap-2">
                    <i class="pi pi-home text-indigo-500"></i> Số cơ sở / chi nhánh
                  </span>
                  <span class="font-bold text-slate-900">{{ plan.maxProperties }} cơ sở</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 flex items-center gap-2">
                    <i class="pi pi-th-large text-emerald-500"></i> Giới hạn phòng
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 flex items-center gap-2">
                    <i class="pi pi-users text-amber-500"></i> Tài khoản nhân viên
                  </span>
                  <span class="font-bold text-slate-900">{{ plan.maxStaff }} nhân viên</span>
                </div>
              </div>

              <!-- Features List -->
              <div class="space-y-2 mb-6">
                <div class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Tính năng bao gồm:</div>
                @for (feat of plan.features; track feat) {
                  <div class="flex items-start gap-2 text-xs text-slate-600">
                    <i class="pi pi-check text-emerald-600 mt-0.5 text-[11px]"></i>
                    <span>{{ feat }}</span>
                  </div>
                }
                @if (plan.hasVnPay) {
                  <div class="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                    <i class="pi pi-credit-card text-[11px]"></i>
                    <span>Hỗ trợ Cổng VNPay & VietQR Động</span>
                  </div>
                }
                @if (plan.hasAdvancedReports) {
                  <div class="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                    <i class="pi pi-chart-line text-[11px]"></i>
                    <span>Báo cáo doanh thu & công suất nâng cao</span>
                  </div>
                }
              </div>
            </div>

            <!-- Card Actions -->
            <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                (click)="toggleActive(plan)"
                class="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
                [class.border-slate-200]="plan.isActive"
                [class.text-slate-600]="plan.isActive"
                [class.hover:bg-slate-50]="plan.isActive"
                [class.border-emerald-200]="!plan.isActive"
                [class.text-emerald-700]="!plan.isActive"
                [class.hover:bg-emerald-50]="!plan.isActive"
              >
                {{ plan.isActive ? 'Tạm ẩn gói' : 'Kích hoạt lại' }}
              </button>

              <button
                type="button"
                (click)="openEditModal(plan)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              >
                <i class="pi pi-pencil text-[11px]"></i> Sửa cấu hình
              </button>
            </div>
          </div>
        }
      </div>

      </div>

    <!-- Plan Form Modal (Create / Edit) -->
    @if (showModal()) {
      <div class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 class="text-base sm:text-lg font-bold text-slate-900">
                  {{ isEditing() ? 'Chỉnh sửa Gói: ' + currentEditPlan()?.code : 'Tạo Gói Dịch Vụ Mới' }}
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">Cấu hình thông số hạn mức, giá bán và đặc quyền gói</p>
              </div>
              <button
                type="button"
                (click)="closeModal()"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Mã Gói (Code)</label>
                  <input
                    type="text"
                    [(ngModel)]="formCode"
                    [disabled]="isEditing()"
                    placeholder="VD: STARTER, PRO, VIP"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tên Hiển Thị</label>
                  <input
                    type="text"
                    [(ngModel)]="formName"
                    placeholder="VD: Gói Chuyên Nghiệp"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Giá theo Tháng (VNĐ)</label>
                  <input
                    type="number"
                    [(ngModel)]="formMonthlyPrice"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Giá theo Năm (VNĐ)</label>
                  <input
                    type="number"
                    [(ngModel)]="formYearlyPrice"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Mô Tả Gói</label>
                <textarea
                  [(ngModel)]="formDescription"
                  rows="2"
                  placeholder="Mô tả mục tiêu và đối tượng sử dụng phù hợp..."
                  class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                ></textarea>
              </div>

              <!-- Quotas -->
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div class="text-xs font-bold text-slate-800 uppercase tracking-wider">Hạn mức tài nguyên</div>

                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Số cơ sở (Chi nhánh)</label>
                    <input
                      type="number"
                      [(ngModel)]="formMaxProperties"
                      class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Số phòng tối đa</label>
                    <input
                      type="number"
                      [(ngModel)]="formMaxRooms"
                      class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Số nhân viên</label>
                    <input
                      type="number"
                      [(ngModel)]="formMaxStaff"
                      class="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <!-- Features -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Danh sách tính năng</label>
                <div class="flex gap-2 mb-2">
                  <input
                    type="text"
                    [(ngModel)]="newFeatureInput"
                    (keydown.enter)="addFeature()"
                    placeholder="Nhập tính năng và nhấn Thêm..."
                    class="flex-1 px-3 py-1.5 text-sm rounded-xl border border-slate-300"
                  />
                  <button
                    type="button"
                    (click)="addFeature()"
                    class="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>

                <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  @for (f of formFeatures(); track $index) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white text-slate-700 border border-slate-200 rounded-lg">
                      {{ f }}
                      <button type="button" (click)="removeFeature($index)" class="text-slate-400 hover:text-rose-500 cursor-pointer">
                        <i class="pi pi-times text-[10px]"></i>
                      </button>
                    </span>
                  }
                  @if (formFeatures().length === 0) {
                    <span class="text-xs text-slate-400">Chưa có tính năng nào được thêm.</span>
                  }
                </div>
              </div>

              <!-- Options Checkboxes -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formIsPopular" class="rounded text-indigo-600" />
                  <span>Gói nổi bật</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formHasVnPay" class="rounded text-indigo-600" />
                  <span>Có VNPay</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formHasReports" class="rounded text-indigo-600" />
                  <span>Báo cáo Pro</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formIsActive" class="rounded text-indigo-600" />
                  <span>Kích hoạt ngay</span>
                </label>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeModal()"
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="savePlan()"
                [disabled]="isSaving()"
                class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <i class="pi pi-check" [class.animate-spin]="isSaving()"></i>
                {{ isSaving() ? 'Đang lưu...' : (isEditing() ? 'Cập nhật' : 'Tạo gói') }}
              </button>
            </div>
          </div>
        </div>
      }
  `
})
export class AdminPlansPage implements OnInit {
  private readonly plansService = inject(AdminPlansService);
  private readonly alertService = inject(AlertService);

  readonly plans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly showModal = signal(false);
  readonly isEditing = signal(false);
  readonly currentEditPlan = signal<AdminSubscriptionPlanDto | null>(null);

  // Form Signals
  formCode = '';
  formName = '';
  formMonthlyPrice = 299000;
  formYearlyPrice = 2990000;
  formDescription = '';
  formMaxRooms = 15;
  formMaxProperties = 1;
  formMaxStaff = 3;
  readonly formFeatures = signal<string[]>([]);
  newFeatureInput = '';
  formIsPopular = false;
  formHasVnPay = true;
  formHasReports = false;
  formIsActive = true;

  readonly activePlansCount = computed(() => this.plans().filter(p => p.isActive).length);
  readonly popularPlanName = computed(() => this.plans().find(p => p.isPopular)?.name || '');

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.isLoading.set(true);
    this.plansService.getAllPlans().subscribe({
      next: data => {
        this.plans.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.alertService.error(err.error?.message || 'Không thể tải danh sách gói dịch vụ');
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.currentEditPlan.set(null);
    this.formCode = '';
    this.formName = '';
    this.formMonthlyPrice = 299000;
    this.formYearlyPrice = 2990000;
    this.formDescription = '';
    this.formMaxRooms = 20;
    this.formMaxProperties = 1;
    this.formMaxStaff = 5;
    this.formFeatures.set([
      'Quản lý sơ đồ phòng trực quan',
      'Đặt phòng theo Giờ, Đêm, Ngày',
      'In hóa đơn VietQR tự động'
    ]);
    this.newFeatureInput = '';
    this.formIsPopular = false;
    this.formHasVnPay = true;
    this.formHasReports = false;
    this.formIsActive = true;
    this.showModal.set(true);
  }

  openEditModal(plan: AdminSubscriptionPlanDto): void {
    this.isEditing.set(true);
    this.currentEditPlan.set(plan);
    this.formCode = plan.code;
    this.formName = plan.name;
    this.formMonthlyPrice = plan.monthlyPrice;
    this.formYearlyPrice = plan.yearlyPrice;
    this.formDescription = plan.description || '';
    this.formMaxRooms = plan.maxRooms;
    this.formMaxProperties = plan.maxProperties;
    this.formMaxStaff = plan.maxStaff;
    this.formFeatures.set([...plan.features]);
    this.newFeatureInput = '';
    this.formIsPopular = plan.isPopular;
    this.formHasVnPay = plan.hasVnPay;
    this.formHasReports = plan.hasAdvancedReports;
    this.formIsActive = plan.isActive;
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  addFeature(): void {
    const val = this.newFeatureInput.trim();
    if (val) {
      this.formFeatures.update(f => [...f, val]);
      this.newFeatureInput = '';
    }
  }

  removeFeature(index: number): void {
    this.formFeatures.update(f => f.filter((_, i) => i !== index));
  }

  savePlan(): void {
    if (!this.formName.trim()) {
      this.alertService.error('Vui lòng nhập tên gói dịch vụ');
      return;
    }

    this.isSaving.set(true);
    if (this.isEditing()) {
      const plan = this.currentEditPlan();
      if (!plan) return;
      const req: UpdateSubscriptionPlanRequest = {
        name: this.formName,
        monthlyPrice: this.formMonthlyPrice,
        yearlyPrice: this.formYearlyPrice,
        description: this.formDescription,
        maxRooms: this.formMaxRooms,
        maxProperties: this.formMaxProperties,
        maxStaff: this.formMaxStaff,
        features: this.formFeatures(),
        isPopular: this.formIsPopular,
        sortOrder: plan.sortOrder,
        hasVnPay: this.formHasVnPay,
        hasAdvancedReports: this.formHasReports,
        isActive: this.formIsActive
      };

      this.plansService.updatePlan(plan.id, req).subscribe({
        next: () => {
          this.alertService.success('Đã cập nhật gói dịch vụ thành công!');
          this.isSaving.set(false);
          this.closeModal();
          this.loadPlans();
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Lỗi khi cập nhật gói');
          this.isSaving.set(false);
        }
      });
    } else {
      if (!this.formCode.trim()) {
        this.alertService.error('Vui lòng nhập mã gói');
        this.isSaving.set(false);
        return;
      }
      const req: CreateSubscriptionPlanRequest = {
        code: this.formCode.trim().toUpperCase(),
        name: this.formName,
        monthlyPrice: this.formMonthlyPrice,
        yearlyPrice: this.formYearlyPrice,
        description: this.formDescription,
        maxRooms: this.formMaxRooms,
        maxProperties: this.formMaxProperties,
        maxStaff: this.formMaxStaff,
        features: this.formFeatures(),
        isPopular: this.formIsPopular,
        sortOrder: this.plans().length + 1,
        hasVnPay: this.formHasVnPay,
        hasAdvancedReports: this.formHasReports,
        isActive: this.formIsActive
      };

      this.plansService.createPlan(req).subscribe({
        next: () => {
          this.alertService.success('Đã tạo mới gói dịch vụ thành công!');
          this.isSaving.set(false);
          this.closeModal();
          this.loadPlans();
        },
        error: err => {
          this.alertService.error(err.error?.message || 'Lỗi khi tạo gói mới');
          this.isSaving.set(false);
        }
      });
    }
  }

  toggleActive(plan: AdminSubscriptionPlanDto): void {
    this.plansService.toggleActive(plan.id).subscribe({
      next: updated => {
        this.plans.update(list => list.map(p => (p.id === updated.id ? updated : p)));
        this.alertService.success(
          updated.isActive
            ? `Đã kích hoạt lại gói ${updated.name}`
            : `Đã tạm ẩn gói ${updated.name}`
        );
      },
      error: err => {
        this.alertService.error(err.error?.message || 'Không thể đổi trạng thái gói');
      }
    });
  }
}
