import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/staff';

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
      .pipe(map(res => res.data || emptyPage));
  }

  getRoles(): Observable<AccessRoleDto[]> {
    return this.http
      .get<ApiResponse<AccessRoleDto[]>>(`${this.baseUrl}/roles`)
      .pipe(
        map(res =>
          (res.data || []).map(r => {
            const meta = VIETNAMESE_ROLE_META[(r.code || '').toUpperCase()];
            return {
              ...r,
              name: meta ? meta.name : r.name,
              description: meta ? meta.description : r.description
            };
          })
        )
      );
  }

  getPermissionFunctions(): Observable<PermissionFunctionDto[]> {
    return this.http
      .get<ApiResponse<PermissionFunctionDto[]>>(`${this.baseUrl}/permissions/functions`)
      .pipe(map(res => (res.data || []).map(f => localizePermissionFunction(f))));
  }

  getRolesWithPermissions(): Observable<RoleDetailDto[]> {
    return this.http
      .get<ApiResponse<RoleDetailDto[]>>(`${this.baseUrl}/roles/detailed`)
      .pipe(
        map(res =>
          (res.data || []).map(r =>
            localizeRoleDetail({
              ...r,
              permissions: this.normalizePermissions(r.permissions || [])
            })
          )
        )
      );
  }

  createRole(request: CreateRoleRequest): Observable<RoleDetailDto> {
    return this.http
      .post<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles`, request)
      .pipe(
        map(res => {
          const created = res.data!;
          return localizeRoleDetail({
            ...created,
            permissions: this.normalizePermissions(created.permissions || [])
          });
        })
      );
  }

  updateRole(id: string, request: UpdateRoleRequest): Observable<RoleDetailDto> {
    return this.http
      .put<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles/${id}`, request)
      .pipe(
        map(res => {
          const updated = res.data!;
          return localizeRoleDetail({
            ...updated,
            permissions: this.normalizePermissions(updated.permissions || [])
          });
        })
      );
  }

  deleteRole(id: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.baseUrl}/roles/${id}`)
      .pipe(map(res => res.success));
  }

  createStaffMember(payload: CreateStaffMemberRequest): Observable<StaffMemberDto> {
    return this.http
      .post<ApiResponse<StaffMemberDto>>(this.baseUrl, payload)
      .pipe(map(res => res.data!));
  }

  updateStaffMember(id: string, payload: UpdateStaffMemberRequest): Observable<StaffMemberDto> {
    return this.http
      .put<ApiResponse<StaffMemberDto>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map(res => res.data!));
  }

  deleteStaffMember(id: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.success));
  }
}
