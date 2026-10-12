/** RoomType DTO — khớp backend RoomTypeDto */
export interface RoomTypeDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  basePrice: number;
  maxOccupancy: number;
  bedType: string | null;
  squareMeters: number | null;
  imageUrl: string | null;
  roomCount: number;
  createdAtUtc: string;
}

export interface CreateRoomTypeRequest {
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  bedType?: string;
  squareMeters?: number;
  imageUrl?: string;
}

export interface UpdateRoomTypeRequest extends CreateRoomTypeRequest {}
