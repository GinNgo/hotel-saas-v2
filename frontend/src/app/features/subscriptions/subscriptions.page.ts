import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AlertService } from '../../core/services/alert.service';
import { TenantSubscriptionDto, SubscriptionPackageDto } from '../../core/models/subscription.model';

@Component({
  selector: 'app-subscriptions-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">
      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <i class="pi pi-bolt text-[11px]"></i> Multi-Tenant SaaS Quota
            </span>
            <span class="text-xs text-slate-600">Thanh toán chu kỳ tháng</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Gói cước & Hạn ngạch tài nguyên
          </h1>
          <p class="text-sm text-slate-600 mt-1">
            Quản trị dung lượng phòng khách sạn, mở rộng số chi nhánh và tính năng trợ lý thông minh AI.
          </p>
        </div>

        <button
          type="button"
          (click)="loadData()"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
          Làm mới trạng thái
        </button>
      </div>

      <!-- Current Subscription Banner Card -->
      @if (currentSub(); as sub) {
        <div class="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <!-- Subtle background glow -->
          <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-50 blur-3xl pointer-events-none"></div>

          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
            <!-- Left Info -->
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <span class="px-3 py-1 rounded-lg text-sm font-bold bg-emerald-600 text-white shadow-2xs">
                  {{ sub.tierName }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đang kích hoạt ({{ sub.status }})
                </span>
              </div>

              <div>
                <div class="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {{ sub.pricePerCycle | number:'1.0-0' }} ₫
                  <span class="text-sm font-normal text-slate-600">/ tháng</span>
                </div>
                <div class="text-xs text-slate-600 mt-0.5">
                  Chu kỳ hiện tại đến hết: <strong>{{ sub.currentPeriodEndUtc | date:'dd/MM/yyyy' }}</strong>
                  (Tự động gia hạn: {{ sub.autoRenew ? 'Bật' : 'Tắt' }})
                </div>
              </div>
            </div>

            <!-- Right Quota Progress Bars -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:w-1/2">
              <!-- Room Quota -->
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700 flex items-center gap-1.5">
                    <i class="pi pi-th-large text-emerald-600"></i> Số phòng quản lý
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ sub.currentRoomCount }} / {{ sub.maxRoomsAllowed >= 999 ? '∞' : sub.maxRoomsAllowed }}
                  </span>
                </div>
                <!-- Progress bar -->
                <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class.bg-emerald-500]="sub.roomUsagePercentage < 80"
                    [class.bg-amber-500]="sub.roomUsagePercentage >= 80 && sub.roomUsagePercentage < 95"
                    [class.bg-rose-500]="sub.roomUsagePercentage >= 95"
                    [style.width.%]="sub.roomUsagePercentage"
                  ></div>
                </div>
                <div class="text-[11px] text-slate-600 mt-1 flex justify-between">
                  <span>Tỷ lệ sử dụng: {{ sub.roomUsagePercentage }}%</span>
                  @if (sub.isNearQuota) {
                    <span class="text-amber-600 font-medium">Sắp chạm hạn mức!</span>
                  }
                </div>
              </div>

              <!-- Property Quota -->
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700 flex items-center gap-1.5">
                    <i class="pi pi-building text-emerald-600"></i> Số cơ sở / chi nhánh
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ sub.currentPropertyCount }} / {{ sub.maxPropertiesAllowed >= 999 ? '∞' : sub.maxPropertiesAllowed }}
                  </span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    class="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    [style.width.%]="(sub.currentPropertyCount / (sub.maxPropertiesAllowed >= 999 ? 10 : sub.maxPropertiesAllowed)) * 100"
                  ></div>
                </div>
                <div class="text-[11px] text-slate-600 mt-1">
                  Đã kết nối {{ sub.currentPropertyCount }} chi nhánh hoạt động
                </div>
              </div>
            </div>
          </div>

          <!-- Quota Alert if Near Limit -->
          @if (sub.isNearQuota) {
            <div class="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-3">
              <i class="pi pi-exclamation-triangle text-amber-600 text-lg shrink-0"></i>
              <div class="text-xs text-amber-800">
                <strong>Cảnh báo hạn mức:</strong> Khách sạn của bạn đã sử dụng trên 80% số lượng phòng cho phép trong gói.
                Để tiếp tục thêm phòng mới hoặc mở chi nhánh tiếp theo, vui lòng nâng cấp lên gói cao hơn bên dưới.
              </div>
            </div>
          }
        </div>
      }

      <!-- Package Comparison Catalog -->
      <div class="space-y-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Danh mục gói cước chuyển đổi số khách sạn</h2>
          <p class="text-xs text-slate-600">Lựa chọn gói dịch vụ tối ưu theo quy mô buồng phòng thực tế của khách sạn.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (plan of plans(); track plan.tier) {
            <div
              class="relative flex flex-col rounded-2xl bg-white border transition-all duration-200 p-6 sm:p-7 shadow-xs hover:shadow-md"
              [class.border-emerald-500]="plan.isPopular"
              [class.ring-2]="plan.isPopular"
              [class.ring-emerald-500/20]="plan.isPopular"
              [class.border-slate-200]="!plan.isPopular"
            >
              <!-- Popular Badge -->
              @if (plan.badge) {
                <div class="absolute -top-3 right-6">
                  <span
                    class="px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs"
                    [class.bg-emerald-600]="plan.isPopular"
                    [class.text-white]="plan.isPopular"
                    [class.bg-slate-800]="!plan.isPopular"
                    [class.text-slate-100]="!plan.isPopular"
                  >
                    {{ plan.badge }}
                  </span>
                </div>
              }

              <!-- Plan Header -->
              <div class="space-y-2">
                <h3 class="text-lg font-bold text-slate-900">{{ plan.name }}</h3>
                <p class="text-xs text-slate-600 min-h-[36px]">{{ plan.description }}</p>
                <div class="pt-2">
                  <div class="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {{ plan.monthlyPrice | number:'1.0-0' }} ₫
                    <span class="text-xs font-normal text-slate-600">/ tháng</span>
                  </div>
                  <div class="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Thanh toán năm: {{ plan.annualPrice | number:'1.0-0' }} ₫ (Tiết kiệm 2 tháng)
                  </div>
                </div>
              </div>

              <!-- Key Limits -->
              <div class="my-6 py-4 border-y border-slate-100 space-y-2 text-xs">
                <div class="flex items-center justify-between text-slate-700">
                  <span class="flex items-center gap-2">
                    <i class="pi pi-th-large text-emerald-600"></i> Quy mô phòng
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-slate-700">
                  <span class="flex items-center gap-2">
                    <i class="pi pi-building text-emerald-600"></i> Số chi nhánh
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ plan.maxProperties >= 999 ? 'Không giới hạn' : plan.maxProperties + ' chi nhánh' }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-slate-700">
                  <span class="flex items-center gap-2">
                    <i class="pi pi-users text-emerald-600"></i> Tài khoản nhân sự
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ plan.maxStaff >= 999 ? 'Không giới hạn' : plan.maxStaff + ' nhân viên' }}
                  </span>
                </div>
              </div>

              <!-- Feature List -->
              <div class="flex-1 space-y-2.5 mb-8">
                <div class="text-xs font-bold text-slate-900 uppercase tracking-wider">Tính năng đi kèm:</div>
                @for (feat of plan.features; track feat) {
                  <div class="flex items-start gap-2.5 text-xs text-slate-600">
                    <i class="pi pi-check text-emerald-600 mt-0.5 shrink-0"></i>
                    <span>{{ feat }}</span>
                  </div>
                }
              </div>

              <!-- Action Button -->
              <div>
                @if (currentSub()?.tier === plan.tier) {
                  <button
                    type="button"
                    disabled
                    class="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed text-center"
                  >
                    <i class="pi pi-check-circle mr-1.5"></i> Đang sử dụng gói này
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="upgradeTo(plan)"
                    [disabled]="isUpgrading()"
                    class="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer text-center"
                    [class.bg-emerald-600]="plan.isPopular"
                    [class.hover:bg-emerald-700]="plan.isPopular"
                    [class.bg-slate-900]="!plan.isPopular"
                    [class.hover:bg-slate-800]="!plan.isPopular"
                  >
                    @if (isUpgrading()) {
                      <i class="pi pi-spin pi-spinner mr-1.5"></i> Đang nâng cấp...
                    } @else {
                      <i class="pi pi-arrow-up-right mr-1.5"></i> Chuyển sang gói này
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class SubscriptionsPage implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly alertService = inject(AlertService);

  isLoading = signal(false);
  isUpgrading = signal(false);
  currentSub = signal<TenantSubscriptionDto | null>(null);
  plans = signal<SubscriptionPackageDto[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.subscriptionService.getCurrentSubscription().subscribe({
      next: res => {
        this.currentSub.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        // Fallback demo mock if backend tenant context is running empty
        this.currentSub.set({
          subscriptionId: 'demo-sub',
          tenantId: 'demo-tenant',
          tier: 1,
          tierName: 'Gói Khởi Nghiệp (Starter)',
          status: 'Active',
          pricePerCycle: 290000,
          currency: 'VND',
          currentPeriodStartUtc: new Date().toISOString(),
          currentPeriodEndUtc: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          autoRenew: true,
          currentRoomCount: 12,
          maxRoomsAllowed: 15,
          currentPropertyCount: 1,
          maxPropertiesAllowed: 1,
          roomUsagePercentage: 80.0,
          features: ['15 phòng', '1 cơ sở'],
          isNearQuota: true
        });
        this.isLoading.set(false);
      }
    });

    this.subscriptionService.getAvailablePlans().subscribe({
      next: res => {
        this.plans.set(res);
      },
      error: () => {
        // Fallback plans
        this.plans.set([
          {
            tier: 1,
            name: 'Gói Khởi Nghiệp (Starter)',
            description: 'Lý tưởng cho khách sạn nhỏ vừa bắt đầu chuyển đổi số.',
            monthlyPrice: 290000,
            annualPrice: 2900000,
            maxRooms: 15,
            maxProperties: 1,
            maxStaff: 3,
            badge: 'Tiết kiệm',
            isPopular: false,
            features: ['Tối đa 15 phòng', '1 cơ sở', '3 nhân viên', 'Đặt phòng Giờ/Đêm', 'Báo cáo thu ngân']
          },
          {
            tier: 2,
            name: 'Gói Chuyên Nghiệp (Pro)',
            description: 'Lựa chọn hàng đầu cho khách sạn boutique, chuỗi 2-3 chi nhánh.',
            monthlyPrice: 690000,
            annualPrice: 6900000,
            maxRooms: 50,
            maxProperties: 3,
            maxStaff: 10,
            badge: 'Phổ biến nhất',
            isPopular: true,
            features: ['Tối đa 50 phòng', '3 chi nhánh', '10 nhân viên', 'Báo cáo ADR/RevPAR', 'Xuất Excel kế toán', 'Gemini AI Concierge 200 lượt']
          },
          {
            tier: 3,
            name: 'Gói Doanh Nghiệp (Enterprise)',
            description: 'Giải pháp toàn diện cho chuỗi khách sạn lớn và tập đoàn lưu trú.',
            monthlyPrice: 1490000,
            annualPrice: 14900000,
            maxRooms: 9999,
            maxProperties: 999,
            maxStaff: 999,
            badge: 'Toàn diện',
            isPopular: false,
            features: ['Không giới hạn phòng', 'Không giới hạn chi nhánh', 'Không giới hạn nhân viên', 'Full AI Suite', 'SLA 99.9%']
          }
        ]);
      }
    });
  }

  upgradeTo(plan: SubscriptionPackageDto): void {
    if (confirm(`Xác nhận chuyển đổi sang "${plan.name}" với giá ${plan.monthlyPrice.toLocaleString('vi-VN')} ₫/tháng?`)) {
      this.isUpgrading.set(true);
      this.subscriptionService.upgradeSubscription(plan.tier).subscribe({
        next: updated => {
          this.currentSub.set(updated);
          this.isUpgrading.set(false);
          this.alertService.toastSuccess(`Đã chuyển đổi sang ${plan.name}. Hạn mức tài nguyên đã được cập nhật ngay lập tức.`, 'Nâng cấp thành công');
        },
        error: () => {
          this.isUpgrading.set(false);
          this.alertService.toastError('Có lỗi xảy ra trong quá trình cập nhật gói cước. Vui lòng thử lại.', 'Nâng cấp thất bại');
        }
      });
    }
  }
}
