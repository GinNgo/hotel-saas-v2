using HotelSaas.Application.Public.DTOs;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.ProcessAiSmartSearch;

public sealed record ProcessAiSmartSearchQuery(
    string Query,
    double? UserLatitude = null,
    double? UserLongitude = null
) : IRequest<AiSmartSearchResponseDto>;
