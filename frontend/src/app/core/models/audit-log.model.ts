/**
 * Audit Log Models — Khớp DTOs Backend T03-A và T03-B.
 */

export interface AuditFieldChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditLogListItem {
  id: string;
  tenantId: string;
  propertyId: string | null;
  propertyName: string | null;
  propertyCode: string | null;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  action: 'Create' | 'Update' | 'Delete' | string;
  entityName: string;
  entityId: string;
  createdAtUtc: string;
  changedFields: string[];
  changeSummary: string;
}

export interface AuditLogDetail extends AuditLogListItem {
  ipAddress: string | null;
  oldValues: string | null;
  newValues: string | null;
  changes: AuditFieldChange[];
}

export interface AuditLogFilterParams {
  propertyId?: string | null;
  userId?: string | null;
  action?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
  page?: number;
  pageSize?: number;
}

