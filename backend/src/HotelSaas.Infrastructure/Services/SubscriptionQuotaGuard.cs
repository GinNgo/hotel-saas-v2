using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Enforces tenant SaaS subscription quotas against database <see cref="SubscriptionPlans"/>
/// configuration (with deterministic fallback limits per tier when plan records are absent).
/// </summary>
public sealed class SubscriptionQuotaGuard : ISubscriptionQuotaGuard
{
    private readonly IApplicationDbContext _context;

    public SubscriptionQuotaGuard(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task EnsureCanCreatePropertyAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var (_, maxProperties, _, _, planName) = await ResolveQuotaAsync(tenantId, cancellationToken);
        var currentCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == tenantId, cancellationToken);

        if (currentCount >= maxProperties)
        {
            throw new ForbiddenException(
                "ERR_QUOTA_EXCEEDED",
                $"Gói {planName} hiện tại cho phép tối đa {maxProperties} chi nhánh (đang sử dụng {currentCount}/{maxProperties}). Vui lòng nâng cấp gói SaaS để tạo thêm.");
        }
    }

    public async Task EnsureCanCreateRoomAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var (maxRooms, _, _, _, planName) = await ResolveQuotaAsync(tenantId, cancellationToken);
        var currentCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == tenantId, cancellationToken);

        if (currentCount >= maxRooms)
        {
            throw new ForbiddenException(
                "ERR_QUOTA_EXCEEDED",
                $"Gói {planName} hiện tại cho phép tối đa {maxRooms} phòng (đang sử dụng {currentCount}/{maxRooms}). Vui lòng nâng cấp gói SaaS để tạo thêm.");
        }
    }

    public async Task EnsureCanCreateStaffAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var (_, _, maxStaff, _, planName) = await ResolveQuotaAsync(tenantId, cancellationToken);
        var currentDistinctStaff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.IsActive)
            .Select(s => s.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        if (currentDistinctStaff >= maxStaff)
        {
            throw new ForbiddenException(
                "ERR_QUOTA_EXCEEDED",
                $"Gói {planName} hiện tại cho phép tối đa {maxStaff} nhân viên hoạt động (đang sử dụng {currentDistinctStaff}/{maxStaff}). Vui lòng nâng cấp gói SaaS để mời thêm nhân sự.");
        }
    }

    private async Task<(int MaxRooms, int MaxProperties, int MaxStaff, SubscriptionTier Tier, string PlanName)> ResolveQuotaAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        Subscription? activeSub = null;
        try
        {
            activeSub = await _context.Subscriptions
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(s => s.TenantId == tenantId &&
                            (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial))
                .OrderByDescending(s => s.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            return (15, 1, 3, SubscriptionTier.Basic, "Khởi Nghiệp (Starter)");
        }

        var tier = activeSub?.Tier ?? SubscriptionTier.Basic;

        SubscriptionPlan? matchedPlan = null;
        try
        {
            var plans = await _context.SubscriptionPlans
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            matchedPlan = plans.FirstOrDefault(p => PlanMatchesTier(p.Code, tier));
        }
        catch (NotImplementedException)
        {
            matchedPlan = null;
        }

        if (matchedPlan != null)
        {
            return (
                Math.Max(1, matchedPlan.MaxRooms),
                Math.Max(1, matchedPlan.MaxProperties),
                Math.Max(1, matchedPlan.MaxStaff),
                tier,
                matchedPlan.Name);
        }

        return tier switch
        {
            SubscriptionTier.Enterprise => (9999, 999, 999, SubscriptionTier.Enterprise, "Doanh Nghiệp (Enterprise)"),
            SubscriptionTier.Pro => (50, 3, 10, SubscriptionTier.Pro, "Chuyên Nghiệp (Pro)"),
            _ => (15, 1, 3, SubscriptionTier.Basic, "Khởi Nghiệp (Starter)")
        };
    }

    internal static bool PlanMatchesTier(string? planCode, SubscriptionTier tier)
    {
        if (string.IsNullOrWhiteSpace(planCode))
        {
            return false;
        }

        var code = planCode.Trim().ToUpperInvariant();
        return tier switch
        {
            SubscriptionTier.Basic => code is "STARTER" or "BASIC",
            SubscriptionTier.Pro => code == "PRO",
            SubscriptionTier.Enterprise => code is "ENTERPRISE" or "ENT",
            _ => string.Equals(code, tier.ToString(), StringComparison.OrdinalIgnoreCase)
        };
    }
}
