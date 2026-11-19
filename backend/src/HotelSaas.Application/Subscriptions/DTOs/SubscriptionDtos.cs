using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Subscriptions.DTOs;

public sealed class SubscriptionPaymentHistoryDto
{
    public Guid Id { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? TransactionRef { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int? TargetTier { get; set; }
    public string? BillingCycle { get; set; }
}

public sealed class TenantSubscriptionCurrentDto
{
    public Guid SubscriptionId { get; set; }
    public Guid TenantId { get; set; }
    public int Tier { get; set; }
    public string TierName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string BillingCycle { get; set; } = "Monthly";
    public decimal PricePerCycle { get; set; }
    public string Currency { get; set; } = "VND";
    public DateTime CurrentPeriodStartUtc { get; set; }
    public DateTime CurrentPeriodEndUtc { get; set; }
    public bool AutoRenew { get; set; }
    public int CurrentRoomCount { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public int CurrentPropertyCount { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public int CurrentStaffCount { get; set; }
    public int MaxStaffAllowed { get; set; }
    public double RoomUsagePercentage { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsNearQuota { get; set; }
    public SubscriptionPaymentHistoryDto? PendingPayment { get; set; }
    public List<SubscriptionPaymentHistoryDto> RecentPayments { get; set; } = new();
}

public sealed class SubscriptionPlanCatalogDto
{
    public int Tier { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal AnnualPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; }
    public int MaxStaff { get; set; }
    public bool HasVnPay { get; set; }
    public bool HasAdvancedReports { get; set; }
    public string Badge { get; set; } = string.Empty;
    public bool IsPopular { get; set; }
    public List<string> Features { get; set; } = new();
}

public sealed record SubscriptionUpgradeInitiationDto(
    Guid PaymentId,
    Guid SubscriptionId,
    Guid TenantId,
    int TargetTier,
    string TargetTierName,
    string BillingCycle,
    decimal Amount,
    string Currency,
    string PaymentStatus,
    string TransactionRef,
    string InvoiceNumber,
    string? PaymentUrl,
    bool IsImmediateActivation,
    string Message
);

public sealed record ConfirmSubscriptionPaymentResultDto(
    Guid PaymentId,
    Guid SubscriptionId,
    Guid TenantId,
    string PaymentStatus,
    bool AlreadyConfirmed,
    string TransactionRef,
    int NewTier,
    string NewTierName,
    string BillingCycle,
    DateTime CurrentPeriodStartUtc,
    DateTime CurrentPeriodEndUtc,
    string Message
);
