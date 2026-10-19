import { Component, EventEmitter, Input, Output } from '@angular/core';


/**
 * Component hiển thị trạng thái rỗng (Empty State) nhất quán:
 * - Icon trung tâm dịu mắt.
 * - Tiêu đề và mô tả giải thích lý do.
 * - Nút hành động tùy chọn (Thêm mới, Xóa bộ lọc, Thử lại).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="py-14 px-4 text-center">
      <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100/80 shadow-2xs">
        <i [class]="iconClass + ' text-2xl'"></i>

      </div>
      <h3 class="text-base font-semibold text-slate-800">{{ title }}</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {{ description }}
      </p>

      @if (actionLabel) {
        <div class="mt-4">
          <button
            type="button"
            (click)="actionClick.emit()"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors shadow-2xs"
          >
            @if (actionIcon) {
              <i [class]="actionIcon"></i>
            }
            <span>{{ actionLabel }}</span>
          </button>
        </div>
      }
    </div>
  `
})
export class EmptyStateComponent {
  @Input() iconClass: string = 'pi pi-inbox';
  @Input() title: string = 'Không có dữ liệu';
  @Input() description: string = 'Chưa có bản ghi nào hoặc không tìm thấy kết quả phù hợp với bộ lọc.';
  @Input() actionLabel?: string;
  @Input() actionIcon?: string;


  @Output() actionClick = new EventEmitter<void>();
}
