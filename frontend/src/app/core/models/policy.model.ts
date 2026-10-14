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
  surcharges: UpdateSurchargeItemRequest[];
}
