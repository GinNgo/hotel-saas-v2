import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError, Subject } from 'rxjs';
import { ReservationsPage, getTodayVnDateString, addDaysToDateString } from './reservations.page';
import { ReservationService } from '../../core/services/reservation.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { PolicyService } from '../../core/services/policy.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PropertyPoliciesDto } from '../../core/models/policy.model';
import {
  FolioDto,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
  PaymentSummaryDto
} from '../../core/models/payment.model';
import {
  ReservationDto,
  ReservationDetailDto,
  RoomAvailabilityDto,
  QuoteDto,
  RentalType,
  ReservationStatus,
  PagedResult
} from '../../core/models/reservation.model';
import { RoomTypeDto } from '../../core/models/room-type.model';

describe('ReservationsPage Logic, Quote Integration, Snapshot Display & Availability', () => {
  let mockReservationService: any;
  let mockRoomTypeService: any;
  let mockPolicyService: any;
  let mockPaymentService: any;
  let mockAuthService: any;
  let mockAlertService: any;

  let activePropertyIdSignal: any;
  let activePropertyNameSignal: any;
  let activePropertyCodeSignal: any;

  const sampleRoomTypes: RoomTypeDto[] = [
    {
      id: 'rt-101',
      name: 'Deluxe Ocean View',
      code: 'DLX',
      description: 'Phòng view biển',
      basePrice: 500000,
      maxOccupancy: 2,
      bedType: 'Double',
      squareMeters: 30,
      imageUrl: null,
      roomCount: 5,
      createdAtUtc: '2026-01-01T00:00:00Z'
    }
  ];

  const sampleReservationDto: ReservationDto = {
    id: 'res-001',
    tenantId: 'tenant-123',
    propertyId: 'prop-123',
    roomId: 'room-101',
    roomNumber: '101',
    roomTypeId: 'rt-101',
    roomTypeName: 'Deluxe Ocean View',
    confirmationCode: 'RES-AB12CD',
    guestName: 'Nguyễn Văn A',
    guestPhone: '0901234567',
    guestEmail: 'a@example.com',
    status: ReservationStatus.Confirmed,
    rentalType: RentalType.Overnight,
    checkInDate: '2026-10-15',
    checkOutDate: '2026-10-16',
    startAtUtc: '2026-10-15T07:00:00Z',
    endAtUtc: '2026-10-16T05:00:00Z',
    numberOfGuests: 2,
    totalAmount: 500000,
    currency: 'VND',
    createdAtUtc: '2026-10-10T10:00:00Z'
  };

  const sampleReservationDetailDto: ReservationDetailDto = {
    ...sampleReservationDto,
    breakdown: [
      {
        rentalType: 'Overnight',
        stayDate: '2026-10-15',
        appliedPrice: 500000,
        rateSource: 'StandardNightlyRate',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-31',
        currency: 'VND'
      }
    ],
    appliedPolicies: {
      maxHourlyHours: 5,
      bufferMinutes: 30,
      checkInTime: '14:00',
      checkOutTime: '12:00'
    },
    customerNotes: 'Khách đến muộn'
  };

  const sampleQuoteDto: QuoteDto = {
    propertyId: 'prop-123',
    roomTypeId: 'rt-101',
    roomTypeName: 'Deluxe Ocean View',
    rentalType: 'Overnight',
    totalAmount: 500000,
    currency: 'VND',
    expiresAtUtc: '2026-10-10T11:00:00Z',
    breakdown: [
      {
        rentalType: 'Overnight',
        stayDate: '2026-10-15',
        appliedPrice: 500000,
        rateSource: 'StandardNightlyRate',
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-31',
        currency: 'VND'
      }
    ],
    appliedPolicies: {
      maxHourlyHours: 5,
      bufferMinutes: 30,
      checkInTime: '14:00',
      checkOutTime: '12:00'
    }
  };

  const sampleAvailability: RoomAvailabilityDto[] = [
    {
      roomId: 'room-101',
      roomNumber: '101',
      floor: 1,
      roomTypeId: 'rt-101',
      roomTypeName: 'Deluxe Ocean View',
      housekeepingStatus: 'Clean',
      isAvailable: true
    },
    {
      roomId: 'room-102',
      roomNumber: '102',
      floor: 1,
      roomTypeId: 'rt-101',
      roomTypeName: 'Deluxe Ocean View',
      housekeepingStatus: 'Clean',
      isAvailable: false,
      conflictReason: 'Đang có đặt phòng trùng thời gian'
    }
  ];

  const samplePropertyPolicies: PropertyPoliciesDto = {
    propertyId: 'prop-123',
    checkInTime: '14:00:00',
    checkOutTime: '12:00:00',
    maxHourlyHours: 5,
    bufferMinutes: 30
  };

  beforeEach(() => {
    mockReservationService = {
      getReservations: vi.fn().mockReturnValue(of({
        items: [sampleReservationDto],
        totalCount: 1,
        page: 1,
        pageSize: 20
      } as PagedResult<ReservationDto>)),
      getReservationById: vi.fn().mockReturnValue(of(sampleReservationDetailDto)),
      calculateQuote: vi.fn().mockReturnValue(of(sampleQuoteDto)),
      getAvailability: vi.fn().mockReturnValue(of(sampleAvailability)),
      createReservation: vi.fn().mockReturnValue(of(sampleReservationDto)),
      checkIn: vi.fn().mockReturnValue(of({ ...sampleReservationDetailDto, status: ReservationStatus.CheckedIn })),
      checkOut: vi.fn().mockReturnValue(of({ ...sampleReservationDetailDto, status: ReservationStatus.CheckedOut })),
      cancel: vi.fn().mockReturnValue(of({ ...sampleReservationDetailDto, status: ReservationStatus.Cancelled, cancellationReason: 'Test reason', cancelledAtUtc: '2026-10-10T12:00:00Z' }))
    };

    mockRoomTypeService = {
      getRoomTypes: vi.fn().mockReturnValue(of({
        items: sampleRoomTypes,
        totalCount: 1,
        page: 1,
        pageSize: 100
      }))
    };

    mockPolicyService = {
      getPolicies: vi.fn().mockReturnValue(of(samplePropertyPolicies))
    };

    mockPaymentService = {
      getFolio: vi.fn().mockReturnValue(of({
        reservationId: 'res-001',
        confirmationCode: 'RES-AB12CD',
        totalAmount: 500000,
        paidAmount: 200000,
        remainingBalance: 300000,
        isFullyPaid: false,
        payments: [
          {
            id: 'pay-001',
            propertyId: 'prop-123',
            reservationId: 'res-001',
            amount: 200000,
            method: PaymentMethod.Cash,
            methodName: 'Tiền mặt',
            status: PaymentStatus.Completed,
            statusName: 'Thành công',
            createdAtUtc: '2026-10-10T10:00:00Z'
          }
        ]
      } as FolioDto)),
      createPayment: vi.fn().mockReturnValue(of({
        id: 'pay-002',
        propertyId: 'prop-123',
        reservationId: 'res-001',
        amount: 300000,
        method: PaymentMethod.Cash,
        methodName: 'Tiền mặt',
        status: PaymentStatus.Completed,
        statusName: 'Thành công',
        createdAtUtc: '2026-10-10T11:00:00Z'
      } as PaymentDto)),
      getPayments: vi.fn().mockReturnValue(of({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20
      })),
      getPaymentSummary: vi.fn().mockReturnValue(of({
        propertyId: 'prop-123',
        date: '2026-10-10',
        totalCollected: 500000,
        cashCollected: 500000,
        bankTransferCollected: 0,
        creditCardCollected: 0,
        completedCount: 1
      } as PaymentSummaryDto))
    };

    activePropertyIdSignal = signal<string | null>('prop-123');
    activePropertyNameSignal = signal<string | null>('Khách sạn Biển Đông');
    activePropertyCodeSignal = signal<string | null>('BD');

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      activePropertyName: activePropertyNameSignal,
      activePropertyCode: activePropertyCodeSignal,
      hasPermission: vi.fn((code: string, mask: number) => {
        if (code === 'RESERVATIONS') return true;
        if (code === 'CHECK_IN_OUT') return true;
        if (code === 'PROPERTIES') return true;
        if (code === 'PAYMENTS') return true;
        return false;
      })
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      toastWarning: vi.fn(),
      toastInfo: vi.fn()
    };
  });

  function createComponent(): ReservationsPage {
    const injector = Injector.create({
      providers: [
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: RoomTypeService, useValue: mockRoomTypeService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    });
    return runInInjectionContext(injector, () => new ReservationsPage());
  }

  it('1. should initialize and load reservations and room types', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp).toBeTruthy();
    expect(mockReservationService.getReservations).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 20
    }));
    expect(mockRoomTypeService.getRoomTypes).toHaveBeenCalled();
    expect(comp.reservations().length).toBe(1);
    expect(comp.reservations()[0].confirmationCode).toBe('RES-AB12CD');
    expect(comp.totalCount()).toBe(1);
  });

  it('2. should handle search, status filter, and date filters', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.onSearchInput({ target: { value: 'RES-AB12' } } as any);
    expect(comp.searchQuery()).toBe('RES-AB12');

    comp.onStatusChange({ target: { value: '1' } } as any);
    expect(comp.selectedStatus()).toBe(1);

    comp.onDateFromChange({ target: { value: '2026-10-01' } } as any);
    expect(comp.dateFrom()).toBe('2026-10-01');

    comp.onDateToChange({ target: { value: '2026-10-31' } } as any);
    expect(comp.dateTo()).toBe('2026-10-31');

    comp.resetFilters();
    expect(comp.searchQuery()).toBe('');
    expect(comp.selectedStatus()).toBeNull();
    expect(comp.dateFrom()).toBe('');
    expect(comp.dateTo()).toBe('');
  });

  it('3. should handle pagination page change and pageSize change', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.goToPage(2);
    expect(comp.currentPage()).toBe(2);
    expect(mockReservationService.getReservations).toHaveBeenCalledWith(expect.objectContaining({
      page: 2
    }));

    comp.onPageSizeChange({ target: { value: '25' } } as any);
    expect(comp.pageSize()).toBe(25);
    expect(comp.currentPage()).toBe(1);
  });

  it('4. should open detail modal and fetch full reservation detail with immutable breakdown', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.viewDetails(sampleReservationDto);
    expect(mockReservationService.getReservationById).toHaveBeenCalledWith('res-001', 'prop-123');
    expect(comp.selectedReservationDetail()?.id).toBe('res-001');
    expect(comp.selectedReservationDetail()?.breakdown.length).toBe(1);
    expect(comp.selectedReservationDetail()?.breakdown[0].appliedPrice).toBe(500000);

    comp.closeDetailModal();
    expect(comp.selectedReservationDetail()).toBeNull();
  });

  it('5. should open create modal and initialize create form with check-in/out times', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.openCreateModal();
    expect(comp.isCreateModalOpen()).toBe(true);
    expect(comp.modalTargetPropertyId()).toBe('prop-123');
    expect(comp.createForm).toBeDefined();
    expect(comp.createForm.get('rentalType')?.value).toBe(RentalType.Overnight);
    expect(comp.createForm.get('checkInTime')?.value).toBe('14:00');
    expect(comp.createForm.get('checkOutTime')?.value).toBe('12:00');

    comp.closeCreateModal();
    expect(comp.isCreateModalOpen()).toBe(false);
    expect(comp.modalTargetPropertyId()).toBeNull();
  });

  it('6. should validate form in create modal when required fields are missing', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.createForm.patchValue({
      guestName: '',
      guestEmail: '',
      roomTypeId: ''
    });

    expect(comp.canSubmitCreate()).toBe(false);
    comp.onSubmitCreate();
    expect(mockReservationService.createReservation).not.toHaveBeenCalled();
  });

  it('7. should calculate quote and check room availability when onCalculateQuoteAndAvailability is invoked', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00'
    });

    comp.onCalculateQuoteAndAvailability();

    expect(mockReservationService.calculateQuote).toHaveBeenCalled();
    expect(mockReservationService.getAvailability).toHaveBeenCalled();
    expect(comp.calculatedQuote()).toEqual(sampleQuoteDto);
    expect(comp.availableRooms().length).toBe(2);
    expect(comp.selectedRoomId()).toBe('room-101');
    expect(comp.verifiedScheduleKey()).toBeTruthy();
  });

  it('8. should submit create reservation successfully with idempotency key and refresh list', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      guestName: 'Nguyễn Văn B',
      guestPhone: '0987654321',
      guestEmail: 'b@example.com',
      rentalType: RentalType.Overnight,
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00',
      numberOfGuests: 2,
      customerNotes: 'Ghi chú đặt phòng'
    });
    // simulate quote calculated and room selected
    comp.onCalculateQuoteAndAvailability();
    comp.selectedRoomId.set('room-101');

    expect(comp.canSubmitCreate()).toBe(true);
    comp.onSubmitCreate();

    expect(mockReservationService.createReservation).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: 'prop-123',
      roomId: 'room-101',
      guestName: 'Nguyễn Văn B',
      guestPhone: '0987654321',
      rentalType: RentalType.Overnight,
      idempotencyKey: expect.stringContaining('IDEMP-')
    }));
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('RES-AB12CD'));
    expect(comp.isCreateModalOpen()).toBe(false);
  });

  it('9. should handle 409 conflict error (ERR_ROOM_UNAVAILABLE) on create submission', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    mockReservationService.createReservation.mockReturnValue(throwError(() => ({
      status: 409,
      error: {
        code: 'ERR_ROOM_UNAVAILABLE',
        message: 'Phòng đã được đặt trong khoảng thời gian này hoặc không đủ thời gian dọn phòng (30 phút buffer).'
      }
    })));

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      guestName: 'Nguyễn Văn B',
      guestPhone: '0987654321',
      guestEmail: 'b@example.com',
      rentalType: RentalType.Overnight,
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00',
      numberOfGuests: 2
    });
    comp.onCalculateQuoteAndAvailability();
    comp.selectedRoomId.set('room-101');

    comp.onSubmitCreate();

    expect(mockAlertService.toastError).toHaveBeenCalledWith(expect.stringContaining('Phòng đã được đặt'));
    expect(comp.isSubmitting()).toBe(false);
  });

  it('10. should respect write permissions for creating reservations', () => {
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (code === 'RESERVATIONS' && mask === 2) return false;
      return true;
    });

    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.canCreate()).toBe(false);
  });

  it('11. should reset quote and rooms when rental type or schedule inputs change', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-16'
    });
    comp.onCalculateQuoteAndAvailability();
    expect(comp.calculatedQuote()).toBeTruthy();

    comp.createForm.patchValue({ rentalType: RentalType.Hourly });
    comp.onRentalTypeChanged();

    expect(comp.calculatedQuote()).toBeNull();
    expect(comp.availableRooms()).toEqual([]);
    expect(comp.selectedRoomId()).toBeNull();
    expect(comp.verifiedScheduleKey()).toBeNull();
  });

  // ── Subject Race Condition & Context Protection Tests (Finding 2) ──

  it('12. should handle out-of-order list responses (slow response 1 arriving after fast response 2 is ignored)', () => {
    const subject1 = new Subject<any>();
    const subject2 = new Subject<any>();

    mockReservationService.getReservations
      .mockReturnValueOnce(subject1.asObservable())
      .mockReturnValueOnce(subject2.asObservable());

    const comp = createComponent();

    // Trigger Request 1
    comp.loadReservations();

    // Trigger Request 2 (e.g. search query changed)
    comp.onSearchInput({ target: { value: 'NewQuery' } } as any);

    // Request 2 completes first with fast data
    subject2.next({
      items: [{ ...sampleReservationDto, confirmationCode: 'RES-FAST2' }],
      totalCount: 1,
      page: 1,
      pageSize: 20
    });
    subject2.complete();

    expect(comp.reservations()[0].confirmationCode).toBe('RES-FAST2');

    // Request 1 arrives late with old data
    subject1.next({
      items: [{ ...sampleReservationDto, confirmationCode: 'RES-SLOW1' }],
      totalCount: 1,
      page: 1,
      pageSize: 20
    });
    subject1.complete();

    // Must still preserve fast response 2
    expect(comp.reservations()[0].confirmationCode).toBe('RES-FAST2');
  });

  it('13. should drop pending quote and availability response if form schedule changes while request is in-flight', () => {
    const quoteSubject = new Subject<any>();
    mockReservationService.calculateQuote.mockReturnValue(quoteSubject.asObservable());

    const comp = createComponent();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00'
    });

    comp.onCalculateQuoteAndAvailability();
    expect(comp.isCalculatingQuote()).toBe(true);

    // User changes checkInDate while quote is in-flight
    comp.createForm.patchValue({ checkInDate: '2026-10-20' });
    comp.onScheduleInputsChanged();

    // Quote response arrives later
    quoteSubject.next(sampleQuoteDto);
    quoteSubject.complete();

    // Stale quote must be dropped and cannot re-enable submit
    expect(comp.calculatedQuote()).toBeNull();
    expect(comp.canSubmitCreate()).toBe(false);
  });

  it('14. should drop pending detail response if branch context changes before response arrives', () => {
    const detailSubject = new Subject<any>();
    mockReservationService.getReservationById.mockReturnValue(detailSubject.asObservable());

    const comp = createComponent();
    comp.viewDetails(sampleReservationDto);

    // Switch branch from prop-123 to prop-456
    activePropertyIdSignal.set('prop-456');
    comp.handlePropertyContextChange('prop-456');

    // Stale detail from prop-123 arrives
    detailSubject.next(sampleReservationDetailDto);
    detailSubject.complete();

    // Stale detail must not be displayed under branch prop-456
    expect(comp.selectedReservationDetail()).toBeNull();
  });

  it('15. should drop pending create submission and not toast if branch changes A -> B while in-flight', () => {
    const createSubject = new Subject<any>();
    mockReservationService.createReservation.mockReturnValue(createSubject.asObservable());

    const comp = createComponent();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      guestName: 'Nguyễn Văn C',
      guestPhone: '0987654321',
      guestEmail: 'c@example.com',
      rentalType: RentalType.Overnight,
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00',
      numberOfGuests: 2
    });
    comp.calculatedQuote.set(sampleQuoteDto);
    comp.availableRooms.set(sampleAvailability);
    comp.selectedRoomId.set('room-101');
    comp.verifiedScheduleKey.set(comp.getCurrentScheduleKey());

    comp.onSubmitCreate();
    expect(comp.isSubmitting()).toBe(true);

    // Switch branch context while submission is in-flight
    activePropertyIdSignal.set('prop-456');
    comp.handlePropertyContextChange('prop-456');

    // Submission response arrives
    createSubject.next(sampleReservationDto);
    createSubject.complete();

    // Response must be dropped without displaying toast under wrong branch
    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
    expect(comp.isCreateModalOpen()).toBe(false);
  });

  it('16. should clear list, roomTypes, detail, and close modal when branch becomes null, and cancel requests on destroy', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();
    comp.selectedReservationDetail.set(sampleReservationDetailDto);

    expect(comp.reservations().length).toBe(1);
    expect(comp.isCreateModalOpen()).toBe(true);
    expect(comp.selectedReservationDetail()).not.toBeNull();

    // Set branch context to null
    activePropertyIdSignal.set(null);
    comp.handlePropertyContextChange(null);

    expect(comp.reservations()).toEqual([]);
    expect(comp.totalCount()).toBe(0);
    expect(comp.roomTypes()).toEqual([]);
    expect(comp.selectedReservationDetail()).toBeNull();
    expect(comp.isCreateModalOpen()).toBe(false);

    // Destroy component
    comp.ngOnDestroy();
    expect(comp).toBeTruthy();
  });

  // ── Round 3 Finding 3: Branch Standard Check-in/out Policies ──

  it('17. should initialize form with custom branch policies (10:00/15:00, 00:00) and require input if policies missing', () => {
    // Case A: Custom policy 10:00 and 15:00
    mockPolicyService.getPolicies.mockReturnValue(of({
      propertyId: 'prop-123',
      checkInTime: '10:00:00',
      checkOutTime: '15:00:00',
      maxHourlyHours: 4,
      bufferMinutes: 45
    }));

    const compCustom = createComponent();
    compCustom.ngOnInit();
    compCustom.openCreateModal();

    expect(compCustom.createForm.get('checkInTime')?.value).toBe('10:00');
    expect(compCustom.createForm.get('checkOutTime')?.value).toBe('15:00');
    expect(compCustom.canCheckAvailability()).toBe(false); // roomTypeId not selected yet

    // Case B: Boundary time 00:00:00
    mockPolicyService.getPolicies.mockReturnValue(of({
      propertyId: 'prop-123',
      checkInTime: '00:00:00',
      checkOutTime: '00:00:00',
      maxHourlyHours: 6,
      bufferMinutes: 30
    }));

    const compZero = createComponent();
    compZero.ngOnInit();
    compZero.openCreateModal();

    expect(compZero.createForm.get('checkInTime')?.value).toBe('00:00');
    expect(compZero.createForm.get('checkOutTime')?.value).toBe('00:00');

    // Case C: No policies available -> must initialize empty and require manual input
    mockPolicyService.getPolicies.mockReturnValue(throwError(() => new Error('Policy not found')));
    const compNoPolicy = createComponent();
    compNoPolicy.ngOnInit();
    compNoPolicy.openCreateModal();

    expect(compNoPolicy.createForm.get('checkInTime')?.value).toBe('');
    expect(compNoPolicy.createForm.get('checkOutTime')?.value).toBe('');
    expect(compNoPolicy.createForm.get('checkInTime')?.valid).toBe(false);
    expect(compNoPolicy.createForm.get('checkOutTime')?.valid).toBe(false);
    expect(compNoPolicy.canCheckAvailability()).toBe(false);

    // Employee enters valid time
    compNoPolicy.createForm.patchValue({
      checkInTime: '11:00',
      checkOutTime: '09:00',
      roomTypeId: 'rt-101'
    });
    expect(compNoPolicy.canCheckAvailability()).toBe(true);
  });

  // ── Round 3 Finding 2: Idempotency Key Reuse on Retry and Regeneration on Form Edit ──

  it('18. should retain same idempotency key on network retry, generate new key on form edit, and clear key on success', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      guestName: 'Nguyễn Văn Retry',
      guestPhone: '0911223344',
      guestEmail: 'retry@example.com',
      rentalType: RentalType.Overnight,
      checkInDate: '2026-10-15',
      checkInTime: '14:00',
      checkOutDate: '2026-10-16',
      checkOutTime: '12:00',
      numberOfGuests: 2,
      customerNotes: 'Ghi chú thử nghiệm retry'
    });
    comp.onCalculateQuoteAndAvailability();
    comp.selectedRoomId.set('room-101');

    // Mock first submission attempt failing due to network/server timeout
    mockReservationService.createReservation.mockReturnValueOnce(throwError(() => ({
      status: 504,
      error: { message: 'Gateway Timeout' }
    })));

    // Attempt 1: Submit fails
    comp.onSubmitCreate();
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Gateway Timeout');
    expect(mockReservationService.createReservation).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockReservationService.createReservation.mock.calls[0][0];
    const firstKey = firstCallArgs.idempotencyKey;
    expect(firstKey).toMatch(/^IDEMP-/);

    // Attempt 2: User retries WITHOUT changing form
    mockReservationService.createReservation.mockReturnValueOnce(of(sampleReservationDto));
    comp.onSubmitCreate();
    expect(mockReservationService.createReservation).toHaveBeenCalledTimes(2);
    const secondCallArgs = mockReservationService.createReservation.mock.calls[1][0];
    const secondKey = secondCallArgs.idempotencyKey;

    // KEY MUST BE PRESERVED ACROSS RETRIES
    expect(secondKey).toBe(firstKey);
    expect(mockAlertService.toastSuccess).toHaveBeenCalled();

    // Now open modal again for a new reservation
    comp.openCreateModal();
    comp.createForm.patchValue({
      roomTypeId: 'rt-101',
      guestName: 'Khách Hàng Mới',
      guestPhone: '0988776655',
      guestEmail: 'new@example.com',
      rentalType: RentalType.Overnight,
      checkInDate: '2026-10-20',
      checkInTime: '14:00',
      checkOutDate: '2026-10-21',
      checkOutTime: '12:00',
      numberOfGuests: 1
    });
    comp.onCalculateQuoteAndAvailability();
    comp.selectedRoomId.set('room-101');

    mockReservationService.createReservation.mockReturnValueOnce(of(sampleReservationDto));
    comp.onSubmitCreate();
    expect(mockReservationService.createReservation).toHaveBeenCalledTimes(3);
    const thirdCallArgs = mockReservationService.createReservation.mock.calls[2][0];
    const thirdKey = thirdCallArgs.idempotencyKey;

    // NEW RESERVATION MUST GENERATE A NEW KEY
    expect(thirdKey).not.toBe(firstKey);
  });

  it('15. should allow check-in when user has permission and update reservation state', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const checkedInDto = {
      ...sampleReservationDetailDto,
      status: ReservationStatus.CheckedIn
    };
    mockReservationService.checkIn.mockReturnValueOnce(of(checkedInDto));

    comp.onCheckIn(sampleReservationDto);

    expect(mockReservationService.checkIn).toHaveBeenCalledWith('res-001', 'prop-123');
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Nhận phòng thành công')
    );
    expect(comp.actionReservationId()).toBeNull();
    expect(comp.isActionLoading()).toBe(false);
  });

  it('16. should handle check-in error when room is not clean (ERR_ROOM_NOT_CLEAN)', () => {
    const comp = createComponent();
    comp.ngOnInit();

    mockReservationService.checkIn.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Phòng 101 chưa được dọn dẹp xong (Dirty)' } }))
    );

    comp.onCheckIn(sampleReservationDto);

    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Phòng 101 chưa được dọn dẹp xong (Dirty)'
    );
    expect(comp.actionReservationId()).toBeNull();
    expect(comp.isActionLoading()).toBe(false);
  });

  it('17. should allow check-out when user has permission and notify room is Dirty', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const checkedOutDto = {
      ...sampleReservationDetailDto,
      status: ReservationStatus.CheckedOut
    };
    mockReservationService.checkOut.mockReturnValueOnce(of(checkedOutDto));

    comp.onCheckOut(sampleReservationDto);

    expect(mockReservationService.checkOut).toHaveBeenCalledWith('res-001', 'prop-123');
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Phòng đã chuyển sang trạng thái Cần dọn dẹp (Dirty)')
    );
    expect(comp.actionReservationId()).toBeNull();
    expect(comp.isActionLoading()).toBe(false);
  });

  it('18. should handle check-out error', () => {
    const comp = createComponent();
    comp.ngOnInit();

    mockReservationService.checkOut.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Chỉ đơn đang lưu trú mới có thể trả phòng' } }))
    );

    comp.onCheckOut(sampleReservationDto);

    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Chỉ đơn đang lưu trú mới có thể trả phòng'
    );
    expect(comp.actionReservationId()).toBeNull();
    expect(comp.isActionLoading()).toBe(false);
  });

  it('19. should open cancel modal, capture cancellation reason, and confirm cancellation successfully', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.openCancelModal(sampleReservationDto);
    expect(comp.cancelModalReservation()).toEqual(sampleReservationDto);
    expect(comp.cancellationReasonInput()).toBe('');

    comp.onCancellationReasonInput({ target: { value: 'Khách đổi kế hoạch đột xuất' } } as any);
    expect(comp.cancellationReasonInput()).toBe('Khách đổi kế hoạch đột xuất');

    const cancelledDto = {
      ...sampleReservationDetailDto,
      status: ReservationStatus.Cancelled,
      cancellationReason: 'Khách đổi kế hoạch đột xuất',
      cancelledAtUtc: '2026-10-10T12:00:00Z'
    };
    mockReservationService.cancel.mockReturnValueOnce(of(cancelledDto));

    comp.confirmCancelReservation();

    expect(mockReservationService.cancel).toHaveBeenCalledWith(
      'res-001',
      'prop-123',
      'Khách đổi kế hoạch đột xuất'
    );
    expect(comp.cancelModalReservation()).toBeNull();
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Hủy đơn đặt phòng RES-AB12CD thành công')
    );
  });

  it('20. should handle cancellation error', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.openCancelModal(sampleReservationDto);
    mockReservationService.cancel.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Không thể hủy đơn đặt phòng đã hoàn tất' } }))
    );

    comp.confirmCancelReservation();

    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Không thể hủy đơn đặt phòng đã hoàn tất'
    );
    expect(comp.isActionLoading()).toBe(false);
  });

  it('21. should compute canCheckInOut and canCancel permissions independently', () => {
    // Case A: CHECK_IN_OUT only
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (code === 'CHECK_IN_OUT' && mask === 4) return true;
      if (code === 'RESERVATIONS' && mask === 4) return false;
      return true;
    });
    const compA = createComponent();
    expect(compA.canCheckInOut()).toBe(true);
    expect(compA.canCancel()).toBe(false);

    // Case B: RESERVATIONS only
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (code === 'CHECK_IN_OUT' && mask === 4) return false;
      if (code === 'RESERVATIONS' && mask === 4) return true;
      return true;
    });
    const compB = createComponent();
    expect(compB.canCheckInOut()).toBe(false);
    expect(compB.canCancel()).toBe(true);

    // Case C: Neither
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (mask === 4) return false;
      return true;
    });
    const compC = createComponent();
    expect(compC.canCheckInOut()).toBe(false);
    expect(compC.canCancel()).toBe(false);
  });

  it('22. should prevent check-in and check-out when lacking CHECK_IN_OUT, and prevent cancel when lacking RESERVATIONS', () => {
    // User lacks CHECK_IN_OUT update
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (code === 'CHECK_IN_OUT' && mask === 4) return false;
      if (code === 'RESERVATIONS' && mask === 4) return true;
      return true;
    });

    const comp = createComponent();
    comp.ngOnInit();

    comp.onCheckIn(sampleReservationDto);
    expect(mockReservationService.checkIn).not.toHaveBeenCalled();

    comp.onCheckOut(sampleReservationDto);
    expect(mockReservationService.checkOut).not.toHaveBeenCalled();

    // Now test user lacking RESERVATIONS update
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      if (code === 'CHECK_IN_OUT' && mask === 4) return true;
      if (code === 'RESERVATIONS' && mask === 4) return false;
      return true;
    });

    const comp2 = createComponent();
    comp2.ngOnInit();

    comp2.openCancelModal(sampleReservationDto);
    expect(comp2.cancelModalReservation()).toBeNull();

    comp2.confirmCancelReservation();
    expect(mockReservationService.cancel).not.toHaveBeenCalled();
  });

  it('23. should guard against double-click/double-submit on lifecycle actions while request is in-flight', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const checkInSubject = new Subject<any>();
    mockReservationService.checkIn.mockReturnValue(checkInSubject.asObservable());

    // First click initiates check-in
    comp.onCheckIn(sampleReservationDto);
    expect(comp.isActionLoading()).toBe(true);
    expect(comp.actionReservationId()).toBe('res-001');
    expect(mockReservationService.checkIn).toHaveBeenCalledTimes(1);

    // Second rapid click while in-flight MUST be ignored
    comp.onCheckIn(sampleReservationDto);
    expect(mockReservationService.checkIn).toHaveBeenCalledTimes(1);

    // Attempting check-out or cancel while check-in is in-flight is also blocked
    comp.onCheckOut(sampleReservationDto);
    expect(mockReservationService.checkOut).not.toHaveBeenCalled();

    comp.openCancelModal(sampleReservationDto);
    expect(comp.cancelModalReservation()).toBeNull();

    // Finish in-flight request
    checkInSubject.next({ ...sampleReservationDetailDto, status: ReservationStatus.CheckedIn });
    checkInSubject.complete();

    expect(comp.isActionLoading()).toBe(false);
    expect(comp.actionReservationId()).toBeNull();
  });

  it('24. should close cancel modal and clear modal state when branch changes, blocking cross-branch cancel submit', () => {
    const comp = createComponent();
    comp.ngOnInit();

    // Open cancel modal on prop-123
    comp.openCancelModal(sampleReservationDto);
    expect(comp.cancelModalReservation()).toEqual(sampleReservationDto);
    expect(comp.cancelModalTargetPropertyId()).toBe('prop-123');

    // Switch branch context from prop-123 to prop-456
    activePropertyIdSignal.set('prop-456');
    comp.handlePropertyContextChange('prop-456');

    // Cancel modal must be forcibly closed and state cleared
    expect(comp.cancelModalReservation()).toBeNull();
    expect(comp.cancelModalTargetPropertyId()).toBeNull();
    expect(comp.cancellationReasonInput()).toBe('');

    // Attempting confirmCancelReservation after branch change must do nothing
    comp.confirmCancelReservation();
    expect(mockReservationService.cancel).not.toHaveBeenCalled();
  });

  it('25. should discard pending check-in response if branch context changes while request is in-flight', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const checkInSubject = new Subject<any>();
    mockReservationService.checkIn.mockReturnValue(checkInSubject.asObservable());

    comp.onCheckIn(sampleReservationDto);
    expect(comp.isActionLoading()).toBe(true);

    // User switches branch context to prop-456 before server responds
    activePropertyIdSignal.set('prop-456');
    comp.handlePropertyContextChange('prop-456');

    // Server responds with check-in success for branch prop-123
    checkInSubject.next({ ...sampleReservationDetailDto, status: ReservationStatus.CheckedIn });
    checkInSubject.complete();

    // Stale response must be discarded without showing toast on branch prop-456
    expect(mockAlertService.toastSuccess).not.toHaveBeenCalledWith(expect.stringContaining('Nhận phòng thành công'));
  });

  it('26. should load folio when viewing reservation details and populate paymentForm with remaining balance', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.viewDetails(sampleReservationDto);

    expect(mockReservationService.getReservationById).toHaveBeenCalledWith('res-001', 'prop-123');
    expect(mockPaymentService.getFolio).toHaveBeenCalledWith('res-001', 'prop-123');
    expect(comp.selectedReservationDetail()).toEqual(sampleReservationDetailDto);
    expect(comp.folio()).toBeTruthy();
    expect(comp.folio()?.remainingBalance).toBe(300000);
    expect(comp.paymentForm.get('amount')?.value).toBe(300000);
    expect(comp.paymentForm.get('method')?.value).toBe(PaymentMethod.Cash);
  });

  it('27. should record manual payment, block overpayment, and refresh folio on success', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.viewDetails(sampleReservationDto);

    // 1. Attempt overpayment (> remaining 300,000)
    comp.paymentForm.patchValue({ amount: 400000 });
    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockAlertService.toastError).toHaveBeenCalledWith(expect.stringContaining('vượt quá dư nợ còn lại'));
    expect(mockPaymentService.createPayment).not.toHaveBeenCalled();

    // 2. Valid payment amount
    comp.paymentForm.patchValue({
      amount: 150000,
      method: PaymentMethod.BankTransfer,
      transactionRef: 'VCB-987654'
    });

    comp.onRecordPayment(sampleReservationDetailDto);

    expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res-001',
        amount: 150000,
        method: PaymentMethod.BankTransfer,
        transactionRef: 'VCB-987654'
      }),
      'prop-123'
    );

    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Thu tiền thành công'));
    expect(comp.isSubmittingPayment()).toBe(false);
  });

  it('28. should auto-fill payment amount when fillFullRemaining is clicked', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.viewDetails(sampleReservationDto);

    comp.paymentForm.patchValue({ amount: 50000 });
    expect(comp.paymentForm.get('amount')?.value).toBe(50000);

    comp.fillFullRemaining();
    expect(comp.paymentForm.get('amount')?.value).toBe(300000);
  });

  it('29. should open cashier summary modal, fetch daily summary metrics, and allow closing it', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.isSummaryModalOpen()).toBe(false);

    comp.openSummaryModal();

    expect(comp.isSummaryModalOpen()).toBe(true);
    expect(mockPaymentService.getPaymentSummary).toHaveBeenCalledWith('prop-123', expect.any(String));
    expect(comp.paymentSummary()).toBeTruthy();
    expect(comp.paymentSummary()?.totalCollected).toBe(500000);
    expect(comp.paymentSummary()?.cashCollected).toBe(500000);

    comp.closeSummaryModal();
    expect(comp.isSummaryModalOpen()).toBe(false);
  });

  it('30. should enforce PAYMENTS permission checks for creating payments and RESERVATIONS permission for folio', () => {
    // Revoke PAYMENTS permission while retaining RESERVATIONS:Read
    mockAuthService.hasPermission.mockImplementation((code: string) => {
      if (code === 'RESERVATIONS') return true;
      if (code === 'PAYMENTS') return false;
      return true;
    });

    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.canCreatePayment()).toBe(false);
    expect(comp.canReadPayment()).toBe(false);
    expect(comp.canReadFolio()).toBe(true);

    // Folio can still be loaded when canReadFolio is true
    comp.viewDetails(sampleReservationDto);
    expect(comp.folio()).not.toBeNull();

    // onRecordPayment should not execute when canCreatePayment is false
    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockPaymentService.createPayment).not.toHaveBeenCalled();

    // Now revoke RESERVATIONS:Read as well
    mockAuthService.hasPermission.mockImplementation(() => false);
    const compNoRead = createComponent();
    expect(compNoRead.canReadFolio()).toBe(false);
    compNoRead.viewDetails(sampleReservationDto);
    expect(compNoRead.folio()).toBeNull();
  });

  it('31. should reset folio, summary modal, and payment state when property context changes', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.viewDetails(sampleReservationDto);
    comp.openSummaryModal();
    expect(comp.folio()).toBeTruthy();
    expect(comp.isSummaryModalOpen()).toBe(true);

    // Switch branch context to prop-456
    activePropertyIdSignal.set('prop-456');
    comp.handlePropertyContextChange('prop-456');

    expect(comp.folio()).toBeNull();
    expect(comp.paymentSummary()).toBeNull();
    expect(comp.isSummaryModalOpen()).toBe(false);
    expect(comp.isSubmittingPayment()).toBe(false);
  });

  it('32. should isolate folio across bookings and discard late response from previous booking A when viewing booking B', () => {
    const comp = createComponent();
    comp.ngOnInit();

    const folioSubjectA = new Subject<FolioDto>();
    const folioSubjectB = new Subject<FolioDto>();

    mockReservationService.getReservationById.mockImplementation((id: string) => of({
      ...sampleReservationDetailDto,
      id: id,
      confirmationCode: id === 'res-002' ? 'RES-B22222' : 'RES-AB12CD'
    }));

    mockPaymentService.getFolio.mockImplementation((resId: string) => {
      if (resId === 'res-001') return folioSubjectA.asObservable();
      if (resId === 'res-002') return folioSubjectB.asObservable();
      return of(null as any);
    });

    const resB: ReservationDto = {
      ...sampleReservationDto,
      id: 'res-002',
      confirmationCode: 'RES-B22222',
      totalAmount: 1000000
    };

    // User views reservation A
    comp.viewDetails(sampleReservationDto);
    expect(comp.detailReservationId()).toBe('res-001');
    expect(comp.isLoadingFolio()).toBe(true);

    // User switches to view reservation B before A finishes
    comp.viewDetails(resB);
    expect(comp.detailReservationId()).toBe('res-002');
    expect(comp.folio()).toBeNull();

    // Now late callback from A arrives
    folioSubjectA.next({
      reservationId: 'res-001',
      confirmationCode: 'RES-AB12CD',
      totalAmount: 500000,
      paidAmount: 200000,
      remainingBalance: 300000,
      isFullyPaid: false,
      payments: []
    });
    folioSubjectA.complete();

    // Late callback from A must NOT overwrite folio for B
    expect(comp.folio()).toBeNull();

    // Response from B arrives
    folioSubjectB.next({
      reservationId: 'res-002',
      confirmationCode: 'RES-B22222',
      totalAmount: 1000000,
      paidAmount: 400000,
      remainingBalance: 600000,
      isFullyPaid: false,
      payments: []
    });
    folioSubjectB.complete();

    // B's folio must be accepted
    expect(comp.folio()?.reservationId).toBe('res-002');
    expect(comp.folio()?.remainingBalance).toBe(600000);
    expect(comp.paymentForm.get('amount')?.value).toBe(600000);
  });

  it('33. should handle folio loading error cleanly and block payment recording without totalAmount fallback', () => {
    const comp = createComponent();
    comp.ngOnInit();

    mockPaymentService.getFolio.mockReturnValue(throwError(() => new Error('Folio network error')));

    comp.viewDetails(sampleReservationDto);

    expect(comp.folio()).toBeNull();
    expect(comp.isLoadingFolio()).toBe(false);

    // Attempting to record payment when folio failed to load must be blocked
    comp.paymentForm.patchValue({ amount: 100000, method: PaymentMethod.Cash });
    comp.onRecordPayment(sampleReservationDetailDto);

    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Đang tải dữ liệu công nợ folio, vui lòng đợi trong giây lát.'
    );
    expect(mockPaymentService.createPayment).not.toHaveBeenCalled();

    // Now simulate retry when user re-opens or reloads
    mockPaymentService.getFolio.mockReturnValue(of({
      reservationId: 'res-001',
      confirmationCode: 'RES-AB12CD',
      totalAmount: 500000,
      paidAmount: 0,
      remainingBalance: 500000,
      isFullyPaid: false,
      payments: []
    }));

    comp.loadFolio('res-001', 'prop-123');
    expect(comp.folio()).toBeTruthy();
    expect(comp.folio()?.remainingBalance).toBe(500000);
    expect(comp.paymentForm.get('amount')?.value).toBe(500000);
  });

  it('34. should retain idempotency key on network failure and generate new key when payment amount or method changes', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.viewDetails(sampleReservationDto);

    const paymentSubject = new Subject<any>();
    mockPaymentService.createPayment.mockReturnValue(paymentSubject.asObservable());

    comp.paymentForm.patchValue({
      amount: 100000,
      method: PaymentMethod.Cash
    });

    // First submit attempt
    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockPaymentService.createPayment).toHaveBeenCalledTimes(1);
    const firstCallKey = mockPaymentService.createPayment.mock.calls[0][0].idempotencyKey;
    expect(firstCallKey).toBeTruthy();

    // Server fails with network error
    paymentSubject.error({ error: { code: 'NETWORK_ERR', message: 'Mạng gián đoạn' } });
    expect(comp.isSubmittingPayment()).toBe(false);

    // Retry without changing form inputs: MUST retain the same idempotency key
    const retrySubject = new Subject<any>();
    mockPaymentService.createPayment.mockReturnValue(retrySubject.asObservable());

    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockPaymentService.createPayment).toHaveBeenCalledTimes(2);
    const retryCallKey = mockPaymentService.createPayment.mock.calls[1][0].idempotencyKey;
    expect(retryCallKey).toBe(firstCallKey);

    retrySubject.error({ error: { code: 'NETWORK_ERR', message: 'Mạng gián đoạn lần 2' } });

    // User changes payment amount: MUST generate a new idempotency key
    comp.paymentForm.patchValue({ amount: 150000 });
    const newSubject = new Subject<any>();
    mockPaymentService.createPayment.mockReturnValue(newSubject.asObservable());

    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockPaymentService.createPayment).toHaveBeenCalledTimes(3);
    const newAmountKey = mockPaymentService.createPayment.mock.calls[2][0].idempotencyKey;
    expect(newAmountKey).not.toBe(firstCallKey);

    // User changes payment method: MUST generate another new idempotency key
    newSubject.error({ error: { message: 'Lỗi' } });
    comp.paymentForm.patchValue({ method: PaymentMethod.BankTransfer });
    const methodSubject = new Subject<any>();
    mockPaymentService.createPayment.mockReturnValue(methodSubject.asObservable());

    comp.onRecordPayment(sampleReservationDetailDto);
    expect(mockPaymentService.createPayment).toHaveBeenCalledTimes(4);
    const newMethodKey = mockPaymentService.createPayment.mock.calls[3][0].idempotencyKey;
    expect(newMethodKey).not.toBe(newAmountKey);
  });
});

