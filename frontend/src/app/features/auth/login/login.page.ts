import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Password } from 'primeng/password';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ContextSelectorDialogComponent } from '../context-selector/context-selector.dialog';
import { UserMembershipDto } from '../../../core/models/auth.model';
import { FormFieldComponent, FormControlDirective } from '../../../shared/components/form-field/form-field.component';

export type PortalType = 'guest' | 'admin';

/**
 * Trang Đăng nhập hệ thống Hotel SaaS phân hệ kép (Dual-Portal Architecture).
 * - Cổng Khách hàng Lưu trú (Guest / Customer Portal): Tra cứu đặt phòng, xem voucher, quản lý thẻ thành viên chuỗi & ví điểm.
 * - Cổng Quản trị Khách sạn & Nền tảng (PMS & Platform Admin Portal): Quản lý chi nhánh, phòng, buồng phòng, thu ngân & hợp đồng SaaS.
 * - Tự động điều hướng thông minh (Role-Based Smart Redirection) chống hoàn toàn xung đột quyền hạn 403 Forbidden.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    Password,
    ContextSelectorDialogComponent,
    FormFieldComponent,
    FormControlDirective
  ],
  template: `
    <div class="w-full">
      <!-- 1. BỘ CHUYỂN ĐỔI PHÂN HỆ CỔNG ĐĂNG NHẬP (DUAL-PORTAL TAB SWITCHER) -->
      <div class="flex items-center p-1.5 mb-5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          (click)="setPortal('guest')"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          [ngClass]="portal() === 'guest' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'"
        >
          <i class="pi pi-user text-xs" [ngClass]="portal() === 'guest' ? 'text-indigo-600' : 'text-slate-400'"></i>
          <span>Khách hàng Lưu trú</span>
        </button>

        <button
          type="button"
          (click)="setPortal('admin')"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          [ngClass]="portal() === 'admin' ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'"
        >
          <i class="pi pi-shield text-xs" [ngClass]="portal() === 'admin' ? 'text-emerald-600' : 'text-slate-400'"></i>
          <span>Quản trị Khách sạn (PMS)</span>
        </button>
      </div>

      <!-- 2. HEADER TIÊU ĐỀ THEO TỪNG CỔNG -->
      <div class="text-center mb-5">
        @if (portal() === 'guest') {
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-2 shadow-2xs">
            <i class="pi pi-sparkles text-[10px] text-amber-500"></i> CỔNG KHÁCH HÀNG & THÀNH VIÊN
          </span>
          <h2 class="text-xl font-bold text-slate-800 mb-1">Đăng nhập Khách hàng</h2>
          <p class="text-xs text-slate-500">Tra cứu đơn đặt phòng, quản lý thẻ thành viên chuỗi & ví điểm thưởng</p>
        } @else {
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 mb-2 shadow-2xs">
            <i class="pi pi-building text-[10px] text-emerald-600"></i> CỔNG ĐỐI TÁC & VẬN HÀNH
          </span>
          <h2 class="text-xl font-bold text-slate-800 mb-1">Quản trị Khách sạn & Nền tảng</h2>
          <p class="text-xs text-slate-500">Bảng điều khiển quản lý phòng, lễ tân, buồng phòng & cấu hình SaaS</p>
        }
      </div>

      <!-- 3. THÔNG BÁO LỖI NẾU CÓ -->
      @if (errorMessage()) {
        <div role="alert" class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5 animate-fade-in">
          <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5 shrink-0"></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- 4. FORM NHẬP EMAIL & MẬT KHẨU -->
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" [attr.aria-busy]="loading()" class="space-y-4">
        <!-- Email Field -->
        <app-form-field #emailField controlId="email" label="Email" [required]="true" [error]="emailError">
          <input
            [appFormControl]="emailField"
            formControlName="email"
            type="email"
            placeholder="ten@vidu.vn"
            autocomplete="username"
            required
          />
        </app-form-field>

        <!-- Password Field -->
        <app-form-field #passwordField controlId="password" label="Mật khẩu" [required]="true" [error]="passwordError">
          @if (portal() === 'guest') {
            <a
              slot="action"
              routerLink="/booking/lookup"
              class="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
            >
              Quên mật khẩu?
            </a>
          }
          <p-password
            inputId="password"
            formControlName="password"
            [feedback]="false"
            [toggleMask]="true"
            placeholder="••••••••"
            styleClass="w-full"
            inputStyleClass="app-form-control"
            autocomplete="current-password"
            [required]="true"
            [invalid]="!!passwordError"
            [pt]="{ pcInputText: { root: { 'aria-describedby': passwordField.descriptionIds() || undefined, 'aria-invalid': passwordError ? 'true' : undefined } } }"
          />
        </app-form-field>

        <!-- Submit Button (Consistent brand token colors) -->
        <div class="pt-2">
          <button
            type="submit"
            [disabled]="loading() || loginForm.invalid"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            [ngClass]="portal() === 'guest'
              ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo-600/25 hover:shadow-indigo-600/35 ring-1 ring-indigo-500/20'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/25 hover:shadow-emerald-600/35 ring-1 ring-emerald-500/20'"
          >
            @if (loading()) {
              <i class="pi pi-spin pi-spinner text-base"></i>
              <span>Đang xử lý đăng nhập...</span>
            } @else {
              <i [class]="portal() === 'guest' ? 'pi pi-user text-base' : 'pi pi-sign-in text-base'"></i>
              <span>{{ portal() === 'guest' ? 'Đăng nhập Khách hàng' : 'Đăng nhập Ban quản lý (PMS)' }}</span>
            }
          </button>
        </div>
      </form>

      <!-- 4B. SOCIAL LOGIN BUTTONS (GOOGLE & FACEBOOK CHO CỔNG KHÁCH HÀNG) -->
      @if (portal() === 'guest') {
        <div class="mt-4 space-y-3">
          <div class="relative flex items-center justify-center">
            <div class="border-t border-slate-200 w-full"></div>
            <span class="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider relative">
              Hoặc tiếp tục với
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- Google Button -->
            <button
              type="button"
              (click)="loginWithGoogle()"
              [disabled]="loading()"
              class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Google</span>
            </button>

            <!-- Facebook Button -->
            <button
              type="button"
              (click)="loginWithFacebook()"
              [disabled]="loading()"
              class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>
      }

      <!-- 5. TÀI KHOẢN MẪU KIỂM THỬ TƯƠNG ỨNG TỪNG PHÂN HỆ -->
      <div class="mt-5 pt-4 border-t border-slate-100">
        <span class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
          Tài khoản kiểm thử nhanh:
        </span>

        @if (portal() === 'guest') {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              (click)="quickFill('guest.vip@hotelsaas.local')"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-800 text-center transition-colors truncate"
              title="Khách hàng VIP: guest.vip@hotelsaas.local"
            >
              <i class="pi pi-star text-amber-500 mr-1"></i> Khách hàng VIP
            </button>
            <button
              type="button"
              (click)="setPortal('admin')"
              class="px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-center transition-colors truncate"
            >
              Chuyển sang Cổng PMS →
            </button>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              (click)="quickFill('manager.both@hotelsaas.local')"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
              title="Quản lý 2 chi nhánh: manager.both@hotelsaas.local"
            >
              Quản lý 2 nhánh
            </button>
            <button
              type="button"
              (click)="quickFill('staff.single@hotelsaas.local')"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
              title="Lễ tân CN-Q1: staff.single@hotelsaas.local"
            >
              Lễ tân CN-Q1
            </button>
            <button
              type="button"
              (click)="quickFill('owner@hotelsaas.local')"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-center transition-colors truncate"
              title="Owner toàn quyền: owner@hotelsaas.local"
            >
              Chủ KS (Owner)
            </button>
            <button
              type="button"
              (click)="quickFill('superadmin@hotelsaas.platform')"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-800 text-center transition-colors truncate"
              title="Admin toàn sàn: superadmin@hotelsaas.platform"
            >
              Admin Nền tảng
            </button>
          </div>
        }
      </div>

      <!-- 6. LIÊN KẾT ĐIỀU HƯỚNG PHỤ TRỢ (FOOTER LINKS) -->
      <div class="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
        @if (portal() === 'guest') {
          <div>
            <span>Chưa có tài khoản khách lưu trú? </span>
            <a routerLink="/register" class="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
              Đăng ký tài khoản
            </a>
          </div>
          <div>
            <span>Cần tra cứu nhanh đơn đặt phòng? </span>
            <a routerLink="/booking/lookup" class="font-semibold text-slate-700 hover:text-indigo-600 hover:underline">
              Tra cứu mã giữ chỗ / SĐT
            </a>
          </div>
        } @else {
          <div>
            <span>Bạn là chủ khách sạn / nhà nghỉ mới? </span>
            <a routerLink="/partner-register" class="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
              Đăng ký mở cơ sở / chuỗi
            </a>
          </div>
          <div class="pt-0.5">
            <button
              type="button"
              (click)="setPortal('guest')"
              class="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium cursor-pointer"
            >
              <i class="pi pi-arrow-left text-[10px]"></i>
              <span>Quay lại Cổng Khách hàng Lưu trú</span>
            </button>
          </div>
        }
      </div>
    </div>

    <!-- Modal bắt buộc chọn chi nhánh khi login bằng Bootstrap Token -->
    <app-context-selector-dialog
      [visible]="showBranchSelector()"
      (visibleChange)="showBranchSelector.set($event)"
      [requireSelection]="true"
      (contextSwitched)="onBranchSelected($event)"
    />
  `
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);

  get emailError(): string {
    const control = this.loginForm.controls.email;
    if (!control.touched) return '';
    return control.hasError('required') ? 'Email không được để trống' : control.hasError('email') ? 'Email không đúng định dạng' : '';
  }

  get passwordError(): string {
    const control = this.loginForm.controls.password;
    return control.touched && control.hasError('required') ? 'Mật khẩu không được để trống' : '';
  }

  portal = signal<PortalType>('guest');
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showBranchSelector = signal(false);

  loginForm = this.fb.group({
    email: ['guest.vip@hotelsaas.local', [Validators.required, Validators.email]],
    password: ['HotelDev@2026!', [Validators.required]]
  });

  ngOnInit(): void {
    // Đọc query param 'portal' nếu có trên URL (e.g. /auth/login?portal=admin)
    this.route.queryParamMap.subscribe(params => {
      const p = params.get('portal');
      if (p === 'admin' || p === 'guest') {
        this.setPortal(p, false);
      }
    });
  }

  setPortal(type: PortalType, updateForm: boolean = true): void {
    this.portal.set(type);
    this.errorMessage.set(null);

    if (updateForm) {
      if (type === 'guest') {
        this.quickFill('guest.vip@hotelsaas.local');
      } else {
        this.quickFill('manager.both@hotelsaas.local');
      }
    }
  }

  quickFill(email: string): void {
    this.loginForm.patchValue({
      email,
      password: 'HotelDev@2026!'
    });
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      const field = this.loginForm.controls.email.invalid ? 'email' : 'password';
      this.element.nativeElement.querySelector<HTMLInputElement>(`#${field}`)?.focus();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const globalRole = response.user.globalRole;

        // PHÂN HỆ 1: Khách hàng Lưu trú (Customer / Guest) -> 100% không cho vào PMS dashboard, điều hướng sang Profile & Ví điểm
        if (globalRole === 'Customer' || globalRole === 'Guest') {
          this.notification.success(`Chào mừng quý khách ${response.user.fullName}!`);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigate([returnUrl || '/booking/profile']);
          return;
        }

        // PHÂN HỆ 2: Quản trị viên Nền tảng SaaS (SuperAdmin) -> Điều hướng cấu hình Gói cước / Hợp đồng
        if (globalRole === 'SuperAdmin') {
          this.notification.success(`Chào mừng Quản trị viên Nền tảng: ${response.user.fullName}`);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigate([returnUrl || '/admin/plans']);
          return;
        }

        // PHÂN HỆ 3: Nhân sự & Quản lý Khách sạn / Chuỗi (TenantStaff)
        const memberships = response.memberships || [];
        const branchMemberships = memberships.filter(m => !!m.propertyId);

        // Trường hợp 3a: Quản lý từ 2 chi nhánh trở lên -> BẮT BUỘC hiện modal chọn chi nhánh làm việc
        if (branchMemberships.length > 1) {
          this.notification.info('Vui lòng chọn chi nhánh làm việc.');
          this.showBranchSelector.set(true);
          return;
        }

        // Trường hợp 3b: Nhân viên có duy nhất 1 chi nhánh -> Tự động kích hoạt ngữ cảnh chi nhánh đó
        if (branchMemberships.length === 1) {
          const soleBranch = branchMemberships[0];
          this.authService.switchContext(soleBranch.propertyId!).subscribe({
            next: () => {
              this.notification.success(`Đăng nhập thành công chi nhánh: ${soleBranch.propertyName || soleBranch.propertyCode}`);
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              this.router.navigate(['/dashboard']);
            }
          });
          return;
        }

        // Trường hợp 3c: Chủ sở hữu cấp Chuỗi (Tenant-wide Owner)
        this.notification.success('Đăng nhập thành công!');
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const detail = err.error?.title || err.error?.message || 'Email hoặc mật khẩu không chính xác.';
        this.errorMessage.set(detail);
      }
    });
  }

  onBranchSelected(membership: UserMembershipDto): void {
    this.showBranchSelector.set(false);
    this.router.navigate(['/dashboard']);
  }

  loginWithGoogle(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.authService.socialLogin({
      provider: 'Google',
      providerSubject: 'google-oauth-demo-user-123456',
      providerEmail: 'alex.luxury@gmail.com',
      fullName: 'Alex Luxury Guest',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.notification.success(`Đăng nhập Google thành công! Chào mừng ${response.user.fullName}`);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigate([returnUrl || '/booking/profile']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.detail || err.error?.message || 'Đăng nhập Google thất bại.');
      }
    });
  }

  loginWithFacebook(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.authService.socialLogin({
      provider: 'Facebook',
      providerSubject: 'facebook-oauth-demo-user-789012',
      providerEmail: 'sarah.traveller@facebook.com',
      fullName: 'Sarah Traveller',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80'
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.notification.success(`Đăng nhập Facebook thành công! Chào mừng ${response.user.fullName}`);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigate([returnUrl || '/booking/profile']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.detail || err.error?.message || 'Đăng nhập Facebook thất bại.');
      }
    });
  }
}
