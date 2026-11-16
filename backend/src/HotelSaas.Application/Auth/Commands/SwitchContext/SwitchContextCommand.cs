using MediatR;

namespace HotelSaas.Application.Auth.Commands.SwitchContext;

/// <summary>
/// Command to switch the user's active working property (or chain-wide HQ when null) context and issue updated scoped tokens.
/// </summary>
/// <param name="PropertyId">The target property identifier, or null to switch to chain-wide HQ scope.</param>
public sealed record SwitchContextCommand(Guid? PropertyId) : IRequest<SwitchContextResponse>;
