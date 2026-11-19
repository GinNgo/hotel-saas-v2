using System;
using HotelSaas.Application.Public.DTOs;
using MediatR;

namespace HotelSaas.Application.Public.Commands.RescheduleGuestBooking;

/// <summary>
/// Reschedules a PendingPayment or Confirmed guest reservation to a new stay interval under row lock,
/// recalculating pricing via the authoritative pricing engine while preserving existing token and promo rules.
/// </summary>
public sealed record RescheduleGuestBookingCommand(
    string LookupToken,
    DateTime NewStartAtUtc,
    DateTime NewEndAtUtc,
    DateOnly? NewCheckInDate = null,
    DateOnly? NewCheckOutDate = null,
    string? Reason = null,
    Guid? AuthenticatedUserId = null
) : IRequest<GuestBookingDetailDto>;
