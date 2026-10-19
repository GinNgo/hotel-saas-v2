import { ChangeDetectionStrategy, Component, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VIETNAM_34_PROVINCES, VietnamProvinceDestination, VietnamRegion } from '../../../../core/data/vietnam-provinces.data';

@Component({
  selector: 'app-popular-destinations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-14 scroll-mt-20" id="popularDestinationsSection">
      <!-- Header Section with Title, Slogan & Region Filter Tabs -->
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <i class="pi pi-compass text-[10px] text-amber-600"></i>
              Bản Đồ Nghỉ Dưỡng Việt Nam
            </span>
            <span class="text-xs text-slate-400 font-medium">34 Tỉnh Thành Trọng Điểm</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
            Khám Phá Địa Danh &amp; Resort Nghỉ Dưỡng
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Hơn 1.500+ khách sạn, resort 5 sao, homestay săn mây và nhà nghỉ ven biển trải dài từ địa đầu Lũng Cú đến Mũi Cà Mau.
          </p>
        </div>

        <!-- Search & Filter Controls -->
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          <!-- Live Search Input -->
          <div class="relative w-full sm:w-64">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm tỉnh, vịnh, đèo, chợ..."
              class="w-full pl-8 pr-7 py-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i class="pi pi-times-circle"></i>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Region Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 no-scrollbar text-xs font-semibold">
        <button
          type="button"
          (click)="selectedRegion.set('all')"
          [class]="selectedRegion() === 'all' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Tất Cả</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">34</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('north')"
          [class]="selectedRegion() === 'north' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Bắc</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'north' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">10</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('central')"
          [class]="selectedRegion() === 'central' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Trung</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'central' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">10</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('highlands')"
          [class]="selectedRegion() === 'highlands' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Tây Nguyên</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'highlands' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">4</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('south')"
          [class]="selectedRegion() === 'south' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Nam</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'south' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">10</span>
        </button>
      </div>

      <!-- Responsive Grid of Destinations (Double-Bezel Luxury Cards) -->
      @if (filteredDestinations().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-4">
          @for (dest of displayedDestinations(); track dest.id) {
            <button
              type="button"
              (click)="onSelect(dest)"
              class="group text-left relative rounded-2xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-200/40 dark:border-slate-800 flex flex-col justify-end aspect-3/4 sm:aspect-4/5 p-3.5 cursor-pointer"
            >
              <!-- High-Res Visual Image with Zoom on Hover -->
              <img
                [src]="dest.imageUrl"
                [alt]="dest.name"
                class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                loading="lazy"
              />

              <!-- Multi-stop Architectural Dark Gradient Overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20"></div>

              <!-- Top Micro Badges (Rating & Tag) -->
              <div class="relative z-10 mb-auto flex items-center justify-between w-full gap-1">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-black/40 backdrop-blur-md text-amber-300 border border-amber-400/30">
                  <i class="pi pi-star-fill text-[8px] text-amber-400"></i>
                  {{ dest.rating }}
                </span>
                <span class="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight bg-white/20 backdrop-blur-md text-white border border-white/20 truncate max-w-[90px]">
                  {{ dest.tag }}
                </span>
              </div>

              <!-- Bottom Content Details -->
              <div class="relative z-10 text-white min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <h3 class="text-sm sm:text-base font-black tracking-tight leading-tight group-hover:text-amber-300 transition-colors truncate font-serif">
                    {{ dest.shortName }}
                  </h3>
                  <span class="text-[10px] font-semibold text-slate-300 shrink-0">
                    {{ dest.propertyCount }}+ chỗ nghỉ
                  </span>
                </div>

                <p class="text-[10px] text-amber-200/90 font-medium truncate mt-0.5">
                  {{ dest.touristZone }}
                </p>

                <!-- Hot Landmark Snippet -->
                <div class="mt-1 flex items-center gap-1 text-[9px] text-slate-300 truncate">
                  <i class="pi pi-map-marker text-[9px] text-amber-400 shrink-0"></i>
                  <span class="truncate">{{ dest.hotLandmarks[0] }}</span>
                </div>

                <!-- Price & Action Footer -->
                <div class="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between gap-1">
                  <div>
                    <span class="text-[9px] text-slate-400 block -mb-0.5 font-medium">Từ</span>
                    <span class="text-xs font-black text-amber-400">{{ dest.startPrice }}</span>
                  </div>
                  <div class="w-6 h-6 rounded-full bg-white/10 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center transition-colors shrink-0">
                    <i class="pi pi-arrow-right text-[10px]"></i>
                  </div>
                </div>
              </div>
            </button>
          }
        </div>

        <!-- Show More / Collapse Button -->
        @if (filteredDestinations().length > initialLimit) {
          <div class="mt-8 text-center">
            <button
              type="button"
              (click)="toggleShowAll()"
              class="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-white hover:bg-slate-50 text-slate-800 border border-slate-300/80 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <span>{{ showAll() ? 'Thu Gọn Danh Sách' : 'Xem Thêm ' + (filteredDestinations().length - initialLimit) + ' Tỉnh Thành Khác' }}</span>
              <i class="pi" [class]="showAll() ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
          </div>
        }
      } @else {
        <!-- Empty Search State -->
        <div class="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <i class="pi pi-search text-3xl text-slate-400 mb-2"></i>
          <p class="text-sm font-bold text-slate-700">Không tìm thấy địa danh nào phù hợp với "{{ searchQuery() }}"</p>
          <p class="text-xs text-slate-500 mt-1">Vui lòng thử tìm kiếm với từ khóa khác như "Hà Nội", "Đà Lạt", "Vịnh Hạ Long", v.v.</p>
          <button
            type="button"
            (click)="searchQuery.set('')"
            class="mt-3 text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
          >
            Xem toàn bộ 34 tỉnh thành
          </button>
        </div>
      }
    </section>
  `
})
export class PopularDestinationsComponent {
  @Output() selectDestination = new EventEmitter<string>();

  readonly allDestinations = VIETNAM_34_PROVINCES;
  readonly initialLimit = 12;

  readonly selectedRegion = signal<VietnamRegion>('all');
  readonly searchQuery = signal<string>('');
  readonly showAll = signal<boolean>(false);

  readonly activeTabClass = 'bg-slate-900 text-white font-black shadow-sm';
  readonly inactiveTabClass = 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900';

  readonly filteredDestinations = computed(() => {
    const reg = this.selectedRegion();
    const query = this.searchQuery().trim().toLowerCase();

    return this.allDestinations.filter(d => {
      const matchRegion = reg === 'all' || d.region === reg;
      if (!matchRegion) return false;

      if (!query) return true;

      const inName = d.name.toLowerCase().includes(query) || d.shortName.toLowerCase().includes(query);
      const inZone = d.touristZone.toLowerCase().includes(query);
      const inLandmark = d.hotLandmarks.some(l => l.toLowerCase().includes(query));
      const inTag = d.tag.toLowerCase().includes(query);

      return inName || inZone || inLandmark || inTag;
    });
  });

  readonly displayedDestinations = computed(() => {
    const list = this.filteredDestinations();
    if (this.showAll() || this.searchQuery().trim().length > 0) {
      return list;
    }
    return list.slice(0, this.initialLimit);
  });

  toggleShowAll(): void {
    this.showAll.update(v => !v);
  }

  onSelect(destination: VietnamProvinceDestination): void {
    this.selectDestination.emit(destination.searchTerm);
  }
}
