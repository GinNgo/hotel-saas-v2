export interface GuestDirectoryItemDto {
  id: string;
  userId?: string;
  fullName: string;
  email?: string;
  phoneNumber: string;
  idCardNumber?: string;
  totalBookings: number;
  completedStays: number;
  cancelledBookings: number;
  totalSpent: number;
  lastStayDate?: string;
  loyaltyTier: string;
  pointsBalance: number;
  isVip: boolean;
  isBlacklisted: boolean;
  notes?: string;
}

export interface GuestBookingHistoryItemDto {
  reservationId: string;
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  status: string;
  createdAtUtc: string;
}

export interface GuestDetailDto {
  profile: GuestDirectoryItemDto;
  bookings: GuestBookingHistoryItemDto[];
}

export interface UpdateGuestNotesRequest {
  phoneNumber: string;
  notes?: string;
  isVip?: boolean;
}
