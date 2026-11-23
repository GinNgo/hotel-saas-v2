import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { PolicyService } from '../../core/services/policy.service';
import {
  PropertyPoliciesDto,
  SurchargePolicyDto,
  SurchargeType,
  SURCHARGE_TYPE_LABELS,
  SurchargeCalculationMethod,
  SURCHARGE_CALCULATION_METHOD_LABELS,
  UpdatePropertyPoliciesRequest,
  UpdateSurchargeItemRequest,
  POL_C03_CANCELLATION_TIERS
} from '../../core/models/policy.model';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintTemplateConfigDto } from '../../core/models/print-document.model';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ContextSelectorDialogComponent } from '../auth/context-selector/context-selector.dialog';

interface SurchargeFormValue {
  id?: string | null;
  surchargeType: SurchargeType;
  fromTime: string;
  toTime: string;
  calculationMethod: SurchargeCalculationMethod;
  percentage: number | null;
  flatAmount: number | null;
  isActive: boolean;
}

interface ErrorWithMessage {
  message?: string;
  error?: {
    message?: string;
    title?: string;
  } | null;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, ContextSelectorDialogComponent],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Chính sách & Quy tắc Vận hành</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Chi nhánh
            </span>
            @if (!canUpdate()) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Chỉ đọc (Read-Only)
              </span>
            }
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Cấu hình thời gian check-in/out, thời gian đệm dọn phòng và các khung giờ phụ thu nhận sớm/trả muộn.
          </p>
        </div>

        <!-- Top Actions -->
        <div class="flex items-center gap-2">
          <!-- Chi nhánh hiện tại -->
          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 text-xs text-slate-600 font-medium border border-slate-200/70">
            <i class="pi pi-building text-emerald-600"></i>
            <span>{{ authService.activePropertyName() || 'Chưa chọn chi nhánh' }}</span>
          </div>

          <!-- Timezone Indicator -->
          <div class="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/60 text-[11px] text-slate-500 border border-slate-200/60" title="Múi giờ Asia/Ho_Chi_Minh">
            <i class="pi pi-clock text-slate-400"></i>
            <span>UTC+7</span>
          </div>

          <!-- Nút Lưu -->
          @if (canUpdate()) {
            <button
              type="button"
              (click)="savePolicies()"
              [disabled]="isSaving() || isLoading() || !propertyId() || loadedPropertyId() !== propertyId()"
              aria-label="Lưu thay đổi chính sách"
              title="Lưu thay đổi chính sách"
              class="inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              @if (isSaving()) {
                <i class="pi pi-spin pi-spinner text-sm"></i>
                <span>Đang lưu...</span>
              } @else {
                <i class="pi pi-check text-sm"></i>
                <span>Lưu thay đổi</span>
              }
            </button>
          }
        </div>
      </div>

      <!-- Không có quyền hoặc chưa chọn chi nhánh -->
      @if (!canRead()) {
        <app-empty-state
          iconClass="pi pi-lock"
          title="Không có quyền truy cập"
          description="Bạn không có quyền xem cấu hình chính sách chi nhánh (yêu cầu quyền PROPERTIES.Read)."
        />
      } @else if (!propertyId()) {
        <app-empty-state
          iconClass="pi pi-building"
          title="Chưa chọn chi nhánh làm việc"
          description="Vui lòng chọn chi nhánh làm việc để xem và cấu hình chính sách vận hành của cơ sở."
          actionLabel="Chọn chi nhánh làm việc"
          actionIcon="pi pi-building"
          (actionClick)="openContextSelector()"
        />
      } @else if (isLoading()) {
        <!-- Skeleton Loading State -->
        <div class="space-y-6 animate-pulse motion-reduce:animate-none">
          <div class="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div class="h-5 w-48 bg-slate-200 rounded"></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div class="h-16 bg-slate-100 rounded-xl"></div>
              <div class="h-16 bg-slate-100 rounded-xl"></div>
              <div class="h-16 bg-slate-100 rounded-xl"></div>
              <div class="h-16 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div class="h-5 w-64 bg-slate-200 rounded"></div>
            <div class="h-32 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      } @else if (errorMessage()) {
        <!-- Error State -->
        <div role="alert" class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
          <div class="flex items-center gap-2.5">
            <i class="pi pi-exclamation-triangle text-xl text-rose-600"></i>
            <h3 class="font-bold text-sm">Không thể tải cấu hình chính sách chi nhánh</h3>
          </div>
          <p class="text-xs text-rose-700 leading-relaxed">{{ errorMessage() }}</p>
          <button
            type="button"
            (click)="loadPolicies()"
            aria-label="Thử tải lại chính sách"
            class="inline-flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <i class="pi pi-refresh"></i>
            <span>Thử lại</span>
          </button>
        </div>
      } @else {
        <!-- Form Content -->
        <form [formGroup]="policyForm" class="space-y-6">
          <!-- Client Validation Alert -->
          @if (clientErrors().length > 0) {
            <div role="alert" class="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1">
              <div class="font-bold flex items-center gap-2 text-amber-800">
                <i class="pi pi-exclamation-circle text-amber-600"></i>
                <span>Vui lòng kiểm tra lại thông tin:</span>
              </div>
              <ul class="list-disc pl-5 space-y-0.5">
                @for (err of clientErrors(); track $index) {
                  <li>{{ err }}</li>
                }
              </ul>
            </div>
          }

          <!-- Block 1: Giờ nhận/trả phòng & Thời gian vận hành -->
          <div class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-calendar-times"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-800">Khung giờ nhận / trả phòng & Vận hành</h2>
                  <p class="text-[11px] text-slate-400">Áp dụng cho đặt phòng lưu trú qua đêm và tính phụ thu</p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <!-- Giờ nhận phòng -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Giờ nhận phòng tiêu chuẩn <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="time"
                    formControlName="checkInTime"
                    [readonly]="!canUpdate()"
                    aria-label="Giờ nhận phòng tiêu chuẩn"
                    title="Giờ nhận phòng tiêu chuẩn"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all font-mono"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Mặc định: 12:00 (Asia/Ho_Chi_Minh)</p>
              </div>

              <!-- Giờ trả phòng -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Giờ trả phòng tiêu chuẩn <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="time"
                    formControlName="checkOutTime"
                    [readonly]="!canUpdate()"
                    aria-label="Giờ trả phòng tiêu chuẩn"
                    title="Giờ trả phòng tiêu chuẩn"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all font-mono"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Mặc định: 12:00 (Asia/Ho_Chi_Minh)</p>
              </div>

              <!-- Thời gian đệm dọn phòng (bufferMinutes) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Thời gian đệm dọn phòng (phút) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="number"
                    min="30"
                    step="5"
                    formControlName="bufferMinutes"
                    [readonly]="!canUpdate()"
                    aria-label="Thời gian đệm dọn phòng (phút)"
                    title="Thời gian đệm dọn phòng (phút)"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Tối thiểu: 30 phút (Turnover buffer)</p>
              </div>

              <!-- Giới hạn thuê theo giờ (maxHourlyHours) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Giới hạn thuê theo giờ (giờ) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="1"
                    formControlName="maxHourlyHours"
                    [readonly]="!canUpdate()"
                    aria-label="Giới hạn thuê theo giờ (giờ)"
                    title="Giới hạn thuê theo giờ (giờ)"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Quyết định D14: Từ 1 đến 24 giờ</p>
              </div>

              <!-- Thuế VAT (%) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Thuế VAT (%) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    formControlName="taxRatePercent"
                    [readonly]="!canUpdate()"
                    aria-label="Thuế VAT phần trăm"
                    title="Thuế VAT (%)"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Áp dụng xuất hóa đơn điện tử / in hóa đơn (0% – 100%)</p>
              </div>

              <!-- Phí dịch vụ (%) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Phí dịch vụ (%) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    formControlName="serviceFeeRatePercent"
                    [readonly]="!canUpdate()"
                    aria-label="Phí dịch vụ phần trăm"
                    title="Phí dịch vụ (%)"
                    class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 transition-all"
                  />
                </div>
                <p class="text-[10px] text-slate-400">Service charge trích trên hóa đơn thanh toán (0% – 100%)</p>
              </div>
            </div>
          </div>

          <!-- Block 2: Danh sách Phụ thu Nhận sớm / Trả muộn -->
          <div class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-percentage"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-800">Quy tắc Phụ thu (Early Check-In & Late Check-Out)</h2>
                  <p class="text-[11px] text-slate-400">Tự động cộng thêm phụ thu khi khách check-in sớm hoặc check-out muộn (hỗ trợ đủ khung 24/24)</p>
                </div>
              </div>

              @if (canUpdate()) {
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    (click)="applyFull24hSurchargePreset()"
                    aria-label="Nạp nhanh biểu phí phụ thu 24/24 tiêu chuẩn"
                    title="Tự động điền 6 khung phụ thu nhận sớm / trả muộn phủ đủ 24/24"
                    class="inline-flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-bolt text-xs"></i>
                    <span>Nạp chuẩn 24/24</span>
                  </button>
                  <button
                    type="button"
                    (click)="addSurcharge()"
                    aria-label="Thêm khung phụ thu"
                    title="Thêm khung phụ thu"
                    class="inline-flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-plus text-xs"></i>
                    <span>Thêm khung phụ thu</span>
                  </button>
                </div>
              }
            </div>

            <!-- Surcharges List -->
            @if (surchargesArray.length === 0) {
              <div class="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <i class="pi pi-info-circle text-slate-400 text-xl mb-1.5"></i>
                <p class="text-xs text-slate-500 font-medium">Chưa cấu hình khung giờ phụ thu nào</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Nhấn "Thêm khung phụ thu" để thiết lập mức phụ thu nhận sớm hoặc trả muộn.</p>
              </div>
            } @else {
              <div class="space-y-3" formArrayName="surcharges">
                @for (item of surchargesArray.controls; track $index) {
                  <div
                    [formGroupName]="$index"
                    class="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-3"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center tabular-nums">
                          {{ $index + 1 }}
                        </span>
                        <span class="text-xs font-bold text-slate-700 tabular-nums">
                          Khung quy tắc #{{ $index + 1 }}
                        </span>
                      </div>

                      <div class="flex items-center gap-3">
                        <!-- Active Checkbox -->
                        <label class="inline-flex items-center gap-1.5 min-h-11 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            formControlName="isActive"
                            [disabled]="!canUpdate()"
                            aria-label="Kích hoạt quy tắc phụ thu"
                            title="Kích hoạt quy tắc phụ thu"
                            class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span class="text-[11px] font-medium">Kích hoạt</span>
                        </label>

                        @if (canUpdate()) {
                          <button
                            type="button"
                            (click)="removeSurcharge($index)"
                            class="min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa quy tắc này"
                            aria-label="Xóa quy tắc phụ thu này"
                          >
                            <i class="pi pi-trash text-xs"></i>
                          </button>
                        }
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                      <!-- Loại phụ thu -->
                      <div class="space-y-1">
                        <label class="block text-[11px] font-medium text-slate-600">Loại phụ thu</label>
                        <select
                          formControlName="surchargeType"
                          [disabled]="!canUpdate()"
                          aria-label="Loại phụ thu"
                          title="Loại phụ thu"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option [ngValue]="1">Nhận sớm (Early Check-In)</option>
                          <option [ngValue]="2">Trả muộn (Late Check-Out)</option>
                        </select>
                      </div>

                      <!-- Từ giờ -->
                      <div class="space-y-1">
                        <label class="block text-[11px] font-medium text-slate-600">Từ giờ</label>
                        <input
                          type="time"
                          formControlName="fromTime"
                          [readonly]="!canUpdate()"
                          aria-label="Từ giờ"
                          title="Từ giờ"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <!-- Đến giờ -->
                      <div class="space-y-1">
                        <label class="block text-[11px] font-medium text-slate-600">Đến giờ</label>
                        <input
                          type="time"
                          formControlName="toTime"
                          [readonly]="!canUpdate()"
                          aria-label="Đến giờ"
                          title="Đến giờ"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <!-- Phương thức tính -->
                      <div class="space-y-1">
                        <label class="block text-[11px] font-medium text-slate-600">Cách tính</label>
                        <select
                          formControlName="calculationMethod"
                          [disabled]="!canUpdate()"
                          aria-label="Phương thức tính phụ thu"
                          title="Phương thức tính phụ thu"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option [ngValue]="1">% Giá đêm phòng</option>
                          <option [ngValue]="2">Số tiền cố định (VND)</option>
                        </select>
                      </div>

                      <!-- Giá trị phụ thu -->
                      <div class="space-y-1">
                        <label class="block text-[11px] font-medium text-slate-600">
                          @if (item.get('calculationMethod')?.value === 1) {
                            Mức phụ thu (%)
                          } @else {
                            Số tiền (VND)
                          }
                        </label>
                        @if (item.get('calculationMethod')?.value === 1) {
                          <div class="relative">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              formControlName="percentage"
                              [readonly]="!canUpdate()"
                              placeholder="30"
                              aria-label="Mức phụ thu theo phần trăm"
                              title="Mức phụ thu theo phần trăm"
                              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <span class="absolute right-2.5 top-1.5 text-xs text-slate-400 font-semibold">%</span>
                          </div>
                        } @else {
                          <div class="relative">
                            <input
                              type="number"
                              min="0"
                              step="10000"
                              formControlName="flatAmount"
                              [readonly]="!canUpdate()"
                              placeholder="100000"
                              aria-label="Mức phụ thu theo số tiền cố định"
                              title="Mức phụ thu theo số tiền cố định"
                              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <span class="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-medium">đ</span>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Block 2b: Chính sách hủy phòng bậc thang POL-C03 & Tiền cọc 30% -->
          <div class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-shield"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-800">Chính sách Hủy phòng bậc thang (POL-C03) & Đặt cọc 30%</h2>
                  <p class="text-[11px] text-slate-400">Hệ thống áp dụng tỷ lệ giữ chỗ tối thiểu 30% tổng giá trị đơn và tự động tính phí hủy theo mốc thời gian trước giờ Check-in</p>
                </div>
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Cọc chuẩn: 30%
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              @for (tier of cancellationTiers; track tier.windowLabel) {
                <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div class="text-xs font-bold text-slate-800">{{ tier.windowLabel }}</div>
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-rose-700">{{ tier.feeRateLabel }}</span>
                    <span class="font-semibold text-emerald-700">{{ tier.refundRateLabel }}</span>
                  </div>
                  <p class="text-[11px] text-slate-500 leading-relaxed">{{ tier.description }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Bottom Save Actions -->
          @if (canUpdate()) {
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                (click)="loadPolicies()"
                [disabled]="isSaving() || isLoading() || !propertyId()"
                aria-label="Hủy thay đổi và tải lại"
                title="Hủy thay đổi và tải lại"
                class="min-h-11 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                (click)="savePolicies()"
                [disabled]="isSaving() || isLoading() || !propertyId() || loadedPropertyId() !== propertyId()"
                aria-label="Lưu thay đổi chính sách"
                title="Lưu thay đổi chính sách"
                class="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                @if (isSaving()) {
                  <i class="pi pi-spin pi-spinner text-sm"></i>
                  <span>Đang lưu chính sách...</span>
                } @else {
                  <i class="pi pi-check text-sm"></i>
                  <span>Lưu thay đổi chính sách</span>
                }
              </button>
            </div>
          }
        </form>

        <!-- Block 3: Cấu hình Mẫu In Hóa đơn, Phiếu Xác nhận & Tài khoản VietQR -->
        @if (printConfigForm) {
          <form [formGroup]="printConfigForm" (ngSubmit)="savePrintTemplateConfig()" class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-print"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-800">Cấu hình Mẫu In Hóa đơn, Voucher & VietQR</h2>
                  <p class="text-[11px] text-slate-400">Thông tin pháp nhân, ngân hàng thụ hưởng tạo mã QR tự động và khổ giấy máy in thu ngân (A4 / K80)</p>
                </div>
              </div>

              @if (canUpdate()) {
                <button
                  type="submit"
                  [disabled]="isSavingPrintConfig()"
                  aria-label="Lưu mẫu in hóa đơn và tài khoản VietQR"
                  class="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  @if (isSavingPrintConfig()) {
                    <i class="pi pi-spin pi-spinner text-xs"></i>
                    <span>Đang lưu mẫu in...</span>
                  } @else {
                    <i class="pi pi-save text-xs"></i>
                    <span>Lưu mẫu in & VietQR</span>
                  }
                </button>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="sm:col-span-2 space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Tên đơn vị / Khách sạn in trên đầu phiếu</label>
                <input
                  type="text"
                  formControlName="headerCompanyName"
                  placeholder="VD: Khách sạn Grand Hotel Sài Gòn"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Mã số thuế</label>
                <input
                  type="text"
                  formControlName="taxNumber"
                  placeholder="0318928374"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Hotline lễ tân / CSKH</label>
                <input
                  type="text"
                  formControlName="hotline"
                  placeholder="1900 6868"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="sm:col-span-3 space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Địa chỉ in trên hóa đơn</label>
                <input
                  type="text"
                  formControlName="headerAddress"
                  placeholder="123 Đồng Khởi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Khổ giấy in mặc định</label>
                <select
                  formControlName="defaultPaperSize"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="A4">Khổ tiêu chuẩn A4</option>
                  <option value="K80">Khổ nhiệt thu ngân K80 (80mm)</option>
                </select>
              </div>
            </div>

            <!-- VietQR & SePay Banking Info -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-4">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <i class="pi pi-qrcode text-indigo-600 dark:text-indigo-400"></i>
                  <span>Tài khoản Ngân hàng tích hợp mã thanh toán VietQR &amp; SePay tự động</span>
                </span>
                <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    formControlName="showVietQrCode"
                    class="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>In mã VietQR lên hóa đơn</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="space-y-1">
                  <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-300">Ngân hàng (Mã BIN / Tên NH)</label>
                  <input
                    type="text"
                    formControlName="bankName"
                    list="vietqr-banks-list"
                    placeholder="MBBank, Vietcombank, ACB..."
                    class="w-full min-h-11 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                  />
                  <datalist id="vietqr-banks-list">
                    @for (bank of supportedVietQrBanks; track bank) {
                      <option [value]="bank">{{ bank }}</option>
                    }
                  </datalist>
                </div>
                <div class="space-y-1">
                  <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-300">Số tài khoản nhận tiền</label>
                  <input
                    type="text"
                    formControlName="bankAccountNumber"
                    placeholder="999988887777"
                    class="w-full min-h-11 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-indigo-900 dark:text-indigo-300"
                  />
                </div>
                <div class="space-y-1">
                  <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-300">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    formControlName="bankAccountHolder"
                    placeholder="CTY CP KHACH SAN..."
                    class="w-full min-h-11 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs uppercase font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <!-- Per-Property SePay Webhook API Key & Ready-to-Copy Webhook URL -->
              <div class="pt-3 border-t border-slate-200/80 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <label for="sepay-api-key-input" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      SePay Webhook API Key riêng của cơ sở (Tùy chọn)
                    </label>
                    @if (hasSepayApiKey()) {
                      <span
                        data-testid="sepay-key-status-badge"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        <i class="pi pi-check-circle text-[9px]"></i>
                        <span>Đã cấu hình Key riêng</span>
                      </span>
                    } @else {
                      <span
                        data-testid="sepay-key-status-badge"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        <i class="pi pi-globe text-[9px]"></i>
                        <span>Dùng cổng SePay chung toàn hệ thống</span>
                      </span>
                    }
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="relative flex-1 min-w-0">
                      <input
                        id="sepay-api-key-input"
                        data-testid="sepay-api-key-input"
                        [type]="showSepayApiKey() ? 'text' : 'password'"
                        formControlName="sepayApiKey"
                        (input)="onSepayApiKeyInput()"
                        placeholder="Để trống nếu dùng SePay API Key chung hoặc nhập Key riêng của chi nhánh..."
                        autocomplete="off"
                        class="w-full min-h-11 pl-3 pr-11 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        data-testid="toggle-sepay-key-visibility-btn"
                        (click)="toggleSepayApiKeyVisibility()"
                        [attr.aria-label]="showSepayApiKey() ? 'Ẩn SePay API Key' : 'Hiện SePay API Key'"
                        class="min-h-11 min-w-11 absolute right-0 top-0 bottom-0 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <i class="pi text-xs" [ngClass]="showSepayApiKey() ? 'pi-eye-slash' : 'pi-eye'"></i>
                      </button>
                    </div>

                    @if (hasSepayApiKey() || printConfigForm.get('sepayApiKey')?.value) {
                      <button
                        type="button"
                        data-testid="clear-sepay-api-key-btn"
                        (click)="clearSepayApiKey()"
                        class="min-h-11 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        Xóa Key riêng
                      </button>
                    }
                  </div>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400">
                    Mỗi cơ sở có thể dùng tài khoản ngân hàng &amp; SePay API Key độc lập. Nếu để trống, hệ thống tự động đối chiếu bằng Key mặc định.
                  </p>
                </div>

                <!-- Ready-to-Copy Webhook URL Card -->
                <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/70 space-y-2 flex flex-col justify-between">
                  <div class="space-y-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[11px] font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <i class="pi pi-link text-indigo-600 dark:text-indigo-400 text-xs"></i>
                        <span>Địa chỉ nhận SePay Webhook của cơ sở này</span>
                      </span>
                      @if (isWebhookUrlCopied()) {
                        <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Đã sao chép!</span>
                      }
                    </div>
                    <div class="flex items-center gap-2">
                      <code
                        data-testid="sepay-webhook-url-code"
                        class="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-indigo-900 dark:text-indigo-300 break-all select-all border border-slate-200/70 dark:border-slate-700"
                      >{{ sepayWebhookUrl() }}</code>
                      <button
                        type="button"
                        data-testid="copy-sepay-webhook-url-btn"
                        (click)="copySepayWebhookUrl()"
                        class="min-h-11 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <i class="pi text-xs" [ngClass]="isWebhookUrlCopied() ? 'pi-check text-emerald-600' : 'pi-copy'"></i>
                        <span>Sao chép URL Webhook</span>
                      </button>
                    </div>
                  </div>
                  <p class="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
                    Cài trên SePay Dashboard -&gt; Webhooks: Sự kiện Tiền vào (In) | Chứng thực: API Key | JSON
                  </p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Lưu ý quy định Check-in trên Voucher</label>
                <input
                  type="text"
                  formControlName="checkInPolicyText"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-700">Lời cảm ơn chân trang Hóa đơn</label>
                <input
                  type="text"
                  formControlName="footerNote"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                />
              </div>
            </div>
          </form>
        }
      }
    </div>

    @if (showContextSelector()) {
      <app-context-selector-dialog
        [visible]="showContextSelector()"
        (visibleChange)="showContextSelector.set($event)"
      />
    }
  `
})
export class PoliciesPage implements OnInit, OnDestroy, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly policyService = inject(PolicyService);
  private readonly alertService = inject(AlertService);
  private readonly printService = inject(PrintDocumentsService, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  private fallbackDestroyCallbacks: Array<() => void> = [];
  private isFallbackDestroyed = false;
  private readonly destroyRef = inject(DestroyRef, { optional: true }) ?? this.createFallbackDestroyRef();

  readonly showContextSelector = signal(false);
  openContextSelector(): void {
    this.showContextSelector.set(true);
  }

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isSavingPrintConfig = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly clientErrors = signal<string[]>([]);
  readonly loadedPropertyId = signal<string | null>(null);

  readonly propertyId = computed(() => this.authService.activePropertyId());
  readonly canRead = computed(() => this.authService.hasPermission('PROPERTIES', 1));
  readonly canUpdate = computed(() => this.authService.hasPermission('PROPERTIES', 4));
  readonly cancellationTiers = POL_C03_CANCELLATION_TIERS;
  readonly supportedVietQrBanks: readonly string[] = [
    'MBBank',
    'Vietcombank',
    'VietinBank',
    'BIDV',
    'ACB',
    'Techcombank',
    'VPBank',
    'TPBank',
    'Sacombank',
    'VIB',
    'HDBank',
    'MSB',
    'OCB',
    'SHB',
    'SeABank',
    'Eximbank',
    'Agribank'
  ];

  readonly showSepayApiKey = signal(false);
  readonly hasSepayApiKey = signal(false);
  readonly isWebhookUrlCopied = signal(false);
  private webhookCopyTimer?: ReturnType<typeof setTimeout>;

  readonly webhookOrigin = computed(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost';
  });

  readonly sepayWebhookUrl = computed(() => {
    const propId = this.propertyId();
    const origin = this.webhookOrigin();
    return propId ? `${origin}/api/webhooks/sepay/${propId}` : `${origin}/api/webhooks/sepay`;
  });

  policyForm!: FormGroup;
  printConfigForm!: FormGroup;

  private loadSub?: Subscription;
  private saveSub?: Subscription;
  private printLoadSub?: Subscription;
  private printSaveSub?: Subscription;

  constructor() {
    this.initForm();
    try {
      effect(() => {
        const propId = this.propertyId();
        untracked(() => {
          this.handlePropertyContextChange(propId);
        });
      });
    } catch {
      // In isolated unit tests with plain Injector.create, effect scheduling is ignored
    }
  }

  ngOnInit(): void {
    if (this.propertyId() && this.canRead() && this.loadedPropertyId() !== this.propertyId() && !this.isLoading()) {
      this.loadPolicies();
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingRequests();
    if (this.webhookCopyTimer) {
      clearTimeout(this.webhookCopyTimer);
      this.webhookCopyTimer = undefined;
    }
    this.isFallbackDestroyed = true;
    const callbacks = this.fallbackDestroyCallbacks.splice(0);
    callbacks.forEach(cb => cb());
  }

  toggleSepayApiKeyVisibility(): void {
    this.showSepayApiKey.update(v => !v);
  }

  onSepayApiKeyInput(): void {
    const val = String(this.printConfigForm?.get('sepayApiKey')?.value ?? '').trim();
    this.hasSepayApiKey.set(val.length > 0);
  }

  clearSepayApiKey(): void {
    if (!this.canUpdate()) return;
    this.printConfigForm?.patchValue({ sepayApiKey: '' });
    this.printConfigForm?.markAsDirty();
    this.hasSepayApiKey.set(false);
  }

  copySepayWebhookUrl(): void {
    const url = this.sepayWebhookUrl();
    if (!url) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        void Promise.resolve(navigator.clipboard.writeText(url)).catch(() => {});
      } catch {
        // Ignore clipboard permission errors in headless/non-HTTPS contexts
      }
    }

    this.isWebhookUrlCopied.set(true);
    if (this.webhookCopyTimer) {
      clearTimeout(this.webhookCopyTimer);
    }
    this.webhookCopyTimer = setTimeout(() => {
      this.isWebhookUrlCopied.set(false);
      this.webhookCopyTimer = undefined;
      this.cdr?.markForCheck();
    }, 2000);
    this.alertService.toastSuccess('Đã sao chép URL Webhook SePay của cơ sở.', 'Đã sao chép');
    this.cdr?.markForCheck();
  }

  hasUnsavedChanges(): boolean {
    if (this.isSaving() || this.isSavingPrintConfig()) {
      return false;
    }
    return Boolean(this.policyForm?.dirty || this.printConfigForm?.dirty);
  }

  private createFallbackDestroyRef(): DestroyRef {
    const page = this;
    return {
      get destroyed(): boolean {
        return page.isFallbackDestroyed;
      },
      onDestroy: (callback: () => void) => {
        page.fallbackDestroyCallbacks.push(callback);
        return () => {
          page.fallbackDestroyCallbacks = page.fallbackDestroyCallbacks.filter(cb => cb !== callback);
        };
      }
    };
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const apiErr = err as ErrorWithMessage;
      return apiErr.error?.message || apiErr.message || fallback;
    }
    return fallback;
  }

  get surchargesArray(): FormArray {
    return this.policyForm.get('surcharges') as FormArray;
  }

  private initForm(): void {
    this.policyForm = this.fb.group({
      checkInTime: ['12:00', [Validators.required]],
      checkOutTime: ['12:00', [Validators.required]],
      bufferMinutes: [30, [Validators.required, Validators.min(30)]],
      maxHourlyHours: [12, [Validators.required, Validators.min(1), Validators.max(24)]],
      taxRatePercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      serviceFeeRatePercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      surcharges: this.fb.array([])
    });

    this.printConfigForm = this.fb.group({
      headerCompanyName: [''],
      headerAddress: [''],
      taxNumber: [''],
      hotline: [''],
      logoUrl: [''],
      bankName: ['MBBank'],
      bankAccountNumber: [''],
      bankAccountHolder: [''],
      sepayApiKey: [''],
      footerNote: ['Cảm ơn Quý khách đã sử dụng dịch vụ của chúng tôi!'],
      checkInPolicyText: ['Vui lòng xuất trình CCCD/Hộ chiếu khi làm thủ tục nhận phòng.'],
      showVietQrCode: [true],
      defaultPaperSize: ['A4']
    });
  }

  private resetForm(): void {
    this.policyForm.patchValue({
      checkInTime: '12:00',
      checkOutTime: '12:00',
      bufferMinutes: 30,
      maxHourlyHours: 12,
      taxRatePercent: 0,
      serviceFeeRatePercent: 0
    });
    this.surchargesArray.clear();
    this.policyForm.markAsPristine();
    this.policyForm.markAsUntouched();
    this.printConfigForm?.patchValue({ sepayApiKey: '' });
    this.hasSepayApiKey.set(false);
    this.showSepayApiKey.set(false);
    this.printConfigForm?.markAsPristine();
    this.printConfigForm?.markAsUntouched();
  }

  handlePropertyContextChange(newPropId: string | null): void {
    this.cancelPendingRequests();
    this.loadedPropertyId.set(null);
    this.isLoading.set(false);
    this.isSaving.set(false);
    this.errorMessage.set(null);
    this.clientErrors.set([]);
    this.resetForm();

    if (newPropId && this.canRead()) {
      this.loadPolicies(newPropId);
    }
  }

  loadPolicies(targetPropId?: string | null): void {
    if (!this.canRead()) {
      return;
    }

    const propId = targetPropId !== undefined ? targetPropId : this.propertyId();
    if (!propId) {
      this.cancelPendingRequests();
      this.loadedPropertyId.set(null);
      this.isLoading.set(false);
      this.resetForm();
      return;
    }

    // Cancel any previous load request (latest-request-wins)
    this.loadSub?.unsubscribe();
    this.loadedPropertyId.set(null);
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.clientErrors.set([]);

    const requestedPropId = propId;
    this.loadSub = this.policyService
      .getPolicies(requestedPropId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: PropertyPoliciesDto) => {
          // Discard response if branch context changed while request was in-flight
          if (this.propertyId() !== requestedPropId) {
            return;
          }
          this.populateForm(data);
          this.loadedPropertyId.set(requestedPropId);
          this.isLoading.set(false);
          this.cdr?.markForCheck();
        },
        error: (err: unknown) => {
          // Discard error if branch context changed while request was in-flight
          if (this.propertyId() !== requestedPropId) {
            return;
          }
          this.isLoading.set(false);
          this.errorMessage.set(this.extractErrorMessage(err, 'Không thể tải chính sách của chi nhánh.'));
          this.cdr?.markForCheck();
        }
      });

    if (this.printService) {
      this.printLoadSub?.unsubscribe();
      this.printLoadSub = this.printService
        .getTemplateConfig(requestedPropId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cfg: PrintTemplateConfigDto) => {
            if (this.propertyId() !== requestedPropId) {
              return;
            }
            if (cfg && this.printConfigForm) {
              const keyVal = cfg.sepayApiKey || '';
              this.printConfigForm.patchValue({
                headerCompanyName: cfg.headerCompanyName || '',
                headerAddress: cfg.headerAddress || '',
                taxNumber: cfg.taxNumber || '',
                hotline: cfg.hotline || '',
                logoUrl: cfg.logoUrl || '',
                bankName: cfg.bankName || 'MBBank',
                bankAccountNumber: cfg.bankAccountNumber || '',
                bankAccountHolder: cfg.bankAccountHolder || '',
                sepayApiKey: keyVal,
                footerNote: cfg.footerNote || '',
                checkInPolicyText: cfg.checkInPolicyText || '',
                showVietQrCode: cfg.showVietQrCode ?? true,
                defaultPaperSize: cfg.defaultPaperSize || 'A4'
              });
              this.hasSepayApiKey.set(Boolean(cfg.hasSepayApiKey ?? keyVal.trim().length > 0));
              this.printConfigForm.markAsPristine();
              this.cdr?.markForCheck();
            }
          },
          error: () => {}
        });
    }
  }

  savePrintTemplateConfig(): void {
    if (!this.printService || !this.canUpdate() || this.isSavingPrintConfig()) return;
    const propId = this.propertyId() || undefined;
    const raw = this.printConfigForm.getRawValue() as PrintTemplateConfigDto;

    this.isSavingPrintConfig.set(true);
    this.printSaveSub?.unsubscribe();
    this.printSaveSub = this.printService
      .updateTemplateConfig(raw, propId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.isSavingPrintConfig.set(false);
          if (updated) {
            this.printConfigForm.patchValue(updated);
            const updatedKey = String(updated.sepayApiKey ?? raw.sepayApiKey ?? '').trim();
            this.hasSepayApiKey.set(Boolean(updated.hasSepayApiKey ?? updatedKey.length > 0));
          } else {
            const rawKey = String(raw.sepayApiKey ?? '').trim();
            this.hasSepayApiKey.set(rawKey.length > 0);
          }
          this.printConfigForm.markAsPristine();
          this.alertService.toastSuccess('Đã lưu cấu hình mẫu in hóa đơn & VietQR.', 'Thành công');
          this.cdr?.markForCheck();
        },
        error: (err: unknown) => {
          this.isSavingPrintConfig.set(false);
          this.alertService.toastError(this.extractErrorMessage(err, 'Không thể lưu cấu hình mẫu in.'), 'Lỗi');
          this.cdr?.markForCheck();
        }
      });
  }

  private populateForm(data: PropertyPoliciesDto): void {
    const checkIn = (data.checkInTime || '12:00').substring(0, 5);
    const checkOut = (data.checkOutTime || '12:00').substring(0, 5);

    this.policyForm.patchValue({
      checkInTime: checkIn,
      checkOutTime: checkOut,
      bufferMinutes: data.bufferMinutes ?? 30,
      maxHourlyHours: data.maxHourlyHours ?? 12,
      taxRatePercent: data.taxRatePercent ?? 0,
      serviceFeeRatePercent: data.serviceFeeRatePercent ?? 0
    });

    this.surchargesArray.clear();
    if (data.surcharges && data.surcharges.length > 0) {
      data.surcharges.forEach(s => {
        this.surchargesArray.push(this.createSurchargeGroup(s));
      });
    }
    this.policyForm.markAsPristine();
  }

  createSurchargeGroup(item?: Partial<SurchargePolicyDto>): FormGroup {
    const fromTime = (item?.fromTime || '06:00').substring(0, 5);
    const toTime = (item?.toTime || '12:00').substring(0, 5);

    return this.fb.group({
      id: [item?.id || null],
      surchargeType: [item?.surchargeType ?? SurchargeType.EarlyCheckIn, Validators.required],
      fromTime: [fromTime, Validators.required],
      toTime: [toTime, Validators.required],
      calculationMethod: [item?.calculationMethod ?? SurchargeCalculationMethod.PercentageOfNightly, Validators.required],
      percentage: [item?.percentage ?? (item?.calculationMethod === SurchargeCalculationMethod.FlatAmount ? null : 30)],
      flatAmount: [item?.flatAmount ?? (item?.calculationMethod === SurchargeCalculationMethod.PercentageOfNightly ? null : 100000)],
      isActive: [item?.isActive ?? true]
    });
  }

  addSurcharge(): void {
    if (!this.canUpdate()) return;
    this.surchargesArray.push(this.createSurchargeGroup({
      surchargeType: SurchargeType.EarlyCheckIn,
      fromTime: '06:00',
      toTime: '12:00',
      calculationMethod: SurchargeCalculationMethod.PercentageOfNightly,
      percentage: 30,
      isActive: true
    }));
    this.policyForm.markAsDirty();
  }

  applyFull24hSurchargePreset(): void {
    if (!this.canUpdate()) return;
    const preset: Array<Partial<SurchargePolicyDto>> = [
      { surchargeType: SurchargeType.EarlyCheckIn, fromTime: '00:00', toTime: '06:00', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 100, isActive: true },
      { surchargeType: SurchargeType.EarlyCheckIn, fromTime: '06:00', toTime: '09:00', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 50, isActive: true },
      { surchargeType: SurchargeType.EarlyCheckIn, fromTime: '09:00', toTime: '14:00', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 30, isActive: true },
      { surchargeType: SurchargeType.LateCheckOut, fromTime: '12:00', toTime: '15:00', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 30, isActive: true },
      { surchargeType: SurchargeType.LateCheckOut, fromTime: '15:00', toTime: '18:00', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 50, isActive: true },
      { surchargeType: SurchargeType.LateCheckOut, fromTime: '18:00', toTime: '23:59', calculationMethod: SurchargeCalculationMethod.PercentageOfNightly, percentage: 100, isActive: true }
    ];
    this.surchargesArray.clear();
    preset.forEach(item => this.surchargesArray.push(this.createSurchargeGroup(item)));
    this.policyForm.markAsDirty();
    this.clientErrors.set([]);
  }

  removeSurcharge(index: number): void {
    if (!this.canUpdate()) return;
    this.surchargesArray.removeAt(index);
    this.policyForm.markAsDirty();
  }

  validateForm(): string[] {
    const errors: string[] = [];
    const val = this.policyForm.value;

    if (!val.checkInTime) {
      errors.push('Giờ nhận phòng tiêu chuẩn không được để trống.');
    }
    if (!val.checkOutTime) {
      errors.push('Giờ trả phòng tiêu chuẩn không được để trống.');
    }
    if (val.bufferMinutes === null || val.bufferMinutes === undefined || val.bufferMinutes < 30) {
      errors.push('Thời gian đệm dọn phòng (buffer) tối thiểu phải từ 30 phút trở lên.');
    }
    if (val.maxHourlyHours === null || val.maxHourlyHours === undefined || val.maxHourlyHours < 1 || val.maxHourlyHours > 24) {
      errors.push('Giới hạn thời gian thuê theo giờ phải từ 1 đến 24 giờ (Quyết định D14).');
    }
    const taxRate = Number(val.taxRatePercent ?? 0);
    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.push('Thuế VAT (%) phải nằm trong khoảng 0% đến 100%.');
    }
    const serviceFeeRate = Number(val.serviceFeeRatePercent ?? 0);
    if (Number.isNaN(serviceFeeRate) || serviceFeeRate < 0 || serviceFeeRate > 100) {
      errors.push('Phí dịch vụ (%) phải nằm trong khoảng 0% đến 100%.');
    }

    const surcharges = (val.surcharges || []) as Array<{
      surchargeType: number;
      fromTime: string;
      toTime: string;
      calculationMethod: number;
      percentage: number | null;
      flatAmount: number | null;
      isActive: boolean;
    }>;

    // Check each surcharge item
    surcharges.forEach((s, idx) => {
      const idxDisplay = idx + 1;
      if (!s.fromTime || !s.toTime) {
        errors.push(`Khung phụ thu #${idxDisplay}: Giờ bắt đầu và kết thúc không được để trống.`);
      } else if (s.fromTime >= s.toTime) {
        errors.push(`Khung phụ thu #${idxDisplay}: Giờ kết thúc (${s.toTime}) phải lớn hơn giờ bắt đầu (${s.fromTime}).`);
      }

      if (s.calculationMethod === SurchargeCalculationMethod.PercentageOfNightly) {
        if (s.percentage === null || s.percentage === undefined || s.percentage <= 0 || s.percentage > 100) {
          errors.push(`Khung phụ thu #${idxDisplay}: Phần trăm phụ thu phải lớn hơn 0% và không vượt quá 100%.`);
        }
      } else if (s.calculationMethod === SurchargeCalculationMethod.FlatAmount) {
        if (s.flatAmount === null || s.flatAmount === undefined || s.flatAmount < 0) {
          errors.push(`Khung phụ thu #${idxDisplay}: Số tiền phụ thu cố định không được âm.`);
        }
      }
    });

    // Overlap validation among active surcharges per SurchargeType
    const activeItems = surcharges.filter(s => s.isActive && s.fromTime && s.toTime && s.fromTime < s.toTime);
    const groups: Record<number, typeof activeItems> = {};
    activeItems.forEach(item => {
      if (!groups[item.surchargeType]) groups[item.surchargeType] = [];
      groups[item.surchargeType].push(item);
    });

    Object.keys(groups).forEach(typeKey => {
      const typeNum = parseInt(typeKey, 10);
      const items = groups[typeNum].slice().sort((a, b) => a.fromTime.localeCompare(b.fromTime));
      const typeName = typeNum === SurchargeType.EarlyCheckIn ? 'Nhận phòng sớm' : 'Trả phòng muộn';

      for (let i = 0; i < items.length - 1; i++) {
        const cur = items[i];
        const next = items[i + 1];
        if (cur.toTime > next.fromTime) {
          errors.push(`Khung phụ thu ${typeName} (${cur.fromTime} - ${cur.toTime}) bị chồng lấn với (${next.fromTime} - ${next.toTime}).`);
        }
      }
    });

    return errors;
  }

  savePolicies(): void {
    // Strict entry guard: check isSaving, isLoading, null propertyId, loadedPropertyId mismatch, canUpdate
    if (
      this.isSaving() ||
      this.isLoading() ||
      !this.propertyId() ||
      this.loadedPropertyId() !== this.propertyId() ||
      !this.canUpdate()
    ) {
      if (!this.canUpdate()) {
        this.alertService.toastError('Bạn không có quyền cập nhật chính sách chi nhánh.');
      } else if (!this.propertyId()) {
        this.alertService.toastError('Vui lòng chọn chi nhánh làm việc trước khi lưu.');
      }
      return;
    }

    const propId = this.propertyId()!;

    const errors = this.validateForm();
    this.clientErrors.set(errors);
    if (errors.length > 0) {
      this.alertService.toastError('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ.');
      return;
    }

    const val = this.policyForm.value;
    const formatTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

    const surchargesPayload: UpdateSurchargeItemRequest[] = ((val.surcharges || []) as SurchargeFormValue[]).map((s) => ({
      id: s.id || null,
      surchargeType: s.surchargeType,
      fromTime: formatTime(s.fromTime),
      toTime: formatTime(s.toTime),
      calculationMethod: s.calculationMethod,
      percentage: s.calculationMethod === SurchargeCalculationMethod.PercentageOfNightly ? Number(s.percentage) : null,
      flatAmount: s.calculationMethod === SurchargeCalculationMethod.FlatAmount ? Number(s.flatAmount) : null,
      isActive: Boolean(s.isActive)
    }));

    const payload: UpdatePropertyPoliciesRequest = {
      checkInTime: formatTime(val.checkInTime),
      checkOutTime: formatTime(val.checkOutTime),
      bufferMinutes: Number(val.bufferMinutes),
      maxHourlyHours: Number(val.maxHourlyHours),
      taxRatePercent: Number(val.taxRatePercent ?? 0),
      serviceFeeRatePercent: Number(val.serviceFeeRatePercent ?? 0),
      surcharges: surchargesPayload
    };

    this.isSaving.set(true);
    this.saveSub?.unsubscribe();
    const savingPropId = propId;

    this.saveSub = this.policyService
      .updatePolicies(savingPropId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PropertyPoliciesDto) => {
          this.isSaving.set(false);
          // Discard response if branch context changed while request was in-flight
          if (this.propertyId() !== savingPropId) {
            return;
          }
          this.populateForm(res);
          this.loadedPropertyId.set(savingPropId);
          this.clientErrors.set([]);
          this.alertService.toastSuccess('Cập nhật chính sách chi nhánh thành công.');
          this.cdr?.markForCheck();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          // Discard error if branch context changed while request was in-flight
          if (this.propertyId() !== savingPropId) {
            return;
          }
          const detail = this.extractErrorMessage(err, 'Lỗi khi lưu chính sách chi nhánh.');
          this.alertService.toastError(detail, 'Lỗi cập nhật');
          this.cdr?.markForCheck();
        }
      });
  }

  private cancelPendingRequests(): void {
    if (this.loadSub) {
      this.loadSub.unsubscribe();
      this.loadSub = undefined;
    }
    if (this.saveSub) {
      this.saveSub.unsubscribe();
      this.saveSub = undefined;
    }
    if (this.printLoadSub) {
      this.printLoadSub.unsubscribe();
      this.printLoadSub = undefined;
    }
    if (this.printSaveSub) {
      this.printSaveSub.unsubscribe();
      this.printSaveSub = undefined;
    }
  }
}
