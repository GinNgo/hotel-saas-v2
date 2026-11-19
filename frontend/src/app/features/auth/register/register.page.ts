import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../../../core/models/api-response.model';
import { LoginResponse, RegisterResponse } from '../../../core/models/auth.model';
import { PhoneOtpModalComponent } from '../phone-otp-modal/phone-otp-modal.component';
import { SocialAuthService } from '../../../core/services/social-auth.service';

function passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value) {
    return null;
  }

  const errors: ValidationErrors = {};
  if (!/[A-Z]/.test(value)) {
    errors['requiresUppercase'] = true;
  }
  if (!/[a-z]/.test(value)) {
    errors['requiresLowercase'] = true;
  }
  if (!/[0-9]/.test(value)) {
    errors['requiresDigit'] = true;
  }
  if (!/[^a-zA-Z0-9]/.test(value)) {
    errors['requiresSpecialChar'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmControl = control.get('confirmPassword');
  const confirmPassword = confirmControl?.value;
  if (!confirmControl) return null;

  if (password && confirmPassword && password !== confirmPassword) {
    const existingErrors = confirmControl.errors ? { ...confirmControl.errors } : {};
    existingErrors['passwordMismatch'] = true;
    confirmControl.setErrors(existingErrors);
    return { passwordMismatch: true };
  }

  if (confirmControl.hasError('passwordMismatch')) {
    const { passwordMismatch: _removed, ...rest } = confirmControl.errors ?? {};
    confirmControl.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
  return null;
}

export type RegisterTab = 'email' | 'phone';

/**
 * Trang Đăng ký tài khoản Hội viên Khách lưu trú (Guest Portal Registration) phân hệ kép:
 * - Tab 1: Đăng ký bằng Email (Tinh gọn: Họ tên, Email, Mật khẩu — không ép nhập SĐT ngay).
 * - Tab 2: Đăng ký bằng Số điện thoại (SMS OTP Firebase — đăng ký 1-chạm không cần nhớ mật khẩu).
 * - Phía dưới: Đăng ký / Đăng nhập 1-chạm qua Google OAuth (Mở popup native).
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    InputText,
    Password,
    Button,
    PhoneOtpModalComponent
  ],
  template: `
    <div class="w-full">
      <div class="text-center mb-5">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-2 shadow-2xs">
          <i class="pi pi-sparkles text-[10px] text-amber-500"></i> HỘI VIÊN CHUỖI DI SẢN
        </span>
        <h2 class="text-xl font-bold text-slate-800">Tạo tài khoản hội viên</h2>
        <p class="text-xs text-slate-500 mt-1">Đăng ký để nhận ngay 50 điểm thưởng và quyền lợi lưu trú độc quyền</p>
      </div>

      <!-- 1. BỘ CHUYỂN TAB ĐĂNG KÝ (EMAIL vs SỐ ĐIỆN THOẠI) -->
      <div class="flex items-center p-1.5 mb-5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          (click)="setTab('email')"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          [ngClass]="activeTab() === 'email' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'"
        >
          <i class="pi pi-envelope text-xs" [ngClass]="activeTab() === 'email' ? 'text-indigo-600' : 'text-slate-400'"></i>
          <span>Đăng ký bằng Email</span>
        </button>

        <button
          type="button"
          (click)="setTab('phone')"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          [ngClass]="activeTab() === 'phone' ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'"
        >
          <i class="pi pi-phone text-xs" [ngClass]="activeTab() === 'phone' ? 'text-emerald-600' : 'text-slate-400'"></i>
          <span>Đăng ký bằng Số điện thoại</span>
        </button>
      </div>

      @if (errorMessage()) {
        <div class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5 animate-fade-in">
          <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5 shrink-0"></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- 2A. TAB 1: FORM ĐĂNG KÝ BẰNG EMAIL (TINH GỌN, KHÔNG ÉP SĐT) -->
      @if (activeTab() === 'email') {
        <form [formGroup]="emailRegisterForm" (ngSubmit)="onEmailSubmit()" class="space-y-4">
          <!-- Full Name Field -->
          <div>
            <label for="fullName" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên <span class="text-rose-500">*</span>
            </label>
            <input
              id="fullName"
              pInputText
              formControlName="fullName"
              placeholder="Ví dụ: Nguyễn Văn A"
              class="w-full text-sm"
              [class.ng-invalid]="emailRegisterForm.get('fullName')?.invalid && emailRegisterForm.get('fullName')?.touched"
            />
            @if (emailRegisterForm.get('fullName')?.hasError('required') && emailRegisterForm.get('fullName')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Họ tên không được để trống</p>
            }
          </div>

          <!-- Email Field -->
          <div>
            <label for="email" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email nhận thông báo & vé phòng <span class="text-rose-500">*</span>
            </label>
            <input
              id="email"
              pInputText
              formControlName="email"
              type="email"
              placeholder="ten@vidu.vn"
              class="w-full text-sm"
              [class.ng-invalid]="emailRegisterForm.get('email')?.invalid && emailRegisterForm.get('email')?.touched"
            />
            @if (emailRegisterForm.get('email')?.hasError('required') && emailRegisterForm.get('email')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Email không được để trống</p>
            }
            @if (emailRegisterForm.get('email')?.hasError('email') && emailRegisterForm.get('email')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Email không đúng định dạng</p>
            }
          </div>

          <!-- Password Field -->
          <div>
            <label for="password" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu <span class="text-rose-500">*</span>
            </label>
            <p-password
              id="password"
              formControlName="password"
              [feedback]="true"
              [toggleMask]="true"
              placeholder="Tối thiểu 8 ký tự (hoa, thường, số, ký tự đặc biệt)"
              promptLabel="Nhập mật khẩu an toàn"
              weakLabel="Yếu"
              mediumLabel="Trung bình"
              strongLabel="Mạnh"
              styleClass="w-full"
              inputStyleClass="w-full text-sm"
            />
            @if (emailRegisterForm.get('password')?.hasError('required') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu không được để trống</p>
            }
            @if (emailRegisterForm.get('password')?.hasError('minlength') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 8 ký tự</p>
            }
            @if (emailRegisterForm.get('password')?.hasError('requiresUppercase') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ hoa (A-Z)</p>
            }
            @if (emailRegisterForm.get('password')?.hasError('requiresLowercase') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ thường (a-z)</p>
            }
            @if (emailRegisterForm.get('password')?.hasError('requiresDigit') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 chữ số (0-9)</p>
            }
            @if (emailRegisterForm.get('password')?.hasError('requiresSpecialChar') && emailRegisterForm.get('password')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu cần ít nhất 1 ký tự đặc biệt</p>
            }
          </div>

          <!-- Confirm Password Field -->
          <div>
            <label for="confirmPassword" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Xác nhận mật khẩu <span class="text-rose-500">*</span>
            </label>
            <p-password
              id="confirmPassword"
              formControlName="confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              placeholder="Nhập lại mật khẩu"
              styleClass="w-full"
              inputStyleClass="w-full text-sm"
            />
            @if (emailRegisterForm.get('confirmPassword')?.hasError('required') && emailRegisterForm.get('confirmPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Xác nhận mật khẩu không được để trống</p>
            }
            @if (emailRegisterForm.get('confirmPassword')?.hasError('passwordMismatch') && emailRegisterForm.get('confirmPassword')?.touched) {
              <p class="text-xs text-rose-600 mt-1">Mật khẩu xác nhận không khớp</p>
            }
          </div>

          <!-- Progressive Profiling Notice -->
          <div class="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
            <i class="pi pi-info-circle text-indigo-600 shrink-0"></i>
            <span>Bạn không cần nhập số điện thoại lúc này. Khi đặt giữ phòng, hệ thống sẽ kích hoạt xác thực SMS OTP nhanh gọn.</span>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <p-button
              type="submit"
              label="Đăng ký bằng Email"
              icon="pi pi-user-plus"
              [loading]="loading()"
              [disabled]="loading() || emailRegisterForm.invalid"
              styleClass="w-full p-button-primary"
            />
          </div>
        </form>
      }

      <!-- 2B. TAB 2: FORM ĐĂNG KÝ BẰNG SỐ ĐIỆN THOẠI (SMS OTP FIREBASE) -->
      @if (activeTab() === 'phone') {
        <div class="space-y-4">
          <!-- Full Name Field (Optional) -->
          <div>
            <label for="phoneFullName" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên hiển thị <span class="text-slate-400 font-normal">(tùy chọn)</span>
            </label>
            <input
              id="phoneFullName"
              pInputText
              [(ngModel)]="phoneFullName"
              placeholder="Ví dụ: Nguyễn Văn A"
              class="w-full text-sm"
            />
          </div>

          <!-- Phone Number with Country Code -->
          <div>
            <label for="regPhoneNumber" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Số điện thoại nhận mã OTP <span class="text-rose-500">*</span>
            </label>
            <div class="flex gap-2 items-center">
              <div class="relative shrink-0">
                <select
                  [(ngModel)]="selectedDialCode"
                  class="h-10 pl-3 pr-8 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer appearance-none shadow-2xs transition-all"
                  title="Chọn mã vùng quốc gia"
                >
                  @for (c of countryCodes; track c.code) {
                    <option [value]="c.dialCode">
                      {{ c.flag }} {{ c.dialCode }}
                    </option>
                  }
                </select>
                <i class="pi pi-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
              </div>

              <div class="flex-1 min-w-0">
                <input
                  id="regPhoneNumber"
                  pInputText
                  [(ngModel)]="rawPhoneNumber"
                  type="tel"
                  placeholder="Ví dụ: 0912 345 678"
                  class="w-full text-sm"
                />
              </div>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Hệ thống sẽ gửi mã SMS OTP 6 chữ số để xác thực tức thì.</p>
          </div>

          <!-- Progressive Profiling Notice -->
          <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <i class="pi pi-bolt text-emerald-600 shrink-0"></i>
            <span>Đăng ký 1-chạm không cần mật khẩu! Sau khi đăng nhập, hệ thống sẽ gợi ý thêm Email để nhận vé phòng PDF và hóa đơn VAT.</span>
          </div>

          <!-- Action Button: Open SMS OTP Modal -->
          <div class="pt-2">
            <button
              type="button"
              (click)="startPhoneRegistration()"
              [disabled]="loading() || !rawPhoneNumber.trim()"
              class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i class="pi pi-send text-sm"></i>
              <span>Gửi mã SMS OTP xác thực</span>
            </button>
          </div>
        </div>
      }

      <!-- 3. SOCIAL REGISTRATION ONE-TAP BUTTON (GOOGLE OAUTH POPUP - G0-02) -->
      <div class="mt-5 space-y-3">
        <div class="relative flex items-center justify-center py-1">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-slate-200"></div>
          </div>
          <span class="relative z-10 bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Hoặc đăng ký nhanh với
          </span>
        </div>

        <!-- Google Button -->
        <button
          type="button"
          (click)="registerWithGoogle()"
          [disabled]="loading()"
          class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Tiếp tục với Google</span>
        </button>
      </div>

      <!-- 4. FOOTER LINKS -->
      <div class="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
        <div>
          <span>Đã có tài khoản? </span>
          <a routerLink="/login" class="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
            Đăng nhập ngay
          </a>
        </div>
        <div>
          <a routerLink="/partner-register" class="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
            <i class="pi pi-building"></i>
            <span>Bạn là chủ khách sạn? Đăng ký mở khách sạn tại đây</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Modal Xác thực & Đăng ký qua SMS OTP (Firebase Phone Auth) -->
    <app-phone-otp-modal
      [visible]="showPhoneOtpModal()"
      (visibleChange)="showPhoneOtpModal.set($event)"
      [mode]="'login'"
      [initialPhoneNumber]="formattedPhoneForModal"
      (verified)="onPhoneRegistered($event)"
    />
  `
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly socialAuth = inject(SocialAuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  activeTab = signal<RegisterTab>('email');
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showPhoneOtpModal = signal(false);

  phoneFullName: string = '';
  selectedDialCode: string = '+84';
  rawPhoneNumber: string = '';
  formattedPhoneForModal: string = '';

  readonly countryCodes = [
    { code: 'VN', dialCode: '+84', flag: '🇻🇳', label: 'Việt Nam (+84)' },
    { code: 'US', dialCode: '+1', flag: '🇺🇸', label: 'Hoa Kỳ / Canada (+1)' },
    { code: 'KR', dialCode: '+82', flag: '🇰🇷', label: 'Hàn Quốc (+82)' },
    { code: 'JP', dialCode: '+81', flag: '🇯🇵', label: 'Nhật Bản (+81)' },
    { code: 'SG', dialCode: '+65', flag: '🇸🇬', label: 'Singapore (+65)' },
    { code: 'TH', dialCode: '+66', flag: '🇹🇭', label: 'Thái Lan (+66)' },
    { code: 'CN', dialCode: '+86', flag: '🇨🇳', label: 'Trung Quốc (+86)' },
    { code: 'GB', dialCode: '+44', flag: '🇬🇧', label: 'Vương quốc Anh (+44)' },
    { code: 'AU', dialCode: '+61', flag: '🇦🇺', label: 'Úc (+61)' },
    { code: 'FR', dialCode: '+33', flag: '🇫🇷', label: 'Pháp (+33)' },
    { code: 'DE', dialCode: '+49', flag: '🇩🇪', label: 'Đức (+49)' },
    { code: 'RU', dialCode: '+7', flag: '🇷🇺', label: 'Nga (+7)' },
  ];

  emailRegisterForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), passwordComplexityValidator]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  setTab(tab: RegisterTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
  }

  onEmailSubmit(): void {
    if (this.emailRegisterForm.invalid) {
      this.emailRegisterForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { fullName, email, password } = this.emailRegisterForm.getRawValue();

    this.authService.register({
      fullName: fullName!.trim(),
      email: email!.trim().toLowerCase(),
      phoneNumber: undefined, // Không bắt buộc SĐT ở bước đăng ký Email
      password: password!,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined
    }).subscribe({
      next: (response: ApiResponse<RegisterResponse>) => {
        this.loading.set(false);
        if (response.success || response.data?.userId || response.data) {
          this.notification.success('Đăng ký tài khoản thành công! Thư xác thực tài khoản đã được gửi đến email của bạn. Vui lòng mở hộp thư để bấm liên kết kích hoạt.');
          this.router.navigate(['/login']);
        } else if (response.message) {
          this.errorMessage.set(response.message);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiResponse<unknown>;
        this.errorMessage.set(body?.message || 'Đăng ký không thành công. Vui lòng thử lại.');
      }
    });
  }

  startPhoneRegistration(): void {
    const raw = this.rawPhoneNumber.trim();
    if (!raw) {
      this.errorMessage.set('Vui lòng nhập số điện thoại.');
      return;
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      this.errorMessage.set('Số điện thoại không hợp lệ (từ 8 đến 15 chữ số).');
      return;
    }

    const stripped = digits.startsWith('0') ? digits.substring(1) : digits;
    this.formattedPhoneForModal = `${this.selectedDialCode}${stripped}`;
    this.errorMessage.set(null);
    this.showPhoneOtpModal.set(true);
  }

  onPhoneRegistered(event: { success: boolean; loginResponse?: LoginResponse; phoneNumber: string }): void {
    if (event.success) {
      this.notification.success(`Chào mừng quý khách! Đăng ký thành công số điện thoại ${event.phoneNumber}`);
      this.router.navigate(['/booking/profile']);
    }
  }

  async registerWithGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const user = await this.socialAuth.signInWithGoogle();
      const idToken = user.idToken;
      if (!idToken) throw new Error('Không nhận được mã xác thực Google.');

      this.authService.googleLogin(idToken).subscribe({
        next: (response) => {
          this.loading.set(false);
          this.notification.success(`Đăng ký Google thành công! Chào mừng ${response.user.fullName}`);
          this.router.navigate(['/booking/profile']);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(err.error?.detail || err.error?.message || 'Đăng ký Google thất bại.');
        }
      });
    } catch (err: unknown) {
      this.loading.set(false);
      this.errorMessage.set(err instanceof Error && err.message ? err.message : 'Đăng ký Google không thành công.');
    }
  }
}
