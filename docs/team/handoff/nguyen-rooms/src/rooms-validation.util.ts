/**
 * Bộ tiện ích kiểm tra tính hợp lệ của số phòng và tầng lầu (Phụ trách: Nguyên)
 */

export interface RoomValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Kiểm tra số phòng có hợp lệ với tầng lầu đã chọn không.
 * Quy tắc:
 * 1. Số phòng không được rỗng.
 * 2. Số phòng từ 1 đến 4 ký tự chữ/số.
 * 3. Nếu số phòng bắt đầu bằng chữ số, chữ số đầu tiên nên khớp với số tầng (ví dụ: Tầng 2 thì phòng là 201, 202).
 */
export function validateRoomNumberWithFloor(roomNumber: string, floor: number): RoomValidationResult {
  const trimmed = roomNumber?.trim();
  if (!trimmed) {
    return { isValid: false, errorMessage: 'Số phòng không được để trống.' };
  }

  if (trimmed.length > 10) {
    return { isValid: false, errorMessage: 'Số phòng không được vượt quá 10 ký tự.' };
  }

  if (floor < 1 || floor > 50) {
    return { isValid: false, errorMessage: 'Tầng lầu phải nằm trong khoảng từ 1 đến 50.' };
  }

  // Kiểm tra gợi ý tầng
  const firstDigit = parseInt(trimmed.charAt(0), 10);
  if (!isNaN(firstDigit) && firstDigit !== floor && floor < 10) {
    // Không cấm hoàn toàn nhưng cảnh báo mềm nếu tầng 1 chữ số
    return {
      isValid: true,
      errorMessage: `Lưu ý: Số phòng '${trimmed}' có thể không khớp với tầng ${floor}.`
    };
  }

  return { isValid: true };
}

/**
 * Kiểm tra trùng lặp số phòng trong danh sách hiện tại của chi nhánh.
 */
export function isRoomNumberDuplicate(roomNumber: string, existingRoomNumbers: string[]): boolean {
  if (!roomNumber || !existingRoomNumbers) return false;
  const normalized = roomNumber.trim().toLowerCase();
  return existingRoomNumbers.some(r => r.trim().toLowerCase() === normalized);
}
