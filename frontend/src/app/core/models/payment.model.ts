export enum PaymentMethod {
  VNPay = 1,
  Cash = 2,
  BankTransfer = 3,
  CreditCard = 4
}

export const PAYMENT_METHOD_LABELS: Record<number, string> = {
  [PaymentMethod.VNPay]: 'VNPay',
  [PaymentMethod.Cash]: 'Tiền mặt',
  [PaymentMethod.BankTransfer]: 'Chuyển khoản',
  [PaymentMethod.CreditCard]: 'Thẻ tín dụng'
};

export enum PaymentStatus {
  Pending = 1,
  Processing = 2,
  Completed = 3,
  Failed = 4,
  Cancelled = 5,
  Refunded = 6
}

export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  [PaymentStatus.Pending]: 'Chờ xử lý',
  [PaymentStatus.Processing]: 'Đang xử lý',
  [PaymentStatus.Completed]: 'Thành công',
  [PaymentStatus.Failed]: 'Thất bại',
  [PaymentStatus.Cancelled]: 'Đã hủy',
  [PaymentStatus.Refunded]: 'Đã hoàn tiền'
};

export interface PaymentDto {
  id: string;
  reservationId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  methodName: string;
  status: PaymentStatus;
  statusName: string;
  transactionRef?: string;
  notes?: string;
  createdAtUtc: string;
}

import { QuoteBreakdownItemDto } from './reservation.model';

export interface FolioDto {
  reservationId: string;
  confirmationCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  roomId?: string;
  roomNumber?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  status: number;
  statusName: string;
  rentalType: number;
  checkInDate: string;
  checkOutDate: string;
  startAtUtc: string;
  endAtUtc: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  payments: PaymentDto[];
  breakdown?: QuoteBreakdownItemDto[];
  baseRoomAmount?: number | null;
  surchargesAmount?: number | null;
  servicesAmount?: number | null;
  depositRequired?: number | null;
  depositPaid?: number | null;
  cancellationFee?: number | null;
  refundableAmount?: number | null;
  refundStatus?: string | null;
  netCollectibleAmount?: number | null;
  financialSettlementStatus?: string | null;
}

export interface AddFolioItemRequest {
  propertyId: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

export interface CreatePaymentRequest {
  reservationId: string;
  propertyId?: string;
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  idempotencyKey?: string;
  isDeposit?: boolean;
}

export interface PaymentSummaryDto {
  propertyId: string;
  date: string;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
  creditCardCollected: number;
  completedCount: number;
}

export enum ShiftType {
  Morning = 1,
  Afternoon = 2,
  Night = 3
}

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  [ShiftType.Morning]: 'Ca 1 - Sáng (06:00 - 14:00)',
  [ShiftType.Afternoon]: 'Ca 2 - Chiều (14:00 - 22:00)',
  [ShiftType.Night]: 'Ca 3 - Đêm (22:00 - 06:00)'
};

export interface ShiftReportDto {
  propertyId: string;
  date: string;
  shiftType: ShiftType;
  shiftName: string;
  shiftStartUtc: string;
  shiftEndUtc: string;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
  creditCardCollected: number;
  completedCount: number;
  payments: PaymentDto[];
}

