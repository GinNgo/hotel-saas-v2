using System;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Reservations.Queries.GetReservations;

/// <summary>
/// Query to retrieve a paginated list of reservations for a property with optional status, date, and keyword filters.
/// </summary>
public sealed record GetReservationsQuery(
    Guid PropertyId,
    ReservationStatus? Status = null,
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<PagedResult<ReservationDto>>;
