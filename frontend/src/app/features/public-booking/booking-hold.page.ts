import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-hold',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
      <!-- Header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              H
            </div>
            <span class="text-base font-bold text-slate-900 tracking-tight">Xác nhận giữ phòng trực tuyến</span>
          </div>
          <a routerLink="/booking" class="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Quay lại tìm kiếm
          </a>
        </div>
      </header>

      <main class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        <!-- Loading State -->
        <div *ngIf="isLoading()" class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p class="text-sm text-slate-600">Đang tải thông tin giữ phòng...</p>
        </div>

        <div *ngIf="!isLoading() && booking()" class="space-y-6">
          <!-- Countdown Timer Banner -->
          <div [ngClass]="isExpired() ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'" class="rounded-2xl border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div class="flex items-center gap-3.5">
              <div [ngClass]="isExpired() ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'" class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold">
                {{ isExpired() ? '⚠️' : '⏱' }}
              </div>
              <div>
                <h2 class="text-base font-bold">{{ isExpired() ? 'Thời gian giữ phòng 15 phút đã hết hạn' : 'Đang giữ phòng cho quý khách' }}</h2>
                <p class="text-xs text-slate-600">
                  {{ isExpired() ? 'Phòng đã được trả lại cho kho phòng công khai. Vui lòng thực hiện đặt phòng mới.' : 'Vui lòng hoàn tất nộp cọc 30% trước khi đồng hồ đếm ngược kết thúc.' }}
                </p>
              </div>
            </div>

            <!-- Big Digital Countdown -->
            <div *ngIf="!isExpired()" class="bg-white px-5 py-2.5 rounded-xl border border-indigo-200 shadow-sm text-center">
              <div class="text-2xl font-black text-indigo-600 font-mono tracking-widest">
                {{ formattedTimeRemaining() }}
              </div>
              <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Thời gian còn lại</span>
            </div>

            <div *ngIf="isExpired()">
              <a routerLink="/booking" class="inline-flex px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors">
                Đặt lại phòng mới →
              </a>
            </div>
          </div>

          <!-- Booking Summary Card -->
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-6 sm:p-8 border-b border-slate-100">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {{ booking()?.status }}
                  </span>
                  <h1 class="text-2xl font-bold text-slate-900 mt-2">{{ booking()?.propertyName }}</h1>
                  <p class="text-xs text-slate-500 mt-0.5">{{ booking()?.propertyAddress }}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Mã xác nhận</span>
                  <div class="text-lg font-mono font-bold text-slate-800">{{ booking()?.confirmationCode }}</div>
                </div>
              </div>
            </div>

            <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
              <!-- Left Details -->
              <div class="space-y-3 text-sm">
                <div class="flex justify-between py-1.5 border-b border-slate-200/60">
                  <span class="text-slate-500">Loại phòng:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.roomTypeName }}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-200/60">
                  <span class="text-slate-500">Hình thức thuê:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.rentalType }}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-200/60">
                  <span class="text-slate-500">Số lượng khách:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.numberOfGuests }} khách</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-200/60">
                  <span class="text-slate-500">Người đặt (PII bảo vệ):</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.maskedGuestName }} ({{ booking()?.maskedGuestEmail }})</span>
                </div>
              </div>

              <!-- Right Financial Folio Breakdown -->
              <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Chi phí & Tiền cọc</h3>
                <div class="flex justify-between text-sm">
                  <span class="text-slate-600">Tổng tiền phòng:</span>
                  <span class="font-bold text-slate-900">{{ booking()?.totalAmount | number:'1.0-0' }} đ</span>
                </div>
                <div class="flex justify-between text-base font-extrabold text-indigo-700 bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
                  <span>Tiền cọc cần nộp (30%):</span>
                  <span>{{ booking()?.depositRequired | number:'1.0-0' }} đ</span>
                </div>
                <div class="flex justify-between text-xs text-slate-500">
                  <span>Còn lại thanh toán khi check-in:</span>
                  <span>{{ ((booking()?.totalAmount || 0) - (booking()?.depositRequired || 0)) | number:'1.0-0' }} đ</span>
                </div>
              </div>
            </div>

            <!-- Payment Instructions & Status Navigation Section (Decisions D08, D15, D21) -->
            <div *ngIf="!isExpired()" class="p-6 sm:p-8 bg-white border-t border-slate-100">
              <h3 class="text-base font-bold text-slate-900 mb-2">Hướng dẫn thanh toán tiền cọc 30%</h3>
              <p class="text-xs text-slate-600 mb-4">
                Theo quy định D08/D15, tiền cọc được xác nhận bởi nhân viên lễ tân sau khi kiểm tra chuyển khoản hoặc thu tiền tại quầy. Hệ thống công khai không tự động tạo giao dịch tài chính.
              </p>

              <div class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 mb-6 space-y-2 text-xs">
                <div class="flex justify-between items-center text-slate-700">
                  <span class="font-medium">Số tiền cọc cần nộp (30%):</span>
                  <span class="text-base font-bold text-indigo-700 font-mono">{{ booking()?.depositRequired | number:'1.0-0' }} đ</span>
                </div>
                <div class="flex justify-between items-center text-slate-700">
                  <span class="font-medium">Cú pháp nội dung chuyển khoản:</span>
                  <span class="font-bold font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-indigo-200">{{ booking()?.confirmationCode }}</span>
                </div>
                <div class="flex justify-between items-center text-slate-700">
                  <span class="font-medium">Tài khoản thụ hưởng:</span>
                  <span class="font-semibold text-slate-800">Vietcombank - 0123456789 (Khách sạn)</span>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-xs text-slate-400">
                  Mã tra cứu bảo mật: <span class="font-mono text-slate-600">{{ booking()?.lookupToken?.substring(0, 16) }}...</span>
                </div>
                <a
                  [routerLink]="['/booking/status', booking()?.lookupToken]"
                  class="w-full sm:w-auto text-center px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all">
                  Kiểm tra trạng thái đơn đặt →
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `
})
export class BookingHoldPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  booking = signal<GuestBookingDetailDto | null>(null);
  isLoading = signal<boolean>(true);
  isExpired = signal<boolean>(false);
  secondsRemaining = signal<number>(0);

  private timerInterval: any = null;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.alertService.toastError('Mã giữ phòng không hợp lệ.');
      this.router.navigate(['/booking']);
      return;
    }

    this.loadBooking(token);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  loadBooking(token: string): void {
    this.isLoading.set(true);
    this.publicBookingService.getBookingByToken(token).subscribe({
      next: detail => {
        this.booking.set(detail);
        this.isLoading.set(false);

        if (detail.status === 'Confirmed' || detail.status === 'CheckedIn') {
          // Already confirmed, forward to status page
          this.router.navigate(['/booking/status', token]);
          return;
        }

        if (detail.secondsRemaining !== null && detail.secondsRemaining !== undefined) {
          this.secondsRemaining.set(detail.secondsRemaining);
          if (detail.secondsRemaining <= 0 || detail.status === 'Expired') {
            this.isExpired.set(true);
          } else {
            this.startTimer();
          }
        }
      },
      error: err => {
        this.isLoading.set(false);
        this.alertService.toastError(err?.error?.message || 'Không tìm thấy thông tin giữ phòng với mã này.');
        this.router.navigate(['/booking']);
      }
    });
  }

  startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const remaining = this.secondsRemaining() - 1;
      if (remaining <= 0) {
        this.secondsRemaining.set(0);
        this.isExpired.set(true);
        clearInterval(this.timerInterval);
      } else {
        this.secondsRemaining.set(remaining);
      }
    }, 1000);
  }

  formattedTimeRemaining(): string {
    const sec = this.secondsRemaining();
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
