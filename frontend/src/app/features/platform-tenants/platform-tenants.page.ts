import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';
import {
  PlatformGovernanceService,
  PlatformTenantBranchDto,
  PlatformTenantDto,
  SupportAccessGrantDto,
  SupportDiagnosticSnapshotDto
} from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-platform-tenants-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    BusinessDateTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 max-w-7xl mx-auto pb-12">
      <app-page-header
        title="Quản trị Thuê bao & Phê duyệt Chi nhánh (Tenants)"
        subtitle="Giám sát vòng đời doanh nghiệp SaaS, hạn ngạch tài nguyên, duyệt xuất bản khách sạn lên cổng đặt phòng và kiểm tra Support Grants."
      >
        <button
          type="button"
          (click)="loadAll()"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
          <span>Làm mới</span>
        </button>
      </app-page-header>

      <!-- KPI Overview -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card title="Tổng số Tenant" [value]="tenants().length" variant="indigo">
          <i icon class="pi pi-building text-lg"></i>
        </app-stat-card>
        <app-stat-card title="Tenant hoạt động" [value]="activeCount()" variant="emerald">
          <i icon class="pi pi-check-circle text-lg"></i>
        </app-stat-card>
        <app-stat-card title="Chi nhánh chờ duyệt" [value]="pendingPublishCount()" variant="amber">
          <i icon class="pi pi-clock text-lg"></i>
        </app-stat-card>
        <app-stat-card
          title="Tổng thu SaaS đã nhận"
          [value]="(totalSaasCollected() | number:'1.0-0') + ' ₫'"
          variant="purple"
        >
          <i icon class="pi pi-wallet text-lg"></i>
        </app-stat-card>
      </div>

      <!-- Filters Bar -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div class="relative flex-1 max-w-md">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              [ngModel]="searchKeyword()"
              (ngModelChange)="searchKeyword.set($event)"
              aria-label="Tìm kiếm tenant"
              placeholder="Tìm theo tên, mã code, thành phố, email..."
              class="w-full min-h-[44px] pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <select
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            aria-label="Lọc trạng thái tenant"
            class="min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Active">Đang hoạt động (Active)</option>
            <option value="Suspended">Tạm đình chỉ (Suspended)</option>
            <option value="PendingApproval">Chờ duyệt</option>
          </select>
        </div>

        <label class="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            [ngModel]="onlyPendingPublish()"
            (ngModelChange)="onlyPendingPublish.set($event)"
            class="w-4 h-4 accent-indigo-600 rounded"
          />
          <span>Chỉ hiện Tenant có chi nhánh chờ duyệt xuất bản</span>
        </label>
      </div>

      <!-- Tenants List -->
      @if (isLoading()) {
        <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2"></i>
          <p class="text-sm">Đang tải danh sách thuê bao...</p>
        </div>
      } @else if (filteredTenants().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200">
          <app-empty-state
            iconClass="pi pi-building"
            title="Không tìm thấy thuê bao phù hợp"
            description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."
            actionLabel="Xóa bộ lọc"
            (actionClick)="resetFilters()"
          />
        </div>
      } @else {
        <div class="space-y-4">
          @for (t of filteredTenants(); track t.id) {
            <article class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div class="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
                <div class="space-y-1.5 min-w-0">
                  <div class="flex items-center gap-2.5 flex-wrap">
                    <span class="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-100">
                      {{ t.code }}
                    </span>
                    <h2 class="text-lg font-bold text-slate-900 truncate">{{ t.name }}</h2>
                    <app-status-badge
                      [status]="t.statusName"
                      [customLabel]="t.statusName === 'Active' ? 'Đang hoạt động' : t.statusName === 'Suspended' ? 'Tạm đình chỉ' : t.statusName"
                      [color]="t.statusName === 'Active' ? 'emerald' : t.statusName === 'Suspended' ? 'rose' : 'amber'"
                    />
                  </div>
                  <div class="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                    <span><i class="pi pi-map-marker mr-1"></i>{{ t.city || 'Chưa cập nhật' }}</span>
                    @if (t.email) {
                      <span><i class="pi pi-envelope mr-1"></i>{{ t.email }}</span>
                    }
                    <span><i class="pi pi-box mr-1 text-indigo-600"></i><strong>{{ t.subscriptionTierName }}</strong> ({{ t.subscriptionStatus }})</span>
                    <span class="font-mono font-semibold text-emerald-700">Đã thu SaaS: {{ t.totalSaasPaid | number:'1.0-0' }} ₫</span>
                  </div>
                </div>

                <div class="flex items-center gap-3 flex-wrap shrink-0">
                  <div class="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
                    <div>Phòng: <strong>{{ t.roomCount }}</strong> / {{ t.maxRoomsAllowed >= 999 ? '∞' : t.maxRoomsAllowed }}</div>
                    <div>Nhân sự: <strong>{{ t.staffCount }}</strong> / {{ t.maxStaffAllowed >= 999 ? '∞' : t.maxStaffAllowed }}</div>
                  </div>

                  <button
                    type="button"
                    (click)="toggleTenantStatus(t)"
                    [disabled]="busyId() === t.id"
                    class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50"
                    [ngClass]="t.statusName === 'Active'
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                  >
                    <i [class]="t.statusName === 'Active' ? 'pi pi-ban' : 'pi pi-check'"></i>
                    <span>{{ t.statusName === 'Active' ? 'Tạm đình chỉ' : 'Kích hoạt lại' }}</span>
                  </button>
                </div>
              </div>

              <!-- Branches / Publish Approval Table -->
              <div class="p-4 bg-slate-50/50">
                <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
                  <span>Chi nhánh / Cơ sở lưu trú ({{ t.branches.length }})</span>
                  <span>Đã xuất bản: {{ t.publishedBranchesCount }} / {{ t.activeBranchesCount }} hoạt động</span>
                </div>

                @if (t.branches.length === 0) {
                  <p class="text-xs text-slate-400 py-2">Doanh nghiệp chưa tạo chi nhánh nào.</p>
                } @else {
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    @for (b of t.branches; track b.id) {
                      <div class="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-mono font-bold text-slate-700">{{ b.code }}</span>
                            <span class="text-sm font-semibold text-slate-900 truncate">{{ b.name }}</span>
                          </div>
                          <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{{ b.city || '—' }}</span>
                            <span>&bull;</span>
                            <span>{{ b.roomCount }} phòng</span>
                            <span>&bull;</span>
                            <app-status-badge
                              [status]="b.isPublished"
                              [customLabel]="b.isPublished ? 'Đã xuất bản' : 'Chờ duyệt B2C'"
                              [color]="b.isPublished ? 'emerald' : 'amber'"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          (click)="toggleBranchPublish(b)"
                          [disabled]="busyId() === b.id"
                          class="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                          [ngClass]="b.isPublished
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'"
                        >
                          <i [class]="b.isPublished ? 'pi pi-eye-slash' : 'pi pi-globe'"></i>
                          <span>{{ b.isPublished ? 'Gỡ xuất bản' : 'Duyệt xuất bản' }}</span>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </article>
          }
        </div>
      }

      <!-- Active Support Access Grants (SDD-05 D24) -->
      <section class="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base font-bold text-slate-900">Quyền Hỗ trợ Kỹ thuật Tạm thời (Support Access Grants)</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Chỉ truy cập chẩn đoán được khi Tenant Owner cấp phép còn hiệu lực; mọi lượt truy cập được ghi SupportAuditLog.
            </p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            {{ activeGrantsCount() }} đang hiệu lực
          </span>
        </div>

        @if (platformGrants().length === 0) {
          <p class="text-xs text-slate-400 py-4 text-center">Chưa có Support Access Grant nào được Tenant cấp.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="py-3 px-3">Tenant</th>
                  <th class="py-3 px-3">Nhân sự hỗ trợ</th>
                  <th class="py-3 px-3">Phạm vi</th>
                  <th class="py-3 px-3">Lý do</th>
                  <th class="py-3 px-3">Hết hạn (UTC+7)</th>
                  <th class="py-3 px-3">Trạng thái</th>
                  <th class="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (g of platformGrants(); track g.id) {
                  <tr>
                    <td class="py-3 px-3 font-semibold text-slate-900">{{ g.tenantName }}</td>
                    <td class="py-3 px-3">{{ g.targetSupportEmail || g.targetSupportName }}</td>
                    <td class="py-3 px-3 font-mono font-bold text-indigo-700">{{ g.scope }}</td>
                    <td class="py-3 px-3 max-w-xs truncate">{{ g.reason }}</td>
                    <td class="py-3 px-3 whitespace-nowrap">{{ g.expiresAtUtc | businessDateTime }}</td>
                    <td class="py-3 px-3">
                      <app-status-badge
                        [status]="g.status"
                        [customLabel]="g.status"
                        [color]="g.isCurrentlyActive ? 'emerald' : g.status === 'REVOKED' ? 'rose' : 'slate'"
                      />
                    </td>
                    <td class="py-3 px-3 text-right">
                      <button
                        type="button"
                        (click)="inspectDiagnostics(g)"
                        [disabled]="!g.isCurrentlyActive || busyId() === g.id"
                        class="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <i class="pi pi-search-plus text-[11px]"></i>
                        <span>Chẩn đoán</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <!-- Diagnostic Snapshot Modal -->
    @if (diagnosticSnapshot(); as snap) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diag-modal-title"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden">
          <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 id="diag-modal-title" class="text-base font-bold">
                Diagnostic Snapshot — {{ snap.tenantName }} ({{ snap.tenantCode }})
              </h3>
              <p class="text-xs text-slate-300 mt-0.5">
                Phạm vi: {{ snap.scope }} &bull; Hết hạn: {{ snap.expiresAtUtc | businessDateTime }}
              </p>
            </div>
            <button
              type="button"
              aria-label="Đóng cửa sổ chẩn đoán"
              (click)="diagnosticSnapshot.set(null)"
              class="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div class="text-xs text-slate-500">Chi nhánh</div>
                <div class="text-xl font-bold text-slate-900">{{ snap.propertyCount }}</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div class="text-xs text-slate-500">Tổng phòng</div>
                <div class="text-xl font-bold text-slate-900">{{ snap.totalRooms }}</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div class="text-xs text-slate-500">Nhân sự Active</div>
                <div class="text-xl font-bold text-slate-900">{{ snap.activeStaffCount }}</div>
              </div>
              <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div class="text-xs text-indigo-700">Audit entries</div>
                <div class="text-xl font-bold text-indigo-900">{{ snap.auditEntriesCount }}</div>
              </div>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto">
              @for (br of snap.branches; track br.propertyId) {
                <div class="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div class="font-bold text-slate-900">{{ br.name }} ({{ br.code }})</div>
                    <div class="text-slate-500">{{ br.isPublished ? 'Đã xuất bản' : 'Chưa xuất bản' }}</div>
                  </div>
                  <div class="text-right font-mono">
                    <div>{{ br.roomCount }} phòng</div>
                    <div class="text-emerald-700">{{ br.activeReservationsCount }} booking active</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              (click)="diagnosticSnapshot.set(null)"
              class="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PlatformTenantsPage implements OnInit {
  private readonly governanceService = inject(PlatformGovernanceService);
  private readonly alertService = inject(AlertService);

  readonly tenants = signal<PlatformTenantDto[]>([]);
  readonly platformGrants = signal<SupportAccessGrantDto[]>([]);
  readonly diagnosticSnapshot = signal<SupportDiagnosticSnapshotDto | null>(null);
  readonly isLoading = signal(false);
  readonly busyId = signal<string | null>(null);

  readonly searchKeyword = signal('');
  readonly statusFilter = signal('ALL');
  readonly onlyPendingPublish = signal(false);

  readonly activeCount = computed(() =>
    this.tenants().filter(t => t.statusName === 'Active').length
  );

  readonly pendingPublishCount = computed(() =>
    this.tenants().reduce(
      (sum, t) => sum + t.branches.filter(b => b.status === 'Active' || b.status === 2 ? !b.isPublished : !b.isPublished).length,
      0
    )
  );

  readonly totalSaasCollected = computed(() =>
    this.tenants().reduce((sum, t) => sum + (t.totalSaasPaid || 0), 0)
  );

  readonly activeGrantsCount = computed(() =>
    this.platformGrants().filter(g => g.isCurrentlyActive).length
  );

  readonly filteredTenants = computed(() => {
    const kw = this.searchKeyword().trim().toLowerCase();
    const status = this.statusFilter();
    const pendingOnly = this.onlyPendingPublish();

    return this.tenants().filter(t => {
      if (status !== 'ALL' && t.statusName !== status) return false;
      if (pendingOnly && !t.branches.some(b => !b.isPublished)) return false;
      if (kw) {
        const hay = `${t.name} ${t.code} ${t.city} ${t.email ?? ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.governanceService.getPlatformTenants().subscribe({
      next: list => {
        this.tenants.set(list || []);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        this.alertService.error(err?.error?.message || 'Không thể tải danh sách Tenant.');
      }
    });

    this.governanceService.getPlatformSupportGrants().subscribe({
      next: grants => this.platformGrants.set(grants || []),
      error: () => {}
    });
  }

  resetFilters(): void {
    this.searchKeyword.set('');
    this.statusFilter.set('ALL');
    this.onlyPendingPublish.set(false);
  }

  toggleTenantStatus(tenant: PlatformTenantDto): void {
    const nextAction = tenant.statusName === 'Active' ? 'Tạm đình chỉ' : 'Kích hoạt lại';
    if (!confirm(`${nextAction} doanh nghiệp "${tenant.name}"?`)) {
      return;
    }

    this.busyId.set(tenant.id);
    this.governanceService.toggleTenantStatus(tenant.id, { reason: `${nextAction} từ Platform Portal` }).subscribe({
      next: res => {
        this.tenants.update(list =>
          list.map(t =>
            t.id === tenant.id
              ? { ...t, status: res.status, statusName: res.statusName }
              : t
          )
        );
        this.busyId.set(null);
        this.alertService.success(`Đã cập nhật trạng thái Tenant "${tenant.name}" -> ${res.statusName}`);
      },
      error: err => {
        this.busyId.set(null);
        this.alertService.error(err?.error?.message || 'Không thể cập nhật trạng thái Tenant.');
      }
    });
  }

  toggleBranchPublish(branch: PlatformTenantBranchDto): void {
    const targetPublished = !branch.isPublished;
    this.busyId.set(branch.id);
    this.governanceService.approvePropertyPublish(branch.id, targetPublished).subscribe({
      next: res => {
        this.tenants.update(list =>
          list.map(t => {
            if (!t.branches.some(b => b.id === branch.id)) return t;
            const nextBranches = t.branches.map(b =>
              b.id === branch.id ? { ...b, isPublished: res.isPublished } : b
            );
            return {
              ...t,
              branches: nextBranches,
              publishedBranchesCount: nextBranches.filter(b => b.isPublished).length
            };
          })
        );
        this.busyId.set(null);
        this.alertService.success(
          res.isPublished
            ? `Đã phê duyệt xuất bản chi nhánh "${branch.name}".`
            : `Đã gỡ xuất bản chi nhánh "${branch.name}".`
        );
      },
      error: err => {
        this.busyId.set(null);
        this.alertService.error(err?.error?.message || 'Không thể cập nhật trạng thái xuất bản chi nhánh.');
      }
    });
  }

  inspectDiagnostics(grant: SupportAccessGrantDto): void {
    this.busyId.set(grant.id);
    this.governanceService.accessSupportDiagnostics(grant.id).subscribe({
      next: snap => {
        this.busyId.set(null);
        this.diagnosticSnapshot.set(snap);
      },
      error: err => {
        this.busyId.set(null);
        this.alertService.error(err?.error?.message || 'Không thể truy cập dữ liệu chẩn đoán.');
      }
    });
  }
}
