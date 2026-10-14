using MediatR;

namespace HotelSaas.Application.Rooms.Commands.DeleteRoom;

/// <summary>
/// Command to delete a physical room by identifier.
/// </summary>
/// <param name="Id">The unique identifier of the room to delete.</param>
public sealed record DeleteRoomCommand(Guid Id) : IRequest<bool>;
