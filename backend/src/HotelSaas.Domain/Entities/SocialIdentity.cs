using System;
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a federated social identity link (e.g. Google, Facebook).
/// Strictly stores immutable provider subjects and provider emails.
/// </summary>
public class SocialIdentity : BaseEntity
{
    /// <summary>
    /// Foreign key to the local user account.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the local user account.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// Social provider name (e.g. "Google", "Facebook").
    /// </summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>
    /// Unique and immutable subject identifier from the external identity provider (sub / id).
    /// </summary>
    public string ProviderSubject { get; set; } = string.Empty;

    /// <summary>
    /// Verified email address returned by the external provider.
    /// </summary>
    public string ProviderEmail { get; set; } = string.Empty;

    /// <summary>
    /// Optional avatar / picture URL provided by the external identity profile.
    /// </summary>
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// UTC timestamp of the most recent successful login with this social provider.
    /// </summary>
    public DateTime LastLoginAtUtc { get; set; } = DateTime.UtcNow;
}
