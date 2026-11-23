using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Housekeeping.DTOs;

/// <summary>
/// Data transfer object representing a room housekeeping task in the PMS queue.
/// </summary>
public sealed record HousekeepingTaskDto
{
    public Guid Id { get; init; }
    public Guid RoomId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public int Floor { get; init; }
    public string RoomTypeName { get; init; } = string.Empty;
    public RoomStatus RoomStatus { get; init; }
    public HousekeepingTaskStatus Status { get; init; }
    public HousekeepingPriority Priority { get; init; }
    public HousekeepingPriority EffectivePriority { get; init; }
    public bool HasUpcomingCheckIn { get; init; }
    public DateTime? NextCheckInAtUtc { get; init; }
    public Guid? AssignedToUserId { get; init; }
    public string? AssignedToName { get; init; }
    public string? Notes { get; init; }
    public DateTime? StartedAtUtc { get; init; }
    public DateTime? CompletedAtUtc { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
}

/// <summary>
/// Lightweight staff option for housekeeping task assignment dropdowns.
/// </summary>
public sealed record HousekeepingStaffOptionDto
{
    public Guid UserId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public StaffRole StaffRole { get; init; }
}
