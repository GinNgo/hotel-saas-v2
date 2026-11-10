using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Commands.ApproveRefund;

/// <summary>
/// Command to approve a pending refund request (Decision D23 / PAYMENTS:Approve permission).
/// </summary>
public sealed record ApproveRefundCommand(
    Guid PaymentId,
    Guid PropertyId,
    string? Notes = null
) : IRequest<RefundRequestDto>;
