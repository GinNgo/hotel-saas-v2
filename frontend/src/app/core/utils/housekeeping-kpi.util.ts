/**
 * Bộ tiện ích tính toán các chỉ số KPI Buồng phòng (Phụ trách: Trần Trọng Tân - 24TX810025)
 */
import { RoomDto } from '../models/room.model';
import { RoomStatus } from '../models/enums';

export interface HousekeepingKpiMetrics {
  totalRooms: number;
  dirtyCount: number;
  cleaningCount: number;
  cleanCount: number;
  occupiedCount: number;
  outOfServiceCount: number;
  cleanRatePercent: number;
  turnaroundNeededCount: number;
}

/**
 * Tính toán các chỉ số KPI từ danh sách phòng hiện tại.
 */
export function calculateHousekeepingKpis(rooms: RoomDto[]): HousekeepingKpiMetrics {
  if (!rooms || rooms.length === 0) {
    return {
      totalRooms: 0,
      dirtyCount: 0,
      cleaningCount: 0,
      cleanCount: 0,
      occupiedCount: 0,
      outOfServiceCount: 0,
      cleanRatePercent: 0,
      turnaroundNeededCount: 0
    };
  }

  const total = rooms.length;
  let dirty = 0;
  let cleaning = 0;
  let clean = 0;
  let occupied = 0;
  let oos = 0;

  for (const r of rooms) {
    switch (r.status) {
      case RoomStatus.Dirty:
        dirty++;
        break;
      case RoomStatus.Cleaning:
        cleaning++;
        break;
      case RoomStatus.Clean:
        clean++;
        break;
      case RoomStatus.Occupied:
        occupied++;
        break;
      case RoomStatus.OutOfService:
        oos++;
        break;
    }
  }

  // Tỷ lệ phòng sạch sẵn sàng đón khách (%)
  const cleanRate = total > 0 ? Math.round((clean / total) * 100) : 0;
  // Số phòng cần nhân viên xử lý dọn dẹp (Bẩn + Đang dọn)
  const turnaroundNeeded = dirty + cleaning;

  return {
    totalRooms: total,
    dirtyCount: dirty,
    cleaningCount: cleaning,
    cleanCount: clean,
    occupiedCount: occupied,
    outOfServiceCount: oos,
    cleanRatePercent: cleanRate,
    turnaroundNeededCount: turnaroundNeeded
  };
}
