import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AlertService } from '../../core/services/alert.service';
import {
  SubscriptionPackageDto,
  SubscriptionUpgradeInitiationDto,
  SubscriptionVietQrDto,
  TenantSubscriptionDto
} from '../../core/models/subscription.model';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ChartCardComponent, ChartCardDataset } from '../../shared/components/chart-card/chart-card.component';
import { BusinessDatePipe, BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';
import { VndCurrencyPipe } from '../../shared/pipes/vnd-currency.pipe';

@Component({
  selector: 'app-subscriptions-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    ChartCardComponent,
    BusinessDatePipe,
    BusinessDateTimePipe,
    VndCurrencyPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-7xl mx-auto pb-12">

      <app-page-header
        title="Gói cước & Hạn ngạch tài nguyên (SaaS Billing)"
        [subtitle]="showVnpay
          ? 'Quản trị dung lượng phòng, chi nhánh, nhân sự, thanh toán nâng cấp qua VietQR / VNPay và quản lý quyền hỗ trợ kỹ thuật.'
          : 'Quản trị dung lượng phòng, chi nhánh, nhân sự, thanh toán nâng cấp tự động qua VietQR (SePay) và quản lý quyền hỗ trợ kỹ thuật.'"
      >
        <a
          routerLink="/support-grants"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-700/70 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <i class="pi pi-shield" aria-hidden="true"></i>
          <span>Ủy quyền Hỗ trợ (D24)</span>
        </a>
        <button
          type="button"
          (click)="loadData()"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
          <span>Làm mới trạng thái</span>
        </button>
      </app-page-header>

      <!-- Pending Subscription Upgrade Payment Banner + SePay VietQR -->
      @if (activePendingPayment(); as pending) {
        <div
          role="region"
          aria-label="Hóa đơn nâng cấp đang chờ thanh toán"
          class="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 p-5 space-y-4 shadow-xs"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  {{ showVnpay ? 'Chờ xác nhận thanh toán (VietQR / VNPay)' : 'Chờ chuyển khoản VietQR (Tự động qua SePay)' }}
                </span>
                <span class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">{{ pending.invoiceNumber }}</span>
              </div>
              <p class="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                Yêu cầu nâng cấp trị giá {{ pending.amount | vndCurrency }} ({{ pending.billingCycle || 'Monthly' }})
                — Mã tham chiếu: <span class="font-mono">{{ pending.transactionRef }}</span>
              </p>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                Quét mã VietQR bên dưới để chuyển khoản. Hệ thống tự động kiểm tra mỗi 5 giây và kích hoạt gói cước mới ngay khi SePay xác nhận.
              </p>
            </div>

            <div class="flex items-center gap-2.5 flex-wrap shrink-0">
              @if (showVnpay && pendingPaymentUrl(); as checkoutUrl) {
                <a
                  [href]="checkoutUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <i class="pi pi-external-link" aria-hidden="true"></i>
                  <span>Thanh toán qua VNPay</span>
                </a>
              }
              <button
                type="button"
                (click)="loadData()"
                [disabled]="isLoading()"
                class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-amber-300 dark:border-amber-700 text-xs font-bold disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
                <span>{{ isLoading() ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái thanh toán' }}</span>
              </button>
            </div>
          </div>

          <!-- SePay VietQR Panel -->
          <div class="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70">
            @if (isLoadingVietQr()) {
              <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 py-3">
                <i class="pi pi-spin pi-spinner text-amber-600" aria-hidden="true"></i>
                <span>Đang tải mã VietQR thanh toán gói cước...</span>
              </div>
            } @else if (subscriptionVietQr(); as qr) {
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <img
                  [src]="qr.qrImageUrl"
                  alt="Mã VietQR nâng cấp gói cước"
                  width="128"
                  height="128"
                  loading="lazy"
                  class="w-32 h-32 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1.5 shrink-0"
                />
                <div class="space-y-1.5 text-xs flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                      VIETQR 24/7 (SEPAY)
                    </span>
                    <span class="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                      <i class="pi pi-sync text-[10px] text-emerald-600" aria-hidden="true"></i>
                      <span>Tự động đối soát mỗi 5 giây</span>
                    </span>
                  </div>
                  <div class="text-slate-700 dark:text-slate-200">
                    Ngân hàng: <strong class="text-slate-900 dark:text-white">{{ qr.bankName }}</strong>
                  </div>
                  <div class="text-slate-700 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                    <span>Số tài khoản: <strong class="font-mono text-indigo-700 dark:text-indigo-300">{{ qr.bankAccountNumber }}</strong></span>
                    <button
                      type="button"
                      (click)="copyVietQrField(qr.bankAccountNumber, 'account')"
                      class="min-h-11 px-2.5 rounded-lg inline-flex items-center text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:underline cursor-pointer"
                    >
                      {{ copiedField() === 'account' ? 'Đã sao chép' : 'Sao chép STK' }}
                    </button>
                  </div>
                  <div class="text-slate-700 dark:text-slate-200">
                    Chủ tài khoản: <strong class="text-slate-900 dark:text-white">{{ qr.bankAccountHolder }}</strong>
                  </div>
                  <div class="text-emerald-700 dark:text-emerald-400 font-mono font-bold tabular-nums">
                    Số tiền: {{ qr.amount | vndCurrency }}
                  </div>
                  <div class="flex items-center gap-2 flex-wrap pt-0.5">
                    <span class="text-slate-600 dark:text-slate-300">Nội dung CK:</span>
                    <span class="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700 font-mono font-bold text-amber-900 dark:text-amber-200 break-all">
                      {{ qr.transferContent }}
                    </span>
                    <button
                      type="button"
                      (click)="copyVietQrField(qr.transferContent, 'content')"
                      class="min-h-11 px-2.5 rounded-lg inline-flex items-center text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:underline cursor-pointer"
                    >
                      {{ copiedField() === 'content' ? 'Đã sao chép nội dung' : 'Sao chép nội dung' }}
                    </button>
                  </div>
                </div>
              </div>
            } @else if (vietQrError()) {
              <div class="flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
                <span>{{ vietQrError() }}</span>
                <button
                  type="button"
                  (click)="loadSubscriptionVietQr(pending.id, true)"
                  class="min-h-11 px-3 rounded-lg inline-flex items-center font-bold underline hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer shrink-0"
                >
                  Tải lại mã QR
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Current Subscription Banner Card + Quota ChartCard -->
      @if (currentSub(); as sub) {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div class="lg:col-span-5 min-w-0 relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between gap-5">
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
                <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                  {{ sub.pricePerCycle | vndCurrency }}
                  <span class="text-sm font-normal text-slate-600 dark:text-slate-400">
                    / {{ sub.billingCycle === 'Annual' ? 'năm' : 'tháng' }}
                  </span>
                </div>
                <div class="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                  Chu kỳ hiện tại đến hết: <strong>{{ sub.currentPeriodEndUtc | businessDate }}</strong>
                  (Tự động gia hạn: {{ sub.autoRenew ? 'Bật' : 'Tắt' }})
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <span class="font-semibold text-xs text-slate-700 dark:text-slate-300 block">Phòng lưu trú</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    @if (computeQuotaUtilizationPercent(sub.currentRoomCount, sub.maxRoomsAllowed); as pct) {
                      <span class="tabular-nums">Đã dùng {{ pct }}%</span>
                    } @else {
                      <span>Không giới hạn</span>
                    }
                  </span>
                </div>
                <span class="font-bold font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ sub.currentRoomCount }} / {{ isUnlimitedQuota(sub.maxRoomsAllowed) ? 'Không giới hạn' : sub.maxRoomsAllowed }}
                </span>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <span class="font-semibold text-xs text-slate-700 dark:text-slate-300 block">Chi nhánh</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    @if (computeQuotaUtilizationPercent(sub.currentPropertyCount, sub.maxPropertiesAllowed); as pct) {
                      <span class="tabular-nums">Đã dùng {{ pct }}%</span>
                    } @else {
                      <span>Không giới hạn</span>
                    }
                  </span>
                </div>
                <span class="font-bold font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ sub.currentPropertyCount }} / {{ isUnlimitedQuota(sub.maxPropertiesAllowed) ? 'Không giới hạn' : sub.maxPropertiesAllowed }}
                </span>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <span class="font-semibold text-xs text-slate-700 dark:text-slate-300 block">Nhân sự RBAC</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    @if (computeQuotaUtilizationPercent(sub.currentStaffCount ?? 0, sub.maxStaffAllowed); as pct) {
                      <span class="tabular-nums">Đã dùng {{ pct }}%</span>
                    } @else {
                      <span>Không giới hạn</span>
                    }
                  </span>
                </div>
                <span class="font-bold font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ sub.currentStaffCount ?? 0 }} / {{ isUnlimitedQuota(sub.maxStaffAllowed) ? 'Không giới hạn' : sub.maxStaffAllowed }}
                </span>
              </div>
            </div>
          </div>

          <div class="lg:col-span-7 min-w-0">
            <app-chart-card
              title="Mức tiêu thụ hạn ngạch tài nguyên SaaS"
              [subtitle]="quotaChartSubtitle()"
              chartType="bar"
              [labels]="quotaChartLabels()"
              [datasets]="quotaChartDatasets()"
              [loading]="isLoading()"
              [error]="loadError()"
              valueUnit="đơn vị"
              [heightPx]="250"
              emptyTitle="Chưa có dữ liệu hạn ngạch"
              emptyDescription="Chưa nhận được thông tin hạn ngạch gói cước hiện tại."
              (retry)="loadData()"
            />
          </div>
        </div>
      } @else if (isLoading() || loadError()) {
        <app-chart-card
          title="Mức tiêu thụ hạn ngạch tài nguyên SaaS"
          subtitle="Theo dõi dung lượng phòng, chi nhánh và nhân sự theo gói cước"
          chartType="bar"
          [labels]="[]"
          [datasets]="[]"
          [loading]="isLoading()"
          [error]="loadError()"
          (retry)="loadData()"
        />
      }

      <!-- Billing Cycle Switch & Plans Grid -->
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">Bảng giá gói dịch vụ</h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">Cập nhật trực tiếp từ danh mục gói cước của nền tảng.</p>
          </div>

          <div class="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
            <button
              type="button"
              (click)="billingCycle.set(0)"
              [attr.aria-pressed]="billingCycle() === 0"
              class="min-h-11 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              [ngClass]="billingCycle() === 0 ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-300'"
            >
              Thanh toán Tháng
            </button>
            <button
              type="button"
              (click)="billingCycle.set(1)"
              [attr.aria-pressed]="billingCycle() === 1"
              class="min-h-11 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              [ngClass]="billingCycle() === 1 ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300'"
            >
              Thanh toán Năm (Tiết kiệm)
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (plan of plans(); track plan.tier) {
            <div
              class="relative rounded-2xl border bg-white dark:bg-slate-900 p-6 flex flex-col justify-between transition-all"
              [class.border-emerald-500]="plan.isPopular"
              [class.shadow-md]="plan.isPopular"
              [class.border-slate-200]="!plan.isPopular"
              [class.dark:border-slate-700]="!plan.isPopular"
            >
              @if (plan.isPopular) {
                <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {{ plan.badge || 'Phổ biến nhất' }}
                </span>
              }

              <div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ plan.name }}</h3>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 min-h-[36px]">{{ plan.description }}</p>

                <div class="my-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                  <div class="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ (billingCycle() === 1 ? plan.annualPrice : plan.monthlyPrice) | vndCurrency }}
                    <span class="text-xs font-normal text-slate-600 dark:text-slate-400">
                      / {{ billingCycle() === 1 ? 'năm' : 'tháng' }}
                    </span>
                  </div>
                </div>

                <div class="my-4 py-3 border-y border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-600 dark:text-slate-400">Quy mô phòng</span>
                    <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {{ isUnlimitedQuota(plan.maxRooms) ? 'Không giới hạn' : plan.maxRooms + ' phòng' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600 dark:text-slate-400">Số chi nhánh</span>
                    <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {{ isUnlimitedQuota(plan.maxProperties) ? 'Không giới hạn' : plan.maxProperties + ' chi nhánh' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600 dark:text-slate-400">Tài khoản nhân sự</span>
                    <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {{ isUnlimitedQuota(plan.maxStaff) ? 'Không giới hạn' : plan.maxStaff + ' nhân viên' }}
                    </span>
                  </div>
                </div>

                <div class="space-y-2 mb-6">
                  @for (feat of plan.features; track feat) {
                    <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <i class="pi pi-check text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden="true"></i>
                      <span>{{ feat }}</span>
                    </div>
                  }
                </div>
              </div>

              @if (currentSub()?.tier === plan.tier) {
                <button
                  type="button"
                  disabled
                  class="w-full min-h-11 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                >
                  <i class="pi pi-check-circle mr-1.5" aria-hidden="true"></i> Đang sử dụng gói này
                </button>
              } @else {
                <button
                  type="button"
                  (click)="upgradeTo(plan)"
                  [disabled]="isUpgrading()"
                  class="w-full min-h-11 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  [class.bg-emerald-600]="plan.isPopular"
                  [class.hover:bg-emerald-700]="plan.isPopular"
                  [class.bg-slate-900]="!plan.isPopular"
                  [class.hover:bg-slate-800]="!plan.isPopular"
                >
                  {{ isUpgrading() ? 'Đang khởi tạo hóa đơn...' : (showVnpay ? 'Nâng cấp qua VietQR / VNPay' : 'Nâng cấp qua VietQR (SePay)') }}
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Recent Payments History -->
      @if ((currentSub()?.recentPayments?.length ?? 0) > 0) {
        <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-2xs">
          <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Lịch sử thanh toán gói cước SaaS</h2>
          </div>

          <!-- Mobile Stacked Cards (<768px) -->
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800" data-testid="subscriptions-payments-mobile-cards">
            @for (p of currentSub()?.recentPayments ?? []; track p.id) {
              <article class="p-4 space-y-2.5 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate">
                      {{ p.invoiceNumber || '—' }}
                    </div>
                    <div class="font-mono text-slate-500 dark:text-slate-400 tabular-nums truncate mt-0.5">
                      Mã GD: {{ p.transactionRef || '—' }}
                    </div>
                  </div>
                  <app-status-badge [status]="p.status" type="payment" />
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1 tabular-nums">
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <span class="text-slate-500 dark:text-slate-400 block">Số tiền</span>
                    <strong class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ p.amount | vndCurrency }}</strong>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <span class="text-slate-500 dark:text-slate-400 block">Cổng thanh toán</span>
                    <strong class="text-slate-800 dark:text-slate-200">{{ p.method }}</strong>
                  </div>
                </div>

                <div class="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Thời gian (UTC+7): {{ (p.paidAtUtc || p.createdAtUtc) | businessDateTime }}
                </div>
              </article>
            }
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="py-3 px-4">Số hóa đơn</th>
                  <th scope="col" class="py-3 px-4">Mã giao dịch</th>
                  <th scope="col" class="py-3 px-4 text-right">Số tiền</th>
                  <th scope="col" class="py-3 px-4">Cổng</th>
                  <th scope="col" class="py-3 px-4">Trạng thái</th>
                  <th scope="col" class="py-3 px-4">Thời gian (UTC+7)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (p of currentSub()?.recentPayments ?? []; track p.id) {
                  <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{{ p.invoiceNumber || '—' }}</td>
                    <td class="py-3 px-4 font-mono tabular-nums">{{ p.transactionRef || '—' }}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ p.amount | vndCurrency }}</td>
                    <td class="py-3 px-4">{{ p.method }}</td>
                    <td class="py-3 px-4">
                      <app-status-badge [status]="p.status" type="payment" />
                    </td>
                    <td class="py-3 px-4 font-mono tabular-nums">{{ (p.paidAtUtc || p.createdAtUtc) | businessDateTime }}</td>
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
  private readonly destroyRef = inject(DestroyRef);

  readonly showVnpay = environment.enableVnpay;
  readonly isLoading = signal(false);
  readonly isUpgrading = signal(false);
  readonly isConfirming = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly billingCycle = signal<0 | 1>(0);
  readonly currentSub = signal<TenantSubscriptionDto | null>(null);
  readonly plans = signal<SubscriptionPackageDto[]>([]);
  readonly lastInitiation = signal<SubscriptionUpgradeInitiationDto | null>(null);
  readonly subscriptionVietQr = signal<SubscriptionVietQrDto | null>(null);
  readonly isLoadingVietQr = signal(false);
  readonly vietQrError = signal<string | null>(null);
  readonly copiedField = signal<'account' | 'content' | null>(null);

  private loadedVietQrPaymentId: string | null = null;
  private pollingInterval?: ReturnType<typeof setInterval>;
  private copyTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopStatusPolling();
      if (this.copyTimer) {
        clearTimeout(this.copyTimer);
        this.copyTimer = undefined;
      }
    });

    effect(() => {
      const pending = this.activePendingPayment();
      untracked(() => {
        if (pending?.id) {
          if (this.loadedVietQrPaymentId !== pending.id) {
            this.loadSubscriptionVietQr(pending.id);
          }
          this.startStatusPolling();
        } else {
          this.stopStatusPolling();
          this.loadedVietQrPaymentId = null;
          this.subscriptionVietQr.set(null);
          this.vietQrError.set(null);
          this.isLoadingVietQr.set(false);
        }
      });
    });
  }

  readonly quotaChartLabels = computed<readonly string[]>(() => {
    const sub = this.currentSub();
    if (!sub) return [];
    return [
      `Phòng (${this.formatQuotaLimit(sub.maxRoomsAllowed)})`,
      `Chi nhánh (${this.formatQuotaLimit(sub.maxPropertiesAllowed)})`,
      `Nhân sự (${this.formatQuotaLimit(sub.maxStaffAllowed)})`
    ];
  });

  readonly quotaChartSubtitle = computed(() => {
    const sub = this.currentSub();
    if (!sub) return '';
    const hasUnlimited =
      this.isUnlimitedQuota(sub.maxRoomsAllowed) ||
      this.isUnlimitedQuota(sub.maxPropertiesAllowed) ||
      this.isUnlimitedQuota(sub.maxStaffAllowed);
    return hasUnlimited
      ? 'Các tài nguyên ở mức Không giới hạn được hiển thị theo số lượng sử dụng thực tế.'
      : 'So sánh số lượng đang sử dụng và phần hạn mức còn lại của gói cước hiện tại.';
  });

  readonly quotaChartDatasets = computed<readonly ChartCardDataset[]>(() => {
    const sub = this.currentSub();
    if (!sub) return [];

    const usedRooms = sub.currentRoomCount ?? 0;
    const usedProps = sub.currentPropertyCount ?? 0;
    const usedStaff = sub.currentStaffCount ?? 0;

    const remRooms = this.isUnlimitedQuota(sub.maxRoomsAllowed)
      ? 0
      : Math.max(0, sub.maxRoomsAllowed - usedRooms);
    const remProps = this.isUnlimitedQuota(sub.maxPropertiesAllowed)
      ? 0
      : Math.max(0, sub.maxPropertiesAllowed - usedProps);
    const remStaff = this.isUnlimitedQuota(sub.maxStaffAllowed)
      ? 0
      : Math.max(0, (sub.maxStaffAllowed ?? 0) - usedStaff);

    const datasets: ChartCardDataset[] = [
      {
        label: 'Đang sử dụng',
        data: [usedRooms, usedProps, usedStaff],
        backgroundColor: '#059669',
        borderColor: '#047857'
      }
    ];

    const hasAnyFiniteLimit =
      !this.isUnlimitedQuota(sub.maxRoomsAllowed) ||
      !this.isUnlimitedQuota(sub.maxPropertiesAllowed) ||
      !this.isUnlimitedQuota(sub.maxStaffAllowed);

    if (hasAnyFiniteLimit) {
      datasets.push({
        label: 'Còn lại theo hạn mức',
        data: [remRooms, remProps, remStaff],
        backgroundColor: '#cbd5e1',
        borderColor: '#94a3b8'
      });
    }

    return datasets;
  });

  readonly activePendingPayment = computed(() => {
    const subPending = this.currentSub()?.pendingPayment;
    if (subPending) return subPending;
    const init = this.lastInitiation();
    if (!init || init.paymentStatus !== 'Pending') return null;
    return {
      id: init.paymentId,
      amount: init.amount,
      method: this.showVnpay ? 'VNPay' : 'BankTransfer',
      status: init.paymentStatus,
      transactionRef: init.transactionRef,
      invoiceNumber: init.invoiceNumber,
      createdAtUtc: new Date().toISOString(),
      targetTier: init.targetTier,
      billingCycle: init.billingCycle
    };
  });

  readonly pendingPaymentUrl = computed(() => this.lastInitiation()?.paymentUrl ?? null);

  isUnlimitedQuota(max: number | undefined | null): boolean {
    return max === undefined || max === null || max >= 999;
  }

  formatQuotaLimit(max: number | undefined | null): string {
    return this.isUnlimitedQuota(max) ? 'Không giới hạn' : `Tối đa ${max}`;
  }

  computeQuotaUtilizationPercent(used: number, max: number | undefined | null): number | null {
    if (this.isUnlimitedQuota(max) || !max || max <= 0) {
      return null;
    }
    return Math.min(100, Math.round((used / max) * 100));
  }

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
      this.subscriptionService
        .verifyVnpayReturn(vnpQuery)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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
    this.loadError.set(null);

    this.subscriptionService
      .getCurrentSubscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.currentSub.set(res);
          this.isLoading.set(false);
        },
        error: err => {
          this.isLoading.set(false);
          const msg = err?.error?.message || err?.message || 'Lỗi kết nối';
          this.loadError.set(`Không thể tải thông tin gói cước: ${msg}`);
          this.alertService.error('Không thể tải thông tin gói cước: ' + msg);
        }
      });

    this.subscriptionService
      .getAvailablePlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => this.plans.set(res || []),
        error: err => this.alertService.error('Không thể tải danh sách gói cước: ' + (err?.error?.message || err?.message || 'Lỗi kết nối'))
      });
  }

  loadSubscriptionVietQr(paymentId: string, force: boolean = false): void {
    if (!paymentId) return;
    if (!force && this.loadedVietQrPaymentId === paymentId && this.subscriptionVietQr()) return;

    this.loadedVietQrPaymentId = paymentId;
    this.isLoadingVietQr.set(true);
    this.vietQrError.set(null);

    this.subscriptionService
      .getSubscriptionVietQr(paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: qr => {
          if (this.activePendingPayment()?.id !== paymentId) return;
          this.subscriptionVietQr.set(qr);
          this.isLoadingVietQr.set(false);
        },
        error: err => {
          if (this.loadedVietQrPaymentId === paymentId) {
            this.loadedVietQrPaymentId = null;
          }
          this.isLoadingVietQr.set(false);
          this.subscriptionVietQr.set(null);
          this.vietQrError.set(
            err?.error?.message || 'Chưa tải được mã VietQR nâng cấp gói cước. Vui lòng thử lại.'
          );
        }
      });
  }

  private startStatusPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      if (this.destroyRef.destroyed || !this.activePendingPayment()) {
        this.stopStatusPolling();
        return;
      }

      this.subscriptionService
        .getCurrentSubscription()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => {
            if (this.destroyRef.destroyed) return;
            const hadPending = Boolean(this.activePendingPayment());
            this.currentSub.set(res);
            if (hadPending && !res.pendingPayment) {
              this.stopStatusPolling();
              this.lastInitiation.set(null);
              this.loadedVietQrPaymentId = null;
              this.subscriptionVietQr.set(null);
              this.alertService.toastSuccess(
                `Gói cước "${res.tierName}" đã được kích hoạt tự động qua SePay!`,
                'Nâng cấp thành công'
              );
            }
          },
          error: () => {
            // Bỏ qua lỗi mạng tạm thời trong quá trình polling nền
          }
        });
    }, 5000);
  }

  private stopStatusPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  copyVietQrField(value: string, field: 'account' | 'content'): void {
    if (!value) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      this.alertService.toastWarning('Trình duyệt không hỗ trợ sao chép tự động.');
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => {
        this.copiedField.set(field);
        this.alertService.toastSuccess(
          field === 'account' ? 'Đã sao chép số tài khoản.' : 'Đã sao chép nội dung chuyển khoản.'
        );
        if (this.copyTimer) {
          clearTimeout(this.copyTimer);
        }
        this.copyTimer = setTimeout(() => {
          this.copiedField.set(null);
          this.copyTimer = undefined;
        }, 2000);
      },
      () => this.alertService.toastWarning('Không thể sao chép tự động. Vui lòng sao chép thủ công.')
    );
  }

  async upgradeTo(plan: SubscriptionPackageDto): Promise<void> {
    const cycle = this.billingCycle();
    const price = cycle === 1 ? plan.annualPrice : plan.monthlyPrice;
    const cycleText = cycle === 1 ? 'năm' : 'tháng';
    const paymentMethodLabel = this.showVnpay ? 'VietQR / VNPay' : 'VietQR (SePay)';
    const confirmed = await this.alertService.confirmAction({
      title: 'Khởi tạo hóa đơn nâng cấp?',
      text: `Khởi tạo hóa đơn nâng cấp "${plan.name}" (${price.toLocaleString('vi-VN')} ₫/${cycleText}) qua ${paymentMethodLabel}?`,
      confirmButtonText: 'Khởi tạo thanh toán',
      cancelButtonText: 'Hủy',
      icon: 'question'
    });
    if (!confirmed) {
      return;
    }

    const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/subscriptions` : undefined;
    this.isUpgrading.set(true);
    this.subscriptionService
      .upgradeSubscription(plan.tier, cycle, returnUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
