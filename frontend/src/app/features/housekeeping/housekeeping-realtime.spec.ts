import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { HousekeepingPage } from './housekeeping.page';
import { AuthService } from '../../core/services/auth.service';
import { RoomService } from '../../core/services/room.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationItem, RealtimeConnectionState } from '../../shared/components/notification-bell/notification-bell.model';

describe('Housekeeping realtime and polling fallback', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const notifications = {
      connectionState: signal<RealtimeConnectionState>('disconnected'),
      activePropertyId: signal<string | null>('branch-a'),
      activeTenantId: signal<string | null>('tenant-a'),
      notifications: signal<readonly NotificationItem[]>([])
    };
    const auth = { activePropertyId: signal<string | null>('branch-a'), hasPermission: () => true, isLoggedIn: true };
    const injector = Injector.create({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: RoomService, useValue: { getRooms: () => of({ items: [], totalCount: 0 }), roomStatusChanged: signal(null) } },
      { provide: AlertService, useValue: {} },
      { provide: NotificationService, useValue: notifications }
    ] });
    const page = runInInjectionContext(injector, () => new HousekeepingPage());
    const rooms = vi.spyOn(page, 'loadRooms').mockImplementation(() => {});
    const tasks = vi.spyOn(page, 'loadTasks').mockImplementation(() => {});
    const poll = vi.spyOn(page, 'pollServerSync').mockImplementation(() => {});
    return { page, notifications, auth, rooms, tasks, poll };
  }

  it('polls only while disconnected, refreshes on reconnect, resumes fallback and cleans up', () => {
    vi.useFakeTimers();
    const { page, notifications, poll, rooms, tasks } = setup();
    page.syncRealtime();
    vi.advanceTimersByTime(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
    notifications.connectionState.set('connected');
    page.syncRealtime();
    expect(rooms).toHaveBeenCalledTimes(1);
    expect(tasks).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(20_000);
    expect(poll).toHaveBeenCalledTimes(1);
    notifications.connectionState.set('reconnecting');
    page.syncRealtime();
    vi.advanceTimersByTime(10_000);
    expect(poll).toHaveBeenCalledTimes(2);
    page.ngOnDestroy();
    vi.advanceTimersByTime(20_000);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('refreshes once for mapped housekeeping/status events and ignores other branches and read changes', () => {
    const { page, notifications, rooms } = setup();
    notifications.connectionState.set('connected');
    page.syncRealtime();
    rooms.mockClear();
    const event: NotificationItem = { id: 'event-1', tenantId: 'tenant-a', propertyId: 'branch-a', type: 'RoomNeedsCleaning',
      title: '', message: '', createdAtUtc: new Date().toISOString(), isRead: false };
    notifications.notifications.set([{ ...event, propertyId: 'branch-b' }]);
    page.syncRealtime();
    expect(rooms).not.toHaveBeenCalled();
    notifications.notifications.set([event]);
    page.syncRealtime();
    expect(rooms).toHaveBeenCalledTimes(1);
    notifications.notifications.set([{ ...event, isRead: true }]);
    page.syncRealtime();
    expect(rooms).toHaveBeenCalledTimes(1);
    notifications.notifications.set([{ ...event, id: 'event-2', type: 'NewReservation' }, event]);
    page.syncRealtime();
    expect(rooms).toHaveBeenCalledTimes(2);
    page.ngOnDestroy();
  });
});
