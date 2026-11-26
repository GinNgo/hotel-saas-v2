import { Injectable } from '@angular/core';
import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
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
      const config = (environment as { firebase?: FirebaseOptions & { apiKey?: string } }).firebase;
      const isDemoConfig = !config?.apiKey || config?.apiKey === 'AIzaSyDemoKeyForHotelSaasDevTestOnly';

      if (!isDemoConfig) {
        this.app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        this.auth = getAuth(this.app);
        this.auth.useDeviceLanguage();
        this.isMockMode = false;
      } else if (!environment.production) {
        this.isMockMode = true;
      } else {
        this.isMockMode = false;
        this.app = null;
        this.auth = null;
      }
    } catch (err) {
      if (!environment.production) {
        console.warn('[FirebaseAuthService] Firebase init fallback to mock mode:', err);
        this.isMockMode = true;
      } else {
        console.error('[FirebaseAuthService] Firebase init failed in production:', err);
        this.isMockMode = false;
        this.app = null;
        this.auth = null;
      }
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
  protected getOrCreateRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
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
      },
      'error-callback': () => {
        console.warn('[FirebaseAuthService] reCAPTCHA error callback');
      }
    });

    return this.recaptchaVerifier;
  }

  protected callSignInWithPhoneNumber(
    auth: Auth,
    formattedPhone: string,
    verifier: RecaptchaVerifier
  ): Promise<ConfirmationResult> {
    return signInWithPhoneNumber(auth, formattedPhone, verifier);
  }

  /**
   * Gửi mã SMS OTP tới số điện thoại người dùng thông qua Google Identity Platform.
   * Nếu ở môi trường dev mock, giả lập gửi OTP thành công với mã thử nghiệm 123456.
   */
  async sendPhoneOtp(rawPhone: string, containerId: string = 'recaptcha-container'): Promise<SendOtpResult> {
    const formattedPhone = this.normalizePhoneNumber(rawPhone);
    this.lastFormattedPhone = formattedPhone;

    // Kịch bản Mock Mode (chỉ cho phép khi !environment.production)
    if (!environment.production && (this.isMockMode || !this.auth || formattedPhone.includes('000000') || formattedPhone.includes('999999'))) {
      this.isMockMode = true;
      this.confirmationResult = null;
      return {
        success: true,
        isMock: true,
        phoneNumber: formattedPhone,
        message: 'Đang ở chế độ mô phỏng Sandbox. Mã OTP thử nghiệm là: 123456'
      };
    }

    if (!this.auth) {
      throw new Error('Dịch vụ xác thực SMS OTP chưa sẵn sàng trên hệ thống. Vui lòng thử lại sau.');
    }

    try {
      const verifier = this.getOrCreateRecaptchaVerifier(containerId);
      if (!verifier) {
        if (!environment.production) {
          // Fallback to mock mode if DOM container is missing in dev
          this.isMockMode = true;
          return {
            success: true,
            isMock: true,
            phoneNumber: formattedPhone,
            message: 'Không tìm thấy container reCAPTCHA. Đã chuyển sang chế độ Sandbox OTP: 123456'
          };
        }
        throw new Error('Không thể khởi tạo xác thực bảo mật reCAPTCHA. Vui lòng tải lại trang và thử lại.');
      }

      this.confirmationResult = await this.callSignInWithPhoneNumber(this.auth, formattedPhone, verifier);
      return {
        success: true,
        isMock: false,
        phoneNumber: formattedPhone,
        message: `Mã OTP xác thực gồm 6 chữ số đã được gửi tới ${formattedPhone} qua tin nhắn SMS.`
      };
    } catch (error: unknown) {
      console.error('[FirebaseAuthService] sendPhoneOtp error:', error);
      const errCode = (error as { code?: string } | null)?.code;
      // Nếu gặp lỗi quota, billing hoặc operation-not-allowed ở dev, fallback sang dev mock để không gián đoạn demo
      if (
        !environment.production &&
        (errCode === 'auth/quota-exceeded' ||
          errCode === 'auth/billing-not-enabled' ||
          errCode === 'auth/invalid-app-credential' ||
          errCode === 'auth/operation-not-allowed')
      ) {
        this.isMockMode = true;
        return {
          success: true,
          isMock: true,
          phoneNumber: formattedPhone,
          message: `Firebase SMS Sandbox: Mã OTP thử nghiệm là 123456 (Lý do: ${errCode})`
        };
      }
      const firebaseErrorMessages: Record<string, string> = {
        'auth/quota-exceeded': `Dịch vụ gửi mã SMS OTP hiện không khả dụng do vượt hạn mức gửi (${errCode}). Vui lòng thử lại sau.`,
        'auth/billing-not-enabled': `Dịch vụ gửi mã SMS OTP hiện không khả dụng do chưa kích hoạt gói SMS (${errCode}). Vui lòng liên hệ quản trị viên.`,
        'auth/invalid-app-credential': `Dịch vụ gửi mã SMS OTP hiện không khả dụng do thông tin xác thực ứng dụng không hợp lệ (${errCode}). Vui lòng thử lại sau.`,
        'auth/operation-not-allowed': `Dịch vụ gửi mã SMS OTP hiện không khả dụng do phương thức SMS chưa được bật (${errCode}).`,
        'auth/unauthorized-domain': `Tên miền hiện tại chưa được cấp quyền gửi OTP trên Firebase (${errCode}). Vui lòng liên hệ quản trị viên.`,
        'auth/too-many-requests': `Bạn đã yêu cầu gửi mã OTP quá nhiều lần, vui lòng thử lại sau ít phút (${errCode}).`,
        'auth/captcha-check-failed': `Xác minh bảo mật reCAPTCHA thất bại (${errCode}). Vui lòng thử lại.`
      };
      if (errCode && firebaseErrorMessages[errCode]) {
        throw new Error(firebaseErrorMessages[errCode]);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.');
    }
  }

  /**
   * Thẩm định mã 6 chữ số OTP và lấy Firebase ID Token từ Google Identity Platform.
   */
  async verifyPhoneOtp(otpCode: string): Promise<VerifyOtpResult> {
    const trimmedOtp = otpCode.trim();

    // Trường hợp mô phỏng Mock Token (chỉ cho phép khi !environment.production và chỉ chấp nhận mã thử nghiệm 123456)
    if (!environment.production && (this.isMockMode || !this.confirmationResult)) {
      if (trimmedOtp === '123456') {
        return {
          success: true,
          idToken: `dev-mock-token:${this.lastFormattedPhone}`,
          phoneNumber: this.lastFormattedPhone
        };
      }
      throw new Error('Mã OTP không chính xác. Trong chế độ thử nghiệm, vui lòng nhập mã 123456.');
    }

    if (!this.confirmationResult) {
      throw new Error('Phiên xác thực OTP chưa sẵn sàng hoặc đã hết hạn. Vui lòng gửi lại mã mới.');
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
    } catch (error: unknown) {
      console.error('[FirebaseAuthService] verifyPhoneOtp error:', error);
      const errCode = (error as { code?: string } | null)?.code;
      if (errCode === 'auth/invalid-verification-code') {
        throw new Error('Mã OTP xác thực không chính xác hoặc đã hết hạn.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Không thể xác thực mã OTP. Vui lòng thử lại.');
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
