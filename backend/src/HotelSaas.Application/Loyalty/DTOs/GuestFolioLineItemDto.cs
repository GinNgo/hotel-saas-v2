using System;

namespace HotelSaas.Application.Loyalty.DTOs;

public sealed class GuestFolioLineItemDto
{
    public Guid Id { get; set; }
    public string ItemType { get; set; } = "RoomCharge";
    public string Description { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}
