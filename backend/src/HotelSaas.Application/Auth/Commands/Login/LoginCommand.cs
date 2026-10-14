using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.Login;

/// <summary>
/// Command to authenticate a user with email and password.
/// </summary>
/// <param name="Email">The user's email address.</param>
/// <param name="Password">The user's plain-text password.</param>
public sealed record LoginCommand(string Email, string Password)
    : IRequest<LoginResponse>;
