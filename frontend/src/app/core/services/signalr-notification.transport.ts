import * as signalR from '@microsoft/signalr';
import {
  RealtimeConnectionState,
  RealtimeNotificationContractDto,
  RealtimeNotificationTransport
} from '../../shared/components/notification-bell/notification-bell.model';

export interface SignalRTransportOptions {
  hubUrl?: string;
  onApiError?: (message: string | null) => void;
}

/**
 * Adapter kết nối thời gian thực qua SignalR NotificationHub (Task A03 / T01).
 * Quản lý kết nối WebSocket/LongPolling, tự động tham gia nhóm chi nhánh (JoinProperty),
 * tự động khôi phục kết nối và bắt lỗi trung thực (không báo connected giả).
 */
export class SignalRNotificationTransport implements RealtimeNotificationTransport {
  private connection: signalR.HubConnection | null = null;
  private eventHandler: ((payload: RealtimeNotificationContractDto) => void) | null = null;
  private stateHandler: ((state: RealtimeConnectionState) => void) | null = null;
  private currentContext: { tenantId: string; propertyId: string; accessToken: string } | null = null;

  constructor(private readonly options?: SignalRTransportOptions) {}

  async connect(context: { tenantId: string; propertyId: string; accessToken: string }): Promise<void> {
    await this.disconnect();
    this.currentContext = context;

    const hubUrl = this.options?.hubUrl || '/hubs/notifications';

    this.stateHandler?.('connecting');
    this.options?.onApiError?.(null);

    const builder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => context.accessToken || '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        skipNegotiation: false
      })
      .withAutomaticReconnect([1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning);

    const conn = builder.build();
    this.connection = conn;

    conn.on('ReceiveNewReservation', (payload: unknown) => {
      this.handleIncomingReservation(payload, context);
    });

    conn.on('ReceiveReservationStatusUpdated', (payload: unknown) => {
      this.handleIncomingStatusUpdate(payload, context);
    });

    conn.on('ReceiveHousekeepingAlert', (payload: unknown) => {
      this.handleIncomingHousekeeping(payload, context);
    });

    conn.onreconnecting(() => {
      this.stateHandler?.('reconnecting');
    });

    conn.onreconnected(async () => {
      this.stateHandler?.('connected');
      this.options?.onApiError?.(null);
      if (this.currentContext?.propertyId && this.connection) {
        try {
          await this.connection.invoke('JoinProperty', this.currentContext.propertyId);
        } catch {
          // Bỏ qua lỗi rejoin
        }
      }
    });

    conn.onclose(err => {
      this.stateHandler?.('disconnected');
      if (err) {
        this.options?.onApiError?.(`Mất kết nối máy chủ SignalR: ${err.message || 'Lỗi mạng'}`);
      }
    });

    try {
      await conn.start();
      await conn.invoke('JoinProperty', context.propertyId);
      this.stateHandler?.('connected');
      this.options?.onApiError?.(null);
    } catch (err: unknown) {
      this.stateHandler?.('disconnected');
      const errObj = err as { message?: string };
      const msg = `Không thể kết nối máy chủ SignalR (${errObj?.message || 'Lỗi mạng'}).`;
      this.options?.onApiError?.(msg);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      const conn = this.connection;
      this.connection = null;
      try {
        if (this.currentContext?.propertyId) {
          await conn.invoke('LeaveProperty', this.currentContext.propertyId).catch(() => {});
        }
        await conn.stop();
      } catch {
        // Bỏ qua lỗi ngắt kết nối
      }
    }
    this.currentContext = null;
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

  private handleIncomingReservation(rawPayload: unknown, context: { tenantId: string; propertyId: string }): void {
    if (!rawPayload || !this.eventHandler) return;
    const payload = rawPayload as Record<string, unknown>;
    const resId = String(payload['reservationId'] || payload['id'] || '');
    const code = String(payload['confirmationCode'] || resId.substring(0, 8).toUpperCase());
    const guest = String(payload['guestName'] || 'Khách đặt phòng');
    const room = String(payload['roomTypeName'] || 'Phòng lưu trú');

    this.eventHandler({
      id: `sig-res-${resId}-${Date.now()}`,
      tenantId: context.tenantId,
      propertyId: String(payload['propertyId'] || context.propertyId),
      type: 'NewReservation',
      title: 'Có đơn đặt phòng mới',
      message: `Khách ${guest} vừa hoàn tất đặt ${room} (Mã: #${code}).`,
      createdAtUtc: String(payload['createdAtUtc'] || new Date().toISOString()),
      isRead: false,
      metadata: {
        reservationId: resId,
        confirmationCode: code,
        guestName: guest
      }
    });
  }

  private handleIncomingStatusUpdate(rawPayload: unknown, context: { tenantId: string; propertyId: string }): void {
    if (!rawPayload || !this.eventHandler) return;
    const payload = rawPayload as Record<string, unknown>;
    const resId = String(payload['reservationId'] || payload['id'] || '');
    const code = String(payload['confirmationCode'] || resId.substring(0, 8).toUpperCase());
    const newStatus = String(payload['newStatus'] || '');
    const isCancel = newStatus === 'Cancelled';

    this.eventHandler({
      id: `sig-status-${resId}-${Date.now()}`,
      tenantId: context.tenantId,
      propertyId: String(payload['propertyId'] || context.propertyId),
      type: isCancel ? 'ReservationCancelled' : 'NewReservation',
      title: isCancel ? 'Đơn đặt phòng bị hủy' : 'Cập nhật trạng thái đặt phòng',
      message: isCancel
        ? `Đơn đặt phòng #${code} vừa chuyển sang trạng thái Đã hủy.`
        : `Đơn đặt phòng #${code} đã cập nhật sang trạng thái ${newStatus}.`,
      createdAtUtc: String(payload['updatedAtUtc'] || new Date().toISOString()),
      isRead: false,
      metadata: {
        reservationId: resId,
        confirmationCode: code
      }
    });
  }

  private handleIncomingHousekeeping(rawPayload: unknown, context: { tenantId: string; propertyId: string }): void {
    if (!rawPayload || !this.eventHandler) return;
    const payload = rawPayload as Record<string, unknown>;
    const roomNumber = String(payload['roomNumber'] || '');
    const roomStatus = String(payload['roomStatus'] || '');
    const isClean = roomStatus === 'Clean';

    this.eventHandler({
      id: `sig-housekeeping-${roomNumber}-${Date.now()}`,
      tenantId: context.tenantId,
      propertyId: String(payload['propertyId'] || context.propertyId),
      type: isClean ? 'RoomCleaningCompleted' : 'RoomNeedsCleaning',
      title: isClean ? 'Phòng đã dọn xong' : 'Phòng cần dọn',
      message: String(
        payload['message'] ||
          (isClean
            ? `Phòng ${roomNumber} đã dọn dẹp hoàn tất và sẵn sàng đón khách.`
            : `Phòng ${roomNumber} đang ở trạng thái ${roomStatus}.`)
      ),
      createdAtUtc: String(payload['updatedAtUtc'] || new Date().toISOString()),
      isRead: false,
      metadata: {
        roomNumber
      }
    });
  }
}

