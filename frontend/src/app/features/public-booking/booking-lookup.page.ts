import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-lookup',
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
          <span class="text-slate-800 font-semibold">Tra cứu &amp; Quản lý Đặt phòng</span>
        </nav>

        <!-- 2. FORM TRA CỨU MÃ TOKEN ĐẶT PHÒNG -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div class="space-y-1">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <i class="pi pi-ticket text-indigo-600"></i>
              <span>Tra cứu Thông tin Đặt phòng</span>
            </h1>
            <p class="text-xs text-slate-500">
              Nhập mã Token bảo mật hoặc mã xác nhận giữ phòng quý khách đã nhận được khi đặt phòng. Không cần đăng nhập tài khoản.
            </p>
          </div>

          <form (ngSubmit)="onSearch()" class="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              [(ngModel)]="searchToken"
              name="lookupToken"
              placeholder="Nhập mã token hoặc mã xác nhận (VD: a1b2c3d4e5f6...)"
              class="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs sm:text-sm focus:bg-white focus:outline-indigo-500"
              required
            />
            <button
              type="submit"
              [disabled]="isLoading() || !searchToken.trim()"
              class="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer shrink-0"
            >
              @if (isLoading()) {
                <span class="flex items-center gap-2">
                  <i class="pi pi-spin pi-spinner"></i>
                  <span>Đang tra cứu...</span>
                </span>
              } @else {
                <span>Tra cứu đơn đặt</span>
              }
            </button>
          </form>
        </div>

        <!-- 3. KẾT QUẢ TRA CỨU ĐƠN ĐẶT PHÒNG -->
        @if (booking()) {
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-300">

            <!-- A. HEADER TRẠNG THÁI -->
            <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span
                    class="px-3 py-1 rounded-full text-xs font-bold border"
                    [class]="getStatusBadgeClass(booking()?.status || '')"
                  >
                    {{ getStatusLabel(booking()?.status || '') }}
                  </span>
                  <span class="text-xs font-mono font-bold text-slate-600">
                    Mã: {{ booking()?.confirmationCode }}
                  </span>
                </div>
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900">{{ booking()?.propertyName }}</h2>
                <p class="text-xs text-slate-500">{{ booking()?.propertyAddress }}</p>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="printConfirmation()"
                  class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <i class="pi pi-print text-xs"></i>
                  <span>In phiếu xác nhận</span>
                </button>
              </div>
            </div>

            <!-- B. BODY CHI TIẾT LƯU TRÚ & HÓA ĐƠN TẠM TÍNH -->
            <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Left: Thông tin lưu trú -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin lưu trú</h3>
                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Hạng phòng:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.roomTypeName }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Chế độ thuê:</span>
                    <span class="font-bold text-indigo-700">{{ booking()?.rentalType }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Nhận phòng:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.checkInDate || 'Theo giờ thỏa thuận' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Trả phòng:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.checkOutDate || 'Theo giờ thỏa thuận' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Số lượng khách:</span>
                    <span class="font-semibold text-slate-800">{{ booking()?.numberOfGuests }} khách</span>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-slate-200">
                    <span class="text-slate-500">Khách đặt (bảo vệ PII):</span>
                    <span class="font-semibold text-slate-800">{{ booking()?.maskedGuestName }} ({{ booking()?.maskedGuestEmail }})</span>
                  </div>
                </div>
              </div>

              <!-- Right: Bóc tách tài chính Folio -->
              <div class="space-y-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Hóa đơn &amp; Thanh toán</h3>
                <div class="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 text-xs">
                  <div class="flex justify-between text-slate-600">
                    <span>Tổng tiền phòng dự kiến:</span>
                    <span class="font-bold text-slate-900 font-mono">{{ booking()?.totalAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-slate-600">
                    <span>Tiền cọc tối thiểu (30%):</span>
                    <span class="font-mono">{{ booking()?.depositRequired | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <span>Số tiền đã thanh toán:</span>
                    <span class="font-mono font-bold">{{ booking()?.paidAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-indigo-700 font-extrabold text-sm pt-2 border-t border-slate-100">
                    <span>Còn lại thanh toán tại quầy lễ tân:</span>
                    <span class="font-mono">{{ booking()?.remainingBalance | number:'1.0-0' }} ₫</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- C. FORM GỬI ĐÁNH GIÁ NẾU ĐÃ CHECK-OUT -->
            @if (booking()?.status === 'CheckedOut') {
              <div class="p-6 sm:p-8 bg-indigo-50/40 border-t border-indigo-100 space-y-4">
                <div class="space-y-1">
                  <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <i class="pi pi-star text-amber-500"></i>
                    <span>Đánh giá trải nghiệm kỳ nghỉ của Quý khách</span>
                  </h3>
                  <p class="text-xs text-slate-500">
                    Đơn đặt phòng này đã hoàn tất lưu trú. Quý khách vui lòng chia sẻ cảm nhận để giúp cơ sở nâng cao chất lượng dịch vụ!
                  </p>
                </div>

                @if (!reviewSubmitted()) {
                  <div class="space-y-3 max-w-lg">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-slate-700">Điểm đánh giá:</span>
                      <div class="flex items-center gap-1 text-amber-400 text-lg cursor-pointer">
                        @for (star of [1,2,3,4,5]; track star) {
                          <i
                            class="pi"
                            [class.pi-star-fill]="star <= userRating()"
                            [class.pi-star]="star > userRating()"
                            (click)="userRating.set(star)"
                          ></i>
                        }
                      </div>
                    </div>

                    <textarea
                      [(ngModel)]="reviewComment"
                      rows="3"
                      placeholder="Chia sẻ nhận xét về độ sạch sẽ, thái độ lễ tân, tiện nghi phòng..."
                      class="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs focus:outline-indigo-500"
                    ></textarea>

                    <button
                      type="button"
                      (click)="submitReview()"
                      [disabled]="!reviewComment.trim()"
                      class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Gửi đánh giá xác thực
                    </button>
                  </div>
                } @else {
                  <div class="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                    <i class="pi pi-check-circle text-emerald-600"></i>
                    <span>Cảm ơn Quý khách! Đánh giá đã được ghi nhận thành công và hiển thị trên trang của cơ sở.</span>
                  </div>
                }
              </div>
            }

          </div>
        }

      </div>
    </div>
  `
})
export class BookingLookupPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);

  searchToken = '';
  readonly isLoading = signal<boolean>(false);
  readonly booking = signal<GuestBookingDetailDto | null>(null);

  readonly userRating = signal<number>(5);
  reviewComment = '';
  readonly reviewSubmitted = signal<boolean>(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.searchToken = token;
        this.onSearch();
      }
    });
  }

  onSearch(): void {
    const token = this.searchToken.trim();
    if (!token) return;

    this.isLoading.set(true);
    this.publicBookingService.getBookingByToken(token).subscribe({
      next: (b) => {
        this.isLoading.set(false);
        this.booking.set(b);
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.error('Không tìm thấy thông tin đặt phòng với mã token này. Vui lòng kiểm tra lại.');
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

  printConfirmation(): void {
    window.print();
  }

  submitReview(): void {
    const b = this.booking();
    if (!b || !this.reviewComment.trim()) return;

    this.publicBookingService.submitReview({
      lookupToken: b.lookupToken,
      rating: this.userRating(),
      comment: this.reviewComment
    }).subscribe(() => {
      this.reviewSubmitted.set(true);
      this.alertService.success('Đã gửi đánh giá thành công.');
    });
  }
}
