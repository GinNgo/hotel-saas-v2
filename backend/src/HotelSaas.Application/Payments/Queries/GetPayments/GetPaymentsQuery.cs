using System;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetPayments;

/// <summary>
/// Query to list payment history within the active property scope with filtering and pagination.
/// </summary>
public sealed record GetPaymentsQuery(
    Guid PropertyId,
    Guid? ReservationId = null,
    PaymentMethod? Method = null,
    PaymentStatus? Status = null,
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<PagedResult<PaymentDto>>;
