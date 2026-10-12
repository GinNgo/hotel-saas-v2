import { QuoteBreakdownItemDto } from './reservation.model';

export interface PublicPropertyDto {
  id: string;
  name: string;
  code: string;
  slug: string;
  address: string;
  city?: string;
  checkInTime: string;
  checkOutTime: string;
  bufferMinutes: number;
  maxHourlyHours: number;
  imageUrl?: string;
}

export interface PublicRoomTypeDto {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  bedType?: string;
  squareMeters?: number;
  imageUrl?: string;
}

export interface PublicRoomTypeAvailabilityDto {
  roomTypeId: string;
  roomTypeName: string;
  description?: string;
  maxOccupancy: number;
  bedType?: string;
  squareMeters?: number;
  imageUrl?: string;
  totalRooms: number;
  availableRooms: number;
  isAvailable: boolean;
  estimatedPrice: number;
}

export interface GuestHoldDto {
  reservationId: string;
  confirmationCode: string;
  lookupToken: string;
  propertyId: string;
  propertyName: string;
  roomTypeId: string;
  roomTypeName: string;
  assignedRoomId: string;
  assignedRoomNumber: string;
  rentalType: string;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalAmount: number;
  depositRequired: number;
  currency: string;
  holdExpiresAtUtc: string;
  secondsRemaining: number;
  status: string;
  breakdown: QuoteBreakdownItemDto[];
}

export interface GuestBookingDetailDto {
  reservationId: string;
  confirmationCode: string;
  lookupToken: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  roomTypeName: string;
  rentalType: string;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfGuests: number;
  totalAmount: number;
  depositRequired: number;
  paidAmount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  status: string;
  maskedGuestName: string;
  maskedGuestEmail: string;
  maskedGuestPhone?: string;
  holdExpiresAtUtc?: string;
  secondsRemaining?: number;
  createdAtUtc: string;
  breakdown: QuoteBreakdownItemDto[];
}

export interface CalculatePublicQuoteRequest {
  propertySlug: string;
  roomTypeId: string;
  rentalType: number;
  startAtUtc: string;
  endAtUtc: string;
  checkInDate?: string;
  checkOutDate?: string;
}

export interface CreateGuestHoldRequest {
  propertySlug: string;
  roomTypeId: string;
  rentalType: number;
  startAtUtc: string;
  endAtUtc: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  numberOfGuests: number;
  checkInDate?: string;
  checkOutDate?: string;
  expectedTotalAmount?: number;
  idempotencyKey?: string;
}

export interface ConfirmGuestBookingRequest {
  paymentAmount?: number;
  paymentMethod?: string;
  transactionRef?: string;
  idempotencyKey?: string;
}
