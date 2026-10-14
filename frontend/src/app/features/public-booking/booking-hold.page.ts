import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto } from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-hold-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- 1. THANH ĐẾM NGƯỢC GIỮ CHỖ (SOFT-HOLD 10 PHÚT) -->
        <div
          class="bg-amber-50 border border-amber-200 text-amber-900 px-5 py-3.5 rounded-2xl flex items-center justify-between shadow-xs"
        >
          <div class="flex items-center gap-3">
            <i class="pi pi-clock text-amber-600 text-xl animate-pulse"></i>
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-amber-800">
                Phòng đang được giữ tạm thời cho bạn
              </p>
              <p class="text-xs text-amber-700">
                Vui lòng hoàn tất thông tin và xác nhận trong thời gian đếm ngược bên dưới.
              </p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xl font-mono font-extrabold text-amber-900">
              {{ formatCountdown(remainingSeconds()) }}
            </span>
            <span class="text-[10px] text-amber-700 block">Thời gian giữ phòng</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <!-- CỘT TRÁI: FORM THÔNG TIN KHÁCH HÀNG & DÙNG ĐIỂM (7 CỘT) -->
          <div class="md:col-span-7 space-y-6">
            <!-- Form thông tin nhận phòng -->
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <i class="pi pi-user text-indigo-600"></i>
                <span>Thông tin người nhận phòng</span>
              </h2>

              <div class="space-y-3.5">
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">
                    Họ và tên khách hàng <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="guestName"
                    placeholder="VD: Nguyễn Văn A"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">
                      Số điện thoại (SĐT) <span class="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      [(ngModel)]="guestPhone"
                      placeholder="VD: 0909123456"
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Email nhận xác nhận</label>
                    <input
                      type="email"
                      [(ngModel)]="guestEmail"
                      placeholder="VD: email@example.com"
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">
                    Ghi chú đặc biệt cho Lễ tân cơ sở
                  </label>
                  <textarea
                    [(ngModel)]="guestNote"
                    rows="2"
                    placeholder="VD: Nhận phòng muộn, yêu cầu phòng tầng cao..."
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- THANH TRƯỢT DÙNG ĐIỂM THƯỞNG & ÁP MÃ GIẢM GIÁ -->
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div>
                <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <i class="pi pi-wallet text-amber-500"></i>
                  <span>Sử dụng Điểm thưởng Thành viên</span>
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">
                  Bạn đang có <strong>{{ availableUserPoints }} điểm</strong> khả dụng (≈
                  {{ availableUserPoints * 1000 | number: '1.0-0' }}đ).
                </p>
              </div>

              <!-- Thanh trượt chọn số điểm muốn dùng -->
              <div class="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Dùng: {{ pointsToUse() }} điểm</span>
                  <span class="text-emerald-600 font-extrabold">
                    -{{ pointsDiscountAmount() | number: '1.0-0' }}đ vào hóa đơn
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  [max]="maxAllowedPointsToUse()"
                  step="10"
                  [ngModel]="pointsToUse()"
                  (ngModelChange)="pointsToUse.set(+$event)"
                  class="w-full accent-indigo-600 cursor-pointer"
                />

                <p class="text-[11px] text-slate-500">
                  * Tối đa dùng 50% giá trị đơn hàng. <strong>Cam kết hoàn 100% điểm</strong> nếu bạn hủy
                  đơn hợp lệ.
                </p>
              </div>

              <!-- Ô nhập mã khuyến mãi -->
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">
                  Mã Giảm Giá / Voucher Chuỗi
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    [(ngModel)]="promoCode"
                    placeholder="Nhập mã (VD: AURORA20)"
                    class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm uppercase"
                  />
                  <button
                    type="button"
                    (click)="applyPromoCode()"
                    class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
                @if (appliedPromoName()) {
                  <p class="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <i class="pi pi-check"></i>
                    <span>Đã áp dụng: {{ appliedPromoName() }} (-{{ promoDiscountAmount() | number: '1.0-0' }}đ)</span>
                  </p>
                }
              </div>
            </div>
          </div>

          <!-- CỘT PHẢI: TÓM TẮT HÓA ĐƠN & NÚT XÁC NHẬN (5 CỘT) -->
          <div class="md:col-span-5 space-y-4 sticky top-6">
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-4">
              <h2 class="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Tóm tắt Chi phí Đặt phòng
              </h2>

              <div class="space-y-2.5 text-xs">
                <div class="flex justify-between text-slate-600">
                  <span>Tiền phòng gốc:</span>
                  <span class="font-bold text-slate-800">{{ baseRoomPrice | number: '1.0-0' }}đ</span>
                </div>

                @if (surchargeTotal > 0) {
                  <div class="flex justify-between text-slate-600">
                    <span>Phụ thu giờ/lễ/quá giờ:</span>
                    <span class="font-bold text-slate-800">+{{ surchargeTotal | number: '1.0-0' }}đ</span>
                  </div>
                }

                @if (promoDiscountAmount() > 0) {
                  <div class="flex justify-between text-emerald-600 font-semibold">
                    <span>Mã giảm giá ({{ promoCode }})</span>
                    <span>-{{ promoDiscountAmount() | number: '1.0-0' }}đ</span>
                  </div>
                }

                @if (pointsToUse() > 0) {
                  <div class="flex justify-between text-indigo-600 font-semibold">
                    <span>Dùng {{ pointsToUse() }} điểm thưởng:</span>
                    <span>-{{ pointsDiscountAmount() | number: '1.0-0' }}đ</span>
                  </div>
                }

                <div
                  class="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t border-slate-200"
                >
                  <span>Tổng thực trả:</span>
                  <span class="text-indigo-600">{{ finalGrandTotal() | number: '1.0-0' }}đ</span>
                </div>

                <div class="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl text-[11px] font-semibold mt-2">
                  <i class="pi pi-sparkles text-emerald-600 mr-1"></i>
                  Sẽ được cộng <strong>+{{ estimatedPointsEarned }} điểm</strong> vào ví sau khi trả phòng.
                </div>
              </div>

              <button
                type="button"
                (click)="confirmBooking()"
                [disabled]="isSubmitting()"
                class="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spinner animate-spin"></i>
                  <span>Đang xử lý giữ phòng...</span>
                } @else {
                  <i class="pi pi-check-circle"></i>
                  <span>Xác nhận Đặt phòng Ngay</span>
                }
              </button>

              <p class="text-[11px] text-center text-slate-400">
                Bằng việc bấm xác nhận, bạn đồng ý với chính sách hủy phòng và quy định của cơ sở lưu trú.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BookingHoldPageComponent implements OnInit, OnDestroy {
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // --- MOCK / INITIAL DATA ---
  availableUserPoints = 320; // 320 điểm = 320.000đ
  baseRoomPrice = 900000;
  surchargeTotal = 0;
  estimatedPointsEarned = 45;

  readonly booking = signal<GuestBookingDetailDto | null>(null);
  readonly remainingSeconds = signal<number>(600); // 10 phút giữ chỗ
  readonly secondsRemaining = signal<number>(600);
  readonly isExpired = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // Form inputs
  guestName = 'Nguyễn Minh Quân';
  guestPhone = '0909888777';
  guestEmail = 'minhquan@example.com';
  guestNote = '';
  promoCode = '';

  readonly pointsToUse = signal<number>(0);
  readonly appliedPromoName = signal<string | null>(null);
  readonly promoDiscountAmount = signal<number>(0);

  private timerInterval: any;

  // --- COMPUTED ---
  readonly maxAllowedPointsToUse = computed(() => {
    const maxByFiftyPercent = Math.floor((this.baseRoomPrice + this.surchargeTotal) * 0.5 / 1000);
    return Math.min(this.availableUserPoints, maxByFiftyPercent);
  });

  readonly pointsDiscountAmount = computed(() => this.pointsToUse() * 1000);

  readonly finalGrandTotal = computed(() => {
    const raw =
      this.baseRoomPrice +
      this.surchargeTotal -
      this.promoDiscountAmount() -
      this.pointsDiscountAmount();
    return raw > 0 ? raw : 0;
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParams;
    if (q) {
      if (q['price']) {
        const p = Number(q['price']);
        if (!isNaN(p) && p > 0) {
          this.baseRoomPrice = p;
        }
      }
      if (q['surcharge']) {
        const s = Number(q['surcharge']);
        if (!isNaN(s) && s >= 0) {
          this.surchargeTotal = s;
        }
      }
    }

    const token = this.route.snapshot.paramMap?.get('token') || (q && q['token']);
    if (token) {
      this.loadBooking(token);
      return;
    }

    this.startCountdownTimer();
  }

  loadBooking(token: string): void {
    this.publicBookingService.getBookingByToken(token).subscribe({
      next: (detail) => {
        this.booking.set(detail);

        if (detail.status === 'Confirmed' || detail.status === 'CheckedIn') {
          this.router.navigate(['/booking/status', token]);
          return;
        }

        const sec = detail.secondsRemaining ?? 600;
        this.remainingSeconds.set(sec);
        this.secondsRemaining.set(sec);

        if (detail.totalAmount) {
          this.baseRoomPrice = detail.totalAmount;
        }

        if (sec <= 0 || detail.status === 'Expired') {
          this.isExpired.set(true);
        } else {
          this.startCountdownTimer();
        }
      },
      error: () => {
        this.alertService.error('Không tìm thấy thông tin giữ phòng với mã này.');
        this.router.navigate(['/booking']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formattedTimeRemaining(): string {
    return this.formatCountdown(this.secondsRemaining());
  }

  applyPromoCode(): void {
    if (this.promoCode.trim().toUpperCase() === 'AURORA20') {
      const discount = (this.baseRoomPrice + this.surchargeTotal) * 0.2;
      this.promoDiscountAmount.set(discount);
      this.appliedPromoName.set('Giảm 20% Khách hàng thân thiết');
    } else {
      this.promoDiscountAmount.set(0);
      this.appliedPromoName.set(null);
      alert('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }
  }

  confirmBooking(): void {
    if (!this.guestName || !this.guestPhone) {
      alert('Vui lòng điền đầy đủ Họ tên và Số điện thoại.');
      return;
    }

    this.isSubmitting.set(true);

    const q = this.route.snapshot.queryParams;
    if (q && q['propertySlug'] && q['roomTypeId']) {
      const rentalTypeInt = q['rentalType'] === 'Hourly' ? 1 : (q['rentalType'] === 'Overnight' ? 2 : 0);
      const now = new Date();
      const points = this.pointsToUse() > 0 ? this.pointsToUse() : undefined;

      this.publicBookingService.createHold({
        propertySlug: q['propertySlug'],
        roomTypeId: q['roomTypeId'],
        rentalType: rentalTypeInt,
        startAtUtc: now.toISOString(),
        endAtUtc: new Date(now.getTime() + 86400000).toISOString(),
        guestName: this.guestName.trim(),
        guestPhone: this.guestPhone.trim(),
        guestEmail: this.guestEmail.trim(),
        numberOfGuests: 2,
        checkInDate: q['checkInDate'] || now.toISOString().split('T')[0],
        checkOutDate: q['checkOutDate'] || new Date(now.getTime() + 86400000).toISOString().split('T')[0],
        expectedTotalAmount: this.finalGrandTotal(),
        pointsToRedeem: points
      }).subscribe({
        next: (holdRes) => {
          this.isSubmitting.set(false);
          this.router.navigate(['/booking/status', holdRes.lookupToken || 'TOKEN-DEMO-9981']);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/booking/status', 'TOKEN-DEMO-9981']);
        }
      });
      return;
    }

    setTimeout(() => {
      this.isSubmitting.set(false);
      // Chuyển sang trang trạng thái đặt phòng kèm mã token
      this.router.navigate(['/booking/status', 'TOKEN-DEMO-9981']);
    }, 1200);
  }

  private startCountdownTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.remainingSeconds.update((curr) => {
        if (curr <= 1) {
          clearInterval(this.timerInterval);
          this.isExpired.set(true);
          this.secondsRemaining.set(0);
          alert('Hết thời gian giữ phòng tạm thời. Vui lòng thực hiện lại tìm kiếm.');
          this.router.navigate(['/booking']);
          return 0;
        }
        const next = curr - 1;
        this.secondsRemaining.set(next);
        return next;
      });
    }, 1000);
  }
}

export { BookingHoldPageComponent as BookingHoldPage };
