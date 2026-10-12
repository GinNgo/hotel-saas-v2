import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { UserMembershipDto } from '../models/auth.model';

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  globalRole: string;
  tenantId?: string;
  propertyId?: string;
  pid?: string;
  scope?: string;
  roleName?: string;
  permissions?: string;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly ACCESS_TOKEN_KEY = 'hotel_saas_access_token';
  private readonly REFRESH_TOKEN_KEY = 'hotel_saas_refresh_token';
  private readonly ACTIVE_PROPERTY_ID_KEY = 'hotel_saas_active_property_id';
  private readonly ACTIVE_PROPERTY_NAME_KEY = 'hotel_saas_active_property_name';
  private readonly ACTIVE_PROPERTY_CODE_KEY = 'hotel_saas_active_property_code';
  private readonly MEMBERSHIPS_KEY = 'hotel_saas_memberships';

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.ACTIVE_PROPERTY_ID_KEY);
    localStorage.removeItem(this.ACTIVE_PROPERTY_NAME_KEY);
    localStorage.removeItem(this.ACTIVE_PROPERTY_CODE_KEY);
    localStorage.removeItem(this.MEMBERSHIPS_KEY);
  }

  getActivePropertyId(): string | null {
    const stored = localStorage.getItem(this.ACTIVE_PROPERTY_ID_KEY);
    if (stored) return stored;
    // Fallback to token claim if present
    const decoded = this.getDecodedToken();
    return decoded?.propertyId || decoded?.pid || null;
  }

  getActivePropertyName(): string | null {
    return localStorage.getItem(this.ACTIVE_PROPERTY_NAME_KEY);
  }

  getActivePropertyCode(): string | null {
    return localStorage.getItem(this.ACTIVE_PROPERTY_CODE_KEY);
  }

  setActiveProperty(propertyId: string, propertyName?: string | null, propertyCode?: string | null): void {
    localStorage.setItem(this.ACTIVE_PROPERTY_ID_KEY, propertyId);
    if (propertyName) {
      localStorage.setItem(this.ACTIVE_PROPERTY_NAME_KEY, propertyName);
    }
    if (propertyCode) {
      localStorage.setItem(this.ACTIVE_PROPERTY_CODE_KEY, propertyCode);
    }
  }

  clearActiveProperty(): void {
    localStorage.removeItem(this.ACTIVE_PROPERTY_ID_KEY);
    localStorage.removeItem(this.ACTIVE_PROPERTY_NAME_KEY);
    localStorage.removeItem(this.ACTIVE_PROPERTY_CODE_KEY);
  }

  getMemberships(): UserMembershipDto[] {
    const raw = localStorage.getItem(this.MEMBERSHIPS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as UserMembershipDto[];
    } catch {
      return [];
    }
  }

  setMemberships(memberships: UserMembershipDto[]): void {
    localStorage.setItem(this.MEMBERSHIPS_KEY, JSON.stringify(memberships));
  }

  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  getDecodedToken(): JwtPayload | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  getUserPermissions(): string[] {
    const decoded = this.getDecodedToken();
    if (!decoded?.permissions) return [];
    try {
      return JSON.parse(decoded.permissions);
    } catch {
      return [];
    }
  }

  hasPermission(functionCode: string, action: number): boolean {
    const decoded = this.getDecodedToken();
    if (decoded?.globalRole === 'SuperAdmin') return true;

    const permissions = this.getUserPermissions();
    return permissions.some(p => {
      const [code, mask] = p.split(':');
      return code === functionCode && (parseInt(mask, 10) & action) === action;
    });
  }
}
