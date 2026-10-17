using System;

namespace HotelSaas.Application.Quotes.DTOs;

/// <summary>
/// Detailed breakdown item for a calculated room quote.
/// </summary>
public sealed record QuoteBreakdownItemDto
{
    public string Description { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public int Quantity { get; init; }
    public decimal Amount { get; init; }
    public string? Category { get; init; }
}

/// <summary>
/// Snapshot of operational policies applied during quote calculation.
/// </summary>
public sealed record AppliedPoliciesDto
{
    public int MaxHourlyHours { get; init; }
    public int BufferMinutes { get; init; }
    public TimeOnly CheckInTime { get; init; }
    public TimeOnly CheckOutTime { get; init; }
}

/// <summary>
/// Data transfer object representing a verified price estimate from the Quote Engine.
/// </summary>
public sealed record QuoteDto
{
    public Guid PropertyId { get; init; }
    public Guid RoomTypeId { get; init; }
    public string RoomTypeName { get; init; } = string.Empty;
    public string RentalType { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime ExpiresAtUtc { get; init; }
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; init; } = Array.Empty<QuoteBreakdownItemDto>();
    public AppliedPoliciesDto AppliedPolicies { get; init; } = null!;
}
