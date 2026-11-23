namespace HotelSaas.Application.Auth.Queries.GetSocialIdentities;

/// <summary>
/// Linked external social identity summary.
/// </summary>
public sealed record SocialIdentityDto(
    Guid Id,
    string Provider,
    string ProviderEmail,
    string? AvatarUrl,
    DateTime LastLoginAtUtc,
    DateTime CreatedAtUtc);

/// <summary>
/// Social account connections and local password availability for the authenticated user.
/// </summary>
public sealed record SocialAccountsResponseDto(
    bool HasPassword,
    IReadOnlyList<SocialIdentityDto> Accounts);
