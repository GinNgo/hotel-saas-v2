import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../../../core/models/api-response.model';
import { ConfirmEmailResponse } from '../../../core/models/auth.model';

export type VerificationState = 'loading' | 'success' | 'error';

/**
 * Trang Xác thực Email đăng ký tài khoản (Confirm Email Page).
 * Đọc token bảo mật HMAC-SHA256 từ query params (?token=...) và kích hoạt tài khoản người dùng.
 */
@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full text-center">
      <!-- 1. TRẠNG THÁI: ĐANG XỬ LÝ (LOADING) -->
      @if (state() === 'loading') {
        <div class="py-8 space-y-4 animate-fade-in">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50">
            <i class="pi pi-spin pi-spinner text-3xl"></i>
          </div>
          <div class="space-y-1">
            <h2 class="text-xl font-bold text-slate-800">Đang kích hoạt tài khoản...</h2>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              Hệ thống đang kiểm tra chữ ký số và mã kích hoạt bảo mật của bạn. Vui lòng đợi trong giây lát.
            </p>
          </div>
        </div>
      }

      <!-- 2. TRẠNG THÁI: THÀNH CÔNG (SUCCESS) -->
      @if (state() === 'success') {
        <div class="py-6 space-y-5 animate-fade-in">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 shadow-sm">
            <i class="pi pi-check-circle text-3xl"></i>
          </div>

          <div class="space-y-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <i class="pi pi-shield text-[10px]"></i> ĐÃ XÁC THỰC DANH TÍNH
            </span>
            <h2 class="text-xl font-bold text-slate-800">Kích hoạt tài khoản thành công!</h2>
            <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              @if (confirmedEmail()) {
                Địa chỉ email <strong class="text-slate-900 font-semibold">{{ confirmedEmail() }}</strong> đã được chứng thực.
              }
              {{ successMessage() }}
            </p>
          </div>

          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-left text-xs text-slate-600 space-y-1.5 max-w-sm mx-auto">
            <div class="flex items-center gap-2 font-semibold text-slate-700">
              <i class="pi pi-info-circle text-emerald-600"></i>
              <span>Quyền lợi tài khoản đã mở khóa:</span>
            </div>
            <ul class="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500">
              <li>Đặt phòng trực tuyến nhanh chóng & tích lũy điểm thưởng</li>
              <li>Nhận mã giảm giá & ưu đãi thành viên LuxeStay độc quyền</li>
              <li>Bảo mật thông tin đặt chỗ và lịch sử lưu trú</li>
            </ul>
          </div>

          <div class="pt-2">
            <a
              routerLink="/login"
              class="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <i class="pi pi-sign-in"></i>
              <span>Đăng nhập ngay</span>
            </a>
          </div>
        </div>
      }

      <!-- 3. TRẠNG THÁI: LỖI HOẶC HẾT HẠN (ERROR) -->
      @if (state() === 'error') {
        <div class="py-6 space-y-5 animate-fade-in">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50 shadow-sm">
            <i class="pi pi-exclamation-triangle text-3xl"></i>
          </div>

          <div class="space-y-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <i class="pi pi-times-circle text-[10px]"></i> XÁC THỰC KHÔNG HỢP LỆ
            </span>
            <h2 class="text-xl font-bold text-slate-800">Không thể xác thực email</h2>
            <p class="text-xs text-rose-600 font-medium max-w-sm mx-auto">
              {{ errorMessage() }}
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-left text-xs text-amber-800 space-y-1 max-w-sm mx-auto">
            <div class="flex items-center gap-1.5 font-semibold">
              <i class="pi pi-lightbulb text-amber-600"></i>
              <span>Nguyên nhân phổ biến:</span>
            </div>
            <p class="text-[11px] text-amber-700 leading-relaxed">
              Mã kích hoạt có thời hạn tối đa 30 phút vì lý do an toàn bảo mật, hoặc liên kết này đã được sử dụng trước đó.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-w-sm mx-auto">
            <a
              routerLink="/register"
              class="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <i class="pi pi-user-plus text-xs"></i>
              <span>Đăng ký lại</span>
            </a>
            <a
              routerLink="/login"
              class="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
            >
              <i class="pi pi-sign-in text-xs"></i>
              <span>Về Đăng nhập</span>
            </a>
          </div>
        </div>
      }

      <!-- FOOTER LINKS -->
      <div class="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
        <a routerLink="/booking" class="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium transition-colors">
          <i class="pi pi-arrow-left text-[10px]"></i>
          <span>Về trang chủ đặt phòng</span>
        </a>
      </div>
    </div>
  `
})
export class ConfirmEmailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);

  state = signal<VerificationState>('loading');
  confirmedEmail = signal<string | null>(null);
  successMessage = signal<string>('Tài khoản của bạn đã được kích hoạt thành công.');
  errorMessage = signal<string>('Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token || !token.trim()) {
      this.state.set('error');
      this.errorMessage.set('Thiếu mã xác thực (token). Vui lòng kiểm tra lại liên kết trong email của bạn.');
      return;
    }

    this.authService.confirmEmail(token.trim()).subscribe({
      next: (response) => {
        const data = response.data;
        this.confirmedEmail.set(data?.email || null);
        this.successMessage.set(data?.message || 'Tài khoản của bạn đã được kích hoạt thành công. Bạn có thể đăng nhập ngay.');
        this.state.set('success');
        this.notification.success('Kích hoạt tài khoản thành công!');
      },
      error: (err: HttpErrorResponse) => {
        this.state.set('error');
        const body = err.error as ApiResponse<unknown>;
        const message = body?.message || err.error?.detail || 'Mã xác thực không hợp lệ hoặc đã hết hạn sau 30 phút.';
        this.errorMessage.set(message);
      }
    });
  }
}
