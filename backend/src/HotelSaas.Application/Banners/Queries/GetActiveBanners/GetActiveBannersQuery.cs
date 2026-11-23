using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Banners.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Banners.Queries.GetActiveBanners;

internal static class BannerMappingHelper
{
    internal static SystemBannerDto ToDto(SystemBanner b) => new(
        b.Id,
        b.Title,
        b.ImageUrl,
        b.TargetUrl,
        b.TargetPlanCode,
        b.ValidFromUtc,
        b.ValidToUtc,
        b.IsActive,
        b.CreatedAtUtc,
        b.UpdatedAtUtc
    );

    internal static bool IsSafeHttpOrRelativeUrl(string? url, bool allowRelative)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return true;
        }

        var trimmed = url.Trim();
        if (trimmed.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("vbscript:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (allowRelative && trimmed.StartsWith("/", StringComparison.Ordinal) && !trimmed.StartsWith("//", StringComparison.Ordinal))
        {
            return true;
        }

        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}

public sealed record GetActiveBannersQuery(string? PlanCode = null)
    : IRequest<IReadOnlyList<SystemBannerDto>>;

public sealed class GetActiveBannersQueryHandler
    : IRequestHandler<GetActiveBannersQuery, IReadOnlyList<SystemBannerDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetActiveBannersQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SystemBannerDto>> Handle(
        GetActiveBannersQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var activeBanners = await _context.SystemBanners
            .AsNoTracking()
            .Where(b => b.IsActive &&
                        (!b.ValidFromUtc.HasValue || b.ValidFromUtc.Value <= now) &&
                        (!b.ValidToUtc.HasValue || b.ValidToUtc.Value >= now))
            .OrderByDescending(b => b.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var targetPlanCode = request.PlanCode?.Trim();
        if (string.IsNullOrWhiteSpace(targetPlanCode) &&
            _currentUser.IsAuthenticated &&
            _currentUser.TenantId.HasValue &&
            _currentUser.TenantId.Value != Guid.Empty)
        {
            var tier = await _context.Subscriptions
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(s => s.TenantId == _currentUser.TenantId.Value)
                .OrderByDescending(s => s.CreatedAtUtc)
                .Select(s => (SubscriptionTier?)s.Tier)
                .FirstOrDefaultAsync(cancellationToken);

            if (tier.HasValue)
            {
                targetPlanCode = tier.Value switch
                {
                    SubscriptionTier.Basic => "STARTER",
                    SubscriptionTier.Pro => "PRO",
                    SubscriptionTier.Enterprise => "ENTERPRISE",
                    _ => tier.Value.ToString().ToUpperInvariant()
                };
            }
        }

        var filtered = activeBanners.Where(b =>
            string.IsNullOrWhiteSpace(b.TargetPlanCode) ||
            (!string.IsNullOrWhiteSpace(targetPlanCode) &&
             b.TargetPlanCode.Trim().Equals(targetPlanCode, StringComparison.OrdinalIgnoreCase)));

        return filtered.Select(BannerMappingHelper.ToDto).ToList();
    }
}
