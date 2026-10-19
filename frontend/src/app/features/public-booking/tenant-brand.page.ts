import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { TenantBrandDto, PublicPropertyDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-tenant-brand',
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
            <a routerLink="/booking/brands" class="hover:text-indigo-600 transition-colors">Chuỗi thương hiệu</a>
            <span>/</span>
            <span class="text-slate-800 font-semibold truncate">{{ activeBrand()?.name || 'Chi nhánh chuỗi' }}</span>
          } @else {
            <span class="text-slate-800 font-semibold">Chuỗi thương hiệu &amp; Đa chi nhánh</span>
          }
        </nav>

        <!-- 2. NẾU KHÔNG CÓ SLUG: DANH SÁCH TẤT CẢ CÁC CHUỖI THƯƠNG HIỆU -->
        @if (!currentSlug()) {
          <div class="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-8 sm:p-12 shadow-md">
            <div class="relative z-10 max-w-2xl space-y-3">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500 text-white uppercase tracking-wider">
                Mô hình Multi-Property HQ
              </span>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Hệ thống Chuỗi Khách sạn &amp; Nhà nghỉ Toàn quốc
              </h1>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Khám phá các chuỗi thương hiệu lưu trú uy tín với mạng lưới chi nhánh rộng khắp, quy chuẩn dịch vụ đồng bộ và hỗ trợ đặt phòng linh hoạt theo giờ, qua đêm.
              </p>
            </div>
          </div>

          <!-- Danh sách thương hiệu -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (brand of brands(); track brand.tenantId) {
              <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between p-6 space-y-5">
                <div class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-xs">
                      {{ brand.name.charAt(0) }}
                    </div>
                    <div>
                      <h2 class="font-bold text-base text-slate-900 leading-snug">{{ brand.name }}</h2>
                      <span class="text-xs text-indigo-600 font-medium">{{ brand.totalProperties }} chi nhánh đang hoạt động</span>
                    </div>
                  </div>

                  <p class="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {{ brand.description }}
                  </p>

                  <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    <span class="text-[10px] font-semibold text-slate-400 block w-full mb-1">Khu vực có mặt:</span>
                    @for (prov of brand.provinces; track prov) {
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                        📍 {{ prov }}
                      </span>
                    }
                  </div>
                </div>

                <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs">
                    @if (brand.ratingAverage > 0 && brand.reviewCount > 0) {
                    <span class="font-extrabold text-slate-900">⭐ {{ brand.ratingAverage }}</span>
                    <span class="text-slate-400">({{ brand.reviewCount }} đánh giá)</span>
                    } @else {
                      <span class="text-slate-600">Chưa có đánh giá chuỗi</span>
                    }
                  </div>

                  <a
                    [routerLink]="['/booking/brands', brand.slug || brand.tenantId]"
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                  >
                    Xem {{ brand.totalProperties }} chi nhánh →
                  </a>
                </div>
              </div>
            }
          </div>
        }

        <!-- 3. NẾU CÓ SLUG: PROFILE CHUỖI & DANH SÁCH CHI NHÁNH -->
        @if (currentSlug() && activeBrand()) {
          <!-- HEADER PROFILE THƯƠNG HIỆU -->
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-3xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
                  {{ activeBrand()?.name?.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Chuỗi thương hiệu xác thực
                    </span>
                    @if ((activeBrand()?.ratingAverage ?? 0) > 0 && (activeBrand()?.reviewCount ?? 0) > 0) {
                    <span class="text-xs text-amber-500 font-bold flex items-center gap-1">
                      ★ {{ activeBrand()?.ratingAverage }} ({{ activeBrand()?.reviewCount }} đánh giá)
                    </span>
                    }
                  </div>
                  <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {{ activeBrand()?.name }}
                  </h1>
                  <p class="text-xs text-slate-500 mt-1">
                    {{ activeBrand()?.description }}
                  </p>
                </div>
              </div>

              <a routerLink="/booking/brands" class="text-xs text-indigo-600 hover:underline font-bold shrink-0">
                ← Chọn chuỗi khác
              </a>
            </div>

            <!-- BỘ LỌC TỈNH THÀNH / KHU VỰC CỦA CHUỖI -->
            <div class="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span class="text-xs font-bold text-slate-700 mr-2">Lọc theo Tỉnh/Thành:</span>
              <button
                type="button"
                (click)="selectedProvince.set(null)"
                class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                [class.bg-indigo-600]="selectedProvince() === null"
                [class.text-white]="selectedProvince() === null"
                [class.border-indigo-600]="selectedProvince() === null"
                [class.bg-white]="selectedProvince() !== null"
                [class.text-slate-700]="selectedProvince() !== null"
                [class.border-slate-200]="selectedProvince() !== null"
              >
                Tất cả ({{ activeBrand()?.totalProperties }})
              </button>

              @for (prov of activeBrand()?.provinces; track prov) {
                <button
                  type="button"
                  (click)="selectedProvince.set(prov)"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                  [class.bg-indigo-600]="selectedProvince() === prov"
                  [class.text-white]="selectedProvince() === prov"
                  [class.border-indigo-600]="selectedProvince() === prov"
                  [class.bg-white]="selectedProvince() !== prov"
                  [class.text-slate-700]="selectedProvince() !== prov"
                  [class.border-slate-200]="selectedProvince() !== prov"
                >
                  📍 {{ prov }}
                </button>
              }
            </div>
          </div>

          <!-- DANH SÁCH CHI NHÁNH THUỘC CHUỖI -->
          <div class="space-y-4">
            <h2 class="text-base font-bold text-slate-900">
              Danh sách chi nhánh thuộc chuỗi ({{ filteredProperties().length }} cơ sở):
            </h2>

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
                        {{ prop.propertyTypeName || 'Chi nhánh' }}
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
                        {{ prop.name }}
                      </h3>
                      <p class="text-xs text-slate-500 mt-1 line-clamp-1">
                        {{ prop.address }}, {{ prop.city }}
                      </p>
                    </div>

                    @if (prop.nearbyLandmarks && prop.nearbyLandmarks.length > 0) {
                      <div class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-1.5">
                        <span>📍</span>
                        <span class="truncate">Gần <b>{{ prop.nearbyLandmarks[0].landmarkName || prop.nearbyLandmarks[0].name }}</b> ({{ prop.nearbyLandmarks[0].distanceFormatted || formatDistance(prop.nearbyLandmarks[0].distanceMeters) }})</span>
                      </div>
                    }

                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span class="text-[10px] text-slate-400 block">Giá từ</span>
                        <span class="text-base font-extrabold text-indigo-700">
                          {{ (prop.hourlyStartingPrice || prop.startingPrice || 180000) | number:'1.0-0' }} ₫
                        </span>
                      </div>

                      <a
                        [routerLink]="['/booking/properties', prop.slug]"
                        class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                      >
                        Đặt phòng →
                      </a>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class TenantBrandPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicBookingService = inject(PublicBookingService);

  readonly currentSlug = signal<string | null>(null);
  readonly brands = signal<TenantBrandDto[]>([]);
  readonly selectedProvince = signal<string | null>(null);

  readonly activeBrand = computed<TenantBrandDto | null>(() => {
    const slug = this.currentSlug();
    if (!slug) return null;
    return this.brands().find(b => b.slug === slug || b.tenantId === slug) ?? null;
  });

  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const brand = this.activeBrand();
    if (!brand) return [];
    const prov = this.selectedProvince();
    if (!prov) return brand.properties;
    return brand.properties.filter(p => p.provinceName === prov || p.city === prov);
  });

  ngOnInit(): void {
    this.publicBookingService.getTenantBrands().subscribe(list => {
      this.brands.set(list);
    });

    this.route.paramMap.subscribe(params => {
      const slug = params.get('tenantSlug');
      this.currentSlug.set(slug);
    });
  }

  formatDistance(meters?: number): string {
    if (!meters || meters <= 0) return 'Gần đây';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}
