using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Reports.DTOs;

public sealed class RevenueSummaryDto
{
    public Guid TenantId { get; set; }
    public string FromDate { get; set; } = string.Empty;
    public string ToDate { get; set; } = string.Empty;
    public decimal TotalRevenue { get; set; }
    public int TotalBookings { get; set; }
    public decimal AverageBookingValue { get; set; }
    public List<PaymentMethodBreakdownDto> PaymentBreakdown { get; set; } = new();
    public List<DailyRevenuePointDto> DailySeries { get; set; } = new();
}

public sealed class PaymentMethodBreakdownDto
{
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int Count { get; set; }
}

public sealed class DailyRevenuePointDto
{
    public string Date { get; set; } = string.Empty;
    public string DisplayDate { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int BookingsCount { get; set; }
}

public sealed class PmsKpiDto
{
    public string FromDate { get; set; } = string.Empty;
    public string ToDate { get; set; } = string.Empty;
    public int TotalRooms { get; set; }
    public int TotalAvailableNights { get; set; }
    public int TotalSoldNights { get; set; }
    public double OccupancyRate { get; set; }
    public decimal AverageDailyRate { get; set; }
    public decimal RevPAR { get; set; }
    public decimal TotalRevenue { get; set; }
    public int TotalGuests { get; set; }
    public int TotalBookings { get; set; }
    public int CancelledBookings { get; set; }
    public double CancellationRate { get; set; }
}

public sealed record ReportRoomTypeItemDto(Guid Id, string Name);

public sealed record ExportedReportFileDto(byte[] Content, string ContentType, string FileName);
