using System;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Data transfer object summarizing cashier collection metrics for a property on a specific date.
/// </summary>
public sealed record PaymentSummaryDto(
    Guid PropertyId,
    DateOnly Date,
    decimal TotalCollected,
    decimal CashCollected,
    decimal BankTransferCollected,
    decimal CreditCardCollected,
    int CompletedCount
);
