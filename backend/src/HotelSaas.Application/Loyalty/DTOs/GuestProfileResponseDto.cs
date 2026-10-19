using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Loyalty.DTOs;

public sealed class GuestProfileResponseDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? CompanyTaxCode { get; set; }
    public string? CompanyAddress { get; set; }
    public int TotalPoints { get; set; }
    public decimal PointsValueVnd { get; set; }
    public int TotalPointsRefunded { get; set; }
    public List<GuestLoyaltyMembershipDto> Memberships { get; set; } = new();
}
