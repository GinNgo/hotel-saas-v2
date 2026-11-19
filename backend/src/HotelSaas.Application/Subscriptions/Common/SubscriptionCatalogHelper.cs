using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.Queries.GetPlatformTenants;
using HotelSaas.Application.Subscriptions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Subscriptions.Common;

internal static class SubscriptionCatalogHelper
{
    internal static List<SubscriptionPlanCatalogDto> BuildFallbackCatalog() => new()
    {
        new SubscriptionPlanCatalogDto
        {
            Tier = (int)SubscriptionTier.Basic,
            PlanCode = "STARTER",
            Name = "Gói Khởi Nghiệp (Starter)",
            Description = "Lý tưởng cho nhà nghỉ, khách sạn độc lập quy mô nhỏ vừa bắt đầu chuyển đổi số.",
            MonthlyPrice = 299000m,
            AnnualPrice = 2990000m,
            MaxRooms = 15,
            MaxProperties = 1,
            MaxStaff = 3,
            HasVnPay = false,
            HasAdvancedReports = false,
            Badge = "Tiết kiệm",
            IsPopular = false,
            Features = new List<string>
            {
                "Quản lý tối đa 15 phòng",
                "1 cơ sở độc lập",
                "3 tài khoản nhân viên",
                "Đặt phòng theo Giờ & Đêm",
                "Báo cáo sổ cái thu ngân cơ bản"
            }
        },
        new SubscriptionPlanCatalogDto
        {
            Tier = (int)SubscriptionTier.Pro,
            PlanCode = "PRO",
            Name = "Gói Chuyên Nghiệp (Pro)",
            Description = "Lựa chọn hàng đầu cho khách sạn boutique, chuỗi 2-3 chi nhánh cần tối ưu doanh thu.",
            MonthlyPrice = 699000m,
            AnnualPrice = 6990000m,
            MaxRooms = 50,
            MaxProperties = 3,
            MaxStaff = 10,
            HasVnPay = true,
            HasAdvancedReports = true,
            Badge = "Phổ biến nhất",
            IsPopular = true,
            Features = new List<string>
            {
                "Quản lý tối đa 50 phòng",
                "Mở rộng tối đa 3 chi nhánh",
                "10 tài khoản nhân viên phân quyền",
                "Báo cáo tài chính chuyên sâu (ADR, RevPAR)",
                "Thanh toán VNPay & Gemini AI Concierge"
            }
        },
        new SubscriptionPlanCatalogDto
        {
            Tier = (int)SubscriptionTier.Enterprise,
            PlanCode = "ENTERPRISE",
            Name = "Gói Doanh Nghiệp (Enterprise)",
            Description = "Giải pháp toàn diện cho chuỗi khách sạn lớn, resort cao cấp và tập đoàn quản trị lưu trú.",
            MonthlyPrice = 1499000m,
            AnnualPrice = 14990000m,
            MaxRooms = 9999,
            MaxProperties = 50,
            MaxStaff = 100,
            HasVnPay = true,
            HasAdvancedReports = true,
            Badge = "Toàn diện",
            IsPopular = false,
            Features = new List<string>
            {
                "Không giới hạn quy mô phòng & chuỗi chi nhánh",
                "Phân quyền đa cơ sở & kiểm toán tập trung",
                "Toàn quyền AI Smart Pricing & Concierge",
                "Hỗ trợ kỹ thuật ưu tiên SLA 99.9%"
            }
        }
    };

    internal static async Task<List<SubscriptionPlanCatalogDto>> LoadCatalogAsync(
        IApplicationDbContext context,
        bool activeOnly,
        CancellationToken cancellationToken)
    {
        List<SubscriptionPlan> dbPlans;
        try
        {
            var query = context.SubscriptionPlans.AsNoTracking();
            if (activeOnly)
            {
                query = query.Where(p => p.IsActive);
            }

            dbPlans = await query
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.MonthlyPrice)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            dbPlans = new List<SubscriptionPlan>();
        }

        if (dbPlans.Count == 0)
        {
            return BuildFallbackCatalog();
        }

        var result = new List<SubscriptionPlanCatalogDto>(dbPlans.Count);
        foreach (var p in dbPlans)
        {
            var mappedTier = MapPlanCodeToTier(p.Code, p.SortOrder);
            var features = ParseFeatures(p.FeaturesJson);
            var badge = p.IsPopular
                ? "Phổ biến nhất"
                : mappedTier == SubscriptionTier.Enterprise
                    ? "Toàn diện"
                    : "Tiêu chuẩn";

            result.Add(new SubscriptionPlanCatalogDto
            {
                Tier = (int)mappedTier,
                PlanCode = p.Code,
                Name = p.Name,
                Description = p.Description ?? string.Empty,
                MonthlyPrice = p.MonthlyPrice,
                AnnualPrice = p.YearlyPrice > 0m ? p.YearlyPrice : p.MonthlyPrice * 10m,
                MaxRooms = p.MaxRooms,
                MaxProperties = Math.Max(1, p.MaxProperties),
                MaxStaff = Math.Max(1, p.MaxStaff),
                HasVnPay = p.HasVnPay,
                HasAdvancedReports = p.HasAdvancedReports,
                Badge = badge,
                IsPopular = p.IsPopular,
                Features = features
            });
        }

        return result;
    }

    internal static SubscriptionPlanCatalogDto ResolvePlanForTier(
        IReadOnlyList<SubscriptionPlanCatalogDto> catalog,
        SubscriptionTier tier)
    {
        var byCode = catalog.FirstOrDefault(p =>
            GetPlatformTenantsQueryHandler.PlanMatchesTier(p.PlanCode, tier));
        if (byCode != null) return byCode;

        var byTierInt = catalog.FirstOrDefault(p => p.Tier == (int)tier);
        if (byTierInt != null) return byTierInt;

        return BuildFallbackCatalog().First(p => p.Tier == (int)tier);
    }

    internal static SubscriptionTier MapPlanCodeToTier(string? planCode, int sortOrder = 1)
    {
        var code = planCode?.Trim().ToUpperInvariant() ?? string.Empty;
        return code switch
        {
            "STARTER" or "BASIC" => SubscriptionTier.Basic,
            "PRO" or "PROFESSIONAL" => SubscriptionTier.Pro,
            "ENTERPRISE" or "ENT" => SubscriptionTier.Enterprise,
            _ => sortOrder >= 3
                ? SubscriptionTier.Enterprise
                : sortOrder == 2
                    ? SubscriptionTier.Pro
                    : SubscriptionTier.Basic
        };
    }

    internal static List<string> ParseFeatures(string? featuresJson)
    {
        if (string.IsNullOrWhiteSpace(featuresJson))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(featuresJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    internal static (SubscriptionTier? Tier, BillingCycle? Cycle) ParseUpgradeMetadata(string? transactionRef, string? invoiceNumber)
    {
        if (!string.IsNullOrWhiteSpace(transactionRef) &&
            transactionRef.StartsWith("SUB_", StringComparison.OrdinalIgnoreCase))
        {
            var parts = transactionRef.Split('_', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 3 &&
                int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var tierVal) &&
                Enum.IsDefined(typeof(SubscriptionTier), tierVal) &&
                int.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var cycleVal) &&
                Enum.IsDefined(typeof(BillingCycle), cycleVal))
            {
                return ((SubscriptionTier)tierVal, (BillingCycle)cycleVal);
            }
        }

        if (!string.IsNullOrWhiteSpace(invoiceNumber) &&
            invoiceNumber.StartsWith("INV-SUB-", StringComparison.OrdinalIgnoreCase))
        {
            var parts = invoiceNumber.Split('-', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 5 &&
                int.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out var tierVal) &&
                Enum.IsDefined(typeof(SubscriptionTier), tierVal) &&
                int.TryParse(parts[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out var cycleVal) &&
                Enum.IsDefined(typeof(BillingCycle), cycleVal))
            {
                return ((SubscriptionTier)tierVal, (BillingCycle)cycleVal);
            }
        }

        return (null, null);
    }

    internal static SubscriptionPaymentHistoryDto MapPaymentDto(SubscriptionPayment p)
    {
        var (tier, cycle) = ParseUpgradeMetadata(p.TransactionRef, p.InvoiceNumber);
        return new SubscriptionPaymentHistoryDto
        {
            Id = p.Id,
            Amount = p.Amount,
            Method = p.Method.ToString(),
            Status = p.Status.ToString(),
            TransactionRef = p.TransactionRef,
            InvoiceNumber = p.InvoiceNumber,
            PaidAtUtc = p.PaidAtUtc,
            CreatedAtUtc = p.CreatedAtUtc,
            TargetTier = tier.HasValue ? (int)tier.Value : null,
            BillingCycle = cycle?.ToString()
        };
    }
}
