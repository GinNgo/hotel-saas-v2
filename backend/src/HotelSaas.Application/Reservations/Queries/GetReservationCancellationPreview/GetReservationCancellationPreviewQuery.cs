using System;
using HotelSaas.Application.Reservations.Services;
using MediatR;

namespace HotelSaas.Application.Reservations.Queries.GetReservationCancellationPreview;

/// <summary>
/// Staff query to calculate and preview the cancellation fee and expected refund for a reservation.
/// Read-only simulation with zero mutations.
/// </summary>
public sealed record GetReservationCancellationPreviewQuery(
    Guid ReservationId,
    Guid PropertyId
) : IRequest<CancellationEstimateResult>;

