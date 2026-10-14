using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Loyalty.Services;

public interface ILoyaltyTierRules
{
    int GetDiscountPercentage(LoyaltyTier tier);
    decimal GetEarnRate(LoyaltyTier tier);
    int CalculateEarnedPoints(LoyaltyTier tier, decimal paidAmount);
    (LoyaltyTier Tier, string NextTierName, int StaysToNextTier) CalculateTierProgress(int completedStaysCount);
}
