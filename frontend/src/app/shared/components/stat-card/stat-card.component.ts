import { Component, computed, input } from '@angular/core';
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
  template: `
    <div
      class="bg-white/80 backdrop-blur-sm rounded-xl p-5 border shadow-xs hover:shadow-md transition-all duration-200"
      [ngClass]="cardBorderClass()"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">{{ title() }}</span>
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          [ngClass]="iconContainerClass()"
        >
          <ng-content select="[icon]"></ng-content>
        </div>
      </div>

      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold tracking-tight text-slate-900">{{ value() }}</span>
        @if (unit()) {
          <span class="text-sm font-medium text-slate-500">{{ unit() }}</span>
        }
      </div>

      @if (trend() || subtitle()) {
        <div class="mt-2.5 flex items-center gap-2 text-xs">
          @if (trend(); as t) {
            <span
              class="inline-flex items-center font-semibold px-1.5 py-0.5 rounded"
              [ngClass]="t.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
            >
              {{ t.isPositive ? '↑' : '↓' }} {{ t.value }}%
            </span>
          }
          @if (subtitle()) {
            <span class="text-slate-500">{{ subtitle() }}</span>
          }
        </div>
      }
    </div>
  `
})
export class StatCardComponent {
  /** Tiêu đề của chỉ số (ví dụ: TỶ LỆ LẤP ĐẦY, DOANH THU...) */
  title = input.required<string>();

  /** Giá trị hiển thị (ví dụ: "85%", "45,000,000 đ", 120) */
  value = input.required<string | number>();

  /** Đơn vị hiển thị phụ (ví dụ: "phòng", "đơn") */
  unit = input<string>();

  /** Chú thích bên dưới (ví dụ: "So với hôm qua", "Mục tiêu tháng") */
  subtitle = input<string>();

  /** Biến động xu hướng */
  trend = input<{ value: number; isPositive: boolean; label?: string }>();

  /** Gam màu chủ đạo của thẻ */
  variant = input<StatCardVariant>('indigo');

  cardBorderClass = computed(() => {
    switch (this.variant()) {
      case 'indigo': return 'border-indigo-100 hover:border-indigo-200';
      case 'emerald': return 'border-emerald-100 hover:border-emerald-200';
      case 'amber': return 'border-amber-100 hover:border-amber-200';
      case 'rose': return 'border-rose-100 hover:border-rose-200';
      case 'sky': return 'border-sky-100 hover:border-sky-200';
      case 'purple': return 'border-purple-100 hover:border-purple-200';
      default: return 'border-slate-200 hover:border-slate-300';
    }
  });

  iconContainerClass = computed(() => {
    switch (this.variant()) {
      case 'indigo': return 'bg-indigo-50 text-indigo-600';
      case 'emerald': return 'bg-emerald-50 text-emerald-600';
      case 'amber': return 'bg-amber-50 text-amber-600';
      case 'rose': return 'bg-rose-50 text-rose-600';
      case 'sky': return 'bg-sky-50 text-sky-600';
      case 'purple': return 'bg-purple-50 text-purple-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  });
}
