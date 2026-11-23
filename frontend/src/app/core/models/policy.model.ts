export enum SurchargeType {
  EarlyCheckIn = 1,
  LateCheckOut = 2
}

export const SURCHARGE_TYPE_LABELS: Record<SurchargeType, string> = {
  [SurchargeType.EarlyCheckIn]: 'Nhận phòng sớm (Early Check-In)',
  [SurchargeType.LateCheckOut]: 'Trả phòng muộn (Late Check-Out)'
};

export enum SurchargeCalculationMethod {
  PercentageOfNightly = 1,
  FlatAmount = 2
}

export const SURCHARGE_CALCULATION_METHOD_LABELS: Record<SurchargeCalculationMethod, string> = {
  [SurchargeCalculationMethod.PercentageOfNightly]: 'Phần trăm giá đêm (%)',
  [SurchargeCalculationMethod.FlatAmount]: 'Số tiền cố định (VND)'
};

export interface SurchargePolicyDto {
  id: string;
  surchargeType: SurchargeType;
  fromTime: string;
  toTime: string;
  calculationMethod: SurchargeCalculationMethod;
  percentage: number | null;
  flatAmount: number | null;
  isActive: boolean;
}

export interface PropertyPoliciesDto {
  propertyId: string;
  checkInTime: string;
  checkOutTime: string;
  bufferMinutes: number;
  maxHourlyHours: number;
  taxRatePercent?: number;
  serviceFeeRatePercent?: number;
  surcharges: SurchargePolicyDto[];
}

export interface UpdateSurchargeItemRequest {
  id?: string | null;
  surchargeType: SurchargeType;
  fromTime: string;
  toTime: string;
  calculationMethod: SurchargeCalculationMethod;
  percentage?: number | null;
  flatAmount?: number | null;
  isActive: boolean;
}

export interface UpdatePropertyPoliciesRequest {
  checkInTime: string;
  checkOutTime: string;
  bufferMinutes: number;
  maxHourlyHours: number;
  taxRatePercent?: number;
  serviceFeeRatePercent?: number;
  surcharges: UpdateSurchargeItemRequest[];
}

export interface CancellationPolicyTier {
  windowLabel: string;
  feeRateLabel: string;
  refundRateLabel: string;
  description: string;
}

export const POL_C03_CANCELLATION_TIERS: readonly CancellationPolicyTier[] = [
  {
    windowLabel: '>= 72 giờ trước nhận phòng',
    feeRateLabel: 'Miễn phí (0%)',
    refundRateLabel: 'Hoàn 100% cọc',
    description: 'Khách hủy sớm trước 3 ngày được hoàn toàn bộ tiền cọc đã thanh toán.'
  },
  {
    windowLabel: '24 - 72 giờ trước nhận phòng',
    feeRateLabel: 'Phí hủy 50% cọc',
    refundRateLabel: 'Hoàn 50% cọc',
    description: 'Giữ lại 50% tiền cọc và hoàn trả phần còn lại (chuyển khoản/VNPay).'
  },
  {
    windowLabel: '< 24 giờ hoặc Vắng mặt (No-Show)',
    feeRateLabel: 'Phí hủy 100% cọc',
    refundRateLabel: 'Không hoàn (0%)',
    description: 'Khấu trừ toàn bộ tiền cọc; áp dụng cho hủy cận giờ hoặc không đến nhận phòng.'
  }
];
