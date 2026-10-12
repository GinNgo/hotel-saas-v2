using System;
using System.Collections.Generic;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Reservations.Queries.GetRoomAvailability;

/// <summary>
/// Query to check physical room availability across a time window accounting for required turnover buffer.
/// </summary>
public sealed record GetRoomAvailabilityQuery(
    Guid PropertyId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    Guid? RoomTypeId = null,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null
) : IRequest<IReadOnlyList<RoomAvailabilityDto>>;
