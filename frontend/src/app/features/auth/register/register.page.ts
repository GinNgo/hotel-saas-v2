import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../../../core/models/api-response.model';

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
 * Trang Đăng ký tài khoản khách hàng hệ thống LuxeStay Hotel SaaS.
 * Hỗ trợ: Họ tên, Email, Số điện thoại kèm mã vùng (+84 mặc định), Mật khẩu bảo mật.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputText,
    Password,
    Button
  ],
  template: `
    <div class="w-full">
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-slate-800">Tạo tài khoản hội viên</h2>
        <p class="text-xs text-slate-500 mt-1">Đăng ký để nhận ưu đãi phòng độc quyền và quản lý đặt phòng tiện lợi</p>
      </div>

      @if (errorMessage()) {
        <div class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
          <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5"></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-4">
        <!-- Full Name Field -->
        <div>
          <label for="fullName" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Họ và tên <span class="text-rose-500">*</span>
          </label>
          <input
            id="fullName"
            pInputText
            formControlName="fullName"
            placeholder="Ví dụ: An Ngô Võ Tuấn"
            class="w-full text-sm"
            [class.ng-invalid]="registerForm.get('fullName')?.invalid && registerForm.get('fullName')?.touched"
          />
          @if (registerForm.get('fullName')?.hasError('required') && registerForm.get('fullName')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Họ tên không được để trống</p>
          }
        </div>

        <!-- Email Field -->
        <div>
          <label for="email" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Email nhận thông báo & vé phòng <span class="text-rose-500">*</span>
          </label>
          <input
            id="email"
            pInputText
            formControlName="email"
            type="email"
            placeholder="ngovotuananh@gmail.com"
            class="w-full text-sm"
            [class.ng-invalid]="registerForm.get('email')?.invalid && registerForm.get('email')?.touched"
          />
          @if (registerForm.get('email')?.hasError('required') && registerForm.get('email')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Email không được để trống</p>
          }
          @if (registerForm.get('email')?.hasError('email') && registerForm.get('email')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Email không đúng định dạng</p>
          }
        </div>

        <!-- Phone Number Field with Country Code Selection -->
        <div>
          <label for="phoneNumber" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Số điện thoại liên hệ <span class="text-rose-500">*</span>
          </label>
          <div class="flex gap-2 items-center">
            <div class="relative shrink-0">
              <select
                formControlName="dialCode"
                class="h-10 pl-3 pr-8 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer appearance-none shadow-2xs transition-all"
                title="Chọn mã vùng quốc gia"
              >
                @for (c of countryCodes; track c.code) {
                  <option [value]="c.dialCode">
                    {{ c.flag }} {{ c.dialCode }}
                  </option>
                }
              </select>
              <i class="pi pi-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>

            <div class="flex-1 min-w-0">
              <input
                id="phoneNumber"
                pInputText
                formControlName="phoneNumber"
                type="tel"
                placeholder="Ví dụ: 0912 345 678"
                class="w-full text-sm"
                [class.ng-invalid]="registerForm.get('phoneNumber')?.invalid && registerForm.get('phoneNumber')?.touched"
              />
            </div>
          </div>
          @if (registerForm.get('phoneNumber')?.hasError('required') && registerForm.get('phoneNumber')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Số điện thoại không được để trống</p>
          }
          @if (registerForm.get('phoneNumber')?.hasError('pattern') && registerForm.get('phoneNumber')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Số điện thoại không hợp lệ (từ 8-15 chữ số)</p>
          }
        </div>

        <!-- Password Field -->
        <div>
          <label for="password" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Mật khẩu <span class="text-rose-500">*</span>
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
            inputStyleClass="w-full text-sm"
          />
          @if (registerForm.get('password')?.hasError('required') && registerForm.get('password')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Mật khẩu không được để trống</p>
          }
          @if (registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 8 ký tự</p>
          }
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label for="confirmPassword" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Xác nhận mật khẩu <span class="text-rose-500">*</span>
          </label>
          <p-password
            id="confirmPassword"
            formControlName="confirmPassword"
            [feedback]="false"
            [toggleMask]="true"
            placeholder="Nhập lại mật khẩu"
            styleClass="w-full"
            inputStyleClass="w-full text-sm"
          />
          @if (registerForm.get('confirmPassword')?.hasError('required') && registerForm.get('confirmPassword')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Xác nhận mật khẩu không được để trống</p>
          }
          @if (registerForm.get('confirmPassword')?.hasError('passwordMismatch') && registerForm.get('confirmPassword')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Mật khẩu xác nhận không khớp</p>
          }
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <p-button
            type="submit"
            label="Đăng ký tài khoản"
            icon="pi pi-user-plus"
            [loading]="loading()"
            [disabled]="loading() || registerForm.invalid"
            styleClass="w-full p-button-success"
          />
        </div>
      </form>

      <div class="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
        <div>
          <span>Đã có tài khoản? </span>
          <a routerLink="/login" class="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
            Đăng nhập ngay
          </a>
        </div>
        <div>
          <a routerLink="/partner-register" class="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
            <i class="pi pi-building"></i>
            <span>Bạn là chủ khách sạn? Đăng ký mở khách sạn tại đây</span>
          </a>
        </div>
      </div>
    </div>
  `
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly countryCodes = [
    { code: 'VN', dialCode: '+84', flag: '🇻🇳', label: 'Việt Nam (+84)' },
    { code: 'US', dialCode: '+1', flag: '🇺🇸', label: 'Hoa Kỳ / Canada (+1)' },
    { code: 'KR', dialCode: '+82', flag: '🇰🇷', label: 'Hàn Quốc (+82)' },
    { code: 'JP', dialCode: '+81', flag: '🇯🇵', label: 'Nhật Bản (+81)' },
    { code: 'SG', dialCode: '+65', flag: '🇸🇬', label: 'Singapore (+65)' },
    { code: 'TH', dialCode: '+66', flag: '🇹🇭', label: 'Thái Lan (+66)' },
    { code: 'CN', dialCode: '+86', flag: '🇨🇳', label: 'Trung Quốc (+86)' },
    { code: 'GB', dialCode: '+44', flag: '🇬🇧', label: 'Vương quốc Anh (+44)' },
    { code: 'AU', dialCode: '+61', flag: '🇦🇺', label: 'Úc (+61)' },
    { code: 'FR', dialCode: '+33', flag: '🇫🇷', label: 'Pháp (+33)' },
    { code: 'DE', dialCode: '+49', flag: '🇩🇪', label: 'Đức (+49)' },
    { code: 'RU', dialCode: '+7', flag: '🇷🇺', label: 'Nga (+7)' },
  ];

  registerForm = this.fb.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    dialCode: ['+84', [Validators.required]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9\s\-]{8,15}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { fullName, email, dialCode, phoneNumber, password } = this.registerForm.getRawValue();

    let formattedPhone: string | undefined = undefined;
    if (phoneNumber?.trim()) {
      const digits = phoneNumber.replace(/\D/g, '');
      if (digits) {
        const stripped = digits.startsWith('0') ? digits.substring(1) : digits;
        formattedPhone = `${dialCode || '+84'}${stripped}`;
      }
    }

    this.authService.register({
      fullName: fullName!.trim(),
      email: email!.trim().toLowerCase(),
      phoneNumber: formattedPhone,
      password: password!,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success || (response as any).userId || (response as any).data) {
          this.notification.success('Đăng ký tài khoản thành công! Thư xác thực tài khoản đã được gửi đến email của bạn. Vui lòng mở hộp thư để bấm liên kết kích hoạt.');
          this.router.navigate(['/login']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiResponse<unknown>;
        this.errorMessage.set(body?.message || 'Đăng ký không thành công. Vui lòng thử lại.');
      }
    });
  }
}
