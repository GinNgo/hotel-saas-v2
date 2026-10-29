import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { PublicPropertyDto, PublicRoomTypeAvailabilityDto, RentalType } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { PublicStayContext, publicStayInterval, readPublicStay } from '../../core/models/public-stay-context';
import { PhotoGalleryModalComponent, GalleryPhotoItem } from '../../shared';

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PhotoGalleryModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6 sm:space-y-8 font-sans">
      <!-- 1. TOP NAV: BREADCRUMB & RETURN LINK -->
      <nav class="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200/60" aria-label="Điều hướng">
        <a
          routerLink="/booking"
          [queryParams]="returnQueryParams()"
          class="inline-flex min-h-11 items-center gap-2 text-stone-700 hover:text-[#C05621] font-semibold transition-colors cursor-pointer"
        >
          <i class="pi pi-arrow-left text-[11px] text-[#C05621]"></i>
          <span>Quay lại tìm kiếm cơ sở</span>
        </a>
        <div class="hidden sm:flex items-center gap-2 text-stone-400">
          <span>Khách sạn &amp; Resort</span>
          <span>&bull;</span>
          <span class="text-[#0D2E28] font-bold">{{ property()?.name || 'Chi tiết' }}</span>
        </div>
      </nav>

      <!-- ALERT MESSAGE NẾU CÓ LỖI -->
      @if (error()) {
        <div role="alert" class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <i class="pi pi-exclamation-triangle text-rose-600"></i>
            <span class="text-xs sm:text-sm font-medium">{{ error() }}</span>
          </div>
          <button type="button" (click)="refresh()" class="min-h-11 px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer">
            Thử lại
          </button>
        </div>
      }

      @if (loading()) {
        <div class="p-16 text-center space-y-3" role="status">
          <i class="pi pi-spin pi-spinner text-3xl text-[#0D2E28]"></i>
          <p class="text-sm font-medium text-stone-600">Đang tải hồ sơ chỗ nghỉ &amp; biểu giá di sản…</p>
        </div>
      }

      @if (property(); as hotel) {
        <!-- 2. HOTEL HEADER: EDITORIAL TYPOGRAPHY & RATINGS -->
        <header class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            @if (hotel.tenantBrandName) {
              <span class="text-xs font-extrabold text-[#C05621] uppercase tracking-widest">
                {{ hotel.tenantBrandName }}
              </span>
              <span class="text-stone-300">&bull;</span>
            }
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              {{ hotel.propertyTypeName || hotel.propertyType }}
            </span>
            @if (hotel.starRating && hotel.starRating >= 3) {
              <span class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80">
                <i class="pi pi-star-fill text-[10px] text-amber-500"></i>
                <span>{{ hotel.starRating }}★ Tiêu chuẩn cao cấp</span>
              </span>
            }
          </div>

          <h1 class="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-900 tracking-tight leading-[1.15]">
            {{ hotel.name }}
          </h1>

          <div class="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-stone-600">
            <a
              [href]="googleMapsDirectionsUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-stone-700 hover:text-[#C05621] transition-colors group cursor-pointer"
              title="Xem vị trí & chỉ đường trên Google Maps"
            >
              <i class="pi pi-map-marker text-[#C05621]"></i>
              <span class="underline decoration-stone-300 underline-offset-2 group-hover:decoration-[#C05621]">
                {{ hotel.addressLine || hotel.address }}, {{ hotel.provinceName || hotel.city }}
              </span>
              <i class="pi pi-external-link text-[10px] text-stone-400 group-hover:text-[#C05621]"></i>
            </a>
            @if (hotel.reviewCount > 0) {
              <span class="text-stone-300 hidden sm:inline">&bull;</span>
              <p class="flex items-center gap-1 text-stone-800 font-semibold">
                <i class="pi pi-star-fill text-amber-500 text-xs"></i>
                <span>{{ hotel.ratingAverage | number:'1.1-1' }}</span>
                <span class="text-stone-500 font-normal">({{ hotel.reviewCount }} đánh giá xác thực)</span>
              </p>
            } @else {
              <span class="text-stone-300 hidden sm:inline">&bull;</span>
              <p class="text-xs text-stone-400">Được quản lý trên nền tảng Hotel SaaS</p>
            }
          </div>
        </header>

        <!-- 3. ASYMMETRIC 5-PHOTO EDITORIAL GALLERY MOSAIC -->
        <section aria-label="Bộ sưu tập ảnh chỗ nghỉ" class="rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-stone-200/90 bg-stone-100">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-2.5 p-2 sm:p-2.5">
            <!-- Hero Photo: Spans 2 cols, 2 rows on desktop -->
            <button
              type="button"
              (click)="openGallery()"
              class="relative md:col-span-2 md:row-span-2 h-72 sm:h-96 md:h-[420px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer text-left focus-visible:outline-[#C05621]"
              aria-label="Xem ảnh chính cơ sở"
            >
              <img
                [src]="getPhotoUrl(hotel, 0)"
                [alt]="hotel.name"
                class="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
              <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                <span class="px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 border border-white/20">
                  <i class="pi pi-camera text-amber-300 text-xs"></i>
                  <span>Ảnh chính khuôn viên</span>
                </span>
                <span class="hidden sm:inline-flex text-[11px] text-stone-200 bg-black/40 px-2.5 py-1 rounded-lg">
                  Nhấn để phóng to
                </span>
              </div>
            </button>

            <!-- 4 Auxiliary Mosaic Photos -->
            @for (idx of [1, 2, 3, 4]; track idx) {
              <button
                type="button"
                (click)="openGallery()"
                class="relative hidden sm:block h-[205px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer text-left focus-visible:outline-[#C05621]"
                [attr.aria-label]="'Xem ảnh ' + (idx + 1)"
              >
                <img
                  [src]="getPhotoUrl(hotel, idx)"
                  [alt]="hotel.name + ' - Ảnh ' + (idx + 1)"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                @if (idx === 4) {
                  <!-- Tinted Overlay on 4th thumbnail to view entire album -->
                  <div class="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-2 text-center group-hover:bg-slate-950/80 transition-colors">
                    <i class="pi pi-images text-2xl mb-1 text-amber-300"></i>
                    <span class="text-xs font-bold uppercase tracking-wider">Xem tất cả ảnh</span>
                    <span class="text-[11px] text-stone-300 mt-0.5">{{ totalPhotosCount(hotel) }} ảnh chi tiết</span>
                  </div>
                }
              </button>
            }
          </div>
        </section>

        <!-- 4. MAIN CONTENT (2 COLUMNS: LEFT ROOMS & POLICIES / RIGHT STICKY QUOTE) -->
        <div class="grid lg:grid-cols-3 gap-8 items-start pt-2">
          <!-- CỘT TRÁI: CONCIERGE BAR & ROOM LIST (2 CỘT) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- CONCIERGE BOOKING SELECTOR -->
            <section class="bg-white rounded-3xl border border-stone-200/90 shadow-sm p-6 space-y-5" aria-labelledby="stay-title">
              <div class="flex items-center justify-between pb-3 border-b border-stone-100">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-[#0D2E28] text-amber-200 flex items-center justify-center font-bold text-sm">
                    <i class="pi pi-calendar-clock"></i>
                  </div>
                  <div>
                    <h2 id="stay-title" class="text-base font-bold text-stone-900">Chọn Lịch &amp; Kiểm Tra Phòng Trống</h2>
                    <p class="text-xs text-stone-500">Đồng bộ lịch phòng thực từ hệ thống PMS thời gian thực</p>
                  </div>
                </div>

                <!-- Mode tags -->
                <div class="hidden sm:flex items-center gap-1.5 text-xs text-stone-600">
                  <i class="pi pi-check-circle text-emerald-600"></i>
                  <span>Khóa phòng tự động</span>
                </div>
              </div>

              <!-- Form fields -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="stay-rental-type" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Hình thức thuê
                  </label>
                  <select
                    id="stay-rental-type"
                    [ngModel]="stay().rentalType"
                    (ngModelChange)="updateStay('rentalType', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                  >
                    @for (mode of supportedModes(); track mode) {
                      <option [value]="mode">
                        {{ mode === 'Daily' ? '☀️ Theo ngày (Nhận 14:00 - Trả 12:00)' : mode === 'Hourly' ? '⏱️ Theo giờ linh hoạt' : '🌙 Qua đêm (21:00 - 10:00)' }}
                      </option>
                    }
                  </select>
                </div>

                <div>
                  <label for="stay-guests" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Số khách (một phòng)
                  </label>
                  <input
                    id="stay-guests"
                    type="number"
                    min="1"
                    max="20"
                    [ngModel]="stay().guests"
                    (ngModelChange)="updateStay('guests', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                  />
                </div>

                <div>
                  <label for="stay-checkin-date" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Ngày nhận phòng
                  </label>
                  <input
                    id="stay-checkin-date"
                    type="date"
                    [ngModel]="stay().checkInDate"
                    (ngModelChange)="updateStay('checkInDate', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                  />
                </div>

                @if (stay().rentalType !== 'Hourly') {
                  <div>
                    <label for="stay-checkout-date" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Ngày trả phòng
                    </label>
                    <input
                      id="stay-checkout-date"
                      type="date"
                      [ngModel]="stay().checkOutDate"
                      (ngModelChange)="updateStay('checkOutDate', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                    />
                  </div>
                } @else {
                  <div>
                    <label for="stay-checkin-time" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Giờ nhận phòng
                    </label>
                    <input
                      id="stay-checkin-time"
                      type="time"
                      [ngModel]="stay().checkInTime"
                      (ngModelChange)="updateStay('checkInTime', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label for="stay-duration-hours" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Số giờ thuê (tối đa {{ hotel.maxHourlyHours || 24 }}h)
                    </label>
                    <input
                      id="stay-duration-hours"
                      type="number"
                      min="1"
                      [max]="hotel.maxHourlyHours || 24"
                      [ngModel]="stay().durationHours"
                      (ngModelChange)="updateStay('durationHours', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[#FBF9F5] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C05621]/20 focus:border-[#C05621] shadow-2xs transition-all font-medium"
                    />
                  </div>
                }
              </div>

              <!-- Note -->
              <div class="p-3.5 rounded-2xl bg-stone-100/80 border border-stone-200/70 text-xs text-stone-600 flex items-center gap-2">
                <i class="pi pi-clock text-[#C05621]"></i>
                <span>Giờ Việt Nam &bull; nhận {{ hotel.checkInTime || '14:00' }} / trả {{ hotel.checkOutTime || '12:00' }} theo cấu hình cơ sở. Tồn phòng được kiểm tra trực tiếp.</span>
              </div>

              <!-- Check action -->
              <button
                type="button"
                (click)="checkAvailability()"
                [disabled]="loading() || availabilityLoading()"
                class="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#0D2E28] hover:bg-[#15473e] active:bg-[#071a17] text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                @if (availabilityLoading()) {
                  <i class="pi pi-spin pi-spinner text-sm text-amber-300"></i>
                  <span>Đang kiểm tra phòng trống…</span>
                } @else {
                  <i class="pi pi-search text-sm text-amber-300"></i>
                  <span>Kiểm Tra Phòng Trống</span>
                }
              </button>
            </section>

            <!-- ROOMS LISTING -->
            <section aria-labelledby="rooms-title" class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 id="rooms-title" class="font-serif text-xl sm:text-2xl font-normal text-stone-900 tracking-tight">
                  Hạng Phòng Sẵn Sàng Đón Khách
                </h2>
                @if (rooms().length > 0) {
                  <span class="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80">
                    {{ rooms().length }} hạng phòng trống
                  </span>
                }
              </div>

              @if (availabilityLoading()) {
                <div role="status" class="bg-white rounded-3xl p-10 border border-stone-200 text-center flex flex-col items-center gap-2 shadow-sm">
                  <i class="pi pi-spin pi-spinner text-2xl text-[#0D2E28]"></i>
                  <p class="text-xs font-medium text-stone-500">Đang đối soát tình trạng phòng từ cơ sở…</p>
                </div>
              } @else if (availabilityChecked() && rooms().length === 0) {
                <div class="bg-white p-10 rounded-3xl border border-stone-200 text-center space-y-2 shadow-sm">
                  <i class="pi pi-calendar-times text-4xl text-stone-300"></i>
                  <p class="text-sm font-bold text-stone-800">Không có phòng phù hợp lịch và số khách đã chọn.</p>
                  <p class="text-xs text-stone-500 max-w-md mx-auto">
                    Hãy thử đổi khoảng thời gian nhận/trả phòng hoặc giảm bớt số lượng khách để tìm kiếm các lựa chọn phòng trống khác.
                  </p>
                </div>
              }

              @for (room of rooms(); track room.roomTypeId) {
                <article
                  class="p-5 sm:p-6 bg-white rounded-3xl border transition-all space-y-4 shadow-sm"
                  [class.border-[#C05621]]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-2]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-amber-200]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.border-stone-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                >
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-serif text-lg sm:text-xl font-normal text-stone-900">
                          {{ room.name || room.roomTypeName }}
                        </h3>
                        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Còn {{ room.availableRoomsCount }} phòng trống
                        </span>
                      </div>
                      <p class="text-xs text-stone-500 flex flex-wrap items-center gap-1.5">
                        @if (room.maxGuests || room.maxOccupancy) {
                          <span class="inline-flex items-center gap-1">
                            <i class="pi pi-users text-stone-400"></i>
                            <span>{{ room.maxGuests || room.maxOccupancy }} khách</span>
                          </span>
                        }
                        @if (room.areaSqm || room.squareMeters) {
                          <span>&bull;</span>
                          <span>{{ room.areaSqm || room.squareMeters }} m²</span>
                        }
                        @if (room.bedConfiguration || room.bedType) {
                          <span>&bull;</span>
                          <span>{{ room.bedConfiguration || room.bedType }}</span>
                        }
                      </p>
                    </div>

                    @if (room.dailyPrice != null || room.dailyRate != null || room.hourlyBasePrice != null || room.hourlyRate != null || room.overnightPrice != null || room.overnightRate != null) {
                      <div class="sm:text-right">
                        <span class="text-[10px] text-stone-400 uppercase font-bold tracking-wider block">Giá cơ bản:</span>
                        <span class="text-lg sm:text-xl font-mono font-black text-[#C05621]">
                          {{ startingPrice(room) | number:'1.0-0' }} ₫
                        </span>
                      </div>
                    } @else {
                      <div class="sm:text-right text-xs text-stone-500 font-medium">Báo giá theo lịch</div>
                    }
                  </div>

                  <!-- Tiện nghi phòng -->
                  @if (room.amenities?.length) {
                    <div class="flex flex-wrap items-center gap-1.5 pt-1">
                      @for (amenity of room.amenities; track amenity) {
                        <span class="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium">
                          {{ amenity }}
                        </span>
                      }
                    </div>
                  }

                  <!-- Chọn phòng button -->
                  <div class="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span class="text-xs text-stone-400">Giá phòng được tính toán chuẩn xác từ Quote Engine</span>
                    <button
                      type="button"
                      (click)="selectRoom(room)"
                      [disabled]="availabilityLoading()"
                      class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      [class.bg-[#0D2E28]]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.text-white]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.shadow-sm]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.bg-stone-100]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.text-stone-800]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.hover:bg-stone-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                    >
                      @if (selectedRoom()?.roomTypeId === room.roomTypeId) {
                        <i class="pi pi-check text-xs text-amber-300"></i>
                        <span>Đã chọn — Bấm để tính lại giá</span>
                      } @else {
                        <span>Chọn phòng &amp; xem báo giá</span>
                        <i class="pi pi-arrow-right text-[10px]"></i>
                      }
                    </button>
                  </div>
                </article>
              }
            </section>

            <!-- GOOGLE MAPS PLATFORM & VỊ TRÍ ĐỊA LÝ DI SẢN -->
            <section
              class="p-6 bg-white border border-stone-200/90 rounded-3xl space-y-5 shadow-2xs"
              style="content-visibility: auto; contain-intrinsic-size: auto none auto 480px;"
              aria-labelledby="location-map-title"
              data-gmp-attribution="gmp_git_agentskills_v1"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0D2E28] flex items-center justify-center font-bold text-lg border border-emerald-100">
                    <i class="pi pi-map text-emerald-700"></i>
                  </div>
                  <div>
                    <h2 id="location-map-title" class="text-base font-bold text-stone-900 flex items-center gap-2">
                      <span>Vị Trí &amp; Bản Đồ Google Maps</span>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        GMP Verified
                      </span>
                    </h2>
                    <p class="text-xs text-stone-500">
                      {{ hotel.addressLine || hotel.address }}, {{ hotel.wardName ? hotel.wardName + ', ' : '' }}{{ hotel.provinceName || hotel.city }}
                    </p>
                  </div>
                </div>

                <!-- Google Maps Platform Compliance CTAs with UTM Campaign -->
                <div class="flex flex-wrap items-center gap-2">
                  <a
                    [href]="googleMapsDirectionsUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="h-9 px-3.5 rounded-xl bg-[#0D2E28] hover:bg-[#15473e] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Chỉ đường tới cơ sở trên Google Maps"
                  >
                    <i class="pi pi-directions text-amber-300 text-xs"></i>
                    <span>Chỉ đường</span>
                  </a>
                  @if (hasGpsCoordinates()) {
                    <a
                      [href]="googleMapsStreetViewUrl()"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="h-9 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#C05621] border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      title="Xem phối cảnh Street View 360° xung quanh"
                    >
                      <i class="pi pi-eye text-xs"></i>
                      <span>Street View 360°</span>
                    </a>
                  }
                </div>
              </div>

              <!-- Interactive Google Map Embed Container with Aspect Ratio and Zero CLS -->
              <div class="relative w-full aspect-video sm:aspect-[21/9] min-h-[300px] rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-inner">
                @if (googleMapEmbedUrl(); as embedUrl) {
                  <iframe
                    [src]="embedUrl"
                    class="w-full h-full border-0"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    allowfullscreen
                    title="Bản đồ vị trí cơ sở khách sạn"
                    aria-label="Bản đồ tương tác Google Maps hiển thị vị trí khách sạn"
                  ></iframe>
                }
                <!-- GPS Badge Overlay on Map -->
                @if (hotel.latitude && hotel.longitude) {
                  <div class="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-200/80 shadow-sm flex items-center gap-2 text-xs font-mono text-stone-700">
                    <i class="pi pi-compass text-[#C05621]"></i>
                    <span>{{ hotel.latitude | number:'1.4-4' }}, {{ hotel.longitude | number:'1.4-4' }}</span>
                    <button
                      type="button"
                      (click)="copyCoordinates(hotel.latitude, hotel.longitude)"
                      class="ml-1 text-[10px] font-sans font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      {{ copiedCoordinates() ? 'Đã sao chép!' : 'Sao chép' }}
                    </button>
                  </div>
                }
              </div>

              <!-- Nearby Landmarks Grid with Haversine Distance -->
              @if (hotel.nearbyLandmarks?.length) {
                <div class="space-y-2 pt-1">
                  <div class="flex items-center justify-between text-xs text-stone-700 font-semibold">
                    <span class="flex items-center gap-1.5">
                      <i class="pi pi-map-marker text-[#C05621]"></i>
                      <span>Địa danh du lịch &amp; danh thắng xung quanh (Khoảng cách trắc địa Haversine):</span>
                    </span>
                    <span class="text-[10px] text-stone-400">R = 6,371 km</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    @for (landmark of hotel.nearbyLandmarks; track landmark.landmarkId) {
                      <div class="p-3 rounded-xl bg-[#FBF9F5] border border-stone-200/80 flex items-center justify-between gap-2">
                        <div class="truncate">
                          <p class="text-xs font-bold text-stone-800 truncate">{{ landmark.landmarkName || landmark.name }}</p>
                          <p class="text-[10px] text-stone-500">{{ landmark.category || 'Điểm tham quan' }}</p>
                        </div>
                        @if (landmark.distanceMeters) {
                          <span class="shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-[#C05621] border border-amber-200">
                            {{ formatDistance(landmark.distanceMeters) }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Chính sách nhận phòng & tiện ích lưu trú -->
              <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 text-xs text-stone-600 leading-relaxed">
                <div class="font-bold text-stone-800 mb-1 flex items-center gap-1.5">
                  <i class="pi pi-shield text-[#0D2E28]"></i>
                  <span>Chính sách nhận phòng &amp; lưu trú:</span>
                </div>
                <span>
                  Nhận phòng từ <strong>{{ hotel.checkInTime || '14:00' }}</strong> &bull; Trả phòng trước <strong>{{ hotel.checkOutTime || '12:00' }}</strong> theo giờ chuẩn Việt Nam.
                  Vui lòng xuất trình giấy tờ tùy thân (CCCD / Hộ chiếu) hợp lệ khi làm thủ tục tại quầy tiếp tân.
                </span>
              </div>
            </section>
          </div>

          <!-- CỘT PHẢI: STICKY LIVE QUOTE SUMMARY (ASIDE) (1 CỘT) -->
          <aside class="bg-white border border-stone-200/90 rounded-3xl p-6 space-y-5 shadow-sm lg:sticky lg:top-24" aria-label="Báo giá">
            <div class="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div class="w-9 h-9 rounded-xl bg-amber-50 text-[#C05621] flex items-center justify-center font-bold text-sm">
                <i class="pi pi-receipt"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-stone-900">Báo Giá Từ Cơ Sở</h2>
                <p class="text-xs text-stone-500">Tính toán minh bạch, không phí ẩn</p>
              </div>
            </div>

            @if (quoteLoading()) {
              <div role="status" class="p-6 text-center text-xs text-stone-500 flex flex-col items-center gap-2">
                <i class="pi pi-spin pi-spinner text-xl text-[#0D2E28]"></i>
                <span>Đang kết nối Quote Engine tính giá…</span>
              </div>
            }

            @if (quote(); as price) {
              <div class="space-y-4">
                <div class="p-3.5 rounded-2xl bg-[#FBF9F5] border border-amber-200/80">
                  <div class="text-[10px] uppercase font-bold text-[#C05621] tracking-wider">Hạng phòng đã chọn</div>
                  <div class="text-sm font-bold text-stone-900 mt-0.5 font-serif">{{ price.roomTypeName }}</div>
                </div>

                <div class="space-y-1.5 text-xs divide-y divide-stone-100">
                  @for (line of price.breakdown; track $index) {
                    <div class="flex justify-between items-center text-stone-600 pt-1.5">
                      <span class="truncate pr-2">{{ line.description }}</span>
                      <span class="font-mono font-semibold text-stone-800 shrink-0">{{ line.amount | number:'1.0-0' }} ₫</span>
                    </div>
                  }
                </div>

                <div class="p-4 rounded-2xl bg-[#0D2E28] text-white space-y-1">
                  <span class="text-[10px] uppercase font-bold text-stone-300 tracking-wider block">Tổng thanh toán dự kiến</span>
                  <div class="text-2xl font-mono font-black text-amber-300">{{ price.totalAmount | number:'1.0-0' }} ₫</div>
                  <p class="text-[10px] text-stone-300">Đã bao gồm 10% VAT &amp; phí dịch vụ cơ sở</p>
                </div>

                <!-- Live SignalR & Payment Guarantees -->
                <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70 text-xs text-emerald-800 space-y-1">
                  <div class="flex items-center gap-1.5 font-bold">
                    <i class="pi pi-bolt text-emerald-600"></i>
                    <span>Xác nhận tức thì qua VietQR / VNPay</span>
                  </div>
                  <p class="text-[11px] text-emerald-700 leading-relaxed">
                    Thông báo trực tiếp cho Lễ tân cơ sở qua SignalR Realtime ngay khi thanh toán thành công.
                  </p>
                </div>

                <p class="text-[11px] text-stone-400 flex items-center gap-1">
                  <i class="pi pi-clock text-[10px]"></i>
                  <span>Báo giá có hiệu lực đến {{ price.expiresAtUtc | date:'HH:mm:ss':'+0700' }}</span>
                </p>
              </div>
            } @else if (!quoteLoading()) {
              <div class="p-6 rounded-2xl bg-stone-50 border border-stone-200/70 text-center space-y-1.5">
                <i class="pi pi-info-circle text-xl text-stone-400"></i>
                <p class="text-xs font-bold text-stone-800">Chưa chọn hạng phòng</p>
                <p class="text-[11px] text-stone-500 leading-relaxed">
                  Kiểm tra lịch và chọn một hạng phòng ở danh sách bên cạnh để xem bảng báo giá chi tiết.
                </p>
              </div>
            }

            <button
              type="button"
              (click)="proceedToHold()"
              [disabled]="!quote() || quoteLoading() || availabilityLoading()"
              class="w-full h-12 rounded-xl bg-[#C05621] hover:bg-[#a34315] active:bg-[#823510] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Tiếp Tục Giữ Phòng &amp; Nhận Mã PIN</span>
              <i class="pi pi-arrow-right text-xs"></i>
            </button>
          </aside>
        </div>

        <!-- FULL-SCREEN PHOTO GALLERY MODAL -->
        <app-photo-gallery-modal
          [isOpen]="galleryOpen()"
          [photos]="galleryPhotos()"
          [title]="hotel.name"
          (close)="galleryOpen.set(false)"
        />
      }
    </main>
  `,
})
export class PropertyDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PublicBookingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly property = signal<PublicPropertyDto | null>(null);
  readonly stay = signal<PublicStayContext>(readPublicStay({}));
  readonly rooms = signal<PublicRoomTypeAvailabilityDto[]>([]);
  readonly selectedRoom = signal<PublicRoomTypeAvailabilityDto | null>(null);
  readonly quote = signal<QuoteDto | null>(null);
  readonly loading = signal(false);
  readonly availabilityLoading = signal(false);
  readonly availabilityChecked = signal(false);
  readonly quoteLoading = signal(false);
  readonly galleryOpen = signal(false);
  readonly error = signal('');
  readonly copiedCoordinates = signal(false);

  readonly hasGpsCoordinates = computed<boolean>(() => {
    const p = this.property();
    return !!(p && p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0);
  });

  readonly googleMapEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const p = this.property();
    if (!p) return null;
    let query = '';
    if (p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0) {
      query = `${p.latitude},${p.longitude}`;
    } else {
      query = encodeURIComponent(`${p.name}, ${p.addressLine || p.address || ''}, ${p.provinceName || p.city || ''}`);
    }
    const url = `https://maps.google.com/maps?q=${query}&hl=vi&z=16&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  readonly googleMapsDirectionsUrl = computed<string>(() => {
    const p = this.property();
    if (!p) return 'https://www.google.com/maps?utm_campaign=gmp_git_agentskills_v1';
    if (p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0) {
      return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&utm_campaign=gmp_git_agentskills_v1`;
    }
    const dest = encodeURIComponent(`${p.name}, ${p.addressLine || p.address || ''}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&utm_campaign=gmp_git_agentskills_v1`;
  });

  readonly googleMapsStreetViewUrl = computed<string>(() => {
    const p = this.property();
    if (!p || !p.latitude || !p.longitude) return 'https://www.google.com/maps?utm_campaign=gmp_git_agentskills_v1';
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.latitude},${p.longitude}&utm_campaign=gmp_git_agentskills_v1`;
  });

  copyCoordinates(lat?: number, lng?: number): void {
    if (lat == null || lng == null) return;
    const text = `${lat}, ${lng}`;
    navigator.clipboard?.writeText(text).then(() => {
      this.copiedCoordinates.set(true);
      setTimeout(() => this.copiedCoordinates.set(false), 2000);
    });
  }

  formatDistance(meters?: number): string {
    if (meters == null) return '';
    return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
  }

  private generation = 0;
  private quoteGeneration = 0;

  supportedModes(): RentalType[] {
    const property = this.property();
    if (!property) return [];
    if (property.allowedRentalTypes?.length) return property.allowedRentalTypes;
    return (['Hourly', 'Overnight', 'Daily'] as RentalType[]).filter(mode =>
      mode === 'Hourly' ? property.allowHourlyBooking :
      mode === 'Overnight' ? property.allowOvernightBooking :
      property.allowDailyBooking
    );
  }

  startingPrice(room: PublicRoomTypeAvailabilityDto): number | null {
    const mode = this.stay().rentalType;
    const price = mode === 'Hourly' ? room.hourlyBasePrice ?? room.hourlyRate
      : mode === 'Overnight' ? room.overnightPrice ?? room.overnightRate
      : room.dailyPrice ?? room.dailyRate;
    return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : null;
  }

  galleryPhotos(): GalleryPhotoItem[] {
    const hotel = this.property();
    if (!hotel) return [];
    const urls = hotel.galleryUrls?.length ? hotel.galleryUrls : (hotel.thumbnailUrl ? [hotel.thumbnailUrl] : []);
    return urls.map(url => ({ url, title: hotel.name }));
  }

  getPhotoUrl(hotel: PublicPropertyDto, index: number): string {
    const urls = hotel.galleryUrls?.length ? hotel.galleryUrls : (hotel.thumbnailUrl ? [hotel.thumbnailUrl] : []);
    if (urls.length === 0) {
      return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200';
    }
    return urls[index % urls.length];
  }

  totalPhotosCount(hotel: PublicPropertyDto): number {
    return Math.max(1, hotel.galleryUrls?.length || (hotel.thumbnailUrl ? 1 : 0));
  }

  returnQueryParams(): Record<string, unknown> {
    const params = this.route.snapshot.queryParams ?? {};
    const discoveryKeys = [
      'destinationKeyword', 'provinceCode', 'touristZoneSlug', 'landmarkSlug', 'propertyTypes',
      'selectedTenantId', 'maxDistanceMeters', 'minPrice', 'maxPrice', 'sortBy', 'userLatitude', 'userLongitude'
    ] as const;
    return {
      ...this.stay(),
      ...Object.fromEntries(
        discoveryKeys
          .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
          .map(key => [key, params[key]])
      )
    };
  }

  openGallery(): void {
    this.galleryOpen.set(true);
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParams ?? of(this.route.snapshot.queryParams)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Không có cơ sở được chọn.');
      return;
    }
    const generation = ++this.generation;
    ++this.quoteGeneration;
    this.property.set(null);
    this.rooms.set([]);
    this.selectedRoom.set(null);
    this.quote.set(null);
    this.availabilityChecked.set(false);
    this.availabilityLoading.set(false);
    this.quoteLoading.set(false);
    this.error.set('');
    this.loading.set(true);

    try {
      this.stay.set(readPublicStay(this.route.snapshot.queryParams));
    } catch (error) {
      this.loading.set(false);
      this.error.set((error as Error).message);
      return;
    }

    this.service.getPropertyBySlug(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: property => {
        if (generation !== this.generation) return;
        this.property.set(property);
        this.loading.set(false);
        this.checkAvailability();
      },
      error: () => {
        if (generation !== this.generation) return;
        this.loading.set(false);
        this.error.set('Không tải được cơ sở. Vui lòng kiểm tra đường dẫn hoặc thử lại.');
      },
    });
  }

  updateStay(key: keyof PublicStayContext, value: string | number): void {
    this.stay.update(stay => ({ ...stay, [key]: value }));
    ++this.generation;
    ++this.quoteGeneration;
    this.rooms.set([]);
    this.quote.set(null);
    this.selectedRoom.set(null);
    this.availabilityChecked.set(false);
    this.availabilityLoading.set(false);
    this.quoteLoading.set(false);
    this.error.set('');
  }

  checkAvailability(): void {
    const property = this.property();
    if (!property) return;
    const generation = ++this.generation;
    ++this.quoteGeneration;
    this.quote.set(null);
    this.selectedRoom.set(null);
    this.rooms.set([]);
    this.quoteLoading.set(false);
    this.error.set('');
    this.availabilityChecked.set(false);
    this.availabilityLoading.set(false);

    try {
      const stay = readPublicStay({ ...this.stay() });
      this.stay.set(stay);
      if (!this.supportedModes().includes(stay.rentalType)) {
        throw new Error('Cơ sở không hỗ trợ hình thức thuê đã chọn. Vui lòng chọn hình thức khác.');
      }
      const interval = publicStayInterval(stay, property);
      this.availabilityLoading.set(true);
      this.availabilityChecked.set(false);

      this.service.getAvailability(property.slug, interval).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: rooms => {
          if (generation !== this.generation) return;
          this.rooms.set(rooms.filter(room => room.availableRoomsCount > 0 && (room.maxGuests || room.maxOccupancy || 0) >= stay.guests));
          this.availabilityLoading.set(false);
          this.availabilityChecked.set(true);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.availabilityLoading.set(false);
          this.error.set('Không kiểm tra được tình trạng phòng. Vui lòng thử lại.');
        },
      });
    } catch (error) {
      this.availabilityLoading.set(false);
      this.error.set((error as Error).message);
    }
  }

  selectRoom(room: PublicRoomTypeAvailabilityDto): void {
    const property = this.property();
    if (!property || !this.rooms().some(candidate => candidate.roomTypeId === room.roomTypeId)) return;
    if (!this.supportedModes().includes(this.stay().rentalType)) {
      this.quote.set(null);
      this.error.set('Cơ sở không hỗ trợ hình thức thuê đã chọn.');
      return;
    }
    const generation = ++this.quoteGeneration;
    this.selectedRoom.set(room);
    this.quote.set(null);
    this.quoteLoading.set(true);
    this.error.set('');

    try {
      this.service.calculateQuote({
        propertySlug: property.slug,
        roomTypeId: room.roomTypeId,
        ...publicStayInterval(this.stay(), property)
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: quote => {
          if (generation !== this.quoteGeneration) return;
          this.quote.set(quote);
          this.quoteLoading.set(false);
        },
        error: () => {
          if (generation !== this.quoteGeneration) return;
          this.quoteLoading.set(false);
          this.error.set('Không lấy được báo giá. Vui lòng chọn lại phòng để thử lại.');
        },
      });
    } catch (error) {
      this.quoteLoading.set(false);
      this.error.set((error as Error).message);
    }
  }

  proceedToHold(): void {
    const price = this.quote(), property = this.property(), room = this.selectedRoom();
    if (!price || !property || !room || this.quoteLoading() || this.availabilityLoading()) return;
    if (!this.supportedModes().includes(this.stay().rentalType) || !this.rooms().some(candidate => candidate.roomTypeId === room.roomTypeId)) {
      this.quote.set(null);
      this.selectedRoom.set(null);
      this.error.set('Lựa chọn phòng không còn hợp lệ. Vui lòng kiểm tra phòng trống lại.');
      return;
    }
    if (!Number.isFinite(new Date(price.expiresAtUtc).getTime()) || new Date(price.expiresAtUtc).getTime() <= Date.now()) {
      this.quote.set(null);
      this.error.set('Báo giá đã hết hiệu lực. Vui lòng chọn lại phòng.');
      return;
    }
    this.router.navigate(['/booking/hold'], {
      queryParams: {
        propertySlug: property.slug,
        roomTypeId: room.roomTypeId,
        ...this.stay()
      }
    });
  }
}
