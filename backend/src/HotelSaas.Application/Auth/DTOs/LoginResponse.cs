namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Response returned after successful authentication (login or token refresh).
/// </summary>
/// <param name="AccessToken">The signed JWT access token.</param>
/// <param name="RefreshToken">The cryptographic refresh token for token rotation.</param>
/// <param name="ExpiresAtUtc">The UTC expiration time of the access token.</param>
/// <param name="User">Basic user profile information.</param>
public sealed record LoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAtUtc, UserDto User);
