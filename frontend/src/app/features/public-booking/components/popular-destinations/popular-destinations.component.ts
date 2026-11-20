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
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-700 border border-slate-200">
              <i class="pi pi-compass text-[10px] text-[var(--brand-primary)]"></i>
              Bản Đồ Nghỉ Dưỡng Việt Nam
            </span>
            <span class="text-xs text-slate-500 font-medium">34 Tỉnh Thành Trọng Điểm</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-display">
            Khám Phá Địa Danh &amp; Resort Nghỉ Dưỡng
          </h2>
          <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Khám phá mạng lưới điểm đến theo chuẩn địa giới 34 tỉnh/thành phố từ địa đầu Lũng Cú đến Mũi Cà Mau.
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
              aria-label="Tìm kiếm điểm đến"
              class="w-full min-h-11 pl-8 pr-11 py-2 rounded-xl text-xs bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                aria-label="Xóa từ khóa tìm kiếm điểm đến"
                class="min-w-11 min-h-11 flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
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
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">{{ totalCount() }}</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('north')"
          [class]="selectedRegion() === 'north' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Bắc</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'north' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">{{ northCount() }}</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('central')"
          [class]="selectedRegion() === 'central' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Trung</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'central' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">{{ centralCount() }}</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('highlands')"
          [class]="selectedRegion() === 'highlands' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Tây Nguyên</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'highlands' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">{{ highlandsCount() }}</span>
        </button>

        <button
          type="button"
          (click)="selectedRegion.set('south')"
          [class]="selectedRegion() === 'south' ? activeTabClass : inactiveTabClass"
          class="px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <span>Miền Nam</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold opacity-80" [class]="selectedRegion() === 'south' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'">{{ southCount() }}</span>
        </button>
      </div>

      <!-- Responsive Grid of Destinations (Bright Photo-Top Cards) -->
      @if (filteredDestinations().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-4">
          @for (dest of displayedDestinations(); track dest.id) {
            <button
              type="button"
              (click)="onSelect(dest)"
              class="group text-left rounded-2xl overflow-hidden bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] flex flex-col cursor-pointer"
            >
              <!-- Bright Local Asset Image -->
              <div class="relative h-36 sm:h-40 w-full overflow-hidden bg-slate-100 shrink-0">
                @if (dest.imageUrl) {
                  <img
                    [src]="dest.imageUrl"
                    [alt]="dest.name"
                    width="360"
                    height="450"
                    (error)="onDestinationImageError($event)"
                    class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                }

                <!-- Top Micro Badges (Region & Tag) -->
                <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-slate-700 border border-slate-200/80 shadow-2xs">
                    {{ dest.regionName }}
                  </span>
                  <span class="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-tight bg-slate-900/75 backdrop-blur-xs text-white truncate max-w-[90px]">
                    {{ dest.tag }}
                  </span>
                </div>
              </div>

              <!-- Bottom Clean White Content Details -->
              <div class="p-3.5 flex-1 flex flex-col justify-between bg-white w-full min-w-0">
                <div>
                  <div class="flex items-baseline justify-between gap-1">
                    <h3 class="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight group-hover:text-[var(--brand-primary)] transition-colors truncate font-display">
                      {{ dest.shortName }}
                    </h3>
                    <span class="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">
                      #{{ dest.code }}
                    </span>
                  </div>

                  <p class="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    {{ dest.touristZone }}
                  </p>

                  <!-- Hot Landmark Snippet -->
                  <div class="mt-1 flex items-center gap-1 text-[10px] text-slate-500 truncate">
                    <i class="pi pi-map-marker text-[9px] text-[var(--brand-primary)] shrink-0"></i>
                    <span class="truncate">{{ dest.hotLandmarks[0] }}</span>
                  </div>
                </div>

                <!-- Action Footer -->
                <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <span class="text-[11px] font-semibold text-[var(--brand-primary)]">Xem cơ sở lưu trú</span>
                  <div class="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-[var(--brand-primary)] group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0">
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
              class="min-h-11 inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
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
            class="mt-3 text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer"
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

  readonly totalCount = computed(() => this.allDestinations.length);
  readonly northCount = computed(() => this.allDestinations.filter(d => d.region === 'north').length);
  readonly centralCount = computed(() => this.allDestinations.filter(d => d.region === 'central').length);
  readonly highlandsCount = computed(() => this.allDestinations.filter(d => d.region === 'highlands').length);
  readonly southCount = computed(() => this.allDestinations.filter(d => d.region === 'south').length);

  readonly selectedRegion = signal<VietnamRegion>('all');
  readonly searchQuery = signal<string>('');
  readonly showAll = signal<boolean>(false);

  readonly activeTabClass = 'bg-[var(--brand-primary)] text-white font-semibold shadow-2xs';
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

  onDestinationImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img) {
      img.style.display = 'none';
    }
  }
}
