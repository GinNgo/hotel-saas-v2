import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Component hiển thị khung chờ tải dữ liệu (Loading Skeleton) dạng bảng:
 * - Thay thế spinner toàn trang gây khó chịu.
 * - Giữ layout ổn định (CLS thấp).
 * - Tôn trọng prefers-reduced-motion qua Tailwind motion-reduce:animate-none.
 */
@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="p-4 space-y-3"
      role="status"
      aria-busy="true"
      aria-label="Đang tải dữ liệu bảng"
    >
      <!-- Header row skeleton -->
      <div class="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse motion-reduce:animate-none w-full"></div>

      <!-- Data rows skeleton -->
      @for (i of rowArray(); track i) {
        <div class="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div class="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none w-1/6"></div>
          <div class="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none w-1/4"></div>
          <div class="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none w-1/5"></div>
          <div class="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none w-1/6"></div>
          <div class="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none w-1/12 ml-auto"></div>
        </div>
      }
    </div>
  `
})
export class SkeletonTableComponent {
  readonly rows = input<number>(5);

  readonly rowArray = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
