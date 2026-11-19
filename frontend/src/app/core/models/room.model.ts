import { RoomStatus } from './enums';

/** Room DTO — khớp backend RoomDto */
export interface RoomDto {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  isActive: boolean;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  basePrice: number;
  createdAtUtc: string;
  propertyId?: string;
  propertyName?: string | null;
}

export interface CreateRoomRequest {
  roomNumber: string;
  roomTypeId: string;
  floor: number;
  notes?: string;
}

export interface UpdateRoomRequest {
  roomNumber: string;
  roomTypeId: string;
  floor: number;
  notes?: string;
  isActive: boolean;
}
