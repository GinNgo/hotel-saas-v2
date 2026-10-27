import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DealPromo {
  code: string;
  badge: string;
  category: 'member' | 'weekend' | 'hourly';
  title: string;
  discount: string;
  condition: string;
  availability: string;
  highlightText: string;
}

@Component({
  selector: 'app-flash-deals-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-12 scroll-mt-24" id="flashDealsSection" aria-label="Đặc quyền Nghỉ dưỡng & Voucher Độc quyền">
      <!-- Header với Phong cách Quiet Luxury & Live Countdown -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-b border-slate-200/80 pb-4">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <i class="pi pi-crown text-[10px] text-amber-600"></i>
              Đặc Quyền Mùa Nghỉ Dưỡng
            </span>
            <span class="text-xs text-slate-400 font-medium">Áp dụng trực tiếp tại bước thanh toán</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Voucher Độc Quyền &amp; Ưu Đãi Thành Viên
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Giảm giá trực tiếp vào hóa đơn phòng. Hỗ trợ giữ phòng trong 30 giây và mở khóa Smart Lock không chạm.
          </p>
        </div>

        <!-- Live Luxury Countdown Capsule -->
        <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950 text-white border border-slate-800 shadow-sm shrink-0">
          <div class="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>Ưu đãi hôm nay còn:</span>
          </div>
          <div class="flex items-center gap-1 font-mono font-black text-xs text-amber-300 tracking-wider">
            <span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10">{{ hours() }}h</span>
            <span class="text-amber-400/80">:</span>
            <span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10">{{ minutes() }}m</span>
            <span class="text-amber-400/80">:</span>
            <span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10">{{ seconds() }}s</span>
          </div>
        </div>
      </div>

      <!-- 3 Thẻ Đặc Quyền Thiết Kế Double-Bezel Cao Cấp (Bãi bỏ hoàn toàn vết cắt vé rách kiểu cũ) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        @for (deal of deals; track deal.code) {
          <div
            class="group relative rounded-2xl p-0.5 bg-gradient-to-b from-amber-400/25 via-slate-200 to-slate-200/50 hover:from-amber-400 hover:via-amber-300 hover:to-amber-500/40 transition-all duration-300 shadow-xs hover:shadow-xl flex flex-col justify-between"
          >
            <!-- Card Inner Surface -->
            <div class="rounded-[14px] bg-white p-5 h-full flex flex-col justify-between relative overflow-hidden">
              <!-- Subtle Luxury Ambient Glow on Hover -->
              <div class="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-amber-400/10 blur-2xl group-hover:bg-amber-400/20 transition-all pointer-events-none"></div>

              <div>
                <!-- Top Badge & Slot Counter -->
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border flex items-center gap-1.5"
                    [ngClass]="getBadgeClass(deal.category)"
                  >
                    <i [class]="getCategoryIcon(deal.category)" class="text-[9px]"></i>
                    {{ deal.badge }}
                  </span>
                  <span class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {{ deal.availability }}
                  </span>
                </div>

                <!-- Deal Main Heading -->
                <h3 class="text-base font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors leading-snug">
                  {{ deal.title }}
                </h3>

                <!-- Big Value Callout in Editorial Typography -->
                <div class="my-2.5 flex items-baseline gap-2">
                  <span class="text-2xl font-black tracking-tight text-slate-900">
                    {{ deal.discount }}
                  </span>
                  <span class="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
                    {{ deal.highlightText }}
                  </span>
                </div>

                <!-- Condition & Scope Note -->
                <p class="text-xs text-slate-500 leading-relaxed">
                  {{ deal.condition }}
                </p>
              </div>

              <!-- Interactive Voucher Code Box & Double-Bezel Copy Button -->
              <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
                <!-- Promo Code Chip -->
                <div class="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl font-mono text-xs font-black text-slate-800 tracking-wider">
                  <i class="pi pi-ticket text-[11px] text-amber-600"></i>
                  <span>{{ deal.code }}</span>
                </div>

                <!-- 1-Click Copy Button with Toast Feedback -->
                <button
                  type="button"
                  (click)="copyCode(deal.code)"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                  [class.bg-emerald-600]="copiedCode() === deal.code"
                  [class.text-white]="copiedCode() === deal.code"
                  [class.bg-slate-900]="copiedCode() !== deal.code"
                  [class.text-white]="copiedCode() !== deal.code"
                  [class.hover:bg-amber-600]="copiedCode() !== deal.code"
                  [title]="copiedCode() === deal.code ? 'Đã sao chép mã' : 'Sao chép mã giảm giá'"
                >
                  <i [class]="copiedCode() === deal.code ? 'pi pi-check' : 'pi pi-copy'" class="text-[10px]"></i>
                  <span>{{ copiedCode() === deal.code ? 'Đã lưu mã!' : 'Lấy mã' }}</span>
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class FlashDealsBannerComponent implements OnInit, OnDestroy {
  @Output() applyCode = new EventEmitter<string>();

  readonly hours = signal('08');
  readonly minutes = signal('45');
  readonly seconds = signal('20');
  readonly copiedCode = signal<string | null>(null);

  private timerInterval: any;
  private remainingSeconds = 0;

  readonly deals: DealPromo[] = [
    {
      code: 'WELCOME15',
      badge: 'Thành Viên Mới',
      category: 'member',
      title: 'Giảm 15% cho kỳ nghỉ đầu tiên',
      discount: 'Tối đa 300.000 ₫',
      highlightText: 'Tiết kiệm ngay',
      condition: 'Áp dụng cho mọi khách sạn, resort & homestay. Không giới hạn số đêm.',
      availability: 'Còn 34 lượt hôm nay'
    },
    {
      code: 'WEEKEND200',
      badge: 'Nghỉ Dưỡng Cuối Tuần',
      category: 'weekend',
      title: 'Giảm 200.000 ₫ các ngày Thứ 6 – CN',
      discount: 'Giảm 200.000 ₫',
      highlightText: 'Đơn từ 1.000.000 ₫',
      condition: 'Áp dụng khi đặt phòng từ 2 đêm tại các khu nghỉ dưỡng và khách sạn 4–5 sao.',
      availability: 'Ưu đãi cuối tuần'
    },
    {
      code: 'HOURLY99K',
      badge: 'Thuê Theo Giờ',
      category: 'hourly',
      title: 'Đồng giá trải nghiệm thuê giờ linh hoạt',
      discount: 'Chỉ 99.000 ₫',
      highlightText: 'Cho 2 giờ đầu',
      condition: 'Áp dụng cho khách sạn nội đô, nhà nghỉ & motel tiện nghi. Nhận phòng 24/7.',
      availability: 'Khung giờ vàng'
    }
  ];

  ngOnInit(): void {
    this.remainingSeconds = this.calculateRemainingSeconds();
    this.updateTimeSignals();

    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
      } else {
        // Reset to next rolling 24h cycle so timer NEVER sits at 00:00:00
        this.remainingSeconds = 24 * 3600 - 1;
      }
      this.updateTimeSignals();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private calculateRemainingSeconds(): number {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const diff = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    return diff > 0 ? diff : 8 * 3600 + 45 * 60 + 20;
  }

  private updateTimeSignals(): void {
    const h = Math.floor(this.remainingSeconds / 3600);
    const m = Math.floor((this.remainingSeconds % 3600) / 60);
    const s = this.remainingSeconds % 60;
    this.hours.set(String(h).padStart(2, '0'));
    this.minutes.set(String(m).padStart(2, '0'));
    this.seconds.set(String(s).padStart(2, '0'));
  }

  getBadgeClass(category: 'member' | 'weekend' | 'hourly'): string {
    switch (category) {
      case 'member':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'weekend':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
      case 'hourly':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    }
  }

  getCategoryIcon(category: 'member' | 'weekend' | 'hourly'): string {
    switch (category) {
      case 'member': return 'pi pi-crown';
      case 'weekend': return 'pi pi-sun';
      case 'hourly': return 'pi pi-bolt';
    }
  }

  copyCode(code: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    this.copiedCode.set(code);
    this.applyCode.emit(code);
    setTimeout(() => {
      if (this.copiedCode() === code) {
        this.copiedCode.set(null);
      }
    }, 3000);
  }
}
