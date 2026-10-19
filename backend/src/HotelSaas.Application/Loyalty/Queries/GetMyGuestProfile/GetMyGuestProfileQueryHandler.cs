using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Queries.GetMyGuestProfile;

public sealed class GetMyGuestProfileQueryHandler : IRequestHandler<GetMyGuestProfileQuery, GuestProfileResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;
    private readonly ILoyaltyTierRules _tierRules;

    public GetMyGuestProfileQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext,
        ILoyaltyTierRules tierRules)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _tierRules = tierRules ?? throw new ArgumentNullException(nameof(tierRules));
    }

    public async Task<GuestProfileResponseDto> Handle(GetMyGuestProfileQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        var memberships = await _context.GuestLoyaltyMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .Include(m => m.EnrolledProperty)
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.PointsBalance)
            .ToListAsync(cancellationToken);

        var membershipDtos = memberships.Select(m =>
        {
            var (_, nextTier, staysToNext) = _tierRules.CalculateTierProgress(m.CompletedStaysCount);
            return new GuestLoyaltyMembershipDto
            {
                MembershipId = m.Id,
                TenantId = m.TenantId,
                TenantBrandName = m.Tenant?.Name ?? "Chuỗi lưu trú",
                EnrolledPropertyId = m.EnrolledPropertyId,
                EnrolledPropertyName = m.EnrolledProperty?.Name ?? "Cơ sở lưu trú",
                MemberCode = m.MemberCode,
                Tier = m.Tier.ToString(),
                PointsBalance = m.PointsBalance,
                PendingPoints = 0,
                TotalStays = m.CompletedStaysCount,
                DiscountPercent = _tierRules.GetDiscountPercentage(m.Tier),
                NextTierName = nextTier,
                StaysToNextTier = staysToNext,
                JoinedAt = m.CreatedAtUtc.ToString("yyyy-MM-dd")
            };
        }).ToList();

        var totalPoints = memberships.Sum(m => m.PointsBalance);
        var membershipIds = memberships.Select(m => m.Id).ToList();

        var totalRefunded = await _context.LoyaltyPointTransactions
            .AsNoTracking()
            .Where(t => membershipIds.Contains(t.MembershipId) && t.TransactionType == LoyaltyPointTransactionType.RefundedOnCancel)
            .SumAsync(t => (int?)t.PointsDelta, cancellationToken) ?? 0;

        return new GuestProfileResponseDto
        {
            UserId = user.Id,
            FullName = user.FullName,
            Phone = user.PhoneNumber ?? string.Empty,
            Email = user.Email,
            CompanyName = user.CompanyName,
            CompanyTaxCode = user.CompanyTaxCode,
            CompanyAddress = user.CompanyAddress,
            TotalPoints = totalPoints,
            PointsValueVnd = totalPoints * 1000m,
            TotalPointsRefunded = totalRefunded,
            Memberships = membershipDtos
        };
    }
}
