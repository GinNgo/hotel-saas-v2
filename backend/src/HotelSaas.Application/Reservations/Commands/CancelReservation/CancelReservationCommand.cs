using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.CancelReservation;

/// <summary>
/// Command to cancel a reservation before check-in, recording the cancellation timestamp and reason.
/// </summary>
/// <param name="ReservationId">The unique identifier of the reservation.</param>
/// <param name="PropertyId">The branch/property identifier.</param>
/// <param name="Reason">Optional cancellation reason provided by the staff or guest.</param>
public sealed record CancelReservationCommand(
    Guid ReservationId,
    Guid PropertyId,
    string? Reason = null
) : IRequest<ReservationDetailDto>;
