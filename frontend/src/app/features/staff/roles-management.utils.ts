import {
  PermissionFunctionDto,
  RoleDetailDto,
  RolePermissionDto
} from '../../core/models/staff.model';

export type RoleScopeFilter = 'ALL' | 'SYSTEM' | 'CUSTOM';
export type RoleStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ASSIGNED' | 'UNASSIGNED';
export type RolePermissionLevelFilter = 'ALL' | 'FULL_ACCESS' | 'OPERATIONAL' | 'LIMITED';

export interface PermissionMatrixRow {
  functionId: string;
  code: string;
  name: string;
  moduleCode: string;
  moduleName?: string;
  description?: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface RolePermissionStats {
  modulesWithAccess: number;
  totalCrudGrants: number;
  fullAccessModules: number;
  totalMaskScore: number;
  maxPossibleScore: number;
}

export interface FunctionLocaleMeta {
  name: string;
  moduleName: string;
  description: string;
}

/**
 * Trọng số điểm phân quyền theo chuẩn Bitmask (1 - 2 - 4 - 8 = Tổng 15 điểm)
 */
export const CRUD_BIT_WEIGHTS = {
  READ: 1,   // 2^0 = 1 điểm (Xem)
  CREATE: 2, // 2^1 = 2 điểm (Thêm)
  UPDATE: 4, // 2^2 = 4 điểm (Sửa)
  DELETE: 8, // 2^3 = 8 điểm (Xóa)
  FULL: 15   // 1 + 2 + 4 + 8 = 15 điểm (Toàn quyền)
} as const;

/**
 * Từ điển chuẩn hóa tên Tiếng Việt cho toàn bộ các phân hệ & tính năng trong hệ thống
 */
export const VIETNAMESE_FUNCTION_META: Record<string, FunctionLocaleMeta> = {
  DASHBOARD: {
    name: 'Bảng điều khiển & Tổng quan',
    moduleName: 'Điều hành chung',
    description: 'Theo dõi chỉ số KPI, công suất phòng và biểu đồ doanh thu thời gian thực'
  },
  PROPERTIES: {
    name: 'Quản lý Cơ sở & Chi nhánh',
    moduleName: 'Chuỗi khách sạn',
    description: 'Cấu hình thông tin khách sạn, chi nhánh, chính sách nhận/trả phòng'
  },
  ROOMS: {
    name: 'Quản lý Sơ đồ & Phòng lưu trú',
    moduleName: 'Quản lý phòng',
    description: 'Quản lý danh sách phòng, tầng, trạng thái phòng trên sơ đồ Room Rack'
  },
  ROOM_TYPES: {
    name: 'Hạng phòng & Biểu giá (Rates)',
    moduleName: 'Quản lý phòng',
    description: 'Thiết lập loại phòng, sức chứa, tiện nghi và chính sách giá theo mùa'
  },
  RESERVATIONS: {
    name: 'Quản lý Đặt phòng & Lưu trú',
    moduleName: 'Lễ tân & Đặt phòng',
    description: 'Tạo booking mới, giữ phòng, điều chỉnh lịch lưu trú và phân bổ phòng'
  },
  CHECK_IN_OUT: {
    name: 'Nghiệp vụ Nhận / Trả phòng (Check-in/out)',
    moduleName: 'Lễ tân & Đặt phòng',
    description: 'Thực hiện thủ tục nhận phòng, đổi phòng, trả phòng và kiểm tra phụ thu'
  },
  HOUSEKEEPING: {
    name: 'Điều phối Buồng phòng & Vệ sinh',
    moduleName: 'Buồng phòng',
    description: 'Phân công dọn phòng, cập nhật trạng thái bẩn/sạch và ghi nhận bảo trì'
  },
  PAYMENTS: {
    name: 'Thu ngân & Giao dịch Thanh toán',
    moduleName: 'Tài chính & Thu ngân',
    description: 'Ghi nhận thanh toán tiền mặt, chuyển khoản VietQR, thẻ và hoàn tiền'
  },
  INVOICES: {
    name: 'Quản lý Hóa đơn & Công nợ Folio',
    moduleName: 'Tài chính & Thu ngân',
    description: 'Phát hành hóa đơn thanh toán, quản lý công nợ khách đoàn và in phiếu thu'
  },
  GUESTS: {
    name: 'Hồ sơ Khách hàng (CRM)',
    moduleName: 'Khách hàng',
    description: 'Quản lý thông tin định danh CCCD/Passport, lịch sử lưu trú và hạng thẻ VIP'
  },
  REVIEWS: {
    name: 'Đánh giá & Phản hồi Khách lưu trú',
    moduleName: 'Khách hàng',
    description: 'Kiểm duyệt nhận xét, phản hồi đánh giá chất lượng dịch vụ của khách'
  },
  STAFF: {
    name: 'Quản lý Hồ sơ Nhân sự',
    moduleName: 'Nhân sự & Bảo mật',
    description: 'Tạo tài khoản nhân viên, phân công chi nhánh làm việc và khóa tài khoản'
  },
  ROLES: {
    name: 'Quản trị Vai trò & Cấp quyền (RBAC)',
    moduleName: 'Nhân sự & Bảo mật',
    description: 'Thiết lập chức vụ tùy biến và cấu hình ma trận điểm phân quyền CRUD'
  },
  REPORTS: {
    name: 'Báo cáo Doanh thu & Thống kê',
    moduleName: 'Báo cáo & Phân tích',
    description: 'Xem báo cáo doanh thu, công suất khai thác (RevPAR, ADR) và xuất dữ liệu'
  },
  PROMOTIONS: {
    name: 'Chương trình Khuyến mãi & Voucher',
    moduleName: 'Kinh doanh & Tiếp thị',
    description: 'Tạo mã giảm giá, chiến dịch ưu đãi theo mùa và gói combo nghỉ dưỡng'
  },
  SUBSCRIPTIONS: {
    name: 'Gói cước SaaS & Hợp đồng Nền tảng',
    moduleName: 'Hệ thống & Gói cước',
    description: 'Quản lý gói thuê bao phần mềm, hạn mức chi nhánh và lịch sử gia hạn'
  },
  SETTINGS: {
    name: 'Cấu hình Hệ thống & Mẫu in',
    moduleName: 'Hệ thống & Gói cước',
    description: 'Tùy chỉnh thông số vận hành, mẫu hóa đơn, thông báo và tích hợp cổng'
  },
  AI_FEATURES: {
    name: 'Tự động hóa & Gợi ý Vận hành',
    moduleName: 'Tiện ích nâng cao',
    description: 'Phân tích xu hướng công suất và tối ưu hóa vận hành chi nhánh tự động'
  },
  AUDIT_LOGS: {
    name: 'Nhật ký Kiểm toán & Bảo mật (Audit)',
    moduleName: 'Nhân sự & Bảo mật',
    description: 'Tra cứu lịch sử thao tác Thêm/Sửa/Xóa dữ liệu và xuất báo cáo tuân thủ'
  }
};

/**
 * Từ điển chuẩn hóa tên & mô tả Tiếng Việt cho các Vai trò mặc định hệ thống
 */
export const VIETNAMESE_ROLE_META: Record<string, { name: string; description: string }> = {
  OWNER: {
    name: 'Chủ chuỗi Khách sạn (Hotel Owner)',
    description: 'Toàn quyền quản trị hệ thống chuỗi khách sạn, cấu hình chi nhánh, gói cước và phân quyền nhân sự.'
  },
  MANAGER: {
    name: 'Quản lý Chi nhánh (Hotel Manager)',
    description: 'Quản lý vận hành chi nhánh, điều phối buồng phòng, phê duyệt biểu giá và giám sát nhân sự ca trực.'
  },
  RECEPTIONIST: {
    name: 'Lễ tân & Thu ngân (Receptionist)',
    description: 'Tiếp đón khách lưu trú, xử lý đặt phòng, thực hiện thủ tục Check-in / Check-out và lập hóa đơn thanh toán.'
  },
  HOUSEKEEPER: {
    name: 'Nhân viên Buồng phòng (Housekeeper)',
    description: 'Xem sơ đồ phòng, cập nhật tiến độ dọn dẹp vệ sinh, kiểm tra minibar và báo cáo bảo trì thiết bị.'
  },
  ACCOUNTANT: {
    name: 'Kế toán Nội bộ (Accountant)',
    description: 'Kiểm soát thu chi, đối soát giao dịch thanh toán, quản lý hóa đơn VAT và xuất báo cáo tài chính.'
  },
  SUPER_ADMIN: {
    name: 'Quản trị Nền tảng (SuperAdmin)',
    description: 'Quản trị toàn diện hạ tầng nền tảng SaaS, đối tác chuỗi khách sạn, gói cước và bảo mật hệ thống.'
  },
  SUPERADMIN: {
    name: 'Quản trị Nền tảng (SuperAdmin)',
    description: 'Quản trị toàn diện hạ tầng nền tảng SaaS, đối tác chuỗi khách sạn, gói cước và bảo mật hệ thống.'
  }
};

/**
 * Trả về tên Tiếng Việt chuẩn của tính năng dựa trên mã code
 */
export function getVietnameseFunctionName(code: string, fallbackName?: string): string {
  const key = (code || '').trim().toUpperCase();
  return VIETNAMESE_FUNCTION_META[key]?.name || fallbackName || key;
}

/**
 * Trả về tên nhóm phân hệ Tiếng Việt dựa trên mã code hoặc moduleCode
 */
export function getVietnameseModuleName(code: string, moduleCode?: string): string {
  const key = (code || '').trim().toUpperCase();
  if (VIETNAMESE_FUNCTION_META[key]) {
    return VIETNAMESE_FUNCTION_META[key].moduleName;
  }
  const modKey = (moduleCode || '').trim().toUpperCase();
  return VIETNAMESE_FUNCTION_META[modKey]?.moduleName || moduleCode || 'Phân hệ chung';
}

/**
 * Trả về mô tả Tiếng Việt của tính năng
 */
export function getVietnameseFunctionDescription(code: string): string {
  const key = (code || '').trim().toUpperCase();
  return VIETNAMESE_FUNCTION_META[key]?.description || 'Phân quyền thao tác nghiệp vụ trên phân hệ này';
}

/**
 * Chuẩn hóa đối tượng PermissionFunctionDto sang Tiếng Việt
 */
export function localizePermissionFunction(func: PermissionFunctionDto): PermissionFunctionDto {
  return {
    ...func,
    name: getVietnameseFunctionName(func.code, func.name)
  };
}

/**
 * Chuẩn hóa đối tượng RoleDetailDto (tên vai trò, mô tả mặc định và tên các tính năng) sang Tiếng Việt
 */
export function localizeRoleDetail(role: RoleDetailDto): RoleDetailDto {
  const codeKey = (role.code || '').trim().toUpperCase();
  const meta = VIETNAMESE_ROLE_META[codeKey];

  const isDefaultEnglishName =
    role.name === 'Hotel Owner' ||
    role.name === 'Hotel Manager' ||
    role.name === 'Receptionist' ||
    role.name === 'Housekeeper' ||
    role.name === 'Super Administrator';

  const isDefaultEnglishDesc =
    !role.description ||
    role.description.startsWith('Full property access') ||
    role.description.startsWith('Operational management') ||
    role.description.startsWith('Front desk operations') ||
    role.description.startsWith('View rooms and manage') ||
    role.description.startsWith('Full system');

  return {
    ...role,
    name: isDefaultEnglishName && meta ? meta.name : role.name,
    description: isDefaultEnglishDesc && meta ? meta.description : role.description,
    permissions: (role.permissions || []).map(p => ({
      ...p,
      functionName: getVietnameseFunctionName(p.functionCode, p.functionName)
    }))
  };
}

/**
 * Tính điểm Bitmask của 1 dòng phân quyền (Xem=1, Thêm=2, Sửa=4, Xóa=8, Tối đa=15)
 */
export function calculateRowMaskScore(
  row: Pick<PermissionMatrixRow, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>
): number {
  return (
    (row.canRead ? CRUD_BIT_WEIGHTS.READ : 0) +
    (row.canCreate ? CRUD_BIT_WEIGHTS.CREATE : 0) +
    (row.canUpdate ? CRUD_BIT_WEIGHTS.UPDATE : 0) +
    (row.canDelete ? CRUD_BIT_WEIGHTS.DELETE : 0)
  );
}

/**
 * Phân loại nhãn cấp độ dựa trên tổ hợp quyền CRUD (ẩn điểm số nội bộ với người dùng)
 */
export function getScoreLevelMeta(score: number): {
  label: string;
  badgeClass: string;
} {
  if (score === 15) {
    return {
      label: 'Toàn quyền',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  if (score >= 7) {
    return {
      label: 'Nghiệp vụ',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
  }
  if (score >= 3) {
    return {
      label: 'Tác nghiệp',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
    };
  }
  if (score >= 1) {
    return {
      label: 'Chỉ xem',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }
  return {
    label: 'Chưa cấp',
    badgeClass: 'bg-slate-100 text-slate-400 border-slate-200'
  };
}

/**
 * Xử lý bật/tắt từng quyền CRUD theo cơ chế phân cấp phụ thuộc (Cascading RBAC):
 * - Khi bật Thêm / Sửa / Xóa -> tự động bật quyền Xem (Read).
 * - Khi tắt Xem (Read) -> tự động tắt Thêm / Sửa / Xóa của tính năng đó.
 */
export function toggleCrudCellWithCascade<
  T extends Pick<PermissionMatrixRow, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>
>(row: T, col: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'): T {
  const nextVal = !row[col];
  if (col === 'canRead') {
    if (!nextVal) {
      return {
        ...row,
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false
      };
    }
    return { ...row, canRead: true };
  }

  return {
    ...row,
    [col]: nextVal,
    canRead: nextVal ? true : row.canRead
  };
}

/**
 * Áp dụng mức điểm Bitmask (VD: 0, 1, 3, 7, 15) vào một dòng phân quyền
 */
export function applyScoreMaskToRow<T extends Pick<PermissionMatrixRow, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>>(
  row: T,
  maskScore: number
): T {
  return {
    ...row,
    canRead: (maskScore & CRUD_BIT_WEIGHTS.READ) !== 0,
    canCreate: (maskScore & CRUD_BIT_WEIGHTS.CREATE) !== 0,
    canUpdate: (maskScore & CRUD_BIT_WEIGHTS.UPDATE) !== 0,
    canDelete: (maskScore & CRUD_BIT_WEIGHTS.DELETE) !== 0
  };
}

/**
 * Computes a concise CRUD string (e.g. "RCUD", "RU", "R") from a RolePermissionDto
 */
export function formatCrudBadge(
  p: Pick<RolePermissionDto, 'actionMask' | 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>
): string {
  const letters: string[] = [];
  const canRead = p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0;
  const canCreate = p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0;
  const canUpdate = p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0;
  const canDelete = p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0;

  if (canRead) letters.push('R');
  if (canCreate) letters.push('C');
  if (canUpdate) letters.push('U');
  if (canDelete) letters.push('D');
  return letters.join('');
}

/**
 * Computes aggregate permission metrics & total bitmask points for a role row
 */
export function countActivePermissions(
  permissions: Array<Pick<RolePermissionDto, 'actionMask' | 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>>,
  totalModuleCount = 17
): RolePermissionStats {
  let modulesWithAccess = 0;
  let totalCrudGrants = 0;
  let fullAccessModules = 0;
  let totalMaskScore = 0;

  for (const p of permissions || []) {
    const canRead = p.canRead !== undefined ? p.canRead : (p.actionMask & 1) !== 0;
    const canCreate = p.canCreate !== undefined ? p.canCreate : (p.actionMask & 2) !== 0;
    const canUpdate = p.canUpdate !== undefined ? p.canUpdate : (p.actionMask & 4) !== 0;
    const canDelete = p.canDelete !== undefined ? p.canDelete : (p.actionMask & 8) !== 0;

    const rowScore = calculateRowMaskScore({ canRead, canCreate, canUpdate, canDelete });
    totalMaskScore += rowScore;

    const badge = formatCrudBadge(p);
    if (badge.length > 0) {
      modulesWithAccess += 1;
      totalCrudGrants += badge.length;
      if (badge.length === 4) {
        fullAccessModules += 1;
      }
    }
  }

  return {
    modulesWithAccess,
    totalCrudGrants,
    fullAccessModules,
    totalMaskScore,
    maxPossibleScore: Math.max(totalModuleCount, (permissions || []).length) * 15
  };
}

/**
 * Checks whether a role is currently active (defaults to true when not explicitly set to false)
 */
export function isRoleActive(role: Pick<RoleDetailDto, 'isActive'>): boolean {
  return role.isActive !== false;
}

/**
 * Classifies a role's permission coverage tier based on active feature modules
 */
export function getRolePermissionLevel(
  role: Pick<RoleDetailDto, 'permissions'>
): 'FULL_ACCESS' | 'OPERATIONAL' | 'LIMITED' {
  const stats = countActivePermissions(role.permissions || []);
  if (stats.modulesWithAccess >= 14) {
    return 'FULL_ACCESS';
  }
  if (stats.modulesWithAccess >= 5) {
    return 'OPERATIONAL';
  }
  return 'LIMITED';
}

/**
 * Filters roles by search keyword (matching name, code, or description),
 * role scope (system vs custom), role status (active, inactive, assigned, unassigned),
 * and permission coverage level.
 */
export function filterRoles(
  roles: RoleDetailDto[],
  searchQuery: string,
  scopeFilter: RoleScopeFilter = 'ALL',
  statusFilter: RoleStatusFilter = 'ALL',
  permissionLevelFilter: RolePermissionLevelFilter = 'ALL'
): RoleDetailDto[] {
  const q = (searchQuery || '').trim().toLowerCase();

  return (roles || []).filter(role => {
    // 1. Scope / Type filter
    if (scopeFilter === 'SYSTEM' && !role.isSystemRole) return false;
    if (scopeFilter === 'CUSTOM' && role.isSystemRole) return false;

    // 2. Role Status filter
    const active = isRoleActive(role);
    const staffCount = role.staffCount || 0;
    if (statusFilter === 'ACTIVE' && !active) return false;
    if (statusFilter === 'INACTIVE' && active) return false;
    if (statusFilter === 'ASSIGNED' && staffCount <= 0) return false;
    if (statusFilter === 'UNASSIGNED' && staffCount > 0) return false;

    // 3. Permission Level filter
    if (permissionLevelFilter !== 'ALL') {
      const level = getRolePermissionLevel(role);
      if (level !== permissionLevelFilter) return false;
    }

    // 4. Search keyword filter
    if (!q) return true;

    const nameMatch = (role.name || '').toLowerCase().includes(q);
    const codeMatch = (role.code || '').toLowerCase().includes(q);
    const descMatch = (role.description || '').toLowerCase().includes(q);

    return nameMatch || codeMatch || descMatch;
  });
}

/**
 * Normalizes a role code into uppercase alphanumeric with underscores
 */
export function normalizeRoleCode(rawCode: string): string {
  return (rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}
