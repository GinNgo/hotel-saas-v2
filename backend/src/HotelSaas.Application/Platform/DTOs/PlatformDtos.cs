using System;
using System.Collections.Generic;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Platform.DTOs;

public sealed record PlatformTenantBranchDto(
    Guid Id,
    string Name,
    string Code,
    string Slug,
    string City,
    PropertyStatus Status,
    bool IsPublished,
    int RoomCount,
    DateTime CreatedAtUtc
);

public sealed record PlatformTenantDto(
    Guid Id,
    string Name,
    string Code,
    string Slug,
    string City,
    string? PhoneNumber,
    string? Email,
    TenantStatus Status,
    string StatusName,
    SubscriptionTier SubscriptionTier,
    string SubscriptionTierName,
    string SubscriptionStatus,
    int ActiveBranchesCount,
    int TotalBranchesCount,
    int PublishedBranchesCount,
    int RoomCount,
    int MaxRoomsAllowed,
    int StaffCount,
    int MaxStaffAllowed,
    decimal TotalSaasPaid,
    DateTime CreatedAtUtc,
    IReadOnlyList<PlatformTenantBranchDto> Branches
);

public sealed record ToggleTenantStatusResultDto(
    Guid TenantId,
    string Name,
    TenantStatus Status,
    string StatusName,
    DateTime UpdatedAtUtc
);

public sealed record ApprovePropertyPublishResultDto(
    Guid PropertyId,
    Guid TenantId,
    string PropertyName,
    bool IsPublished,
    DateTime UpdatedAtUtc
);

public sealed record PlatformPlanBreakdownDto(
    string Code,
    string Name,
    int ActiveTenantsCount,
    decimal MonthlyPrice,
    decimal EstimatedMrr
);

public sealed record PlatformAiTenantUsageDto(
    Guid TenantId,
    string TenantName,
    long CallCount,
    long InputTokens,
    long OutputTokens
);

public sealed record PlatformOverviewDto(
    int TotalTenants,
    int ActiveTenants,
    int SuspendedTenants,
    int PendingTenants,
    int TotalBranches,
    int ActiveBranches,
    int PublishedBranches,
    int PublishPendingBranches,
    int TotalRooms,
    int TotalStaff,
    decimal MrrVnd,
    decimal ArrVnd,
    decimal TotalCollectedSaasRevenue,
    int TotalContracts,
    int ActiveContracts,
    decimal TotalCommittedContractValue,
    long TotalAiCalls,
    long SuccessfulAiCalls,
    long TotalAiInputTokens,
    long TotalAiOutputTokens,
    IReadOnlyList<PlatformPlanBreakdownDto> PlanBreakdown,
    IReadOnlyList<PlatformAiTenantUsageDto> AiUsageByTenant
);

public sealed record DashboardSummaryDto(
    Guid TenantId,
    Guid? PropertyId,
    DateOnly BusinessDate,
    int TotalRooms,
    int CleanRooms,
    int OccupiedRooms,
    int DirtyRooms,
    int CleaningRooms,
    int OutOfServiceRooms,
    double ReadyRatePercent,
    double OccupancyRatePercent,
    int TodayCheckInsCount,
    int TodayCheckOutsCount,
    int InHouseGuestsCount,
    int CheckedInCount,
    int UpcomingConfirmedCount,
    int PendingDepositsCount,
    decimal TodayRevenue,
    decimal TotalBookingRevenue,
    int TotalActiveReservations
);

public sealed class AdminPlanDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; }
    public int MaxStaff { get; set; }
    public bool HasVnPay { get; set; }
    public bool HasAdvancedReports { get; set; }
    public bool IsActive { get; set; }
    public bool IsPopular { get; set; }
    public int SortOrder { get; set; }
    public List<string> Features { get; set; } = new();
    public int ActiveTenantsCount { get; set; }
    public decimal EstimatedMonthlyRevenue { get; set; }
}
