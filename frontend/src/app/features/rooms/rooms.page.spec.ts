import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).customElements = win.customElements;
  (globalThis as any).Node = win.Node;
  (globalThis as any).MutationObserver = win.MutationObserver;
}

import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { RoomsPage, ExtendedRoomDto } from './rooms.page';
import { RoomService } from '../../core/services/room.service';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomStatus } from '../../core/models/enums';
import { ReservationDto, RentalType, ReservationStatus } from '../../core/models/reservation.model';
import { FolioDto } from '../../core/models/payment.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('RoomsPage — Timeline Gantt Chart & Minibar Folio Tests', () => {
  let fixture: ComponentFixture<RoomsPage>;
  let component: RoomsPage;
  let mockRoomService: any;
  let mockReservationService: any;
  let mockRoomTypeService: any;
  let mockPaymentService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let activePropertyIdSignal: WritableSignal<string | null>;

  const sampleRooms: ExtendedRoomDto[] = [
    {
      id: 'room-101',
      roomNumber: '101',
      floor: 1,
      roomTypeId: 'rt-std',
      roomTypeName: 'Standard Double',
      roomTypeCode: 'STD',
      notes: null,
      isActive: true,
      status: RoomStatus.Clean,
      basePrice: 500000,
      createdAtUtc: '2026-10-01T00:00:00Z'
    },
    {
      id: 'room-102',
      roomNumber: '102',
      floor: 1,
      roomTypeId: 'rt-dlx',
      roomTypeName: 'Deluxe Suite',
      roomTypeCode: 'DLX',
      notes: null,
      isActive: true,
      status: RoomStatus.Occupied,
      basePrice: 900000,
      createdAtUtc: '2026-10-01T00:00:00Z',
      activeReservation: {
        id: 'res-999',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        roomId: 'room-102',
        roomNumber: '102',
        roomTypeId: 'rt-dlx',
        roomTypeName: 'Deluxe Suite',
        numberOfGuests: 2,
        confirmationCode: 'RES-102-ABC',
        guestName: 'Nguyễn Văn A',
        guestEmail: 'nguyenvana@gmail.com',
        rentalType: RentalType.Overnight,
        status: ReservationStatus.CheckedIn,
        checkInDate: '2026-10-18',
        checkOutDate: '2026-10-20',
        startAtUtc: '2026-10-18T14:00:00Z',
        endAtUtc: '2026-10-20T12:00:00Z',
        totalAmount: 1800000,
        currency: 'VND',
        createdAtUtc: '2026-10-18T10:00:00Z'
      }
    }
  ];

  const sampleFolio: FolioDto = {
    reservationId: 'res-999',
    confirmationCode: 'RES-102-ABC',
    guestName: 'Nguyễn Văn A',
    guestEmail: 'nguyenvana@gmail.com',
    roomId: 'room-102',
    roomNumber: '102',
    status: 3,
    statusName: 'CheckedIn',
    rentalType: 3,
    checkInDate: '2026-10-18',
    checkOutDate: '2026-10-20',
    startAtUtc: '2026-10-18T14:00:00Z',
    endAtUtc: '2026-10-20T12:00:00Z',
    totalAmount: 1800000,
    paidAmount: 500000,
    remainingBalance: 1300000,
    isFullyPaid: false,
    payments: [],
    baseRoomAmount: 1800000,
    surchargesAmount: 0,
    servicesAmount: 0,
    breakdown: [
      { description: 'Tiền phòng Deluxe Suite 2 đêm', unitPrice: 900000, quantity: 2, amount: 1800000, category: 'Room' }
    ]
  };

  beforeEach(() => {
    activePropertyIdSignal = signal<string | null>('prop-1');

    mockRoomService = {
      getRooms: vi.fn().mockReturnValue(of({ items: sampleRooms, totalCount: 2 })),
      updateRoomStatus: vi.fn().mockReturnValue(of({}))
    };

    mockReservationService = {
      getReservations: vi.fn().mockReturnValue(of({ items: [sampleRooms[1].activeReservation!], totalCount: 1 })),
      createReservation: vi.fn().mockReturnValue(of(sampleRooms[1].activeReservation!)),
      addFolioItem: vi.fn().mockReturnValue(of({
        ...sampleFolio,
        totalAmount: 1825000,
        surchargesAmount: 25000,
        remainingBalance: 1325000,
        breakdown: [
          ...sampleFolio.breakdown!,
          { description: 'Nước tăng lực Redbull (Bò Húc)', unitPrice: 25000, quantity: 1, amount: 25000, category: 'Minibar' }
        ]
      }))
    };

    mockRoomTypeService = {
      getRoomTypes: vi.fn().mockReturnValue(of({ items: [{ id: 'rt-std', name: 'Standard Double' }], totalCount: 1 }))
    };

    mockPaymentService = {
      getFolio: vi.fn().mockReturnValue(of(sampleFolio))
    };

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      currentUser$: of({ email: 'reception@hotel.com', role: 'Staff' })
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      toastInfo: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [RoomsPage],
      providers: [
        { provide: RoomService, useValue: mockRoomService },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: RoomTypeService, useValue: mockRoomTypeService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    });

    fixture = TestBed.createComponent(RoomsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('1. should mount with Rack view and load initial rooms and reservations', () => {
    expect(component.viewMode()).toBe('rack');
    expect(component.rooms().length).toBe(2);
    expect(component.cleanRoomsCount()).toBe(1);
  });

  it('2. should toggle viewMode to timeline Gantt chart and compute 7-day columns', () => {
    component.viewMode.set('timeline');
    expect(component.viewMode()).toBe('timeline');
    expect(component.timelineDaysCount()).toBe(7);

    const dates = component.timelineDates();
    expect(dates.length).toBe(7);
    expect(dates[0].dateStr).toBeDefined();
    expect(dates[0].dayOfWeek).toBeDefined();
  });

  it('3. should support Timeline 14-day zoom and navigation', () => {
    component.timelineDaysCount.set(14);
    expect(component.timelineDates().length).toBe(14);

    const initialStart = component.timelineStartDate();
    component.nextTimeline();
    expect(component.timelineStartDate()).not.toBe(initialStart);

    component.todayTimeline();
    expect(component.timelineStartDate()).toBe(initialStart);
  });

  it('4. should match cell booking on timeline date intervals correctly', () => {
    component.allTimelineReservations.set([sampleRooms[1].activeReservation!]);

    // Room 102 has booking from 2026-10-18 to 2026-10-20
    const bookingOn18 = component.getCellBooking(sampleRooms[1], '2026-10-18');
    expect(bookingOn18).not.toBeNull();
    expect(bookingOn18?.confirmationCode).toBe('RES-102-ABC');

    const bookingOn19 = component.getCellBooking(sampleRooms[1], '2026-10-19');
    expect(bookingOn19).not.toBeNull();

    // After checkout date
    const bookingOn25 = component.getCellBooking(sampleRooms[1], '2026-10-25');
    expect(bookingOn25).toBeNull();
  });

  it('5. should open Minibar Folio modal and fetch live folio balance', () => {
    component.allTimelineReservations.set([sampleRooms[1].activeReservation!]);
    component.openFolioModalForRoom(sampleRooms[1]);

    expect(component.isFolioModalOpen()).toBe(true);
    expect(component.selectedFolioRoom()?.id).toBe('room-102');
    expect(mockPaymentService.getFolio).toHaveBeenCalledWith('res-999', 'prop-1');
    expect(component.currentFolio()?.totalAmount).toBe(1800000);
  });

  it('6. should add quick Minibar item and update folio state with new balance', () => {
    component.activeFolioReservation.set(sampleRooms[1].activeReservation!);
    component.currentFolio.set(sampleFolio);

    const redbullItem = component.quickMinibarCatalog.find(i => i.code === 'MINI-REDBULL')!;
    component.addQuickMinibarItem(redbullItem);

    expect(mockReservationService.addFolioItem).toHaveBeenCalledWith(
      'res-999',
      expect.objectContaining({
        itemCode: 'MINI-REDBULL',
        unitPrice: 25000,
        category: 'Minibar'
      })
    );

    expect(mockAlertService.toastSuccess).toHaveBeenCalled();
    expect(component.currentFolio()?.totalAmount).toBe(1825000);
  });

  it('7. should submit custom incidental item into Folio', () => {
    component.activeFolioReservation.set(sampleRooms[1].activeReservation!);
    component.currentFolio.set(sampleFolio);

    component.customItemName.set('Đền bù vỡ cốc thủy tinh');
    component.customItemPrice.set(50000);

    component.submitCustomFolioItem();

    expect(mockReservationService.addFolioItem).toHaveBeenCalledWith(
      'res-999',
      expect.objectContaining({
        itemCode: 'CUSTOM-INCIDENTAL',
        description: 'Đền bù vỡ cốc thủy tinh',
        unitPrice: 50000
      })
    );
  });
});
