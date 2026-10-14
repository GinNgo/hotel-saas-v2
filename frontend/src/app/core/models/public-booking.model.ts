import { QuoteBreakdownItemDto } from './reservation.model';

export interface LandmarkDistanceDto {
  name: string;
  distanceMeters?: number;
  distanceKm?: number;
  formattedDistance: string;
  category?: string;
}

export interface TouristZoneDto {
  slug: string;
  name: string;
  provinceCode: string;
  provinceName: string;
  description?: string;
  landmarksCount: number;
  latitude?: number;
  longitude?: number;
}

export interface LandmarkDto {
  slug: string;
  name: string;
  touristZoneSlug: string;
  provinceCode: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  addressHint?: string;
}

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
  propertyType?: number;
  propertyTypeName?: string;
  touristZoneSlug?: string;
  touristZoneName?: string;
  latitude?: number;
  longitude?: number;
  nearbyLandmarks?: LandmarkDistanceDto[];
  startingPrice?: number;
  allowHourlyBooking?: boolean;
  allowOvernightBooking?: boolean;
  allowDailyBooking?: boolean;
}

export interface PublicPropertiesFilter {
  search?: string;
  destinationKeyword?: string;
  propertyTypes?: number[];
  rentalType?: number;
  touristZoneSlug?: string;
  landmarkSlug?: string;
  maxDistanceKm?: number;
  latitude?: number;
  longitude?: number;
  page?: number;
  pageSize?: number;
}

export interface TenantPropertySummaryDto {
  id: string;
  name: string;
  code: string;
  slug: string;
  address: string;
  city: string;
  propertyType: number;
  propertyTypeName: string;
  touristZoneName?: string;
  totalRooms: number;
  occupiedRooms: number;
  todayRevenue: number;
  allowHourlyBooking: boolean;
  allowOvernightBooking: boolean;
  allowDailyBooking: boolean;
  isActive: boolean;
}

export interface CreatePropertyRequest {
  name: string;
  code: string;
  slug: string;
  address: string;
  city?: string;
  provinceCode: string;
  propertyType: number;
  touristZoneSlug?: string;
  touristZoneName?: string;
  checkInTime?: string;
  checkOutTime?: string;
  bufferMinutes?: number;
  maxHourlyHours?: number;
  allowHourlyBooking?: boolean;
  allowOvernightBooking?: boolean;
  allowDailyBooking?: boolean;
  latitude?: number;
  longitude?: number;
  nearbyLandmarksJson?: string;
}

export interface UpdatePropertyRequest extends CreatePropertyRequest {
  isActive?: boolean;
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
