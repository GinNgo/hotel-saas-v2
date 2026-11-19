using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReportPdf;

public sealed record ExportReportPdfQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? PropertyId = null
) : IRequest<ExportedReportFileDto>;
