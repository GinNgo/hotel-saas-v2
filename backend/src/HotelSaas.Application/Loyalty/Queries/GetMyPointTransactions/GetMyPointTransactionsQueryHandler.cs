using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Queries.GetMyPointTransactions;

public sealed class GetMyPointTransactionsQueryHandler : IRequestHandler<GetMyPointTransactionsQuery, List<LoyaltyPointLedgerItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetMyPointTransactionsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<List<LoyaltyPointLedgerItemDto>> Handle(GetMyPointTransactionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        var membershipIds = await _context.GuestLoyaltyMemberships
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.Id)
            .ToListAsync(cancellationToken);

        if (membershipIds.Count == 0)
        {
            return new List<LoyaltyPointLedgerItemDto>();
        }

        var query = _context.LoyaltyPointTransactions
            .AsNoTracking()
            .Include(t => t.Tenant)
            .Include(t => t.Property)
            .Include(t => t.Reservation)
            .Where(t => membershipIds.Contains(t.MembershipId));

        if (!string.IsNullOrWhiteSpace(request.FilterType) && request.FilterType != "all")
        {
            switch (request.FilterType.ToLowerInvariant())
            {
                case "earned":
                    query = query.Where(t => t.TransactionType == LoyaltyPointTransactionType.EarnedOnCheckout ||
                                             t.TransactionType == LoyaltyPointTransactionType.WelcomeBonus);
                    break;
                case "redeemed":
                    query = query.Where(t => t.TransactionType == LoyaltyPointTransactionType.HeldForBooking ||
                                             t.TransactionType == LoyaltyPointTransactionType.RedeemedOnPayment);
                    break;
                case "refunded":
                    query = query.Where(t => t.TransactionType == LoyaltyPointTransactionType.RefundedOnCancel ||
                                             t.TransactionType == LoyaltyPointTransactionType.ClawbackOnRefund);
                    break;
            }
        }

        var transactions = await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        return transactions.Select(t =>
        {
            string type = t.TransactionType switch
            {
                LoyaltyPointTransactionType.EarnedOnCheckout => "Earned",
                LoyaltyPointTransactionType.WelcomeBonus => "Bonus",
                LoyaltyPointTransactionType.RefundedOnCancel => "Refunded",
                _ => "Redeemed"
            };

            return new LoyaltyPointLedgerItemDto
            {
                Id = t.Id,
                CreatedAt = t.CreatedAtUtc.ToString("dd/MM/yyyy HH:mm"),
                TenantBrandName = t.Tenant?.Name ?? "Chuỗi khách sạn",
                PropertyName = t.Property?.Name ?? "Cơ sở lưu trú",
                ReservationCode = t.Reservation?.ConfirmationCode ?? "WELCOME-MEMBER",
                Type = type,
                PointsDelta = t.PointsDelta,
                BalanceAfter = t.BalanceAfter,
                Description = t.Description
            };
        }).ToList();
    }
}
