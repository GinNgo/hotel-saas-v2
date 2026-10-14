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
 * Trang Đăng ký tài khoản hệ thống Hotel SaaS.
 * Sử dụng PrimeNG + Tailwind CSS.
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
      <h2 class="text-xl font-bold text-slate-800 text-center mb-6">Tạo tài khoản mới</h2>

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
            placeholder="Nguyễn Văn A"
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
            Email <span class="text-rose-500">*</span>
          </label>
          <input
            id="email"
            pInputText
            formControlName="email"
            type="email"
            placeholder="example@hotel.com"
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

  registerForm = this.fb.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
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

    const { fullName, email, password } = this.registerForm.getRawValue();

    this.authService.register({
      fullName: fullName!,
      email: email!,
      password: password!
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.notification.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
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
