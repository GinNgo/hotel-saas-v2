import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  SearchableSelectComponent,
  SearchableSelectItem
} from '../../shared/components/searchable-select/searchable-select.component';
import { BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';
import {
  PlatformGovernanceService,
  SupportAccessGrantDto,
  SupportAuditLogDto,
  SupportUserOptionDto
} from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-support-grants-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    SearchableSelectComponent,
    BusinessDateTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 max-w-7xl mx-auto pb-12">
      <app-page-header
        title="Ủy quyền Hỗ trợ Kỹ thuật Tạm thời (Support Access Grants)"
        subtitle="Kiểm soát minh bạch theo chuẩn SDD-05 D24: Chủ sở hữu cấp phép giới hạn thời gian (15 phút - 72 giờ), thu hồi tức thì và theo dõi toàn bộ nhật ký truy cập."
      >
        <button
          type="button"
          (click)="loadAll()"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()" aria-hidden="true"></i>
          <span>Làm mới</span>
        </button>
        <button
          type="button"
          (click)="openCreateModal()"
          class="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
        >
          <i class="pi pi-key" aria-hidden="true"></i>
          <span>Cấp quyền Hỗ trợ mới</span>
        </button>
      </app-page-header>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <app-stat-card title="Quyền đang hiệu lực" [value]="activeCount()" variant="emerald">
          <i icon class="pi pi-shield text-lg" aria-hidden="true"></i>
        </app-stat-card>
        <app-stat-card title="Đã thu hồi / Hết hạn" [value]="inactiveCount()" variant="slate">
          <i icon class="pi pi-history text-lg" aria-hidden="true"></i>
        </app-stat-card>
        <app-stat-card title="Sự kiện Nhật ký Kiểm toán" [value]="auditLogs().length" variant="indigo">
          <i icon class="pi pi-list-check text-lg" aria-hidden="true"></i>
        </app-stat-card>
      </div>

      <!-- Grants List -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-2xs">
        <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Danh sách Quyền truy cập Hỗ trợ</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">Chỉ Chủ sở hữu (Owner) mới có quyền cấp hoặc thu hồi</span>
        </div>

        @if (isLoading()) {
          <div class="p-10 text-center text-slate-500 dark:text-slate-400">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-600 mb-2" aria-hidden="true"></i>
            <p class="text-sm">Đang tải danh sách quyền hỗ trợ...</p>
          </div>
        } @else if (grants().length === 0) {
          <app-empty-state
            iconClass="pi pi-shield"
            title="Chưa cấp quyền hỗ trợ kỹ thuật nào"
            description="Dữ liệu khách sạn của bạn được bảo vệ Fail-Closed. Chỉ cấp Support Grant khi cần đội ngũ kỹ thuật nền tảng hỗ trợ chẩn đoán sự cố."
            actionLabel="Cấp quyền Hỗ trợ"
            actionIcon="pi pi-plus"
            (actionClick)="openCreateModal()"
          />
        } @else {
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            @for (g of grants(); track g.id) {
              <article class="p-4 space-y-2 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="font-bold text-slate-900 dark:text-slate-100">{{ g.targetSupportName }}</div>
                    <div class="text-slate-500 dark:text-slate-400">{{ g.targetSupportEmail }}</div>
                  </div>
                  <app-status-badge
                    [status]="g.status"
                    [customLabel]="g.status === 'ACTIVE' ? 'Đang hiệu lực' : g.status === 'REVOKED' ? 'Đã thu hồi' : 'Đã hết hạn'"
                    [color]="g.isCurrentlyActive ? 'emerald' : g.status === 'REVOKED' ? 'rose' : 'slate'"
                  />
                </div>
                <div class="font-mono font-bold text-indigo-700 dark:text-indigo-300">{{ g.scope }}</div>
                <div class="text-slate-600 dark:text-slate-300">{{ g.reason }}</div>
                <div class="flex items-center justify-between pt-1">
                  <span class="font-mono tabular-nums text-slate-500">{{ g.expiresAtUtc | businessDateTime }}</span>
                  @if (g.isCurrentlyActive) {
                    <button
                      type="button"
                      (click)="revokeGrant(g)"
                      [disabled]="revokingId() === g.id"
                      class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <i class="pi pi-ban text-xs" aria-hidden="true"></i>
                      <span>Thu hồi ngay</span>
                    </button>
                  }
                </div>
              </article>
            }
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="py-3.5 px-4">Nhân sự hỗ trợ</th>
                  <th scope="col" class="py-3.5 px-4">Phạm vi</th>
                  <th scope="col" class="py-3.5 px-4">Lý do cấp phép</th>
                  <th scope="col" class="py-3.5 px-4">Hết hạn (UTC+7)</th>
                  <th scope="col" class="py-3.5 px-4">Trạng thái</th>
                  <th scope="col" class="py-3.5 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (g of grants(); track g.id) {
                  <tr>
                    <td class="py-3.5 px-4">
                      <div class="font-semibold text-slate-900 dark:text-slate-100">{{ g.targetSupportName }}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">{{ g.targetSupportEmail }}</div>
                    </td>
                    <td class="py-3.5 px-4 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300">{{ g.scope }}</td>
                    <td class="py-3.5 px-4 text-xs max-w-xs">{{ g.reason }}</td>
                    <td class="py-3.5 px-4 text-xs whitespace-nowrap font-mono tabular-nums">{{ g.expiresAtUtc | businessDateTime }}</td>
                    <td class="py-3.5 px-4">
                      <app-status-badge
                        [status]="g.status"
                        [customLabel]="g.status === 'ACTIVE' ? 'Đang hiệu lực' : g.status === 'REVOKED' ? 'Đã thu hồi' : 'Đã hết hạn'"
                        [color]="g.isCurrentlyActive ? 'emerald' : g.status === 'REVOKED' ? 'rose' : 'slate'"
                      />
                    </td>
                    <td class="py-3.5 px-4 text-right">
                      @if (g.isCurrentlyActive) {
                        <button
                          type="button"
                          (click)="revokeGrant(g)"
                          [disabled]="revokingId() === g.id"
                          class="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          <i class="pi pi-ban text-xs" aria-hidden="true"></i>
                          <span>Thu hồi ngay</span>
                        </button>
                      } @else {
                        <span class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {{ g.revokedAtUtc ? 'Thu hồi lúc ' + (g.revokedAtUtc | businessDateTime) : 'Hết hiệu lực' }}
                        </span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Support Audit Log Trail -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-2xs">
        <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Nhật ký Kiểm toán Hỗ trợ (Support Audit Logs)</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bản ghi bất biến mọi hành động cấp phép, truy cập chẩn đoán và thu hồi.</p>
        </div>

        @if (auditLogs().length === 0) {
          <p class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Chưa có sự kiện nào được ghi nhận.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="py-3 px-4">Thời gian (UTC+7)</th>
                  <th scope="col" class="py-3 px-4">Hành động</th>
                  <th scope="col" class="py-3 px-4">Người thực hiện</th>
                  <th scope="col" class="py-3 px-4">Resource Path</th>
                  <th scope="col" class="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (log of auditLogs(); track log.id) {
                  <tr>
                    <td class="py-3 px-4 whitespace-nowrap font-mono tabular-nums">{{ log.createdAtUtc | businessDateTime }}</td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{{ log.action }}</td>
                    <td class="py-3 px-4">{{ log.actorEmail || log.actorUserId }}</td>
                    <td class="py-3 px-4 font-mono text-indigo-700 dark:text-indigo-300">{{ log.resourcePath }}</td>
                    <td class="py-3 px-4 font-mono tabular-nums">{{ log.ipAddress || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <!-- Create Grant Modal -->
    @if (showCreateModal()) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="showCreateModal.set(false)"
        (click)="showCreateModal.set(false)"
        class="fixed inset-0 z-[65] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 id="grant-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100">
              Cấp quyền Hỗ trợ Kỹ thuật Tạm thời
            </h2>
            <button
              type="button"
              aria-label="Đóng cửa sổ cấp quyền hỗ trợ"
              (click)="showCreateModal.set(false)"
              class="min-w-11 min-h-11 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="support-user-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhân sự Hỗ trợ Nền tảng *
              </label>
              <app-searchable-select
                controlId="support-user-select"
                label="Nhân sự hỗ trợ"
                [items]="supportUserItems()"
                [(ngModel)]="selectedSupportUserId"
                placeholder="Chọn kỹ thuật viên hỗ trợ..."
                searchPlaceholder="Tìm theo tên hoặc email..."
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="grant-scope" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phạm vi truy cập *</label>
                <select
                  id="grant-scope"
                  [(ngModel)]="selectedScope"
                  class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="READ_ONLY">READ_ONLY (Chỉ đọc tổng quan)</option>
                  <option value="DIAGNOSTIC">DIAGNOSTIC (Chẩn đoán kỹ thuật)</option>
                </select>
              </div>

              <div>
                <label for="grant-duration" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Thời hạn hiệu lực *</label>
                <select
                  id="grant-duration"
                  [(ngModel)]="durationMinutes"
                  class="w-full min-h-11 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option [ngValue]="30">30 phút</option>
                  <option [ngValue]="120">2 giờ</option>
                  <option [ngValue]="480">8 giờ</option>
                  <option [ngValue]="1440">24 giờ</option>
                  <option [ngValue]="4320">72 giờ (tối đa)</option>
                </select>
              </div>
            </div>

            <div>
              <label for="grant-reason" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lý do cấp phép *</label>
              <textarea
                id="grant-reason"
                rows="3"
                [(ngModel)]="grantReason"
                placeholder="VD: Kiểm tra cấu hình đồng bộ VNPay IPN và nhật ký hóa đơn chi nhánh 1"
                class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              ></textarea>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
            <button
              type="button"
              (click)="showCreateModal.set(false)"
              class="min-h-11 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              (click)="submitGrant()"
              [disabled]="isSaving()"
              class="min-h-11 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {{ isSaving() ? 'Đang cấp quyền...' : 'Xác nhận cấp quyền' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SupportGrantsPage implements OnInit {
  private readonly governanceService = inject(PlatformGovernanceService);
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly grants = signal<SupportAccessGrantDto[]>([]);
  readonly auditLogs = signal<SupportAuditLogDto[]>([]);
  readonly supportUsers = signal<SupportUserOptionDto[]>([]);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly revokingId = signal<string | null>(null);
  readonly showCreateModal = signal(false);

  selectedSupportUserId = '';
  selectedScope: 'READ_ONLY' | 'DIAGNOSTIC' = 'DIAGNOSTIC';
  durationMinutes = 120;
  grantReason = '';

  readonly activeCount = computed(() => this.grants().filter(g => g.isCurrentlyActive).length);
  readonly inactiveCount = computed(() => this.grants().filter(g => !g.isCurrentlyActive).length);
  readonly supportUserItems = computed<SearchableSelectItem[]>(() =>
    this.supportUsers().map(u => ({
      value: u.userId,
      label: u.fullName || u.email,
      subLabel: u.email,
      badge: 'Support'
    }))
  );

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showCreateModal() && !this.isSaving()) {
      this.showCreateModal.set(false);
    }
  }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.governanceService
      .getTenantSupportGrants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.grants.set(list || []);
          this.isLoading.set(false);
        },
        error: err => {
          this.isLoading.set(false);
          this.alertService.error(err?.error?.message || 'Không thể tải danh sách quyền hỗ trợ.');
        }
      });

    this.governanceService
      .getTenantSupportAuditLogs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: logs => this.auditLogs.set(logs || []),
        error: () => {}
      });

    this.governanceService
      .getAvailableSupportUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => this.supportUsers.set(users || []),
        error: () => {}
      });
  }

  openCreateModal(): void {
    if (!this.selectedSupportUserId && this.supportUsers().length > 0) {
      this.selectedSupportUserId = this.supportUsers()[0].userId;
    }
    this.selectedScope = 'DIAGNOSTIC';
    this.durationMinutes = 120;
    this.grantReason = '';
    this.showCreateModal.set(true);
  }

  submitGrant(): void {
    if (!this.selectedSupportUserId) {
      this.alertService.error('Vui lòng chọn nhân sự hỗ trợ nền tảng.');
      return;
    }
    if (this.grantReason.trim().length < 5) {
      this.alertService.error('Vui lòng nhập lý do tối thiểu 5 ký tự.');
      return;
    }

    const expiresAtUtc = new Date(Date.now() + this.durationMinutes * 60_000).toISOString();
    this.isSaving.set(true);
    this.governanceService
      .createSupportGrant({
        targetSupportUserId: this.selectedSupportUserId,
        scope: this.selectedScope,
        reason: this.grantReason.trim(),
        expiresAtUtc
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.showCreateModal.set(false);
          this.alertService.success('Đã cấp quyền hỗ trợ tạm thời và ghi nhật ký kiểm toán.');
          this.loadAll();
        },
        error: err => {
          this.isSaving.set(false);
          this.alertService.error(err?.error?.message || 'Không thể cấp quyền hỗ trợ.');
        }
      });
  }

  async revokeGrant(grant: SupportAccessGrantDto): Promise<void> {
    const confirmed = await this.alertService.confirmDelete({
      title: 'Thu hồi quyền hỗ trợ?',
      text: `Thu hồi quyền hỗ trợ của "${grant.targetSupportEmail || grant.targetSupportName}" ngay lập tức?`,
      confirmButtonText: 'Thu hồi ngay',
      cancelButtonText: 'Hủy'
    });
    if (!confirmed) {
      return;
    }
    this.revokingId.set(grant.id);
    this.governanceService
      .revokeSupportGrant(grant.id, 'Thu hồi chủ động từ cổng quản trị Owner')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.revokingId.set(null);
          this.alertService.success('Đã thu hồi quyền hỗ trợ kỹ thuật.');
          this.loadAll();
        },
        error: err => {
          this.revokingId.set(null);
          this.alertService.error(err?.error?.message || 'Không thể thu hồi quyền hỗ trợ.');
        }
      });
  }
}
