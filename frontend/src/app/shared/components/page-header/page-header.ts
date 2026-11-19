import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Component hiển thị tiêu đề trang và các nút hành động (Page Header).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-700/80 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class PageHeaderComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
}
