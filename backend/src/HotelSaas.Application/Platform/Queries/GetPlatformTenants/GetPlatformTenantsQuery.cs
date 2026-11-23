using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Queries.GetPlatformTenants;

public sealed record GetPlatformTenantsQuery(
    string? Search = null,
    TenantStatus? Status = null,
    bool? OnlyPendingPublish = null
) : IRequest<IReadOnlyList<PlatformTenantDto>>;

public sealed class GetPlatformTenantsQueryHandler
    : IRequestHandler<GetPlatformTenantsQuery, IReadOnlyList<PlatformTenantDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPlatformTenantsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<PlatformTenantDto>> Handle(
        GetPlatformTenantsQuery request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền xem danh sách thuê bao.");
        }

        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var properties = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

        var rooms = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(r => new { r.TenantId, r.PropertyId, r.IsActive })
            .ToListAsync(cancellationToken);

        var staff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.IsActive)
            .Select(s => new { s.TenantId, s.UserId })
            .ToListAsync(cancellationToken);

        var subscriptions = await _context.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        List<SubscriptionPlan> plans;
        try
        {
            plans = await _context.SubscriptionPlans
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            plans = new List<SubscriptionPlan>();
        }

        List<SubscriptionPayment> paidPayments;
        try
        {
            paidPayments = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.Status == PaymentStatus.Completed)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            paidPayments = new List<SubscriptionPayment>();
        }

        var propsByTenant = properties.GroupBy(p => p.TenantId).ToDictionary(g => g.Key, g => g.ToList());
        var roomsByProperty = rooms.GroupBy(r => r.PropertyId).ToDictionary(g => g.Key, g => g.Count());
        var roomsByTenant = rooms.GroupBy(r => r.TenantId).ToDictionary(g => g.Key, g => g.Count());
        var staffByTenant = staff.GroupBy(s => s.TenantId).ToDictionary(g => g.Key, g => g.Select(x => x.UserId).Distinct().Count());
        var latestSubByTenant = subscriptions.GroupBy(s => s.TenantId).ToDictionary(g => g.Key, g => g.First());
        var paidByTenant = paidPayments.GroupBy(p => p.TenantId).ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        IEnumerable<Tenant> filtered = tenants;
        if (request.Status.HasValue)
        {
            filtered = filtered.Where(t => t.Status == request.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            filtered = filtered.Where(t =>
                t.Name.ToLowerInvariant().Contains(term) ||
                t.Code.ToLowerInvariant().Contains(term) ||
                t.Slug.ToLowerInvariant().Contains(term) ||
                t.City.ToLowerInvariant().Contains(term) ||
                (!string.IsNullOrEmpty(t.Email) && t.Email.ToLowerInvariant().Contains(term)));
        }

        var result = new List<PlatformTenantDto>();
        foreach (var t in filtered)
        {
            var tenantProps = propsByTenant.TryGetValue(t.Id, out var pList) ? pList : new List<Property>();
            if (request.OnlyPendingPublish == true &&
                !tenantProps.Any(p => p.Status == PropertyStatus.Active && !p.IsPublished))
            {
                continue;
            }

            latestSubByTenant.TryGetValue(t.Id, out var sub);
            var tier = sub?.Tier ?? t.SubscriptionTier;
            var matchedPlan = plans.FirstOrDefault(p => PlanMatchesTier(p.Code, tier));
            var (fallbackRooms, fallbackStaff, fallbackTierName) = tier switch
            {
                SubscriptionTier.Enterprise => (9999, 999, "Enterprise"),
                SubscriptionTier.Pro => (50, 10, "Pro"),
                _ => (15, 3, "Starter")
            };

            var branchDtos = tenantProps.Select(p => new PlatformTenantBranchDto(
                p.Id,
                p.Name,
                p.Code,
                p.Slug,
                p.City,
                p.Status,
                p.IsPublished,
                roomsByProperty.TryGetValue(p.Id, out var rc) ? rc : 0,
                p.CreatedAtUtc
            )).ToList();

            result.Add(new PlatformTenantDto(
                Id: t.Id,
                Name: t.Name,
                Code: t.Code,
                Slug: t.Slug,
                City: t.City,
                PhoneNumber: t.PhoneNumber,
                Email: t.Email,
                Status: t.Status,
                StatusName: t.Status.ToString(),
                SubscriptionTier: tier,
                SubscriptionTierName: matchedPlan?.Name ?? fallbackTierName,
                SubscriptionStatus: sub?.Status.ToString() ?? SubscriptionStatus.Active.ToString(),
                ActiveBranchesCount: tenantProps.Count(p => p.Status == PropertyStatus.Active),
                TotalBranchesCount: tenantProps.Count,
                PublishedBranchesCount: tenantProps.Count(p => p.Status == PropertyStatus.Active && p.IsPublished),
                RoomCount: roomsByTenant.TryGetValue(t.Id, out var totalRooms) ? totalRooms : 0,
                MaxRoomsAllowed: matchedPlan?.MaxRooms ?? fallbackRooms,
                StaffCount: staffByTenant.TryGetValue(t.Id, out var totalStaff) ? totalStaff : 0,
                MaxStaffAllowed: matchedPlan?.MaxStaff ?? fallbackStaff,
                TotalSaasPaid: paidByTenant.TryGetValue(t.Id, out var paid) ? paid : 0m,
                CreatedAtUtc: t.CreatedAtUtc,
                Branches: branchDtos
            ));
        }

        return result;
    }

    internal static bool PlanMatchesTier(string? planCode, SubscriptionTier tier)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return false;
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
