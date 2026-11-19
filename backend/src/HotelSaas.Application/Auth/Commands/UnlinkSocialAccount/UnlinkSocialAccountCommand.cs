using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.UnlinkSocialAccount;

/// <summary>
/// Command to unlink a social identity provider from the currently authenticated user.
/// </summary>
/// <param name="Provider">The provider name to unlink (e.g., "Google").</param>
public sealed record UnlinkSocialAccountCommand(string Provider) : IRequest<ApiResponse<object?>>;
