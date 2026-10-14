import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ContextSelectorDialogComponent } from '../context-selector/context-selector.dialog';
import { UserMembershipDto } from '../../../core/models/auth.model';

/**
 * Trang Đăng nhập hệ thống Hotel SaaS.
 * Tích hợp tự động kiểm tra Bootstrap Token & hiển thị Modal Chọn Chi nhánh nếu tài khoản có nhiều chi nhánh.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    InputText,
    Password,
    Button,
    ContextSelectorDialogComponent
  ],
  template: `
    <div class="w-full">
      <h2 class="text-xl font-bold text-slate-800 text-center mb-1.5">Đăng nhập tài khoản</h2>
      <p class="text-xs sm:text-sm text-slate-500 text-center mb-6">Truy cập bảng điều khiển quản lý khách sạn</p>

      @if (errorMessage()) {
        <div class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
          <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5"></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4">
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
            placeholder="manager.both@hotelsaas.local"
            class="w-full text-sm"
            [class.ng-invalid]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
          />
          @if (loginForm.get('email')?.hasError('required') && loginForm.get('email')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Email không được để trống</p>
          }
          @if (loginForm.get('email')?.hasError('email') && loginForm.get('email')?.touched) {
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
            [feedback]="false"
            [toggleMask]="true"
            placeholder="••••••••"
            styleClass="w-full"
            inputStyleClass="w-full text-sm"
          />
          @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
            <p class="text-xs text-rose-600 mt-1">Mật khẩu không được để trống</p>
          }
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <p-button
            type="submit"
            label="Đăng nhập"
            icon="pi pi-sign-in"
            [loading]="loading()"
            [disabled]="loading() || loginForm.invalid"
            styleClass="w-full p-button-success"
          />
        </div>
      </form>

      <!-- Quick Fill Buttons for Seeded Accounts (Local Dev / Demo) -->
      <div class="mt-6 pt-4 border-t border-slate-100">
        <span class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
          Tài khoản kiểm thử nhanh (Local Dev):
        </span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
          <button
            type="button"
            (click)="quickFill('manager.both@hotelsaas.local')"
            class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
            title="Quản lý 2 chi nhánh: manager.both@hotelsaas.local"
          >
            Quản lý 2 nhánh
          </button>
          <button
            type="button"
            (click)="quickFill('staff.single@hotelsaas.local')"
            class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
            title="Lễ tân CN-Q1: staff.single@hotelsaas.local"
          >
            Lễ tân CN-Q1
          </button>
          <button
            type="button"
            (click)="quickFill('owner@hotelsaas.local')"
            class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
            title="Owner toàn quyền: owner@hotelsaas.local"
          >
            Chủ KS (Owner)
          </button>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
        <div>
          <span>Chưa có tài khoản khách lẻ? </span>
          <a routerLink="/register" class="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
            Đăng ký tài khoản
          </a>
        </div>
        <div class="pt-1">
          <a routerLink="/partner-register" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors">
            <i class="pi pi-building"></i>
            <span>Bạn là chủ khách sạn? Đăng ký mở khách sạn</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Modal bắt buộc chọn chi nhánh khi login bằng Bootstrap Token -->
    <app-context-selector-dialog
      [visible]="showBranchSelector()"
      (visibleChange)="showBranchSelector.set($event)"
      [requireSelection]="true"
      (contextSwitched)="onBranchSelected($event)"
    />
  `
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  loginForm = this.fb.group({
    email: ['manager.both@hotelsaas.local', [Validators.required, Validators.email]],
    password: ['HotelDev@2026!', [Validators.required]]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showBranchSelector = signal(false);

  quickFill(email: string): void {
    this.loginForm.patchValue({
      email,
      password: 'HotelDev@2026!'
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const memberships = response.memberships || [];
        const branchMemberships = memberships.filter(m => !!m.propertyId);

        // Trường hợp 1: Có từ 2 chi nhánh trở lên -> BẮT BUỘC hiện modal chọn chi nhánh (không tự ý chọn nhánh đầu)
        if (branchMemberships.length > 1) {
          this.notification.info('Vui lòng chọn chi nhánh làm việc.');
          this.showBranchSelector.set(true);
          return;
        }

        // Trường hợp 2: Chỉ có đúng 1 chi nhánh -> Tự động kích hoạt context chi nhánh đó
        if (branchMemberships.length === 1) {
          const soleBranch = branchMemberships[0];
          this.authService.switchContext(soleBranch.propertyId!).subscribe({
            next: () => {
              this.notification.success(`Đăng nhập thành công chi nhánh: ${soleBranch.propertyName || soleBranch.propertyCode}`);
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              // Fallback vào dashboard
              this.router.navigate(['/dashboard']);
            }
          });
          return;
        }

        // Trường hợp 3: Tài khoản Owner tenant-wide hoặc chưa có chi nhánh cụ thể
        this.notification.success('Đăng nhập thành công!');
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const detail = err.error?.title || err.error?.message || 'Email hoặc mật khẩu không chính xác.';
        this.errorMessage.set(detail);
      }
    });
  }

  onBranchSelected(membership: UserMembershipDto): void {
    this.showBranchSelector.set(false);
    this.router.navigate(['/dashboard']);
  }
}
