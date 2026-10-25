import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsPage } from './reports.page';
import { ReportService } from '../../core/services/report.service';
import { AlertService } from '../../core/services/alert.service';
import { GroupAnalyticsDto, PmsKpiDto, RevenueSummaryDto } from '../../core/models/report.model';

describe('ReportsPage (Multi-Property Group Analytics & Branch Reports)', () => {
  let fixture: ComponentFixture<ReportsPage>;
  let component: ReportsPage;

  let mockReportService: {
    getGroupAnalytics: ReturnType<typeof vi.fn>;
    getPmsKpi: ReturnType<typeof vi.fn>;
    getRevenueSummary: ReturnType<typeof vi.fn>;
    exportCsv: ReturnType<typeof vi.fn>;
  };

  let mockAlertService: {
    toastSuccess: ReturnType<typeof vi.fn>;
    toastError: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
  };

  const sampleGroupAnalytics: GroupAnalyticsDto = {
    tenantId: 'tenant-test-123',
    fromDate: '2026-09-25',
    toDate: '2026-10-25',
    totalProperties: 2,
    totalRooms: 50,
    totalAvailableNights: 1500,
    totalSoldNights: 1100,
    totalRevenue: 880000000,
    averageOccupancyRate: 73.3,
    portfolioAdr: 800000,
    portfolioRevPar: 586667,
    totalBookings: 550,
    totalGuests: 1200,
    cancelledBookings: 20,
    cancellationRate: 3.5,
    properties: [
      {
        propertyId: 'p1',
        propertyName: 'Khách Sạn Sài Gòn Central',
        propertyCode: 'SG-CENTRAL',
        city: 'TP. Hồ Chí Minh',
        starRating: 4,
        totalRooms: 30,
        availableRooms: 8,
        occupiedRooms: 22,
        totalSoldNights: 700,
        revenue: 560000000,
        occupancyRate: 77.8,
        adr: 800000,
        revPar: 622222,
        bookingsCount: 350,
        revenueContributionPercent: 63.6,
        performanceRank: 'Top Performer',
        performanceBadge: 'Dẫn đầu doanh thu'
      },
      {
        propertyId: 'p2',
        propertyName: 'Khách Sạn Đà Lạt Riverside',
        propertyCode: 'DL-RIVER',
        city: 'Đà Lạt',
        starRating: 3,
        totalRooms: 20,
        availableRooms: 7,
        occupiedRooms: 13,
        totalSoldNights: 400,
        revenue: 320000000,
        occupancyRate: 66.7,
        adr: 800000,
        revPar: 533333,
        bookingsCount: 200,
        revenueContributionPercent: 36.4,
        performanceRank: 'Standard',
        performanceBadge: 'Đạt chuẩn'
      }
    ],
    dailyTrends: [
      {
        date: '2026-10-24',
        displayDate: '24/10',
        totalRevenue: 28000000,
        revenueByProperty: {
          'Khách Sạn Sài Gòn Central': 18000000,
          'Khách Sạn Đà Lạt Riverside': 10000000
        }
      },
      {
        date: '2026-10-25',
        displayDate: '25/10',
        totalRevenue: 32000000,
        revenueByProperty: {
          'Khách Sạn Sài Gòn Central': 20000000,
          'Khách Sạn Đà Lạt Riverside': 12000000
        }
      }
    ],
    channelDistribution: [
      { channel: 'Trực tuyến (Website B2C / Portal)', bookingsCount: 350, revenue: 560000000, percentage: 63.6 },
      { channel: 'Doanh nghiệp / Hợp đồng', bookingsCount: 120, revenue: 200000000, percentage: 22.7 },
      { channel: 'Khách vãng lai / Lễ tân Walk-In', bookingsCount: 80, revenue: 120000000, percentage: 13.6 }
    ],
    paymentDistribution: [
      { method: 'VNPay QR / Thẻ nội địa', count: 280, amount: 440000000, percentage: 50.0 },
      { method: 'Chuyển khoản (VietQR / Napas)', count: 180, amount: 308000000, percentage: 35.0 },
      { method: 'Tiền mặt tại quầy (Cash)', count: 90, amount: 132000000, percentage: 15.0 }
    ]
  };

  const samplePmsKpi: PmsKpiDto = {
    fromDate: '2026-09-25',
    toDate: '2026-10-25',
    totalRooms: 30,
    totalAvailableNights: 900,
    totalSoldNights: 700,
    occupancyRate: 77.8,
    averageDailyRate: 800000,
    revPAR: 622222,
    totalRevenue: 560000000,
    totalGuests: 750,
    totalBookings: 350,
    cancelledBookings: 12,
    cancellationRate: 3.3
  };

  const sampleRevenueSummary: RevenueSummaryDto = {
    tenantId: 'tenant-test-123',
    fromDate: '2026-09-25',
    toDate: '2026-10-25',
    totalRevenue: 560000000,
    totalBookings: 350,
    averageBookingValue: 1600000,
    paymentBreakdown: [
      { method: 'VNPay', amount: 280000000, count: 175 }
    ],
    dailySeries: [
      { date: '2026-10-25', displayDate: '25/10', revenue: 20000000, bookingsCount: 12 }
    ]
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockReportService = {
      getGroupAnalytics: vi.fn().mockReturnValue(of(sampleGroupAnalytics)),
      getPmsKpi: vi.fn().mockReturnValue(of(samplePmsKpi)),
      getRevenueSummary: vi.fn().mockReturnValue(of(sampleRevenueSummary)),
      exportCsv: vi.fn().mockReturnValue(of(new Blob(['test-csv'], { type: 'text/csv' })))
    };

    mockAlertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      error: vi.fn(),
      success: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AlertService, useValue: mockAlertService }
      ]
    });

    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
  });

  it('1. should mount with default activeTab as "group" and 30 selected days', () => {
    expect(component.activeTab()).toBe('group');
    expect(component.selectedDays()).toBe(30);
  });

  it('2. should fetch and bind group analytics on initial mount', () => {
    fixture.detectChanges();

    expect(mockReportService.getGroupAnalytics).toHaveBeenCalled();
    expect(component.groupAnalytics()).toEqual(sampleGroupAnalytics);
    expect(component.groupAnalytics()?.totalProperties).toBe(2);
    expect(component.groupAnalytics()?.totalRevenue).toBe(880000000);
  });

  it('3. should switch tabs to "branch" and load branch PMS KPIs and revenue summary', () => {
    component.switchTab('branch');

    expect(component.activeTab()).toBe('branch');
    expect(mockReportService.getPmsKpi).toHaveBeenCalled();
    expect(mockReportService.getRevenueSummary).toHaveBeenCalled();
    expect(component.kpi()).toEqual(samplePmsKpi);
    expect(component.revenueSummary()).toEqual(sampleRevenueSummary);
  });

  it('4. should recalculate date ranges on quick period change (7, 14, 30 days)', () => {
    component.selectQuickPeriod(7);
    expect(component.selectedDays()).toBe(7);
    expect(mockReportService.getGroupAnalytics).toHaveBeenCalled();

    component.selectQuickPeriod(14);
    expect(component.selectedDays()).toBe(14);
  });

  it('5. should update dates on custom date range filter change', () => {
    component.onReportDateFilterChange({
      mode: 'range',
      fromDate: '2026-10-01',
      toDate: '2026-10-20',
      startUtc: '2026-10-01T00:00:00Z',
      endExclusiveUtc: '2026-10-21T00:00:00Z'
    });

    expect(component.fromDate).toBe('2026-10-01');
    expect(component.toDate).toBe('2026-10-20');
    expect(component.selectedDays()).toBe(0);
    expect(mockReportService.getGroupAnalytics).toHaveBeenCalledWith('2026-10-01', '2026-10-20');
  });

  it('6. should calculate max group daily revenue correctly for bar visualization', () => {
    component.groupAnalytics.set(sampleGroupAnalytics);
    const maxRev = component.getMaxGroupDailyRevenue();
    expect(maxRev).toBe(32000000);
  });

  it('7. should handle graceful fallback data when getGroupAnalytics returns error', () => {
    mockReportService.getGroupAnalytics.mockReturnValue(throwError(() => new Error('Server error')));

    component.loadData();

    expect(component.groupAnalytics()).not.toBeNull();
    expect(component.groupAnalytics()?.tenantId).toBe('tenant-group');
    expect(component.isLoading()).toBe(false);
  });

  it('8. should call exportCsv and display success toast on download', () => {
    // Spy on DOM methods for file download
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    const createUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost/blob-id');
    const revokeUrlSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    component.exportCsv();

    expect(mockReportService.exportCsv).toHaveBeenCalled();
    expect(mockAlertService.toastSuccess).toHaveBeenCalledWith(
      'File CSV (UTF-8 BOM) đã được tải về máy tính, sẵn sàng mở bằng Excel.',
      'Xuất file thành công'
    );

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
  });
});
