import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  (globalThis as Record<string, unknown>)['window'] = win;
  (globalThis as Record<string, unknown>)['document'] = win.document;
  (globalThis as Record<string, unknown>)['HTMLElement'] = win.HTMLElement;
  (globalThis as Record<string, unknown>)['customElements'] = win.customElements;
  (globalThis as Record<string, unknown>)['Node'] = win.Node;
  (globalThis as Record<string, unknown>)['MutationObserver'] = win.MutationObserver;
}

import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SystemHealthService, SystemReadinessResult } from './system-health.service';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('SystemHealthService', () => {
  let service: SystemHealthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SystemHealthService]
    });
    service = TestBed.inject(SystemHealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('calls GET /health/ready and returns ready status with database connected and measured latency', () => {
    let result: SystemReadinessResult | undefined;
    service.checkReadiness().subscribe(res => {
      result = res;
    });

    const req = httpMock.expectOne('/health/ready');
    expect(req.request.method).toBe('GET');
    req.flush({
      status: 'ready',
      database: 'connected',
      timestamp: '2026-11-23T07:00:00.000Z'
    });

    expect(result).toBeDefined();
    expect(result!.status).toBe('ready');
    expect(result!.database).toBe('connected');
    expect(result!.timestamp).toBe('2026-11-23T07:00:00.000Z');
    expect(result!.httpStatus).toBe(200);
    expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('handles HTTP 503 degraded probe gracefully without throwing', () => {
    let result: SystemReadinessResult | undefined;
    service.checkReadiness().subscribe(res => {
      result = res;
    });

    const req = httpMock.expectOne('/health/ready');
    req.flush(
      {
        status: 'degraded',
        database: 'unreachable',
        timestamp: '2026-11-23T07:05:00.000Z'
      },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(result).toBeDefined();
    expect(result!.status).toBe('degraded');
    expect(result!.database).toBe('unreachable');
    expect(result!.httpStatus).toBe(503);
    expect(result!.errorMessage).toContain('Cơ sở dữ liệu');
  });

  it('falls back to degraded status on network error', () => {
    let result: SystemReadinessResult | undefined;
    service.checkReadiness().subscribe(res => {
      result = res;
    });

    const req = httpMock.expectOne('/health/ready');
    const globalWithEvent = globalThis as unknown as { ProgressEvent?: new (type: string) => ProgressEvent };
    const windowWithEvent = window as unknown as { ProgressEvent: new (type: string) => ProgressEvent };
    const ProgressEventCtor = globalWithEvent.ProgressEvent ?? windowWithEvent.ProgressEvent;
    req.error(new ProgressEventCtor('error'));

    expect(result).toBeDefined();
    expect(result!.status).toBe('degraded');
    expect(result!.database).toBe('unreachable');
    expect(result!.httpStatus).toBe(0);
    expect(result!.errorMessage).toContain('/health/ready');
  });

  it('fetches observability stack status, updates runtime settings, and queries Loki logs', () => {
    service.getObservabilityStatus().subscribe(status => {
      expect(status.prometheusScrapeHealth).toBe('up');
      expect(status.services.length).toBe(3);
    });
    const statusReq = httpMock.expectOne('/api/platform/observability/status');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({
      checkedAtUtc: '2026-11-27T08:00:00.000Z',
      settings: {
        minimumLogLevel: 'Information',
        metricsExportEnabled: true,
        structuredRequestLoggingEnabled: true,
        payloadLoggingEnabled: false,
        lokiConfigured: true,
        prometheusConfigured: true,
        grafanaConfigured: true
      },
      services: [
        { name: 'Loki', status: 'up', latencyMs: 5, details: 'Sẵn sàng (5 labels)' },
        { name: 'Prometheus', status: 'up', latencyMs: 6, details: 'Scrape /metrics: UP' },
        { name: 'Grafana', status: 'up', latencyMs: 8, details: 'DB: ok', version: '11.2.0' }
      ],
      prometheusScrapeHealth: 'up',
      prometheusScrapeError: null,
      lokiLabels: ['container', 'level']
    });

    service
      .updateObservabilitySettings({
        minimumLogLevel: 'Warning',
        metricsExportEnabled: false,
        structuredRequestLoggingEnabled: true,
        payloadLoggingEnabled: true
      })
      .subscribe(updated => {
        expect(updated.minimumLogLevel).toBe('Warning');
        expect(updated.metricsExportEnabled).toBe(false);
        expect(updated.payloadLoggingEnabled).toBe(true);
      });
    const putReq = httpMock.expectOne('/api/platform/observability/settings');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({
      minimumLogLevel: 'Warning',
      metricsExportEnabled: false,
      structuredRequestLoggingEnabled: true,
      payloadLoggingEnabled: true
    });
    putReq.flush({
      minimumLogLevel: 'Warning',
      metricsExportEnabled: false,
      structuredRequestLoggingEnabled: true,
      payloadLoggingEnabled: true,
      lokiConfigured: true,
      prometheusConfigured: true,
      grafanaConfigured: true
    });

    service
      .queryLokiLogs({ level: 'Warning', search: 'corr-1', minutes: 60, limit: 50 })
      .subscribe(res => {
        expect(res.available).toBe(true);
        expect(res.totalReturned).toBe(1);
      });
    const logsReq = httpMock.expectOne(
      r =>
        r.url === '/api/platform/observability/logs' &&
        r.params.get('level') === 'Warning' &&
        r.params.get('search') === 'corr-1' &&
        r.params.get('minutes') === '60' &&
        r.params.get('limit') === '50'
    );
    expect(logsReq.request.method).toBe('GET');
    logsReq.flush({
      available: true,
      errorMessage: null,
      query: '{container="hotelsaas-backend-api",level="Warning"} |= "corr-1"',
      windowMinutes: 60,
      totalReturned: 1,
      entries: []
    });
  });
});
