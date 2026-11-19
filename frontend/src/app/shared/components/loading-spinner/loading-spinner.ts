import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

/**
 * Component hiển thị vòng xoay đang tải (Loading Spinner).
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [ProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div
        class="flex flex-col justify-center items-center gap-3 p-8"
        role="status"
        aria-live="polite"
        [attr.aria-label]="message() || 'Đang tải dữ liệu'"
      >
        <p-progress-spinner
          strokeWidth="4"
          fill="transparent"
          animationDuration=".8s"
          [class]="spinnerSizeClass()"
        />
        @if (message()) {
          <p class="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 text-center">
            {{ message() }}
          </p>
        }
      </div>
    }
  `
})
export class LoadingSpinnerComponent {
  readonly loading = input<boolean>(true);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly message = input<string>('');

  readonly spinnerSizeClass = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'w-6 h-6';
      case 'lg':
        return 'w-12 h-12';
      default:
        return 'w-9 h-9';
    }
  });
}
