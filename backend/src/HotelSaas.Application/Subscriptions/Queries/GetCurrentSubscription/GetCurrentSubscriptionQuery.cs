using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Subscriptions.Common;
using HotelSaas.Application.Subscriptions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Subscriptions.Queries.GetCurrentSubscription;

public sealed record GetCurrentSubscriptionQuery : IRequest<TenantSubscriptionCurrentDto>;

public sealed class GetCurrentSubscriptionQueryHandler
    : IRequestHandler<GetCurrentSubscriptionQuery, TenantSubscriptionCurrentDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetCurrentSubscriptionQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<TenantSubscriptionCurrentDto> Handle(
        GetCurrentSubscriptionQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId ?? _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh khách sạn / doanh nghiệp hợp lệ.");
        }

        var subscription = await _context.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var currentRoomCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == tenantId.Value, cancellationToken);

        var currentPropertyCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == tenantId.Value, cancellationToken);

        var currentStaffCount = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId.Value && s.IsActive)
            .Select(s => s.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        List<SubscriptionPayment> payments;
        try
        {
            payments = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId.Value)
                .OrderByDescending(p => p.CreatedAtUtc)
                .Take(10)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            payments = new List<SubscriptionPayment>();
        }

        var tier = subscription?.Tier ?? SubscriptionTier.Basic;
        var catalog = await SubscriptionCatalogHelper.LoadCatalogAsync(_context, activeOnly: false, cancellationToken);
        var plan = SubscriptionCatalogHelper.ResolvePlanForTier(catalog, tier);

        var pending = payments
            .Where(p => p.Status == PaymentStatus.Pending)
            .Select(SubscriptionCatalogHelper.MapPaymentDto)
            .FirstOrDefault();

        var recentPayments = payments
            .Select(SubscriptionCatalogHelper.MapPaymentDto)
            .ToList();

        var cycle = subscription?.BillingCycle ?? BillingCycle.Monthly;
        var price = subscription?.PricePerCycle > 0m
            ? subscription.PricePerCycle
            : (cycle == BillingCycle.Annual ? plan.AnnualPrice : plan.MonthlyPrice);

        var maxRooms = Math.Max(1, plan.MaxRooms);

        return new TenantSubscriptionCurrentDto
        {
            SubscriptionId = subscription?.Id ?? Guid.Empty,
            TenantId = tenantId.Value,
            Tier = (int)tier,
            TierName = plan.Name,
            Status = subscription?.Status.ToString() ?? SubscriptionStatus.Active.ToString(),
            BillingCycle = cycle.ToString(),
            PricePerCycle = price,
            Currency = subscription?.Currency ?? "VND",
            CurrentPeriodStartUtc = subscription?.CurrentPeriodStartUtc ?? DateTime.UtcNow.AddDays(-30),
            CurrentPeriodEndUtc = subscription?.CurrentPeriodEndUtc ?? DateTime.UtcNow.AddDays(30),
            AutoRenew = subscription?.AutoRenew ?? true,
            CurrentRoomCount = currentRoomCount,
            MaxRoomsAllowed = maxRooms,
            CurrentPropertyCount = currentPropertyCount,
            MaxPropertiesAllowed = Math.Max(1, plan.MaxProperties),
            CurrentStaffCount = currentStaffCount,
            MaxStaffAllowed = Math.Max(1, plan.MaxStaff),
            RoomUsagePercentage = Math.Min(100, Math.Round((double)currentRoomCount / maxRooms * 100, 1)),
            Features = plan.Features,
            IsNearQuota = currentRoomCount >= (maxRooms * 0.8),
            PendingPayment = pending,
            RecentPayments = recentPayments
        };
    }
}
