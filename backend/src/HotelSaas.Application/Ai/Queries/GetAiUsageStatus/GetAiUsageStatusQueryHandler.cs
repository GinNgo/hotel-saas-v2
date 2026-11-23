using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Ai.Queries.GetAiUsageStatus;

public sealed class GetAiUsageStatusQueryHandler : IRequestHandler<GetAiUsageStatusQuery, AiUsageStatusDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAiUsageStatusQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AiUsageStatusDto> Handle(GetAiUsageStatusQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId == Guid.Empty)
        {
            throw new BadRequestException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh khách sạn hợp lệ.");
        }

        var sub = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var tier = sub?.Tier ?? SubscriptionTier.Basic;
        var monthlyQuota = tier switch
        {
            SubscriptionTier.Enterprise => 99999,
            SubscriptionTier.Pro => 200,
            _ => 20
        };

        var now = DateTime.UtcNow;
        var periodStart = sub != null && sub.CurrentPeriodStartUtc != default && sub.CurrentPeriodStartUtc <= now
            ? sub.CurrentPeriodStartUtc
            : new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        int usedCount = 0;
        try
        {
            usedCount = await _context.AiUsageLogs
                .AsNoTracking()
                .CountAsync(l => l.TenantId == tenantId.Value && l.CreatedAtUtc >= periodStart, cancellationToken);
        }
        catch (NotImplementedException)
        {
            usedCount = 0;
        }

        return new AiUsageStatusDto
        {
            TierName = tier.ToString(),
            MonthlyQuota = monthlyQuota,
            UsedCount = usedCount,
            RemainingCount = Math.Max(0, monthlyQuota - usedCount),
            IsLimitReached = usedCount >= monthlyQuota
        };
    }
}
