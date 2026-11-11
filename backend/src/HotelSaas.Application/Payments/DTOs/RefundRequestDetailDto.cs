using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Detailed DTO for viewing and processing a refund request (Decision D23).
/// Includes original payment records, applied cancellation policies, and D23 audit trail history.
/// </summary>
public sealed record RefundRequestDetailDto(
    Guid PaymentId,
    Guid TenantId,
    Guid PropertyId,
    string PropertyName,
    Guid ReservationId,
    string ConfirmationCode,
    string GuestName,
    string? GuestEmail,
    string? GuestPhone,
    string RoomTypeName,
    string RoomNumber,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal CancellationFee,
    decimal RefundableAmount,
    string Method,
    string Status, // "PendingApproval", "Approved", "Completed", "Rejected"
    string StatusName,
    string? TransactionRef,
    string? BankTransactionRef,
    string PolicyDescription,
    bool IsFreeCancellation,
    int HoursUntilCheckIn,
    Guid? ApprovedByUserId,
    string? ApprovedByUserName,
    DateTime? ApprovedAtUtc,
    DateTime? PaidAtUtc,
    string? RejectionReason,
    string? Notes,
    DateTime CreatedAtUtc,
    bool CanApprove, // Whether caller has PAYMENTS:Approve permission
    IReadOnlyList<RefundPaymentHistoryDto> OriginalPayments,
    IReadOnlyList<RefundAuditStepDto> AuditTrail
);

public sealed record RefundPaymentHistoryDto(
    Guid Id,
    decimal Amount,
    string MethodName,
    string StatusName,
    string? TransactionRef,
    DateTime? PaidAtUtc,
    DateTime CreatedAtUtc
);

public sealed record RefundAuditStepDto(
    string StepTitle,
    string Description,
    string? PerformedBy,
    DateTime? TimestampUtc,
    string State // "completed", "current", "upcoming", "failed"
);
