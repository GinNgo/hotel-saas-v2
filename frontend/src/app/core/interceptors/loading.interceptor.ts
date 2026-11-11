import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingOverlayService } from '../services/loading-overlay.service';
import {
  SKIP_OVERLAY_HEADER,
  resolveContextualLoadingLabel,
  shouldBypassGlobalOverlay
} from '../services/loading-overlay.utils';

/**
 * Global HTTP Interceptor that coordinates with LoadingOverlayService.
 * - Immediately activates the overlay for state-mutating requests (POST, PUT, PATCH, DELETE).
 * - Uses a 140ms anti-flicker grace timer for fast GET queries so cached responses never flash.
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

  let activeTaskId: string | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;

  if (isMutation) {
    activeTaskId = loadingOverlay.begin(label, undefined, {
      method: req.method,
      url: req.url
    });
  } else {
    graceTimer = setTimeout(() => {
      activeTaskId = loadingOverlay.begin(label, undefined, {
        method: req.method,
        url: req.url
      });
    }, 140);
  }

  return next(req).pipe(
    finalize(() => {
      if (graceTimer !== null) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      if (activeTaskId !== null) {
        loadingOverlay.end(activeTaskId);
        activeTaskId = null;
      }
    })
  );
};
