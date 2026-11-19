using HotelSaas.Application.Ai.DTOs;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.GetAiUsageStatus;

public sealed record GetAiUsageStatusQuery : IRequest<AiUsageStatusDto>;
