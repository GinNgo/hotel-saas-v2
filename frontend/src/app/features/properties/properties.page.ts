import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { VIETNAM_34_ADMIN_PROVINCES, removeVietnameseAccents } from '../../core/models/location.model';
import {
  TenantPropertySummaryDto,
  CreatePropertyRequest,
  UpdatePropertyRequest,
  TouristZoneDto,
  LandmarkDto
} from '../../core/models/public-booking.model';
import {
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  FormFieldComponent,
  FormControlDirective,
  GoogleMapPickerComponent,
  LocationPickerResult
} from '../../shared';

type BranchSummaryWithMeta = TenantPropertySummaryDto & {
  provinceCode?: string | null;
  touristZoneSlug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPublished?: boolean;
  status?: number | string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

type CreatePropertyPayload = CreatePropertyRequest & {
  phoneNumber?: string;
  email?: string;
  starRating?: number;
  isPublished?: boolean;
};

type UpdatePropertyPayload = UpdatePropertyRequest & {
  phoneNumber?: string;
  email?: string;
  starRating?: number;
  isPublished?: boolean;
  status?: number;
};

const LEGACY_PROVINCE_CODE_TO_34: Readonly<Record<string, string>> = {
  '1': '01', '4': '04', '8': '08', '2': '08', '02': '08',
  '10': '15', '6': '19', '06': '19', '27': '24', '17': '25', '26': '25',
  '30': '31', '34': '33', '35': '37', '36': '37', '45': '44', '49': '48',
  '62': '51', '64': '52', '58': '56', '54': '66', '60': '68', '67': '68',
  '70': '75', '74': '79', '77': '79', '72': '80', '87': '82',
  '83': '86', '84': '86', '89': '91', '93': '92', '94': '92', '95': '96',
};

const CITY_ALIAS_TO_34: Readonly<Array<[string, string]>> = [
  ['ho chi minh', '79'], ['sai gon', '79'], ['vung tau', '79'], ['con dao', '79'], ['binh duong', '79'],
  ['ha noi', '01'], ['da nang', '48'], ['hoi an', '48'], ['quang nam', '48'],
  ['da lat', '68'], ['mui ne', '68'], ['phan thiet', '68'], ['lam dong', '68'], ['binh thuan', '68'], ['dak nong', '68'],
  ['nha trang', '56'], ['khanh hoa', '56'], ['ninh thuan', '56'], ['phan rang', '56'],
  ['phu quoc', '91'], ['kien giang', '91'], ['an giang', '91'], ['ha tien', '91'],
  ['sa pa', '15'], ['sapa', '15'], ['lao cai', '15'], ['yen bai', '15'],
  ['ha long', '22'], ['quang ninh', '22'], ['van don', '22'], ['co to', '22'],
  ['hue', '46'], ['ha giang', '08'], ['tuyen quang', '08'],
  ['quy nhon', '52'], ['binh dinh', '52'], ['gia lai', '52'], ['pleiku', '52'],
  ['phu yen', '66'], ['tuy hoa', '66'], ['dak lak', '66'], ['buon ma thuot', '66'],
  ['mang den', '51'], ['kon tum', '51'], ['quang ngai', '51'], ['ly son', '51'],
  ['hai phong', '31'], ['cat ba', '31'], ['hai duong', '31'],
  ['can tho', '92'], ['soc trang', '92'], ['hau giang', '92'],
  ['ca mau', '96'], ['bac lieu', '96'],
];

interface PropertyTypeSelectOption {
  readonly value: number;
  readonly label: string;
  readonly icon: string;
  readonly color: 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate';
}

interface HttpErrorPayload {
  error?: {
    detail?: string;
    title?: string;
    message?: string;
  };
}

@Component({
  selector: 'app-properties-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    FormFieldComponent,
    FormControlDirective,
    GoogleMapPickerComponent
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <app-page-header
        title="Quản lý Chuỗi Cơ sở & Chi nhánh"
        subtitle="Hệ thống điều hành trung tâm (HQ) quản lý danh sách khách sạn, nhà nghỉ, motel, homestay và resort trực thuộc."
      >
        <button
          type="button"
          (click)="openCreateModal()"
          class="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
        >
          <i class="pi pi-plus text-xs" aria-hidden="true"></i>
          <span>Thêm Chi nhánh</span>
        </button>
      </app-page-header>

      <!-- KPI Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card
          title="Tổng số Chi nhánh"
          [value]="totalProperties()"
          unit="cơ sở"
          variant="indigo"
          subtitle="Đang vận hành trong chuỗi"
        >
          <i icon class="pi pi-building text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Tổng Quy mô Phòng"
          [value]="totalRooms()"
          unit="phòng"
          variant="emerald"
          subtitle="Sẵn sàng đón khách"
        >
          <i icon class="pi pi-th-large text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Phòng đang có khách"
          [value]="occupiedRooms()"
          unit="phòng"
          variant="amber"
          [subtitle]="occupancyRateLabel()"
        >
          <i icon class="pi pi-users text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Doanh thu hôm nay"
          [value]="formattedTodayRevenue()"
          unit="₫"
          variant="rose"
          subtitle="Tính trên toàn chuỗi"
        >
          <i icon class="pi pi-dollar text-lg"></i>
        </app-stat-card>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <!-- Search input -->
          <div class="relative flex-1 max-w-md">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              aria-label="Tìm theo tên chi nhánh, mã, địa chỉ, thành phố"
              placeholder="Tìm theo tên chi nhánh, mã, địa chỉ, thành phố..."
              class="min-h-11 w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          <!-- Active branch switch reminder badge -->
          <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-end sm:self-center">
            <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span>Chi nhánh đang chọn: </span>
            <strong class="text-slate-800 dark:text-slate-100">{{ authService.activePropertyName() || 'Chưa chọn' }}</strong>
          </div>
        </div>

        <!-- Property Type Filter Chips -->
        <div class="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span class="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Loại hình:</span>
          <button
            type="button"
            (click)="selectedType.set('ALL')"
            [attr.aria-pressed]="selectedType() === 'ALL'"
            [ngClass]="selectedType() === 'ALL' ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'"
            class="min-h-11 inline-flex items-center px-3 py-2 rounded-lg transition-colors cursor-pointer tabular-nums"
          >
            Tất cả ({{ totalProperties() }})
          </button>
          @for (opt of propertyTypeOptions; track opt.value) {
            <button
              type="button"
              (click)="selectedType.set(opt.value)"
              [attr.aria-pressed]="selectedType() === opt.value"
              [ngClass]="selectedType() === opt.value ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'"
              class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <i [class]="opt.icon" class="text-xs" aria-hidden="true"></i>
              <span>{{ opt.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="py-16 flex flex-col items-center justify-center gap-3">
          <app-loading-spinner size="lg" message="Đang tải dữ liệu chi nhánh thuộc chuỗi..." />
        </div>
      } @else if (filteredProperties().length === 0) {
        <app-empty-state
          iconClass="pi pi-building"
          title="Không tìm thấy chi nhánh nào"
          description="Chưa có cơ sở lưu trú nào phù hợp với bộ lọc tìm kiếm hiện tại."
        />
      } @else {
        <!-- Properties Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (prop of filteredProperties(); track prop.id) {
            <div
              class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group"
              [class.ring-2]="authService.activePropertyId() === prop.id"
              [class.ring-emerald-500]="authService.activePropertyId() === prop.id"
            >
              <!-- Card Header -->
              <div class="p-5 pb-4 border-b border-slate-100 flex-1 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                        {{ prop.code }}
                      </span>
                      <app-status-badge
                        [status]="prop.propertyTypeName || getPropertyTypeLabel(prop.propertyType)"
                        type="custom"
                        [customLabel]="prop.propertyTypeName || getPropertyTypeLabel(prop.propertyType)"
                        [color]="getPropertyTypeColor(prop.propertyType)"
                      />
                      <app-status-badge
                        [status]="isPropertyPublished(prop)"
                        type="custom"
                        [customLabel]="isPropertyPublished(prop) ? 'Đang công khai' : 'Chưa công khai'"
                        [color]="isPropertyPublished(prop) ? 'emerald' : 'amber'"
                      />
                      @if (authService.activePropertyId() === prop.id) {
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                          Đang làm việc
                        </span>
                      }
                    </div>
                    <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {{ prop.name }}
                    </h3>
                  </div>

                  <button
                    type="button"
                    (click)="openEditModal(prop)"
                    [attr.aria-label]="'Chỉnh sửa thông tin chi nhánh ' + prop.name"
                    class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Chỉnh sửa thông tin chi nhánh"
                  >
                    <i class="pi pi-pencil text-sm" aria-hidden="true"></i>
                  </button>
                </div>

                <!-- Location & Contact Info -->
                <div class="text-xs text-slate-500 space-y-1">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-map-marker text-slate-400 text-xs shrink-0"></i>
                    <span class="truncate">{{ prop.address }}, {{ prop.city }}</span>
                  </div>
                  @if (prop.starRating && prop.starRating > 0) {
                    <div class="flex items-center gap-1.5 text-amber-600 font-semibold">
                      <i class="pi pi-star-fill text-[11px]"></i>
                      <span>{{ prop.starRating }} sao</span>
                    </div>
                  }
                  @if (prop.phoneNumber || prop.email) {
                    <div class="flex items-center gap-3 flex-wrap text-slate-600">
                      @if (prop.phoneNumber) {
                        <span class="inline-flex items-center gap-1">
                          <i class="pi pi-phone text-[11px] text-slate-400"></i>
                          <span>{{ prop.phoneNumber }}</span>
                        </span>
                      }
                      @if (prop.email) {
                        <span class="inline-flex items-center gap-1 truncate">
                          <i class="pi pi-envelope text-[11px] text-slate-400"></i>
                          <span class="truncate">{{ prop.email }}</span>
                        </span>
                      }
                    </div>
                  }
                  @if (prop.touristZoneName) {
                    <div class="flex items-center gap-2 text-emerald-700 font-medium">
                      <i class="pi pi-compass text-emerald-600 text-xs shrink-0"></i>
                      <span>Khu du lịch: {{ prop.touristZoneName }}</span>
                    </div>
                  }
                </div>

                <!-- Supported Rental Models Badges -->
                <div class="flex items-center gap-1.5 flex-wrap pt-1">
                  <span class="text-[10px] text-slate-400 font-semibold mr-1">Hình thức:</span>
                  @if (prop.allowDailyBooking) {
                    <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 font-medium">
                      Theo ngày
                    </span>
                  }
                  @if (prop.allowHourlyBooking) {
                    <span class="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                      Theo giờ
                    </span>
                  }
                  @if (prop.allowOvernightBooking) {
                    <span class="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80 font-medium">
                      Qua đêm
                    </span>
                  }
                </div>

                <!-- Metrics Strip -->
                <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center tabular-nums">
                  <div class="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2">
                    <span class="block text-[10px] text-slate-400 font-medium uppercase">Tổng phòng</span>
                    <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ prop.totalRooms }}</span>
                  </div>
                  <div class="bg-amber-50/70 dark:bg-amber-950/50 rounded-xl p-2">
                    <span class="block text-[10px] text-amber-700 dark:text-amber-400 font-medium uppercase">Có khách</span>
                    <span class="text-sm font-bold text-amber-800 dark:text-amber-300">{{ prop.occupiedRooms }}</span>
                  </div>
                  <div class="bg-emerald-50/70 dark:bg-emerald-950/50 rounded-xl p-2">
                    <span class="block text-[10px] text-emerald-700 dark:text-emerald-400 font-medium uppercase">Hôm nay</span>
                    <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300">{{ prop.todayRevenue | number:'1.0-0' }}₫</span>
                  </div>
                </div>
              </div>

              <!-- Card Action Footer -->
              <div class="p-3 bg-slate-50/70 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  (click)="togglePublishStatus(prop)"
                  [disabled]="togglingPublishId() === prop.id"
                  [attr.aria-label]="(isPropertyPublished(prop) ? 'Ẩn khỏi trang công khai: ' : 'Công khai chi nhánh: ') + prop.name"
                  [ngClass]="isPropertyPublished(prop)
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'"
                  class="min-h-11 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  @if (togglingPublishId() === prop.id) {
                    Đang lưu...
                  } @else if (isPropertyPublished(prop)) {
                    Ẩn public
                  } @else {
                    Công khai
                  }
                </button>
                <button
                  type="button"
                  (click)="openEditModal(prop)"
                  class="min-h-11 flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Cấu hình
                </button>
                <button
                  type="button"
                  (click)="switchToProperty(prop)"
                  [disabled]="switchingPropertyId() === prop.id"
                  [ngClass]="authService.activePropertyId() === prop.id ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-60'"
                  class="min-h-11 flex-1 py-2 px-3 rounded-xl text-xs font-semibold shadow-2xs transition-colors text-center"
                >
                  @if (switchingPropertyId() === prop.id) {
                    Đang chuyển...
                  } @else if (authService.activePropertyId() === prop.id) {
                    Đang chọn
                  } @else {
                    Vào quản lý
                  }
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create / Edit Property Modal Dialog -->
    @if (isModalOpen()) {
      <div
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[65] !m-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (click)="closeModal()"
      >
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 my-8"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 id="property-modal-title" class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <i class="pi pi-building text-sm" aria-hidden="true"></i>
                </div>
                <span>{{ isEditing() ? 'Cập nhật Thông tin Chi nhánh' : 'Thêm Chi nhánh Mới' }}</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Thiết lập thông tin nhận diện, địa chỉ hành chính, khu vực du lịch và hình thức cho thuê.
              </p>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              aria-label="Đóng cửa sổ chi nhánh"
              class="min-w-11 min-h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              <i class="pi pi-times text-sm" aria-hidden="true"></i>
            </button>
          </div>

          <form [formGroup]="propertyForm" (ngSubmit)="saveProperty()" class="space-y-4">
            <!-- Row 1: Name & Code -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div class="sm:col-span-2">
                <app-form-field
                  #nameField
                  controlId="prop-name"
                  label="Tên Chi nhánh / Khách sạn"
                  [required]="true"
                  [error]="getFieldError('name')"
                >
                  <input
                    [appFormControl]="nameField"
                    type="text"
                    formControlName="name"
                    (input)="onNameChanged()"
                    placeholder="Ví dụ: Khách sạn Sài Gòn Phổ Cổ"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #codeField
                  controlId="prop-code"
                  label="Mã chi nhánh"
                  [required]="true"
                  [error]="getFieldError('code')"
                >
                  <input
                    [appFormControl]="codeField"
                    type="text"
                    formControlName="code"
                    placeholder="KS01, NN02..."
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm uppercase font-mono font-bold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>
            </div>

            <!-- Row 2: Property Type & Slug -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div>
                <app-form-field
                  #typeField
                  controlId="prop-type"
                  label="Loại hình cơ sở"
                  [required]="true"
                  [error]="getFieldError('propertyType')"
                >
                  <select
                    [appFormControl]="typeField"
                    formControlName="propertyType"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  >
                    @for (opt of propertyTypeOptions; track opt.value) {
                      <option [ngValue]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #slugField
                  controlId="prop-slug"
                  label="Đường dẫn định danh (Slug)"
                  [required]="true"
                  [error]="getFieldError('slug')"
                >
                  <input
                    [appFormControl]="slugField"
                    type="text"
                    formControlName="slug"
                    placeholder="khach-san-sai-gon-pho-co"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-700 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>
            </div>

            <!-- Row 3: Address & City -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div class="sm:col-span-2">
                <app-form-field
                  #addressField
                  controlId="prop-address"
                  label="Địa chỉ cụ thể"
                  [required]="true"
                  [error]="getFieldError('address')"
                >
                  <input
                    [appFormControl]="addressField"
                    type="text"
                    formControlName="address"
                    placeholder="Số 123 Đường Trần Phú..."
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #cityField
                  controlId="prop-city"
                  label="Tỉnh / Thành phố"
                  [required]="true"
                  [error]="getFieldError('city')"
                >
                  <input
                    [appFormControl]="cityField"
                    type="text"
                    formControlName="city"
                    placeholder="Đà Lạt, Hà Nội..."
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>
            </div>

            <!-- Row 3b: Contact Info & Star Rating -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div>
                <app-form-field
                  #phoneField
                  controlId="prop-phone"
                  label="Số điện thoại lễ tân"
                  [error]="getFieldError('phoneNumber')"
                >
                  <input
                    [appFormControl]="phoneField"
                    type="tel"
                    formControlName="phoneNumber"
                    placeholder="0909123456"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #emailField
                  controlId="prop-email"
                  label="Email liên hệ"
                  [error]="getFieldError('email')"
                >
                  <input
                    [appFormControl]="emailField"
                    type="email"
                    formControlName="email"
                    placeholder="booking@khachsan.vn"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #starField
                  controlId="prop-star"
                  label="Hạng sao"
                >
                  <select
                    [appFormControl]="starField"
                    formControlName="starRating"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  >
                    <option [ngValue]="0">Chưa xếp hạng</option>
                    <option [ngValue]="1">1 sao</option>
                    <option [ngValue]="2">2 sao</option>
                    <option [ngValue]="3">3 sao</option>
                    <option [ngValue]="4">4 sao</option>
                    <option [ngValue]="5">5 sao</option>
                  </select>
                </app-form-field>
              </div>
            </div>

            <!-- Row 3c: Check-in / Check-out Times & Publish State -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div>
                <app-form-field
                  #checkInTimeField
                  controlId="prop-checkin-time"
                  label="Giờ nhận phòng chuẩn"
                  [error]="getFieldError('checkInTime')"
                >
                  <input
                    [appFormControl]="checkInTimeField"
                    type="time"
                    formControlName="checkInTime"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #checkOutTimeField
                  controlId="prop-checkout-time"
                  label="Giờ trả phòng chuẩn"
                  [error]="getFieldError('checkOutTime')"
                >
                  <input
                    [appFormControl]="checkOutTimeField"
                    type="time"
                    formControlName="checkOutTime"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>

              <div class="pt-6">
                <label class="min-h-11 flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" formControlName="isPublished" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Công khai mở bán (Public)</span>
                </label>
              </div>
            </div>

            <!-- Row 4: Tourist Zone & Province Code -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div>
                <app-form-field
                  #zoneField
                  controlId="prop-zone"
                  label="Khu vực du lịch liên kết"
                >
                  <select
                    [appFormControl]="zoneField"
                    formControlName="touristZoneSlug"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  >
                    <option [ngValue]="null">-- Không thuộc khu du lịch đặc thù --</option>
                    @for (zone of touristZones(); track zone.slug) {
                      <option [value]="zone.slug">{{ zone.name }} ({{ zone.provinceName }})</option>
                    }
                  </select>
                </app-form-field>
              </div>

              <div>
                <app-form-field
                  #provinceField
                  controlId="prop-province"
                  label="Mã Tỉnh/Thành hành chính"
                >
                  <input
                    [appFormControl]="provinceField"
                    type="text"
                    formControlName="provinceCode"
                    placeholder="79, 01, 48, 68..."
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>
            </div>

            <!-- Row 4b: Interactive Map Positioning -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <i class="pi pi-map text-emerald-600"></i>
                  <span>Định vị Chi nhánh trên Bản đồ (GPS &amp; Google Maps)</span>
                </span>
                @if (propertyForm.get('latitude')?.value != null && propertyForm.get('longitude')?.value != null) {
                  <span class="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {{ propertyForm.get('latitude')?.value | number:'1.4-4' }}, {{ propertyForm.get('longitude')?.value | number:'1.4-4' }}
                  </span>
                }
              </div>
              <app-google-map-picker
                [initialAddress]="propertyForm.get('address')?.value || ''"
                [initialLat]="propertyForm.get('latitude')?.value ?? 10.7769"
                [initialLng]="propertyForm.get('longitude')?.value ?? 106.7009"
                (locationSelected)="onMapLocationSelected($event)"
              />
            </div>

            <!-- Row 5: Booking Models Options Checkboxes -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <span class="block text-xs font-bold text-slate-800 dark:text-slate-100">Hình thức kinh doanh được phép mở bán Online:</span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label class="min-h-11 flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" formControlName="allowDailyBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Theo Ngày (Daily)</span>
                </label>
                <label class="min-h-11 flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" formControlName="allowHourlyBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Theo Giờ (Hourly)</span>
                </label>
                <label class="min-h-11 flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" formControlName="allowOvernightBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Qua Đêm (Overnight)</span>
                </label>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeModal()"
                class="min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                [disabled]="propertyForm.invalid || isSubmitting()"
                class="min-h-11 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                }
                <span>{{ isEditing() ? 'Lưu cập nhật' : 'Tạo mới chi nhánh' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class PropertiesPage implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly publicBookingService = inject(PublicBookingService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  properties = signal<TenantPropertySummaryDto[]>([]);
  touristZones = signal<TouristZoneDto[]>([]);
  landmarks = signal<LandmarkDto[]>([]);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  switchingPropertyId = signal<string | null>(null);
  togglingPublishId = signal<string | null>(null);
  searchQuery = signal<string>('');
  selectedType = signal<number | 'ALL'>('ALL');

  /** Đồng bộ 1-based C# enum PropertyType (1..8). */
  readonly propertyTypeOptions: readonly PropertyTypeSelectOption[] = [
    { value: 1, label: 'Khách sạn (Hotel)', icon: 'pi pi-building', color: 'blue' },
    { value: 2, label: 'Resort nghỉ dưỡng', icon: 'pi pi-sun', color: 'emerald' },
    { value: 3, label: 'Hostel / Ký túc xá', icon: 'pi pi-home', color: 'amber' },
    { value: 4, label: 'Bed & Breakfast', icon: 'pi pi-sparkles', color: 'purple' },
    { value: 5, label: 'Biệt thự / Villa', icon: 'pi pi-warehouse', color: 'rose' },
    { value: 6, label: 'Căn hộ dịch vụ', icon: 'pi pi-th-large', color: 'blue' },
    { value: 7, label: 'Nhà nghỉ / Motel', icon: 'pi pi-bolt', color: 'amber' },
    { value: 8, label: 'Homestay', icon: 'pi pi-compass', color: 'emerald' },
  ];

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  editingPropertyId = signal<string | null>(null);

  private static optionalEmailValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return Validators.email({ value } as AbstractControl);
  }

  propertyForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    slug: ['', [Validators.required, Validators.maxLength(100)]],
    propertyType: [1, [Validators.required]],
    starRating: [0, [Validators.min(0), Validators.max(5)]],
    phoneNumber: ['', [Validators.maxLength(20)]],
    email: ['', [PropertiesPage.optionalEmailValidator, Validators.maxLength(200)]],
    address: ['', [Validators.required, Validators.maxLength(200)]],
    city: ['', [Validators.required, Validators.maxLength(50)]],
    provinceCode: ['79'],
    touristZoneSlug: [null],
    latitude: [null as number | null],
    longitude: [null as number | null],
    checkInTime: ['14:00', [Validators.required]],
    checkOutTime: ['12:00', [Validators.required]],
    allowHourlyBooking: [true],
    allowOvernightBooking: [true],
    allowDailyBooking: [true],
    isPublished: [false],
    isActive: [true]
  });

  // KPI Computeds
  totalProperties = computed(() => this.properties().length);
  totalRooms = computed(() => this.properties().reduce((acc, p) => acc + (p.totalRooms || 0), 0));
  occupiedRooms = computed(() => this.properties().reduce((acc, p) => acc + (p.occupiedRooms || 0), 0));
  todayRevenue = computed(() => this.properties().reduce((acc, p) => acc + (p.todayRevenue || 0), 0));

  occupancyRateLabel = computed(() => {
    const total = this.totalRooms();
    if (total === 0) return 'Tỉ lệ lấp đầy 0%';
    const pct = Math.round((this.occupiedRooms() / total) * 100);
    return `Tỉ lệ lấp đầy ${pct}%`;
  });

  formattedTodayRevenue = computed(() => {
    return new Intl.NumberFormat('vi-VN').format(this.todayRevenue());
  });

  filteredProperties = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const type = this.selectedType();
    let list = this.properties();

    if (type !== 'ALL') {
      list = list.filter(p => this.normalizePropertyType(p.propertyType) === type);
    }

    if (query) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query) ||
        (p.city && p.city.toLowerCase().includes(query)) ||
        (p.touristZoneName && p.touristZoneName.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadProperties();
    this.loadTouristZones();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isModalOpen() && !this.isSubmitting()) {
      this.closeModal();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.isModalOpen() && this.propertyForm.dirty;
  }

  loadProperties(): void {
    this.isLoading.set(true);
    this.propertyService.getTenantProperties().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.properties.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.toastError('Không thể tải danh sách chi nhánh thuộc chuỗi.', 'Lỗi');
      }
    });
  }

  loadTouristZones(): void {
    this.publicBookingService.getTouristZones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (zones) => this.touristZones.set(zones || []),
      error: () => {}
    });
  }

  normalizePropertyType(type: number | string | null | undefined): number {
    if (typeof type === 'number' && Number.isFinite(type)) return type;
    switch (String(type ?? '').trim()) {
      case 'Hotel': return 1;
      case 'Resort': return 2;
      case 'Hostel': return 3;
      case 'BedAndBreakfast': return 4;
      case 'Villa': return 5;
      case 'Apartment': return 6;
      case 'Motel':
      case 'Guesthouse': return 7;
      case 'Homestay': return 8;
      default: {
        const parsed = Number(type);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      }
    }
  }

  isPropertyPublished(prop: TenantPropertySummaryDto): boolean {
    return (prop as BranchSummaryWithMeta).isPublished === true;
  }

  private resolvePropertyStatusValue(status: number | string | undefined, isActive: boolean | undefined): number {
    if (typeof status === 'number' && Number.isFinite(status)) return status;
    switch (String(status ?? '').trim()) {
      case 'Inactive': return 0;
      case 'Active': return 1;
      case 'Suspended': return 2;
      default: return isActive === false ? 0 : 1;
    }
  }

  private formatTimeToInput(time: string | null | undefined, fallback: string): string {
    const raw = String(time ?? '').trim();
    if (/^\d{2}:\d{2}/.test(raw)) {
      return raw.slice(0, 5);
    }
    return fallback;
  }

  private formatTimeToBackend(time: string | null | undefined, fallback: string): string {
    const raw = String(time ?? '').trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    return fallback;
  }

  getPropertyTypeLabel(type: number | string): string {
    const normalized = this.normalizePropertyType(type);
    switch (normalized) {
      case 1: return 'Khách sạn (Hotel)';
      case 2: return 'Resort nghỉ dưỡng';
      case 3: return 'Hostel / Ký túc xá';
      case 4: return 'Bed & Breakfast';
      case 5: return 'Biệt thự / Villa';
      case 6: return 'Căn hộ dịch vụ';
      case 7: return 'Nhà nghỉ / Motel';
      case 8: return 'Homestay';
      default: return 'Cơ sở lưu trú';
    }
  }

  getPropertyTypeColor(type: number | string): 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate' {
    const normalized = this.normalizePropertyType(type);
    return this.propertyTypeOptions.find(opt => opt.value === normalized)?.color ?? 'slate';
  }

  switchToProperty(prop: TenantPropertySummaryDto): void {
    if (this.switchingPropertyId() !== null) return;

    this.switchingPropertyId.set(prop.id);
    this.authService.switchContext(prop.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.switchingPropertyId.set(null);
        this.alertService.toastSuccess(`Bạn đang làm việc tại: ${prop.name} (${prop.code})`, 'Đã đổi chi nhánh');
        void this.router.navigate(['/rooms']);
      },
      error: (err: HttpErrorPayload) => {
        this.switchingPropertyId.set(null);
        const detail = err?.error?.detail || err?.error?.title || err?.error?.message || 'Không thể chuyển sang chi nhánh này.';
        this.alertService.toastError(detail, 'Lỗi chuyển ngữ cảnh');
      },
    });
  }

  togglePublishStatus(prop: TenantPropertySummaryDto): void {
    if (this.togglingPublishId() !== null) return;

    const propWithMeta = prop as BranchSummaryWithMeta;
    const nextPublished = !this.isPropertyPublished(prop);
    this.togglingPublishId.set(prop.id);

    const req: UpdatePropertyPayload = {
      name: prop.name,
      code: prop.code,
      slug: prop.slug,
      address: prop.address,
      city: prop.city,
      provinceCode: this.resolveProvinceCodeForProperty(propWithMeta),
      propertyType: this.normalizePropertyType(prop.propertyType),
      starRating: prop.starRating ?? 0,
      phoneNumber: prop.phoneNumber || undefined,
      email: prop.email || undefined,
      touristZoneSlug: propWithMeta.touristZoneSlug || undefined,
      ...(typeof propWithMeta.latitude === 'number' && Number.isFinite(propWithMeta.latitude) ? { latitude: propWithMeta.latitude } : {}),
      ...(typeof propWithMeta.longitude === 'number' && Number.isFinite(propWithMeta.longitude) ? { longitude: propWithMeta.longitude } : {}),
      allowHourlyBooking: prop.allowHourlyBooking,
      allowOvernightBooking: prop.allowOvernightBooking,
      allowDailyBooking: prop.allowDailyBooking,
      isPublished: nextPublished,
      status: this.resolvePropertyStatusValue(propWithMeta.status, prop.isActive),
      isActive: prop.isActive !== false,
    };

    this.propertyService.updateProperty(prop.id, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.togglingPublishId.set(null);
        this.properties.update(list =>
          list.map(item =>
            item.id === prop.id
              ? ({ ...item, isPublished: nextPublished } as BranchSummaryWithMeta)
              : item
          )
        );
        this.alertService.toastSuccess(
          nextPublished
            ? `Chi nhánh ${prop.name} đã được công khai trên trang đặt phòng.`
            : `Chi nhánh ${prop.name} đã chuyển về trạng thái nháp (chưa công khai).`,
          'Cập nhật trạng thái công khai'
        );
      },
      error: (err: HttpErrorPayload) => {
        this.togglingPublishId.set(null);
        const detail = err?.error?.message || err?.error?.detail || err?.error?.title || 'Không thể cập nhật trạng thái công khai chi nhánh.';
        this.alertService.toastError(detail, 'Lỗi cập nhật');
      }
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingPropertyId.set(null);
    this.propertyForm.reset({
      name: '',
      code: '',
      slug: '',
      propertyType: 1,
      starRating: 0,
      phoneNumber: '',
      email: '',
      address: '',
      city: '',
      provinceCode: '79',
      touristZoneSlug: null,
      latitude: null,
      longitude: null,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: true,
      isPublished: false,
      isActive: true
    });
    this.propertyForm.markAsPristine();
    this.isModalOpen.set(true);
  }

  openEditModal(prop: TenantPropertySummaryDto): void {
    const propWithGeo = prop as BranchSummaryWithMeta;
    this.isEditing.set(true);
    this.editingPropertyId.set(prop.id);
    this.propertyForm.patchValue({
      name: prop.name,
      code: prop.code,
      slug: prop.slug,
      propertyType: this.normalizePropertyType(prop.propertyType),
      starRating: prop.starRating ?? 0,
      phoneNumber: prop.phoneNumber ?? '',
      email: prop.email ?? '',
      address: prop.address,
      city: prop.city,
      provinceCode: this.resolveProvinceCodeForProperty(propWithGeo),
      touristZoneSlug: propWithGeo.touristZoneSlug ?? null,
      latitude: propWithGeo.latitude ?? null,
      longitude: propWithGeo.longitude ?? null,
      checkInTime: this.formatTimeToInput(propWithGeo.checkInTime, '14:00'),
      checkOutTime: this.formatTimeToInput(propWithGeo.checkOutTime, '12:00'),
      allowHourlyBooking: prop.allowHourlyBooking,
      allowOvernightBooking: prop.allowOvernightBooking,
      allowDailyBooking: prop.allowDailyBooking,
      isPublished: propWithGeo.isPublished === true,
      isActive: this.resolvePropertyStatusValue(propWithGeo.status, prop.isActive) === 1
    });
    this.propertyForm.markAsPristine();
    this.isModalOpen.set(true);
  }

  private resolveProvinceCodeForProperty(prop: BranchSummaryWithMeta): string {
    const rawCode = prop.provinceCode?.trim();
    if (rawCode) {
      const upper = rawCode.toUpperCase();
      if (LEGACY_PROVINCE_CODE_TO_34[upper]) {
        return LEGACY_PROVINCE_CODE_TO_34[upper];
      }
      if (VIETNAM_34_ADMIN_PROVINCES.some(p => p.code === rawCode)) {
        return rawCode;
      }
    }

    const matchedZone = prop.touristZoneSlug
      ? this.touristZones().find(z => z.slug === prop.touristZoneSlug)
      : undefined;
    const candidates = [matchedZone?.provinceName, prop.city, prop.address].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const norm = removeVietnameseAccents(candidate.toLowerCase());
      for (const [alias, code] of CITY_ALIAS_TO_34) {
        if (norm.includes(alias)) return code;
      }
      const provMatch = VIETNAM_34_ADMIN_PROVINCES.find(p => {
        const cleanProv = removeVietnameseAccents(
          p.name.replace(/^(Thành phố|Tỉnh)\s+/i, '').toLowerCase()
        );
        return norm.includes(cleanProv);
      });
      if (provMatch) return provMatch.code;
    }

    return '79';
  }

  onMapLocationSelected(result: LocationPickerResult): void {
    const currentAddr = String(this.propertyForm.get('address')?.value ?? '').trim();
    const isGpsPlaceholder = result.address.startsWith('Vị trí GPS');
    const patch: {
      latitude: number;
      longitude: number;
      address?: string;
      provinceCode?: string;
    } = {
      latitude: result.latitude,
      longitude: result.longitude,
    };
    if (!isGpsPlaceholder || !currentAddr) {
      patch.address = result.address;
    }
    if (result.provinceCode) {
      patch.provinceCode = result.provinceCode;
    }
    this.propertyForm.patchValue(patch);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  onNameChanged(): void {
    if (!this.isEditing()) {
      const name = this.propertyForm.get('name')?.value || '';
      const autoSlug = this.generateSlug(name);
      this.propertyForm.patchValue({ slug: autoSlug }, { emitEvent: false });
    }
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9 -]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  getFieldError(fieldName: string): string {
    const ctrl = this.propertyForm.get(fieldName);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return '';

    if (ctrl.errors['required']) {
      switch (fieldName) {
        case 'name': return 'Tên chi nhánh không được để trống.';
        case 'code': return 'Mã chi nhánh không được để trống.';
        case 'slug': return 'Đường dẫn định danh (Slug) không được để trống.';
        case 'address': return 'Địa chỉ cụ thể không được để trống.';
        case 'city': return 'Tỉnh / Thành phố không được để trống.';
        case 'propertyType': return 'Vui lòng chọn loại hình cơ sở.';
        case 'checkInTime': return 'Giờ nhận phòng không được để trống.';
        case 'checkOutTime': return 'Giờ trả phòng không được để trống.';
        default: return 'Trường này là bắt buộc.';
      }
    }
    if (ctrl.errors['email']) {
      return 'Email liên hệ không đúng định dạng.';
    }
    if (ctrl.errors['maxlength']) {
      const max = ctrl.errors['maxlength'].requiredLength;
      return `Độ dài không được vượt quá ${max} ký tự.`;
    }
    return '';
  }

  saveProperty(): void {
    if (this.propertyForm.invalid) {
      this.propertyForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formVal = this.propertyForm.value;
    const rawLat = formVal.latitude;
    const rawLng = formVal.longitude;
    const latitude = typeof rawLat === 'number' && Number.isFinite(rawLat) ? rawLat : undefined;
    const longitude = typeof rawLng === 'number' && Number.isFinite(rawLng) ? rawLng : undefined;
    const trimmedPhone = String(formVal.phoneNumber ?? '').trim() || undefined;
    const trimmedEmail = String(formVal.email ?? '').trim() || undefined;
    const starRating = Number(formVal.starRating ?? 0);
    const checkInTime = this.formatTimeToBackend(formVal.checkInTime, '14:00:00');
    const checkOutTime = this.formatTimeToBackend(formVal.checkOutTime, '12:00:00');
    const isPublished = !!formVal.isPublished;

    if (this.isEditing()) {
      const id = this.editingPropertyId();
      if (!id) return;

      const checkInDirty = this.propertyForm.get('checkInTime')?.dirty === true;
      const checkOutDirty = this.propertyForm.get('checkOutTime')?.dirty === true;

      const updateReq: UpdatePropertyPayload = {
        name: formVal.name,
        code: formVal.code.toUpperCase(),
        slug: formVal.slug,
        propertyType: this.normalizePropertyType(formVal.propertyType),
        starRating: Number.isFinite(starRating) ? Math.min(5, Math.max(0, starRating)) : 0,
        phoneNumber: trimmedPhone,
        email: trimmedEmail,
        address: formVal.address,
        city: formVal.city,
        provinceCode: formVal.provinceCode || '79',
        touristZoneSlug: formVal.touristZoneSlug || undefined,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(checkInDirty ? { checkInTime } : {}),
        ...(checkOutDirty ? { checkOutTime } : {}),
        allowHourlyBooking: !!formVal.allowHourlyBooking,
        allowOvernightBooking: !!formVal.allowOvernightBooking,
        allowDailyBooking: !!formVal.allowDailyBooking,
        isPublished,
        status: formVal.isActive === false ? 0 : 1,
        isActive: formVal.isActive !== false
      };

      this.propertyService.updateProperty(id, updateReq).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.propertyForm.markAsPristine();
          this.isModalOpen.set(false);
          this.alertService.toastSuccess(`Chi nhánh ${formVal.name} đã được cập nhật.`, 'Cập nhật thành công');
          this.loadProperties();
          this.authService.fetchMyMemberships().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
        },
        error: (err: HttpErrorPayload) => {
          this.isSubmitting.set(false);
          const msg = err?.error?.message || err?.error?.detail || err?.error?.title || 'Không thể cập nhật chi nhánh. Vui lòng kiểm tra trùng mã hoặc slug.';
          this.alertService.toastError(msg, 'Lỗi cập nhật');
        }
      });
    } else {
      const createReq: CreatePropertyPayload = {
        name: formVal.name,
        code: formVal.code.toUpperCase(),
        slug: formVal.slug,
        propertyType: this.normalizePropertyType(formVal.propertyType),
        starRating: Number.isFinite(starRating) ? Math.min(5, Math.max(0, starRating)) : 0,
        phoneNumber: trimmedPhone,
        email: trimmedEmail,
        address: formVal.address,
        city: formVal.city,
        provinceCode: formVal.provinceCode || '79',
        touristZoneSlug: formVal.touristZoneSlug || undefined,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        checkInTime,
        checkOutTime,
        allowHourlyBooking: !!formVal.allowHourlyBooking,
        allowOvernightBooking: !!formVal.allowOvernightBooking,
        allowDailyBooking: !!formVal.allowDailyBooking,
        isPublished
      };

      this.propertyService.createProperty(createReq).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.propertyForm.markAsPristine();
          this.isModalOpen.set(false);
          this.alertService.toastSuccess(`Chi nhánh ${formVal.name} đã được khởi tạo.`, 'Thêm mới thành công');
          this.loadProperties();
          this.authService.fetchMyMemberships().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
        },
        error: (err: HttpErrorPayload) => {
          this.isSubmitting.set(false);
          const msg = err?.error?.message || err?.error?.detail || err?.error?.title || 'Không thể tạo mới chi nhánh. Vui lòng kiểm tra trùng mã hoặc slug.';
          this.alertService.toastError(msg, 'Lỗi tạo mới');
        }
      });
    }
  }
}
