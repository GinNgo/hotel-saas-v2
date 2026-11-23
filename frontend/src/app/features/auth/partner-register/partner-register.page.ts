import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Password } from 'primeng/password';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { Province, Ward } from '../../../core/models/location.model';
import { HttpErrorResponse } from '@angular/common/http';
import { SearchableSelectComponent, SearchableSelectItem } from '../../../shared/components/searchable-select/searchable-select.component';
import { GoogleMapPickerComponent, LocationPickerResult } from '../../../shared/components/google-map-picker/google-map-picker.component';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';

interface PartnerPropertyTypeOption {
  readonly value: number;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmControl = control.get('confirmPassword');
  const confirmPassword = confirmControl?.value;
  if (!confirmControl) return null;

  if (password && confirmPassword && password !== confirmPassword) {
    const existingErrors = confirmControl.errors ? { ...confirmControl.errors } : {};
    existingErrors['passwordMismatch'] = true;
    confirmControl.setErrors(existingErrors);
    return { passwordMismatch: true };
  }

  if (confirmControl.hasError('passwordMismatch')) {
    const { passwordMismatch: _removed, ...rest } = confirmControl.errors ?? {};
    confirmControl.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
  return null;
}

/**
 * Trang Đăng ký Đối tác Mở Khách sạn & Nâng cấp Chủ Khách sạn
 * Tích hợp Google Maps Places, Bản đồ vị trí tương tác và Bộ chọn 34 Tỉnh/Thành phố (mô hình 2 cấp) thông minh.
 */
@Component({
  selector: 'app-partner-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    Password,
    SearchableSelectComponent,
    GoogleMapPickerComponent
  ],
  template: `
    <div class="w-full max-w-4xl mx-auto py-6 px-4">
      <!-- Header Tinh Gọn -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-2">
          <i class="pi pi-building"></i>
          <span>Dành Cho Chủ Khách Sạn & Đối Tác</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          {{ isAuthenticated() ? 'Nâng Cấp Tài Khoản Mở Khách Sạn' : 'Đăng Ký Đối Tác Mở Khách Sạn' }}
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl mx-auto">
          {{ isAuthenticated()
              ? 'Tài khoản của bạn sẽ được cấp quyền Quản lý Khách sạn. Hoàn tất vị trí để bắt đầu vận hành.'
              : 'Gia nhập nền tảng quản trị khách sạn hiện đại. Thiết lập cơ sở lưu trú và định vị trên bản đồ chỉ trong 2 phút.' }}
        </p>
      </div>

      @if (isAuthenticated()) {
        <div class="mb-5 p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200/90 text-indigo-950 text-xs sm:text-sm shadow-2xs flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
              <i class="pi pi-user-check text-sm"></i>
            </div>
            <div>
              <span class="font-bold text-slate-800">Tài khoản khách hàng: </span>
              <span class="text-indigo-700 font-medium">{{ currentEmail() }}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 bg-indigo-200 text-indigo-900 text-xs font-bold rounded-md shrink-0">
            Đã đăng nhập
          </span>
        </div>
      }

      @if (errorMessage()) {
        <div class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5 shadow-2xs">
          <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5 shrink-0"></i>
          <div>
            <span class="font-bold">Chưa thể hoàn tất đăng ký:</span>
            <p class="mt-0.5">{{ errorMessage() }}</p>
          </div>
        </div>
      }

      @if (successMessage()) {
        <div class="mb-5 p-6 sm:p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-sm flex flex-col items-center text-center">
          <i class="pi pi-check-circle text-4xl text-emerald-600 mb-2"></i>
          <h2 class="font-bold text-lg text-emerald-900">Chúc mừng bạn đã hoàn tất đăng ký đối tác!</h2>
          <p class="mt-1 text-emerald-700 max-w-lg">{{ successMessage() }}</p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              [routerLink]="registeredPropertySlug() ? ['/booking/properties', registeredPropertySlug()] : ['/booking/explore']"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow transition-colors flex items-center gap-2"
            >
              <i class="pi pi-external-link"></i>
              Xem cơ sở vừa đăng ký trên Cổng Đặt Phòng
            </a>
            <a
              routerLink="/login"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition-colors flex items-center gap-2"
            >
              <i class="pi pi-sign-in"></i>
              Đăng nhập trang Quản trị PMS
            </a>
          </div>
          @if (registeredTenantSlug()) {
            <a
              [routerLink]="['/booking/brands', registeredTenantSlug()]"
              class="mt-3 min-h-11 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-indigo-700 hover:underline"
            >
              <span>Xem trang thương hiệu đối tác</span>
              <i class="pi pi-arrow-right text-[10px]"></i>
            </a>
          }
        </div>
      } @else {
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Hàng 1: Hai cột cân xứng - Thông tin người đại diện & Thông tin cơ sở -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <!-- Cột 1: Thông tin Đại diện Chủ sở hữu -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4.5 flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                  <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <i class="pi pi-user"></i>
                  </div>
                  <div>
                    <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider">1. Thông tin Chủ sở hữu</h3>
                    <p class="text-[11px] text-slate-400">Người đại diện pháp lý và nhận thông báo vận hành</p>
                  </div>
                </div>

                <div class="space-y-3.5">
                  <!-- Full Name Field -->
                  <div>
                    <label for="fullName" class="block text-xs font-semibold text-slate-700 mb-1">
                      Họ và tên người đại diện <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      formControlName="fullName"
                      placeholder="Ví dụ: Nguyễn Văn Hoàng"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                      [class.border-rose-400]="isFieldInvalid('fullName')"
                      [class.ring-2]="isFieldInvalid('fullName')"
                      [class.ring-rose-100]="isFieldInvalid('fullName')"
                    />
                    @if (isFieldInvalid('fullName')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng nhập họ và tên của bạn.
                      </p>
                    }
                  </div>

                  <!-- Email Field -->
                  <div>
                    <label for="email" class="block text-xs font-semibold text-slate-700 mb-1">
                      Email liên hệ &amp; đăng nhập <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      formControlName="email"
                      [readonly]="isAuthenticated()"
                      placeholder="chu.khachsan@example.com"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                      [class.bg-slate-100]="isAuthenticated()"
                      [class.border-rose-400]="isFieldInvalid('email')"
                      [class.ring-2]="isFieldInvalid('email')"
                      [class.ring-rose-100]="isFieldInvalid('email')"
                    />
                    @if (isFieldInvalid('email')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng nhập địa chỉ email hợp lệ.
                      </p>
                    }
                  </div>

                  <!-- Phone Field -->
                  <div>
                    <label for="phoneNumber" class="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại liên hệ <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="phoneNumber"
                      type="tel"
                      formControlName="phoneNumber"
                      placeholder="0912345678"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                      [class.border-rose-400]="isFieldInvalid('phoneNumber')"
                      [class.ring-2]="isFieldInvalid('phoneNumber')"
                      [class.ring-rose-100]="isFieldInvalid('phoneNumber')"
                    />
                    @if (isFieldInvalid('phoneNumber')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng nhập số điện thoại liên hệ.
                      </p>
                    }
                  </div>

                  <!-- Password Fields (Chỉ hiển thị với khách chưa đăng nhập) -->
                  @if (!isAuthenticated()) {
                    <div>
                      <label for="password" class="block text-xs font-semibold text-slate-700 mb-1">
                        Mật khẩu tài khoản <span class="text-rose-500">*</span>
                      </label>
                      <p-password
                        id="password"
                        formControlName="password"
                        [feedback]="true"
                        [toggleMask]="true"
                        placeholder="Tối thiểu 8 ký tự"
                        promptLabel="Nhập mật khẩu an toàn"
                        weakLabel="Yếu"
                        mediumLabel="Trung bình"
                        strongLabel="Mạnh"
                        styleClass="w-full"
                        inputStyleClass="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      @if (isFieldInvalid('password')) {
                        <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                          <i class="pi pi-exclamation-circle text-[10px]"></i> Mật khẩu tối thiểu phải từ 8 ký tự.
                        </p>
                      }
                    </div>

                    <div>
                      <label for="confirmPassword" class="block text-xs font-semibold text-slate-700 mb-1">
                        Xác nhận mật khẩu <span class="text-rose-500">*</span>
                      </label>
                      <p-password
                        id="confirmPassword"
                        formControlName="confirmPassword"
                        [feedback]="false"
                        [toggleMask]="true"
                        placeholder="Nhập lại chính xác mật khẩu"
                        styleClass="w-full"
                        inputStyleClass="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      @if (registerForm.get('confirmPassword')?.touched && registerForm.get('confirmPassword')?.errors?.['passwordMismatch']) {
                        <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                          <i class="pi pi-exclamation-circle text-[10px]"></i> Mật khẩu xác nhận không khớp.
                        </p>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-slate-400 text-[11px]">
                <i class="pi pi-shield text-indigo-500"></i>
                <span>Mọi dữ liệu được bảo mật chuẩn mã hóa đa tầng Multi-Tenant</span>
              </div>
            </div>

            <!-- Cột 2: Thông tin Cơ sở lưu trú -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4.5 flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                  <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <i class="pi pi-building"></i>
                  </div>
                  <div>
                    <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider">2. Thông tin Cơ sở Lưu trú</h3>
                    <p class="text-[11px] text-slate-400">Tên thương hiệu và địa chỉ hành chính của khách sạn</p>
                  </div>
                </div>

                <div class="space-y-3.5">
                  <!-- Brand Name Field -->
                  <div>
                    <label for="brandName" class="block text-xs font-semibold text-slate-700 mb-1">
                      Tên hệ thống / Chuỗi thương hiệu <span class="text-slate-400 font-normal">(Tùy chọn)</span>
                    </label>
                    <input
                      id="brandName"
                      type="text"
                      formControlName="brandName"
                      placeholder="Ví dụ: Anantara Hospitality Group"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                    />
                    <p class="text-[11px] text-slate-400 mt-1">
                      Nếu là cơ sở độc lập, có thể để trống hoặc trùng tên cơ sở.
                    </p>
                  </div>

                  <!-- Property Name Field -->
                  <div>
                    <label for="propertyName" class="block text-xs font-semibold text-slate-700 mb-1">
                      Tên Khách sạn / Homestay / Resort <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="propertyName"
                      type="text"
                      formControlName="propertyName"
                      placeholder="Ví dụ: Khách Sạn Biển Xanh Grand"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                      [class.border-rose-400]="isFieldInvalid('propertyName')"
                      [class.ring-2]="isFieldInvalid('propertyName')"
                      [class.ring-rose-100]="isFieldInvalid('propertyName')"
                    />
                    @if (isFieldInvalid('propertyName')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng nhập tên khách sạn hoặc cơ sở lưu trú.
                      </p>
                    }
                  </div>

                  <!-- Tỉnh / Thành phố Searchable Dropdown (Đủ 34 tỉnh thành 2 cấp có tìm kiếm) -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label for="provinceCode" class="block text-xs font-semibold text-slate-700">
                        Tỉnh / Thành phố (34 đơn vị) <span class="text-rose-500">*</span>
                      </label>
                      <span class="text-[10px] text-indigo-600 font-medium">Tìm kiếm nhanh</span>
                    </div>
                    <app-searchable-select
                      [items]="provinceItems()"
                      placeholder="-- Chọn hoặc gõ tìm Tỉnh / Thành phố --"
                      searchPlaceholder="Tìm theo tên tỉnh/thành phố..."
                      formControlName="provinceCode"
                      [invalid]="isFieldInvalid('provinceCode')"
                      (selectionChange)="onProvinceChange($event)"
                    />
                    @if (isFieldInvalid('provinceCode')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng chọn Tỉnh/Thành phố nơi khách sạn tọa lạc.
                      </p>
                    }
                  </div>

                  <!-- Phường / Xã / Đặc khu Searchable Dropdown -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label for="wardCode" class="block text-xs font-semibold text-slate-700">
                        Phường / Xã / Đặc khu <span class="text-rose-500">*</span>
                      </label>
                      @if (wardsLoading()) {
                        <span class="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                          <i class="pi pi-spin pi-spinner text-xs"></i> Đang tải...
                        </span>
                      }
                    </div>
                    <app-searchable-select
                      [items]="wardItems()"
                      [placeholder]="selectedProvinceCode ? '-- Chọn hoặc gõ tìm Phường / Xã / Đặc khu --' : '-- Chọn Tỉnh/Thành trước --'"
                      searchPlaceholder="Tìm kiếm phường, xã, đặc khu..."
                      formControlName="wardCode"
                      [loading]="wardsLoading()"
                      [invalid]="isFieldInvalid('wardCode')"
                    />
                    @if (!selectedProvinceCode) {
                      <p class="text-[11px] text-slate-400 mt-1">Hãy chọn Tỉnh/Thành phố trước để tải danh sách Phường / Xã / Đặc khu.</p>
                    } @else if (isFieldInvalid('wardCode')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng chọn Phường / Xã / Đặc khu.
                      </p>
                    }
                  </div>

                  <!-- Street Address Field -->
                  <div>
                    <label for="address" class="block text-xs font-semibold text-slate-700 mb-1">
                      Địa chỉ số nhà, tên đường chi tiết <span class="text-rose-500">*</span>
                    </label>
                    <input
                      id="address"
                      type="text"
                      formControlName="address"
                      placeholder="Ví dụ: 123 Võ Nguyên Giáp"
                      class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                      [class.border-rose-400]="isFieldInvalid('address')"
                      [class.ring-2]="isFieldInvalid('address')"
                      [class.ring-rose-100]="isFieldInvalid('address')"
                    />
                    @if (isFieldInvalid('address')) {
                      <p class="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle text-[10px]"></i> Vui lòng nhập địa chỉ chi tiết số nhà, tên đường.
                      </p>
                    }
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-slate-400 text-[11px]">
                <i class="pi pi-check-circle text-emerald-500"></i>
                <span>Tự động phân bổ mã phòng và chuỗi hợp đồng sau khi kích hoạt</span>
              </div>
            </div>
          </div>

          <!-- Phần 3: Loại hình Cơ sở & Hạng sao -->
          <div class="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <i class="pi pi-th-large"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider">3. Loại hình Cơ sở &amp; Hạng sao</h3>
                  <p class="text-[11px] text-slate-500">Chọn đúng mô hình lưu trú để hiển thị chính xác trên cổng đặt phòng công khai</p>
                </div>
              </div>

              <!-- Hạng sao selector -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-slate-700 mr-1">Hạng sao:</span>
                @for (star of starRatingOptions; track star) {
                  <button
                    type="button"
                    (click)="selectStarRating(star)"
                    [attr.aria-label]="'Chọn hạng ' + star + ' sao'"
                    class="min-h-11 min-w-11 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1"
                    [class]="registerForm.get('starRating')?.value === star
                      ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-300'"
                  >
                    <span>{{ star }}</span>
                    <i class="pi pi-star-fill text-[10px]"></i>
                  </button>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Chọn loại hình cơ sở lưu trú">
              @for (opt of propertyTypeOptions; track opt.value) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="registerForm.get('propertyType')?.value === opt.value"
                  (click)="selectPropertyType(opt.value)"
                  class="text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5"
                  [class]="registerForm.get('propertyType')?.value === opt.value
                    ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'"
                >
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    [class]="registerForm.get('propertyType')?.value === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'"
                  >
                    <i [class]="'pi ' + opt.icon + ' text-xs'"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-slate-900">{{ opt.label }}</div>
                    <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">{{ opt.description }}</p>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Phần 4: Cấu hình Giá & Hình thức Đặt phòng ban đầu -->
          <div class="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <i class="pi pi-wallet"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider">4. Cấu hình Giá &amp; Hình thức Đặt phòng</h3>
                  <p class="text-[11px] text-slate-500">Thiết lập mức giá khởi tạo giúp cơ sở hiển thị giá minh bạch ngay sau khi tạo</p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:border-indigo-300 transition-colors">
                <input type="checkbox" formControlName="allowDailyBooking" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="block text-xs font-bold text-slate-800">Nhận đặt theo ngày</span>
                  <span class="block text-[11px] text-slate-500">Check-in 14:00, trả 12:00</span>
                </div>
              </label>

              <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:border-indigo-300 transition-colors">
                <input type="checkbox" formControlName="allowOvernightBooking" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="block text-xs font-bold text-slate-800">Nhận đặt qua đêm</span>
                  <span class="block text-[11px] text-slate-500">Nghỉ đêm linh hoạt từ 21:00</span>
                </div>
              </label>

              <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:border-indigo-300 transition-colors">
                <input type="checkbox" formControlName="allowHourlyBooking" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="block text-xs font-bold text-slate-800">Nhận đặt theo giờ</span>
                  <span class="block text-[11px] text-slate-500">Tối ưu công suất phòng trống</span>
                </div>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label for="defaultNightlyPrice" class="block text-xs font-semibold text-slate-700 mb-1">
                  Giá khởi điểm theo đêm / ngày (VNĐ)
                </label>
                <input
                  id="defaultNightlyPrice"
                  type="number"
                  min="0"
                  step="10000"
                  formControlName="defaultNightlyPrice"
                  placeholder="500000"
                  class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                />
              </div>

              <div>
                <label for="defaultHourlyPrice" class="block text-xs font-semibold text-slate-700 mb-1">
                  Giá khởi điểm theo giờ (VNĐ)
                </label>
                <input
                  id="defaultHourlyPrice"
                  type="number"
                  min="0"
                  step="10000"
                  formControlName="defaultHourlyPrice"
                  placeholder="150000"
                  class="w-full h-10 sm:h-11 text-xs sm:text-sm px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Phần 5: Định vị Google Maps (Trải rộng toàn màn hình, cân đối, thoáng đãng) -->
          <div class="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                  <i class="pi pi-map-marker"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider">5. Định Vị Bản Đồ Google Maps</h3>
                  <p class="text-[11px] text-slate-500">Tìm kiếm hoặc chọn địa điểm trên bản đồ để tự động điền địa chỉ &amp; lưu tọa độ GPS chính xác</p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (selectedLatitude() !== null && selectedLongitude() !== null) {
                  <span class="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 shrink-0 inline-flex items-center gap-1">
                    <i class="pi pi-compass text-[10px]"></i>
                    {{ selectedLatitude() | number:'1.4-4' }}, {{ selectedLongitude() | number:'1.4-4' }}
                  </span>
                }
                <span class="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0 inline-flex items-center gap-1">
                  <i class="pi pi-sparkles text-[10px]"></i> Tự động điền biểu mẫu
                </span>
              </div>
            </div>

            <app-google-map-picker
              [initialAddress]="registerForm.get('address')?.value || ''"
              (locationSelected)="onGoogleMapLocationSelected($event)"
            />
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              [disabled]="isLoading() || registerForm.invalid"
              class="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
            >
              @if (isLoading()) {
                <i class="pi pi-spin pi-spinner text-lg"></i>
                <span>Đang khởi tạo khách sạn của bạn...</span>
              } @else {
                <i class="pi pi-building text-base"></i>
                <span>{{ isAuthenticated() ? 'Xác Nhận Nâng Cấp & Mở Khách Sạn' : 'Đăng Ký & Thiết Lập Khách Sạn Ngay' }}</span>
              }
            </button>
          </div>
        </form>
      }

      <div class="text-center mt-6 text-xs text-slate-500 space-y-1.5">
        <div>
          <span>Đã có tài khoản? </span>
          <a routerLink="/login" class="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Đăng nhập ngay
          </a>
        </div>
        <div>
          Quay lại cổng đặt phòng?
          <a routerLink="/booking" class="text-indigo-600 font-semibold hover:underline ml-1">
            Trang chủ đặt phòng
          </a>
        </div>
      </div>
    </div>
  `
})
export class PartnerRegisterPage implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly destroyRef = inject(DestroyRef);

  hasUnsavedChanges(): boolean {
    return this.registerForm.dirty && !this.successMessage();
  }

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly registeredPropertySlug = signal('');
  readonly registeredTenantSlug = signal('');
  readonly selectedLatitude = signal<number | null>(null);
  readonly selectedLongitude = signal<number | null>(null);
  readonly provinces = signal<Province[]>([]);
  readonly wards = signal<Ward[]>([]);
  readonly wardsLoading = signal(false);

  readonly isAuthenticated = signal(false);
  readonly currentEmail = signal('');
  readonly currentFullName = signal('');

  /** Matches backend C# HotelSaas.Domain.Enums.PropertyType (1-based). */
  readonly propertyTypeOptions: readonly PartnerPropertyTypeOption[] = [
    { value: 1, label: 'Khách sạn (Hotel)', description: 'Phòng tiêu chuẩn, khách sạn phố, boutique hotel', icon: 'pi-building' },
    { value: 2, label: 'Resort nghỉ dưỡng', description: 'Khu nghỉ dưỡng biển, núi, sinh thái cao cấp', icon: 'pi-sun' },
    { value: 8, label: 'Homestay', description: 'Không gian bản địa, lưu trú gần gũi ấm cúng', icon: 'pi-home' },
    { value: 5, label: 'Biệt thự / Villa', description: 'Villa nguyên căn, nghỉ dưỡng gia đình & nhóm bạn', icon: 'pi-star' },
    { value: 6, label: 'Căn hộ dịch vụ (Apartment)', description: 'Studio, căn hộ du lịch đầy đủ bếp & tiện nghi', icon: 'pi-key' },
    { value: 7, label: 'Nhà nghỉ / Motel', description: 'Thuận tiện qua đêm, thuê giờ linh hoạt & dừng chân', icon: 'pi-moon' },
    { value: 3, label: 'Hostel / Dorm', description: 'Giường tầng cộng đồng, tiết kiệm cho khách trẻ', icon: 'pi-users' },
    { value: 4, label: 'Bed & Breakfast / Nhà khách', description: 'Lưu trú kèm bữa sáng, nhà khách quy mô vừa', icon: 'pi-coffee' },
  ];

  readonly starRatingOptions: readonly number[] = [1, 2, 3, 4, 5];

  registerForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    phoneNumber: ['', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    confirmPassword: ['', [Validators.required]],
    brandName: ['', [Validators.maxLength(150)]],
    propertyName: ['', [Validators.required, Validators.maxLength(200)]],
    propertyType: [1, [Validators.required]],
    starRating: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    provinceCode: ['', [Validators.required]],
    wardCode: ['', [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(300)]],
    allowDailyBooking: [true],
    allowOvernightBooking: [true],
    allowHourlyBooking: [true],
    defaultNightlyPrice: [500000, [Validators.min(0)]],
    defaultHourlyPrice: [150000, [Validators.min(0)]],
  }, { validators: passwordMatchValidator });

  get selectedProvinceCode(): string {
    return this.registerForm.get('provinceCode')?.value || '';
  }

  readonly provinceItems = computed<SearchableSelectItem[]>(() => {
    return this.provinces().map(p => ({
      value: p.code,
      label: p.name,
      badge: p.type === 'thành phố trung ương' ? 'Đô thị TW' : undefined
    }));
  });

  readonly wardItems = computed<SearchableSelectItem[]>(() => {
    return this.wards().map(w => ({
      value: w.code,
      label: w.name,
      subLabel: w.type
    }));
  });

  ngOnInit(): void {
    this.registerForm.get('wardCode')?.disable();
    this.checkAuthenticatedStatus();
    this.loadProvinces();
  }

  private checkAuthenticatedStatus(): void {
    if (this.authService.isLoggedIn) {
      this.isAuthenticated.set(true);
      const user = this.authService.currentUser;
      if (user) {
        this.currentEmail.set(user.email);
        this.currentFullName.set(user.fullName || '');
        this.registerForm.patchValue({
          fullName: user.fullName || '',
          email: user.email
        });
      }

      // Remove password requirement for authenticated users
      const pwd = this.registerForm.get('password');
      const confirmPwd = this.registerForm.get('confirmPassword');
      pwd?.clearValidators();
      confirmPwd?.clearValidators();
      pwd?.updateValueAndValidity();
      confirmPwd?.updateValueAndValidity();
      this.registerForm.clearValidators();
      this.registerForm.updateValueAndValidity();
    }
  }

  loadProvinces(): void {
    this.locationService.getProvinces().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.provinces.set(list);
      },
      error: () => {
        this.errorMessage.set('Không thể tải danh mục Tỉnh/Thành phố. Vui lòng tải lại trang.');
      }
    });
  }

  onProvinceChange(code?: string): void {
    const provinceCode = code !== undefined ? code : this.selectedProvinceCode;
    this.registerForm.patchValue({ wardCode: '' });
    this.wards.set([]);

    if (!provinceCode) {
      this.registerForm.get('wardCode')?.disable();
      return;
    }

    this.registerForm.get('wardCode')?.enable();
    this.wardsLoading.set(true);
    this.locationService.getWards(provinceCode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.wards.set(list);
        this.wardsLoading.set(false);
      },
      error: () => {
        this.wardsLoading.set(false);
        this.errorMessage.set('Không thể tải danh sách Phường / Xã / Đặc khu cho tỉnh/thành đã chọn.');
      }
    });
  }

  selectPropertyType(propertyType: number): void {
    this.registerForm.patchValue({ propertyType });
  }

  selectStarRating(starRating: number): void {
    this.registerForm.patchValue({ starRating });
  }

  onGoogleMapLocationSelected(result: LocationPickerResult): void {
    if (Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
      this.selectedLatitude.set(result.latitude);
      this.selectedLongitude.set(result.longitude);
    }

    if (result.address) {
      this.registerForm.patchValue({ address: result.address });
    }

    const matchedByCode = result.provinceCode
      ? this.provinces().find(p => p.code === result.provinceCode)
      : undefined;

    if (matchedByCode) {
      this.registerForm.patchValue({ provinceCode: matchedByCode.code });
      this.onProvinceChange(matchedByCode.code);
    } else if (result.provinceName) {
      const match = this.locationService.findProvinceByKeyword(result.provinceName, this.provinces());
      if (match) {
        this.registerForm.patchValue({ provinceCode: match.code });
        this.onProvinceChange(match.code);
      }
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.registeredPropertySlug.set('');
    this.registeredTenantSlug.set('');

    const formVal = this.registerForm.getRawValue();
    const nightlyPrice = Number(formVal.defaultNightlyPrice);
    const hourlyPrice = Number(formVal.defaultHourlyPrice);

    this.authService.partnerRegister({
      fullName: formVal.fullName || '',
      email: formVal.email || '',
      password: this.isAuthenticated() ? '' : (formVal.password || ''),
      phoneNumber: formVal.phoneNumber || '',
      brandName: formVal.brandName?.trim() || null,
      propertyName: formVal.propertyName || '',
      propertyType: formVal.propertyType ?? 1,
      starRating: formVal.starRating ?? 3,
      provinceCode: formVal.provinceCode || '',
      wardCode: formVal.wardCode || null,
      address: formVal.address || '',
      latitude: this.selectedLatitude(),
      longitude: this.selectedLongitude(),
      allowDailyBooking: formVal.allowDailyBooking ?? true,
      allowOvernightBooking: formVal.allowOvernightBooking ?? true,
      allowHourlyBooking: formVal.allowHourlyBooking ?? true,
      defaultNightlyPrice: Number.isFinite(nightlyPrice) && nightlyPrice > 0 ? nightlyPrice : null,
      defaultHourlyPrice: Number.isFinite(hourlyPrice) && hourlyPrice > 0 ? hourlyPrice : null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.registeredPropertySlug.set(res.data?.propertySlug || '');
        this.registeredTenantSlug.set(res.data?.tenantSlug || '');
        this.successMessage.set(
          res.data?.message || 'Khách sạn của bạn đã được khởi tạo thành công trên hệ thống!'
        );
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 409) {
          this.errorMessage.set('Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.');
        } else if (err.error?.message) {
          this.errorMessage.set(err.error.message);
        } else {
          this.errorMessage.set('Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại sau.');
        }
      }
    });
  }
}
