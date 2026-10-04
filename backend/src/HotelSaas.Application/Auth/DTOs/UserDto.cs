namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Lightweight user data transfer object included in auth responses.
/// </summary>
/// <param name="Id">The user's unique identifier.</param>
/// <param name="Email">The user's email address.</param>
/// <param name="FullName">The user's display name.</param>
/// <param name="GlobalRole">The user's platform-wide role as a string.</param>
/// <param name="TenantId">The user's default tenant, if any.</param>
public sealed record UserDto(Guid Id, string Email, string FullName, string GlobalRole, Guid? TenantId);
