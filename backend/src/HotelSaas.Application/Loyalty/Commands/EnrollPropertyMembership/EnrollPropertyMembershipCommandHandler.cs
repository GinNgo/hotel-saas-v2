using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Commands.EnrollPropertyMembership;

public sealed class EnrollPropertyMembershipCommandHandler : IRequestHandler<EnrollPropertyMembershipCommand, GuestLoyaltyMembershipDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;
    private readonly ILoyaltyTierRules _tierRules;

    public EnrollPropertyMembershipCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext,
        ILoyaltyTierRules tierRules)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _tierRules = tierRules ?? throw new ArgumentNullException(nameof(tierRules));
    }

    public async Task<GuestLoyaltyMembershipDto> Handle(EnrollPropertyMembershipCommand request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản để đăng ký thành viên.");
        }

        var property = await _context.Properties
            .Include(p => p.Tenant)
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Cơ sở lưu trú không tồn tại.");
        }

        // Check if user already enrolled in this tenant chain
        var existing = await _context.GuestLoyaltyMemberships
            .Include(m => m.Tenant)
            .Include(m => m.EnrolledProperty)
            .FirstOrDefaultAsync(m => m.TenantId == property.TenantId && m.UserId == userId, cancellationToken);

        if (existing != null)
        {
            var (tier, nextTierName, staysToNextTier) = _tierRules.CalculateTierProgress(existing.CompletedStaysCount);
            return new GuestLoyaltyMembershipDto
            {
                MembershipId = existing.Id,
                TenantId = existing.TenantId,
                TenantBrandName = existing.Tenant?.Name ?? property.Tenant?.Name ?? "Chuỗi khách sạn",
                EnrolledPropertyId = existing.EnrolledPropertyId,
                EnrolledPropertyName = existing.EnrolledProperty?.Name ?? property.Name,
                MemberCode = existing.MemberCode,
                Tier = existing.Tier.ToString(),
                PointsBalance = existing.PointsBalance,
                PendingPoints = 0,
                TotalStays = existing.CompletedStaysCount,
                DiscountPercent = _tierRules.GetDiscountPercentage(existing.Tier),
                NextTierName = nextTierName,
                StaysToNextTier = staysToNextTier,
                JoinedAt = existing.CreatedAtUtc.ToString("yyyy-MM-dd")
            };
        }

        // Create new membership with 50 welcome bonus points
        var memberCode = $"VIP-{RandomNumberGenerator.GetInt32(100000, 999999)}";
        var nowUtc = DateTime.UtcNow;

        var membership = new GuestLoyaltyMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TenantId = property.TenantId,
            EnrolledPropertyId = property.Id,
            MemberCode = memberCode,
            Tier = LoyaltyTier.Silver,
            PointsBalance = 50,
            LifetimePoints = 50,
            CompletedStaysCount = 0,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc
        };

        var welcomeTx = new LoyaltyPointTransaction
        {
            Id = Guid.NewGuid(),
            MembershipId = membership.Id,
            TenantId = property.TenantId,
            PropertyId = property.Id,
            TransactionType = LoyaltyPointTransactionType.WelcomeBonus,
            PointsDelta = 50,
            BalanceAfter = 50,
            Description = $"Tặng 50 điểm chào mừng khi gia nhập hội viên {property.Name}",
            CreatedAtUtc = nowUtc
        };

        _context.GuestLoyaltyMemberships.Add(membership);
        _context.LoyaltyPointTransactions.Add(welcomeTx);
        await _context.SaveChangesAsync(cancellationToken);

        var (_, nextTier, staysNeeded) = _tierRules.CalculateTierProgress(0);

        return new GuestLoyaltyMembershipDto
        {
            MembershipId = membership.Id,
            TenantId = membership.TenantId,
            TenantBrandName = property.Tenant?.Name ?? "Chuỗi khách sạn",
            EnrolledPropertyId = property.Id,
            EnrolledPropertyName = property.Name,
            MemberCode = membership.MemberCode,
            Tier = membership.Tier.ToString(),
            PointsBalance = membership.PointsBalance,
            PendingPoints = 0,
            TotalStays = 0,
            DiscountPercent = _tierRules.GetDiscountPercentage(membership.Tier),
            NextTierName = nextTier,
            StaysToNextTier = staysNeeded,
            JoinedAt = nowUtc.ToString("yyyy-MM-dd")
        };
    }
}
