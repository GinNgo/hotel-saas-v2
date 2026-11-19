using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReportCsv;

public sealed record ExportReportCsvQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? PropertyId = null
) : IRequest<ExportedReportFileDto>;
