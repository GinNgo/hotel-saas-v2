/**
 * Tiện ích xử lý Ngày giờ & Múi giờ nghiệp vụ Hotel SaaS
 * Múi giờ nghiệp vụ chuẩn: Asia/Ho_Chi_Minh (UTC+7, không có Daylight Saving Time).
 *
 * Nguyên tắc:
 * 1. Validate YYYY-MM-DD nghiêm ngặt, kiểm tra ngày thực sự tồn tại trong lịch.
 *    Từ chối tuyệt đối 31/02, 31/04, 29/02 năm không nhuận; KHÔNG tự động normalize/rollover.
 * 2. Date-only giữ nguyên giá trị ngày lịch (calendar date: YYYY-MM-DD), tuyệt đối không chuyển UTC tùy tiện.
 * 3. Khi truy vấn timestamp từ ngày lịch, quy đổi biên ngày sang khoảng nửa mở [startUtc, endExclusiveUtc)
 *    theo đúng múi giờ Asia/Ho_Chi_Minh (UTC+7).
 * 4. Timestamp từ backend luôn được hiển thị theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh (dd/mm/yyyy HH:mm, 24 giờ),
 *    hoàn toàn độc lập với múi giờ của máy khách/trình duyệt.
 */

export const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const BUSINESS_TIMEZONE_OFFSET_HOURS = 7;

/**
 * Kiểm tra một năm có phải năm nhuận hay không (theo lịch Gregory).
 * Năm nhuận chia hết cho 4, ngoại trừ năm tròn thế kỷ không chia hết cho 400.
 */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Lấy số ngày tối đa thực tế trong tháng của một năm cụ thể.
 * Tháng 1-indexed (1 = Tháng 1, ..., 12 = Tháng 12).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return 0;
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12:
      return 31;
    case 4: case 6: case 9: case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Kiểm tra tính hợp lệ nghiêm ngặt của ngày lịch:
 * - Năm từ 1000 đến 9999.
 * - Tháng từ 1 đến 12.
 * - Ngày thực sự tồn tại trong tháng (từ chối 31/02, 31/04, 29/02 năm thường).
 * - Không cho phép tự động normalize sang tháng tiếp theo.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  const maxDays = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDays;
}

/**
 * Phân tích chuỗi ngày 'YYYY-MM-DD' thành các thành phần số nguyên với kiểm tra nghiêm ngặt:
 * - Đúng định dạng 'YYYY-MM-DD' (4 chữ số năm, 2 chữ số tháng, 2 chữ số ngày).
 * - Ngày phải thực sự tồn tại trong lịch (từ chối 2026-02-31, 2026-04-31, 2025-02-29).
 * - Trả về null nếu không hợp lệ; KHÔNG tự động sửa hoặc normalize.
 */
export function parseDateParts(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // Kiểm tra định dạng YYYY-MM-DD nghiêm ngặt
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parts = trimmed.split('-').map(Number);
  const [year, month, day] = parts;

  // Kiểm tra ngày thực sự tồn tại trong lịch
  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  return { year, month, day };
}

/**
 * Chuyển đối tượng Date thành chuỗi ngày lịch 'YYYY-MM-DD'.
 * Giữ nguyên ngày theo lịch người dùng nhìn thấy, KHÔNG dùng toISOString() gây lệch múi giờ.
 */
export function formatCalendarDate(d: Date | null | undefined): string {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Chuyển chuỗi 'YYYY-MM-DD' thành đối tượng Date cho PrimeNG p-datepicker.
 * Thiết lập giờ 12:00:00 (buổi trưa) để bảo vệ an toàn trước bất kỳ độ lệch múi giờ hay DST nào của máy khách.
 * Trả về null nếu chuỗi ngày không hợp lệ hoặc không tồn tại trong lịch.
 */
export function parseCalendarDate(dateStr: string | null | undefined): Date | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
}

/**
 * Tính thời điểm bắt đầu ngày (00:00:00) theo múi giờ nghiệp vụ (UTC+7), quy đổi thành chuỗi ISO UTC kết thúc bằng 'Z'.
 * Ví dụ: Ngày 09/10/2026 tại VN -> [2026-10-08T17:00:00.000Z].
 * Hoàn toàn không phụ thuộc vào múi giờ của trình duyệt/hệ điều hành.
 * Trả về chuỗi rỗng nếu ngày không hợp lệ.
 */
export function getStartOfDayUtc(dateStr: string, offsetHours: number = BUSINESS_TIMEZONE_OFFSET_HOURS): string {
  const p = parseDateParts(dateStr);
  if (!p) return '';
  const utcMs = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) - (offsetHours * 3600 * 1000);
  return new Date(utcMs).toISOString();
}

/**
 * Tính thời điểm bắt đầu của ngày kế tiếp (00:00:00 ngày hôm sau) theo múi giờ nghiệp vụ (UTC+7), quy đổi thành ISO UTC.
 * Dùng làm cận trên loại trừ (endExclusive) cho khoảng nửa mở [startUtc, endExclusiveUtc).
 * Ví dụ: Ngày 09/10/2026 tại VN -> endExclusive: 2026-10-09T17:00:00.000Z.
 * Trả về chuỗi rỗng nếu ngày không hợp lệ.
 */
export function getStartOfNextDayUtc(dateStr: string, offsetHours: number = BUSINESS_TIMEZONE_OFFSET_HOURS): string {
  const p = parseDateParts(dateStr);
  if (!p) return '';
  const utcMs = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) + (24 * 3600 * 1000) - (offsetHours * 3600 * 1000);
  return new Date(utcMs).toISOString();
}

/**
 * Định dạng timestamp (ISO UTC hoặc Date) thành chuỗi Ngày 'dd/mm/yyyy' theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh.
 */
export function formatBusinessDate(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return typeof isoOrDate === 'string' ? isoOrDate : '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

/**
 * Định dạng timestamp (ISO UTC hoặc Date) thành chuỗi Ngày & Giờ 'dd/mm/yyyy HH:mm' (24 giờ)
 * theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh.
 */
export function formatBusinessDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return typeof isoOrDate === 'string' ? isoOrDate : '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';

  return `${day}/${month}/${year} ${hour}:${minute}`;
}
