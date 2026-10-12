using MediatR;

namespace HotelSaas.Application.Auth.Commands.SwitchContext;

/// <summary>
/// Command to switch the user's active working property context and issue updated scoped tokens.
/// </summary>
/// <param name="PropertyId">The target property identifier.</param>
public sealed record SwitchContextCommand(Guid PropertyId) : IRequest<SwitchContextResponse>;
