using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.WebApi.Models;

/// <summary>
/// HTTP request model for recording a manual payment.
/// </summary>
public sealed record CreatePaymentRequest(
    Guid ReservationId,
    decimal Amount,
    PaymentMethod Method,
    string? TransactionRef = null,
    string? IdempotencyKey = null,
    bool IsDeposit = false
);
