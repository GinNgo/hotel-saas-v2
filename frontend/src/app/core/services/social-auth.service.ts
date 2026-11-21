import { Injectable, isDevMode, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfoProfile {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  width?: number;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  locale?: string;
}

interface GoogleAccountsApi {
  id: {
    initialize(config: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
    }): void;
    prompt(callback: (notification: GooglePromptMomentNotification) => void): void;
    renderButton?: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  };
  oauth2?: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (tokenResponse: GoogleTokenResponse) => void | Promise<void>;
      error_callback: (err: unknown) => void;
    }): { requestAccessToken(options: { prompt: string }): void };
  };
}

interface DecodedGoogleJwt {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccountsApi };
  }
}

export interface SocialAuthUser {
  provider: 'Google';
  idToken?: string;
  accessToken?: string;
  providerSubject: string;
  providerEmail: string;
  fullName: string;
  avatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  readonly isGoogleConfigured = signal<boolean>(Boolean(environment.socialAuth?.googleClientId));

  /**
   * Render nút đăng nhập Google chính thức bằng Google Identity Services (GIS `renderButton`).
   * Hoạt động ổn định ngay cả khi trình duyệt chặn One Tap (`id.prompt()`).
   * Trả về `true` nếu render thành công, ngược lại `false` để UI giữ nút fallback an toàn.
   */
  async renderGoogleButton(
    container: HTMLElement,
    callback: (idToken: string) => void,
    options?: { text?: GoogleButtonOptions['text'] }
  ): Promise<boolean> {
    const clientId = environment.socialAuth?.googleClientId;
    if (!clientId || !container || typeof window === 'undefined') {
      return false;
    }

    try {
      await this.loadGoogleScript();
      const g = window.google;
      if (!g?.accounts?.id || typeof g.accounts.id.renderButton !== 'function') {
        return false;
      }

      g.accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => {
          if (response?.credential) {
            callback(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      container.innerHTML = '';
      const computedWidth = container.offsetWidth || container.parentElement?.offsetWidth || 320;
      g.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: computedWidth,
        text: options?.text ?? 'signin_with',
        locale: 'vi'
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Khởi tạo và mở cửa sổ đăng nhập Google OAuth 2.0 (Google Identity Services - GSI).
   * Mở native popup/prompt chọn tài khoản Google của người dùng.
   * Trả về ID Token mật mã để gửi lên Backend xác thực.
   */
  async signInWithGoogle(): Promise<SocialAuthUser> {
    const clientId = environment.socialAuth?.googleClientId;
    if (!clientId) {
      throw new Error('Google Client ID chưa được cấu hình.');
    }

    await this.loadGoogleScript();

    return new Promise((resolve, reject) => {
      try {
        let resolved = false;
        const g = typeof window !== 'undefined' ? window.google : null;
        if (!g?.accounts?.id) {
          throw new Error('Google Identity Services SDK chưa sẵn sàng.');
        }

        g.accounts.id.initialize({
          client_id: clientId,
          callback: (response: GoogleCredentialResponse) => {
            if (response && response.credential) {
              resolved = true;
              try {
                const decoded = jwtDecode<DecodedGoogleJwt>(response.credential);
                resolve({
                  provider: 'Google',
                  idToken: response.credential,
                  providerSubject: decoded.sub || '',
                  providerEmail: decoded.email || '',
                  fullName: decoded.name || decoded.email?.split('@')[0] || 'Khách hàng Google',
                  avatarUrl: decoded.picture || undefined
                });
              } catch {
                resolve({
                  provider: 'Google',
                  idToken: response.credential,
                  providerSubject: '',
                  providerEmail: '',
                  fullName: 'Khách hàng Google'
                });
              }
            } else {
              reject(new Error('Không nhận được mã xác thực từ Google.'));
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });

        // Kích hoạt One Tap / Native Account Chooser prompt
        g.accounts.id.prompt((notification: GooglePromptMomentNotification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Khi trình duyệt chặn One Tap (3rd-party cookie restriction), chỉ cho phép fallback mock token trong chế độ Dev
            if (!isDevMode()) {
              if (!resolved) {
                reject(new Error('Trình duyệt đã chặn cửa sổ Google One Tap. Vui lòng cho phép pop-up/cookie Google hoặc đăng nhập bằng Email / SMS OTP.'));
              }
              return;
            }
            this.triggerGoogleOAuthPopup(clientId)
              .then(res => {
                if (!resolved) resolve(res);
              })
              .catch(err => {
                if (!resolved) reject(err);
              });
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Fallback popup chuẩn OAuth2 của Google khi GSI One Tap bị chặn bởi cài đặt trình duyệt (chỉ dùng trong Dev Mode)
   */
  private triggerGoogleOAuthPopup(clientId: string): Promise<SocialAuthUser> {
    if (!isDevMode()) {
      return Promise.reject(new Error('Xác thực Google cần ID Token hợp lệ từ Google Identity Services.'));
    }

    return new Promise((resolve, reject) => {
      try {
        const g = typeof window !== 'undefined' ? window.google : null;
        if (typeof g?.accounts?.oauth2?.initTokenClient === 'function') {
          const client = g.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            callback: async (tokenResponse: GoogleTokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                try {
                  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  const profile = (await res.json()) as GoogleUserInfoProfile;
                  const email = profile.email || '';
                  const fullName = profile.name || email.split('@')[0] || 'Khách hàng Google';
                  resolve({
                    provider: 'Google',
                    accessToken: tokenResponse.access_token,
                    // Chỉ dùng mock token trong chế độ Dev khi OAuth Token Client không trả ID Token
                    idToken: isDevMode() ? `dev-mock-google-token:${email}:${fullName}` : undefined,
                    providerSubject: profile.sub || profile.id || '',
                    providerEmail: email,
                    fullName,
                    avatarUrl: profile.picture
                  });
                } catch {
                  reject(new Error('Không thể tải thông tin hồ sơ Google.'));
                }
              } else {
                reject(new Error('Người dùng đã hủy đăng nhập Google.'));
              }
            },
            error_callback: (err: unknown) => reject(err)
          });
          client.requestAccessToken({ prompt: 'select_account' });
        } else {
          reject(new Error('Google OAuth SDK không hỗ trợ chế độ popup trên trình duyệt này.'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  private loadGoogleScript(): Promise<void> {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      return Promise.resolve();
    }

    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return Promise.reject(new Error('Google Identity Services SDK không khả dụng trong môi trường kiểm thử JSDOM.'));
    }

    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve();
        return;
      }

      const existing = document.getElementById('google-jssdk') as HTMLScriptElement | null;
      if (existing) {
        if (window.google?.accounts?.id) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => {
          reject(new Error('Không thể tải Google Identity Services SDK (có thể do tiện ích chặn quảng cáo).'));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK (có thể do tiện ích chặn quảng cáo).'));
      document.head.appendChild(script);
    });
  }
}
