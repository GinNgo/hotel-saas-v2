import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { GuestAccountService } from '../../../core/services/guest-account.service';
import { AlertService } from '../../../core/services/alert.service';
import { UserDto } from '../../../core/models/auth.model';
import {
  GuestInvoiceRecordDto,
  GuestPagedBookingsDto,
  GuestProfileResponseDto,
  LoyaltyPointLedgerItemDto
} from '../../../core/models/guest-account.model';
import { GuestProfilePageComponent } from './guest-profile.page';

if (typeof document === 'undefined') {
  const browser = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: browser.window, document: browser.window.document, HTMLElement: browser.window.HTMLElement, Node: browser.window.Node });
}
try { TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()); } catch {}

describe('Real-session guest account', () => {
  const users = new BehaviorSubject<UserDto | null>(null);
  const logout = vi.fn(() => users.next(null));
  const mockGuestService = {
    getMe: vi.fn(() => of({ id: 'u1', fullName: 'Khách Test', email: 'test@example.com', emailVerified: true, capabilities: { canEditName: true, canViewBookings: true } })),
    updateMe: vi.fn((name: string) => of({ id: 'u1', fullName: name, email: 'test@example.com', emailVerified: true, capabilities: { canEditName: true, canViewBookings: true } })),
    getBookings: vi.fn(() => of<GuestPagedBookingsDto>({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })),
    getLoyaltyProfile: vi.fn(() => of<GuestProfileResponseDto | null>(null)),
    getLoyaltyLedger: vi.fn(() => of<LoyaltyPointLedgerItemDto[]>([])),
    getInvoices: vi.fn(() => of<GuestInvoiceRecordDto[]>([])),
    updateVatProfile: vi.fn(() => of(true)),
  };
  const mockAlertService = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGuestService.getBookings.mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }));
    mockGuestService.getLoyaltyProfile.mockReturnValue(of(null));
    mockGuestService.getLoyaltyLedger.mockReturnValue(of([]));
    mockGuestService.getInvoices.mockReturnValue(of([]));
    users.next(null); logout.mockClear();
    TestBed.configureTestingModule({
      imports: [GuestProfilePageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser$: users, currentUser: null, logout } },
        { provide: GuestAccountService, useValue: mockGuestService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('shows sign-in with returnUrl instead of a demo account', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent); fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href*="returnUrl"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Nguyễn Minh Quân');
  });
  it('switches identity and clears private account content on logout', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'a', fullName: 'Khách A', email: 'a@example.com', globalRole: 'Customer', tenantId: null }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('a@example.com');
    fixture.componentInstance.logout(); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('a@example.com');
    users.next({ id: 'b', fullName: 'Khách B', email: 'b@example.com', globalRole: 'Customer', tenantId: null }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('b@example.com');
    expect(logout).toHaveBeenCalledOnce();
  });
  it('does not show guest tools to staff or fabricate invoices', () => {
    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'staff', fullName: 'Staff', email: 'staff@example.com', globalRole: 'TenantStaff', tenantId: 'tenant' }); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[download]')).toBeNull();
  });

  it('links booking details using lookupToken or reference instead of reservation GUID id', () => {
    mockGuestService.getBookings.mockReturnValue(of({
      items: [
        {
          id: 'res-guid-9999',
          reference: 'RES-XYZ789',
          lookupToken: 'secure-lookup-tok-123',
          property: { id: 'p1', name: 'Hotel Đà Lạt', slug: 'hotel-da-lat' },
          roomTypeName: 'Deluxe',
          rentalType: 'Daily',
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          status: 'Confirmed',
          totalAmount: 1500000,
          currency: 'VND'
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    }));

    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'u1', fullName: 'Khách A', email: 'a@example.com', globalRole: 'Customer', tenantId: null });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const detailLink = Array.from(element.querySelectorAll('a')).find(a => a.textContent?.includes('Chi tiết'));
    expect(detailLink?.getAttribute('href')).toBe('/booking/status/secure-lookup-tok-123');
    expect(detailLink?.getAttribute('href')).not.toContain('res-guid-9999');
    expect(element.textContent).toContain('1.500.000 ₫');
    const spentKpi = Array.from(element.querySelectorAll('div')).find(el => el.textContent?.trim() === '1.500.000 ₫');
    expect(spentKpi?.className).not.toContain('truncate');
    expect(spentKpi?.className).toContain('break-words');

    fixture.componentInstance.selectTab('bookings');
    fixture.detectChanges();
    const tabDetailLink = Array.from(element.querySelectorAll('a')).find(a => a.textContent?.includes('Xem chi tiết'));
    expect(tabDetailLink?.getAttribute('href')).toBe('/booking/status/secure-lookup-tok-123');
    expect(tabDetailLink?.getAttribute('href')).not.toContain('res-guid-9999');
  });

  it('loads and renders loyalty ledger, invoices, and updates VAT profile', () => {
    mockGuestService.getLoyaltyProfile.mockReturnValue(of({
      userId: 'u1',
      fullName: 'Khách Test',
      phone: '0901234567',
      email: 'test@example.com',
      companyName: 'ABC Corp',
      companyTaxCode: '0101234567',
      companyAddress: 'Hà Nội',
      totalPoints: 250,
      pointsValueVnd: 250000,
      totalPointsRefunded: 0,
      memberships: [
        {
          membershipId: 'm1',
          tenantId: 't1',
          tenantBrandName: 'LuxeStay',
          enrolledPropertyId: 'p1',
          enrolledPropertyName: 'LuxeStay Đà Lạt',
          memberCode: 'MEM-001',
          tier: 'Silver',
          pointsBalance: 250,
          pendingPoints: 0,
          totalStays: 2,
          discountPercent: 5,
          nextTierName: 'Gold',
          staysToNextTier: 3,
          joinedAt: '2026-01-01'
        }
      ]
    }));

    mockGuestService.getLoyaltyLedger.mockReturnValue(of([
      {
        id: 'led-1',
        createdAt: '2026-11-01',
        tenantBrandName: 'LuxeStay',
        propertyName: 'LuxeStay Đà Lạt',
        reservationCode: 'RES-XYZ789',
        type: 'Earned',
        pointsDelta: 100,
        balanceAfter: 250,
        description: 'Tích điểm sau trả phòng'
      }
    ]));

    mockGuestService.getInvoices.mockReturnValue(of([
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-001',
        reservationId: 'res-guid-9999',
        reservationCode: 'RES-XYZ789',
        tenantBrandName: 'LuxeStay',
        propertyName: 'LuxeStay Đà Lạt',
        propertyType: 'Hotel',
        propertyAddress: 'Đà Lạt',
        propertyTaxCode: '0300000000',
        rentalType: 'Daily',
        checkInTime: '2026-11-01',
        checkOutTime: '2026-11-02',
        roomName: 'Deluxe',
        roomNumber: '101',
        status: 'Paid',
        subTotal: 1000000,
        surchargeTotal: 0,
        discountTotal: 0,
        pointsUsed: 0,
        pointsDiscountAmount: 0,
        pointsEarned: 100,
        pointsRefunded: 0,
        taxAmount: 80000,
        grandTotal: 1080000,
        paidAmount: 1080000,
        paymentMethod: 'VNPay',
        issuedAt: '2026-11-02',
        lineItems: []
      }
    ]));

    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    users.next({ id: 'u1', fullName: 'Khách Test', email: 'test@example.com', globalRole: 'Customer', tenantId: null });
    fixture.detectChanges();

    expect(mockGuestService.getLoyaltyLedger).toHaveBeenCalled();
    expect(mockGuestService.getInvoices).toHaveBeenCalled();

    fixture.componentInstance.selectTab('bookings');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('INV-2026-001');
    expect(element.textContent).toContain('1.080.000 ₫');

    fixture.componentInstance.vatCompanyName = 'New Co';
    fixture.componentInstance.saveVatProfile();
    expect(mockGuestService.updateVatProfile).toHaveBeenCalledWith({
      companyName: 'New Co',
      companyTaxCode: '0101234567',
      companyAddress: 'Hà Nội'
    });

    fixture.componentInstance.selectTab('loyalty');
    fixture.detectChanges();
    expect(element.textContent).toContain('Tích điểm sau trả phòng');
    expect(element.textContent).toContain('MEM-001');
    expect(element.textContent).toContain('250.000 ₫');
  });

  it('localizes booking statuses, rental types, and invoice statuses to Vietnamese across tabs and modal', () => {
    mockGuestService.getBookings.mockReturnValue(of({
      items: [
        {
          id: 'res-loc-1',
          reference: 'RES-LOC-001',
          lookupToken: 'tok-loc-001',
          property: { id: 'p1', name: 'Hotel Đà Lạt', slug: 'hotel-da-lat' },
          roomTypeName: 'Deluxe',
          rentalType: 'Daily',
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          status: 'PendingPayment',
          totalAmount: 1500000,
          currency: 'VND'
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    }));

    mockGuestService.getInvoices.mockReturnValue(of([
      {
        invoiceId: 'inv-loc-1',
        invoiceNumber: 'INV-LOC-001',
        reservationId: 'res-loc-1',
        reservationCode: 'RES-LOC-001',
        tenantBrandName: 'LuxeStay',
        propertyName: 'LuxeStay Đà Lạt',
        propertyType: 'Hotel',
        propertyAddress: 'Đà Lạt',
        propertyTaxCode: '0300000000',
        rentalType: 'Daily',
        checkInTime: '2026-12-01',
        checkOutTime: '2026-12-03',
        roomName: 'Deluxe',
        roomNumber: '101',
        status: 'Paid',
        subTotal: 1500000,
        surchargeTotal: 0,
        discountTotal: 0,
        pointsUsed: 0,
        pointsDiscountAmount: 0,
        pointsEarned: 0,
        pointsRefunded: 0,
        taxAmount: 120000,
        grandTotal: 1620000,
        paidAmount: 1620000,
        paymentMethod: 'VietQR',
        issuedAt: '2026-12-01',
        lineItems: []
      }
    ]));

    const fixture = TestBed.createComponent(GuestProfilePageComponent);
    const comp = fixture.componentInstance;
    users.next({ id: 'u1', fullName: 'Khách Test', email: 'test@example.com', globalRole: 'Customer', tenantId: null });
    fixture.detectChanges();

    expect(comp.getBookingStatusLabel('PendingPayment')).toBe('Chờ thanh toán');
    expect(comp.getBookingStatusLabel('Confirmed')).toBe('Đã xác nhận');
    expect(comp.getBookingStatusLabel('CheckedIn')).toBe('Đang lưu trú');
    expect(comp.getBookingStatusLabel('CheckedOut')).toBe('Đã trả phòng');
    expect(comp.getBookingStatusLabel('Cancelled')).toBe('Đã hủy');
    expect(comp.getBookingStatusLabel('NoShow')).toBe('Không đến');
    expect(comp.getBookingStatusLabel('Expired')).toBe('Hết hạn');

    expect(comp.getRentalTypeLabel('Hourly')).toBe('Theo giờ');
    expect(comp.getRentalTypeLabel('Overnight')).toBe('Qua đêm');
    expect(comp.getRentalTypeLabel('Daily')).toBe('Theo ngày');

    expect(comp.getInvoiceStatusLabel('Issued')).toBe('Đã xuất');
    expect(comp.getInvoiceStatusLabel('Paid')).toBe('Đã thanh toán');
    expect(comp.getInvoiceStatusLabel('Draft')).toBe('Nháp');
    expect(comp.getInvoiceStatusLabel('Voided')).toBe('Đã hủy');
    expect(comp.getInvoiceStatusLabel('Cancelled')).toBe('Đã hủy');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Chờ thanh toán');
    expect(element.textContent).not.toContain('PendingPayment');

    comp.selectTab('bookings');
    fixture.detectChanges();
    expect(element.textContent).toContain('Chờ thanh toán');
    expect(element.textContent).toContain('Theo ngày');
    expect(element.textContent).toContain('Đã thanh toán');
    expect(element.textContent).not.toContain('(Daily)');

    comp.openInvoicePreview(comp.invoices()[0]);
    fixture.detectChanges();
    expect(element.textContent).toContain('VietQR (Đã thanh toán)');
  });
});
