export interface SubscriptionPaymentHistoryDto {
  id: string;
  amount: number;
  method: string;
  status: string;
  transactionRef?: string | null;
  invoiceNumber?: string | null;
  paidAtUtc?: string | null;
  createdAtUtc: string;
  targetTier?: number | null;
  billingCycle?: string | null;
}

export interface TenantSubscriptionDto {
  subscriptionId: string;
  tenantId: string;
  tier: number;
  tierName: string;
  status: string;
  billingCycle?: string;
  pricePerCycle: number;
  currency: string;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
  autoRenew: boolean;
  currentRoomCount: number;
  maxRoomsAllowed: number;
  currentPropertyCount: number;
  maxPropertiesAllowed: number;
  currentStaffCount?: number;
  maxStaffAllowed?: number;
  roomUsagePercentage: number;
  features: string[];
  isNearQuota: boolean;
  pendingPayment?: SubscriptionPaymentHistoryDto | null;
  recentPayments?: SubscriptionPaymentHistoryDto[];
}

export interface SubscriptionPackageDto {
  tier: number;
  planCode?: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxRooms: number;
  maxProperties: number;
  maxStaff: number;
  hasVnPay?: boolean;
  hasAdvancedReports?: boolean;
  badge: string;
  isPopular: boolean;
  features: string[];
}

export interface UpgradeSubscriptionRequest {
  targetTier: number;
  billingCycle?: number;
  returnUrl?: string;
}

export interface SubscriptionUpgradeInitiationDto {
  paymentId: string;
  subscriptionId: string;
  tenantId: string;
  targetTier: number;
  targetTierName: string;
  billingCycle: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  transactionRef: string;
  invoiceNumber: string;
  paymentUrl?: string | null;
  isImmediateActivation: boolean;
  message: string;
}

export interface ConfirmSubscriptionPaymentResultDto {
  paymentId: string;
  subscriptionId: string;
  tenantId: string;
  paymentStatus: string;
  alreadyConfirmed: boolean;
  transactionRef: string;
  newTier: number;
  newTierName: string;
  billingCycle: string;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
  message: string;
}
