import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Component phân trang server-side dùng chung:
 * - Hiển thị số trang, trang hiện tại, tổng số dòng.
 * - Cho phép chọn pageSize (10, 20, 50, 100).
 * - Nút Trước, Sau, Đầu, Cuối, danh sách trang có dấu ...
 * - Thiết kế accessible, hover/active rõ nét.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-3 sm:px-4 bg-white border-t border-slate-200/80 text-xs">
      <!-- Records Count & Page Size Selector -->
      <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-slate-500 text-center sm:text-left">
        <div>
          Hiển thị
          <strong class="text-slate-800">{{ fromRecord }}</strong>
          -
          <strong class="text-slate-800">{{ toRecord }}</strong>
          trên tổng
          <strong class="text-slate-800">{{ totalCount }}</strong>
          bản ghi
        </div>

        <div class="flex items-center gap-1.5 ml-1">
          <label for="pageSizeSelect" class="text-slate-400">Số dòng:</label>
          <select
            id="pageSizeSelect"
            name="pageSize"
            [ngModel]="pageSize"
            (ngModelChange)="onPageSizeChange($event)"
            aria-label="Chọn số dòng mỗi trang"
            class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs text-xs"
          >
            @for (size of pageSizeOptions; track size) {
              <option [value]="size">{{ size }} / trang</option>
            }
          </select>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-1">
        <!-- First Page -->
        <button
          type="button"
          (click)="goToPage(1)"
          [disabled]="page <= 1"
          class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang đầu"
          aria-label="Trang đầu"
        >
          <i class="pi pi-angle-double-left text-xs"></i>
        </button>

        <!-- Previous Page -->
        <button
          type="button"
          (click)="goToPage(page - 1)"
          [disabled]="page <= 1"
          class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang trước"
          aria-label="Trang trước"
        >
          <i class="pi pi-angle-left text-xs"></i>
        </button>

        <!-- Page Numbers -->
        @for (p of pageList; track p) {
          @if (p === -1) {
            <span class="px-1.5 text-slate-400">...</span>
          } @else {
            <button
              type="button"
              (click)="goToPage(p)"
              class="w-7 h-7 rounded-lg font-medium transition-colors text-xs"
              [class.bg-emerald-600]="p === page"
              [class.text-white]="p === page"
              [class.text-slate-700]="p !== page"
              [class.hover:bg-slate-100]="p !== page"
              [class.border]="p !== page"
              [class.border-slate-200]="p !== page"
              [attr.aria-label]="'Đến trang ' + p"
              [attr.aria-current]="p === page ? 'page' : null"
            >
              {{ p }}
            </button>
          }
        }

        <!-- Next Page -->
        <button
          type="button"
          (click)="goToPage(page + 1)"
          [disabled]="page >= totalPages"
          class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang sau"
          aria-label="Trang sau"
        >
          <i class="pi pi-angle-right text-xs"></i>
        </button>

        <!-- Last Page -->
        <button
          type="button"
          (click)="goToPage(totalPages)"
          [disabled]="page >= totalPages"
          class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang cuối"
          aria-label="Trang cuối"
        >
          <i class="pi pi-angle-double-right text-xs"></i>
        </button>
      </div>
    </div>
  `
})
export class PaginationComponent {
  @Input() page: number = 1;
  @Input() pageSize: number = 20;
  @Input() totalCount: number = 0;
  @Input() pageSizeOptions: number[] = [10, 20, 50];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get fromRecord(): number {
    if (this.totalCount === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get toRecord(): number {
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  get pageList(): number[] {
    const total = this.totalPages;
    const current = this.page;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    pages.push(1);

    if (current > 3) {
      pages.push(-1); // Ellipsis
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push(-1); // Ellipsis
    }

    pages.push(total);
    return pages;
  }

  goToPage(targetPage: number): void {
    if (targetPage >= 1 && targetPage <= this.totalPages && targetPage !== this.page) {
      this.pageChange.emit(targetPage);
    }
  }

  onPageSizeChange(newSize: number): void {
    const size = Number(newSize);
    if (size !== this.pageSize) {
      this.pageSizeChange.emit(size);
    }
  }
}
