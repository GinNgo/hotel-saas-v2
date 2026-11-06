import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  StaffMemberDto,
  AccessRoleDto,
  PermissionFunctionDto,
  RoleDetailDto,
  RolePermissionDto,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateStaffMemberRequest,
  UpdateStaffMemberRequest,
  StaffRole
} from '../models/staff.model';
import { ApiResponse, PagedResult } from '../models/api-response.model';
import {
  getVietnameseFunctionName,
  localizePermissionFunction,
  localizeRoleDetail,
  VIETNAMESE_ROLE_META
} from '../../features/staff/roles-management.utils';

export interface GetStaffFilter {
  search?: string;
  propertyId?: string;
  staffRole?: StaffRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

const CUSTOM_ROLES_STORAGE_KEY = 'hotel_saas_custom_roles_v1';
const STAFF_ROLE_OVERRIDES_KEY = 'hotel_saas_staff_role_overrides_v1';

const DEFAULT_PERMISSION_FUNCTIONS: PermissionFunctionDto[] = [
  { id: 'f0000001-0000-0000-0000-000000000001', code: 'DASHBOARD', name: 'Bảng điều khiển & Tổng quan', moduleCode: 'DASHBOARD', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000002', code: 'PROPERTIES', name: 'Quản lý Cơ sở & Chi nhánh', moduleCode: 'PROPERTIES', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000003', code: 'ROOMS', name: 'Quản lý Sơ đồ & Phòng lưu trú', moduleCode: 'ROOMS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000004', code: 'ROOM_TYPES', name: 'Hạng phòng & Biểu giá (Rates)', moduleCode: 'ROOMS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000005', code: 'RESERVATIONS', name: 'Quản lý Đặt phòng & Lưu trú', moduleCode: 'RESERVATIONS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000006', code: 'CHECK_IN_OUT', name: 'Nghiệp vụ Nhận / Trả phòng (Check-in/out)', moduleCode: 'RESERVATIONS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000007', code: 'HOUSEKEEPING', name: 'Điều phối Buồng phòng & Vệ sinh', moduleCode: 'HOUSEKEEPING', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000008', code: 'PAYMENTS', name: 'Thu ngân & Giao dịch Thanh toán', moduleCode: 'PAYMENTS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000009', code: 'INVOICES', name: 'Quản lý Hóa đơn & Công nợ Folio', moduleCode: 'PAYMENTS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000010', code: 'GUESTS', name: 'Hồ sơ Khách hàng (CRM)', moduleCode: 'GUESTS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000011', code: 'REVIEWS', name: 'Đánh giá & Phản hồi Khách lưu trú', moduleCode: 'REVIEWS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000012', code: 'STAFF', name: 'Quản lý Hồ sơ Nhân sự', moduleCode: 'STAFF', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000013', code: 'ROLES', name: 'Quản trị Vai trò & Cấp quyền (RBAC)', moduleCode: 'STAFF', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000014', code: 'REPORTS', name: 'Báo cáo Doanh thu & Thống kê', moduleCode: 'REPORTS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000015', code: 'PROMOTIONS', name: 'Chương trình Khuyến mãi & Voucher', moduleCode: 'PROMOTIONS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000016', code: 'SUBSCRIPTIONS', name: 'Gói cước SaaS & Hợp đồng Nền tảng', moduleCode: 'SUBSCRIPTIONS', supportedActionMask: 15 },
  { id: 'f0000001-0000-0000-0000-000000000017', code: 'SETTINGS', name: 'Cấu hình Hệ thống & Mẫu in', moduleCode: 'SETTINGS', supportedActionMask: 15 }
];

function buildDefaultPermissions(codes: string[], mask: number): RolePermissionDto[] {
  return DEFAULT_PERMISSION_FUNCTIONS
    .filter(f => codes.includes('*') || codes.includes(f.code))
    .map(f => ({
      functionId: f.id,
      functionCode: f.code,
      functionName: f.name,
      moduleCode: f.moduleCode,
      actionMask: mask,
      canRead: (mask & 1) !== 0,
      canCreate: (mask & 2) !== 0,
      canUpdate: (mask & 4) !== 0,
      canDelete: (mask & 8) !== 0,
      canApprove: false,
      canExport: false
    }));
}

const DEFAULT_SYSTEM_ROLES: RoleDetailDto[] = [
  {
    id: 'r0000001-0000-0000-0000-000000000001',
    code: 'OWNER',
    name: 'Chủ cơ sở (Owner)',
    description: 'Toàn quyền quản trị hệ thống chuỗi khách sạn, cấu hình chi nhánh, gói cước và phân quyền nhân sự.',
    isSystemRole: true,
    staffCount: 1,
    permissions: buildDefaultPermissions(['*'], 15)
  },
  {
    id: 'r0000001-0000-0000-0000-000000000002',
    code: 'MANAGER',
    name: 'Quản lý chi nhánh (Manager)',
    description: 'Quản lý vận hành chi nhánh, điều phối phòng, duyệt giá, theo dõi báo cáo doanh thu và phân công nhân sự.',
    isSystemRole: true,
    staffCount: 2,
    permissions: buildDefaultPermissions(
      ['DASHBOARD', 'PROPERTIES', 'ROOMS', 'ROOM_TYPES', 'RESERVATIONS', 'CHECK_IN_OUT', 'HOUSEKEEPING', 'PAYMENTS', 'INVOICES', 'GUESTS', 'REVIEWS', 'STAFF', 'REPORTS', 'PROMOTIONS'],
      15
    )
  },
  {
    id: 'r0000001-0000-0000-0000-000000000003',
    code: 'RECEPTIONIST',
    name: 'Lễ tân & Thu ngân (Receptionist)',
    description: 'Tiếp đón khách, xử lý đặt phòng, thực hiện thủ tục Check-in / Check-out và lập hóa đơn thanh toán.',
    isSystemRole: true,
    staffCount: 3,
    permissions: buildDefaultPermissions(
      ['DASHBOARD', 'ROOMS', 'ROOM_TYPES', 'RESERVATIONS', 'CHECK_IN_OUT', 'PAYMENTS', 'INVOICES', 'GUESTS'],
      7
    )
  },
  {
    id: 'r0000001-0000-0000-0000-000000000004',
    code: 'HOUSEKEEPER',
    name: 'Buồng phòng (Housekeeper)',
    description: 'Cập nhật trạng thái dọn phòng, kiểm tra minibar, ghi nhận bảo trì và vệ sinh buồng phòng.',
    isSystemRole: true,
    staffCount: 2,
    permissions: buildDefaultPermissions(['DASHBOARD', 'ROOMS', 'HOUSEKEEPING'], 5)
  },
  {
    id: 'r0000001-0000-0000-0000-000000000005',
    code: 'ACCOUNTANT',
    name: 'Kế toán nội bộ (Accountant)',
    description: 'Kiểm soát thu chi, đối soát giao dịch thanh toán, quản lý hóa đơn VAT và xuất báo cáo tài chính.',
    isSystemRole: false,
    staffCount: 1,
    permissions: buildDefaultPermissions(['DASHBOARD', 'RESERVATIONS', 'PAYMENTS', 'INVOICES', 'REPORTS'], 7)
  }
];

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/staff';
  private cachedFunctions: PermissionFunctionDto[] = [...DEFAULT_PERMISSION_FUNCTIONS];
  private cachedSystemRoles: RoleDetailDto[] = [...DEFAULT_SYSTEM_ROLES];

  private loadLocalCustomRoles(): RoleDetailDto[] {
    try {
      const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RoleDetailDto[];
    } catch {
      return [];
    }
  }

  private saveLocalCustomRoles(roles: RoleDetailDto[]): void {
    try {
      localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(roles));
    } catch {
      // Ignore storage errors
    }
  }

  private loadStaffRoleOverrides(): Record<string, { roleId: string; roleCode: string; roleName: string }> {
    try {
      const raw = localStorage.getItem(STAFF_ROLE_OVERRIDES_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, { roleId: string; roleCode: string; roleName: string }>;
    } catch {
      return {};
    }
  }

  private saveStaffRoleOverride(key: string, role: { roleId: string; roleCode: string; roleName: string }): void {
    try {
      const current = this.loadStaffRoleOverrides();
      current[key] = role;
      localStorage.setItem(STAFF_ROLE_OVERRIDES_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage errors
    }
  }

  private normalizePermissions(perms: RolePermissionDto[]): RolePermissionDto[] {
    return perms.map(p => ({
      ...p,
      functionName: getVietnameseFunctionName(p.functionCode, p.functionName),
      canRead: p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0,
      canCreate: p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0,
      canUpdate: p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0,
      canDelete: p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0,
      canApprove: p.canApprove !== undefined ? p.canApprove : (p.actionMask & 16) !== 0,
      canExport: p.canExport !== undefined ? p.canExport : (p.actionMask & 32) !== 0
    }));
  }

  private mergeRolesWithLocal(serverRoles: RoleDetailDto[]): RoleDetailDto[] {
    const normalizedServer = serverRoles.map(r =>
      localizeRoleDetail({
        ...r,
        permissions: this.normalizePermissions(r.permissions || [])
      })
    );
    const localRoles = this.loadLocalCustomRoles().map(r =>
      localizeRoleDetail({
        ...r,
        permissions: this.normalizePermissions(r.permissions || [])
      })
    );

    const merged = [...normalizedServer];
    for (const local of localRoles) {
      const existingIdx = merged.findIndex(
        r => r.id === local.id || r.code.toUpperCase() === local.code.toUpperCase()
      );
      if (existingIdx >= 0) {
        merged[existingIdx] = localizeRoleDetail({
          ...merged[existingIdx],
          name: local.name || merged[existingIdx].name,
          description: local.description ?? merged[existingIdx].description,
          isActive: local.isActive !== undefined ? local.isActive : merged[existingIdx].isActive ?? true,
          permissions: local.permissions
        });
      } else {
        merged.push({
          ...local,
          isActive: local.isActive !== false
        });
      }
    }
    return merged;
  }

  getStaffMembers(filter?: GetStaffFilter): Observable<PagedResult<StaffMemberDto>> {
    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search.trim());
    if (filter?.propertyId) params = params.set('propertyId', filter.propertyId);
    if (filter?.staffRole !== undefined) params = params.set('staffRole', filter.staffRole.toString());
    if (filter?.isActive !== undefined) params = params.set('isActive', filter.isActive.toString());
    if (filter?.page) params = params.set('page', filter.page.toString());
    if (filter?.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    const emptyPage: PagedResult<StaffMemberDto> = {
      items: [],
      totalCount: 0,
      page: filter?.page || 1,
      pageSize: filter?.pageSize || 20,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false
    };

    return this.http
      .get<ApiResponse<PagedResult<StaffMemberDto>>>(this.baseUrl, { params })
      .pipe(
        map(res => {
          const data = res.data || emptyPage;
          const overrides = this.loadStaffRoleOverrides();
          const items = (data.items || []).map(item => {
            const ov = overrides[item.id] || overrides[item.email.toLowerCase()];
            if (ov) {
              return {
                ...item,
                roleId: ov.roleId,
                roleCode: ov.roleCode,
                roleName: ov.roleName
              };
            }
            return item;
          });
          return { ...data, items };
        }),
        catchError(() => of(emptyPage))
      );
  }

  getRoles(): Observable<AccessRoleDto[]> {
    return this.http
      .get<ApiResponse<AccessRoleDto[]>>(`${this.baseUrl}/roles`)
      .pipe(
        map(res => {
          const serverList = (res.data && res.data.length > 0 ? res.data : this.cachedSystemRoles).map(r => {
            const meta = VIETNAMESE_ROLE_META[(r.code || '').toUpperCase()];
            return {
              ...r,
              name: meta ? meta.name : r.name,
              description: meta ? meta.description : r.description
            };
          });
          const localCustom = this.loadLocalCustomRoles();
          const merged: AccessRoleDto[] = [...serverList];
          for (const c of localCustom) {
            if (!merged.some(m => m.id === c.id || m.code.toUpperCase() === c.code.toUpperCase())) {
              merged.push({
                id: c.id,
                code: c.code,
                name: c.name,
                description: c.description,
                isSystemRole: false,
                staffCount: c.staffCount || 0
              });
            }
          }
          return merged;
        }),
        catchError(() => {
          const allDetailed = this.mergeRolesWithLocal(this.cachedSystemRoles);
          return of(
            allDetailed.map(c => ({
              id: c.id,
              code: c.code,
              name: c.name,
              description: c.description,
              isSystemRole: c.isSystemRole,
              staffCount: c.staffCount || 0
            }))
          );
        })
      );
  }

  getPermissionFunctions(): Observable<PermissionFunctionDto[]> {
    return this.http
      .get<ApiResponse<PermissionFunctionDto[]>>(`${this.baseUrl}/permissions/functions`)
      .pipe(
        map(res => {
          const raw = res.data && res.data.length > 0 ? res.data : DEFAULT_PERMISSION_FUNCTIONS;
          return raw.map(f => localizePermissionFunction(f));
        }),
        tap(funcs => {
          if (funcs.length > 0) {
            this.cachedFunctions = funcs;
          }
        }),
        catchError(() => of(this.cachedFunctions))
      );
  }

  getRolesWithPermissions(): Observable<RoleDetailDto[]> {
    return this.http
      .get<ApiResponse<RoleDetailDto[]>>(`${this.baseUrl}/roles/detailed`)
      .pipe(
        map(res => {
          const serverRoles = res.data || [];
          if (serverRoles.length > 0) {
            this.cachedSystemRoles = serverRoles;
          }
          return this.mergeRolesWithLocal(serverRoles.length > 0 ? serverRoles : this.cachedSystemRoles);
        }),
        catchError(() => of(this.mergeRolesWithLocal(this.cachedSystemRoles)))
      );
  }

  createRole(request: CreateRoleRequest): Observable<RoleDetailDto> {
    const normalizedCode = request.code.trim().toUpperCase();
    return this.http
      .post<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles`, request)
      .pipe(
        map(res => {
          const created = res.data!;
          return {
            ...created,
            permissions: this.normalizePermissions(created.permissions || [])
          };
        }),
        catchError(() => {
          const funcMap = new Map(this.cachedFunctions.map(f => [f.id, f]));
          const permissions: RolePermissionDto[] = [];

          for (const p of request.permissions) {
            const actionMask =
              (p.canRead ? 1 : 0) |
              (p.canCreate ? 2 : 0) |
              (p.canUpdate ? 4 : 0) |
              (p.canDelete ? 8 : 0) |
              (p.canApprove ? 16 : 0) |
              (p.canExport ? 32 : 0);

            if (actionMask <= 0) continue;

            const func = funcMap.get(p.functionId);
            permissions.push({
              functionId: p.functionId,
              functionCode: func?.code || 'MODULE',
              functionName: func?.name || 'Phân hệ',
              moduleCode: func?.moduleCode || 'GENERAL',
              actionMask,
              canRead: p.canRead,
              canCreate: p.canCreate,
              canUpdate: p.canUpdate,
              canDelete: p.canDelete,
              canApprove: !!p.canApprove,
              canExport: !!p.canExport
            });
          }

          const customRoles = this.loadLocalCustomRoles();
          const newRole: RoleDetailDto = {
            id: crypto.randomUUID ? crypto.randomUUID() : `role-${Date.now()}`,
            code: normalizedCode,
            name: request.name.trim(),
            description: request.description?.trim(),
            isSystemRole: false,
            isActive: request.isActive !== false,
            staffCount: 0,
            permissions
          };

          const existingIdx = customRoles.findIndex(r => r.code.toUpperCase() === normalizedCode);
          if (existingIdx >= 0) {
            customRoles[existingIdx] = newRole;
          } else {
            customRoles.push(newRole);
          }
          this.saveLocalCustomRoles(customRoles);
          return of(newRole);
        })
      );
  }

  private buildLocalUpdatedRole(id: string, request: UpdateRoleRequest): RoleDetailDto {
    const funcMap = new Map(this.cachedFunctions.map(f => [f.id, f]));
    const permissions: RolePermissionDto[] = [];

    for (const p of request.permissions) {
      const actionMask =
        (p.canRead ? 1 : 0) |
        (p.canCreate ? 2 : 0) |
        (p.canUpdate ? 4 : 0) |
        (p.canDelete ? 8 : 0) |
        (p.canApprove ? 16 : 0) |
        (p.canExport ? 32 : 0);

      if (actionMask <= 0) continue;

      const func = funcMap.get(p.functionId);
      permissions.push({
        functionId: p.functionId,
        functionCode: func?.code || 'MODULE',
        functionName: func?.name || 'Phân hệ',
        moduleCode: func?.moduleCode || 'GENERAL',
        actionMask,
        canRead: p.canRead,
        canCreate: p.canCreate,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
        canApprove: !!p.canApprove,
        canExport: !!p.canExport
      });
    }

    const customRoles = this.loadLocalCustomRoles();
    const idx = customRoles.findIndex(r => r.id === id);
    const serverMatch = this.cachedSystemRoles.find(r => r.id === id);
    const existing = idx >= 0
      ? customRoles[idx]
      : serverMatch || {
          id,
          code: 'CUSTOM_ROLE',
          name: request.name.trim(),
          isSystemRole: false,
          staffCount: 0,
          permissions: []
        };

    const updatedRole: RoleDetailDto = {
      ...existing,
      name: request.name.trim(),
      description: request.description?.trim(),
      isActive: request.isActive !== undefined ? request.isActive : existing.isActive !== false,
      permissions
    };

    if (idx >= 0) {
      customRoles[idx] = updatedRole;
    } else {
      customRoles.push(updatedRole);
    }
    this.saveLocalCustomRoles(customRoles);
    return updatedRole;
  }

  updateRole(id: string, request: UpdateRoleRequest): Observable<RoleDetailDto> {
    const isSystemRole = this.cachedSystemRoles.some(r => r.id === id && r.isSystemRole);
    const isLocalCustom = this.loadLocalCustomRoles().some(r => r.id === id);
    if (isSystemRole || isLocalCustom) {
      return of(this.buildLocalUpdatedRole(id, request));
    }

    return this.http
      .put<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles/${id}`, request)
      .pipe(
        map(res => {
          const updated = res.data!;
          return {
            ...updated,
            permissions: this.normalizePermissions(updated.permissions || [])
          };
        }),
        catchError(() => of(this.buildLocalUpdatedRole(id, request)))
      );
  }

  deleteRole(id: string): Observable<boolean> {
    const customRoles = this.loadLocalCustomRoles();
    const isLocalCustom = customRoles.some(r => r.id === id);
    if (isLocalCustom) {
      const filtered = customRoles.filter(r => r.id !== id);
      this.saveLocalCustomRoles(filtered);
      return of(true);
    }

    return this.http
      .delete<ApiResponse<unknown>>(`${this.baseUrl}/roles/${id}`)
      .pipe(
        map(res => res.success),
        catchError(() => {
          const filtered = this.loadLocalCustomRoles().filter(r => r.id !== id);
          this.saveLocalCustomRoles(filtered);
          return of(true);
        })
      );
  }

  createStaffMember(payload: CreateStaffMemberRequest): Observable<StaffMemberDto> {
    const customRoles = this.loadLocalCustomRoles();
    const matchedCustom = customRoles.find(r => r.id === payload.roleId);
    const requestPayload: CreateStaffMemberRequest = matchedCustom
      ? { ...payload, roleId: undefined }
      : payload;

    return this.http
      .post<ApiResponse<StaffMemberDto>>(this.baseUrl, requestPayload)
      .pipe(
        map(res => {
          const created = res.data!;
          if (matchedCustom) {
            this.saveStaffRoleOverride(created.id, {
              roleId: matchedCustom.id,
              roleCode: matchedCustom.code,
              roleName: matchedCustom.name
            });
            this.saveStaffRoleOverride(created.email.toLowerCase(), {
              roleId: matchedCustom.id,
              roleCode: matchedCustom.code,
              roleName: matchedCustom.name
            });
            return {
              ...created,
              roleId: matchedCustom.id,
              roleCode: matchedCustom.code,
              roleName: matchedCustom.name
            };
          }
          return created;
        })
      );
  }

  updateStaffMember(id: string, payload: UpdateStaffMemberRequest): Observable<StaffMemberDto> {
    const customRoles = this.loadLocalCustomRoles();
    const matchedCustom = customRoles.find(r => r.id === payload.roleId);
    const requestPayload: UpdateStaffMemberRequest = matchedCustom
      ? { ...payload, roleId: undefined }
      : payload;

    return this.http
      .put<ApiResponse<StaffMemberDto>>(`${this.baseUrl}/${id}`, requestPayload)
      .pipe(
        map(res => {
          const updated = res.data!;
          if (matchedCustom) {
            this.saveStaffRoleOverride(updated.id, {
              roleId: matchedCustom.id,
              roleCode: matchedCustom.code,
              roleName: matchedCustom.name
            });
            return {
              ...updated,
              roleId: matchedCustom.id,
              roleCode: matchedCustom.code,
              roleName: matchedCustom.name
            };
          }
          return updated;
        })
      );
  }

  deleteStaffMember(id: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.success));
  }
}
