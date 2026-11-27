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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of } from 'rxjs';
import { OpsReadinessPage } from './ops-readiness.page';
import {
  LokiLogQueryResultDto,
  ObservabilityStackStatusDto,
  SystemHealthService,
  SystemReadinessResult
} from '../../core/services/system-health.service';
import { LoadingOverlayService } from '../../core/services/loading-overlay.service';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('OpsReadinessPage — Live Health & Grafana Shortcuts', () => {
  let fixture: ComponentFixture<OpsReadinessPage>;
  let component: OpsReadinessPage;
  let mockHealthService: {
    checkReadiness: ReturnType<typeof vi.fn>;
    getObservabilityStatus: ReturnType<typeof vi.fn>;
    updateObservabilitySettings: ReturnType<typeof vi.fn>;
    queryLokiLogs: ReturnType<typeof vi.fn>;
  };

  const healthyResult: SystemReadinessResult = {
    status: 'ready',
    database: 'connected',
    timestamp: '2026-11-23T07:30:00.000Z',
    latencyMs: 18,
    httpStatus: 200
  };

  const stackStatus: ObservabilityStackStatusDto = {
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
      { name: 'Loki', status: 'up', latencyMs: 4, details: 'Sẵn sàng (5 labels)' },
      { name: 'Prometheus', status: 'up', latencyMs: 6, details: 'Scrape /metrics: UP' },
      { name: 'Grafana', status: 'up', latencyMs: 8, details: 'DB: ok', version: '11.2.0' }
    ],
    prometheusScrapeHealth: 'up',
    prometheusScrapeError: null,
    lokiLabels: ['container', 'level', 'tenant_id']
  };

  const lokiLogs: LokiLogQueryResultDto = {
    available: true,
    errorMessage: null,
    query: '{container="hotelsaas-backend-api"}',
    windowMinutes: 60,
    totalReturned: 1,
    entries: [
      {
        timestampUtc: '2026-11-27T08:00:00.000Z',
        level: 'Warning',
        container: 'hotelsaas-backend-api',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        userId: 'user-1',
        correlationId: 'corr-live-1',
        statusCode: 403,
        elapsedMs: 9.2,
        errorCode: 'ERR_FORBIDDEN',
        message: 'Security Gate denied access',
        requestPayload: '{"email":"test@luxustay.vn","password":"***REDACTED***"}',
        responsePayload: '{"errorCode":"ERR_FORBIDDEN"}'
      }
    ]
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    mockHealthService = {
      checkReadiness: vi.fn().mockReturnValue(of(healthyResult)),
      getObservabilityStatus: vi.fn().mockReturnValue(of(stackStatus)),
      updateObservabilitySettings: vi.fn().mockReturnValue(
        of({
          minimumLogLevel: 'Warning',
          metricsExportEnabled: false,
          structuredRequestLoggingEnabled: true,
          payloadLoggingEnabled: true,
          lokiConfigured: true,
          prometheusConfigured: true,
          grafanaConfigured: true
        })
      ),
      queryLokiLogs: vi.fn().mockReturnValue(of(lokiLogs))
    };

    await TestBed.configureTestingModule({
      imports: [OpsReadinessPage],
      providers: [
        { provide: SystemHealthService, useValue: mockHealthService },
        { provide: LoadingOverlayService, useValue: { begin: vi.fn(), end: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OpsReadinessPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('probes GET /health/ready on init and renders Live status, DB connected, latency, and Grafana CTAs', () => {
    fixture.detectChanges();

    expect(mockHealthService.checkReadiness).toHaveBeenCalledOnce();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Trạng thái Hệ thống Trực tiếp (Live)');
    expect(el.querySelector('[data-testid="live-health-status-badge"]')?.textContent).toContain('Ready');
    expect(el.querySelector('[data-testid="live-health-db-status"]')?.textContent).toContain('Đã kết nối');
    expect(el.querySelector('[data-testid="live-health-latency"]')?.textContent).toContain('18 ms');

    const grafanaHome = el.querySelector('[data-testid="ops-grafana-home-link"]') as HTMLAnchorElement | null;
    const grafanaLogs = el.querySelector('[data-testid="ops-grafana-logs-link"]') as HTMLAnchorElement | null;
    expect(grafanaHome?.getAttribute('href')).toBe('/grafana/');
    expect(grafanaHome?.getAttribute('target')).toBe('_blank');
    expect(grafanaHome?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(grafanaLogs?.getAttribute('href')).toBe('/grafana/d/hotelsaas-ops-logs-vn');
    expect(grafanaLogs?.getAttribute('target')).toBe('_blank');
    expect(grafanaLogs?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders degraded state cleanly when refresh returns degraded database', () => {
    fixture.detectChanges();
    mockHealthService.checkReadiness.mockReturnValueOnce(
      of<SystemReadinessResult>({
        status: 'degraded',
        database: 'unreachable',
        timestamp: '2026-11-23T07:35:00.000Z',
        latencyMs: 52,
        httpStatus: 503,
        errorMessage: 'Cơ sở dữ liệu hiện không thể kết nối.'
      })
    );

    component.refreshLiveHealth();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-health-status-badge"]')?.textContent).toContain('Degraded');
    expect(el.querySelector('[data-testid="live-health-db-status"]')?.textContent).toContain('Không thể kết nối');
    expect(el.textContent).toContain('Cơ sở dữ liệu hiện không thể kết nối.');
  });

  it('applies dark mode surface classes on Tabs 3 and 4', () => {
    component.activeTab.set('CICD_IAC');
    fixture.detectChanges();
    const tab3Html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(tab3Html).toContain('dark:bg-slate-900');

    component.activeTab.set('OBSERVABILITY');
    fixture.detectChanges();
    const tab4Html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(tab4Html).toContain('dark:bg-slate-900');
  });

  it('renders live PLG service badges, saves runtime settings, and loads Loki logs in Tab 4', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="plg-stack-status-strip"]')?.textContent).toContain('Loki');
    expect(el.querySelector('[data-testid="prometheus-scrape-badge"]')?.textContent).toContain('UP');

    component.openObservabilityTab();
    fixture.detectChanges();

    expect(mockHealthService.queryLokiLogs).toHaveBeenCalledOnce();
    const lokiRows = el.querySelectorAll('[data-testid="loki-log-row"]');
    expect(lokiRows.length).toBe(1);
    expect(lokiRows[0].textContent).toContain('corr-live-1');
    expect(el.querySelector('[data-testid="obs-usage-guide"]')?.textContent).toContain('Hướng dẫn nhanh 3 bước');
    const payloadDetails = el.querySelector('[data-testid="loki-payload-details"]');
    expect(payloadDetails).not.toBeNull();
    expect(payloadDetails?.textContent).toContain('***REDACTED***');

    component.formMinLogLevel.set('Warning');
    component.formMetricsEnabled.set(false);
    component.formPayloadLoggingEnabled.set(true);
    component.saveObservabilitySettings();
    fixture.detectChanges();

    expect(mockHealthService.updateObservabilitySettings).toHaveBeenCalledWith({
      minimumLogLevel: 'Warning',
      metricsExportEnabled: false,
      structuredRequestLoggingEnabled: true,
      payloadLoggingEnabled: true
    });
    expect(el.querySelector('[data-testid="obs-save-notice"]')?.textContent).toContain('Warning');
    expect(el.querySelector('[data-testid="obs-save-notice"]')?.textContent).toContain('Payload=Bật');
  });

  it('shows offline banner gracefully when Loki is unavailable', () => {
    fixture.detectChanges();
    mockHealthService.queryLokiLogs.mockReturnValueOnce(
      of<LokiLogQueryResultDto>({
        available: false,
        errorMessage: 'Không thể kết nối tới Grafana Loki.',
        query: '{container="hotelsaas-backend-api"}',
        windowMinutes: 60,
        totalReturned: 0,
        entries: []
      })
    );

    component.openObservabilityTab();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="loki-offline-banner"]')?.textContent).toContain(
      'Không thể kết nối tới Grafana Loki.'
    );
  });
});
