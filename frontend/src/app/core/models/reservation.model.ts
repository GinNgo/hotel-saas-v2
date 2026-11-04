/**
 * Mô hình dữ liệu đặt phòng (Reservation), tính giá (Quote), và tình trạng phòng trống (Availability).
 * Khớp 1:1 với domain contracts và API endpoints backend Phase P3-BOOKING-CORE-01.
 */

export enum RentalType {
  Hourly = 1,
  Overnight = 2
}

export const RENTAL_TYPE_LABELS: Record<RentalType, string> = {
  [RentalType.Hourly]: 'Thuê theo giờ',
  [RentalType.Overnight]: 'Thuê theo đêm'
};

export enum ReservationStatus {
  PendingPayment = 1,
  Confirmed = 2,
  CheckedIn = 3,
  CheckedOut = 4,
  Cancelled = 5,
  NoShow = 6
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  [ReservationStatus.PendingPayment]: 'Chờ thanh toán',
  [ReservationStatus.Confirmed]: 'Đã xác nhận',
  [ReservationStatus.CheckedIn]: 'Đang lưu trú',
  [ReservationStatus.CheckedOut]: 'Đã trả phòng',
  [ReservationStatus.Cancelled]: 'Đã hủy',
  [ReservationStatus.NoShow]: 'Vắng mặt (No-show)'
};

export const RESERVATION_STATUS_BADGE_CLASSES: Record<ReservationStatus, string> = {
  [ReservationStatus.PendingPayment]: 'bg-amber-50 text-amber-800 border-amber-200',
  [ReservationStatus.Confirmed]: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  [ReservationStatus.CheckedIn]: 'bg-blue-50 text-blue-800 border-blue-200',
  [ReservationStatus.CheckedOut]: 'bg-slate-100 text-slate-700 border-slate-200',
  [ReservationStatus.Cancelled]: 'bg-rose-50 text-rose-800 border-rose-200',
  [ReservationStatus.NoShow]: 'bg-purple-50 text-purple-800 border-purple-200'
};

export interface QuoteBreakdownItemDto {
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  category?: string | null;
}

export interface AppliedPoliciesDto {
  maxHourlyHours: number;
  bufferMinutes: number;
  checkInTime: string;
  checkOutTime: string;
}

export interface QuoteDto {
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  rentalType: string;
  totalAmount: number;
  currency: string;
  expiresAtUtc: string;
  breakdown: QuoteBreakdownItemDto[];
  appliedPolicies: AppliedPoliciesDto;
}

export interface ReservationDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  rentalType: RentalType;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  numberOfGuests: number;
  totalAmount: number;
  currency: string;
  status: ReservationStatus;
  confirmationCode: string;
  notes?: string;
  createdAtUtc: string;
}

export interface ReservationDetailDto extends ReservationDto {
  breakdown: QuoteBreakdownItemDto[];
  appliedPolicies: AppliedPoliciesDto;
  cancelledAtUtc?: string;
  cancellationReason?: string;
  cancellationFee?: number;
  refundableAmount?: number;
  pointsRefunded?: number;
}

export interface RoomAvailabilityDto {
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  housekeepingStatus: string;
  isAvailable: boolean;
  conflictReason?: string;
}

export interface CreateReservationRequest {
  propertyId: string;
  roomId: string;
  rentalType: RentalType;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  numberOfGuests: number;
  customerNotes?: string;
  expectedTotalAmount?: number;
  idempotencyKey?: string;
}

