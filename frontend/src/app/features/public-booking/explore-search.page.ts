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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { readPublicStay } from '../../core/models/public-stay-context';
import { resolvePropertyThumbnail } from '../../core/utils/hotel-image.util';
import {
  buildDefaultDestinationSuggestions,
  mergeLiveDestinationCatalog,
} from '../../core/utils/destination-suggestions.util';
import { BookingFilterBarComponent } from './components/booking-filter-bar/booking-filter-bar.component';
import {
  ALL_PROPERTY_TYPES,
  BookingSortOption,
  DestinationSuggestionDto,
  LandmarkDto,
  PropertyType,
  PublicBookingSearchFilter,
  PublicPropertiesFilter,
  PublicPropertyDto,
  RentalType,
  SuggestedFilterChipDto,
  TouristZoneDto,
} from '../../core/models/public-booking.model';
import { LocationService } from '../../core/services/location.service';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  LoadingSpinnerComponent,
  PaginationComponent,
  PhotoGalleryModalComponent,
  VndCurrencyPipe,
  GalleryPhotoItem,
} from '../../shared';

interface TenantBrandFacet {
  tenantId: string;
  tenantBrandName: string;
  tenantSlug?: string;
  branchCount: number;
}

@Component({
  selector: 'app-explore-search-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BookingFilterBarComponent,
    LoadingSpinnerComponent,
    PaginationComponent,
    PhotoGalleryModalComponent,
    VndCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--surface-canvas)] font-sans pb-20">
      <!-- 1. TOP HEADER & SEARCH BAR BANNER -->
      <div class="bg-[var(--surface-card)] text-[var(--text-primary)] pt-6 pb-8 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-subtle)]">
        <div class="max-w-7xl mx-auto space-y-4">
          <!-- Breadcrumb -->
          <nav class="flex items-center gap-2 text-xs text-slate-500">
            <a routerLink="/booking" class="hover:text-[var(--brand-primary)] transition-colors">Trang chủ</a>
            <span>/</span>
            <span class="text-[var(--brand-primary)] font-semibold">Tìm kiếm &amp; Lọc Chỗ Nghỉ</span>
          </nav>

          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 class="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {{ pageTitle() }}
              </h1>
              <p class="text-xs sm:text-sm text-slate-600 mt-1">
                Tìm thấy <span class="tabular-nums font-semibold text-slate-900">{{ totalResultCount() }}</span> cơ sở lưu trú phù hợp với tiêu chí của bạn
              </p>
            </div>
            <a
              routerLink="/booking"
              class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <i class="pi pi-arrow-left text-[11px]"></i>
              <span>Về Trang Chủ</span>
            </a>
          </div>

          <!-- Component Thanh Tìm Kiếm -->
          <div class="pt-2">
            <app-booking-filter-bar
              [initialFilter]="searchFilter()"
              [suggestions]="destinationSuggestions()"
              (filterChange)="onFilterBarChange($event)"
            />
          </div>
        </div>
      </div>

      <!-- 2. MAIN 2-COLUMN SEARCH LAYOUT -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <!-- SMART AI FILTER CHIPS ROW -->
        @if (smartFilterChips().length > 0) {
          <div
            class="mb-6 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 overflow-x-auto"
            aria-label="Gợi ý bộ lọc thông minh AI"
          >
            <div class="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0 mr-1">
              <i class="pi pi-sparkles text-[var(--brand-primary)]"></i>
              <span>Gợi ý nhanh:</span>
            </div>
            <div class="flex items-center gap-2 flex-nowrap">
              @for (chip of smartFilterChips(); track chip.id) {
                <button
                  type="button"
                  (click)="onSmartChipClick(chip)"
                  class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap"
                  [class.bg-[var(--brand-primary)]]="isChipActive(chip)"
                  [class.text-[var(--brand-primary-fg)]]="isChipActive(chip)"
                  [class.border-[var(--brand-primary)]]="isChipActive(chip)"
                  [class.bg-slate-100]="!isChipActive(chip)"
                  [class.text-slate-700]="!isChipActive(chip)"
                  [class.border-slate-200]="!isChipActive(chip)"
                  [class.hover:bg-slate-200]="!isChipActive(chip)"
                >
                  <span>{{ chip.label }}</span>
                  @if (chip.count) {
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                      [ngClass]="isChipActive(chip)
                        ? 'bg-black/15 dark:bg-white/25 text-[var(--brand-primary-fg)]'
                        : 'bg-slate-200'"
                    >
                      {{ chip.count }}
                    </span>
                  }
                </button>
              }
            </div>
          </div>
        }

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- CỘT TRÁI: SIDEBAR BỘ LỌC CHUYÊN SÂU (3 CỘT) -->
          <aside
            class="lg:col-span-3 min-w-0 bg-white rounded-2xl border border-slate-200 p-5 space-y-6 lg:sticky lg:top-6 shadow-2xs"
          >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="pi pi-sliders-h text-[var(--brand-primary)]"></i>
                <span>Bộ lọc chuyên sâu</span>
              </h2>
              <button
                type="button"
                (click)="resetSidebarFilters()"
                class="min-h-11 px-2 inline-flex items-center text-xs text-[var(--brand-primary)] hover:underline font-medium cursor-pointer"
              >
                Đặt lại
              </button>
            </div>

            <!-- 1. Chuỗi Thương hiệu (Parent Tenant) -->
            @if (tenantBrandFacets().length > 0) {
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Chuỗi thương hiệu (Tenant)
                </h3>
                <div class="space-y-2 max-h-44 overflow-y-auto pr-1">
                  <label class="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                    <span class="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tenantBrand"
                        [checked]="selectedTenantId() === null"
                        (change)="selectTenantBrand(null)"
                        class="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Tất cả chuỗi</span>
                    </span>
                    <span class="text-slate-400 font-semibold">{{ properties().length }}</span>
                  </label>
                  @for (tenant of tenantBrandFacets(); track tenant.tenantId) {
                    <label class="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                      <span class="flex items-center gap-2">
                        <input
                          type="radio"
                          name="tenantBrand"
                          [checked]="selectedTenantId() === tenant.tenantId"
                          (change)="selectTenantBrand(tenant.tenantId)"
                          class="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span class="truncate max-w-[140px]">{{ tenant.tenantBrandName }}</span>
                      </span>
                      <span class="text-slate-400 font-semibold">{{ tenant.branchCount }}</span>
                    </label>
                  }
                </div>
              </div>
            }

            <!-- 2. Loại hình Chỗ nghỉ -->
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Loại hình lưu trú
              </h3>
              <div class="space-y-2">
                @for (type of availablePropertyTypes; track type.value) {
                  <label class="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                    <span class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        [checked]="isPropertyTypeSelected(type.value)"
                        (change)="togglePropertyType(type.value)"
                        class="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{{ type.label }}</span>
                    </span>
                  </label>
                }
              </div>
            </div>

            <!-- 3. Khoảng giá dự kiến -->
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Ngân sách dự kiến
              </h3>
              <div class="space-y-1.5">
                @for (range of priceRangeOptions; track range.key) {
                  <button
                    type="button"
                    (click)="applyPriceRange(range.key, range.min, range.max)"
                    class="min-h-11 w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between"
                    [class.bg-slate-100]="selectedPriceRangeKey() === range.key"
                    [class.text-[var(--brand-primary)]]="selectedPriceRangeKey() === range.key"
                    [class.font-bold]="selectedPriceRangeKey() === range.key"
                    [class.text-slate-700]="selectedPriceRangeKey() !== range.key"
                    [class.hover:bg-slate-50]="selectedPriceRangeKey() !== range.key"
                  >
                    <span>{{ range.label }}</span>
                    @if (selectedPriceRangeKey() === range.key) {
                      <i class="pi pi-check text-xs text-[var(--brand-primary)]"></i>
                    }
                  </button>
                }
              </div>
            </div>

            <!-- 4. Khoảng cách tới Địa danh / GPS -->
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Bán kính vị trí
              </h3>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  (click)="setMaxDistance(null)"
                  class="min-h-11 px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer"
                  [class.bg-[var(--brand-primary)]]="maxDistanceMeters() === null"
                  [class.text-[var(--brand-primary-fg)]]="maxDistanceMeters() === null"
                  [class.border-[var(--brand-primary)]]="maxDistanceMeters() === null"
                  [class.border-slate-200]="maxDistanceMeters() !== null"
                  [class.text-slate-700]="maxDistanceMeters() !== null"
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(1000)"
                  class="min-h-11 px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer"
                  [class.bg-[var(--brand-primary)]]="maxDistanceMeters() === 1000"
                  [class.text-[var(--brand-primary-fg)]]="maxDistanceMeters() === 1000"
                  [class.border-[var(--brand-primary)]]="maxDistanceMeters() === 1000"
                  [class.border-slate-200]="maxDistanceMeters() !== 1000"
                  [class.text-slate-700]="maxDistanceMeters() !== 1000"
                >
                  &lt; 1 km
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(3000)"
                  class="min-h-11 px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer"
                  [class.bg-[var(--brand-primary)]]="maxDistanceMeters() === 3000"
                  [class.text-[var(--brand-primary-fg)]]="maxDistanceMeters() === 3000"
                  [class.border-[var(--brand-primary)]]="maxDistanceMeters() === 3000"
                  [class.border-slate-200]="maxDistanceMeters() !== 3000"
                  [class.text-slate-700]="maxDistanceMeters() !== 3000"
                >
                  &lt; 3 km
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(5000)"
                  class="min-h-11 px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer"
                  [class.bg-[var(--brand-primary)]]="maxDistanceMeters() === 5000"
                  [class.text-[var(--brand-primary-fg)]]="maxDistanceMeters() === 5000"
                  [class.border-[var(--brand-primary)]]="maxDistanceMeters() === 5000"
                  [class.border-slate-200]="maxDistanceMeters() !== 5000"
                  [class.text-slate-700]="maxDistanceMeters() !== 5000"
                >
                  &lt; 5 km
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(10000)"
                  class="min-h-11 px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer col-span-2"
                  [class.bg-[var(--brand-primary)]]="maxDistanceMeters() === 10000"
                  [class.text-[var(--brand-primary-fg)]]="maxDistanceMeters() === 10000"
                  [class.border-[var(--brand-primary)]]="maxDistanceMeters() === 10000"
                  [class.border-slate-200]="maxDistanceMeters() !== 10000"
                  [class.text-slate-700]="maxDistanceMeters() !== 10000"
                >
                  &lt; 10 km
                </button>
              </div>
              @if (searchFilter().userLatitude == null || searchFilter().userLongitude == null) {
                <button
                  type="button"
                  data-testid="sidebar-locate-gps-btn"
                  (click)="locateNearbyOnMap()"
                  [disabled]="isMapLocating()"
                  class="mt-2.5 w-full min-h-11 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <i class="pi text-xs" [ngClass]="isMapLocating() ? 'pi-compass pi-spin' : 'pi-map-marker'"></i>
                  <span>{{ isMapLocating() ? 'Đang định vị...' : 'Định vị GPS gần tôi' }}</span>
                </button>
                <p class="mt-1 text-[11px] text-slate-500">
                  Bật GPS để đo khoảng cách thực tế từ vị trí của bạn
                </p>
              }
              @if (mapGeoError()) {
                <p role="alert" data-testid="sidebar-geo-error" class="mt-2 text-[11px] text-rose-700 font-medium">
                  {{ mapGeoError() }}
                </p>
              }
            </div>
          </aside>

          <!-- CỘT PHẢI: KẾT QUẢ TÌM KIẾM & DANH SÁCH KHÁCH SẠN (9 CỘT) -->
          <main class="lg:col-span-9 min-w-0 space-y-5">
            @if (promoCode(); as activePromo) {
              <div
                data-testid="active-promo-banner"
                class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <i class="pi pi-ticket text-sm" aria-hidden="true"></i>
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-emerald-950 truncate">
                      Đang áp dụng mã khuyến mãi: <span class="font-mono uppercase">{{ activePromo }}</span>
                    </p>
                    <p class="text-[11px] text-emerald-800">
                      Mã ưu đãi sẽ được tự động mang sang trang chi tiết và giữ phòng.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="clearPromoCode()"
                  aria-label="Xóa mã khuyến mãi"
                  class="min-h-11 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i class="pi pi-times text-[11px]" aria-hidden="true"></i>
                  <span>Bỏ mã</span>
                </button>
              </div>
            }

            @if (searchFilter().userLatitude != null && searchFilter().userLongitude != null) {
              <div
                data-testid="active-gps-banner"
                class="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <i class="pi pi-compass text-sm"></i>
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-indigo-950 truncate">
                      {{ activeGeoLabel() || 'Đang tìm chỗ nghỉ gần vị trí GPS của bạn' }}
                    </p>
                    <p class="text-[11px] text-indigo-700">
                      Ưu tiên sắp xếp theo khoảng cách gần nhất
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  @for (distOpt of [
                    { label: '< 1km', value: 1000 },
                    { label: '< 3km', value: 3000 },
                    { label: '< 5km', value: 5000 },
                    { label: '< 10km', value: 10000 },
                    { label: 'Tất cả', value: null }
                  ]; track distOpt.label) {
                    <button
                      type="button"
                      (click)="setMaxDistance(distOpt.value)"
                      class="min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer"
                      [class.bg-indigo-600]="maxDistanceMeters() === distOpt.value"
                      [class.text-white]="maxDistanceMeters() === distOpt.value"
                      [class.border-indigo-600]="maxDistanceMeters() === distOpt.value"
                      [class.bg-white]="maxDistanceMeters() !== distOpt.value"
                      [class.text-indigo-800]="maxDistanceMeters() !== distOpt.value"
                      [class.border-indigo-200]="maxDistanceMeters() !== distOpt.value"
                    >
                      {{ distOpt.label }}
                    </button>
                  }
                  <button
                    type="button"
                    (click)="clearGpsLocation()"
                    class="min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer ml-1"
                  >
                    Tắt định vị GPS
                  </button>
                </div>
              </div>
            }

            <!-- THANH ĐIỀU HƯỚNG KẾT QUẢ & SẮP XẾP -->
            <div
              class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
            >
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-slate-800 tabular-nums">
                    {{ totalResultCount() }} cơ sở lưu trú
                  </span>
                  <span class="text-xs text-slate-400">|</span>
                  <span class="text-xs text-slate-500">
                    Chế độ: <strong class="text-indigo-600">{{ getRentalModeLabel(searchFilter().rentalType) }}</strong>
                  </span>
                </div>

                <!-- Google Maps Platform View Switcher -->
                <div class="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80" role="group" aria-label="Chế độ hiển thị">
                  <button
                    type="button"
                    (click)="switchViewMode('list')"
                    class="min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    [class.bg-white]="viewMode() === 'list'"
                    [class.text-[var(--brand-primary)]]="viewMode() === 'list'"
                    [class.shadow-2xs]="viewMode() === 'list'"
                    [class.text-slate-500]="viewMode() !== 'list'"
                    [class.hover:text-slate-800]="viewMode() !== 'list'"
                  >
                    <i class="pi pi-list text-xs"></i>
                    <span>Danh sách</span>
                  </button>
                  <button
                    type="button"
                    (click)="switchViewMode('map')"
                    class="min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    [class.bg-[var(--brand-primary)]]="viewMode() === 'map'"
                    [class.text-[var(--brand-primary-fg)]]="viewMode() === 'map'"
                    [class.shadow-2xs]="viewMode() === 'map'"
                    [class.text-slate-500]="viewMode() !== 'map'"
                    [class.hover:text-slate-800]="viewMode() !== 'map'"
                  >
                    <i class="pi pi-map text-xs" [class.text-amber-500]="viewMode() !== 'map'"></i>
                    <span>Bản đồ Google Maps</span>
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <label for="sortBySelect" class="text-xs font-medium text-slate-500 whitespace-nowrap">
                  Sắp xếp:
                </label>
                <select
                  id="sortBySelect"
                  [ngModel]="sortBy()"
                  (ngModelChange)="onSortChange($event)"
                  class="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="recommended">Gợi ý hàng đầu</option>
                  <option value="price_asc">Giá: Thấp đến Cao</option>
                  <option value="price_desc">Giá: Cao đến Thấp</option>
                  <option value="rating_desc">Đánh giá cao nhất</option>
                  <option value="distance_asc">Khoảng cách gần nhất</option>
                </select>
              </div>
            </div>

            <!-- TRẠNG THÁI LOADING / ERROR / EMPTY -->
            @if (isLoading()) {
              <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <app-loading-spinner [loading]="true" />
              </div>
            } @else if (loadError()) {
              <div class="bg-white rounded-2xl border border-rose-200 p-12 text-center space-y-3">
                <i class="pi pi-exclamation-circle text-rose-500 text-3xl"></i>
                <h3 class="text-base font-bold text-slate-800">Không thể tải dữ liệu tìm kiếm</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto">
                  Đã có lỗi xảy ra trong quá trình truy vấn hệ thống. Vui lòng thử lại sau giây lát.
                </p>
                <button
                  type="button"
                  (click)="loadPublicProperties()"
                  class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 cursor-pointer"
                >
                  Tải lại
                </button>
              </div>
            } @else if (filteredProperties().length === 0) {
              <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                <div class="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-2xl">
                  <i class="pi pi-building text-2xl"></i>
                </div>
                <h3 class="text-base font-bold text-slate-800">Chưa tìm thấy cơ sở phù hợp</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Không có phòng nào đáp ứng trọn vẹn bộ lọc của bạn trong khoảng thời gian hoặc khu vực đã chọn. Quý khách vui lòng thử nới rộng bán kính, chọn ngày khác hoặc xóa bớt bộ lọc.
                </p>
                <button
                  type="button"
                  (click)="resetSidebarFilters()"
                  class="min-h-11 px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Xóa bộ lọc &amp; Xem tất cả
                </button>
              </div>
            } @else {
              @if (viewMode() === 'list') {
                <!-- DANH SÁCH THẺ KHÁCH SẠN (CARDS) -->
                <div class="space-y-4">
                  @for (property of paginatedProperties(); track property.propertyId) {
                    <article
                      class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col md:flex-row group"
                    >
                      <!-- Ảnh đại diện -->
                      <div class="relative md:w-72 h-52 md:h-auto shrink-0 overflow-hidden bg-slate-100">
                        @if (property.thumbnailUrl) {
                          <img
                            [src]="property.thumbnailUrl"
                            [alt]="property.name"
                            width="288"
                            height="208"
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        } @else {
                          <div class="w-full h-full min-h-[180px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-stone-200 text-slate-400 gap-1.5">
                            <i class="pi pi-building text-3xl text-slate-400"></i>
                            <span class="text-[11px] font-semibold text-slate-500">Chưa có ảnh cơ sở</span>
                          </div>
                        }
                        <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white">
                            {{ sanitizeVn(property.propertyTypeName || getPropertyTypeLabel(property.propertyType)) }}
                          </span>
                          @if (property.starRating && property.starRating >= 4) {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1">
                              <i class="pi pi-star-fill text-[9px]"></i>
                              <span>{{ property.starRating }} sao</span>
                            </span>
                          }
                        </div>

                        @if (property.galleryUrls?.length || property.thumbnailUrl) {
                          <button
                            type="button"
                            (click)="openGalleryModal(property)"
                            class="min-h-11 absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Xem toàn bộ ảnh"
                          >
                            <i class="pi pi-images text-xs"></i>
                            <span>Xem ảnh</span>
                          </button>
                        }
                      </div>

                      <!-- Thông tin chi tiết -->
                      <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <!-- Chuỗi & Tên khách sạn -->
                          <div class="flex items-start justify-between gap-2">
                            <div>
                              <span class="text-[11px] font-semibold text-[var(--brand-primary)] uppercase tracking-wider">
                                {{ property.tenantBrandName }}
                              </span>
                              <h3 class="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-[var(--brand-primary)] transition-colors mt-0.5">
                                <a [routerLink]="['/booking/properties', property.slug]" [queryParams]="propertyLinkQueryParams()">
                                  {{ property.name }}
                                </a>
                              </h3>
                              <p class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <i class="pi pi-map-marker text-slate-400 shrink-0"></i>
                                <span>{{ getPropertyAddress(property) }}</span>
                              </p>
                            </div>

                            <div class="shrink-0 text-right">
                              @if (property.reviewCount > 0 && property.ratingAverage > 0) {
                                <span class="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 tabular-nums">
                                  <i class="pi pi-star-fill text-amber-500 text-[10px]"></i>
                                  <span>{{ property.ratingAverage | number:'1.1-1' }}</span>
                                  <span class="text-[10px] text-slate-500">({{ property.reviewCount }})</span>
                                </span>
                              } @else {
                                <span class="text-[11px] text-slate-400 font-medium">Chưa có đánh giá</span>
                              }
                            </div>
                          </div>

                          <!-- Huy hiệu Địa danh & Cự ly (Chuẩn UTF-8) -->
                          <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                            @if (property.distanceFormatted || property.distanceMeters != null) {
                              <span
                                data-testid="property-distance-badge"
                                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular-nums"
                              >
                                <i class="pi pi-map-marker text-[10px] text-[var(--brand-primary)]"></i>
                                <span>{{ property.distanceFormatted || ('Cách ' + formatDistance(property.distanceMeters)) }}</span>
                              </span>
                            }

                            @if (property.isExpandedNearbySuggestion) {
                              <span
                                data-testid="expanded-nearby-badge"
                                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                Gợi ý mở rộng lân cận
                              </span>
                            }

                            @if (property.touristZoneName) {
                              <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                <i class="pi pi-compass text-[10px] text-[var(--brand-primary)]"></i>
                                <span>{{ sanitizeVn(property.touristZoneName) }}</span>
                              </span>
                            }

                            @for (landmark of property.nearbyLandmarks; track (landmark.landmarkId || landmark.name || $index)) {
                              <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 tabular-nums">
                                <i class="pi pi-flag-fill text-[9px] text-slate-400"></i>
                                <span>
                                  Cách {{ sanitizeVn(landmark.landmarkName || landmark.name) }}
                                  {{ formatDistance(landmark.distanceMeters) }}
                                </span>
                              </span>
                            }
                          </div>
                        </div>

                        <!-- Footer card: Giá & Nút Chọn phòng -->
                        <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span class="text-[11px] text-slate-500 block">
                              Giá khởi điểm ({{ getRentalModeLabel(searchFilter().rentalType) }})
                            </span>
                            <div class="flex items-baseline gap-1">
                              @if (property.startingPriceForSelectedMode > 0) {
                                <span class="text-lg sm:text-xl font-sans tabular-nums font-bold tracking-tight text-slate-900">
                                  {{ property.startingPriceForSelectedMode | vndCurrency }}
                                </span>
                                <span class="text-[11px] text-slate-500">/ {{ getPriceUnitShort(searchFilter().rentalType) }}</span>
                              } @else {
                                <span class="text-sm font-semibold text-slate-600">Liên hệ báo giá</span>
                              }
                            </div>
                          </div>

                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              (click)="selectPropertyForMap(property); switchViewMode('map')"
                              class="min-h-11 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Định vị trên Google Maps"
                            >
                              <i class="pi pi-map text-slate-500 text-xs"></i>
                              <span>Bản đồ</span>
                            </button>
                            <a
                              [routerLink]="['/booking/properties', property.slug]"
                              [queryParams]="propertyLinkQueryParams()"
                              class="min-h-11 px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] transition-all cursor-pointer shadow-2xs hover:shadow-xs inline-flex items-center gap-1.5"
                            >
                              <span>Xem phòng &amp; Đặt ngay</span>
                              <i class="pi pi-arrow-right text-[10px]"></i>
                            </a>
                          </div>
                        </div>
                      </div>
                    </article>
                  }
                </div>

                <!-- PHÂN TRANG (PAGINATION) -->
                @if (totalResultCount() > 0) {
                  <div class="pt-6 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xs">
                    <app-pagination
                      [page]="currentPage()"
                      [pageSize]="pageSize()"
                      [totalCount]="totalResultCount()"
                      (pageChange)="onPageChange($event)"
                      (pageSizeChange)="onPageSizeChange($event)"
                    />
                  </div>
                }
              } @else {
                <!-- GOOGLE MAPS PLATFORM RESPONSIVE SPLIT VIEW -->
                <div
                  class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
                  data-gmp-attribution="gmp_git_agentskills_v1"
                >
                  <!-- Cột danh sách cơ sở cuộn (5 cols) -->
                  <div class="lg:col-span-5 min-w-0 space-y-3 max-h-[700px] overflow-y-auto pr-1">
                    @for (property of filteredProperties(); track property.propertyId) {
                      <button
                        type="button"
                        (click)="selectPropertyForMap(property)"
                        class="w-full text-left p-3 bg-white rounded-2xl border transition-all cursor-pointer space-y-2 hover:shadow-md"
                        [ngClass]="selectedMapProperty()?.propertyId === property.propertyId ? 'border-[var(--brand-cta)] ring-2 ring-amber-200' : 'border-slate-200'"
                      >
                        <div class="flex gap-3">
                          @if (property.thumbnailUrl) {
                            <img
                              [src]="property.thumbnailUrl"
                              [alt]="property.name"
                              width="80"
                              height="80"
                              class="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-100"
                              loading="lazy"
                            />
                          } @else {
                            <div class="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <i class="pi pi-building text-xl"></i>
                            </div>
                          }
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1">
                              <span class="text-[10px] font-extrabold text-[var(--brand-cta)] uppercase tracking-wider truncate">
                                {{ property.tenantBrandName }}
                              </span>
                              @if (property.reviewCount > 0 && property.ratingAverage > 0) {
                                <span class="text-[10px] font-bold text-emerald-700 shrink-0 inline-flex items-center gap-0.5 tabular-nums">
                                  <i class="pi pi-star-fill text-[9px] text-amber-500"></i>
                                  <span>{{ property.ratingAverage | number:'1.1-1' }} ({{ property.reviewCount }})</span>
                                </span>
                              } @else {
                                <span class="text-[10px] text-slate-400 shrink-0">Chưa có đánh giá</span>
                              }
                            </div>
                            <h4 class="font-display text-sm font-bold text-slate-900 truncate mt-0.5">
                              {{ property.name }}
                            </h4>
                            <p class="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                              <i class="pi pi-map-marker text-[var(--brand-cta)] text-[10px]"></i>
                              <span>{{ property.wardName ? property.wardName + ', ' : '' }}{{ property.city || property.provinceName }}</span>
                            </p>
                            @if (property.distanceFormatted || property.distanceMeters != null || property.isExpandedNearbySuggestion) {
                              <div class="flex flex-wrap items-center gap-1 mt-1">
                                @if (property.distanceFormatted || property.distanceMeters != null) {
                                  <span
                                    data-testid="map-property-distance-badge"
                                    class="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums"
                                  >
                                    <i class="pi pi-map-marker text-[9px]"></i>
                                    <span>{{ property.distanceFormatted || ('Cách ' + formatDistance(property.distanceMeters)) }}</span>
                                  </span>
                                }
                                @if (property.isExpandedNearbySuggestion) {
                                  <span class="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    Gợi ý mở rộng lân cận
                                  </span>
                                }
                              </div>
                            }
                            <div class="flex items-center justify-between mt-2">
                              <span class="text-xs font-mono tabular-nums font-bold text-[var(--brand-cta)]">
                                {{ property.startingPriceForSelectedMode > 0 ? (property.startingPriceForSelectedMode | vndCurrency) : 'Báo giá' }}
                              </span>
                              <span
                                class="text-[10px] px-2 py-0.5 rounded-md font-semibold border"
                                [ngClass]="selectedMapProperty()?.propertyId === property.propertyId ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] border-[var(--brand-primary)]' : 'bg-emerald-50 text-emerald-700 border-emerald-100'"
                              >
                                {{ selectedMapProperty()?.propertyId === property.propertyId ? 'Đang hiển thị' : 'Định vị' }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    }
                  </div>

                  <!-- Cột bản đồ tương tác dính (7 cols) -->
                  <div
                    class="lg:col-span-7 min-w-0 lg:sticky lg:top-24 space-y-3"
                    style="content-visibility: auto; contain-intrinsic-size: auto none auto 580px;"
                  >
                    <div class="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden flex flex-col">
                      <!-- Thanh tiêu đề Toolbar bản đồ -->
                      <div class="p-3.5 bg-stone-50 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-stone-800 flex items-center gap-1.5">
                            <i class="pi pi-map text-emerald-700"></i>
                            <span>Google Maps Tương Tác</span>
                          </span>
                          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-900 border border-emerald-300">
                            GMP Verified
                          </span>
                          <button
                            type="button"
                            (click)="locateNearbyOnMap()"
                            [disabled]="isMapLocating()"
                            class="min-h-11 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <i class="pi text-[10px]" [ngClass]="isMapLocating() ? 'pi-compass pi-spin' : 'pi-map-marker'"></i>
                            <span>{{ isMapLocating() ? 'Đang định vị...' : 'Gần tôi' }}</span>
                          </button>
                          <div class="inline-flex rounded-lg bg-stone-200/70 p-0.5 text-[11px]">
                            <button
                              type="button"
                              (click)="mapDisplayMode.set('pins')"
                              class="min-h-11 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer inline-flex items-center tabular-nums"
                              [class.bg-white]="mapDisplayMode() === 'pins'"
                              [class.text-stone-900]="mapDisplayMode() === 'pins'"
                              [class.text-stone-600]="mapDisplayMode() !== 'pins'"
                            >
                              Đa điểm ({{ mapPins().length }})
                            </button>
                            <button
                              type="button"
                              (click)="mapDisplayMode.set('embed')"
                              class="min-h-11 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer inline-flex items-center"
                              [class.bg-white]="mapDisplayMode() === 'embed'"
                              [class.text-stone-900]="mapDisplayMode() === 'embed'"
                              [class.text-stone-600]="mapDisplayMode() !== 'embed'"
                            >
                              Google Maps
                            </button>
                          </div>
                        </div>
                        @if (selectedMapProperty(); as selected) {
                          <div class="flex items-center gap-2">
                            <a
                              [href]="getGoogleMapsDirectionsUrl(selected)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="min-h-11 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Chỉ đường Google Maps"
                            >
                              <i class="pi pi-directions text-[var(--brand-primary-fg)] text-[10px]"></i>
                              <span>Chỉ đường</span>
                            </a>
                            @if (selected.latitude && selected.longitude) {
                              <a
                                [href]="getGoogleMapsStreetViewUrl(selected)"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="min-h-11 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[var(--brand-cta)] border border-amber-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Xem Street View 360°"
                              >
                                <i class="pi pi-eye text-[10px]"></i>
                                <span>Street View</span>
                              </a>
                            }
                          </div>
                        }
                      </div>
                      @if (mapGeoError()) {
                        <p role="alert" class="px-3.5 py-2 bg-rose-50 text-rose-700 text-[11px] font-medium border-b border-rose-100">
                          {{ mapGeoError() }}
                        </p>
                      }

                      <!-- Multi-Pin Interactive Coordinate Map & Google Maps Embed -->
                      <div class="relative w-full h-[440px] lg:h-[500px] bg-stone-100">
                        @if (mapDisplayMode() === 'pins') {
                          <div
                            data-testid="multi-pin-map-canvas"
                            class="relative w-full h-full overflow-hidden bg-gradient-to-br from-emerald-50 via-stone-50 to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/60 select-none"
                          >
                            <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-35 text-slate-400" aria-hidden="true">
                              <defs>
                                <pattern id="mapGrid" width="48" height="48" patternUnits="userSpaceOnUse">
                                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" stroke-width="0.6" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill="url(#mapGrid)" />
                            </svg>

                            @if (mapPins().length === 0) {
                              <div class="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                                <i class="pi pi-map-marker text-3xl text-stone-400"></i>
                                <p class="text-xs font-bold text-stone-700">Các cơ sở hiện tại chưa có tọa độ GPS</p>
                                <button
                                  type="button"
                                  (click)="mapDisplayMode.set('embed')"
                                  class="min-h-11 px-3.5 py-2 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-xs font-semibold cursor-pointer inline-flex items-center"
                                >
                                  Chuyển sang Google Maps tìm theo địa chỉ
                                </button>
                              </div>
                            } @else {
                              @for (pin of mapPins(); track pin.property.propertyId) {
                                <button
                                  type="button"
                                  data-testid="map-pin-marker"
                                  (click)="selectPropertyForMap(pin.property)"
                                  [style.left.%]="pin.xPercent"
                                  [style.top.%]="pin.yPercent"
                                  [attr.aria-label]="pin.property.name"
                                  class="absolute -translate-x-1/2 -translate-y-1/2 min-h-11 px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums shadow-md border transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
                                  [ngClass]="selectedMapProperty()?.propertyId === pin.property.propertyId ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] border-[var(--brand-primary-fg)]/40 scale-110 z-20' : 'bg-white text-slate-900 border-stone-300 hover:z-10'"
                                  [title]="pin.property.name"
                                >
                                  <i class="pi pi-map-marker text-[10px]"></i>
                                  <span>{{ pin.priceLabel }}</span>
                                </button>
                              }

                              <div class="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-stone-200 text-[11px] text-stone-600 shadow-xs">
                                Đang hiển thị <strong class="text-stone-900 tabular-nums">{{ mapPins().length }}</strong> ghim tọa độ GPS
                              </div>
                            }
                          </div>
                        } @else if (googleMapSplitEmbedUrl(); as embedUrl) {
                          <iframe
                            [src]="embedUrl"
                            class="w-full h-full border-0"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            allowfullscreen
                            title="Bản đồ các cơ sở lưu trú"
                            aria-label="Bản đồ tương tác Google Maps hiển thị vị trí cơ sở lưu trú"
                          ></iframe>
                        }
                      </div>

                      <!-- Chi tiết nhanh cơ sở đang chọn trên bản đồ -->
                      @if (selectedMapProperty(); as selected) {
                        <div class="p-4 bg-white border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                          <div class="max-w-[65%]">
                            <div class="text-[10px] uppercase font-bold text-[var(--brand-cta)] tracking-wider">{{ selected.tenantBrandName }}</div>
                            <h4 class="font-display text-base font-bold text-stone-900 truncate">{{ selected.name }}</h4>
                            <p class="text-xs text-stone-500 truncate mt-0.5">{{ getPropertyAddress(selected) }}</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <a
                              [routerLink]="['/booking/properties', selected.slug]"
                              [queryParams]="propertyLinkQueryParams()"
                              class="min-h-11 px-4 py-2 rounded-xl bg-[var(--brand-cta)] hover:bg-[var(--brand-cta-hover)] text-[var(--brand-primary-fg)] text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <span>Xem phòng &amp; Đặt</span>
                              <i class="pi pi-arrow-right text-[10px]"></i>
                            </a>
                          </div>
                        </div>
                      } @else {
                        <div class="p-3 bg-stone-50 border-t border-stone-100 text-center text-xs text-stone-500">
                          Bấm vào một cơ sở ở danh sách bên trái để định vị chính xác và xem chỉ đường Google Maps.
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            }
          </main>
        </div>
      </div>

      <!-- MODAL: PHOTO GALLERY -->
      <app-photo-gallery-modal
        [isOpen]="!!selectedGalleryModal()"
        [title]="selectedGalleryModal()?.title ?? ''"
        [photos]="selectedGalleryModal()?.photos ?? []"
        (close)="closeGalleryModal()"
      />
    </div>
  `
})
export class ExploreSearchPageComponent implements OnInit {
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly locationService = inject(LocationService, { optional: true });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<boolean>(false);
  readonly properties = signal<PublicPropertyDto[]>([]);
  readonly liveZones = signal<TouristZoneDto[]>([]);
  readonly liveLandmarks = signal<LandmarkDto[]>([]);
  readonly destinationSuggestions = signal<DestinationSuggestionDto[]>([]);
  readonly smartFilterChips = signal<SuggestedFilterChipDto[]>([]);
  readonly activeGeoLabel = signal<string | null>(null);
  readonly promoCode = signal<string | null>(null);
  readonly isMapLocating = signal<boolean>(false);
  readonly mapGeoError = signal<string | null>(null);

  readonly viewMode = signal<'list' | 'map'>('list');
  readonly mapDisplayMode = signal<'pins' | 'embed'>('pins');
  readonly selectedMapProperty = signal<PublicPropertyDto | null>(null);
  readonly serverTotalCount = signal<number | null>(null);
  readonly usedServerPagination = signal<boolean>(false);

  readonly mapPins = computed<Array<{
    property: PublicPropertyDto;
    xPercent: number;
    yPercent: number;
    priceLabel: string;
  }>>(() => {
    const withCoords = this.filteredProperties().filter(
      p => p.latitude != null && p.longitude != null && p.latitude !== 0 && p.longitude !== 0
    );
    if (withCoords.length === 0) return [];

    const lats = withCoords.map(p => p.latitude!);
    const lngs = withCoords.map(p => p.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    return withCoords.map((p, idx) => {
      const xPercent = lngSpan > 0.0001
        ? 10 + ((p.longitude! - minLng) / lngSpan) * 80
        : 50 + ((idx % 3) - 1) * 10;
      const yPercent = latSpan > 0.0001
        ? 85 - ((p.latitude! - minLat) / latSpan) * 70
        : 50 + ((Math.floor(idx / 3) % 3) - 1) * 10;

      const price = p.startingPriceForSelectedMode;
      const priceLabel = price > 0
        ? (price >= 1000000 ? `${(price / 1000000).toFixed(1).replace(/\.0$/, '')}tr` : `${Math.round(price / 1000)}k`)
        : p.name.slice(0, 14);

      return {
        property: p,
        xPercent: Math.max(8, Math.min(92, xPercent)),
        yPercent: Math.max(12, Math.min(86, yPercent)),
        priceLabel,
      };
    });
  });

  readonly googleMapSplitEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const selected = this.selectedMapProperty();
    if (selected && selected.latitude && selected.longitude && selected.latitude !== 0 && selected.longitude !== 0) {
      const url = `https://maps.google.com/maps?q=${selected.latitude},${selected.longitude}+(${encodeURIComponent(selected.name)})&hl=vi&z=16&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    const filter = this.searchFilter();
    if (filter.userLatitude && filter.userLongitude) {
      const url = `https://maps.google.com/maps?q=${filter.userLatitude},${filter.userLongitude}&hl=vi&z=14&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    const list = this.filteredProperties();
    const firstWithCoord = list.find(p => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0);
    if (firstWithCoord) {
      const url = `https://maps.google.com/maps?q=${firstWithCoord.latitude},${firstWithCoord.longitude}+(${encodeURIComponent(firstWithCoord.name)})&hl=vi&z=14&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    const kw = filter.destinationKeyword?.trim();
    if (kw) {
      const url = `https://maps.google.com/maps?q=${encodeURIComponent(kw + ', Vietnam')}&hl=vi&z=13&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    const url = `https://maps.google.com/maps?q=Vietnam&hl=vi&z=6&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  getGoogleMapsDirectionsUrl(property?: PublicPropertyDto | null): string {
    if (!property) return 'https://www.google.com/maps?utm_campaign=gmp_git_agentskills_v1';
    if (property.latitude && property.longitude && property.latitude !== 0 && property.longitude !== 0) {
      return `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}&utm_campaign=gmp_git_agentskills_v1`;
    }
    const dest = encodeURIComponent(`${property.name}, ${property.addressLine || property.address || ''}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&utm_campaign=gmp_git_agentskills_v1`;
  }

  getGoogleMapsStreetViewUrl(property?: PublicPropertyDto | null): string {
    if (!property || !property.latitude || !property.longitude) return 'https://www.google.com/maps?utm_campaign=gmp_git_agentskills_v1';
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${property.latitude},${property.longitude}&utm_campaign=gmp_git_agentskills_v1`;
  }

  selectPropertyForMap(property: PublicPropertyDto): void {
    this.selectedMapProperty.set(property);
  }

  switchViewMode(mode: 'list' | 'map'): void {
    const previous = this.viewMode();
    this.viewMode.set(mode);
    if (mode === 'map') {
      this.ensureMapSelection();
      if (previous !== 'map' && this.usedServerPagination()) {
        this.loadPublicProperties();
      }
    } else if (previous !== 'list' && typeof this.publicBookingService.getPropertiesPaged === 'function') {
      this.loadPublicProperties();
    }
  }

  private ensureMapSelection(list: readonly PublicPropertyDto[] = this.filteredProperties()): void {
    const current = this.selectedMapProperty();
    if (current && list.some(p => p.propertyId === current.propertyId)) {
      return;
    }
    const firstWithCoord = list.find(
      p => p.latitude != null && p.longitude != null && p.latitude !== 0 && p.longitude !== 0
    ) ?? list[0] ?? null;
    this.selectedMapProperty.set(firstWithCoord);
  }

  readonly selectedTenantId = signal<string | null>(null);
  readonly maxDistanceMeters = signal<number | null>(null);
  readonly selectedPriceRangeKey = signal<string>('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly sortBy = signal<BookingSortOption>('recommended');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  readonly selectedGalleryModal = signal<{ title: string; photos: GalleryPhotoItem[] } | null>(null);

  readonly availablePropertyTypes: { label: string; value: PropertyType }[] = [
    { label: 'Khách sạn (Hotel)', value: 'Hotel' },
    { label: 'Resort nghỉ dưỡng', value: 'Resort' },
    { label: 'Homestay', value: 'Homestay' },
    { label: 'Biệt thự (Villa)', value: 'Villa' },
    { label: 'Căn hộ dịch vụ (Apartment)', value: 'Apartment' },
    { label: 'Nhà nghỉ / Nhà khách (Motel)', value: 'Motel' },
    { label: 'Hostel / Dorm', value: 'Hostel' },
    { label: 'Bed & Breakfast', value: 'BedAndBreakfast' },
  ];

  readonly priceRangeOptions = [
    { key: 'all', label: 'Tất cả mức giá', min: null, max: null },
    { key: 'under_500k', label: 'Dưới 500.000đ', min: null, max: 500000 },
    { key: '500k_1000k', label: '500.000đ - 1.000.000đ', min: 500000, max: 1000000 },
    { key: '1000k_2000k', label: '1.000.000đ - 2.000.000đ', min: 1000000, max: 2000000 },
    { key: 'above_2000k', label: 'Trên 2.000.000đ', min: 2000000, max: null },
  ];

  readonly searchFilter = signal<PublicBookingSearchFilter>({
    rentalType: 'Daily',
    destinationKeyword: '',
    provinceCode: null,
    touristZoneSlug: null,
    landmarkSlug: null,
    tenantSlug: null,
    propertyTypes: [],
    checkInDate: this.getTodayDateString(),
    checkOutDate: this.getNextDayDateString(),
    checkInTime: '12:00',
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

  readonly pageTitle = computed<string>(() => {
    const filter = this.searchFilter();
    const kw = filter.destinationKeyword;
    if (kw) return `Kết quả tìm kiếm cho "${kw}"`;
    if (filter.userLatitude != null && filter.userLongitude != null) {
      const label = this.activeGeoLabel();
      return label ? `Chỗ nghỉ gần ${label}` : 'Chỗ nghỉ gần vị trí của bạn';
    }
    return 'Khám phá Chỗ Nghỉ & Khách Sạn';
  });

  readonly propertyLinkQueryParams = computed<Record<string, unknown>>(() => {
    const code = this.promoCode();
    return code ? { ...this.searchFilter(), promoCode: code } : { ...this.searchFilter() };
  });

  readonly tenantBrandFacets = computed<TenantBrandFacet[]>(() => {
    const map = new Map<string, TenantBrandFacet>();
    for (const p of this.properties()) {
      if (!p.tenantId && !p.tenantSlug) continue;
      const key = p.tenantId || p.tenantSlug || '';
      const existing = map.get(key);
      if (existing) {
        existing.branchCount++;
        if (!existing.tenantSlug && p.tenantSlug) {
          existing.tenantSlug = p.tenantSlug;
        }
      } else {
        map.set(key, {
          tenantId: p.tenantId,
          tenantBrandName: p.tenantBrandName || 'Thương hiệu độc lập',
          tenantSlug: p.tenantSlug,
          branchCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.branchCount - a.branchCount);
  });

  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const raw = this.properties();
    const filter = this.searchFilter();
    const tenantId = this.selectedTenantId();
    const selectedTypes = filter.propertyTypes;
    const filterTenantSlug = filter.tenantSlug;
    const maxDist = this.maxDistanceMeters();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const sort = this.sortBy();

    const list = raw.filter((prop) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(prop.propertyType)) {
        return false;
      }
      if (tenantId && prop.tenantId !== tenantId) return false;
      if (!tenantId && filterTenantSlug && prop.tenantSlug !== filterTenantSlug) return false;
      if (maxDist !== null && !prop.isExpandedNearbySuggestion) {
        const effectiveDist =
          prop.distanceMeters ??
          (prop.nearbyLandmarks?.length
            ? Math.min(...prop.nearbyLandmarks.map((l) => l.distanceMeters))
            : null);
        if (effectiveDist === null || effectiveDist > maxDist) return false;
      }
      const price = prop.startingPriceForSelectedMode;
      if ((minP !== null || maxP !== null) && !(price > 0)) return false;
      if (minP !== null && price < minP) return false;
      if (maxP !== null && price > maxP) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (a.isExpandedNearbySuggestion !== b.isExpandedNearbySuggestion) {
        return a.isExpandedNearbySuggestion ? 1 : -1;
      }
      if (sort === 'price_asc') return (a.startingPriceForSelectedMode || 0) - (b.startingPriceForSelectedMode || 0);
      if (sort === 'price_desc') return (b.startingPriceForSelectedMode || 0) - (a.startingPriceForSelectedMode || 0);
      if (sort === 'rating_desc') return (b.ratingAverage || 0) - (a.ratingAverage || 0);
      if (sort === 'distance_asc') {
        const distA =
          a.distanceMeters ??
          (a.nearbyLandmarks?.length ? Math.min(...a.nearbyLandmarks.map((l) => l.distanceMeters)) : 999999);
        const distB =
          b.distanceMeters ??
          (b.nearbyLandmarks?.length ? Math.min(...b.nearbyLandmarks.map((l) => l.distanceMeters)) : 999999);
        return distA - distB;
      }
      return 0;
    });
  });

  readonly totalResultCount = computed<number>(() => {
    const serverTotal = this.serverTotalCount();
    if (this.usedServerPagination() && serverTotal !== null) {
      return serverTotal;
    }
    return this.filteredProperties().length;
  });

  readonly totalPages = computed<number>(() => {
    return Math.ceil(this.totalResultCount() / this.pageSize());
  });

  readonly paginatedProperties = computed<PublicPropertyDto[]>(() => {
    if (this.usedServerPagination()) {
      return this.filteredProperties();
    }
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredProperties().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.seedDefaultDestinationSuggestions();
    this.loadLiveDestinationCatalog();
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const nonNegative = (value: unknown): number | null => {
          if (value == null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };
        const finiteCoord = (value: unknown): number | null => {
          if (value == null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const stay = readPublicStay(params);
        const promoParam =
          typeof params['promoCode'] === 'string' && params['promoCode'].trim()
            ? params['promoCode'].trim()
            : null;
        this.promoCode.set(promoParam);
        const rawKw = String(params['destinationKeyword'] ?? params['destination'] ?? params['search'] ?? '');
        const isGpsText =
          rawKw.includes('GPS') ||
          rawKw.includes('Vị trí hiện tại') ||
          rawKw.includes('Gần vị trí');
        const effectiveKw = isGpsText ? '' : rawKw;
        const selectedTenantParam =
          typeof params['selectedTenantId'] === 'string' && params['selectedTenantId']
            ? params['selectedTenantId']
            : null;
        const tenantSlugParam =
          typeof params['tenantSlug'] === 'string' && params['tenantSlug']
            ? params['tenantSlug']
            : null;
        const parsedPropertyTypes = Array.from(
          new Set(
            String(params['propertyTypes'] ?? '')
              .split(',')
              .map((t) => t.trim())
              .map((t) => (t === 'Guesthouse' ? 'Motel' : t))
              .filter((t): t is PropertyType => ALL_PROPERTY_TYPES.includes(t as PropertyType))
          )
        );

        const userLat = finiteCoord(params['userLatitude'] ?? params['lat']);
        const userLng = finiteCoord(params['userLongitude'] ?? params['lng']);
        const hasCoords = userLat !== null && userLng !== null;

        const maxDistParam = nonNegative(params['maxDistanceMeters'] ?? params['maxDistance']);
        let minP = nonNegative(params['minPrice']);
        let maxP = nonNegative(params['maxPrice']);
        if (minP !== null && maxP !== null && minP > maxP) {
          minP = null;
          maxP = null;
        }
        const matchedRange = this.priceRangeOptions.find(r => r.min === minP && r.max === maxP);
        const rawSort = String(params['sortBy'] ?? '');
        const validSorts: readonly BookingSortOption[] = ['recommended', 'price_asc', 'price_desc', 'rating_desc', 'distance_asc'];
        const resolvedSort: BookingSortOption = validSorts.includes(rawSort as BookingSortOption)
          ? (rawSort as BookingSortOption)
          : (hasCoords ? 'distance_asc' : 'recommended');
        const pageParam = nonNegative(params['page']);
        const pageSizeParam = nonNegative(params['pageSize']);
        const resolvedPage = pageParam && pageParam >= 1 ? Math.floor(pageParam) : 1;
        const resolvedPageSize = pageSizeParam && pageSizeParam >= 1 ? Math.floor(pageSizeParam) : 10;

        this.selectedTenantId.set(selectedTenantParam);
        this.maxDistanceMeters.set(maxDistParam);
        this.minPrice.set(minP);
        this.maxPrice.set(maxP);
        this.selectedPriceRangeKey.set(matchedRange ? matchedRange.key : 'custom');
        this.sortBy.set(resolvedSort);
        this.currentPage.set(resolvedPage);
        this.pageSize.set(resolvedPageSize);

        this.searchFilter.update((f) => ({
          ...f,
          ...stay,
          destinationKeyword: effectiveKw,
          provinceCode: params['provinceCode'] || params['province'] || null,
          touristZoneSlug: params['touristZoneSlug'] || params['zone'] || null,
          landmarkSlug: params['landmarkSlug'] || params['landmark'] || null,
          tenantSlug: tenantSlugParam,
          userLatitude: userLat,
          userLongitude: userLng,
          maxDistanceMeters: maxDistParam,
          minPrice: minP,
          maxPrice: maxP,
          sortBy: resolvedSort,
          page: resolvedPage,
          pageSize: resolvedPageSize,
          propertyTypes: parsedPropertyTypes,
        }));

        if (hasCoords) {
          this.resolveActiveGeoLabel(userLat!, userLng!);
        } else {
          this.activeGeoLabel.set(null);
        }

        this.loadPublicProperties();
      });
  }

  private resolveActiveGeoLabel(lat: number, lng: number): void {
    this.activeGeoLabel.set('Đang tìm chỗ nghỉ gần vị trí GPS của bạn');
    this.locationService
      ?.reverseGeocode(lat, lng)
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      ?.subscribe((info) => {
        const filter = this.searchFilter();
        if (filter.userLatitude !== lat || filter.userLongitude !== lng) return;
        if (info?.displayLabel) {
          this.activeGeoLabel.set(info.displayLabel.trim());
        }
      });
  }

  loadPublicProperties(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    const filter = this.searchFilter();
    const rawKw = filter.destinationKeyword?.trim() || '';
    const isGpsText =
      rawKw.includes('GPS') ||
      rawKw.includes('Vị trí hiện tại') ||
      rawKw.includes('Gần vị trí');
    const effectiveSearch = isGpsText ? undefined : (rawKw || undefined);

    const isListPaged =
      this.viewMode() === 'list' &&
      typeof this.publicBookingService.getPropertiesPaged === 'function';

    const serviceFilter: PublicPropertiesFilter = {
      search: effectiveSearch,
      destinationKeyword: effectiveSearch,
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
      latitude: filter.userLatitude ?? undefined,
      longitude: filter.userLongitude ?? undefined,
      minPrice: this.minPrice() ?? undefined,
      maxPrice: this.maxPrice() ?? undefined,
      guests: filter.guests > 0 ? filter.guests : undefined,
      checkInDate: filter.checkInDate || undefined,
      checkOutDate: filter.checkOutDate || undefined,
      sortBy: this.sortBy(),
      page: isListPaged ? this.currentPage() : undefined,
      pageSize: isListPaged ? this.pageSize() : undefined,
    };

    const request$ = isListPaged
      ? this.publicBookingService.getPropertiesPaged(serviceFilter).pipe(
          map(res => ({ items: res.items, totalCount: res.totalCount, serverPaged: true }))
        )
      : this.publicBookingService.getProperties(serviceFilter).pipe(
          map(items => ({ items: items || [], totalCount: (items || []).length, serverPaged: false }))
        );

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, totalCount, serverPaged }) => {
          this.isLoading.set(false);
          const mapped: PublicPropertyDto[] = (items || []).map((p) => {
            let price = p.dailyStartingPrice ?? p.startingPriceForSelectedMode ?? p.startingPrice ?? 0;
            if (filter.rentalType === 'Hourly') price = p.hourlyStartingPrice ?? price;
            if (filter.rentalType === 'Overnight') price = p.overnightStartingPrice ?? price;

            const resolvedThumb = resolvePropertyThumbnail(
              p.name,
              `${p.addressLine || p.address || ''} ${p.provinceName || p.city || ''} ${p.touristZoneName || ''}`,
              p.thumbnailUrl || p.imageUrl
            );
            const verifiedGallery = (p.galleryUrls ?? []).filter(
              url => typeof url === 'string' && url.trim().length > 0 && !url.toLowerCase().includes('images.unsplash.com')
            );

            return {
              ...p,
              propertyId: p.propertyId || p.id || '',
              nearbyLandmarks: p.nearbyLandmarks ?? [],
              allowedRentalTypes: p.allowedRentalTypes ?? [],
              startingPriceForSelectedMode: price,
              ratingAverage: p.ratingAverage ?? 0,
              reviewCount: p.reviewCount ?? 0,
              thumbnailUrl: resolvedThumb,
              galleryUrls: verifiedGallery.length > 0 ? verifiedGallery : (resolvedThumb ? [resolvedThumb] : []),
            };
          });
          this.usedServerPagination.set(serverPaged);
          this.serverTotalCount.set(serverPaged ? totalCount : null);
          this.properties.set(mapped);
          this.generateDynamicChips(mapped);
          this.refreshDestinationSuggestions(mapped);
          if (this.viewMode() === 'map') {
            this.ensureMapSelection(this.filteredProperties());
          }
        },
        error: () => {
          this.isLoading.set(false);
          this.loadError.set(true);
        },
      });
  }

  onFilterBarChange(filter: PublicBookingSearchFilter): void {
    const hasCoords = filter.userLatitude != null && filter.userLongitude != null;
    const nextSort: BookingSortOption = hasCoords
      ? (filter.sortBy === 'recommended' ? 'distance_asc' : filter.sortBy)
      : (this.sortBy() === 'distance_asc' ? 'recommended' : this.sortBy());

    this.sortBy.set(nextSort);
    this.searchFilter.set({
      ...filter,
      maxDistanceMeters: this.maxDistanceMeters(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      sortBy: nextSort,
    });
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  selectTenantBrand(id: string | null): void {
    this.selectedTenantId.set(id);
    if (!id) {
      this.searchFilter.update((f) => ({ ...f, tenantSlug: null }));
    } else {
      const facet = this.tenantBrandFacets().find(t => t.tenantId === id);
      if (facet?.tenantSlug) {
        this.searchFilter.update((f) => ({ ...f, tenantSlug: facet.tenantSlug ?? null }));
      }
    }
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  isPropertyTypeSelected(type: PropertyType): boolean {
    return this.searchFilter().propertyTypes.includes(type);
  }

  togglePropertyType(type: PropertyType): void {
    const cur = this.searchFilter().propertyTypes;
    const next = cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type];
    this.searchFilter.update((f) => ({ ...f, propertyTypes: next }));
    this.currentPage.set(1);
    this.onFilterBarChange(this.searchFilter());
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

  applyPriceRange(key: string, min: number | null, max: number | null): void {
    this.selectedPriceRangeKey.set(key);
    this.minPrice.set(min);
    this.maxPrice.set(max);
    this.searchFilter.update((f) => ({ ...f, minPrice: min, maxPrice: max }));
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  setMaxDistance(dist: number | null): void {
    this.maxDistanceMeters.set(dist);
    this.searchFilter.update((f) => ({ ...f, maxDistanceMeters: dist }));
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  onSortChange(sort: BookingSortOption): void {
    this.sortBy.set(sort);
    this.searchFilter.update((f) => ({ ...f, sortBy: sort }));
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  clearGpsLocation(): void {
    this.activeGeoLabel.set(null);
    this.maxDistanceMeters.set(null);
    const nextSort: BookingSortOption = this.sortBy() === 'distance_asc' ? 'recommended' : this.sortBy();
    this.sortBy.set(nextSort);
    this.searchFilter.update((f) => ({
      ...f,
      userLatitude: null,
      userLongitude: null,
      maxDistanceMeters: null,
      sortBy: nextSort,
    }));
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  locateNearbyOnMap(): void {
    this.mapGeoError.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.mapGeoError.set('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    this.isMapLocating.set(true);

    const onSuccess = (pos: GeolocationPosition): void => {
      this.isMapLocating.set(false);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      this.sortBy.set('distance_asc');
      this.searchFilter.update((f) => ({
        ...f,
        destinationKeyword: '',
        provinceCode: null,
        touristZoneSlug: null,
        landmarkSlug: null,
        userLatitude: lat,
        userLongitude: lng,
        sortBy: 'distance_asc',
      }));
      this.resolveActiveGeoLabel(lat, lng);
      this.currentPage.set(1);
      this.syncUrlQueryParams();
    };

    const onFinalError = (err: GeolocationPositionError): void => {
      this.isMapLocating.set(false);
      this.mapGeoError.set(
        err.code === 1
          ? 'Bạn đã từ chối quyền định vị GPS.'
          : 'Không thể lấy vị trí GPS hiện tại. Vui lòng thử lại.'
      );
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (stage1Err) => {
        if (stage1Err.code === 2 || stage1Err.code === 3) {
          navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000,
          });
          return;
        }
        onFinalError(stage1Err);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }

  resetSidebarFilters(): void {
    this.selectedTenantId.set(null);
    this.maxDistanceMeters.set(null);
    this.selectedPriceRangeKey.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('recommended');
    this.searchFilter.update((f) => ({
      ...f,
      propertyTypes: [],
      tenantSlug: null,
      maxDistanceMeters: null,
      minPrice: null,
      maxPrice: null,
      sortBy: 'recommended',
    }));
    this.currentPage.set(1);
    this.syncUrlQueryParams();
  }

  onSmartChipClick(chip: SuggestedFilterChipDto): void {
    if (chip.filterKey === 'maxDistanceMeters') {
      const val = Number(chip.filterValue);
      this.setMaxDistance(this.maxDistanceMeters() === val ? null : val);
    } else if (chip.filterKey === 'destinationKeyword') {
      const kw = String(chip.filterValue ?? '');
      this.searchFilter.update((f) => ({
        ...f,
        destinationKeyword: f.destinationKeyword === kw ? '' : kw,
      }));
      this.syncUrlQueryParams();
    } else if (chip.filterKey === 'maxPrice') {
      const maxP = Number(chip.filterValue);
      this.applyPriceRange(this.maxPrice() === maxP ? 'all' : 'custom', null, this.maxPrice() === maxP ? null : maxP);
    } else if (chip.filterKey === 'rentalType') {
      const rt = chip.filterValue as RentalType;
      this.searchFilter.update((f) => ({ ...f, rentalType: rt }));
      this.syncUrlQueryParams();
    }
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

  clearPromoCode(): void {
    this.promoCode.set(null);
    this.syncUrlQueryParams();
  }

  private syncUrlQueryParams(): void {
    const filter = this.searchFilter();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...filter,
        selectedTenantId: this.selectedTenantId(),
        maxDistanceMeters: this.maxDistanceMeters(),
        minPrice: this.minPrice(),
        maxPrice: this.maxPrice(),
        sortBy: this.sortBy(),
        page: this.currentPage(),
        pageSize: this.pageSize(),
        propertyTypes: filter.propertyTypes.join(','),
        promoCode: this.promoCode() || null,
      },
    });
  }

  private generateDynamicChips(props: readonly PublicPropertyDto[]): void {
    const chips: SuggestedFilterChipDto[] = [];
    const filter = this.searchFilter();
    const keyword = filter.destinationKeyword;
    const hasCoords = filter.userLatitude != null && filter.userLongitude != null;

    if (keyword || hasCoords) {
      const areaLabel = keyword || 'vị trí của bạn';
      chips.push({
        id: 'chip-near-1km',
        label: `Gần ${areaLabel} (< 1km)`,
        category: 'nearby',
        filterKey: 'maxDistanceMeters',
        filterValue: 1000,
      });
      chips.push({
        id: 'chip-near-3km',
        label: `Bán kính ${areaLabel} (< 3km)`,
        category: 'nearby',
        filterKey: 'maxDistanceMeters',
        filterValue: 3000,
      });
    }

    const landmarkCounts = new Map<string, number>();
    for (const p of props) {
      for (const lm of p.nearbyLandmarks ?? []) {
        const name = lm.landmarkName || lm.name;
        if (!name) continue;
        landmarkCounts.set(name, (landmarkCounts.get(name) ?? 0) + 1);
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

    const validPrices = props
      .map((p) => p.startingPriceForSelectedMode)
      .filter((p) => p > 0);

    if (validPrices.length > 0) {
      if (filter.rentalType === 'Hourly') {
        chips.push({
          id: 'chip-price-hourly-200k',
          label: 'Dưới 200k / 2h',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 200000,
        });
      } else {
        chips.push({
          id: 'chip-price-500k',
          label: 'Dưới 500k / đêm',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 500000,
        });
        chips.push({
          id: 'chip-price-1000k',
          label: 'Dưới 1 triệu / đêm',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 1000000,
        });
      }
    }

    if (filter.rentalType !== 'Hourly' && props.some((p) => p.allowedRentalTypes?.includes('Hourly'))) {
      chips.push({
        id: 'chip-mode-hourly',
        label: 'Có cho thuê theo giờ',
        category: 'rentalType',
        filterKey: 'rentalType',
        filterValue: 'Hourly',
      });
    }
    if (filter.rentalType !== 'Overnight' && props.some((p) => p.allowedRentalTypes?.includes('Overnight'))) {
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

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.searchFilter.update(f => ({ ...f, page }));
    this.syncUrlQueryParams();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onPageSizeChange(size: number): void {
    const nextSize = Number(size) > 0 ? Number(size) : 10;
    this.pageSize.set(nextSize);
    this.currentPage.set(1);
    this.searchFilter.update(f => ({ ...f, page: 1, pageSize: nextSize }));
    this.syncUrlQueryParams();
  }

  openGalleryModal(property: PublicPropertyDto): void {
    const urls = (property.galleryUrls?.length ? property.galleryUrls : (property.thumbnailUrl ? [property.thumbnailUrl] : []))
      .filter(u => typeof u === 'string' && u.trim().length > 0 && !u.toLowerCase().includes('images.unsplash.com'));
    if (urls.length === 0) return;

    const photos: GalleryPhotoItem[] = urls.map((url, idx) => ({
      url,
      title: `${property.name} - Ảnh ${idx + 1}`,
      category: 'Exterior',
    }));
    this.selectedGalleryModal.set({
      title: property.name,
      photos,
    });
  }

  closeGalleryModal(): void {
    this.selectedGalleryModal.set(null);
  }

  getRentalModeLabel(mode: RentalType): string {
    switch (mode) {
      case 'Hourly': return 'Theo giờ';
      case 'Overnight': return 'Qua đêm';
      default: return 'Theo ngày';
    }
  }

  getPriceUnitShort(mode: RentalType): string {
    switch (mode) {
      case 'Hourly': return 'giờ';
      case 'Overnight': return 'đêm qua đêm';
      default: return 'đêm';
    }
  }

  formatDistance(meters?: number): string {
    if (meters == null) return '';
    return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
  }

  getPropertyAddress(property: PublicPropertyDto): string {
    const mainAddr = property.addressLine || property.address || '';
    const parts = [mainAddr, property.wardName, property.city || property.provinceName].filter(Boolean);
    return this.sanitizeVn(parts.join(', ') || 'Chưa công bố địa chỉ');
  }

  sanitizeVn(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .replace(/TP\.\s*H\?\s*Ch\?\s*Minh/gi, 'TP. Hồ Chí Minh')
      .replace(/H\?\s*Ch\?\s*Minh/gi, 'Hồ Chí Minh')
      .replace(/H\?\s*Ch\s*Minh/gi, 'Hồ Chí Minh')
      .replace(/Qu\?n\s*1/gi, 'Quận 1')
      .replace(/Trung\s*T\?m/gi, 'Trung Tâm')
      .replace(/S\?n\s*bay\s*Qu\?c\s*t\?\s*T\?n\s*S\?n\s*Nh\?t/gi, 'Sân bay Quốc tế Tân Sơn Nhất')
      .replace(/T\?n\s*S\?n\s*Nh\?t/gi, 'Tân Sơn Nhất')
      .replace(/S\?n\s*bay/gi, 'Sân bay')
      .replace(/Ch\?\s*B\?n\s*Th\?nh/gi, 'Chợ Bến Thành')
      .replace(/Khch\s*s\?n|Kh\?ch\s*s\?n/gi, 'Khách sạn')
      .replace(/Nh\s*ngh\?|Nh\?\s*ngh\?/gi, 'Nhà nghỉ');
  }

  private getTodayDateString(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  }

  private getNextDayDateString(): string {
    const today = this.getTodayDateString();
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
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
}
