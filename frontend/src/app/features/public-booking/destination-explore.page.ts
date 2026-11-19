import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { PublicBookingService } from '../../core/services/public-booking.service';
import {
  TouristZoneDto,
  LandmarkDto,
  PublicPropertyDto,
  PublicPropertiesFilter
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
                  <div class="h-40 overflow-hidden relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 flex flex-col justify-between p-4">
                    <div class="flex items-center justify-between">
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/15">
                        {{ zone.provinceName || 'Điểm đến' }}
                      </span>
                      <i class="pi pi-compass text-indigo-300/80 text-lg"></i>
                    </div>
                    <div>
                      <span class="text-white font-extrabold text-base block leading-snug">{{ zone.name }}</span>
                      @if (zone.landmarksCount) {
                        <span class="text-[11px] text-indigo-200/80 mt-0.5 block">{{ zone.landmarksCount }} địa danh nổi bật</span>
                      }
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

            @if (isLoading()) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (item of [1, 2, 3]; track item) {
                  <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs animate-pulse">
                    <div class="h-48 bg-slate-200"></div>
                    <div class="p-5 space-y-3">
                      <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                }
              </div>
            } @else if (filteredProperties().length === 0) {
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
                @for (prop of filteredProperties(); track (prop.propertyId || prop.id || prop.slug)) {
                  <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
                    <div class="h-48 overflow-hidden relative bg-slate-100">
                      @if (prop.thumbnailUrl || prop.imageUrl) {
                        <img
                          [src]="prop.thumbnailUrl || prop.imageUrl"
                          [alt]="prop.name"
                          class="w-full h-full object-cover"
                        />
                      } @else {
                        <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                          <i class="pi pi-building text-3xl mb-1.5"></i>
                          <span class="text-xs font-medium text-slate-500">Chưa có ảnh đại diện</span>
                        </div>
                      }
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
                          {{ prop.address || prop.addressLine }}, {{ prop.city || prop.provinceName }}
                        </p>
                        <div class="mt-2 flex items-center gap-1.5 text-xs">
                          @if (prop.reviewCount && prop.reviewCount > 0 && prop.ratingAverage > 0) {
                            <span class="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <i class="pi pi-star-fill text-amber-500 text-[10px]"></i>
                              <span>{{ prop.ratingAverage.toFixed(1) }}</span>
                            </span>
                            <span class="text-slate-500">({{ prop.reviewCount }} đánh giá)</span>
                          } @else {
                            <span class="text-slate-500 italic">Chưa có đánh giá</span>
                          }
                        </div>
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
                          @if ((prop.hourlyStartingPrice || prop.startingPriceForSelectedMode || prop.startingPrice || 0) > 0) {
                            <span class="text-base font-extrabold text-indigo-700">
                              {{ (prop.hourlyStartingPrice || prop.startingPriceForSelectedMode || prop.startingPrice) | number:'1.0-0' }} ₫
                            </span>
                          } @else {
                            <span class="text-xs font-semibold text-slate-500">Liên hệ báo giá</span>
                          }
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
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSlug = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly touristZones = signal<TouristZoneDto[]>([]);
  readonly landmarks = signal<LandmarkDto[]>([]);
  readonly allProperties = signal<PublicPropertyDto[]>([]);

  readonly selectedRadiusMeters = signal<number | null>(null);
  readonly sortBy = signal<'distance' | 'price_asc' | 'rating'>('distance');

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
    } else if (sort === 'price_asc') {
      list.sort(
        (a, b) =>
          (a.startingPriceForSelectedMode || a.startingPrice || 999999999) -
          (b.startingPriceForSelectedMode || b.startingPrice || 999999999)
      );
    } else if (sort === 'rating') {
      list.sort((a, b) => (b.ratingAverage || b.starRating || 0) - (a.ratingAverage || a.starRating || 0));
    }

    return list;
  });

  ngOnInit(): void {
    const catalog$ = forkJoin({
      zones: this.publicBookingService.getTouristZones().pipe(catchError(() => of([] as TouristZoneDto[]))),
      landmarks: this.publicBookingService.getLandmarks().pipe(catchError(() => of([] as LandmarkDto[]))),
    }).pipe(
      tap(({ zones, landmarks }) => {
        this.touristZones.set(zones);
        this.landmarks.set(landmarks);
      })
    );

    combineLatest([catalog$, this.route.paramMap])
      .pipe(
        switchMap(([{ zones, landmarks }, params]) => {
          const slug = params.get('slug');
          this.currentSlug.set(slug);
          if (!slug) {
            this.allProperties.set([]);
            this.isLoading.set(false);
            return of(null);
          }

          this.isLoading.set(true);
          const filter: PublicPropertiesFilter = zones.some(z => z.slug === slug)
            ? { touristZoneSlug: slug }
            : landmarks.some(l => l.slug === slug)
              ? { landmarkSlug: slug }
              : { destinationKeyword: slug };

          return this.publicBookingService
            .getProperties(filter)
            .pipe(catchError(() => of([] as PublicPropertyDto[])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((props) => {
        if (props !== null) {
          this.allProperties.set(props);
          this.isLoading.set(false);
        }
      });
  }

  setRadius(meters: number | null): void {
    this.selectedRadiusMeters.set(meters);
  }

}
