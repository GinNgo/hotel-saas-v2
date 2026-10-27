using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Reports.Queries.GetGroupAnalytics;

/// <summary>
/// DTO tổng hợp toàn bộ chỉ số hiệu suất kinh doanh chuỗi khách sạn (Multi-Property Portfolio Group).
/// </summary>
public sealed class GroupAnalyticsDto
{
    public Guid TenantId { get; set; }
    public string FromDate { get; set; } = string.Empty;
    public string ToDate { get; set; } = string.Empty;

    // --- Chỉ số quy mô và hiệu suất tổng hợp chuỗi (Group Executive KPIs) ---
    public int TotalProperties { get; set; }
    public int TotalRooms { get; set; }
    public int TotalAvailableNights { get; set; }
    public int TotalSoldNights { get; set; }
    public decimal TotalRevenue { get; set; }
    public double AverageOccupancyRate { get; set; }
    public decimal PortfolioAdr { get; set; }
    public decimal PortfolioRevPar { get; set; }
    public int TotalBookings { get; set; }
    public int TotalGuests { get; set; }
    public int CancelledBookings { get; set; }
    public double CancellationRate { get; set; }

    // --- Ma trận so sánh hiệu suất từng cơ sở / chi nhánh ---
    public List<PropertyPerformanceDto> Properties { get; set; } = new();

    // --- Dòng thời gian doanh thu đa chi nhánh (Phục vụ biểu đồ xu hướng) ---
    public List<GroupDailyRevenueDto> DailyTrends { get; set; } = new();

    // --- Phân bổ nguồn kênh đặt phòng toàn chuỗi ---
    public List<GroupChannelDistributionDto> ChannelDistribution { get; set; } = new();

    // --- Phân bổ phương thức thanh toán toàn chuỗi ---
    public List<GroupPaymentDistributionDto> PaymentDistribution { get; set; } = new();
}

/// <summary>
/// Chi tiết hiệu suất hoạt động của từng khách sạn/chi nhánh trong chuỗi.
/// </summary>
public sealed class PropertyPerformanceDto
{
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyCode { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int StarRating { get; set; }
    public int TotalRooms { get; set; }
    public int AvailableRooms { get; set; }
    public int OccupiedRooms { get; set; }
    public int TotalSoldNights { get; set; }
    public decimal Revenue { get; set; }
    public double OccupancyRate { get; set; }
    public decimal Adr { get; set; }
    public decimal RevPar { get; set; }
    public int BookingsCount { get; set; }
    public double RevenueContributionPercent { get; set; }
    public string PerformanceRank { get; set; } = string.Empty; // "Top Performer", "Standard", "Needs Attention"
    public string PerformanceBadge { get; set; } = string.Empty; // "Dẫn đầu doanh thu", "Công suất cao", "Đạt chuẩn", "Cần tối ưu"
}

/// <summary>
/// Điểm doanh thu theo ngày kèm chi tiết từng chi nhánh trong chuỗi.
/// </summary>
public sealed class GroupDailyRevenueDto
{
    public string Date { get; set; } = string.Empty;
    public string DisplayDate { get; set; } = string.Empty;
    public decimal TotalRevenue { get; set; }
    public Dictionary<string, decimal> RevenueByProperty { get; set; } = new();
}

/// <summary>
/// Phân bổ nguồn kênh đặt phòng.
/// </summary>
public sealed class GroupChannelDistributionDto
{
    public string Channel { get; set; } = string.Empty;
    public int BookingsCount { get; set; }
    public decimal Revenue { get; set; }
    public double Percentage { get; set; }
}

/// <summary>
/// Phân bổ phương thức thanh toán toàn chuỗi.
/// </summary>
public sealed class GroupPaymentDistributionDto
{
    public string Method { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Amount { get; set; }
    public double Percentage { get; set; }
}
