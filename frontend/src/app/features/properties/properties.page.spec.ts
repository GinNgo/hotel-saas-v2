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
      fetchMyMemberships: vi.fn(() => of([])),
      switchContext: vi.fn(() => of({
        accessToken: 'tok',
        refreshToken: 'ref',
        expiresAtUtc: '',
        currentContext: {
          tenantId: 't1',
          propertyId: 'prop-02',
          scope: 'PropertyScoped',
          roleName: 'Owner',
        },
      })),
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
    expect(mockAuthService.fetchMyMemberships).toHaveBeenCalled();
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
    expect(mockAuthService.fetchMyMemberships).toHaveBeenCalled();
    expect(component.isModalOpen()).toBe(false);
  });

  it('7. should switch active property context via API and navigate to rooms view', () => {
    const targetProp = sampleProperties[1];
    component.switchToProperty(targetProp);

    expect(mockAuthService.switchContext).toHaveBeenCalledWith(targetProp.id);
    expect(mockAlertService.toastSuccess).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/rooms']);
  });

  it('8. should handle switchContext failure gracefully without navigating and support all 8 backend property types', () => {
    mockAuthService.switchContext.mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'Không có quyền truy cập chi nhánh.' } }))
    );

    const targetProp = sampleProperties[1];
    component.switchToProperty(targetProp);

    expect(component.switchingPropertyId()).toBeNull();
    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      'Không có quyền truy cập chi nhánh.',
      'Lỗi chuyển ngữ cảnh'
    );
    expect(mockRouter.navigate).not.toHaveBeenCalled();

    expect(component.propertyTypeOptions.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(component.getPropertyTypeLabel(8)).toBe('Homestay');
    expect(component.getPropertyTypeLabel(7)).toBe('Nhà nghỉ / Motel');
  });

  it('9. should preserve touristZoneSlug and coordinates on openEditModal and send lat/lng from onMapLocationSelected', () => {
    const propWithGeo: TenantPropertySummaryDto & {
      touristZoneSlug?: string;
      latitude?: number;
      longitude?: number;
    } = {
      ...sampleProperties[0],
      touristZoneSlug: 'trung-tam-quan-1',
      latitude: 10.7725,
      longitude: 106.6980,
    };

    component.openEditModal(propWithGeo);

    expect(component.propertyForm.get('touristZoneSlug')?.value).toBe('trung-tam-quan-1');
    expect(component.propertyForm.get('latitude')?.value).toBe(10.7725);
    expect(component.propertyForm.get('longitude')?.value).toBe(106.6980);

    component.onMapLocationSelected({
      address: 'Đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',
      latitude: 16.0601,
      longitude: 108.2464,
      provinceCode: '48',
    });

    expect(component.propertyForm.get('address')?.value).toBe('Đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng');
    expect(component.propertyForm.get('latitude')?.value).toBe(16.0601);
    expect(component.propertyForm.get('longitude')?.value).toBe(108.2464);
    expect(component.propertyForm.get('provinceCode')?.value).toBe('48');

    component.saveProperty();
    expect(mockPropertyService.updateProperty).toHaveBeenCalledWith(
      propWithGeo.id,
      expect.objectContaining({
        touristZoneSlug: 'trung-tam-quan-1',
        latitude: 16.0601,
        longitude: 108.2464,
      })
    );
  });

  it('10. should default provinceCode to canonical 79 on create and bind real provinceCode on openEditModal', () => {
    component.openCreateModal();
    expect(component.propertyForm.get('provinceCode')?.value).toBe('79');

    component.propertyForm.patchValue({
      name: 'Khách sạn Bến Thành',
      code: 'BT01',
      slug: 'khach-san-ben-thanh',
      propertyType: 1,
      address: '10 Lê Lợi',
      city: 'TP. Hồ Chí Minh',
    });
    component.saveProperty();
    expect(mockPropertyService.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        provinceCode: '79',
      })
    );

    // Edit property in Đà Lạt (sampleProperties[1]) infers canonical code '68' instead of 'VN-SG'
    component.openEditModal(sampleProperties[1]);
    expect(component.propertyForm.get('provinceCode')?.value).toBe('68');

    // Edit property with explicit provinceCode or legacy code resolves to canonical 34 code
    component.openEditModal({ ...sampleProperties[0], provinceCode: '48' } as TenantPropertySummaryDto);
    expect(component.propertyForm.get('provinceCode')?.value).toBe('48');

    component.openEditModal({ ...sampleProperties[0], provinceCode: '77' } as TenantPropertySummaryDto);
    expect(component.propertyForm.get('provinceCode')?.value).toBe('79');
  });

  it('11. should wire phoneNumber, email, starRating, checkInTime/checkOutTime, and isPublished in create/edit and togglePublishStatus', () => {
    component.openCreateModal();
    expect(component.propertyForm.get('checkInTime')?.value).toBe('14:00');
    expect(component.propertyForm.get('checkOutTime')?.value).toBe('12:00');
    expect(component.propertyForm.get('isPublished')?.value).toBe(false);

    component.propertyForm.patchValue({
      name: 'Khách sạn Biển Ngọc',
      code: 'BN01',
      slug: 'khach-san-bien-ngoc',
      propertyType: 2,
      starRating: 4,
      phoneNumber: '0908111222',
      email: 'booking@bienngoc.vn',
      address: '88 Trần Phú',
      city: 'Khánh Hòa',
      checkInTime: '14:30',
      checkOutTime: '11:30',
      isPublished: true,
    });

    component.saveProperty();
    expect(mockPropertyService.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '0908111222',
        email: 'booking@bienngoc.vn',
        starRating: 4,
        checkInTime: '14:30:00',
        checkOutTime: '11:30:00',
        isPublished: true,
      })
    );

    const unpublishedProp = {
      ...sampleProperties[0],
      phoneNumber: '0901234567',
      email: 'sg@hotel.vn',
      starRating: 5,
      isPublished: false,
      checkInTime: '14:00:00',
      checkOutTime: '12:00:00',
    } as TenantPropertySummaryDto & { isPublished?: boolean; checkInTime?: string; checkOutTime?: string };

    component.properties.set([unpublishedProp]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chưa công khai');
    expect(fixture.nativeElement.textContent).toContain('0901234567');
    expect(fixture.nativeElement.textContent).toContain('sg@hotel.vn');
    expect(fixture.nativeElement.textContent).toContain('5 sao');

    component.togglePublishStatus(unpublishedProp);
    expect(mockPropertyService.updateProperty).toHaveBeenCalledWith(
      unpublishedProp.id,
      expect.objectContaining({
        name: unpublishedProp.name,
        phoneNumber: '0901234567',
        email: 'sg@hotel.vn',
        starRating: 5,
        isPublished: true,
      })
    );
    expect(component.isPropertyPublished(component.properties()[0])).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Đang công khai');
  });

  it('12. should surface backend 409 conflict message and normalize string PropertyType enums', () => {
    mockPropertyService.createProperty.mockReturnValueOnce(
      throwError(() => ({ error: { message: "Mã chi nhánh 'SG01' đã tồn tại trong chuỗi." } }))
    );

    component.openCreateModal();
    component.propertyForm.patchValue({
      name: 'Trùng Mã',
      code: 'SG01',
      slug: 'trung-ma',
      address: '10 Lê Lợi',
      city: 'TP. Hồ Chí Minh',
    });
    component.saveProperty();

    expect(mockAlertService.toastError).toHaveBeenCalledWith(
      "Mã chi nhánh 'SG01' đã tồn tại trong chuỗi.",
      'Lỗi tạo mới'
    );

    expect(component.normalizePropertyType('Homestay')).toBe(8);
    expect(component.normalizePropertyType('Hotel')).toBe(1);
    expect(component.getPropertyTypeLabel('Homestay')).toBe('Homestay');
  });
});
