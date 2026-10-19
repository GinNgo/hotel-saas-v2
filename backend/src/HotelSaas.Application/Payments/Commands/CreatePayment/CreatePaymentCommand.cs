using System;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Payments.Commands.CreatePayment;

/// <summary>
/// Command to record a manual payment (Cash, BankTransfer) or deposit towards a reservation.
/// Enforces property scoping, advisory and row locks, idempotency key replay, and folio balance validation.
/// </summary>
public sealed record CreatePaymentCommand(
    Guid PropertyId,
    Guid ReservationId,
    decimal Amount,
    PaymentMethod Method,
    string? TransactionRef = null,
    string? IdempotencyKey = null,
    bool IsDeposit = false
) : IRequest<PaymentDto>;
