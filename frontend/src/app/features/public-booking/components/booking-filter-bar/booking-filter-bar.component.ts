import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { readPublicStay } from '../../../../core/models/public-stay-context';
import {
  DestinationSuggestionDto,
  PropertyType,
  PublicBookingSearchFilter,
  RentalType,
} from '../../../../core/models/public-booking.model';

interface RentalModeTab {
  type: RentalType;
  label: string;
  subLabel: string;
  icon: string;
  badgeText?: string;
}

interface PropertyTypeChip {
  type: PropertyType;
  label: string;
  icon: string;
}


export interface BookingFilterCriteria {
  rentalType: number;
  propertyType: number | 'ALL';
  priceRange: 'ALL' | 'UNDER_800K' | '800K_1500K' | '1500K_3000K' | 'ABOVE_3000K';
  bedType: 'ALL' | 'SINGLE' | 'DOUBLE' | 'TWIN' | 'FAMILY';
  amenities: string[];
  sortBy: 'POPULAR' | 'PRICE_ASC' | 'PRICE_DESC' | 'CAPACITY_DESC';
  checkInHour?: string;
  durationHours?: number;
}

export interface DestinationSelection {
  category: 'city' | 'touristZone' | 'landmark' | 'property';
  displayName: string;
  searchTerm: string;
  slug?: string;
}

@Component({
  selector: 'app-booking-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 md:p-6 transition-all"
      aria-label="Bộ lọc tìm kiếm đặt phòng"
    >
      <!-- 1. TABS CHỌN HÌNH THỨC LƯU TRÚ (THEO NGÀY / THEO GIỜ / QUA ĐÊM) -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100"
      >
        <div
          class="inline-flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl w-full sm:w-auto"
          role="tablist"
        >
          @for (tab of rentalModeTabs; track tab.type) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="rentalType() === tab.type"
              (click)="selectRentalType(tab.type)"
              class="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
              [class.bg-indigo-600]="rentalType() === tab.type"
              [class.text-white]="rentalType() === tab.type"
              [class.shadow-sm]="rentalType() === tab.type"
              [class.text-slate-700]="rentalType() !== tab.type"
              [class.hover:bg-white/70]="rentalType() !== tab.type"
            >
              <i [class]="tab.icon + ' text-base'"></i>
              <div class="text-left">
                <div class="flex items-center gap-1.5">
                  <span>{{ tab.label }}</span>
                  @if (tab.badgeText) {
                    <span
                      class="text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold"
                      [class.bg-amber-300]="rentalType() === tab.type"
                      [class.text-slate-900]="rentalType() === tab.type"
                      [class.bg-amber-100]="rentalType() !== tab.type"
                      [class.text-amber-800]="rentalType() !== tab.type"
                    >
                      {{ tab.badgeText }}
                    </span>
                  }
                </div>
                <p
                  class="text-[11px] font-normal hidden md:block"
                  [class.text-indigo-100]="rentalType() === tab.type"
                  [class.text-slate-500]="rentalType() !== tab.type"
                >
                  {{ tab.subLabel }}
                </p>
              </div>
            </button>
          }
        </div>

        <!-- Tóm tắt khung giờ nhận - trả phòng tự động -->
        <div
          class="flex items-center gap-2 text-xs md:text-sm bg-indigo-50/80 text-indigo-900 px-3.5 py-2 rounded-xl border border-indigo-100"
        >
          <i class="pi pi-clock text-indigo-600"></i>
          <span>{{ computedStaySummary() }}</span>
        </div>
      </div>

      <!-- 2. LƯỚI INPUT TÌM KIẾM CHÍNH -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <!-- Cột 1: Điểm đến / Địa danh / Khu du lịch / Tên cơ sở (4 cột) -->
        <div #destinationGroup class="lg:col-span-4 relative">
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Địa danh, Khu du lịch hoặc Cơ sở
            </label>
            <button
              type="button"
              (click)="useCurrentLocation()"
              class="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
              title="Tìm cơ sở lưu trú gần vị trí của tôi"
            >
              <i class="pi pi-compass text-xs" [class.pi-spin]="isLocating()"></i>
              <span>{{ isLocating() ? 'Đang định vị...' : '📍 Gần tôi' }}</span>
            </button>
          </div>
          <div class="relative">
            <i
              class="pi pi-map-marker absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600"
            ></i>
            <input
              type="text"
              [ngModel]="destinationKeyword()"
              (ngModelChange)="onDestinationInput($event)"
              (focus)="showSuggestionsDropdown.set(true)"
              (keydown)="onDestinationKeydown($event)"
              role="combobox"
              aria-label="Điểm đến, địa danh hoặc cơ sở"
              aria-autocomplete="list"
              [attr.aria-expanded]="showSuggestionsDropdown() && filteredSuggestions().length > 0"
              [attr.aria-controls]="showSuggestionsDropdown() && filteredSuggestions().length > 0 ? 'destination-options' : null"
              [attr.aria-activedescendant]="showSuggestionsDropdown() && activeSuggestion() >= 0 ? 'destination-option-' + activeSuggestion() : null"
              placeholder="VD: Chợ đêm Đà Lạt, Bãi Sau, Quận 1, Nhà nghỉ..."
              class="w-full pl-10 pr-9 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            @if (destinationKeyword()) {
              <button
                type="button"
                (click)="clearDestination()"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Xóa địa điểm"
              >
                <i class="pi pi-times-circle"></i>
              </button>
            }
          </div>

          <!-- Dropdown Gợi ý Phân nhóm (Thành phố / Khu du lịch / Địa danh / Khách sạn) -->
          @if (showSuggestionsDropdown() && filteredSuggestions().length > 0) {
            <div
              class="absolute z-40 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100"
            >
              <div
                class="px-3.5 py-2 bg-slate-50 flex items-center justify-between text-xs text-slate-500"
              >
                <span>Gợi ý theo Địa danh, Khu vực du lịch & Thành phố</span>
                <button
                  type="button"
                  (click)="showSuggestionsDropdown.set(false)"
                  class="text-indigo-600 font-medium hover:underline"
                >
                  Đóng
                </button>
              </div>

              <div id="destination-options" role="listbox" aria-label="Gợi ý điểm đến">
              @for (item of filteredSuggestions(); track item.id; let index = $index) {
                <button
                  [id]="'destination-option-' + index"
                  role="option"
                  tabindex="-1"
                  [attr.aria-selected]="activeSuggestion() === index"
                  [class.bg-indigo-50]="activeSuggestion() === index"
                  type="button"
                  (click)="selectSuggestion(item)"
                  class="w-full px-4 py-2.5 text-left hover:bg-indigo-50/60 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                      [ngClass]="getSuggestionIconBadgeClass(item.type)"
                    >
                      <i [class]="getSuggestionIcon(item.type)"></i>
                    </span>
                    <div class="truncate">
                      <p class="text-sm font-medium text-slate-800 truncate">
                        {{ item.name }}
                      </p>
                      <p class="text-xs text-slate-500 truncate">
                        {{ item.provinceName }}
                        @if (item.touristZoneName) {
                          <span> • {{ item.touristZoneName }}</span>
                        }
                        @if (item.distanceLabel) {
                          <span class="text-indigo-600 font-medium">
                            • {{ item.distanceLabel }}
                          </span>
                        }
                      </p>
                    </div>
                  </div>

                  <span
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    [ngClass]="getSuggestionTypePillClass(item.type)"
                  >
                    {{ getSuggestionTypeLabel(item.type) }}
                  </span>
                </button>
              }
              </div>
            </div>
          }
        </div>

        <!-- Cột 2: Bộ chọn Ngày / Giờ linh hoạt theo Chế độ Lưu trú (5 cột) -->
        <div class="lg:col-span-5">
          @switch (rentalType()) {
            <!-- CASE A: THUÊ THEO GIỜ (NHÀ NGHỈ / MOTEL / KHÁCH SẠN THEO GIỜ) -->
            @case ('Hourly') {
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Ngày nhận phòng
                  </label>
                  <input
                    type="date"
                    [ngModel]="checkInDate()"
                    (ngModelChange)="onCheckInDateChange($event)"
                    class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Giờ nhận phòng
                  </label>
                  <select
                    [ngModel]="checkInTime()"
                    (ngModelChange)="checkInTime.set($event)"
                    class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    @for (slot of hourlyTimeSlots; track slot) {
                      <option [value]="slot">{{ slot }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Số giờ sử dụng
                  </label>
                  <select
                    [ngModel]="durationHours()"
                    (ngModelChange)="durationHours.set(+$event)"
                    class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    @for (hour of hourlyDurationOptions; track hour) {
                      <option [value]="hour">{{ hour }} giờ</option>
                    }
                  </select>
                </div>
              </div>
            }

            <!-- CASE B: THUÊ QUA ĐÊM -->
            @case ('Overnight') {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Đêm nhận phòng (giờ theo cơ sở)
                  </label>
                  <input
                    type="date"
                    [ngModel]="checkInDate()"
                    (ngModelChange)="onCheckInDateChange($event)"
                    class="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Trả phòng sáng hôm sau
                  </label>
                  <div
                    class="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 flex items-center justify-between"
                  >
                    <span>{{ checkOutDate() }} (giờ theo cơ sở)</span>
                    <span
                      class="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md"
                    >
                      1 Đêm
                    </span>
                  </div>
                </div>
              </div>
            }

            <!-- CASE C: THUÊ THEO NGÀY (CHUẨN HOTEL / RESORT / HOMESTAY) -->
            @default {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Ngày nhận phòng (giờ theo cơ sở)
                  </label>
                  <input
                    type="date"
                    [ngModel]="checkInDate()"
                    (ngModelChange)="onCheckInDateChange($event)"
                    class="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Ngày trả phòng ({{ nightCount() }} đêm)
                  </label>
                  <input
                    type="date"
                    [ngModel]="checkOutDate()"
                    [min]="checkInDate()"
                    (ngModelChange)="onCheckOutDateChange($event)"
                    class="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            }
          }
        </div>

        <!-- Cột 3: Số khách & Nút Tìm kiếm (3 cột) -->
        <div class="lg:col-span-3 flex flex-col sm:flex-row lg:flex-row gap-2.5 items-end">
          <div class="w-full sm:w-1/2 lg:w-5/12">
            <label
              class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Số khách · một phòng
            </label>
            <div class="flex items-center border border-slate-300 rounded-xl px-2.5 py-2 bg-white">
              <button
                type="button"
                (click)="adjustGuests(-1)"
                class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                -
              </button>
              <div class="flex-1 text-center text-xs font-semibold text-slate-800">
                {{ guests() }} khách
              </div>
              <button
                type="button"
                (click)="adjustGuests(1)"
                class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            (click)="emitSearch()"
            class="w-full sm:w-1/2 lg:w-7/12 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <i class="pi pi-search"></i>
            <span>Tìm phòng</span>
          </button>
        </div>
      </div>

      @if (searchError()) { <p role="alert" class="mt-3 text-sm text-red-700">{{ searchError() }}</p> }
      <p class="mt-3 text-xs text-slate-500">Kết quả khám phá cơ sở; phòng trống và báo giá theo lịch được kiểm tra tại trang chi tiết. Mỗi lượt đặt một phòng.</p>
      <div
        class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 mr-1">
            Loại hình cơ sở:
          </span>

          <button
            type="button"
            (click)="clearPropertyTypes()"
            class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
            [class.bg-slate-900]="selectedPropertyTypes().length === 0"
            [class.text-white]="selectedPropertyTypes().length === 0"
            [class.border-slate-900]="selectedPropertyTypes().length === 0"
            [class.bg-white]="selectedPropertyTypes().length > 0"
            [class.text-slate-600]="selectedPropertyTypes().length > 0"
            [class.border-slate-300]="selectedPropertyTypes().length > 0"
          >
            Tất cả loại hình
          </button>

          @for (chip of propertyTypeChips; track chip.type) {
            <button
              type="button"
              (click)="togglePropertyType(chip.type)"
              class="px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer"
              [class.bg-indigo-600]="isPropertyTypeSelected(chip.type)"
              [class.text-white]="isPropertyTypeSelected(chip.type)"
              [class.border-indigo-600]="isPropertyTypeSelected(chip.type)"
              [class.bg-white]="!isPropertyTypeSelected(chip.type)"
              [class.text-slate-700]="!isPropertyTypeSelected(chip.type)"
              [class.border-slate-300]="!isPropertyTypeSelected(chip.type)"
              [class.hover:border-indigo-400]="!isPropertyTypeSelected(chip.type)"
            >
              <i [class]="chip.icon"></i>
              <span>{{ chip.label }}</span>
            </button>
          }
        </div>

        <!-- Gợi ý Địa danh Hot có thể bấm 1 chạm -->
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="text-slate-400">Địa danh phổ biến:</span>
          @for (quickSpot of quickLandmarkPicks; track quickSpot.slug) {
            <button
              type="button"
              (click)="selectQuickLandmark(quickSpot)"
              class="text-indigo-600 hover:text-indigo-800 hover:underline font-medium px-1.5 py-0.5 rounded bg-indigo-50/60 cursor-pointer"
            >
              #{{ quickSpot.name }}
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class BookingFilterBarComponent {
  readonly activeSuggestion = signal(-1);
  readonly searchError = signal('');

  onDestinationKeydown(event: KeyboardEvent): void {
    const suggestions = this.filteredSuggestions();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.showSuggestionsDropdown.set(true);
      if (suggestions.length) {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.activeSuggestion.set(this.activeSuggestion() < 0
          ? (direction === 1 ? 0 : suggestions.length - 1)
          : (this.activeSuggestion() + direction + suggestions.length) % suggestions.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = this.showSuggestionsDropdown() ? suggestions[this.activeSuggestion()] : undefined;
      if (selected) this.selectSuggestion(selected);
      else this.emitSearch();
    }
  }
  @ViewChild('destinationGroup') private destinationGroup?: ElementRef<HTMLElement>;

  @HostListener('document:pointerdown', ['$event'])
  @HostListener('document:focusin', ['$event'])
  dismissOutsideDestination(event: Event): void {
    if (!this.destinationGroup?.nativeElement.contains(event.target as Node)) {
      this.showSuggestionsDropdown.set(false);
    }
  }

  @HostListener('keydown.escape')
  dismissDestination(): void {
    this.showSuggestionsDropdown.set(false);
  }

  /** Input nhận trạng thái bộ lọc ban đầu từ trang cha */
  readonly initialFilter = input<Partial<PublicBookingSearchFilter> | null>(null);

  /** Danh sách gợi ý địa danh, khu du lịch, tỉnh/thành truyền từ trang cha hoặc LocationService */
  readonly suggestions = input<DestinationSuggestionDto[]>([]);

  /** Output phát sự kiện mỗi khi người dùng bấm Tìm phòng hoặc đổi chế độ thuê */
  readonly filterChange = output<PublicBookingSearchFilter>();

  // --- CẤU HÌNH CÁC TAB & CHIPS ---
  readonly rentalModeTabs: RentalModeTab[] = [
    {
      type: 'Daily',
      label: 'Theo ngày',
      subLabel: 'Khách sạn, Resort, Homestay',
      icon: 'pi pi-calendar',
    },
    {
      type: 'Hourly',
      label: 'Theo giờ',
      subLabel: 'Nhà nghỉ, Motel linh hoạt 1h - 6h',
      icon: 'pi pi-clock',
      badgeText: 'Linh hoạt',
    },
    {
      type: 'Overnight',
      label: 'Qua đêm',
      subLabel: 'Giờ nhận/trả theo từng cơ sở',
      icon: 'pi pi-moon',
      badgeText: 'Tiết kiệm',
    },
  ];

  readonly propertyTypeChips: PropertyTypeChip[] = [
    { type: 'Hotel', label: 'Khách sạn (Hotel)', icon: 'pi pi-building' },
    { type: 'Guesthouse', label: 'Nhà nghỉ', icon: 'pi pi-home' },
    { type: 'Motel', label: 'Motel', icon: 'pi pi-car' },
    { type: 'Homestay', label: 'Homestay', icon: 'pi pi-heart' },
    { type: 'Resort', label: 'Resort / Villa', icon: 'pi pi-sun' },
  ];

  readonly hourlyTimeSlots: string[] = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00', '23:00',
  ];

  readonly hourlyDurationOptions: number[] = [1, 2, 3, 4, 5, 6];

  readonly quickLandmarkPicks: Array<{
    name: string;
    slug: string;
    provinceCode: string;
  }> = [
    { name: 'Chợ đêm Đà Lạt', slug: 'cho-dem-da-lat', provinceCode: '68' },
    { name: 'Bãi Sau Vũng Tàu', slug: 'bai-sau-vung-tau', provinceCode: '77' },
    { name: 'Phố đi bộ Nguyễn Huệ', slug: 'pho-di-bo-nguyen-hue', provinceCode: '79' },
    { name: 'Cầu Rồng Đà Nẵng', slug: 'cau-rong-da-nang', provinceCode: '48' },
    { name: 'Phố cổ Hội An', slug: 'pho-co-hoi-an', provinceCode: '49' },
  ];

  // --- SIGNALS QUẢN LÝ TRẠNG THÁI FORM ---
  readonly rentalType = signal<RentalType>('Daily');
  readonly destinationKeyword = signal<string>('');
  readonly selectedProvinceCode = signal<string | null>(null);
  readonly selectedTouristZoneSlug = signal<string | null>(null);
  readonly selectedLandmarkSlug = signal<string | null>(null);
  readonly selectedPropertyTypes = signal<PropertyType[]>([]);

  readonly checkInDate = signal<string>(this.getTodayIsoDate());
  readonly checkOutDate = signal<string>(this.getTomorrowIsoDate());
  readonly checkInTime = signal<string>('14:00');
  readonly durationHours = signal<number>(2);
  readonly guests = signal<number>(2);
  readonly roomsCount = signal<number>(1);
  readonly showSuggestionsDropdown = signal<boolean>(false);
  readonly isLocating = signal<boolean>(false);
  readonly userCoords = signal<{ lat: number; lng: number } | null>(null);

  // --- COMPUTED SIGNALS ---
  readonly nightCount = computed<number>(() => {
    const start = new Date(this.checkInDate());
    const end = new Date(this.checkOutDate());
    const diffMs = end.getTime() - start.getTime();
    const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return nights > 0 ? nights : 1;
  });

  readonly computedStaySummary = computed<string>(() => {
    const mode = this.rentalType();
    if (mode === 'Hourly') {
      const [h, m] = this.checkInTime().split(':').map(Number);
      const endHour = (h + this.durationHours()) % 24;
      const nextDaySuffix = h + this.durationHours() >= 24 ? ' (hôm sau)' : '';
      const formattedEnd = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return `Nhận phòng ${this.checkInTime()} → Trả phòng ${formattedEnd}${nextDaySuffix} (${this.durationHours()} giờ)`;
    }
    if (mode === 'Overnight') {
      return `${this.checkInDate()} → ${this.checkOutDate()} • Giờ theo cơ sở`;
    }
    return `${this.checkInDate()} → ${this.checkOutDate()} • ${this.nightCount()} đêm • Giờ theo cơ sở`;
  });

  readonly filteredSuggestions = computed<DestinationSuggestionDto[]>(() => {
    const rawKeyword = this.normalizeVietnamese(this.destinationKeyword());
    const all = this.suggestions();
    if (!rawKeyword) {
      return all.slice(0, 8);
    }
    return all
      .filter((item) => {
        const haystack = this.normalizeVietnamese(
          `${item.name} ${item.provinceName} ${item.touristZoneName ?? ''}`
        );
        return haystack.includes(rawKeyword);
      })
      .slice(0, 10);
  });

  constructor() {
    effect(() => {
      const init = this.initialFilter();
      if (!init) return;
      if (init.rentalType) this.rentalType.set(init.rentalType);
      if (init.destinationKeyword !== undefined)
        this.destinationKeyword.set(init.destinationKeyword);
      if (init.provinceCode !== undefined)
        this.selectedProvinceCode.set(init.provinceCode);
      if (init.touristZoneSlug !== undefined)
        this.selectedTouristZoneSlug.set(init.touristZoneSlug);
      if (init.landmarkSlug !== undefined)
        this.selectedLandmarkSlug.set(init.landmarkSlug);
      if (init.propertyTypes)
        this.selectedPropertyTypes.set([...init.propertyTypes]);
      if (init.checkInDate) this.checkInDate.set(init.checkInDate);
      if (init.checkOutDate) this.checkOutDate.set(init.checkOutDate);
      if (init.checkInTime) this.checkInTime.set(init.checkInTime);
      if (init.durationHours) this.durationHours.set(init.durationHours);
      if (init.guests) this.guests.set(init.guests);
      this.userCoords.set(init.userLatitude != null && init.userLongitude != null
        ? { lat: init.userLatitude, lng: init.userLongitude } : null);
    });
  }

  // --- HANDLERS ---
  selectRentalType(type: RentalType): void {
    this.rentalType.set(type);
    if (type === 'Hourly') {
      this.checkOutDate.set(this.checkInDate());
    } else if (type === 'Overnight') {
      this.checkInTime.set('21:00');
      this.checkOutDate.set(this.addDays(this.checkInDate(), 1));
    } else {
      if (this.checkOutDate() <= this.checkInDate()) {
        this.checkOutDate.set(this.addDays(this.checkInDate(), 1));
      }
    }
    this.emitSearch();
  }

  onDestinationInput(value: string): void {
    this.activeSuggestion.set(-1);
    this.userCoords.set(null);
    this.destinationKeyword.set(value);
    this.selectedProvinceCode.set(null);
    this.selectedTouristZoneSlug.set(null);
    this.selectedLandmarkSlug.set(null);
    this.showSuggestionsDropdown.set(true);
  }

  clearDestination(): void {
    this.userCoords.set(null);
    this.activeSuggestion.set(-1);
    this.destinationKeyword.set('');
    this.selectedProvinceCode.set(null);
    this.selectedTouristZoneSlug.set(null);
    this.selectedLandmarkSlug.set(null);
    this.emitSearch();
  }

  selectSuggestion(item: DestinationSuggestionDto): void {
    this.userCoords.set(null);
    this.destinationKeyword.set(item.name);
    this.selectedProvinceCode.set(item.provinceCode);
    this.selectedTouristZoneSlug.set(
      item.type === 'TouristZone' ? item.slug : null
    );
    this.selectedLandmarkSlug.set(item.type === 'Landmark' ? item.slug : null);
    this.showSuggestionsDropdown.set(false);
    this.emitSearch();
  }

  selectQuickLandmark(spot: {
    name: string;
    slug: string;
    provinceCode: string;
  }): void {
    this.userCoords.set(null);
    this.destinationKeyword.set(spot.name);
    this.selectedProvinceCode.set(spot.provinceCode);
    this.selectedLandmarkSlug.set(spot.slug);
    this.selectedTouristZoneSlug.set(null);
    this.showSuggestionsDropdown.set(false);
    this.emitSearch();
  }

  onCheckInDateChange(newDate: string): void {
    this.checkInDate.set(newDate);
    if (this.rentalType() === 'Hourly') {
      this.checkOutDate.set(newDate);
    } else if (
      this.rentalType() === 'Overnight' ||
      this.checkOutDate() <= newDate
    ) {
      this.checkOutDate.set(this.addDays(newDate, 1));
    }
  }

  onCheckOutDateChange(newDate: string): void {
    this.checkOutDate.set(newDate);
  }

  adjustGuests(delta: number): void {
    const next = this.guests() + delta;
    if (next >= 1 && next <= 20) {
      this.guests.set(next);
    }
  }

  isPropertyTypeSelected(type: PropertyType): boolean {
    return this.selectedPropertyTypes().includes(type);
  }

  togglePropertyType(type: PropertyType): void {
    const current = this.selectedPropertyTypes();
    if (current.includes(type)) {
      this.selectedPropertyTypes.set(current.filter((t) => t !== type));
    } else {
      this.selectedPropertyTypes.set([...current, type]);
    }
    this.emitSearch();
  }

  clearPropertyTypes(): void {
    this.selectedPropertyTypes.set([]);
    this.emitSearch();
  }

  useCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ hoặc chưa cấp quyền định vị GPS.');
      return;
    }

    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocating.set(false);
        this.userCoords.set({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        this.destinationKeyword.set('Vị trí hiện tại của tôi (GPS)');
        this.selectedProvinceCode.set(null);
        this.selectedTouristZoneSlug.set(null);
        this.selectedLandmarkSlug.set(null);
        this.showSuggestionsDropdown.set(false);
        this.emitSearch();
      },
      (err) => {
        this.isLocating.set(false);
        console.warn('Geolocation error:', err);
        alert('Không thể lấy vị trí hiện tại. Vui lòng cấp quyền truy cập vị trí trên trình duyệt.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  emitSearch(): void {
    try {
      readPublicStay({ rentalType: this.rentalType(), checkInDate: this.checkInDate(),
        checkOutDate: this.checkOutDate(), checkInTime: this.checkInTime(),
        durationHours: this.durationHours(), guests: this.guests(), roomsCount: this.roomsCount() });
      this.searchError.set('');
    } catch (error) {
      this.searchError.set(error instanceof Error ? error.message : 'Thông tin tìm kiếm không hợp lệ.');
      return;
    }
    this.showSuggestionsDropdown.set(false);
    this.filterChange.emit({
      rentalType: this.rentalType(),
      destinationKeyword: this.destinationKeyword().trim(),
      provinceCode: this.selectedProvinceCode(),
      touristZoneSlug: this.selectedTouristZoneSlug(),
      landmarkSlug: this.selectedLandmarkSlug(),
      tenantSlug: null,
      propertyTypes: this.selectedPropertyTypes(),
      checkInDate: this.checkInDate(),
      checkOutDate: this.checkOutDate(),
      checkInTime: this.checkInTime(),
      durationHours: this.durationHours(),
      guests: this.guests(),
      roomsCount: this.roomsCount(),
      maxDistanceMeters: null,
      userLatitude: this.userCoords()?.lat ?? null,
      userLongitude: this.userCoords()?.lng ?? null,
      minPrice: null,
      maxPrice: null,
      sortBy: 'recommended',
      page: 1,
      pageSize: 10,
    });
  }

  // --- UI HELPERS CHO AUTOCOMPLETE ---
  getSuggestionIcon(type: DestinationSuggestionDto['type']): string {
    switch (type) {
      case 'Province':
        return 'pi pi-map';
      case 'TouristZone':
        return 'pi pi-compass';
      case 'Landmark':
        return 'pi pi-flag-fill';
      case 'Property':
        return 'pi pi-building';
    }
  }

  getSuggestionIconBadgeClass(type: DestinationSuggestionDto['type']): string {
    switch (type) {
      case 'Province':
        return 'bg-blue-100 text-blue-700';
      case 'TouristZone':
        return 'bg-emerald-100 text-emerald-700';
      case 'Landmark':
        return 'bg-amber-100 text-amber-700';
      case 'Property':
        return 'bg-purple-100 text-purple-700';
    }
  }

  getSuggestionTypeLabel(type: DestinationSuggestionDto['type']): string {
    switch (type) {
      case 'Province':
        return 'Tỉnh / Thành phố';
      case 'TouristZone':
        return 'Khu du lịch';
      case 'Landmark':
        return 'Địa danh';
      case 'Property':
        return 'Cơ sở lưu trú';
    }
  }

  getSuggestionTypePillClass(type: DestinationSuggestionDto['type']): string {
    switch (type) {
      case 'Province':
        return 'bg-blue-50 text-blue-700';
      case 'TouristZone':
        return 'bg-emerald-50 text-emerald-700';
      case 'Landmark':
        return 'bg-amber-50 text-amber-800';
      case 'Property':
        return 'bg-purple-50 text-purple-700';
    }
  }

  private normalizeVietnamese(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  private getTodayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getTomorrowIsoDate(): string {
    return this.addDays(this.getTodayIsoDate(), 1);
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
}
