import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError, Subject } from 'rxjs';
import { PoliciesPage } from './policies.page';
import { PolicyService } from '../../core/services/policy.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  PropertyPoliciesDto,
  SurchargeType,
  SurchargeCalculationMethod
} from '../../core/models/policy.model';

describe('PoliciesPage Logic, Validation & Authorization', () => {
  let mockPolicyService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let activePropertyIdSignal: any;
  let activePropertyNameSignal: any;

  const samplePolicies: PropertyPoliciesDto = {
    propertyId: '11111111-1111-1111-1111-111111111111',
    checkInTime: '14:00:00',
    checkOutTime: '12:00:00',
    bufferMinutes: 30,
    maxHourlyHours: 12,
    surcharges: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        surchargeType: SurchargeType.EarlyCheckIn,
        fromTime: '06:00:00',
        toTime: '14:00:00',
        calculationMethod: SurchargeCalculationMethod.PercentageOfNightly,
        percentage: 50,
        flatAmount: null,
        isActive: true
      }
    ]
  };

  beforeEach(() => {
    mockPolicyService = {
      getPolicies: vi.fn().mockReturnValue(of(samplePolicies)),
      updatePolicies: vi.fn().mockReturnValue(of(samplePolicies))
    };

    activePropertyIdSignal = signal<string | null>('11111111-1111-1111-1111-111111111111');
    activePropertyNameSignal = signal<string | null>('Chi nhánh Mỹ Khê');

    mockAuthService = {
      activePropertyId: activePropertyIdSignal,
      activePropertyName: activePropertyNameSignal,
      hasPermission: vi.fn((code: string, mask: number) => {
        if (code === 'PROPERTIES') return true;
        return false;
      })
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      showNotice: vi.fn()
    };
  });

  function createComponent(): PoliciesPage {
    const injector = Injector.create({
      providers: [
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
    return runInInjectionContext(injector, () => new PoliciesPage());
  }

  it('1. should create and load initial policies', () => {
    const comp = createComponent();
    comp.loadPolicies();

    expect(comp).toBeTruthy();
    expect(mockPolicyService.getPolicies).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
    expect(comp.policyForm.value.bufferMinutes).toBe(30);
    expect(comp.policyForm.value.maxHourlyHours).toBe(12);
    expect(comp.surchargesArray.length).toBe(1);
    expect(comp.canRead()).toBe(true);
    expect(comp.canUpdate()).toBe(true);
  });

  it('2. should reject bufferMinutes < 30', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.policyForm.patchValue({ bufferMinutes: 20 });
    const errors = comp.validateForm();
    expect(errors.some(e => e.includes('30 phút'))).toBe(true);
  });

  it('3. should reject maxHourlyHours < 1 or > 24 per Decision D14', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.policyForm.patchValue({ maxHourlyHours: 0 });
    let errors = comp.validateForm();
    expect(errors.some(e => e.includes('từ 1 đến 24 giờ'))).toBe(true);

    comp.policyForm.patchValue({ maxHourlyHours: 25 });
    errors = comp.validateForm();
    expect(errors.some(e => e.includes('từ 1 đến 24 giờ'))).toBe(true);

    comp.policyForm.patchValue({ maxHourlyHours: 8 });
    errors = comp.validateForm();
    expect(errors.some(e => e.includes('từ 1 đến 24 giờ'))).toBe(false);
  });

  it('4. should reject surcharge with toTime <= fromTime', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.surchargesArray.at(0).patchValue({
      fromTime: '14:00',
      toTime: '10:00'
    });
    const errors = comp.validateForm();
    expect(errors.some(e => e.includes('phải lớn hơn giờ bắt đầu'))).toBe(true);
  });

  it('5. should reject surcharge with invalid percentage or flatAmount', () => {
    const comp = createComponent();
    comp.loadPolicies();

    // Percentage must be > 0 and <= 100
    comp.surchargesArray.at(0).patchValue({
      calculationMethod: SurchargeCalculationMethod.PercentageOfNightly,
      percentage: 150
    });
    let errors = comp.validateForm();
    expect(errors.some(e => e.includes('không vượt quá 100%'))).toBe(true);

    // FlatAmount cannot be negative
    comp.surchargesArray.at(0).patchValue({
      calculationMethod: SurchargeCalculationMethod.FlatAmount,
      flatAmount: -50000
    });
    errors = comp.validateForm();
    expect(errors.some(e => e.includes('không được âm'))).toBe(true);
  });

  it('6. should detect overlapping surcharge intervals for the same SurchargeType', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.addSurcharge();
    expect(comp.surchargesArray.length).toBe(2);

    // First surcharge: 06:00 to 12:00
    comp.surchargesArray.at(0).patchValue({
      surchargeType: SurchargeType.EarlyCheckIn,
      fromTime: '06:00',
      toTime: '12:00',
      isActive: true
    });

    // Second surcharge: 10:00 to 14:00 (overlaps with first!)
    comp.surchargesArray.at(1).patchValue({
      surchargeType: SurchargeType.EarlyCheckIn,
      fromTime: '10:00',
      toTime: '14:00',
      isActive: true
    });

    const errors = comp.validateForm();
    expect(errors.some(e => e.includes('chồng lấn'))).toBe(true);
  });

  it('7. should allow non-overlapping intervals for the same SurchargeType', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.addSurcharge();

    comp.surchargesArray.at(0).patchValue({
      surchargeType: SurchargeType.EarlyCheckIn,
      fromTime: '06:00',
      toTime: '10:00',
      isActive: true
    });

    comp.surchargesArray.at(1).patchValue({
      surchargeType: SurchargeType.EarlyCheckIn,
      fromTime: '10:00',
      toTime: '14:00',
      isActive: true
    });

    const errors = comp.validateForm();
    expect(errors.some(e => e.includes('chồng lấn'))).toBe(false);
  });

  it('8. should allow adding and removing surcharges', () => {
    const comp = createComponent();
    comp.loadPolicies();

    const initialLen = comp.surchargesArray.length;
    comp.addSurcharge();
    expect(comp.surchargesArray.length).toBe(initialLen + 1);

    comp.removeSurcharge(initialLen);
    expect(comp.surchargesArray.length).toBe(initialLen);
  });

  it('9. should save valid policies successfully and show toast', () => {
    const comp = createComponent();
    comp.loadPolicies();

    comp.policyForm.patchValue({
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bufferMinutes: 45,
      maxHourlyHours: 10
    });

    comp.savePolicies();

    expect(mockPolicyService.updatePolicies).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.objectContaining({
        checkInTime: '14:00:00',
        checkOutTime: '12:00:00',
        bufferMinutes: 45,
        maxHourlyHours: 10
      })
    );
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith('Cập nhật chính sách chi nhánh thành công.');
    expect(comp.isSaving()).toBe(false);
  });

  it('10. should block saving when user only has Read permission', () => {
    mockAuthService.hasPermission.mockImplementation((code: string, mask: number) => {
      if (code === 'PROPERTIES' && mask === 1) return true; // Read OK
      if (code === 'PROPERTIES' && mask === 4) return false; // Update Denied
      return false;
    });

    const comp = createComponent();
    comp.loadPolicies();
    expect(comp.canUpdate()).toBe(false);

    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).not.toHaveBeenCalled();
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Bạn không có quyền cập nhật chính sách chi nhánh.');
  });

  it('11. should handle error response from backend gracefully', () => {
    mockPolicyService.updatePolicies.mockReturnValue(
      throwError(() => ({ error: { message: 'Lỗi xung đột dữ liệu.' } }))
    );

    const comp = createComponent();
    comp.loadPolicies();

    comp.savePolicies();

    expect(comp.isSaving()).toBe(false);
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Lỗi xung đột dữ liệu.', 'Lỗi cập nhật');
  });

  it('12. should initialize form with domain defaults (12:00 check-in/out, 30min buffer, 12h maxHourly) and disallow save before GET succeeds', () => {
    const comp = createComponent();
    // Do not call loadPolicies()
    expect(comp.policyForm.value.checkInTime).toBe('12:00');
    expect(comp.policyForm.value.checkOutTime).toBe('12:00');
    expect(comp.policyForm.value.bufferMinutes).toBe(30);
    expect(comp.policyForm.value.maxHourlyHours).toBe(12);
    expect(comp.loadedPropertyId()).toBeNull();

    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).not.toHaveBeenCalled();
  });

  it('13. should block SETTINGS-only permission from read and update without fallback', () => {
    mockAuthService.hasPermission.mockImplementation((code: string, mask: number) => {
      if (code === 'SETTINGS') return true;
      return false;
    });

    const comp = createComponent();
    expect(comp.canRead()).toBe(false);
    expect(comp.canUpdate()).toBe(false);

    comp.loadPolicies();
    expect(mockPolicyService.getPolicies).not.toHaveBeenCalled();

    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).not.toHaveBeenCalled();
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Bạn không có quyền cập nhật chính sách chi nhánh.');
  });

  it('14. should block saving when activePropertyId is null', () => {
    activePropertyIdSignal.set(null);
    const comp = createComponent();

    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).not.toHaveBeenCalled();
    expect(mockAlertService.toastError).toHaveBeenCalledWith('Vui lòng chọn chi nhánh làm việc trước khi lưu.');
  });

  it('15. should prevent branch A late GET response from overwriting branch B (latest-request-wins)', () => {
    const subjectA$ = new Subject<PropertyPoliciesDto>();
    const subjectB$ = new Subject<PropertyPoliciesDto>();

    mockPolicyService.getPolicies.mockImplementation((id: string) => {
      if (id === '11111111-1111-1111-1111-111111111111') return subjectA$;
      if (id === '22222222-2222-2222-2222-222222222222') return subjectB$;
      return of(samplePolicies);
    });

    const comp = createComponent();
    comp.loadPolicies(); // initiates GET for branch A
    expect(comp.isLoading()).toBe(true);

    // Switch active branch to branch B and trigger load
    activePropertyIdSignal.set('22222222-2222-2222-2222-222222222222');
    comp.loadPolicies(); // initiates GET for branch B
    expect(comp.isLoading()).toBe(true);

    // Branch B resolves first
    const samplePoliciesB: PropertyPoliciesDto = {
      propertyId: '22222222-2222-2222-2222-222222222222',
      checkInTime: '13:00:00',
      checkOutTime: '11:00:00',
      bufferMinutes: 45,
      maxHourlyHours: 6,
      surcharges: []
    };
    subjectB$.next(samplePoliciesB);
    subjectB$.complete();

    expect(comp.isLoading()).toBe(false);
    expect(comp.loadedPropertyId()).toBe('22222222-2222-2222-2222-222222222222');
    expect(comp.policyForm.value.checkInTime).toBe('13:00');
    expect(comp.policyForm.value.maxHourlyHours).toBe(6);

    // Branch A resolves later (stale/out-of-order response)
    subjectA$.next(samplePolicies);
    subjectA$.complete();

    // Branch B state must remain untouched
    expect(comp.loadedPropertyId()).toBe('22222222-2222-2222-2222-222222222222');
    expect(comp.policyForm.value.checkInTime).toBe('13:00');
    expect(comp.policyForm.value.maxHourlyHours).toBe(6);
  });

  it('16. should drop branch A error if branch switched to B while GET pending', () => {
    const subjectA$ = new Subject<PropertyPoliciesDto>();
    mockPolicyService.getPolicies.mockReturnValue(subjectA$);

    const comp = createComponent();
    comp.loadPolicies();

    activePropertyIdSignal.set('22222222-2222-2222-2222-222222222222');
    subjectA$.error(new Error('Network failure on Branch A'));

    expect(comp.errorMessage()).toBeNull();
  });

  it('17. should block saving branch B when form still holds branch A (mismatch between loadedPropertyId and propertyId)', () => {
    const comp = createComponent();
    comp.loadPolicies(); // Loads branch A
    expect(comp.loadedPropertyId()).toBe('11111111-1111-1111-1111-111111111111');

    // Context changes to branch B without B being loaded
    activePropertyIdSignal.set('22222222-2222-2222-2222-222222222222');
    expect(comp.propertyId()).toBe('22222222-2222-2222-2222-222222222222');

    // Attempting to save while loadedPropertyId !== propertyId must be blocked
    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).not.toHaveBeenCalled();
  });

  it('18. should block duplicate submit when savePolicies is already in progress (anti-double-submit entry guard)', () => {
    const saveSubject$ = new Subject<PropertyPoliciesDto>();
    mockPolicyService.updatePolicies.mockReturnValue(saveSubject$);

    const comp = createComponent();
    comp.loadPolicies();

    comp.savePolicies();
    expect(comp.isSaving()).toBe(true);
    expect(mockPolicyService.updatePolicies).toHaveBeenCalledTimes(1);

    // Call save again while first request is in-flight
    comp.savePolicies();
    expect(mockPolicyService.updatePolicies).toHaveBeenCalledTimes(1);

    // Resolve first save
    saveSubject$.next(samplePolicies);
    saveSubject$.complete();
    expect(comp.isSaving()).toBe(false);
  });

  it('19. should drop pending PUT response if branch switched to B while save was in-flight', () => {
    const saveSubject$ = new Subject<PropertyPoliciesDto>();
    mockPolicyService.updatePolicies.mockReturnValue(saveSubject$);

    const comp = createComponent();
    comp.loadPolicies();

    comp.savePolicies();
    expect(comp.isSaving()).toBe(true);

    // Branch context switched while save in-flight
    activePropertyIdSignal.set('22222222-2222-2222-2222-222222222222');

    saveSubject$.next(samplePolicies);
    saveSubject$.complete();

    // Branch A's PUT response must be dropped: toastSuccess is not called for the new context
    expect(mockAlertService.toastSuccess).not.toHaveBeenCalled();
    expect(comp.isSaving()).toBe(false);
  });

  it('20. should cancel in-flight requests and not update form on component destroy', () => {
    const pendingSubject$ = new Subject<PropertyPoliciesDto>();
    mockPolicyService.getPolicies.mockReturnValue(pendingSubject$);

    const comp = createComponent();
    comp.loadPolicies();
    expect(comp.isLoading()).toBe(true);

    comp.ngOnDestroy();

    pendingSubject$.next(samplePolicies);
    pendingSubject$.complete();

    expect(comp.loadedPropertyId()).toBeNull();
  });
});
