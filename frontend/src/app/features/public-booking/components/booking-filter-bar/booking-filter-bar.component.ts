import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface BookingFilterCriteria {
  priceRange: 'ALL' | 'UNDER_800K' | '800K_1500K' | '1500K_3000K' | 'ABOVE_3000K';
  bedType: 'ALL' | 'SINGLE' | 'DOUBLE' | 'TWIN' | 'FAMILY';
  amenities: string[];
  sortBy: 'POPULAR' | 'PRICE_ASC' | 'PRICE_DESC' | 'CAPACITY_DESC';
}

@Component({
  selector: 'app-booking-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl border border-slate-200/90 p-4 mb-6 shadow-xs">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        <!-- Left: Filters Group -->
        <div class="space-y-3 flex-1 min-w-0">
          
          <!-- Row 1: Price Range Filter Pills -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-bold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mr-1 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Mức giá:</span>
            </span>

            <button
              type="button"
              (click)="setPrice('ALL')"
              [ngClass]="priceRange === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2.5 py-1 rounded-lg transition-colors">
              Tất cả
            </button>
            <button
              type="button"
              (click)="setPrice('UNDER_800K')"
              [ngClass]="priceRange === 'UNDER_800K' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2.5 py-1 rounded-lg transition-colors">
              Dưới 800k
            </button>
            <button
              type="button"
              (click)="setPrice('800K_1500K')"
              [ngClass]="priceRange === '800K_1500K' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2.5 py-1 rounded-lg transition-colors">
              800k - 1.5 triệu
            </button>
            <button
              type="button"
              (click)="setPrice('1500K_3000K')"
              [ngClass]="priceRange === '1500K_3000K' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2.5 py-1 rounded-lg transition-colors">
              1.5 - 3 triệu
            </button>
            <button
              type="button"
              (click)="setPrice('ABOVE_3000K')"
              [ngClass]="priceRange === 'ABOVE_3000K' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2.5 py-1 rounded-lg transition-colors">
              Trên 3 triệu
            </button>
          </div>

          <!-- Row 2: Bed Type & Key Amenities Filter Chips -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-bold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mr-1 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10m0-5h18m0-5v10m-14-6h6a2 2 0 002-2V7H5v2a2 2 0 002 2z"/></svg>
              <span>Tiện ích:</span>
            </span>

            <button
              type="button"
              (click)="toggleAmenity('BATHTUB')"
              [ngClass]="isAmenityActive('BATHTUB') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1">
              <i class="pi pi-heart text-[10px]"></i>
              <span>Bồn tắm nằm</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('BALCONY')"
              [ngClass]="isAmenityActive('BALCONY') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1">
              <i class="pi pi-compass text-[10px]"></i>
              <span>Ban công / View</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('BREAKFAST')"
              [ngClass]="isAmenityActive('BREAKFAST') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1">
              <i class="pi pi-coffee text-[10px]"></i>
              <span>Bữa sáng</span>
            </button>

            <button
              type="button"
              (click)="toggleAmenity('KING_BED')"
              [ngClass]="isAmenityActive('KING_BED') ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
              class="px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1">
              <i class="pi pi-star text-[10px]"></i>
              <span>Giường King cỡ lớn</span>
            </button>

            <!-- Reset Filters CTA -->
            <button
              *ngIf="hasActiveFilters"
              type="button"
              (click)="resetAll()"
              class="text-rose-600 hover:text-rose-800 font-bold ml-2 underline text-xs">
              Xóa bộ lọc
            </button>
          </div>
        </div>

        <!-- Right: Sort Dropdown & Count -->
        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div class="flex items-center gap-2 text-xs text-slate-500">
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
    </div>
  `
})
export class BookingFilterBarComponent {
  @Input() priceRange: 'ALL' | 'UNDER_800K' | '800K_1500K' | '1500K_3000K' | 'ABOVE_3000K' = 'ALL';
  @Input() bedType: 'ALL' | 'SINGLE' | 'DOUBLE' | 'TWIN' | 'FAMILY' = 'ALL';
  @Input() activeAmenities: string[] = [];
  @Input() sortBy: 'POPULAR' | 'PRICE_ASC' | 'PRICE_DESC' | 'CAPACITY_DESC' = 'POPULAR';

  @Output() filterChange = new EventEmitter<BookingFilterCriteria>();

  get hasActiveFilters(): boolean {
    return this.priceRange !== 'ALL' || this.bedType !== 'ALL' || this.activeAmenities.length > 0 || this.sortBy !== 'POPULAR';
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

  resetAll(): void {
    this.priceRange = 'ALL';
    this.bedType = 'ALL';
    this.activeAmenities = [];
    this.sortBy = 'POPULAR';
    this.emitChange();
  }

  private emitChange(): void {
    this.filterChange.emit({
      priceRange: this.priceRange,
      bedType: this.bedType,
      amenities: [...this.activeAmenities],
      sortBy: this.sortBy
    });
  }
}
