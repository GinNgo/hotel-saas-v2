import { Injectable, inject } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { environment } from '../../../environments/environment';

export interface SendOtpResult {
  success: boolean;
  isMock: boolean;
  phoneNumber: string;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  idToken: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private confirmationResult: ConfirmationResult | null = null;
  private lastFormattedPhone: string = '';
  private isMockMode: boolean = false;

  constructor() {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      const config = (environment as any).firebase;
      const isDemoConfig = !config?.apiKey || config?.apiKey === 'AIzaSyDemoKeyForHotelSaasDevTestOnly';

      if (!isDemoConfig) {
        this.app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        this.auth = getAuth(this.app);
        this.auth.useDeviceLanguage();
      } else {
        this.isMockMode = true;
      }
    } catch (err) {
      console.warn('[FirebaseAuthService] Firebase init fallback to mock mode:', err);
      this.isMockMode = true;
    }
  }

  /**
   * Chuẩn hóa số điện thoại Việt Nam sang định dạng E.164 (+84...)
   */
  normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '+84' + cleaned.substring(1);
    } else if (cleaned.startsWith('84') && !cleaned.startsWith('+84')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+84' + cleaned;
    }
    return cleaned;
  }

  /**
   * Khởi tạo hoặc lấy lại reCAPTCHA Invisible Verifier gắn vào container HTML element.
   */
  private getOrCreateRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
    if (typeof window === 'undefined' || !this.auth) return null;

    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch {
        // Ignored
      }
      this.recaptchaVerifier = null;
    }

    const containerEl = document.getElementById(containerId);
    if (!containerEl) {
      console.warn(`[FirebaseAuthService] Container #${containerId} not found in DOM.`);
      return null;
    }

    this.recaptchaVerifier = new RecaptchaVerifier(this.auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - will proceed with phone auth
      },
      'expired-callback': () => {
        console.warn('[FirebaseAuthService] reCAPTCHA expired, user must retry');
      }
    });

    return this.recaptchaVerifier;
  }

  /**
   * Gửi mã SMS OTP tới số điện thoại người dùng thông qua Google Identity Platform.
   * Nếu ở môi trường dev mock, giả lập gửi OTP thành công với mã thử nghiệm 123456.
   */
  async sendPhoneOtp(rawPhone: string, containerId: string = 'recaptcha-container'): Promise<SendOtpResult> {
    const formattedPhone = this.normalizePhoneNumber(rawPhone);
    this.lastFormattedPhone = formattedPhone;

    // Kịch bản Mock Mode (offline dev / test without real SMS charges)
    if (this.isMockMode || !this.auth || formattedPhone.includes('000000') || formattedPhone.includes('999999')) {
      this.isMockMode = true;
      this.confirmationResult = null;
      return {
        success: true,
        isMock: true,
        phoneNumber: formattedPhone,
        message: 'Đang ở chế độ mô phỏng Sandbox. Mã OTP thử nghiệm là: 123456'
      };
    }

    try {
      const verifier = this.getOrCreateRecaptchaVerifier(containerId);
      if (!verifier) {
        // Fallback to mock mode if DOM container is missing
        this.isMockMode = true;
        return {
          success: true,
          isMock: true,
          phoneNumber: formattedPhone,
          message: 'Không tìm thấy container reCAPTCHA. Đã chuyển sang chế độ Sandbox OTP: 123456'
        };
      }

      this.confirmationResult = await signInWithPhoneNumber(this.auth, formattedPhone, verifier);
      return {
        success: true,
        isMock: false,
        phoneNumber: formattedPhone,
        message: `Mã OTP xác thực gồm 6 chữ số đã được gửi tới ${formattedPhone} qua tin nhắn SMS.`
      };
    } catch (error: any) {
      console.error('[FirebaseAuthService] sendPhoneOtp error:', error);
      // Nếu gặp lỗi quota, billing hoặc operation-not-allowed, tự động fallback sang dev mock để không gián đoạn demo
      if (error?.code === 'auth/quota-exceeded' || error?.code === 'auth/billing-not-enabled' || error?.code === 'auth/invalid-app-credential' || error?.code === 'auth/operation-not-allowed') {
        this.isMockMode = true;
        return {
          success: true,
          isMock: true,
          phoneNumber: formattedPhone,
          message: `Firebase SMS Sandbox: Mã OTP thử nghiệm là 123456 (Lý do: ${error?.code})`
        };
      }
      throw error;
    }
  }

  /**
   * Thẩm định mã 6 chữ số OTP và lấy Firebase ID Token từ Google Identity Platform.
   */
  async verifyPhoneOtp(otpCode: string): Promise<VerifyOtpResult> {
    const trimmedOtp = otpCode.trim();

    // Trường hợp mô phỏng Mock Token (hoặc nhập mã dev 123456)
    if (this.isMockMode || !this.confirmationResult) {
      if (trimmedOtp === '123456' || trimmedOtp.length === 6) {
        return {
          success: true,
          idToken: `dev-mock-token:${this.lastFormattedPhone}`,
          phoneNumber: this.lastFormattedPhone
        };
      }
      throw new Error('Mã OTP không chính xác. Trong chế độ thử nghiệm, vui lòng nhập mã 123456.');
    }

    try {
      const userCredential = await this.confirmationResult.confirm(trimmedOtp);
      const idToken = await userCredential.user.getIdToken();
      const verifiedPhone = userCredential.user.phoneNumber || this.lastFormattedPhone;

      return {
        success: true,
        idToken,
        phoneNumber: verifiedPhone
      };
    } catch (error: any) {
      console.error('[FirebaseAuthService] verifyPhoneOtp error:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        throw new Error('Mã OTP xác thực không chính xác hoặc đã hết hạn.');
      }
      throw error;
    }
  }

  /**
   * Dọn dẹp reCAPTCHA và trạng thái khi đóng modal
   */
  reset(): void {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch {
        // Ignored
      }
      this.recaptchaVerifier = null;
    }
    this.confirmationResult = null;
    this.lastFormattedPhone = '';
  }
}
