using System;

namespace HotelSaas.Application.RoomTypes.DTOs;

/// <summary>
/// Data transfer object for room type rate schedules.
/// </summary>
public sealed record RoomTypeRateDto
{
    public Guid Id { get; init; }
    public Guid PropertyId { get; init; }
    public Guid RoomTypeId { get; init; }
    public int FirstHours { get; init; }
    public decimal FirstHoursPrice { get; init; }
    public decimal AdditionalHourPrice { get; init; }
    public decimal NightlyPrice { get; init; }
    public string Currency { get; init; } = "VND";
    public DateOnly EffectiveFrom { get; init; }
    public DateOnly EffectiveTo { get; init; }
    public string? ChangeReason { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
