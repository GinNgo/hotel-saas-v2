using System.Collections.Generic;
using HotelSaas.Application.Ai.DTOs;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.ProcessAiChat;

public sealed record ProcessAiChatQuery(
    string? Message = null,
    IReadOnlyList<AiChatHistoryMessage>? Messages = null,
    AiChatLocation? Location = null
) : IRequest<AiChatResponse>;
