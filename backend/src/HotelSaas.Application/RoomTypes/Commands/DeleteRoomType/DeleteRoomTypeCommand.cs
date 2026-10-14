using MediatR;

namespace HotelSaas.Application.RoomTypes.Commands.DeleteRoomType;

/// <summary>
/// Command to delete a room type by identifier.
/// </summary>
/// <param name="Id">The unique identifier of the room type to delete.</param>
public sealed record DeleteRoomTypeCommand(Guid Id) : IRequest<bool>;
