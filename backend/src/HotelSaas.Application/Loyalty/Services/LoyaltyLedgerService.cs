using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Services;

public interface ILoyaltyLedgerService
{
    Task<int> EarnPointsAsync(Guid userId, Guid tenantId, Guid propertyId, Guid reservationId, Guid invoiceId, decimal paidAmount, string memberTier, CancellationToken cancellationToken);
    Task<bool> RedeemPointsAsync(Guid userId, Guid tenantId, Guid propertyId, Guid reservationId, int pointsToRedeem, CancellationToken cancellationToken);
    Task RefundPointsAsync(Guid reservationId, CancellationToken cancellationToken);
}

public sealed class LoyaltyLedgerService : ILoyaltyLedgerService
{
    private readonly IApplicationDbContext _context;

    public LoyaltyLedgerService(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    /// <summary>
    /// Rule Cộng điểm khi Check-out và Thanh toán thành đơn (EarnedOnCheckout)
    /// </summary>
    public async Task<int> EarnPointsAsync(
        Guid userId, Guid tenantId, Guid propertyId, Guid reservationId, Guid invoiceId,
        decimal paidAmount, string memberTier, CancellationToken cancellationToken)
    {
        var membership = await _context.GuestLoyaltyMemberships
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId, cancellationToken);

        if (membership == null) return 0;

        // Tỷ lệ tích điểm theo Hạng thẻ: Silver = 2%, Gold = 4%, Diamond = 6%
        decimal earnRate = memberTier?.Trim().ToUpperInvariant() switch
        {
            "DIAMOND" => 0.06m,
            "GOLD" => 0.04m,
            _ => 0.02m
        };

        int pointsEarned = (int)Math.Floor(paidAmount * earnRate / 1000m); // 1.000đ = 1 điểm
        if (pointsEarned <= 0 && paidAmount > 0)
        {
            pointsEarned = 1;
        }

        if (pointsEarned <= 0) return 0;

        // Kiểm tra tránh cộng điểm trùng lặp cho cùng 1 hóa đơn hoặc reservation (Idempotency)
        bool alreadyEarned = await _context.LoyaltyPointTransactions
            .AnyAsync(tx => ((invoiceId != Guid.Empty && tx.InvoiceId == invoiceId) ||
                             (reservationId != Guid.Empty && tx.ReservationId == reservationId)) &&
                            tx.TransactionType == LoyaltyPointTransactionType.EarnedOnCheckout, cancellationToken);

        if (alreadyEarned) return 0;

        membership.PointsBalance += pointsEarned;
        membership.LifetimePoints += pointsEarned;
        membership.CompletedStaysCount += 1;

        // Tự động nâng hạng thành viên theo số lượt lưu trú
        if (membership.CompletedStaysCount >= 15)
        {
            membership.Tier = LoyaltyTier.Diamond;
        }
        else if (membership.CompletedStaysCount >= 5)
        {
            membership.Tier = LoyaltyTier.Gold;
        }

        membership.UpdatedAtUtc = DateTime.UtcNow;

        var tx = new LoyaltyPointTransaction
        {
            Id = Guid.NewGuid(),
            MembershipId = membership.Id,
            TenantId = tenantId,
            PropertyId = propertyId,
            ReservationId = reservationId,
            InvoiceId = invoiceId != Guid.Empty ? invoiceId : null,
            TransactionType = LoyaltyPointTransactionType.EarnedOnCheckout,
            PointsDelta = pointsEarned,
            BalanceAfter = membership.PointsBalance,
            Description = $"Cộng {pointsEarned} điểm tích lũy ({earnRate * 100:0}%) cho đơn đặt phòng #{reservationId.ToString()[..8]}",
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.LoyaltyPointTransactions.Add(tx);
        await _context.SaveChangesAsync(cancellationToken);

        return pointsEarned;
    }

    /// <summary>
    /// Rule Dùng điểm giảm tiền khi Đặt phòng (RedeemedOnPayment)
    /// </summary>
    public async Task<bool> RedeemPointsAsync(
        Guid userId, Guid tenantId, Guid propertyId, Guid reservationId,
        int pointsToRedeem, CancellationToken cancellationToken)
    {
        if (pointsToRedeem <= 0) return true;

        var membership = await _context.GuestLoyaltyMemberships
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId, cancellationToken);

        if (membership == null || membership.PointsBalance < pointsToRedeem)
            return false;

        membership.PointsBalance -= pointsToRedeem;
        membership.UpdatedAtUtc = DateTime.UtcNow;

        var tx = new LoyaltyPointTransaction
        {
            Id = Guid.NewGuid(),
            MembershipId = membership.Id,
            TenantId = tenantId,
            PropertyId = propertyId,
            ReservationId = reservationId,
            TransactionType = LoyaltyPointTransactionType.RedeemedOnPayment,
            PointsDelta = -pointsToRedeem,
            BalanceAfter = membership.PointsBalance,
            Description = $"Sử dụng {pointsToRedeem} điểm thanh toán cho đặt phòng #{reservationId.ToString()[..8]}",
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.LoyaltyPointTransactions.Add(tx);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Rule Hoàn trả điểm 100% tự động khi Hủy đơn đặt phòng (RefundedOnCancel)
    /// </summary>
    public async Task RefundPointsAsync(Guid reservationId, CancellationToken cancellationToken)
    {
        // Kiểm tra xem đã hoàn điểm chưa để tránh hoàn trùng lặp (Idempotency)
        bool alreadyRefunded = await _context.LoyaltyPointTransactions
            .AnyAsync(tx => tx.ReservationId == reservationId &&
                tx.TransactionType == LoyaltyPointTransactionType.RefundedOnCancel, cancellationToken);

        if (alreadyRefunded) return;

        // Tìm giao dịch trừ điểm tương ứng của đặt phòng này
        var originalRedeemTx = await _context.LoyaltyPointTransactions
            .FirstOrDefaultAsync(tx => tx.ReservationId == reservationId &&
                (tx.TransactionType == LoyaltyPointTransactionType.RedeemedOnPayment ||
                 tx.TransactionType == LoyaltyPointTransactionType.HeldForBooking), cancellationToken);

        int pointsToRefund = 0;
        GuestLoyaltyMembership? membership = null;
        Guid? propertyId = null;

        if (originalRedeemTx != null)
        {
            pointsToRefund = Math.Abs(originalRedeemTx.PointsDelta);
            propertyId = originalRedeemTx.PropertyId;
            membership = await _context.GuestLoyaltyMemberships
                .FirstOrDefaultAsync(m => m.Id == originalRedeemTx.MembershipId, cancellationToken);
        }
        else
        {
            var res = await _context.Reservations
                .FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken);

            if (res != null && res.PointsRedeemed > 0 && res.PointsRefunded == 0)
            {
                pointsToRefund = res.PointsRedeemed;
                propertyId = res.PropertyId;
                if (res.GuestUserId.HasValue)
                {
                    membership = await _context.GuestLoyaltyMemberships
                        .FirstOrDefaultAsync(m => m.TenantId == res.TenantId && m.UserId == res.GuestUserId.Value, cancellationToken);
                }
            }
        }

        if (pointsToRefund <= 0 || membership == null) return;

        membership.PointsBalance += pointsToRefund;
        membership.UpdatedAtUtc = DateTime.UtcNow;

        var refundTx = new LoyaltyPointTransaction
        {
            Id = Guid.NewGuid(),
            MembershipId = membership.Id,
            TenantId = membership.TenantId,
            PropertyId = propertyId,
            ReservationId = reservationId,
            TransactionType = LoyaltyPointTransactionType.RefundedOnCancel,
            PointsDelta = pointsToRefund,
            BalanceAfter = membership.PointsBalance,
            Description = $"Hoàn trả tự động +{pointsToRefund} điểm vào ví do hủy đơn đặt phòng #{reservationId.ToString()[..8]}",
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.LoyaltyPointTransactions.Add(refundTx);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
