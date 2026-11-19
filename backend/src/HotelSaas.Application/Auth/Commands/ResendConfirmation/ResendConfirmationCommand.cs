using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.ResendConfirmation;

/// <summary>
/// Command to resend an email verification link.
/// Supports both authenticated users (resolving current user identity) and anonymous requests (by email).
/// </summary>
/// <param name="Email">Email address to verify (required when unauthenticated).</param>
/// <param name="AppUrl">Optional client origin URL for verification link generation.</param>
public sealed record ResendConfirmationCommand(
    string? Email = null,
    string? AppUrl = null) : IRequest<ApiResponse<object?>>;
