import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TouristZoneDto, LandmarkDto, PublicPropertyDto } from '../../../../core/models/public-booking.model';

export interface BookingFilterCriteria {
  rentalType: number; // 3 = Daily, 1 = Hourly, 2 = Overnight
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
  template: `
    <div class="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 mb-6 shadow-sm space-y-4">
      
      <!-- Top Row: 3-Tab Rental Type Switcher & Destination Autocomplete -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-100">
        
        <!-- 3-Tab Rental Mode Switcher -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0" role="tablist" aria-label="Chế độ đặt phòng">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="rentalType === 3"
            (click)="setRentalType(3)"
            [ngClass]="rentalType === 3 ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-semibold'"
            class="px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <span>Theo Ngày</span>
            <span class="hidden sm:inline text-[10px] text-slate-400 font-normal">(Hotel/Resort)</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="rentalType === 1"
            (click)="setRentalType(1)"
            [ngClass]="rentalType === 1 ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-semibold'"
            class="px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Theo Giờ</span>
            <span class="hidden sm:inline text-[10px] text-slate-400 font-normal">(Nhà nghỉ/Motel)</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="rentalType === 2"
            (click)="setRentalType(2)"
            [ngClass]="rentalType === 2 ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-semibold'"
            class="px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            <span>Qua Đêm</span>
          </button>
        </div>

        <!-- Conditional Hourly Controls (When rentalType === 1) -->
        <div *ngIf="rentalType === 1" class="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs text-indigo-900 flex-wrap">
          <span class="font-bold text-[11px] flex items-center gap-1 text-indigo-700">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Giờ nhận phòng:
          </span>
          <select
            [(ngModel)]="checkInHour"
            (ngModelChange)="onHourlyConfigChange()"
            class="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="08:00">08:00 Sáng</option>
            <option value="10:00">10:00 Sáng</option>
            <option value="12:00">12:00 Trưa</option>
            <option value="14:00">14:00 Chiều</option>
            <option value="16:00">16:00 Chiều</option>
            <option value="18:00">18:00 Tối</option>
            <option value="20:00">20:00 Tối</option>
            <option value="22:00">22:00 Đêm</option>
          </select>

          <span class="font-bold text-[11px] text-indigo-700 ml-1">Số giờ ở:</span>
          <select
            [(ngModel)]="durationHours"
            (ngModelChange)="onHourlyConfigChange()"
            class="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option [value]="1">1 giờ</option>
            <option [value]="2">2 giờ</option>
            <option [value]="3">3 giờ</option>
            <option [value]="4">4 giờ</option>
            <option [value]="5">5 giờ</option>
            <option [value]="6">6 giờ</option>
          </select>
        </div>

        <!-- Destination Search Input with Grouped Autocomplete Dropdown -->
        <div class="relative flex-1 max-w-md min-w-[260px]">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <input
              type="text"
              [(ngModel)]="searchKeyword"
              (focus)="isAutocompleteOpen.set(true)"
              (input)="isAutocompleteOpen.set(true)"
              placeholder="Tìm Tỉnh/Thành, Khu du lịch, Địa danh..."
              class="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none p-0 min-h-[30px]"
            />
            <button
              *ngIf="searchKeyword"
              type="button"
              (click)="clearSearch()"
              class="text-slate-400 hover:text-slate-600 p-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Grouped Autocomplete Menu -->
          <div
            *ngIf="isAutocompleteOpen() && filteredSuggestions().length > 0"
            class="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto p-2 space-y-2">
            
            <!-- Group: Tỉnh / Thành phố -->
            <div *ngIf="groupedSuggestions().cities.length > 0">
              <div class="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <i class="pi pi-map text-[9px] text-indigo-500"></i> Thành phố / Tỉnh
              </div>
              <div
                *ngFor="let item of groupedSuggestions().cities"
                (click)="selectSuggestion(item)"
                class="px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 text-xs font-semibold text-slate-700 hover:text-indigo-900 cursor-pointer flex items-center justify-between">
                <span>{{ item.displayName }}</span>
                <span class="text-[10px] text-slate-400">Tỉnh/Thành</span>
              </div>
            </div>

            <!-- Group: Khu vực du lịch -->
            <div *ngIf="groupedSuggestions().zones.length > 0">
              <div class="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <i class="pi pi-compass text-[9px] text-emerald-500"></i> Khu vực du lịch
              </div>
              <div
                *ngFor="let item of groupedSuggestions().zones"
                (click)="selectSuggestion(item)"
                class="px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-slate-700 hover:text-emerald-900 cursor-pointer flex items-center justify-between">
                <span>{{ item.displayName }}</span>
                <span class="text-[10px] text-emerald-700 font-medium">Khu du lịch</span>
              </div>
            </div>

            <!-- Group: Địa danh nổi tiếng -->
            <div *ngIf="groupedSuggestions().landmarks.length > 0">
              <div class="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <i class="pi pi-flag text-[9px] text-amber-500"></i> Địa danh nổi tiếng
              </div>
              <div
                *ngFor="let item of groupedSuggestions().landmarks"
                (click)="selectSuggestion(item)"
                class="px-2.5 py-1.5 rounded-lg hover:bg-amber-50 text-xs font-semibold text-slate-700 hover:text-amber-900 cursor-pointer flex items-center justify-between">
                <span>{{ item.displayName }}</span>
                <span class="text-[10px] text-amber-700 font-medium">Địa danh</span>
              </div>
            </div>

            <!-- Group: Tên khách sạn / nhà nghỉ -->
            <div *ngIf="groupedSuggestions().properties.length > 0">
              <div class="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <i class="pi pi-building text-[9px] text-purple-500"></i> Khách sạn / Nhà nghỉ
              </div>
              <div
                *ngFor="let item of groupedSuggestions().properties"
                (click)="selectSuggestion(item)"
                class="px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-xs font-semibold text-slate-700 hover:text-purple-900 cursor-pointer flex items-center justify-between">
                <span class="truncate">{{ item.displayName }}</span>
                <span class="text-[10px] text-purple-700 font-medium shrink-0">Cơ sở</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Row 2: Property Type Quick Chips Filter -->
      <div class="flex items-center gap-1.5 flex-wrap text-xs pt-1">
        <span class="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mr-1 flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <span>Loại hình:</span>
        </span>

        <button
          type="button"
          (click)="setPropertyType('ALL')"
          [ngClass]="propertyType === 'ALL' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          Tất cả
        </button>
        <button
          type="button"
          (click)="setPropertyType(1)"
          [ngClass]="propertyType === 1 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          🏨 Khách sạn (Hotel)
        </button>
        <button
          type="button"
          (click)="setPropertyType(3)"
          [ngClass]="propertyType === 3 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          🏡 Nhà nghỉ
        </button>
        <button
          type="button"
          (click)="setPropertyType(2)"
          [ngClass]="propertyType === 2 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          ⚡ Motel
        </button>
        <button
          type="button"
          (click)="setPropertyType(4)"
          [ngClass]="propertyType === 4 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          🌿 Homestay
        </button>
        <button
          type="button"
          (click)="setPropertyType(5)"
          [ngClass]="propertyType === 5 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
          class="px-3 py-1 rounded-lg transition-colors cursor-pointer">
          🏖️ Resort
        </button>
      </div>

      <!-- Row 3: Price Range & Key Amenities Filter Pills -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
        <div class="space-y-2.5 flex-1 min-w-0">
          <!-- Price Range Filter Pills -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mr-1 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Mức giá:</span>
            </span>

            <button
              type="button"
              (click)="setPrice('ALL')"
              [ngClass]="priceRange === 'ALL' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              Tất cả
            </button>
            <button
              type="button"
              (click)="setPrice('UNDER_800K')"
              [ngClass]="priceRange === 'UNDER_800K' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              Dưới 800k
            </button>
            <button
              type="button"
              (click)="setPrice('800K_1500K')"
              [ngClass]="priceRange === '800K_1500K' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              800k - 1.5 triệu
            </button>
            <button
              type="button"
              (click)="setPrice('1500K_3000K')"
              [ngClass]="priceRange === '1500K_3000K' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              1.5 - 3 triệu
            </button>
            <button
              type="button"
              (click)="setPrice('ABOVE_3000K')"
              [ngClass]="priceRange === 'ABOVE_3000K' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              Trên 3 triệu
            </button>
          </div>

          <!-- Bed Type & Amenities -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mr-1 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10m0-5h18m0-5v10m-14-6h6a2 2 0 002-2V7H5v2a2 2 0 002 2z"/></svg>
              <span>Tiện ích:</span>
            </span>

            <button
              type="button"
              (click)="toggleAmenity('BATHTUB')"
              [ngClass]="isAmenityActive('BATHTUB') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer">
              <i class="pi pi-heart text-[10px]"></i>
              <span>Bồn tắm</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('BALCONY')"
              [ngClass]="isAmenityActive('BALCONY') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer">
              <i class="pi pi-compass text-[10px]"></i>
              <span>Ban công / View</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('BREAKFAST')"
              [ngClass]="isAmenityActive('BREAKFAST') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer">
              <i class="pi pi-coffee text-[10px]"></i>
              <span>Bữa sáng</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('KING_BED')"
              [ngClass]="isAmenityActive('KING_BED') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer">
              <i class="pi pi-star text-[10px]"></i>
              <span>Giường King</span>
            </button>

            <button
              *ngIf="hasActiveFilters"
              type="button"
              (click)="resetAll()"
              class="text-rose-600 hover:text-rose-800 font-bold ml-2 underline text-xs cursor-pointer">
              Xóa bộ lọc
            </button>
          </div>
        </div>

        <!-- Sort Selection -->
        <div class="flex items-center gap-2 text-xs text-slate-500 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <span class="font-semibold text-slate-700 whitespace-nowrap">Sắp xếp:</span>
          <select
            [(ngModel)]="sortBy"
            (ngModelChange)="onSortChange($event)"
            class="rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 py-1.5 px-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[36px]">
            <option value="POPULAR">Phổ biến &amp; Đề xuất</option>
            <option value="PRICE_ASC">Giá: Thấp đến cao</option>
            <option value="PRICE_DESC">Giá: Cao đến thấp</option>
            <option value="CAPACITY_DESC">Sức chứa: Nhiều người nhất</option>
          </select>
        </div>

      </div>

    </div>
  `
})
export class BookingFilterBarComponent {
  @Input() rentalType: number = 3; // Default Daily
  @Input() checkInHour: string = '14:00';
  @Input() durationHours: number = 2;
  @Input() propertyType: number | 'ALL' = 'ALL';
  @Input() priceRange: 'ALL' | 'UNDER_800K' | '800K_1500K' | '1500K_3000K' | 'ABOVE_3000K' = 'ALL';
  @Input() bedType: 'ALL' | 'SINGLE' | 'DOUBLE' | 'TWIN' | 'FAMILY' = 'ALL';
  @Input() activeAmenities: string[] = [];
  @Input() sortBy: 'POPULAR' | 'PRICE_ASC' | 'PRICE_DESC' | 'CAPACITY_DESC' = 'POPULAR';

  @Input() touristZones: TouristZoneDto[] = [];
  @Input() landmarks: LandmarkDto[] = [];
  @Input() properties: PublicPropertyDto[] = [];

  @Output() rentalTypeChange = new EventEmitter<number>();
  @Output() propertyTypeChange = new EventEmitter<number | 'ALL'>();
  @Output() filterChange = new EventEmitter<BookingFilterCriteria>();
  @Output() destinationSelected = new EventEmitter<DestinationSelection>();
  @Output() hourlyConfigChange = new EventEmitter<{ checkInHour: string; durationHours: number }>();

  searchKeyword = '';
  isAutocompleteOpen = signal<boolean>(false);

  allDestinationsList = computed<DestinationSelection[]>(() => {
    const list: DestinationSelection[] = [];

    // Distinct Cities
    const cities = new Set<string>();
    this.touristZones.forEach(z => {
      if (z.provinceName) cities.add(z.provinceName);
    });
    this.properties.forEach(p => {
      if (p.city) cities.add(p.city);
    });
    cities.forEach(c => {
      list.push({ category: 'city', displayName: c, searchTerm: c });
    });

    // Tourist Zones
    this.touristZones.forEach(z => {
      list.push({ category: 'touristZone', displayName: `${z.name} (${z.provinceName})`, searchTerm: z.name, slug: z.slug });
    });

    // Landmarks
    this.landmarks.forEach(lm => {
      list.push({ category: 'landmark', displayName: lm.name, searchTerm: lm.name, slug: lm.slug });
    });

    // Properties
    this.properties.forEach(p => {
      list.push({ category: 'property', displayName: `${p.name} - ${p.address}`, searchTerm: p.name, slug: p.slug });
    });

    return list;
  });

  filteredSuggestions = computed(() => {
    const kw = this.searchKeyword.trim().toLowerCase();
    const all = this.allDestinationsList();
    if (!kw) return all.slice(0, 15);
    return all.filter(item => item.displayName.toLowerCase().includes(kw)).slice(0, 20);
  });

  groupedSuggestions = computed(() => {
    const list = this.filteredSuggestions();
    return {
      cities: list.filter(i => i.category === 'city'),
      zones: list.filter(i => i.category === 'touristZone'),
      landmarks: list.filter(i => i.category === 'landmark'),
      properties: list.filter(i => i.category === 'property')
    };
  });

  get hasActiveFilters(): boolean {
    return (
      this.propertyType !== 'ALL' ||
      this.priceRange !== 'ALL' ||
      this.bedType !== 'ALL' ||
      this.activeAmenities.length > 0 ||
      this.sortBy !== 'POPULAR'
    );
  }

  setRentalType(type: number): void {
    this.rentalType = type;
    this.rentalTypeChange.emit(type);
    this.emitChange();
  }

  setPropertyType(type: number | 'ALL'): void {
    this.propertyType = type;
    this.propertyTypeChange.emit(type);
    this.emitChange();
  }

  setPrice(range: 'ALL' | 'UNDER_800K' | '800K_1500K' | '1500K_3000K' | 'ABOVE_3000K'): void {
    this.priceRange = range;
    this.emitChange();
  }

  setBed(bed: 'ALL' | 'SINGLE' | 'DOUBLE' | 'TWIN' | 'FAMILY'): void {
    this.bedType = bed;
    this.emitChange();
  }

  isAmenityActive(code: string): boolean {
    return this.activeAmenities.includes(code);
  }

  toggleAmenity(code: string): void {
    if (this.activeAmenities.includes(code)) {
      this.activeAmenities = this.activeAmenities.filter(a => a !== code);
    } else {
      this.activeAmenities = [...this.activeAmenities, code];
    }
    this.emitChange();
  }

  onSortChange(newSort: 'POPULAR' | 'PRICE_ASC' | 'PRICE_DESC' | 'CAPACITY_DESC'): void {
    this.sortBy = newSort;
    this.emitChange();
  }

  onHourlyConfigChange(): void {
    this.hourlyConfigChange.emit({
      checkInHour: this.checkInHour,
      durationHours: this.durationHours
    });
    this.emitChange();
  }

  selectSuggestion(item: DestinationSelection): void {
    this.searchKeyword = item.searchTerm;
    this.isAutocompleteOpen.set(false);
    this.destinationSelected.emit(item);
  }

  clearSearch(): void {
    this.searchKeyword = '';
    this.isAutocompleteOpen.set(false);
    this.destinationSelected.emit({ category: 'city', displayName: '', searchTerm: '' });
  }

  resetAll(): void {
    this.propertyType = 'ALL';
    this.priceRange = 'ALL';
    this.bedType = 'ALL';
    this.activeAmenities = [];
    this.sortBy = 'POPULAR';
    this.searchKeyword = '';
    this.emitChange();
  }

  private emitChange(): void {
    this.filterChange.emit({
      rentalType: this.rentalType,
      propertyType: this.propertyType,
      priceRange: this.priceRange,
      bedType: this.bedType,
      amenities: [...this.activeAmenities],
      sortBy: this.sortBy,
      checkInHour: this.checkInHour,
      durationHours: this.durationHours
    });
  }
}
