import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { readPublicStay } from '../../core/models/public-stay-context';
import { resolvePropertyThumbnail } from '../../core/utils/hotel-image.util';
import {
  buildDefaultDestinationSuggestions,
  mergeLiveDestinationCatalog,
} from '../../core/utils/destination-suggestions.util';
import { BookingFilterBarComponent } from './components/booking-filter-bar/booking-filter-bar.component';
import { PopularDestinationsComponent } from './components/popular-destinations/popular-destinations.component';
import { FlashDealsBannerComponent } from './components/flash-deals-banner/flash-deals-banner.component';
import { TrustPillarsComponent } from './components/trust-pillars/trust-pillars.component';
import { CuratedBentoGridComponent } from './components/curated-bento-grid/curated-bento-grid.component';
import { HotelierCtaBannerComponent } from './components/hotelier-cta-banner/hotelier-cta-banner.component';
import {
  ALL_PROPERTY_TYPES,
  BookingSortOption,
  DestinationSuggestionDto,
  LandmarkDto,
  NearbyLandmarkBadgeDto,
  PropertyType,
  PublicBookingSearchFilter,
  PublicPropertyDto,
  PublicRoomTypeAvailabilityDto,
  RentalType,
  SuggestedFilterChipDto,
  TouristZoneDto,
} from '../../core/models/public-booking.model';
import { PublicBookingService } from '../../core/services/public-booking.service';
import {
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PaginationComponent,
  PhotoGalleryModalComponent,
  RoomDetailModalComponent,
  StatusBadgeComponent,
  GalleryPhotoItem,
} from '../../shared';

interface TenantBrandFacet {
  tenantId: string;
  tenantBrandName: string;
  tenantSlug?: string;
  branchCount: number;
}

interface PropertyTypeTabOption {
  key: PropertyType | 'ALL';
  label: string;
  icon: string;
  matchTypes: readonly PropertyType[];
}

interface RawBookingLandmarkInput {
  landmarkId?: string;
  landmarkName?: string;
  name?: string;
  landmarkSlug?: string;
  slug?: string;
  category?: NearbyLandmarkBadgeDto['category'];
  distanceMeters?: number;
  distanceKm?: number;
}

interface RawBookingRoomTypeInput extends Partial<PublicRoomTypeAvailabilityDto> {
  id?: string;
}

interface RawBookingPropertyInput extends Omit<Partial<PublicPropertyDto>, 'propertyType' | 'nearbyLandmarks' | 'availableRoomTypes'> {
  propertyType?: PropertyType | number | string;
  nearbyLandmarks?: RawBookingLandmarkInput[];
  availableRoomTypes?: RawBookingRoomTypeInput[];
  bufferMinutes?: number;
}

@Component({
  selector: 'app-booking-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BookingFilterBarComponent,
    PopularDestinationsComponent,
    FlashDealsBannerComponent,
    TrustPillarsComponent,
    CuratedBentoGridComponent,
    HotelierCtaBannerComponent,
    PhotoGalleryModalComponent,
    RoomDetailModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen overflow-x-clip bg-[var(--surface-canvas)] pb-24 font-sans text-stone-900">
      <!-- 1. HERO BANNER & THANH TÌM KIẾM ĐA NĂNG (SEAMLESS LIGHT CONTEMPORARY LUXURY) -->
      <section
        class="bg-gradient-to-b from-white via-slate-50/90 to-stone-100/60 dark:from-[#0E1715] dark:via-[#12201D] dark:to-[#0B1412] text-slate-900 dark:text-[var(--text-primary)] pt-8 sm:pt-12 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-b border-slate-200/80 dark:border-[var(--border-subtle)]"
      >
        <!-- Subtle ambient radial warm glow -->
        <div class="absolute top-0 right-1/4 w-[500px] h-[350px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div class="absolute bottom-0 left-10 w-[350px] h-[250px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div class="max-w-7xl mx-auto relative z-10">
          <!-- 2-COLUMN HERO HEADER & VISUAL SHOWCASE -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center mb-10">
            
            <!-- LEFT COLUMN: EDITORIAL HEADLINE & DESTINATION PILLS -->
            <div class="lg:col-span-7 min-w-0 space-y-4">
              <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold tracking-wide shadow-2xs">
                <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-primary)]"></span>
                <span>Nền Tảng Đặt Phòng &amp; Nghỉ Dưỡng Di Sản Việt Nam</span>
              </div>

              <div>
                <h1 class="font-display text-3xl sm:text-5xl lg:text-[52px] font-bold text-slate-950 tracking-tight leading-[1.12]">
                  Khám Phá Kỳ Nghỉ Tinh Hoa Giữa Lòng <span class="italic text-[var(--brand-primary)] font-display">Di Sản Việt Nam</span>
                </h1>
              </div>

              <p class="text-sm sm:text-base text-slate-600 max-w-xl font-sans leading-relaxed">
                Khám phá khách sạn, homestay, villa và resort tại 34 tỉnh thành Việt Nam. Minh bạch phòng trống thực tế và hỗ trợ giữ phòng trực tuyến.
              </p>

              <!-- Quick Category Tags -->
              <div class="pt-1 flex flex-wrap items-center gap-2 text-xs">
                <span class="text-slate-500 text-xs font-semibold mr-1">Gợi ý điểm đến:</span>
                <button
                  type="button"
                  (click)="selectCategoryQuickTag('Đà Lạt')"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold transition-all border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i class="pi pi-sun text-[11px] text-[var(--brand-primary)]"></i>
                  <span>Đà Lạt Săn Mây</span>
                </button>
                <button
                  type="button"
                  (click)="selectCategoryQuickTag('Phú Quốc')"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold transition-all border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i class="pi pi-compass text-[11px] text-[var(--brand-primary)]"></i>
                  <span>Đảo Ngọc Phú Quốc</span>
                </button>
                <button
                  type="button"
                  (click)="selectCategoryQuickTag('Đà Nẵng')"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold transition-all border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i class="pi pi-map-marker text-[11px] text-[var(--brand-primary)]"></i>
                  <span>Đà Nẵng Biển Mỹ Khê</span>
                </button>
                <button
                  type="button"
                  (click)="selectCategoryQuickTag('Vũng Tàu')"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold transition-all border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i class="pi pi-sun text-[11px] text-[var(--brand-primary)]"></i>
                  <span>Vũng Tàu Bãi Sau</span>
                </button>
                <button
                  type="button"
                  (click)="selectCategoryQuickTag('Hà Nội')"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold transition-all border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i class="pi pi-building text-[11px] text-[var(--brand-primary)]"></i>
                  <span>Hà Nội Phố Cổ</span>
                </button>
              </div>

              <!-- Quick Trust Indicators Strip -->
              <div class="pt-3 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 font-medium border-t border-slate-200/80">
                <span class="flex items-center gap-1.5 text-slate-700">
                  <i class="pi pi-clock text-[var(--brand-primary)] text-xs"></i>
                  <span>Giữ phòng tạm thời 15 phút</span>
                </span>
                <span class="flex items-center gap-1.5 text-slate-700">
                  <i class="pi pi-check-circle text-[var(--brand-primary)] text-xs"></i>
                  <span>Kiểm tra phòng trống trực tiếp</span>
                </span>
                <span class="flex items-center gap-1.5 text-slate-700">
                  <i class="pi pi-shield text-[var(--brand-primary)] text-xs"></i>
                  <span>Xem trước chính sách hủy rõ ràng</span>
                </span>
              </div>
            </div>

            <!-- RIGHT COLUMN: LIVE FEATURED PROPERTY SHOWCASE CARD (NO HARDCODED MOCK DATA) -->
            <div class="lg:col-span-5 hidden lg:block">
              <div class="relative group">
                <div class="absolute -inset-1 bg-gradient-to-r from-amber-500/15 via-slate-400/10 to-indigo-500/15 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition duration-500 pointer-events-none"></div>

                @if (featuredProperty(); as heroProp) {
                  <div class="relative bg-white rounded-3xl border border-slate-200/90 p-3.5 shadow-xl overflow-hidden transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-2xl">
                    <div class="relative h-[270px] rounded-2xl overflow-hidden bg-slate-900">
                      @if (heroProp.thumbnailUrl) {
                        <img
                          [src]="heroProp.thumbnailUrl"
                          [alt]="heroProp.name"
                          width="560"
                          height="270"
                          fetchpriority="high"
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"></div>
                      } @else {
                        <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 text-white/80 gap-2 pb-16">
                          <i class="pi pi-building text-4xl text-slate-200"></i>
                          <span class="text-xs font-semibold text-slate-200">
                            {{ heroProp.propertyTypeName || getPropertyTypeLabel(heroProp.propertyType) }}
                          </span>
                        </div>
                      }

                      <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs text-slate-800 text-[11px] font-semibold shadow-xs">
                          <i class="pi pi-building text-[var(--brand-primary)] text-[10px]"></i>
                          <span>{{ heroProp.tenantBrandName || 'Cơ sở lưu trú' }}</span>
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-semibold shadow-xs">
                          <span>{{ heroProp.propertyTypeName || getPropertyTypeLabel(heroProp.propertyType) }}</span>
                        </span>
                      </div>

                      <div class="absolute bottom-3 left-3 right-3 text-white space-y-1">
                        <div class="text-[11px] font-semibold text-slate-200 tracking-wider flex items-center gap-1">
                          <i class="pi pi-map-marker text-[10px]"></i>
                          <span>{{ heroProp.provinceName || heroProp.city || 'Việt Nam' }}</span>
                        </div>
                        <h3 class="font-display text-lg font-bold text-white tracking-tight leading-snug line-clamp-1">
                          {{ heroProp.name }}
                        </h3>
                        <div class="flex items-center justify-between pt-1">
                          <div class="text-xs text-slate-200">
                            @if (heroProp.startingPriceForSelectedMode > 0) {
                              <span>Giá từ: </span>
                              <span class="font-sans font-bold text-white text-base tabular-nums">
                                {{ heroProp.startingPriceForSelectedMode | number:'1.0-0' }} ₫
                              </span>
                            } @else {
                              <span class="text-slate-300 italic">Liên hệ báo giá</span>
                            }
                          </div>
                          <a
                            [routerLink]="['/booking/properties', heroProp.slug]"
                            [queryParams]="searchFilter()"
                            class="min-h-11 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <span>Xem phòng</span>
                            <i class="pi pi-arrow-right text-[10px]"></i>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div class="px-2 pt-3 pb-1 flex items-center justify-between text-xs text-slate-600">
                      @if (heroProp.reviewCount > 0 && heroProp.ratingAverage > 0) {
                        <div class="flex items-center gap-2">
                          <div class="flex items-center text-amber-500 text-xs">
                            @for (star of [1, 2, 3, 4, 5]; track star) {
                              <i class="pi" [class.pi-star-fill]="star <= Math.round(heroProp.ratingAverage)" [class.pi-star]="star > Math.round(heroProp.ratingAverage)"></i>
                            }
                          </div>
                          <span class="font-bold text-slate-900">{{ heroProp.ratingAverage | number:'1.1-1' }}/5</span>
                          <span class="text-slate-500 text-[11px]">({{ heroProp.reviewCount }} đánh giá thực tế)</span>
                        </div>
                      } @else {
                        <span class="text-slate-500 text-[11px] font-medium">Chưa có đánh giá</span>
                      }
                      <span class="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                        <i class="pi pi-check-circle text-[10px]"></i> Đặt giữ chỗ trực tiếp
                      </span>
                    </div>
                  </div>
                } @else {
                  <div class="relative bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xl overflow-hidden space-y-4">
                    <div class="h-[220px] rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-800 p-6 flex flex-col justify-between text-white">
                      <span class="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-200 text-[11px] font-bold">
                        <i class="pi pi-map-marker text-[10px]"></i>
                        <span>34 Tỉnh Thành Việt Nam</span>
                      </span>
                      <div class="space-y-1.5">
                        <h3 class="font-display text-xl font-bold text-white">Hệ Thống Đặt Phòng Trực Tuyến</h3>
                        <p class="text-xs text-slate-300 leading-relaxed">
                          Dữ liệu cơ sở lưu trú, giá phòng và lịch trống được đồng bộ trực tiếp từ hệ thống quản lý PMS.
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-slate-600">
                      <span>Hỗ trợ thuê theo giờ, qua đêm &amp; theo ngày</span>
                      <a routerLink="/booking/explore" class="min-h-11 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800">
                        <span>Khám phá</span>
                        <i class="pi pi-arrow-right text-[10px]"></i>
                      </a>
                    </div>
                  </div>
                }
              </div>
            </div>

          </div>

          <!-- Component Thanh Tìm Kiếm -->
          <app-booking-filter-bar
            [initialFilter]="searchFilter()"
            [suggestions]="destinationSuggestions()"
            [autoEmitOnToggle]="false"
            (draftFilterChange)="onFilterDraftChange($event)"
            (filterChange)="onFilterBarChange($event)"
          />
        </div>
      </section>

      <!-- 2. NỘI DUNG CHÍNH (STREAMLINED & CUSTOMER FOCUS) -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-14">

        <!-- SECTION 1: BỘ SƯU TẬP CƠ SỞ NGHỈ DƯỠNG NỔI BẬT (FOCUS CHÍNH CỦA KHÁCH HÀNG) -->
        <section id="featuredAccommodationsSection" aria-label="Khách sạn và khu nghỉ dưỡng nổi bật">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  <i class="pi pi-crown text-[10px] text-[var(--brand-primary)]"></i>
                  Lựa Chọn Hàng Đầu
                </span>
                <span class="text-xs text-slate-500 font-medium">
                  @if (properties().length > 0) {
                    <span class="tabular-nums">{{ properties().length }}</span> cơ sở lưu trú đã kiểm định phòng trống
                  } @else {
                    Cơ sở lưu trú toàn quốc đã kiểm định phòng trống
                  }
                </span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-display">
                Khu Nghỉ Dưỡng &amp; Khách Sạn Nổi Bật
              </h2>
              <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Khám phá đa dạng loại hình lưu trú từ Khách sạn, Resort, Homestay đến Villa, Căn hộ dịch vụ và Nhà nghỉ với chính sách giữ phòng tức thì 15 phút.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <a
                routerLink="/auth/partner-register"
                class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <i class="pi pi-plus-circle text-[11px] text-[var(--brand-primary)]"></i>
                <span>Đăng ký đối tác lưu trú mới</span>
              </a>
              <a
                routerLink="/booking/explore"
                [queryParams]="detailQueryParams()"
                class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span>Xem tất cả trên bộ lọc &amp; bản đồ</span>
                <i class="pi pi-arrow-right text-[10px]"></i>
              </a>
            </div>
          </div>

          <!-- Interactive Filter Tabs: Loại hình lưu trú -->
          <div class="mb-5" role="tablist" aria-label="Lọc theo loại hình lưu trú">
            <div class="flex items-center justify-between gap-2 mb-2.5">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <i class="pi pi-building text-[var(--brand-primary)] text-xs"></i>
                Loại hình lưu trú
              </span>
              @if (selectedPropertyType() !== 'ALL' || selectedTenantId() || searchFilter().propertyTypes.length > 0) {
                <button
                  type="button"
                  (click)="resetSidebarFilters()"
                  class="min-h-11 text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer px-2"
                >
                  Đặt lại bộ lọc
                </button>
              }
            </div>
            <div class="flex flex-wrap gap-2">
              @for (tab of propertyTypeTabs; track tab.key) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="isPropertyTypeTabActive(tab)"
                  (click)="selectPropertyTypeTab(tab.key)"
                  class="min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                  [class]="isPropertyTypeTabActive(tab)
                    ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
                >
                  <i [class]="'pi ' + tab.icon + ' text-[11px]'"></i>
                  <span>{{ tab.label }}</span>
                  <span
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                    [class]="isPropertyTypeTabActive(tab) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ getPropertyTypeTabCount(tab) }}
                  </span>
                </button>
              }
            </div>
          </div>

          <!-- Chuỗi Thương Hiệu & Hệ Thống Đối Tác -->
          @if (tenantBrandFacets().length > 0) {
            <div class="mb-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
              <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-lg bg-slate-100 text-[var(--brand-primary)] flex items-center justify-center">
                    <i class="pi pi-verified text-xs"></i>
                  </span>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">Chuỗi Thương Hiệu &amp; Hệ Thống Đối Tác</h3>
                    <p class="text-[11px] text-slate-500">Chọn hệ thống khách sạn, homestay hoặc đối tác vận hành để lọc nhanh các cơ sở trực thuộc</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <a
                    routerLink="/booking/brands"
                    class="min-h-11 text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Khám phá {{ tenantBrandFacets().length }} thương hiệu</span>
                    <i class="pi pi-arrow-right text-[10px]"></i>
                  </a>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  (click)="filterByTenantBrandInline(null)"
                  class="min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                  [class]="!selectedTenantId() && !searchFilter().tenantSlug
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'"
                >
                  Tất cả hệ thống ({{ properties().length }})
                </button>

                @for (brand of tenantBrandFacets(); track brand.tenantId) {
                  <div class="inline-flex items-center rounded-xl border overflow-hidden transition-all"
                    [class]="isBrandFacetActive(brand)
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'"
                  >
                    <button
                      type="button"
                      (click)="filterByTenantBrandInline(brand)"
                      class="min-h-11 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{{ brand.tenantBrandName }}</span>
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
                        [class]="isBrandFacetActive(brand) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'"
                      >
                        {{ brand.branchCount }} cơ sở
                      </span>
                    </button>
                    <a
                      [routerLink]="['/booking/brands', brand.tenantSlug || brand.tenantId]"
                      class="min-h-11 min-w-11 flex items-center justify-center px-2 py-1.5 border-l text-[10px] font-bold opacity-80 hover:opacity-100"
                      [class]="isBrandFacetActive(brand) ? 'border-white/20 text-white' : 'border-slate-200 text-[var(--brand-primary)] hover:bg-slate-50'"
                      [attr.aria-label]="'Xem hồ sơ thương hiệu ' + brand.tenantBrandName"
                      [title]="'Xem hồ sơ thương hiệu ' + brand.tenantBrandName"
                    >
                      <i class="pi pi-external-link text-[10px]"></i>
                    </a>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Grid các thẻ khách sạn nổi bật -->
          @if (isLoading()) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (item of [1, 2, 3, 4, 5, 6]; track item) {
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs animate-pulse motion-reduce:animate-none">
                  <div class="h-48 bg-slate-200"></div>
                  <div class="p-5 space-y-3">
                    <div class="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div class="h-6 bg-slate-200 rounded w-3/4"></div>
                    <div class="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div class="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <div class="h-5 bg-slate-200 rounded w-1/3"></div>
                      <div class="h-8 bg-slate-200 rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else if (filteredProperties().length > 0) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (property of filteredProperties().slice(0, visibleCount()); track property.propertyId) {
                <article
                  class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col group"
                >
                  <!-- Ảnh Thumbnail & Huy hiệu -->
                  <div class="relative h-52 w-full overflow-hidden bg-slate-100">
                    @if (property.thumbnailUrl) {
                      <img
                        [src]="property.thumbnailUrl"
                        [alt]="property.name"
                        width="400"
                        height="208"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none"></div>
                    } @else {
                      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-stone-200 text-slate-400 gap-1.5">
                        <i class="pi pi-building text-3xl text-slate-400"></i>
                        <span class="text-[11px] font-semibold text-slate-500">Chưa có ảnh cơ sở</span>
                      </div>
                    }

                    <!-- Top Badges -->
                    <div class="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-slate-800 border border-slate-200/80 backdrop-blur-xs shadow-2xs">
                        {{ property.propertyTypeName || getPropertyTypeLabel(property.propertyType) }}
                      </span>
                      @if (property.starRating && property.starRating >= 4) {
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 text-slate-900 border border-slate-200/80 flex items-center gap-1 shadow-2xs tabular-nums">
                          <i class="pi pi-star-fill text-[10px] text-amber-500"></i>
                          <span>{{ property.starRating }} sao</span>
                        </span>
                      }
                    </div>

                    <!-- Nút mở album ảnh -->
                    @if (property.galleryUrls?.length || property.thumbnailUrl) {
                      <button
                        type="button"
                        (click)="openPhotoGallery(property)"
                        class="min-h-11 absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Xem toàn bộ album ảnh"
                      >
                        <i class="pi pi-images text-xs"></i>
                        <span>Xem ảnh</span>
                      </button>
                    }
                  </div>

                  <!-- Nội dung Thẻ Khách Sạn -->
                  <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                          {{ property.tenantBrandName }}
                        </span>
                        @if (property.reviewCount > 0 && property.ratingAverage > 0) {
                          <span class="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0 tabular-nums">
                            <i class="pi pi-star-fill text-amber-500 text-[10px]"></i>
                            <span>{{ property.ratingAverage | number:'1.1-1' }}</span>
                            <span class="text-[10px] text-slate-500">({{ property.reviewCount }})</span>
                          </span>
                        } @else {
                          <span class="text-[11px] text-slate-400 font-medium shrink-0">Chưa có đánh giá</span>
                        }
                      </div>

                      <h3 class="font-display text-lg font-bold text-slate-900 group-hover:text-[var(--brand-primary)] transition-colors line-clamp-1">
                        <a [routerLink]="['/booking/properties', property.slug]" [queryParams]="searchFilter()">
                          {{ property.name }}
                        </a>
                      </h3>

                      <p class="text-xs text-slate-500 flex items-center gap-1.5 line-clamp-1">
                        <i class="pi pi-map-marker text-slate-400 text-xs shrink-0"></i>
                        <span>{{ getPropertyAddress(property) }}</span>
                      </p>
                    </div>

                    <!-- Chân thẻ: Giá & Nút Đặt Phòng -->
                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <span class="text-[10px] text-slate-500 block uppercase font-medium">Giá chỉ từ</span>
                        @if (property.startingPriceForSelectedMode > 0) {
                          <div class="flex items-baseline gap-1">
                            <span class="font-sans text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                              {{ property.startingPriceForSelectedMode | number:'1.0-0' }} <span class="text-sm font-semibold">₫</span>
                            </span>
                            <span class="text-[11px] text-slate-500">
                              / {{ searchFilter().rentalType === 'Hourly' ? 'giờ' : (searchFilter().rentalType === 'Overnight' ? 'đêm' : 'ngày') }}
                            </span>
                          </div>
                        } @else {
                          <span class="text-xs text-slate-500 italic">Liên hệ xem phòng</span>
                        }
                      </div>

                      <a
                        [routerLink]="['/booking/properties', property.slug]"
                        [queryParams]="searchFilter()"
                        class="min-h-11 px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-xs font-bold transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                      >
                        <span>Xem phòng</span>
                        <i class="pi pi-chevron-right text-[10px]"></i>
                      </a>
                    </div>
                  </div>
                </article>
              }
            </div>

            <!-- Thanh điều khiển hiển thị thêm / xem tất cả -->
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-2xs">
              <p class="text-xs text-slate-600 font-medium tabular-nums">
                Đang hiển thị
                <span class="font-bold text-slate-900">{{ filteredProperties().slice(0, visibleCount()).length }}</span>
                /
                <span class="font-bold text-slate-900">{{ filteredProperties().length }}</span>
                cơ sở lưu trú phù hợp
              </p>

              <div class="flex flex-wrap items-center gap-3">
                @if (filteredProperties().length > visibleCount()) {
                  <button
                    type="button"
                    (click)="showMoreProperties()"
                    class="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                  >
                    <i class="pi pi-plus text-[10px]"></i>
                    <span>Xem thêm cơ sở lưu trú (còn {{ filteredProperties().length - visibleCount() }} cơ sở)</span>
                  </button>
                } @else if (visibleCount() > 12 && filteredProperties().length > 12) {
                  <button
                    type="button"
                    (click)="resetVisibleCount()"
                    class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <i class="pi pi-chevron-up text-[10px]"></i>
                    <span>Thu gọn danh sách</span>
                  </button>
                }

                <a
                  routerLink="/booking/explore"
                  [queryParams]="detailQueryParams()"
                  class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <span>Xem tất cả trên bộ lọc &amp; bản đồ</span>
                  <i class="pi pi-map text-[11px]"></i>
                </a>
              </div>
            </div>
          } @else {
            <div class="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs">
              <i class="pi pi-search text-3xl text-slate-300 mb-2"></i>
              <p class="text-sm font-semibold text-slate-700">Chưa tìm thấy cơ sở lưu trú phù hợp với bộ lọc hiện tại.</p>
              <button
                type="button"
                (click)="resetSidebarFilters()"
                class="min-h-11 mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đặt lại bộ lọc tìm kiếm
              </button>
            </div>
          }
        </section>

        <!-- SECTION 2: ĐIỂM ĐẾN & KHU DU LỊCH NỔI BẬT (34 TỈNH THÀNH) -->
        <app-popular-destinations (selectDestination)="onPopularDestinationClick($event)" />

        <!-- SECTION 3: BENTO GRID KHÁM PHÁ THEO PHONG CÁCH NGHỈ DƯỠNG -->
        <app-curated-bento-grid (selectCategory)="onSelectCuratedCategory($event)" />

        <!-- SECTION 4: ƯU ĐÃI FLASH DEALS & VOUCHER MÙA NGHỈ DƯỠNG -->
        <app-flash-deals-banner (applyCode)="onApplyPromoCode($event)" />

        <!-- SECTION 5: TRỤ CỘT CAM KẾT DỊCH VỤ & AN TÂM LƯU TRÚ -->
        <app-trust-pillars />

        <!-- SECTION 6: KÊU GỌI ĐỐI TÁC KHÁCH SẠN SAAS -->
        <app-hotelier-cta-banner />

      </div>

      <!-- MODAL BỘ SƯU TẬP ẢNH CƠ SỞ -->
      <app-photo-gallery-modal
        [isOpen]="isGalleryOpen()"
        [title]="selectedGalleryTitle()"
        [photos]="selectedGalleryPhotos()"
        (close)="closePhotoGallery()"
      />

      <!-- MODAL CHI TIẾT HẠNG PHÒNG & CHÍNH SÁCH PHỤ THU -->
      <app-room-detail-modal
        [isOpen]="isRoomDetailOpen()"
        [roomType]="selectedRoomDetail()"
        [displayPrice]="selectedRoomDetail() ? getRoomDisplayPrice(selectedRoomDetail()!) : 0"
        [propertyName]="selectedRoomPropertyName()"
        (close)="closeRoomDetailModal()"
        (select)="onRoomSelectedFromModal($event)"
      />
    </div>
  `,
})
export class BookingPageComponent implements OnInit {
  protected readonly Math = Math;
  readonly stayTypes: readonly PropertyType[] = ALL_PROPERTY_TYPES;
  readonly propertyTypeTabs: readonly PropertyTypeTabOption[] = [
    { key: 'ALL', label: 'Tất cả', icon: 'pi-th-large', matchTypes: [] },
    { key: 'Hotel', label: 'Khách sạn (Hotel)', icon: 'pi-building', matchTypes: ['Hotel'] },
    { key: 'Resort', label: 'Resort', icon: 'pi-sun', matchTypes: ['Resort'] },
    { key: 'Homestay', label: 'Homestay', icon: 'pi-home', matchTypes: ['Homestay'] },
    { key: 'Villa', label: 'Biệt thự (Villa)', icon: 'pi-star', matchTypes: ['Villa'] },
    { key: 'Apartment', label: 'Căn hộ (Apartment)', icon: 'pi-key', matchTypes: ['Apartment'] },
    { key: 'Motel', label: 'Nhà nghỉ / Motel', icon: 'pi-moon', matchTypes: ['Motel'] },
    { key: 'Hostel', label: 'Hostel / B&B', icon: 'pi-users', matchTypes: ['Hostel', 'BedAndBreakfast'] },
  ];
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // --- SIGNALS TRẠNG THÁI TRANG ---
  readonly isLoading = signal<boolean>(false);
  readonly properties = signal<PublicPropertyDto[]>([]);
  readonly liveBrands = signal<TenantBrandFacet[]>([]);
  readonly liveZones = signal<TouristZoneDto[]>([]);
  readonly liveLandmarks = signal<LandmarkDto[]>([]);
  readonly destinationSuggestions = signal<DestinationSuggestionDto[]>([]);
  readonly selectedTenantId = signal<string | null>(null);
  readonly selectedPropertyType = signal<PropertyType | 'ALL'>('ALL');
  readonly visibleCount = signal<number>(12);
  readonly maxDistanceMeters = signal<number | null>(null);
  readonly loadError = signal(false);
  readonly selectedPriceRangeKey = signal<string>('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly sortBy = signal<BookingSortOption>('recommended');
  readonly smartFilterChips = signal<SuggestedFilterChipDto[]>([]);

  // --- SIGNALS QUẢN LÝ MODAL ---
  readonly isGalleryOpen = signal<boolean>(false);
  readonly selectedGalleryTitle = signal<string>('');
  readonly selectedGalleryPhotos = signal<GalleryPhotoItem[]>([]);

  readonly isRoomDetailOpen = signal<boolean>(false);
  readonly selectedRoomDetail = signal<PublicRoomTypeAvailabilityDto | null>(null);
  readonly selectedRoomPropertyName = signal<string>('');
  readonly selectedRoomPropertyId = signal<string>('');
  private readonly destroyRef = inject(DestroyRef);
  private requestGeneration = 0;

  readonly searchFilter = signal<PublicBookingSearchFilter>({
    rentalType: 'Daily',
    destinationKeyword: '',
    provinceCode: null,
    touristZoneSlug: null,
    landmarkSlug: null,
    tenantSlug: null,
    propertyTypes: [],
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    checkInTime: '14:00',
    durationHours: 2,
    guests: 2,
    roomsCount: 1,
    maxDistanceMeters: null,
    minPrice: null,
    maxPrice: null,
    sortBy: 'recommended',
    page: 1,
    pageSize: 10,
  });

  // --- OPTIONS BỘ LỌC SIDEBAR ---
  readonly distanceFilterOptions: Array<{ label: string; value: number | null }> = [
    { label: 'Mọi khoảng cách', value: null },
    { label: 'Dưới 500m từ địa danh', value: 500 },
    { label: 'Dưới 1 km từ địa danh', value: 1000 },
    { label: 'Dưới 3 km từ địa danh', value: 3000 },
  ];

  readonly priceRangeOptions: Array<{
    key: string;
    label: string;
    min: number | null;
    max: number | null;
  }> = [
    { key: 'all', label: 'Tất cả mức giá', min: null, max: null },
    { key: 'under_200', label: 'Dưới 200.000đ (Phổ biến thuê giờ)', min: 0, max: 200000 },
    { key: '200_500', label: '200.000đ – 500.000đ', min: 200000, max: 500000 },
    { key: '500_1000', label: '500.000đ – 1.000.000đ', min: 500000, max: 1000000 },
    { key: 'above_1000', label: 'Trên 1.000.000đ', min: 1000000, max: null },
  ];

  // --- COMPUTED SIGNALS ---
  readonly featuredProperty = computed<PublicPropertyDto | null>(() => {
    const props = this.properties();
    if (!props.length) return null;
    return props.find(p => !!p.thumbnailUrl) ?? props[0];
  });

  readonly currentRentalModeLabel = computed<string>(() => {
    const mode = this.searchFilter().rentalType;
    if (mode === 'Hourly') return `Theo giờ (${this.searchFilter().durationHours} giờ)`;
    if (mode === 'Overnight') return 'Qua đêm';
    return 'Theo ngày/đêm';
  });

  /** Tổng hợp danh sách Chuỗi thương hiệu (Parent Tenant) từ kết quả để khách lọc theo chuỗi */
  readonly tenantBrandFacets = computed<TenantBrandFacet[]>(() => {
    const map = new Map<string, TenantBrandFacet>();
    for (const prop of this.properties()) {
      if (!prop.tenantId || !prop.tenantBrandName) continue;
      const existing = map.get(prop.tenantId);
      if (existing) {
        existing.branchCount += 1;
        if (!existing.tenantSlug && prop.tenantSlug) {
          existing.tenantSlug = prop.tenantSlug;
        }
      } else {
        map.set(prop.tenantId, {
          tenantId: prop.tenantId,
          tenantBrandName: prop.tenantBrandName,
          tenantSlug: prop.tenantSlug,
          branchCount: 1,
        });
      }
    }
    if (map.size === 0) {
      return [];
    }
    const apiBrands = this.liveBrands();
    if (apiBrands.length > 0) {
      for (const b of apiBrands) {
        if (!map.has(b.tenantId)) {
          map.set(b.tenantId, b);
        }
      }
    }
    return Array.from(map.values());
  });

  /** Lọc và sắp xếp danh sách cơ sở theo thời gian thực bằng Signals */
  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const filter = this.searchFilter();
    const tenantId = this.selectedTenantId();
    const activeTabType = this.selectedPropertyType();
    const maxDist = this.maxDistanceMeters();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const sort = this.sortBy();

    const activeTypes: readonly PropertyType[] =
      filter.propertyTypes.length > 0
        ? filter.propertyTypes
        : activeTabType !== 'ALL'
          ? (this.propertyTypeTabs.find(t => t.key === activeTabType)?.matchTypes ?? [activeTabType])
          : [];

    const list = this.properties().filter((prop) => {
      // 1. Cơ sở phải hỗ trợ chế độ thuê đang chọn (Hourly / Overnight / Daily)
      if (!prop.allowedRentalTypes.includes(filter.rentalType)) {
        return false;
      }
      // 2. Lọc theo loại hình (Hotel, Resort, Homestay, Villa, Apartment, Motel, Guesthouse, Hostel, BedAndBreakfast)
      if (activeTypes.length > 0 && !activeTypes.includes(prop.propertyType)) {
        return false;
      }
      // 3. Lọc theo Chuỗi thương hiệu (Tenant chính)
      if (tenantId && prop.tenantId !== tenantId) {
        return false;
      }
      if (!tenantId && filter.tenantSlug && prop.tenantSlug !== filter.tenantSlug) {
        return false;
      }
      // 4. Lọc theo khoảng cách tới địa danh gần nhất hoặc toạ độ GPS
      if (maxDist !== null) {
        if (prop.distanceMeters !== undefined && prop.distanceMeters !== null) {
          if (prop.distanceMeters > maxDist) return false;
        } else if (prop.nearbyLandmarks.length > 0) {
          const minLandmarkDist = Math.min(
            ...prop.nearbyLandmarks.map((l) => l.distanceMeters)
          );
          if (minLandmarkDist > maxDist) return false;
        } else return false;
      }
      // 5. Lọc theo ngân sách
      const price = prop.startingPriceForSelectedMode;
      if ((minP !== null || maxP !== null) && !(price > 0)) return false;
      if (minP !== null && price < minP) return false;
      if (maxP !== null && price > maxP) return false;

      return true;
    });

    return [...list].sort((a, b) => {
      // Direct matches come before expanded suggestions
      if (a.isExpandedNearbySuggestion !== b.isExpandedNearbySuggestion) {
        return a.isExpandedNearbySuggestion ? 1 : -1;
      }
      if (sort === 'price_asc') {
        if (!(a.startingPriceForSelectedMode > 0)) return b.startingPriceForSelectedMode > 0 ? 1 : 0;
        if (!(b.startingPriceForSelectedMode > 0)) return -1;
        return a.startingPriceForSelectedMode - b.startingPriceForSelectedMode;
      }
      if (sort === 'price_desc') {
        if (!(a.startingPriceForSelectedMode > 0)) return b.startingPriceForSelectedMode > 0 ? 1 : 0;
        if (!(b.startingPriceForSelectedMode > 0)) return -1;
        return b.startingPriceForSelectedMode - a.startingPriceForSelectedMode;
      }
      if (sort === 'rating_desc') {
        return b.ratingAverage - a.ratingAverage;
      }
      if (sort === 'distance_asc') {
        const distA = a.distanceMeters ?? a.nearbyLandmarks[0]?.distanceMeters ?? 999999;
        const distB = b.distanceMeters ?? b.nearbyLandmarks[0]?.distanceMeters ?? 999999;
        return distA - distB;
      }
      return 0;
    });
  });

  ngOnInit(): void {
    this.seedDefaultDestinationSuggestions();
    this.loadLiveDestinationCatalog();
    (this.route.queryParams ?? of(this.route.snapshot.queryParams ?? {})).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      try {
        const nonNegative = (value: unknown): number | null => {
          if (value == null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };
        this.selectedTenantId.set(typeof params['selectedTenantId'] === 'string' && params['selectedTenantId'] ? params['selectedTenantId'] : null);
        this.maxDistanceMeters.set(nonNegative(params['maxDistanceMeters']));
        this.minPrice.set(nonNegative(params['minPrice']));
        this.maxPrice.set(nonNegative(params['maxPrice']));
        if (this.minPrice() !== null && this.maxPrice() !== null && this.minPrice()! > this.maxPrice()!) {
          this.minPrice.set(null);
          this.maxPrice.set(null);
        }
        this.selectedPriceRangeKey.set(this.priceRangeOptions.find(range => range.min === this.minPrice() && range.max === this.maxPrice())?.key ?? 'custom');
        const sort = params['sortBy'];
        this.sortBy.set(['recommended', 'price_asc', 'price_desc', 'rating_desc', 'distance_asc'].includes(sort) ? sort : 'recommended');
        const parsedTypes = Array.from(
          new Set(
            String(params['propertyTypes'] ?? '')
              .split(',')
              .map(t => t.trim())
              .map(t => (t === 'Guesthouse' ? 'Motel' : t))
              .filter((type): type is PropertyType => ALL_PROPERTY_TYPES.includes(type as PropertyType))
          )
        );
        const tenantSlugParam = typeof params['tenantSlug'] === 'string' && params['tenantSlug'] ? params['tenantSlug'] : null;

        this.searchFilter.update(filter => ({ ...filter, ...readPublicStay(params), destinationKeyword: String(params['destinationKeyword'] ?? ''),
          maxDistanceMeters: this.maxDistanceMeters(), minPrice: this.minPrice(), maxPrice: this.maxPrice(), sortBy: this.sortBy(),
          touristZoneSlug: params['touristZoneSlug'] || null, landmarkSlug: params['landmarkSlug'] || null,
          provinceCode: params['provinceCode'] || null,
          tenantSlug: tenantSlugParam,
          propertyTypes: parsedTypes,
          userLatitude: params['userLatitude'] != null && Number.isFinite(Number(params['userLatitude'])) ? Number(params['userLatitude']) : null,
          userLongitude: params['userLongitude'] != null && Number.isFinite(Number(params['userLongitude'])) ? Number(params['userLongitude']) : null }));

        if (parsedTypes.length === 1) {
          const single = parsedTypes[0];
          this.selectedPropertyType.set(single === 'Guesthouse' ? 'Motel' : single === 'BedAndBreakfast' ? 'Hostel' : single);
        } else {
          this.selectedPropertyType.set('ALL');
        }
        this.loadPublicProperties();
      } catch {
        ++this.requestGeneration;
        this.isLoading.set(false);
        this.loadError.set(true);
        this.properties.set([]);
        this.smartFilterChips.set([]);
      }
    });
  }

  onFilterDraftChange(updatedFilter: PublicBookingSearchFilter): void {
    this.searchFilter.set({
      ...updatedFilter,
      maxDistanceMeters: this.maxDistanceMeters(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      sortBy: this.sortBy(),
    });
    if (updatedFilter.propertyTypes.length === 1) {
      const single = updatedFilter.propertyTypes[0];
      this.selectedPropertyType.set(
        single === 'Guesthouse' ? 'Motel' : single === 'BedAndBreakfast' ? 'Hostel' : single
      );
    } else {
      this.selectedPropertyType.set('ALL');
    }
    this.visibleCount.set(12);
    this.loadPublicProperties();
  }

  onFilterBarChange(updatedFilter: PublicBookingSearchFilter): void {
    this.searchFilter.set({
      ...updatedFilter,
      maxDistanceMeters: this.maxDistanceMeters(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      sortBy: this.sortBy(),
    });
    if (!this.route.queryParams) this.loadPublicProperties();

    // When user performs search on the Home page, navigate to dedicated explore search page
    const isHomePage = typeof this.router.url === 'string' && this.router.url.split('?')[0] === '/booking';
    const targetCommands = isHomePage ? ['/booking/explore'] : [];

    this.router.navigate(targetCommands, {
      relativeTo: targetCommands.length === 0 ? this.route : undefined,
      queryParams: {
        ...this.searchFilter(),
        selectedTenantId: this.selectedTenantId(),
        propertyTypes: this.searchFilter().propertyTypes.join(','),
      },
    });
  }

  detailQueryParams(): Record<string, string | number | null> {
    const filter = this.searchFilter();
    return {
      ...filter,
      propertyTypes: filter.propertyTypes.join(','),
      selectedTenantId: this.selectedTenantId(),
      maxDistanceMeters: this.maxDistanceMeters(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      sortBy: this.sortBy(),
    };
  }

  onPopularDestinationClick(destinationKeyword: string): void {
    this.searchFilter.update((prev) => ({
      ...prev,
      destinationKeyword,
      provinceCode: null,
      touristZoneSlug: null,
      landmarkSlug: null,
      userLatitude: null,
      userLongitude: null,
    }));
    this.onFilterBarChange(this.searchFilter());
  }

  selectTenantBrand(tenantId: string | null): void {
    this.selectedTenantId.set(tenantId);
    this.onFilterBarChange(this.searchFilter());
  }

  setMaxDistance(meters: number | null): void {
    this.maxDistanceMeters.set(meters);
    this.onFilterBarChange(this.searchFilter());
  }

  applyPriceRange(key: string, min: number | null, max: number | null): void {
    this.selectedPriceRangeKey.set(key);
    this.minPrice.set(min);
    this.maxPrice.set(max);
    this.onFilterBarChange(this.searchFilter());
  }

  onSortChange(sort: BookingSortOption): void {
    this.sortBy.set(sort);
    this.onFilterBarChange(this.searchFilter());
  }

  selectPropertyTypeTab(tabKey: PropertyType | 'ALL'): void {
    this.selectedPropertyType.set(tabKey);
    const tab = this.propertyTypeTabs.find(t => t.key === tabKey);
    const nextTypes = tab ? [...tab.matchTypes] : [];
    this.searchFilter.update(prev => ({
      ...prev,
      propertyTypes: nextTypes,
      page: 1,
    }));
    this.visibleCount.set(12);
  }

  isPropertyTypeTabActive(tab: PropertyTypeTabOption): boolean {
    if (this.selectedPropertyType() === tab.key) return true;
    const active = this.searchFilter().propertyTypes;
    if (tab.key === 'ALL') {
      return this.selectedPropertyType() === 'ALL' && active.length === 0;
    }
    return active.length > 0 && active.every(t => tab.matchTypes.includes(t)) && tab.matchTypes.some(t => active.includes(t));
  }

  getPropertyTypeTabCount(tab: PropertyTypeTabOption): number {
    const rentalMode = this.searchFilter().rentalType;
    const baseList = this.properties().filter(p => p.allowedRentalTypes.includes(rentalMode));
    if (tab.key === 'ALL') return baseList.length;
    return baseList.filter(p => tab.matchTypes.includes(p.propertyType)).length;
  }

  filterByTenantBrandInline(brand: TenantBrandFacet | null): void {
    if (!brand) {
      this.selectedTenantId.set(null);
      this.searchFilter.update(prev => ({ ...prev, tenantSlug: null, page: 1 }));
      this.visibleCount.set(12);
      return;
    }
    const isAlreadyActive = this.isBrandFacetActive(brand);
    if (isAlreadyActive) {
      this.selectedTenantId.set(null);
      this.searchFilter.update(prev => ({ ...prev, tenantSlug: null, page: 1 }));
    } else {
      this.selectedTenantId.set(brand.tenantId);
      this.searchFilter.update(prev => ({ ...prev, tenantSlug: brand.tenantSlug || null, page: 1 }));
    }
    this.visibleCount.set(12);
  }

  isBrandFacetActive(brand: TenantBrandFacet): boolean {
    return (
      this.selectedTenantId() === brand.tenantId ||
      (!!brand.tenantSlug && this.searchFilter().tenantSlug === brand.tenantSlug)
    );
  }

  showMoreProperties(): void {
    this.visibleCount.update(c => c + 12);
  }

  resetVisibleCount(): void {
    this.visibleCount.set(12);
  }

  resetSidebarFilters(): void {
    this.selectedTenantId.set(null);
    this.selectedPropertyType.set('ALL');
    this.visibleCount.set(12);
    this.maxDistanceMeters.set(null);
    this.selectedPriceRangeKey.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('recommended');
    this.searchFilter.update(prev => ({
      ...prev,
      propertyTypes: [],
      tenantSlug: null,
      page: 1,
    }));
    this.onFilterBarChange(this.searchFilter());
  }

  // --- SMART AI FILTER CHIPS ---
  onSmartChipClick(chip: SuggestedFilterChipDto): void {
    if (chip.filterKey === 'maxDistanceMeters') {
      const current = this.maxDistanceMeters();
      this.maxDistanceMeters.set(current === chip.filterValue ? null : chip.filterValue);
    } else if (chip.filterKey === 'destinationKeyword') {
      this.searchFilter.update((f) => ({
        ...f,
        destinationKeyword: f.destinationKeyword === chip.filterValue ? '' : chip.filterValue,
      }));
    } else if (chip.filterKey === 'maxPrice') {
      const current = this.maxPrice();
      this.maxPrice.set(current === chip.filterValue ? null : chip.filterValue);
    } else if (chip.filterKey === 'rentalType') {
      this.searchFilter.update((f) => ({
        ...f,
        rentalType: chip.filterValue,
      }));
    }
    this.onFilterBarChange(this.searchFilter());
  }

  isChipActive(chip: SuggestedFilterChipDto): boolean {
    if (chip.filterKey === 'maxDistanceMeters') {
      return this.maxDistanceMeters() === chip.filterValue;
    }
    if (chip.filterKey === 'destinationKeyword') {
      return this.searchFilter().destinationKeyword === chip.filterValue;
    }
    if (chip.filterKey === 'maxPrice') {
      return this.maxPrice() === chip.filterValue;
    }
    if (chip.filterKey === 'rentalType') {
      return this.searchFilter().rentalType === chip.filterValue;
    }
    return false;
  }

  private generateDynamicChips(props: PublicPropertyDto[]): void {
    const chips: SuggestedFilterChipDto[] = [];
    const keyword = this.searchFilter().destinationKeyword;

    if (keyword) {
      chips.push({
        id: 'chip-near-1km',
        label: `Gần ${keyword} (< 1km)`,
        category: 'nearby',
        filterKey: 'maxDistanceMeters',
        filterValue: 1000,
      });
      chips.push({
        id: 'chip-near-3km',
        label: `Bán kính ${keyword} (< 3km)`,
        category: 'nearby',
        filterKey: 'maxDistanceMeters',
        filterValue: 3000,
      });
    }

    // Nearby landmarks appearing in results
    const landmarkCounts = new Map<string, number>();
    for (const p of props) {
      for (const lm of p.nearbyLandmarks) {
        landmarkCounts.set(lm.landmarkName, (landmarkCounts.get(lm.landmarkName) ?? 0) + 1);
      }
    }
    const topLandmarks = Array.from(landmarkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [name, count] of topLandmarks) {
      chips.push({
        id: `chip-lm-${name.toLowerCase().replace(/\s+/g, '-')}`,
        label: name,
        category: 'nearby',
        filterKey: 'destinationKeyword',
        filterValue: name,
        count,
      });
    }

    // Price chips
    const validPrices = props
      .map((p) => p.startingPriceForSelectedMode)
      .filter((p) => p > 0);

    if (validPrices.length > 0) {
      if (this.searchFilter().rentalType === 'Hourly') {
        chips.push({
          id: 'chip-price-hourly-120k',
          label: 'Dưới 120k / 2h',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 120000,
        });
      } else {
        chips.push({
          id: 'chip-price-350k',
          label: 'Dưới 350k / đêm',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 350000,
        });
        chips.push({
          id: 'chip-price-600k',
          label: 'Dưới 600k / đêm',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 600000,
        });
      }
    }

    // Rental type chips
    if (this.searchFilter().rentalType !== 'Hourly' && props.some((p) => p.allowedRentalTypes.includes('Hourly'))) {
      chips.push({
        id: 'chip-mode-hourly',
        label: 'Có cho thuê theo giờ',
        category: 'rentalType',
        filterKey: 'rentalType',
        filterValue: 'Hourly',
      });
    }
    if (this.searchFilter().rentalType !== 'Overnight' && props.some((p) => p.allowedRentalTypes.includes('Overnight'))) {
      chips.push({
        id: 'chip-mode-overnight',
        label: 'Thuê qua đêm',
        category: 'rentalType',
        filterKey: 'rentalType',
        filterValue: 'Overnight',
      });
    }

    this.smartFilterChips.set(chips);
  }

  // --- HIỂN THỊ GIÁ LINH HOẠT THEO CHẾ ĐỘ THUÊ ---
  getRoomDisplayPrice(roomType: PublicRoomTypeAvailabilityDto): number {
    const mode = this.searchFilter().rentalType;
    if (mode === 'Hourly') {
      if (roomType.calculatedQuoteTotal > 0) return roomType.calculatedQuoteTotal;
      const baseHours = roomType.hourlyBaseHours;
      const basePrice = roomType.hourlyBasePrice;
      if (!baseHours || !basePrice) return 0;
      const extraHours = Math.max(0, this.searchFilter().durationHours - baseHours);
      if (extraHours > 0 && roomType.hourlyExtraHourPrice == null) return 0;
      const extraPrice = extraHours * (roomType.hourlyExtraHourPrice ?? 0);
      return basePrice + extraPrice;
    }
    if (mode === 'Overnight') {
      return roomType.overnightPrice ?? roomType.calculatedQuoteTotal;
    }
    return roomType.dailyPrice ?? roomType.calculatedQuoteTotal;
  }

  getRoomPriceUnitLabel(roomType: PublicRoomTypeAvailabilityDto): string {
    const mode = this.searchFilter().rentalType;
    if (mode === 'Hourly') {
      return `Giá tham khảo ${this.searchFilter().durationHours} giờ; xác nhận khi đặt`;
    }
    if (mode === 'Overnight') {
      return 'Giá qua đêm; giờ nhận/trả theo cơ sở';
    }
    return 'Giá mỗi đêm; tổng thanh toán xác nhận khi đặt';
  }

  getPropertyAddress(property: PublicPropertyDto): string {
    return [property.addressLine, property.wardName, property.provinceName].filter(Boolean).join(', ') || 'Chưa công bố địa chỉ';
  }

  getRoomMetadata(room: PublicRoomTypeAvailabilityDto): string {
    return [room.bedConfiguration, room.areaSqm ? `${room.areaSqm}m²` : '',
      room.maxGuests > 0 ? `Tối đa ${room.maxGuests} khách` : ''].filter(Boolean).join(' • ') || 'Chưa công bố thông tin phòng';
  }

  // --- ACTIONS: XEM CHI TIẾT & GIỮ PHÒNG (GUEST HOLD) ---
  createHoldAndProceed(
    property: PublicPropertyDto,
    roomType: PublicRoomTypeAvailabilityDto
  ): void {
    const f = this.searchFilter();
    this.router.navigate(['/booking/hold'], {
      queryParams: {
        propertySlug: property.slug,
        propertyId: property.propertyId,
        roomTypeId: roomType.roomTypeId,
        rentalType: f.rentalType,
        checkInDate: f.checkInDate,
        checkOutDate: f.checkOutDate,
        checkInTime: f.checkInTime,
        durationHours: f.durationHours,
        guests: f.guests,
      },
    });
  }

  openPhotoGallery(property: PublicPropertyDto): void {
    if (!property.galleryUrls?.length && !property.thumbnailUrl) return;
    const photos: GalleryPhotoItem[] = (property.galleryUrls ?? []).map((url, i) => ({
      url,
      title: `${property.name} - Ảnh ${i + 1}`,
      category: property.propertyType,
    }));
    this.selectedGalleryTitle.set(property.name);
    this.selectedGalleryPhotos.set(
      photos.length > 0 ? photos : [{ url: property.thumbnailUrl, title: property.name, category: property.propertyType }]
    );
    this.isGalleryOpen.set(true);
  }

  closePhotoGallery(): void {
    this.isGalleryOpen.set(false);
  }

  openRoomDetailModal(
    property: PublicPropertyDto,
    roomType: PublicRoomTypeAvailabilityDto
  ): void {
    this.selectedRoomPropertyName.set(property.name);
    this.selectedRoomPropertyId.set(property.propertyId);
    this.selectedRoomDetail.set(roomType);
    this.isRoomDetailOpen.set(true);
  }

  closeRoomDetailModal(): void {
    this.isRoomDetailOpen.set(false);
  }

  onRoomSelectedFromModal(roomType: PublicRoomTypeAvailabilityDto): void {
    this.isRoomDetailOpen.set(false);
    const prop = this.properties().find((p) => p.propertyId === this.selectedRoomPropertyId());
    if (prop) {
      this.createHoldAndProceed(prop, roomType);
    }
  }

  // --- UI FORMATTERS ---
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

  getPropertyTypeBadgeClass(type: PropertyType): string {
    switch (type) {
      case 'Hotel':
        return 'bg-indigo-600 text-white';
      case 'Resort':
        return 'bg-cyan-600 text-white';
      case 'Homestay':
        return 'bg-rose-500 text-white';
      case 'Villa':
        return 'bg-purple-600 text-white';
      case 'Apartment':
        return 'bg-sky-600 text-white';
      case 'Motel':
        return 'bg-amber-500 text-slate-950';
      case 'Guesthouse':
        return 'bg-emerald-600 text-white';
      case 'Hostel':
        return 'bg-teal-600 text-white';
      case 'BedAndBreakfast':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-slate-800 text-white';
    }
  }

  getRentalModeTag(mode: RentalType): string {
    switch (mode) {
      case 'Hourly':
        return 'Nhận theo giờ';
      case 'Overnight':
        return 'Nhận qua đêm';
      case 'Daily':
        return 'Nhận theo ngày';
    }
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  retryProperties(): void {
    this.loadPublicProperties();
  }

  private loadPublicProperties(): void {
    const generation = ++this.requestGeneration;
    this.isLoading.set(true);
    this.loadError.set(false);
    const filter = this.searchFilter();

    const serviceFilter = {
      search: filter.destinationKeyword || undefined,
      destinationKeyword: filter.destinationKeyword || undefined,
      tenantSlug: filter.tenantSlug || undefined,
      provinceCode: filter.provinceCode || undefined,
      propertyTypes: filter.propertyTypes.length > 0 ? filter.propertyTypes : undefined,
      rentalType: filter.rentalType === 'Hourly' ? 1 : filter.rentalType === 'Overnight' ? 2 : 3,
      touristZoneSlug: filter.touristZoneSlug || undefined,
      landmarkSlug: filter.landmarkSlug || undefined,
      maxDistanceKm: filter.maxDistanceMeters ? filter.maxDistanceMeters / 1000 : undefined,
      maxDistanceMeters: filter.maxDistanceMeters ?? undefined,
      userLatitude: filter.userLatitude ?? undefined,
      userLongitude: filter.userLongitude ?? undefined,
      minPrice: this.minPrice() ?? undefined,
      maxPrice: this.maxPrice() ?? undefined,
      guests: filter.guests > 0 ? filter.guests : undefined,
      checkInDate: filter.checkInDate || undefined,
      checkOutDate: filter.checkOutDate || undefined,
    };

    this.publicBookingService.getProperties(serviceFilter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (props) => {
        if (generation !== this.requestGeneration) return;
        if (props && props.length > 0) {
          const rawProps = props as unknown as RawBookingPropertyInput[];
          const mappedList: PublicPropertyDto[] = rawProps.map((p) => {
            const allowedModes: RentalType[] = p.allowedRentalTypes ?? [
              ...(p.allowDailyBooking === true ? ['Daily' as RentalType] : []),
              ...(p.allowHourlyBooking === true ? ['Hourly' as RentalType] : []),
              ...(p.allowOvernightBooking === true ? ['Overnight' as RentalType] : []),
            ];

            const landmarks: NearbyLandmarkBadgeDto[] = (p.nearbyLandmarks || [])
              .filter((landmark) =>
                Number.isFinite(
                  landmark.distanceMeters ?? (landmark.distanceKm != null ? landmark.distanceKm * 1000 : undefined)
                )
              )
              .map((l, idx) => ({
                landmarkId: l.landmarkId || `lm-${idx}`,
                landmarkName: l.name || l.landmarkName || 'Địa danh',
                landmarkSlug: l.slug || l.landmarkSlug || 'dia-danh',
                category: l.category || 'Center',
                distanceMeters: l.distanceMeters ?? Math.round((l.distanceKm ?? 0) * 1000),
              }));

            const startPrice = (filter.rentalType === 'Hourly'
              ? p.hourlyStartingPrice ?? p.hourlyPriceFrom
              : filter.rentalType === 'Overnight'
                ? p.overnightStartingPrice ?? p.overnightPriceFrom
                : p.dailyStartingPrice ?? p.dailyPriceFrom) ?? p.startingPriceForSelectedMode ?? p.startingPrice ?? 0;

            const rawTypeStr = p.propertyType === 'Guesthouse' ? 'Motel' : p.propertyType;
            const pType: PropertyType = (typeof rawTypeStr === 'string' && ALL_PROPERTY_TYPES.includes(rawTypeStr as PropertyType)
              ? rawTypeStr
              : 'Hotel') as PropertyType;

            const resolvedThumb = resolvePropertyThumbnail(
              p.name || '',
              `${p.addressLine || p.address || ''} ${p.provinceName || p.city || ''} ${p.touristZoneName || ''}`,
              p.thumbnailUrl || p.imageUrl
            );
            const verifiedGallery = (p.galleryUrls ?? []).filter(
              url => typeof url === 'string' && url.trim().length > 0 && !url.toLowerCase().includes('images.unsplash.com')
            );

            return {
              propertyId: p.propertyId || p.id || '',
              id: p.id || p.propertyId,
              tenantId: p.tenantId || '',
              tenantBrandName: p.tenantBrandName || '',
              ...(p.tenantSlug ? { tenantSlug: p.tenantSlug } : {}),
              name: p.name || '',
              code: p.code || '',
              slug: p.slug || '',
              propertyType: pType,
              starRating: p.starRating ?? 0,
              addressLine: p.addressLine || p.address || '',
              address: p.address || p.addressLine || '',
              wardName: p.wardName || '',
              city: p.city || '',
              provinceCode: p.provinceCode || '',
              provinceName: p.provinceName || p.city || '',
              touristZoneName: p.touristZoneName || '',
              touristZoneSlug: p.touristZoneSlug || '',
              latitude: p.latitude,
              longitude: p.longitude,
              thumbnailUrl: resolvedThumb,
              imageUrl: p.imageUrl || p.thumbnailUrl,
              galleryUrls: verifiedGallery.length > 0 ? verifiedGallery : (resolvedThumb ? [resolvedThumb] : []),
              allowedRentalTypes: allowedModes,
              allowHourlyBooking: p.allowHourlyBooking,
              allowOvernightBooking: p.allowOvernightBooking,
              allowDailyBooking: p.allowDailyBooking,
              overnightCheckInTime: p.overnightCheckInTime || '',
              overnightCheckOutTime: p.overnightCheckOutTime || '',
              cleaningBufferMinutes: p.cleaningBufferMinutes ?? p.bufferMinutes ?? 0,
              ratingAverage: p.ratingAverage ?? 0,
              reviewCount: p.reviewCount ?? 0,
              nearbyLandmarks: landmarks,
              startingPriceForSelectedMode: startPrice,
              startingPrice: startPrice,
              distanceMeters: p.distanceMeters,
              distanceFormatted: p.distanceFormatted,
              isExpandedNearbySuggestion: p.isExpandedNearbySuggestion ?? false,
              availableRoomTypes: (p.availableRoomTypes && p.availableRoomTypes.length > 0)
                ? p.availableRoomTypes.map((rt) => ({
                    roomTypeId: rt.roomTypeId || rt.id || '',
                    name: rt.name || rt.roomTypeName || 'Hạng phòng chưa công bố tên',
                    roomTypeName: rt.roomTypeName || rt.name,
                    code: rt.code,
                    maxGuests: rt.maxGuests ?? rt.maxOccupancy ?? 0,
                    maxOccupancy: rt.maxOccupancy ?? rt.maxGuests,
                    bedConfiguration: rt.bedConfiguration || rt.bedType,
                    bedType: rt.bedType || rt.bedConfiguration,
                    areaSqm: rt.areaSqm ?? rt.squareMeters,
                    squareMeters: rt.squareMeters ?? rt.areaSqm,
                    availableRoomsCount: rt.availableRoomsCount ?? rt.availableRooms ?? 0,
                    availableRooms: rt.availableRooms ?? rt.availableRoomsCount ?? 0,
                    totalRooms: rt.totalRooms,
                    isAvailable: rt.isAvailable,
                    amenities: rt.amenities || [],
                    images: rt.images || (rt.imageUrl ? [rt.imageUrl] : []),
                    imageUrl: rt.imageUrl,
                    hourlyBasePrice: rt.hourlyBasePrice ?? rt.hourlyRate,
                    hourlyBaseHours: rt.hourlyBaseHours,
                    hourlyExtraHourPrice: rt.hourlyExtraHourPrice,
                    overnightPrice: rt.overnightPrice ?? rt.overnightRate,
                    dailyPrice: rt.dailyPrice ?? rt.dailyRate,
                    calculatedQuoteTotal: rt.calculatedQuoteTotal ?? rt.estimatedPrice ?? 0,
                    estimatedPrice: rt.estimatedPrice,
                  }))
                : [],
            };
          });
          this.properties.set(mappedList);
          this.generateDynamicChips(mappedList);
          this.refreshDestinationSuggestions(mappedList);
        } else {
          this.properties.set([]);
          this.smartFilterChips.set([]);
          this.refreshDestinationSuggestions([]);
        }
        this.isLoading.set(false);
      },
      error: () => {
        if (generation !== this.requestGeneration) return;
        this.properties.set([]);
        this.smartFilterChips.set([]);
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }


  private seedDefaultDestinationSuggestions(): void {
    this.destinationSuggestions.set(buildDefaultDestinationSuggestions());
  }

  private loadLiveDestinationCatalog(): void {
    this.publicBookingService
      .getTouristZones?.()
      ?.pipe(
        catchError(() => of([] as TouristZoneDto[])),
        takeUntilDestroyed(this.destroyRef)
      )
      ?.subscribe((zones) => {
        this.liveZones.set(zones ?? []);
        this.refreshDestinationSuggestions();
      });

    this.publicBookingService
      .getLandmarks?.()
      ?.pipe(
        catchError(() => of([] as LandmarkDto[])),
        takeUntilDestroyed(this.destroyRef)
      )
      ?.subscribe((landmarks) => {
        this.liveLandmarks.set(landmarks ?? []);
        this.refreshDestinationSuggestions();
      });

    this.publicBookingService
      .getPublicBrands?.()
      ?.pipe(
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef)
      )
      ?.subscribe((brands) => {
        this.liveBrands.set(
          (brands ?? []).map(b => ({
            tenantId: b.tenantId,
            tenantBrandName: b.name,
            tenantSlug: b.slug,
            branchCount: b.totalProperties,
          }))
        );
      });
  }

  private refreshDestinationSuggestions(loadedProps: readonly PublicPropertyDto[] = this.properties()): void {
    this.destinationSuggestions.set(
      mergeLiveDestinationCatalog(
        buildDefaultDestinationSuggestions(),
        this.liveZones(),
        this.liveLandmarks(),
        loadedProps
      )
    );
  }

  selectCategoryQuickTag(tag: string): void {
    this.onFilterBarChange({
      ...this.searchFilter(),
      destinationKeyword: tag
    });
  }

  selectStayTheme(type: PropertyType): void {
    this.selectedPropertyType.set(type === 'Guesthouse' ? 'Motel' : type === 'BedAndBreakfast' ? 'Hostel' : type);
    this.visibleCount.set(12);
    const current = this.searchFilter();
    this.onFilterBarChange({
      ...current,
      propertyTypes: [type]
    });
  }

  onApplyPromoCode(code: string): void {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(trimmed).catch(() => {});
    }
    this.router.navigate(['/booking/explore'], {
      queryParams: {
        ...this.detailQueryParams(),
        promoCode: trimmed,
      },
    });
  }

  onSelectCuratedCategory(type: string): void {
    this.selectStayTheme(type as PropertyType);
  }
}

// --- ALIASES VÀ KIỂU DỮ LIỆU TƯƠNG THÍCH NGƯỢC ---
export { BookingPageComponent as BookingPage };

export function getTodayVnDateString(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RoomImageRenderContext {
  readonly propertyId: string;
  readonly generation: number;
  readonly roomTypeId: string;
  readonly url: string;
  readonly retryAttempt: number;
}
