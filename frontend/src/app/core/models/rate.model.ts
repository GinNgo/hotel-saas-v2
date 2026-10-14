/**
 * Room Type Rate Schedule DTO
 * Khớp backend RoomTypeRateDto
 */
export interface RoomTypeRateDto {
  id: string;
  propertyId: string;
  roomTypeId: string;
  firstHours: number;
  firstHoursPrice: number;
  additionalHourPrice: number;
  nightlyPrice: number;
  currency: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string;   // YYYY-MM-DD
  changeReason?: string | null;
  isActive: boolean;
  createdAtUtc: string;
}

/**
 * Room Type Rate Audit Log DTO
 * Khớp backend RoomTypeRateAuditDto
 */
export interface RoomTypeRateAuditDto {
  id: string;
  propertyId: string;
  roomTypeId: string;
  rateId?: string | null;
  oldEffectiveFrom?: string | null;
  oldEffectiveTo?: string | null;
  oldNightlyPrice?: number | null;
  newEffectiveFrom: string;
  newEffectiveTo: string;
  newNightlyPrice: number;
  actionType: string;
  changedByUserId: string;
  changedAtUtc: string;
  changeReason?: string | null;
}

/**
 * Request payload to configure or interval-split a rate schedule
 * Khớp backend CreateRoomTypeRateCommand
 */
export interface CreateRoomTypeRateRequest {
  roomTypeId: string;
  propertyId?: string | null;
  firstHours: number;
  firstHoursPrice: number;
  additionalHourPrice: number;
  nightlyPrice: number;
  effectiveFrom: string;
  effectiveTo: string;
  currency?: string;
  changeReason?: string | null;
}
