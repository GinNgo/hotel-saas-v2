using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Queries.GetMyMemberships;

/// <summary>
/// Query to retrieve all valid active memberships and available branch contexts for the current authenticated user.
/// </summary>
public sealed record GetMyMembershipsQuery : IRequest<IReadOnlyList<UserMembershipDto>>;
