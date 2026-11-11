using System;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Data transfer object representing a refund request item in the cashier management list (Decision D23).
/// </summary>
public sealed record RefundRequestDto(
    Guid PaymentId,
    Guid TenantId,
    Guid PropertyId,
    string PropertyName,
    Guid ReservationId,
    string ConfirmationCode,
    string GuestName,
    string? GuestEmail,
    string? GuestPhone,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal CancellationFee,
    decimal RefundableAmount,
    string Method,
    string Status, // "PendingApproval", "Approved", "Completed", "Rejected"
    string StatusName,
    string? TransactionRef,
    string? BankTransactionRef,
    Guid? ApprovedByUserId,
    string? ApprovedByUserName,
    DateTime? ApprovedAtUtc,
    DateTime? PaidAtUtc,
    string? RejectionReason,
    string? Notes,
    DateTime CreatedAtUtc
);
