import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AlertService } from '../../core/services/alert.service';
import {
  SubscriptionPackageDto,
  SubscriptionUpgradeInitiationDto,
  TenantSubscriptionDto
} from '../../core/models/subscription.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BusinessDatePipe, BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';

@Component({
  selector: 'app-subscriptions-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    BusinessDatePipe,
    BusinessDateTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">

      <app-page-header
        title="Gói cước & Hạn ngạch tài nguyên (SaaS Billing)"
        subtitle="Quản trị dung lượng phòng, chi nhánh, nhân sự, thanh toán nâng cấp qua VNPay và quản lý quyền hỗ trợ kỹ thuật."
      >
        <a
          routerLink="/support-grants"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          <i class="pi pi-shield"></i>
          <span>Ủy quyền Hỗ trợ (D24)</span>
        </a>
        <button
          type="button"
          (click)="loadData()"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
          <span>Làm mới trạng thái</span>
        </button>
      </app-page-header>

      <!-- Pending VNPay Payment Banner -->
      @if (activePendingPayment(); as pending) {
        <div
          role="region"
          aria-label="Hóa đơn nâng cấp đang chờ thanh toán"
          class="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                Chờ xác nhận thanh toán VNPay
              </span>
              <span class="text-xs font-mono font-bold text-slate-700">{{ pending.invoiceNumber }}</span>
            </div>
            <p class="text-sm font-bold text-slate-900">
              Yêu cầu nâng cấp trị giá {{ pending.amount | number:'1.0-0' }} ₫ ({{ pending.billingCycle || 'Monthly' }})
              — Mã tham chiếu: <span class="font-mono">{{ pending.transactionRef }}</span>
            </p>
            <p class="text-xs text-slate-600">
              Gói cước hiện tại chỉ được kích hoạt hạng mức mới sau khi giao dịch VNPay hoàn tất hoặc được xác thực thành công.
            </p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap shrink-0">
            @if (pendingPaymentUrl(); as checkoutUrl) {
              <a
                [href]="checkoutUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                <i class="pi pi-external-link"></i>
                <span>Thanh toán qua VNPay</span>
              </a>
            }
            <button
              type="button"
              (click)="loadData()"
              [disabled]="isLoading()"
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-amber-300 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
              <span>{{ isLoading() ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái thanh toán' }}</span>
            </button>
          </div>
        </div>
      }

      <!-- Current Subscription Banner Card -->
      @if (currentSub(); as sub) {
        <div class="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div class="space-y-3">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="px-3 py-1 rounded-lg text-sm font-bold bg-emerald-600 text-white shadow-2xs">
                  {{ sub.tierName }}
                </span>
                <app-status-badge
                  [status]="sub.status"
                  [customLabel]="'Đang kích hoạt (' + sub.status + ')'"
                  color="emerald"
                />
              </div>

              <div>
                <div class="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {{ sub.pricePerCycle | number:'1.0-0' }} ₫
                  <span class="text-sm font-normal text-slate-600">
                    / {{ sub.billingCycle === 'Annual' ? 'năm' : 'tháng' }}
                  </span>
                </div>
                <div class="text-xs text-slate-600 mt-1">
                  Chu kỳ hiện tại đến hết: <strong>{{ sub.currentPeriodEndUtc | businessDate }}</strong>
                  (Tự động gia hạn: {{ sub.autoRenew ? 'Bật' : 'Tắt' }})
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:w-3/5">
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700">Phòng</span>
                  <span class="font-bold text-slate-900">
                    {{ sub.currentRoomCount }} / {{ sub.maxRoomsAllowed >= 999 ? '∞' : sub.maxRoomsAllowed }}
                  </span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class.bg-emerald-500]="sub.roomUsagePercentage < 80"
                    [class.bg-amber-500]="sub.roomUsagePercentage >= 80 && sub.roomUsagePercentage < 95"
                    [class.bg-rose-500]="sub.roomUsagePercentage >= 95"
                    [style.width.%]="sub.roomUsagePercentage"
                  ></div>
                </div>
              </div>

              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700">Chi nhánh</span>
                  <span class="font-bold text-slate-900">
                    {{ sub.currentPropertyCount }} / {{ sub.maxPropertiesAllowed >= 999 ? '∞' : sub.maxPropertiesAllowed }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500">Multi-Property SaaS</div>
              </div>

              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700">Nhân sự</span>
                  <span class="font-bold text-slate-900">
                    {{ sub.currentStaffCount ?? 0 }} / {{ (sub.maxStaffAllowed ?? 999) >= 999 ? '∞' : sub.maxStaffAllowed }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500">Tài khoản RBAC</div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Billing Cycle Switch & Plans Grid -->
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Bảng giá gói dịch vụ</h2>
            <p class="text-xs text-slate-500">Cập nhật trực tiếp từ danh mục gói cước của nền tảng.</p>
          </div>

          <div class="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
            <button
              type="button"
              (click)="billingCycle.set(0)"
              class="min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              [ngClass]="billingCycle() === 0 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'"
            >
              Thanh toán Tháng
            </button>
            <button
              type="button"
              (click)="billingCycle.set(1)"
              class="min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              [ngClass]="billingCycle() === 1 ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'"
            >
              Thanh toán Năm (Tiết kiệm)
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (plan of plans(); track plan.tier) {
            <div
              class="relative rounded-2xl border bg-white p-6 flex flex-col justify-between transition-all"
              [class.border-emerald-500]="plan.isPopular"
              [class.shadow-md]="plan.isPopular"
              [class.border-slate-200]="!plan.isPopular"
            >
              @if (plan.isPopular) {
                <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full">
                  {{ plan.badge || 'Phổ biến nhất' }}
                </span>
              }

              <div>
                <h3 class="text-lg font-bold text-slate-900">{{ plan.name }}</h3>
                <p class="text-xs text-slate-500 mt-1 min-h-[36px]">{{ plan.description }}</p>

                <div class="my-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-2xl font-black text-slate-900">
                    {{ (billingCycle() === 1 ? plan.annualPrice : plan.monthlyPrice) | number:'1.0-0' }} ₫
                    <span class="text-xs font-normal text-slate-500">
                      / {{ billingCycle() === 1 ? 'năm' : 'tháng' }}
                    </span>
                  </div>
                </div>

                <div class="my-4 py-3 border-y border-slate-100 space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-600">Quy mô phòng</span>
                    <span class="font-bold text-slate-900">
                      {{ plan.maxRooms >= 999 ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">Số chi nhánh</span>
                    <span class="font-bold text-slate-900">
                      {{ plan.maxProperties >= 999 ? 'Không giới hạn' : plan.maxProperties + ' chi nhánh' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">Tài khoản nhân sự</span>
                    <span class="font-bold text-slate-900">
                      {{ plan.maxStaff >= 999 ? 'Không giới hạn' : plan.maxStaff + ' nhân viên' }}
                    </span>
                  </div>
                </div>

                <div class="space-y-2 mb-6">
                  @for (feat of plan.features; track feat) {
                    <div class="flex items-start gap-2 text-xs text-slate-600">
                      <i class="pi pi-check text-emerald-600 mt-0.5 shrink-0"></i>
                      <span>{{ feat }}</span>
                    </div>
                  }
                </div>
              </div>

              @if (currentSub()?.tier === plan.tier) {
                <button
                  type="button"
                  disabled
                  class="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                >
                  <i class="pi pi-check-circle mr-1.5"></i> Đang sử dụng gói này
                </button>
              } @else {
                <button
                  type="button"
                  (click)="upgradeTo(plan)"
                  [disabled]="isUpgrading()"
                  class="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50"
                  [class.bg-emerald-600]="plan.isPopular"
                  [class.hover:bg-emerald-700]="plan.isPopular"
                  [class.bg-slate-900]="!plan.isPopular"
                  [class.hover:bg-slate-800]="!plan.isPopular"
                >
                  {{ isUpgrading() ? 'Đang khởi tạo hóa đơn...' : 'Nâng cấp qua VNPay' }}
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Recent Payments History -->
      @if ((currentSub()?.recentPayments?.length ?? 0) > 0) {
        <section class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div class="px-5 py-4 border-b border-slate-200">
            <h2 class="text-base font-bold text-slate-900">Lịch sử thanh toán gói cước SaaS</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="py-3 px-4">Số hóa đơn</th>
                  <th class="py-3 px-4">Mã giao dịch</th>
                  <th class="py-3 px-4">Số tiền</th>
                  <th class="py-3 px-4">Cổng</th>
                  <th class="py-3 px-4">Trạng thái</th>
                  <th class="py-3 px-4">Thời gian (UTC+7)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (p of currentSub()?.recentPayments ?? []; track p.id) {
                  <tr>
                    <td class="py-3 px-4 font-mono font-semibold text-slate-900">{{ p.invoiceNumber || '—' }}</td>
                    <td class="py-3 px-4 font-mono">{{ p.transactionRef || '—' }}</td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-900">{{ p.amount | number:'1.0-0' }} ₫</td>
                    <td class="py-3 px-4">{{ p.method }}</td>
                    <td class="py-3 px-4">
                      <app-status-badge [status]="p.status" type="payment" />
                    </td>
                    <td class="py-3 px-4">{{ (p.paidAtUtc || p.createdAtUtc) | businessDateTime }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `
})
export class SubscriptionsPage implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly alertService = inject(AlertService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly isUpgrading = signal(false);
  readonly isConfirming = signal(false);
  readonly billingCycle = signal<0 | 1>(0);
  readonly currentSub = signal<TenantSubscriptionDto | null>(null);
  readonly plans = signal<SubscriptionPackageDto[]>([]);
  readonly lastInitiation = signal<SubscriptionUpgradeInitiationDto | null>(null);

  readonly activePendingPayment = computed(() => {
    const subPending = this.currentSub()?.pendingPayment;
    if (subPending) return subPending;
    const init = this.lastInitiation();
    if (!init || init.paymentStatus !== 'Pending') return null;
    return {
      id: init.paymentId,
      amount: init.amount,
      method: 'VNPay',
      status: init.paymentStatus,
      transactionRef: init.transactionRef,
      invoiceNumber: init.invoiceNumber,
      createdAtUtc: new Date().toISOString(),
      targetTier: init.targetTier,
      billingCycle: init.billingCycle
    };
  });

  readonly pendingPaymentUrl = computed(() => this.lastInitiation()?.paymentUrl ?? null);

  ngOnInit(): void {
    const vnpQuery: Record<string, string> = {};
    const snapshotParams = this.route.snapshot.queryParamMap;
    for (const key of snapshotParams.keys) {
      const val = snapshotParams.get(key);
      if (key.startsWith('vnp_') && val) {
        vnpQuery[key] = val;
      }
    }

    if (vnpQuery['vnp_TxnRef'] && vnpQuery['vnp_SecureHash']) {
      this.isConfirming.set(true);
      this.subscriptionService.verifyVnpayReturn(vnpQuery).subscribe({
        next: res => {
          this.isConfirming.set(false);
          this.alertService.toastSuccess(res.message, 'Thanh toán hoàn tất');
          this.loadData();
        },
        error: err => {
          this.isConfirming.set(false);
          this.alertService.error(err?.error?.message || 'Xác thực chữ ký VNPay thất bại.');
          this.loadData();
        }
      });
      return;
    }

    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.subscriptionService.getCurrentSubscription().subscribe({
      next: res => {
        this.currentSub.set(res);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        this.alertService.error('Không thể tải thông tin gói cước: ' + (err?.error?.message || err?.message || 'Lỗi kết nối'));
      }
    });

    this.subscriptionService.getAvailablePlans().subscribe({
      next: res => this.plans.set(res || []),
      error: err => this.alertService.error('Không thể tải danh sách gói cước: ' + (err?.error?.message || err?.message || 'Lỗi kết nối'))
    });
  }

  upgradeTo(plan: SubscriptionPackageDto): void {
    const cycle = this.billingCycle();
    const price = cycle === 1 ? plan.annualPrice : plan.monthlyPrice;
    const cycleText = cycle === 1 ? 'năm' : 'tháng';
    if (!confirm(`Khởi tạo hóa đơn nâng cấp "${plan.name}" (${price.toLocaleString('vi-VN')} ₫/${cycleText})?`)) {
      return;
    }

    const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/subscriptions` : undefined;
    this.isUpgrading.set(true);
    this.subscriptionService.upgradeSubscription(plan.tier, cycle, returnUrl).subscribe({
      next: init => {
        this.isUpgrading.set(false);
        this.lastInitiation.set(init);
        this.alertService.toastInfo(init.message, 'Chờ hoàn tất thanh toán');
        this.loadData();
      },
      error: err => {
        this.isUpgrading.set(false);
        this.alertService.toastError(err?.error?.message || 'Không thể khởi tạo yêu cầu nâng cấp.', 'Lỗi khởi tạo');
      }
    });
  }
}
