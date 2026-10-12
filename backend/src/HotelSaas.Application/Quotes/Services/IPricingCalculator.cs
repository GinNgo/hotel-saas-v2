using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Quotes.Services;

/// <summary>
/// Authoritative pricing and surcharge calculation service for hourly and overnight room stays.
/// Enforces Decision D05 (60-minute ceiling rounding), D06 (overnight boundaries),
/// D14 (branch hourly limit), D19 (surcharges), D20 (5-minute quote TTL), and D25 (VND AwayFromZero rounding).
/// Shared between internal staff booking flows and public guest reservation engines.
/// </summary>
public interface IPricingCalculator
{
    Task<QuoteDto> CalculateAsync(
        Property property,
        RoomType roomType,
        RentalType rentalType,
        DateTime startAtUtc,
        DateTime endAtUtc,
        DateOnly? checkInDate,
        DateOnly? checkOutDate,
        CancellationToken cancellationToken);
}
