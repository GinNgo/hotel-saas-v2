using System;

namespace HotelSaas.Application.RoomTypes.DTOs;

/// <summary>
/// Data transfer object for audit logs of rate modifications.
/// </summary>
public sealed record RoomTypeRateAuditDto
{
    public Guid Id { get; init; }
    public Guid PropertyId { get; init; }
    public Guid RoomTypeId { get; init; }
    public Guid? RateId { get; init; }
    public DateOnly? OldEffectiveFrom { get; init; }
    public DateOnly? OldEffectiveTo { get; init; }
    public decimal? OldNightlyPrice { get; init; }
    public DateOnly NewEffectiveFrom { get; init; }
    public DateOnly NewEffectiveTo { get; init; }
    public decimal NewNightlyPrice { get; init; }
    public string ActionType { get; init; } = string.Empty;
    public Guid ChangedByUserId { get; init; }
    public DateTime ChangedAtUtc { get; init; }
    public string? ChangeReason { get; init; }
}
