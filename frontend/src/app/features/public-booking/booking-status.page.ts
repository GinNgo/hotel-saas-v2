import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-status',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-6 sm:py-8 font-sans">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">

        <!-- 1. BREADCRUMB -->
        <nav class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/booking" class="hover:text-indigo-600 transition-colors">Trang chủ</a>
          <span>/</span>
          <a routerLink="/booking/lookup" class="hover:text-indigo-600 transition-colors">Tra cứu</a>
          <span>/</span>
          <span class="text-slate-800 font-semibold truncate">Trạng thái đặt phòng</span>
        </nav>

        <!-- 2. SEARCH BOX NẾU CHƯA CÓ BOOKING -->
        @if (!booking() && !isSearching()) {
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 class="text-base font-bold text-slate-900">Tra cứu trạng thái đặt phòng bảo mật</h2>
            <p class="text-xs text-slate-500">Nhập mã Token bảo mật nhận được khi giữ chỗ hoặc nộp cọc.</p>
            <div class="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                [(ngModel)]="searchToken"
                placeholder="Nhập mã token bảo mật..."
                class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-indigo-500"
              />
              <button
                (click)="onSearch()"
                [disabled]="!searchToken.trim()"
                class="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
              >
                Tra cứu ngay
              </button>
            </div>
          </div>
        }

        <!-- LOADING SPINNER -->
        @if (isSearching()) {
          <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p class="text-xs font-semibold text-slate-600">Đang kiểm tra trạng thái đơn đặt phòng...</p>
          </div>
        }

        <!-- 3. BOOKING DETAILS & QR CHECK-IN CARD -->
        @if (booking()) {
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-200">

            <!-- Top Header & Status -->
            <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span [class]="getStatusBadgeClass(booking()?.status || '')" class="px-3 py-1 text-xs font-bold rounded-full border">
                    {{ getStatusLabel(booking()?.status || '') }}
                  </span>
                  <span class="text-xs text-slate-500 font-mono font-bold">Mã xác nhận: {{ booking()?.confirmationCode }}</span>
                </div>
                <h1 class="text-2xl font-black text-slate-900 tracking-tight">{{ booking()?.propertyName }}</h1>
                <p class="text-xs text-slate-500 flex items-center gap-1">
                  <i class="pi pi-map-marker text-indigo-600"></i>
                  <span>{{ booking()?.propertyAddress }}</span>
                </p>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-2">
                <a
                  [href]="getDirectionsUrl()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <i class="pi pi-directions text-xs text-indigo-600"></i>
                  <span>Chỉ đường tới cơ sở</span>
                </a>

                <button
                  type="button"
                  (click)="printConfirmation()"
                  class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <i class="pi pi-print text-xs"></i>
                  <span>In phiếu nhận phòng</span>
                </button>
              </div>
            </div>

            <!-- QR Code Check-in Banner -->
            <div class="p-6 sm:p-8 bg-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
              <div class="space-y-2 text-center sm:text-left">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950">
                  Thủ tục nhận phòng nhanh (Fast Check-in)
                </span>
                <h2 class="text-lg font-bold text-white">Xuất trình Mã này cho Lễ tân tại Quầy</h2>
                <p class="text-xs text-indigo-200 max-w-md">
                  Lễ tân chỉ cần quét mã hoặc kiểm tra mã xác nhận <b>{{ booking()?.confirmationCode }}</b> để hoàn tất nhận phòng trong 30 giây.
                </p>
              </div>

              <!-- Mock QR Code Box -->
              <div class="bg-white p-3 rounded-2xl shadow-md text-center shrink-0">
                <div class="w-32 h-32 bg-slate-100 rounded-xl flex flex-col items-center justify-center p-2 border border-slate-200">
                  <i class="pi pi-qrcode text-5xl text-slate-900 mb-1"></i>
                  <span class="text-[9px] font-mono font-bold text-slate-700 truncate w-28">{{ booking()?.confirmationCode }}</span>
                </div>
                <span class="text-[10px] text-slate-400 font-semibold block mt-1">QR Check-in</span>
              </div>
            </div>

            <!-- Body Details -->
            <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Left Info -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin lưu trú</h3>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Hạng phòng:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.roomTypeName }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Chế độ thuê:</span>
                    <span class="font-bold text-indigo-700">{{ booking()?.rentalType }}</span>
                  </div>
                  @if (booking()?.checkInDate) {
                    <div class="flex justify-between">
                      <span class="text-slate-500">Nhận phòng:</span>
                      <span class="font-bold text-slate-900">{{ booking()?.checkInDate }}</span>
                    </div>
                  }
                  @if (booking()?.checkOutDate) {
                    <div class="flex justify-between">
                      <span class="text-slate-500">Trả phòng:</span>
                      <span class="font-bold text-slate-900">{{ booking()?.checkOutDate }}</span>
                    </div>
                  }
                  <div class="flex justify-between">
                    <span class="text-slate-500">Số lượng khách:</span>
                    <span class="font-semibold text-slate-900">{{ booking()?.numberOfGuests }} người</span>
                  </div>
                </div>

                <!-- PII protection notice -->
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Khách lưu trú (Bảo mật PII)</h3>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs font-mono">
                  <div class="flex justify-between">
                    <span class="text-slate-500 font-sans">Họ và tên:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.maskedGuestName }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500 font-sans">Email:</span>
                    <span class="font-semibold text-slate-800">{{ booking()?.maskedGuestEmail }}</span>
                  </div>
                  @if (booking()?.maskedGuestPhone) {
                    <div class="flex justify-between">
                      <span class="text-slate-500 font-sans">Số điện thoại:</span>
                      <span class="font-semibold text-slate-800">{{ booking()?.maskedGuestPhone }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Right Financial Folio -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Hóa đơn &amp; Tài chính</h3>
                <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
                  <div class="flex justify-between text-slate-600">
                    <span>Tổng chi phí phòng:</span>
                    <span class="font-bold text-slate-900 font-mono">{{ booking()?.totalAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-emerald-700 bg-emerald-50 rounded-xl p-3 border border-emerald-100 font-semibold">
                    <span>Số tiền đã thanh toán (Cọc):</span>
                    <span class="font-mono font-bold">{{ booking()?.paidAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-slate-800 bg-slate-50 rounded-xl p-3 border border-slate-200 font-semibold">
                    <span>Còn lại thu tại quầy:</span>
                    <span class="font-mono font-bold text-indigo-700">{{ booking()?.remainingBalance | number:'1.0-0' }} ₫</span>
                  </div>

                  <div class="pt-2 border-t border-slate-100">
                    <span class="text-xs font-bold" [class.text-emerald-600]="booking()?.isFullyPaid" [class.text-slate-500]="!booking()?.isFullyPaid">
                      {{ booking()?.isFullyPaid ? '✓ Đã tất toán toàn bộ 100%' : 'Chưa tất toán (Thanh toán số tiền còn lại khi làm thủ tục nhận phòng)' }}
                    </span>
                  </div>
                </div>

                @if (booking()?.breakdown && booking()!.breakdown.length > 0) {
                  <div>
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bảng phân rã chi phí</h4>
                    <div class="space-y-1.5 text-xs text-slate-600">
                      @for (item of booking()!.breakdown; track item.description) {
                        <div class="flex justify-between py-1 border-b border-slate-100">
                          <span>{{ item.description }} (x{{ item.quantity }})</span>
                          <span class="font-medium text-slate-800 font-mono">{{ item.amount | number:'1.0-0' }} ₫</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Bottom Actions -->
            <div class="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div class="text-xs text-slate-500">
                Mã tra cứu bảo mật: <span class="font-mono text-slate-700 select-all">{{ booking()?.lookupToken }}</span>
              </div>
              <div class="flex items-center gap-3">
                <button (click)="copyToken()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer">
                  Sao chép mã tra cứu
                </button>
                <a routerLink="/booking" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer">
                  Đặt thêm phòng khác
                </a>
              </div>
            </div>

          </div>
        }

      </div>
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
    this.route.paramMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this.searchToken = token;
        this.fetchBooking(token);
      }
    });
  }

  onSearch(): void {
    if (!this.searchToken.trim()) return;
    this.fetchBooking(this.searchToken.trim());
  }

  fetchBooking(token: string): void {
    this.isSearching.set(true);
    this.publicBookingService.getBookingByToken(token).subscribe({
      next: (b) => {
        this.isSearching.set(false);
        this.booking.set(b);
      },
      error: () => {
        this.isSearching.set(false);
        this.alertService.error('Không tìm thấy thông tin đặt phòng với mã token này.');
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Hold': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Confirmed': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CheckedIn': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CheckedOut': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Hold': return 'Đang giữ phòng (Chờ nộp cọc)';
      case 'Confirmed': return 'Đã xác nhận đặt phòng';
      case 'CheckedIn': return 'Đang lưu trú tại cơ sở';
      case 'CheckedOut': return 'Đã trả phòng (Hoàn tất)';
      case 'Cancelled': return 'Đã hủy';
      default: return status || 'Không xác định';
    }
  }

  copyToken(): void {
    const token = this.booking()?.lookupToken;
    if (token && navigator.clipboard) {
      navigator.clipboard.writeText(token);
      this.alertService.success('Đã sao chép mã tra cứu vào clipboard.');
    }
  }

  printConfirmation(): void {
    window.print();
  }

  getDirectionsUrl(): string {
    const addr = this.booking()?.propertyAddress || this.booking()?.propertyName || '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  }
}

export { BookingStatusPage as BookingStatusPageComponent };
