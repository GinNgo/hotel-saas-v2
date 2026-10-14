import { Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

/**
 * Component hiển thị vòng xoay đang tải (Loading Spinner).
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [ProgressSpinner],
  template: `
    @if (loading()) {
      <div class="flex justify-center items-center p-8">
        <p-progress-spinner strokeWidth="4" fill="transparent" animationDuration=".8s" styleClass="w-12 h-12" />
      </div>
    }
  `
})
export class LoadingSpinnerComponent {
  loading = input(false);
}
