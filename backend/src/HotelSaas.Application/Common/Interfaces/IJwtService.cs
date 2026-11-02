using System.Security.Claims;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Service for generating and validating JWT access tokens and refresh tokens.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Generates a signed JWT access token and a cryptographic refresh token.
    /// </summary>
    (string accessToken, string refreshToken, DateTime expiresAtUtc) GenerateTokens(
        Guid userId,
        string email,
        string fullName,
        string globalRole,
        Guid? tenantId,
        IReadOnlyList<string>? permissions,
        Guid? propertyId = null,
        string? scope = null,
        string? staffRole = null);

    /// <summary>
    /// Generates a new cryptographic refresh token.
    /// </summary>
    string GenerateRefreshToken();

    /// <summary>
    /// Returns the configured refresh token expiration in days.
    /// </summary>
    int GetRefreshTokenExpirationDays();

    /// <summary>
    /// Validates an expired JWT access token and returns its claims principal.
    /// </summary>
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);

    /// <summary>
    /// Generates a signed verification token for email confirmation.
    /// </summary>
    string GenerateEmailVerificationToken(Guid userId, string email, TimeSpan validity);

    /// <summary>
    /// Validates an email verification token and extracts the userId and email.
    /// </summary>
    (bool isValid, Guid userId, string email) ValidateEmailVerificationToken(string token);
}
