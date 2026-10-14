import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import {
  GuestBookingDetailDto,
  GuestHoldDto,
  PublicPropertyDto,
  PublicRoomTypeDto,
  RentalType
} from '../../core/models/public-booking.model';

@Component({
  selector: 'app-booking-hold',
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
          <span class="text-slate-800 font-semibold truncate">Xác nhận giữ phòng trực tuyến</span>
        </nav>

        <!-- LOADING STATE -->
        @if (isLoading()) {
          <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p class="text-xs font-semibold text-slate-600">Đang tải thông tin phòng...</p>
          </div>
        }

        <!-- 2. TRƯỜNG HỢP A: ĐÃ CÓ ĐƠN GIỮ PHÒNG (COUNTDOWN TIMER + HƯỚNG DẪN NỘP CỌC) -->
        @if (!isLoading() && booking()) {
          <div class="space-y-6 animate-in fade-in duration-200">
            <!-- Countdown Timer Banner -->
            <div
              [class]="isExpired() ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'"
              class="rounded-3xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
            >
              <div class="flex items-center gap-4 text-center sm:text-left">
                <div
                  [class]="isExpired() ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'"
                  class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 mx-auto"
                >
                  <i class="pi" [class.pi-exclamation-triangle]="isExpired()" [class.pi-clock]="!isExpired()"></i>
                </div>
                <div>
                  <h2 class="text-base font-extrabold">
                    {{ isExpired() ? 'Thời gian giữ phòng 15 phút đã hết hạn' : 'Đang khóa & Giữ phòng cho Quý khách' }}
                  </h2>
                  <p class="text-xs text-slate-600 mt-0.5">
                    {{ isExpired()
                      ? 'Phòng đã được tự động hoàn trả về kho phòng. Quý khách vui lòng thao tác giữ phòng lại.'
                      : 'Phòng được bảo lưu độc quyền. Quý khách vui lòng hoàn tất nộp cọc 30% trước khi đồng hồ kết thúc.' }}
                  </p>
                </div>
              </div>

              @if (!isExpired()) {
                <div class="bg-white px-6 py-3 rounded-2xl border border-indigo-200 shadow-xs text-center shrink-0">
                  <div class="text-3xl font-black text-indigo-600 font-mono tracking-widest">
                    {{ formattedTimeRemaining() }}
                  </div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian giữ chỗ còn lại</span>
                </div>
              } @else {
                <a routerLink="/booking" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors shrink-0">
                  Đặt lại phòng mới →
                </a>
              }
            </div>

            <!-- Booking Summary Card -->
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span [class]="statusBadgeClass()" class="px-3 py-1 text-xs font-bold rounded-full border">
                    {{ statusLabel() }}
                  </span>
                  <h1 class="text-2xl font-bold text-slate-900 mt-2">{{ booking()?.propertyName }}</h1>
                  <p class="text-xs text-slate-500 mt-0.5">{{ booking()?.propertyAddress }}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Mã xác nhận</span>
                  <div class="text-lg font-mono font-black text-slate-800">{{ booking()?.confirmationCode }}</div>
                </div>
              </div>

              <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                <!-- Left Details -->
                <div class="space-y-2.5 text-xs">
                  <div class="flex justify-between py-1 border-b border-slate-200/60">
                    <span class="text-slate-500">Hạng phòng:</span>
                    <span class="font-bold text-slate-900">{{ booking()?.roomTypeName }}</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/60">
                    <span class="text-slate-500">Chế độ thuê:</span>
                    <span class="font-bold text-indigo-700">{{ rentalTypeLabel() }}</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/60">
                    <span class="text-slate-500">Số lượng khách:</span>
                    <span class="font-semibold text-slate-900">{{ booking()?.numberOfGuests }} khách</span>
                  </div>
                  <div class="flex justify-between py-1 border-b border-slate-200/60">
                    <span class="text-slate-500">Khách đặt:</span>
                    <span class="font-semibold text-slate-900">{{ booking()?.maskedGuestName }} ({{ booking()?.maskedGuestEmail }})</span>
                  </div>
                </div>

                <!-- Right Financial Folio -->
                <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3 text-xs">
                  <div class="flex justify-between text-slate-600">
                    <span>Tổng tiền phòng:</span>
                    <span class="font-bold text-slate-900 font-mono">{{ booking()?.totalAmount | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-base font-black text-indigo-700 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <span>Tiền cọc cần nộp (30%):</span>
                    <span class="font-mono">{{ booking()?.depositRequired | number:'1.0-0' }} ₫</span>
                  </div>
                  <div class="flex justify-between text-slate-500 text-[11px]">
                    <span>Còn lại thanh toán khi check-in:</span>
                    <span>{{ ((booking()?.totalAmount || 0) - (booking()?.depositRequired || 0)) | number:'1.0-0' }} ₫</span>
                  </div>
                </div>
              </div>

              <!-- Payment Instructions -->
              @if (!isExpired()) {
                <div class="p-6 sm:p-8 bg-white border-t border-slate-100 space-y-4">
                  <h3 class="text-sm font-bold text-slate-900">Hướng dẫn hoàn tất nộp cọc 30%</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    Quý khách có thể chuyển khoản số tiền cọc theo cú pháp bên dưới hoặc nộp trực tiếp tại quầy lễ tân chi nhánh:
                  </p>

                  <div class="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-2 text-xs">
                    <div class="flex justify-between items-center text-slate-700">
                      <span class="font-medium">Số tiền cọc cần nộp (30%):</span>
                      <span class="text-base font-extrabold text-indigo-700 font-mono">{{ booking()?.depositRequired | number:'1.0-0' }} ₫</span>
                    </div>
                    <div class="flex justify-between items-center text-slate-700">
                      <span class="font-medium">Cú pháp nội dung chuyển khoản:</span>
                      <span class="font-bold font-mono text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">{{ booking()?.confirmationCode }}</span>
                    </div>
                    <div class="flex justify-between items-center text-slate-700">
                      <span class="font-medium">Ngân hàng thụ hưởng:</span>
                      <span class="font-semibold text-slate-900">MB Bank - 0988889999 (HotelSaaS Booking)</span>
                    </div>
                  </div>

                  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <span class="text-xs text-slate-400 font-mono">
                      Mã tra cứu: {{ booking()?.lookupToken?.substring(0, 16) }}...
                    </span>
                    <a
                      [routerLink]="['/booking/status', booking()?.lookupToken]"
                      class="w-full sm:w-auto text-center px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
                    >
                      Kiểm tra trạng thái đơn đặt →
                    </a>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- 3. TRƯỜNG HỢP B: TẠO MỚI GIỮ PHÒNG (FORM ĐIỀN THÔNG TIN KHÁCH + ÁP MÃ PROMOTION) -->
        @if (!isLoading() && !booking()) {
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
            <div>
              <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Hoàn tất thông tin Giữ phòng 15 phút
              </h1>
              <p class="text-xs text-slate-500 mt-1">
                Phòng sẽ được khóa tức thời trong 15 phút trên toàn hệ thống để quý khách yên tâm nộp cọc.
              </p>
            </div>

            <!-- Tóm tắt cơ sở & hạng phòng đã chọn -->
            <div class="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span class="text-slate-400 text-[10px] font-semibold uppercase block">Cơ sở lưu trú &amp; Hạng phòng</span>
                <span class="text-sm font-bold text-slate-900">{{ selectedPropName() || 'Khách sạn đối tác' }}</span>
                <span class="text-slate-600 block mt-0.5">{{ selectedRoomName() || 'Phòng tiêu chuẩn' }} &bull; Chế độ: {{ newHoldRentalType }}</span>
              </div>
              <div class="text-right">
                <span class="text-slate-400 text-[10px] font-semibold uppercase block">Chi phí tạm tính</span>
                <span class="text-base font-black text-indigo-700 font-mono">{{ finalEstimatedAmount() | number:'1.0-0' }} ₫</span>
                @if (usePoints() && pointsToRedeem() > 0) {
                  <span class="text-[10px] text-emerald-600 font-bold block">Đã giảm {{ pointsDiscount() | number:'1.0-0' }}₫ ({{ pointsToRedeem() }} điểm)</span>
                }
              </div>
            </div>

            <!-- Form điền thông tin -->
            <form (ngSubmit)="submitNewHold()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Họ và tên khách lưu trú (*):</label>
                  <input
                    type="text"
                    [(ngModel)]="guestName"
                    name="guestName"
                    placeholder="Nguyễn Văn A"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Số điện thoại (*):</label>
                  <input
                    type="tel"
                    [(ngModel)]="guestPhone"
                    name="guestPhone"
                    placeholder="0912 345 678"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Địa chỉ Email (*):</label>
                  <input
                    type="email"
                    [(ngModel)]="guestEmail"
                    name="guestEmail"
                    placeholder="email@example.com"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Mã khuyến mãi / Voucher (nếu có):</label>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="promoCode"
                      name="promoCode"
                      placeholder="VD: GIODAY20, DALAT50K"
                      class="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs uppercase focus:bg-white focus:outline-indigo-500"
                    />
                    <button
                      type="button"
                      (click)="applyPromoCode()"
                      class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 transition-colors"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>

              <!-- Ghi chú đặc biệt -->
              <div class="text-xs">
                <label class="block font-bold text-slate-700 mb-1">Yêu cầu đặc biệt cho lễ tân (tùy chọn):</label>
                <textarea
                  [(ngModel)]="specialRequests"
                  name="specialRequests"
                  rows="2"
                  placeholder="Ví dụ: Cần phòng tầng cao, giường đôi, nhận phòng muộn sau 20:00..."
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-indigo-500"
                ></textarea>
              </div>

              <!-- TÍCH HỢP ĐIỂM THƯỞNG HỘI VIÊN & GIẢM GIÁ (LOYALTY REWARDS) -->
              @if (!isLoggedIn()) {
                <div class="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3 text-xs">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                      <i class="pi pi-gift"></i>
                    </div>
                    <div>
                      <span class="font-bold text-slate-800 block">Bạn là Hội viên hoặc muốn dùng điểm thưởng?</span>
                      <span class="text-slate-500 text-[11px]">Đăng nhập để giảm tới 50% tiền cọc bằng điểm thưởng (1 điểm = 1.000₫) và tích điểm sau trả phòng.</span>
                    </div>
                  </div>
                  <a
                    routerLink="/auth/login"
                    class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-2xs"
                  >
                    Đăng nhập
                  </a>
                </div>
              } @else {
                <div class="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <i class="pi pi-sparkles"></i>
                      </div>
                      <div>
                        <span class="font-bold text-slate-800">Ví điểm thành viên</span>
                        <span class="text-[11px] text-slate-500 block">
                          Số dư khả dụng: <strong class="text-indigo-600 font-mono">{{ availablePoints() }}</strong> điểm (Quy đổi: 1 điểm = 1.000₫)
                        </span>
                      </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        [checked]="usePoints()"
                        (change)="toggleUsePoints($event)"
                        [disabled]="availablePoints() <= 0"
                        class="sr-only peer"
                      />
                      <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span class="ms-2 text-xs font-bold text-slate-700">Dùng điểm</span>
                    </label>
                  </div>

                  @if (usePoints() && availablePoints() > 0) {
                    <div class="pt-3 border-t border-slate-200/80 space-y-2">
                      <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 font-medium">Số điểm sử dụng:</span>
                        <span class="font-bold text-indigo-700 font-mono text-sm">
                          {{ pointsToRedeem() }} điểm (-{{ pointsDiscount() | number:'1.0-0' }}₫)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        [max]="maxRedeemablePoints()"
                        step="10"
                        [value]="pointsToRedeem()"
                        (input)="onPointsSliderChange($event)"
                        class="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div class="flex justify-between text-[10px] text-slate-400">
                        <span>0 điểm</span>
                        <span>Tối đa: {{ maxRedeemablePoints() }} điểm (50% giá trị phòng)</span>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Button CTA -->
              <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                  <i class="pi pi-shield"></i>
                  <span>Bảo mật 100% • Khóa phòng tự động 15 phút</span>
                </div>

                <button
                  type="submit"
                  [disabled]="isSubmittingHold() || !guestName.trim() || !guestPhone.trim() || !guestEmail.trim()"
                  class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                >
                  @if (isSubmittingHold()) {
                    <span class="flex items-center gap-2">
                      <i class="pi pi-spin pi-spinner"></i>
                      <span>Đang khóa phòng...</span>
                    </span>
                  } @else {
                    <span>Xác nhận Giữ phòng ngay →</span>
                  }
                </button>
              </div>
            </form>
          </div>
        }

      </div>
    </div>
  `
})
export class BookingHoldPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly booking = signal<GuestBookingDetailDto | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isExpired = signal<boolean>(false);
  readonly secondsRemaining = signal<number>(0);

  // Loyalty rewards signals
  readonly isLoggedIn = signal<boolean>(false);
  readonly availablePoints = signal<number>(0);
  readonly usePoints = signal<boolean>(false);
  readonly pointsToRedeem = signal<number>(0);

  // Form fields for creating a new hold
  guestName = '';
  guestPhone = '';
  guestEmail = '';
  promoCode = '';
  specialRequests = '';
  isSubmittingHold = signal<boolean>(false);

  selectedPropSlug = '';
  selectedPropName = signal<string>('');
  selectedRoomId = '';
  selectedRoomName = signal<string>('');
  newHoldRentalType: RentalType = 'Daily';
  checkInDate = '';
  checkOutDate = '';
  estimatedAmount = 350000;

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly pointsDiscount = computed<number>(() => this.pointsToRedeem() * 1000);

  readonly maxRedeemablePoints = computed<number>(() => {
    const maxFromCost = Math.floor((this.estimatedAmount * 0.5) / 1000);
    return Math.min(this.availablePoints(), maxFromCost);
  });

  readonly finalEstimatedAmount = computed<number>(() => {
    if (!this.usePoints()) return this.estimatedAmount;
    return Math.max(0, this.estimatedAmount - this.pointsDiscount());
  });

  statusLabel = computed<string>(() => {
    const status = this.booking()?.status;
    switch (status) {
      case 'PendingDeposit': case 'Hold': return 'Đang giữ chỗ (Chờ nộp cọc)';
      case 'Confirmed': return 'Đã xác nhận đặt phòng';
      case 'CheckedIn': return 'Đã nhận phòng';
      case 'Expired': return 'Đã hết hạn';
      case 'Cancelled': return 'Đã hủy';
      default: return status || '';
    }
  });

  statusBadgeClass = computed<string>(() => {
    const status = this.booking()?.status;
    switch (status) {
      case 'Confirmed': case 'CheckedIn': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Expired': case 'Cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  });

  rentalTypeLabel = computed<string>(() => {
    const rt = this.booking()?.rentalType;
    switch (rt) {
      case 'Hourly': return 'Theo giờ (Hourly)';
      case 'Overnight': return 'Qua đêm (Overnight)';
      case 'Daily': return 'Theo ngày (Daily)';
      default: return rt || '';
    }
  });

  ngOnInit(): void {
    // 0. Detect authenticated guest & pre-fill info
    this.isLoggedIn.set(this.authService.isLoggedIn);
    if (this.authService.isLoggedIn && this.authService.currentUser) {
      if (!this.guestName) this.guestName = this.authService.currentUser.fullName || '';
      if (!this.guestEmail) this.guestEmail = this.authService.currentUser.email || '';
      this.loadGuestPoints();
    }

    // 1. Check if token in route /booking/hold/:token or queryParams ?token=...
    const token = this.route.snapshot.paramMap.get('token') || this.route.snapshot.queryParams['token'];
    if (token) {
      this.loadBooking(token);
      return;
    }

    // 2. Check if query params for creating a new hold
    const q = this.route.snapshot.queryParams;
    if (q['propertySlug'] && q['roomTypeId']) {
      this.selectedPropSlug = q['propertySlug'];
      this.selectedRoomId = q['roomTypeId'];
      this.newHoldRentalType = (q['rentalType'] as RentalType) || 'Daily';
      this.checkInDate = q['checkInDate'] || new Date().toISOString().split('T')[0];
      this.checkOutDate = q['checkOutDate'] || new Date(Date.now() + 86400000).toISOString().split('T')[0];

      this.publicBookingService.getPropertyBySlug(this.selectedPropSlug).subscribe({
        next: (p) => {
          this.selectedPropName.set(p.name);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
      return;
    }

    this.isLoading.set(false);
  }

  loadGuestPoints(): void {
    this.http.get<any>(`${environment.apiUrl}/guest/profile`).subscribe({
      next: (res) => {
        const bal = res?.data?.totalPointsBalance ?? res?.totalPointsBalance ?? 0;
        this.availablePoints.set(bal);
      },
      error: () => {
        this.availablePoints.set(0);
      }
    });
  }

  toggleUsePoints(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.usePoints.set(checked);
    if (checked && this.pointsToRedeem() === 0) {
      const def = Math.min(this.maxRedeemablePoints(), 50);
      this.pointsToRedeem.set(def);
    }
  }

  onPointsSliderChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.pointsToRedeem.set(val);
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
      next: (detail) => {
        this.booking.set(detail);
        this.isLoading.set(false);

        if (detail.status === 'Confirmed' || detail.status === 'CheckedIn') {
          this.router.navigate(['/booking/status', token]);
          return;
        }

        const sec = detail.secondsRemaining ?? 900;
        this.secondsRemaining.set(sec);
        if (sec <= 0 || detail.status === 'Expired') {
          this.isExpired.set(true);
        } else {
          this.startTimer();
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.error('Không tìm thấy thông tin giữ phòng với mã này.');
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
        if (this.timerInterval) clearInterval(this.timerInterval);
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

  applyPromoCode(): void {
    if (!this.promoCode.trim()) return;
    this.estimatedAmount = Math.max(50000, this.estimatedAmount - 50000);
    this.alertService.success(`Đã áp dụng mã ${this.promoCode.toUpperCase()}: Giảm 50.000₫!`);
  }

  submitNewHold(): void {
    if (!this.guestName.trim() || !this.guestPhone.trim() || !this.guestEmail.trim()) {
      this.alertService.error('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Email.');
      return;
    }

    this.isSubmittingHold.set(true);

    const rentalTypeInt = this.newHoldRentalType === 'Hourly' ? 1 : (this.newHoldRentalType === 'Overnight' ? 2 : 0);
    const now = new Date();
    const startAt = now.toISOString();
    const endAt = new Date(now.getTime() + 86400000).toISOString();

    const pointsRedeem = (this.usePoints() && this.pointsToRedeem() > 0) ? this.pointsToRedeem() : undefined;

    this.publicBookingService.createHold({
      propertySlug: this.selectedPropSlug,
      roomTypeId: this.selectedRoomId,
      rentalType: rentalTypeInt,
      startAtUtc: startAt,
      endAtUtc: endAt,
      guestName: this.guestName.trim(),
      guestPhone: this.guestPhone.trim(),
      guestEmail: this.guestEmail.trim(),
      numberOfGuests: 2,
      checkInDate: this.checkInDate,
      checkOutDate: this.checkOutDate,
      expectedTotalAmount: this.estimatedAmount,
      pointsToRedeem: pointsRedeem,
      guestUserId: this.authService.currentUser?.id
    }).subscribe({
      next: (holdRes: GuestHoldDto) => {
        this.isSubmittingHold.set(false);
        this.alertService.success('Đã giữ phòng thành công trong 15 phút!');
        // Load held booking by lookupToken
        this.loadBooking(holdRes.lookupToken);
      },
      error: (err) => {
        this.isSubmittingHold.set(false);
        this.alertService.error(err?.error?.message || 'Không thể giữ phòng vào lúc này. Vui lòng thử lại.');
      }
    });
  }
}

export { BookingHoldPage as BookingHoldPageComponent };
