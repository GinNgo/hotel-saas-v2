using HotelSaas.Application.Rooms.DTOs;
using MediatR;

namespace HotelSaas.Application.Rooms.Queries.GetRoomById;

/// <summary>
/// Query to retrieve a single room by its identifier.
/// </summary>
/// <param name="Id">The unique identifier of the room.</param>
public sealed record GetRoomByIdQuery(Guid Id) : IRequest<RoomDto?>;
