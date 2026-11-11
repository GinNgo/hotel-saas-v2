using System.Threading;
using System.Threading.Tasks;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Result of Google ID Token verification via Google Identity Services or Firebase.
/// </summary>
/// <param name="IsValid">Whether the token was cryptographically verified and is within its validity period.</param>
/// <param name="Subject">Unique Google User ID (sub claim).</param>
/// <param name="Email">Verified Google account email address.</param>
/// <param name="FullName">Display name on Google profile.</param>
/// <param name="AvatarUrl">URL of Google profile picture.</param>
/// <param name="ErrorMessage">Optional descriptive error message when verification fails.</param>
public sealed record GoogleTokenVerificationResult(
    bool IsValid,
    string? Subject,
    string? Email,
    string? FullName,
    string? AvatarUrl,
    string? ErrorMessage = null
);

/// <summary>
/// Service for validating Google ID Tokens from Google Identity Services (GSI) / OAuth2.
/// Used for Google Social Login and account linking with auto-verified email status.
/// </summary>
public interface IGoogleAuthService
{
    /// <summary>
    /// Validates an incoming Google ID token, returning verified identity claims.
    /// </summary>
    /// <param name="idToken">The Google ID token produced by Google Sign-In.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Result containing validity flag and profile claims.</returns>
    Task<GoogleTokenVerificationResult> VerifyGoogleTokenAsync(string idToken, CancellationToken cancellationToken = default);
}
