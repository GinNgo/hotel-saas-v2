import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Trang Quên mật khẩu (Forgot Password Page).
 * Gửi yêu cầu khôi phục mật khẩu an toàn không làm lộ thông tin tồn tại tài khoản.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, InputText, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full space-y-5">
      <div class="text-center space-y-1.5">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-1">
          <i class="pi pi-envelope text-xl"></i>
        </div>
        <h2 class="text-xl font-bold text-slate-900">Khôi phục mật khẩu</h2>
        <p class="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          Nhập địa chỉ email đã đăng ký. Hệ thống sẽ gửi liên kết đặt lại mật khẩu có hiệu lực trong 30 phút.
        </p>
      </div>

      @if (submitted()) {
        <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 text-xs leading-relaxed">
          <div class="flex items-center gap-2 font-bold">
            <i class="pi pi-check-circle text-emerald-600"></i>
            <span>Đã tiếp nhận yêu cầu khôi phục</span>
          </div>
          <p>{{ responseMessage() }}</p>
          <p class="text-[11px] text-emerald-700">
            Vui lòng kiểm tra cả thư mục Spam / Quảng cáo nếu chưa thấy email trong hộp thư đến.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            (click)="resetForm()"
            class="flex-1 min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Gửi lại với email khác
          </button>
          <a
            routerLink="/login"
            class="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
          >
            <i class="pi pi-sign-in text-xs"></i>
            <span>Quay lại đăng nhập</span>
          </a>
        </div>
      } @else {
        @if (errorMessage()) {
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <i class="pi pi-exclamation-circle text-sm shrink-0 mt-0.5"></i>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label for="forgot-email" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email tài khoản <span class="text-rose-500">*</span>
            </label>
            <input
              pInputText
              id="forgot-email"
              type="email"
              formControlName="email"
              placeholder="name@example.com"
              autocomplete="email"
              class="w-full min-h-11 text-sm"
            />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Vui lòng nhập địa chỉ email hợp lệ.</p>
            }
          </div>

          <p-button
            type="submit"
            label="Gửi liên kết đặt lại mật khẩu"
            icon="pi pi-send"
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
export class ForgotPasswordPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  submitted = signal(false);
  errorMessage = signal<string | null>(null);
  responseMessage = signal('Nếu email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]]
  });

  ngOnInit(): void {
    const prefillEmail = this.route.snapshot.queryParamMap.get('email');
    if (prefillEmail) {
      this.form.patchValue({ email: prefillEmail });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = (this.form.value.email || '').trim().toLowerCase();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.forgotPassword({ email }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.responseMessage.set(
          res.message || 'Nếu email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.'
        );
        this.submitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiResponse<unknown> | undefined;
        this.errorMessage.set(body?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.');
      }
    });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.errorMessage.set(null);
  }
}
