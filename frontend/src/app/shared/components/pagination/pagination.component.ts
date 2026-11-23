import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Component phân trang server-side dùng chung:
 * - Hiển thị số trang, trang hiện tại, tổng số dòng.
 * - Cho phép chọn pageSize (10, 20, 50, 100).
 * - Nút Trước, Sau, Đầu, Cuối, danh sách trang có dấu ...
 * - Thiết kế accessible (>=44px touch targets, focus-visible ring, tabular-nums, dark mode).
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      aria-label="Phân trang dữ liệu"
      class="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-3 sm:px-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-700/80 text-xs"
    >
      <!-- Records Count & Page Size Selector -->
      <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-slate-600 dark:text-slate-300 text-center sm:text-left">
        <div class="tabular-nums">
          Hiển thị
          <strong class="text-slate-800 dark:text-slate-100 tabular-nums">{{ fromRecord() }}</strong>
          -
          <strong class="text-slate-800 dark:text-slate-100 tabular-nums">{{ toRecord() }}</strong>
          trên tổng
          <strong class="text-slate-800 dark:text-slate-100 tabular-nums">{{ totalCount() }}</strong>
          bản ghi
        </div>

        <div class="flex items-center gap-2 ml-1">
          <label [for]="selectId" class="text-slate-600 dark:text-slate-300 font-medium">Số dòng:</label>
          <select
            [id]="selectId"
            name="pageSize"
            [ngModel]="pageSize()"
            (ngModelChange)="onPageSizeChange($event)"
            aria-label="Chọn số dòng hiển thị mỗi trang"
            class="min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 tabular-nums shadow-2xs text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
          >
            @for (size of pageSizeOptions(); track size) {
              <option [value]="size">{{ size }} / trang</option>
            }
          </select>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-1.5">
        <!-- First Page -->
        <button
          type="button"
          (click)="goToPage(1)"
          [disabled]="page() <= 1"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Trang đầu"
          aria-label="Trang đầu"
        >
          <i class="pi pi-angle-double-left text-xs" aria-hidden="true"></i>
        </button>

        <!-- Previous Page -->
        <button
          type="button"
          (click)="goToPage(page() - 1)"
          [disabled]="page() <= 1"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Trang trước"
          aria-label="Trang trước"
        >
          <i class="pi pi-angle-left text-xs" aria-hidden="true"></i>
        </button>

        <!-- Page Numbers -->
        @for (p of pageList(); track $index) {
          @if (p === -1) {
            <span class="px-1.5 text-slate-500 dark:text-slate-400 select-none" aria-hidden="true">...</span>
          } @else {
            <button
              type="button"
              (click)="goToPage(p)"
              class="min-h-11 min-w-11 px-2.5 inline-flex items-center justify-center rounded-lg font-medium transition-colors text-xs tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              [class.bg-emerald-600]="p === page()"
              [class.text-white]="p === page()"
              [class.text-slate-700]="p !== page()"
              [class.dark:text-slate-200]="p !== page()"
              [class.hover:bg-slate-100]="p !== page()"
              [class.dark:hover:bg-slate-800]="p !== page()"
              [class.border]="p !== page()"
              [class.border-slate-200]="p !== page()"
              [class.dark:border-slate-700]="p !== page()"
              [attr.aria-label]="'Đến trang ' + p"
              [attr.aria-current]="p === page() ? 'page' : null"
            >
              {{ p }}
            </button>
          }
        }

        <!-- Next Page -->
        <button
          type="button"
          (click)="goToPage(page() + 1)"
          [disabled]="page() >= totalPages()"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Trang sau"
          aria-label="Trang sau"
        >
          <i class="pi pi-angle-right text-xs" aria-hidden="true"></i>
        </button>

        <!-- Last Page -->
        <button
          type="button"
          (click)="goToPage(totalPages())"
          [disabled]="page() >= totalPages()"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Trang cuối"
          aria-label="Trang cuối"
        >
          <i class="pi pi-angle-double-right text-xs" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  `
})
export class PaginationComponent {
  private static nextInstanceId = 0;
  readonly selectId = `pageSizeSelect-${++PaginationComponent.nextInstanceId}`;

  readonly page = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly totalCount = input<number>(0);
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / Math.max(1, this.pageSize()))));

  readonly fromRecord = computed(() => {
    if (this.totalCount() <= 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });

  readonly toRecord = computed(() => Math.min(this.page() * this.pageSize(), this.totalCount()));

  readonly pageList = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    pages.push(1);

    if (current > 3) {
      pages.push(-1);
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push(-1);
    }

    pages.push(total);
    return pages;
  });

  goToPage(targetPage: number): void {
    if (targetPage >= 1 && targetPage <= this.totalPages() && targetPage !== this.page()) {
      this.pageChange.emit(targetPage);
    }
  }

  onPageSizeChange(newSize: number | string): void {
    const size = Number(newSize);
    if (!Number.isNaN(size) && size !== this.pageSize()) {
      this.pageSizeChange.emit(size);
    }
  }
}
