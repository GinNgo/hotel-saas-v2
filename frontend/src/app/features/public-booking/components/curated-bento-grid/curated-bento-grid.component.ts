import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TravelLifestyle {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  cardGradient: string;
  icon: string;
  filterType: string;
  destinationHint: string;
  imageUrl: string;
}

@Component({
  selector: 'app-curated-bento-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mt-14 mb-14" aria-label="Khám phá theo phong cách nghỉ dưỡng">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <i class="pi pi-compass text-[var(--brand-primary)]"></i> Danh Mục Lưu Trú
          </span>
          <h2 class="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Khám Phá Theo Loại Hình Lưu Trú
          </h2>
          <p class="text-xs sm:text-sm text-slate-600 mt-1">
            Chọn nhanh nhóm cơ sở phù hợp với lịch trình di chuyển và nhu cầu lưu trú của bạn.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (item of lifestyles; track item.id) {
          <button
            type="button"
            [attr.aria-label]="'Khám phá ' + item.filterType"
            (click)="onSelect(item)"
            class="group rounded-2xl overflow-hidden bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col text-left"
          >
            <div class="relative h-40 w-full overflow-hidden bg-slate-100">
              <img
                [src]="item.imageUrl"
                [alt]="item.title"
                width="640"
                height="420"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-xs text-slate-800 border border-slate-200/80 shadow-2xs">
                {{ item.badge }}
              </span>
            </div>

            <div class="p-4 flex-1 flex flex-col justify-between space-y-2 w-full">
              <div>
                <p class="text-xs font-medium text-[var(--brand-primary)] mb-1 flex items-center gap-1">
                  <i class="pi pi-map-marker text-[11px]"></i> {{ item.destinationHint }}
                </p>
                <h3 class="text-base font-bold text-slate-900 tracking-tight leading-snug group-hover:text-[var(--brand-primary)] transition-colors">
                  {{ item.title }}
                </h3>
                <p class="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                  {{ item.tagline }}
                </p>
              </div>

              <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[var(--brand-primary)]">
                <span>Lọc các cơ sở thực tế</span>
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
      title: 'Resort & Khu Nghỉ Dưỡng',
      tagline: 'Xem danh sách resort, tiện nghi và chính sách giá thực tế theo ngày hoặc qua đêm.',
      badge: 'Resort',
      badgeColor: 'bg-emerald-600/90',
      cardGradient: 'bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900',
      icon: 'pi-sun',
      filterType: 'Resort',
      destinationHint: 'Phú Quốc, Đà Nẵng, Nha Trang',
      imageUrl: '/images/danang-ocean-suites.png'
    },
    {
      id: 'homestay-getaway',
      title: 'Homestay Bản Địa',
      tagline: 'Không gian lưu trú gần gũi, dễ dàng kiểm tra phòng trống và giữ chỗ trực tuyến.',
      badge: 'Homestay',
      badgeColor: 'bg-indigo-600/90',
      cardGradient: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900',
      icon: 'pi-home',
      filterType: 'Homestay',
      destinationHint: 'Đà Lạt, Sa Pa, Hội An',
      imageUrl: '/images/dalat-pine-resort.png'
    },
    {
      id: 'city-hotel',
      title: 'Khách Sạn Trung Tâm',
      tagline: 'Xem tiện nghi, hình thức lưu trú theo giờ, qua đêm hoặc theo ngày tại từng cơ sở.',
      badge: 'Khách sạn',
      badgeColor: 'bg-amber-600/90',
      cardGradient: 'bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950',
      icon: 'pi-building',
      filterType: 'Hotel',
      destinationHint: 'TP. Hồ Chí Minh, Hà Nội, Đà Nẵng',
      imageUrl: '/images/saigon-riverside-tower.png'
    },
    {
      id: 'villa-group',
      title: 'Biệt Thự & Villa Nghỉ Dưỡng',
      tagline: 'Lựa chọn phù hợp cho gia đình và nhóm bạn với lịch phòng cập nhật từ cơ sở.',
      badge: 'Villa',
      badgeColor: 'bg-rose-600/90',
      cardGradient: 'bg-gradient-to-br from-stone-900 via-rose-950 to-slate-900',
      icon: 'pi-star',
      filterType: 'Villa',
      destinationHint: 'Vũng Tàu, Đà Lạt, Phú Quốc',
      imageUrl: '/images/family-ocean-suite.png'
    }
  ];

  onSelect(item: TravelLifestyle): void {
    this.selectCategory.emit(item.filterType);
  }
}
