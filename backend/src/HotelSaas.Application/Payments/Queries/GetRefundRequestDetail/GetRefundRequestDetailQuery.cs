using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetRefundRequestDetail;

/// <summary>
/// Query to retrieve full details and audit history for a single refund request.
/// </summary>
public sealed record GetRefundRequestDetailQuery(
    Guid PaymentId,
    Guid PropertyId
) : IRequest<RefundRequestDetailDto>;
