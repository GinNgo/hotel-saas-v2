using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetPaymentSummary;

/// <summary>
/// Query to summarize cashier revenue and collection breakdown for a property on a specific date.
/// </summary>
public sealed record GetPaymentSummaryQuery(
    Guid PropertyId,
    DateOnly? Date = null
) : IRequest<PaymentSummaryDto>;
