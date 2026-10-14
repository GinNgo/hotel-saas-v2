import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicRoomTypeAvailabilityDto } from '../../../core/models/public-booking.model';
import { RoomPhoto, RoomAmenityItem } from '../../../core/services/room-gallery.service';

@Component({
  selector: 'app-room-detail-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen && roomType"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="roomType.roomTypeName"
      (click)="onBackdropClick($event)">

      <div
        class="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()">

        <!-- Header / Hero Media Area -->
        <div class="relative h-56 sm:h-72 bg-slate-900 shrink-0 overflow-hidden">
          <img
            [src]="heroImageUrl"
            [alt]="roomType.roomTypeName"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent"></div>

          <!-- Close Button -->
          <button
            type="button"
            (click)="closeModal()"
            class="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-colors focus:outline-none"
            aria-label="Đóng chi tiết phòng">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <!-- Top Badge: Property & Status -->
          <div class="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span *ngIf="propertyName" class="px-3 py-1 rounded-full text-xs font-bold bg-white/90 text-slate-800 backdrop-blur-xs shadow-xs">
              {{ propertyName }}
            </span>
            <span
              [ngClass]="roomType.isAvailable && roomType.availableRooms > 0 ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'"
              class="px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-xs shadow-xs">
              {{ roomType.isAvailable && roomType.availableRooms > 0 ? 'Còn ' + roomType.availableRooms + ' phòng trống' : 'Hết phòng' }}
            </span>
          </div>

          <!-- Hero Bottom Title & Gallery Trigger -->
          <div class="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4 text-white">
            <div>
              <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                {{ roomType.roomTypeName }}
              </h2>
              <p class="text-xs text-slate-300 mt-1 line-clamp-1">
                {{ roomType.description || 'Hạng phòng nghỉ dưỡng tiện nghi, tiêu chuẩn khách sạn cao cấp' }}
              </p>
            </div>

            <button
              *ngIf="photos.length > 0"
              type="button"
              (click)="openGalleryModal()"
              class="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Xem {{ photos.length }} ảnh</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Modal Content Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          <!-- Key Specifications Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Sức chứa</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800">{{ roomType.maxOccupancy }} người lớn</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10m0-5h18m0-5v10m-14-6h6a2 2 0 002-2V7H5v2a2 2 0 002 2z"/></svg>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Loại giường</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800 truncate block">{{ roomType.bedType || 'Giường King/Queen' }}</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Diện tích</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800">{{ roomType.squareMeters ? roomType.squareMeters + ' m²' : '32 m²' }}</strong>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Hướng nhìn</span>
                <strong class="text-xs sm:text-sm font-bold text-slate-800 truncate block">Thành phố &amp; Vườn</strong>
              </div>
            </div>
          </div>

          <!-- Room Amenities Section -->
          <div>
            <h4 class="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-indigo-600"></span>
              <span>Trang thiết bị &amp; Tiện nghi hạng phòng</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                *ngFor="let item of amenities"
                class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                <i [class]="item.icon" class="text-indigo-600 text-sm"></i>
                <span class="font-medium">{{ item.name }}</span>
              </div>
            </div>
          </div>

          <!-- Policies and Stay Terms -->
          <div class="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100/80 space-y-2 text-xs">
            <h4 class="font-bold text-indigo-950 flex items-center gap-1.5">
              <i class="pi pi-info-circle text-indigo-600"></i>
              <span>Chính sách lưu trú &amp; Giữ phòng</span>
            </h4>
            <ul class="space-y-1.5 text-slate-600 pl-4 list-disc marker:text-indigo-500">
              <li>Nhận phòng từ <strong>14:00</strong> &bull; Trả phòng trước <strong>12:00</strong> ngày hôm sau.</li>
              <li>Hệ thống <strong>khóa giữ phòng tức thì 15 phút</strong> khi hoàn tất tạo yêu cầu để khách làm thủ tục đặt cọc.</li>
              <li>Không hút thuốc lá trong phòng nghỉ. Thú cưng vui lòng liên hệ trước với bộ phận lễ tân.</li>
              <li>Hỗ trợ hủy phòng hoặc đổi lịch linh hoạt trước 24 giờ so với giờ nhận phòng.</li>
            </ul>
          </div>

        </div>

        <!-- Sticky Footer CTA Bar -->
        <footer class="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Giá ước tính:</span>
            <div class="flex items-baseline gap-1">
              <strong class="text-xl sm:text-2xl font-black text-indigo-600">
                {{ roomType.estimatedPrice | number:'1.0-0' }} ₫
              </strong>
              <span class="text-xs text-slate-500">/ lưu trú</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="closeModal()"
              class="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              Đóng
            </button>
            <button
              type="button"
              (click)="selectRoom()"
              [disabled]="!roomType.isAvailable || roomType.availableRooms === 0"
              class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              <span>Chọn phòng này</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
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

  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<PublicRoomTypeAvailabilityDto>();
  @Output() viewGallery = new EventEmitter<number>();

  get heroImageUrl(): string {
    if (this.photos && this.photos.length > 0) {
      return this.photos[0].url;
    }
    return this.roomType?.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  selectRoom(): void {
    if (this.roomType) {
      this.select.emit(this.roomType);
      this.closeModal();
    }
  }

  openGalleryModal(): void {
    this.viewGallery.emit(0);
  }
}
