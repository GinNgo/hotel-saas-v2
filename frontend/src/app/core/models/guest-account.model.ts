export interface GuestCapabilitiesDto {
  canEditName: boolean;
  canViewBookings: boolean;
}

export interface GuestMeDto {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  emailVerified: boolean;
  capabilities: GuestCapabilitiesDto;
  avatarUrl?: string | null;
  phoneVerified?: boolean;
}

export interface GuestPropertySummaryDto {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
}

export interface GuestBookingSummaryDto {
  id: string;
  reference: string;
  lookupToken?: string;
  property: GuestPropertySummaryDto;
  roomTypeName: string;
  rentalType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAtUtc?: string;
}

export interface GuestPagedBookingsDto {
  items: GuestBookingSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GuestLoyaltyMembershipDto {
  membershipId: string;
  tenantId: string;
  tenantBrandName: string;
  enrolledPropertyId: string;
  enrolledPropertyName: string;
  memberCode: string;
  tier: string;
  pointsBalance: number;
  pendingPoints: number;
  totalStays: number;
  discountPercent: number;
  nextTierName: string;
  staysToNextTier: number;
  joinedAt: string;
}

export interface GuestProfileResponseDto {
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  companyName?: string | null;
  companyTaxCode?: string | null;
  companyAddress?: string | null;
  totalPoints: number;
  pointsValueVnd: number;
  totalPointsRefunded: number;
  memberships: GuestLoyaltyMembershipDto[];
}

export interface LoyaltyPointLedgerItemDto {
  id: string;
  createdAt: string;
  tenantBrandName: string;
  propertyName: string;
  reservationCode: string;
  type: string;
  pointsDelta: number;
  balanceAfter: number;
  description: string;
}

export interface GuestFolioLineItemDto {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface GuestInvoiceRecordDto {
  invoiceId: string;
  invoiceNumber: string;
  reservationId: string;
  reservationCode: string;
  tenantBrandName: string;
  propertyName: string;
  propertyType: string;
  propertyAddress: string;
  propertyTaxCode: string;
  rentalType: string;
  checkInTime: string;
  checkOutTime: string;
  roomName: string;
  roomNumber: string;
  status: string;
  subTotal: number;
  surchargeTotal: number;
  discountTotal: number;
  pointsUsed: number;
  pointsDiscountAmount: number;
  pointsEarned: number;
  pointsRefunded: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: string;
  issuedAt: string;
  lineItems: GuestFolioLineItemDto[];
}

export interface UpdateGuestVatProfileRequest {
  companyName?: string | null;
  companyTaxCode?: string | null;
  companyAddress?: string | null;
}

export interface EnrollMembershipRequest {
  propertyId: string;
}

export interface ResendConfirmationRequest {
  email?: string | null;
  appUrl?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SocialAccountItemDto {
  id: string;
  provider: string;
  providerEmail: string;
  avatarUrl?: string | null;
  lastLoginAtUtc: string;
  createdAtUtc: string;
}

export interface SocialAccountsResponseDto {
  hasPassword: boolean;
  accounts: SocialAccountItemDto[];
}

export interface LinkSocialAccountRequest {
  idToken: string;
  provider?: string;
}

export interface AuthActionResponseDto {
  success: boolean;
  message?: string | null;
  errorCode?: string | null;
}
