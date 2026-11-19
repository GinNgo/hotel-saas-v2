using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.ChangePassword;

/// <summary>
/// Command for an authenticated user to change their password after verifying their current password.
/// </summary>
/// <param name="CurrentPassword">The user's current plain-text password.</param>
/// <param name="NewPassword">The new strong password.</param>
public sealed record ChangePasswordCommand(
    string CurrentPassword,
    string NewPassword) : IRequest<ApiResponse<object?>>;
