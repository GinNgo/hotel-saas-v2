export interface PmsGuestReviewItemDto {
  id: string;
  reservationId: string;
  confirmationCode: string;
  propertyId: string;
  propertyName: string;
  propertyCode?: string | null;
  guestName: string;
  guestPhone?: string | null;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  rentalType: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  rating: number;
  cleanlinessRating?: number | null;
  locationRating?: number | null;
  serviceRating?: number | null;
  valueRating?: number | null;
  comment?: string | null;
  ownerReply?: string | null;
  repliedAtUtc?: string | null;
  isPublished: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PmsReviewsSummaryDto {
  averageRating: number;
  totalCount: number;
  publishedCount: number;
  hiddenCount: number;
  unansweredCount: number;
  repliedCount: number;
  cleanlinessAverage: number;
  locationAverage: number;
  serviceAverage: number;
  valueAverage: number;
  ratingDistribution: Record<number, number>;
}

export interface PmsReviewsPagedResultDto {
  items: PmsGuestReviewItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  summary: PmsReviewsSummaryDto;
}

export interface GetPmsReviewsFilter {
  propertyId?: string | null;
  rating?: number | null;
  hasReply?: boolean | null;
  isPublished?: boolean | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ReplyGuestReviewRequest {
  reply: string;
}

export interface ToggleReviewVisibilityRequest {
  isPublished: boolean;
}
