import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
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
  FormControlDirective
} from '../../shared';

@Component({
  selector: 'app-properties-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    FormFieldComponent,
    FormControlDirective
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
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
        >
          <i class="pi pi-plus text-xs"></i>
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
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <!-- Search input -->
          <div class="relative flex-1 max-w-md">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Tìm theo tên chi nhánh, mã, địa chỉ, thành phố..."
              class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          <!-- Active branch switch reminder badge -->
          <div class="text-xs text-slate-500 flex items-center gap-1.5 self-end sm:self-center">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Chi nhánh đang chọn: </span>
            <strong class="text-slate-800">{{ authService.activePropertyName() || 'Chưa chọn' }}</strong>
          </div>
        </div>

        <!-- Property Type Filter Chips -->
        <div class="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span class="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Loại hình:</span>
          <button
            type="button"
            (click)="selectedType.set('ALL')"
            [ngClass]="selectedType() === 'ALL' ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            Tất cả ({{ totalProperties() }})
          </button>
          <button
            type="button"
            (click)="selectedType.set(1)"
            [ngClass]="selectedType() === 1 ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            🏨 Khách sạn (Hotel)
          </button>
          <button
            type="button"
            (click)="selectedType.set(3)"
            [ngClass]="selectedType() === 3 ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            🏡 Nhà nghỉ (Guesthouse)
          </button>
          <button
            type="button"
            (click)="selectedType.set(2)"
            [ngClass]="selectedType() === 2 ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            ⚡ Motel
          </button>
          <button
            type="button"
            (click)="selectedType.set(4)"
            [ngClass]="selectedType() === 4 ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            🌿 Homestay
          </button>
          <button
            type="button"
            (click)="selectedType.set(5)"
            [ngClass]="selectedType() === 5 ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            class="px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            🏖️ Resort
          </button>
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
                        [status]="prop.propertyTypeName"
                        type="custom"
                        [customLabel]="prop.propertyTypeName"
                        [color]="getPropertyTypeColor(prop.propertyType)"
                      />
                      @if (authService.activePropertyId() === prop.id) {
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Đang làm việc
                        </span>
                      }
                    </div>
                    <h3 class="text-base font-bold text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">
                      {{ prop.name }}
                    </h3>
                  </div>

                  <button
                    type="button"
                    (click)="openEditModal(prop)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Chỉnh sửa thông tin chi nhánh"
                  >
                    <i class="pi pi-pencil text-sm"></i>
                  </button>
                </div>

                <!-- Location Info -->
                <div class="text-xs text-slate-500 space-y-1">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-map-marker text-slate-400 text-xs shrink-0"></i>
                    <span class="truncate">{{ prop.address }}, {{ prop.city }}</span>
                  </div>
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
                <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div class="bg-slate-50 rounded-xl p-2">
                    <span class="block text-[10px] text-slate-400 font-medium uppercase">Tổng phòng</span>
                    <span class="text-sm font-bold text-slate-800">{{ prop.totalRooms }}</span>
                  </div>
                  <div class="bg-amber-50/70 rounded-xl p-2">
                    <span class="block text-[10px] text-amber-700 font-medium uppercase">Có khách</span>
                    <span class="text-sm font-bold text-amber-800">{{ prop.occupiedRooms }}</span>
                  </div>
                  <div class="bg-emerald-50/70 rounded-xl p-2">
                    <span class="block text-[10px] text-emerald-700 font-medium uppercase">Hôm nay</span>
                    <span class="text-xs font-bold text-emerald-800">{{ prop.todayRevenue | number:'1.0-0' }}₫</span>
                  </div>
                </div>
              </div>

              <!-- Card Action Footer -->
              <div class="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  (click)="openEditModal(prop)"
                  class="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Cấu hình
                </button>
                <button
                  type="button"
                  (click)="switchToProperty(prop)"
                  [ngClass]="authService.activePropertyId() === prop.id ? 'bg-slate-200 text-slate-500 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'"
                  class="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold shadow-2xs transition-colors text-center"
                >
                  {{ authService.activePropertyId() === prop.id ? 'Đang chọn' : 'Vào quản lý' }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create / Edit Property Modal Dialog -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-2xl w-full p-6 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <i class="pi pi-building text-sm"></i>
                </div>
                <span>{{ isEditing() ? 'Cập nhật Thông tin Chi nhánh' : 'Thêm Chi nhánh Mới' }}</span>
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Thiết lập thông tin nhận diện, địa chỉ hành chính, khu vực du lịch và hình thức cho thuê.
              </p>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
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
                    <option [ngValue]="1">🏨 Khách sạn (Hotel)</option>
                    <option [ngValue]="3">🏡 Nhà nghỉ (Guesthouse)</option>
                    <option [ngValue]="2">⚡ Motel</option>
                    <option [ngValue]="4">🌿 Homestay</option>
                    <option [ngValue]="5">🏖️ Resort</option>
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
                    placeholder="VN-35, VN-43, VN-SG..."
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs focus:outline-hidden bg-white"
                  />
                </app-form-field>
              </div>
            </div>

            <!-- Row 5: Booking Models Options Checkboxes -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span class="block text-xs font-bold text-slate-800">Hình thức kinh doanh được phép mở bán Online:</span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none p-1.5 rounded-lg hover:bg-white transition-colors">
                  <input type="checkbox" formControlName="allowDailyBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Theo Ngày (Daily)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none p-1.5 rounded-lg hover:bg-white transition-colors">
                  <input type="checkbox" formControlName="allowHourlyBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Theo Giờ (Hourly)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none p-1.5 rounded-lg hover:bg-white transition-colors">
                  <input type="checkbox" formControlName="allowOvernightBooking" class="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span>Qua Đêm (Overnight)</span>
                </label>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closeModal()"
                class="px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                [disabled]="propertyForm.invalid || isSubmitting()"
                class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-xs"></i>
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
export class PropertiesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly publicBookingService = inject(PublicBookingService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  properties = signal<TenantPropertySummaryDto[]>([]);
  touristZones = signal<TouristZoneDto[]>([]);
  landmarks = signal<LandmarkDto[]>([]);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedType = signal<number | 'ALL'>('ALL');

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  editingPropertyId = signal<string | null>(null);

  propertyForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    slug: ['', [Validators.required, Validators.maxLength(100)]],
    propertyType: [1, [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(200)]],
    city: ['', [Validators.required, Validators.maxLength(50)]],
    provinceCode: ['VN-SG'],
    touristZoneSlug: [null],
    allowHourlyBooking: [true],
    allowOvernightBooking: [true],
    allowDailyBooking: [true],
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
      list = list.filter(p => p.propertyType === type);
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

  loadProperties(): void {
    this.isLoading.set(true);
    this.propertyService.getTenantProperties().subscribe({
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
    this.publicBookingService.getTouristZones().subscribe({
      next: (zones) => this.touristZones.set(zones || []),
      error: () => {}
    });
  }

  getPropertyTypeColor(type: number): 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate' {
    switch (type) {
      case 1: return 'blue';
      case 2: return 'amber';
      case 3: return 'rose';
      case 4: return 'emerald';
      case 5: return 'purple';
      default: return 'slate';
    }
  }

  switchToProperty(prop: TenantPropertySummaryDto): void {
    this.authService.setActivePropertyContext(prop.id, prop.name, prop.code);
    this.alertService.toastSuccess(`Bạn đang làm việc tại: ${prop.name} (${prop.code})`, 'Đã đổi chi nhánh');
    this.router.navigate(['/rooms']);
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingPropertyId.set(null);
    this.propertyForm.reset({
      name: '',
      code: '',
      slug: '',
      propertyType: 1,
      address: '',
      city: '',
      provinceCode: 'VN-SG',
      touristZoneSlug: null,
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: true,
      isActive: true
    });
    this.isModalOpen.set(true);
  }

  openEditModal(prop: TenantPropertySummaryDto): void {
    this.isEditing.set(true);
    this.editingPropertyId.set(prop.id);
    this.propertyForm.patchValue({
      name: prop.name,
      code: prop.code,
      slug: prop.slug,
      propertyType: prop.propertyType || 1,
      address: prop.address,
      city: prop.city,
      provinceCode: 'VN-SG',
      touristZoneSlug: null,
      allowHourlyBooking: prop.allowHourlyBooking,
      allowOvernightBooking: prop.allowOvernightBooking,
      allowDailyBooking: prop.allowDailyBooking,
      isActive: prop.isActive
    });
    this.isModalOpen.set(true);
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
        default: return 'Trường này là bắt buộc.';
      }
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

    if (this.isEditing()) {
      const id = this.editingPropertyId();
      if (!id) return;

      const updateReq: UpdatePropertyRequest = {
        name: formVal.name,
        code: formVal.code.toUpperCase(),
        slug: formVal.slug,
        propertyType: formVal.propertyType,
        address: formVal.address,
        city: formVal.city,
        provinceCode: formVal.provinceCode || 'VN-SG',
        touristZoneSlug: formVal.touristZoneSlug || undefined,
        allowHourlyBooking: !!formVal.allowHourlyBooking,
        allowOvernightBooking: !!formVal.allowOvernightBooking,
        allowDailyBooking: !!formVal.allowDailyBooking,
        isActive: formVal.isActive !== false
      };

      this.propertyService.updateProperty(id, updateReq).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalOpen.set(false);
          this.alertService.toastSuccess(`Chi nhánh ${formVal.name} đã được cập nhật.`, 'Cập nhật thành công');
          this.loadProperties();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.alertService.toastError('Không thể cập nhật chi nhánh. Vui lòng kiểm tra trùng mã hoặc slug.', 'Lỗi cập nhật');
        }
      });
    } else {
      const createReq: CreatePropertyRequest = {
        name: formVal.name,
        code: formVal.code.toUpperCase(),
        slug: formVal.slug,
        propertyType: formVal.propertyType,
        address: formVal.address,
        city: formVal.city,
        provinceCode: formVal.provinceCode || 'VN-SG',
        touristZoneSlug: formVal.touristZoneSlug || undefined,
        allowHourlyBooking: !!formVal.allowHourlyBooking,
        allowOvernightBooking: !!formVal.allowOvernightBooking,
        allowDailyBooking: !!formVal.allowDailyBooking
      };

      this.propertyService.createProperty(createReq).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalOpen.set(false);
          this.alertService.toastSuccess(`Chi nhánh ${formVal.name} đã được khởi tạo.`, 'Thêm mới thành công');
          this.loadProperties();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.alertService.toastError('Không thể tạo mới chi nhánh. Vui lòng kiểm tra trùng mã hoặc slug.', 'Lỗi tạo mới');
        }
      });
    }
  }
}
