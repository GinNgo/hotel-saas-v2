import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { removeVietnameseAccents } from '../../../core/models/location.model';

export interface LocationPickerResult {
  address: string;
  latitude: number;
  longitude: number;
  provinceName?: string;
  provinceCode?: string;
  placeName?: string;
}

interface PopularLocationPreset {
  name: string;
  provinceName: string;
  provinceCode: string;
  address: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-google-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Search Input Bar with Google Maps Icon -->
      <div class="relative">
        <div class="relative flex items-center">
          <span class="absolute left-3 text-red-500 flex items-center">
            <i class="pi pi-map-marker text-base"></i>
          </span>
          <input
            #searchBox
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchQueryChange($event)"
            [ngModelOptions]="{standalone: true}"
            placeholder="Tìm kiếm địa chỉ, tên đường hoặc vị trí trên Google Maps..."
            class="w-full pl-9 pr-24 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition-all"
          />
          <div class="absolute right-2 flex items-center gap-1">
            @if (searchQuery()) {
              <button
                type="button"
                (click)="clearSearch()"
                class="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                title="Xóa tìm kiếm"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            }
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              Maps
            </span>
          </div>
        </div>

        <!-- Autocomplete Suggestions Dropdown -->
        @if (suggestions().length > 0 && showSuggestions()) {
          <div
            class="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto"
          >
            @for (sug of suggestions(); track sug.name) {
              <button
                type="button"
                (click)="applySuggestion(sug)"
                class="w-full text-left p-2.5 text-xs hover:bg-indigo-50/70 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <i class="pi pi-map-marker text-rose-500 mt-0.5 shrink-0"></i>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-slate-800 truncate">{{ sug.name }}</div>
                  <div class="text-[11px] text-slate-500 truncate">{{ sug.address }}</div>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">
                  {{ sug.provinceName }}
                </span>
              </button>
            }
          </div>
        }
      </div>

      <!-- Quick Location Presets Row -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span class="text-[11px] text-slate-400 shrink-0 font-medium flex items-center gap-1">
          <i class="pi pi-bolt text-amber-500 text-[10px]"></i> Gợi ý nhanh:
        </span>
        @for (preset of presets; track preset.name) {
          <button
            type="button"
            (click)="selectPreset(preset)"
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-medium shrink-0 transition-colors border border-slate-200/60 cursor-pointer"
          >
            {{ preset.name }}
          </button>
        }
      </div>

      <!-- Interactive Map Frame & Marker Container -->
      <div
        class="relative w-full h-52 sm:h-64 rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-inner flex flex-col"
      >
        <!-- Map Canvas / Embed preview -->
        <iframe
          #mapIframe
          [src]="mapEmbedUrl()"
          class="w-full h-full border-0 pointer-events-auto"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="Bản đồ vị trí cơ sở lưu trú Google Maps"
        ></iframe>

        <!-- Map Info Overlay Bar -->
        <div
          class="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md rounded-xl p-2.5 border border-slate-200 shadow-md flex items-center justify-between gap-2 text-xs"
        >
          <div class="flex items-center gap-2 truncate min-w-0 flex-1">
            <div class="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <i class="pi pi-map-marker text-xs"></i>
            </div>
            <div class="truncate min-w-0">
              <div class="font-bold text-slate-800 truncate text-[11px] sm:text-xs">
                {{ currentAddress() || 'Đã ghim vị trí trên Google Maps' }}
              </div>
              <div class="text-[10px] text-slate-500 font-mono">
                GPS: {{ currentLat().toFixed(4) }}, {{ currentLng().toFixed(4) }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <a
              [href]="externalGoogleMapsUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Mở toàn màn hình trong Google Maps"
            >
              <i class="pi pi-external-link text-[10px]"></i>
              <span class="hidden sm:inline">Xem Google Maps</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GoogleMapPickerComponent implements OnInit {
  @Input() initialAddress = '';
  @Input() initialLat = 10.7769; // TP. Hồ Chí Minh
  @Input() initialLng = 106.7009;

  @Output() locationSelected = new EventEmitter<LocationPickerResult>();

  readonly currentLat = signal(10.7769);
  readonly currentLng = signal(106.7009);
  readonly currentAddress = signal('');
  readonly searchQuery = signal('');
  readonly showSuggestions = signal(false);
  readonly suggestions = signal<PopularLocationPreset[]>([]);

  readonly presets: PopularLocationPreset[] = [
    {
      name: 'TP. Hồ Chí Minh (Quận 1)',
      provinceName: 'Thành phố Hồ Chí Minh',
      provinceCode: '79',
      address: 'Đường Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
      lat: 10.7725,
      lng: 106.6980
    },
    {
      name: 'Hà Nội (Hồ Gươm)',
      provinceName: 'Thành phố Hà Nội',
      provinceCode: '1',
      address: 'Phố Đinh Tiên Hoàng, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội',
      lat: 21.0285,
      lng: 105.8542
    },
    {
      name: 'Đà Nẵng (Biển Mỹ Khê)',
      provinceName: 'Thành phố Đà Nẵng',
      provinceCode: '48',
      address: 'Đường Võ Nguyên Giáp, Phường Phước Mỹ, Quận Sơn Trà, Đà Nẵng',
      lat: 16.0601,
      lng: 108.2464
    },
    {
      name: 'Đà Lạt (Hồ Xuân Hương)',
      provinceName: 'Tỉnh Lâm Đồng',
      provinceCode: '68',
      address: 'Đường Trần Quốc Toản, Phường 1, TP. Đà Lạt, Lâm Đồng',
      lat: 11.9404,
      lng: 108.4452
    },
    {
      name: 'Nha Trang (Đường Trần Phú)',
      provinceName: 'Tỉnh Khánh Hòa',
      provinceCode: '56',
      address: 'Đường Trần Phú, Phường Lộc Thọ, TP. Nha Trang, Khánh Hòa',
      lat: 12.2388,
      lng: 109.1967
    },
    {
      name: 'Vũng Tàu (Bãi Sau)',
      provinceName: 'Tỉnh Bà Rịa - Vũng Tàu',
      provinceCode: '77',
      address: 'Đường Thùy Vân, Phường Thắng Tam, TP. Vũng Tàu, Bà Rịa - Vũng Tàu',
      lat: 10.3347,
      lng: 107.0898
    },
    {
      name: 'Phú Quốc (Bãi Trường)',
      provinceName: 'Tỉnh Kiên Giang',
      provinceCode: '91',
      address: 'Đường Trần Hưng Đạo, Dương Tơ, TP. Phú Quốc, Kiên Giang',
      lat: 10.1698,
      lng: 103.9930
    }
  ];

  ngOnInit(): void {
    if (this.initialLat && this.initialLng) {
      this.currentLat.set(this.initialLat);
      this.currentLng.set(this.initialLng);
    }
    if (this.initialAddress) {
      this.currentAddress.set(this.initialAddress);
      this.searchQuery.set(this.initialAddress);
    }
  }

  private readonly sanitizer = inject(DomSanitizer);

  readonly mapEmbedUrl = computed<SafeResourceUrl>(() => {
    const lat = this.currentLat();
    const lng = this.currentLng();
    const url = `https://maps.google.com/maps?q=${lat},${lng}&hl=vi&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  readonly externalGoogleMapsUrl = computed(() => {
    const lat = this.currentLat();
    const lng = this.currentLng();
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  });

  onSearchQueryChange(query: string): void {
    this.searchQuery.set(query);
    const q = query.trim();
    if (q.length < 2) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
      return;
    }

    const normQ = removeVietnameseAccents(q);
    const matched = this.presets.filter(p => {
      const normName = removeVietnameseAccents(p.name);
      const normAddr = removeVietnameseAccents(p.address);
      const normProv = removeVietnameseAccents(p.provinceName);
      return normName.includes(normQ) || normAddr.includes(normQ) || normProv.includes(normQ);
    });

    this.suggestions.set(matched);
    this.showSuggestions.set(matched.length > 0);
  }

  applySuggestion(item: PopularLocationPreset): void {
    this.selectPreset(item);
    this.showSuggestions.set(false);
  }

  selectPreset(preset: PopularLocationPreset): void {
    this.currentLat.set(preset.lat);
    this.currentLng.set(preset.lng);
    this.currentAddress.set(preset.address);
    this.searchQuery.set(preset.address);
    this.showSuggestions.set(false);

    this.locationSelected.emit({
      address: preset.address,
      latitude: preset.lat,
      longitude: preset.lng,
      provinceName: preset.provinceName,
      provinceCode: preset.provinceCode,
      placeName: preset.name
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.showSuggestions.set(false);
  }

  /**
   * Cập nhật vị trí từ địa chỉ người dùng gõ
   */
  updateLocationFromAddress(address: string, provinceName?: string): void {
    if (!address) return;
    this.currentAddress.set(address);
    // Find if matches any preset
    const norm = removeVietnameseAccents(address);
    const match = this.presets.find(p => norm.includes(removeVietnameseAccents(p.provinceName)));
    if (match) {
      this.currentLat.set(match.lat);
      this.currentLng.set(match.lng);
    }
  }
}
