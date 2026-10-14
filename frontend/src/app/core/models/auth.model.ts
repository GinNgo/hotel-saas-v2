/** User info — khớp backend UserDto */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  globalRole: string;
  tenantId: string | null;
}

/** Membership info — khớp backend UserMembershipDto */
export interface UserMembershipDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  propertyId: string | null;
  propertyName: string | null;
  propertyCode: string | null;
  staffRole: string;
  roleName: string;
  isTenantWide: boolean;
}

/** Login response — khớp backend LoginResponse (trả thẳng ở root) */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  user: UserDto;
  memberships?: UserMembershipDto[] | null;
}

/** Register response — khớp backend RegisterResponse */
export interface RegisterResponse {
  userId: string;
  message: string;
}

/** Login request */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Register request */
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

/** Partner Register request */
export interface PartnerRegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  propertyName: string;
  address: string;
  provinceCode: string;
  wardCode?: string | null;
}

/** Partner Register response */
export interface PartnerRegisterResponse {
  userId: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  message: string;
}

/** Refresh token request */
export interface RefreshTokenRequest {
  accessToken: string;
  refreshToken: string;
}

/** Switch context request */
export interface SwitchContextRequest {
  propertyId: string;
}

/** DTO thông tin context chi nhánh đang kích hoạt */
export interface CurrentContextDto {
  tenantId: string;
  propertyId: string;
  scope: string;
  roleName: string;
}

/** Switch context response — bọc trong ApiResponse<{ accessToken, refreshToken, currentContext }> */
export interface SwitchContextResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  currentContext: CurrentContextDto;
}
