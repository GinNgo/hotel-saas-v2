export interface ActiveLoadingTask {
  id: string;
  label: string;
  method?: string;
  url?: string;
  startedAt: number;
}

export interface LoadingOverlayState {
  tasks: ActiveLoadingTask[];
}

export const DEFAULT_LOADING_LABEL = 'Đang xử lý dữ liệu...';
export const SKIP_OVERLAY_HEADER = 'X-Skip-Loading-Overlay';

const SILENT_URL_PATTERNS: readonly string[] = [
  '/hubs/notifications',
  '/health',
  '/metrics',
  '/api/notifications/unread-count'
];

/**
 * Determines whether an HTTP request should bypass the centralized loading overlay.
 */
export function shouldBypassGlobalOverlay(
  url: string,
  headers?: Record<string, string | null | undefined>
): boolean {
  if (!url) return false;

  if (headers) {
    const skipVal = headers[SKIP_OVERLAY_HEADER] ?? headers[SKIP_OVERLAY_HEADER.toLowerCase()];
    if (skipVal === 'true' || skipVal === '1') {
      return true;
    }
  }

  const normalized = url.toLowerCase();
  return SILENT_URL_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Resolves a human-friendly Vietnamese status message for an HTTP request.
 */
export function resolveContextualLoadingLabel(method: string, url: string): string {
  const m = (method || 'GET').toUpperCase();
  const u = (url || '').toLowerCase();

  if (u.includes('/auth/login') || u.includes('/auth/social-login')) {
    return 'Đang xác thực tài khoản...';
  }
  if (u.includes('/auth/switch-context')) {
    return 'Đang chuyển đổi ngữ cảnh chi nhánh...';
  }
  if (u.includes('/staff/roles') || u.includes('/roles')) {
    return m === 'GET' ? 'Đang tải danh sách vai trò & phân quyền...' : 'Đang lưu cấu hình phân quyền...';
  }
  if (u.includes('/staff')) {
    return m === 'GET' ? 'Đang tải danh sách nhân sự...' : 'Đang cập nhật hồ sơ nhân sự...';
  }
  if (u.includes('/payments') || u.includes('/vnpay') || u.includes('/vietqr')) {
    return m === 'GET' ? 'Đang tải dữ liệu thu ngân...' : 'Đang xử lý giao dịch thanh toán...';
  }
  if (u.includes('/reservations') || u.includes('/bookings')) {
    return m === 'GET' ? 'Đang tải thông tin đặt phòng...' : 'Đang cập nhật phiếu đặt phòng...';
  }
  if (u.includes('/rooms') || u.includes('/room-types') || u.includes('/housekeeping')) {
    return m === 'GET' ? 'Đang đồng bộ sơ đồ phòng...' : 'Đang cập nhật trạng thái phòng...';
  }
  if (u.includes('/audit-logs')) {
    return 'Đang truy xuất nhật ký kiểm toán...';
  }
  if (u.includes('/api/ai/chat')) {
    return 'Trợ lý AI Concierge đang phản hồi...';
  }

  if (m === 'POST') return 'Đang khởi tạo dữ liệu mới...';
  if (m === 'PUT' || m === 'PATCH') return 'Đang lưu thay đổi...';
  if (m === 'DELETE') return 'Đang xóa bản ghi...';

  return 'Đang tải dữ liệu hệ thống...';
}

/**
 * Pure state transition: adds or updates an active loading task.
 */
export function addLoadingTask(
  tasks: readonly ActiveLoadingTask[],
  task: ActiveLoadingTask
): ActiveLoadingTask[] {
  const filtered = tasks.filter(t => t.id !== task.id);
  return [...filtered, task];
}

/**
 * Pure state transition: removes a completed loading task by id.
 */
export function removeLoadingTask(
  tasks: readonly ActiveLoadingTask[],
  taskId: string
): ActiveLoadingTask[] {
  return tasks.filter(t => t.id !== taskId);
}

/**
 * Resolves the primary message to display on the overlay (most recent active task).
 */
export function selectPrimaryLoadingLabel(tasks: readonly ActiveLoadingTask[]): string {
  if (!tasks || tasks.length === 0) {
    return DEFAULT_LOADING_LABEL;
  }
  const latest = tasks[tasks.length - 1];
  return latest.label?.trim() || DEFAULT_LOADING_LABEL;
}
