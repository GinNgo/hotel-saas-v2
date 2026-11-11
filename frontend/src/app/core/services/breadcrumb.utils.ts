export interface BreadcrumbItem {
  label: string;
  url: string;
  icon?: string;
  isLast: boolean;
}

/**
 * Route dictionary mapping URL segments to readable Vietnamese display names and icons.
 */
export const ROUTE_SEGMENT_MAP: Record<string, { label: string; icon?: string }> = {
  // Admin Root / Dashboard
  admin: { label: 'Quản trị', icon: 'pi pi-shield' },
  dashboard: { label: 'Tổng quan', icon: 'pi pi-home' },

  // Operational Modules
  properties: { label: 'Cơ sở & Chi nhánh', icon: 'pi pi-building' },
  rooms: { label: 'Quản lý phòng', icon: 'pi pi-th-large' },
  'room-types': { label: 'Loại phòng', icon: 'pi pi-tags' },
  housekeeping: { label: 'Buồng phòng', icon: 'pi pi-sparkles' },
  policies: { label: 'Chính sách & Mẫu in', icon: 'pi pi-sliders-h' },
  rates: { label: 'Bảng giá phòng', icon: 'pi pi-dollar' },
  reservations: { label: 'Đặt phòng', icon: 'pi pi-calendar' },
  payments: { label: 'Thu ngân & Giao dịch', icon: 'pi pi-wallet' },
  reports: { label: 'Báo cáo & Thống kê', icon: 'pi pi-chart-bar' },
  subscriptions: { label: 'Gói cước SaaS', icon: 'pi pi-box' },
  guests: { label: 'Khách hàng (CRM)', icon: 'pi pi-id-card' },
  staff: { label: 'Nhân sự & Phân quyền', icon: 'pi pi-users' },
  roles: { label: 'Quản lý Vai trò', icon: 'pi pi-shield' },
  'audit-logs': { label: 'Nhật ký kiểm toán', icon: 'pi pi-history' },
  'ops-readiness': { label: 'Giám sát SRE', icon: 'pi pi-server' },
  plans: { label: 'Cấu hình gói Tenant', icon: 'pi pi-sliders-v' },
  contracts: { label: 'Hợp đồng Đối tác', icon: 'pi pi-file-edit' },

  // Public Booking / Portal Modules
  booking: { label: 'Cổng Đặt phòng', icon: 'pi pi-globe' },
  explore: { label: 'Tìm kiếm phòng', icon: 'pi pi-search' },
  destinations: { label: 'Điểm đến du lịch', icon: 'pi pi-compass' },
  brands: { label: 'Chuỗi thương hiệu', icon: 'pi pi-star' },
  deals: { label: 'Ưu đãi đặc quyền', icon: 'pi pi-tag' },
  lookup: { label: 'Tra cứu đặt phòng', icon: 'pi pi-search' },
  hold: { label: 'Giữ phòng', icon: 'pi pi-clock' },
  checkout: { label: 'Thanh toán đặt phòng', icon: 'pi pi-credit-card' },
  status: { label: 'Trạng thái đơn đặt', icon: 'pi pi-check-circle' },
  profile: { label: 'Hồ sơ khách hàng', icon: 'pi pi-user' },
  auth: { label: 'Xác thực', icon: 'pi pi-lock' },
  login: { label: 'Đăng nhập', icon: 'pi pi-sign-in' },
  register: { label: 'Đăng ký', icon: 'pi pi-user-plus' },
  'partner-register': { label: 'Đăng ký Đối tác', icon: 'pi pi-briefcase' }
};

/**
 * Builds breadcrumb items from a raw URL path.
 * Handles query parameters, trailing slashes, root route, and nested sub-paths.
 */
export function buildBreadcrumbItems(rawUrl: string): BreadcrumbItem[] {
  if (!rawUrl) {
    return [
      { label: 'Trang chủ', url: '/dashboard', icon: 'pi pi-home', isLast: true }
    ];
  }

  // Strip query parameters and hashes
  const cleanPath = rawUrl.split('?')[0].split('#')[0];
  const segments = cleanPath
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [
      { label: 'Trang chủ', url: '/dashboard', icon: 'pi pi-home', isLast: true }
    ];
  }

  // Determine root home item based on portal context
  const isPublicBooking = segments[0] === 'booking';
  const homeItem: BreadcrumbItem = isPublicBooking
    ? { label: 'Trang chủ', url: '/booking', icon: 'pi pi-globe', isLast: segments.length === 1 && segments[0] === 'booking' }
    : { label: 'Trang chủ', url: '/dashboard', icon: 'pi pi-home', isLast: segments.length === 1 && segments[0] === 'dashboard' };

  // If we are strictly on the landing root page (/dashboard or /booking), return single item
  if ((isPublicBooking && segments.length === 1) || (!isPublicBooking && segments.length === 1 && segments[0] === 'dashboard')) {
    return [homeItem];
  }

  const items: BreadcrumbItem[] = [homeItem];
  let accumulatedPath = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    accumulatedPath += `/${seg}`;

    // Skip redundant segments that equal the home item url
    if (accumulatedPath === homeItem.url) {
      continue;
    }

    const mapping = ROUTE_SEGMENT_MAP[seg];
    const isLast = i === segments.length - 1;

    let label = mapping?.label;
    let icon = mapping?.icon;

    if (!label) {
      // Dynamic route parameters (IDs, slugs, etc.)
      label = formatDynamicSegmentLabel(seg);
      icon = 'pi pi-file';
    }

    items.push({
      label,
      url: accumulatedPath,
      icon,
      isLast
    });
  }

  // Ensure only the very last item has isLast: true
  return items.map((item, idx) => ({
    ...item,
    isLast: idx === items.length - 1
  }));
}

/**
 * Formats dynamic path segments (e.g., 'cho-dem-da-lat' or UUID) into readable text.
 */
export function formatDynamicSegmentLabel(seg: string): string {
  if (!seg) return '';
  // Check if it's a GUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
    return `Chi tiết #${seg.slice(0, 8)}`;
  }
  // Turn slug words with hyphens into title case
  return seg
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
