using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.GoogleLogin;

/// <summary>
/// Authenticates or auto-provisions a user via Google OAuth Identity Services.
/// Enforces Soft-Gating with automatic EmailVerifiedAtUtc assignment for B2C guests,
/// and links to existing accounts by email when applicable.
/// </summary>
/// <param name="IdToken">Cryptographically signed Google ID Token or sandbox test token.</param>
public sealed record GoogleLoginCommand(
    string IdToken
) : IRequest<LoginResponse>;
