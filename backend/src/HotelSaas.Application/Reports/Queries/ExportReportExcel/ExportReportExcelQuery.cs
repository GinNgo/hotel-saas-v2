using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReportExcel;

public sealed record ExportReportExcelQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? PropertyId = null
) : IRequest<ExportedReportFileDto>;
