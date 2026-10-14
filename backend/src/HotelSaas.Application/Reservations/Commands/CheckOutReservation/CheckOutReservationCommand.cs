using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.CheckOutReservation;

/// <summary>
/// Command to check out a guest from an active reservation, transitioning the reservation to CheckedOut
/// and atomically locking and transitioning the physical room to Dirty.
/// </summary>
/// <param name="ReservationId">The unique identifier of the reservation.</param>
/// <param name="PropertyId">The branch/property identifier.</param>
public sealed record CheckOutReservationCommand(
    Guid ReservationId,
    Guid PropertyId
) : IRequest<ReservationDetailDto>;
