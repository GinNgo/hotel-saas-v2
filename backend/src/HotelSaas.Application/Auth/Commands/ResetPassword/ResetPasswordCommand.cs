using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.ResetPassword;

/// <summary>
/// Command to complete password reset or staff invitation password setup using a signed HMAC token.
/// </summary>
/// <param name="Token">The signed password reset token.</param>
/// <param name="NewPassword">The new strong password to assign.</param>
public sealed record ResetPasswordCommand(
    string Token,
    string NewPassword) : IRequest<ApiResponse<object?>>;
