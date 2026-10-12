using System;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Quotes.Queries.CalculateQuote;

/// <summary>
/// Query to calculate a verified price estimate across hourly or overnight accommodations.
/// </summary>
public sealed record CalculateQuoteQuery(
    Guid PropertyId,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null
) : IRequest<QuoteDto>;
