import '@angular/compiler';
import { Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

describe('Guest session initialization', () => {
  function create(role: string) {
    const http = { get: vi.fn().mockReturnValue(of([])), post: vi.fn().mockReturnValue(of({
      accessToken: 'guest-token', refreshToken: 'refresh',
      user: { id: 'guest', email: 'guest@example.test', fullName: 'Guest', globalRole: role, tenantId: null },
      memberships: []
    })) };
    const tokens = {
      getDecodedToken: () => ({ sub: 'guest', email: 'guest@example.test', fullName: 'Guest', globalRole: role }),
      isTokenExpired: () => false,
      getMemberships: () => [], getActivePropertyId: () => 'old-staff-property',
      getActivePropertyName: () => 'Old property', getActivePropertyCode: () => 'OLD',
      setTokens: vi.fn(), setMemberships: vi.fn(), clearActiveProperty: vi.fn()
    };
    const injector = Injector.create({ providers: [AuthService,
      { provide: HttpClient, useValue: http },
      { provide: TokenStorageService, useValue: tokens },
      { provide: Router, useValue: { navigate: vi.fn() } }
    ] });
    return { service: injector.get(AuthService), http, tokens };
  }

  it.each(['Customer', 'Guest'])('does not restore staff context or request memberships for %s', role => {
    const { service, http } = create(role);
    expect(service.activePropertyId()).toBeNull();
    expect(http.get).not.toHaveBeenCalled();
  });

  it('does not request staff memberships after customer password login', () => {
    const { service, http, tokens } = create('Customer');
    http.get.mockClear();
    service.activePropertyId.set('old-staff-property');
    service.login({ email: 'guest@example.test', password: 'synthetic' }).subscribe();
    expect(http.get).not.toHaveBeenCalled();
    expect(service.activePropertyId()).toBeNull();
    expect(tokens.clearActiveProperty).toHaveBeenCalled();
  });

  it('preserves staff context initialization', () => {
    const { service } = create('TenantStaff');
    expect(service.activePropertyId()).toBe('old-staff-property');
  });
});
