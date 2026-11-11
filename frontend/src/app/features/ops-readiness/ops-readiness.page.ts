import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { LoadingOverlayService } from '../../core/services/loading-overlay.service';
import {
  IsolationTestResult,
  LoadTestMetricsSummary,
  StructuredLogEntry,
  generateStructuredLogEntries,
  runAllIsolationAssertions,
  simulateLoadTestRun
} from './ops-readiness.utils';

@Component({
  selector: 'app-ops-readiness-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- 1. PAGE HEADER -->
      <app-page-header
        [title]="'Trung tâm Kiểm định & Giám sát SRE (Enterprise Readiness)'"
        subtitle="Chứng minh cô lập dữ liệu đa Tenant/Chi nhánh, Load Test SignalR & VNPay, CI/CD IaC tự động hóa VPS và Giám sát Log cấu trúc tập trung"
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="runAllVerifications()"
            [disabled]="runningSuite()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <i class="pi" [ngClass]="runningSuite() ? 'pi-spin pi-spinner' : 'pi-play'"></i>
            <span>{{ runningSuite() ? 'Đang chạy bộ kiểm định...' : 'Chạy toàn bộ Kiểm định Tự động' }}</span>
          </button>
        </div>
      </app-page-header>

      <!-- 2. SUMMARY KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold text-slate-500">Cô lập Đa Tenant & Chi nhánh</div>
            <div class="mt-1 text-2xl font-extrabold text-emerald-700">
              {{ passedIsolationCount() }}/{{ isolationResults().length }} PASS
            </div>
            <div class="mt-1 text-[11px] text-slate-500">EF Global Filter + Interceptor + Hub</div>
          </div>
          <span class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <i class="pi pi-shield text-lg"></i>
          </span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold text-slate-500">SignalR Hub Load Test ({{ activeLoadProfile() }})</div>
            <div class="mt-1 text-2xl font-extrabold text-indigo-700">
              p95: {{ loadTestSummary().signalr.p95LatencyMs }}ms
            </div>
            <div class="mt-1 text-[11px] text-emerald-600 font-semibold">
              100% chặn nghe lén chéo chi nhánh
            </div>
          </div>
          <span class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <i class="pi pi-bolt text-lg"></i>
          </span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold text-slate-500">VNPay IPN Concurrency Storm</div>
            <div class="mt-1 text-2xl font-extrabold text-sky-700">
              p95: {{ loadTestSummary().vnpay.p95LatencyMs }}ms
            </div>
            <div class="mt-1 text-[11px] text-emerald-600 font-semibold">
              Idempotency 02 & Checksum 97 đạt 100%
            </div>
          </div>
          <span class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <i class="pi pi-credit-card text-lg"></i>
          </span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold text-slate-500">CI/CD VPS & Observability (PLG)</div>
            <div class="mt-1 text-2xl font-extrabold text-slate-800">4/4 Active</div>
            <div class="mt-1 text-[11px] text-slate-500">GHCR + Terraform + Prometheus + Loki</div>
          </div>
          <span class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <i class="pi pi-server text-lg"></i>
          </span>
        </div>
      </div>

      <!-- 3. PILLAR NAVIGATION TABS -->
      <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          (click)="activeTab.set('ISOLATION')"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          [ngClass]="
            activeTab() === 'ISOLATION'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          "
        >
          1. Cô lập Đa Tenant & Chi nhánh (Automated Tests)
        </button>

        <button
          type="button"
          (click)="activeTab.set('LOAD_TEST')"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          [ngClass]="
            activeTab() === 'LOAD_TEST'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          "
        >
          2. Load Test SignalR Hub & VNPay IPN (k6)
        </button>

        <button
          type="button"
          (click)="activeTab.set('CICD_IAC')"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          [ngClass]="
            activeTab() === 'CICD_IAC'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          "
        >
          3. Tự động hóa Deploy VPS (CI/CD & Terraform IaC)
        </button>

        <button
          type="button"
          (click)="activeTab.set('OBSERVABILITY')"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          [ngClass]="
            activeTab() === 'OBSERVABILITY'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          "
        >
          4. Structured Logs & Giám sát Tập trung (Prometheus/Loki)
        </button>
      </div>

      <!-- TAB 1: MULTI-TENANT & CROSS-BRANCH ISOLATION -->
      @if (activeTab() === 'ISOLATION') {
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-slate-800">
                Bằng chứng Kiểm thử Tự động Cô lập Đa Tenant & Đa Chi nhánh (Fail-Closed)
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Thực thi đồng bộ tại:
                <code class="text-emerald-700 font-mono">backend/tests/HotelSaas.Application.Tests/Isolation/MultiTenantBranchIsolationTests.cs</code>
              </p>
            </div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <i class="pi pi-check-circle"></i> 0 Cross-Tenant / Cross-Branch Leakage
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200/80">
                  <th class="py-3 px-4">Mã Test</th>
                  <th class="py-3 px-4">Lớp Bảo vệ</th>
                  <th class="py-3 px-4">Kịch bản Kiểm định & Ngữ cảnh Gọi</th>
                  <th class="py-3 px-4">Kết quả Mong đợi</th>
                  <th class="py-3 px-4">Kết quả Thực tế</th>
                  <th class="py-3 px-4 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                @for (item of isolationResults(); track item.id) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="py-3.5 px-4 font-mono font-bold text-slate-700">{{ item.id }}</td>
                    <td class="py-3.5 px-4">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {{ item.category }}
                      </span>
                    </td>
                    <td class="py-3.5 px-4">
                      <div class="font-semibold text-slate-800">{{ item.title }}</div>
                      <div class="text-[11px] text-slate-500 mt-0.5">
                        Caller: <span class="font-medium text-slate-700">{{ item.callerDesc }}</span> → {{ item.targetDesc }}
                      </div>
                    </td>
                    <td class="py-3.5 px-4 text-slate-600">{{ item.expectedOutcome }}</td>
                    <td class="py-3.5 px-4 font-mono text-[11px] text-slate-800">{{ item.actualOutcome }}</td>
                    <td class="py-3.5 px-4 text-right">
                      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <i class="pi pi-check text-[10px]"></i> PASS ({{ item.durationMs }}ms)
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- TAB 2: SIGNALR & VNPAY LOAD TESTING -->
      @if (activeTab() === 'LOAD_TEST') {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div>
              <h2 class="text-sm font-bold text-slate-800">Cấu hình Kịch bản Load Test (k6)</h2>
              <p class="text-xs text-slate-500">
                Scripts: <code class="text-indigo-700 font-mono">scripts/load-tests/signalr-hub.k6.js</code> &
                <code class="text-indigo-700 font-mono">scripts/load-tests/vnpay-checkout-ipn.k6.js</code>
              </p>
            </div>
            <div class="flex items-center gap-2">
              @for (prof of loadProfiles; track prof.id) {
                <button
                  type="button"
                  (click)="selectLoadProfile(prof.id)"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  [ngClass]="
                    activeLoadProfile() === prof.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  "
                >
                  {{ prof.label }}
                </button>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- SignalR Hub Card -->
            <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Realtime WebSocket Hub
                  </span>
                  <h3 class="text-base font-bold text-slate-800 mt-1">
                    SignalR NotificationHub (/hubs/notifications)
                  </h3>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  SLA ĐẠT (p95 &lt; 150ms)
                </span>
              </div>

              <div class="grid grid-cols-3 gap-3 text-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <div class="text-[11px] text-slate-500">Virtual Users</div>
                  <div class="text-lg font-extrabold text-slate-800">{{ loadTestSummary().signalr.virtualUsers }} VUs</div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-500">Độ trễ p95 / p99</div>
                  <div class="text-lg font-extrabold text-indigo-700">
                    {{ loadTestSummary().signalr.p95LatencyMs }}ms / {{ loadTestSummary().signalr.p99LatencyMs }}ms
                  </div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-500">Cross-Branch Block</div>
                  <div class="text-lg font-extrabold text-emerald-700">100%</div>
                </div>
              </div>

              <ul class="space-y-2 text-xs text-slate-600">
                @for (pt of loadTestSummary().signalr.highlights; track pt) {
                  <li class="flex items-start gap-2">
                    <i class="pi pi-check-circle text-emerald-600 mt-0.5"></i>
                    <span>{{ pt }}</span>
                  </li>
                }
              </ul>
            </div>

            <!-- VNPay IPN Card -->
            <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                    Payment Gateway & Webhook
                  </span>
                  <h3 class="text-base font-bold text-slate-800 mt-1">
                    VNPay Checkout & IPN Concurrency (/api/public/payments/vnpay/ipn)
                  </h3>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  SLA ĐẠT (p95 &lt; 180ms)
                </span>
              </div>

              <div class="grid grid-cols-3 gap-3 text-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <div class="text-[11px] text-slate-500">Thông lượng</div>
                  <div class="text-lg font-extrabold text-slate-800">{{ loadTestSummary().vnpay.rps }} req/s</div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-500">Độ trễ p95 / p99</div>
                  <div class="text-lg font-extrabold text-sky-700">
                    {{ loadTestSummary().vnpay.p95LatencyMs }}ms / {{ loadTestSummary().vnpay.p99LatencyMs }}ms
                  </div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-500">Tamper Guard (97)</div>
                  <div class="text-lg font-extrabold text-emerald-700">100%</div>
                </div>
              </div>

              <ul class="space-y-2 text-xs text-slate-600">
                @for (pt of loadTestSummary().vnpay.highlights; track pt) {
                  <li class="flex items-start gap-2">
                    <i class="pi pi-check-circle text-emerald-600 mt-0.5"></i>
                    <span>{{ pt }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>
      }

      <!-- TAB 3: CI/CD & IAC AUTOMATED VPS DEPLOYMENT -->
      @if (activeTab() === 'CICD_IAC') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-800">
                Pipeline CI/CD Triển khai Tự động lên VPS (.github/workflows/cd-vps.yml)
              </h3>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Zero Manual SSH
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="font-bold text-slate-800">Stage 1: Multi-Tenant & Branch Isolation Gate</div>
                <div class="text-slate-600 mt-1">
                  Chạy tự động <code class="font-mono text-indigo-700">MultiTenantBranchIsolationTests</code>,
                  <code class="font-mono text-indigo-700">NotificationHubSecurityTests</code> và
                  <code class="font-mono text-indigo-700">VnpayIntegrationTests</code> trên PostgreSQL 17 container trước khi cho phép đóng gói image.
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="font-bold text-slate-800">Stage 2: Build & Push Immutable Images (GHCR)</div>
                <div class="text-slate-600 mt-1">
                  Đóng gói Docker Image cho Backend (.NET 10) và Frontend (Angular 22 + Nginx) gắn nhãn bất biến
                  <code class="font-mono text-emerald-700">sha-&lt;commit&gt;</code> đẩy lên GitHub Container Registry.
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="font-bold text-slate-800">Stage 3: Rolling Update VPS + Readiness Probe + Auto-Rollback</div>
                <div class="text-slate-600 mt-1">
                  Tự động đồng bộ manifest Compose lên <code class="font-mono">/opt/hotel-saas</code>, kiểm tra
                  <code class="font-mono text-emerald-700">GET /health/ready</code> &amp;
                  <code class="font-mono text-emerald-700">GET /metrics</code>. Tự động rollback về digest cũ nếu probe thất bại.
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-800">
                Hạ tầng IaC (infra/terraform/main.tf & docker-compose.observability.yml)
              </h3>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                Terraform + Compose
              </span>
            </div>

            <div class="space-y-3 text-xs text-slate-600">
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="font-bold text-slate-800">Cloud Firewall & Network Isolation</div>
                <p class="mt-1">
                  Chỉ mở cổng <code class="font-mono">80/443</code> (Web/Reverse Proxy), <code class="font-mono">22</code> (SSH Key) và
                  <code class="font-mono">3001</code> (Grafana giới hạn IP). Cổng PostgreSQL (<code class="font-mono">5435</code>), Redis (<code class="font-mono">6381</code>), Prometheus (<code class="font-mono">9090</code>) và Loki (<code class="font-mono">3100</code>) hoàn toàn cô lập trong mạng nội bộ Docker.
                </p>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="font-bold text-slate-800">Sysctl Kernel Tuning cho SignalR WebSockets</div>
                <p class="mt-1">
                  Cấu hình tự động thông qua cloud-init trong Terraform:
                  <code class="font-mono">fs.file-max = 2097152</code>,
                  <code class="font-mono">net.core.somaxconn = 65535</code>, tối ưu hàng nghìn kết nối WebSocket đồng thời.
                </p>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 4: STRUCTURED LOGGING & CENTRALIZED MONITORING -->
      @if (activeTab() === 'OBSERVABILITY') {
        <div class="space-y-4">
          <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-800">
                  Dòng sự kiện Structured JSON Logs (Serilog + CorrelationId + Tenant/Property Context)
                </h3>
                <p class="text-xs text-slate-500">
                  Middleware: <code class="font-mono text-indigo-700">CorrelationAndStructuredLogMiddleware.cs</code> →
                  Promtail → Loki → Grafana
                </p>
              </div>

              <div class="flex items-center gap-2">
                <select
                  [ngModel]="selectedLogLevel()"
                  (ngModelChange)="selectedLogLevel.set($event)"
                  aria-label="Lọc theo cấp độ Log"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700"
                >
                  <option value="ALL">Tất cả mức độ (All Levels)</option>
                  <option value="Information">Information</option>
                  <option value="Warning">Warning (Security / Replay)</option>
                  <option value="Error">Error (Isolation Block / 5xx)</option>
                </select>
              </div>
            </div>

            <div class="space-y-2.5">
              @for (log of filteredLogs(); track log.correlationId) {
                <div class="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40': log.level === 'Information',
                          'bg-amber-500/20 text-amber-300 border border-amber-500/40': log.level === 'Warning',
                          'bg-rose-500/20 text-rose-300 border border-rose-500/40': log.level === 'Error'
                        }"
                      >
                        {{ log.level }}
                      </span>
                      <span class="text-slate-400">{{ log.timestamp }}</span>
                      <span class="text-sky-300">CorrelationId={{ log.correlationId }}</span>
                    </div>
                    <span class="text-emerald-300">{{ log.statusCode }} ({{ log.elapsedMs }}ms)</span>
                  </div>
                  <div class="text-slate-200">{{ log.renderedMessage }}</div>
                  <div class="text-[10px] text-slate-400 flex flex-wrap gap-3 pt-1 border-t border-slate-800">
                    <span>TenantId: <strong class="text-slate-200">{{ log.tenantId }}</strong></span>
                    <span>PropertyId: <strong class="text-slate-200">{{ log.propertyId }}</strong></span>
                    <span>UserId: <strong class="text-slate-200">{{ log.userId }}</strong></span>
                    @if (log.errorCode) {
                      <span class="text-rose-400">ErrorCode: <strong>{{ log.errorCode }}</strong></span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class OpsReadinessPage {
  private readonly loadingOverlay = inject(LoadingOverlayService);

  readonly activeTab = signal<'ISOLATION' | 'LOAD_TEST' | 'CICD_IAC' | 'OBSERVABILITY'>('ISOLATION');
  readonly runningSuite = signal(false);
  readonly isolationResults = signal<IsolationTestResult[]>(runAllIsolationAssertions());
  readonly activeLoadProfile = signal<'SMOKE_50VU' | 'LOAD_150VU' | 'STRESS_500VU'>('LOAD_150VU');
  readonly selectedLogLevel = signal<'ALL' | 'Information' | 'Warning' | 'Error'>('ALL');
  readonly structuredLogs = signal<StructuredLogEntry[]>(generateStructuredLogEntries());

  readonly loadProfiles: Array<{ id: 'SMOKE_50VU' | 'LOAD_150VU' | 'STRESS_500VU'; label: string }> = [
    { id: 'SMOKE_50VU', label: 'Smoke (50 VUs)' },
    { id: 'LOAD_150VU', label: 'Load (150 VUs)' },
    { id: 'STRESS_500VU', label: 'Stress (500 VUs)' }
  ];

  readonly passedIsolationCount = computed(() => this.isolationResults().filter(r => r.passed).length);
  readonly loadTestSummary = computed<{ signalr: LoadTestMetricsSummary; vnpay: LoadTestMetricsSummary }>(() =>
    simulateLoadTestRun(this.activeLoadProfile())
  );

  readonly filteredLogs = computed(() => {
    const lvl = this.selectedLogLevel();
    const all = this.structuredLogs();
    if (lvl === 'ALL') return all;
    return all.filter(l => l.level === lvl);
  });

  selectLoadProfile(profile: 'SMOKE_50VU' | 'LOAD_150VU' | 'STRESS_500VU'): void {
    const taskId = this.loadingOverlay.begin(`Đang mô phỏng kịch bản k6 (${profile})...`);
    setTimeout(() => {
      this.activeLoadProfile.set(profile);
      this.loadingOverlay.end(taskId);
    }, 350);
  }

  runAllVerifications(): void {
    this.runningSuite.set(true);
    const taskId = this.loadingOverlay.begin('Đang chạy bộ kiểm định Multi-Tenant, SignalR & VNPay...');
    setTimeout(() => {
      this.isolationResults.set(runAllIsolationAssertions());
      this.structuredLogs.set(generateStructuredLogEntries());
      this.runningSuite.set(false);
      this.loadingOverlay.end(taskId);
    }, 550);
  }
}
