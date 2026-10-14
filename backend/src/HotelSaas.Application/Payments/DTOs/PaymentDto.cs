using System;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Payments.DTOs;

/// <summary>
/// Data transfer object representing a payment transaction.
/// </summary>
public sealed record PaymentDto(
    Guid Id,
    Guid TenantId,
    Guid PropertyId,
    Guid ReservationId,
    decimal Amount,
    PaymentMethod Method,
    string MethodName,
    PaymentStatus Status,
    string StatusName,
    string? TransactionRef,
    DateTime? PaidAtUtc,
    DateTime CreatedAtUtc
)
{
    public static PaymentDto FromEntity(Payment payment)
    {
        return new PaymentDto(
            payment.Id,
            payment.TenantId,
            payment.PropertyId,
            payment.ReservationId,
            payment.Amount,
            payment.Method,
            payment.Method.ToString(),
            payment.Status,
            payment.Status.ToString(),
            payment.TransactionRef,
            payment.PaidAtUtc,
            payment.CreatedAtUtc
        );
    }
}
