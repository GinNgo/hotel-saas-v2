using System;
using System.Collections.Generic;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Data transfer object representing the financial folio of a reservation,
/// including itemized price breakdown, total charges, completed payments, remaining balance, and full audit list.
/// </summary>
public sealed record FolioDto(
    Guid ReservationId,
    string ConfirmationCode,
    string GuestName,
    string GuestEmail,
    string? GuestPhone,
    Guid? RoomId,
    string? RoomNumber,
    Guid? RoomTypeId,
    string? RoomTypeName,
    ReservationStatus Status,
    string StatusName,
    RentalType RentalType,
    DateOnly? CheckInDate,
    DateOnly? CheckOutDate,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RemainingBalance,
    bool IsFullyPaid,
    IReadOnlyList<PaymentDto> Payments,
    IReadOnlyList<QuoteBreakdownItemDto> Breakdown,
    decimal? BaseRoomAmount,
    decimal? SurchargesAmount,
    decimal? ServicesAmount,
    decimal? DepositRequired,
    decimal? DepositPaid,
    decimal? CancellationFee = null,
    decimal? RefundableAmount = null,
    string? RefundStatus = null,
    decimal? NetCollectibleAmount = null,
    string? FinancialSettlementStatus = null
);
