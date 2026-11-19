using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.ForgotPassword;

/// <summary>
/// Command to request a password reset email for an account.
/// Always responds generically to avoid disclosing account existence.
/// </summary>
/// <param name="Email">The email address requesting password reset.</param>
/// <param name="AppUrl">Optional client origin URL used to construct the reset link.</param>
public sealed record ForgotPasswordCommand(
    string Email,
    string? AppUrl = null) : IRequest<ApiResponse<object?>>;
