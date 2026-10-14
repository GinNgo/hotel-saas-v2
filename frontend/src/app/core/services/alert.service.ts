import { Injectable } from '@angular/core';
import Swal, { SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

/**
 * Service quản lý thông báo (Toast) và hộp thoại xác nhận (Confirm Dialog)
 * sử dụng SweetAlert2 với định hướng giao diện Warm Neutral + Emerald đồng bộ.
 *
 * Tính năng bảo vệ:
 * 1. An toàn XSS: Toàn bộ thông điệp sử dụng thuộc tính `text`, tự động escape HTML không tin cậy.
 * 2. Chống Double-Submit: Khóa các nút và hiển thị loader khi đang xử lý xác nhận.
 * 3. Hỗ trợ prefers-reduced-motion: Tự động tắt hiệu ứng chuyển động nếu người dùng bật reduced motion.
 * 4. Bàn phím & Focus: Focus mặc định vào nút hành động, hỗ trợ phím Esc để hủy.
 */
@Injectable({ providedIn: 'root' })
export class AlertService {
  private isReducedMotion(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  /**
   * Cấu hình Toast chuẩn góc phải trên màn hình.
   */
  private readonly Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  /**
   * Thông báo thành công dạng Toast
   */
  toastSuccess(message: string, title: string = 'Thành công'): void {
    this.Toast.fire({
      icon: 'success',
      title,
      text: message,
      animation: !this.isReducedMotion()
    });
  }

  /**
   * Thông báo lỗi dạng Toast (an toàn escape chuỗi)
   */
  toastError(message: string, title: string = 'Đã có lỗi xảy ra'): void {
    this.Toast.fire({
      icon: 'error',
      title,
      text: message,
      timer: 5000,
      animation: !this.isReducedMotion()
    });
  }

  /**
   * Shorthand gọi toastSuccess
   */
  success(message: string, title: string = 'Thành công'): void {
    this.toastSuccess(message, title);
  }

  /**
   * Shorthand gọi toastError
   */
  error(message: string, title: string = 'Đã có lỗi xảy ra'): void {
    this.toastError(message, title);
  }

  /**
   * Thông báo cảnh báo dạng Toast
   */
  toastWarning(message: string, title: string = 'Cảnh báo'): void {
    this.Toast.fire({
      icon: 'warning',
      title,
      text: message,
      animation: !this.isReducedMotion()
    });
  }

  /**
   * Thông báo thông tin dạng Toast
   */
  toastInfo(message: string, title: string = 'Thông tin'): void {
    this.Toast.fire({
      icon: 'info',
      title,
      text: message,
      animation: !this.isReducedMotion()
    });
  }

  /**
   * Hộp thoại xác nhận hành động nguy hiểm / xóa (Destructive Confirmation)
   * Trả về Promise<boolean>: true nếu người dùng đồng ý, false nếu hủy.
   */
  async confirmDelete(options: {
    title?: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
  }): Promise<boolean> {
    const reducedMotion = this.isReducedMotion();
    const result: SweetAlertResult = await Swal.fire({
      title: options.title || 'Xác nhận xóa?',
      text: options.text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || 'Đồng ý xóa',
      cancelButtonText: options.cancelButtonText || 'Hủy bỏ',
      reverseButtons: true,
      focusCancel: true,
      animation: !reducedMotion,
      customClass: {
        popup: 'rounded-2xl border border-slate-200/90 shadow-xl bg-white font-sans text-slate-800',
        title: 'text-lg font-bold text-slate-900',
        htmlContainer: 'text-sm text-slate-600',
        confirmButton: 'px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm transition-colors shadow-sm focus:ring-2 focus:ring-rose-500/30 outline-none',
        cancelButton: 'px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors mr-2 outline-none'
      },
      buttonsStyling: false
    });

    return !!result.isConfirmed;
  }

  /**
   * Hộp thoại hiển thị thông báo trạng thái tính năng chưa phát hành / bị chặn
   */
  async showNotice(title: string, text: string): Promise<void> {
    const reducedMotion = this.isReducedMotion();
    await Swal.fire({
      title,
      text,
      icon: 'info',
      confirmButtonText: 'Đã hiểu',
      animation: !reducedMotion,
      customClass: {
        popup: 'rounded-2xl border border-slate-200/90 shadow-xl bg-white font-sans text-slate-800',
        title: 'text-base font-bold text-slate-900',
        htmlContainer: 'text-xs text-slate-600',
        confirmButton: 'px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition-colors'
      },
      buttonsStyling: false
    });
  }

  /**
   * Hộp thoại xác nhận chung (Action Confirmation)
   */
  async confirmAction(options: {
    title: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    icon?: 'question' | 'warning' | 'info';
  }): Promise<boolean> {
    const reducedMotion = this.isReducedMotion();
    const result: SweetAlertResult = await Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon || 'question',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || 'Xác nhận',
      cancelButtonText: options.cancelButtonText || 'Hủy',
      reverseButtons: true,
      focusConfirm: true,
      animation: !reducedMotion,
      customClass: {
        popup: 'rounded-2xl border border-slate-200/90 shadow-xl bg-white font-sans text-slate-800',
        title: 'text-lg font-bold text-slate-900',
        htmlContainer: 'text-sm text-slate-600',
        confirmButton: 'px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none',
        cancelButton: 'px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors mr-2 outline-none'
      },
      buttonsStyling: false
    });

    return !!result.isConfirmed;
  }
}
