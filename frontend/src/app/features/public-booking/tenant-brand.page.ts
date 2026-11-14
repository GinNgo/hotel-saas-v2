import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PublicBookingService } from '../../core/services/public-booking.service';
import {
  PropertyType,
  PublicPropertyDto,
  TenantBrandDto,
} from '../../core/models/public-booking.model';

interface BrandPropertyTypeFilterOption {
  value: PropertyType | 'ALL';
  label: string;
}

@Component({
  selector: 'app-tenant-brand',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        <!-- 1. BREADCRUMB -->
        <nav class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span>/</span>
          @if (currentSlug()) {
            <a routerLink="/booking/brands" class="hover:text-indigo-600 transition-colors">Thương hiệu &amp; Đối tác</a>
            <span>/</span>
            <span class="text-slate-800 font-semibold truncate">{{ activeBrand()?.name || 'Hồ sơ đối tác' }}</span>
          } @else {
            <span class="text-slate-800 font-semibold">Thương hiệu &amp; Hệ thống lưu trú đối tác</span>
          }
        </nav>

        @if (isLoading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (skeleton of [1, 2, 3]; track skeleton) {
              <div class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 animate-pulse">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-slate-200"></div>
                  <div class="space-y-2 flex-1">
                    <div class="h-4 bg-slate-200 rounded w-2/3"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/3"></div>
                  </div>
                </div>
                <div class="h-12 bg-slate-200 rounded"></div>
                <div class="h-8 bg-slate-200 rounded w-1/2"></div>
              </div>
            }
          </div>
        } @else {
          <!-- 2. NẾU KHÔNG CÓ SLUG: DANH SÁCH THƯƠNG HIỆU & ĐỐI TÁC -->
          @if (!currentSlug()) {
            <div class="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-7 sm:p-10 shadow-md">
              <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div class="max-w-2xl space-y-3">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/90 text-white uppercase tracking-wider">
                    <i class="pi pi-verified text-xs"></i>
                    Hệ Sinh Thái Đối Tác Lưu Trú
                  </span>
                  <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">
                    Chuỗi Thương Hiệu &amp; Cơ Sở Đối Tác Toàn Quốc
                  </h1>
                  <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Khám phá các chuỗi khách sạn đa chi nhánh lẫn cơ sở lưu trú độc lập mới gia nhập — chuẩn hóa chất lượng vận hành PMS và hỗ trợ đặt phòng linh hoạt theo giờ, qua đêm hoặc theo ngày.
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-3 shrink-0">
                  <a
                    routerLink="/auth/partner-register"
                    class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-extrabold shadow-md transition-colors"
                  >
                    <i class="pi pi-plus-circle text-sm"></i>
                    <span>Đăng ký thương hiệu / cơ sở lưu trú mới</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Bộ lọc loại hình trên trang thương hiệu -->
            <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1.5">
                  <i class="pi pi-filter text-indigo-600 text-xs"></i>
                  Lọc theo loại hình:
                </span>
                @for (opt of propertyTypeFilterOptions(); track opt.value) {
                  <button
                    type="button"
                    (click)="selectedListPropertyType.set(opt.value)"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                    [class]="selectedListPropertyType() === opt.value
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'"
                  >
                    {{ opt.label }}
                  </button>
                }
              </div>
              <span class="text-xs text-slate-500 font-medium">
                Đang hiển thị <strong class="text-slate-900">{{ filteredBrands().length }}</strong> thương hiệu đối tác
              </span>
            </div>

            <!-- Danh sách thương hiệu -->
            @if (filteredBrands().length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (brand of filteredBrands(); track brand.slug || brand.tenantId) {
                  <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between p-6 space-y-5">
                    <div class="space-y-4">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-xs">
                          {{ brand.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                          <h2 class="font-bold text-base text-slate-900 leading-snug truncate">{{ brand.name }}</h2>
                          <div class="flex flex-wrap items-center gap-2 mt-0.5">
                            <span class="text-xs text-indigo-600 font-semibold">
                              {{ brand.totalProperties === 1 ? '1 cơ sở lưu trú' : brand.totalProperties + ' chi nhánh đang hoạt động' }}
                            </span>
                            @if (brand.totalProperties === 1) {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Đối tác độc lập
                              </span>
                            }
                          </div>
                        </div>
                      </div>

                      <p class="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {{ brand.description }}
                      </p>

                      @if (brand.propertyTypes && brand.propertyTypes.length > 0) {
                        <div class="flex flex-wrap gap-1.5">
                          @for (pt of brand.propertyTypes; track pt) {
                            <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold">
                              {{ getPropertyTypeLabel(pt) }}
                            </span>
                          }
                        </div>
                      }

                      @if (brand.provinces.length > 0) {
                        <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                          <span class="text-[10px] font-semibold text-slate-400 block w-full mb-1">Khu vực có mặt:</span>
                          @for (prov of brand.provinces; track prov) {
                            <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                              📍 {{ prov }}
                            </span>
                          }
                        </div>
                      }
                    </div>

                    <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-1.5 text-xs">
                        @if (brand.ratingAverage > 0) {
                          <span class="inline-flex items-center gap-1 font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <i class="pi pi-star-fill text-amber-500 text-[10px]"></i>
                            <span>{{ brand.ratingAverage | number:'1.1-1' }}</span>
                          </span>
                          @if (brand.reviewCount > 0) {
                            <span class="text-slate-500">({{ brand.reviewCount }} đánh giá)</span>
                          }
                        } @else {
                          <span class="text-slate-500 italic">Đối tác mới trên hệ thống</span>
                        }
                      </div>

                      <a
                        [routerLink]="['/booking/brands', brand.slug || brand.tenantId]"
                        class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
                      >
                        {{ brand.totalProperties === 1 ? 'Xem cơ sở →' : 'Xem ' + brand.totalProperties + ' chi nhánh →' }}
                      </a>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
                <i class="pi pi-building text-3xl text-slate-300"></i>
                <p class="text-sm font-semibold text-slate-700">Chưa có thương hiệu phù hợp với bộ lọc loại hình đang chọn.</p>
                <button
                  type="button"
                  (click)="selectedListPropertyType.set('ALL')"
                  class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Hiển thị tất cả thương hiệu
                </button>
              </div>
            }
          }

          <!-- 3. NẾU CÓ SLUG: PROFILE CHUỖI / ĐỐI TÁC & DANH SÁCH CƠ SỞ -->
          @if (currentSlug() && activeBrand()) {
            <!-- HEADER PROFILE THƯƠNG HIỆU -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div class="flex items-center gap-4">
                  <div class="w-16 h-16 rounded-3xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
                    {{ activeBrand()?.name?.charAt(0)?.toUpperCase() }}
                  </div>
                  <div>
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {{ (activeBrand()?.totalProperties ?? 0) === 1 ? 'Cơ sở đối tác xác thực' : 'Chuỗi thương hiệu xác thực' }}
                      </span>
                      @if ((activeBrand()?.ratingAverage ?? 0) > 0) {
                        <span class="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold flex items-center gap-1">
                          <i class="pi pi-star-fill text-amber-500 text-[10px]"></i>
                          <span>{{ activeBrand()?.ratingAverage | number:'1.1-1' }}</span>
                          @if ((activeBrand()?.reviewCount ?? 0) > 0) {
                            <span class="text-slate-500 font-medium">({{ activeBrand()?.reviewCount }} đánh giá)</span>
                          }
                        </span>
                      }
                      @for (pt of activeBrand()?.propertyTypes ?? []; track pt) {
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {{ getPropertyTypeLabel(pt) }}
                        </span>
                      }
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {{ activeBrand()?.name }}
                    </h1>
                    <p class="text-xs sm:text-sm text-slate-600 mt-1">
                      {{ activeBrand()?.description }}
                    </p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 shrink-0">
                  <a
                    routerLink="/auth/partner-register"
                    class="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors"
                  >
                    + Đăng ký đối tác mới
                  </a>
                  <a routerLink="/booking/brands" class="text-xs text-indigo-600 hover:underline font-bold">
                    ← Danh sách thương hiệu
                  </a>
                </div>
              </div>

              <!-- BỘ LỌC TỈNH THÀNH & LOẠI HÌNH -->
              <div class="pt-4 border-t border-slate-100 space-y-3">
                @if ((activeBrand()?.provinces?.length ?? 0) > 0) {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-slate-700 mr-2">Lọc theo Tỉnh/Thành:</span>
                    <button
                      type="button"
                      (click)="selectedProvince.set(null)"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                      [class]="selectedProvince() === null
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'"
                    >
                      Tất cả ({{ activeBrand()?.totalProperties }})
                    </button>

                    @for (prov of activeBrand()?.provinces ?? []; track prov) {
                      <button
                        type="button"
                        (click)="selectedProvince.set(prov)"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                        [class]="selectedProvince() === prov
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'"
                      >
                        📍 {{ prov }}
                      </button>
                    }
                  </div>
                }

                @if ((activeBrand()?.propertyTypes?.length ?? 0) > 1) {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-slate-700 mr-2">Loại hình lưu trú:</span>
                    <button
                      type="button"
                      (click)="selectedDetailPropertyType.set('ALL')"
                      class="px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                      [class]="selectedDetailPropertyType() === 'ALL'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'"
                    >
                      Tất cả loại hình
                    </button>
                    @for (pt of activeBrand()?.propertyTypes ?? []; track pt) {
                      <button
                        type="button"
                        (click)="selectedDetailPropertyType.set(pt)"
                        class="px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                        [class]="selectedDetailPropertyType() === pt
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200'"
                      >
                        {{ getPropertyTypeLabel(pt) }}
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- DANH SÁCH CƠ SỞ THUỘC THƯƠNG HIỆU -->
            <div class="space-y-4">
              <h2 class="text-base font-bold text-slate-900">
                Danh sách cơ sở thuộc thương hiệu ({{ filteredProperties().length }} cơ sở):
              </h2>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (prop of filteredProperties(); track prop.propertyId || prop.id || prop.slug) {
                  <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
                    <div class="h-48 overflow-hidden relative bg-slate-100">
                      <img
                        [src]="prop.thumbnailUrl || prop.imageUrl || '/images/danang-ocean-suites.png'"
                        [alt]="prop.name"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white">
                          {{ prop.propertyTypeName || getPropertyTypeLabel(prop.propertyType) }}
                        </span>
                        @if (prop.touristZoneName) {
                          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600/90 text-white">
                            {{ prop.touristZoneName }}
                          </span>
                        }
                      </div>
                    </div>

                    <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 class="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors line-clamp-1">
                          <a [routerLink]="['/booking/properties', prop.slug]">{{ prop.name }}</a>
                        </h3>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-1">
                          {{ formatPropertyAddress(prop) }}
                        </p>
                      </div>

                      @if (prop.nearbyLandmarks && prop.nearbyLandmarks.length > 0) {
                        <div class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-1.5">
                          <span>📍</span>
                          <span class="truncate">Gần <b>{{ prop.nearbyLandmarks[0].landmarkName || prop.nearbyLandmarks[0].name }}</b> ({{ prop.nearbyLandmarks[0].distanceFormatted || formatDistance(prop.nearbyLandmarks[0].distanceMeters) }})</span>
                        </div>
                      }

                      <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div>
                          <span class="text-[10px] text-slate-400 block">Giá từ</span>
                          @if (getStartingPrice(prop) > 0) {
                            <span class="text-base font-extrabold text-indigo-700">
                              {{ getStartingPrice(prop) | number:'1.0-0' }} ₫
                            </span>
                          } @else {
                            <span class="text-xs text-slate-500 italic">Liên hệ xem phòng</span>
                          }
                        </div>

                        <a
                          [routerLink]="['/booking/properties', prop.slug]"
                          class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
                        >
                          Đặt phòng →
                        </a>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else if (currentSlug() && !activeBrand()) {
            <div class="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
              <i class="pi pi-exclamation-circle text-3xl text-amber-500"></i>
              <h2 class="text-base font-bold text-slate-900">Không tìm thấy thông tin thương hiệu</h2>
              <p class="text-xs text-slate-500">Thương hiệu bạn đang tìm có thể đã đổi tên hoặc chưa có cơ sở hoạt động công khai.</p>
              <a
                routerLink="/booking/brands"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                ← Quay lại danh sách thương hiệu
              </a>
            </div>
          }
        }

      </div>
    </div>
  `,
})
export class TenantBrandPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicBookingService = inject(PublicBookingService);

  readonly isLoading = signal<boolean>(true);
  readonly currentSlug = signal<string | null>(null);
  readonly brands = signal<TenantBrandDto[]>([]);
  readonly selectedProvince = signal<string | null>(null);
  readonly selectedListPropertyType = signal<PropertyType | 'ALL'>('ALL');
  readonly selectedDetailPropertyType = signal<PropertyType | 'ALL'>('ALL');

  readonly propertyTypeFilterOptions = computed<BrandPropertyTypeFilterOption[]>(() => {
    const presentTypes = new Set<PropertyType>();
    for (const brand of this.brands()) {
      for (const pt of brand.propertyTypes ?? []) {
        presentTypes.add(pt);
      }
    }
    const ordered: PropertyType[] = [
      'Hotel',
      'Resort',
      'Homestay',
      'Villa',
      'Apartment',
      'Motel',
      'Hostel',
      'BedAndBreakfast',
      'Guesthouse',
    ];
    return [
      { value: 'ALL', label: 'Tất cả' },
      ...ordered
        .filter(type => presentTypes.has(type))
        .map(type => ({ value: type, label: this.getPropertyTypeLabel(type) })),
    ];
  });

  readonly filteredBrands = computed<TenantBrandDto[]>(() => {
    const selectedType = this.selectedListPropertyType();
    if (selectedType === 'ALL') return this.brands();
    return this.brands().filter(brand => (brand.propertyTypes ?? []).includes(selectedType));
  });

  readonly activeBrand = computed<TenantBrandDto | null>(() => {
    const slug = this.currentSlug();
    if (!slug) return null;
    return this.brands().find(b => b.slug === slug || b.tenantId === slug) ?? null;
  });

  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const brand = this.activeBrand();
    if (!brand) return [];
    const prov = this.selectedProvince();
    const pt = this.selectedDetailPropertyType();
    return brand.properties.filter(p => {
      if (prov && p.provinceName !== prov && p.city !== prov) return false;
      if (pt !== 'ALL' && p.propertyType !== pt) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.publicBookingService
      .getTenantBrands()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.brands.set(list);
          this.isLoading.set(false);
        },
        error: () => {
          this.brands.set([]);
          this.isLoading.set(false);
        },
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('tenantSlug');
        this.currentSlug.set(slug);
        this.selectedProvince.set(null);
        this.selectedDetailPropertyType.set('ALL');
      });
  }

  getPropertyTypeLabel(type: PropertyType): string {
    switch (type) {
      case 'Hotel':
        return 'Khách sạn';
      case 'Resort':
        return 'Resort';
      case 'Homestay':
        return 'Homestay';
      case 'Villa':
        return 'Biệt thự (Villa)';
      case 'Apartment':
        return 'Căn hộ dịch vụ';
      case 'Motel':
        return 'Nhà nghỉ / Motel';
      case 'Guesthouse':
        return 'Nhà khách';
      case 'Hostel':
        return 'Hostel';
      case 'BedAndBreakfast':
        return 'Bed & Breakfast';
      default:
        return 'Cơ sở lưu trú';
    }
  }

  getStartingPrice(prop: PublicPropertyDto): number {
    return (
      prop.startingPriceForSelectedMode ||
      prop.dailyStartingPrice ||
      prop.overnightStartingPrice ||
      prop.hourlyStartingPrice ||
      prop.startingPrice ||
      0
    );
  }

  formatPropertyAddress(prop: PublicPropertyDto): string {
    return (
      [prop.addressLine || prop.address, prop.wardName, prop.provinceName || prop.city]
        .filter(Boolean)
        .join(', ') || 'Chưa công bố địa chỉ'
    );
  }

  formatDistance(meters?: number): string {
    if (!meters || meters <= 0) return 'Gần đây';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}
