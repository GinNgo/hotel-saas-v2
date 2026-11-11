using System.Threading;
using System.Threading.Tasks;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Result of Firebase ID token verification.
/// </summary>
/// <param name="IsValid">Whether the token was cryptographically verified and is within its validity period.</param>
/// <param name="PhoneNumber">Verified E.164 phone number from Google Identity Platform (e.g. "+84901234567").</param>
/// <param name="Uid">Unique Firebase User ID.</param>
/// <param name="ErrorMessage">Optional descriptive error message when verification fails.</param>
public sealed record FirebasePhoneVerificationResult(
    bool IsValid,
    string? PhoneNumber,
    string? Uid,
    string? ErrorMessage = null
);

/// <summary>
/// Service for validating Firebase ID Tokens from Google Identity Platform.
/// Supports zero-cost SMS Phone Authentication with invisible reCAPTCHA anti-bot protection.
/// </summary>
public interface IFirebaseAuthService
{
    /// <summary>
    /// Validates an incoming Firebase ID token, returning the verified phone number.
    /// </summary>
    /// <param name="idToken">The Firebase ID token produced by client-side phone verification.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Result containing validity flag and verified phone number.</returns>
    Task<FirebasePhoneVerificationResult> VerifyIdTokenAsync(string idToken, CancellationToken cancellationToken = default);
}
