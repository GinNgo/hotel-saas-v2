import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hotelier-cta-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mt-14 mb-8" aria-label="Kêu gọi hợp tác đối tác khách sạn">
      <div
        class="relative rounded-3xl bg-gradient-to-br from-teal-50/70 via-white to-slate-50 border border-slate-200 text-slate-900 p-6 sm:p-10 shadow-xs overflow-hidden"
      >
        <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <!-- Text & Value Props -->
          <div class="lg:col-span-8 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
              <i class="pi pi-building text-[var(--brand-primary)]"></i>
              <span>Dành Cho Chủ Cơ Sở &amp; Chuỗi Khách Sạn</span>
            </div>

            <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
              Tối Ưu Công Suất Phòng &amp; Quản Trị Tự Động Với Hotel SaaS
            </h2>

            <p class="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Gia nhập hệ sinh thái PMS &amp; Booking đa chi nhánh. Tự động hóa sơ đồ phòng Rack, điều phối buồng phòng, hạch toán doanh thu và quản lý nhận/trả phòng trực tuyến chỉ trong 2 phút thiết lập.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div class="flex items-center gap-2 text-slate-700">
                <i class="pi pi-check text-[var(--brand-primary)] text-xs font-bold"></i>
                <span>Quản trị đa chi nhánh</span>
              </div>
              <div class="flex items-center gap-2 text-slate-700">
                <i class="pi pi-check text-[var(--brand-primary)] text-xs font-bold"></i>
                <span>Quản lý đặt phòng &amp; lễ tân 24/7</span>
              </div>
              <div class="flex items-center gap-2 text-slate-700">
                <i class="pi pi-check text-[var(--brand-primary)] text-xs font-bold"></i>
                <span>Thu ngân &amp; Cổng VNPay</span>
              </div>
            </div>
          </div>

          <!-- CTA Button Action Box -->
          <div class="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch gap-3">
            <a
              [routerLink]="['/auth/partner-register']"
              class="min-h-11 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] font-bold text-sm transition-all duration-200 shadow-xs cursor-pointer text-center"
            >
              <i class="pi pi-sparkles"></i>
              <span>Đăng ký mở cơ sở ngay</span>
              <i class="pi pi-arrow-right text-xs"></i>
            </a>

            <a
              [routerLink]="['/auth/login']"
              class="min-h-11 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors border border-slate-300 text-center"
            >
              <i class="pi pi-lock"></i>
              <span>Đăng nhập Cổng PMS</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  `
})
export class HotelierCtaBannerComponent {}
