using System;

namespace HotelSaas.Application.Loyalty.DTOs;

public sealed class LoyaltyPointLedgerItemDto
{
    public Guid Id { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string TenantBrandName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public string ReservationCode { get; set; } = string.Empty;
    public string Type { get; set; } = "Earned";
    public int PointsDelta { get; set; }
    public int BalanceAfter { get; set; }
    public string Description { get; set; } = string.Empty;
}
