using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.GetRevenueSummary;

public sealed record GetRevenueSummaryQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? PropertyId = null,
    Guid? RoomTypeId = null
) : IRequest<RevenueSummaryDto>;
