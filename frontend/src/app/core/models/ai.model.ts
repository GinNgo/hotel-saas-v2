export interface AiConciergeRequest {
  message: string;
  propertySlug?: string;
}

export interface AiConciergeResponse {
  intent: string;
  reply: string;
  detectedCriteria: {
    city?: string;
    minGuests?: number;
    amenities: string[];
  };
  suggestedRooms: SuggestedRoomCardDto[];
}

export interface SuggestedRoomCardDto {
  roomTypeId: string;
  roomTypeName: string;
  propertySlug: string;
  propertyName: string;
  city: string;
  standardOccupancy: number;
  maxOccupancy: number;
  basePriceNight: number;
  description: string;
}

export interface AiUsageStatusDto {
  tierName: string;
  monthlyQuota: number;
  usedCount: number;
  remainingCount: number;
  isLimitReached: boolean;
}
