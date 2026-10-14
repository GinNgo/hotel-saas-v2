using MediatR;

namespace HotelSaas.Application.Auth.Commands.RevokeToken;

/// <summary>
/// Command to revoke a refresh token, effectively logging out the user's session.
/// </summary>
/// <param name="RefreshToken">The refresh token to revoke.</param>
public sealed record RevokeTokenCommand(string RefreshToken) : IRequest<bool>;
