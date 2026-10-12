/**
 * Bộ tiện ích lọc danh mục hạng phòng (Phụ trách: Nguyên)
 */
import { RoomTypeDto } from '../../models/room-type.model';

export interface RoomTypeFilterCriteria {
  minPrice?: number;
  maxPrice?: number;
  minOccupancy?: number;
  searchTerm?: string;
}

/**
 * Lọc danh sách hạng phòng theo tiêu chí giá, sức chứa và tên phòng.
 */
export function filterRoomTypes(
  roomTypes: RoomTypeDto[],
  criteria: RoomTypeFilterCriteria
): RoomTypeDto[] {
  if (!roomTypes || roomTypes.length === 0) return [];

  return roomTypes.filter(rt => {
    // 1. Lọc theo giá tối thiểu
    if (criteria.minPrice !== undefined && rt.basePrice < criteria.minPrice) {
      return false;
    }

    // 2. Lọc theo giá tối đa
    if (criteria.maxPrice !== undefined && rt.basePrice > criteria.maxPrice) {
      return false;
    }

    // 3. Lọc theo sức chứa tối thiểu
    if (criteria.minOccupancy !== undefined && rt.maxOccupancy < criteria.minOccupancy) {
      return false;
    }

    // 4. Lọc theo từ khóa tìm kiếm (tên hoặc mã phòng)
    if (criteria.searchTerm && criteria.searchTerm.trim() !== '') {
      const term = criteria.searchTerm.trim().toLowerCase();
      const matchName = rt.name?.toLowerCase().includes(term);
      const matchCode = rt.code?.toLowerCase().includes(term);
      if (!matchName && !matchCode) {
        return false;
      }
    }

    return true;
  });
}
