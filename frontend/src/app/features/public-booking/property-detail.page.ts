import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import {
  PublicPropertyDto,
  PublicRoomTypeDto,
  RentalType,
  PropertyPolicyDto,
  GuestReviewDto
} from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        <!-- 1. BREADCRUMB -->
        <nav class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span>/</span>
          @if (property()?.touristZoneName) {
            <a [routerLink]="['/booking/destinations', property()?.touristZoneSlug]" class="hover:text-indigo-600 transition-colors">
              {{ property()?.touristZoneName }}
            </a>
            <span>/</span>
          } @else if (property()?.city) {
            <span class="text-slate-600">{{ property()?.city }}</span>
            <span>/</span>
          }
          <span class="text-slate-800 font-semibold truncate">{{ property()?.name || 'Chi tiết cơ sở' }}</span>
        </nav>

        <!-- LOADING STATE -->
        @if (isLoading()) {
          <div class="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-xs">
            <div class="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-sm font-medium text-slate-600">Đang tải thông tin cơ sở lưu trú & bảng giá phòng...</p>
          </div>
        }

        @if (!isLoading() && property()) {
          <!-- 2. HEADER CƠ SỞ & CHUỖI THƯƠNG HIỆU -->
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {{ property()?.propertyTypeName || 'Khách sạn' }}
                  </span>
                  @if ((property()?.starRating ?? 0) > 0) {
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <i class="pi pi-star-fill text-[11px] text-amber-500"></i>
                      <span>{{ property()?.starRating }} sao</span>
                    </span>
                  }
                  @if (property()?.touristZoneName) {
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      📍 {{ property()?.touristZoneName }}
                    </span>
                  }
                </div>

                <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {{ property()?.name }}
                </h1>

                <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                  <i class="pi pi-map-marker text-indigo-600 shrink-0"></i>
                  <span>{{ property()?.address }}, {{ property()?.city }}</span>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <!-- Loyalty Membership Callout -->
                <div class="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                      <i class="pi pi-crown"></i>
                    </span>
                    <div>
                      <span class="text-xs font-extrabold text-slate-900 block">Hội viên Cơ sở & Chuỗi</span>
                      <span class="text-[11px] text-slate-600">Giảm ngay 5-12% & Tích điểm</span>
                    </div>
                  </div>
                  <a
                    routerLink="/booking/profile"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all shadow-xs"
                  >
                    <i class="pi pi-plus-circle text-xs"></i>
                    <span>Đăng ký thành viên cơ sở này (Nhận ưu đãi & tích điểm)</span>
                  </a>
                </div>

                <!-- Brand chain tag -->
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right sm:text-left flex flex-col justify-center">
                  <span class="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Hệ thống chuỗi</span>
                  <span class="text-sm font-bold text-slate-900">{{ property()?.tenantBrandName || 'Hệ thống đối tác HotelSaaS' }}</span>
                  <a routerLink="/booking/brands" class="text-xs text-indigo-600 hover:underline font-medium mt-1">
                    Xem tất cả chi nhánh →
                  </a>
                </div>
              </div>
            </div>

            <!-- 3. BENTO PHOTO GALLERY (5 ẢNH NỔI BẬT) -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4">
              <div class="md:col-span-2 h-72 sm:h-96 rounded-2xl overflow-hidden relative group cursor-pointer" (click)="openGallery(0)">
                <img
                  [src]="galleryPhotos()[0]"
                  [alt]="property()?.name"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent flex items-end p-4">
                  <span class="text-white text-xs font-semibold bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/20">
                    Toàn cảnh cơ sở
                  </span>
                </div>
              </div>

              <div class="md:col-span-2 grid grid-cols-2 gap-3 h-72 sm:h-96">
                @for (photo of galleryPhotos().slice(1, 5); track $index) {
                  <div class="h-[138px] sm:h-[186px] rounded-2xl overflow-hidden relative group cursor-pointer" (click)="openGallery($index + 1)">
                    <img
                      [src]="photo"
                      [alt]="'Ảnh ' + ($index + 2)"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    @if ($index === 3) {
                      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center text-white font-bold text-sm">
                        + Xem thêm ảnh
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- 4. MAIN LAYOUT: NỘI DUNG CHÍNH (8 CỘT) & SIDEBAR BÁO GIÁ (4 CỘT) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            <div class="lg:col-span-8 space-y-8">

              <!-- A. VỊ TRÍ & ĐỊA DANH XUNG QUANH -->
              @if (property()?.nearbyLandmarks && property()!.nearbyLandmarks.length > 0) {
                <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                  <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <i class="pi pi-compass text-indigo-600"></i>
                      <span>Vị trí & Địa danh du lịch xung quanh</span>
                    </h2>
                    <span class="text-xs text-slate-500 font-medium">Bán kính 3 km</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (lm of property()!.nearbyLandmarks; track (lm.landmarkSlug || lm.landmarkId || lm.landmarkName)) {
                      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 truncate">
                          <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            📍
                          </div>
                          <div class="truncate">
                            <span class="text-xs font-bold text-slate-900 block truncate">{{ lm.landmarkName || lm.name }}</span>
                            <span class="text-[10px] text-slate-500">{{ lm.category || 'Điểm tham quan' }}</span>
                          </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          {{ lm.distanceFormatted || formatDistance(lm.distanceMeters) }}
                        </span>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- B. BẢNG CHỌN HẠNG PHÒNG & MÁY TÍNH BÁO GIÁ THỜI GIAN THỰC -->
              <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <i class="pi pi-calendar text-indigo-600"></i>
                    <span>Chọn Hạng phòng & Khung giờ thuê</span>
                  </h2>
                  <p class="text-xs text-slate-500 mt-1">
                    Giá phòng được tính toán tự động và chuẩn xác theo công cụ Pricing Engine thời gian thực.
                  </p>
                </div>

                <!-- Chế độ thuê Switcher -->
                <div class="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
                  @if (property()?.allowHourlyBooking) {
                    <button
                      type="button"
                      (click)="setRentalType('Hourly')"
                      class="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                      [class.bg-white]="selectedRentalType() === 'Hourly'"
                      [class.text-indigo-600]="selectedRentalType() === 'Hourly'"
                      [class.shadow-xs]="selectedRentalType() === 'Hourly'"
                      [class.text-slate-600]="selectedRentalType() !== 'Hourly'"
                    >
                      ⏰ Thuê theo giờ
                    </button>
                  }
                  @if (property()?.allowOvernightBooking) {
                    <button
                      type="button"
                      (click)="setRentalType('Overnight')"
                      class="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                      [class.bg-white]="selectedRentalType() === 'Overnight'"
                      [class.text-indigo-600]="selectedRentalType() === 'Overnight'"
                      [class.shadow-xs]="selectedRentalType() === 'Overnight'"
                      [class.text-slate-600]="selectedRentalType() !== 'Overnight'"
                    >
                      🌙 Qua đêm (21h - 10h)
                    </button>
                  }
                  @if (property()?.allowDailyBooking) {
                    <button
                      type="button"
                      (click)="setRentalType('Daily')"
                      class="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                      [class.bg-white]="selectedRentalType() === 'Daily'"
                      [class.text-indigo-600]="selectedRentalType() === 'Daily'"
                      [class.shadow-xs]="selectedRentalType() === 'Daily'"
                      [class.text-slate-600]="selectedRentalType() !== 'Daily'"
                    >
                      ☀️ Theo ngày / đêm
                    </button>
                  }
                </div>

                <!-- Tham số thời gian tùy chọn theo chế độ -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs">
                  @if (selectedRentalType() === 'Hourly') {
                    <div>
                      <label class="block font-semibold text-slate-700 mb-1">Số giờ thuê:</label>
                      <select
                        [ngModel]="selectedHours()"
                        (ngModelChange)="onHoursChange($event)"
                        class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-indigo-500"
                      >
                        <option [value]="1">1 giờ (Nghỉ nhanh)</option>
                        <option [value]="2">2 giờ (Phổ biến)</option>
                        <option [value]="3">3 giờ</option>
                        <option [value]="4">4 giờ</option>
                        <option [value]="6">6 giờ</option>
                      </select>
                    </div>
                    <div>
                      <label class="block font-semibold text-slate-700 mb-1">Giờ nhận phòng dự kiến:</label>
                      <input
                        type="time"
                        [(ngModel)]="checkInTime"
                        (change)="onTimeChange()"
                        class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-indigo-500"
                      />
                    </div>
                    <div>
                      <label class="block font-semibold text-slate-700 mb-1">Ngày nhận phòng:</label>
                      <input
                        type="date"
                        [(ngModel)]="checkInDate"
                        (change)="onDateChange()"
                        class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-indigo-500"
                      />
                    </div>
                  } @else {
                    <div>
                      <label class="block font-semibold text-slate-700 mb-1">Ngày nhận phòng:</label>
                      <input
                        type="date"
                        [(ngModel)]="checkInDate"
                        (change)="onDateChange()"
                        class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-indigo-500"
                      />
                    </div>
                    <div>
                      <label class="block font-semibold text-slate-700 mb-1">Ngày trả phòng:</label>
                      <input
                        type="date"
                        [(ngModel)]="checkOutDate"
                        (change)="onDateChange()"
                        class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-indigo-500"
                      />
                    </div>
                    <div class="flex items-center">
                      <span class="text-slate-500 text-[11px] leading-relaxed">
                        {{ selectedRentalType() === 'Overnight' ? 'Khung giờ: 21:00 tối đến 10:00 sáng hôm sau.' : 'Check-in: 14:00 • Check-out: 12:00 trưa hôm sau.' }}
                      </span>
                    </div>
                  }
                </div>

                <!-- Danh sách Hạng phòng -->
                <div class="space-y-4">
                  <h3 class="text-sm font-bold text-slate-900">Các hạng phòng đang mở bán:</h3>

                  @for (room of roomTypes(); track room.id) {
                    <div
                      class="p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer"
                      [class.border-indigo-600]="selectedRoomType()?.id === room.id"
                      [class.bg-indigo-50/20]="selectedRoomType()?.id === room.id"
                      [class.shadow-xs]="selectedRoomType()?.id === room.id"
                      [class.border-slate-200]="selectedRoomType()?.id !== room.id"
                      (click)="selectRoomType(room)"
                    >
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="space-y-1.5 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="text-base font-bold text-slate-900">{{ room.name }}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600 border border-slate-200">
                              {{ room.code }}
                            </span>
                          </div>

                          <p class="text-xs text-slate-600 line-clamp-2">
                            {{ room.description || 'Phòng nghỉ tiện nghi đầy đủ máy lạnh, nước nóng, wifi tốc độ cao và giường nệm cao cấp.' }}
                          </p>

                          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                            <span>👥 Tối đa: {{ room.maxOccupancy }} khách</span>
                            @if (room.bedType) {
                              <span>🛏️ {{ room.bedType }}</span>
                            }
                            @if (room.squareMeters) {
                              <span>📐 {{ room.squareMeters }} m²</span>
                            }
                          </div>
                        </div>

                        <!-- Price & CTA -->
                        <div class="text-right sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                          <div class="text-lg font-extrabold text-indigo-700">
                            {{ getEstimatedPrice(room) | number:'1.0-0' }} ₫
                          </div>
                          <span class="text-[10px] text-slate-400 block mb-2">{{ getPriceUnitLabel() }}</span>

                          <button
                            type="button"
                            (click)="selectRoomType(room); $event.stopPropagation()"
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            [class.bg-indigo-600]="selectedRoomType()?.id === room.id"
                            [class.text-white]="selectedRoomType()?.id === room.id"
                            [class.bg-slate-100]="selectedRoomType()?.id !== room.id"
                            [class.text-slate-700]="selectedRoomType()?.id !== room.id"
                          >
                            {{ selectedRoomType()?.id === room.id ? '✓ Đã chọn' : 'Chọn hạng phòng' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>

                <!-- BÓC TÁCH BÁO GIÁ THỜI GIAN THỰC (QUOTE BREAKDOWN) KHI ĐÃ CHỌN PHÒNG -->
                @if (selectedRoomType()) {
                  <div class="p-5 rounded-2xl bg-indigo-900 text-white space-y-4 shadow-lg animate-in fade-in duration-200">
                    <div class="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                      <div>
                        <span class="text-[11px] text-indigo-300 font-semibold uppercase tracking-wider">Chi tiết báo giá</span>
                        <h4 class="text-sm font-bold text-white">{{ selectedRoomType()?.name }}</h4>
                      </div>
                      <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-800 text-indigo-200 border border-indigo-700">
                        {{ selectedRentalType() === 'Hourly' ? (selectedHours() + ' giờ') : (selectedRentalType() === 'Overnight' ? 'Qua đêm' : 'Theo ngày') }}
                      </span>
                    </div>

                    <div class="space-y-2 text-xs">
                      <div class="flex justify-between text-indigo-200">
                        <span>Giá phòng gốc:</span>
                        <span class="font-mono">{{ getEstimatedPrice(selectedRoomType()!) | number:'1.0-0' }} ₫</span>
                      </div>
                      <div class="flex justify-between text-indigo-200">
                        <span>Thuế &amp; Phí dịch vụ (VAT 0%):</span>
                        <span class="font-mono">Đã bao gồm</span>
                      </div>
                      <div class="flex justify-between text-base font-extrabold text-white pt-2 border-t border-indigo-800">
                        <span>Tổng chi phí dự kiến:</span>
                        <span class="font-mono text-amber-400 text-lg">{{ getEstimatedPrice(selectedRoomType()!) | number:'1.0-0' }} ₫</span>
                      </div>
                    </div>

                    <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span class="text-[11px] text-indigo-300">
                        🛡️ Giữ chỗ phòng trong 15 phút không mất phí
                      </span>
                      <button
                        type="button"
                        (click)="proceedToHold()"
                        class="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md transition-all cursor-pointer"
                      >
                        Giữ phòng ngay (Khóa 15 phút) →
                      </button>
                    </div>
                  </div>
                }
              </section>

              <!-- C. CHÍNH SÁCH CƠ SỞ LƯU TRÚ -->
              @if (policies()) {
                <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                  <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <i class="pi pi-shield text-indigo-600"></i>
                    <span>Chính sách nhận / trả phòng &amp; Quy định cơ sở</span>
                  </h2>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span class="font-bold text-slate-900 block">Thời gian quy chuẩn:</span>
                      <div class="flex justify-between text-slate-600">
                        <span>Giờ nhận phòng tiêu chuẩn:</span>
                        <span class="font-bold text-slate-900">{{ policies()?.checkInTime }}</span>
                      </div>
                      <div class="flex justify-between text-slate-600">
                        <span>Giờ trả phòng tiêu chuẩn:</span>
                        <span class="font-bold text-slate-900">{{ policies()?.checkOutTime }}</span>
                      </div>
                      <div class="flex justify-between text-slate-600">
                        <span>Thời gian dọn phòng đệm:</span>
                        <span class="font-bold text-slate-900">{{ policies()?.bufferMinutes }} phút</span>
                      </div>
                    </div>

                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span class="font-bold text-slate-900 block">Chính sách hủy &amp; Phụ thu:</span>
                      <p class="text-slate-600">{{ policies()?.cancellationPolicy }}</p>
                      <div class="text-[11px] text-indigo-600 font-medium">
                        Phụ thu trả phòng muộn: {{ policies()?.lateCheckOutFeePerHour | number:'1.0-0' }} ₫/giờ.
                      </div>
                    </div>
                  </div>

                  <div class="space-y-1.5 pt-2">
                    <span class="text-xs font-bold text-slate-700">Quy định chung của cơ sở:</span>
                    <ul class="list-disc list-inside text-xs text-slate-600 space-y-1">
                      @for (rule of policies()?.generalRules; track rule) {
                        <li>{{ rule }}</li>
                      }
                    </ul>
                  </div>
                </section>
              }

              <!-- D. ĐÁNH GIÁ CỦA KHÁCH HÀNG -->
              <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <i class="pi pi-comments text-indigo-600"></i>
                      <span>Đánh giá từ khách hàng thực tế</span>
                    </h2>
                    <p class="text-xs text-slate-500 mt-0.5">
                      100% đánh giá được xác thực sau khi khách hoàn tất lưu trú và trả phòng.
                    </p>
                  </div>
                  <div class="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-2xl">
                    <span class="text-base font-extrabold">4.8</span>
                    <span class="text-[10px] text-emerald-700">/ 5 sao</span>
                  </div>
                </div>

                <!-- Reviews list -->
                <div class="space-y-3">
                  @for (rev of reviews(); track rev.id) {
                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {{ rev.guestName.charAt(0) }}
                          </div>
                          <div>
                            <span class="text-xs font-bold text-slate-900 block">{{ rev.guestName }}</span>
                            <span class="text-[10px] text-slate-400">{{ rev.createdAt }} &bull; {{ rev.roomTypeName }}</span>
                          </div>
                        </div>

                        <div class="flex items-center text-amber-400 text-xs">
                          @for (star of [1,2,3,4,5]; track star) {
                            <i class="pi" [class.pi-star-fill]="star <= rev.rating" [class.pi-star]="star > rev.rating"></i>
                          }
                        </div>
                      </div>

                      <p class="text-xs text-slate-700 leading-relaxed">{{ rev.comment }}</p>
                    </div>
                  }
                </div>
              </section>

            </div>

            <!-- SIDEBAR: THÔNG TIN TÓM TẮT & HỖ TRỢ (4 CỘT) -->
            <div class="lg:col-span-4 space-y-6 sticky top-20">
              <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Bắt đầu từ</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-3xl font-black text-indigo-600">
                    {{ (property()?.hourlyStartingPrice || property()?.startingPrice || 150000) | number:'1.0-0' }} ₫
                  </span>
                  <span class="text-xs text-slate-500 font-medium">/ 2 giờ đầu</span>
                </div>

                <div class="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-check-circle text-emerald-500"></i>
                    <span>Giữ chỗ trực tuyến 15 phút miễn phí</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-check-circle text-emerald-500"></i>
                    <span>Nhận phòng không cần thẻ tín dụng</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-check-circle text-emerald-500"></i>
                    <span>Hỗ trợ lễ tân 24/7 tại chi nhánh</span>
                  </div>
                </div>

                <button
                  type="button"
                  (click)="scrollToRooms()"
                  class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Xem phòng &amp; Báo giá ngay
                </button>
              </div>

              <!-- Contact box -->
              <div class="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 text-xs text-slate-700 space-y-2">
                <span class="font-bold text-indigo-950 block">Hỗ trợ khách hàng:</span>
                <p class="text-slate-600 leading-relaxed">
                  Quý khách cần giải đáp thêm về phòng gia đình, nhận phòng sớm hoặc thuê nguyên căn?
                </p>
                <div class="flex items-center gap-2 text-indigo-700 font-bold pt-1">
                  <i class="pi pi-phone text-xs"></i>
                  <span>Hotline: 1900 6868 (Miễn phí 24/7)</span>
                </div>
              </div>
            </div>

          </div>
        }
      </div>
    </div>
  `
})
export class PropertyDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  readonly isLoading = signal<boolean>(true);
  readonly property = signal<PublicPropertyDto | null>(null);
  readonly roomTypes = signal<PublicRoomTypeDto[]>([]);
  readonly policies = signal<PropertyPolicyDto | null>(null);
  readonly reviews = signal<GuestReviewDto[]>([]);

  readonly selectedRentalType = signal<RentalType>('Daily');
  readonly selectedHours = signal<number>(2);
  readonly checkInDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly checkOutDate = signal<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  readonly checkInTime = signal<string>('14:00');

  readonly selectedRoomType = signal<PublicRoomTypeDto | null>(null);

  readonly galleryPhotos = computed<string[]>(() => {
    const p = this.property();
    if (!p) return [];
    if (p.galleryUrls && p.galleryUrls.length > 0) return p.galleryUrls;
    const base = p.imageUrl || p.thumbnailUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800';
    return [
      base,
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'
    ];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadPropertyData(slug);
      }
    });
  }

  loadPropertyData(slug: string): void {
    this.isLoading.set(true);
    this.publicBookingService.getPropertyBySlug(slug).subscribe({
      next: (prop) => {
        this.property.set(prop);
        this.isLoading.set(false);

        // Load associated room types
        this.publicBookingService.getRoomTypes(slug).subscribe({
          next: (types) => {
            this.roomTypes.set(types);
            if (types.length > 0) {
              this.selectedRoomType.set(types[0]);
            }
          }
        });

        // Load policies
        this.publicBookingService.getPropertyPolicies(slug).subscribe({
          next: (pol) => this.policies.set(pol)
        });

        // Load reviews
        this.publicBookingService.getPropertyReviews(slug).subscribe({
          next: (revs) => this.reviews.set(revs)
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.error('Không tìm thấy thông tin cơ sở lưu trú.');
        this.router.navigate(['/booking']);
      }
    });
  }

  setRentalType(type: RentalType): void {
    this.selectedRentalType.set(type);
  }

  onHoursChange(hours: number): void {
    this.selectedHours.set(Number(hours));
  }

  onTimeChange(): void {}
  onDateChange(): void {}

  selectRoomType(room: PublicRoomTypeDto): void {
    this.selectedRoomType.set(room);
  }

  getEstimatedPrice(room: PublicRoomTypeDto): number {
    const mode = this.selectedRentalType();
    const base = Number(room.basePrice) || 300000;
    if (mode === 'Hourly') {
      const hours = this.selectedHours();
      // First 2 hours base rate, additional hours at 35%
      if (hours <= 2) return Math.round(base * 0.4);
      return Math.round(base * 0.4 + (hours - 2) * (base * 0.15));
    }
    if (mode === 'Overnight') {
      return Math.round(base * 0.7);
    }
    return base;
  }

  getPriceUnitLabel(): string {
    const mode = this.selectedRentalType();
    if (mode === 'Hourly') return `cho ${this.selectedHours()} giờ thuê`;
    if (mode === 'Overnight') return 'cho 1 đêm (21:00 - 10:00)';
    return 'cho 1 ngày / đêm';
  }

  openGallery(index: number): void {
    // Open full image in new tab or viewer
    window.open(this.galleryPhotos()[index], '_blank');
  }

  scrollToRooms(): void {
    window.scrollTo({ top: 600, behavior: 'smooth' });
  }

  proceedToHold(): void {
    const prop = this.property();
    const room = this.selectedRoomType();
    if (!prop || !room) return;

    this.router.navigate(['/booking/hold'], {
      queryParams: {
        propertySlug: prop.slug,
        roomTypeId: room.id,
        rentalType: this.selectedRentalType(),
        checkInDate: this.checkInDate(),
        checkOutDate: this.checkOutDate(),
        hours: this.selectedHours(),
        checkInTime: this.checkInTime()
      }
    });
  }

  formatDistance(meters?: number): string {
    if (!meters || meters <= 0) return 'Gần đây';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}
