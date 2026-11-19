import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartCardComponent, ChartCardDataset } from './chart-card.component';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: browser.window,
    document: browser.window.document,
    HTMLElement: browser.window.HTMLElement,
    Node: browser.window.Node,
  });
}
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('ChartCardComponent', () => {
  const sampleLabels = ['Tháng 1', 'Tháng 2', 'Tháng 3'];
  const sampleDatasets: ChartCardDataset[] = [
    {
      label: 'Doanh thu',
      data: [1200000, 2500000, 1800000],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChartCardComponent],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('renders loading skeleton state and hides canvas and toggle button', () => {
    const fixture = TestBed.createComponent(ChartCardComponent);
    fixture.componentRef.setInput('title', 'Doanh thu theo tháng');
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('labels', sampleLabels);
    fixture.componentRef.setInput('datasets', sampleDatasets);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="chart-loading-skeleton"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-error-state"]')).toBeNull();
    expect(el.querySelector('[data-testid="chart-empty-state"]')).toBeNull();
    expect(el.querySelector('[data-testid="chart-canvas-container"]')).toBeNull();
    expect(el.querySelector('[data-testid="chart-view-toggle"]')).toBeNull();
  });

  it('renders error alert and emits retry event when Retry button is clicked', () => {
    const fixture = TestBed.createComponent(ChartCardComponent);
    fixture.componentRef.setInput('title', 'Công suất phòng');
    fixture.componentRef.setInput('error', 'Không thể tải dữ liệu từ máy chủ');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const errorBox = el.querySelector('[data-testid="chart-error-state"]');
    expect(errorBox).not.toBeNull();
    expect(errorBox?.textContent).toContain('Không thể tải dữ liệu từ máy chủ');

    const retryBtn = el.querySelector<HTMLButtonElement>('[data-testid="chart-retry-btn"]');
    expect(retryBtn).not.toBeNull();
    expect(retryBtn?.className).toContain('min-h-11');

    const retrySpy = vi.fn();
    fixture.componentInstance.retry.subscribe(retrySpy);
    retryBtn?.click();
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when labels or dataset data arrays are empty', () => {
    const fixture = TestBed.createComponent(ChartCardComponent);
    fixture.componentRef.setInput('title', 'Doanh thu theo kênh');
    fixture.componentRef.setInput('emptyTitle', 'Không có số liệu kênh đặt phòng');
    fixture.componentRef.setInput('emptyDescription', 'Hãy chọn khoảng thời gian khác.');
    fixture.componentRef.setInput('labels', []);
    fixture.componentRef.setInput('datasets', []);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    let emptyBox = el.querySelector('[data-testid="chart-empty-state"]');
    expect(emptyBox).not.toBeNull();
    expect(emptyBox?.textContent).toContain('Không có số liệu kênh đặt phòng');
    expect(emptyBox?.textContent).toContain('Hãy chọn khoảng thời gian khác.');
    expect(el.querySelector('canvas')).toBeNull();

    // Labels present, but all datasets have empty data arrays -> still empty state
    fixture.componentRef.setInput('labels', sampleLabels);
    fixture.componentRef.setInput('datasets', [{ label: 'Doanh thu', data: [] }]);
    fixture.detectChanges();

    emptyBox = el.querySelector('[data-testid="chart-empty-state"]');
    expect(emptyBox).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-canvas-container"]')).toBeNull();
  });

  it('renders canvas container and sr-only table gracefully in JSDOM when 2D context is unavailable', () => {
    const fixture = TestBed.createComponent(ChartCardComponent);
    fixture.componentRef.setInput('title', 'Doanh thu theo tháng');
    fixture.componentRef.setInput('subtitle', 'Dữ liệu tổng hợp theo ngày trả phòng');
    fixture.componentRef.setInput('chartType', 'bar');
    fixture.componentRef.setInput('labels', sampleLabels);
    fixture.componentRef.setInput('datasets', sampleDatasets);
    fixture.componentRef.setInput('valueUnit', '₫');
    fixture.componentRef.setInput('heightPx', 280);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Doanh thu theo tháng');
    expect(el.textContent).toContain('Dữ liệu tổng hợp theo ngày trả phòng');

    const canvasContainer = el.querySelector<HTMLElement>('[data-testid="chart-canvas-container"]');
    expect(canvasContainer).not.toBeNull();
    expect(canvasContainer?.style.height).toBe('280px');
    expect(el.querySelector('canvas')).not.toBeNull();

    const srTable = el.querySelector('[data-testid="chart-sr-table"]');
    expect(srTable).not.toBeNull();
    expect(srTable?.classList.contains('sr-only')).toBe(true);
    expect(srTable?.textContent).toContain('Tháng 1');
    expect(srTable?.textContent).toContain('₫');
    expect(srTable?.querySelector('td.tabular-nums')).not.toBeNull();
  });

  it('toggles between chart view and accessible data table view cleanly', () => {
    const fixture = TestBed.createComponent(ChartCardComponent);
    fixture.componentRef.setInput('title', 'Phân bổ đặt phòng');
    fixture.componentRef.setInput('chartType', 'line');
    fixture.componentRef.setInput('labels', ['Ngày 1', 'Ngày 2']);
    fixture.componentRef.setInput('datasets', [
      { label: 'Trực tiếp', data: [12, 18] },
      { label: 'OTA', data: [8, 10] },
    ]);
    fixture.componentRef.setInput('valueUnit', 'đơn');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const toggleBtn = el.querySelector<HTMLButtonElement>('[data-testid="chart-view-toggle"]');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn?.className).toContain('min-h-11');
    expect(toggleBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(toggleBtn?.textContent).toContain('Xem bảng số liệu');
    expect(el.querySelector('[data-testid="chart-data-table"]')).toBeNull();

    // Switch to table view
    toggleBtn?.click();
    fixture.detectChanges();

    expect(toggleBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(toggleBtn?.textContent).toContain('Xem biểu đồ');
    expect(el.querySelector('[data-testid="chart-canvas-container"]')).toBeNull();

    const dataTable = el.querySelector('[data-testid="chart-data-table"]');
    expect(dataTable).not.toBeNull();
    expect(dataTable?.textContent).toContain('Trực tiếp (đơn)');
    expect(dataTable?.textContent).toContain('OTA (đơn)');
    expect(dataTable?.textContent).toContain('Ngày 1');
    expect(dataTable?.textContent).toContain('12 đơn');
    expect(dataTable?.querySelectorAll('td.tabular-nums').length).toBe(4);

    // Switch back to chart view
    toggleBtn?.click();
    fixture.detectChanges();

    expect(toggleBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('[data-testid="chart-canvas-container"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-sr-table"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-data-table"]')).toBeNull();
  });
});
