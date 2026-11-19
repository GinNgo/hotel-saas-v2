import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { PromotionDealDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <!-- 1. BREADCRUMB -->
        <nav aria-label="Điều hướng phân cấp" class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span aria-hidden="true">/</span>
          <span class="text-slate-800 font-semibold">Ưu đãi &amp; Mã khuyến mãi</span>
        </nav>

        <!-- 2. HERO BANNER -->
        <div class="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white p-8 sm:p-12 shadow-lg">
          <div class="relative z-10 max-w-2xl space-y-3">
            <span class="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 uppercase tracking-wider inline-flex items-center gap-1.5">
              <i class="pi pi-ticket text-xs" aria-hidden="true"></i>
              <span>Ưu đãi trực tuyến</span>
            </span>
            <h1 class="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Khuyến Mãi Đang Áp Dụng Từ Các Đối Tác Khách Sạn
            </h1>
            <p class="text-xs sm:text-sm text-indigo-200 leading-relaxed">
              Sao chép mã ưu đãi hợp lệ và áp dụng trực tiếp khi giữ phòng trực tuyến để được tính giảm giá theo chính sách niêm yết.
            </p>
          </div>
        </div>

        <!-- 3. TABS BỘ LỌC DANH MỤC ƯU ĐÃI -->
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            (click)="selectedCategory.set('all')"
            class="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'all'"
            [class.text-white]="selectedCategory() === 'all'"
            [class.border-indigo-600]="selectedCategory() === 'all'"
            [class.bg-white]="selectedCategory() !== 'all'"
            [class.text-slate-700]="selectedCategory() !== 'all'"
            [class.border-slate-200]="selectedCategory() !== 'all'"
          >
            Tất cả ưu đãi ({{ deals().length }})
          </button>

          <button
            type="button"
            (click)="selectedCategory.set('Percent')"
            class="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'Percent'"
            [class.text-white]="selectedCategory() === 'Percent'"
            [class.border-indigo-600]="selectedCategory() === 'Percent'"
            [class.bg-white]="selectedCategory() !== 'Percent'"
            [class.text-slate-700]="selectedCategory() !== 'Percent'"
            [class.border-slate-200]="selectedCategory() !== 'Percent'"
          >
            Giảm theo phần trăm (%)
          </button>

          <button
            type="button"
            (click)="selectedCategory.set('FixedOrFree')"
            class="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'FixedOrFree'"
            [class.text-white]="selectedCategory() === 'FixedOrFree'"
            [class.border-indigo-600]="selectedCategory() === 'FixedOrFree'"
            [class.bg-white]="selectedCategory() !== 'FixedOrFree'"
            [class.text-slate-700]="selectedCategory() !== 'FixedOrFree'"
            [class.border-slate-200]="selectedCategory() !== 'FixedOrFree'"
          >
            Giảm trực tiếp &amp; Tặng đêm
          </button>

          <button
            type="button"
            (click)="selectedCategory.set('destinations')"
            class="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'destinations'"
            [class.text-white]="selectedCategory() === 'destinations'"
            [class.border-indigo-600]="selectedCategory() === 'destinations'"
            [class.bg-white]="selectedCategory() !== 'destinations'"
            [class.text-slate-700]="selectedCategory() !== 'destinations'"
            [class.border-slate-200]="selectedCategory() !== 'destinations'"
          >
            Theo điểm đến
          </button>
        </div>

        <!-- 4. LOADING / ERROR / EMPTY / DEALS GRID -->
        @if (loading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 animate-pulse">
                <div class="h-6 w-28 rounded-lg bg-slate-200"></div>
                <div class="h-5 w-3/4 rounded-lg bg-slate-200"></div>
                <div class="h-4 w-full rounded-lg bg-slate-100"></div>
                <div class="h-10 w-full rounded-xl bg-slate-100"></div>
              </div>
            }
          </div>
        } @else if (errorMessage()) {
          <div class="rounded-3xl border border-rose-200 bg-rose-50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-sm font-bold text-rose-900">Không thể tải danh sách khuyến mãi</h2>
              <p class="text-xs text-rose-700">{{ errorMessage() }}</p>
            </div>
            <button
              type="button"
              (click)="loadDeals()"
              class="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        } @else if (filteredDeals().length === 0) {
          <div class="rounded-3xl border border-slate-200 bg-white p-10 text-center space-y-3 shadow-xs">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <i class="pi pi-ticket text-xl" aria-hidden="true"></i>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-slate-900">
              Hiện chưa có mã khuyến mãi phù hợp
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Các chương trình ưu đãi mới sẽ hiển thị tại đây ngay khi đối tác khách sạn kích hoạt chiến dịch.
            </p>
            <div class="pt-2">
              <a
                routerLink="/booking/explore"
                class="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors"
              >
                <span>Khám phá phòng trống ngay</span>
                <i class="pi pi-arrow-right text-[10px]" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            @for (deal of filteredDeals(); track deal.id) {
              <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <!-- Top Banner -->
                <div class="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 p-6 text-white">
                  @if (deal.bannerImageUrl) {
                    <img
                      [src]="deal.bannerImageUrl"
                      [alt]="deal.title || deal.name || deal.code"
                      class="absolute inset-0 w-full h-full object-cover opacity-35"
                    />
                  }
                  <div class="relative z-10 flex items-center justify-between gap-2 flex-wrap">
                    <span class="px-3 py-1 rounded-xl text-xs font-black bg-amber-400 text-slate-950 shadow-sm">
                      {{ deal.discountBadge }}
                    </span>
                    <div class="flex items-center gap-2 flex-wrap">
                      @if (deal.tenantName) {
                        <span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/15 text-white backdrop-blur-xs border border-white/20">
                          {{ deal.tenantName }}
                        </span>
                      }
                      @if ((deal.minNights ?? 1) > 1) {
                        <span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                          Từ {{ deal.minNights }} đêm
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Content details -->
                <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div class="space-y-2">
                    <h2 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {{ deal.title || deal.name || deal.code }}
                    </h2>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      {{ deal.description || 'Áp dụng trực tiếp khi tính báo giá và giữ phòng trực tuyến.' }}
                    </p>

                    <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span class="inline-flex items-center gap-1">
                        <i class="pi pi-calendar text-[11px] text-slate-400" aria-hidden="true"></i>
                        Hạn dùng: <strong class="text-slate-700">{{ formatExpiryDate(deal.endsAtUtc || deal.expiresAt) }}</strong>
                      </span>
                      @if (getRemainingUsageText(deal); as usageText) {
                        <span class="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <i class="pi pi-check-circle text-[11px]" aria-hidden="true"></i>
                          {{ usageText }}
                        </span>
                      }
                    </div>

                    @if (deal.applicableDestinations && deal.applicableDestinations.length > 0) {
                      <div class="flex flex-wrap gap-1.5 pt-1">
                        @for (dest of deal.applicableDestinations; track dest) {
                          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                            {{ dest }}
                          </span>
                        }
                      </div>
                    }
                  </div>

                  <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-slate-500 font-medium">Mã:</span>
                      <span class="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono font-black text-xs text-indigo-700 tracking-wider">
                        {{ deal.code }}
                      </span>
                    </div>

                    <button
                      type="button"
                      (click)="applyAndBook(deal)"
                      class="min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Sao chép &amp; Chọn phòng</span>
                      <i class="pi pi-arrow-right text-[10px]" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class PromotionsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  readonly deals = signal<PromotionDealDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedCategory = signal<string>('all');

  readonly filteredDeals = computed<PromotionDealDto[]>(() => {
    const cat = this.selectedCategory();
    if (cat === 'all') return this.deals();
    if (cat === 'Percent') {
      return this.deals().filter(d => d.discountType === 'Percent' || d.type === 0);
    }
    if (cat === 'FixedOrFree') {
      return this.deals().filter(
        d =>
          d.discountType === 'Amount' ||
          d.discountType === 'FreeNight' ||
          d.type === 1 ||
          d.type === 2
      );
    }
    if (cat === 'destinations') {
      return this.deals().filter(d => d.applicableDestinations && d.applicableDestinations.length > 0);
    }
    return this.deals();
  });

  ngOnInit(): void {
    this.loadDeals();
  }

  loadDeals(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.publicBookingService.getPromotions().subscribe({
      next: list => {
        this.deals.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Hệ thống tạm thời chưa thể kết nối dữ liệu khuyến mãi. Vui lòng thử lại sau.');
        this.loading.set(false);
      }
    });
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

  getRemainingUsageText(deal: PromotionDealDto): string | null {
    if (deal.maxUsage === null || deal.maxUsage === undefined) {
      return null;
    }
    const remaining = Math.max(0, deal.maxUsage - (deal.currentUsage ?? 0));
    return `Còn ${remaining}/${deal.maxUsage} lượt`;
  }

  applyAndBook(deal: PromotionDealDto): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(deal.code).catch(() => {});
    }
    this.alertService.toastSuccess(`Đã sao chép mã ưu đãi ${deal.code}! Chuyển đến trang tìm phòng...`);

    const queryParams: Record<string, string> = {
      promoCode: deal.code
    };
    if (deal.rentalType) {
      queryParams['rentalType'] = deal.rentalType;
    }
    if (deal.applicableDestinations && deal.applicableDestinations.length > 0) {
      queryParams['search'] = deal.applicableDestinations[0];
    }

    this.router.navigate(['/booking/explore'], { queryParams });
  }
}
