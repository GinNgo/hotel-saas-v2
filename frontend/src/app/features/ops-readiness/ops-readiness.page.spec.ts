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
import { SystemHealthService, SystemReadinessResult } from '../../core/services/system-health.service';
import { LoadingOverlayService } from '../../core/services/loading-overlay.service';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('OpsReadinessPage — Live Health & Grafana Shortcuts', () => {
  let fixture: ComponentFixture<OpsReadinessPage>;
  let component: OpsReadinessPage;
  let mockHealthService: { checkReadiness: ReturnType<typeof vi.fn> };

  const healthyResult: SystemReadinessResult = {
    status: 'ready',
    database: 'connected',
    timestamp: '2026-11-23T07:30:00.000Z',
    latencyMs: 18,
    httpStatus: 200
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    mockHealthService = {
      checkReadiness: vi.fn().mockReturnValue(of(healthyResult))
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
});
