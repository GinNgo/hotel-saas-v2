using System;
using System.Collections.Generic;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRates;

/// <summary>
/// Query to retrieve active pricing schedules for a specific room type within a property.
/// </summary>
public sealed record GetRoomTypeRatesQuery(Guid RoomTypeId, Guid? PropertyId = null) : IRequest<IReadOnlyList<RoomTypeRateDto>>;
