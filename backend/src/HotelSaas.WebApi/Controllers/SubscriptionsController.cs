using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages tenant SaaS subscription plans, usage quotas, and tier upgrades.
/// </summary>
[ApiController]
[Route("api/subscriptions")]
[Produces("application/json")]
[Authorize]
public sealed class SubscriptionsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public SubscriptionsController(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    /// <summary>
    /// Retrieves the current tenant's active subscription status, limits, and resource utilization.
    /// </summary>
    [HttpGet("current")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrentSubscription(CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Yêu cầu ngữ cảnh khách sạn / doanh nghiệp hợp lệ." });
        }

        var subscription = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var currentRoomCount = await _context.Rooms
            .AsNoTracking()
            .CountAsync(r => r.TenantId == tenantId.Value, cancellationToken);

        var currentPropertyCount = await _context.Properties
            .AsNoTracking()
            .CountAsync(p => p.TenantId == tenantId.Value, cancellationToken);

        var tier = subscription?.Tier ?? SubscriptionTier.Basic;
        var (maxRooms, maxProperties, tierName, features) = GetTierMetadata(tier);

        var result = new TenantSubscriptionDto
        {
            SubscriptionId = subscription?.Id ?? Guid.Empty,
            TenantId = tenantId.Value,
            Tier = (int)tier,
            TierName = tierName,
            Status = subscription?.Status.ToString() ?? "Active",
            PricePerCycle = subscription?.PricePerCycle ?? GetDefaultPriceForTier(tier),
            Currency = subscription?.Currency ?? "VND",
            CurrentPeriodStartUtc = subscription?.CurrentPeriodStartUtc ?? DateTime.UtcNow.AddDays(-30),
            CurrentPeriodEndUtc = subscription?.CurrentPeriodEndUtc ?? DateTime.UtcNow.AddDays(30),
            AutoRenew = subscription?.AutoRenew ?? true,
            CurrentRoomCount = currentRoomCount,
            MaxRoomsAllowed = maxRooms,
            CurrentPropertyCount = currentPropertyCount,
            MaxPropertiesAllowed = maxProperties,
            RoomUsagePercentage = maxRooms > 0 ? Math.Min(100, Math.Round((double)currentRoomCount / maxRooms * 100, 1)) : 0,
            Features = features,
            IsNearQuota = maxRooms > 0 && currentRoomCount >= (maxRooms * 0.8)
        };

        return Ok(result);
    }

    /// <summary>
    /// Returns the catalog of standard SaaS subscription packages.
    /// </summary>
    [HttpGet("plans")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<SubscriptionPackageDto>), StatusCodes.Status200OK)]
    public IActionResult GetAvailablePlans()
    {
        var plans = new List<SubscriptionPackageDto>
        {
            new()
            {
                Tier = (int)SubscriptionTier.Basic,
                Name = "Gói Khởi Nghiệp (Starter)",
                Description = "Lý tưởng cho nhà nghỉ, khách sạn độc lập quy mô nhỏ vừa bắt đầu chuyển đổi số.",
                MonthlyPrice = 290000,
                AnnualPrice = 2900000,
                MaxRooms = 15,
                MaxProperties = 1,
                MaxStaff = 3,
                Badge = "Tiết kiệm",
                IsPopular = false,
                Features = new List<string>
                {
                    "Quản lý tối đa 15 phòng",
                    "1 cơ sở độc lập",
                    "3 tài khoản nhân viên",
                    "Cổng đặt phòng theo Giờ & Đêm",
                    "Báo cáo sổ cái thu ngân cơ bản",
                    "Hỗ trợ qua email trong 24h"
                }
            },
            new()
            {
                Tier = (int)SubscriptionTier.Pro,
                Name = "Gói Chuyên Nghiệp (Pro)",
                Description = "Lựa chọn hàng đầu cho khách sạn boutique, chuỗi 2-3 chi nhánh cần tối ưu doanh thu.",
                MonthlyPrice = 690000,
                AnnualPrice = 6900000,
                MaxRooms = 50,
                MaxProperties = 3,
                MaxStaff = 10,
                Badge = "Phổ biến nhất",
                IsPopular = true,
                Features = new List<string>
                {
                    "Quản lý tối đa 50 phòng",
                    "Mở rộng tối đa 3 chi nhánh",
                    "10 tài khoản nhân viên phân quyền",
                    "Báo cáo tài chính chuyên sâu (ADR, RevPAR)",
                    "Xuất báo cáo Excel / CSV kế toán",
                    "Tích hợp Gemini AI Concierge 200 lượt/tháng",
                    "Hỗ trợ hotline ưu tiên 24/7"
                }
            },
            new()
            {
                Tier = (int)SubscriptionTier.Enterprise,
                Name = "Gói Doanh Nghiệp (Enterprise)",
                Description = "Giải pháp toàn diện cho chuỗi khách sạn lớn, resort cao cấp và tập đoàn quản trị lưu trú.",
                MonthlyPrice = 1490000,
                AnnualPrice = 14900000,
                MaxRooms = 9999,
                MaxProperties = 999,
                MaxStaff = 999,
                Badge = "Toàn diện",
                IsPopular = false,
                Features = new List<string>
                {
                    "Không giới hạn số lượng phòng",
                    "Không giới hạn số lượng chi nhánh",
                    "Không giới hạn tài khoản nhân viên",
                    "Toàn quyền quản trị đa cơ sở",
                    "Trợ lý ảo Gemini AI không giới hạn",
                    "Báo cáo & Phân tích động AI Smart Pricing",
                    "Chuyên viên kỹ thuật tận nơi & SLA 99.9%"
                }
            }
        };

        return Ok(plans);
    }

    /// <summary>
    /// Upgrades or modifies the tenant's current subscription tier.
    /// </summary>
    [HttpPost("upgrade")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpgradeSubscription([FromBody] UpgradeSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Yêu cầu ngữ cảnh khách sạn hợp lệ." });
        }

        if (!Enum.IsDefined(typeof(SubscriptionTier), request.TargetTier))
        {
            return BadRequest(new { code = "ERR_INVALID_TIER", message = "Gói cước nâng cấp không hợp lệ." });
        }

        var targetTier = (SubscriptionTier)request.TargetTier;

        var subscription = await _context.Subscriptions
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription == null)
        {
            subscription = new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                Tier = targetTier,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = GetDefaultPriceForTier(targetTier),
                Currency = "VND",
                CurrentPeriodStartUtc = DateTime.UtcNow,
                CurrentPeriodEndUtc = DateTime.UtcNow.AddMonths(1),
                AutoRenew = true,
                CreatedAtUtc = DateTime.UtcNow
            };
            _context.Subscriptions.Add(subscription);
        }
        else
        {
            subscription.Tier = targetTier;
            subscription.Status = SubscriptionStatus.Active;
            subscription.PricePerCycle = GetDefaultPriceForTier(targetTier);
            subscription.CurrentPeriodStartUtc = DateTime.UtcNow;
            subscription.CurrentPeriodEndUtc = DateTime.UtcNow.AddMonths(1);
            subscription.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await GetCurrentSubscription(cancellationToken);
    }

    private static (int maxRooms, int maxProperties, string tierName, List<string> features) GetTierMetadata(SubscriptionTier tier) => tier switch
    {
        SubscriptionTier.Pro => (50, 3, "Gói Chuyên Nghiệp (Pro)", new List<string>
        {
            "Tối đa 50 phòng", "3 chi nhánh", "Báo cáo ADR/RevPAR", "Xuất Excel", "Gemini AI Concierge"
        }),
        SubscriptionTier.Enterprise => (9999, 999, "Gói Doanh Nghiệp (Enterprise)", new List<string>
        {
            "Không giới hạn phòng", "Không giới hạn chi nhánh", "Full AI Suite", "SLA 99.9%"
        }),
        _ => (15, 1, "Gói Khởi Nghiệp (Starter)", new List<string>
        {
            "Tối đa 15 phòng", "1 chi nhánh", "Đặt phòng Giờ/Đêm", "Thu ngân cơ bản"
        })
    };

    private static decimal GetDefaultPriceForTier(SubscriptionTier tier) => tier switch
    {
        SubscriptionTier.Pro => 690000m,
        SubscriptionTier.Enterprise => 1490000m,
        _ => 290000m
    };
}

public sealed class TenantSubscriptionDto
{
    public Guid SubscriptionId { get; set; }
    public Guid TenantId { get; set; }
    public int Tier { get; set; }
    public string TierName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PricePerCycle { get; set; }
    public string Currency { get; set; } = "VND";
    public DateTime CurrentPeriodStartUtc { get; set; }
    public DateTime CurrentPeriodEndUtc { get; set; }
    public bool AutoRenew { get; set; }
    public int CurrentRoomCount { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public int CurrentPropertyCount { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public double RoomUsagePercentage { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsNearQuota { get; set; }
}

public sealed class SubscriptionPackageDto
{
    public int Tier { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal AnnualPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; }
    public int MaxStaff { get; set; }
    public string Badge { get; set; } = string.Empty;
    public bool IsPopular { get; set; }
    public List<string> Features { get; set; } = new();
}

public sealed class UpgradeSubscriptionRequest
{
    public int TargetTier { get; set; }
}
