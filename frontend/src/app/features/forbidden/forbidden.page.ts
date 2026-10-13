import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Trang thông báo từ chối quyền truy cập (403 Forbidden).
 * Hiển thị khi error interceptor phát hiện lỗi 403 và chuyển hướng tới /forbidden.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center">
        <div class="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <i class="pi pi-shield text-3xl"></i>
        </div>
        <h1 class="text-xl font-bold text-slate-800 tracking-tight">Không có quyền truy cập</h1>
        <p class="text-sm text-slate-500 mt-2 leading-relaxed">
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là sự nhầm lẫn.
        </p>
        <div class="mt-6 flex items-center justify-center gap-3">
          <a routerLink="/dashboard"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-2xs"
          >
            <i class="pi pi-home text-xs"></i>
            <span>Về trang chủ</span>
          </a>
          <a routerLink="/login"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors"
          >
            <i class="pi pi-sign-in text-xs"></i>
            <span>Đăng nhập lại</span>
          </a>
        </div>
      </div>
    </div>
  `
})
export class ForbiddenPage {}
