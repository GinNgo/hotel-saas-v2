import '@angular/compiler';
import { Auth, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseAuthService } from './firebase-auth.service';
import { environment } from '../../../environments/environment';

class TestableFirebaseAuthService extends FirebaseAuthService {
  mockVerifier: RecaptchaVerifier | null = null;
  useRealVerifierLookup = false;
  signInFn = vi.fn<
    (auth: Auth, formattedPhone: string, verifier: RecaptchaVerifier) => Promise<ConfirmationResult>
  >();

  protected override getOrCreateRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
    if (this.useRealVerifierLookup) {
      return super.getOrCreateRecaptchaVerifier(containerId);
    }
    return this.mockVerifier;
  }

  protected override callSignInWithPhoneNumber(
    auth: Auth,
    formattedPhone: string,
    verifier: RecaptchaVerifier
  ): Promise<ConfirmationResult> {
    return this.signInFn(auth, formattedPhone, verifier);
  }
}

describe('FirebaseAuthService (Production Fail-Closed vs Dev Sandbox Fallback)', () => {
  const originalProduction = environment.production;
  const originalApiKey = environment.firebase.apiKey;

  beforeEach(() => {
    vi.clearAllMocks();
    environment.production = originalProduction;
    environment.firebase.apiKey = originalApiKey;
  });

  afterEach(() => {
    environment.production = originalProduction;
    environment.firebase.apiKey = originalApiKey;
  });

  it('normalizes Vietnamese phone numbers to E.164 format', () => {
    const service = new TestableFirebaseAuthService();
    expect(service.normalizePhoneNumber('0912 345-678')).toBe('+84912345678');
    expect(service.normalizePhoneNumber('84912345678')).toBe('+84912345678');
    expect(service.normalizePhoneNumber('+84912345678')).toBe('+84912345678');
  });

  describe('when environment.production === true (Fail-Closed)', () => {
    beforeEach(() => {
      environment.production = true;
    });

    it('never enters mock mode and throws on sendPhoneOtp/verifyPhoneOtp when Firebase config is demo/missing', async () => {
      environment.firebase.apiKey = 'AIzaSyDemoKeyForHotelSaasDevTestOnly';
      const service = new TestableFirebaseAuthService();

      await expect(service.sendPhoneOtp('0123456789')).rejects.toThrow(
        'Dịch vụ xác thực SMS OTP chưa sẵn sàng'
      );
      await expect(service.verifyPhoneOtp('123456')).rejects.toThrow(
        'Phiên xác thực OTP chưa sẵn sàng'
      );
    });

    it('throws instead of falling back to mock mode when reCAPTCHA DOM container is missing', async () => {
      const service = new TestableFirebaseAuthService();
      service.useRealVerifierLookup = true;

      await expect(service.sendPhoneOtp('0987654321', 'missing-recaptcha-el')).rejects.toThrow(
        'Không thể khởi tạo xác thực bảo mật reCAPTCHA'
      );
      await expect(service.verifyPhoneOtp('123456')).rejects.toThrow(
        'Phiên xác thực OTP chưa sẵn sàng'
      );
    });

    it('throws instead of falling back to dev-mock-token when signInWithPhoneNumber hits auth/quota-exceeded', async () => {
      const service = new TestableFirebaseAuthService();
      service.mockVerifier = { clear: vi.fn() } as unknown as RecaptchaVerifier;
      service.signInFn.mockRejectedValueOnce({ code: 'auth/quota-exceeded' });

      await expect(service.sendPhoneOtp('0987654321', 'test-recaptcha-container')).rejects.toThrow(
        'Dịch vụ gửi mã SMS OTP hiện không khả dụng'
      );
      await expect(service.verifyPhoneOtp('123456')).rejects.toThrow(
        'Phiên xác thực OTP chưa sẵn sàng'
      );
    });

    it.each([
      ['auth/quota-exceeded', 'Dịch vụ gửi mã SMS OTP hiện không khả dụng'],
      ['auth/billing-not-enabled', 'Dịch vụ gửi mã SMS OTP hiện không khả dụng'],
      ['auth/invalid-app-credential', 'Dịch vụ gửi mã SMS OTP hiện không khả dụng'],
      ['auth/operation-not-allowed', 'Dịch vụ gửi mã SMS OTP hiện không khả dụng'],
      ['auth/unauthorized-domain', 'Tên miền hiện tại chưa được cấp quyền gửi OTP'],
      ['auth/too-many-requests', 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần'],
      ['auth/captcha-check-failed', 'Xác minh bảo mật reCAPTCHA thất bại'],
    ])('maps Firebase error %s to clear Vietnamese message with code in parentheses', async (code, expectedPrefix) => {
      const service = new TestableFirebaseAuthService();
      service.mockVerifier = { clear: vi.fn() } as unknown as RecaptchaVerifier;
      service.signInFn.mockRejectedValueOnce({ code });

      let thrown: Error | undefined;
      try {
        await service.sendPhoneOtp('0987654321', 'test-recaptcha-container');
      } catch (err) {
        thrown = err as Error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown?.message).toContain(expectedPrefix);
      expect(thrown?.message).toContain(`(${code})`);
    });

    it('supports real Firebase confirmation (including +84123456789 sandbox phone) without emitting dev-mock-token', async () => {
      const service = new TestableFirebaseAuthService();
      service.mockVerifier = { clear: vi.fn() } as unknown as RecaptchaVerifier;

      const fakeConfirmation = {
        verificationId: 'ver-123',
        confirm: vi.fn().mockResolvedValue({
          user: {
            phoneNumber: '+84123456789',
            getIdToken: vi.fn().mockResolvedValue('real-firebase-jwt-token'),
          },
        }),
      } as unknown as ConfirmationResult;
      service.signInFn.mockResolvedValueOnce(fakeConfirmation);

      const sendRes = await service.sendPhoneOtp('+84123456789', 'test-recaptcha-container');

      expect(sendRes.success).toBe(true);
      expect(sendRes.isMock).toBe(false);
      expect(service.signInFn).toHaveBeenCalledTimes(1);

      const verifyRes = await service.verifyPhoneOtp('123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.idToken).toBe('real-firebase-jwt-token');
      expect(verifyRes.idToken).not.toContain('dev-mock-token:');
      expect(verifyRes.phoneNumber).toBe('+84123456789');
    });
  });

  describe('when environment.production === false (Dev Sandbox Fallback)', () => {
    beforeEach(() => {
      environment.production = false;
    });

    it('allows offline mock OTP flow and emits dev-mock-token for 123456 when config is demo', async () => {
      environment.firebase.apiKey = 'AIzaSyDemoKeyForHotelSaasDevTestOnly';
      const service = new TestableFirebaseAuthService();

      const sendRes = await service.sendPhoneOtp('0123456789');
      expect(sendRes.success).toBe(true);
      expect(sendRes.isMock).toBe(true);
      expect(sendRes.phoneNumber).toBe('+84123456789');

      const verifyRes = await service.verifyPhoneOtp('123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.idToken).toBe('dev-mock-token:+84123456789');

      await expect(service.verifyPhoneOtp('999999')).rejects.toThrow(
        'Mã OTP không chính xác'
      );
    });

    it('falls back to mock mode on auth/quota-exceeded in non-production environments', async () => {
      const service = new TestableFirebaseAuthService();
      service.mockVerifier = { clear: vi.fn() } as unknown as RecaptchaVerifier;
      service.signInFn.mockRejectedValueOnce({ code: 'auth/quota-exceeded' });

      const sendRes = await service.sendPhoneOtp('0987654321', 'test-recaptcha-container');
      expect(sendRes.success).toBe(true);
      expect(sendRes.isMock).toBe(true);

      const verifyRes = await service.verifyPhoneOtp('123456');
      expect(verifyRes.idToken).toBe('dev-mock-token:+84987654321');
    });
  });
});
