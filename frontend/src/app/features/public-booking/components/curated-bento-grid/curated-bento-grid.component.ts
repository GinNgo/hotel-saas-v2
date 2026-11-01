import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TravelLifestyle {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  startPrice: string;
  image: string;
  filterType: string;
  destinationHint: string;
}

@Component({
  selector: 'app-curated-bento-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mt-14 mb-14" aria-label="Khám phá theo phong cách nghỉ dưỡng">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
            <i class="pi pi-compass"></i> Trải Nghiệm Tuyển Chọn
          </span>
          <h2 class="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Khám Phá Theo Phong Cách Nghỉ Dưỡng
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Lựa chọn không gian lưu trú lý tưởng theo cảm hứng du lịch và mục đích chuyến đi của bạn.
          </p>
        </div>
      </div>

      <!-- Bento Grid 4 Phong Cách Sống (1 ô lớn 2 ô nhỏ hoặc 4 ô cân xứng) -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (item of lifestyles; track item.id) {
          <button type="button"
            [attr.aria-label]="'Khám phá ' + item.filterType"
            (click)="onSelect(item)"
            class="group relative rounded-2xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer aspect-4/5 sm:aspect-3/4 lg:aspect-4/5 flex flex-col justify-between p-5 border border-slate-100"
          >
            <!-- Background Image -->
            <img
              [src]="item.image"
              [alt]="item.title"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
              loading="lazy"
            />

            <!-- Dual Gradient Overlay for Maximum Readability -->
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/20"></div>

            <!-- Top Badge -->
            <div class="relative z-10 flex items-center justify-between">
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md border border-white/20 text-white"
                [ngClass]="item.badgeColor"
              >
                {{ item.badge }}
              </span>
              <span class="text-[11px] font-mono font-bold text-amber-300 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md">
                Từ {{ item.startPrice }}
              </span>
            </div>

            <!-- Bottom Content -->
            <div class="relative z-10 text-white">
              <p class="text-xs text-indigo-300 font-semibold mb-1 flex items-center gap-1">
                <i class="pi pi-map-marker text-[11px]"></i> {{ item.destinationHint }}
              </p>
              <h3 class="text-base sm:text-lg font-black tracking-tight leading-snug group-hover:text-indigo-200 transition-colors">
                {{ item.title }}
              </h3>
              <p class="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                {{ item.tagline }}
              </p>

              <div class="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs font-bold text-white">
                <span>Khám phá ngay</span>
                <i class="pi pi-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
              </div>
            </div>
          </button>
        }
      </div>
    </section>
  `
})
export class CuratedBentoGridComponent {
  @Output() selectCategory = new EventEmitter<string>();

  readonly lifestyles: TravelLifestyle[] = [
    {
      id: 'resort-beach',
      title: 'Resort Biển & Hồ Bơi Vô Cực',
      tagline: 'Thư giãn tuyệt đối bên bờ biển cát trắng với dịch vụ 4-5 sao đẳng cấp.',
      badge: 'Resort Nghỉ Dưỡng',
      badgeColor: 'bg-emerald-500/80',
      startPrice: '950.000 ₫/đêm',
      image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80',
      filterType: 'Resort',
      destinationHint: 'Phú Quốc, Đà Nẵng, Nha Trang'
    },
    {
      id: 'cloud-hunting',
      title: 'Săn Mây & Thung Lũng Rừng Thông',
      tagline: 'Đón bình minh se lạnh và nhâm nhi cà phê giữa đồi sương mờ ảo.',
      badge: 'Staycation Đà Lạt',
      badgeColor: 'bg-indigo-500/80',
      startPrice: '450.000 ₫/đêm',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80',
      filterType: 'Homestay',
      destinationHint: 'Đà Lạt, Sa Pa, Tam Đảo'
    },
    {
      id: 'city-hourly',
      title: 'Khách Sạn Trung Tâm & Thuê Theo Giờ',
      tagline: 'Xem tiện nghi, hình thức lưu trú và chính sách tại từng cơ sở trước khi đặt.',
      badge: 'Linh Hoạt 24/7',
      badgeColor: 'bg-amber-500/80',
      startPrice: '99.000 ₫/2h',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=700&q=80',
      filterType: 'Hotel',
      destinationHint: 'Quận 1 TP.HCM, Phố Cổ Hà Nội'
    },
    {
      id: 'family-nature',
      title: 'Homestay Gia Đình & Nhóm Bạn',
      tagline: 'Không gian ấm cúng, bếp nấu riêng và sân vườn tổ chức tiệc BBQ thư giãn.',
      badge: 'Gia Đình & Bạn Bè',
      badgeColor: 'bg-rose-500/80',
      startPrice: '600.000 ₫/đêm',
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=700&q=80',
      filterType: 'Homestay',
      destinationHint: 'Vũng Tàu, Hội An, Ba Vì'
    }
  ];

  onSelect(item: TravelLifestyle): void {
    this.selectCategory.emit(item.filterType);
  }
}
