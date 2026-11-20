import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { PublicPropertyDto, PublicRoomTypeAvailabilityDto, RentalType, PropertyReviewsSummaryDto, GuestReviewDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { PublicStayContext, publicStayInterval, readPublicStay } from '../../core/models/public-stay-context';
import { PhotoGalleryModalComponent, GalleryPhotoItem } from '../../shared';
import { resolvePropertyGallery, resolveRoomThumbnail } from '../../core/utils';
import { parseCalendarDate, formatCalendarDate } from '../../core/utils/date-time.util';

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PhotoGalleryModalComponent, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--surface-canvas)] pt-6 sm:pt-8 pb-24 font-sans text-stone-900">
      <main class="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
      <!-- 1. TOP NAV: BREADCRUMB & RETURN LINK -->
      <nav class="flex items-center justify-between text-xs text-stone-600 pb-3 border-b border-stone-200" aria-label="Điều hướng">
        <a
          routerLink="/booking"
          [queryParams]="returnQueryParams()"
          class="inline-flex min-h-11 items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs text-stone-700 hover:text-[var(--brand-cta)] font-semibold transition-all cursor-pointer"
        >
          <i class="pi pi-arrow-left text-[11px] text-[var(--brand-cta)]"></i>
          <span>Quay lại tìm kiếm cơ sở</span>
        </a>
        <div class="hidden sm:flex items-center gap-2 text-stone-400 bg-white px-3.5 py-1.5 rounded-xl border border-stone-200/80 shadow-2xs">
          <span>Khách sạn &amp; Resort</span>
          <span>&bull;</span>
          <span class="text-[var(--brand-primary)] font-bold">{{ property()?.name || 'Chi tiết' }}</span>
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
          <i class="pi pi-spin pi-spinner text-3xl text-[var(--brand-primary)]"></i>
          <p class="text-sm font-medium text-stone-600">Đang tải hồ sơ chỗ nghỉ &amp; biểu giá di sản…</p>
        </div>
      }

      @if (property(); as hotel) {
        <!-- 2. HOTEL HEADER: EDITORIAL TYPOGRAPHY & RATINGS -->
        <header class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            @if (hotel.tenantBrandName) {
              <span class="text-xs font-extrabold text-[var(--brand-cta)] uppercase tracking-widest">
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
                <span>{{ hotel.starRating }} sao — Tiêu chuẩn cao cấp</span>
              </span>
            }
          </div>

          <h1 class="font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-900 tracking-tight leading-[1.15]">
            {{ hotel.name }}
          </h1>

          <div class="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-stone-600">
            <a
              [href]="googleMapsDirectionsUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="min-h-11 flex items-center gap-1.5 text-stone-700 hover:text-[var(--brand-cta)] transition-colors group cursor-pointer"
              title="Xem vị trí & chỉ đường trên Google Maps"
            >
              <i class="pi pi-map-marker text-[var(--brand-cta)]"></i>
              <span class="underline decoration-stone-300 underline-offset-2 group-hover:decoration-[var(--brand-cta)]">
                {{ hotel.addressLine || hotel.address }}, {{ hotel.provinceName || hotel.city }}
              </span>
              <i class="pi pi-external-link text-[10px] text-stone-400 group-hover:text-[var(--brand-cta)]"></i>
            </a>
            @if (hotel.reviewCount > 0 && hotel.ratingAverage > 0) {
              <span class="text-stone-300 hidden sm:inline">&bull;</span>
              <p class="flex items-center gap-1 text-stone-800 font-semibold tabular-nums">
                <i class="pi pi-star-fill text-amber-500 text-xs"></i>
                <span>{{ hotel.ratingAverage | number:'1.1-1' }}</span>
                <span class="text-stone-500 font-normal">({{ hotel.reviewCount }} đánh giá xác thực)</span>
              </p>
            } @else {
              <span class="text-stone-300 hidden sm:inline">&bull;</span>
              <p class="text-xs text-stone-500">Chưa có đánh giá</p>
            }
          </div>
        </header>

        <!-- 3. HONEST EDITORIAL GALLERY MOSAIC (NO STOCK PLACEHOLDERS) -->
        <section aria-label="Bộ sưu tập ảnh chỗ nghỉ" class="rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-stone-200/90 bg-stone-100">
          @if (propertyGalleryUrls(hotel); as galleryUrls) {
            @if (galleryUrls.length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-2.5 p-2 sm:p-2.5">
                <button
                  type="button"
                  (click)="openGallery()"
                  [class]="galleryUrls.length === 1
                    ? 'relative md:col-span-4 h-72 sm:h-96 md:h-[420px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer text-left focus-visible:outline-[var(--brand-cta)]'
                    : 'relative md:col-span-2 md:row-span-2 h-72 sm:h-96 md:h-[420px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer text-left focus-visible:outline-[var(--brand-cta)]'"
                  aria-label="Xem ảnh chính cơ sở"
                >
                  <img
                    [src]="galleryUrls[0]"
                    [alt]="hotel.name"
                    width="800"
                    height="420"
                    loading="lazy"
                    class="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                  <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                    <span class="px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 border border-white/20">
                      <i class="pi pi-camera text-amber-300 text-xs"></i>
                      <span>Ảnh thực tế từ cơ sở</span>
                    </span>
                    <span class="hidden sm:inline-flex text-[11px] text-stone-200 bg-black/40 px-2.5 py-1 rounded-lg">
                      Nhấn để xem {{ galleryUrls.length }} ảnh
                    </span>
                  </div>
                </button>

                @for (auxUrl of galleryUrls.slice(1, 5); track auxUrl; let auxIdx = $index) {
                  <button
                    type="button"
                    (click)="openGallery()"
                    class="relative hidden sm:block h-[205px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer text-left focus-visible:outline-[var(--brand-cta)]"
                    [attr.aria-label]="'Xem ảnh ' + (auxIdx + 2)"
                  >
                    <img
                      [src]="auxUrl"
                      [alt]="hotel.name + ' - Ảnh ' + (auxIdx + 2)"
                      width="400"
                      height="205"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    @if (auxIdx === galleryUrls.slice(1, 5).length - 1 && galleryUrls.length > 2) {
                      <div class="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-2 text-center group-hover:bg-slate-950/80 transition-colors">
                        <i class="pi pi-images text-2xl mb-1 text-amber-300"></i>
                        <span class="text-xs font-bold uppercase tracking-wider">Xem tất cả ảnh</span>
                        <span class="text-[11px] text-stone-300 mt-0.5">{{ galleryUrls.length }} ảnh chi tiết</span>
                      </div>
                    }
                  </button>
                }
              </div>
            } @else {
              <div class="h-56 sm:h-64 flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 to-slate-200 text-stone-500 p-6 text-center gap-2">
                <i class="pi pi-building text-4xl text-stone-400"></i>
                <p class="text-sm font-semibold text-stone-700">Cơ sở chưa tải lên hình ảnh thực tế</p>
                <p class="text-xs text-stone-500">Thông tin hạng phòng, lịch trống và báo giá bên dưới được đồng bộ trực tiếp từ hệ thống.</p>
              </div>
            }
          }
        </section>

        <!-- 4. MAIN CONTENT (2 COLUMNS: LEFT ROOMS & POLICIES / RIGHT STICKY QUOTE) -->
        <div class="grid lg:grid-cols-3 gap-8 items-start pt-2">
          <!-- CỘT TRÁI: CONCIERGE BAR & ROOM LIST (2 CỘT) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- CONCIERGE BOOKING SELECTOR -->
            <section class="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-5" aria-labelledby="stay-title">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-slate-100 text-[var(--brand-primary)] flex items-center justify-center font-bold text-sm">
                    <i class="pi pi-calendar-clock"></i>
                  </div>
                  <div>
                    <h2 id="stay-title" class="text-base font-bold text-slate-900">Chọn Lịch &amp; Kiểm Tra Phòng Trống</h2>
                    <p class="text-xs text-slate-500">Đồng bộ lịch phòng thực từ hệ thống PMS thời gian thực</p>
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
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium"
                  >
                    @for (mode of supportedModes(); track mode) {
                      <option [value]="mode">
                        {{ mode === 'Daily' ? 'Theo ngày (Nhận ' + formatTimeHm(hotel.checkInTime, '14:00') + ' - Trả ' + formatTimeHm(hotel.checkOutTime, '12:00') + ')' : mode === 'Hourly' ? 'Theo giờ linh hoạt' : 'Qua đêm (' + formatTimeHm(hotel.overnightCheckInTime, '21:00') + ' - ' + formatTimeHm(hotel.overnightCheckOutTime, '10:00') + ')' }}
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
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium tabular-nums"
                  />
                </div>

                <div>
                  <label for="stay-checkin-date" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Ngày nhận phòng
                  </label>
                  <p-datepicker
                    inputId="stay-checkin-date"
                    [ngModel]="checkInDateValue()"
                    (ngModelChange)="onCheckInDateChange($event)"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    iconDisplay="input"
                    appendTo="body"
                    [firstDayOfWeek]="1"
                    placeholder="dd/mm/yyyy"
                    ariaLabel="Ngày nhận phòng"
                    styleClass="w-full"
                    inputStyleClass="w-full h-11 text-xs sm:text-sm pl-3.5 pr-10 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium"
                  />
                </div>

                @if (stay().rentalType !== 'Hourly') {
                  <div>
                    <label for="stay-checkout-date" class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Ngày trả phòng
                    </label>
                    <p-datepicker
                      inputId="stay-checkout-date"
                      [ngModel]="checkOutDateValue()"
                      (ngModelChange)="onCheckOutDateChange($event)"
                      dateFormat="dd/mm/yy"
                      [showIcon]="true"
                      iconDisplay="input"
                      appendTo="body"
                      [firstDayOfWeek]="1"
                      placeholder="dd/mm/yyyy"
                      ariaLabel="Ngày trả phòng"
                      styleClass="w-full"
                      inputStyleClass="w-full h-11 text-xs sm:text-sm pl-3.5 pr-10 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium"
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
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium tabular-nums"
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
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-stone-300 bg-[var(--surface-canvas)] text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-cta)]/20 focus:border-[var(--brand-cta)] shadow-2xs transition-all font-medium tabular-nums"
                    />
                  </div>
                }
              </div>

              <!-- Note -->
              <div class="p-3.5 rounded-2xl bg-stone-100/80 border border-stone-200/70 text-xs text-stone-600 flex items-center gap-2">
                <i class="pi pi-clock text-[var(--brand-cta)]"></i>
                <span class="tabular-nums">Giờ Việt Nam &bull; nhận {{ formatTimeHm(hotel.checkInTime, '14:00') }} / trả {{ formatTimeHm(hotel.checkOutTime, '12:00') }} theo cấu hình cơ sở. Tồn phòng được kiểm tra trực tiếp.</span>
              </div>

              <!-- Check action -->
              <button
                type="button"
                (click)="checkAvailability()"
                [disabled]="loading() || availabilityLoading()"
                class="w-full sm:w-auto h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                @if (availabilityLoading()) {
                  <i class="pi pi-spin pi-spinner text-sm text-white"></i>
                  <span>Đang kiểm tra phòng trống…</span>
                } @else {
                  <i class="pi pi-search text-sm text-white"></i>
                  <span>Kiểm Tra Phòng Trống</span>
                }
              </button>
            </section>

            <!-- ROOMS LISTING -->
            <section aria-labelledby="rooms-title" class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 id="rooms-title" class="font-display text-xl sm:text-2xl font-normal text-stone-900 tracking-tight">
                  Hạng Phòng Sẵn Sàng Đón Khách
                </h2>
                @if (rooms().length > 0) {
                  <span class="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                    {{ rooms().length }} hạng phòng trống
                  </span>
                }
              </div>

              @if (availabilityLoading()) {
                <div role="status" class="bg-white rounded-3xl p-10 border border-stone-200 text-center flex flex-col items-center gap-2 shadow-sm">
                  <i class="pi pi-spin pi-spinner text-2xl text-[var(--brand-primary)]"></i>
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
                  class="p-5 sm:p-6 bg-white rounded-3xl border transition-all space-y-4 shadow-2xs"
                  [class.border-[var(--brand-primary)]]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-1]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-[var(--brand-primary)]/25]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.border-slate-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                >
                  <div class="flex flex-col sm:flex-row items-start gap-4">
                    <div class="w-full sm:w-44 h-32 rounded-2xl overflow-hidden shrink-0 bg-stone-100 shadow-inner border border-stone-200/80">
                      @if (getRoomPhoto(room, $index); as roomPhotoUrl) {
                        <img
                          [src]="roomPhotoUrl"
                          [alt]="room.name || room.roomTypeName"
                          width="176"
                          height="128"
                          class="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      } @else {
                        <div class="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-1">
                          <i class="pi pi-image text-2xl"></i>
                          <span class="text-[11px] font-medium">Chưa có ảnh phòng</span>
                        </div>
                      }
                    </div>
                    <div class="flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-display text-lg sm:text-xl font-normal text-stone-900">
                          {{ room.name || room.roomTypeName }}
                        </h3>
                        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
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

                    @if (startingPrice(room) !== null) {
                      <div class="sm:text-right">
                        <span class="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">Giá cơ bản:</span>
                        <span class="text-lg sm:text-xl font-sans font-bold tracking-tight text-slate-900 tabular-nums">
                          {{ startingPrice(room) | number:'1.0-0' }} <span class="text-sm font-semibold">₫</span>
                        </span>
                      </div>
                    } @else {
                      <div class="sm:text-right text-xs text-stone-500 font-medium">Báo giá theo lịch</div>
                    }
                  </div>
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
                      class="min-h-11 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      [class.bg-[var(--brand-primary)]]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.text-[var(--brand-primary-fg)]]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.shadow-sm]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.bg-stone-100]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.text-stone-800]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.hover:bg-stone-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                    >
                      @if (selectedRoom()?.roomTypeId === room.roomTypeId) {
                        <i class="pi pi-check text-xs text-[var(--brand-primary-fg)]"></i>
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
                  <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-[var(--brand-primary)] flex items-center justify-center font-bold text-lg border border-emerald-100">
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
                    class="min-h-11 px-3.5 py-2 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Chỉ đường tới cơ sở trên Google Maps"
                  >
                    <i class="pi pi-directions text-[var(--brand-primary-fg)] text-xs"></i>
                    <span>Chỉ đường</span>
                  </a>
                  @if (hasGpsCoordinates()) {
                    <a
                      [href]="googleMapsStreetViewUrl()"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="min-h-11 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[var(--brand-cta)] border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
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
                  <div class="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl border border-stone-200/80 shadow-sm flex items-center gap-2 text-xs font-mono text-stone-700 tabular-nums">
                    <i class="pi pi-compass text-[var(--brand-cta)]"></i>
                    <span>{{ hotel.latitude | number:'1.4-4' }}, {{ hotel.longitude | number:'1.4-4' }}</span>
                    <button
                      type="button"
                      (click)="copyCoordinates(hotel.latitude, hotel.longitude)"
                      class="min-h-11 px-2 -my-1 text-[10px] font-sans font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
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
                      <i class="pi pi-map-marker text-[var(--brand-cta)]"></i>
                      <span>Địa danh du lịch &amp; danh thắng xung quanh (Khoảng cách trắc địa Haversine):</span>
                    </span>
                    <span class="text-[10px] text-stone-400">R = 6,371 km</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    @for (landmark of hotel.nearbyLandmarks; track (landmark.landmarkId || landmark.name || $index)) {
                      <div class="p-3 rounded-xl bg-[var(--surface-canvas)] border border-stone-200/80 flex items-center justify-between gap-2">
                        <div class="truncate">
                          <p class="text-xs font-bold text-stone-800 truncate">{{ landmark.landmarkName || landmark.name }}</p>
                          <p class="text-[10px] text-stone-500">{{ landmark.category || 'Điểm tham quan' }}</p>
                        </div>
                        @if (landmark.distanceMeters) {
                          <span class="shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-[var(--brand-cta)] border border-amber-200 tabular-nums">
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
                  <i class="pi pi-shield text-[var(--brand-primary)]"></i>
                  <span>Chính sách nhận phòng &amp; lưu trú:</span>
                </div>
                <span>
                  Nhận phòng từ <strong>{{ formatTimeHm(hotel.checkInTime, '14:00') }}</strong> &bull; Trả phòng trước <strong>{{ formatTimeHm(hotel.checkOutTime, '12:00') }}</strong> theo giờ chuẩn Việt Nam.
                  Vui lòng xuất trình giấy tờ tùy thân (CCCD / Hộ chiếu) hợp lệ khi làm thủ tục tại quầy tiếp tân.
                </span>
              </div>
            </section>

            <!-- 5. GUEST REVIEWS & VERIFIED RATINGS SECTION (ĐÁNH GIÁ TỪ KHÁCH THỰC TẾ) -->
            <section class="p-6 bg-white border border-stone-200/90 rounded-3xl space-y-6 shadow-2xs" aria-labelledby="reviews-section-title">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-amber-50 text-[var(--brand-cta)] flex items-center justify-center font-bold text-lg border border-amber-200/60">
                    <i class="pi pi-star-fill text-amber-500"></i>
                  </div>
                  <div>
                    <h2 id="reviews-section-title" class="text-base font-bold text-stone-900 flex items-center gap-2">
                      <span>Đánh Giá Từ Khách Hàng Lưu Trú Thực Tế</span>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        100% Verified
                      </span>
                    </h2>
                    <p class="text-xs text-stone-500">Đánh giá xác thực từ các khách hàng đã đặt và trải nghiệm lưu trú</p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  @if ((reviewsSummary()?.totalReviews ?? hotel.reviewCount ?? 0) > 0 && (reviewsSummary()?.averageRating ?? hotel.ratingAverage ?? 0) > 0) {
                    <span class="text-2xl sm:text-3xl font-mono font-black text-[var(--brand-primary)] tabular-nums">
                      {{ (reviewsSummary()?.averageRating ?? hotel.ratingAverage) | number:'1.1-1' }}
                    </span>
                    <div class="text-xs">
                      <div class="flex items-center text-amber-500 text-xs">
                        @for (star of [1, 2, 3, 4, 5]; track star) {
                          <i class="pi" [class.pi-star-fill]="star <= Math.round(reviewsSummary()?.averageRating ?? hotel.ratingAverage ?? 0)" [class.pi-star]="star > Math.round(reviewsSummary()?.averageRating ?? hotel.ratingAverage ?? 0)"></i>
                        }
                      </div>
                      <span class="text-stone-500 font-medium tabular-nums">({{ reviewsSummary()?.totalReviews ?? hotel.reviewCount }} đánh giá)</span>
                    </div>
                  } @else {
                    <div class="text-right">
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">
                        Chưa có đánh giá
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- Sub-ratings Grid (only displayed when real sub-ratings exist) -->
              @if ((reviewsSummary()?.totalReviews ?? hotel.reviewCount ?? 0) > 0) {
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  @if ((reviewsSummary()?.cleanlinessAverage ?? 0) > 0) {
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-canvas)] border border-stone-200/80 space-y-1">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Vệ sinh phòng</span>
                      <div class="flex items-baseline justify-between">
                        <span class="text-base font-mono font-bold text-[var(--brand-primary)] tabular-nums">
                          {{ reviewsSummary()!.cleanlinessAverage | number:'1.1-1' }}/5
                        </span>
                        <i class="pi pi-sparkles text-emerald-600 text-xs"></i>
                      </div>
                      <div class="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-emerald-600 h-1.5 rounded-full" [style.width.%]="(reviewsSummary()!.cleanlinessAverage / 5) * 100"></div>
                      </div>
                    </div>
                  }

                  @if ((reviewsSummary()?.locationAverage ?? 0) > 0) {
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-canvas)] border border-stone-200/80 space-y-1">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Vị trí thuận tiện</span>
                      <div class="flex items-baseline justify-between">
                        <span class="text-base font-mono font-bold text-[var(--brand-primary)] tabular-nums">
                          {{ reviewsSummary()!.locationAverage | number:'1.1-1' }}/5
                        </span>
                        <i class="pi pi-map-marker text-[var(--brand-cta)] text-xs"></i>
                      </div>
                      <div class="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-[var(--brand-cta)] h-1.5 rounded-full" [style.width.%]="(reviewsSummary()!.locationAverage / 5) * 100"></div>
                      </div>
                    </div>
                  }

                  @if ((reviewsSummary()?.serviceAverage ?? 0) > 0) {
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-canvas)] border border-stone-200/80 space-y-1">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Dịch vụ lễ tân</span>
                      <div class="flex items-baseline justify-between">
                        <span class="text-base font-mono font-bold text-[var(--brand-primary)] tabular-nums">
                          {{ reviewsSummary()!.serviceAverage | number:'1.1-1' }}/5
                        </span>
                        <i class="pi pi-heart text-rose-500 text-xs"></i>
                      </div>
                      <div class="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-rose-500 h-1.5 rounded-full" [style.width.%]="(reviewsSummary()!.serviceAverage / 5) * 100"></div>
                      </div>
                    </div>
                  }

                  @if ((reviewsSummary()?.valueAverage ?? 0) > 0) {
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-canvas)] border border-stone-200/80 space-y-1">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Đáng giá tiền</span>
                      <div class="flex items-baseline justify-between">
                        <span class="text-base font-mono font-bold text-[var(--brand-primary)] tabular-nums">
                          {{ reviewsSummary()!.valueAverage | number:'1.1-1' }}/5
                        </span>
                        <i class="pi pi-tag text-amber-600 text-xs"></i>
                      </div>
                      <div class="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-amber-600 h-1.5 rounded-full" [style.width.%]="(reviewsSummary()!.valueAverage / 5) * 100"></div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Review Cards List -->
              @if (reviewsSummary()?.reviews?.length) {
                <div class="space-y-4 divide-y divide-stone-100">
                  @for (rev of reviewsSummary()!.reviews; track rev.id) {
                    <article class="pt-4 first:pt-0 space-y-2.5">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {{ rev.guestName.substring(0, 2).toUpperCase() }}
                          </div>
                          <div>
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-bold text-stone-900">{{ rev.guestName }}</span>
                              <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <i class="pi pi-check text-[9px]"></i>
                                <span>Đã lưu trú</span>
                              </span>
                            </div>
                            <div class="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                              <span>{{ rev.createdAt | date:'dd/MM/yyyy' }}</span>
                              <span>&bull;</span>
                              <span>{{ rev.roomTypeName || 'Tiêu chuẩn' }}</span>
                            </div>
                          </div>
                        </div>

                        <!-- Rating Stars -->
                        <div class="flex items-center gap-1 text-amber-500 text-xs">
                          @for (star of [1,2,3,4,5]; track star) {
                            <i class="pi" [ngClass]="star <= rev.rating ? 'pi-star-fill' : 'pi-star text-stone-200'"></i>
                          }
                        </div>
                      </div>

                      @if (rev.comment) {
                        <p class="text-xs sm:text-sm text-stone-700 leading-relaxed pl-13">
                          "{{ rev.comment }}"
                        </p>
                      }

                      @if (rev.ownerReply) {
                        <div class="ml-13 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs space-y-1">
                          <div class="flex items-center gap-1.5 font-bold text-[var(--brand-primary)]">
                            <i class="pi pi-reply text-xs text-[var(--brand-cta)]"></i>
                            <span>Phản hồi từ Ban quản lý:</span>
                          </div>
                          <p class="text-stone-600 leading-relaxed">{{ rev.ownerReply }}</p>
                        </div>
                      }
                    </article>
                  }
                </div>
              } @else {
                <!-- Empty State -->
                <div class="p-8 rounded-2xl bg-[var(--surface-canvas)] border border-dashed border-stone-300 text-center space-y-2">
                  <i class="pi pi-comments text-3xl text-stone-300"></i>
                  <p class="text-xs font-bold text-stone-700">Chưa có bình luận nào cho cơ sở này</p>
                  <p class="text-[11px] text-stone-500 max-w-sm mx-auto">
                    Hãy hoàn tất kỳ nghỉ và chia sẻ cảm nhận của bạn để giúp các du khách khác chọn được phòng ưng ý nhất!
                  </p>
                </div>
              }
            </section>
          </div>

          <!-- CỘT PHẢI: STICKY LIVE QUOTE SUMMARY (ASIDE) (1 CỘT) -->
          <aside class="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-5 shadow-xs lg:sticky lg:top-24" aria-label="Báo giá">
            <div class="flex items-center gap-2.5 pb-3 border-b border-[var(--border-subtle)]">
              <div class="w-9 h-9 rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] flex items-center justify-center font-bold text-sm">
                <i class="pi pi-receipt"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-[var(--text-primary)]">Báo Giá Từ Cơ Sở</h2>
                <p class="text-xs text-[var(--text-muted)]">Tính toán minh bạch, không phí ẩn</p>
              </div>
            </div>

            @if (promoCode(); as activePromo) {
              <div
                data-testid="detail-promo-pill"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900"
              >
                <span class="inline-flex items-center gap-1.5 font-semibold">
                  <i class="pi pi-ticket text-emerald-700 text-xs" aria-hidden="true"></i>
                  <span>Mã ưu đãi: <strong class="font-mono uppercase">{{ activePromo }}</strong></span>
                </span>
                <span class="text-[11px] font-medium text-emerald-700">Áp dụng tự động</span>
              </div>
            }

            @if (quoteLoading()) {
              <div role="status" class="p-6 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                <i class="pi pi-spin pi-spinner text-xl text-[var(--brand-primary)]"></i>
                <span>Đang kết nối Quote Engine tính giá…</span>
              </div>
            }

            @if (quote(); as price) {
              <div class="space-y-4">
                <div class="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
                  <div class="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">Hạng phòng đã chọn</div>
                  <div class="text-sm font-bold text-[var(--text-primary)] mt-0.5 font-display">{{ price.roomTypeName }}</div>
                </div>

                <div class="space-y-1.5 text-xs divide-y divide-[var(--border-subtle)]">
                  @for (line of price.breakdown; track $index) {
                    <div class="flex justify-between items-center text-[var(--text-secondary)] pt-1.5">
                      <span class="truncate pr-2">{{ line.description }}</span>
                      <span class="font-sans font-semibold text-[var(--text-primary)] shrink-0 tabular-nums">{{ line.amount | number:'1.0-0' }} ₫</span>
                    </div>
                  }
                </div>

                <div class="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-strong)] space-y-1">
                  <span class="text-[11px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider block">Tổng thanh toán dự kiến</span>
                  <div class="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                    {{ price.totalAmount | number:'1.0-0' }} <span class="text-base font-semibold">₫</span>
                  </div>
                  @if ((hotel.taxRatePercent ?? 0) > 0 || (hotel.serviceFeeRatePercent ?? 0) > 0) {
                    <p class="text-[11px] text-[var(--text-muted)] tabular-nums">
                      Chính sách cơ sở: thuế VAT {{ hotel.taxRatePercent ?? 0 }}%, phí dịch vụ {{ hotel.serviceFeeRatePercent ?? 0 }}%
                    </p>
                  } @else {
                    <p class="text-[11px] text-[var(--text-muted)]">Báo giá tính theo biểu giá niêm yết của cơ sở</p>
                  }
                </div>

                <!-- Live SignalR & Payment Guarantees -->
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <div class="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                    <i class="pi pi-bolt text-emerald-600"></i>
                    <span>Xác nhận tức thì qua VietQR / VNPay</span>
                  </div>
                  <p class="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Thông báo trực tiếp cho Lễ tân cơ sở qua SignalR Realtime ngay khi thanh toán thành công.
                  </p>
                </div>

                <p class="text-[11px] text-[var(--text-muted)] flex items-center gap-1 tabular-nums">
                  <i class="pi pi-clock text-[10px]"></i>
                  <span>Báo giá có hiệu lực đến {{ price.expiresAtUtc | date:'HH:mm:ss':'+0700' }}</span>
                </p>
              </div>
            } @else if (!quoteLoading()) {
              <div class="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-center space-y-1.5">
                <i class="pi pi-info-circle text-xl text-[var(--text-muted)]"></i>
                <p class="text-xs font-bold text-[var(--text-primary)]">Chưa chọn hạng phòng</p>
                <p class="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Kiểm tra lịch và chọn một hạng phòng ở danh sách bên cạnh để xem bảng báo giá chi tiết.
                </p>
              </div>
            }

            <button
              type="button"
              (click)="proceedToHold()"
              [disabled]="!quote() || quoteLoading() || availabilityLoading()"
              class="w-full h-12 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-fg)] font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Tiếp Tục Giữ Phòng &amp; Đặt Ngay</span>
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
  protected readonly Math = Math;
  readonly checkInDateValue = computed(() => parseCalendarDate(this.stay().checkInDate));
  readonly checkOutDateValue = computed(() => parseCalendarDate(this.stay().checkOutDate));

  onCheckInDateChange(val: Date | null): void {
    if (val) {
      this.updateStay('checkInDate', formatCalendarDate(val));
    }
  }

  onCheckOutDateChange(val: Date | null): void {
    if (val) {
      this.updateStay('checkOutDate', formatCalendarDate(val));
    }
  }
  getRoomPhoto(room: PublicRoomTypeAvailabilityDto, index: number = 0): string {
    return resolveRoomThumbnail(room.name || room.roomTypeName, index, room.imageUrl || room.images?.[0]);
  }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PublicBookingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly property = signal<PublicPropertyDto | null>(null);
  readonly stay = signal<PublicStayContext>(readPublicStay({}));
  readonly promoCode = signal<string>('');
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
  readonly reviewsSummary = signal<PropertyReviewsSummaryDto | null>(null);
  readonly reviewsLoading = signal(false);

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
    const price = (mode === 'Hourly' ? room.hourlyBasePrice ?? room.hourlyRate
      : mode === 'Overnight' ? room.overnightPrice ?? room.overnightRate
      : room.dailyPrice ?? room.dailyRate) ?? (room.calculatedQuoteTotal && room.calculatedQuoteTotal > 0 ? room.calculatedQuoteTotal : undefined) ?? room.estimatedPrice;
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  }

  propertyGalleryUrls(hotel: PublicPropertyDto): string[] {
    return resolvePropertyGallery(hotel.name, hotel.thumbnailUrl, hotel.galleryUrls);
  }

  galleryPhotos(): GalleryPhotoItem[] {
    const hotel = this.property();
    if (!hotel) return [];
    const urls = resolvePropertyGallery(hotel.name, hotel.thumbnailUrl, hotel.galleryUrls);
    return urls.map(url => ({ url, title: hotel.name }));
  }

  getPhotoUrl(hotel: PublicPropertyDto, index: number): string {
    const urls = resolvePropertyGallery(hotel.name, hotel.thumbnailUrl, hotel.galleryUrls);
    return urls[index] ?? '';
  }

  totalPhotosCount(hotel: PublicPropertyDto): number {
    return resolvePropertyGallery(hotel.name, hotel.thumbnailUrl, hotel.galleryUrls).length;
  }

  returnQueryParams(): Record<string, unknown> {
    const params = this.route.snapshot.queryParams ?? {};
    const discoveryKeys = [
      'destinationKeyword', 'provinceCode', 'touristZoneSlug', 'landmarkSlug', 'propertyTypes',
      'selectedTenantId', 'maxDistanceMeters', 'minPrice', 'maxPrice', 'sortBy', 'userLatitude', 'userLongitude'
    ] as const;
    const promo = this.promoCode();
    return {
      ...this.stay(),
      ...(promo ? { promoCode: promo } : {}),
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
    const queryParams$ = this.route.queryParams ?? of(this.route.snapshot?.queryParams ?? {});
    combineLatest([this.route.paramMap, queryParams$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([, qp]) => {
        const rawPromo = qp?.['promoCode'] ?? this.route.snapshot?.queryParams?.['promoCode'];
        this.promoCode.set(typeof rawPromo === 'string' ? rawPromo.trim() : '');
        this.refresh();
      });
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
    this.reviewsSummary.set(null);
    this.reviewsLoading.set(true);

    this.service.getPropertyReviewsSummary(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => {
        if (generation !== this.generation) return;
        this.reviewsSummary.set(summary);
        this.reviewsLoading.set(false);
      },
      error: () => {
        if (generation !== this.generation) return;
        this.reviewsLoading.set(false);
      }
    });

    try {
      const snapPromo = this.route.snapshot?.queryParams?.['promoCode'];
      if (typeof snapPromo === 'string') {
        this.promoCode.set(snapPromo.trim());
      } else if (!this.route.queryParams) {
        this.promoCode.set('');
      }
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
      const promo = this.promoCode();
      this.service.calculateQuote({
        propertySlug: property.slug,
        roomTypeId: room.roomTypeId,
        ...publicStayInterval(this.stay(), property),
        ...(promo ? { promoCode: promo } : {})
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

  formatTimeHm(value?: string | null, fallback = '14:00'): string {
    const raw = (value || fallback).trim();
    return raw.length >= 5 ? raw.slice(0, 5) : raw;
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
    const promo = this.promoCode();
    this.router.navigate(['/booking/hold'], {
      queryParams: {
        propertySlug: property.slug,
        roomTypeId: room.roomTypeId,
        ...this.stay(),
        ...(promo ? { promoCode: promo } : {})
      }
    });
  }
}
