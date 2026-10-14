using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeById;

/// <summary>
/// Query to retrieve a single room type by its identifier.
/// </summary>
/// <param name="Id">The unique identifier of the room type.</param>
public sealed record GetRoomTypeByIdQuery(Guid Id) : IRequest<RoomTypeDto?>;
