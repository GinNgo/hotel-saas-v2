import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart, {
  type ChartConfiguration,
  type ChartDataset,
  type ChartOptions,
} from 'chart.js/auto';
import { ThemeService } from '../../../core/services/theme.service';

export interface ChartCardDataset {
  label: string;
  data: readonly number[];
  backgroundColor?: string | readonly string[];
  borderColor?: string | readonly string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

export type ChartCardType = 'bar' | 'line' | 'doughnut';

type SupportedChartInstance =
  | Chart<'bar', number[], string>
  | Chart<'line', number[], string>
  | Chart<'doughnut', number[], string>;

const DEFAULT_SERIES_COLORS: readonly string[] = [
  '#059669', // Emerald 600
  '#4f46e5', // Indigo 600
  '#d97706', // Amber 600
  '#0284c7', // Sky 600
  '#e11d48', // Rose 600
  '#7c3aed', // Violet 600
];

const DEFAULT_LINE_FILL_COLORS: readonly string[] = [
  'rgba(5, 150, 105, 0.14)',
  'rgba(79, 70, 229, 0.14)',
  'rgba(217, 119, 6, 0.14)',
  'rgba(2, 132, 199, 0.14)',
  'rgba(225, 29, 72, 0.14)',
  'rgba(124, 58, 237, 0.14)',
];

/**
 * Component thẻ biểu đồ chuẩn hóa (T031):
 * - Dùng Chart.js (Bar / Line / Doughnut) với bảo vệ an toàn cho SSR/JSDOM không có Canvas 2D.
 * - Hỗ trợ đủ 4 trạng thái: loading (skeleton), error (alert + retry), empty, và data.
 * - Tích hợp nút chuyển đổi "Xem bảng số liệu" / "Xem biểu đồ" truy cập được bằng bàn phím,
 *   cùng bảng <table class="sr-only"> luôn sẵn sàng cho Screen Reader khi ở chế độ biểu đồ.
 * - Tự động thích ứng Dark Mode ([data-theme="dark"]) và prefers-reduced-motion.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-[var(--surface-card,#ffffff)] dark:bg-slate-900 p-4 sm:p-5 shadow-xs"
      [attr.aria-label]="title()"
    >
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div class="min-w-0">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {{ title() }}
          </h2>
          @if (subtitle()) {
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              {{ subtitle() }}
            </p>
          }
        </div>

        @if (hasData()) {
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              (click)="toggleView()"
              [attr.aria-pressed]="showTable()"
              data-testid="chart-view-toggle"
              class="inline-flex items-center justify-center gap-2 min-h-11 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <i
                [class]="showTable() ? 'pi pi-chart-bar text-xs' : 'pi pi-table text-xs'"
                aria-hidden="true"
              ></i>
              <span>{{ showTable() ? 'Xem biểu đồ' : 'Xem bảng số liệu' }}</span>
            </button>
          </div>
        }
      </div>

      <!-- State 1: Loading Skeleton -->
      @if (loading()) {
        <div
          class="flex flex-col justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
          [style.height.px]="heightPx()"
          role="status"
          aria-busy="true"
          aria-label="Đang tải dữ liệu biểu đồ"
          data-testid="chart-loading-skeleton"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
            <div class="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
          </div>
          <div class="flex items-end gap-3 flex-1 pt-4">
            <div class="flex-1 h-2/5 rounded-t-lg bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
            <div class="flex-1 h-3/4 rounded-t-lg bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
            <div class="flex-1 h-1/2 rounded-t-lg bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
            <div class="flex-1 h-5/6 rounded-t-lg bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
            <div class="flex-1 h-2/3 rounded-t-lg bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"></div>
          </div>
        </div>
      }

      <!-- State 2: Error State + Retry -->
      @else if (error(); as errorMessage) {
        <div
          class="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/40 p-6 text-center flex flex-col items-center justify-center gap-3"
          [style.minHeight.px]="heightPx()"
          role="alert"
          data-testid="chart-error-state"
        >
          <div class="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center border border-rose-200 dark:border-rose-700/60">
            <i class="pi pi-exclamation-triangle text-xl" aria-hidden="true"></i>
          </div>
          <div class="space-y-1 max-w-md">
            <h3 class="text-sm font-bold text-rose-800 dark:text-rose-200">
              Không thể tải dữ liệu biểu đồ
            </h3>
            <p class="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              {{ errorMessage }}
            </p>
          </div>
          <button
            type="button"
            (click)="retry.emit()"
            data-testid="chart-retry-btn"
            class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
            <span>Thử lại</span>
          </button>
        </div>
      }

      <!-- State 3: Empty State -->
      @else if (isEmpty()) {
        <div
          class="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-6 text-center flex flex-col items-center justify-center gap-2"
          [style.minHeight.px]="heightPx()"
          data-testid="chart-empty-state"
        >
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60 mb-1">
            <i class="pi pi-chart-bar text-xl" aria-hidden="true"></i>
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ emptyTitle() }}
          </h3>
          <p class="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            {{ emptyDescription() }}
          </p>
        </div>
      }

      <!-- State 4: Data (Chart View + Screen Reader Fallback OR Visible Table View) -->
      @else {
        @if (!showTable()) {
          <div
            class="relative w-full"
            [style.height.px]="heightPx()"
            data-testid="chart-canvas-container"
          >
            <canvas
              #chartCanvas
              class="w-full h-full"
              role="img"
              [attr.aria-label]="canvasAriaLabel()"
            ></canvas>
          </div>

          <!-- Always keep an accessible sr-only table in chart mode for Screen Readers -->
          <table class="sr-only" data-testid="chart-sr-table">
            <caption>
              {{ title() }}@if (valueUnit()) { ({{ valueUnit() }}) }
            </caption>
            <thead>
              <tr>
                <th scope="col">Danh mục</th>
                @for (ds of datasets(); track $index) {
                  <th scope="col">
                    {{ ds.label }}@if (valueUnit()) { ({{ valueUnit() }}) }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (label of labels(); track $index; let rowIdx = $index) {
                <tr>
                  <th scope="row">{{ label }}</th>
                  @for (ds of datasets(); track $index) {
                    <td class="tabular-nums">{{ formatCellValue(ds.data[rowIdx]) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div
            class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"
            data-testid="chart-data-table-container"
          >
            <table
              class="w-full text-left border-collapse text-xs text-slate-700 dark:text-slate-200"
              data-testid="chart-data-table"
            >
              <caption class="sr-only">
                Bảng số liệu: {{ title() }}@if (valueUnit()) { ({{ valueUnit() }}) }
              </caption>
              <thead class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="py-3 px-4 font-semibold">Danh mục</th>
                  @for (ds of datasets(); track $index) {
                    <th scope="col" class="py-3 px-4 font-semibold text-right">
                      {{ ds.label }}@if (valueUnit()) { ({{ valueUnit() }}) }
                    </th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                @for (label of labels(); track $index; let rowIdx = $index) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    <th scope="row" class="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-100">
                      {{ label }}
                    </th>
                    @for (ds of datasets(); track $index) {
                      <td class="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {{ formatCellValue(ds.data[rowIdx]) }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class ChartCardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService, { optional: true });
  private readonly numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly chartType = input<ChartCardType>('bar');
  readonly labels = input<readonly string[]>([]);
  readonly datasets = input<readonly ChartCardDataset[]>([]);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly emptyTitle = input<string>('Chưa có dữ liệu biểu đồ');
  readonly emptyDescription = input<string>(
    'Chưa có số liệu phù hợp trong khoảng thời gian đã chọn.'
  );
  readonly valueUnit = input<string>('');
  readonly heightPx = input<number>(260);

  readonly retry = output<void>();

  readonly showTable = signal<boolean>(false);
  private readonly domDarkMode = signal<boolean>(this.readDomDarkMode());

  readonly isDarkTheme = computed(
    () => Boolean(this.themeService?.isDark()) || this.domDarkMode()
  );

  readonly isEmpty = computed(
    () =>
      this.labels().length === 0 ||
      this.datasets().length === 0 ||
      this.datasets().every((d) => d.data.length === 0)
  );

  readonly hasData = computed(
    () => !this.loading() && !this.error() && !this.isEmpty()
  );

  readonly canvasAriaLabel = computed(() => {
    const unitPart = this.valueUnit() ? ` (${this.valueUnit()})` : '';
    return `Biểu đồ ${this.chartType()} hiển thị ${this.title()}${unitPart}`;
  });

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chartInstance: SupportedChartInstance | null = null;

  constructor() {
    this.observeDomThemeChanges();

    this.destroyRef.onDestroy(() => {
      this.destroyChart();
    });

    effect(() => {
      const isLoading = this.loading();
      const errorMsg = this.error();
      const empty = this.isEmpty();
      const tableMode = this.showTable();
      const canvasRef = this.chartCanvas();
      const type = this.chartType();
      const currentLabels = this.labels();
      const currentDatasets = this.datasets();
      const dark = this.isDarkTheme();
      const unit = this.valueUnit();

      this.destroyChart();

      if (isLoading || errorMsg || empty || tableMode || !canvasRef) {
        return;
      }

      if (typeof HTMLCanvasElement === 'undefined') {
        return;
      }

      const canvas = canvasRef.nativeElement;
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      } catch {
        ctx = null;
      }

      if (!ctx) {
        return;
      }

      try {
        this.chartInstance = this.createChartInstance(
          ctx,
          type,
          currentLabels,
          currentDatasets,
          dark,
          unit
        );
      } catch {
        this.chartInstance = null;
      }
    });
  }

  toggleView(): void {
    this.showTable.update((current) => !current);
  }

  formatCellValue(value: number | undefined): string {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '—';
    }
    const formatted = this.numberFormatter.format(value);
    const unit = this.valueUnit().trim();
    return unit ? `${formatted} ${unit}` : formatted;
  }

  private destroyChart(): void {
    if (this.chartInstance) {
      try {
        this.chartInstance.destroy();
      } catch {
        // Ignore teardown errors when canvas context is unavailable
      }
      this.chartInstance = null;
    }
  }

  private createChartInstance(
    ctx: CanvasRenderingContext2D,
    type: ChartCardType,
    labels: readonly string[],
    datasets: readonly ChartCardDataset[],
    isDark: boolean,
    valueUnit: string
  ): SupportedChartInstance {
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.24)';
    const tooltipBg = isDark ? '#1e293b' : '#0f172a';
    const tooltipText = '#f8fafc';
    const fontFamily = "'Be Vietnam Pro', 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
    const reducedMotion = this.prefersReducedMotion();

    if (type === 'doughnut') {
      const doughnutDatasets: ChartDataset<'doughnut', number[]>[] = datasets.map((ds) => ({
        label: ds.label,
        data: [...ds.data],
        backgroundColor:
          this.cloneColorValue(ds.backgroundColor) ??
          labels.map((_, idx) => DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length]),
        borderColor: this.cloneColorValue(ds.borderColor) ?? (isDark ? '#111827' : '#ffffff'),
        borderWidth: ds.borderWidth ?? 2,
      }));

      const doughnutOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        ...(reducedMotion ? { animation: false as const } : {}),
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: textColor,
              font: { family: fontFamily, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            callbacks: {
              label: (context) =>
                this.formatTooltipLabel(
                  context.dataset.label,
                  context.parsed,
                  valueUnit
                ),
            },
          },
        },
      };

      const config: ChartConfiguration<'doughnut', number[], string> = {
        type: 'doughnut',
        data: { labels: [...labels], datasets: doughnutDatasets },
        options: doughnutOptions,
      };
      return new Chart(ctx, config);
    }

    if (type === 'line') {
      const lineDatasets: ChartDataset<'line', number[]>[] = datasets.map((ds, idx) => {
        const seriesColor = DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];
        const fillColor = DEFAULT_LINE_FILL_COLORS[idx % DEFAULT_LINE_FILL_COLORS.length];
        return {
          label: ds.label,
          data: [...ds.data],
          borderColor: this.cloneColorValue(ds.borderColor) ?? seriesColor,
          backgroundColor: this.cloneColorValue(ds.backgroundColor) ?? fillColor,
          borderWidth: ds.borderWidth ?? 2,
          fill: ds.fill ?? false,
          tension: ds.tension ?? 0.35,
        };
      });

      const lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        ...(reducedMotion ? { animation: false as const } : {}),
        plugins: {
          legend: {
            display: datasets.length > 1,
            labels: {
              color: textColor,
              font: { family: fontFamily, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            callbacks: {
              label: (context) =>
                this.formatTooltipLabel(
                  context.dataset.label,
                  context.parsed.y,
                  valueUnit
                ),
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: fontFamily, size: 12 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, font: { family: fontFamily, size: 12 } },
            grid: { color: gridColor },
          },
        },
      };

      const config: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: { labels: [...labels], datasets: lineDatasets },
        options: lineOptions,
      };
      return new Chart(ctx, config);
    }

    const barDatasets: ChartDataset<'bar', number[]>[] = datasets.map((ds, idx) => {
      const seriesColor = DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];
      return {
        label: ds.label,
        data: [...ds.data],
        backgroundColor: this.cloneColorValue(ds.backgroundColor) ?? seriesColor,
        borderColor: this.cloneColorValue(ds.borderColor) ?? seriesColor,
        borderWidth: ds.borderWidth ?? 1,
        borderRadius: 6,
      };
    });

    const barOptions: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      ...(reducedMotion ? { animation: false as const } : {}),
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: textColor,
            font: { family: fontFamily, size: 12 },
          },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          callbacks: {
            label: (context) =>
              this.formatTooltipLabel(
                context.dataset.label,
                context.parsed.y,
                valueUnit
              ),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: fontFamily, size: 12 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: fontFamily, size: 12 } },
          grid: { color: gridColor },
        },
      },
    };

    const config: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: { labels: [...labels], datasets: barDatasets },
      options: barOptions,
    };
    return new Chart(ctx, config);
  }

  private formatTooltipLabel(
    datasetLabel: string | undefined,
    value: number | null,
    valueUnit: string
  ): string {
    const prefix = datasetLabel ? `${datasetLabel}: ` : '';
    const formatted = value !== null && Number.isFinite(value)
      ? this.numberFormatter.format(value)
      : '—';
    const unit = valueUnit.trim();
    return unit ? `${prefix}${formatted} ${unit}` : `${prefix}${formatted}`;
  }

  private cloneColorValue(
    color: string | readonly string[] | undefined
  ): string | string[] | undefined {
    if (color === undefined) {
      return undefined;
    }
    return typeof color === 'string' ? color : [...color];
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private readDomDarkMode(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    const htmlTheme = document.documentElement?.getAttribute('data-theme');
    const bodyTheme = document.body?.getAttribute('data-theme');
    return (
      htmlTheme === 'dark' ||
      bodyTheme === 'dark' ||
      Boolean(document.body?.classList?.contains('dark-theme'))
    );
  }

  private observeDomThemeChanges(): void {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }
    const observer = new MutationObserver(() => {
      this.domDarkMode.set(this.readDomDarkMode());
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
    }
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
    }
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
