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
import { AdminPlansService } from '../../core/services/admin-plans.service';
import { AlertService } from '../../core/services/alert.service';
import { AdminSubscriptionPlanDto, CreateSubscriptionPlanRequest, UpdateSubscriptionPlanRequest } from '../../core/models/admin-plan.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { VndCurrencyPipe } from '../../shared/pipes/vnd-currency.pipe';

@Component({
  selector: 'app-admin-plans-page',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, PageHeaderComponent, VndCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">
      <!-- Header -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
            <i class="pi pi-shield text-xs" aria-hidden="true"></i> Platform Administrator
          </span>
          <span class="text-xs text-slate-600 dark:text-slate-400">Quản trị Hệ sinh thái SaaS</span>
        </div>

        <app-page-header
          title="Quản lý Gói dịch vụ Tenant (Subscription Plans)"
          subtitle="Thiết lập hạn ngạch số phòng, chi nhánh cơ sở, tính năng báo cáo và đơn giá thuê phần mềm động."
        >
          <button
            type="button"
            (click)="loadPlans()"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            (click)="openCreateModal()"
            class="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
            <span>Tạo gói mới</span>
          </button>
        </app-page-header>
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng số gói cước</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{{ plans().length }}</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-lg">
            <i class="pi pi-box" aria-hidden="true"></i>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang kích hoạt</div>
            <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{{ activePlansCount() }}</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-lg">
            <i class="pi pi-check-circle" aria-hidden="true"></i>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gói nổi bật nhất</div>
            <div class="text-base font-bold text-indigo-700 dark:text-indigo-300 mt-1 truncate max-w-[180px]">
              {{ popularPlanName() || 'Chưa thiết lập' }}
            </div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-lg">
            <i class="pi pi-star-fill" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- Pricing Plans Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (plan of plans(); track plan.id) {
          <div
            class="relative rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between"
            [class.border-indigo-500]="plan.isPopular"
            [class.shadow-md]="plan.isPopular"
            [class.border-slate-200]="!plan.isPopular"
            [class.dark:border-slate-700]="!plan.isPopular"
            [class.opacity-60]="!plan.isActive"
          >
            @if (plan.isPopular) {
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                <i class="pi pi-bolt text-xs" aria-hidden="true"></i> Gói phổ biến nhất
              </div>
            }

            <div>
              <!-- Top Card Info -->
              <div class="flex items-center justify-between mb-3">
                <span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {{ plan.code }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-emerald-50]="plan.isActive"
                  [class.text-emerald-700]="plan.isActive"
                  [class.bg-slate-100]="!plan.isActive"
                  [class.text-slate-600]="!plan.isActive"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-500]="plan.isActive" [class.bg-slate-400]="!plan.isActive" aria-hidden="true"></span>
                  {{ plan.isActive ? 'Đang mở' : 'Đã ẩn' }}
                </span>
              </div>

              <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ plan.name }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[36px] line-clamp-2">
                {{ plan.description || 'Chưa có mô tả cho gói này.' }}
              </p>

              <!-- Price Box -->
              <div class="my-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100/80 dark:border-slate-700">
                <div class="flex items-baseline gap-1 tabular-nums">
                  <span class="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {{ plan.monthlyPrice | vndCurrency }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">/ tháng</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  Gói năm: <span class="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{{ plan.yearlyPrice | vndCurrency }}</span> (Tiết kiệm ~2 tháng)
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>Tenant đang dùng: <strong class="text-indigo-700 dark:text-indigo-300">{{ plan.activeTenantsCount ?? 0 }}</strong></span>
                  <span>MRR ước tính: <strong class="text-emerald-700 dark:text-emerald-400 tabular-nums">{{ (plan.estimatedMonthlyRevenue ?? 0) | vndCurrency }}</strong></span>
                </div>
              </div>

              <!-- Quotas -->
              <div class="space-y-2.5 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800 tabular-nums">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <i class="pi pi-home text-indigo-500" aria-hidden="true"></i> Số cơ sở / chi nhánh
                  </span>
                  <span class="font-bold text-slate-900 dark:text-slate-100">{{ plan.maxProperties >= 999 ? 'Không giới hạn' : plan.maxProperties + ' cơ sở' }}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <i class="pi pi-th-large text-emerald-500" aria-hidden="true"></i> Giới hạn phòng
                  </span>
                  <span class="font-bold text-slate-900 dark:text-slate-100">
                    {{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <i class="pi pi-users text-amber-500" aria-hidden="true"></i> Tài khoản nhân viên
                  </span>
                  <span class="font-bold text-slate-900 dark:text-slate-100">{{ plan.maxStaff >= 999 ? 'Không giới hạn' : plan.maxStaff + ' nhân viên' }}</span>
                </div>
              </div>

              <!-- Features List -->
              <div class="space-y-2 mb-6">
                <div class="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Tính năng bao gồm:</div>
                @for (feat of plan.features; track feat) {
                  <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <i class="pi pi-check text-emerald-600 dark:text-emerald-400 mt-0.5 text-xs" aria-hidden="true"></i>
                    <span>{{ feat }}</span>
                  </div>
                }
                @if (plan.hasVnPay) {
                  <div class="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    <i class="pi pi-credit-card text-xs" aria-hidden="true"></i>
                    <span>Hỗ trợ Cổng VNPay &amp; VietQR Động</span>
                  </div>
                }
                @if (plan.hasAdvancedReports) {
                  <div class="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    <i class="pi pi-chart-line text-xs" aria-hidden="true"></i>
                    <span>Báo cáo doanh thu &amp; công suất nâng cao</span>
                  </div>
                }
              </div>
            </div>

            <!-- Card Actions -->
            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                (click)="toggleActive(plan)"
                class="min-h-11 text-xs font-medium px-3.5 py-2 rounded-xl border transition-colors cursor-pointer"
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
                class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
              >
                <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                <span>Sửa cấu hình</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Plan Form Modal (Create / Edit) -->
    @if (showModal()) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="closeModal()"
        (click)="closeModal()"
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[65] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
      >
          <div
            (click)="$event.stopPropagation()"
            class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
          >
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 id="plan-modal-title" class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {{ isEditing() ? 'Chỉnh sửa Gói: ' + currentEditPlan()?.code : 'Tạo Gói Dịch Vụ Mới' }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cấu hình thông số hạn mức, giá bán và đặc quyền gói</p>
              </div>
              <button
                type="button"
                (click)="closeModal()"
                aria-label="Đóng cửa sổ cấu hình gói dịch vụ"
                class="min-w-11 min-h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="plan-code-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã Gói (Code)</label>
                  <input
                    id="plan-code-input"
                    type="text"
                    [(ngModel)]="formCode"
                    [disabled]="isEditing()"
                    placeholder="VD: STARTER, PRO, VIP"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label for="plan-name-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tên Hiển Thị</label>
                  <input
                    id="plan-name-input"
                    type="text"
                    [(ngModel)]="formName"
                    placeholder="VD: Gói Chuyên Nghiệp"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="plan-monthly-price" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giá theo Tháng (VNĐ)</label>
                  <input
                    id="plan-monthly-price"
                    type="number"
                    [(ngModel)]="formMonthlyPrice"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
                <div>
                  <label for="plan-yearly-price" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giá theo Năm (VNĐ)</label>
                  <input
                    id="plan-yearly-price"
                    type="number"
                    [(ngModel)]="formYearlyPrice"
                    class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label for="plan-description" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mô Tả Gói</label>
                <textarea
                  id="plan-description"
                  [(ngModel)]="formDescription"
                  rows="2"
                  placeholder="Mô tả mục tiêu và đối tượng sử dụng phù hợp..."
                  class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                ></textarea>
              </div>

              <!-- Quotas -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-4">
                <div class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Hạn mức tài nguyên</div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label for="plan-max-props" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Số cơ sở (Chi nhánh)</label>
                    <input
                      id="plan-max-props"
                      type="number"
                      [(ngModel)]="formMaxProperties"
                      class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                  <div>
                    <label for="plan-max-rooms" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Số phòng tối đa</label>
                    <input
                      id="plan-max-rooms"
                      type="number"
                      [(ngModel)]="formMaxRooms"
                      class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                  <div>
                    <label for="plan-max-staff" class="block text-xs text-slate-600 dark:text-slate-300 mb-1">Số nhân viên</label>
                    <input
                      id="plan-max-staff"
                      type="number"
                      [(ngModel)]="formMaxStaff"
                      class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <!-- Features -->
              <div>
                <label for="plan-new-feature" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Danh sách tính năng</label>
                <div class="flex gap-2 mb-2">
                  <input
                    id="plan-new-feature"
                    type="text"
                    [(ngModel)]="newFeatureInput"
                    (keydown.enter)="addFeature()"
                    placeholder="Nhập tính năng và nhấn Thêm..."
                    class="flex-1 min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    (click)="addFeature()"
                    class="min-h-11 px-4 py-2 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>

                <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  @for (f of formFeatures(); track $index) {
                    <span class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span>{{ f }}</span>
                      <button
                        type="button"
                        (click)="removeFeature($index)"
                        [attr.aria-label]="'Xóa tính năng ' + f"
                        class="min-w-11 min-h-11 -my-2 inline-flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <i class="pi pi-times text-xs" aria-hidden="true"></i>
                      </button>
                    </span>
                  }
                  @if (formFeatures().length === 0) {
                    <span class="text-xs text-slate-400 p-1">Chưa có tính năng nào được thêm.</span>
                  }
                </div>
              </div>

              <!-- Options Checkboxes -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label class="flex items-center gap-2 min-h-11 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formIsPopular" class="w-4 h-4 rounded text-indigo-600" />
                  <span>Gói nổi bật</span>
                </label>
                <label class="flex items-center gap-2 min-h-11 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formHasVnPay" class="w-4 h-4 rounded text-indigo-600" />
                  <span>Có VNPay</span>
                </label>
                <label class="flex items-center gap-2 min-h-11 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formHasReports" class="w-4 h-4 rounded text-indigo-600" />
                  <span>Báo cáo Pro</span>
                </label>
                <label class="flex items-center gap-2 min-h-11 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formIsActive" class="w-4 h-4 rounded text-indigo-600" />
                  <span>Kích hoạt ngay</span>
                </label>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeModal()"
                class="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="savePlan()"
                [disabled]="isSaving()"
                class="min-h-11 inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <i class="pi pi-check" [class.animate-spin]="isSaving()" aria-hidden="true"></i>
                <span>{{ isSaving() ? 'Đang lưu...' : (isEditing() ? 'Cập nhật' : 'Tạo gói') }}</span>
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
  private readonly destroyRef = inject(DestroyRef);

  readonly plans = signal<AdminSubscriptionPlanDto[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly showModal = signal(false);
  readonly isEditing = signal(false);
  readonly currentEditPlan = signal<AdminSubscriptionPlanDto | null>(null);

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

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showModal() && !this.isSaving()) {
      this.closeModal();
    }
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.isLoading.set(true);
    this.plansService
      .getAllPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

      this.plansService
        .updatePlan(plan.id, req)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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

      this.plansService
        .createPlan(req)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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
    this.plansService
      .toggleActive(plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
