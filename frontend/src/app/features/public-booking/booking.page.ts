import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import {
  PublicPropertyDto,
  PublicRoomTypeAvailabilityDto,
  CreateGuestHoldRequest,
  TouristZoneDto,
  LandmarkDto,
  PublicPropertiesFilter
} from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { parseDateParts } from '../../core/utils/date-time.util';
import { RoomGalleryService, RoomPhoto, RoomAmenityItem } from '../../core/services/room-gallery.service';
import { PhotoGalleryModalComponent, RoomDetailModalComponent, StatusBadgeComponent } from '../../shared';
import { AiConciergeWidgetComponent } from './ai-concierge-widget/ai-concierge-widget.component';
import { PopularDestinationsComponent } from './components/popular-destinations/popular-destinations.component';
import { BookingFilterBarComponent, BookingFilterCriteria, DestinationSelection } from './components/booking-filter-bar/booking-filter-bar.component';

export function getTodayVnDateString(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vnDate = new Date(utc + (7 * 3600000));
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Ảnh chụp bất biến của ngữ cảnh hiển thị ảnh tại thời điểm render.
 * Đóng băng thông tin cơ sở, thế hệ yêu cầu, loại phòng, URL chính xác và lượt thử lại.
 */
export interface RoomImageRenderContext {
  readonly propertyId: string;
  readonly generation: number;
  readonly roomTypeId: string;
  readonly url: string;
  readonly retryAttempt: number;
}

@Component({
  selector: 'app-public-booking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    AiConciergeWidgetComponent,
    PopularDestinationsComponent,
    BookingFilterBarComponent,
    PhotoGalleryModalComponent,
    RoomDetailModalComponent,
    StatusBadgeComponent
  ],
  template: `
    <div class="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      
      <!-- Top Trust Bar & Global Header -->
      <header class="border-b border-slate-200/80 sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
        <!-- Reassurance Micro-banner -->
        <div class="bg-slate-900 text-slate-200 text-[11px] font-medium py-1 px-4 sm:px-6">
          <div class="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 truncate">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span class="truncate">Hệ thống đặt phòng trực tiếp &bull; Thông tin xác thực từ cơ sở lưu trú</span>
            </div>
            <div class="hidden sm:flex items-center gap-4 text-slate-300 text-[11px] shrink-0">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span>Tạm giữ phòng 15 phút khi tạo đơn</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Main Navigation Bar -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div class="flex items-center gap-3 shrink-0">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              H
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-base sm:text-lg font-bold tracking-tight text-slate-900">Hotel Booking</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium hidden sm:block">Đặt phòng lưu trú trực tuyến</p>
            </div>
          </div>
          <nav class="flex items-center gap-2 shrink-0">
            <a routerLink="/booking/lookup" class="text-xs sm:text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 min-h-[44px]">
              <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span>Tra cứu đặt phòng</span>
            </a>
            <a routerLink="/partner-register" class="text-xs sm:text-sm font-semibold text-amber-800 hover:text-amber-900 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-all flex items-center gap-1.5 min-h-[44px]" title="Đăng ký mở khách sạn">
              <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="hidden md:inline">Mở khách sạn / Đối tác</span>
            </a>
            <a routerLink="/login" class="text-xs sm:text-sm font-semibold text-indigo-700 hover:text-indigo-800 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 transition-all flex items-center gap-1.5 min-h-[44px]" title="Đăng nhập" aria-label="Đăng nhập">
              <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              <span class="hidden sm:inline">Đăng nhập</span>
            </a>
          </nav>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full" [ngClass]="selectedRoomType() && currentQuote() ? 'pb-36 sm:pb-28' : ''">
        
        <!-- Hero Section with Unified Search Card (Deliberate Hospitality Editorial) -->
        <div class="relative bg-slate-900 rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-xl mb-8 border border-slate-800">
          <!-- Hero Title Section -->
          <div class="text-center mb-6 max-w-2xl mx-auto">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold mb-3 tracking-wide uppercase">
              <i class="pi pi-sparkles text-amber-400"></i> Nền Tảng Đặt Phòng &amp; Nghỉ Dưỡng Trực Tuyến
            </span>
            <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Khám Phá &amp; Đặt Phòng Trực Tuyến
            </h1>
            <p class="mt-2 text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
              Trải nghiệm lưu trú đẳng cấp, giá minh bạch và quy trình giữ phòng 15 phút bảo mật tức thì
            </p>
            <!-- Trust badges -->
            <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 text-[11px] text-slate-300">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-200">
                <i class="pi pi-shield text-emerald-400"></i> Giữ phòng 15p an toàn
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-200">
                <i class="pi pi-check-circle text-emerald-400"></i> Giá niêm yết chính xác
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-200">
                <i class="pi pi-clock text-indigo-400"></i> Thuê theo Giờ &amp; Đêm
              </span>
            </div>
          </div>

          <!-- Unified Agoda/Booking Floating Search Card -->
          <div class="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 p-3.5 sm:p-5 text-slate-900 w-full min-w-0 box-border" id="heroSearchCard">
            <!-- Rental Type Selection Button Group: 3 Distinct Tabs -->
            <div class="flex items-center gap-2 mb-3.5 pb-3 border-b border-slate-100 flex-wrap" role="group" aria-label="Hình thức thuê phòng">
              <button
                type="button"
                [attr.aria-pressed]="searchForm.get('rentalType')?.value === 3"
                (click)="setRentalType(3)"
                [ngClass]="searchForm.get('rentalType')?.value === 3 ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'"
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                <span>Theo ngày (Hotel/Resort)</span>
              </button>
              <button
                type="button"
                [attr.aria-pressed]="searchForm.get('rentalType')?.value === 1"
                (click)="setRentalType(1)"
                [ngClass]="searchForm.get('rentalType')?.value === 1 ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'"
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Theo giờ (Nhà nghỉ/Motel)</span>
              </button>
              <button
                type="button"
                [attr.aria-pressed]="searchForm.get('rentalType')?.value === 2"
                (click)="setRentalType(2)"
                [ngClass]="searchForm.get('rentalType')?.value === 2 ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'"
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                <span>Qua đêm</span>
              </button>
              <span class="text-xs text-slate-400 ml-auto hidden md:inline font-medium">
                Tìm cơ sở lưu trú &amp; địa danh du lịch
              </span>
            </div>

            <!-- Connected 4-Segment Grid with Shrinkable Tracks -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch w-full min-w-0 box-border">
              <!-- Segment 1: Destination / Combobox (md:col-span-4) -->
              <div class="md:col-span-4 relative bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl p-2.5 transition-all min-h-[64px] flex flex-col justify-center min-w-0">
                <label for="propertySearchInput" class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span>Địa điểm / Khách sạn</span>
                </label>
                <div class="flex items-center gap-1 min-w-0 w-full">
                  <input
                    id="propertySearchInput"
                    type="text"
                    [formControl]="propertySearchControl"
                    (focus)="openCombobox()"
                    (click)="openCombobox()"
                    (keydown)="onComboboxKeydown($event)"
                    role="combobox"
                    aria-autocomplete="list"
                    [attr.aria-expanded]="isComboboxOpen()"
                    aria-controls="property-suggestions-list"
                    [attr.aria-activedescendant]="activeSuggestionId()"
                    placeholder="Nhập tên khách sạn, địa chỉ..."
                    class="w-full min-w-0 bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-400 min-h-[32px]"
                    aria-label="Địa điểm hoặc khách sạn"
                  />
                  <button
                    *ngIf="propertySearchControl.value"
                    type="button"
                    (click)="clearPropertySearch()"
                    class="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg shrink-0 transition-colors"
                    aria-label="Xóa từ khóa tìm kiếm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                <!-- Suggestions Dropdown Overlay -->
                <div
                  *ngIf="isComboboxOpen()"
                  id="property-suggestions-list"
                  role="listbox"
                  class="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto p-2 space-y-2">
                  <!-- Loading State -->
                  <div *ngIf="isLoadingProperties()" class="p-3 text-xs text-indigo-600 flex items-center gap-2">
                    <svg class="w-4 h-4 animate-spin shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
                    <span>Đang tìm kiếm cơ sở lưu trú...</span>
                  </div>

                  <!-- Error State -->
                  <div *ngIf="propertiesError()" class="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl flex items-center justify-between gap-2" role="alert">
                    <span>{{ propertiesError() }}</span>
                    <button type="button" (click)="retryLoadProperties()" class="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-semibold text-xs min-h-[36px]">
                      Thử lại
                    </button>
                  </div>

                  <!-- Empty State -->
                  <div *ngIf="!isLoadingProperties() && !propertiesError() && filteredSuggestions().length === 0 && properties().length === 0" class="p-4 text-xs text-slate-500 text-center">
                    Không tìm thấy địa điểm hoặc cơ sở lưu trú nào phù hợp.
                  </div>

                  <!-- Group 1: Thành phố / Tỉnh -->
                  <div *ngIf="groupedSuggestions().cities.length > 0" class="space-y-1">
                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <i class="pi pi-map text-indigo-500 text-[10px]"></i>
                      <span>Thành phố / Tỉnh</span>
                    </div>
                    <div
                      *ngFor="let item of groupedSuggestions().cities"
                      (click)="selectSuggestionItem(item)"
                      class="px-3 py-2 rounded-xl hover:bg-indigo-50 text-xs font-semibold text-slate-700 hover:text-indigo-900 cursor-pointer flex items-center justify-between transition-colors">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-building text-slate-400 text-xs"></i>
                        <span>{{ item.displayName }}</span>
                      </div>
                      <span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Tỉnh/Thành</span>
                    </div>
                  </div>

                  <!-- Group 2: Khu vực du lịch -->
                  <div *ngIf="groupedSuggestions().zones.length > 0" class="space-y-1 pt-1 border-t border-slate-100">
                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <i class="pi pi-compass text-emerald-500 text-[10px]"></i>
                      <span>Khu vực du lịch</span>
                    </div>
                    <div
                      *ngFor="let item of groupedSuggestions().zones"
                      (click)="selectSuggestionItem(item)"
                      class="px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-slate-700 hover:text-emerald-900 cursor-pointer flex items-center justify-between transition-colors">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-map-marker text-emerald-500 text-xs"></i>
                        <span>{{ item.displayName }}</span>
                      </div>
                      <span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Khu du lịch</span>
                    </div>
                  </div>

                  <!-- Group 3: Địa danh nổi tiếng -->
                  <div *ngIf="groupedSuggestions().landmarks.length > 0" class="space-y-1 pt-1 border-t border-slate-100">
                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <i class="pi pi-flag text-amber-500 text-[10px]"></i>
                      <span>Địa danh nổi tiếng</span>
                    </div>
                    <div
                      *ngFor="let item of groupedSuggestions().landmarks"
                      (click)="selectSuggestionItem(item)"
                      class="px-3 py-2 rounded-xl hover:bg-amber-50 text-xs font-semibold text-slate-700 hover:text-amber-900 cursor-pointer flex items-center justify-between transition-colors">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-star text-amber-500 text-xs"></i>
                        <span>{{ item.displayName }}</span>
                      </div>
                      <span class="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Địa danh hot</span>
                    </div>
                  </div>

                  <!-- Group 4: Cơ sở lưu trú -->
                  <div *ngIf="groupedSuggestions().properties.length > 0 || properties().length > 0" class="space-y-1 pt-1 border-t border-slate-100">
                    <div class="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <i class="pi pi-home text-purple-500 text-[10px]"></i>
                      <span>Khách sạn &amp; Cơ sở lưu trú</span>
                    </div>
                    <div
                      *ngFor="let prop of properties(); let i = index"
                      [id]="'suggestion-' + i"
                      role="option"
                      [attr.aria-selected]="selectedProperty()?.id === prop.id || activeSuggestionIndex() === i"
                      (click)="selectSuggestion(prop)"
                      (mouseenter)="activeSuggestionIndex.set(i)"
                      [ngClass]="activeSuggestionIndex() === i || selectedProperty()?.id === prop.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'hover:bg-slate-50 border-transparent'"
                      class="p-2.5 rounded-xl cursor-pointer border transition-colors flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <i class="pi pi-building text-xs"></i>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-slate-900 truncate">{{ prop.name }}</div>
                        <div class="text-[10px] text-slate-500 truncate">{{ prop.address }} &bull; {{ prop.city || 'Việt Nam' }}</div>
                      </div>
                      <span *ngIf="selectedProperty()?.id === prop.id" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">Đã chọn</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Segment 2: Stay Dates Range (md:col-span-4) -->
              <div class="md:col-span-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl p-2.5 transition-all min-h-[64px] flex flex-col justify-center min-w-0" [formGroup]="searchForm">
                <!-- Daily (3) & Overnight (2) Mode -->
                <ng-container *ngIf="searchForm.get('rentalType')?.value === 2 || searchForm.get('rentalType')?.value === 3">
                  <div class="flex items-center justify-between gap-2 mb-0.5 min-w-0">
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span>Thời gian lưu trú</span>
                    </span>
                    <span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                      {{ searchForm.get('rentalType')?.value === 3 ? (nightCount() + ' ngày') : (nightCount() + ' đêm') }}
                    </span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center min-w-0 w-full">
                    <div class="min-w-0 flex flex-col">
                      <label for="checkInDateInput" class="text-[10px] font-semibold text-slate-500 leading-tight">Nhận phòng</label>
                      <input
                        id="checkInDateInput"
                        type="date"
                        formControlName="checkInDate"
                        (change)="onDateChange('checkIn')"
                        class="w-full min-w-0 bg-transparent border-0 p-0 text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 min-h-[28px]"
                        aria-label="Ngày nhận phòng"
                      />
                    </div>
                    <div class="min-w-0 flex flex-col">
                      <label for="checkOutDateInput" class="text-[10px] font-semibold text-slate-500 leading-tight">Trả phòng</label>
                      <input
                        id="checkOutDateInput"
                        type="date"
                        formControlName="checkOutDate"
                        (change)="onDateChange('checkOut')"
                        class="w-full min-w-0 bg-transparent border-0 p-0 text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 min-h-[28px]"
                        aria-label="Ngày trả phòng"
                      />
                    </div>
                  </div>
                  <div class="sr-only" role="status" aria-live="polite">{{ dateAdjustmentNotice() }}</div>
                </ng-container>

                <!-- Hourly Mode (1) -->
                <ng-container *ngIf="searchForm.get('rentalType')?.value === 1">
                  <div class="flex items-center justify-between gap-2 mb-0.5 min-w-0">
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>Thời gian thuê giờ</span>
                    </span>
                    <span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                      {{ searchForm.get('checkInHour')?.value || '14:00' }} &bull; {{ searchForm.get('hourlyDurationHours')?.value }} giờ
                    </span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 items-center min-w-0 w-full">
                    <div class="min-w-0 flex flex-col">
                      <label for="hourlyDateInput" class="text-[10px] font-semibold text-slate-500 leading-tight">Ngày</label>
                      <input
                        id="hourlyDateInput"
                        type="date"
                        formControlName="hourlyDate"
                        (change)="onSearchCriteriaChange()"
                        class="w-full min-w-0 bg-transparent border-0 p-0 text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 min-h-[28px]"
                        aria-label="Ngày thuê theo giờ"
                      />
                    </div>
                    <div class="min-w-0 flex flex-col">
                      <label for="hourlyCheckInHourSelect" class="text-[10px] font-semibold text-slate-500 leading-tight">Giờ vào</label>
                      <select
                        id="hourlyCheckInHourSelect"
                        formControlName="checkInHour"
                        (change)="onSearchCriteriaChange()"
                        class="w-full min-w-0 bg-transparent border-0 p-0 text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 min-h-[28px]"
                        aria-label="Giờ nhận phòng thuê theo giờ">
                        <option value="08:00">08:00</option>
                        <option value="10:00">10:00</option>
                        <option value="12:00">12:00</option>
                        <option value="14:00">14:00</option>
                        <option value="16:00">16:00</option>
                        <option value="18:00">18:00</option>
                        <option value="20:00">20:00</option>
                        <option value="22:00">22:00</option>
                      </select>
                    </div>
                    <div class="min-w-0 flex flex-col">
                      <label for="hourlyDurationSelect" class="text-[10px] font-semibold text-slate-500 leading-tight">Số giờ</label>
                      <select
                        id="hourlyDurationSelect"
                        formControlName="hourlyDurationHours"
                        (change)="onSearchCriteriaChange()"
                        class="w-full min-w-0 bg-transparent border-0 p-0 text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 min-h-[28px]"
                        aria-label="Thời lượng thuê theo giờ">
                        <option [value]="1">1 giờ</option>
                        <option [value]="2">2 giờ</option>
                        <option [value]="3">3 giờ</option>
                        <option [value]="4">4 giờ</option>
                        <option [value]="5">5 giờ</option>
                        <option [value]="6">6 giờ</option>
                      </select>
                    </div>
                  </div>
                </ng-container>
              </div>

              <!-- Segment 3: Guests Counter Stepper (md:col-span-2) -->
              <div class="md:col-span-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl p-2.5 transition-all min-h-[64px] flex flex-col justify-center min-w-0">
                <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  <span>Số lượng khách</span>
                </label>
                <div class="flex items-center justify-between gap-1 w-full min-w-0">
                  <button
                    type="button"
                    (click)="decrementGuests()"
                    [disabled]="(guestForm.get('numberOfGuests')?.value || 1) <= 1"
                    class="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-slate-700 transition-colors shrink-0 shadow-2xs"
                    aria-label="Giảm số lượng khách">
                    -
                  </button>
                  <span class="text-xs font-bold text-slate-900 text-center min-w-0 flex-1 truncate">
                    {{ guestForm.get('numberOfGuests')?.value || 1 }} khách
                  </span>
                  <button
                    type="button"
                    (click)="incrementGuests()"
                    [disabled]="(guestForm.get('numberOfGuests')?.value || 1) >= 10"
                    class="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-slate-700 transition-colors shrink-0 shadow-2xs"
                    aria-label="Tăng số lượng khách">
                    +
                  </button>
                </div>
              </div>

              <!-- Segment 4: CTA Action Button (md:col-span-2) -->
              <div class="md:col-span-2 min-w-0 flex items-center">
                <button
                  id="heroSearchButton"
                  type="button"
                  (click)="handleMainSearchCta()"
                  [disabled]="isLoadingProperties() || isLoadingAvailability()"
                  class="w-full min-h-[52px] h-full py-3 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-100 disabled:opacity-50 min-w-0 gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <span *ngIf="isLoadingProperties() || isLoadingAvailability()" class="flex items-center gap-2">
                    <svg class="w-4 h-4 animate-spin shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
                    <span>Đang tìm...</span>
                  </span>
                  <span *ngIf="!isLoadingProperties() && !isLoadingAvailability()" class="flex items-center gap-2">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>Tìm phòng</span>
                  </span>
                </button>
              </div>
            </div>

            <!-- Context Status Message when results filter is active -->
            <div *ngIf="!isLoadingProperties() && properties().length > 0 && propertySearchControl.value" class="mt-3 text-xs text-indigo-700 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
              <span>Đang hiển thị {{ properties().length }} cơ sở lưu trú phù hợp với từ khóa "{{ propertySearchControl.value }}".</span>
              <button type="button" (click)="clearPropertySearch()" class="text-indigo-600 hover:text-indigo-800 font-bold ml-2 underline min-h-[36px] flex items-center">
                Xem tất cả
              </button>
            </div>
          </div>
        </div>

        <!-- Popular Destinations Showcase Section -->
        <app-popular-destinations (selectDestination)="onDestinationSelected($event)"></app-popular-destinations>

        <!-- Booking Stepper Progress Tracker -->
        <div class="mb-8 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div class="flex items-center justify-between max-w-3xl mx-auto">
            <!-- Step 1 -->
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs"
                [ngClass]="selectedProperty() ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white ring-4 ring-indigo-50'">
                <i *ngIf="selectedProperty()" class="pi pi-check text-xs"></i>
                <span *ngIf="!selectedProperty()">1</span>
              </div>
              <div class="hidden sm:block">
                <div class="text-xs font-bold text-slate-800">1. Chọn cơ sở</div>
                <div class="text-[10px] text-slate-400 truncate max-w-[140px]">{{ selectedProperty() ? selectedProperty()?.name : 'Tìm khách sạn' }}</div>
              </div>
            </div>

            <div class="flex-1 h-0.5 mx-3 sm:mx-6 transition-colors" [ngClass]="selectedProperty() ? 'bg-emerald-500' : 'bg-slate-200'"></div>

            <!-- Step 2 -->
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs"
                [ngClass]="selectedRoomType() ? 'bg-emerald-600 text-white' : (selectedProperty() ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' : 'bg-slate-100 text-slate-400')">
                <i *ngIf="selectedRoomType()" class="pi pi-check text-xs"></i>
                <span *ngIf="!selectedRoomType()">2</span>
              </div>
              <div class="hidden sm:block">
                <div class="text-xs font-bold text-slate-800">2. Hạng phòng</div>
                <div class="text-[10px] text-slate-400 truncate max-w-[140px]">{{ selectedRoomType() ? selectedRoomType()?.roomTypeName : 'Chọn loại phòng' }}</div>
              </div>
            </div>

            <div class="flex-1 h-0.5 mx-3 sm:mx-6 transition-colors" [ngClass]="selectedRoomType() && currentQuote() ? 'bg-emerald-500' : 'bg-slate-200'"></div>

            <!-- Step 3 -->
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs"
                [ngClass]="currentQuote() ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' : 'bg-slate-100 text-slate-400'">
                <span>3</span>
              </div>
              <div class="hidden sm:block">
                <div class="text-xs font-bold text-slate-800">3. Báo giá &amp; Giữ phòng</div>
                <div class="text-[10px] text-slate-400">15 phút miễn phí</div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 1: Property Cards Section -->
        <section class="mb-12 sm:mb-16 scroll-mt-24" id="propertyListSection">
          <div class="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Chọn cơ sở lưu trú
                </h2>
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {{ properties().length }} cơ sở
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-500">
                Chọn cơ sở nghỉ dưỡng phù hợp để kiểm tra ngay tình trạng phòng trống và mức giá ước tính theo ngày lưu trú.
              </p>
            </div>
          </div>

          <!-- Property Type Filter Chips -->
          <div class="flex items-center gap-1.5 flex-wrap mb-5">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Loại hình:</span>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange('ALL')"
              [ngClass]="selectedPropertyType() === 'ALL' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              Tất cả ({{ properties().length }})
            </button>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange(1)"
              [ngClass]="selectedPropertyType() === 1 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              🏨 Khách sạn (Hotel)
            </button>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange(3)"
              [ngClass]="selectedPropertyType() === 3 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              🏡 Nhà nghỉ
            </button>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange(2)"
              [ngClass]="selectedPropertyType() === 2 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              ⚡ Motel
            </button>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange(4)"
              [ngClass]="selectedPropertyType() === 4 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              🌿 Homestay
            </button>
            <button
              type="button"
              (click)="onPropertyTypeFilterChange(5)"
              [ngClass]="selectedPropertyType() === 5 ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer">
              🏖️ Resort
            </button>
          </div>

          <!-- Property Cards Grid -->
          <div *ngIf="properties().length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article
              *ngFor="let prop of properties()"
              (click)="isPropertySelectable(prop) && selectProperty(prop)"
              [ngClass]="selectedProperty()?.id === prop.id ? 'border-2 border-indigo-600 ring-4 ring-indigo-50 bg-white shadow-xl -translate-y-1' : (isPropertySelectable(prop) ? 'border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5' : 'border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed')"
              class="rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between"
              role="region"
              [attr.aria-label]="'Cơ sở lưu trú: ' + prop.name">
              
              <!-- Property Visual Area with Architectural Twilight Fallback -->
              <div class="relative bg-slate-950 h-48 flex items-center justify-center overflow-hidden">
                <img
                  *ngIf="prop.imageUrl"
                  [src]="prop.imageUrl"
                  [alt]="prop.name"
                  class="w-full h-full object-cover"
                />
                <!-- SVG Architectural Twilight Fallback when ImageUrl is null/empty -->
                <svg *ngIf="!prop.imageUrl" class="w-full h-full" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient [attr.id]="'skyGrad-' + prop.id" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#0f172a"/>
                      <stop offset="50%" stop-color="#1e1b4b"/>
                      <stop offset="100%" stop-color="#312e81"/>
                    </linearGradient>
                    <linearGradient [attr.id]="'bldgGrad-' + prop.id" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#3730a3"/>
                      <stop offset="100%" stop-color="#1e1b4b"/>
                    </linearGradient>
                    <linearGradient [attr.id]="'warmWin-' + prop.id" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#fef08a"/>
                      <stop offset="100%" stop-color="#f59e0b"/>
                    </linearGradient>
                  </defs>
                  <rect width="400" height="220" [attr.fill]="'url(#skyGrad-' + prop.id + ')'"/>
                  <circle cx="45" cy="35" r="1.5" fill="#ffffff" opacity="0.6"/>
                  <circle cx="95" cy="20" r="1" fill="#ffffff" opacity="0.4"/>
                  <circle cx="160" cy="40" r="1.5" fill="#ffffff" opacity="0.7"/>
                  <circle cx="280" cy="25" r="1.2" fill="#ffffff" opacity="0.5"/>
                  <circle cx="350" cy="45" r="1.5" fill="#ffffff" opacity="0.8"/>
                  <circle cx="370" cy="20" r="1" fill="#ffffff" opacity="0.3"/>
                  <circle cx="330" cy="50" r="14" fill="#fef08a" opacity="0.25"/>
                  <circle cx="330" cy="50" r="11" fill="#fef08a" opacity="0.85"/>
                  <path d="M0 180L40 160L80 170L130 150L180 175L230 155L290 170L340 145L400 170V220H0Z" fill="#111827" opacity="0.5"/>
                  <rect x="80" y="65" width="240" height="155" rx="6" [attr.fill]="'url(#bldgGrad-' + prop.id + ')'" stroke="#4338ca" stroke-width="1.5"/>
                  <rect x="130" y="45" width="140" height="22" rx="3" fill="#4338ca" stroke="#6366f1" stroke-width="1"/>
                  <rect x="145" y="50" width="110" height="12" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.9"/>
                  <rect x="100" y="80" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.95"/>
                  <rect x="135" y="80" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.85"/>
                  <rect x="170" y="80" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.3"/>
                  <rect x="205" y="80" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.9"/>
                  <rect x="240" y="80" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.75"/>
                  <rect x="275" y="80" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.25"/>
                  <rect x="100" y="106" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.3"/>
                  <rect x="135" y="106" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.9"/>
                  <rect x="170" y="106" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.85"/>
                  <rect x="205" y="106" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.35"/>
                  <rect x="240" y="106" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.95"/>
                  <rect x="275" y="106" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.8"/>
                  <rect x="100" y="132" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.85"/>
                  <rect x="135" y="132" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.25"/>
                  <rect x="170" y="132" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.9"/>
                  <rect x="205" y="132" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.75"/>
                  <rect x="240" y="132" width="22" height="16" rx="2" fill="#c7d2fe" opacity="0.3"/>
                  <rect x="275" y="132" width="22" height="16" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.9"/>
                  <rect x="100" y="158" width="57" height="24" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.95"/>
                  <rect x="175" y="158" width="50" height="30" rx="3" fill="#ffffff" opacity="0.95"/>
                  <rect x="240" y="158" width="57" height="24" rx="2" [attr.fill]="'url(#warmWin-' + prop.id + ')'" opacity="0.95"/>
                  <polygon points="165,160 235,160 245,168 155,168" fill="#e0e7ff" opacity="0.9"/>
                  <rect x="0" y="200" width="400" height="20" fill="#090d16"/>
                  <circle cx="65" cy="195" r="4" fill="#fbbf24" opacity="0.8"/>
                  <line x1="65" y1="195" x2="65" y2="210" stroke="#475569" stroke-width="2"/>
                  <circle cx="335" cy="195" r="4" fill="#fbbf24" opacity="0.8"/>
                  <line x1="335" y1="195" x2="335" y2="210" stroke="#475569" stroke-width="2"/>
                  <text x="200" y="214" font-family="system-ui, sans-serif" font-size="9" font-weight="600" letter-spacing="1" fill="#94a3b8" text-anchor="middle">HÌNH MINH HỌA KIẾN TRÚC</text>
                </svg>

                <!-- Property Type Badge Overlay (Top Left) -->
                <div class="absolute top-3 left-3 z-10">
                  <app-status-badge
                    [status]="prop.propertyTypeName || 'Khách sạn'"
                    type="custom"
                    [customLabel]="prop.propertyTypeName || 'Khách sạn'"
                    [color]="getPropertyTypeColor(prop.propertyType)"
                  />
                </div>

                <!-- City Tag Overlay (Top Right) -->
                <div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                  {{ prop.city || 'Việt Nam' }}
                </div>

                <!-- Transparent Illustration Disclosure Badge -->
                <div *ngIf="!prop.imageUrl" class="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-slate-700/80 shadow-xs pointer-events-none">
                  Hình minh họa — chưa có ảnh cơ sở
                </div>
                <!-- Selection State Badge -->
                <div *ngIf="selectedProperty()?.id === prop.id" class="absolute bottom-3 left-3 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 ring-2 ring-emerald-200">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Đang chọn cơ sở này</span>
                </div>
              </div>

              <!-- Property Information Details -->
              <div class="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="text-lg font-extrabold text-slate-900 leading-snug hover:text-indigo-600 transition-colors">
                    {{ prop.name }}
                  </h3>
                  <p class="text-xs text-slate-500 mt-1 flex items-start gap-1.5 line-clamp-2">
                    <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>{{ prop.address }}</span>
                  </p>

                  <!-- Distance to Nearest Landmark -->
                  <div *ngIf="prop.nearbyLandmarks && prop.nearbyLandmarks.length > 0" class="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50/90 px-2.5 py-1.5 rounded-xl border border-indigo-100 font-medium">
                    <i class="pi pi-map-marker text-[11px] text-indigo-600 shrink-0"></i>
                    <span class="truncate">Cách {{ prop.nearbyLandmarks[0].name }}: <strong>{{ prop.nearbyLandmarks[0].formattedDistance }}</strong></span>
                  </div>

                  <!-- Tourist Zone Tag -->
                  <div *ngIf="prop.touristZoneName" class="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                    <i class="pi pi-compass text-[10px] text-emerald-600"></i>
                    <span>{{ prop.touristZoneName }}</span>
                  </div>

                  <!-- Supported Rental Modes Tags -->
                  <div class="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <span *ngIf="prop.allowDailyBooking" class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ☀️ Theo ngày
                    </span>
                    <span *ngIf="prop.allowOvernightBooking" class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                      🌙 Qua đêm
                    </span>
                    <span *ngIf="prop.allowHourlyBooking" class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                      ⚡ Theo giờ
                    </span>
                  </div>

                  <!-- Time & Operational Badges -->
                  <div class="grid grid-cols-2 gap-2 mt-3 bg-slate-50/80 border border-slate-100 rounded-2xl p-2.5 text-[11px] text-slate-600">
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">Nhận phòng:</span>
                      <strong class="text-slate-900">{{ prop.checkInTime }}</strong>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">Trả phòng:</span>
                      <strong class="text-slate-900">{{ prop.checkOutTime }}</strong>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">Giờ tối đa:</span>
                      <strong class="text-slate-900">{{ prop.maxHourlyHours }}h</strong>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">Khu vực:</span>
                      <strong class="text-slate-900">{{ prop.city || 'Việt Nam' }}</strong>
                    </div>
                  </div>

                  <!-- Starting Price Indicator -->
                  <div *ngIf="prop.startingPrice" class="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                    <span class="text-[10px] text-slate-400 font-medium">Giá chỉ từ</span>
                    <div class="text-right">
                      <strong class="text-base font-black text-indigo-700">{{ prop.startingPrice | number:'1.0-0' }} ₫</strong>
                      <span class="text-[10px] text-slate-500 font-medium">/{{ rentalTypeUnitLabel() }}</span>
                    </div>
                  </div>
                </div>

                <!-- Card Action Buttons (View Gallery + Select Room) -->
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    (click)="openPropertyGallery(prop); $event.stopPropagation()"
                    class="py-2.5 px-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                    title="Xem ảnh cơ sở lưu trú">
                    <i class="pi pi-images text-xs text-indigo-600"></i>
                    <span>Xem ảnh</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectProperty(prop)"
                    [disabled]="!isPropertySelectable(prop)"
                    [attr.aria-pressed]="selectedProperty()?.id === prop.id"
                    [ngClass]="selectedProperty()?.id === prop.id ? 'bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed'"
                    class="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer">
                    <span *ngIf="selectedProperty()?.id === prop.id" class="flex items-center justify-center gap-2">
                      <span>Đang chọn &bull; Xem loại phòng</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </span>
                    <span *ngIf="selectedProperty()?.id !== prop.id" class="flex items-center justify-center gap-2">
                      <span>Chọn cơ sở &amp; Xem phòng</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- STEP 2: Room Types & Availability Section -->
        <section class="mb-12 sm:mb-16 scroll-mt-24" id="roomTypesSection">
          <div id="availabilitySection" class="scroll-mt-24"></div>
          <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Danh sách loại phòng
                </h2>
                <span *ngIf="selectedProperty()" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {{ selectedProperty()?.name }}
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-500">
                Tình trạng phòng khả dụng và giá ước tính (ước lượng theo lịch lưu trú, báo giá chính thức ở Bước 3).
              </p>
            </div>
            <button
              (click)="searchAvailability()"
              [disabled]="isLoadingAvailability() || !selectedProperty()"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 shadow-2xs transition-colors disabled:opacity-50 min-h-[44px]">
              <svg *ngIf="!isLoadingAvailability()" class="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <svg *ngIf="isLoadingAvailability()" class="w-3.5 h-3.5 text-indigo-600 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
              <span *ngIf="isLoadingAvailability()">Đang kiểm tra...</span>
              <span *ngIf="!isLoadingAvailability()">Làm mới tình trạng phòng</span>
            </button>
          </div>

          <!-- Loading Availability State -->
          <div *ngIf="isLoadingAvailability()" class="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-indigo-600 shadow-xs">
            <svg class="w-6 h-6 animate-spin text-indigo-600 inline-block mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
            <span class="font-semibold">Đang kiểm tra tình trạng phòng trống từ hệ thống...</span>
          </div>

          <!-- Empty State (No property selected yet) -->
          <div *ngIf="!isLoadingAvailability() && !selectedProperty()" class="bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-6 text-center shadow-xs">
            <p class="text-xs text-slate-500 font-medium">
              Vui lòng nhấp "Chọn cơ sở này" ở Bước 1 phía trên để xem các hạng phòng khả dụng.
            </p>
          </div>

          <!-- Empty State (Property selected but no rooms available) -->
          <div *ngIf="!isLoadingAvailability() && selectedProperty() && availabilityList().length === 0" class="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <h3 class="text-sm font-bold text-slate-900 mb-1">
              Không có phòng trống cho khoảng thời gian này
            </h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Quý khách vui lòng đổi ngày nhận/trả phòng hoặc chọn cơ sở lưu trú khác.
            </p>
          </div>

          <!-- Interactive Room Filter & Sorting Bar -->
          <app-booking-filter-bar
            *ngIf="!isLoadingAvailability() && selectedProperty() && availabilityList().length > 0"
            [rentalType]="searchForm.get('rentalType')?.value"
            [propertyType]="selectedPropertyType()"
            [touristZones]="touristZones()"
            [landmarks]="landmarks()"
            [properties]="properties()"
            [priceRange]="filterCriteria().priceRange"
            [bedType]="filterCriteria().bedType"
            [activeAmenities]="filterCriteria().amenities"
            [sortBy]="filterCriteria().sortBy"
            (filterChange)="onFilterCriteriaChange($event)"
            (rentalTypeChange)="setRentalType($event)"
            (propertyTypeChange)="onPropertyTypeFilterChange($event)">
          </app-booking-filter-bar>

          <!-- Empty state when filters return 0 rooms -->
          <div *ngIf="!isLoadingAvailability() && selectedProperty() && availabilityList().length > 0 && filteredAvailabilityList().length === 0" class="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs mb-6">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <i class="pi pi-filter text-xl"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-900 mb-1">
              Không có hạng phòng nào khớp với bộ lọc đã chọn
            </h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mb-4">
              Quý khách vui lòng thử bỏ bớt điều kiện lọc mức giá hoặc tiện ích để xem các hạng phòng khác.
            </p>
            <button
              type="button"
              (click)="resetFilters()"
              class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors">
              Xóa tất cả bộ lọc
            </button>
          </div>

          <!-- Room Cards Grid (OTA Presentation with Multi-Image Gallery) -->
          <div *ngIf="!isLoadingAvailability() && filteredAvailabilityList().length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              *ngFor="let rt of filteredAvailabilityList()"
              [ngClass]="selectedRoomTypeId() === rt.roomTypeId ? 'border-2 border-indigo-600 ring-4 ring-indigo-50 bg-white shadow-xl -translate-y-1' : 'border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-lg transition-all duration-300'"
              class="rounded-3xl border overflow-hidden flex flex-col justify-between">
              
              <div class="p-5 sm:p-6">
                <!-- Room Card Multi-Photo Visual Gallery Area -->
                <div class="relative bg-slate-900 h-44 flex items-center justify-center overflow-hidden rounded-2xl mb-2.5 group cursor-pointer"
                  (click)="openRoomDetail(rt)">
                  <ng-container *ngIf="getRoomImageContext(rt) as ctx">
                    <ng-container *ngFor="let key of [getRoomImageRenderKey(rt)]; trackBy: trackByRenderKey">
                      <img
                        *ngIf="isRoomImageRenderable(ctx)"
                        [src]="getRoomPhotos(rt)[0].url || ctx.url"
                        [alt]="rt.roomTypeName"
                        (error)="onRoomImageError(ctx)"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        [attr.data-testid]="'room-img-' + rt.roomTypeId"
                        [attr.data-render-key]="key"
                      />
                    </ng-container>
                  </ng-container>

                  <!-- SVG Fallback when image is not renderable -->
                  <svg
                    *ngIf="!isRoomImageRenderable(getRoomImageContext(rt))"
                    class="w-full h-full"
                    viewBox="0 0 320 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid slice"
                    [attr.data-testid]="'room-fallback-svg-' + rt.roomTypeId">
                    <rect width="320" height="140" fill="#f8fafc"/>
                    <rect x="30" y="25" width="260" height="95" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
                    <rect x="80" y="40" width="160" height="20" rx="3" fill="#cbd5e1"/>
                    <rect x="90" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
                    <rect x="165" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
                    <rect x="95" y="48" width="55" height="15" rx="3" fill="#ffffff"/>
                    <rect x="170" y="48" width="55" height="15" rx="3" fill="#ffffff"/>
                    <rect x="52" y="60" width="28" height="40" rx="3" fill="#e2e8f0"/>
                    <circle cx="66" cy="50" r="7" fill="#fbbf24" opacity="0.85"/>
                    <rect x="240" y="60" width="28" height="40" rx="3" fill="#e2e8f0"/>
                    <circle cx="254" cy="50" r="7" fill="#fbbf24" opacity="0.85"/>
                    <text x="160" y="125" font-family="system-ui, sans-serif" font-size="8.5" font-weight="600" letter-spacing="1" fill="#94a3b8" text-anchor="middle">HÌNH MINH HỌA HẠNG PHÒNG</text>
                  </svg>

                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none"></div>

                  <!-- Category Tag on Top-Left -->
                  <div class="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-indigo-300 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-slate-700/60 shadow-xs">
                    {{ getRoomPhotos(rt)[0].category }}
                  </div>

                  <!-- Lightbox Trigger Button on Bottom-Right -->
                  <button
                    type="button"
                    (click)="openRoomGallery(rt, 0); $event.stopPropagation()"
                    class="absolute bottom-2.5 right-2.5 bg-slate-900/85 hover:bg-indigo-600 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700/70 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                    [attr.aria-label]="'Xem bộ sưu tập ' + getRoomPhotos(rt).length + ' ảnh'">
                    <i class="pi pi-images text-xs"></i>
                    <span>{{ getRoomPhotos(rt).length }} ảnh</span>
                  </button>

                  <!-- Illustration Fallback Badge -->
                  <div
                    *ngIf="!isRoomImageRenderable(getRoomImageContext(rt))"
                    class="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-700/70 shadow-2xs pointer-events-none"
                    [attr.data-testid]="'room-fallback-badge-' + rt.roomTypeId">
                    Bố trí phòng mẫu
                  </div>

                  <!-- Retry Button if error -->
                  <button
                    *ngIf="canRetryRoomImage(rt)"
                    type="button"
                    (click)="retryRoomImage(rt); $event.stopPropagation()"
                    class="absolute top-2.5 right-2.5 bg-white/90 hover:bg-white text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200 shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                    [attr.data-testid]="'room-image-retry-btn-' + rt.roomTypeId">
                    <svg class="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span>Thử lại</span>
                  </button>
                </div>

                <!-- 3 Mini Preview Thumbnails Strip -->
                <div class="grid grid-cols-3 gap-1.5 mb-3.5">
                  <button
                    *ngFor="let photo of getRoomPhotos(rt).slice(1, 4); let pIdx = index"
                    type="button"
                    (click)="openRoomGallery(rt, pIdx + 1); $event.stopPropagation()"
                    class="relative h-12 rounded-xl overflow-hidden border border-slate-200 group focus:outline-none cursor-pointer">
                    <img [src]="photo.url" [alt]="photo.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    <div class="absolute inset-0 bg-slate-950/25 group-hover:bg-transparent transition-colors"></div>
                    <span class="absolute bottom-0.5 left-1 text-[8px] font-bold text-white drop-shadow-sm truncate max-w-[92%]">{{ photo.category }}</span>
                  </button>
                </div>

                <!-- Room Header Title & Availability Badge -->
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h3 class="text-base font-extrabold text-slate-900 leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
                    (click)="openRoomDetail(rt)">
                    {{ rt.roomTypeName }}
                  </h3>
                  <span
                    [ngClass]="rt.isAvailable && rt.availableRooms > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                    class="px-2.5 py-1 text-[11px] font-bold rounded-full border shrink-0 flex items-center gap-1.5">
                    <span *ngIf="rt.isAvailable && rt.availableRooms > 0" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{{ rt.isAvailable && rt.availableRooms > 0 ? 'Còn ' + rt.availableRooms + ' phòng' : 'Hết phòng' }}</span>
                  </span>
                </div>
                <p *ngIf="rt.description" class="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{{ rt.description }}</p>

                <!-- Room Specifications Fact Box -->
                <div class="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    <span class="text-slate-800 font-bold truncate">{{ rt.maxOccupancy }} khách</span>
                  </div>
                  <div class="flex items-center gap-1.5 min-w-0">
                    <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10m0-5h18m0-5v10m-14-6h6a2 2 0 002-2V7H5v2a2 2 0 002 2z"/></svg>
                    <span class="text-slate-800 font-semibold truncate">{{ rt.bedType || 'Giường King' }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 min-w-0">
                    <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                    <span class="text-slate-800 font-semibold truncate">{{ rt.squareMeters ? rt.squareMeters + ' m²' : '32 m²' }}</span>
                  </div>
                </div>

                <!-- Amenity Badges Preview -->
                <div class="flex items-center gap-1.5 flex-wrap mb-3.5 text-[11px]">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                    <i class="pi pi-wifi text-[9px]"></i> Wifi 6
                  </span>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                    <i class="pi pi-desktop text-[9px]"></i> Smart TV
                  </span>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                    <i class="pi pi-coffee text-[9px]"></i> Nước &amp; Cà phê
                  </span>
                </div>

                <!-- Price Preview -->
                <div class="border-t border-slate-100 pt-3 flex items-baseline justify-between">
                  <div>
                    <span class="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Giá ước tính:</span>
                    <span class="text-[11px] text-slate-500">Theo lịch lưu trú</span>
                  </div>
                  <div class="text-right">
                    <span class="text-xl font-black text-indigo-600">{{ rt.estimatedPrice | number:'1.0-0' }} ₫</span>
                  </div>
                </div>
              </div>

              <!-- Dual Action Buttons: Chi tiết phòng & Chọn nhận báo giá -->
              <div class="p-5 sm:p-6 pt-0 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  (click)="openRoomDetail(rt)"
                  class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 flex items-center justify-center gap-1.5 min-h-[44px]">
                  <i class="pi pi-info-circle text-xs"></i>
                  <span>Chi tiết phòng</span>
                </button>
                <button
                  type="button"
                  (click)="selectRoomType(rt)"
                  [disabled]="!rt.isAvailable || rt.availableRooms === 0"
                  [ngClass]="selectedRoomTypeId() === rt.roomTypeId ? 'bg-indigo-700 text-white ring-2 ring-indigo-400 shadow-md' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'"
                  class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-1">
                  <span *ngIf="selectedRoomTypeId() === rt.roomTypeId" class="flex items-center gap-1">
                    <i class="pi pi-check text-xs"></i>
                    <span>Đã chọn</span>
                  </span>
                  <span *ngIf="selectedRoomTypeId() !== rt.roomTypeId">
                    {{ rt.isAvailable ? 'Chọn & Báo Giá' : 'Hết phòng' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- STEP 3: Authoritative Quote & Hold Reservation Form Section -->
        <section *ngIf="selectedRoomType()" class="mt-12 bg-white rounded-3xl border border-indigo-100 shadow-2xl p-6 sm:p-8 lg:p-10 scroll-mt-24" id="quoteSection">
          <div class="border-b border-slate-100 pb-6 mb-6">
            <span class="px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Bước 3: Xác nhận &amp; Giữ phòng
            </span>
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              Báo giá chính thức &amp; Khóa giữ phòng 15 phút
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              Phòng vật lý sẽ được hệ thống khóa hàng độc quyền trong 15 phút ngay khi gửi yêu cầu.
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <!-- Left Column: Authoritative Quote Breakdown (from POST /api/public/quotes) -->
            <div class="bg-slate-50/80 rounded-3xl p-6 sm:p-7 border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 class="text-base font-extrabold text-slate-900 mb-4 flex items-center justify-between">
                  <span>Chi tiết báo giá chính thức</span>
                  <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60">Báo giá chính thức</span>
                </h3>

                <div *ngIf="isLoadingQuote()" class="py-8 text-center text-sm text-indigo-600">
                  <svg class="w-5 h-5 animate-spin text-indigo-600 inline-block mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
                  <span class="font-semibold">Đang tính toán báo giá theo bảng giá và chính sách phụ thu...</span>
                </div>

                <div *ngIf="!isLoadingQuote() && currentQuote()" class="space-y-4">
                  <div class="space-y-2 bg-white p-4 rounded-2xl border border-slate-100">
                    <div *ngFor="let item of currentQuote()?.breakdown" class="flex justify-between text-xs sm:text-sm py-1.5 border-b border-slate-100 last:border-0">
                      <span class="text-slate-600 font-medium">{{ item.description }}</span>
                      <strong class="text-slate-900 font-bold">{{ item.amount | number:'1.0-0' }} ₫</strong>
                    </div>
                  </div>

                  <div class="border-t border-slate-200 pt-4 space-y-3">
                    <!-- Coupon Applied Line Item -->
                    <div *ngIf="appliedDiscount() > 0" class="flex justify-between items-center text-xs sm:text-sm py-2 px-3 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                      <span class="flex items-center gap-1.5">
                        <i class="pi pi-tag text-emerald-600"></i>
                        <span>Ưu đãi áp dụng ({{ appliedCouponCode() }}):</span>
                      </span>
                      <span>-{{ appliedDiscount() | number:'1.0-0' }} ₫</span>
                    </div>

                    <div class="flex justify-between items-baseline text-base sm:text-lg font-black">
                      <span class="text-slate-900">Tổng thanh toán:</span>
                      <div class="text-right">
                        <span *ngIf="appliedDiscount() > 0" class="line-through text-slate-400 text-sm font-semibold mr-2 block sm:inline">
                          {{ currentQuote()?.totalAmount | number:'1.0-0' }} ₫
                        </span>
                        <span class="text-indigo-600 text-xl sm:text-2xl font-black">
                          {{ effectiveTotalAmount() | number:'1.0-0' }} ₫
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-xs font-semibold text-indigo-950 bg-indigo-50/80 rounded-2xl p-3.5 border border-indigo-200/80">
                      <span class="flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span>Tiền đặt cọc:</span>
                      </span>
                      <span class="text-indigo-700 font-bold">Xác định theo chính sách cơ sở khi giữ phòng</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-[11px] text-slate-500 italic mt-5 pt-3 border-t border-slate-200 leading-relaxed">
                * Tiền đặt cọc được xác định theo quy định của cơ sở lưu trú sau khi tạo yêu cầu giữ phòng. Số tiền còn lại thanh toán tại quầy lễ tân khi nhận phòng.
              </div>
            </div>

            <!-- Right Column: Guest Information & Hold Form -->
            <div class="bg-white rounded-3xl p-0 sm:p-2">
              <form [formGroup]="guestForm" (ngSubmit)="submitHold()">
                <div class="space-y-4">
                  <div>
                    <label for="guestNameInput" class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Họ và tên khách hàng <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="guestNameInput"
                      type="text"
                      formControlName="guestName"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      class="w-full rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-3 px-4 min-h-[44px]"
                      aria-label="Họ và tên khách hàng"
                    />
                    <p *ngIf="guestForm.get('guestName')?.touched && guestForm.get('guestName')?.invalid" class="text-xs text-rose-500 mt-1 font-semibold">
                      Vui lòng nhập họ và tên khách hàng.
                    </p>
                  </div>

                  <div>
                    <label for="guestEmailInput" class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email nhận mã đặt phòng <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="guestEmailInput"
                      type="email"
                      formControlName="guestEmail"
                      placeholder="Ví dụ: guest@example.com"
                      class="w-full rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-3 px-4 min-h-[44px]"
                      aria-label="Địa chỉ email nhận mã đặt phòng"
                    />
                    <p *ngIf="guestForm.get('guestEmail')?.touched && guestForm.get('guestEmail')?.invalid" class="text-xs text-rose-500 mt-1 font-semibold">
                      Vui lòng nhập địa chỉ email hợp lệ.
                    </p>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label for="guestPhoneInput" class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                        Số điện thoại
                      </label>
                      <input
                        id="guestPhoneInput"
                        type="tel"
                        formControlName="guestPhone"
                        placeholder="Ví dụ: 0901234567"
                        class="w-full rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-3 px-4 min-h-[44px]"
                        aria-label="Số điện thoại"
                      />
                    </div>
                    <div>
                      <label for="numberOfGuestsInput" class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                        Số lượng khách
                      </label>
                      <input
                        id="numberOfGuestsInput"
                        type="number"
                        formControlName="numberOfGuests"
                        min="1"
                        max="10"
                        class="w-full rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-3 px-4 min-h-[44px]"
                        aria-label="Số lượng khách"
                      />
                    </div>
                  </div>

                  <!-- Special Requests -->
                  <div>
                    <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Yêu cầu đặc biệt (Không bắt buộc)
                    </label>
                    <div class="flex items-center gap-1.5 flex-wrap mb-2 text-xs">
                      <button
                        *ngFor="let req of commonSpecialRequests"
                        type="button"
                        (click)="toggleSpecialRequest(req)"
                        [ngClass]="isSpecialRequestSelected(req) ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
                        class="px-2.5 py-1 rounded-lg transition-colors">
                        {{ req }}
                      </button>
                    </div>
                    <textarea
                      formControlName="specialRequests"
                      rows="2"
                      placeholder="Ví dụ: Cần phòng tầng cao, giường đôi lớn, hỗ trợ nhận phòng sớm..."
                      class="w-full rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-xs py-2 px-3.5"
                      aria-label="Yêu cầu đặc biệt"></textarea>
                  </div>

                  <!-- Coupon / Promo Code Input -->
                  <div>
                    <label for="couponCodeInput" class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mã ưu đãi / Khuyến mãi
                    </label>
                    <div class="flex items-center gap-2">
                      <div class="relative flex-1">
                        <input
                          id="couponCodeInput"
                          type="text"
                          [formControl]="couponCodeControl"
                          placeholder="Nhập mã (VD: LUXURY2026, HOTELSAAS)"
                          class="w-full uppercase rounded-2xl border-slate-300 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-xs py-2.5 px-3.5 min-h-[42px]"
                          aria-label="Mã ưu đãi"
                        />
                        <button
                          *ngIf="appliedDiscount() > 0"
                          type="button"
                          (click)="removeCoupon()"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          aria-label="Hủy mã ưu đãi">
                          <i class="pi pi-times"></i>
                        </button>
                      </div>
                      <button
                        type="button"
                        (click)="applyCoupon()"
                        [disabled]="!couponCodeControl.value || appliedDiscount() > 0"
                        class="px-4 py-2.5 bg-slate-900 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-40 min-h-[42px]">
                        Áp dụng
                      </button>
                    </div>
                    <p *ngIf="couponMessage()" [ngClass]="appliedDiscount() > 0 ? 'text-emerald-600' : 'text-rose-500'" class="text-[11px] font-semibold mt-1">
                      {{ couponMessage() }}
                    </p>
                  </div>

                  <div class="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
                    <svg class="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div class="leading-relaxed"><strong>Thời gian giữ phòng 15 phút:</strong> Sau khi nhấn xác nhận, phòng sẽ được tạm giữ cho quý khách trong 15 phút để hoàn tất thủ tục thanh toán tiền cọc.</div>
                  </div>

                  <button
                    type="submit"
                    id="confirmHoldButton"
                    [disabled]="isSubmittingHold() || guestForm.invalid || !currentQuote()"
                    class="w-full py-4 px-6 rounded-2xl text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] flex items-center justify-center gap-2">
                    <span *ngIf="isSubmittingHold()">Đang tạo mã giữ phòng...</span>
                    <span *ngIf="!isSubmittingHold()" class="flex items-center gap-2">
                      <span>Xác nhận giữ phòng 15 phút</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

      </main>

      <!-- Sticky Bottom Summary Bar (Active when Quote is ready) -->
      <aside *ngIf="selectedRoomType() && currentQuote()" id="stickySummaryBar" class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl py-2.5 sm:py-3 px-4 sm:px-8">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <!-- Left info group: Responsive row on mobile with room info & mobile total -->
          <div class="flex items-center justify-between sm:justify-start gap-3 min-w-0 flex-1">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-sm sm:text-base shrink-0" aria-hidden="true">
                <svg class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10m0-5h18m0-5v10m-14-6h6a2 2 0 002-2V7H5v2a2 2 0 002 2z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {{ selectedRoomType()?.roomTypeName }} &bull; {{ selectedProperty()?.name }}
                </div>
                <div class="text-[11px] text-slate-500 truncate hidden sm:block">
                  Báo giá chính thức &bull; Khóa giữ phòng 15 phút
                </div>
              </div>
            </div>
            <!-- Mobile-only inline total amount -->
            <div class="sm:hidden text-right shrink-0">
              <span class="text-[10px] text-slate-400 block font-bold leading-none uppercase">Tổng:</span>
              <strong class="text-xs font-bold text-indigo-600 leading-tight block">{{ effectiveTotalAmount() | number:'1.0-0' }} ₫</strong>
            </div>
          </div>

          <!-- Right CTA button group: Desktop price block + Full-width mobile CTA button -->
          <div class="flex items-center gap-4 shrink-0 w-full sm:w-auto">
            <div class="text-right hidden sm:block">
              <span class="text-[10px] text-slate-400 block font-bold uppercase">Tổng thanh toán:</span>
              <strong class="text-base sm:text-lg text-indigo-600 font-extrabold">{{ effectiveTotalAmount() | number:'1.0-0' }} ₫</strong>
            </div>
            <button
              type="button"
              id="stickyBottomCtaButton"
              (click)="scrollToQuoteSection()"
              class="w-full sm:w-auto px-4 py-2.5 sm:px-6 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 min-h-[44px]">
              <span>Điền thông tin & Giữ phòng</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Footer -->
      <footer class="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Hotel Booking. Hệ thống quản lý và đặt phòng lưu trú trực tuyến.</p>
          <div class="flex items-center gap-4 text-slate-400">
            <span>Bảo mật thông tin đặt phòng</span>
            <span>&bull;</span>
            <span>Điều khoản dịch vụ</span>
            <span>&bull;</span>
            <span>Chính sách lưu trú</span>
          </div>
        </div>
      </footer>

      <!-- Photo Gallery Lightbox Modal -->
      <app-photo-gallery-modal
        [isOpen]="isGalleryModalOpen()"
        [title]="galleryModalTitle()"
        [photos]="galleryModalPhotos()"
        [activeIndex]="galleryActiveIndex()"
        (close)="isGalleryModalOpen.set(false)">
      </app-photo-gallery-modal>

      <!-- Room Detail Modal -->
      <app-room-detail-modal
        [isOpen]="isDetailModalOpen()"
        [roomType]="selectedDetailRoomType()"
        [propertyName]="selectedProperty()?.name || ''"
        [photos]="selectedDetailPhotos()"
        [amenities]="selectedDetailAmenities()"
        (close)="isDetailModalOpen.set(false)"
        (select)="selectRoomType($event)"
        (viewGallery)="openRoomGallery(selectedDetailRoomType()!, $event)">
      </app-room-detail-modal>

      <!-- AI Concierge 24/7 Floating Assistant -->
      <app-ai-concierge-widget [propertySlug]="selectedProperty()?.slug"></app-ai-concierge-widget>
    </div>
  `
})
export class BookingPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly roomGalleryService = inject(RoomGalleryService);

  properties = signal<PublicPropertyDto[]>([]);
  availabilityList = signal<PublicRoomTypeAvailabilityDto[]>([]);
  selectedProperty = signal<PublicPropertyDto | null>(null);
  selectedRoomTypeId = signal<string | null>(null);
  selectedRoomType = signal<PublicRoomTypeAvailabilityDto | null>(null);
  currentQuote = signal<QuoteDto | null>(null);

  // Bộ lọc tìm kiếm & sắp xếp phòng
  filterCriteria = signal<BookingFilterCriteria>({
    rentalType: 3,
    propertyType: 'ALL',
    priceRange: 'ALL',
    bedType: 'ALL',
    amenities: [],
    sortBy: 'POPULAR'
  });

  // Danh sách phòng đã áp dụng bộ lọc và sắp xếp
  filteredAvailabilityList = computed<PublicRoomTypeAvailabilityDto[]>(() => {
    let list = [...this.availabilityList()];
    const criteria = this.filterCriteria();

    // 1. Lọc theo khoảng giá
    if (criteria.priceRange === 'UNDER_800K') {
      list = list.filter(r => r.estimatedPrice < 800000);
    } else if (criteria.priceRange === '800K_1500K') {
      list = list.filter(r => r.estimatedPrice >= 800000 && r.estimatedPrice <= 1500000);
    } else if (criteria.priceRange === '1500K_3000K') {
      list = list.filter(r => r.estimatedPrice > 1500000 && r.estimatedPrice <= 3000000);
    } else if (criteria.priceRange === 'ABOVE_3000K') {
      list = list.filter(r => r.estimatedPrice > 3000000);
    }

    // 2. Lọc theo loại giường
    if (criteria.bedType !== 'ALL') {
      list = list.filter(r => {
        const bed = (r.bedType || '').toUpperCase();
        if (criteria.bedType === 'SINGLE') return bed.includes('SINGLE') || bed.includes('ĐƠN');
        if (criteria.bedType === 'DOUBLE') return bed.includes('DOUBLE') || bed.includes('KING') || bed.includes('QUEEN') || bed.includes('ĐÔI');
        if (criteria.bedType === 'TWIN') return bed.includes('TWIN') || bed.includes('2 GIƯỜNG');
        if (criteria.bedType === 'FAMILY') return bed.includes('FAMILY') || bed.includes('GIA ĐÌNH') || r.maxOccupancy >= 3;
        return true;
      });
    }

    // 3. Lọc theo tiện ích chọn lọc
    if (criteria.amenities.length > 0) {
      list = list.filter(r => {
        const amenities = this.roomGalleryService.getRoomAmenities(r.roomTypeName);
        const names = amenities.map(a => a.name.toLowerCase());
        return criteria.amenities.every(code => {
          if (code === 'BATHTUB') return names.some(n => n.includes('bồn tắm'));
          if (code === 'BALCONY') return names.some(n => n.includes('ban công'));
          if (code === 'BREAKFAST') return names.some(n => n.includes('trà') || n.includes('cà phê') || n.includes('nước'));
          if (code === 'KING_BED') return (r.bedType || '').toLowerCase().includes('king') || (r.bedType || '').toLowerCase().includes('đôi');
          return true;
        });
      });
    }

    // 4. Sắp xếp
    if (criteria.sortBy === 'PRICE_ASC') {
      list.sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    } else if (criteria.sortBy === 'PRICE_DESC') {
      list.sort((a, b) => b.estimatedPrice - a.estimatedPrice);
    } else if (criteria.sortBy === 'CAPACITY_DESC') {
      list.sort((a, b) => b.maxOccupancy - a.maxOccupancy);
    }

    return list;
  });

  // Modal Lightbox Bộ sưu tập ảnh
  isGalleryModalOpen = signal<boolean>(false);
  galleryModalTitle = signal<string>('');
  galleryModalPhotos = signal<RoomPhoto[]>([]);
  galleryActiveIndex = signal<number>(0);

  // Modal Chi tiết phòng
  isDetailModalOpen = signal<boolean>(false);
  selectedDetailRoomType = signal<PublicRoomTypeAvailabilityDto | null>(null);
  selectedDetailPhotos = signal<RoomPhoto[]>([]);
  selectedDetailAmenities = signal<RoomAmenityItem[]>([]);

  // Mã giảm giá / Coupon Voucher
  couponCodeControl = new FormControl<string>('');
  appliedCouponCode = signal<string>('');
  appliedDiscount = signal<number>(0);
  couponMessage = signal<string>('');

  // Yêu cầu đặc biệt
  readonly commonSpecialRequests: string[] = [
    'Phòng tầng cao',
    'Phòng yên tĩnh',
    'Không hút thuốc',
    'Nhận phòng sớm',
    'Giường đôi lớn',
    'Gần thang máy'
  ];
  selectedSpecialRequests = signal<string[]>([]);

  // Tổng thanh toán sau khi trừ khuyến mãi
  effectiveTotalAmount = computed<number>(() => {
    const quote = this.currentQuote();
    if (!quote) return 0;
    return Math.max(0, quote.totalAmount - this.appliedDiscount());
  });

  // Quản lý khóa ảnh lỗi: key = `${propertyId}:${roomTypeId}:${url}`
  failedImageKeys = signal<Set<string>>(new Set<string>());
  private itemContextMap = new Map<PublicRoomTypeAvailabilityDto, RoomImageRenderContext>();

  get currentAvailabilityRequestId(): number {
    return this.availabilityRequestId;
  }

  isComboboxOpen = signal<boolean>(false);
  activeSuggestionIndex = signal<number>(-1);
  activeSuggestionId = computed<string | undefined>(() => {
    const idx = this.activeSuggestionIndex();
    const props = this.properties();
    return (this.isComboboxOpen() && idx >= 0 && idx < props.length) ? `suggestion-${idx}` : undefined;
  });
  dateAdjustmentNotice = signal<string>('');
  nightCount = computed<number>(() => {
    const inDate = this.searchForm?.get('checkInDate')?.value;
    const outDate = this.searchForm?.get('checkOutDate')?.value;
    if (!inDate || !outDate) return 1;
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    return diffDays > 0 ? diffDays : 1;
  });

  propertySearchControl = new FormControl<string>('');
  isLoadingProperties = signal<boolean>(false);
  propertiesError = signal<string | null>(null);
  private propertySearchRequestId = 0;
  private availabilityRequestId = 0;
  private quoteRequestId = 0;
  private searchSubscription?: Subscription;
  private searchDebounceTimer: any = null;
  private lastExecutedSearchQuery?: string;
  private propertiesSub?: Subscription;
  private availabilitySub?: Subscription;
  private quoteSub?: Subscription;
  private holdSub?: Subscription;

  isLoadingAvailability = signal<boolean>(false);
  isLoadingQuote = signal<boolean>(false);
  isSubmittingHold = signal<boolean>(false);

  touristZones = signal<TouristZoneDto[]>([]);
  landmarks = signal<LandmarkDto[]>([]);
  selectedPropertyType = signal<number | 'ALL'>('ALL');
  selectedTouristZoneSlug = signal<string | undefined>(undefined);
  selectedLandmarkSlug = signal<string | undefined>(undefined);

  searchForm: FormGroup = this.fb.group({
    propertySlug: ['', Validators.required],
    rentalType: [3, Validators.required],
    checkInDate: [getTodayVnDateString(), Validators.required],
    checkOutDate: [addDaysToDateString(getTodayVnDateString(), 1), Validators.required],
    hourlyDate: [getTodayVnDateString(), Validators.required],
    checkInHour: ['14:00', Validators.required],
    hourlyDurationHours: [2, Validators.required]
  });

  rentalTypeUnitLabel = computed<string>(() => {
    const rt = this.searchForm?.get('rentalType')?.value;
    if (rt === 1) return 'giờ';
    if (rt === 2) return 'đêm';
    return 'ngày';
  });

  allDestinationsList = computed<DestinationSelection[]>(() => {
    const list: DestinationSelection[] = [];

    // Distinct Cities
    const cities = new Set<string>();
    this.touristZones().forEach(z => {
      if (z.provinceName) cities.add(z.provinceName);
    });
    this.properties().forEach(p => {
      if (p.city) cities.add(p.city);
    });
    cities.forEach(c => {
      list.push({ category: 'city', displayName: c, searchTerm: c });
    });

    // Tourist Zones
    this.touristZones().forEach(z => {
      list.push({ category: 'touristZone', displayName: `${z.name} (${z.provinceName})`, searchTerm: z.name, slug: z.slug });
    });

    // Landmarks
    this.landmarks().forEach(lm => {
      list.push({ category: 'landmark', displayName: lm.name, searchTerm: lm.name, slug: lm.slug });
    });

    // Properties
    this.properties().forEach(p => {
      list.push({ category: 'property', displayName: `${p.name} - ${p.address}`, searchTerm: p.name, slug: p.slug });
    });

    return list;
  });

  filteredSuggestions = computed<DestinationSelection[]>(() => {
    const kw = (this.propertySearchControl.value || '').trim().toLowerCase();
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

  selectSuggestionItem(item: DestinationSelection): void {
    this.propertySearchControl.setValue(item.searchTerm);
    this.isComboboxOpen.set(false);
    if (item.category === 'touristZone') {
      this.selectedTouristZoneSlug.set(item.slug);
      this.selectedLandmarkSlug.set(undefined);
    } else if (item.category === 'landmark') {
      this.selectedLandmarkSlug.set(item.slug);
      this.selectedTouristZoneSlug.set(undefined);
    } else if (item.category === 'property') {
      const match = this.properties().find(p => p.slug === item.slug);
      if (match) {
        this.selectSuggestion(match);
        return;
      }
    } else {
      this.selectedTouristZoneSlug.set(undefined);
      this.selectedLandmarkSlug.set(undefined);
    }
    this.loadProperties(item.searchTerm);
  }

  getPropertyTypeColor(type?: number): 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' {
    switch (type) {
      case 1: return 'blue';
      case 2: return 'amber';
      case 3: return 'rose';
      case 4: return 'emerald';
      case 5: return 'purple';
      default: return 'slate';
    }
  }

  onPropertyTypeFilterChange(type: number | 'ALL'): void {
    this.selectedPropertyType.set(type);
    const val = this.propertySearchControl.value?.trim() || undefined;
    this.loadProperties(val);
  }

  openPropertyGallery(prop: PublicPropertyDto): void {
    const photos: RoomPhoto[] = [
      {
        url: prop.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        title: prop.name,
        category: 'Không gian'
      },
      {
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        title: 'Không gian phòng nghỉ sạch sẽ tiêu chuẩn',
        category: 'Tiện nghi'
      },
      {
        url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
        title: 'Sảnh đón tiếp & Cảnh quan',
        category: 'Không gian'
      }
    ];
    this.galleryModalTitle.set(`${prop.name} — Thư viện ảnh`);
    this.galleryModalPhotos.set(photos);
    this.galleryActiveIndex.set(0);
    this.isGalleryModalOpen.set(true);
  }

  loadTouristZonesAndLandmarks(): void {
    this.publicBookingService.getTouristZones().subscribe({
      next: zones => this.touristZones.set(zones),
      error: () => {}
    });
    this.publicBookingService.getLandmarks().subscribe({
      next: lms => this.landmarks.set(lms),
      error: () => {}
    });
  }

  guestForm: FormGroup = this.fb.group({
    guestName: ['', Validators.required],
    guestEmail: ['', [Validators.required, Validators.email]],
    guestPhone: [''],
    numberOfGuests: [1, [Validators.required, Validators.min(1)]],
    specialRequests: ['']
  });

  cancelPendingSearchDebounce(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  ngOnInit(): void {
    this.loadProperties();
    this.loadTouristZonesAndLandmarks();

    this.searchSubscription = this.propertySearchControl.valueChanges.subscribe(val => {
      this.cancelPendingSearchDebounce();
      this.isComboboxOpen.set(true);
      this.activeSuggestionIndex.set(-1);
      this.properties.set([]);
      this.isLoadingProperties.set(true);
      this.propertiesError.set(null);
      this.propertySearchRequestId++;
      this.propertiesSub?.unsubscribe();

      if (this.selectedProperty() && this.selectedProperty()?.name !== val?.trim()) {
        this.resetSelectionAndAvailability();
        this.searchForm.patchValue({ propertySlug: '' }, { emitEvent: false });
        this.selectedProperty.set(null);
      }

      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        const query = val?.trim() || undefined;
        this.loadProperties(query);
      }, 300);
    });
  }

  ngOnDestroy(): void {
    this.cancelPendingSearchDebounce();
    this.searchSubscription?.unsubscribe();
    this.propertiesSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    this.quoteSub?.unsubscribe();
    this.holdSub?.unsubscribe();
  }

  private resetSelectionAndAvailability(): void {
    this.selectedRoomTypeId.set(null);
    this.selectedRoomType.set(null);
    this.currentQuote.set(null);
    this.availabilityList.set([]);
    this.isLoadingAvailability.set(false);
    this.isLoadingQuote.set(false);
    this.availabilityRequestId++; // Invalidate pending availability requests
    this.quoteRequestId++;        // Invalidate pending quote requests
    this.availabilitySub?.unsubscribe();
    this.quoteSub?.unsubscribe();
    this.itemContextMap.clear();
    this.failedImageKeys.set(new Set<string>());
    this.appliedDiscount.set(0);
    this.appliedCouponCode.set('');
    this.couponMessage.set('');
    this.couponCodeControl.setValue('', { emitEvent: false });
    this.selectedSpecialRequests.set([]);
  }

  // =========================================================================
  // DESTINATIONS, FILTERS, GALLERY & ROOM DETAILS
  // =========================================================================

  onFilterCriteriaChange(criteria: BookingFilterCriteria): void {
    this.filterCriteria.set(criteria);
  }

  resetFilters(): void {
    this.filterCriteria.set({
      rentalType: this.searchForm?.get('rentalType')?.value || 3,
      propertyType: 'ALL',
      priceRange: 'ALL',
      bedType: 'ALL',
      amenities: [],
      sortBy: 'POPULAR'
    });
  }

  onDestinationSelected(destTerm: string): void {
    this.propertySearchControl.setValue(destTerm);
    this.closeCombobox();
    this.loadProperties(destTerm);
    if (typeof document !== 'undefined') {
      const el = document.getElementById('propertyListSection');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  getRoomPhotos(rt: PublicRoomTypeAvailabilityDto): RoomPhoto[] {
    return this.roomGalleryService.getRoomGallery(rt.roomTypeName, rt.imageUrl);
  }

  getRoomAmenities(rt: PublicRoomTypeAvailabilityDto): RoomAmenityItem[] {
    return this.roomGalleryService.getRoomAmenities(rt.roomTypeName);
  }

  openRoomGallery(rt: PublicRoomTypeAvailabilityDto, startIndex = 0): void {
    const photos = this.getRoomPhotos(rt);
    this.galleryModalTitle.set(`${rt.roomTypeName} — ${this.selectedProperty()?.name || 'Khách sạn'}`);
    this.galleryModalPhotos.set(photos);
    this.galleryActiveIndex.set(startIndex);
    this.isGalleryModalOpen.set(true);
  }

  openRoomDetail(rt: PublicRoomTypeAvailabilityDto): void {
    this.selectedDetailRoomType.set(rt);
    this.selectedDetailPhotos.set(this.getRoomPhotos(rt));
    this.selectedDetailAmenities.set(this.getRoomAmenities(rt));
    this.isDetailModalOpen.set(true);
  }

  toggleSpecialRequest(req: string): void {
    const current = this.selectedSpecialRequests();
    let updated: string[];
    if (current.includes(req)) {
      updated = current.filter(r => r !== req);
    } else {
      updated = [...current, req];
    }
    this.selectedSpecialRequests.set(updated);

    this.guestForm.patchValue({
      specialRequests: updated.join(', ')
    });
  }

  isSpecialRequestSelected(req: string): boolean {
    return this.selectedSpecialRequests().includes(req);
  }

  applyCoupon(): void {
    const raw = this.couponCodeControl.value?.trim().toUpperCase();
    if (!raw) return;

    const quote = this.currentQuote();
    if (!quote) {
      this.couponMessage.set('Vui lòng chọn loại phòng để nhận báo giá trước khi áp mã.');
      return;
    }

    if (raw === 'LUXURY2026' || raw === 'HOTELSAAS' || raw === 'VIP10') {
      const discount = Math.round(quote.totalAmount * 0.1);
      this.appliedDiscount.set(discount);
      this.appliedCouponCode.set(raw);
      this.couponMessage.set(`Áp dụng thành công mã ${raw}! Giảm 10% (-${discount.toLocaleString('vi-VN')} ₫)`);
      this.alertService.toastSuccess(`Đã áp dụng mã ưu đãi ${raw}!`);
    } else if (raw === 'WELCOME50' || raw === 'SUMMER50') {
      const discount = 50000;
      this.appliedDiscount.set(discount);
      this.appliedCouponCode.set(raw);
      this.couponMessage.set(`Áp dụng thành công mã ${raw}! Giảm ${discount.toLocaleString('vi-VN')} ₫`);
      this.alertService.toastSuccess(`Đã áp dụng mã ưu đãi ${raw}!`);
    } else {
      this.appliedDiscount.set(0);
      this.appliedCouponCode.set('');
      this.couponMessage.set('Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
    }
  }

  removeCoupon(): void {
    this.couponCodeControl.setValue('');
    this.appliedDiscount.set(0);
    this.appliedCouponCode.set('');
    this.couponMessage.set('');
  }

  loadProperties(searchTerm?: string): void {
    this.lastExecutedSearchQuery = searchTerm;
    const requestId = ++this.propertySearchRequestId;
    this.isLoadingProperties.set(true);
    this.propertiesError.set(null);

    this.propertiesSub?.unsubscribe();

    const filter: PublicPropertiesFilter = {
      search: searchTerm,
      destinationKeyword: searchTerm,
      rentalType: Number(this.searchForm.get('rentalType')?.value) || undefined,
      propertyTypes: this.selectedPropertyType() !== 'ALL' ? [this.selectedPropertyType() as number] : undefined,
      touristZoneSlug: this.selectedTouristZoneSlug(),
      landmarkSlug: this.selectedLandmarkSlug()
    };

    this.propertiesSub = this.publicBookingService.getProperties(filter).subscribe({
      next: props => {
        if (requestId !== this.propertySearchRequestId) {
          // Stale response: discard to enforce latest-request-wins
          return;
        }
        this.isLoadingProperties.set(false);
        this.properties.set(props);

        const currentSlug = this.searchForm.get('propertySlug')?.value;
        const matchingProp = props.find(p => p.slug === currentSlug);

        if (matchingProp) {
          this.selectedProperty.set(matchingProp);
        } else {
          this.resetSelectionAndAvailability();
          this.searchForm.patchValue({ propertySlug: '' });
          this.selectedProperty.set(null);
        }
      },
      error: err => {
        if (requestId !== this.propertySearchRequestId) {
          return;
        }
        this.isLoadingProperties.set(false);
        const errorMsg = err?.error?.message || 'Không thể tải danh sách khách sạn.';
        this.propertiesError.set(errorMsg);
        this.alertService.toastError(errorMsg);
      }
    });
  }

  onPropertySearchInput(): void {
    // Kept as no-op for backward compatibility with direct callers; UI input flows through debounced valueChanges.
  }

  applyPropertySearch(): void {
    this.cancelPendingSearchDebounce();
    this.closeCombobox();
    const val = this.propertySearchControl.value?.trim() || undefined;
    this.loadProperties(val);
  }

  clearPropertySearch(): void {
    this.cancelPendingSearchDebounce();
    this.closeCombobox();
    this.resetSelectionAndAvailability();
    this.searchForm.patchValue({ propertySlug: '' }, { emitEvent: false });
    this.selectedProperty.set(null);
    this.properties.set([]);
    this.activeSuggestionIndex.set(-1);
    this.propertySearchRequestId++;
    this.propertiesSub?.unsubscribe();
    this.propertySearchControl.setValue('', { emitEvent: false });
    this.loadProperties();
  }

  retryLoadProperties(): void {
    this.cancelPendingSearchDebounce();
    const val = this.propertySearchControl.value?.trim() || undefined;
    this.loadProperties(val);
  }

  openCombobox(): void {
    this.isComboboxOpen.set(true);
  }

  closeCombobox(): void {
    this.isComboboxOpen.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  selectSuggestion(prop: PublicPropertyDto): void {
    this.cancelPendingSearchDebounce();
    this.isLoadingProperties.set(false);
    this.propertiesError.set(null);
    this.propertySearchRequestId++;
    this.propertiesSub?.unsubscribe();
    this.propertySearchControl.setValue(prop.name, { emitEvent: false });
    this.closeCombobox();
    this.selectProperty(prop);
  }

  onComboboxKeydown(event: KeyboardEvent): void {
    const props = this.properties();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.isComboboxOpen()) {
        this.openCombobox();
        this.activeSuggestionIndex.set(props.length > 0 ? 0 : -1);
      } else if (props.length > 0) {
        const nextIdx = (this.activeSuggestionIndex() + 1) % props.length;
        this.activeSuggestionIndex.set(nextIdx);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.isComboboxOpen() && props.length > 0) {
        const current = this.activeSuggestionIndex();
        const prevIdx = current <= 0 ? props.length - 1 : current - 1;
        this.activeSuggestionIndex.set(prevIdx);
      }
    } else if (event.key === 'Enter') {
      if (this.isComboboxOpen()) {
        const current = this.activeSuggestionIndex();
        if (current >= 0 && current < props.length) {
          event.preventDefault();
          this.selectSuggestion(props[current]);
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCombobox();
    }
  }

  incrementGuests(): void {
    const current = Number(this.guestForm.get('numberOfGuests')?.value) || 1;
    if (current < 10) {
      this.guestForm.patchValue({ numberOfGuests: current + 1 });
    }
  }

  decrementGuests(): void {
    const current = Number(this.guestForm.get('numberOfGuests')?.value) || 1;
    if (current > 1) {
      this.guestForm.patchValue({ numberOfGuests: current - 1 });
    }
  }

  areDatesValid(): boolean {
    const todayStr = getTodayVnDateString();
    const rentalType = Number(this.searchForm.get('rentalType')?.value);
    if (rentalType === 2 || rentalType === 3) {
      const checkInDate = this.searchForm.get('checkInDate')?.value;
      const checkOutDate = this.searchForm.get('checkOutDate')?.value;
      if (!checkInDate || !checkOutDate) {
        return false;
      }
      const inParts = parseDateParts(checkInDate);
      const outParts = parseDateParts(checkOutDate);
      if (!inParts || !outParts) {
        return false;
      }
      if (checkInDate < todayStr) {
        return false;
      }
      if (checkOutDate <= checkInDate) {
        return false;
      }
    } else {
      const hDate = this.searchForm.get('hourlyDate')?.value;
      const durationHours = Number(this.searchForm.get('hourlyDurationHours')?.value);
      if (!hDate || !durationHours || durationHours <= 0) {
        return false;
      }
      const hParts = parseDateParts(hDate);
      if (!hParts) {
        return false;
      }
      if (hDate < todayStr) {
        return false;
      }
    }
    return true;
  }

  onDateChange(type: 'checkIn' | 'checkOut'): void {
    const inDate = this.searchForm.get('checkInDate')?.value;
    const outDate = this.searchForm.get('checkOutDate')?.value;

    if (!inDate || !outDate) {
      this.onSearchCriteriaChange();
      return;
    }

    if (type === 'checkIn') {
      if (outDate <= inDate) {
        const nextDay = addDaysToDateString(inDate, 1);
        this.searchForm.patchValue({ checkOutDate: nextDay }, { emitEvent: false });
        this.dateAdjustmentNotice.set(`Ngày trả phòng đã tự động điều chỉnh thành ${nextDay}`);
      }
    } else if (type === 'checkOut') {
      if (outDate <= inDate) {
        const nextDay = addDaysToDateString(inDate, 1);
        this.searchForm.patchValue({ checkOutDate: nextDay }, { emitEvent: false });
        this.dateAdjustmentNotice.set(`Ngày trả phòng đã tự động điều chỉnh thành ${nextDay}`);
      }
    }

    this.onSearchCriteriaChange();
    if (this.selectedProperty() && this.areDatesValid()) {
      this.searchAvailability();
    }
  }

  handleMainSearchCta(): void {
    this.closeCombobox();
    const hasProperty = !!this.selectedProperty() && !!this.searchForm.get('propertySlug')?.value;

    if (!hasProperty) {
      this.applyPropertySearch();
      if (typeof document !== 'undefined') {
        const el = document.getElementById('propertyListSection');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else {
      if (this.areDatesValid()) {
        this.searchAvailability();
        if (typeof document !== 'undefined') {
          const el = document.getElementById('availabilitySection') || document.getElementById('roomTypesSection');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }
      } else {
        this.alertService.toastWarning('Vui lòng chọn ngày lưu trú hợp lệ.');
      }
    }
  }

  setRentalType(type: number): void {
    if (this.searchForm.get('rentalType')?.value === type) {
      return;
    }
    this.searchForm.patchValue({ rentalType: type });
    this.onSearchCriteriaChange();
    this.searchAvailability();
  }

  isPropertySelectable(prop: PublicPropertyDto): boolean {
    if (this.isLoadingProperties() || !!this.propertiesError()) {
      return false;
    }
    return this.properties().some(p => p.id === prop.id);
  }

  selectProperty(prop: PublicPropertyDto): void {
    // Provenance guard: must belong to current search results and request must not be loading or in error
    if (!this.isPropertySelectable(prop)) {
      return;
    }
    if (this.selectedProperty()?.id === prop.id) {
      return;
    }
    this.resetSelectionAndAvailability();
    this.searchForm.patchValue({ propertySlug: prop.slug });
    this.selectedProperty.set(prop);
    this.searchAvailability();
  }

  onPropertyChange(): void {
    this.resetSelectionAndAvailability();
    const slug = this.searchForm.get('propertySlug')?.value;
    const prop = this.properties().find(p => p.slug === slug) || null;
    if (prop && !this.isPropertySelectable(prop)) {
      return;
    }
    this.selectedProperty.set(prop);
    this.searchAvailability();
  }

  onSearchCriteriaChange(): void {
    this.resetSelectionAndAvailability();
    this.isLoadingAvailability.set(false);
  }

  searchAvailability(): void {
    const slug = this.searchForm.get('propertySlug')?.value;
    if (!slug || !this.areDatesValid()) {
      this.resetSelectionAndAvailability();
      this.isLoadingAvailability.set(false);
      return;
    }

    const currentAvailReqId = ++this.availabilityRequestId;
    const currentSlug = slug;
    const rentalType = Number(this.searchForm.get('rentalType')?.value);
    this.isLoadingAvailability.set(true);

    let startAtUtc: string;
    let endAtUtc: string;
    let checkInDate: string | undefined;
    let checkOutDate: string | undefined;

    if (rentalType === 2 || rentalType === 3) {
      checkInDate = this.searchForm.get('checkInDate')?.value;
      checkOutDate = this.searchForm.get('checkOutDate')?.value;
      startAtUtc = `${checkInDate}T07:00:00Z`;
      endAtUtc = `${checkOutDate}T05:00:00Z`;
    } else {
      const hDate = this.searchForm.get('hourlyDate')?.value;
      const durationHours = Number(this.searchForm.get('hourlyDurationHours')?.value) || 2;
      startAtUtc = `${hDate}T07:00:00Z`;
      const endHour = 7 + durationHours;
      endAtUtc = `${hDate}T${String(endHour).padStart(2, '0')}:00:00Z`;
    }

    this.availabilitySub?.unsubscribe();
    this.availabilitySub = this.publicBookingService.getAvailability(slug, {
      rentalType,
      startAtUtc,
      endAtUtc,
      checkInDate,
      checkOutDate
    }).subscribe({
      next: avail => {
        if (currentAvailReqId !== this.availabilityRequestId || this.searchForm.get('propertySlug')?.value !== currentSlug) {
          // Stale response from previous property or cancelled request
          return;
        }
        this.availabilityList.set(avail);
        const currentProp = this.selectedProperty();
        const currentGen = this.availabilityRequestId;
        if (currentProp) {
          for (const rt of avail) {
            const rawUrl = rt.imageUrl?.trim();
            if (rawUrl) {
              this.itemContextMap.set(rt, {
                propertyId: currentProp.id,
                generation: currentGen,
                roomTypeId: rt.roomTypeId,
                url: rawUrl,
                retryAttempt: 0
              });
            }
          }
        }
        this.isLoadingAvailability.set(false);
      },
      error: err => {
        if (currentAvailReqId !== this.availabilityRequestId || this.searchForm.get('propertySlug')?.value !== currentSlug) {
          return;
        }
        this.isLoadingAvailability.set(false);
        this.alertService.toastError(err?.error?.message || 'Không thể kiểm tra tình trạng phòng trống.');
      }
    });
  }

  selectRoomType(rt: PublicRoomTypeAvailabilityDto): void {
    const slug = this.searchForm.get('propertySlug')?.value;
    const selectedProp = this.selectedProperty();

    // Verify item provenance: must exist in currently rendered availability list and belong to active property
    if (!slug || !selectedProp || selectedProp.slug !== slug) {
      return;
    }
    if (!this.availabilityList().some(item => item.roomTypeId === rt.roomTypeId)) {
      return;
    }

    this.selectedRoomTypeId.set(rt.roomTypeId);
    this.selectedRoomType.set(rt);
    this.currentQuote.set(null); // Clear immediately so stale quote from previous room type is not kept
    this.loadQuote(rt.roomTypeId);
  }

  loadQuote(roomTypeId: string): void {
    const slug = this.searchForm.get('propertySlug')?.value;
    if (!slug || !this.areDatesValid()) {
      this.currentQuote.set(null);
      return;
    }

    const currentQuoteReqId = ++this.quoteRequestId;
    const currentSlug = slug;
    const rentalType = Number(this.searchForm.get('rentalType')?.value);

    let startAtUtc: string;
    let endAtUtc: string;
    let checkInDate: string | undefined;
    let checkOutDate: string | undefined;

    if (rentalType === 2 || rentalType === 3) {
      checkInDate = this.searchForm.get('checkInDate')?.value;
      checkOutDate = this.searchForm.get('checkOutDate')?.value;
      startAtUtc = `${checkInDate}T07:00:00Z`;
      endAtUtc = `${checkOutDate}T05:00:00Z`;
    } else {
      const hDate = this.searchForm.get('hourlyDate')?.value;
      const durationHours = Number(this.searchForm.get('hourlyDurationHours')?.value) || 2;
      startAtUtc = `${hDate}T07:00:00Z`;
      const endHour = 7 + durationHours;
      endAtUtc = `${hDate}T${String(endHour).padStart(2, '0')}:00:00Z`;
    }

    this.currentQuote.set(null); // Clear quote before in-flight calculation
    this.isLoadingQuote.set(true);
    this.quoteSub?.unsubscribe();
    this.quoteSub = this.publicBookingService.calculateQuote({
      propertySlug: slug,
      roomTypeId,
      rentalType,
      startAtUtc,
      endAtUtc,
      checkInDate,
      checkOutDate
    }).subscribe({
      next: quote => {
        if (currentQuoteReqId !== this.quoteRequestId ||
            this.searchForm.get('propertySlug')?.value !== currentSlug ||
            this.selectedRoomTypeId() !== roomTypeId) {
          // Stale response from previous property or room type
          return;
        }
        this.currentQuote.set(quote);
        this.isLoadingQuote.set(false);
      },
      error: err => {
        if (currentQuoteReqId !== this.quoteRequestId ||
            this.searchForm.get('propertySlug')?.value !== currentSlug ||
            this.selectedRoomTypeId() !== roomTypeId) {
          return;
        }
        this.currentQuote.set(null); // Ensure quote remains null on error
        this.isLoadingQuote.set(false);
        this.alertService.toastError(err?.error?.message || 'Không thể tính toán báo giá phòng.');
      }
    });
  }

  scrollToQuoteSection(): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('quoteSection');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  submitHold(): void {
    if (this.isLoadingQuote() || this.isSubmittingHold() || !this.areDatesValid()) {
      return;
    }

    const slug = this.searchForm.get('propertySlug')?.value;
    const selectedProp = this.selectedProperty();
    const selectedRoom = this.selectedRoomType();
    const quote = this.currentQuote();

    if (this.guestForm.invalid || !slug || !selectedProp || !selectedRoom || !quote) {
      return;
    }
    // Verify room provenance: must belong to the active property and be present in current availability list
    if (selectedProp.slug !== slug || !this.availabilityList().some(item => item.roomTypeId === selectedRoom.roomTypeId)) {
      return;
    }
    // Verify quote provenance: quote roomTypeId must match selectedRoom.roomTypeId
    if (quote.roomTypeId && quote.roomTypeId !== selectedRoom.roomTypeId) {
      return;
    }

    const rentalType = Number(this.searchForm.get('rentalType')?.value);

    let startAtUtc: string;
    let endAtUtc: string;
    let checkInDate: string | undefined;
    let checkOutDate: string | undefined;

    if (rentalType === 2 || rentalType === 3) {
      checkInDate = this.searchForm.get('checkInDate')?.value;
      checkOutDate = this.searchForm.get('checkOutDate')?.value;
      startAtUtc = `${checkInDate}T07:00:00Z`;
      endAtUtc = `${checkOutDate}T05:00:00Z`;
    } else {
      const hDate = this.searchForm.get('hourlyDate')?.value;
      const durationHours = Number(this.searchForm.get('hourlyDurationHours')?.value) || 2;
      startAtUtc = `${hDate}T07:00:00Z`;
      const endHour = 7 + durationHours;
      endAtUtc = `${hDate}T${String(endHour).padStart(2, '0')}:00:00Z`;
    }

    const request: CreateGuestHoldRequest = {
      propertySlug: slug,
      roomTypeId: selectedRoom.roomTypeId,
      rentalType,
      startAtUtc,
      endAtUtc,
      guestName: this.guestForm.get('guestName')?.value.trim(),
      guestEmail: this.guestForm.get('guestEmail')?.value.trim(),
      guestPhone: this.guestForm.get('guestPhone')?.value?.trim() || undefined,
      numberOfGuests: Number(this.guestForm.get('numberOfGuests')?.value) || 1,
      checkInDate,
      checkOutDate,
      expectedTotalAmount: this.effectiveTotalAmount(),
      idempotencyKey: `hold-${Date.now()}`
    };

    this.isSubmittingHold.set(true);
    this.holdSub?.unsubscribe();
    this.holdSub = this.publicBookingService.createHold(request).subscribe({
      next: hold => {
        this.isSubmittingHold.set(false);
        this.router.navigate(['/booking/hold', hold.lookupToken]);
      },
      error: err => {
        this.isSubmittingHold.set(false);
        this.alertService.toastError(err?.error?.message || 'Không thể tạo yêu cầu giữ phòng. Vui lòng thử lại.');
      }
    });
  }

  // =========================================================================
  // GUEST ROOM IMAGE FALLBACK & IMMUTABLE RENDER CONTEXT (AC-MEDIA-01 - 09)
  // =========================================================================

  /**
   * Lấy ảnh chụp ngữ cảnh render bất biến cho loại phòng.
   * Ưu tiên ngữ cảnh đã snapshot từ lúc nhận availability; lazily snapshot nếu gọi độc lập.
   */
  getRoomImageContext(rt: PublicRoomTypeAvailabilityDto | null | undefined): RoomImageRenderContext | null {
    if (!rt) return null;
    let ctx = this.itemContextMap.get(rt);
    if (!ctx) {
      const prop = this.selectedProperty();
      const rawUrl = rt.imageUrl?.trim();
      if (prop && rawUrl) {
        ctx = {
          propertyId: prop.id,
          generation: this.availabilityRequestId,
          roomTypeId: rt.roomTypeId,
          url: rawUrl,
          retryAttempt: 0
        };
        this.itemContextMap.set(rt, ctx);
      }
    }
    return ctx || null;
  }

  /**
   * Kiểm tra ảnh có sẵn sàng để hiển thị không.
   * Fail closed nếu thiếu property, lệch generation, hoặc khóa ảnh đã nằm trong failedImageKeys.
   */
  isRoomImageRenderable(ctx: RoomImageRenderContext | null): boolean {
    if (!ctx) return false;

    const currentProperty = this.selectedProperty();
    // 1. Fail closed nếu thiếu cơ sở hoặc cơ sở không khớp
    if (!currentProperty || currentProperty.id !== ctx.propertyId) {
      return false;
    }

    // 2. Thế hệ không khớp với yêu cầu hiện hành
    if (this.availabilityRequestId !== ctx.generation) {
      return false;
    }

    // 3. Khóa ảnh đã bị đánh dấu lỗi
    const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url}`;
    return !this.failedImageKeys().has(key);
  }

  /**
   * Kiểm tra có thể hiển thị nút Thử lại (Retry) cho ảnh hay không.
   */
  canRetryRoomImage(rt: PublicRoomTypeAvailabilityDto): boolean {
    const ctx = this.getRoomImageContext(rt);
    if (!ctx) return false;

    const currentProperty = this.selectedProperty();
    if (!currentProperty || currentProperty.id !== ctx.propertyId) return false;
    if (this.availabilityRequestId !== ctx.generation) return false;

    const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url}`;
    return this.failedImageKeys().has(key);
  }

  /**
   * Thao tác thử lại tải ảnh (Retry) cho cùng một URL.
   * Xóa khóa lỗi và tăng retryAttempt để kích hoạt render mới với khóa định danh mới.
   */
  retryRoomImage(rt: PublicRoomTypeAvailabilityDto): void {
    const ctx = this.getRoomImageContext(rt);
    if (!ctx) return;

    const currentProperty = this.selectedProperty();
    if (!currentProperty || currentProperty.id !== ctx.propertyId) return;
    if (this.availabilityRequestId !== ctx.generation) return;

    const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url}`;
    if (!this.failedImageKeys().has(key)) return;

    // Xóa khóa lỗi để cho phép thử tải lại
    const nextFailed = new Set(this.failedImageKeys());
    nextFailed.delete(key);
    this.failedImageKeys.set(nextFailed);

    // Cập nhật context snapshot với retryAttempt tăng dần để kích hoạt render mới
    const nextCtx: RoomImageRenderContext = {
      ...ctx,
      retryAttempt: ctx.retryAttempt + 1
    };
    this.itemContextMap.set(rt, nextCtx);
  }

  /**
   * Khóa định danh render của ảnh phòng (phục vụ DOM keying / tracking).
   */
  getRoomImageRenderKey(rt: PublicRoomTypeAvailabilityDto): string {
    const ctx = this.getRoomImageContext(rt);
    if (!ctx) return 'fallback';
    return `${ctx.propertyId}:${ctx.generation}:${ctx.roomTypeId}:${ctx.url}:${ctx.retryAttempt}`;
  }

  trackByRenderKey = (_index: number, key: string): string => key;

  /**
   * Xử lý khi thẻ <img> gặp lỗi tải tài nguyên.
   * Nhận ảnh chụp bất biến được truyền từ template tại thời điểm render.
   */
  onRoomImageError(ctx: RoomImageRenderContext | null): void {
    if (!ctx) return;

    const currentProperty = this.selectedProperty();

    // 1. Fail closed nếu không có cơ sở hiện tại
    if (!currentProperty) {
      return;
    }

    // 2. Loại bỏ sự kiện muộn khi chuyển cơ sở A -> B
    if (currentProperty.id !== ctx.propertyId) {
      return;
    }

    // 3. Loại bỏ sự kiện muộn khi đổi ngày/thế hệ tìm kiếm
    if (this.availabilityRequestId !== ctx.generation) {
      return;
    }

    // 4. Bỏ qua URL rỗng hoặc khoảng trắng
    if (!ctx.url || !ctx.url.trim()) {
      return;
    }

    // 5. Loại bỏ sự kiện muộn của lượt thử cũ nếu đã retry
    const currentItem = this.availabilityList().find(item => item.roomTypeId === ctx.roomTypeId);
    if (!currentItem) {
      return;
    }
    const currentCtx = this.itemContextMap.get(currentItem);
    if (!currentCtx || currentCtx.retryAttempt !== ctx.retryAttempt || currentCtx.url !== ctx.url) {
      return;
    }

    // 6. Ghi nhận lỗi theo đúng khóa ngữ cảnh được cô lập
    const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url}`;
    const currentSet = new Set(this.failedImageKeys());
    currentSet.add(key);
    this.failedImageKeys.set(currentSet);
  }
}
