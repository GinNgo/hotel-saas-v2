/** User info — khớp backend UserDto */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
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

/** Confirm email response */
export interface ConfirmEmailResponse {
  success: boolean;
  message: string;
  email?: string | null;
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
  phoneNumber?: string;
  avatarUrl?: string;
  appUrl?: string;
}

/** Partner Register request */
export interface PartnerRegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  propertyName: string;
  brandName?: string | null;
  propertyType?: number | null;
  starRating?: number | null;
  address: string;
  provinceCode: string;
  wardCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  allowHourlyBooking?: boolean;
  allowOvernightBooking?: boolean;
  allowDailyBooking?: boolean;
  defaultNightlyPrice?: number | null;
  defaultHourlyPrice?: number | null;
}

/** Partner Register response */
export interface PartnerRegisterResponse {
  userId: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  tenantSlug?: string;
  propertySlug?: string;
  message: string;
}

/** Refresh token request */
export interface RefreshTokenRequest {
  accessToken: string;
  refreshToken: string;
}

/** Switch context request */
export interface SwitchContextRequest {
  propertyId: string | null;
}

/** DTO thông tin context chi nhánh đang kích hoạt */
export interface CurrentContextDto {
  tenantId: string;
  propertyId: string | null;
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
