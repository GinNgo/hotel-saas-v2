using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Auth.Queries.GetSocialIdentities;

/// <summary>
/// Query to retrieve linked social identities for the currently authenticated user.
/// </summary>
public sealed record GetSocialIdentitiesQuery() : IRequest<ApiResponse<SocialAccountsResponseDto>>;
