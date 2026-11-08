using System;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Payments.Commands.ConfirmRefundPayout;

/// <summary>
/// Command to confirm successful refund payout after physical disbursement or bank transfer has been executed (Decision D23).
/// Requires a valid bank transaction reference or payment voucher code.
/// </summary>
public sealed record ConfirmRefundPayoutCommand(
    Guid PaymentId,
    Guid PropertyId,
    PaymentMethod PayoutMethod,
    string BankTransactionRef,
    string? Notes = null
) : IRequest<RefundRequestDto>;
