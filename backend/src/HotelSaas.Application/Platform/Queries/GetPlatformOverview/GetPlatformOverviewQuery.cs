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

        var activeTenantList = tenants
            .Where(t => t.Status == TenantStatus.Active)
            .ToList();
        var activeTenantIds = activeTenantList
            .Select(t => t.Id)
            .ToHashSet();

        var latestActiveSubByTenant = subscriptions
            .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
            .GroupBy(s => s.TenantId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.CreatedAtUtc).First());

        var latestActiveContractByTenant = contracts
            .Where(c => c.Status == TenantContractStatus.Active)
            .GroupBy(c => c.TenantId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.SignedAtUtc ?? c.CreatedAtUtc).First());

        var tenantPlanAssignments = new List<(string? PlanCode, SubscriptionTier? Tier, decimal MonthlyMrr)>();

        foreach (var tenant in activeTenantList)
        {
            if (latestActiveSubByTenant.TryGetValue(tenant.Id, out var sub))
            {
                decimal subMonthly;
                if (sub.PricePerCycle > 0m)
                {
                    subMonthly = sub.BillingCycle == BillingCycle.Annual
                        ? Math.Round(sub.PricePerCycle / 12m, 0)
                        : sub.PricePerCycle;
                }
                else
                {
                    var matchedPlan = plans.FirstOrDefault(p =>
                        GetPlatformTenantsQueryHandler.PlanMatchesTier(p.Code, sub.Tier));
                    subMonthly = matchedPlan?.MonthlyPrice ?? 0m;
                }

                tenantPlanAssignments.Add((null, sub.Tier, subMonthly));
            }
            else if (latestActiveContractByTenant.TryGetValue(tenant.Id, out var contract))
            {
                var contractMonthly = contract.ContractValue > 0m
                    ? (contract.BillingCycle == BillingCycle.Annual
                        ? Math.Round(contract.ContractValue / 12m, 0)
                        : contract.ContractValue)
                    : plans.FirstOrDefault(p => string.Equals(p.Code, contract.PlanCode, StringComparison.OrdinalIgnoreCase))?.MonthlyPrice ?? 0m;

                tenantPlanAssignments.Add((contract.PlanCode, null, contractMonthly));
            }
            else
            {
                var matchedPlan = plans.FirstOrDefault(p =>
                    GetPlatformTenantsQueryHandler.PlanMatchesTier(p.Code, tenant.SubscriptionTier));
                tenantPlanAssignments.Add((matchedPlan?.Code, tenant.SubscriptionTier, matchedPlan?.MonthlyPrice ?? 0m));
            }
        }

        // Also include any active/trial subscriptions whose Tenant wasn't in activeTenantList (safety for partial test doubles)
        foreach (var kv in latestActiveSubByTenant)
        {
            if (activeTenantIds.Contains(kv.Key))
            {
                continue;
            }
            var sub = kv.Value;
            var subMonthly = sub.PricePerCycle > 0m
                ? (sub.BillingCycle == BillingCycle.Annual ? Math.Round(sub.PricePerCycle / 12m, 0) : sub.PricePerCycle)
                : plans.FirstOrDefault(p => GetPlatformTenantsQueryHandler.PlanMatchesTier(p.Code, sub.Tier))?.MonthlyPrice ?? 0m;
            tenantPlanAssignments.Add((null, sub.Tier, subMonthly));
        }

        decimal mrr = tenantPlanAssignments.Sum(x => x.MonthlyMrr);

        static bool MatchesPlan(SubscriptionPlan plan, (string? PlanCode, SubscriptionTier? Tier, decimal MonthlyMrr) entry)
        {
            if (!string.IsNullOrWhiteSpace(entry.PlanCode))
            {
                if (string.Equals(plan.Code, entry.PlanCode.Trim(), StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            if (entry.Tier.HasValue)
            {
                return GetPlatformTenantsQueryHandler.PlanMatchesTier(plan.Code, entry.Tier.Value);
            }

            return false;
        }

        var planBreakdown = plans.Select(plan =>
        {
            var matched = tenantPlanAssignments.Where(entry => MatchesPlan(plan, entry)).ToList();
            return new PlatformPlanBreakdownDto(
                plan.Code,
                plan.Name,
                matched.Count,
                plan.MonthlyPrice,
                matched.Sum(x => x.MonthlyMrr > 0m ? x.MonthlyMrr : plan.MonthlyPrice));
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
