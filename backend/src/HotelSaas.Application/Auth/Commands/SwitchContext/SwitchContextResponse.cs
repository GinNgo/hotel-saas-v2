namespace HotelSaas.Application.Auth.Commands.SwitchContext;

/// <summary>
/// Data transfer object describing the newly activated working context (branch or chain-wide HQ).
/// </summary>
public sealed record CurrentContextDto(
    Guid TenantId,
    Guid? PropertyId,
    string Scope,
    string RoleName);

/// <summary>
/// Response payload containing fresh scoped JWT and refresh tokens.
/// </summary>
public sealed record SwitchContextResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc,
    CurrentContextDto CurrentContext);
