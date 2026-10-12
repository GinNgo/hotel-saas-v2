import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component hiển thị khung chờ tải dữ liệu (Loading Skeleton) dạng bảng:
 * - Thay thế spinner toàn trang gây khó chịu.
 * - Giữ layout ổn định (CLS thấp).
 * - Tôn trọng prefers-reduced-motion qua Tailwind animate-pulse.
 */
@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 space-y-3">
      <!-- Header row skeleton -->
      <div class="h-8 bg-slate-100 rounded-lg animate-pulse w-full"></div>

      <!-- Data rows skeleton -->
      @for (i of rowArray; track i) {
        <div class="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
          <div class="h-6 bg-slate-100 rounded animate-pulse w-1/6"></div>
          <div class="h-6 bg-slate-100 rounded animate-pulse w-1/4"></div>
          <div class="h-6 bg-slate-100 rounded animate-pulse w-1/5"></div>
          <div class="h-6 bg-slate-100 rounded animate-pulse w-1/6"></div>
          <div class="h-6 bg-slate-100 rounded animate-pulse w-1/12 ml-auto"></div>
        </div>
      }
    </div>
  `
})
export class SkeletonTableComponent {
  @Input() rows: number = 5;

  get rowArray(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }
}
