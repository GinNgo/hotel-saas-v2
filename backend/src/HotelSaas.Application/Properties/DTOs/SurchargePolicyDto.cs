using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Properties.DTOs;

/// <summary>
/// Data transfer object for property surcharge policy items.
/// </summary>
public sealed record SurchargePolicyDto
{
    public Guid Id { get; init; }
    public SurchargeType SurchargeType { get; init; }
    public TimeOnly FromTime { get; init; }
    public TimeOnly ToTime { get; init; }
    public SurchargeCalculationMethod CalculationMethod { get; init; }
    public decimal? Percentage { get; init; }
    public decimal? FlatAmount { get; init; }
    public bool IsActive { get; init; }
}
