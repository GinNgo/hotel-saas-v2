import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { removeVietnameseAccents } from '../../../core/models/location.model';
import { VIETNAM_34_PROVINCES } from '../../../core/data/vietnam-provinces.data';

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
  keywords?: string;
  isRawCoord?: boolean;
}

const PROVINCE_COORDINATES: Readonly<Record<string, { lat: number; lng: number }>> = {
  hanoi: { lat: 21.0285, lng: 105.8542 },
  quangninh: { lat: 20.9599, lng: 107.0425 },
  laocai: { lat: 22.3364, lng: 103.8438 },
  ninhbinh: { lat: 20.2506, lng: 105.9745 },
  haiphong: { lat: 20.7278, lng: 107.0482 },
  hagiang: { lat: 22.8233, lng: 104.9836 },
  caobang: { lat: 22.8535, lng: 106.7224 },
  hoabinh: { lat: 20.6606, lng: 105.0725 },
  yenbai: { lat: 21.8492, lng: 104.0888 },
  langson: { lat: 21.8537, lng: 106.7615 },
  danang: { lat: 16.0601, lng: 108.2464 },
  quangnam: { lat: 15.8801, lng: 108.3380 },
  khanhhoa: { lat: 12.2388, lng: 109.1967 },
  hue: { lat: 16.4637, lng: 107.5909 },
  binhdinh: { lat: 13.7830, lng: 109.2197 },
  binhthuan: { lat: 10.9333, lng: 108.2833 },
  phuyen: { lat: 13.0955, lng: 109.3209 },
  quangbinh: { lat: 17.5526, lng: 106.2835 },
  quangtri: { lat: 16.9255, lng: 107.1856 },
  quangngai: { lat: 15.3822, lng: 109.1180 },
  lamdong: { lat: 11.9404, lng: 108.4452 },
  daklak: { lat: 12.6667, lng: 108.0500 },
  kontum: { lat: 14.5968, lng: 108.2932 },
  gialai: { lat: 13.9833, lng: 108.0000 },
  hcm: { lat: 10.7725, lng: 106.6980 },
  vungtau: { lat: 10.3347, lng: 107.0898 },
  kiengiang: { lat: 10.1698, lng: 103.9930 },
  cantho: { lat: 10.0452, lng: 105.7469 },
  angiang: { lat: 10.6976, lng: 105.0682 },
  bentre: { lat: 10.2434, lng: 106.3756 },
  dongthap: { lat: 10.2921, lng: 105.7586 },
  tayninh: { lat: 11.3736, lng: 106.1763 },
  camau: { lat: 8.6061, lng: 104.7250 },
  binhduong: { lat: 10.9036, lng: 106.7011 }
};

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
            (keydown.enter)="onSearchEnter($event)"
            [ngModelOptions]="{standalone: true}"
            placeholder="Tìm 34 tỉnh/khu du lịch, dán tọa độ (10.77, 106.69) hoặc link Google Maps..."
            class="w-full pl-9 pr-24 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition-all"
          />
          <div class="absolute right-2 flex items-center gap-1">
            @if (searchQuery()) {
              <button
                type="button"
                (click)="clearSearch()"
                class="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
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
            @for (sug of suggestions(); track sug.name + '-' + sug.lat + '-' + sug.lng) {
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

      <!-- Quick Location Presets & GPS Row -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          (click)="useCurrentLocation()"
          [disabled]="locatingGps()"
          class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1"
        >
          @if (locatingGps()) {
            <i class="pi pi-spin pi-spinner text-[10px]"></i>
            <span>Đang định vị...</span>
          } @else {
            <span>📍 Vị trí hiện tại</span>
          }
        </button>
        <span class="text-[11px] text-slate-400 shrink-0 font-medium flex items-center gap-1 ml-1">
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

      @if (geoError()) {
        <div role="alert" class="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span>{{ geoError() }}</span>
          <button
            type="button"
            (click)="geoError.set(null)"
            class="text-rose-500 hover:text-rose-700 cursor-pointer"
            aria-label="Đóng thông báo lỗi vị trí"
          >
            <i class="pi pi-times text-[10px]"></i>
          </button>
        </div>
      }

      <!-- Compact Numeric Coordinate Inputs -->
      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1" for="map-picker-lat">
            Vĩ độ (Lat)
          </label>
          <input
            id="map-picker-lat"
            type="number"
            step="0.0001"
            min="-90"
            max="90"
            [ngModel]="currentLat()"
            (ngModelChange)="onManualLatChange($event)"
            [ngModelOptions]="{standalone: true}"
            class="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1" for="map-picker-lng">
            Kinh độ (Lng)
          </label>
          <input
            id="map-picker-lng"
            type="number"
            step="0.0001"
            min="-180"
            max="180"
            [ngModel]="currentLng()"
            (ngModelChange)="onManualLngChange($event)"
            [ngModelOptions]="{standalone: true}"
            class="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
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
export class GoogleMapPickerComponent implements OnInit, OnChanges {
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
  readonly locatingGps = signal(false);
  readonly geoError = signal<string | null>(null);

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

  readonly searchableCatalog: PopularLocationPreset[] = [
    ...this.presets,
    ...VIETNAM_34_PROVINCES.map((prov): PopularLocationPreset => {
      const coords = PROVINCE_COORDINATES[prov.id] ?? { lat: 10.7769, lng: 106.7009 };
      const label =
        prov.shortName !== prov.name
          ? `${prov.shortName} (${prov.name})`
          : `${prov.name} — ${prov.touristZone}`;
      return {
        name: label,
        provinceName: prov.name,
        provinceCode: prov.code,
        address: `${prov.touristZone}, ${prov.name}`,
        lat: coords.lat,
        lng: coords.lng,
        keywords: [prov.name, prov.shortName, prov.searchTerm, prov.touristZone, ...prov.hotLandmarks].join(' ')
      };
    })
  ];

  private readonly sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    this.syncInitialCoords();
    if (this.initialAddress) {
      this.currentAddress.set(this.initialAddress);
      this.searchQuery.set(this.initialAddress);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLat'] || changes['initialLng']) {
      this.syncInitialCoords();
    }
    if (changes['initialAddress'] && this.initialAddress !== this.currentAddress()) {
      const addr = this.initialAddress ?? '';
      this.currentAddress.set(addr);
      this.searchQuery.set(addr);
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

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

    const parsedCoords = this.parseCoordinatesFromInput(q);
    const rawCoordSuggestion: PopularLocationPreset[] = parsedCoords
      ? [
          {
            name: `📌 Ghim tọa độ GPS: ${parsedCoords.lat.toFixed(4)}, ${parsedCoords.lng.toFixed(4)}`,
            provinceName: 'Tọa độ GPS',
            provinceCode: '',
            address: `Vị trí GPS (${parsedCoords.lat.toFixed(4)}, ${parsedCoords.lng.toFixed(4)})`,
            lat: parsedCoords.lat,
            lng: parsedCoords.lng,
            isRawCoord: true
          }
        ]
      : [];

    const normQ = removeVietnameseAccents(q);
    const matched = this.searchableCatalog.filter(p => {
      const normName = removeVietnameseAccents(p.name);
      const normAddr = removeVietnameseAccents(p.address);
      const normProv = removeVietnameseAccents(p.provinceName);
      const normKeys = p.keywords ? removeVietnameseAccents(p.keywords) : '';
      return (
        normName.includes(normQ) ||
        normAddr.includes(normQ) ||
        normProv.includes(normQ) ||
        normKeys.includes(normQ)
      );
    });

    const combined = [...rawCoordSuggestion, ...matched].slice(0, 12);
    this.suggestions.set(combined);
    this.showSuggestions.set(combined.length > 0);
  }

  onSearchEnter(event: Event): void {
    const firstRaw = this.suggestions().find(s => s.isRawCoord);
    if (firstRaw) {
      event.preventDefault();
      this.applySuggestion(firstRaw);
    }
  }

  applySuggestion(item: PopularLocationPreset): void {
    this.selectPreset(item);
    this.showSuggestions.set(false);
  }

  selectPreset(preset: PopularLocationPreset): void {
    this.geoError.set(null);
    this.currentLat.set(preset.lat);
    this.currentLng.set(preset.lng);
    this.currentAddress.set(preset.address);
    this.searchQuery.set(preset.address);
    this.showSuggestions.set(false);

    this.locationSelected.emit({
      address: preset.address,
      latitude: preset.lat,
      longitude: preset.lng,
      provinceName: preset.isRawCoord ? undefined : preset.provinceName,
      provinceCode: preset.provinceCode || undefined,
      placeName: preset.isRawCoord ? undefined : preset.name
    });
  }

  onManualLatChange(value: number | string): void {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!this.isValidCoord(parsed, this.currentLng())) return;
    this.updateCoordinates(parsed, this.currentLng());
  }

  onManualLngChange(value: number | string): void {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!this.isValidCoord(this.currentLat(), parsed)) return;
    this.updateCoordinates(this.currentLat(), parsed);
  }

  useCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.geoError.set('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    this.geoError.set(null);
    this.locatingGps.set(true);

    const handleSuccess = (pos: GeolocationPosition): void => {
      this.locatingGps.set(false);
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      if (!this.isValidCoord(lat, lng)) {
        this.geoError.set('Tọa độ GPS trả về không hợp lệ.');
        return;
      }
      this.updateCoordinates(lat, lng);
    };

    const handleFinalError = (err: GeolocationPositionError): void => {
      this.locatingGps.set(false);
      if (err.code === 1) {
        this.geoError.set('Quyền truy cập vị trí đã bị từ chối. Vui lòng cấp quyền GPS trên trình duyệt.');
      } else if (err.code === 3) {
        this.geoError.set('Hết thời gian chờ định vị GPS. Vui lòng thử lại hoặc nhập tọa độ trực tiếp.');
      } else {
        this.geoError.set('Không thể xác định vị trí hiện tại. Vui lòng thử lại hoặc tìm tỉnh/thành trên bản đồ.');
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err: GeolocationPositionError) => {
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleFinalError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000
          });
        } else {
          handleFinalError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.showSuggestions.set(false);
  }

  /**
   * Cập nhật vị trí từ địa chỉ người dùng gõ
   */
  updateLocationFromAddress(address: string): void {
    if (!address) return;
    this.currentAddress.set(address);
    const norm = removeVietnameseAccents(address);
    const match = this.searchableCatalog.find(
      p =>
        norm.includes(removeVietnameseAccents(p.provinceName)) ||
        (p.keywords ? removeVietnameseAccents(p.keywords).split(' ').some(k => k.length > 2 && norm.includes(k)) : false)
    );
    if (match) {
      this.currentLat.set(match.lat);
      this.currentLng.set(match.lng);
    }
  }

  private updateCoordinates(lat: number, lng: number): void {
    this.geoError.set(null);
    this.currentLat.set(lat);
    this.currentLng.set(lng);
    const addr = this.currentAddress().trim() || `Vị trí GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    this.currentAddress.set(addr);
    this.locationSelected.emit({
      address: addr,
      latitude: lat,
      longitude: lng
    });
  }

  private syncInitialCoords(): void {
    if (this.isValidCoord(this.initialLat, this.initialLng)) {
      this.currentLat.set(this.initialLat);
      this.currentLng.set(this.initialLng);
    }
  }

  private parseCoordinatesFromInput(input: string): { lat: number; lng: number } | null {
    // 1. Direct lat, lng input (e.g., "10.7725, 106.6980")
    const directMatch = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(input);
    if (directMatch) {
      const lat = Number.parseFloat(directMatch[1]);
      const lng = Number.parseFloat(directMatch[2]);
      return this.isValidCoord(lat, lng) ? { lat, lng } : null;
    }

    // 2. Google Maps URL with @lat,lng
    const atMatch = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input);
    if (atMatch) {
      const lat = Number.parseFloat(atMatch[1]);
      const lng = Number.parseFloat(atMatch[2]);
      return this.isValidCoord(lat, lng) ? { lat, lng } : null;
    }

    // 3. Google Maps URL with q=lat,lng or query=lat,lng or ll=lat,lng
    const queryMatch = /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input);
    if (queryMatch) {
      const lat = Number.parseFloat(queryMatch[1]);
      const lng = Number.parseFloat(queryMatch[2]);
      return this.isValidCoord(lat, lng) ? { lat, lng } : null;
    }

    return null;
  }

  private isValidCoord(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}
