import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestBookingDetailDto, PublicPropertyDto } from '../../core/models/public-booking.model';
import { QuoteDto } from '../../core/models/reservation.model';
import { publicStayInterval, readPublicStay } from '../../core/models/public-stay-context';
import { FormFieldComponent, FormControlDirective } from '../../shared/components/form-field/form-field.component';

@Component({
  selector: 'app-booking-hold-page', standalone: true, imports: [CommonModule, FormsModule, RouterLink, FormFieldComponent, FormControlDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <main class="max-w-5xl mx-auto space-y-6">
        <!-- Navigation Breadcrumb -->
        <div class="flex items-center justify-between">
          <a
            routerLink="/booking"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs"
          >
            <i class="pi pi-arrow-left text-[11px]"></i>
            <span>Quay lại danh sách chỗ nghỉ</span>
          </a>
          <span class="text-xs text-slate-400 font-medium flex items-center gap-1">
            <i class="pi pi-shield text-emerald-600 text-[11px]"></i>
            Thủ tục giữ phòng mã hóa an toàn 100%
          </span>
        </div>

        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {{ booking() ? 'Chi Tiết Giữ Phòng Thành Công' : 'Kiểm Tra & Xác Nhận Giữ Chỗ' }}
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            {{ booking()
                ? 'Thông tin đặt chỗ của bạn đã được ghi nhận. Vui lòng thanh toán đặt cọc theo hạn mức để xác nhận lưu trú.'
                : 'Xác nhận thông tin lưu trú, nhập thông tin liên lạc để hệ thống cấp mã giữ phòng và mã khóa PIN.' }}
          </p>
        </div>

        @if (error()) {
          <div role="alert" class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 shadow-2xs">
            <i class="pi pi-exclamation-triangle text-rose-500 text-lg shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold text-xs uppercase tracking-wider block">Thông báo từ hệ thống</span>
              <p class="text-xs sm:text-sm mt-0.5">{{ error() }}</p>
            </div>
          </div>
        }

        @if (loading()) {
          <div role="status" class="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
            <i class="pi pi-spin pi-spinner text-2xl text-indigo-600"></i>
            <p class="text-sm font-medium text-slate-600">Đang đối soát giá và tình trạng phòng thời gian thực…</p>
          </div>
        }

        @if (booking(); as detail) {
          <!-- VOUCHER THÀNH CÔNG SAU KHI TẠO GIỮ PHÒNG -->
          <section class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                  <i class="pi pi-check-circle"></i>
                </div>
                <div>
                  <div class="text-xs font-bold uppercase tracking-wider text-emerald-600">Mã giữ phòng thành công</div>
                  <h2 class="text-xl sm:text-2xl font-black text-slate-900">{{ detail.propertyName }}</h2>
                </div>
              </div>

              <div class="text-left sm:text-right">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <i class="pi pi-tag text-[10px]"></i> {{ detail.status }}
                </span>
                @if (detail.holdExpiresAtUtc) {
                  <p class="text-[11px] text-slate-500 mt-1">
                    Hết hạn lúc: <b>{{ detail.holdExpiresAtUtc | date:'HH:mm:ss dd/MM':'+0700' }}</b> ({{ formattedTimeRemaining() }})
                  </p>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Hạng phòng</span>
                <span class="text-sm font-bold text-slate-800">{{ detail.roomTypeName }}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Số lượng khách</span>
                <span class="text-sm font-bold text-slate-800">{{ detail.numberOfGuests }} khách</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Thời gian lưu trú</span>
                <span class="text-xs sm:text-sm font-bold text-indigo-900">
                  {{ detail.startAtUtc | date:'dd/MM/yyyy HH:mm':'+0700' }} → {{ detail.endAtUtc | date:'dd/MM/yyyy HH:mm':'+0700' }}
                </span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 gap-4">
              <div>
                <div class="text-xs text-indigo-900 font-medium">Tổng tiền lưu trú dự tính</div>
                <div class="text-2xl sm:text-3xl font-black text-indigo-700">{{ detail.totalAmount | number:'1.0-0' }} ₫</div>
              </div>
              <div class="sm:text-right">
                <div class="text-xs text-amber-800 font-bold uppercase tracking-wide">Đặt cọc yêu cầu</div>
                <div class="text-xl font-extrabold text-amber-600">{{ detail.depositRequired | number:'1.0-0' }} ₫</div>
              </div>
            </div>

            @if (isExpired()) {
              <div role="status" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <i class="pi pi-times-circle"></i>
                <span>Giữ phòng đã hết hạn. Vui lòng quay lại tìm kiếm và đặt phòng mới.</span>
              </div>
            }

            <div class="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <a
                [routerLink]="['/booking/status', detail.lookupToken]"
                class="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Xem Trạng Thái &amp; Hướng Dẫn Thanh Toán</span>
                <i class="pi pi-arrow-right text-xs"></i>
              </a>
            </div>
          </section>
        } @else {
          <!-- FORM CHECKOUT & TÓM TẮT ĐƠN ĐẶT PHÒNG -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Cột Trái: Thông tin Người nhận phòng (7 cột) -->
            <form
              (ngSubmit)="confirmBooking()"
              [attr.aria-busy]="isSubmitting()"
              class="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5"
            >
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-user"></i>
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-800">Thông tin Khách nhận phòng</h2>
                  <p class="text-xs text-slate-400">Dùng để cấp mã mở khóa Smart Lock và hóa đơn điện tử</p>
                </div>
              </div>

              <div class="space-y-4">
                <app-form-field #nameField controlId="hold-name" label="Họ và tên người đại diện" [required]="true" [error]="fieldError('name', nameControl.touched)">
                  <input
                    [appFormControl]="nameField"
                    name="name"
                    [(ngModel)]="guestName"
                    #nameControl="ngModel"
                    required
                    autocomplete="name"
                    placeholder="Ví dụ: Nguyễn Văn Hoàng"
                  />
                </app-form-field>

                <app-form-field #phoneField controlId="hold-phone" label="Số điện thoại nhận tin nhắn" [required]="true" [error]="fieldError('phone', phoneControl.touched)">
                  <input
                    [appFormControl]="phoneField"
                    name="phone"
                    [(ngModel)]="guestPhone"
                    #phoneControl="ngModel"
                    required
                    type="tel"
                    autocomplete="tel"
                    placeholder="0912345678"
                  />
                </app-form-field>

                <app-form-field #emailField controlId="hold-email" label="Email nhận xác nhận đặt chỗ" [required]="true" [error]="fieldError('email', emailControl.touched)">
                  <input
                    [appFormControl]="emailField"
                    name="email"
                    [(ngModel)]="guestEmail"
                    #emailControl="ngModel"
                    required
                    type="email"
                    autocomplete="email"
                    placeholder="hoang.nguyen@example.com"
                  />
                </app-form-field>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 flex items-center gap-2.5">
                <i class="pi pi-info-circle text-indigo-600 text-sm shrink-0"></i>
                <span>Phòng được giữ tạm sau khi máy chủ cấp mã. Bạn có thể thanh toán qua VNPAY hoặc chuyển khoản tại bước tiếp theo.</span>
              </div>

              <button
                type="submit"
                [disabled]="loading() || isSubmitting() || !quote()"
                class="w-full h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (isSubmitting()) {
                  <i class="pi pi-spin pi-spinner text-base"></i>
                  <span>Đang xử lý giữ phòng…</span>
                } @else {
                  <i class="pi pi-check text-base"></i>
                  <span>Xác Nhận Giữ Phòng Ngay</span>
                }
              </button>
            </form>

            <!-- Cột Phải: Báo giá & Chi tiết chỗ nghỉ (5 cột) -->
            <section class="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5 lg:sticky lg:top-24">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <i class="pi pi-receipt"></i>
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-800">Tóm tắt Đơn Đặt</h2>
                  <p class="text-xs text-slate-400">Báo giá chính thức từ hệ thống</p>
                </div>
              </div>

              @if (quote(); as price) {
                <div class="space-y-3.5">
                  <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <div class="font-bold text-sm text-slate-900">{{ property()?.name }}</div>
                    <div class="text-xs text-indigo-700 font-semibold flex items-center gap-1.5">
                      <i class="pi pi-bed"></i> {{ price.roomTypeName }}
                    </div>
                  </div>

                  <!-- Chi tiết tính giá -->
                  <div class="space-y-2 pt-1 border-t border-slate-100 text-xs">
                    <div class="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Khoản phí mục vụ</div>
                    @for (line of price.breakdown; track $index) {
                      <div class="flex items-center justify-between text-slate-700 py-0.5">
                        <span class="truncate pr-2">{{ line.description }}</span>
                        <span class="font-semibold shrink-0">{{ line.amount | number:'1.0-0' }} ₫</span>
                      </div>
                    }
                  </div>

                  <!-- Tổng tiền & Cọc -->
                  <div class="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                    <div class="flex items-baseline justify-between">
                      <span class="text-xs font-bold text-indigo-950 uppercase tracking-wide">Tổng tiền lưu trú:</span>
                      <strong class="text-xl sm:text-2xl font-black text-indigo-700">
                        {{ price.totalAmount | number:'1.0-0' }} ₫
                      </strong>
                    </div>
                    <div class="flex items-center justify-between text-xs text-amber-800 pt-1.5 border-t border-indigo-100/80 font-medium">
                      <span>Đặt cọc giữ chỗ (50%):</span>
                      <span class="font-bold text-amber-600">{{ (price.totalAmount * 0.5) | number:'1.0-0' }} ₫</span>
                    </div>
                  </div>

                  <p class="text-[11px] text-slate-400 flex items-center gap-1">
                    <i class="pi pi-clock text-[10px]"></i>
                    Báo giá hiệu lực đến {{ price.expiresAtUtc | date:'HH:mm:ss':'+0700' }}
                  </p>
                </div>
              } @else {
                <div class="text-center py-6 text-slate-400 text-xs">
                  <i class="pi pi-info-circle text-lg mb-1 block"></i>
                  Đang chờ tính giá hoặc chưa có báo giá phòng.
                </div>
              }

              <button
                type="button"
                (click)="loadPreview()"
                [disabled]="loading() || isSubmitting()"
                class="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()"></i>
                <span>Kiểm tra lại giá phòng</span>
              </button>
            </section>
          </div>
        }
      </main>
    </div>
  `,
})
export class BookingHoldPageComponent implements OnInit, OnDestroy {
  private readonly publicBookingService = inject(PublicBookingService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  readonly submitted = signal(false);
  readonly booking = signal<GuestBookingDetailDto | null>(null);
  readonly property = signal<PublicPropertyDto | null>(null);
  readonly quote = signal<QuoteDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly remainingSeconds = signal(0);
  readonly secondsRemaining = signal(0);
  readonly isExpired = signal(false);
  readonly isSubmitting = signal(false);
  readonly finalGrandTotal = computed(() => this.quote()?.totalAmount ?? this.booking()?.totalAmount ?? 0);
  guestName = '';
  guestPhone = '';
  guestEmail = '';
  private timerInterval?: ReturnType<typeof setInterval>;
  private readonly idempotencyKey = crypto.randomUUID();
  private requestGeneration = 0;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap?.get('token') || this.route.snapshot.queryParams?.['token'];
    if (token) this.loadBooking(token);
    else this.loadPreview();
  }

  loadPreview(): void {
    if (this.isSubmitting()) return;
    const generation = ++this.requestGeneration;
    this.error.set('');
    this.quote.set(null);
    try {
      const params = this.route.snapshot.queryParams;
      const stay = readPublicStay(params);
      if (!params['propertySlug'] || !params['roomTypeId']) throw new Error('Vui lòng chọn cơ sở và hạng phòng trước.');
      this.loading.set(true);
      this.publicBookingService.getPropertyBySlug(params['propertySlug']).pipe(
        switchMap(property => {
          if (generation !== this.requestGeneration) throw new Error('Yêu cầu đã thay đổi.');
          this.property.set(property);
          return this.publicBookingService.calculateQuote({ propertySlug: params['propertySlug'], roomTypeId: params['roomTypeId'], ...publicStayInterval(stay, property) });
        }), takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: price => { if (generation !== this.requestGeneration) return; this.quote.set(price); this.loading.set(false); },
        error: () => { if (generation !== this.requestGeneration) return; this.loading.set(false); this.error.set('Chưa kiểm tra được giá. Vui lòng thử lại hoặc chọn lại phòng.'); },
      });
    } catch (error) { this.loading.set(false); this.error.set(error instanceof Error ? error.message : 'Lựa chọn không hợp lệ.'); }
  }

  loadBooking(token: string): void {
    this.loading.set(true);
    this.publicBookingService.getBookingByToken(token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        this.loading.set(false); this.booking.set(detail);
        if (detail.status === 'Confirmed' || detail.status === 'CheckedIn') { this.router.navigate(['/booking/status', token]); return; }
        this.isExpired.set(detail.status === 'Expired');
        if (detail.holdExpiresAtUtc) {
          const tick = () => {
            const remaining = Math.max(0, Math.floor((new Date(detail.holdExpiresAtUtc!).getTime() - Date.now()) / 1000));
            this.remainingSeconds.set(remaining); this.secondsRemaining.set(remaining); this.isExpired.set(remaining <= 0);
          };
          tick();
          if (this.timerInterval) clearInterval(this.timerInterval);
          this.timerInterval = setInterval(tick, 1000);
        }
      },
      error: () => { this.loading.set(false); this.error.set('Không tìm thấy giữ phòng hoặc không thể tải dữ liệu.'); },
    });
  }

  confirmBooking(): void {
    if (this.isSubmitting() || this.loading() || this.booking()) return;
    this.submitted.set(true);
    const invalidField = (['name', 'phone', 'email'] as const).find(field => this.fieldError(field));
    if (invalidField) this.element.nativeElement.querySelector<HTMLInputElement>(`#hold-${invalidField}`)?.focus();
    if (!this.guestName.trim() || !this.guestPhone.trim()) { this.alertService.error('Vui lòng điền đầy đủ Họ tên và Số điện thoại.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.guestEmail.trim())) { this.error.set('Vui lòng nhập email hợp lệ.'); return; }
    const price = this.quote();
    if (!price || !Number.isFinite(new Date(price.expiresAtUtc).getTime()) || new Date(price.expiresAtUtc).getTime() <= Date.now()) { this.quote.set(null); this.error.set('Giá chưa có hoặc đã hết hiệu lực. Vui lòng kiểm tra lại giá.'); return; }
    try {
      const params = this.route.snapshot.queryParams;
      const stay = readPublicStay(params);
      const property = this.property();
      if (!property) throw new Error('Chưa có dữ liệu cơ sở.');
      this.error.set(''); this.isSubmitting.set(true);
      this.publicBookingService.createHold({
        propertySlug: params['propertySlug'], roomTypeId: params['roomTypeId'],
        ...publicStayInterval(stay, property), guestName: this.guestName.trim(),
        guestEmail: this.guestEmail.trim(), guestPhone: this.guestPhone.trim(),
        numberOfGuests: stay.guests, expectedTotalAmount: price.totalAmount, idempotencyKey: this.idempotencyKey,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: hold => {
          this.isSubmitting.set(false);
          if (!hold.lookupToken) { this.error.set('Phản hồi chưa có mã giữ phòng. Vui lòng thử lại cùng yêu cầu.'); return; }
          this.router.navigate(['/booking/hold', hold.lookupToken]);
        },
        error: () => { this.isSubmitting.set(false); this.error.set('Chưa giữ được phòng. Kiểm tra lại giá/tình trạng hoặc thử lại; chưa có xác nhận thành công.'); },
      });
    } catch (error) { this.isSubmitting.set(false); this.error.set(error instanceof Error ? error.message : 'Lựa chọn không hợp lệ.'); }
  }

  fieldError(field: 'name' | 'phone' | 'email', touched: boolean | null = false): string {
    if (!this.submitted() && !touched) return '';
    if (field === 'name') return this.guestName.trim() ? '' : 'Vui lòng nhập họ và tên.';
    if (field === 'phone') return this.guestPhone.trim() ? '' : 'Vui lòng nhập số điện thoại.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.guestEmail.trim()) ? '' : 'Vui lòng nhập email hợp lệ.';
  }

  formatCountdown(seconds: number): string { return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  formattedTimeRemaining(): string { return this.formatCountdown(this.secondsRemaining()); }
  ngOnDestroy(): void { if (this.timerInterval) clearInterval(this.timerInterval); }
}
export { BookingHoldPageComponent as BookingHoldPage };
