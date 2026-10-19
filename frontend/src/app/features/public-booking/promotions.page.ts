import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { PromotionDealDto, RentalType } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        <!-- 1. BREADCRUMB -->
        <nav class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span>/</span>
          <span class="text-slate-800 font-semibold">Ưu đãi &amp; Giờ vàng Đặt phòng</span>
        </nav>

        <!-- 2. HERO BANNER -->
        <div class="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white p-8 sm:p-12 shadow-lg">
          <div class="relative z-10 max-w-2xl space-y-3">
            <span class="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 uppercase tracking-wider inline-flex items-center gap-1.5">
              <i class="pi pi-bolt text-xs"></i>
              <span>Flash Deal &amp; Giờ vàng</span>
            </span>
            <h1 class="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Săn Mã Giảm Giá &amp; Khuyến Mãi Đặt Phòng Toàn Quốc
            </h1>
            <p class="text-xs sm:text-sm text-indigo-200 leading-relaxed">
              Tiết kiệm đến 20% khi đặt phòng nghỉ trưa theo giờ, phòng qua đêm cuối tuần hoặc nghỉ dưỡng tại các điểm du lịch hot nhất.
            </p>
          </div>
        </div>

        <!-- 3. TABS BỘ LỌC DANH MỤC ƯU ĐÃI -->
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            (click)="selectedCategory.set('all')"
            class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
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
            (click)="selectedCategory.set('Hourly')"
            class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'Hourly'"
            [class.text-white]="selectedCategory() === 'Hourly'"
            [class.border-indigo-600]="selectedCategory() === 'Hourly'"
            [class.bg-white]="selectedCategory() !== 'Hourly'"
            [class.text-slate-700]="selectedCategory() !== 'Hourly'"
            [class.border-slate-200]="selectedCategory() !== 'Hourly'"
          >
            ⏰ Thuê theo giờ (Happy Hour)
          </button>
          <button
            type="button"
            (click)="selectedCategory.set('Overnight')"
            class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'Overnight'"
            [class.text-white]="selectedCategory() === 'Overnight'"
            [class.border-indigo-600]="selectedCategory() === 'Overnight'"
            [class.bg-white]="selectedCategory() !== 'Overnight'"
            [class.text-slate-700]="selectedCategory() !== 'Overnight'"
            [class.border-slate-200]="selectedCategory() !== 'Overnight'"
          >
            🌙 Đặt phòng qua đêm
          </button>
          <button
            type="button"
            (click)="selectedCategory.set('destinations')"
            class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border"
            [class.bg-indigo-600]="selectedCategory() === 'destinations'"
            [class.text-white]="selectedCategory() === 'destinations'"
            [class.border-indigo-600]="selectedCategory() === 'destinations'"
            [class.bg-white]="selectedCategory() !== 'destinations'"
            [class.text-slate-700]="selectedCategory() !== 'destinations'"
            [class.border-slate-200]="selectedCategory() !== 'destinations'"
          >
            📍 Điểm đến du lịch (Đà Lạt, Vũng Tàu...)
          </button>
        </div>

        <!-- 4. LƯỚI THẺ KHUYẾN MÃI -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (deal of filteredDeals(); track deal.id) {
            <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <!-- Top Image banner -->
              <div class="h-44 overflow-hidden relative">
                <img
                  [src]="deal.bannerImageUrl"
                  [alt]="deal.title"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-5">
                  <div class="flex items-center gap-2">
                    <span class="px-3 py-1 rounded-xl text-xs font-black bg-amber-400 text-slate-950 shadow-md">
                      {{ deal.discountBadge }}
                    </span>
                    @if (deal.rentalType) {
                      <span class="px-2.5 py-1 rounded-xl text-xs font-bold bg-white/90 text-slate-900 backdrop-blur-xs">
                        {{ deal.rentalType === 'Hourly' ? 'Thuê theo giờ' : 'Qua đêm' }}
                      </span>
                    }
                  </div>
                </div>
              </div>

              <!-- Content details -->
              <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                  <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {{ deal.title }}
                  </h3>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    {{ deal.description }}
                  </p>

                  @if (deal.applicableDestinations && deal.applicableDestinations.length > 0) {
                    <div class="flex flex-wrap gap-1.5 pt-1">
                      @for (dest of deal.applicableDestinations; track dest) {
                        <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                          📍 {{ dest }}
                        </span>
                      }
                    </div>
                  }
                </div>

                <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <!-- Code voucher tag -->
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-slate-400 font-medium">Mã:</span>
                    <span class="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono font-black text-xs text-indigo-700 tracking-wider">
                      {{ deal.code }}
                    </span>
                  </div>

                  <!-- Copy & Book CTA -->
                  <button
                    type="button"
                    (click)="applyAndBook(deal)"
                    class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Sao chép &amp; Đặt ngay</span>
                    <i class="pi pi-arrow-right text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>

      </div>
    </div>
  `
})
export class PromotionsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  readonly deals = signal<PromotionDealDto[]>([]);
  readonly selectedCategory = signal<string>('all');

  readonly filteredDeals = computed<PromotionDealDto[]>(() => {
    const cat = this.selectedCategory();
    if (cat === 'all') return this.deals();
    if (cat === 'Hourly') return this.deals().filter(d => d.rentalType === 'Hourly');
    if (cat === 'Overnight') return this.deals().filter(d => d.rentalType === 'Overnight');
    if (cat === 'destinations') return this.deals().filter(d => d.applicableDestinations && d.applicableDestinations.length > 0);
    return this.deals();
  });

  ngOnInit(): void {
    this.publicBookingService.getPromotions().subscribe(list => this.deals.set(list));
  }

  applyAndBook(deal: PromotionDealDto): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(deal.code);
    }
    this.alertService.success(`Đã sao chép mã ưu đãi ${deal.code}! Chuyển đến trang tìm phòng...`);

    const queryParams: Record<string, string> = {};
    if (deal.rentalType) {
      queryParams['rentalType'] = deal.rentalType;
    }
    if (deal.applicableDestinations && deal.applicableDestinations.length > 0) {
      queryParams['destinationKeyword'] = deal.applicableDestinations[0];
    }

    this.router.navigate(['/booking'], { queryParams });
  }
}
