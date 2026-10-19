using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Loyalty.Services;

public sealed class LoyaltyTierRules : ILoyaltyTierRules
{
    public int GetDiscountPercentage(LoyaltyTier tier) => tier switch
    {
        LoyaltyTier.Diamond => 12,
        LoyaltyTier.Gold => 8,
        _ => 5
    };

    public decimal GetEarnRate(LoyaltyTier tier) => tier switch
    {
        LoyaltyTier.Diamond => 0.06m,
        LoyaltyTier.Gold => 0.04m,
        _ => 0.02m
    };

    public int CalculateEarnedPoints(LoyaltyTier tier, decimal paidAmount)
    {
        if (paidAmount <= 0) return 0;
        var points = (int)Math.Floor(paidAmount * GetEarnRate(tier) / 1000m);
        return Math.Max(1, points);
    }

    public (LoyaltyTier Tier, string NextTierName, int StaysToNextTier) CalculateTierProgress(int completedStaysCount)
    {
        if (completedStaysCount >= 15)
        {
            return (LoyaltyTier.Diamond, "Hạng tối đa", 0);
        }
        if (completedStaysCount >= 5)
        {
            return (LoyaltyTier.Gold, "Diamond", 15 - completedStaysCount);
        }
        return (LoyaltyTier.Silver, "Gold", 5 - completedStaysCount);
    }
}
