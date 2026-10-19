import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { PublicPropertyDto, PublicRoomTypeAvailabilityDto, RentalType } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { PublicStayContext, publicStayInterval, readPublicStay } from '../../core/models/public-stay-context';
import { PhotoGalleryModalComponent, GalleryPhotoItem } from '../../shared';

@Component({
  selector: 'app-property-detail', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PhotoGalleryModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <a routerLink="/booking" [queryParams]="stay()" class="inline-flex min-h-11 items-center text-indigo-700">← Quay lại tìm chỗ nghỉ</a>
      @if (error()) { <div role="alert" class="bg-rose-50 text-rose-800 p-4 rounded-xl">{{ error() }} <button type="button" (click)="refresh()" class="min-h-11 px-3 underline">Thử lại</button></div> }
      @if (loading()) { <p role="status">Đang tải thông tin chỗ nghỉ…</p> }
      @if (property(); as hotel) {
        <header class="space-y-3">
          <p class="text-indigo-700">{{ hotel.tenantBrandName }}</p>
          <h1 class="text-3xl sm:text-4xl font-bold text-slate-900">{{ hotel.name }}</h1>
          <p class="text-slate-600">{{ hotel.addressLine || hotel.address }}, {{ hotel.provinceName || hotel.city }}</p>
          @if (hotel.reviewCount > 0) { <p>{{ hotel.ratingAverage }} · {{ hotel.reviewCount }} đánh giá</p> }
          @else { <p class="text-sm text-slate-600">Chưa có đánh giá xác thực để hiển thị.</p> }
        </header>
        @if (hotel.galleryUrls?.length || hotel.thumbnailUrl) {
          <button type="button" (click)="openGallery()" class="block w-full text-left relative rounded-2xl overflow-hidden bg-slate-100 focus-visible:outline-indigo-600" aria-label="Xem ảnh cơ sở">
            <img [src]="hotel.galleryUrls?.[0] || hotel.thumbnailUrl" [alt]="hotel.name" class="w-full h-64 sm:h-96 object-cover" />
            <span class="absolute bottom-4 right-4 px-4 py-3 rounded-xl bg-white text-slate-900 font-medium">Xem ảnh</span>
          </button>
        } @else { <div class="bg-slate-100 rounded-2xl p-12 text-center text-slate-600">Cơ sở chưa cung cấp ảnh.</div> }
        <div class="grid lg:grid-cols-3 gap-8 items-start">
          <div class="lg:col-span-2 space-y-6">
            <section class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5" aria-labelledby="stay-title">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-calendar"></i>
                </div>
                <div>
                  <h2 id="stay-title" class="text-base font-bold text-slate-800">Chọn Lịch &amp; Kiểm Tra Phòng Trống</h2>
                  <p class="text-xs text-slate-400">Kiểm tra giá thực và tình trạng phòng trống thời gian thực</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="stay-rental-type" class="block text-xs font-semibold text-slate-700 mb-1">Hình thức thuê</label>
                  <select
                    id="stay-rental-type"
                    [ngModel]="stay().rentalType"
                    (ngModelChange)="updateStay('rentalType', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                  >
                    @for (mode of supportedModes(); track mode) {
                      <option [value]="mode">{{ mode === 'Daily' ? 'Theo ngày (Nhận 14:00 - Trả 12:00)' : mode === 'Hourly' ? 'Theo giờ linh hoạt' : 'Qua đêm (21:00 - 10:00)' }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label for="stay-guests" class="block text-xs font-semibold text-slate-700 mb-1">Số khách (một phòng)</label>
                  <input
                    id="stay-guests"
                    type="number"
                    min="1"
                    max="20"
                    [ngModel]="stay().guests"
                    (ngModelChange)="updateStay('guests', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                  />
                </div>

                <div>
                  <label for="stay-checkin-date" class="block text-xs font-semibold text-slate-700 mb-1">Ngày nhận phòng</label>
                  <input
                    id="stay-checkin-date"
                    type="date"
                    [ngModel]="stay().checkInDate"
                    (ngModelChange)="updateStay('checkInDate', $event)"
                    class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                  />
                </div>

                @if (stay().rentalType !== 'Hourly') {
                  <div>
                    <label for="stay-checkout-date" class="block text-xs font-semibold text-slate-700 mb-1">Ngày trả phòng</label>
                    <input
                      id="stay-checkout-date"
                      type="date"
                      [ngModel]="stay().checkOutDate"
                      (ngModelChange)="updateStay('checkOutDate', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                    />
                  </div>
                } @else {
                  <div>
                    <label for="stay-checkin-time" class="block text-xs font-semibold text-slate-700 mb-1">Giờ nhận</label>
                    <input
                      id="stay-checkin-time"
                      type="time"
                      [ngModel]="stay().checkInTime"
                      (ngModelChange)="updateStay('checkInTime', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label for="stay-duration-hours" class="block text-xs font-semibold text-slate-700 mb-1">Số giờ thuê</label>
                    <input
                      id="stay-duration-hours"
                      type="number"
                      min="1"
                      [max]="hotel.maxHourlyHours || 24"
                      [ngModel]="stay().durationHours"
                      (ngModelChange)="updateStay('durationHours', $event)"
                      class="w-full h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                    />
                  </div>
                }
              </div>

              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 flex items-center gap-2">
                <i class="pi pi-clock text-indigo-600"></i>
                <span>Giờ Việt Nam · nhận {{ hotel.checkInTime }} / trả {{ hotel.checkOutTime }} theo cấu hình cơ sở. Giá và tồn phòng được kiểm tra lại khi giữ chỗ.</span>
              </div>

              <button
                type="button"
                (click)="checkAvailability()"
                [disabled]="loading()"
                class="w-full sm:w-auto h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                @if (availabilityLoading()) {
                  <i class="pi pi-spin pi-spinner text-sm"></i>
                  <span>Đang kiểm tra phòng trống…</span>
                } @else {
                  <i class="pi pi-search text-sm"></i>
                  <span>Kiểm Tra Phòng Trống</span>
                }
              </button>
            </section>

            <section aria-labelledby="rooms-title" class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 id="rooms-title" class="text-xl font-bold text-slate-900">Hạng Phòng Phù Hợp</h2>
                @if (rooms().length > 0) {
                  <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {{ rooms().length }} hạng phòng trống
                  </span>
                }
              </div>

              @if (availabilityLoading()) {
                <div role="status" class="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center gap-2">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-600"></i>
                  <p class="text-xs font-medium text-slate-500">Đang đối soát tình trạng phòng từ cơ sở…</p>
                </div>
              } @else if (availabilityChecked() && rooms().length === 0) {
                <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                  <i class="pi pi-calendar-times text-3xl text-slate-300"></i>
                  <p class="text-sm font-semibold text-slate-700">Không có phòng phù hợp lịch và số khách đã chọn.</p>
                  <p class="text-xs text-slate-400">Hãy thử đổi khoảng thời gian nhận/trả hoặc giảm số lượng khách.</p>
                </div>
              }

              @for (room of rooms(); track room.roomTypeId) {
                <article
                  class="p-5 bg-white rounded-3xl border transition-all space-y-4 shadow-sm"
                  [class.border-indigo-500]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-2]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.ring-indigo-100]="selectedRoom()?.roomTypeId === room.roomTypeId"
                  [class.border-slate-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                >
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="text-base font-bold text-slate-900">{{ room.name || room.roomTypeName }}</h3>
                        <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Còn {{ room.availableRoomsCount }} phòng
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-1">
                        Sức chứa tối đa {{ room.maxGuests || room.maxOccupancy }} khách • {{ room.areaSqm || room.squareMeters || 25 }}m² • {{ room.bedConfiguration || room.bedType || '1 giường đôi' }}
                      </p>
                    </div>

                    @if (room.dailyPrice || room.hourlyBasePrice || room.overnightPrice) {
                      <div class="sm:text-right">
                        <span class="text-[10px] text-slate-400 uppercase font-semibold block">Giá khởi điểm:</span>
                        <span class="text-base font-black text-indigo-600">
                          {{ (room.dailyPrice || room.hourlyBasePrice || room.overnightPrice) | number:'1.0-0' }} ₫
                        </span>
                      </div>
                    }
                  </div>

                  @if (room.amenities?.length) {
                    <div class="flex flex-wrap items-center gap-1.5 pt-1">
                      @for (amenity of room.amenities; track amenity) {
                        <span class="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          {{ amenity }}
                        </span>
                      }
                    </div>
                  }

                  <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs text-slate-400">Cam kết giữ chỗ tức thì</span>
                    <button
                      type="button"
                      (click)="selectRoom(room)"
                      [disabled]="availabilityLoading()"
                      class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      [class.bg-indigo-600]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.text-white]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.shadow-sm]="selectedRoom()?.roomTypeId === room.roomTypeId"
                      [class.bg-slate-100]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.text-slate-700]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                      [class.hover:bg-slate-200]="selectedRoom()?.roomTypeId !== room.roomTypeId"
                    >
                      @if (selectedRoom()?.roomTypeId === room.roomTypeId) {
                        <i class="pi pi-check text-xs"></i>
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

            <section class="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-2xs">
              <div class="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <i class="pi pi-shield text-indigo-600"></i>
                <span>Chính sách &amp; Địa danh xung quanh</span>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">
                Chính sách nhận/trả phòng và phụ thu dịch vụ được đồng bộ trực tiếp từ quản trị cơ sở. Vui lòng kiểm tra kỹ chi tiết trước khi đặt cọc.
              </p>
              @if (hotel.nearbyLandmarks?.length) {
                <div class="flex flex-wrap gap-2 pt-2">
                  @for (landmark of hotel.nearbyLandmarks; track landmark.landmarkId) {
                    <span class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/70 font-medium">
                      <i class="pi pi-map-marker text-amber-600 text-[10px]"></i>
                      {{ landmark.landmarkName || landmark.name }}
                      @if (landmark.distanceMeters) {
                        <span>({{ landmark.distanceMeters }}m)</span>
                      }
                    </span>
                  }
                </div>
              }
            </section>
          </div>

          <!-- ASIDE: BÁO GIÁ TỪ HỆ THỐNG -->
          <aside class="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-5 shadow-sm lg:sticky lg:top-24" aria-label="Báo giá">
            <div class="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                <i class="pi pi-tag"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-slate-800">Báo Giá Từ Cơ Sở</h2>
                <p class="text-xs text-slate-400">Tính toán chính xác theo biểu giá</p>
              </div>
            </div>

            @if (quoteLoading()) {
              <div role="status" class="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <i class="pi pi-spin pi-spinner text-xl text-indigo-600"></i>
                <span>Đang kết nối Quote Engine tính giá…</span>
              </div>
            }

            @if (quote(); as price) {
              <div class="space-y-4">
                <div class="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                  <div class="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Hạng phòng đã chọn</div>
                  <div class="text-sm font-bold text-indigo-950 mt-0.5">{{ price.roomTypeName }}</div>
                </div>

                <div class="space-y-1.5 text-xs divide-y divide-slate-100">
                  @for (line of price.breakdown; track $index) {
                    <div class="flex justify-between items-center text-slate-600 pt-1.5">
                      <span class="truncate pr-2">{{ line.description }}</span>
                      <span class="font-semibold text-slate-800 shrink-0">{{ line.amount | number:'1.0-0' }} ₫</span>
                    </div>
                  }
                </div>

                <div class="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
                  <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Tổng thanh toán dự kiến</span>
                  <div class="text-2xl font-black text-amber-400">{{ price.totalAmount | number:'1.0-0' }} ₫</div>
                  <p class="text-[10px] text-slate-400">Đã bao gồm thuế &amp; phí dịch vụ cơ sở</p>
                </div>

                <p class="text-[11px] text-slate-400 flex items-center gap-1">
                  <i class="pi pi-clock text-[10px]"></i>
                  Giá có hiệu lực đến {{ price.expiresAtUtc | date:'HH:mm:ss':'+0700' }}
                </p>
              </div>
            } @else if (!quoteLoading()) {
              <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/60 text-center space-y-1.5">
                <i class="pi pi-info-circle text-xl text-slate-400"></i>
                <p class="text-xs font-semibold text-slate-700">Chưa chọn hạng phòng</p>
                <p class="text-[11px] text-slate-400">Kiểm tra lịch và chọn một hạng phòng ở danh sách bên cạnh để xem bảng báo giá chi tiết.</p>
              </div>
            }

            <button
              type="button"
              (click)="proceedToHold()"
              [disabled]="!quote() || quoteLoading() || availabilityLoading()"
              class="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Tiếp Tục Giữ Phòng Này</span>
              <i class="pi pi-arrow-right text-xs"></i>
            </button>
          </aside>
        </div>
        <app-photo-gallery-modal [isOpen]="galleryOpen()" [photos]="galleryPhotos()" [title]="hotel.name" (close)="galleryOpen.set(false)" />
      }
    </main>
  `,
})
export class PropertyDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PublicBookingService);
  private readonly destroyRef = inject(DestroyRef);
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
  private generation = 0;
  private quoteGeneration = 0;

  supportedModes(): RentalType[] {
    const property = this.property();
    if (!property) return [];
    if (property.allowedRentalTypes?.length) return property.allowedRentalTypes;
    return (['Hourly', 'Overnight', 'Daily'] as RentalType[]).filter(mode => mode === 'Hourly' ? property.allowHourlyBooking : mode === 'Overnight' ? property.allowOvernightBooking : property.allowDailyBooking);
  }
  galleryPhotos(): GalleryPhotoItem[] { return (this.property()?.galleryUrls?.length ? this.property()!.galleryUrls : this.property()?.thumbnailUrl ? [this.property()!.thumbnailUrl] : []).map(url => ({ url, title: this.property()!.name })); }
  openGallery(): void { this.galleryOpen.set(true); }
  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParams ?? of(this.route.snapshot.queryParams)])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
  }
  refresh(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) { this.error.set('Không có cơ sở được chọn.'); return; }
    const generation = ++this.generation;
    ++this.quoteGeneration; this.property.set(null); this.rooms.set([]); this.selectedRoom.set(null); this.quote.set(null);
    this.availabilityChecked.set(false); this.availabilityLoading.set(false); this.quoteLoading.set(false);
    this.error.set(''); this.loading.set(true);
    try { this.stay.set(readPublicStay(this.route.snapshot.queryParams)); } catch (error) { this.loading.set(false); this.error.set((error as Error).message); return; }
    this.service.getPropertyBySlug(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: property => { if (generation !== this.generation) return; this.property.set(property); this.loading.set(false); this.checkAvailability(); },
      error: () => { if (generation !== this.generation) return; this.loading.set(false); this.error.set('Không tải được cơ sở. Vui lòng kiểm tra đường dẫn hoặc thử lại.'); },
    });
  }
  updateStay(key: keyof PublicStayContext, value: string | number): void {
    this.stay.update(stay => ({ ...stay, [key]: value }));
    ++this.generation; ++this.quoteGeneration; this.rooms.set([]); this.quote.set(null); this.selectedRoom.set(null);
    this.availabilityChecked.set(false); this.availabilityLoading.set(false); this.quoteLoading.set(false); this.error.set('');
  }
  checkAvailability(): void {
    const property = this.property(); if (!property) return;
    const generation = ++this.generation; ++this.quoteGeneration; this.quote.set(null); this.selectedRoom.set(null); this.rooms.set([]); this.quoteLoading.set(false); this.error.set('');
    try {
      const stay = readPublicStay({ ...this.stay() }); this.stay.set(stay);
      const interval = publicStayInterval(stay, property);
      this.availabilityLoading.set(true); this.availabilityChecked.set(false);
      this.service.getAvailability(property.slug, interval).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: rooms => { if (generation !== this.generation) return; this.rooms.set(rooms.filter(room => room.availableRoomsCount > 0 && (room.maxGuests || room.maxOccupancy || 0) >= stay.guests)); this.availabilityLoading.set(false); this.availabilityChecked.set(true); },
        error: () => { if (generation !== this.generation) return; this.availabilityLoading.set(false); this.error.set('Không kiểm tra được tình trạng phòng. Vui lòng thử lại.'); },
      });
    } catch (error) { this.availabilityLoading.set(false); this.error.set((error as Error).message); }
  }
  selectRoom(room: PublicRoomTypeAvailabilityDto): void {
    const property = this.property(); if (!property || !this.rooms().some(candidate => candidate.roomTypeId === room.roomTypeId)) return;
    const generation = ++this.quoteGeneration; this.selectedRoom.set(room); this.quote.set(null); this.quoteLoading.set(true); this.error.set('');
    try {
      this.service.calculateQuote({ propertySlug: property.slug, roomTypeId: room.roomTypeId, ...publicStayInterval(this.stay(), property) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: quote => { if (generation !== this.quoteGeneration) return; this.quote.set(quote); this.quoteLoading.set(false); },
        error: () => { if (generation !== this.quoteGeneration) return; this.quoteLoading.set(false); this.error.set('Không lấy được báo giá. Vui lòng chọn lại phòng để thử lại.'); },
      });
    } catch (error) { this.quoteLoading.set(false); this.error.set((error as Error).message); }
  }
  proceedToHold(): void {
    const price = this.quote(), property = this.property(), room = this.selectedRoom();
    if (!price || !property || !room || this.quoteLoading() || this.availabilityLoading()) return;
    if (!Number.isFinite(new Date(price.expiresAtUtc).getTime()) || new Date(price.expiresAtUtc).getTime() <= Date.now()) { this.quote.set(null); this.error.set('Báo giá đã hết hiệu lực. Vui lòng chọn lại phòng.'); return; }
    this.router.navigate(['/booking/hold'], { queryParams: { propertySlug: property.slug, roomTypeId: room.roomTypeId, ...this.stay() } });
  }
}
