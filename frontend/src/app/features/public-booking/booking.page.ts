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
import { readPublicStay } from '../../core/models/public-stay-context';
import { VIETNAM_34_PROVINCES } from '../../core/data/vietnam-provinces.data';
import { BookingFilterBarComponent } from './components/booking-filter-bar/booking-filter-bar.component';
import { PopularDestinationsComponent } from './components/popular-destinations/popular-destinations.component';
import { FlashDealsBannerComponent } from './components/flash-deals-banner/flash-deals-banner.component';
import { TrustPillarsComponent } from './components/trust-pillars/trust-pillars.component';
import { CuratedBentoGridComponent } from './components/curated-bento-grid/curated-bento-grid.component';
import { HotelierCtaBannerComponent } from './components/hotelier-cta-banner/hotelier-cta-banner.component';
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
    FlashDealsBannerComponent,
    TrustPillarsComponent,
    CuratedBentoGridComponent,
    HotelierCtaBannerComponent,
    AiConciergeWidgetComponent,
    PhotoGalleryModalComponent,
    RoomDetailModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 pb-16">
      <!-- HERO BANNER & THANH TÌM KIẾM ĐA NĂNG -->
      <div
        class="bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-900 text-white pt-12 pb-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      >
        <!-- Background decorative ambient circles -->
        <div class="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-rose-500/10 blur-3xl pointer-events-none"></div>

        <div class="max-w-7xl mx-auto relative z-10">
          <div class="max-w-3xl mb-8">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-200 text-xs font-semibold mb-3">
              <i class="pi pi-sparkles text-amber-400"></i>
              <span>Khám phá nhiều loại hình lưu trú</span>
            </div>
            <div>
              <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Khám Phá Chỗ Nghỉ Hoàn Hảo & Tận Hưởng Kỳ Nghỉ Trong Mơ
              </h1>
            </div>
            <p class="text-sm sm:text-base text-slate-300 max-w-2xl mt-3 leading-relaxed">
              Tìm khách sạn, homestay và resort phù hợp với chuyến đi. Xem giá, tiện nghi và hình thức lưu trú được từng cơ sở hỗ trợ trước khi đặt phòng.
            </p>

            <!-- Quick Category Tags -->
            <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span class="text-slate-400 text-[11px] font-medium mr-1">Gợi ý điểm đến:</span>
              <button
                type="button"
                (click)="selectCategoryQuickTag('Đà Lạt')"
                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors border border-white/10 cursor-pointer"
              >
                🌸 Đà Lạt Săn Mây
              </button>
              <button
                type="button"
                (click)="selectCategoryQuickTag('Phú Quốc')"
                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors border border-white/10 cursor-pointer"
              >
                🏝️ Đảo Ngọc Phú Quốc
              </button>
              <button
                type="button"
                (click)="selectCategoryQuickTag('Đà Nẵng')"
                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors border border-white/10 cursor-pointer"
              >
                🌉 Đà Nẵng Biển Mỹ Khê
              </button>
              <button
                type="button"
                (click)="selectCategoryQuickTag('Vũng Tàu')"
                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors border border-white/10 cursor-pointer"
              >
                🌊 Vũng Tàu Bãi Sau
              </button>
              <button
                type="button"
                (click)="selectCategoryQuickTag('Hà Nội')"
                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors border border-white/10 cursor-pointer"
              >
                🏛️ Hà Nội Phố Cổ
              </button>
            </div>
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
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <!-- Khối Flash Deals & Voucher độc quyền hôm nay -->
        <app-flash-deals-banner (applyCode)="onApplyPromoCode($event)" />

        <!-- Điểm đến & Khu du lịch nổi bật -->
        <div class="mb-8">
          <app-popular-destinations
            (selectDestination)="onPopularDestinationClick($event)"
          />
        </div>

        <!-- Bento Grid Khám Phá Theo Phong Cách Nghỉ Dưỡng -->
        <app-curated-bento-grid (selectCategory)="onSelectCuratedCategory($event)" />

        <!-- 4 Trụ Cột Cam Kết Dịch Vụ & An Tâm Đặt Phòng -->
        <app-trust-pillars />

        <!-- Bento Grid Khám Phá Theo Phong Cách Nghỉ Dưỡng -->
        <app-curated-bento-grid (selectCategory)="onSelectCuratedCategory($event)" />

        <!-- Banner Kêu Gọi Chủ Cơ Sở & Đối Tác Khách Sạn SaaS -->
        <app-hotelier-cta-banner />

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
        [displayPrice]="selectedRoomDetail() ? getRoomDisplayPrice(selectedRoomDetail()!) : 0"
        [propertyName]="selectedRoomPropertyName()"
        (close)="closeRoomDetailModal()"
        (select)="onRoomSelectedFromModal($event)"
      />
    </div>
  `,
})
export class BookingPageComponent implements OnInit {
  readonly stayTypes: readonly PropertyType[] = ['Hotel', 'Resort', 'Homestay', 'Guesthouse'];
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // --- SIGNALS TRẠNG THÁI TRANG ---
  readonly isLoading = signal<boolean>(false);
  readonly properties = signal<PublicPropertyDto[]>([]);
  readonly destinationSuggestions = signal<DestinationSuggestionDto[]>([]);
  readonly selectedTenantId = signal<string | null>(null);
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
    (this.route.queryParams ?? of(this.route.snapshot.queryParams ?? {})).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      try {
        const nonNegative = (value: unknown): number | null => {
          if (value == null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };
        this.selectedTenantId.set(typeof params['selectedTenantId'] === 'string' ? params['selectedTenantId'] : null);
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
        this.searchFilter.update(filter => ({ ...filter, ...readPublicStay(params), destinationKeyword: String(params['destinationKeyword'] ?? ''),
          maxDistanceMeters: this.maxDistanceMeters(), minPrice: this.minPrice(), maxPrice: this.maxPrice(), sortBy: this.sortBy(),
          touristZoneSlug: params['touristZoneSlug'] || null, landmarkSlug: params['landmarkSlug'] || null,
          provinceCode: params['provinceCode'] || null,
          propertyTypes: String(params['propertyTypes'] ?? '').split(',').filter((type): type is PropertyType => ['Hotel', 'Motel', 'Guesthouse', 'Homestay', 'Resort'].includes(type)),
          userLatitude: params['userLatitude'] != null && Number.isFinite(Number(params['userLatitude'])) ? Number(params['userLatitude']) : null,
          userLongitude: params['userLongitude'] != null && Number.isFinite(Number(params['userLongitude'])) ? Number(params['userLongitude']) : null }));
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

  resetSidebarFilters(): void {
    this.selectedTenantId.set(null);
    this.maxDistanceMeters.set(null);
    this.selectedPriceRangeKey.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('recommended');
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
    if (!property.galleryUrls.length && !property.thumbnailUrl) return;
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

    this.publicBookingService.getProperties(serviceFilter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (props) => {
        if (generation !== this.requestGeneration) return;
        if (props && props.length > 0) {
          const mappedList: PublicPropertyDto[] = props.map((p: any) => {
            const allowedModes: RentalType[] = p.allowedRentalTypes ?? [
              ...(p.allowDailyBooking === true ? ['Daily' as RentalType] : []),
              ...(p.allowHourlyBooking === true ? ['Hourly' as RentalType] : []),
              ...(p.allowOvernightBooking === true ? ['Overnight' as RentalType] : []),
            ];

            const landmarks = (p.nearbyLandmarks || []).filter((landmark: { distanceMeters?: number; distanceKm?: number }) =>
              Number.isFinite(landmark.distanceMeters ?? (landmark.distanceKm != null ? landmark.distanceKm * 1000 : undefined)))
              .map((l: any, idx: number) => ({
              landmarkId: l.landmarkId || `lm-${idx}`,
              landmarkName: l.name || l.landmarkName || 'Địa danh',
              landmarkSlug: l.slug || l.landmarkSlug || 'dia-danh',
              category: (l.category || 'Center') as any,
              distanceMeters: l.distanceMeters ?? Math.round(l.distanceKm * 1000),
            }));

            const startPrice = (filter.rentalType === 'Hourly'
              ? p.hourlyStartingPrice ?? p.hourlyPriceFrom
              : filter.rentalType === 'Overnight'
                ? p.overnightStartingPrice ?? p.overnightPriceFrom
                : p.dailyStartingPrice ?? p.dailyPriceFrom) ?? p.startingPriceForSelectedMode ?? p.startingPrice ?? 0;

            const pType: PropertyType = (typeof p.propertyType === 'string'
              ? p.propertyType
              : (p.propertyTypeName || 'Hotel')) as PropertyType;

            return {
              propertyId: p.propertyId || p.id || '',
              id: p.id || p.propertyId,
              tenantId: p.tenantId || '',
              tenantBrandName: p.tenantBrandName || '',
              name: p.name,
              code: p.code || '',
              slug: p.slug,
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
              thumbnailUrl: p.thumbnailUrl || p.imageUrl || '',
              imageUrl: p.imageUrl || p.thumbnailUrl,
              galleryUrls: p.galleryUrls?.length ? p.galleryUrls : (p.thumbnailUrl || p.imageUrl ? [p.thumbnailUrl || p.imageUrl] : []),
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
                ? p.availableRoomTypes.map((rt: any) => ({
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
        } else {
          this.properties.set([]);
          this.smartFilterChips.set([]);
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

  selectCategoryQuickTag(tag: string): void {
    this.onFilterBarChange({
      ...this.searchFilter(),
      destinationKeyword: tag
    });
  }

  selectStayTheme(type: PropertyType): void {
    const current = this.searchFilter();
    this.onFilterBarChange({
      ...current,
      propertyTypes: [type]
    });
  }

  onApplyPromoCode(code: string): void {
    // Promo code applied, ready for checkout
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
