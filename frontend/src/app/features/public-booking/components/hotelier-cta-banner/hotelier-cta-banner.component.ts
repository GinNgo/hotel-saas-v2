import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hotelier-cta-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="mt-14 mb-8" aria-label="Kêu gọi hợp tác đối tác khách sạn">
      <div
        class="relative rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 border border-indigo-900/60 overflow-hidden shadow-xl"
      >
        <!-- Decorative Ambient Light -->
        <div class="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none"></div>
        <div class="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <!-- Text & Value Props -->
          <div class="lg:col-span-8 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-300 text-xs font-bold">
              <i class="pi pi-building text-amber-400"></i>
              <span>Dành Cho Chủ Cơ Sở &amp; Chuỗi Khách Sạn</span>
            </div>

            <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              Tối Ưu Công Suất Phòng &amp; Quản Trị Tự Động Với Hotel SaaS
            </h2>

            <p class="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Gia nhập hệ sinh thái PMS &amp; Booking đa chi nhánh. Tự động hóa sơ đồ phòng Rack, điều phối buồng phòng, hạch toán doanh thu và mở khóa Smart Lock không chạm chỉ trong 2 phút thiết lập.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div class="flex items-center gap-2 text-slate-200">
                <i class="pi pi-check text-emerald-400 text-xs font-bold"></i>
                <span>Quản trị đa chi nhánh</span>
              </div>
              <div class="flex items-center gap-2 text-slate-200">
                <i class="pi pi-check text-emerald-400 text-xs font-bold"></i>
                <span>Tích hợp Smart Lock 24/7</span>
              </div>
              <div class="flex items-center gap-2 text-slate-200">
                <i class="pi pi-check text-emerald-400 text-xs font-bold"></i>
                <span>Thu ngân &amp; Cổng VNPay</span>
              </div>
            </div>
          </div>

          <!-- CTA Button Action Box -->
          <div class="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch gap-3">
            <a
              [routerLink]="['/partner-register']"
              class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 cursor-pointer text-center"
            >
              <i class="pi pi-sparkles"></i>
              <span>Đăng ký mở cơ sở ngay</span>
              <i class="pi pi-arrow-right text-xs"></i>
            </a>

            <a
              [routerLink]="['/login']"
              class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs transition-colors border border-white/15 text-center"
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
