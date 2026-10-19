import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { PublicRoomTypeAvailabilityDto } from '../../../core/models/public-booking.model';
import { RoomPhoto, RoomAmenityItem } from '../../../core/services/room-gallery.service';

@Component({
  selector: 'app-room-detail-modal',
  standalone: true,
  imports: [CommonModule, A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="isOpen && roomType"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="roomType.roomTypeName || roomType.name"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (keydown.escape)="$event.stopPropagation(); closeModal()"
      (click)="onBackdropClick($event)">

      <div
        class="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()">

        <!-- Header / Hero Media Area -->
        <div class="relative h-56 sm:h-72 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 shrink-0 overflow-hidden">
          <img
            *ngIf="heroImageUrl; else fallbackHero"
            [src]="heroImageUrl"
            [alt]="roomType.roomTypeName || roomType.name"
            class="w-full h-full object-cover"
          />
          <ng-template #fallbackHero>
            <div class="w-full h-full flex flex-col items-center justify-center text-white/70 p-6 text-center space-y-1.5">
              <div class="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white text-2xl border border-white/15">
                <i class="pi pi-image"></i>
              </div>
              <span class="text-xs font-semibold text-slate-300">Chưa công bố ảnh phòng</span>
              <p class="text-[11px] text-slate-400">Kiểm tra lịch trống ở bước đặt phòng</p>
            </div>
          </ng-template>

          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent"></div>

          <!-- Close Button -->
          <button
            type="button"
            (click)="closeModal()"
            cdkFocusInitial
            class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
            aria-label="Đóng chi tiết phòng">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <!-- Top Badge: Property & Status -->
          <div class="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
            <span *ngIf="propertyName" class="px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-800 backdrop-blur-md shadow-xs">
              {{ propertyName }}
            </span>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600/90 text-white backdrop-blur-md flex items-center gap-1">
              <i class="pi pi-sparkles text-[10px]"></i> Smart Lock 24/7
            </span>
          </div>

          <!-- Hero Bottom Title & Gallery Trigger -->
          <div class="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4 text-white">
            <div>
              <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                {{ roomType.roomTypeName || roomType.name }}
              </h2>
              <p class="text-xs text-slate-300 mt-1 line-clamp-1">
                {{ roomType.description || 'Không gian nghỉ dưỡng tiện nghi, thoáng mát với đầy đủ tiện ích cơ bản.' }}
              </p>
            </div>

            <button
              *ngIf="photos.length > 0"
              type="button"
              (click)="openGalleryModal()"
              class="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Xem {{ photos.length }} ảnh</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Modal Content Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          <!-- Key Specifications Bar (Bento Tiles) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <i class="pi pi-users text-sm"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Sức chứa</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800">{{ (roomType.maxOccupancy || roomType.maxGuests) ? (roomType.maxOccupancy || roomType.maxGuests) + ' khách' : 'Tiêu chuẩn' }}</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <i class="pi pi-bed text-sm"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Loại giường</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800 truncate block">{{ roomType.bedType || roomType.bedConfiguration || 'Giường tiêu chuẩn' }}</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <i class="pi pi-expand text-sm"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Diện tích</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800">{{ (roomType.squareMeters || roomType.areaSqm) ? (roomType.squareMeters || roomType.areaSqm) + ' m²' : 'Tiêu chuẩn' }}</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <i class="pi pi-key text-sm"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Khóa phòng</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800 truncate block">Smart Lock</strong>
              </div>
            </div>
          </div>

          <!-- Room Amenities Section -->
          <div>
            <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-indigo-600"></span>
              <span>Trang thiết bị &amp; Tiện nghi hạng phòng</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              @if (amenities.length > 0) {
                <div
                  *ngFor="let item of amenities"
                  class="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700">
                  <i [class]="item.icon" class="text-indigo-600 text-sm"></i>
                  <span class="font-medium">{{ item.name }}</span>
                </div>
              } @else if (roomType.amenities.length > 0) {
                @for (amenity of roomType.amenities; track $index) {
                  <div class="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700">
                    <i class="pi pi-check text-emerald-600 text-sm"></i>
                    <span class="font-medium">{{ amenity }}</span>
                  </div>
                }
              } @else {
                <div class="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                  <i class="pi pi-info-circle text-indigo-500"></i>
                  <span>Trang bị đầy đủ điều hòa, nước nóng, wifi cáp quang, máy sấy tóc và vật dụng cá nhân.</span>
                </div>
              }
            </div>
          </div>

          <!-- Policies and Stay Terms -->
          <div class="bg-indigo-50/60 rounded-2xl p-4 sm:p-5 border border-indigo-100/80 space-y-2.5 text-xs">
            <h4 class="font-bold text-indigo-950 flex items-center gap-1.5">
              <i class="pi pi-shield text-indigo-600"></i>
              <span>Chính sách lưu trú &amp; Cam kết nhận phòng</span>
            </h4>
            <ul class="space-y-1.5 text-slate-600 pl-4 list-disc marker:text-indigo-500">
              <li>Mã số Smart Lock sẽ được cấp tự động sau khi hoàn tất giữ phòng &amp; xác nhận cọc.</li>
              <li>Giá và phòng trống được đối soát trực tiếp theo thời gian thực từ cơ sở lưu trú.</li>
              <li>Đảm bảo 100% có phòng đúng thời gian đăng ký lưu trú.</li>
            </ul>
          </div>

        </div>

        <!-- Sticky Footer CTA Bar -->
        <footer class="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Giá dự kiến:</span>
            <div *ngIf="displayPrice > 0; else referencePrice" class="flex items-baseline gap-1">
              <strong class="text-xl sm:text-2xl font-black text-indigo-600">
                {{ displayPrice | number:'1.0-0' }} ₫
              </strong>
              <span class="text-xs text-slate-500">theo biểu giá cơ sở</span>
            </div>
            <ng-template #referencePrice>
              <p class="text-sm font-semibold text-indigo-700">Giá tính theo lịch đã chọn</p>
            </ng-template>
          </div>

          <div class="flex items-center justify-end gap-2.5">
            <button
              type="button"
              (click)="closeModal()"
              class="min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Đóng
            </button>
            <button
              type="button"
              (click)="selectRoom()"
              [disabled]="!roomType.roomTypeId"
              class="min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
              <span>Tiếp tục đặt phòng</span>
              <i class="pi pi-arrow-right text-xs"></i>
            </button>
          </div>
        </footer>

      </div>
    </div>
  `
})
export class RoomDetailModalComponent {
  @Input() isOpen = false;
  @Input() roomType: PublicRoomTypeAvailabilityDto | null = null;
  @Input() propertyName = '';
  @Input() photos: RoomPhoto[] = [];
  @Input() amenities: RoomAmenityItem[] = [];
  @Input() displayPrice = 0;

  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<PublicRoomTypeAvailabilityDto>();
  @Output() viewGallery = new EventEmitter<number>();

  get heroImageUrl(): string {
    if (this.photos && this.photos.length > 0) {
      return this.photos[0].url;
    }
    return this.roomType?.imageUrl || this.roomType?.images?.[0] || '';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    if (this.isOpen) this.close.emit();
  }

  selectRoom(): void {
    if (this.isOpen && this.roomType?.roomTypeId) {
      this.select.emit(this.roomType);
      this.closeModal();
    }
  }

  openGalleryModal(): void {
    if (this.isOpen && this.photos.length) this.viewGallery.emit(0);
  }
}
