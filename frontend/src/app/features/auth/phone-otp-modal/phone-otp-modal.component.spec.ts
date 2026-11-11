import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneOtpModalComponent } from './phone-otp-modal.component';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('PhoneOtpModalComponent', () => {
  const mockSendPhoneOtp = vi.fn();
  const mockVerifyPhoneOtp = vi.fn();
  const mockReset = vi.fn();
  const mockVerifyPhoneFirebase = vi.fn();
  const mockNotification = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PhoneOtpModalComponent],
      providers: [
        {
          provide: FirebaseAuthService,
          useValue: {
            sendPhoneOtp: mockSendPhoneOtp,
            verifyPhoneOtp: mockVerifyPhoneOtp,
            reset: mockReset
          }
        },
        {
          provide: AuthService,
          useValue: {
            verifyPhoneFirebase: mockVerifyPhoneFirebase
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

  it('renders correctly and populates demo phone number', () => {
    const fixture = TestBed.createComponent(PhoneOtpModalComponent);
    fixture.componentInstance.visible = true;
    fixture.detectChanges();

    expect(fixture.componentInstance.step()).toBe('phone');
    fixture.componentInstance.quickFillDemoPhone();
    expect(fixture.componentInstance.phoneNumber).toBe('0123456789');
  });

  it('transitions to otp step when sendOtp succeeds', async () => {
    mockSendPhoneOtp.mockResolvedValue({
      success: true,
      isMock: true,
      phoneNumber: '+84987654321',
      message: 'Mã OTP là 123456'
    });

    const fixture = TestBed.createComponent(PhoneOtpModalComponent);
    fixture.componentInstance.visible = true;
    fixture.componentInstance.phoneNumber = '0987654321';
    fixture.detectChanges();

    await fixture.componentInstance.sendOtp();
    fixture.detectChanges();

    expect(mockSendPhoneOtp).toHaveBeenCalledWith('0987654321', 'recaptcha-phone-modal');
    expect(fixture.componentInstance.step()).toBe('otp');
    expect(fixture.componentInstance.normalizedPhone()).toBe('+84987654321');
    expect(fixture.componentInstance.countdown()).toBe(60);

    fixture.componentInstance.closeModal();
  });

  it('verifies otp and completes login workflow', async () => {
    mockVerifyPhoneOtp.mockResolvedValue({
      success: true,
      idToken: 'dev-mock-token:+84987654321',
      phoneNumber: '+84987654321'
    });

    const mockLoginResponse: any = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      user: { id: 'u1', fullName: 'Test User', globalRole: 'Customer' }
    };
    mockVerifyPhoneFirebase.mockReturnValue(of(mockLoginResponse));

    const fixture = TestBed.createComponent(PhoneOtpModalComponent);
    fixture.componentInstance.visible = true;
    fixture.componentInstance.phoneNumber = '0987654321';
    fixture.componentInstance.otpCode = '123456';
    fixture.componentInstance.step.set('otp');

    let emittedResult: any = null;
    fixture.componentInstance.verified.subscribe((res) => {
      emittedResult = res;
    });

    await fixture.componentInstance.verifyOtp();

    expect(mockVerifyPhoneOtp).toHaveBeenCalledWith('123456');
    expect(mockVerifyPhoneFirebase).toHaveBeenCalledWith({
      firebaseIdToken: 'dev-mock-token:+84987654321',
      fullName: undefined
    });
    expect(mockNotification.success).toHaveBeenCalled();
    expect(emittedResult?.success).toBe(true);
    expect(fixture.componentInstance.visible).toBe(false);
  });
});
