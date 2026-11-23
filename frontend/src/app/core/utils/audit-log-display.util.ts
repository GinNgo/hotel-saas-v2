/**
 * Tiện ích Việt hóa và chuẩn hóa hiển thị Nhật ký kiểm toán (Audit Logs)
 * dùng chung cho trang Audit Logs và Dashboard chủ khách sạn.
 */

export interface AuditSelectOption {
  value: string;
  label: string;
}

/** 18 hành động kiểm toán chuẩn (khớp 100% AllowedCanonicalActions của Backend) */
export const AUDIT_ACTION_OPTIONS: ReadonlyArray<AuditSelectOption> = [
  { value: 'Create', label: 'Tạo mới' },
  { value: 'Update', label: 'Chỉnh sửa' },
  { value: 'Delete', label: 'Xóa' },
  { value: 'Cancel', label: 'Hủy đặt phòng / giao dịch' },
  { value: 'Reschedule', label: 'Đổi lịch lưu trú' },
  { value: 'MarkNoShow', label: 'Đánh dấu No-Show' },
  { value: 'NightAuditAutoNoShow', label: 'Kiểm toán đêm tự động No-Show' },
  { value: 'RegenerateSmartLockPin', label: 'Cấp lại mã PIN khóa thông minh' },
  { value: 'RevokeSmartLockPin', label: 'Thu hồi mã PIN khóa thông minh' },
  { value: 'CheckInDepositWarning', label: 'Cảnh báo thiếu cọc khi Check-in' },
  { value: 'OverrideLateCheckOutSurcharge', label: 'Miễn / điều chỉnh phụ thu trả muộn' },
  { value: 'ApproveRefund', label: 'Duyệt hoàn tiền' },
  { value: 'RejectRefund', label: 'Từ chối hoàn tiền' },
  { value: 'ConfirmRefundPayout', label: 'Xác nhận chi hoàn tiền' },
  { value: 'StatusToggle', label: 'Đổi trạng thái' },
  { value: 'PublishApproval', label: 'Duyệt xuất bản cơ sở' },
  { value: 'Upgrade', label: 'Nâng cấp gói dịch vụ' },
  { value: 'LoginFailed', label: 'Đăng nhập thất bại' }
];

export const TENANT_AUDIT_ENTITY_OPTIONS: ReadonlyArray<AuditSelectOption> = [
  { value: 'Property', label: 'Cơ sở / Chi nhánh' },
  { value: 'Room', label: 'Phòng lưu trú' },
  { value: 'RoomType', label: 'Loại phòng' },
  { value: 'RoomTypeRate', label: 'Bảng giá phòng' },
  { value: 'PropertySurchargePolicy', label: 'Phụ thu chi nhánh' },
  { value: 'Reservation', label: 'Đơn đặt phòng' },
  { value: 'Payment', label: 'Thanh toán & Giao dịch' },
  { value: 'Invoice', label: 'Hóa đơn' },
  { value: 'GuestReview', label: 'Đánh giá khách lưu trú' },
  { value: 'TenantStaff', label: 'Tài khoản Nhân sự' },
  { value: 'AccessRole', label: 'Chức vụ & Quyền hạn' },
  { value: 'HousekeepingTask', label: 'Buồng phòng' },
  { value: 'Auth', label: 'Xác thực & Đăng nhập' },
  { value: 'SepayExpiredHoldAlert', label: 'Cảnh báo chuyển khoản quá hạn SePay' },
  { value: 'SepayBankAccountConfigWarning', label: 'Cảnh báo chưa cấu hình STK SePay' }
];

export const PLATFORM_AUDIT_ENTITY_OPTIONS: ReadonlyArray<AuditSelectOption> = [
  { value: 'Tenant', label: 'Doanh nghiệp / Chuỗi khách sạn' },
  { value: 'TenantStatus', label: 'Trạng thái thuê bao' },
  { value: 'PropertyPublishApproval', label: 'Duyệt xuất bản cơ sở' },
  { value: 'SubscriptionUpgrade', label: 'Nâng cấp gói cước' },
  { value: 'TenantContract', label: 'Hợp đồng SaaS' },
  { value: 'SubscriptionPlan', label: 'Gói dịch vụ SaaS' },
  { value: 'User', label: 'Tài khoản người dùng' }
];

export function getAuditActionLabel(action?: string | null): string {
  switch (action) {
    case 'Create': return 'Tạo mới';
    case 'Update': return 'Chỉnh sửa';
    case 'Delete': return 'Xóa';
    case 'StatusToggle': return 'Đổi trạng thái';
    case 'PublishApproval': return 'Duyệt xuất bản';
    case 'Upgrade': return 'Nâng cấp gói';
    case 'Cancel': return 'Hủy đặt phòng';
    case 'Reschedule': return 'Đổi lịch';
    case 'MarkNoShow': return 'Đánh dấu No-Show';
    case 'NightAuditAutoNoShow': return 'Night Audit No-Show';
    case 'RegenerateSmartLockPin': return 'Cấp lại mã PIN khóa thông minh';
    case 'RevokeSmartLockPin': return 'Thu hồi mã PIN khóa thông minh';
    case 'CheckInDepositWarning': return 'Cảnh báo thiếu cọc khi Check-in';
    case 'OverrideLateCheckOutSurcharge': return 'Miễn / điều chỉnh phụ thu trả muộn';
    case 'ApproveRefund': return 'Duyệt hoàn tiền';
    case 'RejectRefund': return 'Từ chối hoàn tiền';
    case 'ConfirmRefundPayout': return 'Xác nhận chi hoàn';
    case 'LoginFailed': return 'Đăng nhập thất bại';
    default: return action || 'Không xác định';
  }
}

export function getAuditActionBadgeClass(action?: string | null): string {
  switch (action) {
    case 'Create':
    case 'ApproveRefund':
    case 'ConfirmRefundPayout':
    case 'PublishApproval':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Update':
    case 'Reschedule':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Upgrade':
    case 'StatusToggle':
    case 'RegenerateSmartLockPin':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'MarkNoShow':
    case 'NightAuditAutoNoShow':
    case 'RevokeSmartLockPin':
    case 'CheckInDepositWarning':
    case 'OverrideLateCheckOutSurcharge':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Delete':
    case 'Cancel':
    case 'RejectRefund':
    case 'LoginFailed':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getAuditActionIcon(action?: string | null): string {
  switch (action) {
    case 'Create': return 'pi-plus-circle text-emerald-600 dark:text-emerald-400';
    case 'Update': return 'pi-pencil text-sky-600 dark:text-sky-400';
    case 'Delete': return 'pi-trash text-rose-600 dark:text-rose-400';
    case 'Cancel': return 'pi-times-circle text-rose-600 dark:text-rose-400';
    case 'Reschedule': return 'pi-calendar text-sky-600 dark:text-sky-400';
    case 'MarkNoShow': return 'pi-user-minus text-amber-600 dark:text-amber-400';
    case 'NightAuditAutoNoShow': return 'pi-moon text-amber-600 dark:text-amber-400';
    case 'RegenerateSmartLockPin': return 'pi-key text-indigo-600 dark:text-indigo-400';
    case 'RevokeSmartLockPin': return 'pi-lock text-amber-600 dark:text-amber-400';
    case 'CheckInDepositWarning': return 'pi-exclamation-triangle text-amber-600 dark:text-amber-400';
    case 'OverrideLateCheckOutSurcharge': return 'pi-sliders-h text-amber-600 dark:text-amber-400';
    case 'ApproveRefund': return 'pi-check-circle text-emerald-600 dark:text-emerald-400';
    case 'RejectRefund': return 'pi-ban text-rose-600 dark:text-rose-400';
    case 'ConfirmRefundPayout': return 'pi-wallet text-emerald-600 dark:text-emerald-400';
    case 'StatusToggle': return 'pi-sync text-indigo-600 dark:text-indigo-400';
    case 'PublishApproval': return 'pi-verified text-emerald-600 dark:text-emerald-400';
    case 'Upgrade': return 'pi-arrow-up-right text-indigo-600 dark:text-indigo-400';
    case 'LoginFailed': return 'pi-shield text-rose-600 dark:text-rose-400';
    default: return 'pi-info-circle text-slate-500 dark:text-slate-400';
  }
}

export function getAuditEntityDisplayLabel(name?: string | null): string {
  switch (name) {
    case 'Property': return 'Cơ sở & Chi nhánh';
    case 'Room': return 'Phòng lưu trú';
    case 'RoomType': return 'Loại phòng';
    case 'RoomTypeRate': return 'Bảng giá phòng';
    case 'PropertySurchargePolicy': return 'Phụ thu chi nhánh';
    case 'Reservation': return 'Đơn đặt phòng';
    case 'Payment': return 'Giao dịch thanh toán';
    case 'Invoice': return 'Hóa đơn thanh toán';
    case 'TenantStaff': return 'Tài khoản nhân sự';
    case 'AccessRole': return 'Chức vụ & Quyền hạn';
    case 'HousekeepingTask': return 'Nhiệm vụ buồng phòng';
    case 'Auth': return 'Xác thực & Đăng nhập';
    case 'SepayExpiredHoldAlert': return 'Cảnh báo chuyển khoản quá hạn SePay';
    case 'SepayBankAccountConfigWarning': return 'Cảnh báo chưa cấu hình STK SePay';
    case 'Tenant': return 'Doanh nghiệp / Chuỗi khách sạn';
    case 'TenantStatus': return 'Trạng thái thuê bao';
    case 'PropertyPublishApproval': return 'Duyệt xuất bản cơ sở';
    case 'SubscriptionUpgrade': return 'Nâng cấp gói cước';
    case 'GuestReview': return 'Đánh giá khách lưu trú';
    case 'TenantContract': return 'Hợp đồng SaaS';
    case 'SubscriptionPlan': return 'Gói cước SaaS';
    case 'User': return 'Tài khoản người dùng';
    default: return name || 'Bản ghi';
  }
}

function formatIsoShortDate(isoDateStr: string): string {
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
}

const CUSTOM_ACTION_SUMMARY_PHRASES: Record<string, (entityLabel: string) => string> = {
  RegenerateSmartLockPin: entity => `Cấp lại mã PIN khóa thông minh cho ${entity}`,
  RevokeSmartLockPin: entity => `Thu hồi mã PIN khóa thông minh của ${entity}`,
  ApproveRefund: entity => `Phê duyệt hoàn tiền cho ${entity}`,
  RejectRefund: entity => `Từ chối yêu cầu hoàn tiền cho ${entity}`,
  ConfirmRefundPayout: entity => `Xác nhận đã chi hoàn tiền cho ${entity}`,
  Cancel: entity => `Hủy ${entity}`,
  Reschedule: entity => `Đổi lịch lưu trú cho ${entity}`,
  MarkNoShow: entity => `Đánh dấu khách không đến (No-Show) cho ${entity}`,
  NightAuditAutoNoShow: entity => `Kiểm toán đêm tự động đánh dấu No-Show cho ${entity}`,
  LoginFailed: () => 'Ghi nhận lần đăng nhập thất bại',
  StatusToggle: entity => `Thay đổi trạng thái hoạt động của ${entity}`,
  PublishApproval: entity => `Phê duyệt xuất bản ${entity}`,
  Upgrade: entity => `Nâng cấp gói dịch vụ cho ${entity}`,
  OverrideLateCheckOutSurcharge: entity => `Miễn hoặc điều chỉnh phụ thu trả phòng muộn cho ${entity}`,
  CheckInDepositWarning: entity => `Cảnh báo thiếu tiền cọc khi nhận phòng cho ${entity}`
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getFriendlyAuditSummary(
  summary: string | null | undefined,
  action?: string | null,
  entityName?: string | null
): string {
  const entityLabel = getAuditEntityDisplayLabel(entityName);
  const trimmed = summary?.trim() || '';

  if (!trimmed) {
    if (action && CUSTOM_ACTION_SUMMARY_PHRASES[action]) {
      return CUSTOM_ACTION_SUMMARY_PHRASES[action](entityLabel);
    }
    return 'Không có mô tả chi tiết';
  }

  let s = trimmed;

  // Chuyển hóa tiền tố hành động tiếng Anh (VD: "ApproveRefund Payment", "LoginFailed Auth", "Cancel Reservation: ...")
  const actionKeys = Object.keys(CUSTOM_ACTION_SUMMARY_PHRASES);
  const matchedActionKey =
    (action && CUSTOM_ACTION_SUMMARY_PHRASES[action] && s.startsWith(action) ? action : null) ||
    actionKeys.find(key => new RegExp(`^${key}(?:\\s|:|-|$)`).test(s)) ||
    null;

  if (matchedActionKey) {
    const escapedEntity = entityName ? escapeRegExp(entityName) : '[A-Za-z][A-Za-z0-9]*';
    const prefixRegex = new RegExp(`^${matchedActionKey}(?:\\s+(?:${escapedEntity}))?(?:\\s*[:\\-]\\s*)?`);
    const match = s.match(prefixRegex);
    if (match) {
      const rest = s.slice(match[0].length).trim();
      const matchedEntityToken = match[0]
        .slice(matchedActionKey.length)
        .replace(/[:\-\s]+/g, '')
        .trim();
      const targetLabel = matchedEntityToken
        ? getAuditEntityDisplayLabel(matchedEntityToken)
        : entityLabel;
      const vnPrefix = CUSTOM_ACTION_SUMMARY_PHRASES[matchedActionKey](targetLabel);
      s = rest ? `${vnPrefix}: ${rest}` : vnPrefix;
    }
  }

  // Thay thế tên thực thể tiếng Anh còn sót lại trong nội dung
  s = s.replace(/\bPropertySurchargePolicy\b/g, 'Phụ thu chi nhánh');
  s = s.replace(/\bPropertyPublishApproval\b/g, 'Duyệt xuất bản cơ sở');
  s = s.replace(/\bSepayExpiredHoldAlert\b/g, 'Cảnh báo chuyển khoản quá hạn SePay');
  s = s.replace(/\bSepayBankAccountConfigWarning\b/g, 'Cảnh báo chưa cấu hình STK SePay');
  s = s.replace(/\bSubscriptionUpgrade\b/g, 'Nâng cấp gói cước');
  s = s.replace(/\bSubscriptionPlan\b/g, 'Gói cước SaaS');
  s = s.replace(/\bHousekeepingTask\b/g, 'Buồng phòng');
  s = s.replace(/\bTenantContract\b/g, 'Hợp đồng SaaS');
  s = s.replace(/\bTenantStatus\b/g, 'Trạng thái thuê bao');
  s = s.replace(/\bTenantStaff\b/g, 'Tài khoản nhân sự');
  s = s.replace(/\bRoomTypeRate\b/g, 'Bảng giá phòng');
  s = s.replace(/\bGuestReview\b/g, 'Đánh giá khách lưu trú');
  s = s.replace(/\bAccessRole\b/g, 'Chức vụ phân quyền');
  s = s.replace(/\bReservation\b/g, 'Đơn đặt phòng');
  s = s.replace(/\bRoomType\b/g, 'Loại phòng');
  s = s.replace(/\bProperty\b/g, 'Cơ sở/Chi nhánh');
  s = s.replace(/\bPayment\b/g, 'Giao dịch thanh toán');
  s = s.replace(/\bInvoice\b/g, 'Hóa đơn');
  s = s.replace(/\bTenant\b/g, 'Doanh nghiệp');
  s = s.replace(/\bRoom\b/g, 'Phòng');
  s = s.replace(/\bUser\b/g, 'Tài khoản người dùng');
  s = s.replace(/\bAuth\b/g, 'Xác thực đăng nhập');

  // Ẩn GUID kỹ thuật thừa trong tóm tắt nhanh
  s = s.replace(/,?\s*(RoomTypeId|CreatedByUserId|TenantId|PropertyId|Id)=[0-9a-f-]{36}/gi, '');
  s = s.replace(/\(\s*,\s*/g, '(');
  s = s.replace(/,\s*\)/g, ')');
  s = s.replace(/\(\s*\)/g, '');

  // Định dạng giá tiền VND
  s = s.replace(/\bNightlyPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
    return `Giá theo đêm: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
  });
  s = s.replace(/\bFirstHoursPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
    return `Giá giờ đầu: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
  });
  s = s.replace(/\bAdditionalHourPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
    return `Giá giờ tiếp theo: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
  });

  // Định dạng mốc ngày hiệu lực
  s = s.replace(/\bEffectiveTo:\s*(\d{4}-\d{2}-\d{2})\s*->\s*(\d{4}-\d{2}-\d{2})/g, (_, o, n) => {
    return `Hạn hiệu lực: ${formatIsoShortDate(o)} → ${formatIsoShortDate(n)} (Hết ngày trước)`;
  });
  s = s.replace(/\bEffectiveFrom:\s*(\d{4}-\d{2}-\d{2})\s*->\s*(\d{4}-\d{2}-\d{2})/g, (_, o, n) => {
    return `Từ ngày: ${formatIsoShortDate(o)} → ${formatIsoShortDate(n)}`;
  });
  s = s.replace(/\bEffectiveTo:\s*(\d{4}-\d{2}-\d{2})/g, (_, d) => {
    return `Hạn hiệu lực: ${formatIsoShortDate(d)}`;
  });
  s = s.replace(/\bEffectiveFrom:\s*(\d{4}-\d{2}-\d{2})/g, (_, d) => {
    return `Từ ngày: ${formatIsoShortDate(d)}`;
  });

  s = s.replace(/\bIsActive:\s*(true|True)\b/g, 'Trạng thái: Hoạt động');
  s = s.replace(/\bIsActive:\s*(false|False)\b/g, 'Trạng thái: Tạm dừng');
  s = s.replace(/\bIsActive=(true|True)\b/g, 'Trạng thái=Hoạt động');
  s = s.replace(/\bIsActive=(false|False)\b/g, 'Trạng thái=Tạm dừng');
  s = s.replace(/\bCurrency=VND\b/g, 'Tiền tệ=VND');
  s = s.replace(/\bFirstHours=(\d+)\b/g, 'Số giờ đầu=$1h');
  s = s.replace(/\bChangeReason:\s*/g, 'Lý do: ');

  s = s.replace(/->/g, '→');

  return s.trim();
}
