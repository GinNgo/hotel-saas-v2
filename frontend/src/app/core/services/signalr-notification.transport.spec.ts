import { describe, it, expect, vi } from 'vitest';
import { SignalRNotificationTransport } from './signalr-notification.transport';
import { RealtimeNotificationContractDto } from '../../shared/components/notification-bell/notification-bell.model';

interface SignalRTransportHandlers {
  handleIncomingPaymentConfirmed(
    rawPayload: unknown,
    context: { tenantId: string; propertyId: string }
  ): void;
  handleIncomingCancellationRequested(
    rawPayload: unknown,
    context: { tenantId: string; propertyId: string }
  ): void;
}

describe('SignalRNotificationTransport VND currency formatting', () => {
  const ctx = { tenantId: 'tenant-1', propertyId: 'prop-1' };

  it('formats BookingPaymentConfirmed amount with canonical " ₫" suffix', () => {
    const transport = new SignalRNotificationTransport();
    const received: RealtimeNotificationContractDto[] = [];
    transport.onEvent((evt) => received.push(evt));

    const internal = transport as unknown as SignalRTransportHandlers;
    internal.handleIncomingPaymentConfirmed(
      {
        reservationId: 'res-101',
        confirmationCode: 'RES-101',
        guestName: 'Nguyễn Văn A',
        paidAmount: 1200000,
        paymentMethod: 'VietQR'
      },
      ctx
    );

    expect(received.length).toBe(1);
    expect(received[0].message).toContain('1.200.000 ₫');
    expect(received[0].message).not.toContain('1.200.000 đ');
  });

  it('formats BookingCancellationRequested refundableAmount with canonical " ₫" suffix', () => {
    const transport = new SignalRNotificationTransport();
    const onEventSpy = vi.fn<(evt: RealtimeNotificationContractDto) => void>();
    transport.onEvent(onEventSpy);

    const internal = transport as unknown as SignalRTransportHandlers;
    internal.handleIncomingCancellationRequested(
      {
        reservationId: 'res-102',
        confirmationCode: 'RES-102',
        guestName: 'Trần Thị B',
        refundableAmount: 850000
      },
      ctx
    );

    expect(onEventSpy).toHaveBeenCalledTimes(1);
    const event = onEventSpy.mock.calls[0][0];
    expect(event.message).toContain('850.000 ₫.');
    expect(event.message).not.toContain('850.000 đ.');
  });
});
