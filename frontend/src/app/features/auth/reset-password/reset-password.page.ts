import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiResponse } from '../../../core/models/api-response.model';

function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value) {
    return null;
  }

  const errors: ValidationErrors = {};
  if (!/[A-Z]/.test(value)) {
    errors['requiresUppercase'] = true;
  }
  if (!/[a-z]/.test(value)) {
    errors['requiresLowercase'] = true;
  }
  if (!/[0-9]/.test(value)) {
    errors['requiresDigit'] = true;
  }
  if (!/[^a-zA-Z0-9]/.test(value)) {
    errors['requiresSpecialChar'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmControl = group.get('confirmPassword');
  if (!confirmControl) {
    return null;
  }

  const confirmValue = confirmControl.value;
  if (newPassword && confirmValue && newPassword !== confirmValue) {
    const existingErrors = confirmControl.errors ? { ...confirmControl.errors } : {};
    existingErrors['mismatch'] = true;
    confirmControl.setErrors(existingErrors);
    return { mismatch: true };
  }

  if (confirmControl.hasError('mismatch')) {
    const rest = { ...confirmControl.errors };
    delete rest['mismatch'];
    confirmControl.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
  return null;
}

/**
 * Trang Đặt lại mật khẩu / Thiết lập mật khẩu nhân sự từ liên kết token an toàn.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Password, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full space-y-5">
      <div class="text-center space-y-1.5">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-1">
          <i class="pi pi-lock text-xl"></i>
        </div>
        <h2 class="text-xl font-bold text-slate-900">
          {{ isInviteMode() ? 'Thiết lập mật khẩu tài khoản PMS' : 'Đặt lại mật khẩu mới' }}
        </h2>
        <p class="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {{ isInviteMode()
            ? 'Hoàn tất kích hoạt tài khoản nhân sự bằng cách tạo mật khẩu bảo mật cho riêng bạn.'
            : 'Vui lòng nhập mật khẩu mới đạt chuẩn bảo mật để tiếp tục sử dụng tài khoản.' }}
        </p>
      </div>

      @if (!token()) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
          <div class="font-bold flex items-center gap-1.5">
            <i class="pi pi-exclamation-triangle"></i>
            <span>Thiếu mã xác thực đặt lại mật khẩu</span>
          </div>
          <p>Liên kết không chứa token hợp lệ hoặc đã bị cắt xén.</p>
          <a routerLink="/auth/forgot-password" class="min-h-11 inline-flex items-center gap-1.5 font-bold text-indigo-700 hover:underline">
            <span>Yêu cầu liên kết mới</span>
            <i class="pi pi-arrow-right text-[11px]"></i>
          </a>
        </div>
      } @else if (completed()) {
        <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 text-xs">
          <div class="flex items-center gap-2 font-bold">
            <i class="pi pi-check-circle text-emerald-600"></i>
            <span>{{ isInviteMode() ? 'Thiết lập mật khẩu thành công!' : 'Đặt lại mật khẩu thành công!' }}</span>
          </div>
          <p>Tất cả phiên đăng nhập cũ đã được làm mới vì an toàn. Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
        </div>

        <a
          routerLink="/login"
          class="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
        >
          <i class="pi pi-sign-in"></i>
          <span>Đăng nhập ngay</span>
        </a>
      } @else {
        @if (errorMessage()) {
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <i class="pi pi-exclamation-circle text-sm shrink-0 mt-0.5"></i>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label for="newPassword" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu mới <span class="text-rose-500">*</span>
            </label>
            <p-password
              id="newPassword"
              formControlName="newPassword"
              [feedback]="true"
              [toggleMask]="true"
              placeholder="Tối thiểu 8 ký tự (hoa, thường, số, ký tự đặc biệt)"
              promptLabel="Nhập mật khẩu mạnh"
              weakLabel="Yếu"
              mediumLabel="Trung bình"
              strongLabel="Mạnh"
              styleClass="w-full"
              inputStyleClass="w-full min-h-11 text-sm"
            />
            @if (form.get('newPassword')?.hasError('required') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Vui lòng nhập mật khẩu mới.</p>
            }
            @if (form.get('newPassword')?.hasError('minlength') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 8 ký tự.</p>
            }
            @if (form.get('newPassword')?.hasError('requiresUppercase') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ hoa (A-Z).</p>
            }
            @if (form.get('newPassword')?.hasError('requiresLowercase') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ thường (a-z).</p>
            }
            @if (form.get('newPassword')?.hasError('requiresDigit') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ số (0-9).</p>
            }
            @if (form.get('newPassword')?.hasError('requiresSpecialChar') && form.get('newPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 ký tự đặc biệt.</p>
            }
          </div>

          <div>
            <label for="confirmNewPassword" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Xác nhận mật khẩu mới <span class="text-rose-500">*</span>
            </label>
            <p-password
              id="confirmNewPassword"
              formControlName="confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              placeholder="Nhập lại mật khẩu mới"
              styleClass="w-full"
              inputStyleClass="w-full min-h-11 text-sm"
            />
            @if (form.get('confirmPassword')?.hasError('mismatch') && form.get('confirmPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu xác nhận không khớp.</p>
            }
          </div>

          <p-button
            type="submit"
            [label]="isInviteMode() ? 'Hoàn tất thiết lập mật khẩu' : 'Cập nhật mật khẩu mới'"
            icon="pi pi-check"
            [loading]="loading()"
            [disabled]="loading()"
            styleClass="w-full min-h-11 font-bold text-sm"
          />
        </form>
      }

      <div class="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
        <a routerLink="/login" class="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold transition-colors">
          <i class="pi pi-arrow-left text-[10px]"></i>
          <span>Quay về trang đăng nhập</span>
        </a>
      </div>
    </div>
  `
})
export class ResetPasswordPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  token = signal<string>('');
  isInviteMode = signal(false);
  loading = signal(false);
  completed = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100), strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordMatchValidator }
  );

  ngOnInit(): void {
    const qToken = this.route.snapshot.queryParamMap.get('token') || '';
    const mode = this.route.snapshot.queryParamMap.get('mode') || '';
    this.token.set(qToken.trim());
    this.isInviteMode.set(mode.toLowerCase() === 'invite');
  }

  onSubmit(): void {
    if (!this.token()) {
      this.errorMessage.set('Thiếu mã xác thực đặt lại mật khẩu.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const newPassword = this.form.value.newPassword || '';
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword({ token: this.token(), newPassword }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading.set(false);
        this.completed.set(true);
        this.notification.success(
          this.isInviteMode() ? 'Thiết lập mật khẩu tài khoản thành công!' : 'Đặt lại mật khẩu thành công!'
        );
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiResponse<unknown> | undefined;
        this.errorMessage.set(body?.message || 'Liên kết không hợp lệ hoặc đã hết hạn.');
      }
    });
  }
}
