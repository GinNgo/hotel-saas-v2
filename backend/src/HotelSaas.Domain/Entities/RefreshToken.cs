using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a JWT refresh token issued to a user for token rotation.
/// </summary>
public class RefreshToken : BaseEntity
{
    /// <summary>
    /// Foreign key to the user this token was issued to.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the owning user.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// The refresh token string value.
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when this token expires.
    /// </summary>
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>
    /// UTC timestamp when this token was revoked; null if still valid.
    /// </summary>
    public DateTime? RevokedAtUtc { get; set; }

    /// <summary>
    /// The token string that replaced this token during rotation; null if not yet rotated.
    /// </summary>
    public string? ReplacedByToken { get; set; }
}
