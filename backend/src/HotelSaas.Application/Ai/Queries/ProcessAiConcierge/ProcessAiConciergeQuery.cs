using HotelSaas.Application.Ai.DTOs;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.ProcessAiConcierge;

public sealed record ProcessAiConciergeQuery(
    string Message,
    string? PropertySlug = null
) : IRequest<AiConciergeResponse>;
