using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.RevokeSmartLockPin;

/// <summary>
/// Revokes an active Smart Lock access PIN for a reservation while preserving activation history and recording an audit trail (G0-03).
/// </summary>
public sealed record RevokeSmartLockPinCommand(
    Guid ReservationId,
    Guid PropertyId,
    string? Reason = null
) : IRequest<ReservationDetailDto>;
