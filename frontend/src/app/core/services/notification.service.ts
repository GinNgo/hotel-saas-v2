import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertService } from './alert.service';
import { TokenStorageService } from './token-storage.service';
import { SignalRNotificationTransport } from './signalr-notification.transport';
import {
  NotificationItem,
  REALTIME_TOAST_DURATION_MS,
  RealtimeConnectionState,
  RealtimeNotificationContractDto,
  RealtimeNotificationTransport,
  normalizeNotificationEventType
} from '../../shared/components/notification-bell/notification-bell.model';

export interface ReceiveNotificationOptions {
  /** Nếu `true`, chỉ nạp vào danh sách chuông mà không bật Toast popup hoặc phát âm thanh */
  silent?: boolean;
}

/**
 * Service thông báo dùng chung toàn hệ thống (Task T01):
 * 1. Gom toàn bộ Toast về AlertService (SweetAlert2) — không tạo hệ thống Toast thứ hai.
 *    - Toast thao tác thông thường giữ mặc định 2.2s.
 *    - Toast sự kiện thông báo thời gian thực (T01) hiển thị 5s (`REALTIME_TOAST_DURATION_MS = 5000`).
 * 2. Âm thanh thông báo nhẹ nhàng (Web Audio API):
 *    - Chuông 2 âm sắc dịu dàng chuẩn khách sạn (D5 587.33Hz -> A5 880Hz).
 *    - Không phụ thuộc file mp3 tĩnh, hoạt động offline và an toàn với Autoplay policy.
 * 3. Quản lý trạng thái Trung tâm Thông báo (Notification Center) cho Header PMS:
 *    - Cô lập nghiêm ngặt theo `TenantId` và `PropertyId` (Fail-Closed).
 *    - Chống trùng lặp sự kiện (Deduplication theo `id`).
 *    - Tự động đồng bộ lại khi chuyển chi nhánh (`syncContext`).
 *    - Tự động dọn dẹp listener & state khi đăng xuất (`cleanupOnLogout`).
 *    - Hỗ trợ kết nối SignalR thời gian thực qua `SignalRNotificationTransport`.
 *    - Ghi nhận lỗi trung thực và cập nhật `connectionState = 'disconnected'` khi API gặp sự cố (không báo connected giả).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly alertService = inject(AlertService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly tokenStorage = inject(TokenStorageService, { optional: true });

  /** Danh sách thông báo thuộc chi nhánh hiện hành */
  readonly notifications = signal<readonly NotificationItem[]>([]);

  /** Ngữ cảnh Tenant & Property đang hoạt động */
  readonly activeTenantId = signal<string | null>(null);
  readonly activePropertyId = signal<string | null>(null);

  /** Trạng thái kết nối thời gian thực */
  readonly connectionState = signal<RealtimeConnectionState>('unconfigured');

  /** Trạng thái tải dữ liệu và lỗi nguồn thông báo */
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  /** Cờ xác định nguồn thông báo hỗ trợ xác nhận đánh dấu đã đọc hay chưa */
  readonly canMarkAsRead = signal<boolean>(false);

  /** Cờ bật/tắt âm thanh chuông thông báo */
  readonly isSoundEnabled = signal<boolean>(true);

  private readonly seenNotificationIds = new Set<string>();
  private transport: RealtimeNotificationTransport | null = null;
  private unsubscribeTransportEvent: (() => void) | null = null;
  private unsubscribeTransportState: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private currentAccessToken = '';
  private liveMonitorEnabled = false;
  private persistenceEnabled = false;
  private realtimeSignalREnabled = false;

  private static readonly RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000];
  private static readonly MAX_PERSISTED_NOTIFICATIONS = 50;

  // ── 1. Standard Toast API (Tương thích ngược 100%, mặc định 2.2s) ──────────

  success(message: string, summary: string = 'Thành công', timer?: number): void {
    this.alertService.toastSuccess(message, summary, timer);
  }

  error(message: string, summary: string = 'Đã có lỗi'): void {
    this.alertService.toastError(message, summary);
  }

  warning(message: string, summary: string = 'Cảnh báo', timer?: number): void {
    this.alertService.toastWarning(message, summary, timer);
  }

  info(message: string, summary: string = 'Thông tin', timer?: number): void {
    this.alertService.toastInfo(message, summary, timer);
  }

  // ── 2. Audio Chime API (Âm thanh thông báo nhẹ nhàng) ─────────────────────

  /**
   * Bật hoặc tắt âm thanh thông báo.
   */
  toggleSound(): boolean {
    const next = !this.isSoundEnabled();
    this.isSoundEnabled.set(next);
    return next;
  }

  /**
   * Phát âm thanh chuông thông báo nhẹ nhàng (Web Audio API).
   * Tạo âm thanh chuông 2 âm sắc dịu dàng (D5 -> A5, 587.33Hz -> 880Hz) chuẩn khách sạn cao cấp,
   * không phụ thuộc file tĩnh ngoài, tự xử lý an toàn Autoplay policy.
   */
  playNotificationSound(): void {
    if (!this.isSoundEnabled()) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;

      // Tone 1: 587.33 Hz (D5) - Khởi đầu êm ái
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: 880 Hz (A5) - Tiếng chuông ngân thanh lịch
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.65);

      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 800);
    } catch {
      // Bỏ qua nếu môi trường không có AudioContext hoặc trình duyệt chặn autoplay
    }
  }

  // ── 3. Realtime Notification Center Lifecycle (T01-B) ──────────────────────

  /**
   * Kích hoạt kênh thông báo SignalR thời gian thực kết nối tới `/hubs/notifications`.
   * Tự động bật lưu trữ bền vững (session/localStorage) theo Tenant + Property để không mất thông báo khi F5.
   * Nếu SignalR gặp sự cố mất kết nối, hệ thống ghi nhận lỗi trung thực và tự động thử lại.
   */
  enableRealtimeNotifications(hubUrl?: string): void {
    this.persistenceEnabled = true;
    this.realtimeSignalREnabled = true;
    if (this.transport) {
      return;
    }
    const signalrTransport = new SignalRNotificationTransport({
      hubUrl: hubUrl || '/hubs/notifications',
      onApiError: msg => this.errorMessage.set(msg)
    });
    this.registerTransport(signalrTransport);

    const tenantId = this.activeTenantId();
    const propertyId = this.activePropertyId();
    if (tenantId && propertyId) {
      this.restoreNotificationsFromStorage(tenantId, propertyId);
      void this.hydrateInitialBranchSnapshot(tenantId, propertyId);
    }
  }

  /**
   * Bật/tắt chế độ lưu trữ bền vững thông báo qua F5 theo chi nhánh.
   */
  setPersistenceEnabled(enabled: boolean): void {
    this.persistenceEnabled = enabled;
  }

  /**
   * Kích hoạt bộ giám sát thông báo trực tiếp theo chi nhánh đang hoạt động (Live Property Monitor)
   * dùng làm cơ chế dự phòng hoặc môi trường kiểm thử không có WebSocket.
   */
  enableLivePropertyMonitor(): void {
    if (this.liveMonitorEnabled || this.transport || !this.http) {
      return;
    }
    this.liveMonitorEnabled = true;
    this.persistenceEnabled = true;
    const monitorTransport = new LivePropertyMonitorTransport(
      this.http,
      (payload, options) => this.receiveRealtimeNotification(payload, options),
      msg => this.errorMessage.set(msg)
    );
    this.registerTransport(monitorTransport);
  }

  /**
   * Đăng ký adapter kết nối thời gian thực (SignalR hoặc Monitor transport).
   */
  registerTransport(transport: RealtimeNotificationTransport | null): void {
    const previousTransport = this.transport;
    this.teardownTransportListeners();
    if (previousTransport && previousTransport !== transport) {
      void previousTransport.disconnect().catch(() => {});
    }
    this.transport = transport;
    this.canMarkAsRead.set(Boolean(transport?.markAsRead || transport?.markAllAsRead));

    if (!transport) {
      this.liveMonitorEnabled = false;
      this.realtimeSignalREnabled = false;
      this.connectionState.set('unconfigured');
      return;
    }

    this.unsubscribeTransportEvent = transport.onEvent(payload => {
      this.receiveRealtimeNotification(payload);
    });

    if (transport.onStateChange) {
      this.unsubscribeTransportState = transport.onStateChange(state => {
        this.connectionState.set(state);
        if (state === 'disconnected' && this.hasValidActiveContext()) {
          this.scheduleAutoReconnect();
        } else if (state === 'connected') {
          this.reconnectAttempts = 0;
          this.clearReconnectTimer();
          this.errorMessage.set(null);
        }
      });
    }

    if (this.hasValidActiveContext()) {
      void this.connectTransportForActiveContext();
    } else {
      this.connectionState.set('disconnected');
    }
  }

  /**
   * Đồng bộ ngữ cảnh khi người dùng đăng nhập, tải lại trang (F5) hoặc chuyển đổi chi nhánh làm việc.
   * Nếu đổi sang chi nhánh khác, toàn bộ thông báo trên bộ nhớ của chi nhánh cũ được dọn sạch ngay lập tức
   * và nạp lại cache thông báo của đúng chi nhánh mới để đảm bảo không rò rỉ dữ liệu chéo giữa các cơ sở.
   */
  async syncContext(
    tenantId: string | null | undefined,
    propertyId: string | null | undefined,
    accessToken?: string | null
  ): Promise<void> {
    const normTenant = tenantId?.trim() || null;
    const normProperty = propertyId?.trim() || null;
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      this.currentAccessToken = accessToken;
    } else if (this.tokenStorage) {
      this.currentAccessToken = this.tokenStorage.getAccessToken() || '';
    }

    const contextChanged =
      this.activeTenantId() !== normTenant || this.activePropertyId() !== normProperty;

    this.activeTenantId.set(normTenant);
    this.activePropertyId.set(normProperty);

    if (contextChanged) {
      this.clearReconnectTimer();
      this.reconnectAttempts = 0;
      this.seenNotificationIds.clear();
      this.notifications.set([]);
      this.errorMessage.set(null);

      if (this.transport) {
        try {
          await this.transport.disconnect();
        } catch {
          // Bỏ qua lỗi ngắt kết nối cũ khi chuyển chi nhánh
        }
      }
    }

    if (!normTenant || !normProperty) {
      this.connectionState.set(this.transport ? 'disconnected' : 'unconfigured');
      return;
    }

    if (contextChanged && this.persistenceEnabled) {
      this.restoreNotificationsFromStorage(normTenant, normProperty);
      if (this.realtimeSignalREnabled && this.http) {
        void this.hydrateInitialBranchSnapshot(normTenant, normProperty);
      }
    }

    if (this.transport && contextChanged) {
      await this.connectTransportForActiveContext();
    }
  }

  /**
   * Dọn dẹp toàn bộ listener, bộ đếm reconnect, cache lưu trữ và danh sách thông báo khi đăng xuất.
   */
  async cleanupOnLogout(): Promise<void> {
    const prevTenant = this.activeTenantId();
    const prevProperty = this.activePropertyId();
    this.clearPersistedNotifications(prevTenant, prevProperty);

    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.currentAccessToken = '';
    this.activeTenantId.set(null);
    this.activePropertyId.set(null);
    this.seenNotificationIds.clear();
    this.notifications.set([]);
    this.errorMessage.set(null);
    this.loading.set(false);

    if (this.transport) {
      try {
        await this.transport.disconnect();
      } catch {
        // Đảm bảo logout luôn sạch sẽ kể cả khi transport đóng lỗi
      }
      this.connectionState.set('disconnected');
    } else {
      this.connectionState.set('unconfigured');
    }
  }

  /**
   * Nhận và xử lý một sự kiện thông báo thời gian thực:
   * - Kiểm tra Fail-Closed theo `activeTenantId` và `activePropertyId`.
   * - Kiểm tra loại sự kiện được hỗ trợ.
   * - Chống trùng lặp theo `id` (Deduplication).
   * - Cập nhật danh sách thông báo, lưu bền vững qua F5, phát âm thanh chuông và hiển thị Toast 5 giây qua `AlertService`.
   * Trả về `true` nếu thông báo hợp lệ và được tiếp nhận, `false` nếu bị từ chối hoặc trùng lặp.
   */
  receiveRealtimeNotification(
    payload: RealtimeNotificationContractDto | null | undefined,
    options?: ReceiveNotificationOptions
  ): boolean {
    if (!payload || !payload.id || !payload.tenantId || !payload.propertyId) {
      return false;
    }

    const expectedTenant = this.activeTenantId();
    const expectedProperty = this.activePropertyId();

    // Fail-closed: bắt buộc phải có ngữ cảnh đang hoạt động và khớp tuyệt đối TenantId + PropertyId
    if (!expectedTenant || !expectedProperty) {
      return false;
    }
    if (payload.tenantId !== expectedTenant || payload.propertyId !== expectedProperty) {
      return false;
    }

    const normalizedType = normalizeNotificationEventType(payload.type);
    if (!normalizedType) {
      return false;
    }

    const trimmedId = payload.id.trim();
    if (!trimmedId) {
      return false;
    }

    const existing = this.notifications();
    const existingIndex = existing.findIndex(item => item.id === trimmedId);

    if (existingIndex >= 0) {
      const existingItem = existing[existingIndex];
      // Role priority: If new payload has higher fidelity (financial data) and existing is sanitized, upgrade in place!
      const newRefund = payload.metadata?.refundableAmount ?? 0;
      const oldRefund = existingItem.metadata?.refundableAmount ?? 0;
      const newAmount = payload.metadata?.amount ?? 0;
      const oldAmount = existingItem.metadata?.amount ?? 0;

      const isHigherFidelity = (newRefund > 0 && oldRefund === 0) || (newAmount > 0 && oldAmount === 0);

      if (isHigherFidelity) {
        this.notifications.update(items =>
          items.map((item, idx) =>
            idx === existingIndex
              ? {
                  ...item,
                  title: payload.title?.trim() || item.title,
                  message: payload.message?.trim() || item.message,
                  metadata: { ...item.metadata, ...payload.metadata }
                }
              : item
          )
        );
        this.persistNotificationsToStorage();
      }

      // Deduplication: Drop duplicate payload (no second toast, no second audio chime, no unread badge increment)
      return false;
    }

    // Chống trùng lặp sự kiện hủy phòng kép (ReceiveReservationStatusUpdated + ReceiveBookingCancellationRequested) cho cùng 1 đơn
    const incomingResId = payload.metadata?.reservationId;
    const incomingCode = payload.metadata?.confirmationCode;
    if (
      (normalizedType === 'BookingCancellationRequested' || normalizedType === 'ReservationCancelled') &&
      (incomingResId || incomingCode)
    ) {
      const siblingCancelIndex = existing.findIndex(
        item =>
          (item.type === 'BookingCancellationRequested' || item.type === 'ReservationCancelled') &&
          ((incomingResId && item.metadata?.reservationId === incomingResId) ||
            (incomingCode && item.metadata?.confirmationCode === incomingCode))
      );

      if (siblingCancelIndex >= 0) {
        const siblingItem = existing[siblingCancelIndex];
        // Nếu sự kiện mới là BookingCancellationRequested (chi tiết hoàn tiền đầy đủ hơn) còn bản cũ là ReservationCancelled chung chung -> nâng cấp tại chỗ
        if (normalizedType === 'BookingCancellationRequested' && siblingItem.type === 'ReservationCancelled') {
          this.seenNotificationIds.add(trimmedId);
          this.notifications.update(items =>
            items.map((item, idx) =>
              idx === siblingCancelIndex
                ? {
                    ...item,
                    id: trimmedId,
                    type: 'BookingCancellationRequested',
                    title: payload.title?.trim() || item.title,
                    message: payload.message?.trim() || item.message,
                    metadata: { ...item.metadata, ...payload.metadata }
                  }
                : item
            )
          );
          this.persistNotificationsToStorage();
        }
        return false;
      }
    }

    if (this.seenNotificationIds.has(trimmedId)) {
      return false;
    }

    this.seenNotificationIds.add(trimmedId);

    const readIdsFromStorage = this.persistenceEnabled
      ? this.loadReadIdsSetFromStorage(expectedTenant, expectedProperty)
      : new Set<string>();

    const newItem: NotificationItem = {
      id: trimmedId,
      tenantId: payload.tenantId,
      propertyId: payload.propertyId,
      type: normalizedType,
      title: payload.title?.trim() || 'Thông báo mới',
      message: payload.message?.trim() || '',
      createdAtUtc: payload.createdAtUtc || new Date().toISOString(),
      isRead: Boolean(payload.isRead) || readIdsFromStorage.has(trimmedId),
      metadata: payload.metadata
    };

    const updated = [newItem, ...existing]
      .sort((a, b) => {
        const timeA = Date.parse(a.createdAtUtc);
        const timeB = Date.parse(b.createdAtUtc);
        if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
        return timeB - timeA;
      })
      .slice(0, NotificationService.MAX_PERSISTED_NOTIFICATIONS);

    this.notifications.set(updated);
    this.persistNotificationsToStorage();

    // Hiển thị Toast 5 giây (5000ms) và phát âm thanh chuông nhẹ nhàng khi thông báo mới chưa đọc
    if (!newItem.isRead && !options?.silent) {
      this.playNotificationSound();
      this.showRealtimeToast(newItem);
    }

    return true;
  }

  /**
   * Yêu cầu đánh dấu 1 thông báo đã đọc qua transport.
   * Chỉ cập nhật `isRead = true` khi xác nhận thành công.
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!this.transport?.markAsRead || !this.canMarkAsRead()) {
      return false;
    }

    try {
      const confirmed = await this.transport.markAsRead(notificationId);
      if (confirmed) {
        this.notifications.update(items =>
          items.map(item => (item.id === notificationId ? { ...item, isRead: true } : item))
        );
        this.persistNotificationsToStorage();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Yêu cầu đánh dấu tất cả thông báo trong chi nhánh hiện hành là đã đọc qua transport.
   * Chỉ cập nhật `isRead = true` khi xác nhận thành công.
   */
  async markAllAsRead(): Promise<boolean> {
    const tenantId = this.activeTenantId();
    const propertyId = this.activePropertyId();
    if (!tenantId || !propertyId || !this.transport?.markAllAsRead || !this.canMarkAsRead()) {
      return false;
    }

    try {
      const confirmed = await this.transport.markAllAsRead({ tenantId, propertyId });
      if (confirmed) {
        this.notifications.update(items => items.map(item => ({ ...item, isRead: true })));
        this.persistNotificationsToStorage();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private showRealtimeToast(item: NotificationItem): void {
    switch (item.type) {
      case 'NewReservation':
      case 'BookingPaymentConfirmed':
      case 'RoomCleaningCompleted':
        this.alertService.toastSuccess(item.message, item.title, REALTIME_TOAST_DURATION_MS);
        break;
      case 'ReservationCancelled':
      case 'BookingCancellationRequested':
        this.alertService.toastWarning(item.message, item.title, REALTIME_TOAST_DURATION_MS);
        break;
      case 'RoomNeedsCleaning':
      case 'HoldExpired':
        this.alertService.toastInfo(item.message, item.title, REALTIME_TOAST_DURATION_MS);
        break;
    }
  }

  private getNotificationsStorageKey(tenantId: string, propertyId: string): string {
    return `hotelsaas_notifications_v1_${tenantId}_${propertyId}`;
  }

  private getReadIdsStorageKey(tenantId: string, propertyId: string): string {
    return `hotelsaas_read_notifs_${tenantId}_${propertyId}`;
  }

  private loadReadIdsSetFromStorage(tenantId: string, propertyId: string): Set<string> {
    const set = new Set<string>();
    const key = this.getReadIdsStorageKey(tenantId, propertyId);
    const readFrom = (storage: Storage | undefined) => {
      if (!storage) return;
      try {
        const raw = storage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id === 'string' && id.trim()) {
              set.add(id.trim());
            }
          }
        }
      } catch {
        // Bỏ qua lỗi đọc storage
      }
    };
    if (typeof localStorage !== 'undefined') readFrom(localStorage);
    if (typeof sessionStorage !== 'undefined') readFrom(sessionStorage);
    return set;
  }

  private persistNotificationsToStorage(): void {
    if (!this.persistenceEnabled) return;
    const tenantId = this.activeTenantId();
    const propertyId = this.activePropertyId();
    if (!tenantId || !propertyId) return;

    const currentItems = this.notifications().filter(
      item => item.tenantId === tenantId && item.propertyId === propertyId
    );
    const toStore = currentItems.slice(0, NotificationService.MAX_PERSISTED_NOTIFICATIONS);
    const listKey = this.getNotificationsStorageKey(tenantId, propertyId);
    const readKey = this.getReadIdsStorageKey(tenantId, propertyId);

    const readIds = this.loadReadIdsSetFromStorage(tenantId, propertyId);
    for (const item of toStore) {
      if (item.isRead) {
        readIds.add(item.id);
      }
    }

    const serializedList = JSON.stringify(toStore);
    const serializedReadIds = JSON.stringify(Array.from(readIds));

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(listKey, serializedList);
        localStorage.setItem(readKey, serializedReadIds);
      }
    } catch {
      // Bỏ qua lỗi ghi localStorage
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(listKey, serializedList);
        sessionStorage.setItem(readKey, serializedReadIds);
      }
    } catch {
      // Bỏ qua lỗi ghi sessionStorage
    }
  }

  private restoreNotificationsFromStorage(tenantId: string, propertyId: string): void {
    if (!this.persistenceEnabled || !tenantId || !propertyId) return;

    const listKey = this.getNotificationsStorageKey(tenantId, propertyId);
    const readIds = this.loadReadIdsSetFromStorage(tenantId, propertyId);

    let raw: string | null = null;
    try {
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(listKey);
      }
      if (!raw && typeof sessionStorage !== 'undefined') {
        raw = sessionStorage.getItem(listKey);
      }
    } catch {
      raw = null;
    }

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const restored: NotificationItem[] = [];
      for (const candidate of parsed) {
        if (!candidate || typeof candidate !== 'object') continue;
        const dto = candidate as Partial<NotificationItem>;
        if (!dto.id || dto.tenantId !== tenantId || dto.propertyId !== propertyId) {
          continue;
        }
        const normalizedType = normalizeNotificationEventType(dto.type ?? '');
        if (!normalizedType) continue;

        const trimmedId = String(dto.id).trim();
        if (!trimmedId || this.seenNotificationIds.has(trimmedId)) continue;

        this.seenNotificationIds.add(trimmedId);
        restored.push({
          id: trimmedId,
          tenantId,
          propertyId,
          type: normalizedType,
          title: dto.title?.trim() || 'Thông báo',
          message: dto.message?.trim() || '',
          createdAtUtc: dto.createdAtUtc || new Date().toISOString(),
          isRead: Boolean(dto.isRead) || readIds.has(trimmedId),
          metadata: dto.metadata
        });
      }

      if (restored.length > 0) {
        const mergedRaw = [...restored, ...this.notifications()];
        // Lọc bỏ các bản ghi ReservationCancelled bị trùng với BookingCancellationRequested của cùng 1 đơn đặt phòng
        const richCancelKeys = new Set<string>();
        for (const item of mergedRaw) {
          if (item.type === 'BookingCancellationRequested') {
            if (item.metadata?.reservationId) richCancelKeys.add(`id:${item.metadata.reservationId}`);
            if (item.metadata?.confirmationCode) richCancelKeys.add(`code:${item.metadata.confirmationCode}`);
          }
        }
        const deduplicated = mergedRaw.filter(item => {
          if (item.type === 'ReservationCancelled') {
            const hasRichById = item.metadata?.reservationId && richCancelKeys.has(`id:${item.metadata.reservationId}`);
            const hasRichByCode = item.metadata?.confirmationCode && richCancelKeys.has(`code:${item.metadata.confirmationCode}`);
            if (hasRichById || hasRichByCode) return false;
          }
          return true;
        });

        const merged = deduplicated
          .sort((a, b) => {
            const timeA = Date.parse(a.createdAtUtc);
            const timeB = Date.parse(b.createdAtUtc);
            if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
            return timeB - timeA;
          })
          .slice(0, NotificationService.MAX_PERSISTED_NOTIFICATIONS);
        this.notifications.set(merged);
      }
    } catch {
      // Bỏ qua dữ liệu cache không hợp lệ
    }
  }

  private clearPersistedNotifications(tenantId: string | null, propertyId: string | null): void {
    const clearIn = (storage: Storage | undefined) => {
      if (!storage) return;
      try {
        if (tenantId && propertyId) {
          storage.removeItem(this.getNotificationsStorageKey(tenantId, propertyId));
          storage.removeItem(this.getReadIdsStorageKey(tenantId, propertyId));
        }
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (
            k &&
            (k.startsWith('hotelsaas_notifications_v1_') || k.startsWith('hotelsaas_read_notifs_'))
          ) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          storage.removeItem(k);
        }
      } catch {
        // Bỏ qua lỗi xóa storage
      }
    };
    if (typeof localStorage !== 'undefined') clearIn(localStorage);
    if (typeof sessionStorage !== 'undefined') clearIn(sessionStorage);
  }

  /**
   * Đồng bộ ngầm danh sách đơn đặt phòng và phòng cần dọn mới nhất của chi nhánh khi khởi tạo / F5
   * để đảm bảo kể cả khi mở trình duyệt mới hoặc sau khi F5, chuông thông báo vẫn hiển thị đầy đủ
   * các sự kiện quan trọng gần nhất của chi nhánh mà không bị trống rỗng.
   */
  private async hydrateInitialBranchSnapshot(tenantId: string, propertyId: string): Promise<void> {
    if (!this.http || !tenantId || !propertyId) return;

    try {
      const resParams = new HttpParams()
        .set('propertyId', propertyId)
        .set('page', '1')
        .set('pageSize', '10');
      const roomParams = new HttpParams()
        .set('page', '1')
        .set('pageSize', '50');

      const [resResponse, roomResponse] = await Promise.all([
        firstValueFrom(
          this.http.get<Record<string, unknown>>(`${environment.apiUrl}/reservations`, {
            params: resParams
          })
        ).catch(() => null),
        firstValueFrom(
          this.http.get<Record<string, unknown>>(`${environment.apiUrl}/rooms`, {
            params: roomParams
          })
        ).catch(() => null)
      ]);

      // Kiểm tra ngữ cảnh vẫn còn khớp sau khi await
      if (this.activeTenantId() !== tenantId || this.activePropertyId() !== propertyId) {
        return;
      }

      const readIds = this.loadReadIdsSetFromStorage(tenantId, propertyId);

      if (resResponse) {
        const resData = resResponse['data'] as Record<string, unknown> | undefined;
        const reservations = (resData?.['items'] ??
          resResponse['items'] ??
          []) as MonitoredReservationRow[];

        const ordered = [...reservations].reverse();
        for (const r of ordered) {
          if (!r?.id) continue;
          if (r.propertyId && r.propertyId !== propertyId) continue;

          const isCancelled = r.status === 3 || r.status === 'Cancelled';
          const code = r.id.substring(0, 8).toUpperCase();

          // Tránh tạo bản ghi snapshot trùng nếu đã có thông báo SignalR tương ứng của cùng đơn đặt phòng
          const alreadyHasSignalRForRes = this.notifications().some(
            item =>
              item.metadata?.reservationId === r.id ||
              (item.metadata?.confirmationCode === code &&
                (isCancelled
                  ? item.type === 'BookingCancellationRequested' ||
                    item.type === 'ReservationCancelled'
                  : item.type === 'NewReservation' || item.type === 'BookingPaymentConfirmed'))
          );
          if (alreadyHasSignalRForRes) continue;

          const notifId = isCancelled ? `res-cancel-${r.id}` : `res-new-${r.id}`;
          const guestName = r.guestName?.trim() || 'Khách đặt phòng';
          const roomLabel = r.roomNumber
            ? `Phòng ${r.roomNumber}`
            : r.roomTypeName || 'Phòng lưu trú';

          this.receiveRealtimeNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: isCancelled ? 'ReservationCancelled' : 'NewReservation',
              title: isCancelled ? 'Đơn đặt phòng bị hủy' : 'Có đơn đặt phòng mới',
              message: isCancelled
                ? `Đơn đặt ${roomLabel} của khách ${guestName} (Mã: #${code}) đã bị hủy.`
                : `Khách ${guestName} vừa đặt ${roomLabel} (Mã: #${code}).`,
              createdAtUtc: r.createdAtUtc || new Date().toISOString(),
              isRead: readIds.has(notifId),
              metadata: {
                reservationId: r.id,
                confirmationCode: code,
                guestName,
                targetRoute: `/reservations?code=${encodeURIComponent(code)}&reservationId=${encodeURIComponent(r.id)}`
              }
            },
            { silent: true }
          );
        }
      }

      if (roomResponse) {
        const roomData = roomResponse['data'] as Record<string, unknown> | undefined;
        const rooms = (roomData?.['items'] ?? roomResponse['items'] ?? []) as MonitoredRoomRow[];

        for (const room of rooms) {
          if (!room?.id) continue;
          if (room.propertyId && room.propertyId !== propertyId) continue;
          if (String(room.status || '') !== 'Dirty') continue;

          const notifId = `room-dirty-${room.id}`;
          this.receiveRealtimeNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'RoomNeedsCleaning',
              title: 'Phòng cần dọn',
              message: `Phòng ${room.roomNumber} (${room.roomTypeName || 'Tiêu chuẩn'}) đang ở trạng thái Cần dọn.`,
              createdAtUtc: new Date().toISOString(),
              isRead: readIds.has(notifId),
              metadata: {
                roomNumber: room.roomNumber,
                targetRoute: `/housekeeping?room=${encodeURIComponent(room.roomNumber)}`
              }
            },
            { silent: true }
          );
        }
      }
    } catch {
      // Bỏ qua lỗi đồng bộ snapshot phụ trợ
    }
  }

  private hasValidActiveContext(): boolean {
    return Boolean(this.activeTenantId() && this.activePropertyId());
  }

  private async connectTransportForActiveContext(): Promise<void> {
    const tenantId = this.activeTenantId();
    const propertyId = this.activePropertyId();
    if (!this.transport || !tenantId || !propertyId) {
      return;
    }

    this.connectionState.set(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    try {
      await this.transport.connect({
        tenantId,
        propertyId,
        accessToken: this.currentAccessToken
      });
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.errorMessage.set(null);
      this.connectionState.set('connected');
    } catch {
      this.connectionState.set('reconnecting');
      this.scheduleAutoReconnect();
    }
  }

  private scheduleAutoReconnect(): void {
    if (!this.transport || !this.hasValidActiveContext() || this.reconnectTimer !== null) {
      return;
    }

    const delayIndex = Math.min(
      this.reconnectAttempts,
      NotificationService.RECONNECT_DELAYS_MS.length - 1
    );
    const delayMs = NotificationService.RECONNECT_DELAYS_MS[delayIndex];
    this.reconnectAttempts += 1;
    this.connectionState.set('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.hasValidActiveContext() && this.transport) {
        void this.connectTransportForActiveContext();
      }
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownTransportListeners(): void {
    this.clearReconnectTimer();
    if (this.unsubscribeTransportEvent) {
      this.unsubscribeTransportEvent();
      this.unsubscribeTransportEvent = null;
    }
    if (this.unsubscribeTransportState) {
      this.unsubscribeTransportState();
      this.unsubscribeTransportState = null;
    }
  }
}

interface MonitoredReservationRow {
  id: string;
  propertyId?: string;
  guestName?: string;
  roomTypeName?: string;
  roomNumber?: string;
  status: number | string;
  createdAtUtc?: string;
}

interface MonitoredRoomRow {
  id: string;
  propertyId?: string;
  roomNumber: string;
  roomTypeName?: string;
  status: string;
}

/**
 * Adapter giám sát sự kiện Đặt phòng / Hủy phòng / Buồng phòng trực tiếp theo chi nhánh.
 * Sử dụng kết hợp BroadcastChannel (tức thời giữa các tab) và chu kỳ kiểm tra dữ liệu API.
 * Bắt lỗi trung thực và cập nhật trạng thái disconnected khi API lỗi (không báo connected giả).
 */
export class LivePropertyMonitorTransport implements RealtimeNotificationTransport {
  private eventHandler: ((payload: RealtimeNotificationContractDto) => void) | null = null;
  private stateHandler: ((state: RealtimeConnectionState) => void) | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private activeTenantId: string | null = null;
  private activePropertyId: string | null = null;
  private isInitialSnapshot = true;
  private isPolling = false;
  private hasApiError = false;

  private readonly knownReservations = new Map<string, string>();
  private readonly knownRooms = new Map<string, string>();
  private readIds = new Set<string>();

  private static readonly POLL_INTERVAL_MS = 3500;

  constructor(
    private readonly http: HttpClient,
    private readonly dispatchNotification: (
      payload: RealtimeNotificationContractDto,
      options?: ReceiveNotificationOptions
    ) => boolean,
    private readonly onErrorChange?: (message: string | null) => void
  ) {}

  async connect(context: { tenantId: string; propertyId: string; accessToken: string }): Promise<void> {
    await this.disconnect();

    this.activeTenantId = context.tenantId;
    this.activePropertyId = context.propertyId;
    this.isInitialSnapshot = true;
    this.hasApiError = false;
    this.knownReservations.clear();
    this.knownRooms.clear();
    this.loadReadIdsFromStorage();

    this.setupBroadcastListener();
    await this.pollOnce();

    this.pollInterval = setInterval(() => {
      void this.pollOnce();
    }, LivePropertyMonitorTransport.POLL_INTERVAL_MS);

    if (!this.hasApiError) {
      this.stateHandler?.('connected');
      this.onErrorChange?.(null);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Bỏ qua lỗi đóng BroadcastChannel
      }
      this.broadcastChannel = null;
    }
    this.activeTenantId = null;
    this.activePropertyId = null;
    this.isInitialSnapshot = true;
    this.isPolling = false;
    this.hasApiError = false;
    this.knownReservations.clear();
    this.knownRooms.clear();
    this.stateHandler?.('disconnected');
  }

  onEvent(handler: (payload: RealtimeNotificationContractDto) => void): () => void {
    this.eventHandler = handler;
    return () => {
      if (this.eventHandler === handler) {
        this.eventHandler = null;
      }
    };
  }

  onStateChange(handler: (state: RealtimeConnectionState) => void): () => void {
    this.stateHandler = handler;
    return () => {
      if (this.stateHandler === handler) {
        this.stateHandler = null;
      }
    };
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    if (!notificationId || !this.activeTenantId || !this.activePropertyId) {
      return false;
    }
    this.readIds.add(notificationId);
    this.saveReadIdsToStorage();
    return true;
  }

  async markAllAsRead(context: { tenantId: string; propertyId: string }): Promise<boolean> {
    if (context.tenantId !== this.activeTenantId || context.propertyId !== this.activePropertyId) {
      return false;
    }
    for (const id of this.knownReservations.keys()) {
      this.readIds.add(`res-new-${id}`);
      this.readIds.add(`res-confirm-${id}`);
      this.readIds.add(`res-cancel-${id}`);
    }
    for (const roomId of this.knownRooms.keys()) {
      this.readIds.add(`room-dirty-${roomId}`);
      this.readIds.add(`room-clean-${roomId}`);
    }
    this.saveReadIdsToStorage();
    return true;
  }

  private setupBroadcastListener(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('hotelsaas-live-notifications');
        this.broadcastChannel.onmessage = () => {
          void this.pollOnce();
        };
      }
    } catch {
      // Môi trường không hỗ trợ BroadcastChannel
    }
  }

  private async pollOnce(): Promise<void> {
    const tenantId = this.activeTenantId;
    const propertyId = this.activePropertyId;
    if (!tenantId || !propertyId || this.isPolling) {
      return;
    }

    this.isPolling = true;
    const initialRun = this.isInitialSnapshot;

    try {
      const resParams = new HttpParams()
        .set('propertyId', propertyId)
        .set('page', '1')
        .set('pageSize', '10');

      const roomParams = new HttpParams()
        .set('page', '1')
        .set('pageSize', '50');

      let resResponse: Record<string, unknown> | null = null;
      let roomResponse: Record<string, unknown> | null = null;

      try {
        const [res, room] = await Promise.all([
          firstValueFrom(this.http.get<Record<string, unknown>>(`${environment.apiUrl}/reservations`, { params: resParams })),
          firstValueFrom(this.http.get<Record<string, unknown>>(`${environment.apiUrl}/rooms`, { params: roomParams }))
        ]);
        resResponse = res;
        roomResponse = room;

        if (this.hasApiError) {
          this.hasApiError = false;
          this.stateHandler?.('connected');
          this.onErrorChange?.(null);
        }
      } catch (err: unknown) {
        this.hasApiError = true;
        this.stateHandler?.('disconnected');
        const httpErr = err as { status?: number };
        const status = httpErr?.status;
        const msg =
          status === 401 || status === 403
            ? 'Phiên đăng nhập hết hạn hoặc không có quyền truy cập dữ liệu chi nhánh.'
            : status
              ? `Lỗi kết nối máy chủ API (HTTP ${status}).`
              : 'Mất kết nối máy chủ dữ liệu thông báo.';
        this.onErrorChange?.(msg);
        return; // Dừng ngay: Không chuyển thành null và không báo connected giả!
      }

      // Nếu người dùng đã chuyển chi nhánh hoặc logout trong lúc đang gọi API thì hủy bỏ kết quả
      if (this.activeTenantId !== tenantId || this.activePropertyId !== propertyId) {
        return;
      }

      const resData = resResponse?.['data'] as Record<string, unknown> | undefined;
      const reservations: MonitoredReservationRow[] =
        ((resData?.['items'] ?? resResponse?.['items'] ?? []) as MonitoredReservationRow[]);

      const roomData = roomResponse?.['data'] as Record<string, unknown> | undefined;
      const rooms: MonitoredRoomRow[] =
        ((roomData?.['items'] ?? roomResponse?.['items'] ?? []) as MonitoredRoomRow[]);

      this.processReservations(reservations, tenantId, propertyId, initialRun);
      this.processRooms(rooms, tenantId, propertyId, initialRun);

      if (initialRun) {
        this.isInitialSnapshot = false;
      }
    } finally {
      this.isPolling = false;
    }
  }

  private processReservations(
    reservations: MonitoredReservationRow[],
    tenantId: string,
    propertyId: string,
    initialRun: boolean
  ): void {
    const ordered = [...reservations].reverse();

    for (const r of ordered) {
      if (!r?.id) continue;
      if (r.propertyId && r.propertyId !== propertyId) continue;

      const statusKey = this.normalizeReservationStatus(r.status);
      const prevStatus = this.knownReservations.get(r.id);
      const code = r.id.substring(0, 8).toUpperCase();
      const guestName = r.guestName?.trim() || 'Khách đặt phòng';
      const roomLabel = r.roomNumber
        ? `Phòng ${r.roomNumber}`
        : r.roomTypeName || 'Phòng lưu trú';

      if (prevStatus === undefined) {
        this.knownReservations.set(r.id, statusKey);

        const isCancelled = statusKey === 'Cancelled';
        const notifId = isCancelled ? `res-cancel-${r.id}` : `res-new-${r.id}`;
        const isRead = this.readIds.has(notifId);

        this.dispatchNotification(
          {
            id: notifId,
            tenantId,
            propertyId,
            type: isCancelled ? 'ReservationCancelled' : 'NewReservation',
            title: isCancelled ? 'Đơn đặt phòng bị hủy' : 'Có đơn đặt phòng mới',
            message: isCancelled
              ? `Đơn đặt ${roomLabel} của khách ${guestName} (Mã: #${code}) đã bị hủy.`
              : `Khách ${guestName} vừa đặt ${roomLabel} (Mã: #${code}).`,
            createdAtUtc: r.createdAtUtc || new Date().toISOString(),
            isRead
          },
          { silent: initialRun }
        );
      } else if (prevStatus !== statusKey) {
        this.knownReservations.set(r.id, statusKey);

        if (statusKey === 'Cancelled') {
          const notifId = `res-cancel-${r.id}`;
          this.dispatchNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'ReservationCancelled',
              title: 'Đơn đặt phòng bị hủy',
              message: `Đơn đặt ${roomLabel} của khách ${guestName} (Mã: #${code}) vừa chuyển sang Đã hủy.`,
              createdAtUtc: new Date().toISOString(),
              isRead: false
            },
            { silent: false }
          );
        } else if (prevStatus === 'PendingPayment' && statusKey === 'Confirmed') {
          const notifId = `res-confirm-${r.id}`;
          this.dispatchNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'NewReservation',
              title: 'Đơn đặt phòng đã xác nhận',
              message: `Khách ${guestName} đã hoàn tất xác nhận ${roomLabel} (Mã: #${code}).`,
              createdAtUtc: new Date().toISOString(),
              isRead: false
            },
            { silent: false }
          );
        }
      }
    }
  }

  private processRooms(
    rooms: MonitoredRoomRow[],
    tenantId: string,
    propertyId: string,
    initialRun: boolean
  ): void {
    for (const room of rooms) {
      if (!room?.id) continue;
      if (room.propertyId && room.propertyId !== propertyId) continue;

      const statusKey = String(room.status || '');
      const prevStatus = this.knownRooms.get(room.id);

      if (prevStatus === undefined) {
        this.knownRooms.set(room.id, statusKey);

        if (initialRun && statusKey === 'Dirty') {
          const notifId = `room-dirty-${room.id}`;
          this.dispatchNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'RoomNeedsCleaning',
              title: 'Phòng cần dọn',
              message: `Phòng ${room.roomNumber} (${room.roomTypeName || 'Tiêu chuẩn'}) đang ở trạng thái Cần dọn.`,
              createdAtUtc: new Date().toISOString(),
              isRead: this.readIds.has(notifId)
            },
            { silent: true }
          );
        }
      } else if (prevStatus !== statusKey) {
        this.knownRooms.set(room.id, statusKey);

        if (statusKey === 'Dirty') {
          const notifId = `room-dirty-${room.id}-${Date.now()}`;
          this.dispatchNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'RoomNeedsCleaning',
              title: 'Phòng cần dọn',
              message: `Phòng ${room.roomNumber} (${room.roomTypeName || 'Tiêu chuẩn'}) vừa chuyển sang trạng thái Cần dọn.`,
              createdAtUtc: new Date().toISOString(),
              isRead: false
            },
            { silent: false }
          );
        } else if (statusKey === 'Clean' && (prevStatus === 'Dirty' || prevStatus === 'Cleaning')) {
          const notifId = `room-clean-${room.id}-${Date.now()}`;
          this.dispatchNotification(
            {
              id: notifId,
              tenantId,
              propertyId,
              type: 'RoomCleaningCompleted',
              title: 'Phòng đã dọn xong',
              message: `Phòng ${room.roomNumber} đã dọn dẹp hoàn tất và sẵn sàng đón khách.`,
              createdAtUtc: new Date().toISOString(),
              isRead: false
            },
            { silent: false }
          );
        }
      }
    }
  }

  private normalizeReservationStatus(status: number | string): string {
    if (typeof status === 'number') {
      switch (status) {
        case 0:
          return 'PendingPayment';
        case 1:
          return 'Confirmed';
        case 2:
          return 'CheckedIn';
        case 3:
          return 'Cancelled';
        case 4:
          return 'Completed';
        case 5:
          return 'NoShow';
        default:
          return String(status);
      }
    }
    return String(status);
  }

  private getStorageKey(): string | null {
    if (!this.activeTenantId || !this.activePropertyId) return null;
    return `hotelsaas_read_notifs_${this.activeTenantId}_${this.activePropertyId}`;
  }

  private loadReadIdsFromStorage(): void {
    this.readIds = new Set<string>();
    try {
      const key = this.getStorageKey();
      if (!key || typeof sessionStorage === 'undefined') return;
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') {
            this.readIds.add(item);
          }
        }
      }
    } catch {
      // Bỏ qua lỗi đọc sessionStorage
    }
  }

  private saveReadIdsToStorage(): void {
    try {
      const key = this.getStorageKey();
      if (!key || typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(key, JSON.stringify(Array.from(this.readIds)));
    } catch {
      // Bỏ qua lỗi ghi sessionStorage
    }
  }
}
