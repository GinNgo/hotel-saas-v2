import { Injectable, computed, signal } from '@angular/core';
import {
  ActiveLoadingTask,
  DEFAULT_LOADING_LABEL,
  addLoadingTask,
  removeLoadingTask,
  selectPrimaryLoadingLabel
} from './loading-overlay.utils';

/**
 * Centralized Loading Overlay Service (Angular 22 Signals).
 * Manages concurrent asynchronous tasks (HTTP requests, form submissions, batch jobs)
 * and exposes reactive signals consumed by <app-loading-overlay />.
 */
@Injectable({ providedIn: 'root' })
export class LoadingOverlayService {
  private readonly _tasks = signal<ActiveLoadingTask[]>([]);
  private _seq = 0;

  /** Read-only list of currently active async tasks */
  readonly tasks = this._tasks.asReadonly();

  /** Number of concurrent active async tasks */
  readonly activeCount = computed(() => this._tasks().length);

  /** Whether the centralized loading overlay should be visible */
  readonly isLoading = computed(() => this._tasks().length > 0);

  /** Primary contextual Vietnamese status message */
  readonly activeLabel = computed(() => selectPrimaryLoadingLabel(this._tasks()));

  /**
   * Starts tracking an asynchronous operation and returns its unique taskId.
   */
  begin(label: string = DEFAULT_LOADING_LABEL, customTaskId?: string, meta?: { method?: string; url?: string }): string {
    const id = customTaskId || `async-task-${++this._seq}-${Date.now()}`;
    const task: ActiveLoadingTask = {
      id,
      label: label || DEFAULT_LOADING_LABEL,
      method: meta?.method,
      url: meta?.url,
      startedAt: Date.now()
    };

    this._tasks.update(current => addLoadingTask(current, task));
    return id;
  }

  /**
   * Completes and removes a tracked asynchronous operation by its taskId.
   */
  end(taskId: string): void {
    if (!taskId) return;
    this._tasks.update(current => removeLoadingTask(current, taskId));
  }

  /**
   * Imperative helper to display the global spinner with an optional custom message.
   */
  show(label: string = DEFAULT_LOADING_LABEL): string {
    return this.begin(label, 'manual-default-overlay');
  }

  /**
   * Imperative helper to hide the manual overlay task.
   */
  hide(taskId: string = 'manual-default-overlay'): void {
    this.end(taskId);
  }

  /**
   * Clears all active tasks immediately (escape hatch / error recovery).
   */
  resetAll(): void {
    this._tasks.set([]);
  }

  /**
   * Wraps any Promise or async function with the centralized loading overlay.
   */
  async withLoading<T>(operation: () => Promise<T>, label: string = DEFAULT_LOADING_LABEL): Promise<T> {
    const taskId = this.begin(label);
    try {
      return await operation();
    } finally {
      this.end(taskId);
    }
  }
}
