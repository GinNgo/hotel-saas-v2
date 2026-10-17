using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Enumerates the operational cashier shifts in Vietnam hospitality workflow.
/// </summary>
public enum ShiftType
{
    Morning = 1,    // 06:00 - 14:00 (UTC+7)
    Afternoon = 2,  // 14:00 - 22:00 (UTC+7)
    Night = 3       // 22:00 - 06:00 sáng hôm sau (UTC+7)
}

/// <summary>
/// Data transfer object representing a verified cashier shift report,
/// strictly isolating shift collections and line-by-line shift audit from full-day revenue summaries.
/// </summary>
public sealed record ShiftReportDto(
    Guid PropertyId,
    DateOnly Date,
    ShiftType ShiftType,
    string ShiftName,
    DateTime ShiftStartUtc,
    DateTime ShiftEndUtc,
    decimal TotalCollected,
    decimal CashCollected,
    decimal BankTransferCollected,
    decimal CreditCardCollected,
    int CompletedCount,
    IReadOnlyList<PaymentDto> Payments
);
