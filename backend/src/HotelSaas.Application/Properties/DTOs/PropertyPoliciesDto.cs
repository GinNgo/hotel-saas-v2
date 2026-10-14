using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Properties.DTOs;

/// <summary>
/// Data transfer object representing the complete operational policy configuration of a property branch.
/// </summary>
public sealed record PropertyPoliciesDto
{
    public Guid PropertyId { get; init; }
    public TimeOnly CheckInTime { get; init; }
    public TimeOnly CheckOutTime { get; init; }
    public int BufferMinutes { get; init; }
    public int MaxHourlyHours { get; init; }
    public IReadOnlyList<SurchargePolicyDto> Surcharges { get; init; } = Array.Empty<SurchargePolicyDto>();
}
