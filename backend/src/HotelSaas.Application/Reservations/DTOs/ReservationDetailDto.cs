using System;
using System.Collections.Generic;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.DTOs;

/// <summary>
/// Detailed DTO representing a reservation including its immutable pricing breakdown and operational policies.
/// </summary>
public sealed record ReservationDetailDto : ReservationDto
{
    public IReadOnlyList<QuoteBreakdownItemDto> Breakdown { get; init; } = Array.Empty<QuoteBreakdownItemDto>();
    public AppliedPoliciesDto AppliedPolicies { get; init; } = null!;
    public DateTime? CancelledAtUtc { get; init; }
    public string? CancellationReason { get; init; }
}
