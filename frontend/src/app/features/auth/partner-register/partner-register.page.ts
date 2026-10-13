import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { Province, Ward } from '../../../core/models/location.model';
import { HttpErrorResponse } from '@angular/common/http';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

/**
 * Trang Đăng ký Đối tác Mở Khách sạn (Partner Hotel Registration & Customer Upgrade).
 * Hỗ trợ 2 luồng:
 * 1. Khách vãng lai (Guest): Tạo tài khoản mới + Cơ sở lưu trú.
 * 2. Khách hàng đã đăng nhập (Customer Upgrade): Tự động nạp profile, bỏ qua mật khẩu, nâng cấp trực tiếp lên Hotel Owner.
 */
@Component({
  selector: 'app-partner-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    InputText
  ],
  template: `
    <div class="w-full max-w-4xl mx-auto py-4">
      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
          <i class="pi pi-building"></i>
          Dành Cho Chủ Cơ Sở Lưu Trú & Đối Tác
        </div>
        <h2 class="text-2xl font-bold text-slate-800">
          {{ isAuthenticated() ? 'Nâng Cấp Tài Khoản Mở Khách Sạn' : 'Đăng Ký Đối Tác Mở Khách Sạn' }}
        </h2>
        <p class="text-sm text-slate-500 mt-1 max-w-2xl mx-auto">
          {{ isAuthenticated()
              ? 'Tài khoản khách hàng của bạn sẽ được nâng cấp thành Chủ khách sạn (Owner). Dễ dàng quản lý phòng và tiếp cận hàng ngàn lượt đặt.'
              : 'Gia nhập nền tảng quản trị khách sạn đa cơ sở hiện đại. Thiết lập cơ sở lưu trú đầu tiên của bạn chỉ trong 2 phút.' }}
        </p>
      </div>

      @if (isAuthenticated()) {
        <div class="mb-5 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 text-indigo-950 text-sm shadow-sm flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
              <i class="pi pi-user-check text-lg"></i>
            </div>
            <div>
              <p class="font-bold text-slate-800">Đang nâng cấp từ tài khoản khách hàng</p>
              <p class="text-xs text-indigo-700">{{ currentEmail() }} ({{ currentFullName() }})</p>
            </div>
          </div>
          <span class="px-2.5 py-1 bg-indigo-200 text-indigo-900 text-xs font-bold rounded-lg shrink-0">
            Đã đăng nhập
          </span>
        </div>
      }

      @if (errorMessage()) {
        <div class="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 shadow-sm">
          <i class="pi pi-exclamation-triangle text-lg text-rose-500 mt-0.5 shrink-0"></i>
          <div>
            <span class="font-medium">Chưa thể hoàn tất đăng ký:</span>
            <p class="mt-0.5">{{ errorMessage() }}</p>
          </div>
        </div>
      }

      @if (successMessage()) {
        <div class="mb-5 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-sm flex flex-col items-center text-center">
          <i class="pi pi-check-circle text-4xl text-emerald-600 mb-2"></i>
          <h3 class="font-bold text-lg text-emerald-900">Chúc mừng bạn đã hoàn tất đăng ký đối tác!</h3>
          <p class="mt-1 text-emerald-700 max-w-lg">{{ successMessage() }}</p>
          <div class="mt-5 flex gap-3">
            <a routerLink="/login" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition-colors flex items-center gap-2">
              <i class="pi pi-sign-in"></i>
              Đăng nhập quản trị khách sạn
            </a>
          </div>
        </div>
      } @else {
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Cột 1: Thông tin người đại diện / Chủ sở hữu -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
                <i class="pi pi-user text-indigo-600 font-bold"></i>
                <h3 class="font-bold text-slate-800 text-sm uppercase tracking-wide">1. Thông tin Chủ sở hữu</h3>
              </div>

              <!-- Full Name Field -->
              <div>
                <label for="fullName" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ và tên người đại diện <span class="text-rose-500">*</span>
                </label>
                <input
                  id="fullName"
                  pInputText
                  formControlName="fullName"
                  placeholder="Ví dụ: Nguyễn Văn Hoàng"
                  class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('fullName')"
                />
                @if (isFieldInvalid('fullName')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng nhập họ và tên của bạn.</p>
                }
              </div>

              <!-- Email Field -->
              <div>
                <label for="email" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email liên hệ & đăng nhập <span class="text-rose-500">*</span>
                </label>
                <input
                  id="email"
                  pInputText
                  type="email"
                  formControlName="email"
                  [readonly]="isAuthenticated()"
                  placeholder="chu.khachsan@example.com"
                  class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  [class.bg-slate-100]="isAuthenticated()"
                  [class.border-rose-400]="isFieldInvalid('email')"
                />
                @if (isFieldInvalid('email')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng nhập địa chỉ email hợp lệ.</p>
                }
              </div>

              <!-- Phone Field -->
              <div>
                <label for="phoneNumber" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Số điện thoại liên hệ <span class="text-rose-500">*</span>
                </label>
                <input
                  id="phoneNumber"
                  pInputText
                  type="tel"
                  formControlName="phoneNumber"
                  placeholder="0912345678"
                  class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('phoneNumber')"
                />
                @if (isFieldInvalid('phoneNumber')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng nhập số điện thoại liên hệ.</p>
                }
              </div>

              <!-- Password Fields (Chỉ hiển thị với khách vãng lai chưa đăng nhập) -->
              @if (!isAuthenticated()) {
                <div>
                  <label for="password" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu tài khoản <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="password"
                    pInputText
                    type="password"
                    formControlName="password"
                    placeholder="Ít nhất 6 ký tự"
                    class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    [class.border-rose-400]="isFieldInvalid('password')"
                  />
                  @if (isFieldInvalid('password')) {
                    <p class="text-xs text-rose-500 mt-1">Mật khẩu tối thiểu phải từ 6 ký tự.</p>
                  }
                </div>

                <div>
                  <label for="confirmPassword" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Xác nhận mật khẩu <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    pInputText
                    type="password"
                    formControlName="confirmPassword"
                    placeholder="Nhập lại chính xác mật khẩu"
                    class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    [class.border-rose-400]="registerForm.get('confirmPassword')?.touched && registerForm.get('confirmPassword')?.errors?.['passwordMismatch']"
                  />
                  @if (registerForm.get('confirmPassword')?.touched && registerForm.get('confirmPassword')?.errors?.['passwordMismatch']) {
                    <p class="text-xs text-rose-500 mt-1">Mật khẩu xác nhận không khớp.</p>
                  }
                </div>
              }
            </div>

            <!-- Cột 2: Thông tin Cơ sở lưu trú đầu tiên -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
                <i class="pi pi-map-marker text-indigo-600 font-bold"></i>
                <h3 class="font-bold text-slate-800 text-sm uppercase tracking-wide">2. Cơ sở lưu trú đầu tiên</h3>
              </div>

              <!-- Property Name Field -->
              <div>
                <label for="propertyName" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Khách sạn / Homestay / Resort <span class="text-rose-500">*</span>
                </label>
                <input
                  id="propertyName"
                  pInputText
                  formControlName="propertyName"
                  placeholder="Ví dụ: Khách Sạn Sen Vàng Luxury"
                  class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('propertyName')"
                />
                @if (isFieldInvalid('propertyName')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng nhập tên khách sạn hoặc cơ sở lưu trú.</p>
                }
              </div>

              <!-- Tỉnh / Thành phố Dropdown (63 Tỉnh Thành) -->
              <div>
                <label for="provinceCode" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tỉnh / Thành phố <span class="text-rose-500">*</span>
                </label>
                <select
                  id="provinceCode"
                  formControlName="provinceCode"
                  (change)="onProvinceChange()"
                  class="w-full text-sm py-2 px-3 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  [class.border-rose-400]="isFieldInvalid('provinceCode')"
                >
                  <option value="">-- Chọn Tỉnh / Thành phố (63 đơn vị) --</option>
                  @for (prov of provinces(); track prov.code) {
                    <option [value]="prov.code">{{ prov.name }}</option>
                  }
                </select>
                @if (isFieldInvalid('provinceCode')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng chọn Tỉnh/Thành phố nơi khách sạn tọa lạc.</p>
                }
              </div>

              <!-- Phường / Xã Dropdown (2-Level Direct Mapping) -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label for="wardCode" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phường / Xã / Thị trấn <span class="text-rose-500">*</span>
                  </label>
                  @if (wardsLoading()) {
                    <span class="text-xs text-indigo-600 flex items-center gap-1 font-medium">
                      <i class="pi pi-spin pi-spinner text-xs"></i> Đang tải...
                    </span>
                  }
                </div>
                <select
                  id="wardCode"
                  formControlName="wardCode"
                  class="w-full text-sm py-2 px-3 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  [disabled]="!selectedProvinceCode || wardsLoading()"
                >
                  <option value="">-- Chọn Phường / Xã --</option>
                  @for (w of wards(); track w.code) {
                    <option [value]="w.code">{{ w.name }}</option>
                  }
                </select>
                @if (!selectedProvinceCode) {
                  <p class="text-xs text-slate-400 mt-1">Hãy chọn Tỉnh/Thành phố trước để tải danh sách Phường/Xã.</p>
                }
              </div>

              <!-- Street Address Field -->
              <div>
                <label for="address" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Địa chỉ số nhà, tên đường <span class="text-rose-500">*</span>
                </label>
                <input
                  id="address"
                  pInputText
                  formControlName="address"
                  placeholder="Ví dụ: 123 Võ Nguyên Giáp"
                  class="w-full text-sm py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('address')"
                />
                @if (isFieldInvalid('address')) {
                  <p class="text-xs text-rose-500 mt-1">Vui lòng nhập địa chỉ chi tiết số nhà, tên đường.</p>
                }
              </div>

              <!-- Policy Preview Info -->
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <div class="font-semibold text-slate-700 flex items-center gap-1.5">
                  <i class="pi pi-info-circle text-indigo-500"></i>
                  Chính sách vận hành ban đầu:
                </div>
                <p>• Nhận phòng (Check-in): <strong>14:00</strong> | Trả phòng (Check-out): <strong>12:00</strong></p>
                <p>• Thời gian đệm dọn phòng: <strong>30 phút</strong></p>
                <p class="text-slate-400 text-[11px] italic">Bạn có thể cấu hình thêm phòng và bảng giá sau khi đăng nhập.</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              [disabled]="isLoading() || registerForm.invalid"
              class="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
            >
              @if (isLoading()) {
                <i class="pi pi-spin pi-spinner text-lg"></i>
                <span>Đang khởi tạo khách sạn của bạn...</span>
              } @else {
                <i class="pi pi-building-columns text-lg"></i>
                <span>{{ isAuthenticated() ? 'Xác Nhận Nâng Cấp & Mở Khách Sạn' : 'Đăng Ký & Thiết Lập Khách Sạn Ngay' }}</span>
              }
            </button>
          </div>
        </form>
      }

      <div class="text-center mt-6 text-sm text-slate-500">
        Bạn muốn quay lại cổng đặt phòng?
        <a routerLink="/booking" class="text-indigo-600 font-semibold hover:underline ml-1">
          Trang chủ đặt phòng
        </a>
      </div>
    </div>
  `
})
export class PartnerRegisterPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly provinces = signal<Province[]>([]);
  readonly wards = signal<Ward[]>([]);
  readonly wardsLoading = signal(false);

  readonly isAuthenticated = signal(false);
  readonly currentEmail = signal('');
  readonly currentFullName = signal('');

  registerForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    phoneNumber: ['', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    confirmPassword: ['', [Validators.required]],
    propertyName: ['', [Validators.required, Validators.maxLength(200)]],
    provinceCode: ['', [Validators.required]],
    wardCode: ['', [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(300)]]
  }, { validators: passwordMatchValidator });

  get selectedProvinceCode(): string {
    return this.registerForm.get('provinceCode')?.value || '';
  }

  ngOnInit(): void {
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
      this.registerForm.clearValidators(); // Clear passwordMatchValidator
      this.registerForm.updateValueAndValidity();
    }
  }

  loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (list) => {
        this.provinces.set(list);
      },
      error: () => {
        this.errorMessage.set('Không thể tải danh mục Tỉnh/Thành phố. Vui lòng tải lại trang.');
      }
    });
  }

  onProvinceChange(): void {
    const provinceCode = this.selectedProvinceCode;
    this.registerForm.patchValue({ wardCode: '' });
    this.wards.set([]);

    if (!provinceCode) return;

    this.wardsLoading.set(true);
    this.locationService.getWards(provinceCode).subscribe({
      next: (list) => {
        this.wards.set(list);
        this.wardsLoading.set(false);
      },
      error: () => {
        this.wardsLoading.set(false);
        this.errorMessage.set('Không thể tải danh sách Phường/Xã cho tỉnh/thành đã chọn.');
      }
    });
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

    const formVal = this.registerForm.getRawValue();

    this.authService.partnerRegister({
      fullName: formVal.fullName || '',
      email: formVal.email || '',
      password: this.isAuthenticated() ? '' : (formVal.password || ''),
      phoneNumber: formVal.phoneNumber || '',
      propertyName: formVal.propertyName || '',
      provinceCode: formVal.provinceCode || '',
      wardCode: formVal.wardCode || null,
      address: formVal.address || ''
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
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
