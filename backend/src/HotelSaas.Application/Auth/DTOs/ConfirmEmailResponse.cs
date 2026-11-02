namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Response payload for email confirmation request.
/// </summary>
/// <param name="Success">Whether the confirmation was successful.</param>
/// <param name="Message">Descriptive message of the outcome.</param>
/// <param name="Email">The verified email address.</param>
public sealed record ConfirmEmailResponse(bool Success, string Message, string? Email = null);
