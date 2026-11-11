using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Commands.RejectRefund;

/// <summary>
/// Command to reject a pending refund request with a mandatory reason (Decision D23 / PAYMENTS:Approve permission).
/// </summary>
public sealed record RejectRefundCommand(
    Guid PaymentId,
    Guid PropertyId,
    string Reason
) : IRequest<RefundRequestDto>;
