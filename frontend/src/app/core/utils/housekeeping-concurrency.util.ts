/**
 * Bộ tiện ích xử lý xung đột đồng thời 409 (ERR_STALE_STATE) buồng phòng (Phụ trách: Tân)
 */
import { RoomStatus, ROOM_STATUS_LABELS } from '../models/enums';

export interface ConcurrencyErrorResolution {
  isHandled: boolean;
  userMessage: string;
  shouldRefreshList: boolean;
}

interface ParsedConcurrencyHttpError {
  status?: number;
  code?: string;
  errorCode?: string;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseConcurrencyHttpError(error: unknown): ParsedConcurrencyHttpError {
  if (!isRecord(error)) {
    return {};
  }

  const status = typeof error['status'] === 'number' ? error['status'] : undefined;
  const rawPayload = error['error'];
  if (!isRecord(rawPayload)) {
    return { status };
  }

  return {
    status,
    code: readOptionalString(rawPayload['code']),
    errorCode: readOptionalString(rawPayload['errorCode']),
    message: readOptionalString(rawPayload['message'])
  };
}

/**
 * Xử lý lỗi HTTP phản hồi khi cập nhật trạng thái phòng.
 * Nhận diện mã 409 Conflict hoặc ERR_STALE_STATE để sinh thông báo hướng dẫn.
 */
export function handleRoomStatusConcurrencyError(
  error: unknown,
  roomNumber: string,
  targetStatus: RoomStatus
): ConcurrencyErrorResolution {
  const parsed = parseConcurrencyHttpError(error);
  const status = parsed.status;
  const errorCode = parsed.code || parsed.errorCode;
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
    userMessage: parsed.message || `Không thể cập nhật trạng thái phòng ${roomNumber}. Vui lòng thử lại.`,
    shouldRefreshList: false
  };
}
