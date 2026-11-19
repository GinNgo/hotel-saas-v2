import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneOtpModalComponent } from './phone-otp-modal.component';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginResponse } from '../../../core/models/auth.model';

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

  it('renders dialog accessibility attributes and close button aria-label', () => {
    const fixture = TestBed.createComponent(PhoneOtpModalComponent);
    fixture.componentInstance.visible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const closeBtn = el.querySelector('button[aria-label]');
    expect(closeBtn?.getAttribute('aria-label')).toBeTruthy();

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

    const mockLoginResponse: LoginResponse = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAtUtc: '2026-12-31T00:00:00Z',
      user: {
        id: 'u1',
        fullName: 'Test User',
        email: 'test@example.com',
        globalRole: 'Customer',
        tenantId: null
      },
      memberships: []
    };
    mockVerifyPhoneFirebase.mockReturnValue(of(mockLoginResponse));

    const fixture = TestBed.createComponent(PhoneOtpModalComponent);
    fixture.componentInstance.visible = true;
    fixture.componentInstance.phoneNumber = '0987654321';
    fixture.componentInstance.otpCode = '123456';
    fixture.componentInstance.step.set('otp');

    const emittedResults: Array<{ success: boolean; loginResponse?: LoginResponse; phoneNumber: string }> = [];
    fixture.componentInstance.verified.subscribe((res) => {
      emittedResults.push(res);
    });

    await fixture.componentInstance.verifyOtp();

    expect(mockVerifyPhoneOtp).toHaveBeenCalledWith('123456');
    expect(mockVerifyPhoneFirebase).toHaveBeenCalledWith({
      firebaseIdToken: 'dev-mock-token:+84987654321',
      fullName: undefined
    });
    expect(mockNotification.success).toHaveBeenCalled();
    expect(emittedResults[0]?.success).toBe(true);
    expect(fixture.componentInstance.visible).toBe(false);
  });
});
