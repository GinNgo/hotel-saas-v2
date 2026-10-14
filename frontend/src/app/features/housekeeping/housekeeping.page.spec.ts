import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { HousekeepingPage } from './housekeeping.page';
import { RoomService } from '../../core/services/room.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomDto } from '../../core/models/room.model';
import { RoomStatus } from '../../core/models/enums';
import { HttpErrorResponse } from '@angular/common/http';

describe('HousekeepingPage Logic, Pagination & Server-Side Filtering', () => {
  let mockRoomService: any;
  let mockAlertService: any;
  let mockAuthService: any;

  const samplePage1Rooms: RoomDto[] = [
    {
      id: 'room-1',
      roomNumber: '101',
      floor: 1,
      status: RoomStatus.Clean,
      isActive: true,
      roomTypeId: 'type-1',
      roomTypeName: 'Deluxe Double',
      roomTypeCode: 'DLX',
      basePrice: 1200000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    },
    {
      id: 'room-2',
      roomNumber: '102',
      floor: 1,
      status: RoomStatus.Dirty,
      isActive: true,
      roomTypeId: 'type-2',
      roomTypeName: 'Standard Twin',
      roomTypeCode: 'STD',
      basePrice: 800000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    },
    {
      id: 'room-3',
      roomNumber: '201',
      floor: 2,
      status: RoomStatus.Cleaning,
      isActive: true,
      roomTypeId: 'type-1',
      roomTypeName: 'Deluxe Double',
      roomTypeCode: 'DLX',
      basePrice: 1200000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    },
    {
      id: 'room-4',
      roomNumber: '202',
      floor: 2,
      status: RoomStatus.Occupied,
      isActive: true,
      roomTypeId: 'type-2',
      roomTypeName: 'Standard Twin',
      roomTypeCode: 'STD',
      basePrice: 800000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    },
    {
      id: 'room-5',
      roomNumber: '301',
      floor: 3,
      status: RoomStatus.OutOfService,
      isActive: true,
      roomTypeId: 'type-3',
      roomTypeName: 'Suite',
      roomTypeCode: 'SUI',
      basePrice: 2000000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    }
  ];

  const samplePage2Rooms: RoomDto[] = [
    {
      id: 'room-101-deep',
      roomNumber: '501',
      floor: 5,
      status: RoomStatus.Dirty,
      isActive: true,
      roomTypeId: 'type-1',
      roomTypeName: 'Deluxe Double',
      roomTypeCode: 'DLX',
      basePrice: 1500000,
      notes: null,
      createdAtUtc: '2026-10-09T10:00:00Z'
    }
  ];

  beforeEach(() => {
    mockRoomService = {
      getRooms: vi.fn().mockReturnValue(of({ items: samplePage1Rooms, totalCount: 150 })),
      updateRoomStatus: vi.fn()
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastWarning: vi.fn(),
      toastError: vi.fn()
    };

    mockAuthService = {
      hasPermission: vi.fn().mockReturnValue(true)
    };
  });

  function createComponent(): HousekeepingPage {
    const injector = Injector.create({
      providers: [
        { provide: RoomService, useValue: mockRoomService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
    return runInInjectionContext(injector, () => new HousekeepingPage());
  }

  it('loads rooms and calculates KPI counts strictly on current page ("trên trang đang hiển thị")', () => {
    const comp = createComponent();
    comp.ngOnInit();

    // 5 rooms on current page out of 150 total
    expect(comp.rooms().length).toBe(5);
    expect(comp.pageRoomsCount()).toBe(5);
    expect(comp.totalCount()).toBe(150);
    expect(comp.cleanCount()).toBe(1);
    expect(comp.dirtyCount()).toBe(1);
    expect(comp.cleaningCount()).toBe(1);
    expect(comp.occupiedCount()).toBe(1);
    expect(comp.outOfServiceCount()).toBe(1);
  });

  it('groups rooms correctly by floor in ascending order on the current page', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const groups = comp.groupedRoomsByFloor();
    expect(groups.length).toBe(3);
    expect(groups[0].floor).toBe(1);
    expect(groups[0].rooms.length).toBe(2);
    expect(groups[1].floor).toBe(2);
    expect(groups[1].rooms.length).toBe(2);
    expect(groups[2].floor).toBe(3);
    expect(groups[2].rooms.length).toBe(1);
  });

  it('navigates to page 2 and passes page=2 to backend query', () => {
    const comp = createComponent();
    comp.ngOnInit();

    mockRoomService.getRooms.mockReturnValue(of({ items: samplePage2Rooms, totalCount: 150 }));
    comp.onPageChange(2);

    expect(comp.currentPage()).toBe(2);
    expect(mockRoomService.getRooms).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 })
    );
    expect(comp.rooms().length).toBe(1);
    expect(comp.rooms()[0].roomNumber).toBe('501');
  });

  it('sends status filter to backend before pagination and resets page to 1', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.currentPage.set(3); // giả lập đang ở trang 3

    comp.setStatusFilter(RoomStatus.Dirty);

    expect(comp.currentPage()).toBe(1);
    expect(comp.activeStatusFilter()).toBe(RoomStatus.Dirty);
    expect(mockRoomService.getRooms).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: RoomStatus.Dirty, page: 1 })
    );
  });

  it('sends floor filter to backend before pagination and resets page to 1', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.currentPage.set(2);

    comp.onFloorChange(5);

    expect(comp.currentPage()).toBe(1);
    expect(comp.selectedFloor()).toBe(5);
    expect(mockRoomService.getRooms).toHaveBeenLastCalledWith(
      expect.objectContaining({ floor: 5, page: 1 })
    );
  });

  it('finds rooms outside the first 100 records by sending search query to backend before pagination', () => {
    const comp = createComponent();
    comp.ngOnInit();

    // Giả lập phòng '501' nằm ở bản ghi thứ 120 ngoài 100 records đầu tiên
    mockRoomService.getRooms.mockReturnValue(of({ items: samplePage2Rooms, totalCount: 1 }));

    comp.searchRoomNumber.set('501');
    comp.onSearchSubmit();

    expect(comp.currentPage()).toBe(1);
    expect(mockRoomService.getRooms).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '501', page: 1 })
    );
    expect(comp.rooms().length).toBe(1);
    expect(comp.rooms()[0].roomNumber).toBe('501');
  });

  it('resets page to 1 when changing page size or clicking resetFilters', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.currentPage.set(4);

    comp.onPageSizeChange(50);
    expect(comp.currentPage()).toBe(1);
    expect(comp.currentPageSize()).toBe(50);

    comp.currentPage.set(3);
    comp.resetFilters();
    expect(comp.currentPage()).toBe(1);
    expect(comp.activeStatusFilter()).toBe('ALL');
    expect(comp.selectedFloor()).toBeNull();
    expect(comp.searchRoomNumber()).toBe('');
  });

  it('sends correct expectedOldStatus with PATCH to update status', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const dirtyRoom = samplePage1Rooms[1]; // room-2, status Dirty
    const updatedRoom: RoomDto = { ...dirtyRoom, status: RoomStatus.Cleaning };
    mockRoomService.updateRoomStatus.mockReturnValue(of(updatedRoom));

    comp.changeRoomStatus(dirtyRoom, RoomStatus.Cleaning);

    expect(mockRoomService.updateRoomStatus).toHaveBeenCalledWith(
      'room-2',
      RoomStatus.Cleaning,
      RoomStatus.Dirty
    );
    expect(mockAlertService.toastSuccess).toHaveBeenCalled();
    const roomInList = comp.rooms().find(r => r.id === 'room-2');
    expect(roomInList?.status).toBe(RoomStatus.Cleaning);
  });

  it('handles 409 ERR_STALE_STATE by warning user and re-fetching authoritative data', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const dirtyRoom = samplePage1Rooms[1]; // room-2, status Dirty
    const conflictError = new HttpErrorResponse({
      status: 409,
      error: { code: 'ERR_STALE_STATE', message: 'Trạng thái phòng đã thay đổi trước đó.' }
    });
    mockRoomService.updateRoomStatus.mockReturnValue(throwError(() => conflictError));

    comp.changeRoomStatus(dirtyRoom, RoomStatus.Cleaning);

    expect(mockAlertService.toastWarning).toHaveBeenCalledWith(
      expect.stringContaining('Trạng thái phòng đã thay đổi trước đó')
    );
    // Should re-fetch data (getRooms called again)
    expect(mockRoomService.getRooms).toHaveBeenCalledTimes(2);
  });

  it('prevents update when user does not have update permission', () => {
    mockAuthService.hasPermission.mockReturnValue(false);
    const comp = createComponent();
    comp.ngOnInit();

    const dirtyRoom = samplePage1Rooms[1];
    comp.changeRoomStatus(dirtyRoom, RoomStatus.Cleaning);

    expect(mockRoomService.updateRoomStatus).not.toHaveBeenCalled();
  });

  describe('Race condition & Latest-request-wins via switchMap stream', () => {
    it('guarantees latest-request-wins: slow page 1 resolving after page 2 does not overwrite page 2 state', () => {
      const comp = createComponent();
      const page1Subject$ = new Subject<any>();
      const page2Subject$ = new Subject<any>();

      let callCount = 0;
      mockRoomService.getRooms.mockImplementation((filter: any) => {
        callCount++;
        if (filter.page === 1) {
          return page1Subject$;
        } else if (filter.page === 2) {
          return page2Subject$;
        }
        return of({ items: [], totalCount: 0 });
      });

      comp.ngOnInit(); // triggers initial loadRooms() for page 1
      expect(callCount).toBe(1);
      expect(comp.loading()).toBe(true);

      // User navigates to page 2 before page 1 resolves
      comp.onPageChange(2);
      expect(callCount).toBe(2);
      expect(comp.currentPage()).toBe(2);

      // Page 2 resolves first
      page2Subject$.next({ items: samplePage2Rooms, totalCount: 150 });
      page2Subject$.complete();

      expect(comp.loading()).toBe(false);
      expect(comp.rooms().length).toBe(1);
      expect(comp.rooms()[0].roomNumber).toBe('501');

      // Page 1 resolves later (stale response)
      page1Subject$.next({ items: samplePage1Rooms, totalCount: 150 });
      page1Subject$.complete();

      // Page 2 data must remain intact and NOT be overwritten by page 1
      expect(comp.rooms().length).toBe(1);
      expect(comp.rooms()[0].roomNumber).toBe('501');
      expect(comp.totalCount()).toBe(150);
    });

    it('ensures stale request errors do not corrupt or overwrite fresh state', () => {
      const comp = createComponent();
      const page1Subject$ = new Subject<any>();
      const page2Subject$ = new Subject<any>();

      mockRoomService.getRooms.mockImplementation((filter: any) => {
        if (filter.page === 1) return page1Subject$;
        if (filter.page === 2) return page2Subject$;
        return of({ items: [], totalCount: 0 });
      });

      comp.ngOnInit(); // triggers page 1 request

      // User navigates to page 2
      comp.onPageChange(2);

      // Page 2 resolves successfully
      page2Subject$.next({ items: samplePage2Rooms, totalCount: 150 });
      page2Subject$.complete();

      expect(comp.rooms()[0].roomNumber).toBe('501');
      expect(comp.loadError()).toBeNull();

      // Now page 1 fails with an error (stale request error)
      page1Subject$.error(new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' }));

      // Page 2 data and error state must remain completely unaffected
      expect(comp.rooms().length).toBe(1);
      expect(comp.rooms()[0].roomNumber).toBe('501');
      expect(comp.loadError()).toBeNull();
      expect(mockAlertService.toastError).not.toHaveBeenCalled();
    });

    it('handles current request error gracefully and recovers cleanly on subsequent retry', () => {
      const comp = createComponent();
      const errorSubject$ = new Subject<any>();

      mockRoomService.getRooms.mockReturnValueOnce(errorSubject$);
      comp.ngOnInit();

      expect(comp.loading()).toBe(true);
      expect(comp.loadError()).toBeNull();

      // Trigger error on active request
      errorSubject$.error(new HttpErrorResponse({ status: 500, statusText: 'Server Error' }));

      expect(comp.loading()).toBe(false);
      expect(comp.loadError()).toBe('Lỗi kết nối máy chủ hoặc chưa chọn chi nhánh.');
      expect(mockAlertService.toastError).toHaveBeenCalledWith('Không thể tải danh sách buồng phòng.');

      // User retries loading
      mockRoomService.getRooms.mockReturnValueOnce(of({ items: samplePage1Rooms, totalCount: 150 }));
      comp.loadRooms();

      expect(comp.loading()).toBe(false);
      expect(comp.loadError()).toBeNull();
      expect(comp.rooms().length).toBe(5);
      expect(comp.rooms()[0].roomNumber).toBe('101');
    });

    it('cancels in-flight requests and avoids updating UI state after component destruction', () => {
      const comp = createComponent();
      const pendingSubject$ = new Subject<any>();

      mockRoomService.getRooms.mockReturnValue(pendingSubject$);
      comp.ngOnInit();

      expect(comp.loading()).toBe(true);
      expect(comp.rooms().length).toBe(0);

      // Component is destroyed while request is still pending
      comp.ngOnDestroy();

      // Subject emits after destroy
      pendingSubject$.next({ items: samplePage1Rooms, totalCount: 150 });
      pendingSubject$.complete();

      // State should not have been updated with emitted data
      expect(comp.rooms().length).toBe(0);
    });
  });
});
