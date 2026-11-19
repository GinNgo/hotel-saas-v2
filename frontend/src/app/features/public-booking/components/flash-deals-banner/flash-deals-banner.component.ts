import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../../../core/services/public-booking.service';
import { PromotionDealDto } from '../../../../core/models/public-booking.model';

@Component({
  selector: 'app-flash-deals-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-12 scroll-mt-24" id="flashDealsSection" aria-label="Ưu đãi & Mã khuyến mãi trực tuyến">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-b border-slate-200/80 pb-4">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-800 border border-amber-500/20">
              <i class="pi pi-ticket text-[10px] text-amber-700" aria-hidden="true"></i>
              Khuyến mãi đang mở
            </span>
            <span class="text-xs text-slate-500 font-medium">Áp dụng trực tiếp khi giữ phòng</span>
          </div>
          <h2 class="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Mã Giảm Giá &amp; Ưu Đãi Đang Hoạt Động
          </h2>
          <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Dữ liệu ưu đãi được đồng bộ trực tiếp từ hệ thống của các đối tác khách sạn đang hoạt động.
          </p>
        </div>

        <a
          routerLink="/booking/deals"
          class="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors shrink-0"
        >
          <span>Xem tất cả ưu đãi</span>
          <i class="pi pi-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          @for (item of [1, 2, 3]; track item) {
            <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 animate-pulse">
              <div class="h-5 w-24 rounded-full bg-slate-200"></div>
              <div class="h-5 w-3/4 rounded bg-slate-200"></div>
              <div class="h-4 w-full rounded bg-slate-100"></div>
              <div class="h-10 w-full rounded-xl bg-slate-100"></div>
            </div>
          }
        </div>
      } @else if (deals().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-slate-900">Hiện chưa có mã khuyến mãi công khai nào đang kích hoạt</h3>
            <p class="text-xs text-slate-600">
              Bạn vẫn có thể tìm kiếm phòng trống theo giờ hoặc qua đêm với mức giá niêm yết tốt nhất từ các cơ sở lưu trú.
            </p>
          </div>
          <a
            routerLink="/booking/explore"
            class="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shrink-0"
          >
            <span>Khám phá phòng trống</span>
            <i class="pi pi-arrow-right text-[10px]" aria-hidden="true"></i>
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          @for (deal of deals(); track deal.id) {
            <div class="group relative rounded-2xl p-0.5 bg-gradient-to-b from-amber-400/25 via-slate-200 to-slate-200/50 hover:from-amber-400 hover:via-amber-300 hover:to-amber-500/40 transition-all duration-300 shadow-xs hover:shadow-xl flex flex-col justify-between">
              <div class="rounded-[14px] bg-white p-5 h-full flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-3">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase border flex items-center gap-1.5"
                      [ngClass]="getBadgeClass(deal)"
                    >
                      <i [class]="getCategoryIcon(deal)" class="text-[10px]" aria-hidden="true"></i>
                      {{ deal.discountBadge }}
                    </span>

                    <span class="text-[11px] font-semibold text-slate-600">
                      Hết hạn: {{ formatExpiryDate(deal.endsAtUtc || deal.expiresAt) }}
                    </span>
                  </div>

                  <h3 class="text-base font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors leading-snug">
                    {{ deal.title || deal.name || deal.code }}
                  </h3>

                  @if (deal.tenantName) {
                    <p class="mt-1 text-xs font-semibold text-indigo-700">
                      {{ deal.tenantName }}
                    </p>
                  }

                  <p class="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {{ deal.description || 'Áp dụng trực tiếp khi nhập mã ở bước xác nhận giữ phòng.' }}
                  </p>

                  @if (getUsageLabel(deal); as usageLabel) {
                    <p class="mt-2 text-[11px] font-medium text-emerald-700">
                      {{ usageLabel }}
                    </p>
                  }
                </div>

                <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
                  <div class="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl font-mono text-xs font-black text-slate-800 tracking-wider">
                    <i class="pi pi-ticket text-[11px] text-amber-600" aria-hidden="true"></i>
                    <span>{{ deal.code }}</span>
                  </div>

                  <button
                    type="button"
                    (click)="applyDeal(deal)"
                    class="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 text-white"
                    [class.bg-emerald-600]="copiedCode() === deal.code"
                    [class.bg-slate-900]="copiedCode() !== deal.code"
                    [class.hover:bg-amber-600]="copiedCode() !== deal.code"
                  >
                    <i [class]="copiedCode() === deal.code ? 'pi pi-check' : 'pi pi-arrow-right'" class="text-[10px]" aria-hidden="true"></i>
                    <span>{{ copiedCode() === deal.code ? 'Đang chuyển...' : 'Dùng mã này' }}</span>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `
})
export class FlashDealsBannerComponent implements OnInit {
  private readonly publicBookingService = inject(PublicBookingService, { optional: true });
  private readonly router = inject(Router, { optional: true });

  @Output() applyCode = new EventEmitter<string>();

  readonly deals = signal<PromotionDealDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly copiedCode = signal<string | null>(null);

  ngOnInit(): void {
    const getPromos$ = this.publicBookingService?.getPromotions?.();
    if (!getPromos$) {
      return;
    }

    this.loading.set(true);
    getPromos$.subscribe({
      next: items => {
        this.deals.set(items.slice(0, 3));
        this.loading.set(false);
      },
      error: () => {
        this.deals.set([]);
        this.loading.set(false);
      }
    });
  }

  getBadgeClass(deal: PromotionDealDto): string {
    if (deal.discountType === 'Amount' || deal.type === 1) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
    }
    if (deal.discountType === 'FreeNight' || deal.type === 2) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    }
    return 'bg-amber-50 text-amber-800 border-amber-200/80';
  }

  getCategoryIcon(deal: PromotionDealDto): string {
    if (deal.discountType === 'Amount' || deal.type === 1) {
      return 'pi pi-wallet';
    }
    if (deal.discountType === 'FreeNight' || deal.type === 2) {
      return 'pi pi-moon';
    }
    return 'pi pi-percentage';
  }

  formatExpiryDate(raw?: string | null): string {
    if (!raw) return 'Đang cập nhật';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getUsageLabel(deal: PromotionDealDto): string | null {
    const parts: string[] = [];
    if ((deal.minNights ?? 1) > 1) {
      parts.push(`Tối thiểu ${deal.minNights} đêm`);
    }
    if (deal.maxUsage !== null && deal.maxUsage !== undefined) {
      const remaining = Math.max(0, deal.maxUsage - (deal.currentUsage ?? 0));
      parts.push(`Còn ${remaining}/${deal.maxUsage} lượt`);
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  }

  applyDeal(deal: PromotionDealDto): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(deal.code).catch(() => {});
    }
    this.copiedCode.set(deal.code);
    this.applyCode.emit(deal.code);

    this.router?.navigate(['/booking/explore'], {
      queryParams: { promoCode: deal.code }
    });
  }
}
