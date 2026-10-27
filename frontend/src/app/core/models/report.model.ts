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

export interface GroupAnalyticsDto {
  tenantId: string;
  fromDate: string;
  toDate: string;
  totalProperties: number;
  totalRooms: number;
  totalAvailableNights: number;
  totalSoldNights: number;
  totalRevenue: number;
  averageOccupancyRate: number;
  portfolioAdr: number;
  portfolioRevPar: number;
  totalBookings: number;
  totalGuests: number;
  cancelledBookings: number;
  cancellationRate: number;
  properties: PropertyPerformanceDto[];
  dailyTrends: GroupDailyRevenueDto[];
  channelDistribution: GroupChannelDistributionDto[];
  paymentDistribution: GroupPaymentDistributionDto[];
}

export interface PropertyPerformanceDto {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  city: string;
  starRating: number;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  totalSoldNights: number;
  revenue: number;
  occupancyRate: number;
  adr: number;
  revPar: number;
  bookingsCount: number;
  revenueContributionPercent: number;
  performanceRank: string;
  performanceBadge: string;
}

export interface GroupDailyRevenueDto {
  date: string;
  displayDate: string;
  totalRevenue: number;
  revenueByProperty: Record<string, number>;
}

export interface GroupChannelDistributionDto {
  channel: string;
  bookingsCount: number;
  revenue: number;
  percentage: number;
}

export interface GroupPaymentDistributionDto {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}
