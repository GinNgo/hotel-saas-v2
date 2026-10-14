/**
 * Bộ tiện ích xử lý xung đột đồng thời 409 (ERR_STALE_STATE) buồng phòng (Phụ trách: Tân)
 */
import { RoomStatus, ROOM_STATUS_LABELS } from '../models/enums';

export interface ConcurrencyErrorResolution {
  isHandled: boolean;
  userMessage: string;
  shouldRefreshList: boolean;
}

/**
 * Xử lý lỗi HTTP phản hồi khi cập nhật trạng thái phòng.
 * Nhận diện mã 409 Conflict hoặc ERR_STALE_STATE để sinh thông báo hướng dẫn.
 */
export function handleRoomStatusConcurrencyError(
  error: any,
  roomNumber: string,
  targetStatus: RoomStatus
): ConcurrencyErrorResolution {
  const status = error?.status;
  const errorCode = error?.error?.code || error?.error?.errorCode;
  const targetLabel = ROOM_STATUS_LABELS[targetStatus] || 'mới';

  if (status === 409 || errorCode === 'ERR_STALE_STATE') {
    return {
      isHandled: true,
      userMessage: `Phòng ${roomNumber} đã bị thay đổi trạng thái bởi một nhân viên khác trước khi bạn chuyển sang '${targetLabel}'. Hệ thống đang tự động tải lại dữ liệu mới nhất!`,
      shouldRefreshList: true
    };
  }

  if (status === 403) {
    return {
      isHandled: true,
      userMessage: `Bạn không có quyền cập nhật trạng thái buồng phòng tại chi nhánh này.`,
      shouldRefreshList: false
    };
  }

  return {
    isHandled: false,
    userMessage: error?.error?.message || `Không thể cập nhật trạng thái phòng ${roomNumber}. Vui lòng thử lại.`,
    shouldRefreshList: false
  };
}
