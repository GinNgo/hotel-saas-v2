import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
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
  UpdateSurchargeItemRequest
} from '../../core/models/policy.model';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent],
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
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
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
          description="Vui lòng bấm vào bộ chuyển chi nhánh ở thanh tiêu đề trên cùng để chọn chi nhánh cần quản lý chính sách."
        />
      } @else if (isLoading()) {
        <!-- Skeleton Loading State -->
        <div class="space-y-6 animate-pulse">
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
        <div class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
          <div class="flex items-center gap-2.5">
            <i class="pi pi-exclamation-triangle text-xl text-rose-600"></i>
            <h3 class="font-bold text-sm">Không thể tải cấu hình chính sách chi nhánh</h3>
          </div>
          <p class="text-xs text-rose-700 leading-relaxed">{{ errorMessage() }}</p>
          <button
            type="button"
            (click)="loadPolicies()"
            aria-label="Thử tải lại chính sách"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
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
            <div class="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1">
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
                  <p class="text-[11px] text-slate-400">Tự động cộng thêm phụ thu khi khách check-in sớm hoặc check-out muộn</p>
                </div>
              </div>

              @if (canUpdate()) {
                <button
                  type="button"
                  (click)="addSurcharge()"
                  aria-label="Thêm khung phụ thu"
                  title="Thêm khung phụ thu"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <i class="pi pi-plus text-xs"></i>
                  <span>Thêm khung phụ thu</span>
                </button>
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
                        <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                          {{ $index + 1 }}
                        </span>
                        <span class="text-xs font-bold text-slate-700">
                          Khung quy tắc #{{ $index + 1 }}
                        </span>
                      </div>

                      <div class="flex items-center gap-3">
                        <!-- Active Checkbox -->
                        <label class="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
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
                            class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa quy tắc này"
                            aria-label="Xóa quy tắc này"
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

          <!-- Bottom Save Actions -->
          @if (canUpdate()) {
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                (click)="loadPolicies()"
                [disabled]="isSaving() || isLoading() || !propertyId()"
                aria-label="Hủy thay đổi và tải lại"
                title="Hủy thay đổi và tải lại"
                class="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                (click)="savePolicies()"
                [disabled]="isSaving() || isLoading() || !propertyId() || loadedPropertyId() !== propertyId()"
                aria-label="Lưu thay đổi chính sách"
                title="Lưu thay đổi chính sách"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
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
      }
    </div>
  `
})
export class PoliciesPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly policyService = inject(PolicyService);
  private readonly alertService = inject(AlertService);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly clientErrors = signal<string[]>([]);
  readonly loadedPropertyId = signal<string | null>(null);

  readonly propertyId = computed(() => this.authService.activePropertyId());
  readonly canRead = computed(() => this.authService.hasPermission('PROPERTIES', 1));
  readonly canUpdate = computed(() => this.authService.hasPermission('PROPERTIES', 4));

  policyForm!: FormGroup;

  private loadSub?: Subscription;
  private saveSub?: Subscription;

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
      surcharges: this.fb.array([])
    });
  }

  private resetForm(): void {
    this.policyForm.patchValue({
      checkInTime: '12:00',
      checkOutTime: '12:00',
      bufferMinutes: 30,
      maxHourlyHours: 12
    });
    this.surchargesArray.clear();
    this.policyForm.markAsPristine();
    this.policyForm.markAsUntouched();
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
    this.loadSub = this.policyService.getPolicies(requestedPropId).subscribe({
      next: (data: PropertyPoliciesDto) => {
        // Discard response if branch context changed while request was in-flight
        if (this.propertyId() !== requestedPropId) {
          return;
        }
        this.populateForm(data);
        this.loadedPropertyId.set(requestedPropId);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        // Discard error if branch context changed while request was in-flight
        if (this.propertyId() !== requestedPropId) {
          return;
        }
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Không thể tải chính sách của chi nhánh.';
        this.errorMessage.set(msg);
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
      maxHourlyHours: data.maxHourlyHours ?? 12
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
  }

  removeSurcharge(index: number): void {
    if (!this.canUpdate()) return;
    this.surchargesArray.removeAt(index);
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

    const surchargesPayload: UpdateSurchargeItemRequest[] = (val.surcharges || []).map((s: any) => ({
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
      surcharges: surchargesPayload
    };

    this.isSaving.set(true);
    this.saveSub?.unsubscribe();
    const savingPropId = propId;

    this.saveSub = this.policyService.updatePolicies(savingPropId, payload).subscribe({
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
      },
      error: (err: any) => {
        this.isSaving.set(false);
        // Discard error if branch context changed while request was in-flight
        if (this.propertyId() !== savingPropId) {
          return;
        }
        const detail = err?.error?.message || err?.message || 'Lỗi khi lưu chính sách chi nhánh.';
        this.alertService.toastError(detail, 'Lỗi cập nhật');
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
  }
}
