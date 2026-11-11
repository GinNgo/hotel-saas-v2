export interface GuestCapabilitiesDto {
  canEditName: boolean;
  canViewBookings: boolean;
}

export interface GuestMeDto {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  emailVerified: boolean;
  capabilities: GuestCapabilitiesDto;
  avatarUrl?: string | null;
  phoneVerified?: boolean;
}

export interface GuestPropertySummaryDto {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
}

export interface GuestBookingSummaryDto {
  id: string;
  reference: string;
  property: GuestPropertySummaryDto;
  roomTypeName: string;
  rentalType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAtUtc?: string;
}

export interface GuestPagedBookingsDto {
  items: GuestBookingSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
