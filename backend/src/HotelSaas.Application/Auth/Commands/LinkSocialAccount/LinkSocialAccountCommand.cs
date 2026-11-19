using HotelSaas.Application.Auth.Queries.GetSocialIdentities;
using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.LinkSocialAccount;

/// <summary>
/// Command to link a verified external social account (Google) to the currently authenticated user.
/// </summary>
/// <param name="IdToken">Cryptographically verifiable provider ID token.</param>
/// <param name="Provider">Social provider name (defaults to Google).</param>
public sealed record LinkSocialAccountCommand(
    string IdToken,
    string Provider = "Google") : IRequest<ApiResponse<SocialIdentityDto>>;
