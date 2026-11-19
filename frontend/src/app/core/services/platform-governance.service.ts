import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface PlatformTenantBranchDto {
  id: string;
  name: string;
  code: string;
  slug: string;
  city: string;
  status: string | number;
  isPublished: boolean;
  roomCount: number;
  createdAtUtc: string;
}

export interface PlatformTenantDto {
  id: string;
  name: string;
  code: string;
  slug: string;
  city: string;
  phoneNumber?: string | null;
  email?: string | null;
  status: string | number;
  statusName: string;
  subscriptionTier: number;
  subscriptionTierName: string;
  subscriptionStatus: string;
  activeBranchesCount: number;
  totalBranchesCount: number;
  publishedBranchesCount: number;
  roomCount: number;
  maxRoomsAllowed: number;
  staffCount: number;
  maxStaffAllowed: number;
  totalSaasPaid: number;
  createdAtUtc: string;
  branches: PlatformTenantBranchDto[];
}

export interface ToggleTenantStatusResultDto {
  tenantId: string;
  name: string;
  status: string | number;
  statusName: string;
  updatedAtUtc: string;
}

export interface ApprovePropertyPublishResultDto {
  propertyId: string;
  tenantId: string;
  propertyName: string;
  isPublished: boolean;
  updatedAtUtc: string;
}

export interface PlatformPlanBreakdownDto {
  code: string;
  name: string;
  activeTenantsCount: number;
  monthlyPrice: number;
  estimatedMrr: number;
}

export interface PlatformAiTenantUsageDto {
  tenantId: string;
  tenantName: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PlatformOverviewDto {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  pendingTenants: number;
  totalBranches: number;
  activeBranches: number;
  publishedBranches: number;
  publishPendingBranches: number;
  totalRooms: number;
  totalStaff: number;
  mrrVnd: number;
  arrVnd: number;
  totalCollectedSaasRevenue: number;
  totalContracts: number;
  activeContracts: number;
  totalCommittedContractValue: number;
  totalAiCalls: number;
  successfulAiCalls: number;
  totalAiInputTokens: number;
  totalAiOutputTokens: number;
  planBreakdown: PlatformPlanBreakdownDto[];
  aiUsageByTenant: PlatformAiTenantUsageDto[];
}

export interface DashboardSummaryDto {
  tenantId: string;
  propertyId?: string | null;
  businessDate: string;
  totalRooms: number;
  cleanRooms: number;
  occupiedRooms: number;
  dirtyRooms: number;
  cleaningRooms: number;
  outOfServiceRooms: number;
  readyRatePercent: number;
  occupancyRatePercent: number;
  todayCheckInsCount: number;
  todayCheckOutsCount: number;
  inHouseGuestsCount: number;
  checkedInCount: number;
  upcomingConfirmedCount: number;
  pendingDepositsCount: number;
  todayRevenue: number;
  totalBookingRevenue: number;
  totalActiveReservations: number;
}

export interface SupportUserOptionDto {
  userId: string;
  fullName: string;
  email: string;
}

export interface SupportAccessGrantDto {
  id: string;
  tenantId: string;
  tenantName: string;
  grantedByUserId: string;
  grantedByEmail: string;
  targetSupportUserId: string;
  targetSupportEmail: string;
  targetSupportName: string;
  scope: 'READ_ONLY' | 'DIAGNOSTIC' | string;
  reason: string;
  expiresAtUtc: string;
  revokedAtUtc?: string | null;
  revokedByUserId?: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | string;
  isCurrentlyActive: boolean;
  createdAtUtc: string;
}

export interface SupportAuditLogDto {
  id: string;
  tenantId: string;
  supportAccessGrantId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  resourcePath: string;
  detailsJson?: string | null;
  ipAddress?: string | null;
  createdAtUtc: string;
}

export interface SupportDiagnosticBranchDto {
  propertyId: string;
  name: string;
  code: string;
  status: string | number;
  isPublished: boolean;
  roomCount: number;
  activeReservationsCount: number;
}

export interface SupportDiagnosticSnapshotDto {
  grantId: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  tenantStatus: string | number;
  scope: string;
  expiresAtUtc: string;
  propertyCount: number;
  totalRooms: number;
  activeStaffCount: number;
  auditEntriesCount: number;
  branches: SupportDiagnosticBranchDto[];
}

export interface CreateSupportGrantRequest {
  targetSupportUserId: string;
  scope: 'READ_ONLY' | 'DIAGNOSTIC';
  reason: string;
  expiresAtUtc: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

function unwrapPayload<T>(res: ApiEnvelope<T> | T): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class PlatformGovernanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getPlatformTenants(filters?: {
    search?: string;
    status?: string | number;
    onlyPendingPublish?: boolean;
  }): Observable<PlatformTenantDto[]> {
    let params = new HttpParams();
    if (filters?.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters?.status !== undefined && filters.status !== '' && filters.status !== 'ALL') {
      params = params.set('status', String(filters.status));
    }
    if (filters?.onlyPendingPublish) {
      params = params.set('onlyPendingPublish', 'true');
    }

    return this.http
      .get<ApiEnvelope<PlatformTenantDto[]> | PlatformTenantDto[]>(`${this.baseUrl}/platform/tenants`, { params })
      .pipe(map(res => unwrapPayload(res)));
  }

  toggleTenantStatus(
    tenantId: string,
    body?: { targetStatus?: string | number; reason?: string }
  ): Observable<ToggleTenantStatusResultDto> {
    return this.http
      .patch<ApiEnvelope<ToggleTenantStatusResultDto> | ToggleTenantStatusResultDto>(
        `${this.baseUrl}/platform/tenants/${tenantId}/status`,
        body ?? {}
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  approvePropertyPublish(
    propertyId: string,
    isPublished: boolean,
    note?: string
  ): Observable<ApprovePropertyPublishResultDto> {
    return this.http
      .post<ApiEnvelope<ApprovePropertyPublishResultDto> | ApprovePropertyPublishResultDto>(
        `${this.baseUrl}/platform/properties/${propertyId}/publish-approval`,
        { isPublished, note }
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  getPlatformOverview(): Observable<PlatformOverviewDto> {
    return this.http
      .get<ApiEnvelope<PlatformOverviewDto> | PlatformOverviewDto>(`${this.baseUrl}/platform/overview`)
      .pipe(map(res => unwrapPayload(res)));
  }

  getDashboardSummary(propertyId?: string | null): Observable<DashboardSummaryDto> {
    let params = new HttpParams();
    if (propertyId?.trim()) {
      params = params.set('propertyId', propertyId.trim());
    }
    return this.http
      .get<ApiEnvelope<DashboardSummaryDto> | DashboardSummaryDto>(`${this.baseUrl}/dashboard/summary`, { params })
      .pipe(map(res => unwrapPayload(res)));
  }

  getPlatformSupportGrants(tenantId?: string, onlyActive = false): Observable<SupportAccessGrantDto[]> {
    let params = new HttpParams();
    if (tenantId?.trim()) {
      params = params.set('tenantId', tenantId.trim());
    }
    if (onlyActive) {
      params = params.set('onlyActive', 'true');
    }
    return this.http
      .get<ApiEnvelope<SupportAccessGrantDto[]> | SupportAccessGrantDto[]>(
        `${this.baseUrl}/platform/support-grants`,
        { params }
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  accessSupportDiagnostics(grantId: string): Observable<SupportDiagnosticSnapshotDto> {
    return this.http
      .get<ApiEnvelope<SupportDiagnosticSnapshotDto> | SupportDiagnosticSnapshotDto>(
        `${this.baseUrl}/platform/support-grants/${grantId}/diagnostics`
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  getTenantSupportGrants(): Observable<SupportAccessGrantDto[]> {
    return this.http
      .get<ApiEnvelope<SupportAccessGrantDto[]> | SupportAccessGrantDto[]>(
        `${this.baseUrl}/tenants/current/support-grants`
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  getTenantSupportAuditLogs(grantId?: string): Observable<SupportAuditLogDto[]> {
    let params = new HttpParams();
    if (grantId?.trim()) {
      params = params.set('grantId', grantId.trim());
    }
    return this.http
      .get<ApiEnvelope<SupportAuditLogDto[]> | SupportAuditLogDto[]>(
        `${this.baseUrl}/tenants/current/support-grants/audit-logs`,
        { params }
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  getAvailableSupportUsers(): Observable<SupportUserOptionDto[]> {
    return this.http
      .get<ApiEnvelope<SupportUserOptionDto[]> | SupportUserOptionDto[]>(
        `${this.baseUrl}/tenants/current/support-users`
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  createSupportGrant(req: CreateSupportGrantRequest): Observable<SupportAccessGrantDto> {
    return this.http
      .post<ApiEnvelope<SupportAccessGrantDto> | SupportAccessGrantDto>(
        `${this.baseUrl}/tenants/current/support-grants`,
        req
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  revokeSupportGrant(grantId: string, reason?: string): Observable<SupportAccessGrantDto> {
    return this.http
      .post<ApiEnvelope<SupportAccessGrantDto> | SupportAccessGrantDto>(
        `${this.baseUrl}/tenants/current/support-grants/${grantId}/revoke`,
        { reason }
      )
      .pipe(map(res => unwrapPayload(res)));
  }
}
