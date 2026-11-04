namespace HotelSaas.Application.Guests.DTOs;

public sealed record GuestDirectoryItemDto
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string PhoneNumber { get; init; } = string.Empty;
    public string? IdCardNumber { get; init; }
    public int TotalBookings { get; init; }
    public int CompletedStays { get; init; }
    public int CancelledBookings { get; init; }
    public decimal TotalSpent { get; init; }
    public DateTime? LastStayDate { get; init; }
    public string LoyaltyTier { get; init; } = "None";
    public int PointsBalance { get; init; }
    public bool IsVip { get; init; }
    public bool IsBlacklisted { get; init; }
    public string? Notes { get; init; }
}

public sealed record GuestBookingHistoryItemDto
{
    public Guid ReservationId { get; init; }
    public string BookingCode { get; init; } = string.Empty;
    public Guid PropertyId { get; init; }
    public string PropertyName { get; init; } = string.Empty;
    public string RoomNumber { get; init; } = string.Empty;
    public string RoomTypeName { get; init; } = string.Empty;
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public decimal TotalAmount { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
}

public sealed record GuestDetailDto
{
    public GuestDirectoryItemDto Profile { get; init; } = null!;
    public IReadOnlyList<GuestBookingHistoryItemDto> Bookings { get; init; } = Array.Empty<GuestBookingHistoryItemDto>();
}
