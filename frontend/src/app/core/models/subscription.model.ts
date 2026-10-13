export interface TenantSubscriptionDto {
  subscriptionId: string;
  tenantId: string;
  tier: number;
  tierName: string;
  status: string;
  pricePerCycle: number;
  currency: string;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
  autoRenew: boolean;
  currentRoomCount: number;
  maxRoomsAllowed: number;
  currentPropertyCount: number;
  maxPropertiesAllowed: number;
  roomUsagePercentage: number;
  features: string[];
  isNearQuota: boolean;
}

export interface SubscriptionPackageDto {
  tier: number;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxRooms: number;
  maxProperties: number;
  maxStaff: number;
  badge: string;
  isPopular: boolean;
  features: string[];
}

export interface UpgradeSubscriptionRequest {
  targetTier: number;
}
