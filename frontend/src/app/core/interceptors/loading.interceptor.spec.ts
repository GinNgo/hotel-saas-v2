import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingOverlayService } from '../services/loading-overlay.service';
import { LOADING_OVERLAY_WATCHDOG_MS, loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let loadingOverlay: LoadingOverlayService;
  let injector: Injector;

  beforeEach(() => {
    vi.useFakeTimers();
    loadingOverlay = new LoadingOverlayService();
    injector = Injector.create({
      providers: [{ provide: LoadingOverlayService, useValue: loadingOverlay }]
    });
  });

  afterEach(() => {
    loadingOverlay.resetAll();
    vi.useRealTimers();
  });

  it('does not start graceTimer or call begin() until the returned observable is subscribed', () => {
    const req = new HttpRequest('GET', '/api/reservations');
    const next: HttpHandlerFn = () => new Subject<HttpResponse<unknown>>();
    const beginSpy = vi.spyOn(loadingOverlay, 'begin');

    const obs$ = runInInjectionContext(injector, () => loadingInterceptor(req, next));

    vi.advanceTimersByTime(5000);
    expect(beginSpy).not.toHaveBeenCalled();
    expect(loadingOverlay.isLoading()).toBe(false);

    const sub = obs$.subscribe();
    vi.advanceTimersByTime(140);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(loadingOverlay.isLoading()).toBe(true);

    sub.unsubscribe();
    expect(loadingOverlay.isLoading()).toBe(false);
  });

  it('does not activate overlay when a GET request settles before the 140ms grace period', () => {
    const req = new HttpRequest('GET', '/api/rooms');
    const response$ = new Subject<HttpResponse<unknown>>();
    const next: HttpHandlerFn = () => response$;
    const beginSpy = vi.spyOn(loadingOverlay, 'begin');

    const obs$ = runInInjectionContext(injector, () => loadingInterceptor(req, next));
    const sub = obs$.subscribe();

    vi.advanceTimersByTime(50);
    response$.next(new HttpResponse({ status: 200 }));
    response$.complete();

    vi.advanceTimersByTime(500);
    expect(beginSpy).not.toHaveBeenCalled();
    expect(loadingOverlay.isLoading()).toBe(false);
    sub.unsubscribe();
  });

  it('starts overlay immediately for mutations and cleans up on finalize', () => {
    const req = new HttpRequest('POST', '/api/reservations', {});
    const response$ = new Subject<HttpResponse<unknown>>();
    const next: HttpHandlerFn = () => response$;

    const obs$ = runInInjectionContext(injector, () => loadingInterceptor(req, next));
    expect(loadingOverlay.isLoading()).toBe(false);

    const sub = obs$.subscribe();
    expect(loadingOverlay.isLoading()).toBe(true);
    expect(loadingOverlay.activeCount()).toBe(1);

    response$.complete();
    expect(loadingOverlay.isLoading()).toBe(false);
    expect(loadingOverlay.activeCount()).toBe(0);
    sub.unsubscribe();
  });

  it('ends stuck overlay task via 25s failsafe watchdog when observable never completes', () => {
    const req = new HttpRequest('GET', '/api/platform/tenants');
    const next: HttpHandlerFn = () => new Observable<never>(() => () => {});

    const obs$ = runInInjectionContext(injector, () => loadingInterceptor(req, next));
    const sub = obs$.subscribe();

    vi.advanceTimersByTime(140);
    expect(loadingOverlay.isLoading()).toBe(true);
    expect(loadingOverlay.activeCount()).toBe(1);

    vi.advanceTimersByTime(LOADING_OVERLAY_WATCHDOG_MS);
    expect(loadingOverlay.isLoading()).toBe(false);
    expect(loadingOverlay.activeCount()).toBe(0);
    sub.unsubscribe();
  });

  it('bypasses overlay entirely for silent URLs such as /api/banners/active', () => {
    const req = new HttpRequest('GET', '/api/banners/active');
    const next: HttpHandlerFn = () => of(new HttpResponse({ status: 200 }));
    const beginSpy = vi.spyOn(loadingOverlay, 'begin');

    const sub = runInInjectionContext(injector, () => loadingInterceptor(req, next)).subscribe();
    vi.advanceTimersByTime(500);

    expect(beginSpy).not.toHaveBeenCalled();
    expect(loadingOverlay.isLoading()).toBe(false);
    sub.unsubscribe();
  });
});
