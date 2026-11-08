using System;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetRefundRequests;

/// <summary>
/// Query to retrieve a paginated list of refund requests for the active property scope.
/// </summary>
public sealed record GetRefundRequestsQuery(
    Guid PropertyId,
    string? Status = null, // "all", "PendingApproval", "Approved", "Completed", "Rejected"
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    string? SearchTerm = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<PagedResult<RefundRequestDto>>;
