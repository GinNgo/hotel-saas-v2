using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guests.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guests.Queries.GetGuestDirectory;

public sealed record GetGuestDirectoryQuery : IRequest<PagedResult<GuestDirectoryItemDto>>
{
    public string? Search { get; init; }
    public string? LoyaltyTier { get; init; }
    public bool? IsVip { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed class GetGuestDirectoryQueryHandler : IRequestHandler<GetGuestDirectoryQuery, PagedResult<GuestDirectoryItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public GetGuestDirectoryQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<PagedResult<GuestDirectoryItemDto>> Handle(
        GetGuestDirectoryQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            return new PagedResult<GuestDirectoryItemDto>(Array.Empty<GuestDirectoryItemDto>(), 0, request.Page, request.PageSize);
        }

        // Aggregate guest data from Reservations in this tenant
        var reservationsQuery = _context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId.Value && !string.IsNullOrWhiteSpace(r.GuestPhone));

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            reservationsQuery = reservationsQuery.Where(r =>
                r.GuestName.ToLower().Contains(search) ||
                r.GuestPhone!.Contains(search) ||
                (r.GuestEmail != null && r.GuestEmail.ToLower().Contains(search)));
        }

        // Group by Phone
        var grouped = reservationsQuery
            .GroupBy(r => r.GuestPhone!)
            .Select(g => new
            {
                PhoneNumber = g.Key,
                FullName = g.OrderByDescending(r => r.CreatedAtUtc).Select(r => r.GuestName).FirstOrDefault() ?? string.Empty,
                Email = g.OrderByDescending(r => r.CreatedAtUtc).Select(r => r.GuestEmail).FirstOrDefault(),
                IdCardNumber = (string?)null,
                GuestUserId = g.OrderByDescending(r => r.CreatedAtUtc).Select(r => r.GuestUserId).FirstOrDefault(),
                TotalBookings = g.Count(),
                CompletedStays = g.Count(r => r.Status == ReservationStatus.CheckedOut),
                CancelledBookings = g.Count(r => r.Status == ReservationStatus.Cancelled),
                TotalSpent = g.Where(r => r.Status == ReservationStatus.CheckedOut || r.Status == ReservationStatus.CheckedIn || r.Status == ReservationStatus.Confirmed)
                              .Sum(r => (decimal?)r.TotalAmount) ?? 0m,
                LastStayDate = g.Max(r => (DateTime?)r.CreatedAtUtc),
                Notes = g.OrderByDescending(r => r.CreatedAtUtc).Select(r => r.Notes).FirstOrDefault()
            });

        var totalCount = await grouped.CountAsync(cancellationToken);
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var pagedRows = await grouped
            .OrderByDescending(g => g.TotalSpent)
            .ThenByDescending(g => g.CompletedStays)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Fetch loyalty cards for users if any
        var userIds = pagedRows
            .Where(r => r.GuestUserId.HasValue)
            .Select(r => r.GuestUserId!.Value)
            .Distinct()
            .ToList();

        var loyaltyMap = new Dictionary<Guid, (string Tier, int Points)>();
        if (userIds.Count > 0)
        {
            var memberships = await _context.GuestLoyaltyMemberships
                .AsNoTracking()
                .Where(m => m.TenantId == tenantId.Value && userIds.Contains(m.UserId))
                .ToListAsync(cancellationToken);

            foreach (var m in memberships)
            {
                loyaltyMap[m.UserId] = (m.Tier.ToString(), m.PointsBalance);
            }
        }

        var items = pagedRows.Select(r =>
        {
            var tier = "Standard";
            var points = 0;
            if (r.GuestUserId.HasValue && loyaltyMap.TryGetValue(r.GuestUserId.Value, out var l))
            {
                tier = l.Tier;
                points = l.Points;
            }
            else if (r.CompletedStays >= 2)
            {
                tier = "Silver";
            }

            var isVip = r.TotalSpent >= 5_000_000 || r.CompletedStays >= 3 || tier != "Standard";

            return new GuestDirectoryItemDto
            {
                Id = r.GuestUserId ?? Guid.NewGuid(),
                UserId = r.GuestUserId,
                FullName = r.FullName,
                Email = r.Email,
                PhoneNumber = r.PhoneNumber,
                IdCardNumber = r.IdCardNumber,
                TotalBookings = r.TotalBookings,
                CompletedStays = r.CompletedStays,
                CancelledBookings = r.CancelledBookings,
                TotalSpent = r.TotalSpent,
                LastStayDate = r.LastStayDate,
                LoyaltyTier = tier,
                PointsBalance = points,
                IsVip = isVip,
                IsBlacklisted = false,
                Notes = r.Notes
            };
        }).ToList();

        return new PagedResult<GuestDirectoryItemDto>(items, totalCount, page, pageSize);
    }
}
