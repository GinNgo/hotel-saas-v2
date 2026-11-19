import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';
import {
  SaveSystemBannerRequest,
  SystemBannerDto,
  SystemBannerService
} from '../../core/services/system-banner.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-admin-banners-page',
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
        title="Quản lý System Banners & Thông báo Nền tảng"
        subtitle="Tạo thông báo bảo trì, khuyến mãi hoặc banner upsell theo từng gói dịch vụ (STARTER / PRO / ENTERPRISE)."
      >
        <button
          type="button"
          (click)="loadBanners()"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
        >
          <i class="pi pi-refresh" [class.animate-spin]="isLoading()"></i>
          <span>Làm mới</span>
        </button>
        <button
          type="button"
          (click)="openCreateModal()"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
        >
          <i class="pi pi-plus"></i>
          <span>Tạo Banner mới</span>
        </button>
      </app-page-header>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <app-stat-card title="Tổng số Banner" [value]="banners().length" variant="indigo">
          <i icon class="pi pi-megaphone text-lg"></i>
        </app-stat-card>
        <app-stat-card title="Đang kích hoạt" [value]="activeCount()" variant="emerald">
          <i icon class="pi pi-check-circle text-lg"></i>
        </app-stat-card>
        <app-stat-card title="Nhắm mục tiêu gói" [value]="targetedCount()" variant="amber">
          <i icon class="pi pi-bullseye text-lg"></i>
        </app-stat-card>
      </div>

      @if (isLoading()) {
        <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-600 mb-2"></i>
          <p class="text-sm">Đang tải danh sách System Banner...</p>
        </div>
      } @else if (banners().length === 0) {
        <div class="bg-white rounded-2xl border border-slate-200">
          <app-empty-state
            iconClass="pi pi-megaphone"
            title="Chưa có System Banner nào"
            description="Tạo banner đầu tiên để thông báo bảo trì hệ thống hoặc quảng bá nâng cấp gói dịch vụ."
            actionLabel="Tạo Banner mới"
            actionIcon="pi pi-plus"
            (actionClick)="openCreateModal()"
          />
        </div>
      } @else {
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="py-3.5 px-4">Banner & Tiêu đề</th>
                  <th class="py-3.5 px-4">Gói mục tiêu</th>
                  <th class="py-3.5 px-4">Hiệu lực (UTC+7)</th>
                  <th class="py-3.5 px-4">Trạng thái</th>
                  <th class="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (b of banners(); track b.id) {
                  <tr class="hover:bg-slate-50/70">
                    <td class="py-3.5 px-4">
                      <div class="flex items-center gap-3">
                        <img
                          [src]="b.imageUrl"
                          [alt]="b.title"
                          class="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div class="min-w-0">
                          <div class="font-bold text-slate-900 truncate max-w-xs">{{ b.title }}</div>
                          @if (b.targetUrl) {
                            <div class="text-xs text-indigo-600 truncate max-w-xs">{{ b.targetUrl }}</div>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4">
                      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {{ b.targetPlanCode || 'TẤT CẢ' }}
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-xs whitespace-nowrap">
                      <div>Từ: {{ b.validFromUtc ? (b.validFromUtc | businessDateTime) : 'Ngay lập tức' }}</div>
                      <div class="text-slate-400">Đến: {{ b.validToUtc ? (b.validToUtc | businessDateTime) : 'Không giới hạn' }}</div>
                    </td>
                    <td class="py-3.5 px-4">
                      <app-status-badge [status]="b.isActive" type="boolean" />
                    </td>
                    <td class="py-3.5 px-4 text-right">
                      <div class="inline-flex items-center gap-2">
                        <button
                          type="button"
                          (click)="toggleBannerActive(b)"
                          class="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          {{ b.isActive ? 'Tạm ẩn' : 'Bật lại' }}
                        </button>
                        <button
                          type="button"
                          (click)="openEditModal(b)"
                          aria-label="Chỉnh sửa banner"
                          class="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold cursor-pointer"
                        >
                          <i class="pi pi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          (click)="deleteBanner(b)"
                          aria-label="Xóa banner"
                          class="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer"
                        >
                          <i class="pi pi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    @if (showModal()) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-modal-title"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-8">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 id="banner-modal-title" class="text-base font-bold text-slate-900">
              {{ editingId() ? 'Cập nhật System Banner' : 'Tạo System Banner mới' }}
            </h2>
            <button
              type="button"
              aria-label="Đóng"
              (click)="showModal.set(false)"
              class="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="banner-title" class="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề thông báo *</label>
              <input
                id="banner-title"
                type="text"
                [(ngModel)]="formTitle"
                placeholder="VD: Nâng cấp gói Pro mở khóa thanh toán VNPay tự động"
                class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="banner-img" class="block text-xs font-semibold text-slate-700 mb-1">URL hình ảnh (HTTP/HTTPS hoặc /assets/...) *</label>
              <input
                id="banner-img"
                type="url"
                [(ngModel)]="formImageUrl"
                placeholder="https://cdn.example.com/banner.png"
                class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="banner-target-url" class="block text-xs font-semibold text-slate-700 mb-1">Đường dẫn đích (tùy chọn)</label>
                <input
                  id="banner-target-url"
                  type="text"
                  [(ngModel)]="formTargetUrl"
                  placeholder="/subscriptions"
                  class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="banner-plan" class="block text-xs font-semibold text-slate-700 mb-1">Nhắm gói mục tiêu</label>
                <select
                  id="banner-plan"
                  [(ngModel)]="formTargetPlanCode"
                  class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">Tất cả gói (Global)</option>
                  <option value="STARTER">STARTER (Upsell)</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="banner-from" class="block text-xs font-semibold text-slate-700 mb-1">Hiệu lực từ (giờ địa phương)</label>
                <input
                  id="banner-from"
                  type="datetime-local"
                  [(ngModel)]="formValidFromLocal"
                  class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="banner-to" class="block text-xs font-semibold text-slate-700 mb-1">Đến hết (giờ địa phương)</label>
                <input
                  id="banner-to"
                  type="datetime-local"
                  [(ngModel)]="formValidToLocal"
                  class="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <label class="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" [(ngModel)]="formIsActive" class="w-4 h-4 accent-indigo-600 rounded" />
              <span>Kích hoạt hiển thị ngay</span>
            </label>
          </div>

          <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              (click)="showModal.set(false)"
              class="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              (click)="saveBanner()"
              [disabled]="isSaving()"
              class="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {{ isSaving() ? 'Đang lưu...' : 'Lưu Banner' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AdminBannersPage implements OnInit {
  private readonly bannerService = inject(SystemBannerService);
  private readonly alertService = inject(AlertService);

  readonly banners = signal<SystemBannerDto[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);

  formTitle = '';
  formImageUrl = '';
  formTargetUrl = '';
  formTargetPlanCode = '';
  formValidFromLocal = '';
  formValidToLocal = '';
  formIsActive = true;

  readonly activeCount = computed(() => this.banners().filter(b => b.isActive).length);
  readonly targetedCount = computed(() => this.banners().filter(b => !!b.targetPlanCode).length);

  ngOnInit(): void {
    this.loadBanners();
  }

  loadBanners(): void {
    this.isLoading.set(true);
    this.bannerService.getAllBanners().subscribe({
      next: list => {
        this.banners.set(list || []);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        this.alertService.error(err?.error?.message || 'Không thể tải danh sách Banner.');
      }
    });
  }

  openCreateModal(): void {
    this.editingId.set(null);
    this.formTitle = '';
    this.formImageUrl = '';
    this.formTargetUrl = '/subscriptions';
    this.formTargetPlanCode = '';
    this.formValidFromLocal = '';
    this.formValidToLocal = '';
    this.formIsActive = true;
    this.showModal.set(true);
  }

  openEditModal(banner: SystemBannerDto): void {
    this.editingId.set(banner.id);
    this.formTitle = banner.title;
    this.formImageUrl = banner.imageUrl;
    this.formTargetUrl = banner.targetUrl ?? '';
    this.formTargetPlanCode = banner.targetPlanCode ?? '';
    this.formValidFromLocal = this.toDateTimeLocalInput(banner.validFromUtc);
    this.formValidToLocal = this.toDateTimeLocalInput(banner.validToUtc);
    this.formIsActive = banner.isActive;
    this.showModal.set(true);
  }

  saveBanner(): void {
    const title = this.formTitle.trim();
    const imageUrl = this.formImageUrl.trim();
    if (!title) {
      this.alertService.error('Vui lòng nhập tiêu đề banner.');
      return;
    }
    if (!imageUrl || !this.isSafeUrl(imageUrl)) {
      this.alertService.error('URL hình ảnh không hợp lệ (chỉ chấp nhận http/https hoặc đường dẫn /).');
      return;
    }
    if (this.formTargetUrl.trim() && !this.isSafeUrl(this.formTargetUrl.trim())) {
      this.alertService.error('URL đích không hợp lệ.');
      return;
    }

    const fromIso = this.formValidFromLocal ? new Date(this.formValidFromLocal).toISOString() : null;
    const toIso = this.formValidToLocal ? new Date(this.formValidToLocal).toISOString() : null;
    if (fromIso && toIso && new Date(toIso) < new Date(fromIso)) {
      this.alertService.error('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }

    const req: SaveSystemBannerRequest = {
      title,
      imageUrl,
      targetUrl: this.formTargetUrl.trim() || null,
      targetPlanCode: this.formTargetPlanCode.trim() || null,
      validFromUtc: fromIso,
      validToUtc: toIso,
      isActive: this.formIsActive
    };

    this.isSaving.set(true);
    const id = this.editingId();
    const request$ = id
      ? this.bannerService.updateBanner(id, req)
      : this.bannerService.createBanner(req);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showModal.set(false);
        this.alertService.success(id ? 'Đã cập nhật banner thành công.' : 'Đã tạo banner mới thành công.');
        this.loadBanners();
      },
      error: err => {
        this.isSaving.set(false);
        this.alertService.error(err?.error?.message || 'Không thể lưu banner.');
      }
    });
  }

  toggleBannerActive(banner: SystemBannerDto): void {
    const req: SaveSystemBannerRequest = {
      title: banner.title,
      imageUrl: banner.imageUrl,
      targetUrl: banner.targetUrl,
      targetPlanCode: banner.targetPlanCode,
      validFromUtc: banner.validFromUtc,
      validToUtc: banner.validToUtc,
      isActive: !banner.isActive
    };

    this.bannerService.updateBanner(banner.id, req).subscribe({
      next: updated => {
        this.banners.update(list => list.map(b => (b.id === updated.id ? updated : b)));
        this.alertService.success(updated.isActive ? 'Đã kích hoạt banner.' : 'Đã tạm ẩn banner.');
      },
      error: err => this.alertService.error(err?.error?.message || 'Không thể đổi trạng thái banner.')
    });
  }

  deleteBanner(banner: SystemBannerDto): void {
    if (!confirm(`Xóa vĩnh viễn banner "${banner.title}"?`)) {
      return;
    }
    this.bannerService.deleteBanner(banner.id).subscribe({
      next: () => {
        this.banners.update(list => list.filter(b => b.id !== banner.id));
        this.alertService.success('Đã xóa banner.');
      },
      error: err => this.alertService.error(err?.error?.message || 'Không thể xóa banner.')
    });
  }

  private isSafeUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.startsWith('https://') ||
      lower.startsWith('http://') ||
      (lower.startsWith('/') && !lower.startsWith('//'))
    );
  }

  private toDateTimeLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
