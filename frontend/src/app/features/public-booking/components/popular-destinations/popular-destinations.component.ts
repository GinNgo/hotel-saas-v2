import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PopularDestination {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly touristZone: string;
  readonly hotLandmarks: string[];
  readonly tag: string;
  readonly startPrice: string;
  readonly propertyCount: number;
  readonly imageUrl: string;
  readonly searchTerm: string;
}

@Component({
  selector: 'app-popular-destinations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mb-12" id="popularDestinationsSection">
      <div class="flex items-end justify-between mb-5 flex-wrap gap-2">
        <div>
          <span class="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider block mb-1">
            Gợi ý địa điểm nghỉ dưỡng hàng đầu
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Điểm Đến Nổi Bật &amp; Địa Danh Du Lịch
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
            Khám phá các khu du lịch và địa danh nổi tiếng với đa dạng loại hình lưu trú (Hotel, Motel, Homestay, Resort).
          </p>
        </div>
      </div>

      <!-- Destinations Responsive Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        <button
          *ngFor="let dest of destinations"
          type="button"
          (click)="onSelect(dest)"
          class="group text-left relative rounded-2xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-100 flex flex-col justify-end aspect-3/4 sm:aspect-4/5 p-3 sm:p-3.5 cursor-pointer">

          <!-- Background Image with Zoom on Hover -->
          <img
            [src]="dest.imageUrl"
            [alt]="dest.name"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />

          <!-- Gradient Overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent"></div>

          <!-- Top Tag Badge -->
          <div class="relative z-10 mb-auto flex flex-col gap-1 items-start">
            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase bg-white/20 backdrop-blur-md text-white border border-white/20">
              {{ dest.tag }}
            </span>
          </div>

          <!-- Bottom Content -->
          <div class="relative z-10 text-white min-w-0">
            <h3 class="text-sm sm:text-base font-extrabold tracking-tight leading-tight group-hover:text-indigo-300 transition-colors truncate">
              {{ dest.name }}
            </h3>
            <p class="text-[10px] text-emerald-300 font-semibold truncate mt-0.5">
              {{ dest.touristZone }}
            </p>
            
            <!-- Hot Landmark Micro-Badge -->
            <div class="mt-1 flex items-center gap-1 text-[9px] text-slate-300 truncate">
              <i class="pi pi-map-marker text-[9px] text-amber-400 shrink-0"></i>
              <span class="truncate">{{ dest.hotLandmarks.join(', ') }}</span>
            </div>

            <div class="mt-2 pt-1.5 border-t border-white/15 flex items-baseline justify-between gap-1">
              <span class="text-[10px] text-slate-300 font-medium truncate">Từ</span>
              <strong class="text-xs sm:text-sm font-black text-amber-300 whitespace-nowrap">
                {{ dest.startPrice }}
              </strong>
            </div>
          </div>
        </button>
      </div>
    </section>
  `
})
export class PopularDestinationsComponent {
  @Output() selectDestination = new EventEmitter<string>();

  readonly destinations: PopularDestination[] = [
    {
      id: 'dalat',
      name: 'Đà Lạt',
      region: 'Lâm Đồng &bull; Cao nguyên',
      touristZone: 'Khu DL Hồ Tuyền Lâm',
      hotLandmarks: ['Chợ đêm Đà Lạt', 'Hồ Xuân Hương'],
      tag: 'Nghỉ dưỡng',
      startPrice: '450.000 ₫',
      propertyCount: 42,
      imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Đà Lạt'
    },
    {
      id: 'vungtau',
      name: 'Vũng Tàu',
      region: 'Bà Rịa &bull; Ven biển',
      touristZone: 'Khu du lịch Bãi Sau',
      hotLandmarks: ['Bãi Sau', 'Tượng Chúa Kito'],
      tag: 'Thuê giờ & Đêm',
      startPrice: '250.000 ₫',
      propertyCount: 34,
      imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Vũng Tàu'
    },
    {
      id: 'danang',
      name: 'Đà Nẵng',
      region: 'Miền Trung &bull; Biển Mỹ Khê',
      touristZone: 'Bán đảo Sơn Trà',
      hotLandmarks: ['Cầu Rồng', 'Biển Mỹ Khê'],
      tag: 'Thành phố biển',
      startPrice: '490.000 ₫',
      propertyCount: 55,
      imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Đà Nẵng'
    },
    {
      id: 'nhatrang',
      name: 'Nha Trang',
      region: 'Khánh Hòa &bull; Vịnh biển',
      touristZone: 'Vịnh Nha Trang',
      hotLandmarks: ['Tháp Trầm Hương', 'Bãi Trần Phú'],
      tag: 'Biển đảo',
      startPrice: '520.000 ₫',
      propertyCount: 38,
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Nha Trang'
    },
    {
      id: 'phuquoc',
      name: 'Phú Quốc',
      region: 'Kiên Giang &bull; Đảo ngọc',
      touristZone: 'Khu du lịch Bãi Dài',
      hotLandmarks: ['Grand World', 'Chợ đêm Phú Quốc'],
      tag: 'Resort sang trọng',
      startPrice: '850.000 ₫',
      propertyCount: 29,
      imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Phú Quốc'
    },
    {
      id: 'hcm',
      name: 'Hồ Chí Minh',
      region: 'Trung tâm &bull; Quận 1',
      touristZone: 'Trung tâm Quận 1 & Chợ Bến Thành',
      hotLandmarks: ['Chợ Bến Thành', 'Phố đi bộ Nguyễn Huệ'],
      tag: 'Đô thị sôi động',
      startPrice: '550.000 ₫',
      propertyCount: 68,
      imageUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80',
      searchTerm: 'Hồ Chí Minh'
    }
  ];

  onSelect(destination: PopularDestination): void {
    this.selectDestination.emit(destination.searchTerm);
  }
}
