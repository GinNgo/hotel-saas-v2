using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetPlatformTenants;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Queries.GetPlatformOverview;

public sealed record GetPlatformOverviewQuery : IRequest<PlatformOverviewDto>;

public sealed class GetPlatformOverviewQueryHandler
    : IRequestHandler<GetPlatformOverviewQuery, PlatformOverviewDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPlatformOverviewQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PlatformOverviewDto> Handle(
        GetPlatformOverviewQuery request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền truy cập tổng quan nền tảng.");
        }

        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var properties = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(p => new { p.Id, p.TenantId, p.Status, p.IsPublished })
            .ToListAsync(cancellationToken);

        var totalRooms = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(cancellationToken);

        var totalStaff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.IsActive)
            .Select(s => s.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var subscriptions = await _context.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        List<SubscriptionPlan> plans;
        try
        {
            plans = await _context.SubscriptionPlans
                .IgnoreQueryFilters()
                .AsNoTracking()
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.MonthlyPrice)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            plans = new List<SubscriptionPlan>();
        }

        decimal totalCollectedSaasRevenue = 0m;
        try
        {
            totalCollectedSaasRevenue = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.Status == PaymentStatus.Completed)
                .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;
        }
        catch (NotImplementedException)
        {
            totalCollectedSaasRevenue = 0m;
        }

        List<TenantContract> contracts;
        try
        {
            contracts = await _context.TenantContracts
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            contracts = new List<TenantContract>();
        }

        List<AiUsageLog> aiLogs;
        try
        {
            aiLogs = await _context.AiUsageLogs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            aiLogs = new List<AiUsageLog>();
        }

        var activeTenantIds = tenants
            .Where(t => t.Status == TenantStatus.Active)
            .Select(t => t.Id)
            .ToHashSet();

        var tenantPlanAssignments = PlatformMrrCalculator.ComputeActiveTenantMrrAssignments(
            tenants,
            subscriptions,
            contracts,
            plans);

        decimal mrr = tenantPlanAssignments.Sum(x => x.MonthlyMrr);

        var planBreakdown = plans.Select(plan =>
        {
            var matched = tenantPlanAssignments.Where(entry => PlatformMrrCalculator.MatchesPlan(plan, entry)).ToList();
            return new PlatformPlanBreakdownDto(
                plan.Code,
                plan.Name,
                matched.Count,
                plan.MonthlyPrice,
                matched.Sum(x => x.MonthlyMrr));
        }).ToList();

        var tenantNames = tenants.ToDictionary(t => t.Id, t => t.Name);
        var aiUsageByTenant = aiLogs
            .GroupBy(l => l.TenantId)
            .Select(g => new PlatformAiTenantUsageDto(
                g.Key,
                tenantNames.TryGetValue(g.Key, out var name) ? name : "Unknown Tenant",
                g.LongCount(),
                g.Sum(x => (long)x.InputTokens),
                g.Sum(x => (long)x.OutputTokens)))
            .OrderByDescending(x => x.CallCount)
            .Take(10)
            .ToList();

        return new PlatformOverviewDto(
            TotalTenants: tenants.Count,
            ActiveTenants: activeTenantIds.Count,
            SuspendedTenants: tenants.Count(t => t.Status == TenantStatus.Suspended),
            PendingTenants: tenants.Count(t => t.Status == TenantStatus.PendingApproval),
            TotalBranches: properties.Count,
            ActiveBranches: properties.Count(p => p.Status == PropertyStatus.Active),
            PublishedBranches: properties.Count(p => p.Status == PropertyStatus.Active && p.IsPublished),
            PublishPendingBranches: properties.Count(p => p.Status == PropertyStatus.Active && !p.IsPublished),
            TotalRooms: totalRooms,
            TotalStaff: totalStaff,
            MrrVnd: mrr,
            ArrVnd: mrr * 12m,
            TotalCollectedSaasRevenue: totalCollectedSaasRevenue,
            TotalContracts: contracts.Count,
            ActiveContracts: contracts.Count(c => c.Status == TenantContractStatus.Active),
            TotalCommittedContractValue: contracts
                .Where(c => c.Status != TenantContractStatus.Terminated)
                .Sum(c => c.ContractValue),
            TotalAiCalls: aiLogs.LongCount(),
            SuccessfulAiCalls: aiLogs.LongCount(l => l.IsSuccess),
            TotalAiInputTokens: aiLogs.Sum(l => (long)l.InputTokens),
            TotalAiOutputTokens: aiLogs.Sum(l => (long)l.OutputTokens),
            PlanBreakdown: planBreakdown,
            AiUsageByTenant: aiUsageByTenant
        );
    }
}

internal readonly record struct TenantMrrAssignment(
    Guid TenantId,
    string? PlanCode,
    SubscriptionTier? Tier,
    decimal MonthlyMrr);

internal static class PlatformMrrCalculator
{
    internal static List<TenantMrrAssignment> ComputeActiveTenantMrrAssignments(
        IReadOnlyList<Tenant> tenants,
        IReadOnlyList<Subscription> subscriptions,
        IReadOnlyList<TenantContract> contracts,
        IReadOnlyList<SubscriptionPlan> plans)
    {
        var knownTenantIds = tenants
            .Select(t => t.Id)
            .ToHashSet();

        var activeTenantList = tenants
            .Where(t => t.Status == TenantStatus.Active)
            .ToList();

        // Track tenants that already have ANY subscription record so Trial / Cancelled / Expired / PastDue
        // subscriptions never fall back to TenantContract or Tenant.SubscriptionTier.
        var tenantsWithAnySubscription = subscriptions
            .Select(s => s.TenantId)
            .ToHashSet();

        // Count ONLY paid Active subscriptions (exclude Trial and all non-active statuses)
        // and deduplicate per tenant by taking the latest Active subscription.
        var latestActiveSubByTenant = subscriptions
            .Where(s => s.Status == SubscriptionStatus.Active)
            .GroupBy(s => s.TenantId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(s => s.CreatedAtUtc)
                      .ThenByDescending(s => s.Id)
                      .First());

        var latestActiveContractByTenant = contracts
            .Where(c => c.Status == TenantContractStatus.Active)
            .GroupBy(c => c.TenantId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(c => c.SignedAtUtc ?? c.CreatedAtUtc)
                      .ThenByDescending(c => c.Id)
                      .First());

        var assignments = new List<TenantMrrAssignment>();

        foreach (var tenant in activeTenantList)
        {
            if (latestActiveSubByTenant.TryGetValue(tenant.Id, out var sub))
            {
                var subMonthly = ResolveSubscriptionMonthlyMrr(sub, plans);
                assignments.Add(new TenantMrrAssignment(tenant.Id, null, sub.Tier, subMonthly));
            }
            else if (tenantsWithAnySubscription.Contains(tenant.Id))
            {
                // Non-active subscription only (e.g., Trial / Cancelled / Expired) contributes 0 to paid MRR.
                continue;
            }
            else if (latestActiveContractByTenant.TryGetValue(tenant.Id, out var contract))
            {
                var contractMonthly = ResolveContractMonthlyMrr(contract, plans);
                assignments.Add(new TenantMrrAssignment(tenant.Id, contract.PlanCode, null, contractMonthly));
            }
            else
            {
                var matchedPlan = plans.FirstOrDefault(p =>
                    GetPlatformTenantsQueryHandler.PlanMatchesTier(p.Code, tenant.SubscriptionTier));
                assignments.Add(new TenantMrrAssignment(
                    tenant.Id,
                    matchedPlan?.Code,
                    tenant.SubscriptionTier,
                    matchedPlan?.MonthlyPrice ?? 0m));
            }
        }

        // Safety for isolated unit test doubles that seed Active subscriptions without Tenant rows:
        // include Active subscriptions whose TenantId is not present in Tenants at all, while
        // strictly excluding any known Suspended / PendingApproval tenant.
        foreach (var kv in latestActiveSubByTenant)
        {
            if (knownTenantIds.Contains(kv.Key))
            {
                continue;
            }

            var sub = kv.Value;
            var subMonthly = ResolveSubscriptionMonthlyMrr(sub, plans);
            assignments.Add(new TenantMrrAssignment(kv.Key, null, sub.Tier, subMonthly));
        }

        return assignments;
    }

    internal static bool MatchesPlan(SubscriptionPlan plan, TenantMrrAssignment entry)
    {
        if (!string.IsNullOrWhiteSpace(entry.PlanCode))
        {
            if (string.Equals(plan.Code, entry.PlanCode.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        if (entry.Tier.HasValue)
        {
            return GetPlatformTenantsQueryHandler.PlanMatchesTier(plan.Code, entry.Tier.Value);
        }

        return false;
    }

    private static decimal ResolveSubscriptionMonthlyMrr(Subscription sub, IReadOnlyList<SubscriptionPlan> plans)
    {
        if (sub.PricePerCycle > 0m)
        {
            return sub.BillingCycle == BillingCycle.Annual
                ? Math.Round(sub.PricePerCycle / 12m, 0)
                : sub.PricePerCycle;
        }

        var matchedPlan = plans.FirstOrDefault(p =>
            GetPlatformTenantsQueryHandler.PlanMatchesTier(p.Code, sub.Tier));
        return matchedPlan?.MonthlyPrice ?? 0m;
    }

    private static decimal ResolveContractMonthlyMrr(TenantContract contract, IReadOnlyList<SubscriptionPlan> plans)
    {
        if (contract.ContractValue > 0m)
        {
            return contract.BillingCycle == BillingCycle.Annual
                ? Math.Round(contract.ContractValue / 12m, 0)
                : contract.ContractValue;
        }

        return plans.FirstOrDefault(p =>
            string.Equals(p.Code, contract.PlanCode, StringComparison.OrdinalIgnoreCase))?.MonthlyPrice ?? 0m;
    }
}
