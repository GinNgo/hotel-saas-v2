using System;

namespace HotelSaas.Application.Loyalty.DTOs;

public sealed class GuestLoyaltyMembershipDto
{
    public Guid MembershipId { get; set; }
    public Guid TenantId { get; set; }
    public string TenantBrandName { get; set; } = string.Empty;
    public Guid EnrolledPropertyId { get; set; }
    public string EnrolledPropertyName { get; set; } = string.Empty;
    public string MemberCode { get; set; } = string.Empty;
    public string Tier { get; set; } = "Silver";
    public int PointsBalance { get; set; }
    public int PendingPoints { get; set; }
    public int TotalStays { get; set; }
    public int DiscountPercent { get; set; }
    public string NextTierName { get; set; } = "Gold";
    public int StaysToNextTier { get; set; }
    public string JoinedAt { get; set; } = string.Empty;
}
