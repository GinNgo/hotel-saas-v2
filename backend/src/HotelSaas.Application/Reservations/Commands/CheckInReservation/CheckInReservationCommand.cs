using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.CheckInReservation;

/// <summary>
/// Command to check in a guest for a confirmed reservation, transitioning the reservation to CheckedIn
/// and atomically locking and transitioning the physical room to Occupied.
/// </summary>
/// <param name="ReservationId">The unique identifier of the reservation.</param>
/// <param name="PropertyId">The branch/property identifier.</param>
public sealed record CheckInReservationCommand(
    Guid ReservationId,
    Guid PropertyId
) : IRequest<ReservationDetailDto>;
