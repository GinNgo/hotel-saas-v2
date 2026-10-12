using System;
using System.Collections.Generic;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRateHistory;

/// <summary>
/// Query to retrieve audit history of rate changes for a room type.
/// </summary>
public sealed record GetRoomTypeRateHistoryQuery(Guid RoomTypeId, Guid? PropertyId = null) : IRequest<IReadOnlyList<RoomTypeRateAuditDto>>;
