import '@angular/compiler';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertiesPage } from './properties.page';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { TenantPropertySummaryDto } from '../../core/models/public-booking.model';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: browser.window,
    document: browser.window.document,
    HTMLElement: browser.window.HTMLElement,
    Node: browser.window.Node,
  });
}

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('PropertiesPage — PMS Properties & FormField Validation (Task T016)', () => {
  let fixture: ComponentFixture<PropertiesPage>;
  let component: PropertiesPage;
  let mockPropertyService: any;
  let mockPublicBookingService: any;
  let mockAuthService: any;
  let mockAlertService: any;
  let mockRouter: any;

  const sampleProperties: TenantPropertySummaryDto[] = [
    {
      id: 'prop-01',
      name: 'Khách sạn Sài Gòn Phố Cổ',
      code: 'SG01',
      slug: 'khach-san-sai-gon-pho-co',
      propertyType: 1,
      propertyTypeName: 'Khách sạn',
      address: '101 Đồng Khởi',
      city: 'TP. Hồ Chí Minh',
      touristZoneName: 'Trung Tâm Quận 1',
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: true,
      isActive: true,
      totalRooms: 20,
      occupiedRooms: 12,
      todayRevenue: 15000000,
    },
    {
      id: 'prop-02',
      name: 'Nhà nghỉ Đà Lạt Mộng Mơ',
      code: 'DL02',
      slug: 'nha-nghi-da-lat-mong-mo',
      propertyType: 3,
      propertyTypeName: 'Nhà nghỉ',
      address: '22 Bùi Thị Xuân',
      city: 'Đà Lạt',
      touristZoneName: 'Chợ Đêm Đà Lạt',
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: false,
      isActive: true,
      totalRooms: 10,
      occupiedRooms: 8,
      todayRevenue: 4000000,
    },
  ];

  beforeEach(async () => {
    mockPropertyService = {
      getTenantProperties: vi.fn(() => of(sampleProperties)),
      createProperty: vi.fn(() => of({ id: 'prop-new', name: 'New Property' })),
      updateProperty: vi.fn(() => of({ id: 'prop-01', name: 'Updated' })),
    };

    mockPublicBookingService = {
      getTouristZones: vi.fn(() => of([
        { id: 'tz-01', name: 'Trung Tâm Quận 1', slug: 'trung-tam-quan-1', provinceName: 'TP. Hồ Chí Minh' },
      ])),
    };

    mockAuthService = {
      activePropertyId: vi.fn(() => 'prop-01'),
      activePropertyName: vi.fn(() => 'Khách sạn Sài Gòn Phố Cổ'),
      setActivePropertyContext: vi.fn(),
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PropertiesPage],
      providers: [
        provideRouter([]),
        { provide: PropertyManagementService, useValue: mockPropertyService },
        { provide: PublicBookingService, useValue: mockPublicBookingService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('1. should mount and load properties list with accurate KPIs', () => {
    expect(mockPropertyService.getTenantProperties).toHaveBeenCalled();
    expect(component.properties().length).toBe(2);
    expect(component.totalProperties()).toBe(2);
    expect(component.totalRooms()).toBe(30);
    expect(component.occupiedRooms()).toBe(20);
    expect(component.occupancyRateLabel()).toContain('67%');
  });

  it('2. should filter properties correctly by search keyword and property type', () => {
    component.searchQuery.set('Đà Lạt');
    expect(component.filteredProperties().length).toBe(1);
    expect(component.filteredProperties()[0].name).toBe('Nhà nghỉ Đà Lạt Mộng Mơ');

    component.searchQuery.set('');
    component.selectedType.set(1); // Hotel
    expect(component.filteredProperties().length).toBe(1);
    expect(component.filteredProperties()[0].code).toBe('SG01');
  });

  it('3. should open create modal with empty form and validate required fields on submit', () => {
    component.openCreateModal();
    expect(component.isModalOpen()).toBe(true);
    expect(component.isEditing()).toBe(false);

    // Initial form is invalid
    expect(component.propertyForm.valid).toBe(false);

    // Trigger save on empty form
    component.saveProperty();
    expect(component.propertyForm.touched).toBe(true);

    // Validation error messages must be generated
    expect(component.getFieldError('name')).toBe('Tên chi nhánh không được để trống.');
    expect(component.getFieldError('code')).toBe('Mã chi nhánh không được để trống.');
    expect(component.getFieldError('slug')).toBe('Đường dẫn định danh (Slug) không được để trống.');
    expect(component.getFieldError('address')).toBe('Địa chỉ cụ thể không được để trống.');
    expect(component.getFieldError('city')).toBe('Tỉnh / Thành phố không được để trống.');

    // Service createProperty must NOT have been called
    expect(mockPropertyService.createProperty).not.toHaveBeenCalled();
  });

  it('4. should auto-generate URL slug from property name in create mode', () => {
    component.openCreateModal();
    component.propertyForm.patchValue({ name: 'Khách Sạn Biển Xanh Nha Trang' });
    component.onNameChanged();

    expect(component.propertyForm.get('slug')?.value).toBe('khach-san-bien-xanh-nha-trang');
  });

  it('5. should submit valid new property and show success notification', () => {
    component.openCreateModal();
    component.propertyForm.patchValue({
      name: 'Khách sạn Mới',
      code: 'NEW01',
      slug: 'khach-san-moi',
      propertyType: 1,
      address: '12 Lê Lợi',
      city: 'Huế',
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: true,
    });

    expect(component.propertyForm.valid).toBe(true);
    component.saveProperty();

    expect(mockPropertyService.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Khách sạn Mới',
        code: 'NEW01',
        slug: 'khach-san-moi',
        city: 'Huế',
      })
    );
    expect(component.isModalOpen()).toBe(false);
    expect(mockAlertService.toastSuccess).toHaveBeenCalled();
  });

  it('6. should open edit modal with pre-populated property data and submit update', () => {
    const propToEdit = sampleProperties[0];
    component.openEditModal(propToEdit);

    expect(component.isModalOpen()).toBe(true);
    expect(component.isEditing()).toBe(true);
    expect(component.propertyForm.get('name')?.value).toBe(propToEdit.name);
    expect(component.propertyForm.get('code')?.value).toBe(propToEdit.code);

    component.propertyForm.patchValue({ name: 'Khách sạn Sài Gòn Phố Cổ Luxury' });
    component.saveProperty();

    expect(mockPropertyService.updateProperty).toHaveBeenCalledWith(
      propToEdit.id,
      expect.objectContaining({
        name: 'Khách sạn Sài Gòn Phố Cổ Luxury',
      })
    );
    expect(component.isModalOpen()).toBe(false);
  });

  it('7. should switch active property context and navigate to rooms view', () => {
    const targetProp = sampleProperties[1];
    component.switchToProperty(targetProp);

    expect(mockAuthService.setActivePropertyContext).toHaveBeenCalledWith(
      targetProp.id,
      targetProp.name,
      targetProp.code
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/rooms']);
  });
});
