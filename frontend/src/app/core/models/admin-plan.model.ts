export interface AdminSubscriptionPlanDto {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description?: string;
  maxRooms: number;
  maxProperties: number;
  maxStaff: number;
  featuresJson?: string;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  hasVnPay: boolean;
  hasAdvancedReports: boolean;
  isActive: boolean;
  createdAtUtc?: string;
}

export interface CreateSubscriptionPlanRequest {
  code: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description?: string;
  maxRooms: number;
  maxProperties: number;
  maxStaff: number;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  hasVnPay: boolean;
  hasAdvancedReports: boolean;
  isActive: boolean;
}

export interface UpdateSubscriptionPlanRequest {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description?: string;
  maxRooms: number;
  maxProperties: number;
  maxStaff: number;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  hasVnPay: boolean;
  hasAdvancedReports: boolean;
  isActive: boolean;
}
