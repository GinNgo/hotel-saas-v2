import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingOverlayService } from '../../../core/services/loading-overlay.service';

/**
 * Centralized Loading Overlay Component (<app-loading-overlay />).
 * Mounted once at the root App component to provide consistent, accessible visual feedback
 * during asynchronous HTTP requests, branch switches, RBAC updates, and batch operations.
 */
@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loadingService.isLoading()) {
      <!-- Top Indeterminate Progress Bar -->
      <div
        class="fixed top-0 inset-x-0 z-[9998] h-1 bg-emerald-100/80 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          class="h-full w-1/3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite]"
        ></div>
      </div>

      <!-- Full-Viewport Frosted Backdrop & Spinner Card -->
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-testid="global-loading-overlay"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-150 px-4"
      >
        <div
          class="w-full max-w-sm sm:max-w-md rounded-2xl bg-white/95 border border-slate-200/90 shadow-xl p-5 flex items-center gap-4"
        >
          <!-- Dual-Ring Accessible SVG Spinner -->
          <div class="relative flex items-center justify-center w-11 h-11 shrink-0" aria-hidden="true">
            <svg
              class="w-11 h-11 text-emerald-600 animate-spin motion-reduce:animate-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="3"
              ></circle>
              <path
                class="opacity-95"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <i class="pi pi-building text-xs text-emerald-700 absolute"></i>
          </div>

          <!-- Contextual Message & Concurrent Task Counter -->
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-slate-900 leading-snug line-clamp-2" data-testid="loading-overlay-label">
              {{ loadingService.activeLabel() }}
            </div>
            <div class="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
              <span>Vui lòng đợi trong giây lát</span>
              @if (loadingService.activeCount() > 1) {
                <span class="font-mono text-[11px] text-emerald-700 font-semibold">
                  {{ loadingService.activeCount() }} tác vụ
                </span>
              }
            </div>
          </div>

          <!-- Escape Hatch to dismiss overlay if user wants to continue inspecting UI -->
          <button
            type="button"
            (click)="loadingService.resetAll()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Ẩn thông báo đang tải"
            aria-label="Ẩn thông báo đang tải"
          >
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>
      </div>
    }
  `
})
export class LoadingOverlayComponent {
  readonly loadingService = inject(LoadingOverlayService);
}
