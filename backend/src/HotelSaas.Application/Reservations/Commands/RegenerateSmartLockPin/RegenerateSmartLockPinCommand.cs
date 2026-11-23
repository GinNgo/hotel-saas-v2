using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.RegenerateSmartLockPin;

/// <summary>
/// Regenerates a fresh 6-digit Smart Lock access PIN for a Confirmed or CheckedIn reservation (G0-03).
/// </summary>
public sealed record RegenerateSmartLockPinCommand(
    Guid ReservationId,
    Guid PropertyId,
    string? Reason = null
) : IRequest<ReservationDetailDto>;
