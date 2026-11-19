import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  BusinessDateTimePipe,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent
} from '../../shared';
import { PromotionService } from '../../core/services/promotion.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  CreatePromotionRequest,
  PROMOTION_TYPE_LABELS,
  PromotionDto,
  PromotionType,
  UpdatePromotionRequest
} from '../../core/models/promotion.model';

function toVnDatetimeLocalInput(isoUtc: string): string {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const vnMillis = date.getTime() + 7 * 60 * 60 * 1000;
  const vn = new Date(vnMillis);
  const y = vn.getUTCFullYear();
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vn.getUTCDate()).padStart(2, '0');
  const h = String(vn.getUTCHours()).padStart(2, '0');
  const min = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function getDefaultVnDatetimeLocal(addDays: number, hour: number, minute: number): string {
  const nowVn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  nowVn.setUTCDate(nowVn.getUTCDate() + addDays);
  const y = nowVn.getUTCFullYear();
  const m = String(nowVn.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nowVn.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function vnDatetimeLocalToUtcIso(localValue: string): string {
  const trimmed = localValue.trim();
  const parsed = new Date(`${trimmed}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(trimmed).toISOString();
  }
  return parsed.toISOString();
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string; title?: string; errors?: Record<string, string[]> } | null;
    if (body?.message) return body.message;
    if (body?.errors) {
      const firstKey = Object.keys(body.errors)[0];
      if (firstKey && body.errors[firstKey]?.length) {
        return body.errors[firstKey][0];
      }
    }
    if (body?.title) return body.title;
  }
  return fallback;
}

@Component({
  selector: 'app-promotions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    A11yModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    BusinessDateTimePipe
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <app-page-header
        title="Quản lý Khuyến mãi & Mã ưu đãi"
        subtitle="Tạo và kiểm soát mã giảm giá theo phần trăm, số tiền cố định hoặc tặng đêm miễn phí cho toàn bộ chi nhánh."
      >
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 text-xs text-slate-600 font-medium border border-slate-200/70">
            <i class="pi pi-clock text-emerald-600" aria-hidden="true"></i>
            <span>Múi giờ UTC+7</span>
          </div>

          @if (canCreate()) {
            <button
              type="button"
              (click)="openCreateModal()"
              class="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
            >
              <i class="pi pi-plus text-xs" aria-hidden="true"></i>
              <span>Tạo mã khuyến mãi</span>
            </button>
          }
        </div>
      </app-page-header>

      <!-- KPI Strip -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card
          title="Tổng chiến dịch"
          [value]="promotions().length"
          subtitle="Toàn doanh nghiệp"
          variant="indigo"
        >
          <i icon class="pi pi-ticket text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="Đang kích hoạt"
          [value]="activeCount()"
          subtitle="Sẵn sàng áp dụng"
          variant="emerald"
        >
          <i icon class="pi pi-check-circle text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="Lượt đã sử dụng"
          [value]="totalUsage()"
          subtitle="Đơn giữ chỗ đã quy đổi"
          variant="amber"
        >
          <i icon class="pi pi-users text-lg" aria-hidden="true"></i>
        </app-stat-card>

        <app-stat-card
          title="Đang tạm ngừng"
          [value]="inactiveCount()"
          subtitle="Đã tắt hoặc chờ mở"
          variant="slate"
        >
          <i icon class="pi pi-pause-circle text-lg" aria-hidden="true"></i>
        </app-stat-card>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div class="relative flex-1 max-w-md">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
            <label for="promo-search-input" class="sr-only">Tìm kiếm mã khuyến mãi</label>
            <input
              id="promo-search-input"
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm theo mã (VD: SUMMER20) hoặc tên chương trình..."
              class="min-h-[44px] w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500 transition-all"
            />
          </div>

          <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              (click)="setStatusFilter('all')"
              [ngClass]="statusFilter() === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="min-h-[44px] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Tất cả
            </button>
            <button
              type="button"
              (click)="setStatusFilter('active')"
              [ngClass]="statusFilter() === 'active' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="min-h-[44px] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Đang bật
            </button>
            <button
              type="button"
              (click)="setStatusFilter('inactive')"
              [ngClass]="statusFilter() === 'inactive' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'"
              class="min-h-[44px] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Đang tắt
            </button>
          </div>
        </div>

        <button
          type="button"
          (click)="loadPromotions()"
          [disabled]="loading()"
          class="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          <i class="pi pi-refresh text-xs text-emerald-600" [class.pi-spin]="loading()" aria-hidden="true"></i>
          <span>Làm mới</span>
        </button>
      </div>

      @if (errorMessage()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-rose-600 text-base" aria-hidden="true"></i>
            <span>{{ errorMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="loadPromotions()"
            class="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      }

      @if (loading()) {
        <div class="py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80">
          <app-loading-spinner size="lg" message="Đang tải danh sách mã khuyến mãi..." />
        </div>
      } @else if (filteredPromotions().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-2xs">
          <app-empty-state
            iconClass="pi pi-ticket"
            title="Chưa có chương trình khuyến mãi phù hợp"
            description="Hãy tạo mã khuyến mãi mới để kích cầu đặt phòng trực tuyến và thu hút khách quay lại."
          />
          @if (canCreate()) {
            <div class="mt-4 flex justify-center">
              <button
                type="button"
                (click)="openCreateModal()"
                class="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
              >
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                <span>Tạo mã khuyến mãi đầu tiên</span>
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs overflow-hidden">
          <!-- Mobile Cards (< md) -->
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            @for (promo of filteredPromotions(); track promo.id) {
              <div class="p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono font-bold text-xs tracking-wide">
                      {{ promo.code }}
                    </span>
                    <p class="font-semibold text-slate-900 dark:text-slate-100 mt-1.5">{{ promo.name }}</p>
                    @if (promo.description) {
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{{ promo.description }}</p>
                    }
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <app-status-badge
                      [status]="promo.isActive"
                      type="custom"
                      [customLabel]="promo.isActive ? 'Đang kích hoạt' : 'Đang tạm ngừng'"
                      [color]="promo.isActive ? 'emerald' : 'slate'"
                    />
                    @if (isExpired(promo)) {
                      <app-status-badge status="expired" type="custom" customLabel="Đã hết hạn" color="amber" />
                    }
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5">
                  <div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">Ưu đãi</div>
                    <div class="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">{{ formatOfferBadge(promo) }}</div>
                  </div>
                  <div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">Lượt dùng / Tối thiểu</div>
                    <div class="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {{ promo.currentUsage }}@if (promo.maxUsage !== null && promo.maxUsage !== undefined) {/{{ promo.maxUsage }}} · {{ promo.minNights }} đêm
                    </div>
                  </div>
                  <div class="col-span-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                    Hiệu lực: {{ promo.startsAtUtc | businessDateTime }} – {{ promo.endsAtUtc | businessDateTime }}
                  </div>
                </div>

                @if (canUpdate()) {
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      (click)="openEditModal(promo)"
                      [attr.aria-label]="'Chỉnh sửa mã ' + promo.code"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      (click)="toggleStatus(promo)"
                      [disabled]="togglingId() === promo.id"
                      [attr.aria-label]="(promo.isActive ? 'Tạm ngừng mã ' : 'Kích hoạt mã ') + promo.code"
                      [ngClass]="promo.isActive
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'"
                      class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <i [class]="promo.isActive ? 'pi pi-pause text-xs' : 'pi pi-play text-xs'" aria-hidden="true"></i>
                      <span>{{ promo.isActive ? 'Tạm ngừng' : 'Kích hoạt' }}</span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Desktop Table (>= md) -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr class="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('code')">
                    <button type="button" (click)="toggleSort('code')" class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
                      <span>Mã &amp; Tên chương trình</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('code')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('type')">
                    <button type="button" (click)="toggleSort('type')" class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
                      <span>Loại ưu đãi</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('type')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('usage')">
                    <button type="button" (click)="toggleSort('usage')" class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
                      <span>Điều kiện &amp; Lượt dùng</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('usage')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('endsAt')">
                    <button type="button" (click)="toggleSort('endsAt')" class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
                      <span>Hiệu lực (UTC+7)</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('endsAt')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5">Trạng thái</th>
                  <th scope="col" class="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                @for (promo of filteredPromotions(); track promo.id) {
                  <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="px-5 py-4 align-top">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono font-bold text-xs tracking-wide">
                          {{ promo.code }}
                        </span>
                      </div>
                      <p class="font-semibold text-slate-900 dark:text-slate-100 mt-1.5">{{ promo.name }}</p>
                      @if (promo.description) {
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 max-w-xs">{{ promo.description }}</p>
                      }
                    </td>

                    <td class="px-5 py-4 align-top">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-xs tabular-nums">
                        {{ formatOfferBadge(promo) }}
                      </span>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{{ getTypeLabel(promo.type) }}</p>
                    </td>

                    <td class="px-5 py-4 align-top text-xs text-slate-700 dark:text-slate-300 space-y-1 tabular-nums">
                      <div>
                        Tối thiểu: <strong class="font-semibold tabular-nums">{{ promo.minNights }} đêm</strong>
                      </div>
                      <div>
                        Đã dùng:
                        <strong class="font-mono font-semibold tabular-nums">{{ promo.currentUsage }}</strong>
                        @if (promo.maxUsage !== null && promo.maxUsage !== undefined) {
                          <span class="text-slate-500 dark:text-slate-400 tabular-nums">/ {{ promo.maxUsage }} lượt</span>
                        } @else {
                          <span class="text-slate-500 dark:text-slate-400">(Không giới hạn)</span>
                        }
                      </div>
                    </td>

                    <td class="px-5 py-4 align-top text-xs text-slate-700 dark:text-slate-300 space-y-1 whitespace-nowrap tabular-nums">
                      <div>
                        <span class="text-slate-500 dark:text-slate-400">Từ:</span>
                        <strong class="ml-1 font-medium text-slate-800 dark:text-slate-200 tabular-nums">{{ promo.startsAtUtc | businessDateTime }}</strong>
                      </div>
                      <div>
                        <span class="text-slate-500 dark:text-slate-400">Đến:</span>
                        <strong class="ml-1 font-medium text-slate-800 dark:text-slate-200 tabular-nums">{{ promo.endsAtUtc | businessDateTime }}</strong>
                      </div>
                    </td>

                    <td class="px-5 py-4 align-top">
                      <div class="flex flex-col items-start gap-1.5">
                        <app-status-badge
                          [status]="promo.isActive"
                          type="custom"
                          [customLabel]="promo.isActive ? 'Đang kích hoạt' : 'Đang tạm ngừng'"
                          [color]="promo.isActive ? 'emerald' : 'slate'"
                        />
                        @if (isExpired(promo)) {
                          <app-status-badge
                            status="expired"
                            type="custom"
                            customLabel="Đã hết hạn"
                            color="amber"
                          />
                        }
                      </div>
                    </td>

                    <td class="px-5 py-4 align-top text-right">
                      <div class="inline-flex items-center justify-end gap-2">
                        @if (canUpdate()) {
                          <button
                            type="button"
                            (click)="openEditModal(promo)"
                            [attr.aria-label]="'Chỉnh sửa mã ' + promo.code"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            (click)="toggleStatus(promo)"
                            [disabled]="togglingId() === promo.id"
                            [attr.aria-label]="(promo.isActive ? 'Tạm ngừng mã ' : 'Kích hoạt mã ') + promo.code"
                            [ngClass]="promo.isActive
                              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'"
                            class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <i [class]="promo.isActive ? 'pi pi-pause text-xs' : 'pi pi-play text-xs'" aria-hidden="true"></i>
                            <span>{{ promo.isActive ? 'Tạm ngừng' : 'Kích hoạt' }}</span>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Create / Edit Modal -->
      @if (showModal()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="onBackdropClick($event)"
        >
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h2 id="promo-modal-title" class="text-base sm:text-lg font-bold text-slate-900">
                  {{ editingPromo() ? 'Cập nhật mã khuyến mãi' : 'Tạo mã khuyến mãi mới' }}
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Mã khuyến mãi áp dụng toàn doanh nghiệp và được chuẩn hóa chữ in hoa.
                </p>
              </div>
              <button
                type="button"
                (click)="closeModal()"
                aria-label="Đóng hộp thoại khuyến mãi"
                class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form [formGroup]="promoForm" (ngSubmit)="submitForm()" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              @if (modalError()) {
                <div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center gap-2">
                  <i class="pi pi-exclamation-circle text-rose-600" aria-hidden="true"></i>
                  <span>{{ modalError() }}</span>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="promo-code" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mã khuyến mãi <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="promo-code"
                    type="text"
                    formControlName="code"
                    (input)="normalizeCodeInput()"
                    placeholder="VD: SUMMER2026"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-hidden focus:border-emerald-500"
                  />
                  <p class="text-[11px] text-slate-500 mt-1">Chỉ gồm chữ cái không dấu, số, dấu gạch ngang (-) hoặc gạch dưới (_).</p>
                </div>

                <div>
                  <label for="promo-name" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tên chương trình <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="promo-name"
                    type="text"
                    formControlName="name"
                    placeholder="VD: Ưu đãi mùa hè giảm 20%"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="promo-type" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loại khuyến mãi <span class="text-rose-600">*</span>
                  </label>
                  <select
                    id="promo-type"
                    formControlName="type"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="PercentDiscount">Giảm theo phần trăm (%)</option>
                    <option value="FixedDiscount">Giảm số tiền cố định (VND)</option>
                    <option value="FreeNight">Tặng đêm miễn phí</option>
                  </select>
                </div>

                <div>
                  <label for="promo-value" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    @if (promoForm.get('type')?.value === 'PercentDiscount') {
                      Mức giảm (%) <span class="text-rose-600">*</span>
                    } @else if (promoForm.get('type')?.value === 'FixedDiscount') {
                      Số tiền giảm (VND) <span class="text-rose-600">*</span>
                    } @else {
                      Số đêm tặng <span class="text-rose-600">*</span>
                    }
                  </label>
                  <input
                    id="promo-value"
                    type="number"
                    formControlName="value"
                    min="1"
                    [attr.max]="promoForm.get('type')?.value === 'PercentDiscount' ? 100 : null"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="promo-min-nights" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Số đêm lưu trú tối thiểu <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="promo-min-nights"
                    type="number"
                    formControlName="minNights"
                    min="1"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label for="promo-max-usage" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Giới hạn lượt sử dụng (để trống = không giới hạn)
                  </label>
                  <input
                    id="promo-max-usage"
                    type="number"
                    formControlName="maxUsage"
                    min="1"
                    placeholder="VD: 100"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="promo-start" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Thời gian bắt đầu (UTC+7) <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="promo-start"
                    type="datetime-local"
                    formControlName="startsAtLocal"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label for="promo-end" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Thời gian kết thúc (UTC+7) <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="promo-end"
                    type="datetime-local"
                    formControlName="endsAtLocal"
                    class="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label for="promo-description" class="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mô tả chi tiết điều kiện áp dụng
                </label>
                <textarea
                  id="promo-description"
                  rows="2"
                  formControlName="description"
                  placeholder="Ghi chú phạm vi phòng áp dụng, mùa lễ hội hoặc quyền lợi kèm theo..."
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-emerald-500"
                ></textarea>
              </div>

              <label for="promo-active" class="flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none">
                <input
                  id="promo-active"
                  type="checkbox"
                  formControlName="isActive"
                  class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span class="text-sm font-medium text-slate-800">Kích hoạt mã khuyến mãi ngay sau khi lưu</span>
              </label>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  (click)="closeModal()"
                  [disabled]="saving()"
                  class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  [disabled]="saving()"
                  class="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  @if (saving()) {
                    <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                  }
                  <span>{{ editingPromo() ? 'Lưu thay đổi' : 'Tạo mã khuyến mãi' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class PromotionsPageComponent implements OnInit {
  private readonly promotionService = inject(PromotionService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly canRead = computed(() => this.authService.hasPermission('PROMOTIONS', 1));
  readonly canCreate = computed(() => this.authService.hasPermission('PROMOTIONS', 2));
  readonly canUpdate = computed(() => this.authService.hasPermission('PROMOTIONS', 4));

  readonly promotions = signal<PromotionDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly togglingId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly modalError = signal<string | null>(null);

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  readonly sortField = signal<'code' | 'type' | 'usage' | 'endsAt'>('endsAt');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly showModal = signal<boolean>(false);
  readonly editingPromo = signal<PromotionDto | null>(null);

  readonly activeCount = computed(() => this.promotions().filter(p => p.isActive).length);
  readonly inactiveCount = computed(() => this.promotions().filter(p => !p.isActive).length);
  readonly totalUsage = computed(() =>
    this.promotions().reduce((acc, item) => acc + (item.currentUsage || 0), 0)
  );

  readonly filteredPromotions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.statusFilter();
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    const list = this.promotions().filter(promo => {
      if (filter === 'active' && !promo.isActive) return false;
      if (filter === 'inactive' && promo.isActive) return false;
      if (!query) return true;
      return (
        promo.code.toLowerCase().includes(query) ||
        promo.name.toLowerCase().includes(query) ||
        (promo.description ?? '').toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      switch (field) {
        case 'code':
          return a.code.localeCompare(b.code) * dir;
        case 'type':
          return a.type.localeCompare(b.type) * dir;
        case 'usage':
          return ((a.currentUsage || 0) - (b.currentUsage || 0)) * dir;
        case 'endsAt':
        default:
          return (new Date(a.endsAtUtc).getTime() - new Date(b.endsAtUtc).getTime()) * dir;
      }
    });
  });

  toggleSort(field: 'code' | 'type' | 'usage' | 'endsAt'): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'endsAt' || field === 'usage' ? 'desc' : 'asc');
    }
  }

  getAriaSort(field: 'code' | 'type' | 'usage' | 'endsAt'): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(field: 'code' | 'type' | 'usage' | 'endsAt'): string {
    if (this.sortField() !== field) return 'pi-sort-alt text-slate-400';
    return this.sortDirection() === 'asc' ? 'pi-sort-amount-up text-emerald-600' : 'pi-sort-amount-down text-emerald-600';
  }

  promoForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(1000)]],
    type: ['PercentDiscount' as PromotionType, [Validators.required]],
    value: [15, [Validators.required, Validators.min(1)]],
    minNights: [1, [Validators.required, Validators.min(1)]],
    maxUsage: [null as number | null],
    startsAtLocal: [getDefaultVnDatetimeLocal(0, 0, 0), [Validators.required]],
    endsAtLocal: [getDefaultVnDatetimeLocal(30, 23, 59), [Validators.required]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.loadPromotions();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showModal() && !this.saving()) {
      this.closeModal();
    }
  }

  loadPromotions(): void {
    if (!this.canRead()) {
      this.errorMessage.set('Tài khoản hiện tại chưa được cấp quyền xem danh sách khuyến mãi.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.promotionService.getPromotions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.promotions.set(list);
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(extractApiErrorMessage(err, 'Không thể tải danh sách khuyến mãi. Vui lòng thử lại.'));
        this.loading.set(false);
      }
    });
  }

  setStatusFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(filter);
  }

  getTypeLabel(type: PromotionType): string {
    return PROMOTION_TYPE_LABELS[type] ?? type;
  }

  formatOfferBadge(promo: PromotionDto): string {
    if (promo.type === 'PercentDiscount') {
      return `Giảm ${promo.value}%`;
    }
    if (promo.type === 'FixedDiscount') {
      return `-${promo.value.toLocaleString('vi-VN')}₫`;
    }
    return `Tặng ${Math.max(1, Math.floor(promo.value))} đêm`;
  }

  isExpired(promo: PromotionDto): boolean {
    const endsAt = new Date(promo.endsAtUtc).getTime();
    return !Number.isNaN(endsAt) && endsAt < Date.now();
  }

  openCreateModal(): void {
    this.editingPromo.set(null);
    this.modalError.set(null);
    this.promoForm.reset({
      code: '',
      name: '',
      description: '',
      type: 'PercentDiscount',
      value: 15,
      minNights: 1,
      maxUsage: null,
      startsAtLocal: getDefaultVnDatetimeLocal(0, 0, 0),
      endsAtLocal: getDefaultVnDatetimeLocal(30, 23, 59),
      isActive: true
    });
    this.showModal.set(true);
  }

  openEditModal(promo: PromotionDto): void {
    this.editingPromo.set(promo);
    this.modalError.set(null);
    this.promoForm.reset({
      code: promo.code,
      name: promo.name,
      description: promo.description ?? '',
      type: promo.type,
      value: promo.value,
      minNights: promo.minNights,
      maxUsage: promo.maxUsage ?? null,
      startsAtLocal: toVnDatetimeLocalInput(promo.startsAtUtc),
      endsAtLocal: toVnDatetimeLocalInput(promo.endsAtUtc),
      isActive: promo.isActive
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingPromo.set(null);
    this.modalError.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving()) {
      this.closeModal();
    }
  }

  normalizeCodeInput(): void {
    const current = String(this.promoForm.get('code')?.value ?? '');
    const normalized = current.toUpperCase();
    if (current !== normalized) {
      this.promoForm.get('code')?.setValue(normalized, { emitEvent: false });
    }
  }

  submitForm(): void {
    this.modalError.set(null);
    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      this.modalError.set('Vui lòng kiểm tra lại các trường thông tin bắt buộc và định dạng mã khuyến mãi.');
      return;
    }

    const raw = this.promoForm.getRawValue() as {
      code: string;
      name: string;
      description: string;
      type: PromotionType;
      value: number;
      minNights: number;
      maxUsage: number | null;
      startsAtLocal: string;
      endsAtLocal: string;
      isActive: boolean;
    };

    const valueNum = Number(raw.value);
    if (Number.isNaN(valueNum) || valueNum <= 0) {
      this.modalError.set('Giá trị ưu đãi phải lớn hơn 0.');
      return;
    }
    if (raw.type === 'PercentDiscount' && valueNum > 100) {
      this.modalError.set('Mức giảm theo phần trăm không được vượt quá 100%.');
      return;
    }

    const startsAtUtc = vnDatetimeLocalToUtcIso(raw.startsAtLocal);
    const endsAtUtc = vnDatetimeLocalToUtcIso(raw.endsAtLocal);
    if (new Date(endsAtUtc).getTime() <= new Date(startsAtUtc).getTime()) {
      this.modalError.set('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }

    const maxUsageVal =
      raw.maxUsage !== null && raw.maxUsage !== undefined && String(raw.maxUsage) !== ''
        ? Number(raw.maxUsage)
        : null;
    if (maxUsageVal !== null && maxUsageVal < 1) {
      this.modalError.set('Giới hạn lượt sử dụng tối đa phải lớn hơn hoặc bằng 1.');
      return;
    }

    const payload: CreatePromotionRequest = {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      description: raw.description?.trim() ? raw.description.trim() : null,
      type: raw.type,
      value: valueNum,
      minNights: Math.max(1, Number(raw.minNights || 1)),
      maxUsage: maxUsageVal,
      startsAtUtc,
      endsAtUtc,
      isActive: Boolean(raw.isActive)
    };

    this.saving.set(true);
    const editing = this.editingPromo();

    if (editing) {
      const updatePayload: UpdatePromotionRequest = { id: editing.id, ...payload };
      this.promotionService.updatePromotion(editing.id, updatePayload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.promotions.update(list => list.map(item => (item.id === updated.id ? updated : item)));
          this.saving.set(false);
          this.closeModal();
          this.alertService.toastSuccess(`Đã cập nhật mã khuyến mãi ${updated.code}.`);
        },
        error: err => {
          this.saving.set(false);
          this.modalError.set(extractApiErrorMessage(err, 'Không thể cập nhật mã khuyến mãi.'));
        }
      });
    } else {
      this.promotionService.createPromotion(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: created => {
          this.promotions.update(list => [created, ...list]);
          this.saving.set(false);
          this.closeModal();
          this.alertService.toastSuccess(`Đã tạo mã khuyến mãi ${created.code}.`);
        },
        error: err => {
          this.saving.set(false);
          this.modalError.set(extractApiErrorMessage(err, 'Không thể tạo mã khuyến mãi.'));
        }
      });
    }
  }

  toggleStatus(promo: PromotionDto): void {
    this.togglingId.set(promo.id);
    this.promotionService.togglePromotionStatus(promo.id, { isActive: !promo.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.promotions.update(list => list.map(item => (item.id === updated.id ? updated : item)));
        this.togglingId.set(null);
        this.alertService.toastSuccess(
          updated.isActive
            ? `Đã kích hoạt mã khuyến mãi ${updated.code}.`
            : `Đã tạm ngừng mã khuyến mãi ${updated.code}.`
        );
      },
      error: err => {
        this.togglingId.set(null);
        this.alertService.toastError(extractApiErrorMessage(err, 'Không thể cập nhật trạng thái mã khuyến mãi.'));
      }
    });
  }
}
