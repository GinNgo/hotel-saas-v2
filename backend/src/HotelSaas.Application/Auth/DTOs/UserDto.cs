namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Lightweight user data transfer object included in auth responses.
/// </summary>
/// <param name="Id">The user's unique identifier.</param>
/// <param name="Email">The user's email address.</param>
/// <param name="FullName">The user's display name.</param>
/// <param name="GlobalRole">The user's platform-wide role as a string.</param>
/// <param name="TenantId">The user's default tenant, if any.</param>
/// <param name="PhoneNumber">The user's verified or recorded phone number.</param>
/// <param name="IsPhoneVerified">Whether the user's phone number is verified.</param>
/// <param name="IsEmailVerified">Whether the user's email address is verified.</param>
public sealed record UserDto(
    Guid Id,
    string Email,
    string FullName,
    string GlobalRole,
    Guid? TenantId,
    string? PhoneNumber = null,
    bool IsPhoneVerified = false,
    bool IsEmailVerified = false);
