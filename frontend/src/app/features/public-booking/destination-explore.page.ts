import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import {
  TouristZoneDto,
  LandmarkDto,
  PublicPropertyDto,
  PropertyType
} from '../../core/models/public-booking.model';

@Component({
  selector: 'app-destination-explore',
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
          @if (currentSlug()) {
            <a routerLink="/booking/destinations" class="hover:text-indigo-600 transition-colors">Địa danh &amp; Khu du lịch</a>
            <span>/</span>
            <span class="text-slate-800 font-semibold truncate">{{ activeTitle() }}</span>
          } @else {
            <span class="text-slate-800 font-semibold">Khám phá Địa danh &amp; Khu du lịch</span>
          }
        </nav>

        <!-- 2. NẾU KHÔNG CÓ SLUG: TRANG TỔNG HỢP TOÀN QUỐC -->
        @if (!currentSlug()) {
          <!-- HERO BANNER -->
          <div class="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-8 sm:p-12 shadow-md">
            <div class="relative z-10 max-w-2xl space-y-3">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                Điểm đến nổi tiếng
              </span>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Khám phá Khách sạn &amp; Nhà nghỉ quanh các Địa danh Du lịch
              </h1>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tìm kiếm phòng nghỉ theo giờ, qua đêm hoặc theo ngày ngay sát bãi biển, chợ đêm, phố đi bộ và các danh thắng hàng đầu Việt Nam.
              </p>
            </div>
          </div>

          <!-- A. DANH MỤC KHU DU LỊCH TRỌNG ĐIỂM -->
          <section class="space-y-4">
            <div>
              <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Khu du lịch &amp; Thành phố nổi bật</h2>
              <p class="text-xs text-slate-500">Các điểm đến có mật độ cơ sở lưu trú và địa danh phong phú nhất</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              @for (zone of touristZones(); track zone.slug) {
                <a
                  [routerLink]="['/booking/destinations', zone.slug]"
                  class="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col cursor-pointer"
                >
                  <div class="h-40 overflow-hidden relative">
                    <img
                      [src]="getZoneImage(zone.slug)"
                      [alt]="zone.name"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-3.5">
                      <span class="text-white font-extrabold text-base">{{ zone.name }}</span>
                    </div>
                  </div>

                  <div class="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <p class="text-xs text-slate-600 line-clamp-2">{{ zone.description || 'Khám phá các điểm nghỉ chân hấp dẫn' }}</p>
                    <div class="flex items-center justify-between text-[11px] text-indigo-600 font-semibold pt-2 border-t border-slate-100">
                      <span>Xem khách sạn gần đó</span>
                      <i class="pi pi-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </a>
              }
            </div>
          </section>

          <!-- B. DANH MỤC ĐỊA DANH NỔI TIẾNG (LANDMARKS) -->
          <section class="space-y-4 pt-4">
            <div>
              <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Top Địa danh &amp; Thắng cảnh Hút Khách</h2>
              <p class="text-xs text-slate-500">Bấm vào địa danh để xem khách sạn trong bán kính đi bộ &lt; 500m</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              @for (lm of landmarks(); track lm.slug) {
                <a
                  [routerLink]="['/booking/destinations', lm.slug]"
                  class="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all flex items-center justify-between gap-3 shadow-2xs group cursor-pointer"
                >
                  <div class="flex items-center gap-3 truncate">
                    <div class="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                      📍
                    </div>
                    <div class="truncate">
                      <span class="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-600 transition-colors">{{ lm.name }}</span>
                      <span class="text-[10px] text-slate-500">{{ lm.category || 'Địa danh du lịch' }}</span>
                    </div>
                  </div>
                  <i class="pi pi-angle-right text-xs text-slate-300 group-hover:text-indigo-600 transition-colors"></i>
                </a>
              }
            </div>
          </section>
        }

        <!-- 3. NẾU CÓ SLUG: XEM CƠ SỞ THEO BÁN KÍNH ĐỊA DANH / KHU DU LỊCH ĐÃ CHỌN -->
        @if (currentSlug()) {
          <!-- HEADER ĐỊA DANH ĐƯỢC CHỌN -->
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block mb-2">
                  📍 Điểm đến du lịch
                </span>
                <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Khách sạn &amp; Nhà nghỉ quanh {{ activeTitle() }}
                </h1>
                <p class="text-xs sm:text-sm text-slate-500 mt-1">
                  Hiển thị các cơ sở lưu trú gần nhất, hỗ trợ thuê theo giờ, qua đêm và theo ngày.
                </p>
              </div>

              <a routerLink="/booking/destinations" class="text-xs text-indigo-600 hover:underline font-bold">
                ← Chọn địa danh khác
              </a>
            </div>

            <!-- BỘ LỌC BÁN KÍNH & LOẠI HÌNH & SẮP XẾP -->
            <div class="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <!-- Bán kính pills -->
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-bold text-slate-700 mr-1">Bán kính:</span>
                <button
                  type="button"
                  (click)="setRadius(null)"
                  class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  [class.bg-indigo-600]="selectedRadiusMeters() === null"
                  [class.text-white]="selectedRadiusMeters() === null"
                  [class.border-indigo-600]="selectedRadiusMeters() === null"
                  [class.bg-white]="selectedRadiusMeters() !== null"
                  [class.text-slate-700]="selectedRadiusMeters() !== null"
                  [class.border-slate-200]="selectedRadiusMeters() !== null"
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  (click)="setRadius(500)"
                  class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  [class.bg-indigo-600]="selectedRadiusMeters() === 500"
                  [class.text-white]="selectedRadiusMeters() === 500"
                  [class.border-indigo-600]="selectedRadiusMeters() === 500"
                  [class.bg-white]="selectedRadiusMeters() !== 500"
                  [class.text-slate-700]="selectedRadiusMeters() !== 500"
                  [class.border-slate-200]="selectedRadiusMeters() !== 500"
                >
                  🚶 Ngay sát (&lt; 500m)
                </button>
                <button
                  type="button"
                  (click)="setRadius(1000)"
                  class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  [class.bg-indigo-600]="selectedRadiusMeters() === 1000"
                  [class.text-white]="selectedRadiusMeters() === 1000"
                  [class.border-indigo-600]="selectedRadiusMeters() === 1000"
                  [class.bg-white]="selectedRadiusMeters() !== 1000"
                  [class.text-slate-700]="selectedRadiusMeters() !== 1000"
                  [class.border-slate-200]="selectedRadiusMeters() !== 1000"
                >
                  Đi bộ (&lt; 1 km)
                </button>
                <button
                  type="button"
                  (click)="setRadius(3000)"
                  class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  [class.bg-indigo-600]="selectedRadiusMeters() === 3000"
                  [class.text-white]="selectedRadiusMeters() === 3000"
                  [class.border-indigo-600]="selectedRadiusMeters() === 3000"
                  [class.bg-white]="selectedRadiusMeters() !== 3000"
                  [class.text-slate-700]="selectedRadiusMeters() !== 3000"
                  [class.border-slate-200]="selectedRadiusMeters() !== 3000"
                >
                  Lân cận (&lt; 3 km)
                </button>
              </div>

              <!-- Sắp xếp -->
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-500">Sắp xếp:</span>
                <select
                  [ngModel]="sortBy()"
                  (ngModelChange)="sortBy.set($event)"
                  class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-indigo-500"
                >
                  <option value="distance">Gần nhất</option>
                  <option value="price_asc">Giá rẻ nhất</option>
                  <option value="rating">Đánh giá cao nhất</option>
                </select>
              </div>
            </div>
          </div>

          <!-- KẾT QUẢ TÌM THẤY -->
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>Tìm thấy <b>{{ filteredProperties().length }}</b> cơ sở lưu trú phù hợp:</span>
            </div>

            @if (filteredProperties().length === 0) {
              <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  🏨
                </div>
                <h3 class="text-sm font-bold text-slate-800">Chưa có cơ sở lưu trú trong bán kính này</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">
                  Quý khách vui lòng chọn bán kính rộng hơn (&lt; 3km) hoặc khám phá các địa danh lân cận.
                </p>
                <button
                  type="button"
                  (click)="setRadius(null)"
                  class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Xem mọi khoảng cách
                </button>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (prop of filteredProperties(); track prop.id) {
                  <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
                    <div class="h-48 overflow-hidden relative">
                      <img
                        [src]="prop.imageUrl || prop.thumbnailUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'"
                        [alt]="prop.name"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white">
                          {{ prop.propertyTypeName || 'Khách sạn' }}
                        </span>
                        @if (prop.starRating && prop.starRating > 0) {
                          <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 flex items-center gap-0.5">
                            ★ {{ prop.starRating }}
                          </span>
                        }
                      </div>

                      @if (prop.distanceFormatted) {
                        <div class="absolute bottom-3 left-3">
                          <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-600 text-white shadow-xs">
                            📍 {{ prop.distanceFormatted }}
                          </span>
                        </div>
                      }
                    </div>

                    <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 class="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors line-clamp-1">
                          {{ prop.name }}
                        </h3>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-1">
                          {{ prop.address }}, {{ prop.city }}
                        </p>
                      </div>

                      <!-- Rental modes -->
                      <div class="flex flex-wrap gap-1 text-[10px] font-medium text-slate-600">
                        @if (prop.allowHourlyBooking) {
                          <span class="px-2 py-0.5 rounded-md bg-slate-100">⏰ Thuê giờ</span>
                        }
                        @if (prop.allowOvernightBooking) {
                          <span class="px-2 py-0.5 rounded-md bg-slate-100">🌙 Qua đêm</span>
                        }
                        @if (prop.allowDailyBooking) {
                          <span class="px-2 py-0.5 rounded-md bg-slate-100">☀️ Theo ngày</span>
                        }
                      </div>

                      <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span class="text-[10px] text-slate-400 block">Giá khởi điểm từ</span>
                          <span class="text-base font-extrabold text-indigo-700">
                            {{ (prop.hourlyStartingPrice || prop.startingPrice || 160000) | number:'1.0-0' }} ₫
                          </span>
                        </div>

                        <a
                          [routerLink]="['/booking/properties', prop.slug]"
                          class="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                        >
                          Xem phòng →
                        </a>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

      </div>
    </div>
  `
})
export class DestinationExplorePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicBookingService = inject(PublicBookingService);

  readonly currentSlug = signal<string | null>(null);
  readonly touristZones = signal<TouristZoneDto[]>([]);
  readonly landmarks = signal<LandmarkDto[]>([]);
  readonly allProperties = signal<PublicPropertyDto[]>([]);

  readonly selectedRadiusMeters = signal<number | null>(null);
  readonly sortBy = signal<'distance' | 'price' | 'rating'>('distance');

  readonly activeTitle = computed<string>(() => {
    const slug = this.currentSlug();
    if (!slug) return 'Khám phá Địa danh';

    const lm = this.landmarks().find(l => l.slug === slug);
    if (lm) return lm.name;

    const z = this.touristZones().find(tz => tz.slug === slug);
    if (z) return z.name;

    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  });

  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    let list = [...this.allProperties()];
    const radius = this.selectedRadiusMeters();
    if (radius !== null) {
      list = list.filter(p => (p.distanceMeters ?? 999999) <= radius);
    }

    const sort = this.sortBy();
    if (sort === 'distance') {
      list.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    } else if (sort === 'price') {
      list.sort((a, b) => (a.startingPrice ?? 999999) - (b.startingPrice ?? 999999));
    } else if (sort === 'rating') {
      list.sort((a, b) => (b.starRating ?? 0) - (a.starRating ?? 0));
    }

    return list;
  });

  ngOnInit(): void {
    this.loadCatalog();

    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.currentSlug.set(slug);
      if (slug) {
        this.loadPropertiesForDestination(slug);
      }
    });
  }

  loadCatalog(): void {
    this.publicBookingService.getTouristZones().subscribe(zones => this.touristZones.set(zones));
    this.publicBookingService.getLandmarks().subscribe(lms => this.landmarks.set(lms));
  }

  loadPropertiesForDestination(slug: string): void {
    this.publicBookingService.getProperties({ destinationKeyword: slug }).subscribe(props => {
      this.allProperties.set(props);
    });
  }

  setRadius(meters: number | null): void {
    this.selectedRadiusMeters.set(meters);
  }

  getZoneImage(slug: string): string {
    const map: Record<string, string> = {
      'da-lat': 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=800',
      'vung-tau': 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800',
      'da-nang': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800',
      'hoi-an': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
      'phu-quoc': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
      'sa-pa': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      'ha-noi-pho-co': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
      'quan-1-tphcm': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800',
      'ha-long': 'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
      'phan-thiet-mui-ne': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
      'quy-nhon': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'
    };
    return map[slug] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800';
  }
}
