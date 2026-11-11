import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginResponse } from '../../../core/models/auth.model';

export type PhoneOtpMode = 'login' | 'link' | 'verify-for-booking';

@Component({
  selector: 'app-phone-otp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
          <!-- 1. Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <i class="pi pi-phone text-sm"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">
                  {{ mode === 'link' ? 'Liên kết Số Điện Thoại' : (mode === 'verify-for-booking' ? 'Xác thực SĐT Giữ Phòng' : 'Đăng nhập qua SMS OTP') }}
                </h3>
                <p class="text-[11px] text-slate-500">Google Identity Platform &bull; reCAPTCHA Invisible</p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>

          <!-- Mode Notice for Booking -->
          @if (mode === 'verify-for-booking') {
            <div class="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
              <i class="pi pi-shield text-indigo-600 shrink-0"></i>
              <span>Cần xác thực số điện thoại qua tin nhắn SMS OTP để cấp quyền giữ chỗ và mã PIN khóa phòng.</span>
            </div>
          }

          <!-- 2. Thông báo lỗi / trạng thái -->
          @if (errorMessage()) {
            <div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <i class="pi pi-exclamation-circle text-rose-500 mt-0.5 shrink-0"></i>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          @if (statusMessage()) {
            <div role="status" class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <i class="pi pi-check-circle text-emerald-600 mt-0.5 shrink-0"></i>
              <span>{{ statusMessage() }}</span>
            </div>
          }

          <!-- BƯỚC 1: NHẬP SỐ ĐIỆN THOẠI -->
          @if (step() === 'phone') {
            <div class="space-y-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại <span class="text-rose-500">*</span>
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 text-xs font-bold text-slate-400 select-none">+84</span>
                  <input
                    type="tel"
                    [(ngModel)]="phoneNumber"
                    placeholder="912 345 678"
                    maxlength="15"
                    class="w-full h-10 pl-11 pr-3 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p class="text-[10px] text-slate-400 mt-1">Định dạng: 09xx xxx xxx hoặc 9xx xxx xxx</p>
              </div>

              @if (mode === 'login') {
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên hiển thị <span class="text-slate-400 font-normal">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="fullName"
                    placeholder="Nguyễn Văn A"
                    class="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p class="text-[10px] text-slate-400 mt-1">Dành cho khách hàng mới đăng ký lần đầu</p>
                </div>
              }

              <!-- reCAPTCHA Invisible Anchor Container -->
              <div id="recaptcha-phone-modal" class="my-1"></div>

              <!-- Action buttons -->
              <div class="pt-2 space-y-2">
                <button
                  type="button"
                  (click)="sendOtp()"
                  [disabled]="loading() || !phoneNumber.trim()"
                  class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (loading()) {
                    <i class="pi pi-spin pi-spinner text-xs"></i>
                    <span>Đang gửi mã qua SMS...</span>
                  } @else {
                    <i class="pi pi-send text-xs"></i>
                    <span>Gửi mã xác thực OTP (0đ SMS)</span>
                  }
                </button>

                <button
                  type="button"
                  (click)="quickFillDemoPhone()"
                  class="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Dùng số kiểm thử (+84 123 456 789 / Mã: 123456)
                </button>
              </div>
            </div>
          }

          <!-- BƯỚC 2: NHẬP MÃ OTP 6 CHỮ SỐ -->
          @if (step() === 'otp') {
            <div class="space-y-4">
              <div class="text-center py-1">
                <span class="text-xs text-slate-500">Mã xác thực đã được gửi tới:</span>
                <div class="text-sm font-mono font-bold text-indigo-700 mt-0.5">{{ normalizedPhone() }}</div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 text-center">
                  Nhập mã OTP gồm 6 chữ số <span class="text-rose-500">*</span>
                </label>
                <div class="flex justify-center">
                  <input
                    type="text"
                    [(ngModel)]="otpCode"
                    maxlength="6"
                    placeholder="••••••"
                    class="w-48 h-12 text-center text-xl font-mono tracking-widest font-extrabold rounded-xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-inner"
                  />
                </div>
              </div>

              <!-- Countdown timer & Resend button -->
              <div class="text-center text-xs text-slate-500">
                @if (countdown() > 0) {
                  <span>Gửi lại mã sau <strong class="text-indigo-600 font-mono">{{ countdown() }}s</strong></span>
                } @else {
                  <button
                    type="button"
                    (click)="sendOtp()"
                    [disabled]="loading()"
                    class="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
                  >
                    Gửi lại mã OTP mới
                  </button>
                }
              </div>

              <div class="pt-2 space-y-2">
                <button
                  type="button"
                  (click)="verifyOtp()"
                  [disabled]="loading() || otpCode.trim().length < 6"
                  class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (loading()) {
                    <i class="pi pi-spin pi-spinner text-xs"></i>
                    <span>Đang thẩm định token Firebase...</span>
                  } @else {
                    <i class="pi pi-check-circle text-xs"></i>
                    <span>{{ mode === 'verify-for-booking' ? 'Xác thực & Tiến hành Giữ phòng' : 'Xác nhận & Đăng nhập' }}</span>
                  }
                </button>

                <div class="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    (click)="backToPhoneStep()"
                    class="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    ← Đổi số điện thoại
                  </button>

                  <button
                    type="button"
                    (click)="quickFillOtp('123456')"
                    class="text-[11px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                  >
                    Nhập mã mẫu 123456
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class PhoneOtpModalComponent implements OnChanges {
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() visible: boolean = false;
  @Input() mode: PhoneOtpMode = 'login';
  @Input() initialPhoneNumber?: string;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() verified = new EventEmitter<{
    success: boolean;
    loginResponse?: LoginResponse;
    phoneNumber: string;
    firebaseIdToken?: string;
  }>();

  step = signal<'phone' | 'otp'>('phone');
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  statusMessage = signal<string | null>(null);
  countdown = signal<number>(0);
  normalizedPhone = signal<string>('');

  phoneNumber: string = '';
  fullName: string = '';
  otpCode: string = '';

  private countdownInterval: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      if (this.initialPhoneNumber && !this.phoneNumber) {
        // Strip country code if present to fit input (+84 -> "")
        const clean = this.initialPhoneNumber.replace(/^\+84/, '0').trim();
        this.phoneNumber = clean.startsWith('0') ? clean.substring(1) : clean;
      }
    }
  }

  closeModal(): void {
    this.stopCountdown();
    this.firebaseAuth.reset();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  quickFillDemoPhone(): void {
    this.phoneNumber = '0123456789';
    this.fullName = 'Khách Kiểm Thử (+84123456789)';
  }

  quickFillOtp(code: string): void {
    this.otpCode = code;
  }

  backToPhoneStep(): void {
    this.stopCountdown();
    this.step.set('phone');
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.otpCode = '';
  }

  async sendOtp(): Promise<void> {
    if (!this.phoneNumber.trim()) {
      this.errorMessage.set('Vui lòng nhập số điện thoại hợp lệ.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);

    try {
      const res = await this.firebaseAuth.sendPhoneOtp(this.phoneNumber, 'recaptcha-phone-modal');
      this.loading.set(false);
      this.normalizedPhone.set(res.phoneNumber);
      this.statusMessage.set(res.message || 'Mã xác thực đã được gửi.');
      this.step.set('otp');
      this.startCountdown(60);
    } catch (err: any) {
      this.loading.set(false);
      const msg = err?.message || 'Không thể gửi mã SMS OTP. Vui lòng thử lại sau.';
      this.errorMessage.set(msg);
    }
  }

  async verifyOtp(): Promise<void> {
    const trimmedOtp = this.otpCode.trim();
    if (trimmedOtp.length < 6) {
      this.errorMessage.set('Mã OTP phải bao gồm 6 chữ số.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      // 1. Thẩm định qua Firebase SDK để lấy Firebase ID Token
      const verifyRes = await this.firebaseAuth.verifyPhoneOtp(trimmedOtp);

      // Kịch bản Verify-for-booking: Không gọi authService.verifyPhoneFirebase (tránh đăng nhập/tạo tài khoản ngoài ý muốn)
      if (this.mode === 'verify-for-booking') {
        this.loading.set(false);
        this.notification.success(`Xác thực SĐT ${verifyRes.phoneNumber} thành công!`);
        this.verified.emit({
          success: true,
          phoneNumber: verifyRes.phoneNumber,
          firebaseIdToken: verifyRes.idToken
        });
        this.closeModal();
        return;
      }

      // 2. Gửi ID Token về WebApi Backend (cho mode login hoặc link)
      this.authService.verifyPhoneFirebase({
        firebaseIdToken: verifyRes.idToken,
        fullName: this.fullName.trim() || undefined
      }).subscribe({
        next: (loginResponse) => {
          this.loading.set(false);
          this.notification.success(`Xác thực SĐT ${verifyRes.phoneNumber} thành công!`);
          this.verified.emit({
            success: true,
            loginResponse,
            phoneNumber: verifyRes.phoneNumber,
            firebaseIdToken: verifyRes.idToken
          });
          this.closeModal();
        },
        error: (backendErr) => {
          this.loading.set(false);
          const detail = backendErr?.error?.detail || backendErr?.error?.message || 'Không thể liên kết hoặc đăng nhập với SĐT này.';
          this.errorMessage.set(detail);
        }
      });
    } catch (firebaseErr: any) {
      this.loading.set(false);
      this.errorMessage.set(firebaseErr?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    }
  }

  private startCountdown(seconds: number): void {
    this.stopCountdown();
    this.countdown.set(seconds);
    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.stopCountdown();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdown.set(0);
  }
}
