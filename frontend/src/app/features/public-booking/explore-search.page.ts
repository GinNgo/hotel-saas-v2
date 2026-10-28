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
import { readPublicStay } from '../../core/models/public-stay-context';
import { VIETNAM_34_PROVINCES } from '../../core/data/vietnam-provinces.data';
import { BookingFilterBarComponent } from './components/booking-filter-bar/booking-filter-bar.component';
import {
  BookingSortOption,
  DestinationSuggestionDto,
  PropertyType,
  PublicBookingSearchFilter,
  PublicPropertiesFilter,
  PublicPropertyDto,
  RentalType,
  SuggestedFilterChipDto,
} from '../../core/models/public-booking.model';
import { PublicBookingService } from '../../core/services/public-booking.service';
import {
  LoadingSpinnerComponent,
  PaginationComponent,
  PhotoGalleryModalComponent,
  GalleryPhotoItem,
} from '../../shared';

interface TenantBrandFacet {
  tenantId: string;
  tenantBrandName: string;
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#FBF9F5] font-sans pb-20">
      <!-- 1. TOP HEADER & SEARCH BAR BANNER -->
      <div class="bg-[#0D2E28] text-white pt-10 pb-12 px-4 sm:px-6 lg:px-8 border-b border-[#1A453D]">
        <div class="max-w-7xl mx-auto space-y-4">
          <!-- Breadcrumb -->
          <nav class="flex items-center gap-2 text-xs text-slate-400">
            <a routerLink="/booking" class="hover:text-white transition-colors">Trang chủ</a>
            <span>/</span>
            <span class="text-indigo-300 font-semibold">Tìm kiếm &amp; Lọc Chỗ Nghỉ</span>
          </nav>

          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 class="font-serif text-2xl sm:text-4xl font-normal text-[#FBF9F5] tracking-tight">
                {{ pageTitle() }}
              </h1>
              <p class="text-xs sm:text-sm text-slate-300 mt-1">
                Tìm thấy {{ filteredProperties().length }} cơ sở lưu trú phù hợp với tiêu chí của bạn
              </p>
            </div>
            <a
              routerLink="/booking"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors"
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
            class="mb-6 bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs flex items-center gap-2 overflow-x-auto"
            aria-label="Gợi ý bộ lọc thông minh AI"
          >
            <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-700 shrink-0 mr-1">
              <i class="pi pi-sparkles text-amber-500"></i>
              <span>Gợi ý nhanh AI:</span>
            </div>
            <div class="flex items-center gap-2 flex-nowrap">
              @for (chip of smartFilterChips(); track chip.id) {
                <button
                  type="button"
                  (click)="onSmartChipClick(chip)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap"
                  [class.bg-indigo-600]="isChipActive(chip)"
                  [class.text-white]="isChipActive(chip)"
                  [class.border-indigo-600]="isChipActive(chip)"
                  [class.bg-indigo-50]="!isChipActive(chip)"
                  [class.text-indigo-900]="!isChipActive(chip)"
                  [class.border-indigo-200]="!isChipActive(chip)"
                  [class.hover:bg-indigo-100]="!isChipActive(chip)"
                >
                  <span>{{ chip.label }}</span>
                  @if (chip.count) {
                    <span
                      class="text-[10px] px-1.5 py-0.2 rounded-full"
                      [class.bg-white/20]="isChipActive(chip)"
                      [class.bg-indigo-200/80]="!isChipActive(chip)"
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
            class="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 space-y-6 lg:sticky lg:top-6 shadow-2xs"
          >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="pi pi-sliders-h text-indigo-600"></i>
                <span>Bộ lọc chuyên sâu</span>
              </h2>
              <button
                type="button"
                (click)="resetSidebarFilters()"
                class="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
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
                    class="w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between"
                    [class.bg-indigo-50]="selectedPriceRangeKey() === range.key"
                    [class.text-indigo-700]="selectedPriceRangeKey() === range.key"
                    [class.font-bold]="selectedPriceRangeKey() === range.key"
                    [class.text-slate-700]="selectedPriceRangeKey() !== range.key"
                    [class.hover:bg-slate-50]="selectedPriceRangeKey() !== range.key"
                  >
                    <span>{{ range.label }}</span>
                    @if (selectedPriceRangeKey() === range.key) {
                      <i class="pi pi-check text-xs text-indigo-600"></i>
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
                  class="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer"
                  [class.bg-indigo-600]="maxDistanceMeters() === null"
                  [class.text-white]="maxDistanceMeters() === null"
                  [class.border-indigo-600]="maxDistanceMeters() === null"
                  [class.border-slate-200]="maxDistanceMeters() !== null"
                  [class.text-slate-700]="maxDistanceMeters() !== null"
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(1000)"
                  class="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer"
                  [class.bg-indigo-600]="maxDistanceMeters() === 1000"
                  [class.text-white]="maxDistanceMeters() === 1000"
                  [class.border-indigo-600]="maxDistanceMeters() === 1000"
                  [class.border-slate-200]="maxDistanceMeters() !== 1000"
                  [class.text-slate-700]="maxDistanceMeters() !== 1000"
                >
                  &lt; 1 km
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(3000)"
                  class="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer"
                  [class.bg-indigo-600]="maxDistanceMeters() === 3000"
                  [class.text-white]="maxDistanceMeters() === 3000"
                  [class.border-indigo-600]="maxDistanceMeters() === 3000"
                  [class.border-slate-200]="maxDistanceMeters() !== 3000"
                  [class.text-slate-700]="maxDistanceMeters() !== 3000"
                >
                  &lt; 3 km
                </button>
                <button
                  type="button"
                  (click)="setMaxDistance(5000)"
                  class="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer"
                  [class.bg-indigo-600]="maxDistanceMeters() === 5000"
                  [class.text-white]="maxDistanceMeters() === 5000"
                  [class.border-indigo-600]="maxDistanceMeters() === 5000"
                  [class.border-slate-200]="maxDistanceMeters() !== 5000"
                  [class.text-slate-700]="maxDistanceMeters() !== 5000"
                >
                  &lt; 5 km
                </button>
              </div>
            </div>
          </aside>

          <!-- CỘT PHẢI: KẾT QUẢ TÌM KIẾM & DANH SÁCH KHÁCH SẠN (9 CỘT) -->
          <main class="lg:col-span-9 space-y-5">
            <!-- THANH ĐIỀU HƯỚNG KẾT QUẢ & SẮP XẾP -->
            <div
              class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-800">
                  {{ filteredProperties().length }} cơ sở lưu trú
                </span>
                <span class="text-xs text-slate-400">|</span>
                <span class="text-xs text-slate-500">
                  Chế độ: <strong class="text-indigo-600">{{ getRentalModeLabel(searchFilter().rentalType) }}</strong>
                </span>
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
                  🏨
                </div>
                <h3 class="text-base font-bold text-slate-800">Chưa tìm thấy cơ sở phù hợp</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Không có phòng nào đáp ứng trọn vẹn bộ lọc của bạn trong khoảng thời gian hoặc khu vực đã chọn. Quý khách vui lòng thử nới rộng bán kính, chọn ngày khác hoặc xóa bớt bộ lọc.
                </p>
                <button
                  type="button"
                  (click)="resetSidebarFilters()"
                  class="px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Xóa bộ lọc &amp; Xem tất cả
                </button>
              </div>
            } @else {
              <!-- DANH SÁCH THẺ KHÁCH SẠN (CARDS) -->
              <div class="space-y-4">
                @for (property of paginatedProperties(); track property.propertyId) {
                  <article
                    class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col md:flex-row group"
                  >
                    <!-- Ảnh đại diện -->
                    <div class="relative md:w-72 h-52 md:h-auto shrink-0 overflow-hidden bg-slate-100">
                      <img
                        [src]="property.thumbnailUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'"
                        [alt]="property.name"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white">
                          {{ sanitizeVn(property.propertyTypeName || property.propertyType) }}
                        </span>
                        @if (property.starRating && property.starRating >= 4) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1">
                            <i class="pi pi-star-fill text-[9px]"></i>
                            <span>{{ property.starRating }}★</span>
                          </span>
                        }
                      </div>

                      <button
                        type="button"
                        (click)="openGalleryModal(property)"
                        class="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Xem toàn bộ ảnh"
                      >
                        <i class="pi pi-images text-xs"></i>
                        <span>Xem ảnh</span>
                      </button>
                    </div>

                    <!-- Thông tin chi tiết -->
                    <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <!-- Chuỗi & Tên khách sạn -->
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <span class="text-[11px] font-bold text-[#0D2E28] uppercase tracking-wider">
                              {{ property.tenantBrandName }}
                            </span>
                            <h3 class="font-serif text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#C05621] transition-colors mt-0.5">
                              <a [routerLink]="['/booking/properties', property.slug]" [queryParams]="searchFilter()">
                                {{ property.name }}
                              </a>
                            </h3>
                            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <i class="pi pi-map-marker text-indigo-600 shrink-0"></i>
                              <span>{{ getPropertyAddress(property) }}</span>
                            </p>
                          </div>

                          @if (property.starRating) {
                            <div class="flex items-center gap-0.5 text-amber-400 text-xs shrink-0">
                              @for (s of [1, 2, 3, 4, 5]; track s) {
                                <i class="pi" [class.pi-star-fill]="s <= property.starRating" [class.pi-star]="s > property.starRating"></i>
                              }
                            </div>
                          }
                        </div>

                        <!-- Huy hiệu Địa danh & Cự ly (Chuẩn UTF-8) -->
                        <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                          @if (property.touristZoneName) {
                            <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <i class="pi pi-compass text-[10px]"></i>
                              <span>{{ sanitizeVn(property.touristZoneName) }}</span>
                            </span>
                          }

                          @for (landmark of property.nearbyLandmarks; track landmark.landmarkId) {
                            <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              <i class="pi pi-flag-fill text-[9px] text-amber-600"></i>
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
                              <span class="text-lg font-mono font-extrabold text-[#C05621]">
                                {{ property.startingPriceForSelectedMode | number: '1.0-0' }}đ
                              </span>
                              <span class="text-[11px] text-slate-400">/ {{ getPriceUnitShort(searchFilter().rentalType) }}</span>
                            } @else {
                              <span class="text-sm font-bold text-slate-600">Liên hệ báo giá</span>
                            }
                          </div>
                        </div>

                        <div class="flex items-center gap-2">
                          <a
                            [routerLink]="['/booking/properties', property.slug]"
                            [queryParams]="searchFilter()"
                            class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C05621] hover:bg-[#a34315] text-white transition-all cursor-pointer shadow-sm hover:shadow inline-flex items-center gap-1.5"
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
              @if (totalPages() > 1) {
                <div class="pt-6">
                  <app-pagination
                    [page]="currentPage()"
                    [pageSize]="pageSize()"
                    [totalCount]="filteredProperties().length"
                    (pageChange)="onPageChange($event)"
                  />
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<boolean>(false);
  readonly properties = signal<PublicPropertyDto[]>([]);
  readonly destinationSuggestions = signal<DestinationSuggestionDto[]>([]);
  readonly smartFilterChips = signal<SuggestedFilterChipDto[]>([]);

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
    { label: 'Nhà nghỉ (Motel)', value: 'Motel' },
    { label: 'Homestay', value: 'Homestay' },
    { label: 'Nhà khách (Guesthouse)', value: 'Guesthouse' },
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
    const kw = this.searchFilter().destinationKeyword;
    if (kw) return `Kết quả tìm kiếm cho "${kw}"`;
    return 'Khám phá Chỗ Nghỉ & Khách Sạn';
  });

  readonly tenantBrandFacets = computed<TenantBrandFacet[]>(() => {
    const map = new Map<string, TenantBrandFacet>();
    for (const p of this.properties()) {
      const existing = map.get(p.tenantId);
      if (existing) {
        existing.branchCount++;
      } else {
        map.set(p.tenantId, {
          tenantId: p.tenantId,
          tenantBrandName: p.tenantBrandName || 'Thương hiệu độc lập',
          branchCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.branchCount - a.branchCount);
  });

  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const raw = this.properties();
    const tenantId = this.selectedTenantId();
    const maxDist = this.maxDistanceMeters();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const sort = this.sortBy();

    const list = raw.filter((prop) => {
      if (tenantId && prop.tenantId !== tenantId) return false;
      if (maxDist !== null) {
        if (prop.distanceMeters != null && prop.distanceMeters > maxDist) return false;
      }
      const price = prop.startingPriceForSelectedMode;
      if (minP !== null && price < minP) return false;
      if (maxP !== null && price > maxP) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === 'price_asc') return (a.startingPriceForSelectedMode || 0) - (b.startingPriceForSelectedMode || 0);
      if (sort === 'price_desc') return (b.startingPriceForSelectedMode || 0) - (a.startingPriceForSelectedMode || 0);
      if (sort === 'rating_desc') return (b.ratingAverage || 0) - (a.ratingAverage || 0);
      if (sort === 'distance_asc') return (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999);
      return 0;
    });
  });

  readonly totalPages = computed<number>(() => {
    return Math.ceil(this.filteredProperties().length / this.pageSize());
  });

  readonly paginatedProperties = computed<PublicPropertyDto[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredProperties().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.seedDefaultDestinationSuggestions();
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const stay = readPublicStay(params);
        const rawKw = String(params['destinationKeyword'] ?? params['destination'] ?? params['search'] ?? '');
        const isGpsText = rawKw.includes('📍') || rawKw.includes('GPS') || rawKw.includes('Vị trí hiện tại');
        const effectiveKw = isGpsText ? '' : rawKw;

        this.searchFilter.update((f) => ({
          ...f,
          ...stay,
          destinationKeyword: effectiveKw,
          provinceCode: params['provinceCode'] || params['province'] || null,
          touristZoneSlug: params['touristZoneSlug'] || params['zone'] || null,
          landmarkSlug: params['landmarkSlug'] || params['landmark'] || null,
          userLatitude: params['userLatitude'] != null && Number.isFinite(Number(params['userLatitude'])) ? Number(params['userLatitude']) : (params['lat'] != null ? Number(params['lat']) : null),
          userLongitude: params['userLongitude'] != null && Number.isFinite(Number(params['userLongitude'])) ? Number(params['userLongitude']) : (params['lng'] != null ? Number(params['lng']) : null),
          maxDistanceMeters: params['maxDistanceMeters'] != null && Number.isFinite(Number(params['maxDistanceMeters'])) ? Number(params['maxDistanceMeters']) : (params['maxDistance'] != null ? Number(params['maxDistance']) : null),
          propertyTypes: String(params['propertyTypes'] ?? '')
            .split(',')
            .filter((t): t is PropertyType => ['Hotel', 'Motel', 'Guesthouse', 'Homestay', 'Resort'].includes(t as PropertyType)),
        }));
        this.loadPublicProperties();
      });
  }

  loadPublicProperties(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    const filter = this.searchFilter();
    const rawKw = filter.destinationKeyword?.trim() || '';
    const isGpsText = rawKw.includes('📍') || rawKw.includes('GPS') || rawKw.includes('Vị trí hiện tại');
    const effectiveSearch = isGpsText ? undefined : (rawKw || undefined);

    const serviceFilter: PublicPropertiesFilter = {
      search: effectiveSearch,
      destinationKeyword: effectiveSearch,
      rentalType: filter.rentalType === 'Hourly' ? 1 : filter.rentalType === 'Overnight' ? 2 : 3,
      touristZoneSlug: filter.touristZoneSlug || undefined,
      landmarkSlug: filter.landmarkSlug || undefined,
      maxDistanceKm: filter.maxDistanceMeters ? filter.maxDistanceMeters / 1000 : undefined,
      latitude: filter.userLatitude ?? undefined,
      longitude: filter.userLongitude ?? undefined,
      page: filter.page,
      pageSize: filter.pageSize,
    };

    this.publicBookingService
      .getProperties(serviceFilter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (props: PublicPropertyDto[]) => {
          this.isLoading.set(false);
          const mapped: PublicPropertyDto[] = (props || []).map((p: any) => {
            let price = p.dailyStartingPrice ?? p.startingPrice ?? 0;
            if (filter.rentalType === 'Hourly') price = p.hourlyStartingPrice ?? price;
            if (filter.rentalType === 'Overnight') price = p.overnightStartingPrice ?? price;

            return {
              ...p,
              propertyId: p.id || p.propertyId,
              startingPriceForSelectedMode: price,
              ratingAverage: p.ratingAverage ?? p.starRating ?? 4.5,
              reviewCount: p.reviewCount ?? 12,
              nearbyLandmarks: p.nearbyLandmarks ?? [],
              thumbnailUrl: p.imageUrl || p.thumbnailUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
            };
          });
          this.properties.set(mapped);
        },
        error: () => {
          this.isLoading.set(false);
          this.loadError.set(true);
        },
      });
  }

  onFilterBarChange(filter: PublicBookingSearchFilter): void {
    this.searchFilter.set(filter);
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...filter,
        propertyTypes: filter.propertyTypes.join(','),
      },
    });
  }

  selectTenantBrand(id: string | null): void {
    this.selectedTenantId.set(id);
    this.currentPage.set(1);
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

  applyPriceRange(key: string, min: number | null, max: number | null): void {
    this.selectedPriceRangeKey.set(key);
    this.minPrice.set(min);
    this.maxPrice.set(max);
    this.currentPage.set(1);
  }

  setMaxDistance(dist: number | null): void {
    this.maxDistanceMeters.set(dist);
    this.currentPage.set(1);
  }

  onSortChange(sort: BookingSortOption): void {
    this.sortBy.set(sort);
    this.currentPage.set(1);
  }

  resetSidebarFilters(): void {
    this.selectedTenantId.set(null);
    this.maxDistanceMeters.set(null);
    this.selectedPriceRangeKey.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('recommended');
    this.searchFilter.update((f) => ({ ...f, propertyTypes: [] }));
    this.currentPage.set(1);
    this.onFilterBarChange(this.searchFilter());
  }

  onSmartChipClick(chip: SuggestedFilterChipDto): void {
    if (chip.filterKey === 'maxDistanceMeters') {
      this.setMaxDistance(this.maxDistanceMeters() === chip.filterValue ? null : chip.filterValue);
    }
  }

  isChipActive(chip: SuggestedFilterChipDto): boolean {
    if (chip.filterKey === 'maxDistanceMeters') {
      return this.maxDistanceMeters() === chip.filterValue;
    }
    return false;
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openGalleryModal(property: PublicPropertyDto): void {
    const photos: GalleryPhotoItem[] = [
      {
        url: property.thumbnailUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
        title: property.name,
        category: 'Exterior',
      }
    ];
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
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private getNextDayDateString(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private seedDefaultDestinationSuggestions(): void {
    const list: DestinationSuggestionDto[] = [];
    for (const p of VIETNAM_34_PROVINCES) {
      list.push({
        id: `prov-${p.code}`,
        name: p.name,
        slug: p.id,
        type: 'Province',
        provinceCode: p.code,
        provinceName: p.name,
        propertyCount: p.propertyCount,
      });
      if (p.touristZone) {
        list.push({
          id: `zone-${p.id}`,
          name: p.touristZone,
          slug: p.id,
          type: 'TouristZone',
          provinceCode: p.code,
          provinceName: p.name,
          touristZoneName: p.touristZone,
        });
      }
      for (const lm of p.hotLandmarks) {
        list.push({
          id: `lm-${p.code}-${lm.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: lm,
          slug: lm.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          type: 'Landmark',
          provinceCode: p.code,
          provinceName: p.name,
          touristZoneName: p.touristZone,
        });
      }
    }
    this.destinationSuggestions.set(list);
  }
}
