import { Component, OnDestroy, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DealPromo {
  code: string;
  badge: string;
  badgeColor: string;
  title: string;
  discount: string;
  condition: string;
  expiryNote: string;
}

@Component({
  selector: 'app-flash-deals-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mb-10" aria-label="Ưu đãi Flash Sale & Voucher độc quyền">
      <!-- Header với Countdown Timer sống động -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-base animate-pulse">
            <i class="pi pi-bolt"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Ưu Đãi Flash Sale &amp; Voucher Độc Quyền
              </h2>
              <span class="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 tracking-wider">
                Hôm nay
              </span>
            </div>
            <p class="text-xs text-slate-500">Áp dụng trực tiếp khi giữ chỗ &amp; thanh toán trực tuyến qua VNPay / Thẻ quốc tế</p>
          </div>
        </div>

        <!-- Live Countdown -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs">
          <span class="text-slate-400 text-[11px] font-normal">Kết thúc sau:</span>
          <div class="flex items-center gap-1 font-mono font-bold text-amber-400">
            <span class="bg-white/10 px-1.5 py-0.5 rounded">{{ hours() }}</span>
            <span>:</span>
            <span class="bg-white/10 px-1.5 py-0.5 rounded">{{ minutes() }}</span>
            <span>:</span>
            <span class="bg-white/10 px-1.5 py-0.5 rounded">{{ seconds() }}</span>
          </div>
        </div>
      </div>

      <!-- Lưới 3 Thẻ Voucher Tương Tác (Bento Card Style) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        @for (deal of deals; track deal.code) {
          <div
            class="relative rounded-2xl bg-white border border-slate-200/90 p-4.5 shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between overflow-hidden"
          >
            <!-- Decorative ticket notch pattern -->
            <div class="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-50 border border-slate-200/80"></div>
            <div class="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-50 border border-slate-200/80"></div>

            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span
                  class="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border"
                  [ngClass]="deal.badgeColor"
                >
                  {{ deal.badge }}
                </span>
                <span class="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                  <i class="pi pi-clock text-[10px]"></i> {{ deal.expiryNote }}
                </span>
              </div>

              <h3 class="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {{ deal.title }}
              </h3>
              <p class="text-lg font-black text-emerald-600 mt-1">
                {{ deal.discount }}
              </p>
              <p class="text-xs text-slate-500 mt-1 line-clamp-1">
                {{ deal.condition }}
              </p>
            </div>

            <!-- Mã code & nút copy 1 chạm -->
            <div class="mt-4 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg font-mono text-xs font-bold text-slate-700">
                <i class="pi pi-tag text-[10px] text-indigo-500"></i>
                <span>{{ deal.code }}</span>
              </div>

              <button
                type="button"
                (click)="copyCode(deal.code)"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                [class.bg-emerald-600]="copiedCode() === deal.code"
                [class.text-white]="copiedCode() === deal.code"
                [class.bg-indigo-50]="copiedCode() !== deal.code"
                [class.text-indigo-700]="copiedCode() !== deal.code"
                [class.hover:bg-indigo-100]="copiedCode() !== deal.code"
                [title]="copiedCode() === deal.code ? 'Đã sao chép mã' : 'Sao chép mã giảm giá'"
              >
                <i [class]="copiedCode() === deal.code ? 'pi pi-check' : 'pi pi-copy'"></i>
                <span>{{ copiedCode() === deal.code ? 'Đã chép!' : 'Lấy mã' }}</span>
              </button>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class FlashDealsBannerComponent implements OnInit, OnDestroy {
  @Output() applyCode = new EventEmitter<string>();

  readonly hours = signal('05');
  readonly minutes = signal('42');
  readonly seconds = signal('19');
  readonly copiedCode = signal<string | null>(null);

  private timerInterval: any;
  private remainingSeconds = 5 * 3600 + 42 * 60 + 19;

  readonly deals: DealPromo[] = [
    {
      code: 'WELCOME15',
      badge: 'Khách Mới',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      title: 'Giảm 15% cho lần đặt đầu tiên',
      discount: 'Tối đa 300.000 ₫',
      condition: 'Áp dụng cho mọi cơ sở lưu trú, không giới hạn số đêm',
      expiryNote: 'Còn 34 lượt'
    },
    {
      code: 'WEEKEND200',
      badge: 'Cuối Tuần',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      title: 'Giảm 200.000 ₫ nghỉ dưỡng T6 – CN',
      discount: 'Giảm trực tiếp 200.000 ₫',
      condition: 'Đơn đặt từ 1.000.000 ₫ tại resort & khách sạn',
      expiryNote: 'Ưu đãi hot'
    },
    {
      code: 'HOURLY99K',
      badge: 'Thuê Theo Giờ',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      title: 'Đồng giá thuê giờ từ 99.000 ₫',
      discount: 'Chỉ 99.000 ₫ / 2 giờ đầu',
      condition: 'Áp dụng cho nhà nghỉ, motel & khách sạn nội đô',
      expiryNote: 'Khung giờ vàng'
    }
  ];

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        const h = Math.floor(this.remainingSeconds / 3600);
        const m = Math.floor((this.remainingSeconds % 3600) / 60);
        const s = this.remainingSeconds % 60;
        this.hours.set(String(h).padStart(2, '0'));
        this.minutes.set(String(m).padStart(2, '0'));
        this.seconds.set(String(s).padStart(2, '0'));
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
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
    }, 2500);
  }
}
