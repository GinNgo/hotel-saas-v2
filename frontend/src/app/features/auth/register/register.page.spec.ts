import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { JSDOM } from 'jsdom';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './register.page';
import { AuthService } from '../../../core/services/auth.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { NotificationService } from '../../../core/services/notification.service';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: browser.window,
    document: browser.window.document,
    HTMLElement: browser.window.HTMLElement,
    Node: browser.window.Node
  });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('RegisterPage email submission response handling', () => {
  const mockRegister = vi.fn();
  const mockGoogleLogin = vi.fn();
  const mockNotification = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            register: mockRegister,
            googleLogin: mockGoogleLogin
          }
        },
        {
          provide: SocialAuthService,
          useValue: {
            renderGoogleButton: vi.fn().mockResolvedValue(false),
            signInWithGoogle: vi.fn()
          }
        },
        {
          provide: NotificationService,
          useValue: mockNotification
        }
      ]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  function fillValidEmailForm(page: RegisterPage): void {
    page.emailRegisterForm.setValue({
      fullName: 'Nguyễn Văn A',
      email: 'guest@example.com',
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
  }

  it('treats bare RegisterResponse { userId, message } as success without setting errorMessage', () => {
    mockRegister.mockReturnValue(
      of({ userId: 'usr-bare-001', message: 'Đăng ký thành công' })
    );

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RegisterPage);
    fillValidEmailForm(fixture.componentInstance);

    fixture.componentInstance.onEmailSubmit();

    expect(mockNotification.success).toHaveBeenCalledWith(
      'Đăng ký tài khoản thành công! Thư xác thực tài khoản đã được gửi đến email của bạn. Vui lòng mở hộp thư để bấm liên kết kích hoạt.'
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(fixture.componentInstance.errorMessage()).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('treats wrapped ApiResponse { success: true, data: { userId } } as success without setting errorMessage', () => {
    mockRegister.mockReturnValue(
      of({ success: true, data: { userId: 'usr-wrap-002', message: 'OK' } })
    );

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RegisterPage);
    fillValidEmailForm(fixture.componentInstance);

    fixture.componentInstance.onEmailSubmit();

    expect(mockNotification.success).toHaveBeenCalledWith(
      'Đăng ký tài khoản thành công! Thư xác thực tài khoản đã được gửi đến email của bạn. Vui lòng mở hộp thư để bấm liên kết kích hoạt.'
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(fixture.componentInstance.errorMessage()).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sets errorMessage when register HTTP call fails', () => {
    mockRegister.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Email đã tồn tại.' } }))
    );

    const fixture = TestBed.createComponent(RegisterPage);
    fillValidEmailForm(fixture.componentInstance);

    fixture.componentInstance.onEmailSubmit();

    expect(mockNotification.success).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorMessage()).toBe('Email đã tồn tại.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
