import { Component, input } from '@angular/core';

/**
 * Component hiển thị tiêu đề trang và các nút hành động (Page Header).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-200 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800 tracking-tight">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-sm text-slate-500 mt-1">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-3">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class PageHeaderComponent {
  title = input<string>('');
  subtitle = input<string>('');
}
