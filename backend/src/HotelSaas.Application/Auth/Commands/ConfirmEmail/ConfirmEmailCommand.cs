using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.ConfirmEmail;

/// <summary>
/// Command to confirm and activate a user's account using an email verification token.
/// </summary>
/// <param name="Token">Signed verification token sent via email.</param>
public sealed record ConfirmEmailCommand(string Token) : IRequest<ConfirmEmailResponse>;
