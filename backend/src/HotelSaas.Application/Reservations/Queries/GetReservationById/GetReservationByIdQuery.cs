using System;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Queries.GetReservationById;

/// <summary>
/// Query to retrieve single reservation details by ID, including its immutable breakdown snapshot.
/// </summary>
public sealed record GetReservationByIdQuery(
    Guid Id,
    Guid PropertyId
) : IRequest<ReservationDetailDto>;
