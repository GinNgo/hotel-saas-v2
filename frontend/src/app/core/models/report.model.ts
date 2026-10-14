export interface RevenueSummaryDto {
  tenantId: string;
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalBookings: number;
  averageBookingValue: number;
  paymentBreakdown: PaymentMethodBreakdownDto[];
  dailySeries: DailyRevenuePointDto[];
}

export interface PaymentMethodBreakdownDto {
  method: string;
  amount: number;
  count: number;
}

export interface DailyRevenuePointDto {
  date: string;
  displayDate: string;
  revenue: number;
  bookingsCount: number;
}

export interface PmsKpiDto {
  fromDate: string;
  toDate: string;
  totalRooms: number;
  totalAvailableNights: number;
  totalSoldNights: number;
  occupancyRate: number;
  averageDailyRate: number;
  revPAR: number;
  totalRevenue: number;
  totalGuests: number;
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
}
