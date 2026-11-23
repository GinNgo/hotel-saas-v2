export type PromotionType = 'PercentDiscount' | 'FixedDiscount' | 'FreeNight';

export interface PromotionDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  type: PromotionType;
  typeName: string;
  value: number;
  minNights: number;
  maxUsage?: number | null;
  currentUsage: number;
  startsAtUtc: string;
  endsAtUtc: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreatePromotionRequest {
  code: string;
  name: string;
  description?: string | null;
  type: PromotionType;
  value: number;
  minNights: number;
  maxUsage?: number | null;
  startsAtUtc: string;
  endsAtUtc: string;
  isActive: boolean;
}

export interface UpdatePromotionRequest extends CreatePromotionRequest {
  id: string;
}

export interface TogglePromotionStatusRequest {
  isActive?: boolean | null;
}

export interface PromotionFilterParams {
  isActive?: boolean | null;
  search?: string | null;
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  PercentDiscount: 'Giảm theo %',
  FixedDiscount: 'Giảm số tiền cố định',
  FreeNight: 'Tặng đêm miễn phí'
};
