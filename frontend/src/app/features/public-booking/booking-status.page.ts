import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-status',
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
            <span class="text-base font-bold text-slate-900 tracking-tight">Tra cứu & Trạng thái đặt phòng</span>
          </div>
          <div class="flex items-center gap-3">
            <a routerLink="/booking" class="text-sm font-medium text-slate-500 hover:text-slate-800">
              Đặt phòng mới
            </a>
          </div>
        </div>
      </header>

      <main class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        <!-- Token Lookup Search Box -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 class="text-base font-bold text-slate-900 mb-1">Tra cứu thông tin đặt phòng bảo mật</h2>
          <p class="text-xs text-slate-500 mb-4">Nhập mã tra cứu bảo mật (Lookup Token) nhận được khi giữ hoặc xác nhận đặt phòng.</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              [(ngModel)]="searchToken"
              placeholder="Nhập mã token (ví dụ: a1b2c3d4e5f6...)"
              class="flex-1 rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 px-3 font-mono" />
            <button
              (click)="onSearch()"
              [disabled]="!searchToken.trim() || isSearching()"
              class="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50">
              <span *ngIf="isSearching()">Đang tìm...</span>
              <span *ngIf="!isSearching()">Tra cứu</span>
            </button>
          </div>
        </div>

        <!-- Booking Result Details -->
        <div *ngIf="booking()" class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <!-- Top Banner & Status -->
          <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span [ngClass]="getStatusBadgeClass(booking()?.status || '')" class="px-3 py-1 text-xs font-bold rounded-full border">
                  {{ getStatusLabel(booking()?.status || '') }}
                </span>
                <span class="text-xs text-slate-400 font-mono">Mã xác nhận: {{ booking()?.confirmationCode }}</span>
              </div>
              <h1 class="text-2xl font-bold text-slate-900">{{ booking()?.propertyName }}</h1>
              <p class="text-xs text-slate-500 mt-0.5">{{ booking()?.propertyAddress }}</p>
            </div>

            <div class="text-right">
              <span class="text-xs text-slate-400 font-medium">Thời điểm tạo</span>
              <div class="text-xs font-semibold text-slate-700">{{ booking()?.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
          </div>

          <!-- Body details -->
          <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Left Info -->
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin lưu trú</h3>
              <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-500">Loại phòng:</span>
                  <span class="font-bold text-slate-900">{{ booking()?.roomTypeName }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Hình thức thuê:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.rentalType }}</span>
                </div>
                <div class="flex justify-between" *ngIf="booking()?.checkInDate">
                  <span class="text-slate-500">Nhận phòng:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.checkInDate }}</span>
                </div>
                <div class="flex justify-between" *ngIf="booking()?.checkOutDate">
                  <span class="text-slate-500">Trả phòng:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.checkOutDate }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Số lượng khách:</span>
                  <span class="font-semibold text-slate-900">{{ booking()?.numberOfGuests }} người</span>
                </div>
              </div>

              <!-- PII Protection Notice -->
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6">Thông tin khách hàng (Đã mã hóa PII)</h3>
              <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-500">Họ và tên:</span>
                  <span class="font-semibold text-slate-900 font-mono">{{ booking()?.maskedGuestName }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Email:</span>
                  <span class="font-semibold text-slate-900 font-mono">{{ booking()?.maskedGuestEmail }}</span>
                </div>
                <div class="flex justify-between" *ngIf="booking()?.maskedGuestPhone">
                  <span class="text-slate-500">Số điện thoại:</span>
                  <span class="font-semibold text-slate-900 font-mono">{{ booking()?.maskedGuestPhone }}</span>
                </div>
              </div>
            </div>

            <!-- Right Financial Reconciliation -->
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Đối soát tài chính</h3>
              <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-500">Tổng tiền lưu trú:</span>
                  <span class="font-bold text-slate-900">{{ booking()?.totalAmount | number:'1.0-0' }} đ</span>
                </div>
                <div class="flex justify-between text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <span class="font-semibold">Đã thanh toán (Cọc):</span>
                  <span class="font-bold">{{ booking()?.paidAmount | number:'1.0-0' }} đ</span>
                </div>
                <div class="flex justify-between text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <span class="font-semibold">Còn lại cần thu tại quầy:</span>
                  <span class="font-bold text-indigo-700">{{ booking()?.remainingBalance | number:'1.0-0' }} đ</span>
                </div>

                <div class="pt-2 border-t border-slate-100">
                  <span class="text-xs font-semibold" [ngClass]="booking()?.isFullyPaid ? 'text-emerald-600' : 'text-slate-500'">
                    {{ booking()?.isFullyPaid ? '✓ Đã thanh toán đầy đủ 100%' : 'Chưa tất toán (Thanh toán phần còn lại khi nhận phòng)' }}
                  </span>
                </div>
              </div>

              <!-- Quote Itemized Breakdown -->
              <div *ngIf="booking()?.breakdown && (booking()?.breakdown)!.length > 0" class="mt-4">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bảng phân rã chi phí</h4>
                <div class="space-y-1.5 text-xs text-slate-600">
                  <div *ngFor="let item of booking()?.breakdown" class="flex justify-between py-1 border-b border-slate-100">
                    <span>{{ item.description }} (x{{ item.quantity }})</span>
                    <span class="font-medium text-slate-800">{{ item.amount | number:'1.0-0' }} đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div class="text-xs text-slate-500">
              Mã bảo mật: <span class="font-mono text-slate-700 select-all">{{ booking()?.lookupToken }}</span>
            </div>
            <div class="flex items-center gap-3">
              <button (click)="copyToken()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors">
                Sao chép mã tra cứu
              </button>
              <a routerLink="/booking" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                Đặt thêm phòng khác
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  `
})
export class BookingStatusPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  searchToken: string = '';
  booking = signal<GuestBookingDetailDto | null>(null);
  isSearching = signal<boolean>(false);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      this.searchToken = token;
      this.fetchBooking(token);
    }
  }

  onSearch(): void {
    if (!this.searchToken.trim()) return;
    this.router.navigate(['/booking/status', this.searchToken.trim()]);
    this.fetchBooking(this.searchToken.trim());
  }

  fetchBooking(token: string): void {
    this.isSearching.set(true);
    this.publicBookingService.getBookingByToken(token).subscribe({
      next: detail => {
        this.booking.set(detail);
        this.isSearching.set(false);
      },
      error: err => {
        this.isSearching.set(false);
        this.alertService.toastError(err?.error?.message || 'Không tìm thấy thông tin đặt phòng với mã này.');
      }
    });
  }

  copyToken(): void {
    if (this.booking()?.lookupToken) {
      navigator.clipboard?.writeText(this.booking()!.lookupToken);
      this.alertService.toastSuccess('Đã sao chép mã tra cứu vào bộ nhớ tạm.');
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PendingPayment':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CheckedIn':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Expired':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Confirmed':
        return 'Đã xác nhận';
      case 'PendingPayment':
        return 'Đang giữ phòng (Chờ thanh toán cọc)';
      case 'CheckedIn':
        return 'Đã nhận phòng';
      case 'Expired':
        return 'Đã hết hạn giữ phòng';
      default:
        return status;
    }
  }
}
