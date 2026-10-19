using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GetShiftReport;

/// <summary>
/// Query to retrieve a verified cashier shift collection report and audit line items.
/// </summary>
public sealed record GetShiftReportQuery(
    Guid PropertyId,
    DateOnly? Date = null,
    ShiftType ShiftType = ShiftType.Morning
) : IRequest<ShiftReportDto>;
