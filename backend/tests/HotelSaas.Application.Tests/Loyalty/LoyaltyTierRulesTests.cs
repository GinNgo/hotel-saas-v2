using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Domain.Enums;
using Xunit;

namespace HotelSaas.Application.Tests.Loyalty;

public sealed class LoyaltyTierRulesTests
{
    private readonly ILoyaltyTierRules _rules = new LoyaltyTierRules();

    [Theory]
    [InlineData(LoyaltyTier.Silver, 5)]
    [InlineData(LoyaltyTier.Gold, 8)]
    [InlineData(LoyaltyTier.Diamond, 12)]
    public void GetDiscountPercentage_ReturnsExpectedDiscount(LoyaltyTier tier, int expectedPercent)
    {
        var percent = _rules.GetDiscountPercentage(tier);
        Assert.Equal(expectedPercent, percent);
    }

    [Theory]
    [InlineData(LoyaltyTier.Silver, 0.02)]
    [InlineData(LoyaltyTier.Gold, 0.04)]
    [InlineData(LoyaltyTier.Diamond, 0.06)]
    public void GetEarnRate_ReturnsExpectedRate(LoyaltyTier tier, decimal expectedRate)
    {
        var rate = _rules.GetEarnRate(tier);
        Assert.Equal(expectedRate, rate);
    }

    [Theory]
    [InlineData(LoyaltyTier.Silver, 1000000, 20)]
    [InlineData(LoyaltyTier.Gold, 1000000, 40)]
    [InlineData(LoyaltyTier.Diamond, 1000000, 60)]
    [InlineData(LoyaltyTier.Silver, 500000, 10)]
    [InlineData(LoyaltyTier.Silver, 10000, 1)] // Min 1 point
    [InlineData(LoyaltyTier.Silver, 0, 0)]
    public void CalculateEarnedPoints_CalculatesCorrectPoints(LoyaltyTier tier, decimal paidAmount, int expectedPoints)
    {
        var points = _rules.CalculateEarnedPoints(tier, paidAmount);
        Assert.Equal(expectedPoints, points);
    }

    [Theory]
    [InlineData(0, LoyaltyTier.Silver, "Gold", 5)]
    [InlineData(4, LoyaltyTier.Silver, "Gold", 1)]
    [InlineData(5, LoyaltyTier.Gold, "Diamond", 10)]
    [InlineData(14, LoyaltyTier.Gold, "Diamond", 1)]
    [InlineData(15, LoyaltyTier.Diamond, "Hạng tối đa", 0)]
    [InlineData(20, LoyaltyTier.Diamond, "Hạng tối đa", 0)]
    public void CalculateTierProgress_CalculatesProgressionAccurately(int stays, LoyaltyTier expectedTier, string expectedNextTier, int expectedStaysNeeded)
    {
        var (tier, nextTier, staysNeeded) = _rules.CalculateTierProgress(stays);
        Assert.Equal(expectedTier, tier);
        Assert.Equal(expectedNextTier, nextTier);
        Assert.Equal(expectedStaysNeeded, staysNeeded);
    }
}
