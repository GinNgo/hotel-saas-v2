using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.GetPmsKpi;

public sealed record GetPmsKpiQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? PropertyId = null,
    Guid? RoomTypeId = null
) : IRequest<PmsKpiDto>;
