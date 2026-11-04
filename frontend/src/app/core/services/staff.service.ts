import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  StaffMemberDto,
  AccessRoleDto,
  PermissionFunctionDto,
  RoleDetailDto,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateStaffMemberRequest,
  UpdateStaffMemberRequest,
  StaffRole
} from '../models/staff.model';
import { ApiResponse, PagedResult } from '../models/api-response.model';

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

  getStaffMembers(filter?: GetStaffFilter): Observable<PagedResult<StaffMemberDto>> {
    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search.trim());
    if (filter?.propertyId) params = params.set('propertyId', filter.propertyId);
    if (filter?.staffRole !== undefined) params = params.set('staffRole', filter.staffRole.toString());
    if (filter?.isActive !== undefined) params = params.set('isActive', filter.isActive.toString());
    if (filter?.page) params = params.set('page', filter.page.toString());
    if (filter?.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    return this.http
      .get<ApiResponse<PagedResult<StaffMemberDto>>>(this.baseUrl, { params })
      .pipe(map(res => res.data || { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0, hasPreviousPage: false, hasNextPage: false }));
  }

  getRoles(): Observable<AccessRoleDto[]> {
    return this.http
      .get<ApiResponse<AccessRoleDto[]>>(`${this.baseUrl}/roles`)
      .pipe(map(res => res.data || []));
  }

  getPermissionFunctions(): Observable<PermissionFunctionDto[]> {
    return this.http
      .get<ApiResponse<PermissionFunctionDto[]>>(`${this.baseUrl}/permissions/functions`)
      .pipe(map(res => res.data || []));
  }

  getRolesWithPermissions(): Observable<RoleDetailDto[]> {
    return this.http
      .get<ApiResponse<RoleDetailDto[]>>(`${this.baseUrl}/roles/detailed`)
      .pipe(map(res => res.data || []));
  }

  createRole(request: CreateRoleRequest): Observable<RoleDetailDto> {
    return this.http
      .post<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles`, request)
      .pipe(map(res => res.data!));
  }

  updateRole(id: string, request: UpdateRoleRequest): Observable<RoleDetailDto> {
    return this.http
      .put<ApiResponse<RoleDetailDto>>(`${this.baseUrl}/roles/${id}`, request)
      .pipe(map(res => res.data!));
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
