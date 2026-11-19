import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SystemBannerDto, SystemBannerService } from '../../../core/services/system-banner.service';

@Component({
  selector: 'app-system-banner-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bannerService.visibleBanners().length > 0) {
      <section aria-label="Thông báo hệ thống" class="space-y-2 mb-4">
        @for (banner of bannerService.visibleBanners(); track banner.id) {
          <div
            role="region"
            [attr.aria-label]="banner.title"
            class="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-900 text-white px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              @if (banner.imageUrl && isRenderableImage(banner.imageUrl)) {
                <img
                  [src]="banner.imageUrl"
                  [alt]="banner.title"
                  width="44"
                  height="44"
                  loading="lazy"
                  class="w-11 h-11 rounded-lg object-cover border border-white/20 shrink-0 bg-white/10"
                />
              } @else {
                <div class="w-11 h-11 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <i class="pi pi-megaphone text-amber-300 text-base"></i>
                </div>
              }

              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950">
                    Thông báo nền tảng
                  </span>
                  @if (banner.targetPlanCode) {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-indigo-100 border border-white/20">
                      Gói {{ banner.targetPlanCode }}
                    </span>
                  }
                </div>
                <p class="text-sm font-bold text-white mt-0.5 truncate">{{ banner.title }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              @if (banner.targetUrl) {
                @if (isInternalRoute(banner.targetUrl)) {
                  <a
                    [routerLink]="banner.targetUrl"
                    class="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    <span>Xem chi tiết</span>
                    <i class="pi pi-arrow-right text-[11px]"></i>
                  </a>
                } @else if (isSafeExternalUrl(banner.targetUrl)) {
                  <a
                    [href]="banner.targetUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    <span>Mở liên kết</span>
                    <i class="pi pi-external-link text-[11px]"></i>
                  </a>
                }
              }

              <button
                type="button"
                (click)="dismiss(banner)"
                [attr.aria-label]="'Đóng thông báo ' + banner.title"
                class="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
          </div>
        }
      </section>
    }
  `
})
export class SystemBannerBarComponent implements OnInit {
  readonly bannerService = inject(SystemBannerService);

  ngOnInit(): void {
    this.bannerService.refreshActiveBanners();
  }

  dismiss(banner: SystemBannerDto): void {
    this.bannerService.dismissForSession(banner.id);
  }

  isInternalRoute(url: string): boolean {
    const trimmed = url.trim();
    return trimmed.startsWith('/') && !trimmed.startsWith('//');
  }

  isSafeExternalUrl(url: string): boolean {
    const trimmed = url.trim().toLowerCase();
    return trimmed.startsWith('https://') || trimmed.startsWith('http://');
  }

  isRenderableImage(url: string): boolean {
    const trimmed = url.trim().toLowerCase();
    return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/');
  }
}
