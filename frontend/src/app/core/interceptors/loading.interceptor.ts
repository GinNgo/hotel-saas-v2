import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import { LoadingOverlayService } from '../services/loading-overlay.service';
import {
  SKIP_OVERLAY_HEADER,
  resolveContextualLoadingLabel,
  shouldBypassGlobalOverlay
} from '../services/loading-overlay.utils';

export const LOADING_OVERLAY_WATCHDOG_MS = 25_000;

/**
 * Global HTTP Interceptor that coordinates with LoadingOverlayService.
 * - Immediately activates the overlay for state-mutating requests (POST, PUT, PATCH, DELETE).
 * - Uses a 140ms anti-flicker grace timer for fast GET queries so cached responses never flash.
 * - Guards against pre-subscription timers via defer() and stuck overlays via a 25s watchdog.
 * - Automatically cleans up when the observable completes, errors, or is unsubscribed.
 */
export const loadingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const loadingOverlay = inject(LoadingOverlayService);

  const headerMap: Record<string, string | null> = {
    [SKIP_OVERLAY_HEADER]: req.headers.get(SKIP_OVERLAY_HEADER)
  };

  if (shouldBypassGlobalOverlay(req.url, headerMap)) {
    return next(req);
  }

  const label = resolveContextualLoadingLabel(req.method, req.url);
  const isMutation = req.method !== 'GET' && req.method !== 'HEAD';

  return defer(() => {
    let activeTaskId: string | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const clearTimers = () => {
      if (graceTimer !== null) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      if (maxDurationTimer !== null) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }
    };

    const endActiveTask = () => {
      if (activeTaskId !== null) {
        loadingOverlay.end(activeTaskId);
        activeTaskId = null;
      }
    };

    if (isMutation) {
      activeTaskId = loadingOverlay.begin(label, undefined, {
        method: req.method,
        url: req.url
      });
    } else {
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (settled) return;
        activeTaskId = loadingOverlay.begin(label, undefined, {
          method: req.method,
          url: req.url
        });
      }, 140);
    }

    maxDurationTimer = setTimeout(() => {
      maxDurationTimer = null;
      settled = true;
      clearTimers();
      endActiveTask();
    }, LOADING_OVERLAY_WATCHDOG_MS);

    return next(req).pipe(
      finalize(() => {
        settled = true;
        clearTimers();
        endActiveTask();
      })
    );
  });
};
