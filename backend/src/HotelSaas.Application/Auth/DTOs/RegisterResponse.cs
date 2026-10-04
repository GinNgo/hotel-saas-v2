namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Response returned after successful user registration.
/// </summary>
/// <param name="UserId">The unique identifier of the newly created user.</param>
/// <param name="Message">A localized success message.</param>
public sealed record RegisterResponse(Guid UserId, string Message);
