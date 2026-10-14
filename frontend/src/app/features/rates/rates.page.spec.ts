import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { RatesPage, getTodayVnDateString, addDaysToDateString } from './rates.page';
import { RateService } from '../../core/services/rate.service';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { RoomTypeRateDto, RoomTypeRateAuditDto } from '../../core/models/rate.model';
import { RoomTypeDto } from '../../core/models/room-type.model';

describe('RatesPage Logic, Interval Splitting, Modal Snapshot & Context Guards', () => {
  let mockRateService: any;
  let mockRoomTypeService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let mockRoute: any;
  let mockRouter: any;
  let queryParamsSubject: Subject<any>;

  let activePropertyIdSignal: any;
  let activePropertyNameSignal: any;

  const sampleRoomTypes: RoomTypeDto[] = [
    {
      id: 'rt-1111',
      name: 'Phòng Deluxe Hướng Biển',
      code: 'DLX-SEA',
      description: 'Phòng sang trọng view biển',
      basePrice: 500000,
      maxOccupancy: 2,
      bedType: 'Giường Đôi',
      squareMeters: 35,
      imageUrl: null,
      roomCount: 10,
      createdAtUtc: '2026-01-01T00:00:00Z'
    },
    {
      id: 'rt-2222',
      name: 'Phòng Suite Gia Đình',
      code: 'STE-FAM',
      description: 'Phòng suite 2 phòng ngủ',
      basePrice: 900000,
      maxOccupancy: 4,
      bedType: '2 Giường Đôi',
      squareMeters: 55,
      imageUrl: null,
      roomCount: 5,
      createdAtUtc: '2026-01-01T00:00:00Z'
    }
  ];

  const todayStr = getTodayVnDateString();
  const nextMonthStr = addDaysToDateString(todayStr, 30);
  const nextYearStr = addDaysToDateString(todayStr, 365);

  const sampleRates: RoomTypeRateDto[] = [
    {
      id: 'rate-1',
      propertyId: 'prop-123',
      roomTypeId: 'rt-1111',
      firstHours: 2,
      firstHoursPrice: 200000,
      additionalHourPrice: 60000,
      nightlyPrice: 500000,
      currency: 'VND',
      effectiveFrom: todayStr,
      effectiveTo: nextMonthStr,
      changeReason: 'Bảng giá ban đầu',
      isActive: true,
      createdAtUtc: '2026-10-01T00:00:00Z'
    }
  ];

  const sampleHistory: RoomTypeRateAuditDto[] = [
    {
      id: 'audit-1',
      propertyId: 'prop-123',
      roomTypeId: 'rt-1111',
      rateId: 'rate-1',
      oldEffectiveFrom: null,
      oldEffectiveTo: null,
      oldNightlyPrice: null,
      newEffectiveFrom: todayStr,
      newEffectiveTo: nextMonthStr,
      newNightlyPrice: 500000,
      actionType: 'Created',
      changedByUserId: 'user-admin-1',
      changedAtUtc: '2026-10-01T00:00:00Z',
      changeReason: 'Khởi tạo bảng giá'
    }
  ];

  beforeEach(() => {
    queryParamsSubject = new Subject<any>();

    mockRateService = {
      getRates: vi.fn().mockReturnValue(of(sampleRates)),
      getRateHistory: vi.fn().mockReturnValue(of(sampleHistory)),
      createRate: vi.fn().mockReturnValue(of({
        id: 'rate-new',
        propertyId: 'prop-123',
        roomTypeId: 'rt-1111',
        firstHours: 2,
        firstHoursPrice: 220000,
        additionalHourPrice: 70000,
        nightlyPrice: 550000,
        currency: 'VND',
        effectiveFrom: todayStr,
        effectiveTo: nextYearStr,
        changeReason: 'Điều chỉnh mùa cao điểm',
        isActive: true,
        createdAtUtc: '2026-10-10T10:00:00Z'
      }))
    };

    mockRoomTypeService = {
      getRoomTypes: vi.fn().mockReturnValue(of({ items: sampleRoomTypes, totalCount: 2, page: 1, pageSize: 50 }))
    };

    activePropertyIdSignal = signal<string | null>('prop-123');
    activePropertyNameSignal = signal<string | null>('Khách sạn Biển Đông');

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      activePropertyName: activePropertyNameSignal,
      hasPermission: vi.fn((code: string, mask: number) => {
        if (code === 'ROOM_TYPES') return true;
        return false;
      })
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      toastWarning: vi.fn()
    };

    mockRoute = {
      queryParams: queryParamsSubject.asObservable()
    };

    mockRouter = {
      navigate: vi.fn()
    };
  });

  function createComponent(): RatesPage {
    const injector = Injector.create({
      providers: [
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: RateService, useValue: mockRateService },
        { provide: RoomTypeService, useValue: mockRoomTypeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter }
      ]
    });
    return runInInjectionContext(injector, () => new RatesPage());
  }

  it('1. should initialize and load room types & active rates', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp).toBeTruthy();
    expect(mockRoomTypeService.getRoomTypes).toHaveBeenCalled();
    expect(comp.roomTypes().length).toBe(2);
    expect(comp.selectedRoomTypeId()).toBe('rt-1111');
    expect(mockRateService.getRates).toHaveBeenCalledWith('rt-1111', 'prop-123');
    expect(mockRateService.getRateHistory).toHaveBeenCalledWith('rt-1111', 'prop-123');
    expect(comp.rates().length).toBe(1);
    expect(comp.rateHistory().length).toBe(1);
    expect(comp.canRead()).toBe(true);
    expect(comp.canUpdate()).toBe(true);
  });

  it('2. should enforce read permission guard', () => {
    mockAuthService.hasPermission = vi.fn().mockReturnValue(false);
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.canRead()).toBe(false);
    expect(comp.canUpdate()).toBe(false);
    expect(mockRoomTypeService.getRoomTypes).not.toHaveBeenCalled();
    expect(mockRateService.getRates).not.toHaveBeenCalled();
  });

  it('3. should enforce update permission: read-only user cannot open modal or submit', () => {
    mockAuthService.hasPermission = vi.fn((code: string, mask: number) => {
      // Allow Read (1), deny Update (4)
      return mask === 1;
    });

    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.canRead()).toBe(true);
    expect(comp.canUpdate()).toBe(false);

    // Attempt to open create modal
    comp.openCreateModal();
    expect(comp.showCreateModal()).toBe(false);

    // Attempt to submit rate
    comp.submitRate();
    expect(mockRateService.createRate).not.toHaveBeenCalled();
  });

  it('4. Finding 1: should NOT fallback/prepopulate BasePrice or synthetic prices on modal open, and reject submit if empty', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.openCreateModal();
    expect(comp.showCreateModal()).toBe(true);

    // Verify fields are strictly null, not prepopulated from basePrice (500000 * 0.4 or 500000)
    expect(comp.rateForm.get('firstHoursPrice')?.value).toBeNull();
    expect(comp.rateForm.get('additionalHourPrice')?.value).toBeNull();
    expect(comp.rateForm.get('nightlyPrice')?.value).toBeNull();

    // Attempting submit without entering prices MUST fail validation and NOT call createRate
    comp.submitRate();
    expect(mockRateService.createRate).not.toHaveBeenCalled();
    expect(comp.clientErrors().some(e => e.includes('Vui lòng nhập giá gói giờ đầu'))).toBe(true);
    expect(comp.clientErrors().some(e => e.includes('Vui lòng nhập giá mỗi giờ thêm'))).toBe(true);
    expect(comp.clientErrors().some(e => e.includes('Vui lòng nhập giá thuê qua đêm tiêu chuẩn'))).toBe(true);
  });

  it('5. should reject effectiveFrom in past and effectiveTo <= effectiveFrom', () => {
    const comp = createComponent();
    comp.ngOnInit();

    // In past
    comp.rateForm.patchValue({
      effectiveFrom: '2020-01-01',
      effectiveTo: '2020-02-01',
      firstHoursPrice: 100000,
      additionalHourPrice: 30000,
      nightlyPrice: 400000
    });
    let errors = comp.validateForm();
    expect(errors.some(e => e.includes('quá khứ'))).toBe(true);

    // effectiveTo <= effectiveFrom
    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: todayStr,
      firstHoursPrice: 100000,
      additionalHourPrice: 30000,
      nightlyPrice: 400000
    });
    errors = comp.validateForm();
    expect(errors.some(e => e.includes('lớn hơn ngày bắt đầu'))).toBe(true);
  });

  it('6. should reject non-positive firstHours and negative prices', () => {
    const comp = createComponent();
    comp.ngOnInit();

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextMonthStr,
      firstHours: 0,
      firstHoursPrice: -1000,
      additionalHourPrice: -500,
      nightlyPrice: -50000
    });

    const errors = comp.validateForm();
    expect(errors.some(e => e.includes('Số giờ gói đầu tiên phải lớn hơn 0'))).toBe(true);
    expect(errors.some(e => e.includes('Giá gói giờ đầu không được âm'))).toBe(true);
    expect(errors.some(e => e.includes('Giá mỗi giờ thêm không được âm'))).toBe(true);
    expect(errors.some(e => e.includes('Giá thuê qua đêm không được âm'))).toBe(true);
  });

  it('7. should successfully submit valid user-entered rate schedule and reload rates', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    expect(comp.showCreateModal()).toBe(true);

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextYearStr,
      firstHours: 2,
      firstHoursPrice: 220000,
      additionalHourPrice: 70000,
      nightlyPrice: 550000,
      changeReason: 'Điều chỉnh mùa cao điểm'
    });

    comp.submitRate();

    expect(mockRateService.createRate).toHaveBeenCalledWith('rt-1111', {
      roomTypeId: 'rt-1111',
      propertyId: 'prop-123',
      firstHours: 2,
      firstHoursPrice: 220000,
      additionalHourPrice: 70000,
      nightlyPrice: 550000,
      effectiveFrom: todayStr,
      effectiveTo: nextYearStr,
      currency: 'VND',
      changeReason: 'Điều chỉnh mùa cao điểm'
    });
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith('Thiết lập bảng giá thành công.');
    expect(comp.showCreateModal()).toBe(false);
  });

  it('8. should handle HTTP 409 Conflict when date intervals overlap cannot be split', () => {
    mockRateService.createRate = vi.fn().mockReturnValue(throwError(() => ({
      status: 409,
      error: { message: 'Khoảng ngày bị xung đột dữ liệu.' }
    })));

    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextMonthStr,
      firstHours: 2,
      firstHoursPrice: 200000,
      additionalHourPrice: 60000,
      nightlyPrice: 500000
    });

    comp.submitRate();

    expect(comp.isSaving()).toBe(false);
    expect(comp.showCreateModal()).toBe(true); // Modal remains open for adjustment
    expect(comp.conflictError()).toBe('Khoảng ngày bị xung đột dữ liệu.');
    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Khoảng ngày bị xung đột dữ liệu.',
      'Xung đột bảng giá (409)'
    );
  });

  it('9. Finding 2: should bind modal to snapshot roomType and reset modal on selection change', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.selectedRoomTypeId()).toBe('rt-1111');
    comp.openCreateModal();

    expect(comp.modalTargetRoomTypeId()).toBe('rt-1111');
    expect(comp.modalTargetPropertyId()).toBe('prop-123');
    expect(comp.showCreateModal()).toBe(true);

    // Switching room type while modal is open closes and resets modal
    comp.onRoomTypeChanged('rt-2222');

    expect(comp.showCreateModal()).toBe(false);
    expect(comp.modalTargetRoomTypeId()).toBe(null);
    expect(comp.modalTargetPropertyId()).toBe(null);
    expect(comp.selectedRoomTypeId()).toBe('rt-2222');
  });

  it('10. Finding 2: should discard POST response if roomType context changed while request was in-flight (Race Guard)', () => {
    const createRateSubject = new Subject<any>();
    mockRateService.createRate = vi.fn().mockReturnValue(createRateSubject.asObservable());

    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextYearStr,
      firstHours: 2,
      firstHoursPrice: 250000,
      additionalHourPrice: 80000,
      nightlyPrice: 600000
    });

    // Start submit for rt-1111
    comp.submitRate();
    expect(comp.isSaving()).toBe(true);

    // In-flight: selection changes to rt-2222
    comp.onRoomTypeChanged('rt-2222');
    expect(comp.selectedRoomTypeId()).toBe('rt-2222');

    // createRate for rt-1111 finally resolves
    createRateSubject.next({ id: 'late-rate', roomTypeId: 'rt-1111' });
    createRateSubject.complete();

    // Assert: success toast must NOT be shown, and loadRatesData for rt-1111 was not invoked on new selection
    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
  });

  it('11. Finding 2: should discard POST response if branch context changed A -> B while request was in-flight', () => {
    const createRateSubject = new Subject<any>();
    mockRateService.createRate = vi.fn().mockReturnValue(createRateSubject.asObservable());

    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextYearStr,
      firstHours: 2,
      firstHoursPrice: 250000,
      additionalHourPrice: 80000,
      nightlyPrice: 600000
    });

    comp.submitRate();
    expect(comp.isSaving()).toBe(true);

    // Branch changes
    comp.handlePropertyContextChange('prop-999');

    // Late response comes in
    createRateSubject.next({ id: 'late-rate', propertyId: 'prop-123' });
    createRateSubject.complete();

    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
    expect(comp.showCreateModal()).toBe(false);
  });

  it('12. Finding 3: should clear rates & history immediately on room type switch and isolate history errors', () => {
    const ratesSubject = new Subject<any>();
    const historySubject = new Subject<any>();
    mockRateService.getRates = vi.fn().mockReturnValue(ratesSubject.asObservable());
    mockRateService.getRateHistory = vi.fn().mockReturnValue(historySubject.asObservable());

    const comp = createComponent();
    comp.ngOnInit();

    // Supply initial rates for rt-1111
    ratesSubject.next(sampleRates);
    expect(comp.rates().length).toBe(1);

    // Switch to rt-2222
    comp.onRoomTypeChanged('rt-2222');

    // Assert: old data immediately cleared while new requests are pending!
    expect(comp.rates().length).toBe(0);
    expect(comp.rateHistory().length).toBe(0);
    expect(comp.isLoadingHistory()).toBe(true);

    // History request for rt-2222 fails
    historySubject.error(new Error('Network error on history'));

    expect(comp.isLoadingHistory()).toBe(false);
    expect(comp.historyErrorMessage()).toBe('Network error on history');
    expect(comp.rateHistory().length).toBe(0); // NOT masked as empty success

    // Retry history
    mockRateService.getRateHistory = vi.fn().mockReturnValue(of([{ id: 'h-retry', actionType: 'Created' }]));
    comp.loadHistoryData();

    expect(comp.historyErrorMessage()).toBeNull();
    expect(comp.rateHistory().length).toBe(1);
  });

  it('13. should clean up pending subscriptions on component destroy', () => {
    const createRateSubject = new Subject<any>();
    mockRateService.createRate = vi.fn().mockReturnValue(createRateSubject.asObservable());

    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.rateForm.patchValue({
      effectiveFrom: todayStr,
      effectiveTo: nextYearStr,
      firstHours: 2,
      firstHoursPrice: 200000,
      additionalHourPrice: 60000,
      nightlyPrice: 500000
    });

    comp.submitRate();
    expect(comp.isSaving()).toBe(true);

    comp.ngOnDestroy();

    // Late response arrives after destroy
    createRateSubject.next({ id: 'late-rate' });
    createRateSubject.complete();

    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
  });

  it('14. should prevent double submission with entry guard', () => {
    const comp = createComponent();
    comp.ngOnInit();
    comp.openCreateModal();

    comp.isSaving.set(true);

    comp.submitRate();

    expect(mockRateService.createRate).not.toHaveBeenCalled();
  });

  it('15. should correctly compute rate status (active, upcoming, expired)', () => {
    const comp = createComponent();

    const activeRate: RoomTypeRateDto = {
      ...sampleRates[0],
      effectiveFrom: todayStr,
      effectiveTo: addDaysToDateString(todayStr, 10)
    };
    expect(comp.getRateStatus(activeRate)).toBe('active');

    const upcomingRate: RoomTypeRateDto = {
      ...sampleRates[0],
      effectiveFrom: addDaysToDateString(todayStr, 5),
      effectiveTo: addDaysToDateString(todayStr, 20)
    };
    expect(comp.getRateStatus(upcomingRate)).toBe('upcoming');

    const expiredRate: RoomTypeRateDto = {
      ...sampleRates[0],
      effectiveFrom: '2025-01-01',
      effectiveTo: '2025-02-01'
    };
    expect(comp.getRateStatus(expiredRate)).toBe('expired');
  });

  it('16. should map audit actions to Vietnamese labels and badge CSS classes', () => {
    const comp = createComponent();

    expect(comp.getActionLabel('Created')).toBe('Tạo mới');
    expect(comp.getActionLabel('Split_Created')).toBe('Chia khoảng (Tạo mới)');
    expect(comp.getActionLabel('Split_Shortened')).toBe('Chia khoảng (Rút ngắn)');
    expect(comp.getActionLabel('Replaced')).toBe('Thay thế (Hủy cũ)');
    expect(comp.getActionLabel('Replaced_Created')).toBe('Thay thế (Áp dụng)');

    expect(comp.getActionBadgeClass('Created')).toContain('emerald');
    expect(comp.getActionBadgeClass('Split_Created')).toContain('sky');
    expect(comp.getActionBadgeClass('Split_Shortened')).toContain('amber');
    expect(comp.getActionBadgeClass('Replaced')).toContain('purple');
    expect(comp.getActionBadgeClass('Replaced_Created')).toContain('indigo');
  });
});
