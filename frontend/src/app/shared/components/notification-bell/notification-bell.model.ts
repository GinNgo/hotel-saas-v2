/**
 * Mô hình dữ liệu và Contract cho Trung tâm Thông báo (Notification Center — T01-A & T01-B).
 *
 * Lưu ý kiến trúc:
 * - Cung cấp UI Foundation, bộ lọc cô lập Tenant/Property (Fail-Closed), chống trùng lặp (Deduplication),
 *   đồng bộ ngữ cảnh khi đổi chi nhánh, cleanup khi đăng xuất và adapter chờ kết nối SignalR NotificationHub (A03).
 * - Không tự tạo endpoint hoặc tên event SignalR giả khi Backend chưa bàn giao NotificationHub.
 */

/**
 * 4 loại sự kiện thông báo nghiệp vụ PMS theo kế hoạch Tuần 4 (T01):
 * - NewReservation: Có đơn đặt phòng mới
 * - ReservationCancelled: Đơn đặt phòng bị hủy
 * - RoomNeedsCleaning: Phòng cần dọn
 * - RoomCleaningCompleted: Phòng đã dọn xong
 */
export type NotificationEventType =
  | 'NewReservation'
  | 'ReservationCancelled'
  | 'RoomNeedsCleaning'
  | 'RoomCleaningCompleted';

/**
 * Các giá trị enum NotificationType tương ứng từ Backend Domain (`HotelSaas.Domain.Enums.NotificationType`)
 * để ánh xạ an toàn khi nhận payload từ Backend.
 */
export type BackendDomainNotificationType =
  | NotificationEventType
  | 'NewBooking'
  | 'BookingConfirmed'
  | 'BookingCancelled'
  | 'RoomStatusChanged'
  | 'HousekeepingAssigned'
  | 'HousekeepingCompleted'
  | 0
  | 1
  | 2
  | 7
  | 8
  | 9;

/**
 * Thông tin ngữ cảnh nghiệp vụ đi kèm mỗi thông báo để phục vụ điều hướng hoặc tra cứu nhanh.
 */
export interface NotificationMetadata {
  reservationId?: string;
  confirmationCode?: string;
  roomId?: string;
  roomNumber?: string;
  guestName?: string;
}

/**
 * Cấu trúc một bản ghi thông báo chuẩn trong Notification Center.
 * Bắt buộc có `tenantId` và `propertyId` để đảm bảo cô lập dữ liệu đa chi nhánh (Multi-Tenant Fail-Closed).
 */
export interface NotificationItem {
  id: string;
  tenantId: string;
  propertyId: string;
  type: NotificationEventType;
  title: string;
  message: string;
  /** Chuỗi thời gian chuẩn ISO 8601 UTC (ví dụ: '2026-10-28T02:15:00.000Z') */
  createdAtUtc: string;
  /** Trạng thái đã đọc xác nhận từ Backend (không tự ý ghi nhận thành công ở client khi chưa có xác nhận) */
  isRead: boolean;
  metadata?: NotificationMetadata;
}

/**
 * Cấu hình hiển thị trực quan (Icon, Nhãn phân loại, Màu sắc theo chuẩn PMS White/Slate/Emerald)
 * cho từng loại thông báo.
 */
export interface NotificationTypeVisualConfig {
  type: NotificationEventType;
  categoryLabel: string;
  iconClass: string;
  iconContainerClass: string;
  badgeClass: string;
}

export const NOTIFICATION_TYPE_VISUALS: Readonly<Record<NotificationEventType, NotificationTypeVisualConfig>> = {
  NewReservation: {
    type: 'NewReservation',
    categoryLabel: 'Đơn đặt phòng mới',
    iconClass: 'pi pi-calendar-plus',
    iconContainerClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
  },
  ReservationCancelled: {
    type: 'ReservationCancelled',
    categoryLabel: 'Đơn đặt phòng bị hủy',
    iconClass: 'pi pi-calendar-times',
    iconContainerClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80'
  },
  RoomNeedsCleaning: {
    type: 'RoomNeedsCleaning',
    categoryLabel: 'Phòng cần dọn',
    iconClass: 'pi pi-sparkles',
    iconContainerClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80'
  },
  RoomCleaningCompleted: {
    type: 'RoomCleaningCompleted',
    categoryLabel: 'Phòng đã dọn xong',
    iconClass: 'pi pi-check-circle',
    iconContainerClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80'
  }
};

/**
 * Contract dự kiến cho payload sự kiện từ SignalR NotificationHub (chờ A03 bàn giao).
 */
export interface RealtimeNotificationContractDto {
  id: string;
  tenantId: string;
  propertyId: string;
  type: BackendDomainNotificationType;
  title: string;
  message: string;
  createdAtUtc: string;
  isRead?: boolean;
  metadata?: NotificationMetadata;
}

/**
 * Trạng thái kết nối của kênh thông báo thời gian thực.
 */
export type RealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unconfigured';

/**
 * Giao diện Transport trừu tượng cho kết nối thời gian thực (SignalR HubConnection adapter).
 * Cho phép gắn kết nối thật ngay khi Backend NotificationHub sẵn sàng, đồng thời kiểm thử đầy đủ
 * luồng nhận sự kiện, mất kết nối, auto-reconnect, đổi chi nhánh và đăng xuất.
 */
export interface RealtimeNotificationTransport {
  connect(context: { tenantId: string; propertyId: string; accessToken: string }): Promise<void>;
  disconnect(): Promise<void>;
  onEvent(handler: (payload: RealtimeNotificationContractDto) => void): () => void;
  onStateChange?(handler: (state: RealtimeConnectionState) => void): () => void;
  markAsRead?(notificationId: string): Promise<boolean>;
  markAllAsRead?(context: { tenantId: string; propertyId: string }): Promise<boolean>;
}

/**
 * Ánh xạ kiểu sự kiện từ Backend Domain (`NotificationType`) hoặc chuỗi sự kiện về `NotificationEventType` chuẩn.
 * Trả về `null` nếu loại thông báo không thuộc nhóm sự kiện nghiệp vụ lễ tân/buồng phòng được hỗ trợ.
 */
export function normalizeNotificationEventType(
  rawType: BackendDomainNotificationType | string | number | null | undefined
): NotificationEventType | null {
  if (rawType === null || rawType === undefined) return null;

  switch (rawType) {
    case 'NewReservation':
    case 'NewBooking':
    case 'BookingConfirmed':
    case 0:
    case 1:
      return 'NewReservation';

    case 'ReservationCancelled':
    case 'BookingCancelled':
    case 2:
      return 'ReservationCancelled';

    case 'RoomNeedsCleaning':
    case 'RoomStatusChanged':
    case 'HousekeepingAssigned':
    case 7:
    case 8:
      return 'RoomNeedsCleaning';

    case 'RoomCleaningCompleted':
    case 'HousekeepingCompleted':
    case 9:
      return 'RoomCleaningCompleted';

    default:
      return null;
  }
}

/**
 * Hằng số giới hạn số lượng thông báo tối đa hiển thị trong dropdown theo đặc tả T01.
 */
export const MAX_RECENT_NOTIFICATIONS = 10;

/**
 * Thời lượng hiển thị Toast cho thông báo thời gian thực mới (5000ms = 5 giây theo kế hoạch Tuần 4).
 */
export const REALTIME_TOAST_DURATION_MS = 5000;
