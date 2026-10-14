using System.Text;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Unified validator for JWT configuration keys.
/// Enforces fail-fast behavior when secret keys are missing, empty, or too short for HMAC-SHA256.
/// </summary>
public static class JwtKeyValidator
{
    /// <summary>
    /// Minimum key length in bytes required for HMAC-SHA256 (256 bits = 32 bytes).
    /// </summary>
    public const int MinimumKeyLengthBytes = 32;

    /// <summary>
    /// Validates that the provided secret key is non-null, non-whitespace, and meets the minimum length requirement.
    /// </summary>
    /// <param name="secretKey">The secret key to validate.</param>
    /// <returns>The validated secret key string.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the key is missing, empty, or too short.</exception>
    public static string ValidateSecretKey(string? secretKey)
    {
        if (string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException(
                "JwtSettings:SecretKey is not configured or is empty. A valid secret key is required.");
        }

        var keyBytes = Encoding.UTF8.GetBytes(secretKey);
        if (keyBytes.Length < MinimumKeyLengthBytes)
        {
            throw new InvalidOperationException(
                $"JwtSettings:SecretKey is too short ({keyBytes.Length} bytes). It must be at least {MinimumKeyLengthBytes} bytes (256 bits) for HMAC-SHA256.");
        }

        return secretKey;
    }
}
