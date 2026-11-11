export enum StaffRole {
  Owner = 1,
  Manager = 2,
  Receptionist = 3,
  Housekeeper = 4
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.Owner]: 'Chủ cơ sở (Owner)',
  [StaffRole.Manager]: 'Quản lý (Manager)',
  [StaffRole.Receptionist]: 'Lễ tân (Receptionist)',
  [StaffRole.Housekeeper]: 'Buồng phòng (Housekeeper)'
};

export const STAFF_ROLE_BADGES: Record<StaffRole, string> = {
  [StaffRole.Owner]: 'bg-purple-100 text-purple-800 border-purple-200',
  [StaffRole.Manager]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [StaffRole.Receptionist]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [StaffRole.Housekeeper]: 'bg-amber-100 text-amber-800 border-amber-200'
};

export interface StaffMemberDto {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  propertyId?: string;
  propertyName?: string;
  isTenantWide: boolean;
  roleId: string;
  roleCode: string;
  roleName: string;
  staffRole: StaffRole;
  staffRoleName: string;
  isActive: boolean;
  createdAtUtc: string;
}

export interface AccessRoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  isActive?: boolean;
  staffCount: number;
}

export interface PermissionFunctionDto {
  id: string;
  code: string;
  name: string;
  moduleCode: string;
  supportedActionMask: number;
}

export interface RolePermissionDto {
  functionId: string;
  functionCode: string;
  functionName: string;
  moduleCode: string;
  actionMask: number;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}

export interface RoleDetailDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  isActive?: boolean;
  tenantId?: string;
  staffCount: number;
  permissions: RolePermissionDto[];
}

export interface RolePermissionInput {
  functionId: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove?: boolean;
  canExport?: boolean;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  permissions: RolePermissionInput[];
}

export interface UpdateRoleRequest {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  permissions: RolePermissionInput[];
}

export interface CreateStaffMemberRequest {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  propertyId?: string | null;
  roleId?: string;
  staffRole: StaffRole;
}

export interface UpdateStaffMemberRequest {
  id: string;
  propertyId?: string | null;
  roleId?: string;
  staffRole?: StaffRole;
  isActive?: boolean;
}
