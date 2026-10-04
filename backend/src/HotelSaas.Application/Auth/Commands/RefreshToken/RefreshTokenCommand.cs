using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.RefreshToken;

/// <summary>
/// Command to exchange an expired access token and valid refresh token for a new token pair.
/// </summary>
/// <param name="AccessToken">The expired JWT access token.</param>
/// <param name="RefreshToken">The current refresh token.</param>
public sealed record RefreshTokenCommand(string AccessToken, string RefreshToken)
    : IRequest<LoginResponse>;
