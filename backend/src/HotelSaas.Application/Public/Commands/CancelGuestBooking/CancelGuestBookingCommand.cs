using HotelSaas.Application.Public.DTOs;
using MediatR;

namespace HotelSaas.Application.Public.Commands.CancelGuestBooking;

/// <summary>
/// Command for a guest to securely cancel an online reservation using their secure lookup token
/// and optional identity verification (matching guest email or phone number).
/// </summary>
/// <param name="LookupToken">Cryptographically secure secret lookup token generated at hold creation.</param>
/// <param name="VerificationEmailOrPhone">Optional guest email or phone number for identity ownership validation.</param>
/// <param name="Reason">Optional cancellation reason provided by the guest.</param>
/// <param name="IdempotencyKey">Optional idempotency key preventing duplicate concurrent cancellation requests.</param>
public sealed record CancelGuestBookingCommand(
    string LookupToken,
    string? VerificationEmailOrPhone = null,
    string? Reason = null,
    string? IdempotencyKey = null
) : IRequest<GuestBookingDetailDto>;

