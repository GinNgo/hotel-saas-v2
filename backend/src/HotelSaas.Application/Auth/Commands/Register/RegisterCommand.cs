using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.Register;

/// <summary>
/// Command to register a new user account.
/// </summary>
/// <param name="Email">The email address for the new account.</param>
/// <param name="Password">The plain-text password (will be hashed).</param>
/// <param name="FullName">The user's display name.</param>
public sealed record RegisterCommand(string Email, string Password, string FullName)
    : IRequest<RegisterResponse>;
