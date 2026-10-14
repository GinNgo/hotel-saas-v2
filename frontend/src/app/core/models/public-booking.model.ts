import { QuoteBreakdownItemDto } from './reservation.model';

export type RentalType = 'Hourly' | 'Overnight' | 'Daily';

export type PropertyType = 'Hotel' | 'Motel' | 'Guesthouse' | 'Homestay' | 'Resort';

export type DestinationSuggestionType = 'Province' | 'TouristZone' | 'Landmark' | 'Property';

export type BookingSortOption =
  | 'recommended'
  | 'price_asc'
  | 'price_desc'
  | 'distance_asc'
  | 'rating_desc';

export interface DestinationSuggestionDto {
  id: string;
  name: string;
  slug: string;
  type: DestinationSuggestionType;
  provinceCode: string;
  provinceName: string;
  touristZoneName?: string;
  distanceLabel?: string;
  propertyCount?: number;
  propertyType?: PropertyType;
}

export interface NearbyLandmarkBadgeDto {
  landmarkId: string;
  landmarkName: string;
  name?: string; // compatibility alias
  landmarkSlug: string;
  category: 'Market' | 'Beach' | 'Heritage' | 'Airport' | 'Center';
  distanceMeters: number;
  distanceFormatted?: string; // compatibility formatted string (e.g. "500m")
}

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

export interface SuggestedFilterChipDto {
  id: string;
  label: string;
  category: 'nearby' | 'price' | 'rating' | 'rentalType' | 'amenity';
  filterKey: string;
  filterValue: any;
  count?: number;
  isActive?: boolean;
}

export interface AiSmartSearchResponseDto {
  query: string;
  summaryMessage: string;
  extractedFilters: any;
  suggestedFilterChips: SuggestedFilterChipDto[];
  properties: PublicPropertyDto[];
  totalResults: number;
}

export interface PublicBookingSearchFilter {
  rentalType: RentalType;
  destinationKeyword: string;
  provinceCode: string | null;
  touristZoneSlug: string | null;
  landmarkSlug: string | null;
  tenantSlug: string | null;
  propertyTypes: PropertyType[];
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm (dùng cho Hourly & Overnight)
  durationHours: number; // Số giờ thuê (dùng cho Hourly: 1, 2, 3, 4, 6...)
  guests: number;
  roomsCount: number;
  maxDistanceMeters: number | null;
  userLatitude?: number | null;
  userLongitude?: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: BookingSortOption;
  page: number;
  pageSize: number;
}

export interface PublicRoomTypeAvailabilityDto {
  roomTypeId: string;
  name: string;
  roomTypeName?: string; // for compatibility
  code: string;
  description?: string;
  maxGuests: number;
  maxOccupancy?: number; // for compatibility
  bedConfiguration?: string;
  bedType?: string; // for compatibility
  areaSqm?: number;
  squareMeters?: number; // for compatibility
  availableRoomsCount: number;
  availableRooms: number; // for compatibility
  totalRooms?: number;
  isAvailable?: boolean;
  amenities: string[];
  images: string[];
  imageUrl?: string;
  // Giá tương ứng với từng chế độ thuê
  hourlyBasePrice?: number; // Giá block giờ đầu (VD: 2 giờ đầu)
  hourlyBaseHours?: number; // Số giờ block đầu (mặc định 2h)
  hourlyExtraHourPrice?: number; // Phụ thu mỗi giờ tiếp theo
  overnightPrice?: number; // Giá qua đêm
  dailyPrice?: number; // Giá theo ngày/đêm
  calculatedQuoteTotal: number; // Tổng tiền tạm tính theo bộ lọc hiện tại
  estimatedPrice?: number; // for compatibility
}

export interface PublicPropertyDto {
  propertyId: string;
  id?: string; // for compatibility
  tenantId: string;
  tenantBrandName: string; // Tên Tenant chính (Chuỗi thương hiệu)
  name: string; // Tên cơ sở / chi nhánh
  code?: string;
  slug: string;
  propertyType: PropertyType;
  propertyTypeName?: string;
  starRating?: number;
  addressLine: string;
  address?: string; // for compatibility
  wardName: string;
  city?: string;
  provinceCode: string;
  provinceName: string;
  touristZoneName?: string;
  touristZoneSlug?: string;
  latitude?: number;
  longitude?: number;
  thumbnailUrl: string;
  imageUrl?: string; // for compatibility
  galleryUrls: string[];
  allowedRentalTypes: RentalType[];
  allowHourlyBooking?: boolean;
  allowOvernightBooking?: boolean;
  allowDailyBooking?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  overnightCheckInTime: string; // VD: "21:00"
  overnightCheckOutTime: string; // VD: "10:00"
  cleaningBufferMinutes: number; // VD: 15 hoặc 30 phút
  bufferMinutes?: number;
  maxHourlyHours?: number;
  ratingAverage: number;
  reviewCount: number;
  nearbyLandmarks: NearbyLandmarkBadgeDto[];
  startingPriceForSelectedMode: number;
  startingPrice?: number;
  hourlyStartingPrice?: number;
  overnightStartingPrice?: number;
  dailyStartingPrice?: number;
  availableRoomTypes: PublicRoomTypeAvailabilityDto[];
  distanceMeters?: number;
  distanceFormatted?: string;
  isExpandedNearbySuggestion?: boolean;
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

export interface TenantBrandDto {
  tenantId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  totalProperties: number;
  ratingAverage: number;
  reviewCount: number;
  properties: PublicPropertyDto[];
  provinces: string[];
}

export interface PropertyPolicyDto {
  propertyId: string;
  propertyName: string;
  checkInTime: string;
  checkOutTime: string;
  bufferMinutes: number;
  maxHourlyHours: number;
  earlyCheckInFeePerHour?: number;
  lateCheckOutFeePerHour?: number;
  cancellationPolicy: string;
  generalRules: string[];
}

export interface GuestReviewDto {
  id: string;
  propertyId: string;
  guestName: string;
  rating: number;
  comment: string;
  createdAt: string;
  rentalType: RentalType;
  roomTypeName?: string;
  cleanlinessRating?: number;
  staffRating?: number;
}

export interface SubmitGuestReviewRequest {
  lookupToken: string;
  rating: number;
  cleanlinessRating?: number;
  staffRating?: number;
  comment: string;
}

export interface PromotionDealDto {
  id: string;
  code: string;
  title: string;
  description: string;
  discountBadge: string;
  discountType: 'Percent' | 'Amount';
  discountValue: number;
  rentalType?: RentalType;
  applicableDestinations?: string[];
  expiresAt: string;
  minSpend?: number;
  bannerImageUrl?: string;
}

