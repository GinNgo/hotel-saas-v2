using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetFolio;

/// <summary>
/// Query to retrieve the financial folio statement for a reservation,
/// including room charges, payments, and remaining balance.
/// </summary>
public sealed record GetFolioQuery(
    Guid ReservationId,
    Guid PropertyId
) : IRequest<FolioDto>;
