import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  UserDto,
  UserMembershipDto,
  SwitchContextResponse
} from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<UserDto | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private membershipsSubject = new BehaviorSubject<UserMembershipDto[]>([]);
  memberships$ = this.membershipsSubject.asObservable();

  readonly activePropertyId = signal<string | null>(null);
  readonly activePropertyName = signal<string | null>(null);
  readonly activePropertyCode = signal<string | null>(null);
  readonly activeRoleName = signal<string | null>(null);

  constructor() {
    this.initializeUser();
  }

  get isLoggedIn(): boolean {
    return !!this.tokenStorage.getAccessToken() && !this.tokenStorage.isTokenExpired();
  }

  get currentUser(): UserDto | null {
    return this.currentUserSubject.value;
  }

  get memberships(): UserMembershipDto[] {
    return this.membershipsSubject.value;
  }

  get isTenantWide(): boolean {
    const decoded = this.tokenStorage.getDecodedToken();
    if (decoded?.scope === 'TenantWide') return true;
    return this.memberships.some(m => m.isTenantWide);
  }

  register(request: RegisterRequest): Observable<ApiResponse<RegisterResponse>> {
    return this.http.post<ApiResponse<RegisterResponse>>(`${this.apiUrl}/register`, request);
  }

  /**
   * Đăng nhập hệ thống:
   * Backend trả trực tiếp LoginResponse ở root: { accessToken, refreshToken, expiresAtUtc, user, memberships }
   * Hỗ trợ đồng thời cả format bọc ApiResponse<{...}> phòng hờ.
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<any>(`${this.apiUrl}/login`, request).pipe(
      map(res => {
        // Chuẩn hóa response payload
        const data: LoginResponse = res.accessToken ? res : res.data;
        return data;
      }),
      tap(data => {
        if (data?.accessToken) {
          this.tokenStorage.setTokens(data.accessToken, data.refreshToken);
          this.currentUserSubject.next(data.user);

          const memberships = data.memberships || [];
          this.tokenStorage.setMemberships(memberships);
          this.membershipsSubject.next(memberships);

          // Kiểm tra xem token đã có propertyId chưa (trường hợp user chỉ có 1 branch hoặc token đã gán)
          const decoded = this.tokenStorage.getDecodedToken();
          const propId = decoded?.propertyId || decoded?.pid;
          if (propId) {
            const matched = memberships.find(m => m.propertyId?.toLowerCase() === propId.toLowerCase());
            this.setActivePropertyContext(propId, matched?.propertyName, matched?.propertyCode, matched?.roleName);
          } else if (!memberships.some(m => !!m.propertyId)) {
            // Tải danh sách chi nhánh mở rộng (cho tài khoản Tenant-Wide)
            this.fetchMyMemberships().subscribe({
              next: (fullList) => {
                const branchMembers = fullList.filter(m => !!m.propertyId);
                if (branchMembers.length > 0 && !this.activePropertyId()) {
                  const defaultBranch = branchMembers[0];
                  this.setActivePropertyContext(defaultBranch.propertyId!, defaultBranch.propertyName, defaultBranch.propertyCode, defaultBranch.roleName);
                }
              },
              error: () => {}
            });
          }
        }
      })
    );
  }

  /**
   * Chuyển ngữ cảnh chi nhánh làm việc:
   * Gọi POST /api/auth/switch-context với { propertyId }
   * Cập nhật access token + refresh token mới, lưu active property và reload signal.
   */
  switchContext(propertyId: string): Observable<SwitchContextResponse> {
    return this.http.post<any>(`${this.apiUrl}/switch-context`, { propertyId }).pipe(
      map(res => {
        const payload: SwitchContextResponse = res.data ? res.data : res;
        return payload;
      }),
      tap(payload => {
        if (payload?.accessToken) {
          this.tokenStorage.setTokens(payload.accessToken, payload.refreshToken);

          // Tìm tên và mã chi nhánh từ memberships
          const matched = this.memberships.find(m => m.propertyId?.toLowerCase() === propertyId.toLowerCase());
          const propName = matched?.propertyName || 'Chi nhánh ' + (matched?.propertyCode || '');
          const propCode = matched?.propertyCode || '';
          const roleName = payload.currentContext?.roleName || matched?.roleName || '';

          this.setActivePropertyContext(propertyId, propName, propCode, roleName);
        }
      })
    );
  }

  /**
   * Lấy danh sách memberships của user hiện tại từ GET /api/auth/me/memberships
   */
  fetchMyMemberships(): Observable<UserMembershipDto[]> {
    return this.http.get<any>(`${this.apiUrl}/me/memberships`).pipe(
      map(res => {
        const list: UserMembershipDto[] = Array.isArray(res) ? res : (res.data || []);
        return list;
      }),
      tap(list => {
        this.tokenStorage.setMemberships(list);
        this.membershipsSubject.next(list);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const request: RefreshTokenRequest = {
      accessToken: this.tokenStorage.getAccessToken() || '',
      refreshToken: this.tokenStorage.getRefreshToken() || ''
    };
    return this.http.post<any>(`${this.apiUrl}/refresh-token`, request).pipe(
      map(res => (res.accessToken ? res : res.data) as LoginResponse),
      tap(data => {
        if (data?.accessToken) {
          this.tokenStorage.setTokens(data.accessToken, data.refreshToken);
          this.currentUserSubject.next(data.user);
        }
      })
    );
  }

  logout(): void {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/revoke-token`, { refreshToken }).subscribe({
        error: () => { /* Không chặn logout nếu revoke lỗi */ }
      });
    }
    this.tokenStorage.clearTokens();
    this.currentUserSubject.next(null);
    this.membershipsSubject.next([]);
    this.activePropertyId.set(null);
    this.activePropertyName.set(null);
    this.activePropertyCode.set(null);
    this.activeRoleName.set(null);
    this.router.navigate(['/login']);
  }

  /** Khởi tạo user và context từ token/storage khi app reload */
  initializeUser(): void {
    const decoded = this.tokenStorage.getDecodedToken();
    if (decoded && !this.tokenStorage.isTokenExpired()) {
      this.currentUserSubject.next({
        id: decoded.sub,
        email: decoded.email,
        fullName: decoded.fullName,
        globalRole: decoded.globalRole,
        tenantId: decoded.tenantId || null
      });

      const cachedMemberships = this.tokenStorage.getMemberships();
      this.membershipsSubject.next(cachedMemberships);

      const savedPropId = this.tokenStorage.getActivePropertyId();
      if (savedPropId) {
        const matched = cachedMemberships.find(m => m.propertyId?.toLowerCase() === savedPropId.toLowerCase());
        const propName = this.tokenStorage.getActivePropertyName() || matched?.propertyName || 'Chi nhánh ' + (matched?.propertyCode || '');
        const propCode = this.tokenStorage.getActivePropertyCode() || matched?.propertyCode || '';
        this.activePropertyId.set(savedPropId);
        this.activePropertyName.set(propName);
        this.activePropertyCode.set(propCode);
        this.activeRoleName.set(matched?.roleName || null);
      }

      // Nếu cached memberships chưa có chi nhánh cụ thể, làm mới từ API
      if (!cachedMemberships.some(m => !!m.propertyId)) {
        this.fetchMyMemberships().subscribe({
          next: (fullList) => {
            const branchMembers = fullList.filter(m => !!m.propertyId);
            if (branchMembers.length > 0 && !this.activePropertyId()) {
              const defaultBranch = branchMembers[0];
              this.setActivePropertyContext(defaultBranch.propertyId!, defaultBranch.propertyName, defaultBranch.propertyCode, defaultBranch.roleName);
            }
          },
          error: () => {}
        });
      }
    }
  }

  hasPermission(functionCode: string, action: number = 1): boolean {
    return this.tokenStorage.hasPermission(functionCode, action);
  }

  setActivePropertyContext(propertyId: string, propertyName?: string | null, propertyCode?: string | null, roleName?: string | null): void {
    this.tokenStorage.setActiveProperty(propertyId, propertyName, propertyCode);
    this.activePropertyId.set(propertyId);
    this.activePropertyName.set(propertyName || null);
    this.activePropertyCode.set(propertyCode || null);
    if (roleName) {
      this.activeRoleName.set(roleName);
    }
  }
}
