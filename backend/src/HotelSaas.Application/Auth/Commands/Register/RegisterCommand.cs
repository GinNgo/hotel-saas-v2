using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.Register;

/// <summary>
/// Command to register a new user account.
/// </summary>
/// <param name="Email">The email address for the new account.</param>
/// <param name="Password">The plain-text password (will be hashed).</param>
/// <param name="FullName">The user's display name.</param>
/// <param name="PhoneNumber">Optional contact phone number.</param>
/// <param name="AvatarUrl">Optional URL to the user's avatar image.</param>
/// <param name="AppUrl">Optional client origin URL for verification link generation.</param>
public sealed record RegisterCommand(
    string Email,
    string Password,
    string FullName,
    string? PhoneNumber = null,
    string? AvatarUrl = null,
    string? AppUrl = null)
    : IRequest<RegisterResponse>;
