import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Component hiển thị trạng thái rỗng (Empty State) nhất quán:
 * - Icon trung tâm dịu mắt.
 * - Tiêu đề và mô tả giải thích lý do.
 * - Nút hành động tùy chọn (Thêm mới, Xóa bộ lọc, Thử lại).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-12 px-4 text-center">
      <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-100/80 dark:border-emerald-800/60 shadow-2xs">
        <i [class]="resolvedIconClass() + ' text-2xl'" aria-hidden="true"></i>
      </div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ title() }}</h3>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
        {{ description() }}
      </p>

      @if (actionLabel()) {
        <div class="mt-4">
          <button
            type="button"
            (click)="actionClick.emit()"
            class="inline-flex items-center justify-center gap-1.5 min-h-11 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            @if (actionIcon()) {
              <i [class]="actionIcon()!" aria-hidden="true"></i>
            }
            <span>{{ actionLabel() }}</span>
          </button>
        </div>
      }
    </div>
  `
})
export class EmptyStateComponent {
  readonly iconClass = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly title = input<string>('Không có dữ liệu');
  readonly description = input<string>('Chưa có bản ghi nào hoặc không tìm thấy kết quả phù hợp với bộ lọc.');
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionIcon = input<string | undefined>(undefined);

  readonly actionClick = output<void>();

  readonly resolvedIconClass = computed(() => {
    const explicitClass = this.iconClass()?.trim();
    if (explicitClass) {
      return explicitClass;
    }
    const customIcon = this.icon()?.trim();
    if (customIcon) {
      return customIcon.startsWith('pi ') || customIcon.includes(' ')
        ? customIcon
        : `pi ${customIcon}`;
    }
    return 'pi pi-inbox';
  });
}
