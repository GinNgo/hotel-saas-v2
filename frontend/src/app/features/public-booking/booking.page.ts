import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingFilterBarComponent } from './components/booking-filter-bar/booking-filter-bar.component';
import { PopularDestinationsComponent } from './components/popular-destinations/popular-destinations.component';
import { AiConciergeWidgetComponent } from './ai-concierge-widget/ai-concierge-widget.component';
import {
  BookingSortOption,
  DestinationSuggestionDto,
  PropertyType,
  PublicBookingSearchFilter,
  PublicPropertyDto,
  PublicRoomTypeAvailabilityDto,
  RentalType,
  SuggestedFilterChipDto,
} from '../../core/models/public-booking.model';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
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
  branchCount: number;
}

@Component({
  selector: 'app-booking-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BookingFilterBarComponent,
    PopularDestinationsComponent,
    AiConciergeWidgetComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    PhotoGalleryModalComponent,
    RoomDetailModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 pb-16">
      <!-- HERO BANNER & THANH TÌM KIẾM ĐA NĂNG -->
      <div
        class="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8"
      >
        <div class="max-w-7xl mx-auto">
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-3"
              >
                <i class="pi pi-verified"></i>
                Hệ thống Đặt phòng Đa Chi nhánh • Hotel, Motel, Nhà nghỉ & Homestay
              </span>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Đặt phòng theo Địa danh, Khu du lịch & Khung giờ linh hoạt
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-indigo-200 max-w-md">
              Tồn kho thời gian thực đồng bộ trực tiếp với lễ tân từng cơ sở. Hỗ trợ giữ chỗ
              tức thì theo giờ, qua đêm và dài ngày.
            </p>
          </div>

          <!-- Component Thanh Tìm Kiếm -->
          <app-booking-filter-bar
            [initialFilter]="searchFilter()"
            [suggestions]="destinationSuggestions()"
            (filterChange)="onFilterBarChange($event)"
          />
        </div>
      </div>

      <!-- NỘI DUNG CHÍNH -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <!-- Điểm đến & Khu du lịch nổi bật -->
        <div class="mb-6">
          <app-popular-destinations
            (selectDestination)="onPopularDestinationClick($event)"
          />
        </div>

        <!-- SMART AI FILTER CHIPS ROW -->
        @if (smartFilterChips().length > 0) {
          <div
            class="mb-6 bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-2 overflow-x-auto"
            aria-label="Gợi ý bộ lọc thông minh AI"
          >
            <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-700 shrink-0 mr-1">
              <i class="pi pi-sparkles text-amber-500"></i>
              <span>Gợi ý AI & Gần đó:</span>
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
          <!-- SIDEBAR BỘ LỌC CHUYÊN SÂU (3 CỘT) -->
          <aside
            class="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-6 sticky top-4"
          >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="pi pi-Sliders-h text-indigo-600"></i>
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

            <!-- 1. Lọc theo Chuỗi Thương hiệu (Parent Tenant) -->
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
                      <span>Tất cả chuỗi & cơ sở</span>
                    </span>
                  </label>
                  @for (brand of tenantBrandFacets(); track brand.tenantId) {
                    <label
                      class="flex items-center justify-between text-xs text-slate-700 cursor-pointer hover:text-indigo-600"
                    >
                      <span class="flex items-center gap-2 truncate">
                        <input
                          type="radio"
                          name="tenantBrand"
                          [checked]="selectedTenantId() === brand.tenantId"
                          (change)="selectTenantBrand(brand.tenantId)"
                          class="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span class="truncate">{{ brand.tenantBrandName }}</span>
                      </span>
                      <span
                        class="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold"
                      >
                        {{ brand.branchCount }} cơ sở
                      </span>
                    </label>
                  }
                </div>
              </div>
            }

            <!-- 2. Lọc theo Khoảng cách tới Địa danh / Trung tâm -->
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Khoảng cách tới Địa danh
              </h3>
              <div class="space-y-2">
                @for (dist of distanceFilterOptions; track dist.label) {
                  <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="maxDistance"
                      [checked]="maxDistanceMeters() === dist.value"
                      (change)="setMaxDistance(dist.value)"
                      class="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{{ dist.label }}</span>
                  </label>
                }
              </div>
            </div>

            <!-- 3. Lọc theo Khoảng giá ({{ currentRentalModeLabel() }}) -->
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Ngân sách ({{ currentRentalModeLabel() }})
              </h3>
              <div class="space-y-2">
                @for (range of priceRangeOptions; track range.label) {
                  <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="priceRange"
                      [checked]="selectedPriceRangeKey() === range.key"
                      (change)="applyPriceRange(range.key, range.min, range.max)"
                      class="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{{ range.label }}</span>
                  </label>
                }
              </div>
            </div>
          </aside>

          <!-- DANH SÁCH CƠ SỞ LƯU TRÚ & HẠNG PHÒNG (9 CỘT) -->
          <main class="lg:col-span-9 space-y-4">
            <!-- Thanh trạng thái kết quả & Sắp xếp -->
            <div
              class="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p class="text-sm font-bold text-slate-800">
                  Tìm thấy
                  <span class="text-indigo-600">{{ filteredProperties().length }}</span>
                  cơ sở lưu trú phù hợp
                  @if (searchFilter().destinationKeyword) {
                    <span>tại "{{ searchFilter().destinationKeyword }}"</span>
                  }
                </p>
                <p class="text-xs text-slate-500">
                  Chế độ đang xem:
                  <strong class="text-slate-700">{{ currentRentalModeLabel() }}</strong>
                  @if (selectedTenantId()) {
                    <span> • Đang lọc theo chuỗi chi nhánh</span>
                  }
                </p>
              </div>

              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-500 font-medium">Sắp xếp:</label>
                <select
                  [ngModel]="sortBy()"
                  (ngModelChange)="onSortChange($event)"
                  class="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="recommended">Đề xuất tốt nhất</option>
                  <option value="distance_asc">Gần địa danh nhất</option>
                  <option value="price_asc">Giá thấp đến cao</option>
                  <option value="price_desc">Giá cao đến thấp</option>
                  <option value="rating_desc">Đánh giá cao nhất</option>
                </select>
              </div>
            </div>

            <!-- Trạng thái Loading -->
            @if (isLoading()) {
              <div class="bg-white rounded-2xl p-12 border border-slate-200 flex justify-center">
                <app-loading-spinner />
              </div>
            } @else if (filteredProperties().length === 0) {
              <div class="bg-white rounded-2xl p-8 border border-slate-200">
                <app-empty-state
                  title="Không tìm thấy cơ sở lưu trú phù hợp"
                  description="Hãy thử mở rộng khoảng cách tới địa danh, chuyển sang chế độ thuê khác hoặc xóa bớt bộ lọc loại hình."
                />
              </div>
            } @else {
              <!-- Danh sách Thẻ Cơ sở Lưu trú (Property Cards) -->
              @for (property of filteredProperties(); track property.propertyId) {
                <article
                  class="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 overflow-hidden transition-all"
                >
                  <div class="grid grid-cols-1 md:grid-cols-12">
                    <!-- Ảnh đại diện & Thư viện ảnh cơ sở (4 cột) -->
                    <div class="md:col-span-4 relative group bg-slate-100 min-h-56">
                      <img
                        [src]="property.thumbnailUrl"
                        [alt]="property.name"
                        class="w-full h-full object-cover"
                      />
                      <!-- Badge Loại hình (Hotel / Nhà nghỉ / Motel / Homestay) -->
                      <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span
                          class="px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm"
                          [ngClass]="getPropertyTypeBadgeClass(property.propertyType)"
                        >
                          {{ getPropertyTypeLabel(property.propertyType) }}
                        </span>
                        <span
                          class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/80 text-white backdrop-blur-sm"
                        >
                          {{ property.tenantBrandName }}
                        </span>
                      </div>

                      <!-- Nút mở Gallery ảnh -->
                      <button
                        type="button"
                        (click)="openPhotoGallery(property)"
                        class="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <i class="pi pi-images"></i>
                        <span>Xem ảnh ({{ property.galleryUrls.length || 1 }})</span>
                      </button>
                    </div>

                    <!-- Thông tin Cơ sở, Địa danh & Hạng phòng (8 cột) -->
                    <div class="md:col-span-8 p-5 flex flex-col justify-between">
                      <div>
                        <!-- Header Thẻ: Tên Chi nhánh + Điểm đánh giá -->
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <div class="flex items-center gap-2 flex-wrap">
                              <h3 class="text-lg font-bold text-slate-900">
                                {{ property.name }}
                              </h3>
                              @if (property.starRating) {
                                <span class="text-amber-400 text-xs">
                                  {{ '★'.repeat(property.starRating) }}
                                </span>
                              }
                            </div>
                            <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <i class="pi pi-map-marker text-indigo-600"></i>
                              <span>
                                {{ property.addressLine }}, {{ property.wardName }},
                                {{ property.provinceName }}
                              </span>
                            </p>
                          </div>

                          <div class="text-right shrink-0">
                            <div
                              class="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1 rounded-xl text-xs font-bold"
                            >
                              <span>{{ property.ratingAverage | number: '1.1-1' }}</span>
                              <i class="pi pi-star-fill text-[10px]"></i>
                            </div>
                            <p class="text-[11px] text-slate-400 mt-0.5">
                              {{ property.reviewCount }} đánh giá
                            </p>
                          </div>
                        </div>

                        <!-- Badges Khu vực Du lịch & Khoảng cách tới Địa danh -->
                        <div class="flex flex-wrap items-center gap-2 mt-3">
                          @if (property.isExpandedNearbySuggestion) {
                            <span
                              class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              <i class="pi pi-sparkles text-[11px] text-indigo-600"></i>
                              <span>Gợi ý mở rộng gần đó</span>
                            </span>
                          }

                          @if (property.distanceFormatted) {
                            <span
                              class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              <i class="pi pi-map-marker text-[11px] text-blue-600"></i>
                              <span>{{ property.distanceFormatted }}</span>
                            </span>
                          }

                          @if (property.touristZoneName) {
                            <span
                              class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <i class="pi pi-compass text-[11px]"></i>
                              <span>Khu du lịch: {{ property.touristZoneName }}</span>
                            </span>
                          }

                          @for (landmark of property.nearbyLandmarks; track landmark.landmarkId) {
                            <span
                              class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
                            >
                              <i class="pi pi-flag-fill text-[10px] text-amber-600"></i>
                              <span>
                                Cách {{ landmark.landmarkName }}
                                {{ formatDistance(landmark.distanceMeters) }}
                              </span>
                            </span>
                          }

                          <!-- Các chế độ lưu trú cơ sở hỗ trợ -->
                          @for (mode of property.allowedRentalTypes; track mode) {
                            <span
                              class="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                            >
                              {{ getRentalModeTag(mode) }}
                            </span>
                          }
                        </div>

                        <!-- Danh sách Hạng phòng trống tại Chi nhánh này -->
                        <div class="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                          @for (roomType of property.availableRoomTypes; track roomType.roomTypeId) {
                            <div
                              class="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div class="flex items-center gap-2">
                                  <span class="font-bold text-sm text-slate-800">
                                    {{ roomType.name }}
                                  </span>
                                  <span
                                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                    [class.bg-rose-100]="roomType.availableRoomsCount <= 2"
                                    [class.text-rose-700]="roomType.availableRoomsCount <= 2"
                                    [class.bg-emerald-100]="roomType.availableRoomsCount > 2"
                                    [class.text-emerald-700]="roomType.availableRoomsCount > 2"
                                  >
                                    Còn {{ roomType.availableRoomsCount }} phòng trống
                                  </span>
                                </div>
                                <p class="text-xs text-slate-500 mt-0.5">
                                  {{ roomType.bedConfiguration }} • {{ roomType.areaSqm }}m² • Tối
                                  đa {{ roomType.maxGuests }} khách
                                </p>
                                <button
                                  type="button"
                                  (click)="openRoomDetailModal(property, roomType)"
                                  class="text-xs text-indigo-600 hover:underline font-medium mt-1 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Xem chi tiết & chính sách phụ thu</span>
                                  <i class="pi pi-angle-right text-[10px]"></i>
                                </button>
                              </div>

                              <!-- Cột Giá theo Chế độ đang chọn & Nút Giữ chỗ -->
                              <div class="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-2">
                                <div>
                                  <div class="text-lg font-extrabold text-indigo-600">
                                    {{
                                      getRoomDisplayPrice(roomType)
                                        | number: '1.0-0'
                                    }}đ
                                  </div>
                                  <p class="text-[11px] text-slate-500">
                                    {{ getRoomPriceUnitLabel(roomType) }}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  (click)="createHoldAndProceed(property, roomType)"
                                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
                                >
                                  Giữ phòng ngay
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              }
            }
          </main>
        </div>
      </div>

      <!-- TRỢ LÝ AI TÌM PHÒNG TIẾNG VIỆT (KHÔNG BỊA GIÁ) -->
      <app-ai-concierge-widget (applyFilterChip)="onSmartChipClick($event)" />

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
        [propertyName]="selectedRoomPropertyName()"
        (close)="closeRoomDetailModal()"
        (select)="onRoomSelectedFromModal($event)"
      />
    </div>
  `,
})
export class BookingPageComponent implements OnInit {
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // --- SIGNALS TRẠNG THÁI TRANG ---
  readonly isLoading = signal<boolean>(false);
  readonly properties = signal<PublicPropertyDto[]>([]);
  readonly destinationSuggestions = signal<DestinationSuggestionDto[]>([]);
  readonly selectedTenantId = signal<string | null>(null);
  readonly maxDistanceMeters = signal<number | null>(null);
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
  readonly currentRentalModeLabel = computed<string>(() => {
    const mode = this.searchFilter().rentalType;
    if (mode === 'Hourly') return `Theo giờ (${this.searchFilter().durationHours} giờ)`;
    if (mode === 'Overnight') return 'Qua đêm (21:00 - 10:00)';
    return 'Theo ngày/đêm';
  });

  /** Tổng hợp danh sách Chuỗi thương hiệu (Parent Tenant) từ kết quả để khách lọc theo chuỗi */
  readonly tenantBrandFacets = computed<TenantBrandFacet[]>(() => {
    const map = new Map<string, TenantBrandFacet>();
    for (const prop of this.properties()) {
      const existing = map.get(prop.tenantId);
      if (existing) {
        existing.branchCount += 1;
      } else {
        map.set(prop.tenantId, {
          tenantId: prop.tenantId,
          tenantBrandName: prop.tenantBrandName,
          branchCount: 1,
        });
      }
    }
    return Array.from(map.values());
  });

  /** Lọc và sắp xếp danh sách cơ sở theo thời gian thực bằng Signals */
  readonly filteredProperties = computed<PublicPropertyDto[]>(() => {
    const filter = this.searchFilter();
    const tenantId = this.selectedTenantId();
    const maxDist = this.maxDistanceMeters();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const sort = this.sortBy();

    const list = this.properties().filter((prop) => {
      // 1. Cơ sở phải hỗ trợ chế độ thuê đang chọn (Hourly / Overnight / Daily)
      if (!prop.allowedRentalTypes.includes(filter.rentalType)) {
        return false;
      }
      // 2. Lọc theo loại hình (Hotel, Motel, Guesthouse/Nhà nghỉ, Homestay, Resort)
      if (
        filter.propertyTypes.length > 0 &&
        !filter.propertyTypes.includes(prop.propertyType)
      ) {
        return false;
      }
      // 3. Lọc theo Chuỗi thương hiệu (Tenant chính)
      if (tenantId && prop.tenantId !== tenantId) {
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
        }
      }
      // 5. Lọc theo ngân sách
      const price = prop.startingPriceForSelectedMode;
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
        return a.startingPriceForSelectedMode - b.startingPriceForSelectedMode;
      }
      if (sort === 'price_desc') {
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
    this.loadPublicProperties();
  }

  onPopularDestinationClick(destinationKeyword: string): void {
    this.searchFilter.update((prev) => ({
      ...prev,
      destinationKeyword,
    }));
    this.loadPublicProperties();
  }

  selectTenantBrand(tenantId: string | null): void {
    this.selectedTenantId.set(tenantId);
  }

  setMaxDistance(meters: number | null): void {
    this.maxDistanceMeters.set(meters);
  }

  applyPriceRange(key: string, min: number | null, max: number | null): void {
    this.selectedPriceRangeKey.set(key);
    this.minPrice.set(min);
    this.maxPrice.set(max);
  }

  onSortChange(sort: BookingSortOption): void {
    this.sortBy.set(sort);
  }

  resetSidebarFilters(): void {
    this.selectedTenantId.set(null);
    this.maxDistanceMeters.set(null);
    this.selectedPriceRangeKey.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('recommended');
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
      this.loadPublicProperties();
    } else if (chip.filterKey === 'maxPrice') {
      const current = this.maxPrice();
      this.maxPrice.set(current === chip.filterValue ? null : chip.filterValue);
    } else if (chip.filterKey === 'rentalType') {
      this.searchFilter.update((f) => ({
        ...f,
        rentalType: chip.filterValue,
      }));
      this.loadPublicProperties();
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

  private generateDynamicChips(props: PublicPropertyDto[]): void {
    const chips: SuggestedFilterChipDto[] = [];
    const keyword = this.searchFilter().destinationKeyword;

    if (keyword) {
      chips.push({
        id: 'chip-near-1km',
        label: `📍 Gần ${keyword} (< 1km)`,
        category: 'nearby',
        filterKey: 'maxDistanceMeters',
        filterValue: 1000,
      });
      chips.push({
        id: 'chip-near-3km',
        label: `📍 Bán kính ${keyword} (< 3km)`,
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
        label: `📍 ${name}`,
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
          label: '💰 Dưới 120k / 2h',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 120000,
        });
      } else {
        chips.push({
          id: 'chip-price-350k',
          label: '💰 Dưới 350k / đêm',
          category: 'price',
          filterKey: 'maxPrice',
          filterValue: 350000,
        });
        chips.push({
          id: 'chip-price-600k',
          label: '💰 Dưới 600k / đêm',
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
        label: '⏰ Có cho thuê theo giờ',
        category: 'rentalType',
        filterKey: 'rentalType',
        filterValue: 'Hourly',
      });
    }
    if (this.searchFilter().rentalType !== 'Overnight' && props.some((p) => p.allowedRentalTypes.includes('Overnight'))) {
      chips.push({
        id: 'chip-mode-overnight',
        label: '🌙 Thuê qua đêm',
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
      const baseHours = roomType.hourlyBaseHours ?? 2;
      const basePrice = roomType.hourlyBasePrice ?? roomType.calculatedQuoteTotal;
      const extraHours = Math.max(0, this.searchFilter().durationHours - baseHours);
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
      return `Trọn gói ${this.searchFilter().durationHours} giờ (${roomType.hourlyBaseHours ?? 2}h đầu + phụ thu)`;
    }
    if (mode === 'Overnight') {
      return 'Giá trọn gói qua đêm (21:00 - 10:00)';
    }
    return 'Giá mỗi đêm (đã gồm thuế phí cơ bản)';
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
    const photos: GalleryPhotoItem[] = (property.galleryUrls || []).map((url, i) => ({
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
    this.selectedRoomDetail.set(roomType);
    this.isRoomDetailOpen.set(true);
  }

  closeRoomDetailModal(): void {
    this.isRoomDetailOpen.set(false);
  }

  onRoomSelectedFromModal(roomType: PublicRoomTypeAvailabilityDto): void {
    this.isRoomDetailOpen.set(false);
    const prop = this.properties().find((p) => p.name === this.selectedRoomPropertyName());
    if (prop) {
      this.createHoldAndProceed(prop, roomType);
    }
  }

  // --- UI FORMATTERS ---
  getPropertyTypeLabel(type: PropertyType): string {
    switch (type) {
      case 'Hotel':
        return 'Khách sạn';
      case 'Guesthouse':
        return 'Nhà nghỉ';
      case 'Motel':
        return 'Motel';
      case 'Homestay':
        return 'Homestay';
      case 'Resort':
        return 'Resort';
    }
  }

  getPropertyTypeBadgeClass(type: PropertyType): string {
    switch (type) {
      case 'Hotel':
        return 'bg-indigo-600 text-white';
      case 'Guesthouse':
        return 'bg-emerald-600 text-white';
      case 'Motel':
        return 'bg-amber-500 text-slate-950';
      case 'Homestay':
        return 'bg-rose-500 text-white';
      case 'Resort':
        return 'bg-cyan-600 text-white';
    }
  }

  getRentalModeTag(mode: RentalType): string {
    switch (mode) {
      case 'Hourly':
        return '⚡ Nhận theo giờ';
      case 'Overnight':
        return '🌙 Nhận qua đêm';
      case 'Daily':
        return '📅 Nhận theo ngày';
    }
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  private loadPublicProperties(): void {
    this.isLoading.set(true);
    const filter = this.searchFilter();

    const serviceFilter = {
      search: filter.destinationKeyword || undefined,
      destinationKeyword: filter.destinationKeyword || undefined,
      rentalType: filter.rentalType === 'Hourly' ? 1 : filter.rentalType === 'Overnight' ? 2 : 3,
      touristZoneSlug: filter.touristZoneSlug || undefined,
      landmarkSlug: filter.landmarkSlug || undefined,
      maxDistanceKm: filter.maxDistanceMeters ? filter.maxDistanceMeters / 1000 : undefined,
      maxDistanceMeters: filter.maxDistanceMeters ?? undefined,
      userLatitude: filter.userLatitude ?? undefined,
      userLongitude: filter.userLongitude ?? undefined,
      page: filter.page,
      pageSize: filter.pageSize,
    };

    this.publicBookingService.getProperties(serviceFilter).subscribe({
      next: (props) => {
        if (props && props.length > 0) {
          const mappedList: PublicPropertyDto[] = props.map((p: any) => {
            const allowedModes: RentalType[] = [
              ...(p.allowDailyBooking !== false ? ['Daily' as RentalType] : []),
              ...(p.allowHourlyBooking !== false ? ['Hourly' as RentalType] : []),
              ...(p.allowOvernightBooking !== false ? ['Overnight' as RentalType] : []),
            ];

            const landmarks = (p.nearbyLandmarks || []).map((l: any, idx: number) => ({
              landmarkId: l.landmarkId || `lm-${idx}`,
              landmarkName: l.name || l.landmarkName || 'Địa danh',
              landmarkSlug: l.slug || l.landmarkSlug || 'dia-danh',
              category: (l.category || 'Center') as any,
              distanceMeters: l.distanceMeters ?? Math.round((l.distanceKm ?? 0.5) * 1000),
            }));

            let startPrice = p.startingPrice || 350000;
            if (filter.rentalType === 'Hourly' && p.hourlyStartingPrice) {
              startPrice = p.hourlyStartingPrice;
            } else if (filter.rentalType === 'Overnight' && p.overnightStartingPrice) {
              startPrice = p.overnightStartingPrice;
            } else if (filter.rentalType === 'Daily' && p.dailyStartingPrice) {
              startPrice = p.dailyStartingPrice;
            }

            const pType: PropertyType = (typeof p.propertyType === 'string'
              ? p.propertyType
              : (p.propertyTypeName || 'Hotel')) as PropertyType;

            return {
              propertyId: p.propertyId || p.id || '',
              id: p.id || p.propertyId,
              tenantId: p.tenantId || 'tenant-hq-01',
              tenantBrandName: p.tenantBrandName || p.name || 'Hệ thống Khách sạn & Nhà nghỉ liên kết',
              name: p.name,
              code: p.code || '',
              slug: p.slug,
              propertyType: pType,
              starRating: p.starRating ?? 4,
              addressLine: p.addressLine || p.address || 'Đường Lê Đại Hành',
              address: p.address || p.addressLine || 'Đường Lê Đại Hành',
              wardName: p.wardName || 'Phường 1',
              city: p.city || 'Đà Lạt',
              provinceCode: p.provinceCode || '68',
              provinceName: p.provinceName || p.city || 'Lâm Đồng',
              touristZoneName: p.touristZoneName || 'Trung tâm Đà Lạt',
              touristZoneSlug: p.touristZoneSlug || '',
              latitude: p.latitude,
              longitude: p.longitude,
              thumbnailUrl: p.thumbnailUrl || p.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
              imageUrl: p.imageUrl || p.thumbnailUrl,
              galleryUrls: p.galleryUrls || [
                p.thumbnailUrl || p.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
              ],
              allowedRentalTypes: allowedModes.length > 0 ? allowedModes : ['Daily', 'Hourly', 'Overnight'],
              allowHourlyBooking: p.allowHourlyBooking,
              allowOvernightBooking: p.allowOvernightBooking,
              allowDailyBooking: p.allowDailyBooking,
              overnightCheckInTime: p.overnightCheckInTime || '21:00',
              overnightCheckOutTime: p.overnightCheckOutTime || '10:00',
              cleaningBufferMinutes: p.cleaningBufferMinutes || p.bufferMinutes || 30,
              ratingAverage: p.ratingAverage ?? 4.8,
              reviewCount: p.reviewCount ?? 128,
              nearbyLandmarks: landmarks,
              startingPriceForSelectedMode: startPrice,
              startingPrice: startPrice,
              distanceMeters: p.distanceMeters,
              distanceFormatted: p.distanceFormatted,
              isExpandedNearbySuggestion: p.isExpandedNearbySuggestion ?? false,
              availableRoomTypes: (p.availableRoomTypes && p.availableRoomTypes.length > 0)
                ? p.availableRoomTypes.map((rt: any) => ({
                    roomTypeId: rt.roomTypeId || rt.id || 'rt-1',
                    name: rt.name || rt.roomTypeName || 'Phòng Tiêu Chuẩn',
                    roomTypeName: rt.roomTypeName || rt.name || 'Phòng Tiêu Chuẩn',
                    code: rt.code || 'STD',
                    maxGuests: rt.maxGuests || rt.maxOccupancy || 2,
                    maxOccupancy: rt.maxOccupancy || rt.maxGuests || 2,
                    bedConfiguration: rt.bedConfiguration || rt.bedType || '1 giường đôi Queen',
                    bedType: rt.bedType || rt.bedConfiguration || '1 giường đôi Queen',
                    areaSqm: rt.areaSqm || rt.squareMeters || 25,
                    squareMeters: rt.squareMeters || rt.areaSqm || 25,
                    availableRoomsCount: rt.availableRoomsCount ?? rt.availableRooms ?? 3,
                    availableRooms: rt.availableRooms ?? rt.availableRoomsCount ?? 3,
                    totalRooms: rt.totalRooms || 5,
                    isAvailable: rt.isAvailable !== false,
                    amenities: rt.amenities || ['Wifi miễn phí', 'Máy lạnh', 'Nước nóng', 'Smart TV'],
                    images: rt.images || [rt.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'],
                    imageUrl: rt.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
                    hourlyBasePrice: rt.hourlyBasePrice || 120000,
                    hourlyBaseHours: rt.hourlyBaseHours || 2,
                    hourlyExtraHourPrice: rt.hourlyExtraHourPrice || 40000,
                    overnightPrice: rt.overnightPrice || 350000,
                    dailyPrice: rt.dailyPrice || 500000,
                    calculatedQuoteTotal: rt.calculatedQuoteTotal || rt.estimatedPrice || (filter.rentalType === 'Hourly' ? 120000 : filter.rentalType === 'Overnight' ? 350000 : 500000),
                    estimatedPrice: rt.estimatedPrice || (filter.rentalType === 'Hourly' ? 120000 : filter.rentalType === 'Overnight' ? 350000 : 500000),
                  }))
                : this.createDefaultRoomTypes(p, filter.rentalType),
            };
          });
          this.properties.set(mappedList);
          this.generateDynamicChips(mappedList);
        } else {
          this.loadDemoFallbackProperties();
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Backend public properties fetch error, falling back to demo data:', err);
        this.loadDemoFallbackProperties();
        this.isLoading.set(false);
      },
    });
  }

  private createDefaultRoomTypes(property: any, rentalType: RentalType): PublicRoomTypeAvailabilityDto[] {
    const propId = property.id || property.propertyId || 'prop';
    return [
      {
        roomTypeId: `${propId}-std`,
        name: 'Phòng Tiêu Chuẩn Giường Đôi',
        roomTypeName: 'Phòng Tiêu Chuẩn Giường Đôi',
        code: 'STD-DBL',
        maxGuests: 2,
        maxOccupancy: 2,
        bedConfiguration: '1 giường đôi Queen-size',
        bedType: '1 giường đôi Queen-size',
        areaSqm: 24,
        squareMeters: 24,
        availableRoomsCount: 4,
        availableRooms: 4,
        totalRooms: 6,
        isAvailable: true,
        amenities: ['Wifi tốc độ cao', 'Điều hòa 2 chiều', 'Nước suối miễn phí', 'Máy sấy tóc'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'],
        imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        hourlyBasePrice: 120000,
        hourlyBaseHours: 2,
        hourlyExtraHourPrice: 40000,
        overnightPrice: 320000,
        dailyPrice: 480000,
        calculatedQuoteTotal: rentalType === 'Hourly' ? 120000 : rentalType === 'Overnight' ? 320000 : 480000,
        estimatedPrice: rentalType === 'Hourly' ? 120000 : rentalType === 'Overnight' ? 320000 : 480000,
      },
      {
        roomTypeId: `${propId}-dlx`,
        name: 'Phòng Deluxe Hướng Phố / View Đồi',
        roomTypeName: 'Phòng Deluxe Hướng Phố / View Đồi',
        code: 'DLX-VIEW',
        maxGuests: 2,
        maxOccupancy: 2,
        bedConfiguration: '1 giường King-size cao cấp',
        bedType: '1 giường King-size cao cấp',
        areaSqm: 32,
        squareMeters: 32,
        availableRoomsCount: 2,
        availableRooms: 2,
        totalRooms: 4,
        isAvailable: true,
        amenities: ['Ban công ngắm cảnh', 'Bồn tắm thư giãn', 'Smart TV 55 inch', 'Mini Bar'],
        images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'],
        imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
        hourlyBasePrice: 180000,
        hourlyBaseHours: 2,
        hourlyExtraHourPrice: 60000,
        overnightPrice: 450000,
        dailyPrice: 750000,
        calculatedQuoteTotal: rentalType === 'Hourly' ? 180000 : rentalType === 'Overnight' ? 450000 : 750000,
        estimatedPrice: rentalType === 'Hourly' ? 180000 : rentalType === 'Overnight' ? 450000 : 750000,
      },
    ];
  }

  private loadDemoFallbackProperties(): void {
    const f = this.searchFilter();
    this.properties.set([
      {
        propertyId: 'p-dalat-palace',
        id: 'p-dalat-palace',
        tenantId: 'tenant-heritage',
        tenantBrandName: 'Heritage Hospitality Group',
        name: 'Heritage Da Lat Palace & Boutique Resort',
        code: 'DLP01',
        slug: 'heritage-da-lat-palace',
        propertyType: 'Resort',
        starRating: 5,
        addressLine: '12 Trần Phú, Phường 3',
        wardName: 'Phường 3',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Hồ Xuân Hương & Khu Hòa Bình',
        touristZoneSlug: 'khu-hoa-binh-da-lat',
        thumbnailUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        galleryUrls: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        ],
        allowedRentalTypes: ['Daily', 'Overnight'],
        overnightCheckInTime: '21:00',
        overnightCheckOutTime: '10:00',
        cleaningBufferMinutes: 30,
        ratingAverage: 4.9,
        reviewCount: 312,
        nearbyLandmarks: [
          {
            landmarkId: 'lm-cho-dem-dl',
            landmarkName: 'Chợ đêm Đà Lạt',
            landmarkSlug: 'cho-dem-da-lat',
            category: 'Market',
            distanceMeters: 450,
          },
          {
            landmarkId: 'lm-ho-xuan-huong',
            landmarkName: 'Hồ Xuân Hương',
            landmarkSlug: 'ho-xuan-huong',
            category: 'Center',
            distanceMeters: 200,
          },
        ],
        startingPriceForSelectedMode: f.rentalType === 'Overnight' ? 650000 : 980000,
        availableRoomTypes: [
          {
            roomTypeId: 'rt-dl-palace-deluxe',
            name: 'Phòng Deluxe Hướng Hồ Xuân Hương',
            roomTypeName: 'Phòng Deluxe Hướng Hồ Xuân Hương',
            code: 'DLX-LAKE',
            maxGuests: 2,
            bedConfiguration: '1 giường King-size Hoàng Gia',
            areaSqm: 38,
            availableRoomsCount: 3,
            availableRooms: 3,
            isAvailable: true,
            amenities: ['View toàn cảnh Hồ Xuân Hương', 'Bồn tắm sục Jacuzzi', 'Bữa sáng Buffet cao cấp', 'Trà chiều'],
            images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'],
            overnightPrice: 650000,
            dailyPrice: 980000,
            calculatedQuoteTotal: f.rentalType === 'Overnight' ? 650000 : 980000,
          },
          {
            roomTypeId: 'rt-dl-palace-suite',
            name: 'Executive Suite Ban Công Cổ Điển',
            roomTypeName: 'Executive Suite Ban Công Cổ Điển',
            code: 'SUI-EXEC',
            maxGuests: 4,
            bedConfiguration: '2 giường Queen-size',
            areaSqm: 56,
            availableRoomsCount: 2,
            availableRooms: 2,
            isAvailable: true,
            amenities: ['Phòng khách riêng', 'Ban công kiểu Pháp', 'Lò sưởi ấm cúng', 'Rượu vang chào đón'],
            images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'],
            overnightPrice: 950000,
            dailyPrice: 1550000,
            calculatedQuoteTotal: f.rentalType === 'Overnight' ? 950000 : 1550000,
          },
        ],
      },
      {
        propertyId: 'p-may-homestay',
        id: 'p-may-homestay',
        tenantId: 'tenant-chill-vibes',
        tenantBrandName: 'Chill & Dream Stays',
        name: 'Mây Trên Đồi Homestay & Coffee Đà Lạt',
        code: 'MAY01',
        slug: 'may-tren-doi-homestay',
        propertyType: 'Homestay',
        starRating: 4,
        addressLine: '89 Hoàng Hoa Thám, Phường 10',
        wardName: 'Phường 10',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Dốc Trại Mát & Đồi Chè Cầu Đất',
        touristZoneSlug: 'trai-mat-cau-dat',
        thumbnailUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
        galleryUrls: [
          'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
        ],
        allowedRentalTypes: ['Daily', 'Overnight', 'Hourly'],
        overnightCheckInTime: '21:00',
        overnightCheckOutTime: '10:00',
        cleaningBufferMinutes: 20,
        ratingAverage: 4.8,
        reviewCount: 189,
        nearbyLandmarks: [
          {
            landmarkId: 'lm-san-may-cau-dat',
            landmarkName: 'Điểm săn mây Cầu Đất',
            landmarkSlug: 'san-may-cau-dat',
            category: 'Center',
            distanceMeters: 800,
          },
        ],
        startingPriceForSelectedMode: f.rentalType === 'Hourly' ? 140000 : f.rentalType === 'Overnight' ? 380000 : 520000,
        availableRoomTypes: [
          {
            roomTypeId: 'rt-may-view-doi',
            name: 'Phòng Gác Mái Săn Mây View Thung Lũng',
            roomTypeName: 'Phòng Gác Mái Săn Mây View Thung Lũng',
            code: 'MAY-ATTIC',
            maxGuests: 2,
            bedConfiguration: '1 đệm Futon Nhật Bản đôi',
            areaSqm: 26,
            availableRoomsCount: 4,
            availableRooms: 4,
            isAvailable: true,
            amenities: ['Cửa kính lớn ngắm thung lũng sương mù', 'Loa Marshall Bluetooth', 'Bình đun siêu tốc', 'Cà phê rang mộc'],
            images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'],
            hourlyBasePrice: 140000,
            hourlyBaseHours: 2,
            hourlyExtraHourPrice: 50000,
            overnightPrice: 380000,
            dailyPrice: 520000,
            calculatedQuoteTotal: f.rentalType === 'Hourly' ? 140000 : f.rentalType === 'Overnight' ? 380000 : 520000,
          },
        ],
      },
      {
        propertyId: 'p-sunshine-motel',
        id: 'p-sunshine-motel',
        tenantId: 'tenant-fast-rest',
        tenantBrandName: 'Fast & Relax Motel Chain',
        name: 'Sunshine Express Motel & Smart Rooms',
        code: 'SUN01',
        slug: 'sunshine-express-motel',
        propertyType: 'Motel',
        starRating: 3,
        addressLine: '45 Nam Kỳ Khởi Nghĩa, Phường 1',
        wardName: 'Phường 1',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Khu trung tâm Hòa Bình',
        touristZoneSlug: 'khu-hoa-binh-da-lat',
        thumbnailUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        galleryUrls: [
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        ],
        allowedRentalTypes: ['Hourly', 'Overnight', 'Daily'],
        overnightCheckInTime: '21:00',
        overnightCheckOutTime: '10:00',
        cleaningBufferMinutes: 15,
        ratingAverage: 4.6,
        reviewCount: 94,
        nearbyLandmarks: [
          {
            landmarkId: 'lm-cho-dem-dl',
            landmarkName: 'Chợ đêm Đà Lạt',
            landmarkSlug: 'cho-dem-da-lat',
            category: 'Market',
            distanceMeters: 280,
          },
        ],
        startingPriceForSelectedMode: f.rentalType === 'Hourly' ? 100000 : f.rentalType === 'Overnight' ? 260000 : 380000,
        availableRoomTypes: [
          {
            roomTypeId: 'rt-sun-express-std',
            name: 'Phòng Nghỉ Nhanh Thông Minh (Smart Check-in)',
            roomTypeName: 'Phòng Nghỉ Nhanh Thông Minh (Smart Check-in)',
            code: 'SUN-EXP',
            maxGuests: 2,
            bedConfiguration: '1 giường đôi 1m6',
            areaSqm: 20,
            availableRoomsCount: 6,
            availableRooms: 6,
            isAvailable: true,
            amenities: ['Khóa cửa vân tay / mã số', 'Smart TV kết nối Netflix', 'Phòng tắm vòi sen đứng', 'Nước ngọt miễn phí'],
            images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'],
            hourlyBasePrice: 100000,
            hourlyBaseHours: 2,
            hourlyExtraHourPrice: 35000,
            overnightPrice: 260000,
            dailyPrice: 380000,
            calculatedQuoteTotal: f.rentalType === 'Hourly' ? 100000 : f.rentalType === 'Overnight' ? 260000 : 380000,
          },
        ],
      },
      {
        propertyId: 'p-thanh-binh-guesthouse',
        id: 'p-thanh-binh-guesthouse',
        tenantId: 'tenant-family-lodging',
        tenantBrandName: 'Hệ thống Nhà nghỉ Bình Dân Thanh Bình',
        name: 'Nhà nghỉ Thanh Bình Đà Lạt',
        code: 'TB01',
        slug: 'nha-nghi-thanh-binh-da-lat',
        propertyType: 'Guesthouse',
        starRating: 2,
        addressLine: '16 Bùi Thị Xuân, Phường 2',
        wardName: 'Phường 2',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Khu trung tâm Hòa Bình',
        touristZoneSlug: 'khu-hoa-binh-da-lat',
        thumbnailUrl: 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=800&q=80',
        galleryUrls: [
          'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=800&q=80',
        ],
        allowedRentalTypes: ['Hourly', 'Overnight', 'Daily'],
        overnightCheckInTime: '21:00',
        overnightCheckOutTime: '10:00',
        cleaningBufferMinutes: 15,
        ratingAverage: 4.5,
        reviewCount: 62,
        nearbyLandmarks: [
          {
            landmarkId: 'lm-cho-dem-dl',
            landmarkName: 'Chợ đêm Đà Lạt',
            landmarkSlug: 'cho-dem-da-lat',
            category: 'Market',
            distanceMeters: 350,
          },
        ],
        startingPriceForSelectedMode: f.rentalType === 'Hourly' ? 80000 : f.rentalType === 'Overnight' ? 220000 : 320000,
        availableRoomTypes: [
          {
            roomTypeId: 'rt-tb-cozy-twin',
            name: 'Phòng Đôi Tiết Kiệm Sạch Sẽ',
            roomTypeName: 'Phòng Đôi Tiết Kiệm Sạch Sẽ',
            code: 'TB-TWN',
            maxGuests: 2,
            bedConfiguration: '1 giường đôi 1m5',
            areaSqm: 18,
            availableRoomsCount: 5,
            availableRooms: 5,
            isAvailable: true,
            amenities: ['Wifi miễn phí', 'Nước nóng năng lượng mặt trời', 'Ấm đun nước', 'Quạt máy làm mát'],
            images: ['https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=800&q=80'],
            hourlyBasePrice: 80000,
            hourlyBaseHours: 2,
            hourlyExtraHourPrice: 30000,
            overnightPrice: 220000,
            dailyPrice: 320000,
            calculatedQuoteTotal: f.rentalType === 'Hourly' ? 80000 : f.rentalType === 'Overnight' ? 220000 : 320000,
          },
        ],
      },
    ]);
  }

  private seedDefaultDestinationSuggestions(): void {
    this.destinationSuggestions.set([
      {
        id: 'prov-68',
        name: 'Đà Lạt, Lâm Đồng',
        slug: 'da-lat',
        type: 'Province',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        propertyCount: 42,
      },
      {
        id: 'zone-hoa-binh',
        name: 'Khu trung tâm Hòa Bình',
        slug: 'khu-hoa-binh-da-lat',
        type: 'TouristZone',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Trung tâm Đà Lạt',
      },
      {
        id: 'lm-cho-dem-dl',
        name: 'Chợ đêm Đà Lạt',
        slug: 'cho-dem-da-lat',
        type: 'Landmark',
        provinceCode: '68',
        provinceName: 'Lâm Đồng',
        touristZoneName: 'Khu Hòa Bình',
        distanceLabel: 'Bán kính 500m có 18 khách sạn & nhà nghỉ',
      },
      {
        id: 'zone-bai-sau',
        name: 'Khu du lịch Bãi Sau Thùy Vân',
        slug: 'bai-sau-vung-tau',
        type: 'TouristZone',
        provinceCode: '77',
        provinceName: 'Bà Rịa - Vũng Tàu',
      },
      {
        id: 'lm-pho-di-bo-nh',
        name: 'Phố đi bộ Nguyễn Huệ',
        slug: 'pho-di-bo-nguyen-hue',
        type: 'Landmark',
        provinceCode: '79',
        provinceName: 'TP. Hồ Chí Minh',
        touristZoneName: 'Quận 1 Trung tâm',
      },
    ]);
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
