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

interface GoogleAccountsApi {
  id: {
    initialize(config: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select: boolean;
      cancel_on_tap_outside: boolean;
    }): void;
    prompt(callback: (notification: GooglePromptMomentNotification) => void): void;
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

interface FacebookLoginResponse {
  authResponse?: {
    accessToken?: string;
    userID?: string;
  };
}

interface FacebookProfileResponse {
  id?: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

interface FacebookSdkApi {
  init(config: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: FacebookLoginResponse) => void, options: { scope: string; return_scopes: boolean }): void;
  api(path: string, params: Record<string, string>, callback: (profile: FacebookProfileResponse) => void): void;
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
    FB?: FacebookSdkApi;
    fbAsyncInit?: () => void;
  }
}

export interface SocialAuthUser {
  provider: 'Google' | 'Facebook';
  idToken?: string;
  accessToken?: string;
  providerSubject: string;
  providerEmail: string;
  fullName: string;
  avatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private googleInitialized = false;
  private facebookInitialized = false;

  readonly isGoogleConfigured = signal<boolean>(Boolean(environment.socialAuth?.googleClientId));
  readonly isFacebookConfigured = signal<boolean>(Boolean(environment.socialAuth?.facebookAppId));

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

  /**
   * Khởi tạo và mở cửa sổ đăng nhập Facebook OAuth (Facebook JavaScript SDK).
   * Mở native popup ủy quyền facebook.com trực tiếp trên màn hình người dùng.
   * Thu nhận accessToken và thông tin profile Graph API /me (name, email, picture).
   */
  async signInWithFacebook(): Promise<SocialAuthUser> {
    const appId = environment.socialAuth?.facebookAppId;
    if (!appId) {
      throw new Error('Facebook App ID chưa được cấu hình.');
    }

    await this.loadFacebookScript(appId);

    return new Promise((resolve, reject) => {
      try {
        const fb = typeof window !== 'undefined' ? window.FB : null;
        if (!fb) {
          throw new Error('Facebook SDK chưa sẵn sàng.');
        }

        fb.login((response: FacebookLoginResponse) => {
          if (response && response.authResponse) {
            const auth = response.authResponse;
            const accessToken = auth.accessToken || '';
            const userId = auth.userID || '';

            // Truy vấn thông tin profile từ Graph API v26.0
            fb.api('/me', { credentials: 'include', fields: 'id,name,email,picture.width(200)' }, (profile: FacebookProfileResponse) => {
              const email = profile?.email || `${userId}@facebook.com`;
              const name = profile?.name || 'Khách hàng Facebook';
              const avatar = profile?.picture?.data?.url;

              resolve({
                provider: 'Facebook',
                accessToken,
                providerSubject: userId,
                providerEmail: email,
                fullName: name,
                avatarUrl: avatar
              });
            });
          } else {
            reject(new Error('Người dùng đã hủy hoặc đóng cửa sổ đăng nhập Facebook.'));
          }
        }, {
          scope: 'email,public_profile',
          return_scopes: true
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private loadGoogleScript(): Promise<void> {
    if (this.googleInitialized && typeof window !== 'undefined' && window.google) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve();
        return;
      }

      if (document.getElementById('google-jssdk')) {
        this.googleInitialized = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.googleInitialized = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK (có thể do tiện ích chặn quảng cáo).'));
      document.head.appendChild(script);
    });
  }

  private loadFacebookScript(appId: string): Promise<void> {
    if (this.facebookInitialized && typeof window !== 'undefined' && window.FB) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve();
        return;
      }

      if (document.getElementById('facebook-jssdk')) {
        if (window.FB) {
          this.facebookInitialized = true;
          resolve();
        } else {
          window.fbAsyncInit = () => {
            window.FB?.init({
              appId,
              cookie: true,
              xfbml: true,
              version: 'v26.0'
            });
            this.facebookInitialized = true;
            resolve();
          };
        }
        return;
      }

      window.fbAsyncInit = () => {
        window.FB?.init({
          appId,
          cookie: true,
          xfbml: true,
          version: 'v26.0'
        });
        this.facebookInitialized = true;
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/vi_VN/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Không thể tải Facebook JavaScript SDK (có thể do tiện ích chặn theo dõi).'));
      document.head.appendChild(script);
    });
  }
}
