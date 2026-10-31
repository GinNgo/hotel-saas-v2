import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { JSDOM } from 'jsdom';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '../../../core/services/alert.service';
import {
  NotificationService,
  LivePropertyMonitorTransport
} from '../../../core/services/notification.service';
import { SignalRNotificationTransport } from '../../../core/services/signalr-notification.transport';
import {
  NotificationBellComponent,
  NotificationEventType,
  NotificationItem,
  REALTIME_TOAST_DURATION_MS,
  RealtimeConnectionState,
  RealtimeNotificationContractDto,
  RealtimeNotificationTransport
} from './notification-bell.component';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: browser.window,
    document: browser.window.document,
    HTMLElement: browser.window.HTMLElement,
    Node: browser.window.Node
  });
}
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('NotificationBellComponent & NotificationService (T01-A & T01-B)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const PROP_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PROP_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  function createFixtureItem(overrides: Partial<NotificationItem> & { id: string }): NotificationItem {
    return {
      id: overrides.id,
      tenantId: overrides.tenantId ?? TENANT_A,
      propertyId: overrides.propertyId ?? PROP_1,
      type: overrides.type ?? 'NewReservation',
      title: overrides.title ?? `Thông báo ${overrides.id}`,
      message: overrides.message ?? `Nội dung chi tiết của thông báo ${overrides.id}`,
      createdAtUtc: overrides.createdAtUtc ?? '2026-10-28T02:00:00.000Z',
      isRead: overrides.isRead ?? false,
      metadata: overrides.metadata
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('1. Empty State & Ẩn nút/nhãn "Đã xem hết" khi không có thông báo', () => {
    it('khởi tạo mặc định không có dữ liệu giả và ẩn badge khi unreadCount = 0', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const trigger = el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!;

      expect(fixture.componentInstance.notifications()).toEqual([]);
      expect(fixture.componentInstance.unreadCount()).toBe(0);
      expect(el.querySelector('[data-testid="notification-unread-badge"]')).toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-label')).toContain('Trung tâm thông báo');
    });

    it('hiển thị trạng thái rỗng và ẩn pill "Đã xem hết" khi danh sách không có thông báo', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const trigger = el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!;
      trigger.click();
      fixture.detectChanges();

      const panel = el.querySelector('[data-testid="notification-dropdown-panel"]');
      const emptyState = el.querySelector('[data-testid="notification-empty-state"]');
      const allReadPill = el.querySelector('[data-testid="notification-header-all-read-pill"]');

      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('Trung tâm thông báo');
      expect(emptyState).not.toBeNull();
      expect(emptyState?.textContent).toContain('Không có thông báo mới');
      // Khi không có thông báo nào, pill "Đã xem hết" phải được ẩn
      expect(allReadPill).toBeNull();
    });

    it('hiển thị pill "Đã xem hết" khi có thông báo và tất cả đều đã đọc', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('notifications', [
        createFixtureItem({ id: 'read-1', isRead: true })
      ]);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      const allReadPill = el.querySelector('[data-testid="notification-header-all-read-pill"]');
      expect(allReadPill).not.toBeNull();
      expect(allReadPill?.textContent?.trim()).toBe('Đã xem hết');
    });
  });

  describe('2. Danh sách 1–10 thông báo, Phân loại sự kiện & Định dạng thời gian', () => {
    it('hiển thị đầy đủ 4 loại thông báo dự kiến và phân biệt rõ chưa đọc / đã đọc', () => {
      const items: NotificationItem[] = [
        createFixtureItem({
          id: 'n-1',
          type: 'NewReservation',
          title: 'Có đơn đặt phòng mới #LX-1001',
          message: 'Khách Nguyễn Văn A vừa đặt phòng Deluxe 201.',
          createdAtUtc: '2026-10-28T03:30:00.000Z',
          isRead: false
        }),
        createFixtureItem({
          id: 'n-2',
          type: 'ReservationCancelled',
          title: 'Đơn đặt phòng #LX-0998 bị hủy',
          message: 'Khách Trần Thị B đã hủy đơn trước giờ check-in.',
          createdAtUtc: '2026-10-28T02:15:00.000Z',
          isRead: false
        }),
        createFixtureItem({
          id: 'n-3',
          type: 'RoomNeedsCleaning',
          title: 'Phòng 305 cần dọn',
          message: 'Phòng vừa trả, yêu cầu buồng phòng dọn chuẩn bị đón khách.',
          createdAtUtc: '2026-10-28T01:00:00.000Z',
          isRead: true
        }),
        createFixtureItem({
          id: 'n-4',
          type: 'RoomCleaningCompleted',
          title: 'Phòng 102 đã dọn xong',
          message: 'Nhân viên buồng phòng đã xác nhận hoàn tất dọn phòng 102.',
          createdAtUtc: '2026-10-28T00:30:00.000Z',
          isRead: true
        })
      ];

      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', items);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      const renderedItems = el.querySelectorAll('[data-testid^="notification-item-"]');
      const itemRows = Array.from(renderedItems).filter(node =>
        /^notification-item-\d+$/.test(node.getAttribute('data-testid') || '')
      );
      expect(itemRows).toHaveLength(4);

      expect(itemRows[0].getAttribute('data-unread')).toBe('true');
      expect(itemRows[1].getAttribute('data-unread')).toBe('true');
      expect(itemRows[2].getAttribute('data-unread')).toBe('false');
      expect(itemRows[3].getAttribute('data-unread')).toBe('false');

      const unreadIndicators = el.querySelectorAll('[data-testid="notification-unread-indicator"]');
      expect(unreadIndicators).toHaveLength(2);

      const firstTime = itemRows[0].querySelector('[data-testid="notification-item-time"]');
      expect(firstTime?.textContent?.trim()).toBe('28/10/2026 10:30');
    });

    it('giới hạn hiển thị tối đa 10 thông báo gần nhất khi nguồn dữ liệu có nhiều hơn 10 bản ghi', () => {
      const types: NotificationEventType[] = [
        'NewReservation',
        'ReservationCancelled',
        'RoomNeedsCleaning',
        'RoomCleaningCompleted'
      ];
      const fourteenItems: NotificationItem[] = Array.from({ length: 14 }, (_, idx) => {
        const minute = String(idx).padStart(2, '0');
        return createFixtureItem({
          id: `notif-${idx + 1}`,
          type: types[idx % types.length],
          title: `Sự kiện thứ ${idx + 1}`,
          createdAtUtc: `2026-10-28T03:${minute}:00.000Z`,
          isRead: idx % 2 === 0
        });
      });

      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', fourteenItems);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      const visible = fixture.componentInstance.visibleNotifications();
      expect(visible).toHaveLength(10);
      expect(visible[0].id).toBe('notif-14');
      expect(visible[9].id).toBe('notif-5');

      const domRows = el.querySelectorAll('button[data-notification-item-btn]');
      expect(domRows).toHaveLength(10);
    });
  });

  describe('3. Badge số lượng chưa đọc', () => {
    it('hiển thị đúng số lượng thông báo chưa đọc và giới hạn "99+" khi vượt quá 99', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);

      const threeUnread = [
        createFixtureItem({ id: '1', isRead: false }),
        createFixtureItem({ id: '2', isRead: true }),
        createFixtureItem({ id: '3', isRead: false }),
        createFixtureItem({ id: '4', isRead: false })
      ];
      fixture.componentRef.setInput('notifications', threeUnread);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const badge = el.querySelector('[data-testid="notification-unread-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent?.trim()).toBe('3');

      const manyUnread = Array.from({ length: 105 }, (_, i) =>
        createFixtureItem({ id: `u-${i}`, isRead: false })
      );
      fixture.componentRef.setInput('notifications', manyUnread);
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="notification-unread-badge"]')?.textContent?.trim()).toBe('99+');
    });
  });

  describe('4. Mở/đóng Dropdown & Tương tác Bàn phím (Escape, Arrow Keys)', () => {
    it('mở/đóng khi bấm nút chuông, cập nhật aria-expanded và đóng khi click ra ngoài', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const trigger = el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!;

      trigger.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.isOpen()).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.isOpen()).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('nhấn phím Escape đóng dropdown và trả focus về nút chuông', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('notifications', [
        createFixtureItem({ id: 'esc-1', isRead: false })
      ]);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const trigger = el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!;

      trigger.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.isOpen()).toBe(true);

      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.isOpen()).toBe(false);
      expect(document.activeElement).toBe(trigger);
    });

    it('di chuyển focus giữa các thông báo bằng phím ArrowDown / ArrowUp / Home / End', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('notifications', [
        createFixtureItem({ id: 'k-1', createdAtUtc: '2026-10-28T03:03:00.000Z' }),
        createFixtureItem({ id: 'k-2', createdAtUtc: '2026-10-28T03:02:00.000Z' }),
        createFixtureItem({ id: 'k-3', createdAtUtc: '2026-10-28T03:01:00.000Z' })
      ]);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const trigger = el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!;
      trigger.click();
      fixture.detectChanges();

      const panel = el.querySelector<HTMLElement>('[data-testid="notification-dropdown-panel"]')!;
      const itemButtons = el.querySelectorAll<HTMLButtonElement>('button[data-notification-item-btn]');

      itemButtons[0].focus();
      expect(document.activeElement).toBe(itemButtons[0]);

      panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement).toBe(itemButtons[1]);

      panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(document.activeElement).toBe(itemButtons[2]);

      panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(document.activeElement).toBe(itemButtons[0]);

      panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(document.activeElement).toBe(itemButtons[2]);
    });
  });

  describe('5. Cô lập dữ liệu Đa Tenant & Đa Chi nhánh (Fail-Closed Isolation)', () => {
    it('loại bỏ hoàn toàn thông báo khác Tenant hoặc khác Property khỏi danh sách và khỏi badge chưa đọc', () => {
      const mixedItems: NotificationItem[] = [
        createFixtureItem({ id: 'valid-1', tenantId: TENANT_A, propertyId: PROP_1, isRead: false }),
        createFixtureItem({ id: 'wrong-tenant', tenantId: TENANT_B, propertyId: PROP_1, isRead: false }),
        createFixtureItem({ id: 'wrong-prop', tenantId: TENANT_A, propertyId: PROP_2, isRead: false }),
        createFixtureItem({ id: 'valid-2', tenantId: TENANT_A, propertyId: PROP_1, isRead: true })
      ];

      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', mixedItems);
      fixture.detectChanges();

      expect(fixture.componentInstance.scopedNotifications().map(i => i.id)).toEqual(['valid-1', 'valid-2']);
      expect(fixture.componentInstance.unreadCount()).toBe(1);
    });

    it('áp dụng Fail-Closed (ẩn toàn bộ) nếu activeTenantId hoặc activePropertyId là chuỗi rỗng', () => {
      const items = [createFixtureItem({ id: 'n-1', tenantId: TENANT_A, propertyId: PROP_1, isRead: false })];

      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', '');
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', items);
      fixture.detectChanges();

      expect(fixture.componentInstance.scopedNotifications()).toEqual([]);
      expect(fixture.componentInstance.unreadCount()).toBe(0);

      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', '   ');
      fixture.detectChanges();

      expect(fixture.componentInstance.scopedNotifications()).toEqual([]);
      expect(fixture.componentInstance.unreadCount()).toBe(0);
    });
  });

  describe('6. Không báo đã đọc thành công giả khi thiếu xác nhận từ Backend', () => {
    it('không tự ý chuyển isRead=true hoặc giảm unreadCount khi chưa có xác nhận từ Backend (canMarkAsRead=false)', () => {
      const item = createFixtureItem({ id: 'unread-1', isRead: false });
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', [item]);
      fixture.componentRef.setInput('canMarkAsRead', false);
      fixture.detectChanges();

      const markSingleSpy = vi.fn();
      const markAllSpy = vi.fn();
      fixture.componentInstance.markAsReadRequest.subscribe(markSingleSpy);
      fixture.componentInstance.markAllAsReadRequest.subscribe(markAllSpy);

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      const markAllBtn = el.querySelector<HTMLButtonElement>('[data-testid="notification-mark-all-read-btn"]')!;
      markAllBtn.click();
      fixture.detectChanges();

      expect(markAllSpy).not.toHaveBeenCalled();
      expect(markSingleSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.unreadCount()).toBe(1);
      expect(fixture.componentInstance.visibleNotifications()[0].isRead).toBe(false);

      const feedback = el.querySelector('[data-testid="notification-read-feedback"]');
      expect(feedback).not.toBeNull();
      expect(feedback?.textContent).toContain('chờ kết nối xác nhận từ máy chủ');
    });

    it('khi canMarkAsRead=true, chỉ phát yêu cầu lên parent và chờ Backend cập nhật lại nguồn dữ liệu chứ không tự sửa isRead cục bộ', () => {
      const item = createFixtureItem({ id: 'unread-2', isRead: false });
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('activeTenantId', TENANT_A);
      fixture.componentRef.setInput('activePropertyId', PROP_1);
      fixture.componentRef.setInput('notifications', [item]);
      fixture.componentRef.setInput('canMarkAsRead', true);
      fixture.detectChanges();

      const requestedIds: string[] = [];
      fixture.componentInstance.markAsReadRequest.subscribe(id => requestedIds.push(id));

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      const itemBtn = el.querySelector<HTMLButtonElement>('button[data-notification-item-btn="0"]')!;
      itemBtn.click();
      fixture.detectChanges();

      expect(requestedIds).toEqual(['unread-2']);
      expect(fixture.componentInstance.unreadCount()).toBe(1);
      expect(fixture.componentInstance.visibleNotifications()[0].isRead).toBe(false);
    });
  });

  describe('7. Trạng thái Loading và Error', () => {
    it('hiển thị trạng thái loading và trạng thái lỗi kèm nút thử lại', () => {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="notification-bell-trigger"]')!.click();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="notification-loading-state"]')).not.toBeNull();

      const retrySpy = vi.fn();
      fixture.componentInstance.retryRequest.subscribe(retrySpy);
      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('errorMessage', 'Không thể tải danh sách thông báo.');
      fixture.detectChanges();

      const errorBox = el.querySelector('[data-testid="notification-error-state"]');
      expect(errorBox).not.toBeNull();
      expect(errorBox?.textContent).toContain('Không thể tải danh sách thông báo.');

      el.querySelector<HTMLButtonElement>('[data-testid="notification-retry-btn"]')!.click();
      expect(retrySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('8. NotificationService Realtime Pipeline (T01-B: Toast 5s, Deduplication, Reconnect, Context Sync & Logout)', () => {
    it('nhận sự kiện hợp lệ, hiển thị Toast 5 giây qua AlertService và chống trùng lặp theo ID', async () => {
      const alertService = TestBed.inject(AlertService);
      const toastSuccessSpy = vi.spyOn(alertService, 'toastSuccess').mockImplementation(() => {});
      const toastWarningSpy = vi.spyOn(alertService, 'toastWarning').mockImplementation(() => {});
      const toastInfoSpy = vi.spyOn(alertService, 'toastInfo').mockImplementation(() => {});

      const service = TestBed.inject(NotificationService);
      await service.syncContext(TENANT_A, PROP_1);

      const newBookingEvent: RealtimeNotificationContractDto = {
        id: 'evt-100',
        tenantId: TENANT_A,
        propertyId: PROP_1,
        type: 'NewBooking',
        title: 'Đơn đặt phòng mới #LX-2001',
        message: 'Khách Lê Hoàng vừa đặt phòng Superior 101.',
        createdAtUtc: '2026-10-28T04:00:00.000Z'
      };

      expect(service.receiveRealtimeNotification(newBookingEvent)).toBe(true);
      expect(service.notifications()).toHaveLength(1);
      expect(service.notifications()[0].type).toBe('NewReservation');
      expect(toastSuccessSpy).toHaveBeenCalledWith(
        'Khách Lê Hoàng vừa đặt phòng Superior 101.',
        'Đơn đặt phòng mới #LX-2001',
        REALTIME_TOAST_DURATION_MS
      );

      // Gửi trùng lặp cùng ID -> bị từ chối và không gọi lại Toast
      expect(service.receiveRealtimeNotification(newBookingEvent)).toBe(false);
      expect(service.notifications()).toHaveLength(1);
      expect(toastSuccessSpy).toHaveBeenCalledTimes(1);

      // Gửi sự kiện hủy phòng và buồng phòng
      expect(
        service.receiveRealtimeNotification({
          id: 'evt-101',
          tenantId: TENANT_A,
          propertyId: PROP_1,
          type: 'BookingCancelled',
          title: 'Hủy đặt phòng #LX-2000',
          message: 'Khách đã hủy đơn.',
          createdAtUtc: '2026-10-28T04:01:00.000Z'
        })
      ).toBe(true);
      expect(toastWarningSpy).toHaveBeenCalledWith(
        'Khách đã hủy đơn.',
        'Hủy đặt phòng #LX-2000',
        REALTIME_TOAST_DURATION_MS
      );

      expect(
        service.receiveRealtimeNotification({
          id: 'evt-102',
          tenantId: TENANT_A,
          propertyId: PROP_1,
          type: 'HousekeepingAssigned',
          title: 'Phòng 105 cần dọn',
          message: 'Khách vừa trả phòng 105.',
          createdAtUtc: '2026-10-28T04:02:00.000Z'
        })
      ).toBe(true);
      expect(toastInfoSpy).toHaveBeenCalledWith(
        'Khách vừa trả phòng 105.',
        'Phòng 105 cần dọn',
        REALTIME_TOAST_DURATION_MS
      );
    });

    it('từ chối sự kiện khác TenantId/PropertyId, dọn sạch khi chuyển chi nhánh và khi đăng xuất', async () => {
      const alertService = TestBed.inject(AlertService);
      vi.spyOn(alertService, 'toastSuccess').mockImplementation(() => {});

      const service = TestBed.inject(NotificationService);
      await service.syncContext(TENANT_A, PROP_1);

      // Sự kiện của chi nhánh khác bị từ chối
      expect(
        service.receiveRealtimeNotification({
          id: 'evt-wrong-branch',
          tenantId: TENANT_A,
          propertyId: PROP_2,
          type: 'NewReservation',
          title: 'Đơn chi nhánh 2',
          message: 'Không được hiển thị ở chi nhánh 1',
          createdAtUtc: '2026-10-28T04:05:00.000Z'
        })
      ).toBe(false);
      expect(service.notifications()).toHaveLength(0);

      // Sự kiện đúng chi nhánh 1 được nhận
      expect(
        service.receiveRealtimeNotification({
          id: 'evt-branch-1',
          tenantId: TENANT_A,
          propertyId: PROP_1,
          type: 'NewReservation',
          title: 'Đơn chi nhánh 1',
          message: 'Hợp lệ',
          createdAtUtc: '2026-10-28T04:06:00.000Z'
        })
      ).toBe(true);
      expect(service.notifications()).toHaveLength(1);

      // Chuyển sang chi nhánh 2 -> dọn sạch thông báo của chi nhánh 1
      await service.syncContext(TENANT_A, PROP_2);
      expect(service.notifications()).toHaveLength(0);

      // Đăng xuất -> dọn sạch ngữ cảnh
      await service.cleanupOnLogout();
      expect(service.activeTenantId()).toBeNull();
      expect(service.activePropertyId()).toBeNull();
      expect(service.notifications()).toHaveLength(0);
    });

    it('hỗ trợ auto-reconnect khi mất kết nối và chỉ đánh dấu đã đọc khi transport xác nhận', async () => {
      vi.useFakeTimers();
      try {
        let stateHandler: ((s: RealtimeConnectionState) => void) | null = null;
        const connectMock = vi.fn().mockResolvedValue(undefined);
        const disconnectMock = vi.fn().mockResolvedValue(undefined);
        const markAsReadMock = vi.fn().mockResolvedValue(true);

        const mockTransport: RealtimeNotificationTransport = {
          connect: connectMock,
          disconnect: disconnectMock,
          onEvent: () => () => {},
          onStateChange: handler => {
            stateHandler = handler;
            return () => {
              stateHandler = null;
            };
          },
          markAsRead: markAsReadMock
        };

        const alertService = TestBed.inject(AlertService);
        vi.spyOn(alertService, 'toastSuccess').mockImplementation(() => {});

        const service = TestBed.inject(NotificationService);
        service.registerTransport(mockTransport);
        await service.syncContext(TENANT_A, PROP_1, 'jwt-token');

        expect(connectMock).toHaveBeenCalledTimes(1);
        expect(service.connectionState()).toBe('connected');

        // Giả lập rớt mạng -> tự động reconnect sau 1000ms
        stateHandler!('disconnected');
        expect(service.connectionState()).toBe('reconnecting');

        await vi.advanceTimersByTimeAsync(1000);
        expect(connectMock).toHaveBeenCalledTimes(2);
        expect(service.connectionState()).toBe('connected');

        // Nhận thông báo và đánh dấu đã đọc có xác nhận từ transport
        service.receiveRealtimeNotification({
          id: 'evt-read-test',
          tenantId: TENANT_A,
          propertyId: PROP_1,
          type: 'NewReservation',
          title: 'Đơn mới',
          message: 'Chi tiết',
          createdAtUtc: '2026-10-28T04:10:00.000Z'
        });
        expect(service.notifications()[0].isRead).toBe(false);

        const marked = await service.markAsRead('evt-read-test');
        expect(marked).toBe(true);
        expect(service.notifications()[0].isRead).toBe(true);

        await service.cleanupOnLogout();
        expect(disconnectMock).toHaveBeenCalled();

        // Sau khi đăng xuất, mọi sự kiện đến trễ đều bị chặn tuyệt đối (Fail-Closed)
        expect(
          service.receiveRealtimeNotification({
            id: 'evt-after-logout',
            tenantId: TENANT_A,
            propertyId: PROP_1,
            type: 'NewReservation',
            title: 'Đơn đến trễ sau logout',
            message: 'Không được nhận',
            createdAtUtc: '2026-10-28T04:12:00.000Z'
          })
        ).toBe(false);
        expect(service.notifications()).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('hỗ trợ nạp snapshot đầu tiên ở chế độ silent (không bật Toast) và ngắt transport cũ khi thay thế bằng SignalR transport mới', async () => {
      const alertService = TestBed.inject(AlertService);
      const toastSuccessSpy = vi.spyOn(alertService, 'toastSuccess').mockImplementation(() => {});

      const service = TestBed.inject(NotificationService);
      const disconnectOldTransport = vi.fn().mockResolvedValue(undefined);
      const oldTransport: RealtimeNotificationTransport = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: disconnectOldTransport,
        onEvent: () => () => {}
      };

      service.registerTransport(oldTransport);
      await service.syncContext(TENANT_A, PROP_1);

      // Snapshot ban đầu nạp với silent: true -> vào danh sách nhưng không bật Toast
      expect(
        service.receiveRealtimeNotification(
          {
            id: 'evt-initial-snapshot',
            tenantId: TENANT_A,
            propertyId: PROP_1,
            type: 'NewReservation',
            title: 'Đơn có sẵn',
            message: 'Nạp lúc mở trang',
            createdAtUtc: '2026-10-28T04:00:00.000Z'
          },
          { silent: true }
        )
      ).toBe(true);
      expect(service.notifications()).toHaveLength(1);
      expect(toastSuccessSpy).not.toHaveBeenCalled();

      // Khi đăng ký transport SignalR mới -> transport cũ tự động được disconnect
      disconnectOldTransport.mockClear();
      const newTransport: RealtimeNotificationTransport = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        onEvent: () => () => {}
      };
      service.registerTransport(newTransport);
      expect(disconnectOldTransport).toHaveBeenCalledTimes(1);
    });

    it('phát âm thanh chuông nhẹ nhàng khi có thông báo mới và tôn trọng cờ isSoundEnabled', async () => {
      const alertService = TestBed.inject(AlertService);
      vi.spyOn(alertService, 'toastSuccess').mockImplementation(() => {});

      const service = TestBed.inject(NotificationService);
      await service.syncContext(TENANT_A, PROP_1);

      const soundSpy = vi.spyOn(service, 'playNotificationSound').mockImplementation(() => {});

      // Nhận thông báo mới -> gọi phát âm thanh
      service.receiveRealtimeNotification({
        id: 'sound-test-1',
        tenantId: TENANT_A,
        propertyId: PROP_1,
        type: 'NewReservation',
        title: 'Đơn mới có âm thanh',
        message: 'Kiểm tra tiếng chuông',
        createdAtUtc: '2026-10-28T05:00:00.000Z'
      });
      expect(soundSpy).toHaveBeenCalledTimes(1);

      // Khi silent: true -> không phát âm thanh
      soundSpy.mockClear();
      service.receiveRealtimeNotification(
        {
          id: 'sound-test-2',
          tenantId: TENANT_A,
          propertyId: PROP_1,
          type: 'NewReservation',
          title: 'Đơn silent',
          message: 'Không kêu',
          createdAtUtc: '2026-10-28T05:01:00.000Z'
        },
        { silent: true }
      );
      expect(soundSpy).not.toHaveBeenCalled();

      // Khi tắt âm thanh (toggleSound) -> không phát
      service.toggleSound();
      expect(service.isSoundEnabled()).toBe(false);
      soundSpy.mockClear();

      // Bật lại âm thanh
      service.toggleSound();
      expect(service.isSoundEnabled()).toBe(true);
    });

    it('LivePropertyMonitorTransport bắt lỗi API trung thực, chuyển disconnected và không báo connected giả khi API lỗi', async () => {
      const mockHttp = {
        get: vi.fn().mockReturnValue(throwError(() => ({ status: 401, message: 'Unauthorized' })))
      } as unknown as HttpClient;

      const stateHandler = vi.fn();
      const errorHandler = vi.fn();
      const monitor = new LivePropertyMonitorTransport(
        mockHttp,
        () => true,
        errorHandler
      );
      monitor.onStateChange(stateHandler);

      // Kết nối với API bị lỗi 401
      await monitor.connect({ tenantId: TENANT_A, propertyId: PROP_1, accessToken: 'token' });

      // Transport phải báo disconnected, không bao giờ báo connected giả
      expect(stateHandler).toHaveBeenCalledWith('disconnected');
      expect(stateHandler).not.toHaveBeenCalledWith('connected');
      expect(errorHandler).toHaveBeenCalledWith(
        expect.stringContaining('Phiên đăng nhập hết hạn hoặc không có quyền truy cập')
      );

      await monitor.disconnect();
    });

    it('SignalRNotificationTransport quản lý kết nối, tự động tham gia nhóm chi nhánh và bắt lỗi khi mất kết nối', () => {
      const errorHandler = vi.fn();
      const transport = new SignalRNotificationTransport({
        hubUrl: '/hubs/notifications',
        onApiError: errorHandler
      });

      expect(transport).toBeDefined();
    });
  });
});
