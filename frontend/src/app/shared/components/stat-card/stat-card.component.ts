import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardVariant = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple' | 'slate';

/**
 * Component hiển thị Thẻ Thống kê / Chỉ số KPI (Stat Card) dùng chung cho toàn hệ thống.
 * Áp dụng thiết kế Luxury Minimalist theo chuẩn nhận diện Hotel SaaS.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-[var(--surface-card,#ffffff)] dark:bg-slate-900 rounded-xl p-5 border shadow-xs hover:shadow-md transition-all duration-200"
      [ngClass]="cardBorderClass()"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">{{ title() }}</span>
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          [ngClass]="iconContainerClass()"
        >
          <ng-content select="[icon]"></ng-content>
        </div>
      </div>

      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">{{ value() }}</span>
        @if (unit()) {
          <span class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ unit() }}</span>
        }
      </div>

      @if (trend() || subtitle()) {
        <div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          @if (trend(); as t) {
            <span
              class="inline-flex items-center font-semibold px-2 py-0.5 rounded tabular-nums"
              [ngClass]="t.isPositive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'"
            >
              {{ t.isPositive ? '↑' : '↓' }} {{ t.value }}%
            </span>
          }
          @if (subtitle()) {
            <span class="text-slate-600 dark:text-slate-400">{{ subtitle() }}</span>
          }
        </div>
      }
    </div>
  `
})
export class StatCardComponent {
  /** Tiêu đề của chỉ số (ví dụ: TỶ LỆ LẤP ĐẦY, DOANH THU...) */
  readonly title = input.required<string>();

  /** Giá trị hiển thị (ví dụ: "85%", "45,000,000 đ", 120) */
  readonly value = input.required<string | number>();

  /** Đơn vị hiển thị phụ (ví dụ: "phòng", "đơn") */
  readonly unit = input<string>();

  /** Chú thích bên dưới (ví dụ: "So với hôm qua", "Mục tiêu tháng") */
  readonly subtitle = input<string>();

  /** Biến động xu hướng */
  readonly trend = input<{ value: number; isPositive: boolean; label?: string }>();

  /** Gam màu chủ đạo của thẻ */
  readonly variant = input<StatCardVariant>('indigo');

  readonly cardBorderClass = computed(() => {
    switch (this.variant()) {
      case 'indigo':
        return 'border-indigo-100 hover:border-indigo-200 dark:border-indigo-500/30 dark:hover:border-indigo-400/50';
      case 'emerald':
        return 'border-emerald-100 hover:border-emerald-200 dark:border-emerald-500/30 dark:hover:border-emerald-400/50';
      case 'amber':
        return 'border-amber-100 hover:border-amber-200 dark:border-amber-500/30 dark:hover:border-amber-400/50';
      case 'rose':
        return 'border-rose-100 hover:border-rose-200 dark:border-rose-500/30 dark:hover:border-rose-400/50';
      case 'sky':
        return 'border-sky-100 hover:border-sky-200 dark:border-sky-500/30 dark:hover:border-sky-400/50';
      case 'purple':
        return 'border-purple-100 hover:border-purple-200 dark:border-purple-500/30 dark:hover:border-purple-400/50';
      default:
        return 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600';
    }
  });

  readonly iconContainerClass = computed(() => {
    switch (this.variant()) {
      case 'indigo':
        return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300';
      case 'amber':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300';
      case 'rose':
        return 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300';
      case 'sky':
        return 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300';
      case 'purple':
        return 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    }
  });
}
