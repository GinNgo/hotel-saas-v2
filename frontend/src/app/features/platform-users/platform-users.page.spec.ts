import '@angular/compiler';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { BehaviorSubject, of } from 'rxjs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformUsersPage } from './platform-users.page';
import {
  PlatformGovernanceService,
  PlatformUserDto,
  PlatformUsersResponseDto
} from '../../core/services/platform-governance.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { UserDto } from '../../core/models/auth.model';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  Object.assign(globalThis, {
    window: browser.window,
    document: browser.window.document,
    HTMLElement: browser.window.HTMLElement,
    Node: browser.window.Node,
    Event: browser.window.Event,
    CustomEvent: browser.window.CustomEvent,
    EventTarget: browser.window.EventTarget,
    MutationObserver: browser.window.MutationObserver
  });
}

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('PlatformUsersPage — SuperAdmin Platform Users & Admin Management', () => {
  let fixture: ComponentFixture<PlatformUsersPage>;
  let component: PlatformUsersPage;

  const loggedInSuperAdmin: UserDto = {
    id: 'admin-self-001',
    email: 'root@hotelsaas.vn',
    fullName: 'Root SuperAdmin',
    globalRole: 'SuperAdmin',
    tenantId: null
  };

  const sampleUsers: PlatformUserDto[] = [
    {
      id: 'admin-self-001',
      email: 'root@hotelsaas.vn',
      username: 'root.admin',
      fullName: 'Root SuperAdmin',
      phoneNumber: '0901000111',
      globalRole: 'SuperAdmin',
      globalRoleName: 'Quản trị nền tảng (SuperAdmin)',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      defaultTenantId: null,
      defaultTenantName: null,
      membershipsCount: 0,
      createdAtUtc: '2026-10-01T08:00:00Z'
    },
    {
      id: 'staff-owner-002',
      email: 'owner@saigonhotel.vn',
      username: 'saigon.owner',
      fullName: 'Trần Minh Chủ Chuỗi',
      phoneNumber: '0909222333',
      globalRole: 'TenantStaff',
      globalRoleName: 'Chủ cơ sở & Nhân sự',
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      defaultTenantId: 'tenant-ghg',
      defaultTenantName: 'Golden Hospitality Group',
      membershipsCount: 2,
      createdAtUtc: '2026-10-05T09:30:00Z'
    },
    {
      id: 'customer-003',
      email: 'guest@gmail.com',
      username: 'guest.b2c',
      fullName: 'Lê Thu Khách Hàng',
      phoneNumber: null,
      globalRole: 'Customer',
      globalRoleName: 'Khách hàng B2C',
      isActive: false,
      emailVerified: false,
      phoneVerified: false,
      defaultTenantId: null,
      defaultTenantName: null,
      membershipsCount: 0,
      createdAtUtc: '2026-10-10T14:15:00Z'
    }
  ];

  const sampleResponse: PlatformUsersResponseDto = {
    summary: {
      totalUsers: 18,
      superAdminCount: 2,
      tenantStaffCount: 7,
      customerCount: 9,
      activeCount: 16,
      lockedCount: 2
    },
    items: sampleUsers,
    totalCount: 3,
    page: 1,
    pageSize: 50
  };

  let getPlatformUsersSpy: ReturnType<typeof vi.fn>;
  let createPlatformAdminSpy: ReturnType<typeof vi.fn>;
  let togglePlatformUserStatusSpy: ReturnType<typeof vi.fn>;
  let updatePlatformUserRoleSpy: ReturnType<typeof vi.fn>;
  let alertSuccessSpy: ReturnType<typeof vi.fn>;
  let alertErrorSpy: ReturnType<typeof vi.fn>;
  let alertConfirmSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getPlatformUsersSpy = vi.fn(() => of(sampleResponse));
    createPlatformAdminSpy = vi.fn(() =>
      of({
        ...sampleUsers[0],
        id: 'admin-new-004',
        email: 'ops.admin@hotelsaas.vn',
        username: 'ops.admin',
        fullName: 'Ops SuperAdmin'
      })
    );
    togglePlatformUserStatusSpy = vi.fn(() =>
      of({ ...sampleUsers[1], isActive: false })
    );
    updatePlatformUserRoleSpy = vi.fn(() =>
      of({ ...sampleUsers[2], globalRole: 'SuperAdmin', globalRoleName: 'Quản trị nền tảng (SuperAdmin)' })
    );

    alertSuccessSpy = vi.fn();
    alertErrorSpy = vi.fn();
    alertConfirmSpy = vi.fn(() => Promise.resolve(true));

    const currentUserSubject = new BehaviorSubject<UserDto | null>(loggedInSuperAdmin);

    await TestBed.configureTestingModule({
      imports: [PlatformUsersPage],
      providers: [
        {
          provide: PlatformGovernanceService,
          useValue: {
            getPlatformUsers: getPlatformUsersSpy,
            createPlatformAdmin: createPlatformAdminSpy,
            togglePlatformUserStatus: togglePlatformUserStatusSpy,
            updatePlatformUserRole: updatePlatformUserRoleSpy
          }
        },
        {
          provide: AlertService,
          useValue: {
            success: alertSuccessSpy,
            error: alertErrorSpy,
            confirmAction: alertConfirmSpy
          }
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: loggedInSuperAdmin,
            currentUser$: currentUserSubject.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformUsersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('1. mounts and loads platform users and renders KPI counts', () => {
    expect(getPlatformUsersSpy).toHaveBeenCalledTimes(1);
    expect(component.users().length).toBe(3);
    expect(component.summary().totalUsers).toBe(18);
    expect(component.summary().superAdminCount).toBe(2);
    expect(component.summary().tenantStaffCount).toBe(7);
    expect(component.summary().customerCount).toBe(9);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quản trị Người dùng & Tài khoản Admin');
    expect(text).toContain('18');
    expect(text).toContain('Golden Hospitality Group');
  });

  it('2. filters platform users by role and search keyword', () => {
    getPlatformUsersSpy.mockClear();

    component.searchKeyword.set('saigon');
    component.onRoleFilterChange('TenantStaff');

    expect(getPlatformUsersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'saigon',
        role: 'TenantStaff',
        isActive: null,
        page: 1,
        pageSize: 50
      })
    );

    getPlatformUsersSpy.mockClear();
    component.onStatusFilterChange('LOCKED');
    expect(getPlatformUsersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'saigon',
        role: 'TenantStaff',
        isActive: false,
        page: 1
      })
    );
  });

  it('3. opens modal, validates form fields, and calls createPlatformAdmin on valid submit', () => {
    const openBtn = fixture.nativeElement.querySelector(
      '[data-testid="open-create-admin-btn"]'
    ) as HTMLButtonElement | null;
    expect(openBtn).not.toBeNull();
    openBtn?.click();
    fixture.detectChanges();

    expect(component.showCreateModal()).toBe(true);
    expect(component.createAdminForm.valid).toBe(false);

    // Invalid submit should mark touched and NOT call API
    component.createAdminForm.patchValue({
      fullName: 'Ops SuperAdmin',
      email: 'bad-email',
      password: 'short'
    });
    component.submitCreateAdmin();
    expect(createPlatformAdminSpy).not.toHaveBeenCalled();

    // Valid submit should call createPlatformAdmin, close modal, notify success, and reload users
    getPlatformUsersSpy.mockClear();
    component.createAdminForm.patchValue({
      fullName: 'Ops SuperAdmin',
      email: 'ops.admin@hotelsaas.vn',
      phoneNumber: '0912345678',
      password: 'StrongPassword123!'
    });
    expect(component.createAdminForm.valid).toBe(true);

    component.submitCreateAdmin();
    expect(createPlatformAdminSpy).toHaveBeenCalledWith({
      fullName: 'Ops SuperAdmin',
      email: 'ops.admin@hotelsaas.vn',
      phoneNumber: '0912345678',
      password: 'StrongPassword123!'
    });
    expect(component.showCreateModal()).toBe(false);
    expect(alertSuccessSpy).toHaveBeenCalled();
    expect(getPlatformUsersSpy).toHaveBeenCalledTimes(1);
  });

  it('4. disables self-lock and role-change buttons for current logged-in SuperAdmin', async () => {
    const selfLockBtn = fixture.nativeElement.querySelector(
      '[data-testid="toggle-status-btn-admin-self-001"]'
    ) as HTMLButtonElement | null;
    const selfRoleBtn = fixture.nativeElement.querySelector(
      '[data-testid="change-role-btn-admin-self-001"]'
    ) as HTMLButtonElement | null;
    const otherLockBtn = fixture.nativeElement.querySelector(
      '[data-testid="toggle-status-btn-staff-owner-002"]'
    ) as HTMLButtonElement | null;
    const otherRoleBtn = fixture.nativeElement.querySelector(
      '[data-testid="change-role-btn-staff-owner-002"]'
    ) as HTMLButtonElement | null;

    expect(selfLockBtn).not.toBeNull();
    expect(selfRoleBtn).not.toBeNull();
    expect(selfLockBtn?.disabled).toBe(true);
    expect(selfRoleBtn?.disabled).toBe(true);

    expect(otherLockBtn?.disabled).toBe(false);
    expect(otherRoleBtn?.disabled).toBe(false);

    // Direct method guard also prevents self-lock / self-role-change
    await component.toggleUserStatus(sampleUsers[0]);
    await component.changeUserRole(sampleUsers[0]);
    expect(togglePlatformUserStatusSpy).not.toHaveBeenCalled();
    expect(updatePlatformUserRoleSpy).not.toHaveBeenCalled();
  });

  it('5. renders responsive md:hidden mobile cards with >=44px action targets and self-action protection', async () => {
    const mobileList = fixture.nativeElement.querySelector(
      '[data-testid="platform-users-mobile-cards"]'
    ) as HTMLElement | null;
    expect(mobileList).not.toBeNull();
    expect(mobileList?.className).toContain('md:hidden');

    const cards = mobileList?.querySelectorAll('article') ?? [];
    expect(cards.length).toBe(3);

    const mobileText = mobileList?.textContent ?? '';
    expect(mobileText).toContain('Root SuperAdmin');
    expect(mobileText).toContain('owner@saigonhotel.vn');
    expect(mobileText).toContain('Golden Hospitality Group');
    expect(mobileText).toContain('guest@gmail.com');

    const selfMobileLock = mobileList?.querySelector(
      '[data-testid="mobile-toggle-status-btn-admin-self-001"]'
    ) as HTMLButtonElement | null;
    const otherMobileLock = mobileList?.querySelector(
      '[data-testid="mobile-toggle-status-btn-staff-owner-002"]'
    ) as HTMLButtonElement | null;
    const otherMobileRole = mobileList?.querySelector(
      '[data-testid="mobile-change-role-btn-customer-003"]'
    ) as HTMLButtonElement | null;

    expect(selfMobileLock?.disabled).toBe(true);
    expect(otherMobileLock?.disabled).toBe(false);
    expect(otherMobileLock?.className).toContain('min-h-11');
    expect(otherMobileRole?.className).toContain('min-h-11');

    otherMobileLock?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(alertConfirmSpy).toHaveBeenCalledTimes(1);
    expect(togglePlatformUserStatusSpy).toHaveBeenCalledWith('staff-owner-002', expect.objectContaining({ targetIsActive: false }));
  });
});
